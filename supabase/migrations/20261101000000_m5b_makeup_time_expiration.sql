-- M5-b 후속(2026-09-05, 제품 오너 확정) — 보충시간(makeup_obligations) 만료 정책.
-- R1 원안(20260830060000)은 "만료 정책 미합의"로 만료 이벤트 없이 무기한 유효였으나,
-- 이번에 "발생 후 30일 내 사용" 정책이 확정됐다. 기존 데이터 무결성을 지키기 위해
-- additive로 처리한다: expires_at은 생성 시점 + 30일로 고정(트리거로 강제, 클라이언트가
-- 임의 연장 못 하게), apply_makeup_time_to_booking()은 만료된 의무의 적용을 거부한다.
-- 이미 있던 다른 선생님 예약 연결 금지(요구사항 6의 teacher_id 일치 검사)는 이번에
-- 다시 확인해 그대로 유지한다(변경 없음).

alter table makeup_obligations add column expires_at timestamptz;

update makeup_obligations set expires_at = created_at + interval '30 days' where expires_at is null;

alter table makeup_obligations alter column expires_at set not null;
alter table makeup_obligations alter column expires_at set default (now() + interval '30 days');

comment on column makeup_obligations.expires_at is
  '2026-09-05 확정: 생성 후 30일 이내에만 사용 가능(apply_makeup_time_to_booking()이 강제). 이 값을
  직접 UPDATE로 연장하지 못하도록 트리거로 막는다 — 연장이 필요하면 관리자가 새 조정 사유를
  남기고 별도 의무를 만드는 것이 감사 이력상 더 안전하다.';

create or replace function public.reject_makeup_obligation_expiry_extension()
returns trigger
language plpgsql as $$
begin
  if new.expires_at <> old.expires_at then
    raise exception '만료일은 연장할 수 없습니다 — 필요하면 관리자가 새 보충시간 의무를 생성하세요.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger makeup_obligations_no_expiry_extension
  before update on makeup_obligations
  for each row execute function public.reject_makeup_obligation_expiry_extension();

create or replace function public.apply_makeup_time_to_booking(
  p_reservation_id uuid,
  p_obligation_id uuid,
  p_minutes int,
  p_actor_id uuid
) returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_reservation reservations%rowtype;
  v_session sessions%rowtype;
  v_obligation makeup_obligations%rowtype;
  v_new_ends timestamptz;
begin
  if p_minutes <= 0 then
    raise exception 'p_minutes는 0보다 커야 합니다.' using errcode = 'P0001';
  end if;

  select * into v_reservation from reservations where id = p_reservation_id for update;
  if v_reservation.id is null or v_reservation.kind <> 'lesson' or v_reservation.status <> 'confirmed' then
    raise exception '확정된 정규 수업 예약에만 보충시간을 이어붙일 수 있습니다.' using errcode = 'P0001';
  end if;
  if v_reservation.starts_at <= now() then
    raise exception '아직 시작하지 않은 미래 예약에만 보충시간을 연결할 수 있습니다.' using errcode = 'P0001';
  end if;

  select * into v_session from sessions where reservation_id = p_reservation_id for update;
  if v_session.id is null then
    raise exception '연결된 세션을 찾을 수 없습니다.' using errcode = 'P0001';
  end if;

  select * into v_obligation from makeup_obligations where id = p_obligation_id;
  if v_obligation.id is null then
    raise exception '유효하지 않은 보충시간 의무입니다.' using errcode = 'P0001';
  end if;
  if v_obligation.teacher_id <> v_reservation.owner_profile_id then
    raise exception '보충시간을 발생시킨 선생님의 예약에만 이어붙일 수 있습니다.' using errcode = 'P0001';
  end if;
  -- 2026-09-05 확정: 보충시간은 발생 후 30일 이내에만 사용 가능하다. 만료 여부는 적용
  -- 시점(예약 시작 시점이 아니라 지금)의 now()로 판정한다 — 만료된 채무는 관리자가 별도
  -- 조정(entitlement 수동 보정 등)으로 처리해야 한다(자동 소멸일 뿐 자동 보상은 아님).
  if v_obligation.expires_at <= now() then
    raise exception 'makeup_obligation_expired' using errcode = 'P0001';
  end if;

  v_new_ends := v_reservation.ends_at + (p_minutes || ' minutes')::interval;

  -- 요구사항 7: 연장 구간이 선생님 가능시간·기존 예약과 충돌하지 않는지 검사(기존 로직 재사용).
  if not is_teacher_slot_open(v_reservation.owner_profile_id, v_reservation.starts_at, v_new_ends) then
    raise exception 'teacher_slot_not_open' using errcode = 'P0001';
  end if;
  if violates_teacher_buffer(v_reservation.owner_profile_id, v_reservation.starts_at, v_new_ends, v_reservation.id) then
    raise exception 'teacher_buffer_violation' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from reservations r2
    where r2.owner_profile_id = v_reservation.owner_profile_id
      and r2.status in ('holding', 'confirmed')
      and r2.id <> v_reservation.id
      and tstzrange(r2.starts_at, r2.ends_at) && tstzrange(v_reservation.ends_at, v_new_ends)
  ) then
    raise exception 'teacher_extension_conflict' using errcode = 'P0001';
  end if;

  update reservations set ends_at = v_new_ends where id = v_reservation.id;
  update sessions
    set scheduled_duration_minutes = scheduled_duration_minutes + p_minutes,
        makeup_minutes_generated = makeup_minutes_generated + p_minutes
    where id = v_session.id;

  perform public.apply_makeup_time(p_obligation_id, v_session.id, p_minutes);
end;
$$;
revoke execute on function public.apply_makeup_time_to_booking(uuid, uuid, int, uuid) from public, anon, authenticated;
grant execute on function public.apply_makeup_time_to_booking(uuid, uuid, int, uuid) to service_role;

comment on function public.apply_makeup_time_to_booking(uuid, uuid, int, uuid) is
  'M5-b + 2026-09-05 만료 정책: 보충시간을 새 예약으로 만들지 않고 기존 미래 정규 예약 뒤에
  이어붙인다. 발생 후 30일 이내(makeup_obligations.expires_at)에만 적용 가능, 발생시킨 선생님의
  예약에만 적용 가능(다른 선생님 예약으로 이전 불가). entitlement_ledger 신규 소진 이벤트 없음.';
