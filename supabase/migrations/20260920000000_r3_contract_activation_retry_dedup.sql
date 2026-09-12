-- R3 후속(2026-09-01 이어서) — contract_activation_retries에 같은
-- contract_version_id로 미해결(resolved_at is null) 행이 두 개 이상 쌓이는 걸
-- DB 레벨에서 막는다.
--
-- 배경: external_event_receipts의 (provider, event_id) unique로 같은 이벤트의
-- 재처리는 이미 막혀 있지만, completed 이벤트가 어떤 경로로든 다시 처리되거나
-- 웹훅 재시도가 그 방어를 우회하는 경우를 방어적으로 닫아둔다. 애플리케이션
-- 레벨(webhook route)에서 이 unique 위반을 감지해 새 행을 만드는 대신 기존
-- 행의 failure_reason/created_at을 갱신하도록 바꾼다(이 마이그레이션과 짝).

create unique index contract_activation_retries_open_version_idx
  on contract_activation_retries (contract_version_id)
  where (resolved_at is null);

comment on index contract_activation_retries_open_version_idx is
  'contract_version_id당 미해결(resolved_at is null) 재처리 행은 최대 1개만 허용한다 — '
  '중복 이벤트 처리로 같은 계약 버전에 대한 재처리 행이 여러 개 쌓이는 걸 방지.';
