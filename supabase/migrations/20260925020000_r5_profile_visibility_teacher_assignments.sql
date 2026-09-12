-- R5 후속 — profiles SELECT 정책에 teacher_assignments 기반 가시성 추가.
--
-- 버그: app/student/enrollment-data.ts, app/teacher/assignments-data.ts는
-- teacher_assignments.teacher_id/subject_enrollments.child_id로 상대방 이름을
-- profiles!teacher_assignments_teacher_id_fkey(name) 임베드로 읽는다. 하지만
-- profiles의 "본인/관계자/관리자 조회" RLS 정책은 여전히 레거시 enrollments
-- 테이블(1:1 학생-선생님, R1 이전)과 guardian_students/household만 인식하고
-- R5의 teacher_assignments/subject_enrollments 관계는 전혀 모른다 — 그 결과
-- R5로 새로 배정된 선생님·학생은 서로의 프로필 이름을 못 읽어(RLS가 null로
-- 막음) EnrollmentTab/AssignmentsTab에 이름이 빈칸으로 보인다(담당 선생님 이름
-- 없이 날짜만 표시됨). 실제 브라우저 E2E(r5-subject-enrollment-flow.spec.ts)로
-- 재현 확인.
--
-- 수정: teacher_assignments(활성/예정/종료 모두 — 이력 화면에서도 과거 선생님
-- 이름이 필요하다)를 통해 연결된 학생<->선생님, 그리고 그 학생의 보호자<->선생님
-- 조합을 모두 볼 수 있게 EXISTS 절을 추가한다. is_guardian_of()를 재사용해
-- household 백필 사각지대(2026-09-01 마이그레이션과 동일 이유)를 반복하지 않는다.

drop policy if exists "본인/관계자/관리자 조회" on profiles;
create policy "본인/관계자/관리자 조회" on profiles for select
  using (
    id = auth.uid()
    or is_admin()
    or exists (
      select 1 from enrollments e
      where (e.student_id = profiles.id and e.teacher_id = auth.uid())
         or (e.teacher_id = profiles.id and e.student_id = auth.uid())
    )
    or exists (
      select 1 from guardian_students gs
      where (gs.student_id = profiles.id and gs.parent_id = auth.uid())
         or (gs.parent_id = profiles.id and gs.student_id = auth.uid())
    )
    or shares_household_as_guardian_or_child(profiles.id)
    or exists (
      select 1 from teacher_assignments ta
      join subject_enrollments se on se.id = ta.subject_enrollment_id
      where (ta.teacher_id = profiles.id and se.child_id = auth.uid())
         or (ta.teacher_id = auth.uid() and se.child_id = profiles.id)
    )
    or exists (
      select 1 from teacher_assignments ta
      join subject_enrollments se on se.id = ta.subject_enrollment_id
      where ta.teacher_id = profiles.id and is_guardian_of(se.child_id)
    )
  );
