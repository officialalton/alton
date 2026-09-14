-- v3 커리큘럼 열람 결함 수정 — 학부모 읽기 접근 추가
--
-- 배경: student_curriculum_overlays/curriculum_overlay_units/
-- curriculum_overlay_unit_keywords/curriculum_overlay_unit_materials의 조회
-- RLS(20261229000000_r9_student_curriculum_overlay.sql)는 "담당 선생님/본인
-- 학생/관리자"만 허용했다 — 학부모 조회 경로가 처음부터 없었다. subject_
-- enrollments/teacher_assignments가 이미 쓰는 is_enrollment_child_or_guardian()
-- (20260830080000_r1_rls_policies.sql, 본인 학생 또는 보호자/가구 보호자)로
-- is_owning_student_for_enrollment()를 대체한다 — 그 함수 자체가 "본인 학생"
-- 조건을 포함하는 상위 집합이라 학생 접근 범위는 그대로 유지된다. 데이터 변경
-- 없음, 정책만 교체.

drop policy "담당 선생님/본인 학생/관리자 조회" on student_curriculum_overlays;
create policy "담당 선생님/본인 학생·보호자/관리자 조회" on student_curriculum_overlays for select
  using (
    is_admin()
    or is_active_teacher_for_enrollment(subject_enrollment_id)
    or is_enrollment_child_or_guardian(subject_enrollment_id)
  );

drop policy "담당 선생님/본인 학생/관리자 조회" on curriculum_overlay_units;
create policy "담당 선생님/본인 학생·보호자/관리자 조회" on curriculum_overlay_units for select
  using (
    is_admin()
    or exists (
      select 1 from student_curriculum_overlays o
      where o.id = overlay_id
        and (is_active_teacher_for_enrollment(o.subject_enrollment_id)
             or is_enrollment_child_or_guardian(o.subject_enrollment_id))
    )
  );

drop policy "담당 선생님/본인 학생/관리자 조회" on curriculum_overlay_unit_keywords;
create policy "담당 선생님/본인 학생·보호자/관리자 조회" on curriculum_overlay_unit_keywords for select
  using (
    is_admin()
    or exists (
      select 1 from curriculum_overlay_units u
      join student_curriculum_overlays o on o.id = u.overlay_id
      where u.id = overlay_unit_id
        and (is_active_teacher_for_enrollment(o.subject_enrollment_id)
             or is_enrollment_child_or_guardian(o.subject_enrollment_id))
    )
  );

drop policy "담당 선생님/본인 학생/관리자 조회" on curriculum_overlay_unit_materials;
create policy "담당 선생님/본인 학생·보호자/관리자 조회" on curriculum_overlay_unit_materials for select
  using (
    is_admin()
    or exists (
      select 1 from curriculum_overlay_units u
      join student_curriculum_overlays o on o.id = u.overlay_id
      where u.id = overlay_unit_id
        and (is_active_teacher_for_enrollment(o.subject_enrollment_id)
             or is_enrollment_child_or_guardian(o.subject_enrollment_id))
    )
  );
