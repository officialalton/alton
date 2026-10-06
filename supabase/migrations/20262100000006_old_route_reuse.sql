-- =========================================================================
-- 2026-10-05 무료 회원 S5 — 기존 상담 경로 재사용(old_route_reuse).
--  - trial_onboarding_link_students.is_existing_child (기존 무료 회원 자녀 연결 행)
--  - create_trial_onboarding_link_multi: 학생 payload 선택 키 existing_child_id
--    (consultations.child_id 와 같을 때만, 무료 회원일 때만; 행은 status=created 로 삽입)
--  - finalize_trial_onboarding_students: 기존 자녀 분기(household 없을 때만 insert, 칸반 멱등,
--    convert_free_member_to_tutoring 호출) + 직접생성 경로 거절
--  - convert_free_member_to_tutoring: 일방향 free->tutoring(students.id·학습 기록 불변)
-- existing_child_id 가 없는 호출은 이전과 동일하게 동작한다.
-- =========================================================================

alter table trial_onboarding_link_students add column if not exists is_existing_child boolean not null default false;

-- 같은 기존 자녀에 대해 링크 재발급(만료/폐기)을 허용하려면 기존 자녀 행은 유니크 대상에서 뺀다.
drop index if exists trial_onboarding_link_students_child_auth_unique;
create unique index trial_onboarding_link_students_child_auth_unique
  on trial_onboarding_link_students (child_auth_user_id) where child_auth_user_id is not null and not is_existing_child;

create or replace function public.convert_free_member_to_tutoring(p_student_id uuid, p_consultation_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_c consultations%rowtype;
  v_type text;
begin
  select * into v_c from consultations where id = p_consultation_id;
  if not found or v_c.child_id is distinct from p_student_id or v_c.source <> 'free_member' then
    raise exception 'convert_free_member_to_tutoring: 이 상담은 해당 학생의 무료 회원 연결 상담이 아닙니다.';
  end if;
  select member_type into v_type from students where id = p_student_id for update;
  if not found then
    raise exception 'convert_free_member_to_tutoring: 학생을 찾을 수 없습니다.';
  end if;
  if v_type = 'tutoring' then
    return false; -- 이미 전환됨(멱등)
  end if;
  perform set_config('app.allow_member_type_change', 'true', true);
  update students set member_type = 'tutoring' where id = p_student_id and member_type = 'free';
  perform set_config('app.allow_member_type_change', 'false', true);
  return true;
end;
$$;
revoke execute on function public.convert_free_member_to_tutoring(uuid, uuid) from public, anon, authenticated;
grant execute on function public.convert_free_member_to_tutoring(uuid, uuid) to service_role;
comment on function public.convert_free_member_to_tutoring(uuid, uuid) is
  '2026-10-05 S5 일방향 free->tutoring. students.id·학습 기록은 건드리지 않는다. 상담 경로 finalize 에서만 호출.';

create or replace function public.create_trial_onboarding_link_multi(
  p_consultation_id uuid,
  p_guardian_email text,
  p_guardian_name text,
  p_students jsonb,
  p_admin_id uuid
)
returns table(link_id uuid, raw_token text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_prospect_contact_id uuid;
  v_confirmed timestamptz;
  v_outcome consult_outcome;
  v_status v3_consultation_status;
  v_child_id uuid;
  v_raw_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash text := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');
  v_id uuid;
  v_student jsonb;
  v_first_name text;
  v_first_email text;
  v_first_grade text;
  v_count int := 0;
  v_existing uuid;
  v_ex_name text;
  v_ex_email text;
  v_ex_grade text;
begin
  if p_students is null or jsonb_typeof(p_students) <> 'array' or jsonb_array_length(p_students) < 1 then
    raise exception '학생을 최소 1명 입력해야 합니다.';
  end if;

  select prospect_contact_id, trial_intent_confirmed_at, outcome, status, child_id
    into v_prospect_contact_id, v_confirmed, v_outcome, v_status, v_child_id
  from consultations where id = p_consultation_id;
  if not found then
    raise exception '상담을 찾을 수 없습니다: %', p_consultation_id;
  end if;
  if v_status = 'cancelled' then
    raise exception '취소된 상담에는 온보딩 링크를 발급할 수 없습니다.';
  end if;
  if v_prospect_contact_id is null then
    raise exception '잠재고객(prospect_contact) 연결이 없는 상담입니다.';
  end if;
  if v_confirmed is null and v_outcome is distinct from 'regular_recommended' then
    raise exception '보호자의 체험 진행 확정(confirm_trial_intent) 이후에만 온보딩 링크를 발급할 수 있습니다.';
  end if;

  -- existing_child_id 사전 검증(링크 생성 전) — 상담의 child_id 와 같고 무료 회원이어야 한다.
  for v_student in select * from jsonb_array_elements(p_students)
  loop
    if nullif(v_student->>'existing_child_id', '') is not null then
      v_existing := (v_student->>'existing_child_id')::uuid;
      if v_child_id is null or v_existing is distinct from v_child_id then
        raise exception 'existing_child_id 가 이 상담의 자녀(child_id)와 일치하지 않습니다.';
      end if;
      if not exists (select 1 from students where id = v_existing and member_type = 'free') then
        raise exception 'existing_child_id 는 무료 회원 학생이어야 합니다.';
      end if;
    end if;
  end loop;

  select coalesce(nullif(v->>'name',''), ''), v->>'email', v->>'grade', nullif(v->>'existing_child_id','')
    into v_first_name, v_first_email, v_first_grade, v_existing
  from jsonb_array_elements(p_students) v limit 1;
  if v_existing is not null then
    select p.name, u.email into v_ex_name, v_ex_email
      from profiles p join auth.users u on u.id = p.id where p.id = v_existing;
    v_first_name := coalesce(v_ex_name, v_first_name);
    v_first_email := coalesce(v_ex_email, v_first_email);
  end if;

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
    if nullif(v_student->>'existing_child_id', '') is not null then
      v_existing := (v_student->>'existing_child_id')::uuid;
      select p.name, u.email, s.grade into v_ex_name, v_ex_email, v_ex_grade
        from profiles p join auth.users u on u.id = p.id join students s on s.id = p.id where p.id = v_existing;
      insert into trial_onboarding_link_students (
        link_id, student_name, student_email, student_grade, student_subject,
        status, child_auth_user_id, is_existing_child
      ) values (
        v_id, coalesce(v_ex_name, v_student->>'name'), v_ex_email, coalesce(v_student->>'grade', v_ex_grade), v_student->>'subject',
        'created', v_existing, true
      );
    else
      if coalesce(v_student->>'name', '') = '' or coalesce(v_student->>'email', '') = '' then
        raise exception '학생 이름과 이메일은 필수입니다.';
      end if;
      insert into trial_onboarding_link_students (link_id, student_name, student_email, student_grade, student_subject)
      values (v_id, v_student->>'name', v_student->>'email', v_student->>'grade', v_student->>'subject');
    end if;
    v_count := v_count + 1;
  end loop;

  insert into trial_onboarding_link_events (link_id, event_type, actor_id, detail)
  values (v_id, 'created', p_admin_id, jsonb_build_object('guardian_email', p_guardian_email, 'student_count', v_count));

  return query select v_id, v_raw_token;
end;
$$;

CREATE OR REPLACE FUNCTION public.finalize_trial_onboarding_students(p_link_id uuid, p_new_guardian boolean, p_guardian_auth_user_id uuid, p_guardian_name text, p_students jsonb, p_claim_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(household_id uuid, guardian_id uuid, created_count integer, failed_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row trial_onboarding_links%rowtype;
  v_household_id uuid;
  v_item jsonb;
  v_link_student_id uuid;
  v_child_auth_user_id uuid;
  v_student trial_onboarding_link_students%rowtype;
  v_created int := 0;
  v_failed int := 0;
  v_grant_id uuid;
  v_child_household uuid;
begin
  select * into v_row from trial_onboarding_links where id = p_link_id for update;
  if not found then
    raise exception '존재하지 않는 온보딩 링크입니다.';
  end if;
  if v_row.status not in ('pending', 'redeemed') then
    raise exception 'pending 또는 redeemed 상태의 온보딩 링크만 처리할 수 있습니다(현재: %).', v_row.status;
  end if;

  -- 직접생성(상담 없음) 경로는 기존 무료 회원 자녀 연결을 거절한다(무료->과외 전환은 상담 경로 전용).
  if v_row.consultation_id is null
     and exists (select 1 from trial_onboarding_link_students where link_id = p_link_id and is_existing_child) then
    raise exception 'existing_child_not_allowed_in_direct_path: 무료 회원 자녀는 상담 경로 온보딩으로만 과외 전환할 수 있습니다.';
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
      if v_student.is_existing_child then
        -- 기존 무료 회원 자녀(2026-10-05 S5) — 계정은 이미 있다. household 연결(없을 때만)·칸반 카드(멱등)·free->tutoring 전환.
        select hm.household_id into v_child_household from household_members hm
          where hm.profile_id = v_student.child_auth_user_id and hm.role = 'child' order by hm.household_id limit 1;
        if v_child_household is null then
          insert into household_members (household_id, profile_id, role, is_primary)
            values (v_household_id, v_student.child_auth_user_id, 'child', false)
            on conflict on constraint household_members_household_id_profile_id_key do nothing;
          v_child_household := v_household_id;
        end if;
        perform public._create_student_kanban_card(v_row.consultation_id, v_link_student_id, v_student.child_auth_user_id, v_child_household);
        perform public.convert_free_member_to_tutoring(v_student.child_auth_user_id, v_row.consultation_id);
        insert into trial_onboarding_link_events (link_id, event_type, actor_id, detail)
        values (p_link_id, 'finalized', p_guardian_auth_user_id,
          jsonb_build_object('household_id', v_child_household, 'child_id', v_student.child_auth_user_id, 'link_student_id', v_link_student_id, 'existing_free_member', true));
        continue;
      end if;
      if v_row.consultation_id is null and v_student.consultant_id is not null and v_student.child_auth_user_id is not null
         and not exists (select 1 from consultant_assignments where student_id = v_student.child_auth_user_id) then
        insert into consultant_assignments (consultant_id, student_id, assigned_by, assigned_at)
        values (v_student.consultant_id, v_student.child_auth_user_id, v_student.consultant_assigned_by, now())
        on conflict (student_id) do nothing;
        insert into consultant_assignment_history (student_id, prior_consultant_id, new_consultant_id, actor_id, reason)
        values (v_student.child_auth_user_id, null, v_student.consultant_id, v_student.consultant_assigned_by, '가입 대기 단계 담당자 이어받음(계정 이미 생성됨 — 결함 수정 백필)');
      end if;
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
        -- 지인/추천 직접생성 경로 — 담당 컨설턴트를 그대로 이어 붙인다(R15-A).
        if v_student.consultant_id is not null then
          insert into consultant_assignments (consultant_id, student_id, assigned_by, assigned_at)
          values (v_student.consultant_id, v_child_auth_user_id, v_student.consultant_assigned_by, now())
          on conflict (student_id) do nothing;
          insert into consultant_assignment_history (student_id, prior_consultant_id, new_consultant_id, actor_id, reason)
          values (v_child_auth_user_id, null, v_student.consultant_id, v_student.consultant_assigned_by, '가입 대기 단계 담당자 이어받음(계정 생성)');
        end if;

        update trial_onboarding_link_students set trial_entitlement_grant_status = 'pending' where id = v_link_student_id;
        begin
          v_grant_id := grant_trial_entitlement_for_student(v_child_auth_user_id);
          update trial_onboarding_link_students set
            trial_entitlement_grant_id = v_grant_id,
            trial_entitlement_grant_status = 'granted',
            trial_entitlement_grant_error = null
          where id = v_link_student_id;
        exception when others then
          update trial_onboarding_link_students set
            trial_entitlement_grant_status = 'failed',
            trial_entitlement_grant_error = sqlerrm
          where id = v_link_student_id;
        end;
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
$function$;

revoke execute on function public.finalize_trial_onboarding_students(uuid, boolean, uuid, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.finalize_trial_onboarding_students(uuid, boolean, uuid, text, jsonb, uuid) to service_role;
