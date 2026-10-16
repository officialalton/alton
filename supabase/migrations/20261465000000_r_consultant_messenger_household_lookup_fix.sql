-- 2026-09-22(실사용자 UAT에서 발견 — 컨설턴트로 실제 로그인해 메신저 탭을
-- 열자 500 에러: "이 학생이 속한 household를 찾을 수 없습니다.") —
-- app/consultant/messenger-actions.ts의 requireStudentHouseholdId()가 컨설턴트
-- 본인 세션 클라이언트로 household_members를 직접 select했는데, household_members
-- RLS(20260830010000)는 본인 guardian/child 행 또는 관리자만 읽을 수 있어
-- 담당 컨설턴트는 애초에 이 테이블을 읽을 권한이 없었다(select 자체가
-- RLS에 막혀 항상 0행 반환 → "찾을 수 없습니다" 오류). household_members RLS를
-- 넓히는 대신, 다른 교차 역할 조회와 같은 패턴으로 SECURITY DEFINER 함수 하나만
-- 추가해 담당 컨설턴트(또는 관리자)만 학생의 household_id를 조회할 수 있게 한다.
create or replace function public.household_id_for_assigned_student(p_student_id uuid)
returns uuid
language sql stable security definer set search_path = public as $$
  select hm.household_id
  from household_members hm
  where hm.profile_id = p_student_id
    and hm.role = 'child'
    and (is_admin() or is_assigned_consultant_of_household(hm.household_id))
  limit 1;
$$;

comment on function public.household_id_for_assigned_student(uuid) is
  '2026-09-22 — 담당 컨설턴트(또는 관리자)가 학생의 household_id를 알아낼 때 쓴다.
  household_members 테이블 자체는 RLS로 여전히 컨설턴트에게 닫혀 있다(가구
  구성원 전체 목록까지 노출하지 않기 위해) — 이 함수는 household_id 하나만
  반환한다.';
