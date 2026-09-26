-- R6 11/N — Google Calendar 직접 변경의 사이트 역반영("외부 변경 감지").
--
-- 정책(2026-09-02 제품 오너 확정): 선생님/관리자가 Google Calendar에서 ALTON 수업
-- 이벤트를 직접 바꾸면 감지는 하되, 업무 상태(reservations/sessions/entitlement hold)를
-- 자동으로 확정하지 않는다 — "관리자 확인 필요" 상태만 만들고, 관리자가 ALTON에서
-- 승인할 때만 가용성·FreeBusy·버퍼·중복예약·수업권·알림 영향을 다시 검사한 뒤 확정한다.
-- 제목·설명 변경은 애초에 추적하지 않는다(업무 상태와 무관). Meet 링크 변경은 자동 수용
-- 하지 않고 대조 대상으로만 남긴다.

alter table reservations
  add column external_change_status text not null default 'none'
    check (external_change_status in ('none', 'time_changed', 'deleted', 'meet_link_changed')),
  add column external_change_detected_at timestamptz,
  add column external_change_detail jsonb,
  add column external_change_confirmed_by uuid references profiles (id),
  add column external_change_confirmed_at timestamptz;

comment on column reservations.external_change_status is
  'Google Calendar에서 이 예약의 이벤트가 ALTON 모르게 직접 바뀌었는지 — none 이외 값은 '
  '관리자 확인 전까지 예약/세션/수업권 hold를 절대 자동으로 바꾸지 않는다는 신호일 뿐이다. '
  'Meet 링크 변경(meet_link_changed)은 자동 수용하지 않고 대조 대상으로만 남는다.';

create index on reservations (external_change_status) where external_change_status <> 'none';

-- 선생님별 Calendar 증분 동기화(sync token) 상태 — 매번 전체 이벤트를 다시 조회하지
-- 않기 위한 Google 권장 패턴. 토큰이 없거나 만료(410 GONE)되면 호출부가 전체 재동기화로
-- 폴백한다(이 마이그레이션은 그 폴백 로직 자체를 강제하지 않음, 앱 코드 책임).
create table teacher_calendar_sync_state (
  teacher_id uuid primary key references profiles (id),
  sync_token text,
  last_synced_at timestamptz,
  last_sync_error text
);

comment on table teacher_calendar_sync_state is
  'R6 11/N: 선생님별 Google Calendar 증분 동기화(sync token) 상태. 알림 누락(webhook '
  '미수신)에 대비한 정기 대조용 — Workspace Events/Calendar push 알림만으로 "마지막 '
  '편집자"를 신뢰하지 않고, 이 증분 조회로 항상 재확인한다.';

alter table teacher_calendar_sync_state enable row level security;
create policy "관리자만 조회" on teacher_calendar_sync_state for select using (is_admin());

revoke all on teacher_calendar_sync_state from public, anon, authenticated;
grant select on teacher_calendar_sync_state to authenticated;

-- 관리자가 ALTON 통합 일정 화면에서 외부 변경을 확인·처리할 때 쓰는 함수 — 반드시
-- 가용성/FreeBusy/버퍼/중복예약/수업권/알림 영향을 다시 검사하는 것은 앱 레이어
-- (lib/booking/*)의 책임이고, 이 함수는 그 검사를 통과한 뒤 호출되는 "확정 기록"만
-- 담당한다(다른 R6 확정 함수들과 동일한 계층 분리 원칙).
-- service_role 전용(다른 R6 확정 함수와 동일) — 관리자 여부는 앱 레이어
-- (requireAdminOrCapability, admin-client 호출 전)에서 이미 검증됐다고 가정하고,
-- 그 검증을 통과한 관리자의 id를 p_admin_id로 명시적으로 받는다(service_role
-- 컨텍스트에는 auth.uid()가 없으므로 is_admin()에 의존할 수 없다 — cancel_lesson_booking과
-- 동일한 이유).
create or replace function public.resolve_external_calendar_change(
  p_reservation_id uuid,
  p_admin_id uuid,
  p_resolution text, -- 'accepted_google_time' | 'kept_alton_time' | 'confirmed_cancelled' | 'dismissed'
  p_reason text
) returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_status text;
begin
  if p_resolution not in ('accepted_google_time', 'kept_alton_time', 'confirmed_cancelled', 'dismissed') then
    raise exception '알 수 없는 처리 방식입니다: %', p_resolution;
  end if;

  select external_change_status into v_status from reservations where id = p_reservation_id for update;
  if v_status is null then
    raise exception '예약을 찾을 수 없습니다.';
  end if;
  if v_status = 'none' then
    raise exception '이 예약에는 처리할 외부 변경이 없습니다.';
  end if;

  update reservations
  set external_change_status = 'none',
      external_change_confirmed_by = p_admin_id,
      external_change_confirmed_at = now(),
      external_change_detail = coalesce(external_change_detail, '{}'::jsonb)
        || jsonb_build_object('resolution', p_resolution, 'reason', p_reason, 'resolved_at', now())
  where id = p_reservation_id;
end;
$$;

revoke execute on function public.resolve_external_calendar_change(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.resolve_external_calendar_change(uuid, uuid, text, text) to service_role;
