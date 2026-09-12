-- P4-1(B) — 경량 가구 아카이브·복귀 (2026-09-11)
--
-- 조사 문서: docs/2026-09-10-p4-1-account-expansion-and-household-archive-investigation.md B절
-- 착수 정리: docs/2026-09-11-p4-1b-household-archive-plan.md
--
-- 제품 오너 확정 정책:
--  * C-2 종료 파이프라인(lib/enrollment/teacher-assignment-termination.ts)과
--    cancel_lesson_booking()을 재사용한다 — 새 종료·취소 경로를 만들지 않는다.
--  * 진행 중(live) 수업이 있으면 어떤 변경보다 먼저 차단한다(부분 진행 금지).
--  * 완료된 수업과 이미 소진된 수업권은 보존한다.
--  * 가구 단위 **별도 아카이브 상태**를 쓴다. R2 계정 상태(closure_pending/closed)는
--    재사용하지 않는다 — lib/auth.ts가 그 두 상태에서 즉시 로그아웃시키는데,
--    로그인 차단은 이번 범위 밖이기 때문이다.
--  * 복귀는 플래그 해제만 한다 — 취소된 예약·종료된 매칭·수강 상태를 자동 복원하지 않는다.
--
-- 전부 additive다. 기존 행은 archived_at is null(= 활성)로 남는다.

-- =========================================================================
-- 1. households 아카이브 플래그
-- =========================================================================

alter table households add column archived_at timestamptz;
alter table households add column archived_by uuid references profiles (id);

comment on column households.archived_at is
  'P4-1(B): 가구 아카이브 시각(null이면 활성). 관리자 목록에서 숨기기 위한 경량 플래그이며 '
  '로그인·인증에는 영향을 주지 않는다(R2 account_status와 별개).';

-- 활성 가구 조회가 기본 경로이므로 부분 인덱스로 받는다.
create index households_active_idx on households (id) where archived_at is null;
create index households_archived_at_idx on households (archived_at) where archived_at is not null;

-- =========================================================================
-- 2. 아카이브 처리 요청(선점 + 부분 실패 재시도)
-- =========================================================================
-- 하나의 큰 plpgsql 트랜잭션으로 만들 수 없다: 예약 취소는 DB RPC + Google
-- Calendar 삭제(HTTP) 조합이라 app 레이어 오케스트레이션이 필요하다. 대신
-- teacher_assignment_termination_requests와 같은 패턴(선점 + 항목별 멱등 처리 +
-- 재시도)으로 "부분 취소가 남지 않는다"는 요구를 재실행 가능성으로 충족한다.

create table household_archive_requests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  status text not null default 'requested'
    check (status in ('requested', 'processing', 'completed', 'failed')),
  requested_by uuid references profiles (id),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on household_archive_requests (household_id);
create index on household_archive_requests (status);

comment on table household_archive_requests is
  'P4-1(B): 가구 아카이브 처리 요청·진행 상태. 실제 처리(매칭 종료·예약 취소·Calendar 해제)는 '
  'app 레이어(lib/household/household-archive.ts)가 기존 경로를 재사용해 수행한다.';

alter table household_archive_requests enable row level security;
create policy "관리자 조회" on household_archive_requests for select
  using (is_admin() or current_user_has_capability('예약관리권한'));
-- 쓰기는 client에서 하지 않는다 — 서버 액션이 service_role로 처리한다.

-- =========================================================================
-- 3. 아카이브·복귀 감사 이력(INSERT-only)
-- =========================================================================

create table household_archive_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  action text not null check (action in ('archived', 'restored')),
  actor_id uuid references profiles (id),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on household_archive_events (household_id, created_at desc);

comment on table household_archive_events is
  'P4-1(B): 가구 아카이브·복귀 감사 이력. detail에 종료된 매칭 수·취소된 예약 수 등 처리 요약을 남긴다.';

create or replace function public.reject_household_archive_event_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'household_archive_events는 INSERT-only입니다.';
end;
$$;
create trigger household_archive_events_no_update
  before update or delete on household_archive_events
  for each row execute function public.reject_household_archive_event_mutation();
revoke execute on function public.reject_household_archive_event_mutation() from public, anon, authenticated, service_role;

alter table household_archive_events enable row level security;
create policy "관리자 조회" on household_archive_events for select
  using (is_admin() or current_user_has_capability('예약관리권한'));

-- =========================================================================
-- 4. 아카이브 영향 미리보기
-- =========================================================================
-- 관리자 확인 모달이 쓰는 조회 전용 함수. 상태를 바꾸지 않는다.
--   * 종료 대상 매칭: 이 가구 자녀의 active teacher_assignments
--   * 취소 대상 예약: 그 자녀들의 미래 confirmed lesson 예약 중 세션이 아직
--     최종 판정되지 않은 것(scheduled) — 이미 완료/취소/노쇼로 판정된 이력은 제외
--   * 진행 중 수업: 세션 최종 판정이 'live'인 예약(하나라도 있으면 아카이브 차단)

create or replace function public.preview_household_archive_impact(p_household_id uuid)
returns table (
  child_id uuid,
  active_assignment_count int,
  cancellable_reservation_count int,
  live_reservation_count int
)
language sql stable security definer set search_path = public as $$
  with children as (
    select hm.profile_id as child_id
    from household_members hm
    where hm.household_id = p_household_id and hm.role = 'child'
  ),
  assignments as (
    select se.child_id, count(*)::int as cnt
    from teacher_assignments ta
    join subject_enrollments se on se.id = ta.subject_enrollment_id
    where ta.status = 'active' and se.child_id in (select child_id from children)
    group by se.child_id
  ),
  reservations_by_child as (
    select
      se.child_id,
      -- 취소 대상: 미래의 확정 예약 중 세션이 아직 최종 판정되지 않은 것.
      -- (기존 preview_teacher_assignment_termination_impact와 같은 기준)
      count(*) filter (
        where r.starts_at > now() and coalesce(s.final_status::text, 'scheduled') = 'scheduled'
      )::int as cancellable,
      -- 진행 중: 이미 시작된 수업이라 starts_at 기준으로는 잡히지 않는다 —
      -- 시간 조건 없이 final_status='live'만 본다.
      count(*) filter (where s.final_status::text = 'live')::int as live
    from reservations r
    join subject_enrollments se on se.id = r.subject_enrollment_id
    left join sessions s on s.reservation_id = r.id
    where r.kind = 'lesson'
      and r.status = 'confirmed'
      and se.child_id in (select child_id from children)
    group by se.child_id
  )
  select
    c.child_id,
    coalesce(a.cnt, 0),
    coalesce(rb.cancellable, 0),
    coalesce(rb.live, 0)
  from children c
  left join assignments a on a.child_id = c.child_id
  left join reservations_by_child rb on rb.child_id = c.child_id;
$$;

revoke execute on function public.preview_household_archive_impact(uuid) from public, anon, authenticated;
grant execute on function public.preview_household_archive_impact(uuid) to service_role;

-- =========================================================================
-- 5. 아카이브된 가구에 속한 profile 집합(목록 필터용)
-- =========================================================================
-- 관리자 목록(학부모/학생/매칭 대기 등)에서 아카이브된 가구의 보호자·자녀를
-- 한 번의 왕복으로 제외하기 위한 조회 전용 함수.

create or replace function public.archived_household_profile_ids()
returns table (profile_id uuid)
language sql stable security definer set search_path = public as $$
  select hm.profile_id
  from household_members hm
  join households h on h.id = hm.household_id
  where h.archived_at is not null;
$$;

revoke execute on function public.archived_household_profile_ids() from public, anon, authenticated;
grant execute on function public.archived_household_profile_ids() to service_role;
