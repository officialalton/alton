-- Mock Exam MST Phase 1 — 고정형 V1 위에 Digital SAT 4모듈(R&W M1·M2 / 휴식 / Math M1·M2)
-- 응시 shell을 additive로 얹는다. 계획: docs/2026-09-28-sat-adaptive-mock-exam-redesign-plan.md §3~§4.
--
-- 원칙
-- - 기존 고정형(format='fixed') 세트·응시의 동작은 바꾸지 않는다(모든 신규 분기는 format='mst'에서만).
-- - 학생 쓰기 경로는 20261429 P0 원칙 그대로 SECURITY DEFINER RPC만. 모듈 시작/마감/잠금/자동 제출은
--   전부 서버 시각(now())으로 판정한다 — 클라이언트 타이머는 표시용.
-- - 미시작·잠긴 모듈의 문항은 학생·보호자에게 내려주지 않는다(미래 문항 사전 노출 차단).
-- - 적응형 경로(higher/lower)는 Phase 3에서 채운다. 컬럼만 미리 두고 화면에는 절대 노출하지 않는다.

-- =========================================================================
-- 1. enum · 컬럼 · 테이블
-- =========================================================================
create type mock_exam_module_key as enum ('rw_m1', 'rw_m2', 'break', 'math_m1', 'math_m2');
create type mock_exam_route as enum ('higher', 'lower');

alter table mock_exam_sets
  add column format text not null default 'fixed' check (format in ('fixed', 'mst')),
  add column module_time_limits jsonb;

alter table mock_exam_set_items
  add column module_key mock_exam_module_key,
  add column route mock_exam_route;
create index on mock_exam_set_items (exam_set_id, module_key, position);

alter table mock_exam_attempts
  add column current_module mock_exam_module_key,
  add column rw_m2_route mock_exam_route,
  add column math_m2_route mock_exam_route;

create table mock_exam_attempt_modules (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references mock_exam_attempts (id) on delete cascade,
  module_key mock_exam_module_key not null,
  position int not null,
  time_limit_seconds int not null,
  item_count int not null default 0,
  started_at timestamptz,
  ends_at timestamptz,
  submitted_at timestamptz,
  locked boolean not null default false,
  auto_submitted boolean not null default false,
  raw_correct_count int,
  unique (attempt_id, module_key),
  unique (attempt_id, position)
);
alter table mock_exam_attempt_modules enable row level security;
create policy "관리자 전체" on mock_exam_attempt_modules for all using (is_admin()) with check (is_admin());
create policy "본인·관계자 조회" on mock_exam_attempt_modules for select
  using (exists (select 1 from mock_exam_attempts a where a.id = attempt_id and _mock_exam_can_view(a.student_id)));

-- =========================================================================
-- 2. SPR 정규화 채점 (제품 오너 확정 2026-09-28)
--    공백·쉼표 제거, 앞자리 0·불필요한 소수점 0 무시, 분수(a/b)↔소수 동치, 문항이 명시한
--    correct answers와 수학적으로 같으면 정답. 범위 채점은 문항이 정의하지 않는 한 없음.
--    소수 정답은 Digital SAT 규칙대로 소수점 이하 3자리 이상 절사/반올림을 허용한다.
--    숙제(homework_submit_answer)도 같은 함수를 쓰므로 기존 통과 사례(문자열 일치·1e-9 수치)는 유지.
-- =========================================================================
create or replace function public._spr_to_rational(p_raw text) returns numeric
language plpgsql immutable as $$
declare v text; v_num text; v_den text;
begin
  if p_raw is null then return null; end if;
  v := regexp_replace(p_raw, '[\s,]', '', 'g');
  if v = '' then return null; end if;
  if v ~ '^[+-]?(\d+\.?\d*|\.\d+)$' then return v::numeric; end if;
  if v ~ '^[+-]?\d+/\d+$' then
    v_num := split_part(v, '/', 1); v_den := split_part(v, '/', 2);
    if v_den::numeric = 0 then return null; end if;
    return v_num::numeric / v_den::numeric;
  end if;
  return null;
exception when others then return null;
end $$;

create or replace function public._answer_auto_grade(
  p_format text, p_response text, p_correct_index int, p_answers jsonb
) returns boolean
language plpgsql immutable set search_path = public as $$
declare
  v_resp text; v_ans text; v_rn numeric; v_an numeric; v_places int; v_tol numeric;
begin
  if p_format = 'mc' then
    if p_correct_index is null then return null; end if;
    return p_response = p_correct_index::text;
  end if;
  if p_format = 'spr' then
    if p_answers is null or jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) = 0 then return null; end if;
    v_resp := regexp_replace(coalesce(p_response, ''), '[\s,]', '', 'g');
    if v_resp = '' then return false; end if;
    v_rn := _spr_to_rational(v_resp);
    for v_ans in select regexp_replace(value #>> '{}', '[\s,]', '', 'g') from jsonb_array_elements(p_answers) loop
      if v_ans = v_resp then return true; end if;
      v_an := _spr_to_rational(v_ans);
      if v_rn is not null and v_an is not null then
        if abs(v_rn - v_an) < 1e-9 then return true; end if;
        -- 학생이 소수로 답했고 정답이 무한소수 등일 때: 소수점 이하 자릿수(3자리 이상)만큼의
        -- 절사·반올림 허용(예: 1/3 → .333 / 0.3333). 2자리 이하는 허용하지 않는다.
        if v_resp ~ '\.' then
          v_places := length(split_part(v_resp, '.', 2));
          if v_places >= 3 then
            v_tol := power(10::numeric, -v_places);
            if abs(v_rn - v_an) < v_tol then return true; end if;
          end if;
        end if;
      end if;
    end loop;
    return false;
  end if;
  return null; -- essay/math 는 수동 채점
end $$;

-- =========================================================================
-- 3. 내부 헬퍼 (execute 권한 없음 — RPC 안에서만)
-- =========================================================================
create or replace function public._mock_exam_is_mst(p_attempt_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from mock_exam_attempts a join mock_exam_sets s on s.id = a.exam_set_id
    where a.id = p_attempt_id and s.format = 'mst'
  );
$$;
revoke execute on function public._mock_exam_is_mst(uuid) from public, anon, authenticated;

-- 모듈 잠금 + 모듈 raw 정답 수 집계. 이미 잠겨 있으면 no-op(중복 제출 멱등).
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
end $$;
revoke execute on function public._mock_exam_lock_module(uuid, boolean) from public, anon, authenticated;

-- 현재 모듈이 잠긴 뒤 다음 모듈을 시작한다. 마지막이면 V1 자동 채점 의미 그대로 attempt를 graded로.
create or replace function public._mock_exam_open_next_module(p_attempt_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_a mock_exam_attempts%rowtype; v_cur mock_exam_attempt_modules%rowtype; v_next mock_exam_attempt_modules%rowtype;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id for update;
  select * into v_cur from mock_exam_attempt_modules where attempt_id = p_attempt_id and module_key = v_a.current_module;
  select * into v_next from mock_exam_attempt_modules where attempt_id = p_attempt_id and position = v_cur.position + 1;
  if v_next.id is null then
    update mock_exam_attempts
    set status = 'graded', submitted_at = coalesce(submitted_at, now()), graded_at = now(), attempt_count = 1
    where id = p_attempt_id;
    return;
  end if;
  update mock_exam_attempt_modules
  set started_at = now(), ends_at = now() + make_interval(secs => time_limit_seconds)
  where id = v_next.id;
  update mock_exam_attempts set current_module = v_next.module_key where id = p_attempt_id;
end $$;
revoke execute on function public._mock_exam_open_next_module(uuid) from public, anon, authenticated;

-- 만료 정산: 현재 모듈 ends_at이 지났으면 자동 잠금 → 다음 모듈. 오래 이탈한 경우 연쇄 처리.
-- 모든 MST 관련 RPC가 진입 시 먼저 호출한다.
create or replace function public._mock_exam_settle(p_attempt_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_a mock_exam_attempts%rowtype; v_cur mock_exam_attempt_modules%rowtype;
begin
  loop
    select * into v_a from mock_exam_attempts where id = p_attempt_id for update;
    if v_a.status <> 'in_progress' or v_a.current_module is null then return; end if;
    select * into v_cur from mock_exam_attempt_modules where attempt_id = p_attempt_id and module_key = v_a.current_module;
    if v_cur.id is null or v_cur.ends_at is null or v_cur.ends_at > now() then return; end if;
    perform _mock_exam_lock_module(v_cur.id, true);
    perform _mock_exam_open_next_module(p_attempt_id);
  end loop;
end $$;
revoke execute on function public._mock_exam_settle(uuid) from public, anon, authenticated;

-- =========================================================================
-- 4. 공개 RPC
-- =========================================================================

-- 시작: assigned → in_progress, 모듈 5개 생성, rw_m1 시작. 이미 시작했으면 정산만 하고 반환(멱등).
create or replace function public.mock_exam_start_mst(p_attempt_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_a mock_exam_attempts%rowtype; v_s mock_exam_sets%rowtype; v_limits jsonb; v_key text; v_pos int := 0; v_first uuid;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id for update;
  if v_a.id is null or v_a.student_id <> auth.uid() then raise exception '본인 응시만 진행할 수 있습니다.'; end if;
  select * into v_s from mock_exam_sets where id = v_a.exam_set_id;
  if v_s.format <> 'mst' then raise exception '4모듈 형식 시험이 아닙니다.'; end if;
  if v_a.status <> 'assigned' then perform _mock_exam_settle(p_attempt_id); return; end if;
  if v_a.start_by is not null and now() < v_a.start_by then raise exception '아직 시작할 수 없는 시험입니다.'; end if;
  if v_a.due_at is not null and now() > v_a.due_at then raise exception '마감이 지난 시험입니다.'; end if;

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
revoke execute on function public.mock_exam_start_mst(uuid) from public, anon;
grant execute on function public.mock_exam_start_mst(uuid) to authenticated, service_role;

-- 현재 모듈 제출(휴식 조기 종료 포함). p_expected_module이 현재 모듈이 아니면 no-op(중복 제출 멱등).
create or replace function public.mock_exam_submit_module(p_attempt_id uuid, p_expected_module mock_exam_module_key) returns void
language plpgsql security definer set search_path = public as $$
declare v_a mock_exam_attempts%rowtype; v_cur mock_exam_attempt_modules%rowtype;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  if v_a.id is null or v_a.student_id <> auth.uid() then raise exception '본인 응시만 제출할 수 있습니다.'; end if;
  perform _mock_exam_settle(p_attempt_id);
  select * into v_a from mock_exam_attempts where id = p_attempt_id for update;
  if v_a.status <> 'in_progress' or v_a.current_module is distinct from p_expected_module then return; end if;
  select * into v_cur from mock_exam_attempt_modules where attempt_id = p_attempt_id and module_key = v_a.current_module;
  if v_cur.locked then return; end if;
  perform _mock_exam_lock_module(v_cur.id, false);
  perform _mock_exam_open_next_module(p_attempt_id);
end $$;
revoke execute on function public.mock_exam_submit_module(uuid, mock_exam_module_key) from public, anon;
grant execute on function public.mock_exam_submit_module(uuid, mock_exam_module_key) to authenticated, service_role;

-- 응시 화면 상태(복구용). 모듈 목록(서버 계산 남은 시간) + 현재 모듈 문항(정답 마스킹) + 답안/표시.
-- 문항 키는 mock_exam_attempt_detail의 items와 같게 맞춘다(클라이언트 타입 공유).
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
    'passage', v.passage, 'question', v.question, 'options', v.options, 'figure', v.figure,
    'correctIndex', null, 'answers', null, 'explanation', null, 'correct', null,
    'response', case when ans.response is null then null else ans.response #>> '{}' end,
    'flagged', coalesce(ans.flagged, false), 'savedToPractice', coalesce(ans.saved_to_practice, false),
    'timeSpentSeconds', ans.time_spent_seconds
  ) order by i.position), '[]'::jsonb) into v_items
  from mock_exam_set_items i
  join problem_versions v on v.id = i.problem_version_id
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

-- =========================================================================
-- 5. 기존 RPC 재정의 — MST 분기 추가(고정형 동작 불변)
-- =========================================================================
create or replace function public.mock_exam_save_answer(
  p_attempt_id uuid, p_set_item_id uuid, p_response text, p_time_spent_seconds int default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_a mock_exam_attempts%rowtype; v_i mock_exam_set_items%rowtype; v_v problem_versions%rowtype; v_format text; v_correct boolean;
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
  select * into v_v from problem_versions where id = v_i.problem_version_id;
  select format::text into v_format from problems where id = v_i.problem_id;
  v_correct := _answer_auto_grade(coalesce(v_format, 'mc'), p_response, v_v.correct_index, v_v.answers);

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
  if v_i.id is null then raise exception '문항을 찾을 수 없습니다.'; end if;
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

-- 고정형 제출 함수: MST 응시는 모듈 제출로만 끝나므로 명시적으로 거부한다.
create or replace function public.mock_exam_submit(p_attempt_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_a mock_exam_attempts%rowtype;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  if v_a.id is null or v_a.student_id <> auth.uid() then raise exception '본인 응시만 제출할 수 있습니다.'; end if;
  if _mock_exam_is_mst(p_attempt_id) then raise exception '4모듈 시험은 모듈 단위로 제출합니다.'; end if;
  if v_a.status not in ('assigned', 'in_progress') then raise exception '이미 제출한 시험입니다.'; end if;
  update mock_exam_attempts
    set status = 'graded', submitted_at = now(), graded_at = now(), attempt_count = 1
    where id = p_attempt_id;
end $$;

-- 상세 조회: 기존 본문은 그대로 두고(rename) 얇은 래퍼가 format/currentModule을 덧붙이고,
-- MST 진행 중 응시를 학생·보호자·컨설턴트가 볼 때는 현재 모듈 문항만 남긴다(교사·관리자·service_role은
-- 그대로 전체, graded면 전체).
alter function public.mock_exam_attempt_detail(uuid) rename to _mock_exam_attempt_detail_v1;
revoke execute on function public._mock_exam_attempt_detail_v1(uuid) from public, anon, authenticated;

create or replace function public.mock_exam_attempt_detail(p_attempt_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_d jsonb; v_a mock_exam_attempts%rowtype; v_s mock_exam_sets%rowtype; v_staff boolean; v_items jsonb;
begin
  v_d := _mock_exam_attempt_detail_v1(p_attempt_id);
  if v_d is null then return null; end if;
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  select * into v_s from mock_exam_sets where id = v_a.exam_set_id;
  v_d := v_d || jsonb_build_object('format', coalesce(v_s.format, 'fixed'), 'currentModule', v_a.current_module);
  if coalesce(v_s.format, 'fixed') = 'mst' and v_a.status <> 'graded' then
    v_staff := _is_service_role() or is_admin() or teaches_student(v_a.student_id);
    if not v_staff then
      select coalesce(jsonb_agg(it), '[]'::jsonb) into v_items
      from jsonb_array_elements(v_d->'items') it
      join mock_exam_set_items i on i.id = (it->>'setItemId')::uuid
      where i.module_key = v_a.current_module
        and exists (select 1 from mock_exam_attempt_modules m where m.attempt_id = v_a.id and m.module_key = i.module_key and not m.locked);
      v_d := v_d || jsonb_build_object('items', v_items);
    end if;
  end if;
  return v_d;
end $$;
revoke execute on function public.mock_exam_attempt_detail(uuid) from public, anon;
grant execute on function public.mock_exam_attempt_detail(uuid) to authenticated, service_role;
