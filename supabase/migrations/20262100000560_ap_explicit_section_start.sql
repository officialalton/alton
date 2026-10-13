-- AP 섹션 탭을 눌러 보기만 해서는 그 섹션 시계가 시작되지 않는다(2026-10-12 오너 결정).
--  · 첫 섹션 = 응시 시작과 함께 시작(변경 없음). 나머지 섹션은 학생이 "Start section" 을 눌러 mock_exam_ap_enter_section 을 부를 때만 시계가 시작한다(406 의 함수 그대로, 멱등).
--  · mock_exam_save_answer: 시작 안 한 비첫 섹션의 저장은 거절한다(예전엔 첫 저장이 암묵 진입이었다). 첫 섹션의 암묵 진입은 유지한다.
--  · mock_exam_attempt_detail: 학생 본인의 진행 중(assigned/in_progress) AP 응시에서 시작 안 한 섹션의 문항 내용(passage·question·options·figure·parts)을 비워서 보낸다(네트워크로도 미리 못 봄).
--    새 키 apSectionStarted{섹션키: bool}. 이미 들어간 섹션(ap_section_entered)·제출/채점 뒤·직원 조회는 그대로(전부 공개).
--  · 이미 진행 중인 응시: 이미 들어간 섹션은 그대로 시작됨으로 취급, 시계·상태 변경 없음.
-- 되돌리기: 406 의 mock_exam_save_answer·mock_exam_attempt_detail 정의로 create or replace.

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
      elsif v_i.section = v_s.section_layout->'sections'->0->>'key' then
        -- 첫 섹션만: 응시 시작 = 첫 섹션 시작(구버전 화면이 진입 호출 없이 먼저 저장해도 같다).
        update mock_exam_attempts set ap_section_entered = ap_section_entered || jsonb_build_object(v_i.section, to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) where id = p_attempt_id;
      else
        raise exception 'This section has not started yet. Press Start section first.';
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


create or replace function public.mock_exam_attempt_detail(p_attempt_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d jsonb; s mock_exam_sets%rowtype; v_items jsonb; v_a mock_exam_attempts%rowtype; v_first text; v_started jsonb; v_mask boolean;
begin
  d := _mock_exam_attempt_detail_v5(p_attempt_id);
  if d is null then return null; end if;
  select * into s from mock_exam_sets where id = (d->>'examSetId')::uuid;
  if s.id is null or s.exam_program <> 'ap' then return d || jsonb_build_object('examProgram', 'sat'); end if;
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  v_mask := v_a.student_id = auth.uid() and v_a.status in ('assigned', 'in_progress');
  v_first := s.section_layout->'sections'->0->>'key';
  select coalesce(jsonb_object_agg(x->>'key', (not v_mask) or v_a.ap_section_entered ? (x->>'key') or (x->>'key') = v_first), '{}'::jsonb)
    into v_started from jsonb_array_elements(s.section_layout->'sections') x;
  select coalesce(jsonb_agg(
           case when coalesce((v_started->>(t.it->>'section'))::boolean, true) then t.it
                else t.it || jsonb_build_object('passage', null, 'question', null, 'options', null, 'figure', null) end
           || case when coalesce((v_started->>(t.it->>'section'))::boolean, true)
                   then jsonb_build_object('optionCount', case when jsonb_typeof(v.options) = 'array' then jsonb_array_length(v.options) else null end, 'parts', v.statements)
                   else jsonb_build_object('optionCount', null, 'parts', null) end
           || jsonb_build_object('apItemIndex', p.ap_item_index) order by t.ord), '[]'::jsonb)
    into v_items
  from jsonb_array_elements(coalesce(d->'items', '[]'::jsonb)) with ordinality as t(it, ord)
  left join mock_exam_set_items i on i.id = (t.it->>'setItemId')::uuid
  left join problem_versions v on v.id = i.problem_version_id
  left join problems p on p.id = i.problem_id;
  return d || jsonb_build_object('items', v_items, 'examProgram', 'ap', 'apSubject', s.ap_subject, 'apLabel', s.ap_label, 'sectionLayout', s.section_layout->'sections',
                                 'timeRemainingSeconds', _mock_exam_ap_remaining(v_a), 'apSectionStarted', v_started);
end $$;
