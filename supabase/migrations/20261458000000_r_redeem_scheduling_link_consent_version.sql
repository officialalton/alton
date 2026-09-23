-- 2026-09-22(버그 발견 — 실제 UAT) — redeem_consultation_scheduling_link()가
-- consent_version_id를 설정하지 않아, Calendar 초대 description에 실리는
-- 동의 확인 페이지(getConsultConsentView, app/consult-actions.ts)가
-- "동의 문구를 불러올 수 없습니다"로 깨졌다. admin_accept_consultation()과
-- 동일하게 현재 활성 동의 버전을 설정한다.
create or replace function public.redeem_consultation_scheduling_link(
  p_token text,
  p_starts_at timestamptz
)
returns consultations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link consultation_scheduling_links;
  v_row consultations;
  v_ends_at timestamptz := p_starts_at + interval '60 minutes';
  v_active_consent_version_id uuid;
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

  perform 1 from consultations c
  where c.starts_at is not null
    and c.status in ('requested', 'scheduled')
    and c.admissions_consultant_id = v_link.consultant_id
    and tstzrange(c.starts_at, c.ends_at) && tstzrange(p_starts_at, v_ends_at)
  for update;
  if found then
    raise exception '이미 다른 상담이 있는 시간입니다. 다른 시간을 선택해 주세요.';
  end if;

  select id into v_active_consent_version_id
  from consult_consent_versions
  where is_active = true
  order by created_at desc
  limit 1;

  update consultations set
    starts_at = p_starts_at,
    ends_at = v_ends_at,
    status = 'scheduled',
    scheduled_at = p_starts_at,
    consent_version_id = coalesce(v_row.consent_version_id, v_active_consent_version_id),
    updated_at = now()
  where id = v_row.id
  returning * into v_row;

  update consultation_scheduling_links set used_at = now() where id = v_link.id;

  insert into consultation_status_events (consultation_id, previous_status, new_status, reason)
  values (v_row.id, 'requested', 'scheduled', '고객 셀프 스케줄링(컨설턴트 전용 링크)');

  return v_row;
end;
$$;

grant execute on function public.redeem_consultation_scheduling_link(text, timestamptz) to anon, authenticated;

-- 데이터 보정 — 이미 이 버그를 겪고 scheduled로 넘어간 UAT 테스트 건들의
-- consent_version_id를 채운다(고객이 이미 동의 확인 페이지 접근을 시도한 건들).
update consultations c
set consent_version_id = (
  select id from consult_consent_versions where is_active = true order by created_at desc limit 1
)
where c.status = 'scheduled'
  and c.admissions_consultant_id is not null
  and c.consent_version_id is null
  and c.starts_at is not null;
