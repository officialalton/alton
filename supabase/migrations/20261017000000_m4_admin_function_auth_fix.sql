-- M4 (2/N 후속) — 실제 버그 수정: confirm_trial_intent / create_trial_onboarding_link
-- / get_or_create_draft_contract_for_child / admin_edit_trial_lesson_review가
-- SQL 안에서 다시 is_admin()을 확인하고 있었는데, 이 함수들은 전부 관리자
-- 서버 액션이 requireAdminOrCapability()로 이미 검증한 뒤 createAdminClient()
-- (service_role)로 호출한다 — service_role 세션에는 auth.uid()가 없어
-- is_admin()이 항상 false를 반환하고, 그 결과 정상적인 관리자 호출도
-- "관리자만..." 예외로 매번 실패했다(M4 골든 패스 E2E 최초 실행에서 실측
-- 발견). 앱 레이어 권한 검사와 중복이라 SQL 쪽 is_admin() 재확인을 제거한다
-- (M3 teacher-assignment-termination-actions.ts 등 기존 관리자 전용 함수들과
-- 동일한 설계로 맞춘다 — 이 함수들도 SQL 안에서 is_admin()을 다시 묻지 않는다).

-- auth.uid()도 service_role 호출에서는 null이라 trial_intent_confirmed_by가
-- 항상 비어있던 같은 종류의 버그가 있었다 — 호출부가 실제 관리자 id를
-- p_admin_id로 넘기도록 시그니처를 바꾼다.
drop function if exists public.confirm_trial_intent(uuid);
create or replace function public.confirm_trial_intent(p_consultation_id uuid, p_admin_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_outcome text;
begin
  select outcome::text into v_outcome from consultations where id = p_consultation_id for update;
  if not found then
    raise exception '상담을 찾을 수 없습니다: %', p_consultation_id;
  end if;
  if v_outcome is distinct from 'trial_recommended' then
    raise exception '관리자 추천(trial_recommended) 결과가 기록된 상담만 체험 진행을 확정할 수 있습니다(현재: %).', coalesce(v_outcome, 'null');
  end if;

  update consultations
  set trial_intent_confirmed_at = coalesce(trial_intent_confirmed_at, now()),
      trial_intent_confirmed_by = coalesce(trial_intent_confirmed_by, p_admin_id)
  where id = p_consultation_id;
end;
$$;
revoke execute on function public.confirm_trial_intent(uuid, uuid) from public, anon, authenticated;
grant execute on function public.confirm_trial_intent(uuid, uuid) to service_role;

drop function if exists public.create_trial_onboarding_link(uuid, text, text, text, text, text);
create or replace function public.create_trial_onboarding_link(
  p_consultation_id uuid,
  p_guardian_email text,
  p_guardian_name text,
  p_student_name text,
  p_student_email text,
  p_admin_id uuid,
  p_student_grade text default null
) returns table (link_id uuid, raw_token text)
language plpgsql security definer set search_path = public as $$
declare
  v_prospect_contact_id uuid;
  v_confirmed timestamptz;
  v_raw_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash text := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');
  v_id uuid;
begin
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

  insert into trial_onboarding_links (
    consultation_id, prospect_contact_id, guardian_email, guardian_name,
    student_name, student_email, student_grade, token_hash, expires_at, created_by
  ) values (
    p_consultation_id, v_prospect_contact_id, p_guardian_email, p_guardian_name,
    p_student_name, p_student_email, p_student_grade, v_token_hash, now() + interval '72 hours', p_admin_id
  )
  returning id into v_id;

  insert into trial_onboarding_link_events (link_id, event_type, actor_id, detail)
  values (v_id, 'created', p_admin_id, jsonb_build_object('guardian_email', p_guardian_email));

  return query select v_id, v_raw_token;
end;
$$;
revoke execute on function public.create_trial_onboarding_link(uuid, text, text, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.create_trial_onboarding_link(uuid, text, text, text, text, uuid, text) to service_role;

create or replace function public.get_or_create_draft_contract_for_child(p_child_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_household_id uuid;
  v_existing_id uuid;
  v_new_id uuid;
begin
  select id into v_existing_id from contracts
  where child_id = p_child_id and status not in ('void', 'superseded', 'terminated', 'expired')
  order by created_at desc limit 1;
  if v_existing_id is not null then
    return v_existing_id;
  end if;

  select hm.household_id into v_household_id
  from household_members hm where hm.profile_id = p_child_id and hm.role = 'child' limit 1;
  if v_household_id is null then
    raise exception '이 학생의 가족(household)을 찾을 수 없습니다.';
  end if;

  insert into contracts (household_id, child_id, status) values (v_household_id, p_child_id, 'draft')
  returning id into v_new_id;
  return v_new_id;
end;
$$;

-- admin_edit_trial_lesson_review: is_admin() 제거뿐 아니라, auth.uid()도
-- service_role 호출에서는 null이라 admin_edited_by가 항상 null로 남는 같은
-- 종류의 버그가 있었다 — 호출부(app/admin)가 실제 관리자 id를 파라미터로
-- 넘기도록 시그니처를 바꾼다(다른 관리자 함수들의 p_processed_by/p_changed_by
-- 관례와 동일).
create or replace function public.admin_edit_trial_lesson_review(
  p_session_id uuid,
  p_final_text text,
  p_admin_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(trim(p_final_text), '') = '' then
    raise exception '빈 리뷰로 정정할 수 없습니다.';
  end if;
  update trial_lesson_reviews
  set final_text = p_final_text, admin_edited_by = p_admin_id, admin_edited_at = now(), updated_at = now()
  where session_id = p_session_id and status = 'final';
  if not found then
    raise exception '확정된 리뷰만 정정할 수 있습니다.';
  end if;
end;
$$;
revoke execute on function public.admin_edit_trial_lesson_review(uuid, text) from public, anon, authenticated, service_role;
drop function if exists public.admin_edit_trial_lesson_review(uuid, text);
revoke execute on function public.admin_edit_trial_lesson_review(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.admin_edit_trial_lesson_review(uuid, text, uuid) to service_role;
