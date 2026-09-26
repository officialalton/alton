-- 2026-09-22(사용자 지시 — "선생님 수업 예약되는 것도, 선생님이 일정 한 번
-- 확인하고 확정하거나 변경/거절할 수 있게 해") — 예약은 지금처럼 즉시 확정을
-- 유지한다(reservations 상태 머신·수업권 hold·세션 생성 시점을 건드리면
-- 기존 회귀 범위가 매우 커진다 — 제품 오너 확인됨). 대신 확정된 예약에 대해
-- 선생님이 "재조정 요청"을 걸 수 있게 하고, 학생/보호자가 수락하면 그때
-- reservations의 시간을 실제로 바꾼다(reservations_no_overlap 배타 제약이
-- 그대로 최종 방어선 역할을 한다). 거절하면 기존 예약은 그대로 유지된다.

create table reservation_reschedule_requests (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations (id) on delete cascade,
  requested_by uuid not null references profiles (id),
  reason text,
  proposed_starts_at timestamptz not null,
  proposed_ends_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references profiles (id),
  check (proposed_ends_at > proposed_starts_at)
);
create index on reservation_reschedule_requests (reservation_id);
-- 예약 하나당 동시에 대기 중인 재조정 요청은 하나만.
create unique index reservation_reschedule_requests_one_pending
  on reservation_reschedule_requests (reservation_id) where (status = 'pending');

comment on table reservation_reschedule_requests is
  '2026-09-22: 확정된 예약(reservations)에 대한 선생님의 재조정 요청. 수락 전까지 원래 예약은 그대로 유효 — 수락 시점에만 reservations.starts_at/ends_at을 실제로 바꾼다(exclusion 제약이 최종 방어선).';

alter table reservation_reschedule_requests enable row level security;
-- 직접 insert/update 정책은 두지 않는다(meeting_request_reviews와 동일 원칙) — 아래
-- SECURITY DEFINER 함수로만 쓴다. 조회만 RLS로 허용한다.
create policy "관리자 전체 조회" on reservation_reschedule_requests for select using (is_admin());
create policy "담당 선생님 본인 요청 조회" on reservation_reschedule_requests for select using (
  requested_by = auth.uid()
);
create policy "학생/보호자 본인 예약 조회" on reservation_reschedule_requests for select using (
  exists (
    select 1 from reservations r
    join subject_enrollments se on se.id = r.subject_enrollment_id
    where r.id = reservation_reschedule_requests.reservation_id
      and (se.child_id = auth.uid() or is_guardian_of(se.child_id))
  )
);

-- 선생님이 본인 소유(owner_profile_id) 확정 예약에 재조정을 요청한다.
create or replace function public.request_reservation_reschedule(
  p_reservation_id uuid,
  p_proposed_starts_at timestamptz,
  p_proposed_ends_at timestamptz,
  p_reason text
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_res reservations%rowtype; v_id uuid;
begin
  select * into v_res from reservations where id = p_reservation_id;
  if v_res.id is null then raise exception '예약을 찾을 수 없습니다.'; end if;
  if v_res.owner_profile_id <> auth.uid() then raise exception '본인 예약만 재조정 요청할 수 있습니다.'; end if;
  if v_res.status <> 'confirmed' then raise exception '확정된 예약만 재조정 요청할 수 있습니다.'; end if;
  if v_res.starts_at <= now() then raise exception '이미 지났거나 진행 중인 예약은 재조정 요청할 수 없습니다.'; end if;
  if p_proposed_ends_at <= p_proposed_starts_at then raise exception '종료 시각은 시작 시각보다 뒤여야 합니다.'; end if;

  insert into reservation_reschedule_requests (reservation_id, requested_by, reason, proposed_starts_at, proposed_ends_at)
  values (p_reservation_id, auth.uid(), nullif(trim(p_reason), ''), p_proposed_starts_at, p_proposed_ends_at)
  returning id into v_id;
  return v_id;
end $$;

-- 선생님이 본인이 건 대기 중 요청을 철회한다.
create or replace function public.cancel_my_reservation_reschedule_request(p_request_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update reservation_reschedule_requests
  set status = 'cancelled', resolved_at = now(), resolved_by = auth.uid()
  where id = p_request_id and requested_by = auth.uid() and status = 'pending';
end $$;

-- 학생/보호자가 응답한다. 수락 시 reservations 시간을 실제로 바꾼다
-- (reservations_no_overlap 배타 제약이 충돌 시 예외를 던진다 — 최종 방어선).
create or replace function public.respond_to_reservation_reschedule(p_request_id uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare v_req reservation_reschedule_requests%rowtype; v_child_id uuid;
begin
  select * into v_req from reservation_reschedule_requests where id = p_request_id;
  if v_req.id is null then raise exception '요청을 찾을 수 없습니다.'; end if;
  if v_req.status <> 'pending' then raise exception '이미 처리된 요청입니다.'; end if;

  select se.child_id into v_child_id
  from reservations r join subject_enrollments se on se.id = r.subject_enrollment_id
  where r.id = v_req.reservation_id;
  if v_child_id is null or not (v_child_id = auth.uid() or is_guardian_of(v_child_id)) then
    raise exception '본인 또는 자녀의 예약만 응답할 수 있습니다.';
  end if;

  if p_accept then
    update reservations set starts_at = v_req.proposed_starts_at, ends_at = v_req.proposed_ends_at
    where id = v_req.reservation_id;
    update reservation_reschedule_requests
    set status = 'accepted', resolved_at = now(), resolved_by = auth.uid()
    where id = p_request_id;
  else
    update reservation_reschedule_requests
    set status = 'declined', resolved_at = now(), resolved_by = auth.uid()
    where id = p_request_id;
  end if;
end $$;
