-- 온보딩 링크 재사용 수정(20261279000000)에 대한 제품 오너 재검토 반영 —
-- 2026-09-11.
--
-- 1) 리스 소유권 부재: 이전 설계는 finalize_claimed_at(타임스탬프)만으로
--    "누가 리스를 쥐고 있는지"를 판단했다. 리스가 만료된 뒤 새 요청이
--    새로 리스를 잡은 상태에서, 만료 전에 시작된 이전 요청이 뒤늦게
--    record_pending_guardian_account()/release_trial_onboarding_link_finalize_claim()를
--    호출하면 status='pending'이라는 조건만으로는 그것이 "지금 유효한
--    리스"인지 "이미 새 요청에게 넘어간 리스"인지 구분할 수 없었다 —
--    새 요청의 리스를 잘못 해제하거나 새 요청이 기록해야 할 pending id를
--    엉뚱한 값으로 덮어쓸 수 있었다. finalize_claim_id(요청마다 새로 발급되는
--    세대 값)를 추가해, 각 함수가 "지금 내가 쥔 리스가 맞는지"를 명시적으로
--    검증한 뒤에만 쓰기를 허용한다.
--
-- 2) Auth 생성 후 기록 전 중단: GoTrue 자체 장애뿐 아니라 앱 프로세스 중단·
--    네트워크 단절로도 admin.auth.admin.createUser() 성공 직후
--    record_pending_guardian_account() 호출 전에 죽을 수 있다. 이 경우 재시도는
--    이메일이 이미 auth.users에 존재해 createUser()가 실패하는데, 기존
--    find_auth_user_id_by_email()은 auth.users만 보고 "이미 존재하는 계정"으로
--    판정해버려 profiles가 없는 고아 계정에 finalize_trial_onboarding_students(
--    p_new_guardian=false)를 시도 → "보호자 계정이 아닙니다" 예외로 매번
--    영구 실패했다. 이 온보딩이 실제로 만든 계정인지는 이메일 일치만으로
--    증명할 수 없다(무관한 계정이 우연히 같은 이메일을 쓸 수도 있음) — 대신
--    createUser() 호출 시 raw_user_meta_data에 trial_onboarding_link_id를
--    남겨, 나중에 그 값이 지금 처리 중인 링크 id와 일치하는 계정만 "이
--    온보딩이 만든 고아"로 인정하고 이어서 복구한다. 일치하지 않으면(무관한
--    계정) 여전히 병합하지 않고 관리자 문의로 막는다.

alter table trial_onboarding_links add column finalize_claim_id uuid;
alter table trial_onboarding_links add column redeemed_claim_id uuid;
comment on column trial_onboarding_links.finalize_claim_id is
  '현재 유효한 리스의 소유권 식별자(세대 값). claim_trial_onboarding_link_finalize()가 리스를 잡을 때마다 새로 발급하며, record_pending_guardian_account()/release_trial_onboarding_link_finalize_claim()는 이 값이 일치할 때만 쓰기를 허용한다 — 리스 만료 후 넘어간 새 요청을 이전 요청이 되돌리지 못하게 막는다.';
comment on column trial_onboarding_links.redeemed_claim_id is
  'pending→redeemed 전이를 실제로 수행한 claim_id(영구 기록). 이후 오래된 claim_id를 쥔 요청이 뒤늦게 finalize를 다시 호출해도(예: 리스 만료 후 새 요청이 이미 완료시킨 경우) 이 값과 다르면 거부한다.';

-- =========================================================================
-- claim_trial_onboarding_link_finalize — claim_id(세대 값)를 새로 발급해
-- 반환한다. 이후 이 요청이 하는 모든 쓰기(record_pending_guardian_account,
-- release_trial_onboarding_link_finalize_claim, finalize_trial_onboarding_students의
-- 신규 보호자 경로)는 이 claim_id를 함께 제시해야 한다.
-- =========================================================================
-- 반환 컬럼 구성이 바뀌므로(claim_id 추가) CREATE OR REPLACE로 대체할 수
-- 없다 — 이전 시그니처를 명시적으로 먼저 제거한다.
drop function if exists public.claim_trial_onboarding_link_finalize(uuid, int);

create function public.claim_trial_onboarding_link_finalize(
  p_link_id uuid,
  p_lease_seconds int default 120
) returns table (action text, redeemed_auth_user_id uuid, pending_guardian_auth_user_id uuid, claim_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_row trial_onboarding_links%rowtype;
  v_new_claim uuid;
begin
  select * into v_row from trial_onboarding_links where id = p_link_id for update;
  if not found then
    raise exception 'invalid_link';
  end if;

  if v_row.status = 'redeemed' then
    return query select 'already_redeemed', v_row.redeemed_auth_user_id, v_row.pending_guardian_auth_user_id, null::uuid;
    return;
  end if;
  if v_row.status = 'revoked' then
    raise exception 'revoked_link';
  end if;
  if v_row.status = 'expired' then
    raise exception 'expired_link';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'invalid_link_status:%', v_row.status;
  end if;

  if v_row.finalize_claimed_at is not null
     and v_row.finalize_claimed_at > now() - (p_lease_seconds || ' seconds')::interval then
    return query select 'busy', null::uuid, v_row.pending_guardian_auth_user_id, null::uuid;
    return;
  end if;

  v_new_claim := gen_random_uuid();
  update trial_onboarding_links
  set finalize_claimed_at = now(), finalize_claim_id = v_new_claim
  where id = p_link_id;

  return query select 'proceed', null::uuid, v_row.pending_guardian_auth_user_id, v_new_claim;
end;
$$;
revoke execute on function public.claim_trial_onboarding_link_finalize(uuid, int) from public;
grant execute on function public.claim_trial_onboarding_link_finalize(uuid, int) to anon, authenticated, service_role;

-- =========================================================================
-- record_pending_guardian_account — 호출자가 지금 이 링크의 유효한 claim_id를
-- 쥐고 있을 때만 기록한다. 리스가 만료돼 다른 요청이 새 claim_id로 넘겨받은
-- 뒤라면(=finalize_claim_id가 더 이상 p_claim_id와 다르면) 아무것도 바꾸지
-- 않고 false를 반환한다 — 호출부는 이 경우 자신이 방금 만든 Auth 계정을
-- 고아로 정리해야 한다(더 이상 자신이 이 링크의 소유자가 아니므로).
-- =========================================================================
drop function if exists public.record_pending_guardian_account(uuid, uuid);

create function public.record_pending_guardian_account(
  p_link_id uuid,
  p_claim_id uuid,
  p_auth_user_id uuid
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_updated boolean;
begin
  update trial_onboarding_links
  set pending_guardian_auth_user_id = coalesce(pending_guardian_auth_user_id, p_auth_user_id)
  where id = p_link_id and status = 'pending' and finalize_claim_id = p_claim_id
  returning true into v_updated;
  return coalesce(v_updated, false);
end;
$$;
revoke execute on function public.record_pending_guardian_account(uuid, uuid, uuid) from public;
grant execute on function public.record_pending_guardian_account(uuid, uuid, uuid) to anon, authenticated, service_role;

-- =========================================================================
-- release_trial_onboarding_link_finalize_claim — 마찬가지로 claim_id가
-- 일치할 때만 리스를 푼다. 이미 다른 요청에게 넘어간 리스를 실수로 풀어주는
-- 일이 없다.
-- =========================================================================
drop function if exists public.release_trial_onboarding_link_finalize_claim(uuid);

create function public.release_trial_onboarding_link_finalize_claim(
  p_link_id uuid,
  p_claim_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
begin
  update trial_onboarding_links set finalize_claimed_at = null, finalize_claim_id = null
  where id = p_link_id and status = 'pending' and finalize_claim_id = p_claim_id;
end;
$$;
revoke execute on function public.release_trial_onboarding_link_finalize_claim(uuid, uuid) from public;
grant execute on function public.release_trial_onboarding_link_finalize_claim(uuid, uuid) to anon, authenticated, service_role;

-- =========================================================================
-- finalize_trial_onboarding_students — 신규 보호자(p_new_guardian=true)
-- 경로에서 pending→redeemed 전이를 수행하기 직전, 호출자의 claim_id가 지금
-- 이 링크의 유효한 리스와 일치하는지 확인한다. 일치하지 않으면(=리스가
-- 만료돼 다른 요청에게 넘어간 뒤 뒤늦게 도착한 호출) stale_claim으로 막아
-- 이미 완료된 전이를 되돌리거나 엉뚱한 guardian_auth_user_id로 덮어쓰지
-- 못하게 한다. 전이가 성공하면 redeemed_claim_id에 영구 기록해, 그 뒤
-- 똑같이 뒤늦게 도착하는 재호출도 계속 막는다. 기존 보호자 경로
-- (p_new_guardian=false, 형제자매 추가 등)는 애초에 새 Auth 계정을 만들지
-- 않아 이 경쟁이 없으므로 claim 검사 대상이 아니다(p_claim_id는 null 허용).
-- =========================================================================
drop function if exists public.finalize_trial_onboarding_students(uuid, boolean, uuid, text, jsonb);

create function public.finalize_trial_onboarding_students(
  p_link_id uuid,
  p_new_guardian boolean,
  p_guardian_auth_user_id uuid,
  p_guardian_name text,
  p_students jsonb,
  p_claim_id uuid default null
) returns table (household_id uuid, guardian_id uuid, created_count integer, failed_count integer)
language plpgsql security definer set search_path = public as $$
declare
  v_row trial_onboarding_links%rowtype;
  v_household_id uuid;
  v_item jsonb;
  v_link_student_id uuid;
  v_child_auth_user_id uuid;
  v_student trial_onboarding_link_students%rowtype;
  v_created int := 0;
  v_failed int := 0;
begin
  select * into v_row from trial_onboarding_links where id = p_link_id for update;
  if not found then
    raise exception '존재하지 않는 온보딩 링크입니다.';
  end if;
  if v_row.status not in ('pending', 'redeemed') then
    raise exception 'pending 또는 redeemed 상태의 온보딩 링크만 처리할 수 있습니다(현재: %).', v_row.status;
  end if;

  if p_new_guardian and v_row.status = 'pending' then
    if v_row.finalize_claim_id is distinct from p_claim_id then
      raise exception 'stale_claim: 이 온보딩 링크는 다른 요청이 이미 처리 중이거나 완료했습니다.';
    end if;
  end if;
  if p_new_guardian and v_row.status = 'redeemed' and v_row.redeemed_claim_id is not null
     and v_row.redeemed_claim_id is distinct from p_claim_id then
    raise exception 'stale_claim: 이 온보딩 링크는 이미 다른 요청이 완료했습니다.';
  end if;

  if p_new_guardian then
    insert into profiles (id, role, name) values (p_guardian_auth_user_id, 'parent', p_guardian_name)
      on conflict (id) do nothing;
    insert into parents (id) values (p_guardian_auth_user_id) on conflict (id) do nothing;

    select id into v_household_id from households where primary_guardian_id = p_guardian_auth_user_id
      order by created_at asc limit 1;
    if v_household_id is null then
      insert into households (primary_guardian_id) values (p_guardian_auth_user_id) returning id into v_household_id;
      insert into household_members (household_id, profile_id, role, is_primary)
        values (v_household_id, p_guardian_auth_user_id, 'guardian', true)
        on conflict on constraint household_members_household_id_profile_id_key do nothing;
    end if;
  else
    if not exists (select 1 from profiles where id = p_guardian_auth_user_id and role = 'parent') then
      raise exception '보호자 계정이 아닙니다.';
    end if;
    select id into v_household_id from households where primary_guardian_id = p_guardian_auth_user_id
      order by created_at asc limit 1;
    if v_household_id is null then
      raise exception '이 보호자 계정에 연결된 household를 찾을 수 없습니다 — 관리자에게 문의하세요.';
    end if;
  end if;

  update trial_onboarding_links
  set status = 'redeemed', redeemed_at = coalesce(redeemed_at, now()), redeemed_auth_user_id = p_guardian_auth_user_id,
      redeemed_claim_id = case when p_new_guardian then coalesce(redeemed_claim_id, p_claim_id) else redeemed_claim_id end
  where id = p_link_id;

  if v_row.prospect_contact_id is not null then
    update prospect_contacts
    set converted_guardian_id = p_guardian_auth_user_id, converted_at = coalesce(converted_at, now()),
        converted_by = p_guardian_auth_user_id,
        conversion_note = coalesce(conversion_note, '복수자녀 온보딩(link_id=' || p_link_id::text || ')')
    where id = v_row.prospect_contact_id;
  end if;

  for v_item in select * from jsonb_array_elements(p_students)
  loop
    v_link_student_id := (v_item->>'link_student_id')::uuid;
    v_child_auth_user_id := (v_item->>'child_auth_user_id')::uuid;

    select * into v_student from trial_onboarding_link_students where id = v_link_student_id and link_id = p_link_id for update;
    if not found then
      continue;
    end if;
    if v_student.status = 'created' then
      v_created := v_created + 1;
      continue;
    end if;
    if v_student.status = 'cancelled' then
      continue;
    end if;

    begin
      insert into profiles (id, role, name) values (v_child_auth_user_id, 'student', v_student.student_name)
        on conflict (id) do nothing;
      insert into students (id, grade, status) values (v_child_auth_user_id, v_student.student_grade, 'pending')
        on conflict (id) do nothing;
      insert into household_members (household_id, profile_id, role, is_primary)
        values (v_household_id, v_child_auth_user_id, 'child', false)
        on conflict on constraint household_members_household_id_profile_id_key do nothing;

      update trial_onboarding_link_students
      set status = 'created', child_auth_user_id = v_child_auth_user_id, error = null, updated_at = now()
      where id = v_link_student_id;

      if v_row.consultation_id is not null then
        perform public._create_student_kanban_card(v_row.consultation_id, v_link_student_id, v_child_auth_user_id, v_household_id);
      else
        update trial_onboarding_link_students
        set trial_entitlement_grant_status = 'awaiting_consent'
        where id = v_link_student_id;
      end if;

      insert into trial_onboarding_link_events (link_id, event_type, actor_id, detail)
      values (p_link_id, 'finalized', p_guardian_auth_user_id,
        jsonb_build_object('household_id', v_household_id, 'child_id', v_child_auth_user_id, 'link_student_id', v_link_student_id));

      v_created := v_created + 1;
    exception when others then
      update trial_onboarding_link_students
      set status = 'failed', error = sqlerrm, updated_at = now()
      where id = v_link_student_id;
      v_failed := v_failed + 1;
    end;
  end loop;

  return query select v_household_id, p_guardian_auth_user_id, v_created, v_failed;
end;
$$;
revoke execute on function public.finalize_trial_onboarding_students(uuid, boolean, uuid, text, jsonb, uuid) from public;
grant execute on function public.finalize_trial_onboarding_students(uuid, boolean, uuid, text, jsonb, uuid) to anon, authenticated, service_role;
