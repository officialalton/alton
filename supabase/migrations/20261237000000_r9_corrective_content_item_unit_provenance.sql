-- R9 — corrective: session_prepared_selection_content_items의 단원 출처(provenance)를
-- 명시적으로 기록하고, pin_session_selection()의 source_overlay_unit_id 도출을
-- 휴리스틱에서 명시적 조인으로 바꾼다.
--
-- 배경(제품 오너 리뷰에서 발견한 실제 구멍, Task 1/2
-- (20261232000000_r9_session_prepared_selection.sql,
-- 20261233000000_r9_session_content_manifest.sql) 구현 이후):
--
--   session_prepared_selection_content_items는 그동안 "이 콘텐츠를 pick할 때
--   선생님이 어느 단원(session_prepared_selection_units 행)을 편성하고 있었는지"를
--   전혀 저장하지 않았다 — 저장된 컬럼은 (prepared_selection_id, content_type,
--   content_id, position, included, added_at)뿐이었다. 그 결과
--   check_prepared_content_item_selectable() INSERT 트리거와
--   pin_session_selection()의 source_overlay_unit_id 도출 쿼리 둘 다
--   "이 콘텐츠가 이 선택에 속한 단원들(SESSION_PREPARED_SELECTION_UNITS u
--   ... WHERE u.prepared_selection_id = ...) '중 아무거나' 하나라도 키워드
--   범위에 포함되는가"만 확인했고, source_overlay_unit_id는 그 매칭되는 단원들
--   중 "order by u.position asc limit 1"로 임의로 하나를 골랐다. 한 선택에
--   단원이 여러 개이고 같은 콘텐츠가 두 단원의 활성 키워드 범위에 동시에
--   들어가는 경우(예: 복습 단원과 새 진도 단원이 겹치는 키워드를 공유), 선생님이
--   실제로는 단원 B를 편성하며 그 콘텐츠를 골랐어도 매니페스트에는 항상 position이
--   더 앞선 단원(대개 단원 A)이 출처로 기록됐다 — 실제 편성 맥락과 무관한
--   임의 선택이었다.
--
-- 해법(이번 corrective, 계획서 명시 범위를 넘어선 교정):
--   1) session_prepared_selection_content_items에 prepared_selection_unit_id
--      (필수 FK → session_prepared_selection_units)를 추가한다 — 선생님이 이
--      콘텐츠를 pick할 때 편성하고 있던 그 단원을 명시적으로 기록한다.
--   2) check_prepared_content_item_selectable()을 확장해 (a) 그 단원이 실제로
--      같은 prepared_selection_id에 속하는지, (b) 콘텐츠가 '그 단원만의' 활성
--      키워드 범위(session_prepared_selection_unit_keywords, 그 단원 행 한정)
--      안에서 selectable한지 검사한다 — "이 선택의 아무 단원"이 아니라 "이
--      특정 단원"으로 좁힌다.
--   3) pin_session_selection()의 source_overlay_unit_id 도출을 각 스테이징
--      항목의 prepared_selection_unit_id → 그 단원 행의 overlay_unit_id로
--      가는 직접 조인으로 바꾼다. "order by position limit 1" 같은 임의 선택
--      로직은 완전히 제거한다.
--   4) 빈 pin 방지: staged+included 콘텐츠 항목이 0개인 채로 pin_session_selection()이
--      호출되면 매니페스트 행을 하나도 쓰지 않고 status 전이도 하지 않은 채
--      즉시 실패한다(이전에는 이 케이스를 막는 명시적 가드가 없었다 — 루프가
--      0회 돌고 곧장 status='pinned'로 전이해버릴 수 있었다는 뜻).
--
-- 기존 두 마이그레이션 파일(20261232000000, 20261233000000)은 이미 여러 번의
-- 리뷰를 거쳐 확정된 형태이므로 직접 편집하지 않고, 이 추가 마이그레이션으로만
-- 교정한다.

-- =========================================================================
-- 1. prepared_selection_unit_id 컬럼 추가 — 기존 행은 지금까지의 휴리스틱과
-- 동일한 방식(order by position limit 1)으로 1회성 백필한 뒤 NOT NULL로 잠근다
-- (이 마이그레이션 이후에 생성되는 행은 전부 애플리케이션이 명시적으로 값을
-- 넣어야 한다 — INSERT 트리거가 검증한다).
-- =========================================================================

alter table session_prepared_selection_content_items
  add column prepared_selection_unit_id uuid references session_prepared_selection_units (id) on delete cascade;

update session_prepared_selection_content_items ci
set prepared_selection_unit_id = (
  select u.id
  from session_prepared_selection_units u
  join session_prepared_selection_unit_keywords k on k.prepared_selection_unit_id = u.id
  join curriculum_doc_section_keywords_selectable sel
    on sel.section_id = ci.content_id and sel.keyword_id = k.keyword_id
  where u.prepared_selection_id = ci.prepared_selection_id and ci.content_type = 'material_section'
  order by u.position asc
  limit 1
)
where ci.content_type = 'material_section' and ci.prepared_selection_unit_id is null;

update session_prepared_selection_content_items ci
set prepared_selection_unit_id = (
  select u.id
  from session_prepared_selection_units u
  join session_prepared_selection_unit_keywords k on k.prepared_selection_unit_id = u.id
  join problem_keywords_selectable sel
    on sel.problem_id = ci.content_id and sel.keyword_id = k.keyword_id
  where u.prepared_selection_id = ci.prepared_selection_id and ci.content_type = 'problem'
  order by u.position asc
  limit 1
)
where ci.content_type = 'problem' and ci.prepared_selection_unit_id is null;

-- 위 백필로도 채울 수 없는 행(예: 백필 시점에 이미 selectable하지 않게 된
-- 콘텐츠)이 남아있으면 아무 단원에나 붙이지 않고 그 단원 목록의 첫 행으로
-- 폴백한다 — 이 마이그레이션은 로컬 개발 DB 리셋 흐름에서만 실행되므로(운영
-- 데이터 없음), 완벽한 이력 복원보다 NOT NULL 제약을 안전하게 걸 수 있는지가
-- 우선이다.
update session_prepared_selection_content_items ci
set prepared_selection_unit_id = (
  select u.id from session_prepared_selection_units u
  where u.prepared_selection_id = ci.prepared_selection_id
  order by u.position asc
  limit 1
)
where ci.prepared_selection_unit_id is null;

alter table session_prepared_selection_content_items
  alter column prepared_selection_unit_id set not null;

create index on session_prepared_selection_content_items (prepared_selection_unit_id);

comment on column session_prepared_selection_content_items.prepared_selection_unit_id is
  '이 콘텐츠를 pick할 때 선생님이 편성하고 있던 단원(session_prepared_selection_units 행) — 명시적 출처. 같은 콘텐츠가 이 선택의 여러 단원의 키워드 범위에 동시에 들어가더라도, 실제로 어느 단원을 편성하며 골랐는지가 여기 남는다(pin_session_selection()의 source_overlay_unit_id는 이 값에서 직접 도출된다 — 더 이상 임의 선택이 아니다).';

-- =========================================================================
-- 2. check_prepared_content_item_selectable() 확장 — 기존 "이 선택의 아무
-- 단원"이 아니라 "new.prepared_selection_unit_id로 지목된 그 단원"으로 검사를
-- 좁힌다. 기존 동작(selectable하지 않거나 범위 밖이면 거부)은 그대로 유지한다.
-- =========================================================================

create or replace function public.check_prepared_content_item_selectable()
returns trigger
language plpgsql as $$
declare
  v_unit_selection_id uuid;
  v_ok boolean;
begin
  perform public.check_prepared_selection_not_pinned(new.prepared_selection_id);

  -- (a) new.prepared_selection_unit_id가 실제로 존재하고, 이 콘텐츠 항목과
  -- 같은 prepared_selection_id에 속하는지 확인한다 — 선생님이 다른 선택(다른
  -- prepared_selection_id)의 단원을 이 콘텐츠의 출처로 지목하는 것을 구조적으로
  -- 막는다.
  select prepared_selection_id into v_unit_selection_id
  from session_prepared_selection_units
  where id = new.prepared_selection_unit_id;

  if v_unit_selection_id is null then
    raise exception '존재하지 않는 준비된 선택 단원입니다: %', new.prepared_selection_unit_id;
  end if;

  if v_unit_selection_id <> new.prepared_selection_id then
    raise exception '이 단원은 다른 준비된 선택에 속해 있어 출처로 지목할 수 없습니다: %', new.prepared_selection_unit_id;
  end if;

  -- (b) 콘텐츠가 '그 단원만의' 활성 키워드 범위(다른 단원의 키워드는 보지
  -- 않는다) 안에서 selectable한지 검사한다.
  if new.content_type = 'material_section' then
    select exists (
      select 1
      from session_prepared_selection_unit_keywords k
      join curriculum_doc_section_keywords_selectable sel
        on sel.section_id = new.content_id and sel.keyword_id = k.keyword_id
      where k.prepared_selection_unit_id = new.prepared_selection_unit_id
    ) into v_ok;
  elsif new.content_type = 'problem' then
    select exists (
      select 1
      from session_prepared_selection_unit_keywords k
      join problem_keywords_selectable sel
        on sel.problem_id = new.content_id and sel.keyword_id = k.keyword_id
      where k.prepared_selection_unit_id = new.prepared_selection_unit_id
    ) into v_ok;
  else
    raise exception '알 수 없는 콘텐츠 유형입니다: %', new.content_type;
  end if;

  if not v_ok then
    raise exception '선택 가능(published/confirmed)하지 않거나 이 단원의 키워드 범위 밖인 콘텐츠는 담을 수 없습니다: % %', new.content_type, new.content_id;
  end if;

  return new;
end;
$$;

-- 트리거 자체는 이미 20261232000000에서 생성돼 있으므로(create or replace
-- function만으로 본문이 바뀐다) 재생성하지 않는다.

comment on table session_prepared_selection_content_items is
  'R9(레슨 준비 Task 1, corrective로 단원 출처 보강): 선생님이 명시적으로 pick/exclude/order한 실제 교재 조각/문제 목록 — pinSessionSelection()(Task 2)이 얼려 넣는 실제 페이로드. included=false는 소프트 제외(행 유지). prepared_selection_unit_id는 pick 당시 편성 중이던 단원의 명시적 출처(corrective) — INSERT 시점 트리거가 그 단원 소속+키워드 범위 내인지 검사한다.';

-- =========================================================================
-- 3. pin_session_selection() 재작성 — source_overlay_unit_id를 각 스테이징
-- 항목의 prepared_selection_unit_id → 그 단원 행의 overlay_unit_id로 가는 직접
-- 조인으로 도출한다("order by position limit 1" 완전 제거). 재검증도 이제
-- '그 항목이 지목한 그 단원'의 키워드 범위 안에서만 selectable한지 확인한다.
-- 빈 pin 방지 가드를 새로 추가한다(요구사항 4).
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

  -- (0e, corrective 신규) 빈 pin 방지 — staged+included 콘텐츠 항목이 0개면
  -- 매니페스트 행을 하나도 쓰지 않고, status 전이도 하지 않은 채 즉시 실패한다.
  if not exists (
    select 1 from session_prepared_selection_content_items
    where prepared_selection_id = v_selection.id and included = true
  ) then
    raise exception '포함된(included) 콘텐츠가 하나도 없는 준비된 선택은 pin할 수 없습니다.';
  end if;

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

    if v_item.content_type = 'material_section' then
      select d.updated_at into v_doc_version
      from curriculum_doc_sections s
      join curriculum_docs d on d.id = s.curriculum_doc_id
      where s.id = v_item.content_id;
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
  'R9(레슨 준비 Task 2, corrective로 provenance 직접 조인 + 빈 pin 방지 보강): session_content_manifest의 유일한 쓰기 경로. SECURITY DEFINER라 RLS/앱 레벨 가드가 자동 적용되지 않으므로, 함수 본문 맨 앞에서 (0a)~(0e) 인가/불변조건을 스스로 전부 검사한다. source_overlay_unit_id는 각 항목의 prepared_selection_unit_id에서 직접 도출한다(더 이상 임의 선택 없음). 검증→INSERT→status 전이를 한 트랜잭션 안에서 원자적으로 수행한다(부분 freeze 없음).';

-- search_path/EXECUTE 그랜트는 20261233000000에서 이미 고정돼있고 이 함수
-- 재정의로 바뀌지 않으므로(같은 시그니처 CREATE OR REPLACE) 다시 선언하지
-- 않는다.
