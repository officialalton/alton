-- 문제 오류 신고를 과제 묶음(homework_batches)까지 확장 (2026-09-30, UAT 결함 수정).
-- 조사 결과: 선생님 세션 '과제' 탭·학생 포털 과제는 session_problem_work 가 아니라 별도 테이블 homework_batches
--   (items jsonb 문항 스냅샷 — 정답·제출·채점이 원소 안에 있고 문항 버전 id 는 없다)에 있다. 그래서 신고 출처에 'homework_batch' 를 추가한다.
-- 설계 (20261940000000·01, 20261965 계열 본문은 그대로 두고 새 번호로 create or replace)
--  - 신고 원본은 그대로 problem_error_reports 하나. source='homework_batch' + homework_batch_id. 같은 신고자·같은 문항(버전) 1회 고유 제약은 출처와 무관.
--  - 권한: 학생=본인 배치, 선생님=자기가 발급한 배치. 학부모·관리자·타인 배치는 거부(같은 메시지).
--  - 문항 버전: 스냅샷에 problemVersionId 가 있으면 그것, 없으면 문항의 현재 공개 버전(세션 풀이의 coalesce 규칙과 동일).
--  - 판정 처리: 오류 확정(정답 오류·문제 자체 오류)=이미 제출된 과제 묶음 문항 전원 정답 처리(mc/spr autoCorrect=true).
--      선생님이 이미 채점(graded)한 문항은 grade 를 덮어쓰지 않고 errorAdjustmentPending 으로 '조정 대상' 표시만 한다.
--      선생님이 homework_regrade_item() 으로 다시 채점하면 표시가 해제된다. 채점 전 문항은 errorAdjustedAt 만 남고 선생님이 확정할 때 정답으로 굳는다.
--      오류 아님·해설 오류로 바뀌면 조정 표시를 지우고 autoCorrect 를 원채점(스냅샷 정답 + 제출 답)으로 복원한다(수동 채점 결과는 그대로).
--      판정 이후 새로 제출되는 답도 같은 기준(homework_submit_answer). 과제 묶음은 여분 문항 자동 교체 대상이 아니다.
--  - 관리자 읽기: problem_error_report_groups 의 sourceCounts 에 homework_batch, problem_error_report_detail 의 affected.homework(제출 문항·조정·조정 대상 수).
--  - 스냅샷 원소에 추가되는 키: errorAdjustedAt, errorAdjustmentPending, errorAdjustmentVerdictId(학생 마스킹 대상 아님 — 정답·해설을 담지 않는다).
-- 되돌리기: drop function _problem_error_apply_homework, _problem_error_homework_counts, homework_regrade_item; report_submit·apply_verdict·groups·detail·homework_submit_answer 는 이전 번호 본문으로 새 번호에서 재적용;
--          alter table problem_error_reports drop column homework_batch_id (source 제약도 원복).

-- =========================================================================
-- 1. 신고 원본: 출처 확장
-- =========================================================================
alter table problem_error_reports add column if not exists homework_batch_id uuid references homework_batches (id) on delete set null;
alter table problem_error_reports drop constraint if exists problem_error_reports_source_check;
alter table problem_error_reports add constraint problem_error_reports_source_check check (source in ('session_assignment', 'mock_exam', 'homework_batch'));
alter table problem_error_reports drop constraint if exists problem_error_reports_source_shape;
alter table problem_error_reports add constraint problem_error_reports_source_shape check (
  (source = 'session_assignment' and session_source is not null and mock_attempt_id is null and mock_set_item_id is null and homework_batch_id is null)
  or (source = 'mock_exam' and session_source is null and session_id is null and homework_batch_id is null)
  or (source = 'homework_batch' and session_source is null and session_id is null and mock_attempt_id is null and mock_set_item_id is null)
);
create index if not exists problem_error_reports_homework_batch_idx on problem_error_reports (homework_batch_id) where homework_batch_id is not null;

-- 배치·세션 등이 삭제돼 참조가 set null 로 끊기는 갱신은 허용(신고 본문은 유지). 그 외 내용 수정은 계속 금지.
create or replace function public._problem_error_reports_guard() returns trigger
language plpgsql as $$
declare v_old jsonb; v_new jsonb; k text;
begin
  if tg_op = 'DELETE' then
    raise exception '문제 오류 신고는 삭제할 수 없습니다.';
  end if;
  v_old := to_jsonb(old) - 'resolved_verdict_id' - 'resolved_at';
  v_new := to_jsonb(new) - 'resolved_verdict_id' - 'resolved_at';
  foreach k in array array['session_id', 'mock_attempt_id', 'mock_set_item_id', 'homework_batch_id'] loop
    if v_new->k = 'null'::jsonb then
      v_old := v_old - k; v_new := v_new - k;
    end if;
  end loop;
  if v_new is distinct from v_old then
    raise exception '문제 오류 신고 내용은 수정할 수 없습니다.';
  end if;
  return new;
end $$;

-- 과제 묶음 스냅샷에서 (문항, 버전)을 찾는 배치 조회용.
create index if not exists homework_batches_items_gin on homework_batches using gin (items jsonb_path_ops);

-- =========================================================================
-- 2. 신고 제출 RPC — p_homework_batch_id 추가(오버로드가 남지 않게 이전 시그니처를 지운다)
-- =========================================================================
drop function if exists public.problem_error_report_submit(text, text, text, uuid, text, uuid, uuid, uuid);
create or replace function public.problem_error_report_submit(
  p_source text,
  p_report_type text,
  p_memo text default null,
  p_session_id uuid default null,
  p_session_source text default null,
  p_problem_id uuid default null,
  p_attempt_id uuid default null,
  p_set_item_id uuid default null,
  p_homework_batch_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_memo text := nullif(btrim(coalesce(p_memo, '')), '');
  v_problem uuid;
  v_version uuid;
  v_a mock_exam_attempts%rowtype;
  v_i mock_exam_set_items%rowtype;
  v_id uuid;
  v_b homework_batches%rowtype;
  v_it jsonb;
begin
  if v_uid is null then raise exception '로그인이 필요합니다.'; end if;
  select role::text into v_role from profiles where id = v_uid;
  if v_role not in ('student', 'teacher') then
    raise exception '문제 오류 신고는 학생과 선생님만 할 수 있습니다.';
  end if;
  if p_report_type not in ('wrong_key', 'flawed_problem', 'bad_explanation', 'other') then
    raise exception '신고 유형을 선택해 주세요.';
  end if;
  if p_report_type = 'bad_explanation' and v_role <> 'teacher' then
    raise exception '해설 오류 신고는 선생님만 할 수 있습니다.';
  end if;
  if p_report_type = 'other' and v_memo is null then
    raise exception '기타 사유는 내용을 적어 주세요.';
  end if;
  if v_memo is not null and char_length(v_memo) > 1000 then
    raise exception '메모는 1000자 이내로 적어 주세요.';
  end if;

  if p_source = 'session_assignment' then
    if p_session_id is null or p_problem_id is null or p_session_source not in ('lesson', 'homework') then
      raise exception '신고할 문제를 찾을 수 없습니다.';
    end if;
    if not ((v_role = 'student' and is_session_student_v3(p_session_id)) or (v_role = 'teacher' and is_session_teacher_v3(p_session_id))) then
      raise exception '이 수업의 문제만 신고할 수 있습니다.';
    end if;
    v_problem := p_problem_id;
    if p_session_source = 'lesson' then
      select m.problem_version_id into v_version from session_content_manifest m
       where m.session_id = p_session_id and m.content_type = 'problem' and m.content_id = p_problem_id limit 1;
      if not found then raise exception '이 수업에 고정된 문제만 신고할 수 있습니다.'; end if;
    else
      select h.problem_version_id into v_version from session_homework_items h
       where h.session_id = p_session_id and h.problem_id = p_problem_id
         and (v_role = 'teacher' or h.student_id = v_uid) limit 1;
      if not found then raise exception '이 과제에 발급된 문제만 신고할 수 있습니다.'; end if;
    end if;
    v_version := coalesce(v_version, (select published_version_id from problems where id = p_problem_id));
    if v_version is null then raise exception '신고할 문제 버전을 찾을 수 없습니다.'; end if;
    insert into problem_error_reports (problem_id, problem_version_id, source, session_id, session_source, reporter_id, reporter_role, report_type, memo)
    values (v_problem, v_version, 'session_assignment', p_session_id, p_session_source, v_uid, v_role, p_report_type, v_memo)
    on conflict (reporter_id, problem_id, problem_version_id) do nothing
    returning id into v_id;

  elsif p_source = 'mock_exam' then
    select * into v_a from mock_exam_attempts where id = p_attempt_id;
    if v_a.id is null then raise exception '문항을 찾을 수 없습니다.'; end if;
    if not ((v_role = 'student' and v_a.student_id = v_uid) or (v_role = 'teacher' and teaches_student(v_a.student_id))) then
      raise exception '문항을 찾을 수 없습니다.';
    end if;
    select * into v_i from mock_exam_set_items where id = p_set_item_id and exam_set_id = v_a.exam_set_id;
    -- 존재·경로 비노출: 다른 경로 문항·아직 열리지 않은 모듈 문항은 "없음"과 같은 메시지.
    if v_i.id is null or not _mock_exam_item_in_route(v_i, v_a) then raise exception '문항을 찾을 수 없습니다.'; end if;
    if v_role = 'student' then
      if v_a.status = 'assigned' then raise exception '문항을 찾을 수 없습니다.'; end if;
      if v_a.status = 'in_progress' and v_i.module_key is not null and not exists (
           select 1 from mock_exam_attempt_modules m
            where m.attempt_id = v_a.id and m.module_key = v_i.module_key and m.started_at is not null) then
        raise exception '문항을 찾을 수 없습니다.';
      end if;
    end if;
    v_problem := v_i.problem_id;
    v_version := v_i.problem_version_id;
    insert into problem_error_reports (problem_id, problem_version_id, source, mock_attempt_id, mock_set_item_id, reporter_id, reporter_role, report_type, memo)
    values (v_problem, v_version, 'mock_exam', v_a.id, v_i.id, v_uid, v_role, p_report_type, v_memo)
    on conflict (reporter_id, problem_id, problem_version_id) do nothing
    returning id into v_id;
  elsif p_source = 'homework_batch' then
    -- 과제 묶음(homework_batches): 학생=본인 배치, 선생님=자기가 발급한 배치만. 배치 밖 문항·타인 배치는 모두 같은 메시지.
    if p_homework_batch_id is null or p_problem_id is null then raise exception '신고할 문제를 찾을 수 없습니다.'; end if;
    select * into v_b from homework_batches where id = p_homework_batch_id;
    if v_b.id is null or not ((v_role = 'student' and v_b.student_id = v_uid) or (v_role = 'teacher' and v_b.teacher_id = v_uid)) then
      raise exception '이 과제에 발급된 문제만 신고할 수 있습니다.';
    end if;
    select it into v_it from jsonb_array_elements(v_b.items) it where it->>'problemId' = p_problem_id::text limit 1;
    if v_it is null then raise exception '이 과제에 발급된 문제만 신고할 수 있습니다.'; end if;
    v_problem := p_problem_id;
    -- 스냅샷에 버전이 기록돼 있으면 그것, 없으면(이전 발급분) 문항의 현재 공개 버전.
    v_version := coalesce(nullif(v_it->>'problemVersionId', '')::uuid, (select published_version_id from problems where id = p_problem_id));
    if v_version is null then raise exception '신고할 문제 버전을 찾을 수 없습니다.'; end if;
    insert into problem_error_reports (problem_id, problem_version_id, source, homework_batch_id, reporter_id, reporter_role, report_type, memo)
    values (v_problem, v_version, 'homework_batch', v_b.id, v_uid, v_role, p_report_type, v_memo)
    on conflict (reporter_id, problem_id, problem_version_id) do nothing
    returning id into v_id;
  else
    raise exception '알 수 없는 신고 출처입니다.';
  end if;

  if v_id is null then
    return jsonb_build_object('duplicate', true,
      'reportId', (select id from problem_error_reports where reporter_id = v_uid and problem_id = v_problem and problem_version_id = v_version));
  end if;
  return jsonb_build_object('duplicate', false, 'reportId', v_id);
end $$;;
revoke execute on function public.problem_error_report_submit(text, text, text, uuid, text, uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.problem_error_report_submit(text, text, text, uuid, text, uuid, uuid, uuid, uuid) to authenticated;

-- =========================================================================
-- 3. 과제 묶음 채점 조정 (내부 — execute 권한 없음)
-- =========================================================================
create or replace function public._problem_error_apply_homework(p_problem_id uuid, p_version_id uuid, p_verdict_id uuid, p_score_affecting boolean)
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_pub uuid;
  v_b record;
  v_items jsonb;
  v_it jsonb;
  v_new jsonb;
  v_fmt text;
  v_graded boolean;
  v_grade text;
  v_needs boolean;
  v_n int := 0;
begin
  select published_version_id into v_pub from problems where id = p_problem_id;
  for v_b in
    select id, items from homework_batches
     where items @> jsonb_build_array(jsonb_build_object('problemId', p_problem_id))
     order by id for update
  loop
    v_items := '[]'::jsonb;
    for v_it in select value from jsonb_array_elements(v_b.items) loop
      v_new := v_it;
      if v_it->>'problemId' = p_problem_id::text
         and coalesce(nullif(v_it->>'problemVersionId', ''), v_pub::text) = p_version_id::text then
        v_fmt := v_it->>'format';
        v_graded := coalesce((v_it->>'graded')::boolean, false);
        v_grade := v_it->>'grade';
        if p_score_affecting then
          if nullif(v_it->>'submittedAt', '') is not null then
            v_needs := (not v_graded) or v_grade is distinct from 'correct';
            if v_fmt in ('mc', 'spr') then v_new := v_new || jsonb_build_object('autoCorrect', true); end if;
            v_new := v_new || jsonb_build_object(
              'errorAdjustmentVerdictId', p_verdict_id,
              'errorAdjustedAt', case when v_needs then to_jsonb(now()) else v_it->'errorAdjustedAt' end,
              'errorAdjustmentPending', v_graded and v_grade is distinct from 'correct');
            v_n := v_n + 1;
          end if;
        elsif nullif(v_it->>'errorAdjustmentVerdictId', '') is not null then
          v_new := v_new - 'errorAdjustmentVerdictId' - 'errorAdjustedAt' - 'errorAdjustmentPending';
          if v_fmt in ('mc', 'spr') then
            v_new := v_new || jsonb_build_object('autoCorrect',
              _answer_auto_grade(v_fmt, v_it->>'response', nullif(v_it->>'correctIndex', '')::int, v_it->'answers'));
          end if;
          v_n := v_n + 1;
        end if;
      end if;
      v_items := v_items || jsonb_build_array(v_new);
    end loop;
    if v_items is distinct from v_b.items then
      update homework_batches set items = v_items where id = v_b.id;
    end if;
  end loop;
  return v_n;
end $$;
revoke execute on function public._problem_error_apply_homework(uuid, uuid, uuid, boolean) from public, anon, authenticated;

create or replace function public._problem_error_homework_counts(p_problem_id uuid, p_version_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'items', count(*) filter (where s.submitted),
    'adjusted', count(*) filter (where s.adjusted),
    'pending', count(*) filter (where s.pending))
  from (
    select nullif(it->>'submittedAt', '') is not null as submitted,
           nullif(it->>'errorAdjustedAt', '') is not null as adjusted,
           coalesce((it->>'errorAdjustmentPending')::boolean, false) as pending
      from homework_batches b
      cross join lateral jsonb_array_elements(b.items) it
     where b.items @> jsonb_build_array(jsonb_build_object('problemId', p_problem_id))
       and it->>'problemId' = p_problem_id::text
       and coalesce(nullif(it->>'problemVersionId', ''), (select published_version_id::text from problems where id = p_problem_id)) = p_version_id::text
  ) s;
$$;
revoke execute on function public._problem_error_homework_counts(uuid, uuid) from public, anon, authenticated;

-- =========================================================================
-- 4. 학생 제출: 판정 이후 새로 제출되는 답도 같은 기준으로 자동 채점(20261429000000 본문 + 오류 확정 반영)
-- =========================================================================
create or replace function public.homework_submit_answer(p_batch_id uuid, p_problem_id uuid, p_response text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_b homework_batches%rowtype; v_items jsonb := '[]'::jsonb; v_it jsonb; v_found boolean := false; v_auto boolean;
  v_ver uuid; v_vid uuid; v_dec text;
begin
  select * into v_b from homework_batches where id = p_batch_id;
  if v_b.id is null or v_b.student_id <> auth.uid() then raise exception '본인 과제만 답할 수 있습니다.'; end if;
  for v_it in select value from jsonb_array_elements(v_b.items) loop
    if (v_it->>'problemId')::uuid = p_problem_id then
      v_found := true;
      if coalesce((v_it->>'graded')::boolean, false) then raise exception '이미 채점된 과제는 답을 바꿀 수 없습니다.'; end if;
      v_auto := _answer_auto_grade(v_it->>'format', p_response, (v_it->>'correctIndex')::int, v_it->'answers');
      v_it := (v_it - 'errorAdjustmentVerdictId' - 'errorAdjustedAt' - 'errorAdjustmentPending')
              || jsonb_build_object('response', p_response, 'submittedAt', now(), 'autoCorrect', v_auto);
      if v_it->>'format' in ('mc', 'spr') then
        v_ver := coalesce(nullif(v_it->>'problemVersionId', '')::uuid, (select published_version_id from problems where id = p_problem_id));
        select v.id, v.decision into v_vid, v_dec from problem_error_verdicts v
         where v.problem_id = p_problem_id and v.problem_version_id = v_ver
         order by v.decided_at desc, v.id desc limit 1;
        if v_dec in ('key_wrong_confirmed', 'flawed_confirmed') then
          v_it := v_it || jsonb_build_object('autoCorrect', true, 'errorAdjustmentVerdictId', v_vid,
                                             'errorAdjustedAt', now(), 'errorAdjustmentPending', false);
        end if;
      end if;
    end if;
    v_items := v_items || jsonb_build_array(v_it);
  end loop;
  if not v_found then raise exception '문항을 찾을 수 없습니다.'; end if;
  update homework_batches set items = v_items where id = p_batch_id;
end $$;

-- =========================================================================
-- 5. 선생님 재채점(조정 대상 해제). 발급 교사만, 조정 대상으로 표시된 문항만.
--    p_grade 가 null 이면 (조정된) 자동 채점 결과를 그대로 확정한다.
-- =========================================================================
create or replace function public.homework_regrade_item(p_batch_id uuid, p_problem_id uuid, p_grade text default null, p_comment text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_b homework_batches%rowtype; v_items jsonb := '[]'::jsonb; v_it jsonb; v_found boolean := false; v_grade text := p_grade;
  v_comment text := nullif(btrim(coalesce(p_comment, '')), '');
begin
  if auth.uid() is null then raise exception '인증되지 않은 사용자입니다.'; end if;
  select * into v_b from homework_batches where id = p_batch_id for update;
  if v_b.id is null or v_b.teacher_id <> auth.uid() then raise exception '발급한 교사만 채점할 수 있습니다.'; end if;
  if v_grade is not null and v_grade not in ('correct', 'incorrect') then raise exception '채점 결과는 정답/오답 중 하나입니다.'; end if;
  for v_it in select value from jsonb_array_elements(v_b.items) loop
    if v_it->>'problemId' = p_problem_id::text then
      v_found := true;
      if not coalesce((v_it->>'errorAdjustmentPending')::boolean, false) then
        raise exception '다시 채점할 조정 대상 문항이 아닙니다.';
      end if;
      if v_grade is null then
        if nullif(v_it->>'autoCorrect', '') is null then raise exception '채점 결과(정답/오답)를 골라 주세요.'; end if;
        v_grade := case when (v_it->>'autoCorrect')::boolean then 'correct' else 'incorrect' end;
      end if;
      v_it := v_it || jsonb_build_object('grade', v_grade, 'gradeComment', coalesce(v_comment, v_it->>'gradeComment'),
                                         'graded', true, 'gradedAt', now(), 'errorAdjustmentPending', false);
      if v_grade = 'incorrect' then v_it := v_it || jsonb_build_object('savedToPractice', true); end if;
    end if;
    v_items := v_items || jsonb_build_array(v_it);
  end loop;
  if not v_found then raise exception '문항을 찾을 수 없습니다.'; end if;
  update homework_batches set items = v_items where id = p_batch_id;
end $$;
revoke execute on function public.homework_regrade_item(uuid, uuid, text, text) from public, anon;
grant execute on function public.homework_regrade_item(uuid, uuid, text, text) to authenticated;

-- =========================================================================
-- 6. 판정 RPC (본문은 20261940000001 + 과제 묶음 조정 호출)
-- =========================================================================
create or replace function public.problem_error_apply_verdict(
  p_problem_id uuid,
  p_version_id uuid,
  p_decision text,
  p_note text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_prob problems%rowtype;
  v_last problem_error_verdicts%rowtype;
  v_id uuid;
  v_affecting boolean;
  v_confirmed boolean;
  v_mock int := 0;
  v_work int := 0;
  v_hw int := 0;
  v_resolved int;
  v_needs int := 0;
  v_need uuid;
  v_res text;
  v_replaced int := 0;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_uid is null or not is_admin() then raise exception '관리자만 판정할 수 있습니다.'; end if;
  if p_decision not in ('not_error', 'key_wrong_confirmed', 'flawed_confirmed', 'explanation_confirmed') then
    raise exception '알 수 없는 판정입니다.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('problem_error:' || p_problem_id::text, 0));
  select * into v_prob from problems where id = p_problem_id for update;
  if v_prob.id is null then raise exception '존재하지 않는 문항입니다.'; end if;
  if not exists (select 1 from problem_versions where id = p_version_id and problem_id = p_problem_id) then
    raise exception '이 문항의 버전이 아닙니다.';
  end if;

  select * into v_last from problem_error_verdicts
   where problem_id = p_problem_id and problem_version_id = p_version_id
   order by decided_at desc, id desc limit 1;
  if v_last.id is not null and v_last.decision = p_decision then
    -- 같은 판정 재적용: 새 행 없음. 남아 있는 열린 신고만 닫는다(판정 이후 들어온 신고).
    update problem_error_reports set resolved_verdict_id = v_last.id, resolved_at = now()
     where problem_id = p_problem_id and problem_version_id = p_version_id and resolved_verdict_id is null;
    get diagnostics v_resolved = row_count;
    if v_resolved > 0 and not exists (select 1 from problem_error_reports where problem_id = p_problem_id and resolved_verdict_id is null) then
      update problems set error_review_needed = false where id = p_problem_id;
    end if;
    return jsonb_build_object('alreadyApplied', true, 'verdictId', v_last.id, 'decision', v_last.decision, 'resolvedReports', v_resolved);
  end if;

  v_affecting := p_decision in ('key_wrong_confirmed', 'flawed_confirmed');
  v_confirmed := p_decision <> 'not_error';

  insert into problem_error_verdicts (problem_id, problem_version_id, decision, note, decided_by)
  values (p_problem_id, p_version_id, p_decision, v_note, v_uid) returning id into v_id;

  update problem_error_reports set resolved_verdict_id = v_id, resolved_at = now()
   where problem_id = p_problem_id and problem_version_id = p_version_id and resolved_verdict_id is null;
  get diagnostics v_resolved = row_count;
  -- 다른 버전에 열린 신고가 남아 있으면 검토 필요 표시는 유지.
  update problems set error_review_needed = exists (
      select 1 from problem_error_reports r where r.problem_id = p_problem_id and r.resolved_verdict_id is null)
   where id = p_problem_id;

  if v_confirmed then
    update problems
       set archived_at = coalesce(archived_at, now()),
           archived_reason = coalesce(archived_reason, '문제 오류 신고 확정(' || p_decision || ')')
     where id = p_problem_id;
    -- 같은 칸(모듈×난이도×skill, 용도) 정보와 함께 대체 문항 필요 큐에 쌓고, 여분이 있으면 아직 시작 안 한 세트의 그 칸을 자동 교체한다.
    -- 이 문항의 큐가 이미 있으면(이전 확정 판정) 다시 쌓지·교체하지 않는다.
    if not exists (select 1 from problem_replacement_needs where problem_id = p_problem_id) then
      insert into problem_replacement_needs
        (verdict_id, problem_id, set_item_id, exam_set_id, section, module_key, route, difficulty, sat_domain, skill_code, usage_scope, in_mock_set)
      select v_id, p_problem_id, i.id, i.exam_set_id, i.section, i.module_key::text, i.route::text, i.difficulty, i.sat_domain, i.skill_code, v_prob.usage_scope, true
        from mock_exam_set_items i join mock_exam_sets s on s.id = i.exam_set_id
       where i.problem_id = p_problem_id and s.archived_at is null and s.status in ('draft', 'published');
      get diagnostics v_needs = row_count;
      if v_needs = 0 then
        insert into problem_replacement_needs (verdict_id, problem_id, difficulty, sat_domain, skill_code, usage_scope, in_mock_set)
        values (v_id, p_problem_id, (select difficulty from problem_versions where id = p_version_id), v_prob.sat_domain, v_prob.skill_code, v_prob.usage_scope, false);
        v_needs := 1;
      end if;
      for v_need in select id from problem_replacement_needs where problem_id = p_problem_id and in_mock_set order by id loop
        v_res := _problem_error_try_replace_need(v_need);
        if v_res = 'replaced' then v_replaced := v_replaced + 1; end if;
      end loop;
    end if;
  end if;

  -- 이전 판정이 만든 조정은 모두 대체 처리한 뒤 새 판정 기준으로 다시 계산한다.
  update mock_exam_answer_adjustments set superseded_at = now()
   where problem_id = p_problem_id and problem_version_id = p_version_id and superseded_at is null;
  if v_affecting then
    v_mock := _problem_error_apply_mock(p_problem_id, p_version_id, v_id);
  end if;
  v_work := _problem_error_apply_session(p_problem_id, p_version_id, v_id, v_affecting);
  v_hw := _problem_error_apply_homework(p_problem_id, p_version_id, v_id, v_affecting);

  return jsonb_build_object('alreadyApplied', false, 'verdictId', v_id, 'decision', p_decision,
    'resolvedReports', v_resolved, 'mockAdjustedAnswers', v_mock, 'sessionWorksAdjusted', v_work, 'homeworkItemsAdjusted', v_hw,
    'replacementNeedsCreated', v_needs, 'autoReplaced', v_replaced,
    'replacementNeedsOpen', (select count(*) from problem_replacement_needs where problem_id = p_problem_id and status = 'open'),
    'archived', v_confirmed);
end $$;

-- =========================================================================
-- 7. 관리자 읽기: 목록 출처 집계·상세 영향 집계(과제 묶음 포함)
-- =========================================================================
create or replace function public.problem_error_report_groups(
  p_status text default 'open', p_limit int default 50, p_offset int default 0,
  p_skill text default null, p_difficulty text default null, p_domain text default null, p_days int default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_total int; v_rows jsonb; v_limit int := least(greatest(coalesce(p_limit, 50), 1), 200); v_open boolean := coalesce(p_status, 'open') <> 'all';
begin
  if not is_admin() then raise exception '관리자만 볼 수 있습니다.'; end if;
  select count(*) into v_total from (
    select 1 from problem_error_reports r
    join problems p on p.id = r.problem_id
    join problem_versions v on v.id = r.problem_version_id
    where (not v_open or r.resolved_verdict_id is null)
      and (p_skill is null or coalesce(p.skill_code, 'unknown') = p_skill)
      and (p_domain is null or coalesce(p.sat_domain, 'unknown') = p_domain)
      and (p_difficulty is null or coalesce(v.difficulty::text, 'unknown') = p_difficulty)
      and (p_days is null or r.created_at >= now() - make_interval(days => p_days))
    group by r.problem_id, r.problem_version_id) x;
  select coalesce(jsonb_agg(g.item order by g.last_at desc), '[]'::jsonb) into v_rows from (
    select c.last_at, jsonb_build_object(
      'problemId', c.problem_id, 'versionId', c.problem_version_id,
      'format', p.format, 'satDomain', p.sat_domain, 'skillCode', p.skill_code, 'difficulty', v.difficulty,
      'snippet', left(coalesce(nullif(v.question, ''), v.passage, ''), 140),
      'reportCount', c.n, 'openCount', c.n_open,
      'typeCounts', jsonb_build_object('wrong_key', c.n_key, 'flawed_problem', c.n_flawed, 'bad_explanation', c.n_expl, 'other', c.n_other),
      'sourceCounts', jsonb_build_object('session_assignment', c.n_session, 'mock_exam', c.n_mock, 'homework_batch', c.n_hw),
      'firstAt', c.first_at, 'lastAt', c.last_at,
      'archived', p.archived_at is not null,
      'latestDecision', (select lv.decision from problem_error_verdicts lv where lv.problem_id = c.problem_id and lv.problem_version_id = c.problem_version_id
                          order by lv.decided_at desc, lv.id desc limit 1)
    ) as item
    from (
      select r.problem_id, r.problem_version_id, count(*) n, count(*) filter (where r.resolved_verdict_id is null) n_open,
             count(*) filter (where r.report_type = 'wrong_key') n_key, count(*) filter (where r.report_type = 'flawed_problem') n_flawed,
             count(*) filter (where r.report_type = 'bad_explanation') n_expl, count(*) filter (where r.report_type = 'other') n_other,
             count(*) filter (where r.source = 'session_assignment') n_session, count(*) filter (where r.source = 'mock_exam') n_mock, count(*) filter (where r.source = 'homework_batch') n_hw,
             min(r.created_at) first_at, max(r.created_at) last_at
      from problem_error_reports r
      join problems fp on fp.id = r.problem_id
      join problem_versions fv on fv.id = r.problem_version_id
      where (not v_open or r.resolved_verdict_id is null)
        and (p_skill is null or coalesce(fp.skill_code, 'unknown') = p_skill)
        and (p_domain is null or coalesce(fp.sat_domain, 'unknown') = p_domain)
        and (p_difficulty is null or coalesce(fv.difficulty::text, 'unknown') = p_difficulty)
        and (p_days is null or r.created_at >= now() - make_interval(days => p_days))
      group by r.problem_id, r.problem_version_id
      order by max(r.created_at) desc
      limit v_limit offset greatest(coalesce(p_offset, 0), 0)
    ) c
    join problems p on p.id = c.problem_id
    join problem_versions v on v.id = c.problem_version_id
  ) g;
  return jsonb_build_object('total', v_total, 'rows', v_rows);
end $$;;
create or replace function public.problem_error_report_detail(p_problem_id uuid, p_version_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_prob problems%rowtype; v_ver problem_versions%rowtype; v_out jsonb;
begin
  if not is_admin() then raise exception '관리자만 볼 수 있습니다.'; end if;
  select * into v_prob from problems where id = p_problem_id;
  select * into v_ver from problem_versions where id = p_version_id and problem_id = p_problem_id;
  if v_prob.id is null or v_ver.id is null then raise exception '문항을 찾을 수 없습니다.'; end if;
  v_out := jsonb_build_object(
    'problem', jsonb_build_object('id', v_prob.id, 'format', v_prob.format, 'satDomain', v_prob.sat_domain, 'skillCode', v_prob.skill_code,
      'usageScope', v_prob.usage_scope, 'archived', v_prob.archived_at is not null, 'archivedReason', v_prob.archived_reason,
      'reviewNeeded', v_prob.error_review_needed),
    'version', jsonb_build_object('id', v_ver.id, 'versionNo', v_ver.version_no, 'status', v_ver.status, 'passage', v_ver.passage, 'question', v_ver.question,
      'options', v_ver.options, 'correctIndex', v_ver.correct_index, 'answers', v_ver.answers, 'explanation', v_ver.explanation, 'difficulty', v_ver.difficulty),
    'reports', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'source', r.source, 'sessionSource', r.session_source, 'reporterRole', r.reporter_role,
        'reporterName', pr.name, 'reportType', r.report_type, 'memo', r.memo, 'createdAt', r.created_at, 'resolved', r.resolved_verdict_id is not null)
        order by r.created_at desc)
      from (select * from problem_error_reports where problem_id = p_problem_id and problem_version_id = p_version_id order by created_at desc limit 200) r
      left join profiles pr on pr.id = r.reporter_id), '[]'::jsonb),
    'reportTotal', (select count(*) from problem_error_reports where problem_id = p_problem_id and problem_version_id = p_version_id),
    'affected', jsonb_build_object(
      'mockAttemptsGraded', (select count(*) from mock_exam_set_items i join mock_exam_attempts a on a.exam_set_id = i.exam_set_id and a.status = 'graded'
                              where i.problem_id = p_problem_id and i.problem_version_id = p_version_id),
      'mockAttemptsOpen', (select count(*) from mock_exam_set_items i join mock_exam_attempts a on a.exam_set_id = i.exam_set_id and a.status <> 'graded'
                            where i.problem_id = p_problem_id and i.problem_version_id = p_version_id),
      'sessionWorks', (select count(*) from session_problem_work w join problems p on p.id = w.problem_id
                        where w.problem_id = p_problem_id and w.submitted_at is not null
                          and coalesce(w.problem_version_id, p.published_version_id) = p_version_id),
      'mockAdjusted', (select count(*) from mock_exam_answer_adjustments where problem_id = p_problem_id and problem_version_id = p_version_id and superseded_at is null),
      'sessionAdjusted', (select count(*) from session_problem_work w where w.problem_id = p_problem_id and w.error_adjusted_at is not null),
      'sessionPending', (select count(*) from session_problem_work w where w.problem_id = p_problem_id and w.error_adjustment_pending),
      'homework', _problem_error_homework_counts(p_problem_id, p_version_id)),
    'verdicts', coalesce((
      select jsonb_agg(jsonb_build_object('id', vd.id, 'decision', vd.decision, 'note', vd.note, 'decidedAt', vd.decided_at, 'decidedByName', pr.name) order by vd.decided_at desc)
      from problem_error_verdicts vd left join profiles pr on pr.id = vd.decided_by
      where vd.problem_id = p_problem_id and vd.problem_version_id = p_version_id), '[]'::jsonb),
    'replacementNeeds', coalesce((
      select jsonb_agg(jsonb_build_object('id', n.id, 'status', n.status, 'moduleKey', n.module_key, 'route', n.route, 'difficulty', n.difficulty,
        'satDomain', n.sat_domain, 'skillCode', n.skill_code, 'usageScope', n.usage_scope, 'inMockSet', n.in_mock_set,
        'openReason', n.open_reason, 'replacementProblemId', n.replacement_problem_id) order by n.created_at)
      from problem_replacement_needs n where n.problem_id = p_problem_id), '[]'::jsonb),
    'replacements', coalesce((
      select jsonb_agg(jsonb_build_object('examSetId', r.exam_set_id, 'examSetName', s.name, 'newProblemId', r.new_problem_id,
        'moduleKey', r.module_key, 'route', r.route, 'createdAt', r.created_at) order by r.created_at)
      from mock_exam_item_replacements r left join mock_exam_sets s on s.id = r.exam_set_id
      where r.old_problem_id = p_problem_id), '[]'::jsonb));
  return v_out;
end $$;
