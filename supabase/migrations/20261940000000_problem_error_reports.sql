-- 문제 오류 신고 (2026-09-29, 오너 확정) — 1/2: 신고 원본·검토 필요 표시·제출 RPC·과제 조정 컬럼.
-- 설계 요약
--  - 신고 원본은 problem_error_reports 하나(수업 과제·모의고사 공용). 같은 신고자·같은 문항(버전)은 고유 제약으로 1회.
--  - 신고 1건이면 즉시 problems.error_review_needed = true (임계값은 1로 고정, 설정값 없음).
--  - 신고 유형: wrong_key(정답 오류) / flawed_problem(문제 자체 오류) / bad_explanation(해설 오류, 선생님만) / other(메모 필수).
--  - 학생·선생님만 신고할 수 있다(학부모·관리자는 제출 불가). 테이블 직접 쓰기는 모두 닫고 SECURITY DEFINER RPC 로만.
--  - 신고자는 자기 신고만, 관리자는 전체를 읽는다. 해당 신고의 판정 결과는 problem_error_report_mine() 으로만 요약(정답·메모 미포함).
--  - session_problem_work 에 오류 판정 조정 표시 컬럼 추가(자동 채점 재계산·선생님 수동 채점 미덮어쓰기 표시는 2/2).
-- 되돌리기: drop table problem_error_reports cascade; alter table problems drop column error_review_needed, drop column error_review_flagged_at;
--           alter table session_problem_work drop column error_adjusted_at, drop column error_adjustment_pending, drop column error_adjustment_verdict_id;

-- =========================================================================
-- 1. 문항 '검토 필요' 표시
-- =========================================================================
alter table problems
  add column if not exists error_review_needed boolean not null default false,
  add column if not exists error_review_flagged_at timestamptz;
create index if not exists problems_error_review_needed_idx
  on problems (error_review_flagged_at desc) where error_review_needed;
comment on column problems.error_review_needed is
  '오류 신고가 1건이라도 열려 있으면 true(임계값 1 고정). 관리자 판정(problem_error_apply_verdict)이 해당 신고를 닫으면 false.';

-- =========================================================================
-- 2. 신고 원본
-- =========================================================================
create table problem_error_reports (
  id uuid primary key default gen_random_uuid(),
  problem_id uuid not null references problems (id),
  problem_version_id uuid not null references problem_versions (id),
  source text not null check (source in ('session_assignment', 'mock_exam')),
  -- 수업 과제 출처
  session_id uuid references sessions (id) on delete set null,
  session_source text check (session_source in ('lesson', 'homework')),
  -- 모의고사 출처
  mock_attempt_id uuid references mock_exam_attempts (id) on delete set null,
  mock_set_item_id uuid references mock_exam_set_items (id) on delete set null,
  reporter_id uuid not null references profiles (id),
  reporter_role text not null check (reporter_role in ('student', 'teacher')),
  report_type text not null check (report_type in ('wrong_key', 'flawed_problem', 'bad_explanation', 'other')),
  memo text check (memo is null or char_length(memo) <= 1000),
  created_at timestamptz not null default now(),
  resolved_verdict_id uuid,
  resolved_at timestamptz,
  -- 같은 신고자·같은 문항(버전) 중복 신고 불가.
  constraint problem_error_reports_one_per_reporter unique (reporter_id, problem_id, problem_version_id),
  constraint problem_error_reports_other_needs_memo check (report_type <> 'other' or char_length(btrim(coalesce(memo, ''))) > 0),
  constraint problem_error_reports_explanation_teacher_only check (report_type <> 'bad_explanation' or reporter_role = 'teacher'),
  -- 출처별 모양. 세션·응시·세트 문항은 삭제·교체돼도(set null) 신고 본문이 남아야 하므로 해당 id 는 필수로 강제하지 않는다.
  constraint problem_error_reports_source_shape check (
    (source = 'session_assignment' and session_source is not null and mock_attempt_id is null and mock_set_item_id is null)
    or (source = 'mock_exam' and session_source is null and session_id is null)
  )
);
create index problem_error_reports_open_idx on problem_error_reports (problem_id, problem_version_id) where resolved_verdict_id is null;
create index problem_error_reports_problem_idx on problem_error_reports (problem_id, problem_version_id, created_at desc);
create index problem_error_reports_created_idx on problem_error_reports (created_at desc);
comment on table problem_error_reports is
  '문제 오류 신고(수업 과제·모의고사 공용 단일 원본). 직접 쓰기 없음 — problem_error_report_submit() 으로만 생성, 관리자 판정이 resolved_* 를 채운다.';

alter table problem_error_reports enable row level security;
revoke all on problem_error_reports from anon, authenticated;
grant select on problem_error_reports to authenticated;
create policy "신고자 본인·관리자 조회" on problem_error_reports for select
  using (reporter_id = auth.uid() or is_admin());

-- 신고 내용은 바뀌지 않는다: 삭제 금지, 갱신은 해결 표시(resolved_*)만.
create or replace function public._problem_error_reports_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception '문제 오류 신고는 삭제할 수 없습니다.';
  end if;
  if (to_jsonb(new) - 'resolved_verdict_id' - 'resolved_at') is distinct from (to_jsonb(old) - 'resolved_verdict_id' - 'resolved_at') then
    raise exception '문제 오류 신고 내용은 수정할 수 없습니다.';
  end if;
  return new;
end $$;
create trigger problem_error_reports_guard before update or delete on problem_error_reports
  for each row execute function _problem_error_reports_guard();

-- 신고 1건 → 즉시 검토 필요(이미 true 면 행을 건드리지 않아 대량 신고에서 잠금 경합이 없다).
create or replace function public._problem_error_reports_flag() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update problems set error_review_needed = true, error_review_flagged_at = now()
  where id = new.problem_id and not error_review_needed;
  return new;
end $$;
create trigger problem_error_reports_flag after insert on problem_error_reports
  for each row execute function _problem_error_reports_flag();

-- =========================================================================
-- 3. 수업 과제 풀이의 오류 판정 조정 표시
--    (auto_correct 는 컬럼 SELECT 가 회수돼 있다 — 새 컬럼 중 화면에 필요한 둘만 authenticated 에 다시 연다.)
-- =========================================================================
alter table session_problem_work
  add column if not exists error_adjusted_at timestamptz,
  add column if not exists error_adjustment_pending boolean not null default false,
  add column if not exists error_adjustment_verdict_id uuid;
grant select (error_adjusted_at, error_adjustment_pending) on public.session_problem_work to anon, authenticated;
comment on column session_problem_work.error_adjusted_at is '문항 오류 판정으로 이 풀이의 자동 채점·안내가 조정된 시각(채점 뒤 학생·보호자 안내용).';
comment on column session_problem_work.error_adjustment_pending is
  '선생님이 이미 채점했는데 문항 오류 판정(전원 정답 처리)과 결과가 달라 확인이 필요한 풀이 — 수동 채점은 덮어쓰지 않고 이 표시만 한다. 다시 채점하면 해제.';

-- =========================================================================
-- 4. 신고 제출 RPC (학생·선생님)
-- =========================================================================
create or replace function public.problem_error_report_submit(
  p_source text,
  p_report_type text,
  p_memo text default null,
  p_session_id uuid default null,
  p_session_source text default null,
  p_problem_id uuid default null,
  p_attempt_id uuid default null,
  p_set_item_id uuid default null
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
  else
    raise exception '알 수 없는 신고 출처입니다.';
  end if;

  if v_id is null then
    return jsonb_build_object('duplicate', true,
      'reportId', (select id from problem_error_reports where reporter_id = v_uid and problem_id = v_problem and problem_version_id = v_version));
  end if;
  return jsonb_build_object('duplicate', false, 'reportId', v_id);
end $$;
revoke execute on function public.problem_error_report_submit(text, text, text, uuid, text, uuid, uuid, uuid) from public, anon;
grant execute on function public.problem_error_report_submit(text, text, text, uuid, text, uuid, uuid, uuid) to authenticated;
