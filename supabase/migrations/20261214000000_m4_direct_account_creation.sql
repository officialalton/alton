-- M4 마지막 항목(2026-09-06) — 지인/추천: 상담 없이 바로 보호자+학생 계정 생성.
--
-- 배경: 관리자가 상담 칸반과 완전히 무관하게, 지인/추천으로 들어온 케이스에
-- 바로 보호자+학생(1~N명) 계정을 만들 수 있어야 한다. 기존 복수자녀 온보딩
-- 경로(trial_onboarding_links + trial_onboarding_link_students +
-- create_trial_onboarding_link_multi/finalize_trial_onboarding_students/
-- redeem_trial_onboarding_link + lib/trial-onboarding-finalize.ts의 실제 Auth
-- 계정 생성·비밀번호 설정 링크 발송 플로우)는 이미 "가족당 링크 1개, 학생
-- 1~N명, 형제자매 개별 실패 격리, 멱등 재시도"를 전부 구현하고 있고,
-- consultation_id에 의존하는 부분은 (a) trial_intent_confirmed_at 검증
-- (b) prospect_contacts 갱신 (c) _create_student_kanban_card() 호출 세 곳뿐이다
-- (redeem_trial_onboarding_link/createGuardianAndStudentThenRedirect는
-- consultation_id를 전혀 참조하지 않음 — 코드 확인 완료). 새 보드나 새 온보딩
-- 화면 플로우를 처음부터 만들 필요 없이, 이 세 곳만 "consultation_id가
-- null이면 건너뛴다"로 분기하면 된다(additive).
--
-- 정책 재확인: 이 경로로 만든 계정은 상담 칸반에 카드를 만들지 않는다
-- (_create_student_kanban_card 호출 자체를 하지 않음 — 원천적으로 무관).
-- 체험수업권은 정상적으로 체험 수업을 들을 수 있어야 하므로 이 경로에서도
-- 동일하게 60분 체험수업권 1장을 지급한다 — 다만 지급 게이트(학생별 Smart
-- Notes 동의, 관리자 생년월일 확인)는 상담 경로와 동일하게 그대로 유지한다
-- (계정 생성 시점에는 대개 게이트 미충족 상태라 실패로 남고, 이후 게이트가
-- 충족되면 관리자가 재처리할 수 있어야 한다 — 아래 3번 함수 + 재처리 액션).

-- =========================================================================
-- 1. trial_onboarding_links.consultation_id/prospect_contact_id — nullable로
--    전환. 상담 경로는 계속 not null로 채워 넣으므로(create_trial_onboarding_link_multi
--    변경 없음) 기존 동작에 영향 없음. 직접생성 경로만 null을 쓴다.
--    trial_onboarding_links_pending_unique(consultation_id) where status='pending'는
--    partial unique index라 NULL은 서로 다른 값으로 취급돼(postgres 표준 동작)
--    직접생성 링크가 여러 개 pending이어도 충돌하지 않는다.
-- =========================================================================
alter table trial_onboarding_links alter column consultation_id drop not null;
alter table trial_onboarding_links alter column prospect_contact_id drop not null;

comment on column trial_onboarding_links.consultation_id is
  '2026-09-06: 상담에서 발급된 온보딩 링크는 원 상담 id. 지인/추천 직접생성 경로(create_direct_onboarding_link_multi)로 만든 링크는 null — 상담 칸반과 무관함을 의미한다.';

-- =========================================================================
-- 2. trial_onboarding_link_students — 직접생성 경로 전용 체험수업권 지급 추적
--    컬럼(consultations.trial_entitlement_grant_status와 동일한 상태 머신).
--    상담 경로는 계속 consultations 쪽 컬럼을 쓰므로(_create_student_kanban_card)
--    이 컬럼은 항상 'not_applicable'로 남는다 — 직접생성 경로에서만 갱신된다.
-- =========================================================================
alter table trial_onboarding_link_students
  add column trial_entitlement_grant_status text not null default 'not_applicable'
    check (trial_entitlement_grant_status in ('not_applicable', 'pending', 'granted', 'failed')),
  add column trial_entitlement_grant_id uuid,
  add column trial_entitlement_grant_error text;

comment on column trial_onboarding_link_students.trial_entitlement_grant_status is
  '2026-09-06: 지인/추천 직접생성 경로(consultation_id is null) 전용 — 학생 계정 생성 성공 직후 grant_trial_entitlement_for_student() 시도 결과. 상담 경로 학생은 consultations.trial_entitlement_grant_status를 대신 쓰므로 항상 not_applicable.';

-- =========================================================================
-- 3. grant_trial_entitlement_for_student — grant_trial_entitlement_for_consultation()과
--    동일한 지급 로직(동의 게이트 + 생년월일 확인 게이트 + 학생당 1회)을
--    consultation 없이 학생 id만으로 수행한다. entitlement_grants.source_consultation_id는
--    null로 남는다(이미 nullable — 20261012000000). 학생 단위 dedup(child_id +
--    trial_lesson_grant 존재 확인)은 상담 경로에서도 이미 2차 방어로 쓰던 것과
--    동일한 조건이라 이 경로에서도 그대로 안전하다.
-- =========================================================================
create or replace function public.grant_trial_entitlement_for_student(
  p_child_id uuid
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_existing_grant_id uuid;
  v_new_grant_id uuid;
  v_trial_product_id uuid;
  v_expires_at timestamptz;
begin
  if not exists (select 1 from profiles where id = p_child_id and role = 'student') then
    raise exception '학생 계정을 찾을 수 없습니다: %', p_child_id;
  end if;

  if not exists (select 1 from trial_smart_notes_consents where child_id = p_child_id) then
    raise exception '체험 Smart Notes 동의가 없어 체험수업권을 지급할 수 없습니다(학생 id: %).', p_child_id;
  end if;

  if not exists (
    select 1 from profiles where id = p_child_id and date_of_birth_verified_at is not null
  ) then
    raise exception '관리자의 생년월일 확인이 완료되지 않아 체험수업권을 지급할 수 없습니다(학생 id: %).', p_child_id;
  end if;

  select eg.id into v_existing_grant_id
  from entitlement_grants eg
  join entitlement_products ep on ep.id = eg.entitlement_product_id
  where eg.child_id = p_child_id and ep.code = 'trial_lesson_grant'
  limit 1;
  if v_existing_grant_id is not null then
    return v_existing_grant_id;
  end if;

  select id into v_trial_product_id from entitlement_products where code = 'trial_lesson_grant';
  if v_trial_product_id is null then
    raise exception '체험수업권 상품(trial_lesson_grant)이 존재하지 않습니다 — 마이그레이션 순서 문제.';
  end if;

  v_expires_at := now() + interval '90 days';

  insert into entitlement_grants (
    child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at,
    is_paid, source_consultation_id
  ) values (
    p_child_id, v_trial_product_id, null, 1, v_expires_at, false, null
  )
  returning id into v_new_grant_id;

  insert into entitlement_ledger (grant_id, event_type, amount, business_event_id)
  values (v_new_grant_id, 'grant', 1, 'trial_grant_direct:' || p_child_id::text)
  on conflict do nothing;

  return v_new_grant_id;
end;
$$;
revoke execute on function public.grant_trial_entitlement_for_student(uuid) from public, anon, authenticated;
grant execute on function public.grant_trial_entitlement_for_student(uuid) to service_role;

comment on function public.grant_trial_entitlement_for_student(uuid) is
  '2026-09-06: grant_trial_entitlement_for_consultation()의 지인/추천 직접생성 경로용 — consultation 없이 학생 id만으로 동일한 게이트(Smart Notes 동의, 생년월일 확인)를 적용해 체험수업권 1장을 지급한다.';

-- =========================================================================
-- 4. create_direct_onboarding_link_multi — 상담 없이 보호자+학생 1~N명 온보딩
--    링크를 발급한다. create_trial_onboarding_link_multi와 거의 동일하지만
--    consultation/prospect_contact 조회·trial_intent_confirmed 검증이 없다.
-- =========================================================================
create or replace function public.create_direct_onboarding_link_multi(
  p_guardian_email text,
  p_guardian_name text,
  p_students jsonb
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
  if not is_admin() then
    raise exception '관리자만 온보딩 링크를 발급할 수 있습니다.';
  end if;
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
    v_first_name, v_first_email, v_first_grade, v_token_hash, now() + interval '72 hours', auth.uid()
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
  values (v_id, 'created', auth.uid(), jsonb_build_object('guardian_email', p_guardian_email, 'student_count', v_count, 'direct', true));

  return query select v_id, v_raw_token;
end;
$$;
revoke execute on function public.create_direct_onboarding_link_multi(text, text, jsonb) from public, anon;
grant execute on function public.create_direct_onboarding_link_multi(text, text, jsonb) to authenticated, service_role;

comment on function public.create_direct_onboarding_link_multi(text, text, jsonb) is
  '2026-09-06: 지인/추천 — 상담(consultation)·잠재고객(prospect_contact) 연결 없이 보호자+학생 1~N명 온보딩 링크를 발급한다. 이후 redeem/finalize 플로우는 상담 경로와 완전히 동일(consultation_id가 null일 뿐).';

-- =========================================================================
-- 5. finalize_trial_onboarding_students — consultation_id가 null이면
--    (a) prospect_contacts 갱신을 건너뛰고 (b) _create_student_kanban_card() 대신
--    grant_trial_entitlement_for_student()를 직접 시도해 결과를
--    trial_onboarding_link_students에 pending→granted/failed로 기록한다.
--    그 외 로직(멱등, 학생별 savepoint 격리)은 기존과 완전히 동일.
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
        -- 지인/추천 직접생성 경로 — 상담 칸반과 완전히 무관. 카드는 만들지
        -- 않고, 체험수업권만 동일하게 즉시 지급 시도(게이트 미충족이면
        -- failed로 남아 관리자 재처리 대상이 된다).
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
  '2026-09-06(지인/추천 직접생성 경로 추가): consultation_id가 null인 링크(create_direct_onboarding_link_multi)는 prospect_contacts 갱신·칸반 카드 생성을 건너뛰고 grant_trial_entitlement_for_student()로 체험수업권만 직접 지급한다. consultation_id가 있는 기존 경로는 동작 변경 없음.';

-- =========================================================================
-- 6. retry_trial_onboarding_student — 'account' 재시도 성공 시에도 동일하게
--    consultation_id null 분기 반영(직접생성 경로 학생의 계정 생성 재시도).
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
  '2026-09-06(지인/추천 직접생성 경로 추가): consultation_id가 null인 링크의 계정 재시도 성공 시에도 칸반 카드 대신 grant_trial_entitlement_for_student()로 체험수업권을 직접 지급한다. 그 외 동작(멱등, invite 단계) 변경 없음.';

-- =========================================================================
-- 7. retry_direct_onboarding_student_entitlement — 직접생성 경로에서 게이트
--    미충족으로 체험수업권 지급이 실패(status='failed')한 학생을, 게이트가
--    이후에 충족됐을 때(Smart Notes 동의, 생년월일 확인) 관리자가 재처리할
--    수 있는 함수. record_consultation_outcome 계열의 기존 "재처리" 패턴과
--    동일한 모양.
-- =========================================================================
create or replace function public.retry_direct_onboarding_student_entitlement(p_link_student_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_student trial_onboarding_link_students%rowtype;
  v_grant_id uuid;
begin
  if not is_admin() then
    raise exception '관리자만 재처리를 할 수 있습니다.';
  end if;
  select * into v_student from trial_onboarding_link_students where id = p_link_student_id for update;
  if not found then
    raise exception '존재하지 않는 학생 항목입니다.';
  end if;
  if v_student.status <> 'created' or v_student.child_auth_user_id is null then
    raise exception '아직 계정이 생성되지 않은 학생입니다.';
  end if;

  update trial_onboarding_link_students set trial_entitlement_grant_status = 'pending' where id = p_link_student_id;
  begin
    v_grant_id := grant_trial_entitlement_for_student(v_student.child_auth_user_id);
    update trial_onboarding_link_students set
      trial_entitlement_grant_id = v_grant_id,
      trial_entitlement_grant_status = 'granted',
      trial_entitlement_grant_error = null
    where id = p_link_student_id;
    return v_grant_id;
  exception when others then
    update trial_onboarding_link_students set
      trial_entitlement_grant_status = 'failed',
      trial_entitlement_grant_error = sqlerrm
    where id = p_link_student_id;
    raise;
  end;
end;
$$;
revoke execute on function public.retry_direct_onboarding_student_entitlement(uuid) from public, anon;
grant execute on function public.retry_direct_onboarding_student_entitlement(uuid) to authenticated, service_role;

comment on function public.retry_direct_onboarding_student_entitlement(uuid) is
  '2026-09-06: 지인/추천 직접생성 경로에서 체험수업권 지급이 게이트 미충족(Smart Notes 동의/생년월일 확인 없음)으로 실패한 학생을 관리자가 재처리한다.';
