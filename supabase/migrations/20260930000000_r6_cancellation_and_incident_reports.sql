-- R6 5/N — 취소(수업권 release/consume + 30일 최소 만료 보장), 지각·노쇼 "신고"와
-- 원본 접속 기록 수집(확정·소진·정산은 R7 범위 — 여기서는 수집만).
--
-- 취소 정책(스펙 원문):
-- - 취소는 기존 예약을 덮어쓰지 않는다 — reservations.status를 'cancelled'로 바꾸고
--   이력(reservation_cancellations)에 남긴다. 같은 슬롯 재예약은 사용자가 새
--   confirm_lesson_booking() 호출로 별도 예약을 만든다(자동 대체 예약 없음).
-- - 학생 취소: 24시간 이상 전이면 release, 24시간 미만이면 consume.
-- - 선생님/회사 취소: 항상 release, 선생님 지급 없음(payout 쪽은 애초에 실제 수업
--   완료 이벤트가 없으므로 지급 대상이 아님 — 별도 조치 불필요). 취소일 기준 grant
--   만료가 30일 미만 남았으면 30일로 연장(extend_entitlement, R4에서 이미 이 용도로
--   준비돼 있었음 — "회사/선생님 귀책 취소로 만료 30일 미만 남은 grant를 연장").
-- - 중복 차감·이중 복구 방지는 release_entitlement/consume_entitlement 자체의 기존
--   가드(이미 release/consume된 예약 재처리 차단, R1)에 의존한다 — 여기서 새로 만들지
--   않는다.

create table reservation_cancellations (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations (id),
  cancelled_by_role text not null check (cancelled_by_role in ('student', 'teacher', 'company')),
  cancelled_by_id uuid not null references profiles (id),
  reason text,
  entitlement_disposition text not null check (entitlement_disposition in ('released', 'consumed')),
  cancelled_at timestamptz not null default now()
);
create index on reservation_cancellations (reservation_id);

alter table reservation_cancellations enable row level security;
create policy "예약 당사자/관리자 조회" on reservation_cancellations for select
  using (
    exists (
      select 1 from reservations r
      where r.id = reservation_id
        and (
          r.owner_profile_id = auth.uid()
          or exists (
            select 1 from subject_enrollments se where se.id = r.subject_enrollment_id
              and (se.child_id = auth.uid() or is_guardian_of(se.child_id) or is_household_guardian_of(se.child_id))
          )
        )
    )
    or is_admin() or current_user_has_capability('예약관리권한')
  );
-- 쓰기는 client에서 직접 하지 않는다 — cancel_lesson_booking()(service_role 전용)만 insert한다.

create or replace function public.cancel_lesson_booking(
  p_reservation_id uuid,
  p_cancelled_by_role text,
  p_cancelled_by_id uuid,
  p_reason text
) returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_reservation reservations%rowtype;
  v_hours_until numeric;
  v_grant_id uuid;
  v_current_expires_at timestamptz;
  v_min_expires_at timestamptz;
  v_disposition text;
begin
  if p_cancelled_by_role not in ('student', 'teacher', 'company') then
    raise exception '알 수 없는 취소 주체입니다: %', p_cancelled_by_role using errcode = 'P0001';
  end if;

  select * into v_reservation from reservations where id = p_reservation_id for update;
  if v_reservation.id is null then
    raise exception '예약을 찾을 수 없습니다.' using errcode = 'P0001';
  end if;
  if v_reservation.status <> 'confirmed' then
    raise exception '확정된 예약만 취소할 수 있습니다(현재 상태: %).', v_reservation.status using errcode = 'P0001';
  end if;

  v_hours_until := extract(epoch from (v_reservation.starts_at - now())) / 3600;

  -- 예약을 먼저 cancelled로 전환(덮어쓰지 않음 — 이 행 자체가 취소 이력이 된다).
  update reservations set status = 'cancelled' where id = p_reservation_id;

  if p_cancelled_by_role = 'student' and v_hours_until < 24 then
    perform consume_entitlement(p_reservation_id);
    v_disposition := 'consumed';
  else
    perform release_entitlement(p_reservation_id);
    v_disposition := 'released';

    if p_cancelled_by_role in ('teacher', 'company') then
      select grant_id into v_grant_id from entitlement_ledger
        where reservation_id = p_reservation_id and event_type = 'release';
      if v_grant_id is not null then
        select expires_at into v_current_expires_at from entitlement_grants where id = v_grant_id;
        v_min_expires_at := now() + interval '30 days';
        if v_current_expires_at < v_min_expires_at then
          perform extend_entitlement(v_grant_id, v_min_expires_at, 'r6_teacher_or_company_cancel:' || p_reservation_id);
        end if;
      end if;
    end if;
  end if;

  insert into reservation_cancellations (reservation_id, cancelled_by_role, cancelled_by_id, reason, entitlement_disposition)
  values (p_reservation_id, p_cancelled_by_role, p_cancelled_by_id, p_reason, v_disposition);
end;
$$;

-- hold_entitlement/consume_entitlement/release_entitlement/extend_entitlement와 동일한
-- 신뢰 경계(service_role 전용, 서버 액션이 호출 전 실제 취소 주체·권한을 검증).
revoke execute on function public.cancel_lesson_booking(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.cancel_lesson_booking(uuid, text, uuid, text) to service_role;

-- =========================================================================
-- 지각·노쇼 "신고"와 원본 접속 기록 수집 — R6은 수집까지만, 확정·수업권 소진·
-- payable_minutes·정산 판정은 R7. 두 테이블 모두 순수 append 로그이며 서로 다른
-- source를 명확히 분리한다(Meet 참가 기록 vs ALTON 화면 접속·체류를 절대 섞지 않음).
-- =========================================================================

create table session_incident_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id),
  report_type text not null check (report_type in ('teacher_late', 'student_no_show_reported', 'teacher_no_show_reported')),
  reported_by uuid not null references profiles (id),
  minutes_late int,
  notes text,
  reported_at timestamptz not null default now(),
  check (report_type <> 'teacher_late' or minutes_late is not null)
);
create index on session_incident_reports (session_id);

comment on table session_incident_reports is
  'R6: 선생님 지각/학생·선생님 노쇼 "신고"만 기록하는 append-only 로그. 이 신고 자체는 '
  '출석 확정이나 수업권 소진을 일으키지 않는다 — 확정·정산 판정은 R7(수업 상태·출석·정산 근거)에서 '
  '이 로그를 입력으로 사용해 처리한다.';

-- v3 sessions용 관련자 판정 헬퍼(레거시 is_session_related()는 legacy_sessions 전용이라
-- 재사용 불가 — 이름 충돌을 피해 별도 함수로 만든다). 아래 정책들이 참조하므로 먼저 정의.
create or replace function public.is_session_related_v3(p_session_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.sessions s
    join public.subject_enrollments se on se.id = s.subject_enrollment_id
    where s.id = p_session_id
      and (
        s.teacher_id = auth.uid()
        or se.child_id = auth.uid()
        or public.is_guardian_of(se.child_id)
        or public.is_household_guardian_of(se.child_id)
      )
  );
$$;

alter table session_incident_reports enable row level security;
create policy "세션 당사자/관리자 조회" on session_incident_reports for select
  using (is_session_related_v3(session_id) or is_admin() or current_user_has_capability('예약관리권한'));
create policy "세션 당사자/관리자 신고" on session_incident_reports for insert
  with check (is_session_related_v3(session_id) or is_admin() or current_user_has_capability('예약관리권한'));

-- Meet 참가 기록과 ALTON 화면 접속·체류 기록을 source로 명확히 분리한 원본 로그.
-- event_type/source는 서로 다른 파이프라인(Meet API 폴링 vs ALTON 클라이언트 beacon)이
-- 각자 쓴다 — 한쪽의 지연·부재를 다른 쪽으로 보정하지 않는다(스펙 원문).
create table session_access_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id),
  actor_id uuid references profiles (id),
  source text not null check (source in ('google_meet_api', 'alton_client')),
  event_type text not null check (event_type in ('meet_join', 'meet_leave', 'alton_page_open', 'alton_page_close')),
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  raw_payload jsonb
);
create index on session_access_events (session_id);
create index on session_access_events (session_id, source);

comment on table session_access_events is
  'R6: Meet 참가 기록(source=google_meet_api)과 ALTON 화면 접속·체류(source=alton_client)를 '
  '분리 수집하는 원본 로그. 이 두 source를 섞어 하나의 "출석"으로 합성하지 않는다 — '
  '그 합성·판정 로직은 R7 범위. google_meet_api 행은 R6에서는 공식 API 제공 범위·지연 확인만 '
  '하고(product-architecture-v3.md 관련 절), 실제 수집 파이프라인은 Google Workspace Events '
  'API 구독이 필요해 Sandbox 승인 이후에 배선한다 — 그 전까지 이 테이블은 alton_client 이벤트만 '
  '받는다.';

alter table session_access_events enable row level security;
create policy "세션 당사자/관리자 조회" on session_access_events for select
  using (is_session_related_v3(session_id) or is_admin() or current_user_has_capability('예약관리권한'));
-- 쓰기는 클라이언트에서 직접 하지 않는다(신뢰할 수 없는 자기보고 방지) — 서버 액션이
-- service_role로만 insert한다. RLS insert 정책을 아예 만들지 않아 authenticated/anon은
-- 기본적으로 차단되고, service_role은 RLS를 우회하므로 별도 정책 불필요.
