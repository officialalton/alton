-- M4 — 골든패스 실사용 버그 #1/#2: 학생 포털 "선생님" 탭 / 선생님 포털 "학생" 탭이
-- 체험 수업(trial)만 진행한 사용자에게 "매칭된 선생님이 없습니다" / "담당 중인 학생이
-- 없습니다"로 뜨는 문제의 근본 원인.
--
-- 조사 결과: `teaches_student()` 함수와 `teachers` 테이블의 SELECT RLS 정책이 R1(v3
-- 스키마, `subject_enrollments`/`teacher_assignments`) 도입 이후에도 legacy `enrollments`
-- 테이블만 확인하도록 남아 있었다(반면 `profiles` 테이블 SELECT 정책은 이미 R5에서
-- v3 배정도 함께 확인하도록 갱신되어 있었다 — 20260925020000_r5_profile_visibility_teacher_assignments.sql
-- 참고). 체험 수업만 진행 중인 학생은 `enrollments`(정규 전환 후에만 생성) 행이 없고
-- `subject_enrollments`+`teacher_assignments`만 있으므로, 이 함수/정책들이 항상 false를
-- 반환해 화면에 아무것도 보이지 않았다.
--
-- 이 마이그레이션은 순수 additive(기존 legacy 조건 OR 추가)로, 기존 접근 권한을 전혀
-- 축소하지 않는다.

-- 1) teaches_student(): session_problem_attempts/vocab_words/students 등 여러 테이블의
--    RLS가 공유하는 헬퍼 함수. v3 배정(teacher_assignments + subject_enrollments)도
--    확인하도록 OR 조건 추가.
create or replace function public.teaches_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.enrollments e
    where e.student_id = p_student_id and e.teacher_id = auth.uid() and e.status = 'active'
  )
  or exists (
    select 1
    from public.teacher_assignments ta
    join public.subject_enrollments se on se.id = ta.subject_enrollment_id
    where se.child_id = p_student_id
      and ta.teacher_id = auth.uid()
      and ta.status in ('planned', 'active')
  );
$$;

-- 2) teachers 테이블 SELECT 정책: 학생/보호자가 담당 선생님의 school/bio/hourly_rate_krw
--    등을 조회할 때 v3 배정 경로도 인정하도록 확장.
drop policy if exists "선생님 본인/관리자/담당학생/학부모 조회" on public.teachers;
create policy "선생님 본인/관리자/담당학생/학부모 조회"
on public.teachers
for select
using (
  id = auth.uid()
  or is_admin()
  or exists (
    select 1 from public.enrollments e
    where e.teacher_id = teachers.id and e.student_id = auth.uid()
  )
  or exists (
    select 1 from public.enrollments e
    where e.teacher_id = teachers.id and is_guardian_of(e.student_id)
  )
  or exists (
    select 1
    from public.teacher_assignments ta
    join public.subject_enrollments se on se.id = ta.subject_enrollment_id
    where ta.teacher_id = teachers.id
      and se.child_id = auth.uid()
      and ta.status in ('planned', 'active')
  )
  or exists (
    select 1
    from public.teacher_assignments ta
    join public.subject_enrollments se on se.id = ta.subject_enrollment_id
    where ta.teacher_id = teachers.id
      and is_guardian_of(se.child_id)
      and ta.status in ('planned', 'active')
  )
);
