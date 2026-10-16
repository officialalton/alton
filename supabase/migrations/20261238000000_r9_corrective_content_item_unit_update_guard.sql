-- R9 — corrective(2차): session_prepared_selection_content_items.prepared_selection_unit_id를
-- INSERT 시점뿐 아니라 UPDATE 시점에도 "같은 prepared_selection_id에 속한 단원인가"로
-- 구조적으로 잠근다.
--
-- 배경(제품 오너 리뷰에서 발견한 실제 구멍, 20261237000000 승인 직후):
--
--   20261237000000이 추가한 prepared_selection_unit_id 컬럼과
--   check_prepared_content_item_selectable() 트리거는 BEFORE INSERT에만 걸려
--   있었다(20261232000000의 트리거 정의를 그대로 재사용 — 함수 본문만
--   CREATE OR REPLACE로 바꿨을 뿐 트리거 자체는 다시 만들지 않음). 반면
--   session_prepared_selection_content_items_lock() 트리거(BEFORE UPDATE OR
--   DELETE)는 오직 "부모 선택이 아직 pinned가 아닌가"만 검사하고, 바뀌는
--   컬럼이 무엇인지는 전혀 보지 않는다. 그 결과 staged 상태에서 담당 선생님이
--   자신의 스테이징 항목의 prepared_selection_unit_id를 완전히 다른
--   session_prepared_selections(다른 선생님/다른 학생/다른 subject_enrollment)에
--   속한 단원 id로 UPDATE해도 아무 트리거도 막지 않았다. pin_session_selection()은
--   그렇게 저장된 prepared_selection_unit_id를 그대로 믿고 그 단원 행의
--   overlay_unit_id를 source_overlay_unit_id로 매니페스트에 복사하므로, 한 학생의
--   세션 매니페스트가 다른 학생의 커리큘럼 오버레이 단원을 출처로 갖게 될 수
--   있었다 — 크로스 테넌트/크로스 학생 데이터 유출.
--
-- 해법(이번 corrective, 20261237000000을 승인 조건부로 막던 구멍을 닫는다):
--   1) session_prepared_selection_units(id, prepared_selection_id)에 복합
--      유니크 제약을 추가한다(id 단독으로도 이미 유니크이므로 추가해도 기존
--      동작에 영향 없음 — 순수 additive) — 이 복합 유니크가 있어야 이 조합을
--      대상으로 하는 복합 FK를 걸 수 있다.
--   2) session_prepared_selection_content_items(prepared_selection_unit_id,
--      prepared_selection_id)에 복합 FK를 건다 → 위 복합 유니크를 참조한다.
--      이제 "이 두 컬럼이 서로 다른 선택을 가리키는" 행은 Postgres 자체가
--      구조적으로 거부한다 — 트리거가 아니라 제약이다. 기존 단독 FK
--      (prepared_selection_unit_id → session_prepared_selection_units(id))와
--      (prepared_selection_id → session_prepared_selections(id))는 그대로
--      유지한다(복합 FK가 추가로 얹힐 뿐 대체하지 않는다 — ON DELETE CASCADE도
--      단독 FK 쪽에서 계속 담당하므로 삭제 동작은 바뀌지 않는다).
--   3) check_prepared_content_item_selectable() 트리거를 BEFORE INSERT OR
--      UPDATE OF prepared_selection_id, prepared_selection_unit_id,
--      content_type, content_id로 확장한다 — 이 네 컬럼 중 하나라도 바뀌는
--      UPDATE는 INSERT와 동일한 전체 재검증(단원 소속 + 그 단원만의 키워드
--      범위 내 selectable)을 다시 받는다.
--   4) pin_session_selection()에 방어적 이중 확인(defense-in-depth)을 추가한다
--      — 복합 FK가 구조적으로 막아주더라도, pin 시점에 각 스테이징 항목의
--      prepared_selection_unit_id가 실제로 v_selection.id에 속하는지 함수
--      자신이 명시적으로 다시 확인한다(FK 하나만 맹신하지 않는다).
--
-- 20261232000000/20261233000000/20261237000000은 이미 승인된 형태이므로 직접
-- 편집하지 않고 이 추가 마이그레이션으로만 교정한다.

-- =========================================================================
-- 1. 복합 유니크 제약 (id, prepared_selection_id) — id 단독 유니크는 이미
-- 있으므로(PK) 이 추가는 순수 additive, 기존 삽입/조회 동작에 영향 없다.
-- =========================================================================

alter table session_prepared_selection_units
  add constraint session_prepared_selection_units_id_selection_uniq
  unique (id, prepared_selection_id);

-- =========================================================================
-- 2. 복합 FK — content_items의 (prepared_selection_unit_id, prepared_selection_id)가
-- 항상 같은 session_prepared_selection_units 행 안에서 짝을 이루도록 강제한다.
-- 이제 이 두 컬럼이 서로 다른 선택을 가리키는 조합은 INSERT든 UPDATE든 이
-- 제약 위반으로 거부된다 — 트리거가 아니라 Postgres 자체가 막는다.
-- =========================================================================

alter table session_prepared_selection_content_items
  add constraint session_prepared_selection_content_items_unit_selection_fk
  foreign key (prepared_selection_unit_id, prepared_selection_id)
  references session_prepared_selection_units (id, prepared_selection_id);

comment on constraint session_prepared_selection_content_items_unit_selection_fk
  on session_prepared_selection_content_items is
  'R9 corrective(2차, 크로스 테넌트/크로스 학생 유출 방지): prepared_selection_unit_id가 가리키는 단원은 항상 이 행의 prepared_selection_id와 같은 준비된 선택에 속해야 한다 — 복합 FK로 구조적으로 강제(INSERT/UPDATE 둘 다). 단독 FK(prepared_selection_unit_id → session_prepared_selection_units(id))는 그대로 유지되어 ON DELETE CASCADE를 계속 담당한다.';

-- =========================================================================
-- 3. check_prepared_content_item_selectable() 트리거를 UPDATE까지 확장한다.
-- 함수 본문(20261237000000)은 이미 new.* 기준으로 동작하므로(old를 참조하지
-- 않는다) INSERT/UPDATE 양쪽에 그대로 재사용 가능 — 변경 없음. 트리거 정의만
-- 새로 만든다(기존 BEFORE INSERT 트리거를 drop하고, BEFORE INSERT OR UPDATE OF
-- ...로 재생성).
-- =========================================================================

drop trigger if exists session_prepared_selection_content_items_check_selectable
  on session_prepared_selection_content_items;

create trigger session_prepared_selection_content_items_check_selectable
  before insert or update of prepared_selection_id, prepared_selection_unit_id, content_type, content_id
  on session_prepared_selection_content_items
  for each row execute function public.check_prepared_content_item_selectable();

comment on trigger session_prepared_selection_content_items_check_selectable
  on session_prepared_selection_content_items is
  'R9 corrective(2차): INSERT뿐 아니라 prepared_selection_id/prepared_selection_unit_id/content_type/content_id 중 하나라도 바뀌는 UPDATE에도 동일하게 단원 소속 + 키워드 범위 내 selectable 재검증을 받는다.';

-- =========================================================================
-- 4. pin_session_selection() 방어적 이중 확인 — 복합 FK(위 2)가 구조적으로
-- 막아주더라도, 함수 자신이 각 스테이징 항목의 prepared_selection_unit_id가
-- 실제로 v_selection.id에 속하는지 명시적으로 재확인한다. 이론상 FK 하나만으로
-- 이미 불가능해야 하는 상태이므로 이 확인은 "있을 수 없는 일"에 대한
-- belt-and-suspenders다 — 실패 시 매니페스트 0행/status 전이 없음으로 즉시
-- 중단한다.
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
  v_unit_selection_id uuid;
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
  'R9(레슨 준비 Task 2, corrective 2차로 방어적 이중 확인 추가): session_content_manifest의 유일한 쓰기 경로. SECURITY DEFINER라 RLS/앱 레벨 가드가 자동 적용되지 않으므로, 함수 본문 맨 앞에서 (0a)~(0f) 인가/불변조건을 스스로 전부 검사한다. (0f)는 복합 FK가 구조적으로 막아주는 것과 별개로 함수 자신이 prepared_selection_unit_id의 소속 선택을 재확인하는 defense-in-depth다. 검증→INSERT→status 전이를 한 트랜잭션 안에서 원자적으로 수행한다(부분 freeze 없음).';

-- search_path/EXECUTE 그랜트는 20261233000000에서 이미 고정돼있고 이 함수
-- 재정의로 바뀌지 않으므로(같은 시그니처 CREATE OR REPLACE) 다시 선언하지
-- 않는다.
