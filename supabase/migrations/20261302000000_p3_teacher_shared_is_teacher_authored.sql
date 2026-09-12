-- P3 6단계 — 제품 오너 확정(2026-09-12): 교사 공용 필기는 **교사가 작성**한다.
--
-- 그동안 'teacher_shared' 기록 조건은 "수업 당사자면 누구나"였다(R8 이후의 기존
-- 동작). 확정 기준은 다르다:
--
--   교사 공용 필기 → 교사(와 관리자)가 쓴다. 학생·보호자는 읽기만 한다.
--   학생 → 개인 교재 필기(student_private)와 문제별 풀이판(problem_student)에 쓴다.
--
-- 학생이 설명을 따라 적을 자리가 없어지는 것이 아니다 — 학생에게는 같은 교재 위에
-- 자기만 보는 필기 레이어가 있고, 문제는 문제별 풀이판이 따로 있다.
--
-- 이미 남아 있는 학생 작성 공용 필기는 지우지 않는다(append-only 기록이고,
-- 과거 수업의 화면을 바꾸지 않는다는 원칙이 우선한다). 앞으로의 기록만 막는다.
drop policy if exists "필기 범위별 기록" on session_annotation_events;
create policy "필기 범위별 기록" on session_annotation_events for insert
  with check (
    author_id = auth.uid()
    and public.current_account_access_allowed()
    and case scope
      -- 공용 필기: 담당 교사와 관리자만. 학생·보호자는 쓸 수 없다.
      when 'teacher_shared' then
        public.is_session_teacher_v3(session_id) or is_admin()
      when 'student_private' then owner_student_id = auth.uid() and event_type <> 'clear_all'
      when 'problem_student' then owner_student_id = auth.uid() and event_type <> 'clear_all'
      when 'problem_teacher_feedback' then public.is_session_teacher_v3(session_id)
      else false
    end
  );

comment on policy "필기 범위별 기록" on session_annotation_events is
  'P3(2026-09-12 확정): 교사 공용 필기는 교사·관리자가 작성한다. 학생은 개인 교재 필기와 '
  '문제별 풀이판에만 쓴다. 보호자는 어떤 범위에도 쓸 수 없다.';
