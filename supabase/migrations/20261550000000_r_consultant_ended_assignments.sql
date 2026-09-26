-- Phase B(1) — 컨설턴트 Students 탭을 "배정 중(Active)" / "배정 종료(Ended)"로
-- 나눈다. 종료된 배정은 기록 조회 전용이어야 하므로, 본인이 과거에(현재는
-- 아니게 된) 담당했던 학생 목록을 조회할 수 있는 경로가 필요하다. 기존
-- consultant_assignment_history는 관리자 전용 SELECT 정책만 있었다(현재
-- 담당인지와 무관하게 전체 이력 조회는 여전히 관리자만).

create policy "본인이 이전/현재 담당자였던 이력 조회" on consultant_assignment_history
  for select
  using (auth.uid() = prior_consultant_id or auth.uid() = new_consultant_id);

comment on policy "본인이 이전/현재 담당자였던 이력 조회" on consultant_assignment_history is
  '컨설턴트 Students > Ended 탭(2026-09-23 Phase B)이 본인이 배정 해제된 학생
  목록·사유·시점을 조회하기 위함. 다른 컨설턴트의 이력은 여전히 보이지 않는다
  (관리자 전용 정책은 그대로 유지).';
