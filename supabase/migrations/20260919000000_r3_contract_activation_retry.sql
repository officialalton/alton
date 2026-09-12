-- R3 후속(2026-09-01) — completed 웹훅은 정상 수신됐으나 활성화 선행조건 미충족으로
-- contracts.status='active' 전환이 막힌 경우를 재처리 가능한 상태로 남긴다.
--
-- 기존 문제: 웹훅이 activateError를 만나면 500만 반환하고 external_event_receipts에
-- processed_at을 남기지 않아 — (a) 이 건이 "재처리 대기 중"이라는 걸 조회할 방법이
--없고, (b) DocuSign이 언젠가 재전송해줄 때만 우연히 재시도되는 구조였다. drive_artifacts
-- 패턴과 동일하게, "웹훅 수신·파싱"과 "그 결과로 일어나야 할 부수 효과(활성화)"를
-- 분리해 후자만 별도 재처리 큐로 관리한다.

create table contract_activation_retries (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts (id),
  contract_version_id uuid not null references contract_versions (id),
  envelope_id text not null,
  failure_reason text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references profiles (id)
);
create index on contract_activation_retries (contract_id) where (resolved_at is null);

comment on table contract_activation_retries is
  'completed 웹훅 수신은 성공했으나 contracts.status=active 전환이 선행조건(생년월일·'
  '보호자 동의 등) 미충족으로 실패한 건. 새 envelope·재서명 없이 관리자가 조회 후 '
  'retryContractActivation()으로 재처리한다(app/admin/consultation-actions.ts).';

alter table contract_activation_retries enable row level security;

create policy "관리자만 조회" on contract_activation_retries for select
  using (is_admin() or current_user_has_capability('manage_consultations'));

create policy "관리자만 해결 표시" on contract_activation_retries for update
  using (is_admin() or current_user_has_capability('manage_consultations'));
