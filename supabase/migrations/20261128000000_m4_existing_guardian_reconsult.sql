-- M4 후속(2026-09-06, 제품 오너 확정) — 재상담: 이미 보호자 Auth 계정이 있는 사람이
-- 체험 온보딩을 다시 시도하면 새 계정 생성이 이메일 중복으로 실패해 고아 계정
-- 위험 없이도 사용자에게 원인 불명 오류만 보이는 문제(UAT 중 실측)를 해결한다.
--
-- 신뢰 모델: redeem_trial_onboarding_link()가 상태를 바꾸지 않고 검증만 하므로
-- (실제 완료 표시는 finalize_* 함수가 담당), 이 흐름은 finalize_trial_onboarding_new_guardian()과
-- 완전히 동일한 신뢰 모델을 그대로 따른다 — "1회용 온보딩 토큰 교환에 성공했다"는
-- 사실 자체가 이메일 접근 확인이다(app/api/trial-onboarding/confirm-email/route.ts
-- 기존 주석 참고). 새 enum 상태 없이 기존 pending/redeemed 상태 기계를 그대로 쓴다.

-- =========================================================================
-- 1) 이메일로 기존 Auth 사용자 id 조회 — service_role 전용(온보딩 라우트가
--    createUser 시도 전에 미리 충돌을 감지하는 데 사용).
-- =========================================================================
create or replace function public.find_auth_user_id_by_email(p_email text)
returns uuid
language sql stable security definer set search_path = public as $$
  select id from auth.users where lower(email) = lower(btrim(p_email)) limit 1;
$$;
revoke execute on function public.find_auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.find_auth_user_id_by_email(text) to service_role;

-- =========================================================================
-- 2) 기존 보호자 계정에 새 자녀를 연결 — 새 household·새 보호자 profile을 만들지
--    않고 기존 household를 재사용한다. 멱등: 이미 redeemed된 링크는 기존 결과를
--    그대로 반환한다(재시도 시 중복 생성 방지, finalize_trial_onboarding_new_guardian()과
--    동일한 패턴).
-- =========================================================================
create or replace function public.finalize_trial_onboarding_existing_guardian(
  p_link_id uuid,
  p_existing_guardian_id uuid,
  p_child_auth_user_id uuid
) returns table (household_id uuid, guardian_id uuid, child_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_row trial_onboarding_links%rowtype;
  v_household_id uuid;
  v_child_id uuid;
begin
  select * into v_row from trial_onboarding_links where id = p_link_id for update;
  if not found then
    raise exception '존재하지 않는 온보딩 링크입니다.';
  end if;

  if v_row.status = 'redeemed' then
    -- 재시도 안전: 이미 완료된 링크면 기존 결과를 그대로 반환(중복 생성 방지).
    select c.child_id into v_child_id from consultations c where c.id = v_row.consultation_id;
    select hm.household_id into v_household_id
      from household_members hm where hm.profile_id = v_child_id and hm.role = 'child'
      limit 1;
    return query select v_household_id, v_row.redeemed_auth_user_id, v_child_id;
    return;
  end if;
  if v_row.status <> 'pending' then
    raise exception 'pending 상태의 온보딩 링크만 finalize할 수 있습니다(현재: %).', v_row.status using errcode = 'P0001';
  end if;

  if not exists (select 1 from profiles where id = p_existing_guardian_id and role = 'parent') then
    raise exception '보호자 계정이 아닙니다.' using errcode = 'P0001';
  end if;

  select id into v_household_id from households where primary_guardian_id = p_existing_guardian_id
    order by created_at asc limit 1;
  if v_household_id is null then
    raise exception '이 보호자 계정에 연결된 household를 찾을 수 없습니다 — 관리자에게 문의하세요.' using errcode = 'P0001';
  end if;

  v_child_id := p_child_auth_user_id;
  insert into profiles (id, role, name) values (v_child_id, 'student', v_row.student_name) on conflict (id) do nothing;
  insert into students (id, grade, status) values (v_child_id, v_row.student_grade, 'pending') on conflict (id) do nothing;
  insert into household_members (household_id, profile_id, role, is_primary)
  values (v_household_id, v_child_id, 'child', false)
  on conflict on constraint household_members_household_id_profile_id_key do nothing;

  update trial_onboarding_links
  set status = 'redeemed', redeemed_at = now(), redeemed_auth_user_id = p_existing_guardian_id
  where id = p_link_id;

  update prospect_contacts
  set converted_guardian_id = p_existing_guardian_id, converted_at = now(), converted_by = p_existing_guardian_id,
      conversion_note = '재상담 — 기존 보호자 계정에 연결(link_id=' || p_link_id::text || ')'
  where id = v_row.prospect_contact_id;

  update consultations set child_id = v_child_id where id = v_row.consultation_id;

  insert into trial_onboarding_link_events (link_id, event_type, actor_id, detail)
  values (p_link_id, 'linked_existing_guardian', p_existing_guardian_id, jsonb_build_object('household_id', v_household_id, 'child_id', v_child_id));

  return query select v_household_id, p_existing_guardian_id, v_child_id;
end;
$$;
revoke execute on function public.finalize_trial_onboarding_existing_guardian(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.finalize_trial_onboarding_existing_guardian(uuid, uuid, uuid) to service_role;

comment on function public.finalize_trial_onboarding_existing_guardian(uuid, uuid, uuid) is
  '2026-09-06: 재상담 — 이미 Auth 계정이 있는 보호자에게 새 자녀를 연결한다.
  finalize_trial_onboarding_new_guardian()과 동일한 신뢰 모델(1회용 온보딩
  토큰 교환 성공 = 이메일 접근 확인)과 상태 기계(pending→redeemed)를 그대로
  따른다 — service_role 전용, 새 household를 만들지 않고 기존 것을 재사용.';
