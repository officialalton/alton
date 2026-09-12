-- P3 4단계 개정 — 보호자 열람 범위 변경(2026-09-12 제품 오너 지시).
--
-- 직전 20261299000000은 "보호자는 요약만"이라는 당시 정책에 따라 보호자를
-- 필기·교재 원본에서 제외했다. 정책이 바뀌었다: 보호자는 **연결된 자녀의 학생
-- 화면을 읽기 전용으로** 볼 수 있다.
--
--   볼 수 있다: 교재, 문제, 교사 공용 필기, 학생 문제 풀이, 교사 피드백, 복습 기록
--   볼 수 없다: 학생 개인 교재 메모(본인만)
--   할 수 없다: 답안 제출, 필기 작성·수정·삭제, 수업 시작, 준비 구성 변경
--
-- 핵심은 "읽기는 열되 쓰기는 DB에서 막는다"이다. 화면에서 버튼을 숨기는 것으로
-- 처리하지 않는다.

-- 이 수업의 학생과 연결된 보호자인지. is_session_related_v3와 달리 교사·학생을
-- 포함하지 않아, 범위별로 "보호자에게도 열 것인가"를 따로 판단할 수 있다.
create or replace function public.is_session_guardian_v3(p_session_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.sessions s
    join public.subject_enrollments se on se.id = s.subject_enrollment_id
    where s.id = p_session_id
      and (public.is_guardian_of(se.child_id) or public.is_household_guardian_of(se.child_id))
  );
$$;
revoke execute on function public.is_session_guardian_v3(uuid) from public, anon;
grant execute on function public.is_session_guardian_v3(uuid) to authenticated;

comment on function public.is_session_guardian_v3(uuid) is
  'P3: 이 수업 학생의 연결된 보호자인지. 연결이 없는 보호자는 false이므로 자녀 간 내용이 섞이지 않는다.';

-- =========================================================================
-- 조회 — 보호자에게 자녀의 학생 화면을 연다(개인 메모만 제외)
-- =========================================================================
drop policy if exists "필기 범위별 조회" on session_annotation_events;
create policy "필기 범위별 조회" on session_annotation_events for select
  using (
    case scope
      -- 공용 필기: 수업 당사자와 관리자, 그리고 연결된 보호자.
      when 'teacher_shared' then
        public.is_session_teacher_v3(session_id)
        or public.is_session_student_v3(session_id)
        or public.is_session_guardian_v3(session_id)
        or is_admin()
      -- 학생 개인 교재 메모: **본인만.** 보호자도 볼 수 없다 — 이 한 가지는
      -- 정책 변경 후에도 그대로다.
      when 'student_private' then owner_student_id = auth.uid()
      -- 학생 문제 풀이: 본인·담당 교사·연결된 보호자.
      when 'problem_student' then
        owner_student_id = auth.uid()
        or public.is_session_teacher_v3(session_id)
        or public.is_session_guardian_v3(session_id)
        or is_admin()
      -- 교사 피드백 레이어: 같은 범위.
      when 'problem_teacher_feedback' then
        owner_student_id = auth.uid()
        or public.is_session_teacher_v3(session_id)
        or public.is_session_guardian_v3(session_id)
        or is_admin()
      else false
    end
  );

-- 레거시 공용 캔버스도 보호자에게 연다(자녀 수업에 한해).
drop policy if exists "관련자 조회" on canvas_annotations;
create policy "관련자 조회" on canvas_annotations for select
  using (
    public.is_session_teacher_v3(session_id)
    or public.is_session_student_v3(session_id)
    or public.is_session_guardian_v3(session_id)
    or is_admin()
    or public.is_session_related(session_id)
  );

comment on policy "관련자 조회" on canvas_annotations is
  'P3(2026-09-12 개정): 보호자는 연결된 자녀 수업의 필기를 읽기 전용으로 본다.';

-- 풀이판 자체도 보호자가 읽을 수 있어야 복습 기록이 열린다.
drop policy if exists "풀이판 조회" on session_problem_work;
create policy "풀이판 조회" on session_problem_work for select
  using (
    student_id = auth.uid()
    or public.is_session_teacher_v3(session_id)
    or public.is_session_guardian_v3(session_id)
    or is_admin()
  );

-- 수업에 고정된 교재·문제 목록도 마찬가지다.
drop policy if exists "담당 선생님/본인 학생/관리자만 조회" on session_content_manifest;
create policy "담당 선생님/본인 학생/보호자/관리자 조회" on session_content_manifest for select
  using (
    is_admin()
    or public.is_session_guardian_v3(session_id)
    or exists (
      select 1 from sessions s
      where s.id = session_id
        and (
          is_active_teacher_for_enrollment(s.subject_enrollment_id)
          or is_owning_student_for_enrollment(s.subject_enrollment_id)
        )
    )
  );

-- =========================================================================
-- 쓰기 — 보호자는 어떤 범위에도 쓸 수 없다
-- =========================================================================
-- 기존 'teacher_shared' 기록 조건은 is_session_related_v3였는데, 이 판정에는
-- 보호자가 포함된다. 즉 보호자가 공용 필기를 쓸 수 있었다 — 읽기 권한을 넓히는
-- 지금 반드시 함께 막아야 하는 구멍이다(버튼을 숨기는 것으로는 막히지 않는다).
drop policy if exists "필기 범위별 기록" on session_annotation_events;
create policy "필기 범위별 기록" on session_annotation_events for insert
  with check (
    author_id = auth.uid()
    and public.current_account_access_allowed()
    and case scope
      -- 공용 필기: 담당 교사·그 수업의 학생·관리자만. 보호자는 제외.
      -- clear_all은 여전히 교사·관리자만.
      when 'teacher_shared' then
        (
          public.is_session_teacher_v3(session_id)
          or public.is_session_student_v3(session_id)
          or is_admin()
        )
        and (event_type <> 'clear_all' or public.is_session_teacher_v3(session_id) or is_admin())
      when 'student_private' then owner_student_id = auth.uid() and event_type <> 'clear_all'
      when 'problem_student' then owner_student_id = auth.uid() and event_type <> 'clear_all'
      when 'problem_teacher_feedback' then public.is_session_teacher_v3(session_id)
      else false
    end
  );

-- 수정·삭제는 append-only 트리거가 이미 모두에게 막고 있다(20261223000000).
