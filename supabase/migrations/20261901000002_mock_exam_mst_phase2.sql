-- Mock Exam MST Phase 2 — 메타데이터 + 조립 강화 (docs/2026-09-28-sat-adaptive-mock-exam-redesign-plan.md §3·§6,
-- docs/briefs/2026-09-29-mock-exam-mst-phase2-brief.md). 전부 additive.
--
-- 1) 문항 M1/M2(higher/lower) 배정 가능 플래그: difficulty 라벨에서 파생하는 generated column
--    (초기 규칙: easy·medium -> M1/lower, medium·hard -> higher). 규칙이 바뀌면 새 마이그레이션에서 재정의한다.
-- 2) 응시 시점 문항 내용 고정: set_items.content_snapshot(문항 본문·선택지·정답·해설). insert 시 트리거가 채우고
--    이후 변경 불가. mst_state·save_answer 채점은 스냅샷을 읽는다(없으면 기존 버전 행으로 fallback).
-- 3) 유사문항 그룹(problems.similarity_group), 조립 규칙(mock_exam_sets.assembly_rules), 노출 이력 집계 함수.
-- 4) mock_exam_validate_mst_set 확장: skill 균형·M1 배정 가능·유사문항 반복·스냅샷 누락. 규칙은 세트의
--    assembly_rules에 명시된 경우에만 강제(null = Phase 1 세트, 동작 불변).

alter table problems add column similarity_group text;
comment on column problems.similarity_group is '유사문항 그룹 키(같은 그룹 문항은 한 모의고사 세트에 함께 넣지 않는다). null이면 그룹 없음.';

alter table mock_exam_sets add column assembly_rules jsonb;
comment on column mock_exam_sets.assembly_rules is 'mst 조립 규칙 {skillMaxSharePct, enforceM1Eligibility, noSimilarGroupRepeat}. null이면 Phase 1 세트(추가 검증 없음).';

alter table mock_exam_set_items
  add column m1_eligible boolean generated always as (difficulty in ('easy', 'medium')) stored,
  add column m2_lower_eligible boolean generated always as (difficulty in ('easy', 'medium')) stored,
  add column m2_higher_eligible boolean generated always as (difficulty in ('medium', 'hard')) stored,
  add column content_snapshot jsonb;

-- 문항 내용: 스냅샷 우선, 없으면 현재 버전 행(고정형 등 스냅샷 이전 데이터).
create or replace function public._mock_exam_item_content(p_item mock_exam_set_items) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(
    p_item.content_snapshot,
    (select jsonb_build_object(
       'passage', v.passage, 'question', v.question, 'options', v.options, 'figure', v.figure,
       'correct_index', v.correct_index, 'answers', v.answers, 'explanation', v.explanation)
     from problem_versions v where v.id = p_item.problem_version_id)
  );
$$;
revoke execute on function public._mock_exam_item_content(mock_exam_set_items) from public, anon, authenticated;
grant execute on function public._mock_exam_item_content(mock_exam_set_items) to service_role;

create or replace function public._mock_exam_set_items_snapshot() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.content_snapshot is null then
      select jsonb_build_object(
        'passage', v.passage, 'question', v.question, 'options', v.options, 'figure', v.figure,
        'correct_index', v.correct_index, 'answers', v.answers, 'explanation', v.explanation)
      into new.content_snapshot from problem_versions v where v.id = new.problem_version_id;
    end if;
  else
    if old.content_snapshot is not null and (new.content_snapshot is distinct from old.content_snapshot
       or new.problem_version_id is distinct from old.problem_version_id) then
      raise exception '조립된 세트의 문항 내용(스냅샷)은 변경할 수 없습니다.';
    end if;
    if old.content_snapshot is null and new.content_snapshot is null then
      select jsonb_build_object(
        'passage', v.passage, 'question', v.question, 'options', v.options, 'figure', v.figure,
        'correct_index', v.correct_index, 'answers', v.answers, 'explanation', v.explanation)
      into new.content_snapshot from problem_versions v where v.id = new.problem_version_id;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists mock_exam_set_items_snapshot on mock_exam_set_items;
create trigger mock_exam_set_items_snapshot before insert or update on mock_exam_set_items
  for each row execute function _mock_exam_set_items_snapshot();

-- 기존 세트 문항 백필(트리거가 null -> 값 전환만 허용).
update mock_exam_set_items set content_snapshot = null where content_snapshot is null;

-- 노출 이력: 문항이 (보관 안 된) 세트에 들어간 횟수와 실제 응답이 저장된 횟수. 조립 시 덜 노출된 문항을 우선한다.
create or replace function public.mock_exam_problem_exposure_counts()
returns table (problem_id uuid, set_count int, attempt_count int)
language sql stable security definer set search_path = public as $$
  select i.problem_id,
         count(distinct i.exam_set_id)::int,
         count(distinct a.attempt_id) filter (where a.response is not null)::int
  from mock_exam_set_items i
  join mock_exam_sets s on s.id = i.exam_set_id and s.archived_at is null
  left join mock_exam_answers a on a.set_item_id = i.id
  group by i.problem_id;
$$;
revoke execute on function public.mock_exam_problem_exposure_counts() from public, anon, authenticated;
grant execute on function public.mock_exam_problem_exposure_counts() to service_role;

-- 관리자 세트 목록 문항 수(PostgREST 1,000행 상한 회피 — 집계는 DB에서).
create or replace function public.mock_exam_set_item_counts()
returns table (exam_set_id uuid, rw_count int, math_count int)
language sql stable security definer set search_path = public as $$
  select exam_set_id, count(*) filter (where section = 'rw')::int, count(*) filter (where section = 'math')::int
  from mock_exam_set_items group by exam_set_id;
$$;
revoke execute on function public.mock_exam_set_item_counts() from public, anon, authenticated;
grant execute on function public.mock_exam_set_item_counts() to service_role;

-- 청사진 검증 확장. 반환 형태는 Phase 1과 호환(추가 키만 붙는다).
create or replace function public.mock_exam_validate_mst_set(p_exam_set_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_s mock_exam_sets%rowtype; v_counts jsonb; v_key text; v_needed int; v_found int;
  v_modules jsonb := '[]'::jsonb; v_ready boolean := true; v_route mock_exam_route; v_routes mock_exam_route[];
  v_dup int; v_rules jsonb; v_share numeric; v_skill jsonb := '[]'::jsonb; v_elig jsonb := '[]'::jsonb;
  v_sim jsonb := '[]'::jsonb; v_nosnap int;
begin
  select * into v_s from mock_exam_sets where id = p_exam_set_id;
  if v_s.id is null then raise exception '세트를 찾을 수 없습니다.'; end if;
  if v_s.format <> 'mst' then return jsonb_build_object('ready', true, 'modules', '[]'::jsonb, 'applicable', false); end if;
  v_counts := coalesce(v_s.module_item_counts, '{"rw_m1":27,"rw_m2":27,"math_m1":22,"math_m2":22}'::jsonb);
  v_rules := coalesce(v_s.assembly_rules, '{}'::jsonb);

  foreach v_key in array array['rw_m1', 'rw_m2', 'math_m1', 'math_m2'] loop
    v_needed := (v_counts->>v_key)::int;
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

  select count(*) into v_nosnap from mock_exam_set_items where exam_set_id = p_exam_set_id and content_snapshot is null;
  if v_nosnap > 0 then v_ready := false; end if;

  -- skill 균형: 모듈·경로·영역 안에서 한 skill이 차지하는 비율 상한(문항 3개 미만인 영역은 제외).
  if v_rules ? 'skillMaxSharePct' then
    v_share := (v_rules->>'skillMaxSharePct')::numeric;
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
    if jsonb_array_length(v_skill) > 0 then v_ready := false; end if;
  end if;

  -- M1 배정 가능: Module 1 문항은 m1_eligible이어야 한다.
  if coalesce((v_rules->>'enforceM1Eligibility')::boolean, false) then
    select coalesce(jsonb_agg(jsonb_build_object('moduleKey', i.module_key, 'setItemId', i.id, 'difficulty', i.difficulty)), '[]'::jsonb)
    into v_elig
    from mock_exam_set_items i
    where i.exam_set_id = p_exam_set_id and i.module_key in ('rw_m1', 'math_m1') and not i.m1_eligible;
    if jsonb_array_length(v_elig) > 0 then v_ready := false; end if;
  end if;

  -- 유사문항 그룹: 같은 그룹 문항이 한 세트에 둘 이상 들어가면 안 된다.
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
    'missingSnapshotCount', v_nosnap, 'skillViolations', v_skill, 'eligibilityViolations', v_elig,
    'similarityViolations', v_sim
  );
end $$;
revoke execute on function public.mock_exam_validate_mst_set(uuid) from public, anon;
grant execute on function public.mock_exam_validate_mst_set(uuid) to authenticated, service_role;

-- MST 응시 화면 상태: 문항 내용을 스냅샷에서 읽는다(본문은 20261901000000과 동일).
create or replace function public.mock_exam_mst_state(p_attempt_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_a mock_exam_attempts%rowtype; v_modules jsonb; v_items jsonb;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  if v_a.id is null or not _mock_exam_can_view(v_a.student_id) then raise exception '이 응시 기록을 볼 권한이 없습니다.'; end if;
  if not _mock_exam_is_mst(p_attempt_id) then raise exception '4모듈 형식 시험이 아닙니다.'; end if;
  if v_a.student_id = auth.uid() then perform _mock_exam_settle(p_attempt_id); end if;
  select * into v_a from mock_exam_attempts where id = p_attempt_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'moduleKey', m.module_key, 'position', m.position, 'timeLimitSeconds', m.time_limit_seconds,
    'itemCount', m.item_count, 'startedAt', m.started_at, 'endsAt', m.ends_at, 'locked', m.locked,
    'remainingSeconds', case when m.ends_at is null then null else greatest(0, floor(extract(epoch from (m.ends_at - now()))))::int end
  ) order by m.position), '[]'::jsonb) into v_modules
  from mock_exam_attempt_modules m where m.attempt_id = p_attempt_id;

  -- position은 V1 unique(exam_set_id, section, position) 때문에 섹션 안에서 연속(rw 1..54, math 1..44).
  -- 화면 번호는 모듈 안 순번(moduleSeq)으로 따로 준다.
  select coalesce(jsonb_agg(jsonb_build_object(
    'setItemId', i.id, 'section', i.section, 'position', i.position, 'moduleKey', i.module_key,
    'moduleSeq', i.position - (select min(position) from mock_exam_set_items x where x.exam_set_id = i.exam_set_id and x.module_key = i.module_key) + 1,
    'problemId', i.problem_id, 'satDomain', i.sat_domain, 'skillCode', i.skill_code, 'difficulty', i.difficulty,
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
    and i.module_key = v_a.current_module and not m.locked;

  return jsonb_build_object(
    'attemptId', v_a.id, 'status', v_a.status, 'currentModule', v_a.current_module,
    'serverNow', now(), 'modules', v_modules, 'items', v_items
  );
end $$;
revoke execute on function public.mock_exam_mst_state(uuid) from public, anon;
grant execute on function public.mock_exam_mst_state(uuid) to authenticated, service_role;

-- 저장 시 채점도 스냅샷 정답 기준(본문은 20261901000000과 동일, 문항 내용 출처만 변경).
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
  if v_i.id is null then raise exception '문항을 찾을 수 없습니다.'; end if;
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

