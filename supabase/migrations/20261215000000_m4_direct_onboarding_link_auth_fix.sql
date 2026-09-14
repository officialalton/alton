-- 2026-09-06/07 — 실제 버그 수정: create_direct_onboarding_link_multi()가
-- SQL 안에서 is_admin()/auth.uid()를 확인하고 있었다. 이 함수는
-- app/admin/direct-account-actions.ts의 sendDirectOnboardingNoticeAction()이
-- requireAdminOrCapability()로 이미 권한 검증을 마친 뒤 createAdminClient()
-- (service_role)로만 호출한다 — service_role 세션에는 auth.uid()가 없어
-- is_admin()이 항상 false를 반환하고, 그 결과 "지인/추천 — 상담 없이 바로
-- 계정 생성" 폼에서 "계정 생성 안내 발송"을 누를 때마다 매번 "관리자만
-- 온보딩 링크를 발급할 수 있습니다." 예외로 실패했다(제품 오너가 Preview에서
-- 실측 재현). 20261208000000_m4_multi_onboarding_link_auth_fix.sql이
-- create_trial_onboarding_link_multi()에서 고친 것과 완전히 동일한 버그
-- 클래스다 — create_direct_onboarding_link_multi()는 그 수정보다 나중
-- (20261214)에 추가되면서 같은 패턴을 놓쳤다. 이번에도 같은 패턴으로
-- 맞춘다: SQL 쪽 is_admin() 재확인 제거, auth.uid() 대신 호출부가 넘기는
-- p_admin_id를 created_by/actor_id로 사용, service_role 전용으로 grant 축소.
drop function if exists public.create_direct_onboarding_link_multi(text, text, jsonb);
create or replace function public.create_direct_onboarding_link_multi(
  p_guardian_email text,
  p_guardian_name text,
  p_students jsonb,
  p_admin_id uuid
) returns table (link_id uuid, raw_token text)
language plpgsql security definer set search_path = public as $$
declare
  v_raw_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash text := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');
  v_id uuid;
  v_student jsonb;
  v_first_name text;
  v_first_email text;
  v_first_grade text;
  v_count int := 0;
begin
  if coalesce(trim(p_guardian_name), '') = '' then
    raise exception '보호자 이름은 필수입니다.';
  end if;
  if coalesce(trim(p_guardian_email), '') = '' then
    raise exception '보호자 이메일은 필수입니다.';
  end if;
  if p_students is null or jsonb_typeof(p_students) <> 'array' or jsonb_array_length(p_students) < 1 then
    raise exception '학생을 최소 1명 입력해야 합니다.';
  end if;

  select v->>'name', v->>'email', v->>'grade'
    into v_first_name, v_first_email, v_first_grade
  from jsonb_array_elements(p_students) v limit 1;

  insert into trial_onboarding_links (
    consultation_id, prospect_contact_id, guardian_email, guardian_name,
    student_name, student_email, student_grade, token_hash, expires_at, created_by
  ) values (
    null, null, p_guardian_email, p_guardian_name,
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
  values (v_id, 'created', p_admin_id, jsonb_build_object('guardian_email', p_guardian_email, 'student_count', v_count, 'direct', true));

  return query select v_id, v_raw_token;
end;
$$;
revoke execute on function public.create_direct_onboarding_link_multi(text, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.create_direct_onboarding_link_multi(text, text, jsonb, uuid) to service_role;

comment on function public.create_direct_onboarding_link_multi(text, text, jsonb, uuid) is
  '2026-09-07: create_trial_onboarding_link_multi()와 동일한 auth.uid()/service_role 버그 수정 패턴 적용 — 호출부가 p_admin_id를 명시 전달한다(app/admin/direct-account-actions.ts).';
