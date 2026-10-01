-- 2026-09-06 — 실제 버그 수정: create_trial_onboarding_link_multi()가
-- SQL 안에서 is_admin()/auth.uid()를 다시 확인하고 있었다. 이 함수는
-- app/admin/trial-onboarding-actions.ts의 sendTrialOnboardingNoticeAction()이
-- requireAdminOrCapability()로 이미 권한 검증을 마친 뒤 createAdminClient()
-- (service_role)로만 호출한다 — service_role 세션에는 auth.uid()가 없어
-- is_admin()이 항상 false를 반환하고, 그 결과 정상적인 관리자 세션에서
-- "다음 단계 — 체험 온보딩" 폼으로 실제 발송을 시도할 때마다 매번
-- "관리자만 온보딩 링크를 발급할 수 있습니다." 예외로 실패했다(제품 오너가
-- Preview에서 실측 재현). 이 함수는 20261017000000_m4_admin_function_auth_fix.sql이
-- 같은 종류의 버그를 고친 confirm_trial_intent()/create_trial_onboarding_link()보다
-- 나중(20261206)에 추가되면서 그 수정 패턴을 놓쳤다 — 이번에 같은 패턴으로
-- 맞춘다: SQL 쪽 is_admin() 재확인 제거, auth.uid() 대신 호출부가 넘기는
-- p_admin_id를 created_by/actor_id로 사용, service_role 전용으로 grant 축소.
drop function if exists public.create_trial_onboarding_link_multi(uuid, text, text, jsonb);
create or replace function public.create_trial_onboarding_link_multi(
  p_consultation_id uuid,
  p_guardian_email text,
  p_guardian_name text,
  p_students jsonb,
  p_admin_id uuid
) returns table (link_id uuid, raw_token text)
language plpgsql security definer set search_path = public as $$
declare
  v_prospect_contact_id uuid;
  v_confirmed timestamptz;
  v_raw_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash text := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');
  v_id uuid;
  v_student jsonb;
  v_first_name text;
  v_first_email text;
  v_first_grade text;
  v_count int := 0;
begin
  if p_students is null or jsonb_typeof(p_students) <> 'array' or jsonb_array_length(p_students) < 1 then
    raise exception '학생을 최소 1명 입력해야 합니다.';
  end if;

  select prospect_contact_id, trial_intent_confirmed_at into v_prospect_contact_id, v_confirmed
  from consultations where id = p_consultation_id;
  if not found then
    raise exception '상담을 찾을 수 없습니다: %', p_consultation_id;
  end if;
  if v_prospect_contact_id is null then
    raise exception '잠재고객(prospect_contact) 연결이 없는 상담입니다.';
  end if;
  if v_confirmed is null then
    raise exception '보호자의 체험 진행 확정(confirm_trial_intent) 이후에만 온보딩 링크를 발급할 수 있습니다.';
  end if;

  select v->>'name', v->>'email', v->>'grade'
    into v_first_name, v_first_email, v_first_grade
  from jsonb_array_elements(p_students) v limit 1;

  insert into trial_onboarding_links (
    consultation_id, prospect_contact_id, guardian_email, guardian_name,
    student_name, student_email, student_grade, token_hash, expires_at, created_by
  ) values (
    p_consultation_id, v_prospect_contact_id, p_guardian_email, p_guardian_name,
    v_first_name, v_first_email, v_first_grade, v_token_hash, now() + interval '72 hours', p_admin_id
  )
  returning id into v_id;

  for v_student in select * from jsonb_array_elements(p_students)
  loop
    if coalesce(v_student->>'name', '') = '' or coalesce(v_student->>'email', '') = '' then
      raise exception '학생 이름과 이메일은 필수입니다.';
    end if;
    insert into trial_onboarding_link_students (link_id, student_name, student_email, student_grade, student_subject)
    values (v_id, v_student->>'name', v_student->>'email', v_student->>'grade', v_student->>'subject');
    v_count := v_count + 1;
  end loop;

  insert into trial_onboarding_link_events (link_id, event_type, actor_id, detail)
  values (v_id, 'created', p_admin_id, jsonb_build_object('guardian_email', p_guardian_email, 'student_count', v_count));

  return query select v_id, v_raw_token;
end;
$$;
revoke execute on function public.create_trial_onboarding_link_multi(uuid, text, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.create_trial_onboarding_link_multi(uuid, text, text, jsonb, uuid) to service_role;
