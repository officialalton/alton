-- First-consultation AI meeting notes: ONE consent given when the consultation is requested (the existing privacy-consent
-- checkbox, wording extended). Only the accepted wording VERSION and the time are stored (additive); the older separate
-- consult consent (consultations.consent_version_id / consent_confirmed_at, removed from the flow in migration 030) is not
-- reintroduced. Smart Notes for a first consultation are generated and linked only when this stamp exists.
alter table consultations
  add column ai_notes_consent_version text,
  add column ai_notes_consent_at timestamptz;
comment on column consultations.ai_notes_consent_version is
  'Wording version of the single request-time consent (personal information + first-consultation AI notes). Null = not consented: no Smart Notes generation or linking. Constant: lib/consultation/first-consultation-consent.ts.';

drop function public.submit_homepage_consult_request(text, text, text, timestamptz, text, text, text);
create function public.submit_homepage_consult_request(
  p_full_name text, p_email text, p_phone text, p_starts_at timestamptz,
  p_student_grade text, p_concerns text, p_idempotency_key text,
  p_ai_notes_consent_version text default null
) returns consultations
language plpgsql security definer set search_path = public as $function$
declare
  v_prospect prospect_contacts;
  v_consultation consultations;
  v_existing consultations;
begin
  if p_starts_at is not null then
    raise exception '상담 시간은 신청 시 정할 수 없습니다. 담당 컨설턴트가 배정된 뒤 안내되는 링크에서 선택해 주세요.' using errcode = 'P0001';
  end if;

  if p_idempotency_key is not null then
    select * into v_existing from consultations where idempotency_key = p_idempotency_key;
    if found then
      return v_existing;
    end if;
  end if;

  if exists (
    select 1 from consultations c
    where c.status = 'requested'
      and lower(trim(c.contact_email)) = lower(trim(p_email))
  ) then
    raise exception '이미 처리 대기 중인 상담 신청이 있습니다. 관리자가 확인할 때까지 기다려 주세요.';
  end if;

  insert into prospect_contacts (full_name, primary_email, primary_phone)
  values (p_full_name, p_email, p_phone)
  returning * into v_prospect;

  insert into consultations (
    prospect_contact_id, source, contact_name, contact_email, contact_phone,
    student_grade, category, concerns, status, requested_at, idempotency_key,
    ai_notes_consent_version, ai_notes_consent_at
  ) values (
    v_prospect.id, 'homepage', p_full_name, p_email, p_phone,
    p_student_grade, 'family', p_concerns, 'requested', now(), p_idempotency_key,
    nullif(trim(p_ai_notes_consent_version), ''),
    case when nullif(trim(p_ai_notes_consent_version), '') is not null then now() end
  )
  returning * into v_consultation;

  insert into consultation_status_events (consultation_id, previous_status, new_status, reason)
  values (v_consultation.id, null, 'requested', '홈페이지 상담 신청');

  if _auto_assign_consultation(v_consultation.id) is not null then
    select * into v_consultation from consultations where id = v_consultation.id;
  end if;

  return v_consultation;
end;
$function$;
revoke execute on function public.submit_homepage_consult_request(text, text, text, timestamptz, text, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_homepage_consult_request(text, text, text, timestamptz, text, text, text, text) to service_role;
