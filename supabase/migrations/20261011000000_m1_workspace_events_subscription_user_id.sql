-- M1/R6 공통 blocker 정정(2026-09-03, 같은 날 네 번째 후속) — 구독 대상 리소스 형식 수정.
--
-- 이전 구현(20261010000000)은 `//meet.googleapis.com/workspaces/{email}/spaces/-`라는
-- 존재하지 않는 리소스 형식으로 구독을 생성하려 했다 — Workspace Events API 문서 기준
-- 사용자 단위 구독의 target resource는 `//cloudidentity.googleapis.com/users/{USER}`
-- 형식이고, `{USER}`는 이메일이 아니라 Directory API가 반환하는 불변 사용자 ID다.
-- 이 컬럼은 그 ID를 organizer별로 캐시해 매번 Directory API를 다시 조회하지 않게 한다.
alter table workspace_events_subscriptions add column organizer_workspace_user_id text;

comment on column workspace_events_subscriptions.organizer_workspace_user_id is
  'M1/R6 정정: Directory API(getWorkspaceUserByEmail)가 반환하는 불변 사용자 ID(숫자 문자열). '
  'Workspace Events 구독의 targetResource(//cloudidentity.googleapis.com/users/{USER})에 이 값을 쓴다. '
  '최초 조회 후 이 컬럼에 캐시해 재사용 — organizer_email이 같아도 이메일 자체를 다시 리소스 이름에 쓰지 않는다.';
