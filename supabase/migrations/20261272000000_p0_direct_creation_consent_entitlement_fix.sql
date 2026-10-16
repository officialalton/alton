-- P0(2026-09-10, 제품 오너 지적) — 직접 계정 생성(지인/추천, consultation_id is
-- null) 경로에서 발견된 3중 결함 중 DB 레이어 수정.
--
-- 결함 1(별도 코드 수정, lib/auth.ts): 학생 생년월일 입력 전에
-- current_account_access_allowed()가 fail-closed(미성년으로 간주)로 평가돼
-- /consent-pending에 갇히는 순환 데드락. is_under_13()/게이트 자체는 그대로 두고
-- 게이트 순서만 애플리케이션 레이어에서 바꾼다 — 이 마이그레이션은 관여하지 않음.
--
-- 결함 2(이 마이그레이션): 직접생성 경로가 학생 계정 생성 "직후" 곧바로
-- grant_trial_entitlement_for_student()를 시도한다 — 이 시점엔 필연적으로
-- trial_smart_notes_consents가 없으므로 항상 실패해 trial_entitlement_grant_status
-- ='failed'로 조용히 남고, 학생 포털에 체험수업권이 영원히 보이지 않는다(관리자가
-- 수동 재처리 버튼을 눌러야만 해소됨). 정책(2026-09-10 확정): 지급 시도는 "체험
-- Smart Notes 동의가 실제로 제출된 시점"으로 옮긴다 — record_trial_smart_notes_consent()가
-- 상담 경로(consultations.outcome='trial_recommended')에서 이미 하던 것과 정확히
-- 동일한 패턴을 직접생성 경로 학생에도 추가한다. 계정 생성 시점에는 grant를 아예
-- 시도하지 않고 상태를 'awaiting_consent'로만 남긴다(관리자 화면에 "동의 대기"로
-- 구분 표시하기 위한 새 상태값 — 기존 재처리 버튼/RPC는 변경 없이 그대로 쓸 수 있다).
--
-- 결함 3(별도 코드 수정, app/student·app/parent booking-actions.ts +
-- LessonBookingTab.tsx): 예약 확정 실패가 프로덕션 빌드에서 Next.js digest로
-- 가려져 "React error #441"로만 노출된다 — 이 마이그레이션은 관여하지 않음.

-- 원본 컬럼 정의(20261214000000)의 인라인 check 제약은 postgres 63자 식별자
-- 한도 때문에 trial_onboarding_link_studen_trial_entitlement_grant_stat_check로
-- 잘려서 생성됐다 — 그 실제 이름으로 드롭해야 한다(원하는 이름으로 drop constraint
-- if exists를 시도하면 이름 불일치로 조용히 no-op되어 새 값이 기존 제약을
-- 위반하게 된다).
alter table trial_onboarding_link_students
  drop constraint if exists trial_onboarding_link_studen_trial_entitlement_grant_stat_check;
alter table trial_onboarding_link_students
  add constraint trial_onboarding_link_students_grant_status_check
  check (trial_entitlement_grant_status in ('not_applicable', 'awaiting_consent', 'pending', 'granted', 'failed'));

comment on column trial_onboarding_link_students.trial_entitlement_grant_status is
  '2026-09-06: 지인/추천 직접생성 경로(consultation_id is null) 전용. 2026-09-10 정책 변경: 계정 생성 직후에는 더 이상 지급을 시도하지 않고 awaiting_consent로만 남긴다 — 실제 지급 시도는 record_trial_smart_notes_consent()가 체험 Smart Notes 동의 제출 시점에 수행한다. 상담 경로 학생은 consultations.trial_entitlement_grant_status를 대신 쓰므로 항상 not_applicable.';

-- =========================================================================
-- finalize_trial_onboarding_students — 직접생성 분기에서 즉시 grant 시도를
-- 제거하고 'awaiting_consent'만 기록한다. 그 외 로직 변경 없음.
-- =========================================================================
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
      -- 2026-09-07(20261216000000): 관리자가 잘못된 이메일 등으로 취소한 학생 —
      -- 계정 생성/체험수업권 지급 모두 건너뛴다.
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
        -- 2026-09-10: 계정 생성 직후에는 지급을 시도하지 않는다(체험 Smart Notes
        -- 동의가 아직 없어 항상 실패했었다) — 동의 대기 상태로만 남기고,
        -- 실제 지급은 record_trial_smart_notes_consent()가 동의 제출 시점에 시도한다.
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
revoke execute on function public.finalize_trial_onboarding_students(uuid, boolean, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.finalize_trial_onboarding_students(uuid, boolean, uuid, text, jsonb) to service_role;

comment on function public.finalize_trial_onboarding_students(uuid, boolean, uuid, text, jsonb) is
  '2026-09-10: consultation_id가 null인 직접생성 경로는 계정 생성 직후 체험수업권 지급을 시도하지 않고 awaiting_consent로만 남긴다(과거엔 즉시 시도 → 필연적 실패). 실제 지급은 record_trial_smart_notes_consent()가 동의 제출 시점에 수행한다.';

-- =========================================================================
-- retry_trial_onboarding_student — 계정 생성 재시도 성공 시에도 동일하게
-- 즉시 grant 시도를 제거한다.
-- =========================================================================
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
      update trial_onboarding_link_students
      set trial_entitlement_grant_status = 'awaiting_consent'
      where id = p_link_student_id;
    end if;

    insert into trial_onboarding_link_events (link_id, event_type, actor_id, detail)
    values (p_link_id, 'finalized', v_row.redeemed_auth_user_id,
      jsonb_build_object('household_id', v_household_id, 'child_id', p_child_auth_user_id, 'link_student_id', p_link_student_id, 'retry', true));

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
  '2026-09-10: consultation_id가 null인 링크의 계정 재시도 성공 시에도 즉시 지급을 시도하지 않고 awaiting_consent로만 남긴다. 그 외 동작(멱등, invite 단계) 변경 없음.';

-- =========================================================================
-- record_trial_smart_notes_consent — 상담 경로(consultations.outcome=
-- 'trial_recommended')에서 이미 하던 "동의 제출 시 즉시 지급 시도" 패턴을
-- 직접생성 경로(trial_onboarding_link_students, consultation_id is null)
-- 학생에도 그대로 추가한다. 두 경로는 상호 배타적이므로(학생 1명이 상담·직접생성
-- 양쪽에 동시에 걸릴 수 없음 — link_students.child_auth_user_id는 직접생성 경로
-- 전용 컬럼) 분기 순서와 무관하게 안전하다.
-- =========================================================================
create or replace function public.record_trial_smart_notes_consent(
  p_child_id uuid,
  p_policy_version text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_guardian_id uuid := auth.uid();
  v_existing_id uuid;
  v_new_id uuid;
  v_consultation_id uuid;
  v_link_student_id uuid;
  v_grant_id uuid;
begin
  if v_guardian_id is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if not exists (
    select 1 from household_members hm
    join household_members hc on hc.household_id = hm.household_id
    where hm.profile_id = v_guardian_id and hm.role = 'guardian'
      and hc.profile_id = p_child_id and hc.role = 'child'
  ) then
    raise exception '본인 가족의 자녀에 대해서만 동의를 기록할 수 있습니다.';
  end if;

  select id into v_existing_id from trial_smart_notes_consents where child_id = p_child_id;
  if v_existing_id is not null then
    v_new_id := v_existing_id; -- 멱등: 이미 동의했으면 그대로 반환(재확인 요구 안 함).
  else
    insert into trial_smart_notes_consents (child_id, guardian_id, policy_version, confirmed_ip)
    values (
      p_child_id, v_guardian_id, p_policy_version,
      nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-forwarded-for'
    )
    returning id into v_new_id;
  end if;

  -- 이 동의로 지급 가능해진 체험수업권을 즉시 시도한다. 실패해도 동의 기록
  -- 자체는 되돌리지 않는다 — 관리자 화면의 "지급 재시도" 버튼이 여전히
  -- fallback으로 남아있다.
  select id into v_consultation_id
  from consultations
  where child_id = p_child_id and outcome = 'trial_recommended'
    and coalesce(trial_entitlement_grant_status, 'not_applicable') != 'granted'
  order by created_at desc
  limit 1;

  if v_consultation_id is not null then
    update consultations set trial_entitlement_grant_status = 'pending' where id = v_consultation_id;
    begin
      v_grant_id := grant_trial_entitlement_for_consultation(v_consultation_id);
      update consultations set
        trial_entitlement_grant_id = v_grant_id,
        trial_entitlement_grant_status = 'granted',
        trial_entitlement_grant_error = null
      where id = v_consultation_id;
    exception when others then
      update consultations set
        trial_entitlement_grant_status = 'failed',
        trial_entitlement_grant_error = sqlerrm
      where id = v_consultation_id;
    end;
  else
    -- 2026-09-10: 상담이 없으면(직접생성 경로) trial_onboarding_link_students에서
    -- 이 학생을 찾아 동일한 pending→granted/failed 기록 패턴으로 지급을 시도한다.
    select id into v_link_student_id
    from trial_onboarding_link_students
    where child_auth_user_id = p_child_id and status = 'created'
      and coalesce(trial_entitlement_grant_status, 'not_applicable') != 'granted'
    order by created_at desc
    limit 1;

    if v_link_student_id is not null then
      update trial_onboarding_link_students set trial_entitlement_grant_status = 'pending' where id = v_link_student_id;
      begin
        v_grant_id := grant_trial_entitlement_for_student(p_child_id);
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
  end if;

  return v_new_id;
end;
$$;
revoke execute on function public.record_trial_smart_notes_consent(uuid, text) from public, anon;
grant execute on function public.record_trial_smart_notes_consent(uuid, text) to authenticated, service_role;

comment on function public.record_trial_smart_notes_consent(uuid, text) is
  '2026-09-10: 상담 경로뿐 아니라 직접생성 경로(trial_onboarding_link_students, consultation_id is null) 학생도 동의 제출 시점에 grant_trial_entitlement_for_student()를 시도하도록 확장. 계정 생성 시점 즉시 지급 시도는 제거됨(별도 함수 수정).';
