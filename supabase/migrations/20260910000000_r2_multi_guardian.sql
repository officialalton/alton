-- R2 잔여 항목 — 복수 보호자와 주 보호자 설정.
--
-- Task 3(household cutover)는 households/household_members가 복수 보호자를
-- 정확히 지원하는 스키마(주 보호자 정확히 1명을 강제하는 partial unique
-- index)를 이미 갖췄지만, Task 4(초대) 구현 당시 "다중 보호자 초대 UX는
-- Task 4에서 별도로 설계"라고만 남기고 실제로는 구현하지 않았다
-- (app/admin/users-actions.ts의 findOrCreateHouseholdForGuardian 주석 참고).
-- create_account_invite()는 role='parent'일 때 household_id를 절대 지정할
-- 수 없게 막혀 있었다 — 즉 항상 "새 household를 만드는 단독 보호자"만
-- 초대 가능했고, "이미 존재하는 가족에 공동 보호자를 추가"하는 경로가
-- 전혀 없었다.
--
-- §4.19는 "관리자가 보호자를 초대하고, 가입한 보호자는 자기 화면에서
-- 자녀를 추가로 초대할 수 있다"고만 확정했고 "보호자가 다른 보호자를
-- 초대"하는 자기서비스 경로는 확정한 적이 없다 — 그래서 이번 구현도
-- 기존 정책 그대로 관리자 전용으로 좁혀서 새 정책을 만들지 않는다.
-- household_members 쓰기는 이미 `is_admin() OR
-- current_user_has_capability('학생관리')`로 게이트돼 있으므로(R1 RLS,
-- supabase/migrations/20260830080000_r1_rls_policies.sql) 새 함수도 같은
-- capability를 그대로 재사용한다(신규 capability 이름을 만들지 않음).

-- 테이블 체크 제약도 같은 이유로 완화한다 — 함수 안의 검사만으로는 이
-- 제약이 여전히 INSERT를 막는다(실측 확인: account_invites_parent_has_no_household
-- 위반).
alter table account_invites drop constraint account_invites_parent_has_no_household;

create or replace function public.create_account_invite(
  p_email text,
  p_name text,
  p_role text,
  p_household_id uuid,
  p_grade text default null
) returns table (invite_id uuid, raw_token text)
language plpgsql security definer set search_path = public as $$
declare
  v_email_normalized text := lower(trim(p_email));
  v_raw_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash text := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_role = 'parent' then
    if not (is_admin() or current_user_has_capability('학생관리')) then
      raise exception '보호자 초대는 관리자만 할 수 있습니다.';
    end if;
    -- (2026-09-01 R2 잔여 항목) 기존에는 household_id를 절대 지정할 수 없어
    -- "이미 존재하는 가족에 두 번째 보호자를 초대"할 방법이 없었다 — 항상
    -- 새 household를 만드는 단독 보호자 초대만 가능했다. household_id를
    -- 지정하면 그 household에 공동 보호자(is_primary=false)로 합류시킨다.
    if p_household_id is not null and not exists (select 1 from households where id = p_household_id) then
      raise exception '존재하지 않는 household입니다: %', p_household_id;
    end if;
  elsif p_role = 'student' then
    if p_household_id is null then
      raise exception '학생(자녀) 초대는 household_id가 필요합니다.';
    end if;
    if not (
      is_admin()
      or exists (
        select 1 from household_members hm
        where hm.household_id = p_household_id and hm.profile_id = auth.uid() and hm.role = 'guardian'
      )
    ) then
      raise exception '본인 household에만 자녀를 초대할 수 있습니다.';
    end if;
  else
    raise exception '지원하지 않는 초대 역할입니다: %(선생님 초대는 이 테이블 범위 밖입니다)', p_role;
  end if;

  -- (2026-09-01 R2 잔여 항목·Task 9 E2E 작성 중 발견) 지금까지는 이 사전
  -- 확인이 없어 같은 이메일로 두 번째 초대를 시도하면
  -- account_invites_pending_unique 유니크 인덱스 위반이라는 원본 Postgres
  -- 오류가 관리자 화면에 그대로 노출됐다("duplicate key value violates
  -- unique constraint..." 같은 내부 구현 세부사항). 안내 메시지를 먼저
  -- 확인해 던진다.
  if exists (
    select 1 from account_invites
    where email_normalized = v_email_normalized
      and role = p_role::account_invite_role
      and household_id is not distinct from p_household_id
      and status = 'pending'
  ) then
    raise exception '이미 처리 대기 중인 초대가 있습니다. 재발송하거나 철회한 뒤 다시 시도해주세요.';
  end if;

  insert into account_invites (
    email_normalized, email_original, invitee_name, invitee_grade, role, household_id, invited_by,
    token_hash, expires_at, last_sent_at
  ) values (
    v_email_normalized, p_email, p_name, p_grade, p_role::account_invite_role, p_household_id, auth.uid(),
    v_token_hash, now() + interval '7 days', now()
  )
  returning id into v_id;

  insert into account_invite_events (invite_id, event_type, actor_id, detail)
  values (v_id, 'sent', auth.uid(), jsonb_build_object('email', p_email));

  return query select v_id, v_raw_token;
end;
$$;

create or replace function public.finalize_account_invite(p_invite_id uuid, p_auth_user_id uuid)
returns table (target_profile_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_row account_invites%rowtype;
begin
  select * into v_row from account_invites where id = p_invite_id for update;
  if not found then
    raise exception '존재하지 않는 초대입니다.';
  end if;
  if v_row.status <> 'accepted' then
    raise exception '수락(accepted) 상태의 초대만 finalize할 수 있습니다(현재: %).', v_row.status;
  end if;

  if v_row.target_profile_id is not null then
    return query select v_row.target_profile_id;
    return;
  end if;

  insert into profiles (id, role, name) values (p_auth_user_id, v_row.role::text::profile_role, v_row.invitee_name);

  if v_row.role = 'parent' then
    insert into parents (id) values (p_auth_user_id);
    -- household_id가 있으면(공동 보호자 초대) 기존 household에 합류한다 —
    -- 주 보호자는 이미 있으므로 is_primary=false. household_id가 없으면
    -- (기존과 동일) 여기서는 household를 만들지 않는다 — 그 보호자가 첫
    -- 자녀를 초대할 때 findOrCreateHouseholdForGuardian()이 지연 생성한다.
    if v_row.household_id is not null then
      insert into household_members (household_id, profile_id, role, is_primary)
      values (v_row.household_id, p_auth_user_id, 'guardian', false)
      on conflict (household_id, profile_id) do nothing;
    end if;
  elsif v_row.role = 'student' then
    insert into students (id, grade, status) values (p_auth_user_id, v_row.invitee_grade, 'pending');
    insert into household_members (household_id, profile_id, role, is_primary)
    values (v_row.household_id, p_auth_user_id, 'child', true);
  end if;

  update account_invites
  set target_profile_id = p_auth_user_id, auth_user_id = p_auth_user_id, updated_at = now()
  where id = p_invite_id;

  return query select p_auth_user_id;
end;
$$;

-- 주 보호자 재지정. partial unique index(household_members_one_primary_guardian
-- 계열)가 이미 "household당 is_primary=true는 최대 1명"을 강제하므로, 이 함수는
-- 그 제약을 만족하는 순서(기존 것 해제 → 새 것 설정)로만 갱신하고,
-- households.primary_guardian_id 비정규화 컬럼도 같은 트랜잭션에서 동기화한다
-- (이 컬럼은 지금까지 백필 INSERT 시점에만 채워졌고 이후 갱신 경로가 없었다).
create or replace function public.set_primary_guardian(p_household_id uuid, p_profile_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (is_admin() or current_user_has_capability('학생관리')) then
    raise exception '주 보호자 지정은 관리자만 할 수 있습니다.';
  end if;

  if not exists (
    select 1 from household_members
    where household_id = p_household_id and profile_id = p_profile_id and role = 'guardian'
  ) then
    raise exception '해당 household의 보호자가 아닙니다(household_id=%, profile_id=%).', p_household_id, p_profile_id;
  end if;

  update household_members set is_primary = false
  where household_id = p_household_id and role = 'guardian' and is_primary = true;

  update household_members set is_primary = true
  where household_id = p_household_id and profile_id = p_profile_id and role = 'guardian';

  update households set primary_guardian_id = p_profile_id where id = p_household_id;
end;
$$;
revoke execute on function public.set_primary_guardian(uuid, uuid) from public;
grant execute on function public.set_primary_guardian(uuid, uuid) to authenticated;
