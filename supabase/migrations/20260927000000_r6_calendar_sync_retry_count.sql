-- R6 2/N — Calendar/Meet 동기화 재시도 카운트. drive_artifacts.retry_count(R3)와 동일한
-- 패턴: MAX_RETRY_COUNT 초과 시 'failed' 대신 'reconciliation_needed'로 전환해 관리자
-- 수동 개입 대상으로 분리한다.
alter table reservations add column google_sync_retry_count int not null default 0;
