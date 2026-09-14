-- R8 6/N — Shared Drive 폴더/권한 자동화 실패 재처리 큐 (Gate C GW-12 인수 기준)
--
-- 배경(docs/2026-08-29-master-roadmap-v3.md R8 체크리스트, Gate C GW-12): Gate C에서는
-- Google API가 안정적으로 재현 가능한 오류를 반환하는 것까지만 검증했고, ALTON 자체
-- 큐 적재·재처리는 이 R8 구현에서 검증한다. lib/drive-artifacts.ts(R3, 계약서 Drive
-- 업로드)와 동일한 패턴(조건부 UPDATE로 claim, retry_count 초과 시 manual_review,
-- 복구 불가능한 오류(잘못된 fileId 등)는 즉시 reconciliation_needed)을 세션 Shared
-- Drive 폴더/권한 작업에도 적용한다.

create table session_drive_tasks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id),
  task_type text not null check (task_type in ('folder_provision', 'permission_grant', 'permission_revoke')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'succeeded', 'retryable_failed', 'manual_review', 'reconciliation_needed')),
  retry_count int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index on session_drive_tasks (session_id);
create index on session_drive_tasks (status);

comment on table session_drive_tasks is
  'R8: 학생→과목→연도→세션 Shared Drive 폴더 생성 및 선생님 배정 권한 부여/회수 작업 큐. '
  'Gate C GW-12: Drive/Meet API 실패가 manual_review(재시도 소진)/reconciliation_needed'
  '(잘못된 fileId 등 복구 불가능한 오류)로 적재되고, 재처리 배치가 이를 처리해야 한다.';
