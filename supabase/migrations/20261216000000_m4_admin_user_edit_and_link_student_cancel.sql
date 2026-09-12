-- M4 UAT 후속(2026-09-07) — 3가지:
-- 1. 관리자가 보호자/학생 프로필(이름/이메일 등)을 수기로 수정할 수 있는 최소
--    감사 컬럼(admin_edited_by/admin_edited_at) — 실제 UPDATE는
--    app/admin/user-edit-actions.ts가 service-role 클라이언트로 수행한다
--    (profiles.name은 RLS로 관리자 직접 UPDATE가 막혀있지 않으므로 새 RPC 없이
--    admin client로 충분 — 다만 "누가 언제 고쳤는지"를 남기기 위한 컬럼만 추가).
-- 2. 지인/추천(consultation_id가 null) 온보딩 링크에 잘못된 이메일로 등록된
--    학생을 "이 링크에서 제외"할 수 있도록 trial_onboarding_link_students.status에
--    'cancelled'를 추가한다(additive — 기존 pending/created/failed 값과 로직은
--    그대로, cancelled만 finalize에서 건너뛴다).

alter table profiles add column admin_edited_by uuid references profiles (id);
alter table profiles add column admin_edited_at timestamptz;
comment on column profiles.admin_edited_by is '관리자가 이 프로필(이름 등)을 수기로 마지막으로 수정한 관리자 profile id. app/admin/user-edit-actions.ts만 쓴다.';
comment on column profiles.admin_edited_at is '위 admin_edited_by가 마지막으로 수정한 시각.';

-- status check 제약을 cancelled 허용하도록 재생성(컬럼 자체는 그대로, 값만 추가).
alter table trial_onboarding_link_students drop constraint trial_onboarding_link_students_status_check;
alter table trial_onboarding_link_students add constraint trial_onboarding_link_students_status_check
  check (status in ('pending', 'created', 'failed', 'cancelled'));

-- trial_onboarding_link_events.event_type도 'student_cancelled'를 허용해야
-- cancel_trial_onboarding_link_student()의 감사 로그 insert가 통과한다
-- (20261018000000의 제약을 그대로 확장 — 값만 추가).
alter table trial_onboarding_link_events drop constraint trial_onboarding_link_events_event_type_check;
alter table trial_onboarding_link_events add constraint trial_onboarding_link_events_event_type_check
  check (event_type in (
    'created', 'redeemed', 'finalized', 'linked_existing_guardian', 'expired', 'revoked', 'conflict_manual_review',
    'notice_sent', 'notice_failed', 'login_email_change_requested', 'login_email_change_confirmed',
    'student_cancelled'
  ));

-- ---------------------------------------------------------------------------
-- cancel_trial_onboarding_link_student — 학생 1명을 이 온보딩 링크에서 제외한다.
-- 이미 계정이 만들어진(created) 학생은 취소 대상이 아니다(계정 삭제는 이
-- 함수의 책임이 아님 — 관리자가 별도로 계정 상태를 변경해야 한다).
-- ---------------------------------------------------------------------------
create or replace function public.cancel_trial_onboarding_link_student(
  p_link_student_id uuid,
  p_admin_id uuid,
  p_reason text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_link_id uuid;
begin
  select status, link_id into v_status, v_link_id
  from trial_onboarding_link_students where id = p_link_student_id for update;
  if not found then
    raise exception '존재하지 않는 학생 항목입니다.';
  end if;
  if v_status = 'created' then
    raise exception '이미 계정이 생성된 학생은 취소할 수 없습니다.';
  end if;
  if v_status = 'cancelled' then
    return; -- 이미 취소됨 — 멱등하게 통과
  end if;

  update trial_onboarding_link_students
  set status = 'cancelled', updated_at = now()
  where id = p_link_student_id;

  insert into trial_onboarding_link_events (link_id, event_type, actor_id, detail)
  values (v_link_id, 'student_cancelled', p_admin_id,
    jsonb_build_object('link_student_id', p_link_student_id, 'reason', p_reason));
end;
$$;
revoke execute on function public.cancel_trial_onboarding_link_student(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.cancel_trial_onboarding_link_student(uuid, uuid, text) to service_role;

comment on function public.cancel_trial_onboarding_link_student is
  '2026-09-07: 지인/추천 등 온보딩 링크에서 학생 1명을 취소(계정 생성 대상에서 제외)한다. finalize_trial_onboarding_students()는 cancelled 학생을 건너뛴다(아래 재정의).';

-- ---------------------------------------------------------------------------
-- finalize_trial_onboarding_students 재정의 — cancelled 학생은 건너뛴다(계정
-- 생성/체험수업권 지급 대상에서 제외). 그 외 로직은 20261214000000의 버전과
-- 완전히 동일 — 최상단 상태 체크 한 줄만 추가.
-- ---------------------------------------------------------------------------
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
      continue;
    end if;
    if v_student.status = 'cancelled' then
      -- 2026-09-07: 관리자가 잘못된 이메일 등으로 취소한 학생 — 계정 생성/
      -- 체험수업권 지급 모두 건너뛴다.
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

comment on function public.finalize_trial_onboarding_students is
  '2026-09-07: cancelled 상태 학생은 계정 생성/체험수업권 지급을 건너뛴다(관리자가 잘못된 이메일로 등록된 학생을 취소한 경우). 그 외 동작은 20261214000000 버전과 동일.';
