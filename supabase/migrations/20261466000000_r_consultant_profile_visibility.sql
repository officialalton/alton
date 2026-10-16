-- 2026-09-22(실사용자 UAT — jiman@alton.education로 로그인해 확인) — "담당 학생"
-- 목록이 전부 "이름 없음"으로 보임. R5 후속(20260925020000)과 정확히 같은 버그
-- 클래스: consultant_assignments로 이어진 컨설턴트<->학생 관계를 profiles의
-- "본인/관계자/관리자 조회" RLS가 전혀 모른다 — app/consultant/consultant-data.ts의
-- loadMyAssignedStudents()가 profiles!consultant_assignments_student_id_fkey(name)
-- 임베드로 이름을 읽는데 RLS가 막아 null로 돌아온다.

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
    or exists (
      select 1 from consultant_assignments ca
      where (ca.student_id = profiles.id and ca.consultant_id = auth.uid())
         or (ca.consultant_id = profiles.id and ca.student_id = auth.uid())
    )
  );
