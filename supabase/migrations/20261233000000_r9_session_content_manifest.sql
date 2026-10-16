-- R9 — 레슨 준비/세션 선택 2/N: 불변 세션 콘텐츠 매니페스트 + pinSessionSelection()
--
-- 배경(docs/superpowers/plans/2026-09-08-lesson-prep-session-selection.md Task 2,
-- v4 확정): Task 1은 선생님이 세션별로 명시적으로 pick/exclude/order한 콘텐츠
-- 목록(session_prepared_selection_content_items)까지만 만든다. 이 마이그레이션은
-- 그 목록을 pin 시점에 "그대로 한 번만" 얼려 넣는 session_content_manifest와,
-- 그 얼림을 수행하는 유일한 함수 pin_session_selection()을 추가한다.
--
-- 핵심 설계 결정(계획서 그대로):
--   1) session_content_manifest는 어떤 ordinary role(teacher/authenticated)에게도
--      INSERT/UPDATE/DELETE 권한이 전혀 없다 — staged 상태든 pinned 상태든 예외
--      없이. 유일한 쓰기 경로는 pin_session_selection()(SECURITY DEFINER)의
--      함수 본문 안 INSERT뿐이다. "완화했다가 트리거로 잠그는" 패턴이 아니라
--      "테이블 권한 자체가 애초에 없는" 더 강한 보장이다.
--   2) pin_session_selection()은 SECURITY DEFINER라 호출자의 RLS/앱 레벨 가드가
--      자동으로 적용되지 않는다 — 함수 본문 맨 앞에서 스스로 인가를 전부 검사한다
--      (0a auth.uid() null 거부, 0b 담당 선생님/관리자만, 0c 넘어온 sessionId가
--      실제로 이 staged 선택에 붙어있는지, 0d 세션과 선택의 subject_enrollment_id
--      일치). 이 네 검사 중 하나라도 실패하면 매니페스트 행도 status 전이도
--      전혀 일어나지 않는다.
--   3) 재검증은 pick 시점(Task 1)과 별개로 pin 시점에 다시 한다 — pick 이후
--      unpublish/unconfirm된 항목이 있으면 그 항목을 지목해 전체 pin을 실패시키고
--      부분 freeze를 남기지 않는다.
--   4) 이 마이그레이션은 또한 지난 corrective(20261236000000)가 남긴 구멍을
--      닫는다: session_prepared_selections에 대한 Task 1의 "담당 선생님/관리자만
--      쓰기" 정책이 그 자체로 status='pinned' 직접 UPDATE까지 허용하고 있었다
--      (블랙릿 ALL 정책이라 status 컬럼을 특별 취급하지 않았음) — 즉 선생님이
--      pin_session_selection()을 거치지 않고 그냥
--      `update session_prepared_selections set status = 'pinned'`를 실행해도
--      막을 방법이 없었다(매니페스트가 0행인 채로 세션이 "pinned"로 표시되는
--      결과). 고른 해법: RLS WITH CHECK 자체에서 "새 행의 status가 'pinned'인
--      UPDATE/INSERT는 ordinary role 정책으로 통과할 수 없다"로 좁힌다(옵션
--      (b), 컬럼 값 기반 WITH CHECK 좁히기 — 세션-트랜잭션 로컬 플래그 방식은
--      지난 GUC corrective가 증명했듯 authenticated 세션이 스스로 설정 가능한
--      어떤 마커도 흉내낼 수 있어 안전하지 않다고 판단했다). pin_session_selection()은
--      SECURITY DEFINER 함수 소유자(마이그레이션을 실행하는 슈퍼유저) 권한으로
--      돌아가 RLS를 통째로 우회하므로 이 좁힌 정책의 영향을 받지 않는다.

-- =========================================================================
-- 1. session_content_manifest — pin 시점에 1회만 채워지는 불변 매니페스트.
-- =========================================================================

create table session_content_manifest (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  content_type session_prepared_selection_content_type not null,
  content_id uuid not null,
  source_overlay_unit_id uuid references curriculum_overlay_units (id) on delete set null,
  display_position int not null,
  -- curriculum_docs/problems에는 별도 버전 테이블/컬럼이 없다(검토 완료 —
  -- curriculum_doc_versions 같은 테이블은 이 스키마에 존재하지 않는다). 감사/
  -- 표시용으로 pin 시점 curriculum_docs.updated_at 스냅샷을 기록한다(material_section만
  -- 값이 있고 problem은 null). 이 값으로 나중에 "다른 버전"을 다시 불러오지 않는다.
  published_doc_version_at_pin timestamptz,
  created_at timestamptz not null default now(),
  unique (session_id, content_type, content_id),
  unique (session_id, display_position)
);
create index on session_content_manifest (session_id);

comment on table session_content_manifest is
  'R9(레슨 준비 Task 2): 세션별 불변 콘텐츠 매니페스트 — pin_session_selection()이 한 번만 채운다. 어떤 ordinary role에게도 INSERT/UPDATE/DELETE 그랜트가 없다(아래 섹션 참고). session_prepared_selection_content_items의 staged+included 목록의 1:1 스냅샷일 뿐, 키워드/단원 파생 쿼리가 아니다.';

alter table session_content_manifest enable row level security;

-- 조회: 담당 선생님/관리자/본인 학생(세션 → subject_enrollment_id 경유).
create policy "담당 선생님/본인 학생/관리자만 조회" on session_content_manifest for select
  using (
    is_admin()
    or exists (
      select 1 from sessions s
      where s.id = session_id
        and (
          is_active_teacher_for_enrollment(s.subject_enrollment_id)
          or is_owning_student_for_enrollment(s.subject_enrollment_id)
        )
    )
  );

-- 쓰기 정책은 의도적으로 두지 않는다 — INSERT/UPDATE/DELETE에 대해 아무 정책도
-- 없으면 RLS가 기본적으로 전부 거부한다. 게다가 아래에서 테이블 권한 자체를
-- authenticated/anon/public에서 회수해 "정책이 있었는데 우연히 통과" 시나리오도
-- 원천 차단한다(이 프로젝트의 기본 ACL은 새 테이블에 대해 authenticated에게
-- ALL을 자동으로 부여하므로, 명시적으로 되돌려야 한다 — 함수 EXECUTE 권한의
-- 기본 자동부여 문제를 고쳤던 20260907000000_r2_workspace_preflight_permissions_fix.sql과
-- 같은 이유).
revoke insert, update, delete, truncate on session_content_manifest from public, anon, authenticated;
grant select on session_content_manifest to authenticated;

-- =========================================================================
-- 2. session_prepared_selections에 대한 "쓰기" RLS 정책을 좁힌다 — ordinary
-- role이 status를 'pinned'로 직접 전이시키는 UPDATE는 이 정책으로 통과할 수
-- 없다. status='pinned'로의 전이는 오직 pin_session_selection()(아래, RLS를
-- 우회하는 SECURITY DEFINER)을 통해서만 가능하다.
-- =========================================================================

drop policy if exists "담당 선생님/관리자만 쓰기" on session_prepared_selections;
create policy "담당 선생님/관리자만 쓰기" on session_prepared_selections for all
  using (is_admin() or is_active_teacher_for_enrollment(subject_enrollment_id))
  with check (
    (is_admin() or is_active_teacher_for_enrollment(subject_enrollment_id))
    and status <> 'pinned'
  );

comment on table session_prepared_selections is
  'R9(레슨 준비 Task 1, Task 2에서 RLS 보강): 세션 콘텐츠 준비 스테이징 컨테이너. session_id가 null이면 임시보관함. status=pinned 이후에는 이 행과 하위 3개 테이블 전부 수정 불가(트리거). ordinary role의 쓰기 RLS는 status=''pinned''로의 전이 자체를 통과시키지 않는다(Task 2 WITH CHECK) — pinned 전이는 오직 pin_session_selection() SECURITY DEFINER를 통해서만 가능하다.';

-- =========================================================================
-- 3. pin_session_selection(p_session_id) — 유일한 매니페스트 쓰기 경로.
-- =========================================================================

create or replace function public.pin_session_selection(p_session_id uuid)
returns setof session_content_manifest
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid;
  v_selection session_prepared_selections;
  v_session_enrollment uuid;
  v_final_status v3_session_final_status;
  v_item record;
  v_source_unit uuid;
  v_doc_version timestamptz;
  v_ok boolean;
  v_pos int := 0;
begin
  -- (0a) 인증되지 않은 호출은 거부한다.
  v_caller := auth.uid();
  if v_caller is null then
    raise exception '인증되지 않은 호출입니다.';
  end if;

  -- (0b)/(0c) 넘어온 sessionId에 현재 attach된 staged 선택을 찾는다(없으면
  -- "이 sessionId에 붙은 staged 선택이 없다" = 0c 위반, 다른 선택을 대상
  -- session과 섞어 pin하는 것을 구조적으로 막는다).
  select s.* into v_selection
  from session_prepared_selections s
  where s.session_id = p_session_id and s.status = 'staged';

  if not found then
    raise exception '이 세션에 attach된 staged 준비된 선택을 찾을 수 없습니다.';
  end if;

  -- (0b) 호출자가 이 선택의 담당(활성) 선생님이거나 관리자여야 한다.
  if not (
    is_admin()
    or (v_caller = v_selection.teacher_id and is_active_teacher_for_enrollment(v_selection.subject_enrollment_id))
  ) then
    raise exception '이 준비된 선택을 pin할 권한이 없습니다.';
  end if;

  -- (0d) 세션의 subject_enrollment_id와 선택의 subject_enrollment_id가 일치해야
  -- 한다(정상 흐름에서는 항상 일치하지만, 데이터 정합성이 깨진 경우에 대한
  -- 방어적 이중 확인).
  select subject_enrollment_id, final_status into v_session_enrollment, v_final_status
  from sessions where id = p_session_id;

  if v_session_enrollment is distinct from v_selection.subject_enrollment_id then
    raise exception '세션과 준비된 선택의 subject_enrollment_id가 일치하지 않습니다.';
  end if;

  if v_final_status <> 'scheduled' then
    raise exception '이미 시작/종료된 세션은 pin할 수 없습니다.';
  end if;

  -- (2) staged+included 항목을 전부 재검증한다 — 하나라도 실패하면 전체를
  -- 중단한다(매니페스트 행 0개, status 전이 없음).
  for v_item in
    select id, content_type, content_id, position
    from session_prepared_selection_content_items
    where prepared_selection_id = v_selection.id and included = true
    order by position asc
  loop
    v_source_unit := null;
    v_ok := false;

    if v_item.content_type = 'material_section' then
      select u.overlay_unit_id into v_source_unit
      from session_prepared_selection_units u
      join session_prepared_selection_unit_keywords k on k.prepared_selection_unit_id = u.id
      join curriculum_doc_section_keywords_selectable sel
        on sel.section_id = v_item.content_id and sel.keyword_id = k.keyword_id
      where u.prepared_selection_id = v_selection.id
      order by u.position asc
      limit 1;
      v_ok := found;
    elsif v_item.content_type = 'problem' then
      select u.overlay_unit_id into v_source_unit
      from session_prepared_selection_units u
      join session_prepared_selection_unit_keywords k on k.prepared_selection_unit_id = u.id
      join problem_keywords_selectable sel
        on sel.problem_id = v_item.content_id and sel.keyword_id = k.keyword_id
      where u.prepared_selection_id = v_selection.id
      order by u.position asc
      limit 1;
      v_ok := found;
    else
      raise exception '알 수 없는 콘텐츠 유형입니다: %', v_item.content_type;
    end if;

    if not v_ok then
      raise exception 'pin 시점 재검증 실패 — 선택 가능(published/confirmed)하지 않거나 범위 밖인 항목이 있습니다: % %', v_item.content_type, v_item.content_id;
    end if;
  end loop;

  -- (3) 전부 통과했으니(위 루프가 예외 없이 끝났으니) 이제 실제로 INSERT한다.
  -- display_position은 staged 항목의 순서(position asc)를 그대로 1..N으로
  -- 재부여한다(exclude로 생긴 gap을 그대로 노출하지 않는다).
  for v_item in
    select id, content_type, content_id, position
    from session_prepared_selection_content_items
    where prepared_selection_id = v_selection.id and included = true
    order by position asc
  loop
    v_pos := v_pos + 1;
    v_source_unit := null;
    v_doc_version := null;

    if v_item.content_type = 'material_section' then
      select u.overlay_unit_id into v_source_unit
      from session_prepared_selection_units u
      join session_prepared_selection_unit_keywords k on k.prepared_selection_unit_id = u.id
      join curriculum_doc_section_keywords_selectable sel
        on sel.section_id = v_item.content_id and sel.keyword_id = k.keyword_id
      where u.prepared_selection_id = v_selection.id
      order by u.position asc
      limit 1;

      select d.updated_at into v_doc_version
      from curriculum_doc_sections s
      join curriculum_docs d on d.id = s.curriculum_doc_id
      where s.id = v_item.content_id;
    else
      select u.overlay_unit_id into v_source_unit
      from session_prepared_selection_units u
      join session_prepared_selection_unit_keywords k on k.prepared_selection_unit_id = u.id
      join problem_keywords_selectable sel
        on sel.problem_id = v_item.content_id and sel.keyword_id = k.keyword_id
      where u.prepared_selection_id = v_selection.id
      order by u.position asc
      limit 1;
    end if;

    insert into session_content_manifest
      (session_id, content_type, content_id, source_overlay_unit_id, display_position, published_doc_version_at_pin)
    values
      (p_session_id, v_item.content_type, v_item.content_id, v_source_unit, v_pos, v_doc_version);
  end loop;

  -- (4) 매니페스트가 전부 채워진 뒤에만 status를 전이한다. RLS를 우회하는
  -- SECURITY DEFINER 함수 안이므로 위에서 좁힌 "쓰기" 정책의 영향을 받지 않는다.
  update session_prepared_selections
  set status = 'pinned', pinned_at = now()
  where id = v_selection.id;

  return query select * from session_content_manifest where session_id = p_session_id order by display_position;
end;
$$;

comment on function public.pin_session_selection(uuid) is
  'R9(레슨 준비 Task 2): session_content_manifest의 유일한 쓰기 경로. SECURITY DEFINER라 RLS/앱 레벨 가드가 자동 적용되지 않으므로, 함수 본문 맨 앞에서 (0a)~(0d) 인가를 스스로 전부 검사한다. 검증→INSERT→status 전이를 한 트랜잭션 안에서 원자적으로 수행한다(부분 freeze 없음).';

-- search_path 고정 + PUBLIC EXECUTE 회수 + authenticated에게만 허용(Postgres가
-- 함수 생성 시 PUBLIC에 EXECUTE를 기본 부여하는 것을 되돌린다).
revoke execute on function public.pin_session_selection(uuid) from public, anon;
grant execute on function public.pin_session_selection(uuid) to authenticated;
