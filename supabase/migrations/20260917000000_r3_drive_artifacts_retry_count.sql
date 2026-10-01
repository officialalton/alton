-- R3: drive_artifacts에 재시도 횟수 카운터 추가.
--
-- 배경: processQueuedDriveArtifacts()/retryFailedDriveArtifacts()가 queued/
-- retryable_failed 행을 실제로 처리하는 워커를 도입하면서, 재시도 한도(예: 5회)를
-- 넘기면 retryable_failed 대신 manual_review로 전이해야 한다(정책: "재시도 한도
-- 초과·복구 불가 시 manual_review"). 이 카운터가 없으면 한도를 셀 방법이 없어
-- additive 컬럼으로 추가한다. 기존 행은 전부 0으로 초기화된다(이미 존재하는
-- queued/retryable_failed 행은 아직 이 워커가 시도한 적이 없으므로 0이 맞다).
alter table drive_artifacts
  add column if not exists retry_count int not null default 0;

comment on column drive_artifacts.retry_count is
  'R3: processQueuedDriveArtifacts/retryFailedDriveArtifacts가 실패할 때마다 증가시키는 카운터. 한도(현재 5) 초과 시 sync_status를 manual_review로 전이한다.';
