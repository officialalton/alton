-- 2026-09-23(실사용 UAT 발견) — finalize_trial_onboarding_students/
-- retry_trial_onboarding_student가 "이미 status='created'인 학생"을 만나면
-- 곧바로 continue/return 해버려서, 20261473000000에서 추가한 consultant_id ->
-- consultant_assignments 이어붙이기 코드에 도달하지 못했다. 실제로 "테스트
-- 자녀 16-1" 건에서 재현: link_student.consultant_id는 채워졌고 계정도
-- 만들어졌는데(status='created') consultant_assignments 행이 없어 컨설턴트
-- "담당 학생" 화면에 안 보였다. 두 함수의 already-created 분기에 동일한
-- 이어붙이기(멱등, on conflict do nothing)를 추가한다. 그 외 로직은 동일.

create or replace function public.finalize_trial_onboarding_students(
  p_link_id uuid,
  p_new_guardian boolean,
  p_guardian_auth_user_id uuid,
  p_guardian_name text,
  p_students jsonb
) returns table (household_id uuid, guardian_id uuid, created_count int, failed_count int)
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
  v_grant_id uuid;
begin
  select * into v_row from trial_onboarding_links where id = p_link_id for update;
  if not found then
    raise exception '존재하지 않는 온보딩 링크입니다.';
  end if;
  if v_row.status not in ('pending', 'redeemed') then
    raise exception 'pending 또는 redeemed 상태의 온보딩 링크만 처리할 수 있습니다(현재: %).', v_row.status;
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
  set status = 'redeemed', redeemed_at = coalesce(redeemed_at, now()), redeemed_auth_user_id = p_guardian_auth_user_id
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
$$;
revoke execute on function public.finalize_trial_onboarding_students(uuid, boolean, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.finalize_trial_onboarding_students(uuid, boolean, uuid, text, jsonb) to service_role;

comment on function public.finalize_trial_onboarding_students(uuid, boolean, uuid, text, jsonb) is
  '2026-09-23(결함 수정) — 학생이 이미 status=created인 채로 들어와도(멀티자녀
  부분 재시도 등) consultant_assignments 이어붙이기를 빠뜨리지 않는다(멱등).
  그 외 동작은 R15-A 버전과 동일.';

create or replace function public.retry_trial_onboarding_student(
  p_link_id uuid,
  p_link_student_id uuid,
  p_child_auth_user_id uuid,
  p_stage text default 'account'
) returns table (child_id uuid, status text)
language plpgsql security definer set search_path = public as $$
declare
  v_row trial_onboarding_links%rowtype;
  v_student trial_onboarding_link_students%rowtype;
  v_household_id uuid;
  v_grant_id uuid;
begin
  if p_stage not in ('account', 'invite') then
    raise exception 'p_stage는 account 또는 invite여야 합니다.';
  end if;

  select * into v_row from trial_onboarding_links where id = p_link_id for update;
  if not found then
    raise exception '존재하지 않는 온보딩 링크입니다.';
  end if;
  if v_row.status <> 'redeemed' or v_row.redeemed_auth_user_id is null then
    raise exception '아직 보호자 계정이 확정되지 않은 링크입니다 — 먼저 보호자 확인 절차를 완료해야 합니다.';
  end if;

  select id into v_household_id from households where primary_guardian_id = v_row.redeemed_auth_user_id
    order by created_at asc limit 1;
  if v_household_id is null then
    raise exception '연결된 household를 찾을 수 없습니다 — 관리자에게 문의하세요.';
  end if;

  select * into v_student from trial_onboarding_link_students where id = p_link_student_id and link_id = p_link_id for update;
  if not found then
    raise exception '존재하지 않는 학생 항목입니다.';
  end if;

  if p_stage = 'invite' then
    if v_student.status <> 'created' or v_student.child_auth_user_id is null then
      raise exception '학생 계정이 아직 생성되지 않았습니다 — 계정 생성 재시도가 먼저 필요합니다.';
    end if;
    update trial_onboarding_link_students
    set invite_retry_count = invite_retry_count + 1, updated_at = now()
    where id = p_link_student_id;
    return query select v_student.child_auth_user_id, v_student.status;
    return;
  end if;

  if v_student.status = 'created' then
    if v_row.consultation_id is null and v_student.consultant_id is not null and v_student.child_auth_user_id is not null
       and not exists (select 1 from consultant_assignments where student_id = v_student.child_auth_user_id) then
      insert into consultant_assignments (consultant_id, student_id, assigned_by, assigned_at)
      values (v_student.consultant_id, v_student.child_auth_user_id, v_student.consultant_assigned_by, now())
      on conflict (student_id) do nothing;
      insert into consultant_assignment_history (student_id, prior_consultant_id, new_consultant_id, actor_id, reason)
      values (v_student.child_auth_user_id, null, v_student.consultant_id, v_student.consultant_assigned_by, '가입 대기 단계 담당자 이어받음(계정 이미 생성됨 — 결함 수정 백필)');
    end if;
    return query select v_student.child_auth_user_id, v_student.status;
    return;
  end if;

  begin
    insert into profiles (id, role, name) values (p_child_auth_user_id, 'student', v_student.student_name)
      on conflict (id) do nothing;
    insert into students (id, grade, status) values (p_child_auth_user_id, v_student.student_grade, 'pending')
      on conflict (id) do nothing;
    insert into household_members (household_id, profile_id, role, is_primary)
      values (v_household_id, p_child_auth_user_id, 'child', false)
      on conflict on constraint household_members_household_id_profile_id_key do nothing;

    update trial_onboarding_link_students
    set status = 'created', child_auth_user_id = p_child_auth_user_id, error = null, updated_at = now()
    where id = p_link_student_id;

    if v_row.consultation_id is not null then
      perform public._create_student_kanban_card(v_row.consultation_id, p_link_student_id, p_child_auth_user_id, v_household_id);
    else
      if v_student.consultant_id is not null then
        insert into consultant_assignments (consultant_id, student_id, assigned_by, assigned_at)
        values (v_student.consultant_id, p_child_auth_user_id, v_student.consultant_assigned_by, now())
        on conflict (student_id) do nothing;
        insert into consultant_assignment_history (student_id, prior_consultant_id, new_consultant_id, actor_id, reason)
        values (p_child_auth_user_id, null, v_student.consultant_id, v_student.consultant_assigned_by, '가입 대기 단계 담당자 이어받음(계정 생성 재시도)');
      end if;

      update trial_onboarding_link_students set trial_entitlement_grant_status = 'pending' where id = p_link_student_id;
      begin
        v_grant_id := grant_trial_entitlement_for_student(p_child_auth_user_id);
        update trial_onboarding_link_students set
          trial_entitlement_grant_id = v_grant_id,
          trial_entitlement_grant_status = 'granted',
          trial_entitlement_grant_error = null
        where id = p_link_student_id;
      exception when others then
        update trial_onboarding_link_students set
          trial_entitlement_grant_status = 'failed',
          trial_entitlement_grant_error = sqlerrm
        where id = p_link_student_id;
      end;
    end if;

    return query select p_child_auth_user_id, 'created'::text;
  exception when others then
    update trial_onboarding_link_students
    set status = 'failed', error = sqlerrm, updated_at = now()
    where id = p_link_student_id;
    raise;
  end;
end;
$$;
revoke execute on function public.retry_trial_onboarding_student(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.retry_trial_onboarding_student(uuid, uuid, uuid, text) to service_role;

comment on function public.retry_trial_onboarding_student(uuid, uuid, uuid, text) is
  '2026-09-23(결함 수정) — 이미 status=created로 반환하는 분기에서도
  consultant_assignments 이어붙이기를 빠뜨리지 않는다(멱등). 그 외 동작은
  R15-A 버전과 동일.';

-- 지금 이미 만들어진 기존 데이터(테스트 자녀 16-1 등)도 즉시 백필한다.
insert into consultant_assignments (consultant_id, student_id, assigned_by, assigned_at)
select ls.consultant_id, ls.child_auth_user_id, ls.consultant_assigned_by, ls.consultant_assigned_at
from trial_onboarding_link_students ls
join trial_onboarding_links l on l.id = ls.link_id
where ls.status = 'created'
  and ls.child_auth_user_id is not null
  and ls.consultant_id is not null
  and l.consultation_id is null
on conflict (student_id) do nothing;

insert into consultant_assignment_history (student_id, prior_consultant_id, new_consultant_id, actor_id, reason)
select ls.child_auth_user_id, null, ls.consultant_id, ls.consultant_assigned_by,
  '가입 대기 단계 담당자 이어받음(기존 데이터 백필 — 2026-09-23 결함 수정)'
from trial_onboarding_link_students ls
join trial_onboarding_links l on l.id = ls.link_id
join consultant_assignments ca on ca.student_id = ls.child_auth_user_id and ca.consultant_id = ls.consultant_id
where ls.status = 'created'
  and ls.child_auth_user_id is not null
  and ls.consultant_id is not null
  and l.consultation_id is null
  and not exists (
    select 1 from consultant_assignment_history h
    where h.student_id = ls.child_auth_user_id and h.new_consultant_id = ls.consultant_id
  );
