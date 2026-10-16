-- Mock Exam MST Phase 1 — 출시 조건(2026-09-28 제품 오너): 학생이 Module 1을 끝낸 뒤 Module 2 조립 실패를
-- 겪어서는 안 된다. 따라서 세트 생성 시점에 모든 모듈·모든 후보 경로(Phase 3의 higher/lower 포함)가
-- 청사진 문항 수를 채우는지 검증하고, 부족하면 ready로 만들지 않는다. 학생 시험 중 fallback(다른 난이도·
-- 중복 문항 몰래 채움)은 없다 — 응시 RPC는 세트에 이미 고정된 문항만 내려준다.
--
-- 강제 지점(DB): (1) mst 세트 publish 시 readiness_status='ready'가 아니면 거부(트리거),
-- (2) mst 세트를 attempt에 배정(insert/exam_set_id 변경) 시 ready가 아니면 거부(트리거),
-- (3) mock_exam_start_mst()가 Module 1 시작 직전에 4개 모듈의 문항 수·중복 없음을 다시 검증.
-- 고정형(fixed) 세트는 영향 없음(readiness는 mst만 계산).

alter table mock_exam_sets
  add column module_item_counts jsonb,   -- mst: {"rw_m1":27,"rw_m2":27,"math_m1":22,"math_m2":22}
  add column readiness_status text not null default 'not_applicable'
    check (readiness_status in ('not_applicable', 'ready', 'incomplete')),
  add column readiness_report jsonb,     -- [{moduleKey, route, needed, found, shortfalls:[{satDomain, difficulty, format, needed, found}]}]
  add column readiness_checked_at timestamptz;

-- 세트의 모듈·경로별 문항 수를 청사진과 비교한다. M2 모듈은 세트에 존재하는 경로 변형마다(Phase 1: route null
-- 하나, Phase 3: higher/lower 각각) 전부 정원을 채워야 한다. 중복은 unique(exam_set_id, problem_id)가 이미
-- 막지만 여기서도 재확인한다. 결과: {ready boolean, modules:[...]}.
create or replace function public.mock_exam_validate_mst_set(p_exam_set_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_s mock_exam_sets%rowtype; v_counts jsonb; v_key text; v_needed int; v_found int;
  v_modules jsonb := '[]'::jsonb; v_ready boolean := true; v_route mock_exam_route; v_routes mock_exam_route[];
  v_dup int;
begin
  select * into v_s from mock_exam_sets where id = p_exam_set_id;
  if v_s.id is null then raise exception '세트를 찾을 수 없습니다.'; end if;
  if v_s.format <> 'mst' then return jsonb_build_object('ready', true, 'modules', '[]'::jsonb, 'applicable', false); end if;
  v_counts := coalesce(v_s.module_item_counts, '{"rw_m1":27,"rw_m2":27,"math_m1":22,"math_m2":22}'::jsonb);

  foreach v_key in array array['rw_m1', 'rw_m2', 'math_m1', 'math_m2'] loop
    v_needed := (v_counts->>v_key)::int;
    -- 세트에 존재하는 경로 변형(없으면 [null] 하나로 취급)
    select coalesce(array_agg(distinct route), array[null::mock_exam_route]) into v_routes
    from mock_exam_set_items where exam_set_id = p_exam_set_id and module_key = v_key::mock_exam_module_key;
    if v_routes is null or array_length(v_routes, 1) is null then v_routes := array[null::mock_exam_route]; end if;
    foreach v_route in array v_routes loop
      select count(*) into v_found from mock_exam_set_items
      where exam_set_id = p_exam_set_id and module_key = v_key::mock_exam_module_key and route is not distinct from v_route;
      if v_found <> v_needed then v_ready := false; end if;
      v_modules := v_modules || jsonb_build_object(
        'moduleKey', v_key, 'route', v_route, 'needed', v_needed, 'found', v_found, 'ok', v_found = v_needed
      );
    end loop;
  end loop;

  select count(*) - count(distinct problem_id) into v_dup from mock_exam_set_items where exam_set_id = p_exam_set_id;
  if v_dup > 0 then v_ready := false; end if;
  if exists (select 1 from mock_exam_set_items where exam_set_id = p_exam_set_id and module_key is null) then v_ready := false; end if;

  return jsonb_build_object('ready', v_ready, 'applicable', true, 'duplicateCount', v_dup, 'modules', v_modules);
end $$;
revoke execute on function public.mock_exam_validate_mst_set(uuid) from public, anon;
grant execute on function public.mock_exam_validate_mst_set(uuid) to authenticated, service_role;

-- 세트 공개 게이트: mst는 ready일 때만 published로 갈 수 있다(관리자 UI가 막아도 DB가 최종 방어).
create or replace function public._mock_exam_sets_publish_gate() returns trigger
language plpgsql as $$
begin
  if new.format = 'mst' and new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    if new.readiness_status <> 'ready' then
      raise exception '문항 구성이 완료되지 않은 4모듈 시험은 공개할 수 없습니다(readiness=%). 부족한 모듈을 먼저 채우세요.', new.readiness_status;
    end if;
    if not (mock_exam_validate_mst_set(new.id)->>'ready')::boolean then
      raise exception '4모듈 시험의 문항 구성이 청사진을 채우지 못해 공개할 수 없습니다.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists mock_exam_sets_publish_gate on mock_exam_sets;
create trigger mock_exam_sets_publish_gate before insert or update of status on mock_exam_sets
  for each row execute function _mock_exam_sets_publish_gate();

-- 배정 게이트: ready가 아닌 mst 세트는 학생에게 배정할 수 없다(교사 RLS insert·관리자 service_role 모두).
create or replace function public._mock_exam_attempts_assign_gate() returns trigger
language plpgsql as $$
declare v_s mock_exam_sets%rowtype;
begin
  if tg_op = 'UPDATE' and new.exam_set_id = old.exam_set_id then return new; end if;
  select * into v_s from mock_exam_sets where id = new.exam_set_id;
  if v_s.format = 'mst' and v_s.readiness_status <> 'ready' then
    raise exception '문항 구성이 완료되지 않은 4모듈 시험은 배정할 수 없습니다(관리자에게 문의).';
  end if;
  return new;
end $$;
drop trigger if exists mock_exam_attempts_assign_gate on mock_exam_attempts;
create trigger mock_exam_attempts_assign_gate before insert or update of exam_set_id on mock_exam_attempts
  for each row execute function _mock_exam_attempts_assign_gate();

-- Module 1 시작 직전 재검증: 배정 이후 세트가 훼손됐더라도(문항 삭제 등) 학생이 중간에 막히지 않도록
-- 시작 자체를 관리자 오류로 거부한다. 나머지 본문은 20261901000000과 동일.
create or replace function public.mock_exam_start_mst(p_attempt_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_a mock_exam_attempts%rowtype; v_s mock_exam_sets%rowtype; v_limits jsonb; v_key text; v_pos int := 0; v_first uuid; v_check jsonb;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id for update;
  if v_a.id is null or v_a.student_id <> auth.uid() then raise exception '본인 응시만 진행할 수 있습니다.'; end if;
  select * into v_s from mock_exam_sets where id = v_a.exam_set_id;
  if v_s.format <> 'mst' then raise exception '4모듈 형식 시험이 아닙니다.'; end if;
  if v_a.status <> 'assigned' then perform _mock_exam_settle(p_attempt_id); return; end if;
  if v_a.start_by is not null and now() < v_a.start_by then raise exception '아직 시작할 수 없는 시험입니다.'; end if;
  if v_a.due_at is not null and now() > v_a.due_at then raise exception '마감이 지난 시험입니다.'; end if;

  v_check := mock_exam_validate_mst_set(v_s.id);
  if not (v_check->>'ready')::boolean then
    raise exception '이 시험의 문항 구성이 완료되지 않아 시작할 수 없습니다. 관리자에게 문의해 주세요.';
  end if;

  v_limits := coalesce(v_s.module_time_limits, '{"rw_m1":1920,"rw_m2":1920,"break":600,"math_m1":2100,"math_m2":2100}'::jsonb);
  foreach v_key in array array['rw_m1', 'rw_m2', 'break', 'math_m1', 'math_m2'] loop
    v_pos := v_pos + 1;
    insert into mock_exam_attempt_modules (attempt_id, module_key, position, time_limit_seconds, item_count)
    values (
      p_attempt_id, v_key::mock_exam_module_key, v_pos, (v_limits->>v_key)::int,
      (select count(*) from mock_exam_set_items i where i.exam_set_id = v_a.exam_set_id and i.module_key = v_key::mock_exam_module_key)
    );
  end loop;

  select id into v_first from mock_exam_attempt_modules where attempt_id = p_attempt_id and position = 1;
  update mock_exam_attempt_modules set started_at = now(), ends_at = now() + make_interval(secs => time_limit_seconds) where id = v_first;
  update mock_exam_attempts
  set status = 'in_progress', started_at = coalesce(started_at, now()), current_module = 'rw_m1'
  where id = p_attempt_id;
end $$;
