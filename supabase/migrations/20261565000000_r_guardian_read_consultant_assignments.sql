-- 실사용 UAT 발견(2026-09-23) — getMyHouseholdConsultantsAction()이 항상 빈
-- 배열을 반환해 "담당 컨설턴트에게 상담 신청" 기능(20261563000000)이 실제로
-- 전혀 활성화되지 않았다. 원인: consultant_assignments의 SELECT 정책이
-- 컨설턴트 본인·관리자·학생 본인만 허용하고 보호자용 정책이 없었다(학생은
-- "학생 본인 배정 조회"로 자기 배정을 볼 수 있지만, 보호자는 자녀의 배정을
-- 볼 방법이 아예 없었음). household_members로 그 학생이 본인 자녀인지
-- 확인하는 정책을 추가한다.

create policy "보호자 자녀 배정 조회" on consultant_assignments for select
  using (
    exists (
      select 1 from household_members guardian_hm
      join household_members child_hm
        on child_hm.household_id = guardian_hm.household_id and child_hm.role = 'child'
      where guardian_hm.profile_id = auth.uid()
        and guardian_hm.role = 'guardian'
        and child_hm.profile_id = consultant_assignments.student_id
    )
  );

-- 위 정책만으로는 부족하다 — getMyHouseholdConsultantsAction()이 컨설턴트
-- 이름을 함께 읽으려고 profiles를 조인하는데, profiles의 기존 "본인/관계자/
-- 관리자 조회" 정책에는 "보호자가 자녀의 담당 컨설턴트를 본다"는 경우가
-- 없다(컨설턴트<->학생 상호 조회만 있음). 같은 조건으로 하나 추가한다.
create policy "보호자 자녀의 담당 컨설턴트 프로필 조회" on profiles for select
  using (
    exists (
      select 1 from consultant_assignments ca
      join household_members child_hm on child_hm.profile_id = ca.student_id and child_hm.role = 'child'
      join household_members guardian_hm
        on guardian_hm.household_id = child_hm.household_id and guardian_hm.role = 'guardian'
      where ca.consultant_id = profiles.id
        and guardian_hm.profile_id = auth.uid()
    )
  );
