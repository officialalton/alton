-- P2/P3 2단계 — 예약 전 회차 준비 화면을 실제 수업에 연결하면서 pin 경로에
-- 두 가지를 더한다.
--   (1) 고정 시점의 문제 버전을 매니페스트에 박는다. 20261293000000이
--       session_content_manifest.problem_version_id를 추가했지만 채우는 곳이
--       없어서, 문제만 교재와 달리 "고정 시점 재현"이 되지 않고 있었다.
--   (2) 이 수업이 다룬 회차를 session_curriculum_units에 기록한다
--       (20261292000000에서 만든 표. 지금까지 쓰는 경로가 없었다).
-- 나머지 본문은 20261238000000의 정의를 그대로 유지한다 — 인가 (0a)~(0f)와
-- 재검증 루프는 손대지 않는다.

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
  v_unit_selection_id uuid;
  v_problem_version uuid;
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

  -- (0e) 빈 pin 방지 — staged+included 콘텐츠 항목이 0개면 매니페스트 행을
  -- 하나도 쓰지 않고, status 전이도 하지 않은 채 즉시 실패한다.
  if not exists (
    select 1 from session_prepared_selection_content_items
    where prepared_selection_id = v_selection.id and included = true
  ) then
    raise exception '포함된(included) 콘텐츠가 하나도 없는 준비된 선택은 pin할 수 없습니다.';
  end if;

  -- (0f, corrective 2차 신규) 방어적 이중 확인(defense-in-depth) — 복합 FK가
  -- (prepared_selection_unit_id, prepared_selection_id) 조합을 구조적으로
  -- 강제하므로 이론상 이미 불가능해야 하지만, 이 함수 자신도 각 항목의
  -- prepared_selection_unit_id가 정말로 v_selection.id에 속하는 단원을
  -- 가리키는지 재확인한다. FK 하나만 맹신하지 않는다.
  for v_item in
    select id, prepared_selection_unit_id
    from session_prepared_selection_content_items
    where prepared_selection_id = v_selection.id and included = true
  loop
    select prepared_selection_id into v_unit_selection_id
    from session_prepared_selection_units
    where id = v_item.prepared_selection_unit_id;

    if v_unit_selection_id is distinct from v_selection.id then
      raise exception 'pin 시점 방어적 재확인 실패 — 콘텐츠 항목 %의 prepared_selection_unit_id(%)가 이 선택(%)에 속하지 않습니다.',
        v_item.id, v_item.prepared_selection_unit_id, v_selection.id;
    end if;
  end loop;

  -- (2) staged+included 항목을 전부 재검증한다 — 하나라도 실패하면 전체를
  -- 중단한다(매니페스트 행 0개, status 전이 없음). 각 항목은 자신이 지목한
  -- prepared_selection_unit_id의 키워드 범위 안에서만 검증한다(corrective —
  -- "이 선택의 아무 단원"이 아니다).
  for v_item in
    select id, content_type, content_id, position, prepared_selection_unit_id
    from session_prepared_selection_content_items
    where prepared_selection_id = v_selection.id and included = true
    order by position asc
  loop
    v_ok := false;

    if v_item.content_type = 'material_section' then
      select exists (
        select 1
        from session_prepared_selection_unit_keywords k
        join curriculum_doc_section_keywords_selectable sel
          on sel.section_id = v_item.content_id and sel.keyword_id = k.keyword_id
        where k.prepared_selection_unit_id = v_item.prepared_selection_unit_id
      ) into v_ok;
    elsif v_item.content_type = 'problem' then
      select exists (
        select 1
        from session_prepared_selection_unit_keywords k
        join problem_keywords_selectable sel
          on sel.problem_id = v_item.content_id and sel.keyword_id = k.keyword_id
        where k.prepared_selection_unit_id = v_item.prepared_selection_unit_id
      ) into v_ok;
    else
      raise exception '알 수 없는 콘텐츠 유형입니다: %', v_item.content_type;
    end if;

    if not v_ok then
      raise exception 'pin 시점 재검증 실패 — 선택 가능(published/confirmed)하지 않거나 범위 밖인 항목이 있습니다: % %', v_item.content_type, v_item.content_id;
    end if;
  end loop;

  -- (3) 전부 통과했으니(위 루프가 예외 없이 끝났으니) 이제 실제로 INSERT한다.
  -- display_position은 staged 항목의 순서(position asc)를 그대로 1..N으로
  -- 재부여한다(exclude로 생긴 gap을 그대로 노출하지 않는다). source_overlay_unit_id는
  -- 각 항목의 prepared_selection_unit_id → 그 단원 행의 overlay_unit_id로
  -- 가는 직접 조인으로 도출한다 — 임의 선택(order by position limit 1) 없음.
  for v_item in
    select id, content_type, content_id, position, prepared_selection_unit_id
    from session_prepared_selection_content_items
    where prepared_selection_id = v_selection.id and included = true
    order by position asc
  loop
    v_pos := v_pos + 1;
    v_doc_version := null;

    select u.overlay_unit_id into v_source_unit
    from session_prepared_selection_units u
    where u.id = v_item.prepared_selection_unit_id;

    v_problem_version := null;

    if v_item.content_type = 'material_section' then
      select d.updated_at into v_doc_version
      from curriculum_doc_sections s
      join curriculum_docs d on d.id = s.curriculum_doc_id
      where s.id = v_item.content_id;
    elsif v_item.content_type = 'problem' then
      -- P2 2단계 — 교재가 published_doc_version_at_pin으로 하는 것과 같은 일을
      -- 문제에도 한다. 20261293000000이 컬럼만 추가하고 쓰는 곳이 없었다.
      -- 이후 새 버전이 공개돼도 이 수업은 지금 공개본을 그대로 재현한다.
      select p.published_version_id into v_problem_version
      from problems p where p.id = v_item.content_id;
    end if;

    insert into session_content_manifest
      (session_id, content_type, content_id, source_overlay_unit_id, display_position, published_doc_version_at_pin, problem_version_id)
    values
      (p_session_id, v_item.content_type, v_item.content_id, v_source_unit, v_pos, v_doc_version, v_problem_version);
  end loop;

  -- (3b, P3 2단계 신규) 이 수업이 어떤 회차를 다뤘는지 기록한다. 확정 정책상
  -- 회차 1개가 여러 수업에 연결될 수 있으므로(재수업·보강) 연결은 세션 쪽에
  -- 남긴다. 준비 화면에서 고른 순서의 첫 회차가 기본(primary), 나머지가
  -- 보강(supplement)이다. pin과 같은 트랜잭션 안에서 쓰기 때문에 "고정은 됐는데
  -- 회차 연결은 없는" 중간 상태가 생기지 않는다.
  insert into session_curriculum_units (session_id, overlay_unit_id, role)
  select
    p_session_id,
    u.overlay_unit_id,
    case when row_number() over (order by u.position asc) = 1 then 'primary' else 'supplement' end
  from session_prepared_selection_units u
  where u.prepared_selection_id = v_selection.id
  on conflict (session_id, overlay_unit_id) do nothing;

  -- (4) 매니페스트가 전부 채워진 뒤에만 status를 전이한다. RLS를 우회하는
  -- SECURITY DEFINER 함수 안이므로 위에서 좁힌 "쓰기" 정책의 영향을 받지 않는다.
  update session_prepared_selections
  set status = 'pinned', pinned_at = now()
  where id = v_selection.id;

  return query select * from session_content_manifest where session_id = p_session_id order by display_position;
end;
$$;


comment on function public.pin_session_selection(uuid) is
  'R9(레슨 준비 Task 2) + P2/P3 2단계: session_content_manifest와 session_curriculum_units의 유일한 쓰기 경로. '
  'SECURITY DEFINER라 RLS/앱 레벨 가드가 자동 적용되지 않으므로 (0a)~(0f) 인가/불변조건을 본문에서 스스로 검사한다. '
  '검증 → 매니페스트 INSERT(교재는 문서 버전, 문제는 공개 버전을 고정) → 회차 연결 기록 → status 전이를 한 트랜잭션에서 '
  '원자적으로 수행한다(부분 freeze 없음).';

-- search_path/EXECUTE 그랜트는 20261233000000에서 고정돼있고 같은 시그니처
-- CREATE OR REPLACE라 바뀌지 않는다.
