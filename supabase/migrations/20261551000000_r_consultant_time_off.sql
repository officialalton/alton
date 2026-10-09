-- Phase B(3) — 컨설턴트 Schedule > Time Off. 월간 캘린더에서 종일/부분 시간
-- 휴무를 등록·수정·취소한다. 충돌 검사(기존 확정 일정과의 겹침)는 서버 액션
-- 레이어에서 처리하고(meeting_requests/consultations를 함께 조회해야 해서
-- 순수 RLS로는 표현하기 어려움), 이 테이블 자체의 RLS는 본인 것만 조작하게
-- 막는 표준 패턴이다.

create table consultant_time_off (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references profiles (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  reason text,
  created_at timestamptz not null default now(),
  constraint consultant_time_off_range_valid check (ends_at > starts_at)
);
create index on consultant_time_off (consultant_id, starts_at);

alter table consultant_time_off enable row level security;

create policy "본인 휴무 조회" on consultant_time_off for select
  using (consultant_id = auth.uid() or is_admin());
create policy "본인 휴무 등록" on consultant_time_off for insert
  with check (consultant_id = auth.uid());
create policy "본인 휴무 취소" on consultant_time_off for delete
  using (consultant_id = auth.uid());

comment on table consultant_time_off is
  '2026-09-23(Phase B-3) — 컨설턴트 휴무일·휴무시간. 등록 시 기존 확정된
  meeting_requests/consultations와의 충돌은 app/consultant/time-off-actions.ts가
  애플리케이션 레이어에서 검사해 안내한다(DB 제약으로는 표현하지 않음).';
