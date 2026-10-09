-- Phase B(2) — 컨설턴트 Documents 탭: 현재 담당 학생·가족의 계약 문서와
-- 서명 진행 상태를 조회한다("기존 계약 문서 정책에 따라 열람·다운로드 범위를
-- 적용하고, 다른 컨설턴트 담당 건은 차단"). contracts/contract_versions/
-- drive_artifacts에 이미 있는 SELECT 정책은 그대로 두고(관리자/본인가족),
-- 담당 컨설턴트용 정책을 추가한다(additive — permissive 정책은 OR로 합쳐짐).

create policy "담당 컨설턴트 조회" on contracts for select
  using (
    exists (
      select 1 from consultant_assignments ca
      where ca.student_id = contracts.child_id and ca.consultant_id = auth.uid()
    )
  );

create policy "담당 컨설턴트 조회" on contract_versions for select
  using (
    exists (
      select 1 from contracts ct
      join consultant_assignments ca on ca.student_id = ct.child_id
      where ct.id = contract_versions.contract_id and ca.consultant_id = auth.uid()
    )
  );

create policy "담당 컨설턴트 조회" on drive_artifacts for select
  using (
    exists (
      select 1 from contracts ct
      join consultant_assignments ca on ca.student_id = ct.child_id
      where ct.id = drive_artifacts.contract_id and ca.consultant_id = auth.uid()
    )
  );

comment on policy "담당 컨설턴트 조회" on contracts is
  '2026-09-23(Phase B-2) — 컨설턴트 Documents 탭. 현재 담당 학생의 계약만
  보인다(consultant_assignments 기준 — 배정 해제되면 즉시 사라짐). 다른
  컨설턴트 담당 건은 계속 차단된다.';
