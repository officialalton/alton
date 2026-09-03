-- M1/R6 공통 blocker — Workspace Events 구독 수명주기 (2026-09-03, M1 마감+R6 Calendar
-- 정책 보정 통합 작업). 기존 웹훅 수신 코드(app/api/webhooks/workspace-events/route.ts)는
-- 있었지만 구독을 실제로 만들고 관리하는 코드가 전혀 없었다 — 이 마이그레이션은 그 공백을
-- 메우는 상태 저장소만 추가한다(실제 Google API 호출은 lib/google-workspace-events-
-- subscriptions.ts가 CALENDAR_SYNC_ALLOW_REAL_CALLS 게이트 뒤에서 담당, 이 세션에서는
-- 호출하지 않는다 — mock/로컬 검증까지만).
--
-- 설계 판단: organizer(상담 관리자 official@alton.education, 정규수업 담당 선생님 회사
-- 계정)별로 최대 1개의 활성 구독만 둔다(사용자 단위 구독) — Workspace Events API가
-- 리소스(이 경우 Meet space 이벤트)를 subject 계정 기준으로 구독하는 구조이므로, 조직
-- 전체를 한 번에 구독하는 도메인 단위 옵션은 없다(Google 공개 문서 기준 사용자/리소스
-- 단위 구독만 지원 — 실제 Sandbox 검증 전까지는 최선 추정으로 표시). organizer당 구독을
-- 하나로 유지하는 이유: 같은 organizer에 중복 구독을 만들면 같은 이벤트가 여러 번 도착해
-- 중복 처리 로직이 필요해지고, 구독 자체의 운영 비용(모니터링·갱신 대상)도 늘어난다.

create type workspace_events_subscription_status as enum (
  'active', 'expiring', 'expired', 'error', 'disabled'
);

create table workspace_events_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organizer_email text not null,
  organizer_role text not null check (organizer_role in ('consult_organizer', 'teacher')),
  subscription_name text, -- Google 리소스 이름(예: subscriptions/{id}) — 생성 성공 전까지 null
  status workspace_events_subscription_status not null default 'error',
  expires_at timestamptz,
  last_verified_at timestamptz,
  last_renewed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- organizer당 활성(구독이 존재하는 상태로 취급되는) 행은 하나만 — disabled로 내리고
-- 새로 만들면 이전 행은 그대로 두고(감사 목적) 새 행을 추가하는 대신, 이 테이블은
-- upsert 대상으로 설계해 organizer_email 유니크로 강제한다(행 이력을 별도로 남기고
-- 싶다면 추후 감사 테이블을 분리 — 이번 범위에서는 구독 자체가 lifecycle 이벤트를
-- 많이 만들지 않아 단일 행 갱신으로 충분하다고 판단).
create unique index workspace_events_subscriptions_organizer_uq on workspace_events_subscriptions (organizer_email);
create index on workspace_events_subscriptions (status);
create index on workspace_events_subscriptions (expires_at);

comment on table workspace_events_subscriptions is
  'M1/R6 공통 — organizer(상담 관리자 또는 정규수업 담당 선생님)별 Workspace Events 구독 상태. '
  'ensureSubscriptionForOrganizer()(lib/workspace-events/subscription-lifecycle.ts)가 생성·재사용·갱신을 '
  '전담하고, 이 테이블은 그 상태만 저장한다. 구독 장애·이벤트 유실 시 상담·수업을 자동 완료 처리하지 '
  '않는다 — reconcileMissedSmartNotesEvents()가 Meet API 사후 대조로 별도 복구를 시도한다.';

alter table workspace_events_subscriptions enable row level security;
create policy "관리자 조회" on workspace_events_subscriptions for select using (is_admin());
-- 쓰기는 client에서 하지 않는다 — lifecycle 함수가 service_role로만 insert/update한다.
