-- 2026-09-22(실사용자 UAT — 학생 "일정 잡기" 탭이 "아직 담당 컨설턴트가
-- 배정되지 않았습니다"로 뜸) — consultant_assignments RLS(20261447000000)가
-- consultant_id=본인 또는 관리자만 조회하게 해서, 정작 배정된 학생 본인은
-- 자기 담당 컨설턴트가 누구인지 조회할 수 없었다.
create policy "학생 본인 배정 조회" on consultant_assignments for select using (
  student_id = auth.uid()
);
