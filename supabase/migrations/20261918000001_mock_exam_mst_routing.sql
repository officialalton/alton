-- Mock Exam MST Phase 3 (2/3) — M1 잠금 시 경로 결정 · M2 변형 노출 · 검증 확장. 전부 함수 재정의(additive).
-- 라우팅은 세트 assembly_rules.routing = true 일 때만 동작한다. 그 값이 없는 세트(Phase 1/2 세트)는 route 가
-- 전부 null 이라 이전 동작 그대로다(M2 문항 제한 없음, 경로 null).
-- 학생·보호자는 경로·변형을 알 수 없다: 노출 문항 필터, 난이도 라벨 제거, 경로 키 미포함, 거부 사유도 "문항 없음"과 동일.
-- 되돌리기: 20261901000001/20261901000002/20261905000000/20261915... 본문으로 각 함수를 새 번호 마이그레이션으로 재적용.

-- 세트 라우팅 사용 여부(assembly_rules.routing)
create or replace function public._mock_exam_set_routing_enabled(p_exam_set_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (assembly_rules->>'routing')::boolean from mock_exam_sets where id = p_exam_set_id), false);
$$;
revoke execute on function public._mock_exam_set_routing_enabled(uuid) from public, anon, authenticated;

-- 응시 기준으로 이 문항이 학생이 풀 경로에 속하는가: 경로 없는 문항(M1·레거시)은 항상 true, 변형 문항은 응시 경로와 일치할 때만.
create or replace function public._mock_exam_item_in_route(p_item mock_exam_set_items, p_attempt mock_exam_attempts) returns boolean
language sql immutable as $$
  select p_item.route is null
      or p_item.route = case p_item.section when 'rw' then p_attempt.rw_m2_route else p_attempt.math_m2_route end;
$$;
revoke execute on function public._mock_exam_item_in_route(mock_exam_set_items, mock_exam_attempts) from public, anon, authenticated;

-- 모듈 정원(경로 변형이 있으면 변형 하나의 문항 수).
create or replace function public._mock_exam_module_item_count(p_exam_set_id uuid, p_module mock_exam_module_key) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(max(n), 0)::int from (
    select count(*) n from mock_exam_set_items where exam_set_id = p_exam_set_id and module_key = p_module group by route
  ) c;
$$;
revoke execute on function public._mock_exam_module_item_count(uuid, mock_exam_module_key) from public, anon, authenticated;

-- 응시자가 실제로 풀 문항 수(변형 하나만 센다). 요약·내역의 totalCount 용.
create or replace function public._mock_exam_expected_item_count(p_exam_set_id uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(coalesce(nr, 0) + coalesce(mv, 0)), 0)::int from (
    select section, sum(n) filter (where route is null) nr, max(n) filter (where route is not null) mv
    from (select section, route, count(*) n from mock_exam_set_items where exam_set_id = p_exam_set_id group by section, route) c
    group by section
  ) s;
$$;
revoke execute on function public._mock_exam_expected_item_count(uuid) from public, anon, authenticated;

-- 관리자 내역용(service_role): 세트별 응시자가 풀 총 문항 수.
create or replace function public.mock_exam_set_expected_counts() returns table (exam_set_id uuid, total_count int)
language sql stable security definer set search_path = public as $$
  select s.id, _mock_exam_expected_item_count(s.id) from mock_exam_sets s;
$$;
revoke execute on function public.mock_exam_set_expected_counts() from public, anon, authenticated;
grant execute on function public.mock_exam_set_expected_counts() to service_role;

-- 경로 결정: M1 모듈이 잠길 때 정확히 한 번, 그 응시에 고정된 정책 버전(없으면 현재 활성)으로 판정한다.
-- 정답 수는 저장 시 스냅샷 정답으로 서버가 계산한 mock_exam_answers.correct 의 합(_mock_exam_lock_module 이 집계).
-- 활성 정책이 없으면(readiness 가 막지만 방어) 응시를 막지 않고 lower·버전 0으로 기록한다.
create or replace function public._mock_exam_route_m2(p_attempt_id uuid, p_m1 mock_exam_module_key, p_correct int, p_item_count int) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_a mock_exam_attempts%rowtype; v_sec text; v_pinned int; v_pol mock_exam_routing_policies%rowtype; v_route mock_exam_route; v_higher boolean;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id for update;
  if not _mock_exam_set_routing_enabled(v_a.exam_set_id) then return; end if;
  v_sec := case p_m1 when 'rw_m1' then 'rw' when 'math_m1' then 'math' end;
  if v_sec is null then return; end if;
  if (v_sec = 'rw' and v_a.rw_m2_route is not null) or (v_sec = 'math' and v_a.math_m2_route is not null) then return; end if; -- 재결정 금지
  v_pinned := case v_sec when 'rw' then v_a.rw_m2_route_policy_version else v_a.math_m2_route_policy_version end;
  if v_pinned is not null then
    select * into v_pol from mock_exam_routing_policies where section = v_sec and version = v_pinned;
  end if;
  if v_pol.id is null then
    select * into v_pol from mock_exam_routing_policies where section = v_sec and active;
  end if;
  if v_pol.id is null then
    v_route := 'lower';
  else
    -- 정확한 numeric 비교(부동소수 없음): ratio -> correct >= threshold * item_count, count -> correct >= threshold.
    v_higher := p_item_count > 0 and case v_pol.threshold_type
      when 'correct_ratio' then p_correct::numeric >= v_pol.threshold_value * p_item_count
      else p_correct::numeric >= v_pol.threshold_value end;
    v_route := case when v_higher then 'higher' else 'lower' end;
  end if;
  if v_sec = 'rw' then
    update mock_exam_attempts set rw_m2_route = v_route, rw_m2_route_policy_version = coalesce(v_pol.version, 0) where id = p_attempt_id;
  else
    update mock_exam_attempts set math_m2_route = v_route, math_m2_route_policy_version = coalesce(v_pol.version, 0) where id = p_attempt_id;
  end if;
end $$;
revoke execute on function public._mock_exam_route_m2(uuid, mock_exam_module_key, int, int) from public, anon, authenticated;

-- 모듈 잠금: Phase 1 본문 + M1 잠금 직후 경로 결정. 이미 잠겨 있으면 no-op(중복 제출·만료 재정산이 재라우팅하지 않는다).
create or replace function public._mock_exam_lock_module(p_module_id uuid, p_auto boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_m mock_exam_attempt_modules%rowtype; v_correct int;
begin
  select * into v_m from mock_exam_attempt_modules where id = p_module_id for update;
  if v_m.locked then return; end if;
  select count(*) into v_correct
  from mock_exam_answers ans join mock_exam_set_items i on i.id = ans.set_item_id
  where ans.attempt_id = v_m.attempt_id and i.module_key = v_m.module_key and ans.correct;
  update mock_exam_attempt_modules
  set locked = true, submitted_at = now(), auto_submitted = p_auto, raw_correct_count = v_correct,
      started_at = coalesce(started_at, now()), ends_at = coalesce(ends_at, now())
  where id = p_module_id;
  if v_m.module_key in ('rw_m1', 'math_m1') then
    perform _mock_exam_route_m2(v_m.attempt_id, v_m.module_key, v_correct, v_m.item_count);
  end if;
end $$;
revoke execute on function public._mock_exam_lock_module(uuid, boolean) from public, anon, authenticated;

-- 시작: readiness 재검증 + 모듈 생성(item_count 는 변형 하나 기준) + 라우팅 세트면 현재 활성 정책 버전을 응시에 고정.
create or replace function public.mock_exam_start_mst(p_attempt_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_a mock_exam_attempts%rowtype; v_s mock_exam_sets%rowtype; v_limits jsonb; v_key text; v_pos int := 0; v_first uuid; v_check jsonb;
  v_rw_v int; v_math_v int;
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
    values (p_attempt_id, v_key::mock_exam_module_key, v_pos, (v_limits->>v_key)::int,
            _mock_exam_module_item_count(v_a.exam_set_id, v_key::mock_exam_module_key));
  end loop;

  if _mock_exam_set_routing_enabled(v_s.id) then
    select version into v_rw_v from mock_exam_routing_policies where section = 'rw' and active;
    select version into v_math_v from mock_exam_routing_policies where section = 'math' and active;
    update mock_exam_attempts set rw_m2_route_policy_version = v_rw_v, math_m2_route_policy_version = v_math_v where id = p_attempt_id;
  end if;

  select id into v_first from mock_exam_attempt_modules where attempt_id = p_attempt_id and position = 1;
  update mock_exam_attempt_modules set started_at = now(), ends_at = now() + make_interval(secs => time_limit_seconds) where id = v_first;
  update mock_exam_attempts
  set status = 'in_progress', started_at = coalesce(started_at, now()), current_module = 'rw_m1'
  where id = p_attempt_id;
end $$;
revoke execute on function public.mock_exam_start_mst(uuid) from public, anon;
grant execute on function public.mock_exam_start_mst(uuid) to authenticated, service_role;

-- 응시 상태: 현재 모듈 문항 중 응시 경로에 속한 것만. 경로 뷰어(관리자·담당 교사·컨설턴트·service_role)가 아니면
-- 난이도 라벨을 비운다(M2 변형은 난이도 분포로 구분되므로). moduleSeq 는 (모듈, 변형) 안 순번.
create or replace function public.mock_exam_mst_state(p_attempt_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_a mock_exam_attempts%rowtype; v_modules jsonb; v_items jsonb; v_viewer boolean;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  if v_a.id is null or not _mock_exam_can_view(v_a.student_id) then raise exception '이 응시 기록을 볼 권한이 없습니다.'; end if;
  if not _mock_exam_is_mst(p_attempt_id) then raise exception '4모듈 형식 시험이 아닙니다.'; end if;
  if v_a.student_id = auth.uid() then perform _mock_exam_settle(p_attempt_id); end if;
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  v_viewer := _is_service_role() or is_admin() or teaches_student(v_a.student_id) or is_assigned_consultant_of(v_a.student_id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'moduleKey', m.module_key, 'position', m.position, 'timeLimitSeconds', m.time_limit_seconds,
    'itemCount', m.item_count, 'startedAt', m.started_at, 'endsAt', m.ends_at, 'locked', m.locked,
    'remainingSeconds', case when m.ends_at is null then null else greatest(0, floor(extract(epoch from (m.ends_at - now()))))::int end
  ) order by m.position), '[]'::jsonb) into v_modules
  from mock_exam_attempt_modules m where m.attempt_id = p_attempt_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'setItemId', i.id, 'section', i.section,
    -- 변형 문항의 원래 position(rw 28..54 / 55..81)은 경로를 드러내므로 응시 경로 안 섹션 순번으로 다시 매긴다.
    'position', (select count(*) from mock_exam_set_items y
                 where y.exam_set_id = i.exam_set_id and y.section = i.section and y.position <= i.position and _mock_exam_item_in_route(y, v_a)),
    'moduleKey', i.module_key,
    'moduleSeq', i.position - (select min(position) from mock_exam_set_items x
                               where x.exam_set_id = i.exam_set_id and x.module_key = i.module_key and x.route is not distinct from i.route) + 1,
    'problemId', i.problem_id, 'satDomain', i.sat_domain, 'skillCode', i.skill_code,
    'difficulty', case when v_viewer then i.difficulty else null end,
    'format', coalesce(p.format::text, 'mc'),
    'passage', c.content->>'passage', 'question', c.content->>'question', 'options', c.content->'options', 'figure', c.content->'figure',
    'correctIndex', null, 'answers', null, 'explanation', null, 'correct', null,
    'response', case when ans.response is null then null else ans.response #>> '{}' end,
    'flagged', coalesce(ans.flagged, false), 'savedToPractice', coalesce(ans.saved_to_practice, false),
    'timeSpentSeconds', ans.time_spent_seconds
  ) order by i.position), '[]'::jsonb) into v_items
  from mock_exam_set_items i
  cross join lateral (select _mock_exam_item_content(i) as content) c
  left join problems p on p.id = i.problem_id
  left join mock_exam_answers ans on ans.attempt_id = v_a.id and ans.set_item_id = i.id
  join mock_exam_attempt_modules m on m.attempt_id = v_a.id and m.module_key = i.module_key
  where i.exam_set_id = v_a.exam_set_id and v_a.status = 'in_progress'
    and i.module_key = v_a.current_module and not m.locked
    and _mock_exam_item_in_route(i, v_a);

  return jsonb_build_object(
    'attemptId', v_a.id, 'status', v_a.status, 'currentModule', v_a.current_module,
    'serverNow', now(), 'modules', v_modules, 'items', v_items
  );
end $$;
revoke execute on function public.mock_exam_mst_state(uuid) from public, anon;
grant execute on function public.mock_exam_mst_state(uuid) to authenticated, service_role;

-- 답 저장: 다른 변형 문항은 "문항 없음"과 같은 메시지로 거부(존재·경로 비노출).
create or replace function public.mock_exam_save_answer(
  p_attempt_id uuid, p_set_item_id uuid, p_response text, p_time_spent_seconds int default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_a mock_exam_attempts%rowtype; v_i mock_exam_set_items%rowtype; v_c jsonb; v_format text; v_correct boolean;
  v_mst boolean; v_m mock_exam_attempt_modules%rowtype;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  if v_a.id is null or v_a.student_id <> auth.uid() then raise exception '본인 응시만 진행할 수 있습니다.'; end if;
  v_mst := _mock_exam_is_mst(p_attempt_id);
  if v_mst then
    perform _mock_exam_settle(p_attempt_id);
    select * into v_a from mock_exam_attempts where id = p_attempt_id;
  end if;
  if v_a.status in ('submitted', 'graded') then raise exception '이미 제출한 시험은 답을 바꿀 수 없습니다.'; end if;
  select * into v_i from mock_exam_set_items where id = p_set_item_id and exam_set_id = v_a.exam_set_id;
  if v_i.id is null or (v_mst and not _mock_exam_item_in_route(v_i, v_a)) then raise exception '문항을 찾을 수 없습니다.'; end if;
  if v_mst then
    if v_a.status <> 'in_progress' then raise exception '시험을 먼저 시작해야 합니다.'; end if;
    select * into v_m from mock_exam_attempt_modules where attempt_id = p_attempt_id and module_key = v_i.module_key;
    if v_i.module_key is distinct from v_a.current_module or v_m.locked or v_m.started_at is null then
      raise exception '이미 제출된 모듈에는 답안을 저장할 수 없습니다.';
    end if;
  end if;
  v_c := _mock_exam_item_content(v_i);
  select format::text into v_format from problems where id = v_i.problem_id;
  v_correct := _answer_auto_grade(coalesce(v_format, 'mc'), p_response, nullif(v_c->>'correct_index', '')::int, v_c->'answers');

  insert into mock_exam_answers (attempt_id, set_item_id, response, correct, time_spent_seconds, updated_at)
  values (p_attempt_id, p_set_item_id, to_jsonb(p_response), v_correct, p_time_spent_seconds, now())
  on conflict (attempt_id, set_item_id) do update
    set response = excluded.response, correct = excluded.correct,
        time_spent_seconds = coalesce(excluded.time_spent_seconds, mock_exam_answers.time_spent_seconds),
        updated_at = now();

  if v_a.status = 'assigned' then
    update mock_exam_attempts set status = 'in_progress', started_at = coalesce(started_at, now()) where id = p_attempt_id;
  end if;
end $$;

create or replace function public.mock_exam_toggle_flag(p_attempt_id uuid, p_set_item_id uuid, p_flagged boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare v_a mock_exam_attempts%rowtype; v_i mock_exam_set_items%rowtype; v_m mock_exam_attempt_modules%rowtype;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  if v_a.id is null or v_a.student_id <> auth.uid() then raise exception '본인 응시만 진행할 수 있습니다.'; end if;
  if _mock_exam_is_mst(p_attempt_id) then
    perform _mock_exam_settle(p_attempt_id);
    select * into v_a from mock_exam_attempts where id = p_attempt_id;
  end if;
  if v_a.status in ('submitted', 'graded') then raise exception '이미 제출한 시험은 바꿀 수 없습니다.'; end if;
  select * into v_i from mock_exam_set_items where id = p_set_item_id and exam_set_id = v_a.exam_set_id;
  if v_i.id is null or not _mock_exam_item_in_route(v_i, v_a) then raise exception '문항을 찾을 수 없습니다.'; end if;
  if v_i.module_key is not null then
    select * into v_m from mock_exam_attempt_modules where attempt_id = p_attempt_id and module_key = v_i.module_key;
    if v_i.module_key is distinct from v_a.current_module or coalesce(v_m.locked, true) then
      raise exception '이미 제출된 모듈에는 표시를 바꿀 수 없습니다.';
    end if;
  end if;
  insert into mock_exam_answers (attempt_id, set_item_id, flagged, updated_at)
  values (p_attempt_id, p_set_item_id, p_flagged, now())
  on conflict (attempt_id, set_item_id) do update set flagged = excluded.flagged, updated_at = now();
end $$;

-- 응시 상세: 라우팅 세트는 모든 호출자에게 응시 경로에 속한 문항만(경로 미확정이면 변형 문항 제외).
-- 학생·보호자(경로 뷰어 아님)는 난이도 라벨 제거·경로 키 없음. 경로 뷰어에게만 routing 키를 덧붙인다.
create or replace function public.mock_exam_attempt_detail(p_attempt_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_d jsonb; v_a mock_exam_attempts%rowtype; v_s mock_exam_sets%rowtype; v_staff boolean; v_viewer boolean; v_items jsonb; v_routing boolean;
begin
  v_d := _mock_exam_attempt_detail_v1(p_attempt_id);
  if v_d is null then return null; end if;
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  select * into v_s from mock_exam_sets where id = v_a.exam_set_id;
  v_d := v_d || jsonb_build_object('format', coalesce(v_s.format, 'fixed'), 'currentModule', v_a.current_module);
  if coalesce(v_s.format, 'fixed') <> 'mst' then return v_d; end if;

  v_staff := _is_service_role() or is_admin() or teaches_student(v_a.student_id);
  v_viewer := v_staff or is_assigned_consultant_of(v_a.student_id);
  v_routing := coalesce((v_s.assembly_rules->>'routing')::boolean, false);

  select coalesce(jsonb_agg(
           (case when v_viewer or not v_routing then t.it else t.it || jsonb_build_object('difficulty', null) end)
           -- position 도 응시 경로 안 섹션 순번으로 다시 매긴다(변형별 원래 position 이 경로를 드러내므로).
           || jsonb_build_object('position', (select count(*) from mock_exam_set_items y
                where y.exam_set_id = i.exam_set_id and y.section = i.section and y.position <= i.position and _mock_exam_item_in_route(y, v_a)))
           order by t.ord), '[]'::jsonb) into v_items
  from jsonb_array_elements(v_d->'items') with ordinality as t(it, ord)
  join mock_exam_set_items i on i.id = (t.it->>'setItemId')::uuid
  where _mock_exam_item_in_route(i, v_a)
    and (v_a.status = 'graded' or v_staff
         or (i.module_key = v_a.current_module
             and exists (select 1 from mock_exam_attempt_modules m where m.attempt_id = v_a.id and m.module_key = i.module_key and not m.locked)));
  v_d := v_d || jsonb_build_object('items', v_items);

  if v_routing and v_viewer then
    v_d := v_d || jsonb_build_object('routing', jsonb_build_object(
      'rw', jsonb_build_object('route', v_a.rw_m2_route, 'policyVersion', v_a.rw_m2_route_policy_version),
      'math', jsonb_build_object('route', v_a.math_m2_route, 'policyVersion', v_a.math_m2_route_policy_version)));
  end if;
  return v_d;
end $$;
revoke execute on function public.mock_exam_attempt_detail(uuid) from public, anon;
grant execute on function public.mock_exam_attempt_detail(uuid) to authenticated, service_role;

-- 요약: totalCount 는 응시자가 실제로 풀 문항 수(변형 하나). 그 밖의 본문은 20261469 와 동일.
create or replace function public.mock_exam_attempt_summaries(p_student_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not _mock_exam_can_view(p_student_id) then
    raise exception '이 학생의 모의고사 기록을 볼 권한이 없습니다.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'examSetId', a.exam_set_id, 'examSetName', s.name, 'difficultyTier', s.difficulty_tier,
      'studentId', a.student_id, 'studentName', pr.name, 'status', a.status,
      'assignedByName', ap.name,
      'dueAt', a.due_at, 'startBy', a.start_by, 'startedAt', a.started_at, 'submittedAt', a.submitted_at, 'gradedAt', a.graded_at,
      'entryCount', a.entry_count,
      'totalCount', _mock_exam_expected_item_count(a.exam_set_id),
      'correctCount', case
        when _mock_exam_results_visible(a.student_id, a.status) and a.status = 'graded'
          then (select count(*) from mock_exam_answers ans where ans.attempt_id = a.id and ans.correct = true)
        else null end
    ) order by a.created_at desc)
    from mock_exam_attempts a
    join mock_exam_sets s on s.id = a.exam_set_id
    left join profiles pr on pr.id = a.student_id
    left join profiles ap on ap.id = a.assigned_by
    where a.student_id = p_student_id
  ), '[]'::jsonb);
end $$;
revoke execute on function public.mock_exam_attempt_summaries(uuid) from public, anon;
grant execute on function public.mock_exam_attempt_summaries(uuid) to authenticated, service_role;

-- 세트 문항 내용(관리자·교사): 모듈·경로 표시 추가(직원용 — 학생·보호자는 호출 불가).
create or replace function public.mock_exam_set_content_for_staff(p_exam_set_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_is_staff boolean;
begin
  select is_admin() or exists(select 1 from profiles where id = auth.uid() and role = 'teacher') into v_is_staff;
  if not v_is_staff then
    raise exception '관리자·교사만 모의고사 문항 내용을 볼 수 있습니다.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'setItemId', i.id, 'section', i.section, 'position', i.position, 'problemId', i.problem_id,
      'satDomain', i.sat_domain, 'skillCode', i.skill_code, 'difficulty', i.difficulty,
      'moduleKey', i.module_key, 'route', i.route,
      'format', coalesce(p.format::text, 'mc'),
      'passage', v.passage, 'question', v.question, 'options', v.options, 'figure', v.figure,
      'correctIndex', v.correct_index, 'answers', v.answers, 'explanation', v.explanation
    ) order by i.section, i.position)
    from mock_exam_set_items i
    join problem_versions v on v.id = i.problem_version_id
    left join problems p on p.id = i.problem_id
    where i.exam_set_id = p_exam_set_id
  ), '[]'::jsonb);
end $$;
revoke execute on function public.mock_exam_set_content_for_staff(uuid) from public, anon;
grant execute on function public.mock_exam_set_content_for_staff(uuid) to authenticated, service_role;

-- 청사진 검증(20261905000000 확장): 라우팅 세트는 M2 higher/lower 두 변형이 각각 정원을 채워야 하고,
-- 변형 문항은 해당 경로 배정 가능 플래그를 만족하며, 두 섹션의 활성 정책이 있어야 한다. skill 균형은 여전히 경고 전용.
create or replace function public.mock_exam_validate_mst_set(p_exam_set_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_s mock_exam_sets%rowtype; v_counts jsonb; v_key text; v_needed int; v_found int;
  v_modules jsonb := '[]'::jsonb; v_ready boolean := true; v_route mock_exam_route; v_routes mock_exam_route[];
  v_dup int; v_rules jsonb; v_share numeric; v_skill jsonb := '[]'::jsonb; v_elig jsonb := '[]'::jsonb;
  v_sim jsonb := '[]'::jsonb; v_nosnap int; v_hard boolean;
  v_routing boolean; v_shape int := 0; v_var jsonb := '[]'::jsonb; v_polmiss jsonb := '[]'::jsonb; v_sec text;
begin
  select * into v_s from mock_exam_sets where id = p_exam_set_id;
  if v_s.id is null then raise exception '세트를 찾을 수 없습니다.'; end if;
  if v_s.format <> 'mst' then return jsonb_build_object('ready', true, 'modules', '[]'::jsonb, 'applicable', false); end if;
  v_counts := coalesce(v_s.module_item_counts, '{"rw_m1":27,"rw_m2":27,"math_m1":22,"math_m2":22}'::jsonb);
  v_rules := coalesce(v_s.assembly_rules, '{}'::jsonb);
  v_routing := coalesce((v_rules->>'routing')::boolean, false);

  foreach v_key in array array['rw_m1', 'rw_m2', 'math_m1', 'math_m2'] loop
    v_needed := (v_counts->>v_key)::int;
    if v_routing and v_key in ('rw_m2', 'math_m2') then
      v_routes := array['lower', 'higher']::mock_exam_route[];      -- 두 변형 모두 있어야 한다(없으면 found=0)
    else
      select coalesce(array_agg(distinct route), array[null::mock_exam_route]) into v_routes
      from mock_exam_set_items where exam_set_id = p_exam_set_id and module_key = v_key::mock_exam_module_key;
      if v_routes is null or array_length(v_routes, 1) is null then v_routes := array[null::mock_exam_route]; end if;
    end if;
    foreach v_route in array v_routes loop
      select count(*) into v_found from mock_exam_set_items
      where exam_set_id = p_exam_set_id and module_key = v_key::mock_exam_module_key and route is not distinct from v_route;
      if v_found <> v_needed then v_ready := false; end if;
      v_modules := v_modules || jsonb_build_object(
        'moduleKey', v_key, 'route', v_route, 'needed', v_needed, 'found', v_found, 'ok', v_found = v_needed
      );
    end loop;
  end loop;

  -- 경로 모양: 라우팅 세트는 M1 문항에 route 없음·M2 문항은 반드시 route 있음. 라우팅이 아닌 세트는 route 문항 자체가 없어야 한다.
  select count(*) into v_shape from mock_exam_set_items i
  where i.exam_set_id = p_exam_set_id and (
    (v_routing and i.module_key in ('rw_m1', 'math_m1') and i.route is not null)
    or (v_routing and i.module_key in ('rw_m2', 'math_m2') and i.route is null)
    or (not v_routing and i.route is not null));
  if v_shape > 0 then v_ready := false; end if;

  if v_routing then
    select coalesce(jsonb_agg(jsonb_build_object('moduleKey', i.module_key, 'route', i.route, 'setItemId', i.id, 'difficulty', i.difficulty)), '[]'::jsonb)
    into v_var
    from mock_exam_set_items i
    where i.exam_set_id = p_exam_set_id
      and ((i.route = 'lower' and not i.m2_lower_eligible) or (i.route = 'higher' and not i.m2_higher_eligible));
    if jsonb_array_length(v_var) > 0 then v_ready := false; end if;
    foreach v_sec in array array['rw', 'math'] loop
      if not exists (select 1 from mock_exam_routing_policies where section = v_sec and active) then
        v_polmiss := v_polmiss || to_jsonb(v_sec);
        v_ready := false;
      end if;
    end loop;
  end if;

  select count(*) - count(distinct problem_id) into v_dup from mock_exam_set_items where exam_set_id = p_exam_set_id;
  if v_dup > 0 then v_ready := false; end if;
  if exists (select 1 from mock_exam_set_items where exam_set_id = p_exam_set_id and module_key is null) then v_ready := false; end if;

  select count(*) into v_nosnap from mock_exam_set_items where exam_set_id = p_exam_set_id and content_snapshot is null;
  if v_nosnap > 0 then v_ready := false; end if;

  if v_rules ? 'skillMaxSharePct' or coalesce((v_rules->>'skillHardGate')::boolean, false) then
    v_hard := coalesce((v_rules->>'skillHardGate')::boolean, false);
    v_share := coalesce((v_rules->>'skillMaxSharePct')::numeric, 50);
    select coalesce(jsonb_agg(jsonb_build_object(
      'moduleKey', g.module_key, 'route', g.route, 'satDomain', g.sat_domain, 'skillCode', g.skill_code,
      'count', g.cnt, 'cap', ceil(g.domain_n * v_share / 100)::int) order by g.module_key, g.sat_domain, g.skill_code), '[]'::jsonb)
    into v_skill
    from (
      select i.module_key, i.route, i.sat_domain, i.skill_code, count(*) cnt,
             sum(count(*)) over (partition by i.module_key, i.route, i.sat_domain) domain_n
      from mock_exam_set_items i
      where i.exam_set_id = p_exam_set_id and i.skill_code is not null
      group by i.module_key, i.route, i.sat_domain, i.skill_code
    ) g
    where g.domain_n >= 3 and g.cnt > ceil(g.domain_n * v_share / 100);
    if v_hard and jsonb_array_length(v_skill) > 0 then v_ready := false; end if;
  end if;

  if coalesce((v_rules->>'enforceM1Eligibility')::boolean, false) then
    select coalesce(jsonb_agg(jsonb_build_object('moduleKey', i.module_key, 'setItemId', i.id, 'difficulty', i.difficulty)), '[]'::jsonb)
    into v_elig
    from mock_exam_set_items i
    where i.exam_set_id = p_exam_set_id and i.module_key in ('rw_m1', 'math_m1') and not i.m1_eligible;
    if jsonb_array_length(v_elig) > 0 then v_ready := false; end if;
  end if;

  if coalesce((v_rules->>'noSimilarGroupRepeat')::boolean, false) then
    select coalesce(jsonb_agg(jsonb_build_object('similarityGroup', g.similarity_group, 'count', g.cnt)), '[]'::jsonb)
    into v_sim
    from (
      select p.similarity_group, count(*) cnt
      from mock_exam_set_items i join problems p on p.id = i.problem_id
      where i.exam_set_id = p_exam_set_id and p.similarity_group is not null
      group by p.similarity_group having count(*) > 1
    ) g;
    if jsonb_array_length(v_sim) > 0 then v_ready := false; end if;
  end if;

  return jsonb_build_object(
    'ready', v_ready, 'applicable', true, 'duplicateCount', v_dup, 'modules', v_modules,
    'missingSnapshotCount', v_nosnap, 'skillViolations', case when v_hard then v_skill else '[]'::jsonb end,
    'skillWarnings', case when v_hard then '[]'::jsonb else v_skill end, 'eligibilityViolations', v_elig,
    'similarityViolations', v_sim,
    'routing', v_routing, 'routeShapeViolationCount', v_shape, 'variantEligibilityViolations', v_var, 'routingPolicyMissing', v_polmiss
  );
end $$;
revoke execute on function public.mock_exam_validate_mst_set(uuid) from public, anon, authenticated;
grant execute on function public.mock_exam_validate_mst_set(uuid) to service_role;
