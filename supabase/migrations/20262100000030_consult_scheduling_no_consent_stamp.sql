-- 2026-10-06 — 상담 동의 절차 제거: 셀프 스케줄링 링크 사용 시 상담 동의 문구 버전
-- (consult_consent_versions)을 consultations.consent_version_id에 찍던 동작을 없앤다.
-- 어떤 게이트도 이 값을 요구하지 않는다(20261126/27에서 이미 제거). 컬럼·과거 데이터는 보존.
create or replace function public.redeem_consultation_scheduling_link(p_token text, p_starts_at timestamp with time zone)
 returns consultations
 language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_link consultation_scheduling_links;
  v_row consultations;
  v_ends_at timestamptz := p_starts_at + interval '60 minutes';
begin
  select * into v_link from consultation_scheduling_links where token = p_token for update;
  if not found or v_link.expires_at < now() or v_link.used_at is not null then
    raise exception '유효하지 않거나 만료된 예약 링크입니다.';
  end if;

  select * into v_row from consultations where id = v_link.consultation_id for update;
  if not found then
    raise exception '상담 요청을 찾을 수 없습니다.';
  end if;
  if v_row.status <> 'requested' or v_row.starts_at is not null then
    raise exception '이미 처리된 상담 요청입니다.';
  end if;
  if v_row.admissions_consultant_id is distinct from v_link.consultant_id then
    raise exception '담당 컨설턴트가 변경되어 이 링크는 더 이상 사용할 수 없습니다.';
  end if;

  if p_starts_at <= now() then
    raise exception '이미 지난 시간은 선택할 수 없습니다. 다른 시간을 선택해 주세요.' using errcode = 'P0001';
  end if;
  if consultant_slot_blocked(v_link.consultant_id, p_starts_at, v_ends_at) then
    raise exception '담당 컨설턴트가 해당 시간에는 상담할 수 없습니다. 다른 시간을 선택해 주세요.' using errcode = 'P0001';
  end if;

  perform 1 from consultations c
  where c.starts_at is not null
    and c.status in ('requested', 'scheduled')
    and c.admissions_consultant_id = v_link.consultant_id
    and tstzrange(c.starts_at, c.ends_at) && tstzrange(p_starts_at, v_ends_at)
  for update;
  if found then
    raise exception '이미 다른 상담이 있는 시간입니다. 다른 시간을 선택해 주세요.';
  end if;

  update consultations set
    starts_at = p_starts_at,
    ends_at = v_ends_at,
    status = 'scheduled',
    scheduled_at = p_starts_at,
    updated_at = now()
  where id = v_row.id
  returning * into v_row;

  update consultation_scheduling_links set used_at = now() where id = v_link.id;

  insert into consultation_status_events (consultation_id, previous_status, new_status, reason)
  values (v_row.id, 'requested', 'scheduled', '고객 셀프 스케줄링(컨설턴트 전용 링크)');

  return v_row;
end;
$function$;
