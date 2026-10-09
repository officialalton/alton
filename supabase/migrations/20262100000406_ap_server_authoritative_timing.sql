-- AP 모의고사 시간 제한을 서버가 정한다(2026-10-09 오너 결정). 지금까지는 클라이언트 타이머가 주(남은 시간을 15초마다 저장)였고 서버는 만료 뒤에도 답 저장·제출을 막지 않았다.
-- 규칙(AP 응시만 — SAT 고정형·MST 동작은 그대로):
--  · 섹션 시계는 그 섹션에 처음 들어간 시각(ap_section_entered[섹션])부터 공식 분(section_layout.minutes)이다. 첫 답 저장도 진입으로 친다.
--  · 만료(+5초 유예) 뒤 그 섹션의 답 저장·변경은 거절한다('Time is up for this section…').
--  · 마지막 섹션이 만료되면 mock_exam_ap_settle 이 응시를 채점 완료(graded)로 마감한다(멱등). 화면을 닫은 채 만료돼도 다음에 열 때(서버 페이지·클라이언트가 호출) 마감된다.
--  · mock_exam_submit 은 AP 에서 멱등: 이미 제출·채점된 응시에 다시 불러도(더블클릭·두 탭·재시도) 오류 없이 그대로 둔다(행 추가·시각 변경 없음). SAT 는 기존처럼 오류.
--  · 상세(mock_exam_attempt_detail)의 timeRemainingSeconds 는 AP 에서 서버 계산 값이다. mock_exam_save_section_time 은 AP 에서 클라이언트 값을 저장하지 않는다.
-- 되돌리기: 401 의 save_section_time·attempt_detail 정의와 250 의 save_answer·submit 정의로 create or replace, 함수 _mock_exam_ap_* / mock_exam_ap_* 삭제, 컬럼 drop.
alter table public.mock_exam_attempts add column if not exists ap_section_entered jsonb not null default '{}'::jsonb;
comment on column public.mock_exam_attempts.ap_section_entered is 'AP: 섹션 키 → 그 섹션에 처음 들어간 시각(ISO). 섹션 시계의 서버 기준.';

create or replace function public._mock_exam_ap_remaining(p_a public.mock_exam_attempts) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(sec->>'key',
           case when p_a.ap_section_entered ? (sec->>'key')
                then greatest(0, ceil((sec->>'minutes')::int * 60 - extract(epoch from (now() - (p_a.ap_section_entered->>(sec->>'key'))::timestamptz)))::int)
                else (sec->>'minutes')::int * 60 end), '{}'::jsonb)
  from mock_exam_sets s, jsonb_array_elements(s.section_layout->'sections') sec
  where s.id = p_a.exam_set_id and s.exam_program = 'ap';
$$;
revoke execute on function public._mock_exam_ap_remaining(public.mock_exam_attempts) from public, anon, authenticated;

create or replace function public.mock_exam_ap_enter_section(p_attempt_id uuid, p_section text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_a mock_exam_attempts%rowtype; v_s mock_exam_sets%rowtype;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id for update;
  if v_a.id is null or v_a.student_id <> auth.uid() then raise exception 'You can only continue your own attempt.'; end if;
  select * into v_s from mock_exam_sets where id = v_a.exam_set_id;
  if v_s.exam_program <> 'ap' then raise exception 'Not an AP exam.'; end if;
  if not exists (select 1 from jsonb_array_elements(v_s.section_layout->'sections') x where x->>'key' = p_section) then raise exception 'Invalid section.'; end if;
  if v_a.status in ('submitted', 'graded') then return _mock_exam_ap_remaining(v_a); end if;
  if not (v_a.ap_section_entered ? p_section) then
    update mock_exam_attempts
       set ap_section_entered = ap_section_entered || jsonb_build_object(p_section, to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),
           status = case when status = 'assigned' then 'in_progress' else status end,
           started_at = coalesce(started_at, now())
     where id = p_attempt_id returning * into v_a;
  end if;
  return _mock_exam_ap_remaining(v_a);
end $$;
revoke execute on function public.mock_exam_ap_enter_section(uuid, text) from public, anon;
grant execute on function public.mock_exam_ap_enter_section(uuid, text) to authenticated, service_role;

-- 마지막 섹션이 만료됐으면 마감한다. 반환: 응시 상태. 멱등(이미 마감이면 그대로).
create or replace function public.mock_exam_ap_settle(p_attempt_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_a mock_exam_attempts%rowtype; v_s mock_exam_sets%rowtype; v_last jsonb;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id for update;
  if v_a.id is null or v_a.student_id <> auth.uid() then raise exception 'You can only continue your own attempt.'; end if;
  select * into v_s from mock_exam_sets where id = v_a.exam_set_id;
  if v_s.exam_program <> 'ap' or v_a.status not in ('assigned', 'in_progress') then return v_a.status::text; end if;
  select x into v_last from jsonb_array_elements(v_s.section_layout->'sections') with ordinality t(x, n) order by n desc limit 1;
  if v_last is not null and v_a.ap_section_entered ? (v_last->>'key')
     and now() - (v_a.ap_section_entered->>(v_last->>'key'))::timestamptz > make_interval(secs => (v_last->>'minutes')::int * 60 + 5) then
    update mock_exam_attempts set status = 'graded', submitted_at = coalesce(submitted_at, now()), graded_at = coalesce(graded_at, now()), attempt_count = 1 where id = p_attempt_id;
    return 'graded';
  end if;
  return v_a.status::text;
end $$;
revoke execute on function public.mock_exam_ap_settle(uuid) from public, anon;
grant execute on function public.mock_exam_ap_settle(uuid) to authenticated, service_role;

-- 답 저장: 250 의 정의 그대로 + AP 섹션 시간 가드.
create or replace function public.mock_exam_save_answer(p_attempt_id uuid, p_set_item_id uuid, p_response text, p_time_spent_seconds integer default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_a mock_exam_attempts%rowtype; v_i mock_exam_set_items%rowtype; v_c jsonb; v_format text; v_correct boolean;
  v_mst boolean; v_m mock_exam_attempt_modules%rowtype; v_s mock_exam_sets%rowtype; v_min int;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  if v_a.id is null or v_a.student_id <> auth.uid() then raise exception 'You can only continue your own attempt.'; end if;
  v_mst := _mock_exam_is_mst(p_attempt_id);
  if v_mst then
    perform _mock_exam_settle(p_attempt_id);
    select * into v_a from mock_exam_attempts where id = p_attempt_id;
  end if;
  if v_a.status in ('submitted', 'graded') then raise exception 'This exam has already been submitted, so answers cannot be changed.'; end if;
  select * into v_i from mock_exam_set_items where id = p_set_item_id and exam_set_id = v_a.exam_set_id;
  if v_i.id is null or (v_mst and not _mock_exam_item_in_route(v_i, v_a)) then raise exception 'Question not found.'; end if;
  if v_mst then
    if v_a.status <> 'in_progress' then raise exception 'You need to start the exam first.'; end if;
    select * into v_m from mock_exam_attempt_modules where attempt_id = p_attempt_id and module_key = v_i.module_key;
    if v_i.module_key is distinct from v_a.current_module or v_m.locked or v_m.started_at is null then
      raise exception 'This module has already been submitted, so answers cannot be saved.';
    end if;
  end if;
  select * into v_s from mock_exam_sets where id = v_a.exam_set_id;
  if v_s.exam_program = 'ap' then
    select (x->>'minutes')::int into v_min from jsonb_array_elements(v_s.section_layout->'sections') x where x->>'key' = v_i.section;
    if v_min is not null then
      if v_a.ap_section_entered ? v_i.section then
        if now() - (v_a.ap_section_entered->>v_i.section)::timestamptz > make_interval(secs => v_min * 60 + 5) then
          raise exception 'Time is up for this section. Answers can no longer be changed.';
        end if;
      else
        update mock_exam_attempts set ap_section_entered = ap_section_entered || jsonb_build_object(v_i.section, to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) where id = p_attempt_id;
      end if;
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

-- 제출: 250 의 정의 그대로 + AP 멱등.
create or replace function public.mock_exam_submit(p_attempt_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_a mock_exam_attempts%rowtype; v_ap boolean;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id for update;
  if v_a.id is null or v_a.student_id <> auth.uid() then raise exception 'You can only submit your own attempt.'; end if;
  if _mock_exam_is_mst(p_attempt_id) then raise exception 'This exam is submitted module by module.'; end if;
  select exists (select 1 from mock_exam_sets where id = v_a.exam_set_id and exam_program = 'ap') into v_ap;
  if v_a.status not in ('assigned', 'in_progress') then
    if v_ap then return; end if; -- AP: 이미 제출·채점됨 — 재시도·더블클릭·두 탭에서 오류 없이 그대로 둔다
    raise exception 'This exam has already been submitted.';
  end if;
  update mock_exam_attempts
    set status = 'graded', submitted_at = now(), graded_at = now(), attempt_count = 1
    where id = p_attempt_id;
end $$;

-- 섹션 시간 저장: AP 는 서버 시계가 기준이라 클라이언트 값을 저장하지 않는다(SAT 는 기존 그대로, 405 의 in_progress 전환은 enter_section/save_answer 가 대신한다).
create or replace function public.mock_exam_save_section_time(p_attempt_id uuid, p_section text, p_remaining_seconds int)
returns void language plpgsql security definer set search_path = public as $$
declare v_a mock_exam_attempts%rowtype;
begin
  if p_section not in ('rw', 'math') and p_section !~ '^ap_[a-z0-9_]{1,30}$' then raise exception 'Invalid section.'; end if;
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  if v_a.id is null or v_a.student_id <> auth.uid() then raise exception 'You can only take your own exam.'; end if;
  if v_a.status in ('submitted', 'graded') then return; end if;
  if p_section ~ '^ap_' then return; end if;
  update mock_exam_attempts
    set time_remaining_seconds = coalesce(time_remaining_seconds, '{}'::jsonb) || jsonb_build_object(p_section, greatest(0, p_remaining_seconds))
    where id = p_attempt_id;
end $$;

-- 상세: AP 는 서버가 계산한 남은 시간.
create or replace function public.mock_exam_attempt_detail(p_attempt_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d jsonb; s mock_exam_sets%rowtype; v_items jsonb; v_a mock_exam_attempts%rowtype;
begin
  d := _mock_exam_attempt_detail_v5(p_attempt_id);
  if d is null then return null; end if;
  select * into s from mock_exam_sets where id = (d->>'examSetId')::uuid;
  if s.id is null or s.exam_program <> 'ap' then return d || jsonb_build_object('examProgram', 'sat'); end if;
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  select coalesce(jsonb_agg(t.it || jsonb_build_object(
           'optionCount', case when jsonb_typeof(v.options) = 'array' then jsonb_array_length(v.options) else null end,
           'parts', v.statements,
           'apItemIndex', p.ap_item_index) order by t.ord), '[]'::jsonb)
    into v_items
  from jsonb_array_elements(coalesce(d->'items', '[]'::jsonb)) with ordinality as t(it, ord)
  left join mock_exam_set_items i on i.id = (t.it->>'setItemId')::uuid
  left join problem_versions v on v.id = i.problem_version_id
  left join problems p on p.id = i.problem_id;
  return d || jsonb_build_object('items', v_items, 'examProgram', 'ap', 'apSubject', s.ap_subject, 'apLabel', s.ap_label, 'sectionLayout', s.section_layout->'sections',
                                 'timeRemainingSeconds', _mock_exam_ap_remaining(v_a));
end $$;
