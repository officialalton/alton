-- R15-A(1) — 관리자 생성 계정("Onboarding > 계정 생성", 지인/추천 직접생성
-- 경로 = create_direct_onboarding_link_multi)에 담당 컨설턴트 배정을 붙인다.
--
-- 문제: 이 경로로 만든 학생은 담당자 정보가 전혀 없다가, 계정 생성 후 관리자가
-- Consultants 화면에서 학생 이메일을 다시 검색해 수동 배정해야 했다(가입 대기
-- 상태에는 담당자 개념 자체가 없었음). 이번 마이그레이션은:
--   (a) trial_onboarding_link_students에 담당 컨설턴트 컬럼을 추가하고(가입 전에도
--       담당자를 알 수 있게), 발급 시점부터 필수로 만든다.
--   (b) consultant_assignments.student_id에 유니크 제약을 걸어 "학생 한 명 = 담당
--       컨설턴트 한 명" 불변식을 DB 레벨에서 보장한다(지금까지는 PK가
--       (consultant_id, student_id)라 같은 학생에게 컨설턴트 여러 명이 동시에 붙는
--       걸 막지 못했다).
--   (c) 배정 변경 이력을 남기는 공용 감사 테이블(consultant_assignment_history)을
--       추가하고, 배정/재배정/해제를 전부 이 테이블에 기록하는 단일 RPC들로
--       옮긴다 — 기존 assignStudentToConsultantAction()의 raw upsert는 (b)의 유니크
--       제약과 충돌하므로(같은 학생을 다른 컨설턴트로 재배정하면 PK 기준 upsert가
--       새 행을 insert 시도해 student_id 유니크 위반 에러) 반드시 이 RPC로 대체해야
--       한다.
--   (d) finalize_trial_onboarding_students/retry_trial_onboarding_student(직접생성
--       분기)가 학생 계정을 실제로 만들 때 trial_onboarding_link_students.consultant_id를
--       consultant_assignments로 그대로 이어 붙인다 — "이메일 재검색 수동 배정" 단계를
--       없앤다.

-- =========================================================================
-- 1. trial_onboarding_link_students — 담당 컨설턴트 컬럼.
-- =========================================================================
alter table trial_onboarding_link_students
  add column consultant_id uuid references profiles (id),
  add column consultant_assigned_by uuid references profiles (id),
  add column consultant_assigned_at timestamptz;

comment on column trial_onboarding_link_students.consultant_id is
  '2026-09-23(R15-A) — 이 학생(가입 대기 단계 포함)의 담당 컨설턴트. 상담 경로
  (consultation_id not null)의 학생은 이 컬럼을 쓰지 않고 consultations.
  admissions_consultant_id를 그대로 쓴다(이 마이그레이션 범위 밖) — 직접생성
  경로(consultation_id is null) 전용.';

-- =========================================================================
-- 2. consultant_assignments — 학생당 담당 컨설턴트 1명 불변식.
--    기존에 (실수로) 같은 학생에게 컨설턴트가 둘 이상 붙은 행이 있으면
--    가장 최근 배정만 남기고 정리한다(운영 데이터 없음 확인 — 비프로덕션).
-- =========================================================================
delete from consultant_assignments a
using consultant_assignments b
where a.student_id = b.student_id
  and (a.assigned_at, a.consultant_id) < (b.assigned_at, b.consultant_id);

alter table consultant_assignments
  add constraint consultant_assignments_student_id_key unique (student_id);

-- =========================================================================
-- 3. 배정 변경 감사 이력 — 가입 전(link_student 단위)·가입 후(student 단위)
--    양쪽 다 같은 테이블에 남긴다(둘 중 하나만 채워짐).
-- =========================================================================
create table consultant_assignment_history (
  id uuid primary key default gen_random_uuid(),
  link_student_id uuid references trial_onboarding_link_students (id),
  student_id uuid references profiles (id),
  prior_consultant_id uuid references profiles (id),
  new_consultant_id uuid references profiles (id),
  actor_id uuid references profiles (id),
  reason text,
  changed_at timestamptz not null default now()
);
create index on consultant_assignment_history (link_student_id);
create index on consultant_assignment_history (student_id);

alter table consultant_assignment_history enable row level security;
create policy "관리자 조회" on consultant_assignment_history for select using (is_admin());
-- 쓰기는 아래 SECURITY DEFINER RPC를 통해서만(직접 insert 정책 없음).

-- =========================================================================
-- 4. RPC — 가입 대기 단계(link_student) 담당자 지정/변경.
--    app/admin/direct-account-actions.ts 패턴과 동일하게 service_role 전용 +
--    p_admin_id 명시 전달(20261215000000이 고친 auth.uid() 버그 클래스를
--    다시 만들지 않기 위함).
-- =========================================================================
create or replace function public.admin_set_link_student_consultant(
  p_link_student_id uuid,
  p_consultant_id uuid,
  p_admin_id uuid,
  p_reason text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_prior uuid;
begin
  if not exists (select 1 from profiles where id = p_consultant_id and role = 'consultant') then
    raise exception '컨설턴트 계정이 아닙니다.';
  end if;
  select consultant_id into v_prior from trial_onboarding_link_students where id = p_link_student_id for update;
  if not found then
    raise exception '존재하지 않는 학생 항목입니다.';
  end if;

  update trial_onboarding_link_students
  set consultant_id = p_consultant_id, consultant_assigned_by = p_admin_id, consultant_assigned_at = now()
  where id = p_link_student_id;

  insert into consultant_assignment_history (link_student_id, prior_consultant_id, new_consultant_id, actor_id, reason)
  values (p_link_student_id, v_prior, p_consultant_id, p_admin_id, p_reason);
end;
$$;
revoke execute on function public.admin_set_link_student_consultant(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_set_link_student_consultant(uuid, uuid, uuid, text) to service_role;

-- =========================================================================
-- 5. RPC — 가입 후(실제 학생 계정) 담당자 지정/재배정/해제. p_new_consultant_id
--    가 null이면 해제. 관리자 4개 화면(계정 생성 발송 내역/신규 현황/
--    Users/Consultants)이 전부 이 RPC 하나로 담당자를 바꿔야 한다 — 그래야
--    변경이 어디서 실행되든 같은 이력·같은 결과로 이어진다.
-- =========================================================================
create or replace function public.admin_set_student_consultant(
  p_student_id uuid,
  p_new_consultant_id uuid,
  p_admin_id uuid,
  p_reason text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_prior uuid;
begin
  if not exists (select 1 from profiles where id = p_student_id and role = 'student') then
    raise exception '학생 계정이 아닙니다.';
  end if;
  if p_new_consultant_id is not null and not exists (
    select 1 from profiles where id = p_new_consultant_id and role = 'consultant'
  ) then
    raise exception '컨설턴트 계정이 아닙니다.';
  end if;

  select consultant_id into v_prior from consultant_assignments where student_id = p_student_id;

  if p_new_consultant_id is null then
    delete from consultant_assignments where student_id = p_student_id;
  else
    insert into consultant_assignments (consultant_id, student_id, assigned_by, assigned_at)
    values (p_new_consultant_id, p_student_id, p_admin_id, now())
    on conflict (student_id) do update
      set consultant_id = excluded.consultant_id, assigned_by = excluded.assigned_by, assigned_at = excluded.assigned_at;
  end if;

  if v_prior is distinct from p_new_consultant_id then
    insert into consultant_assignment_history (student_id, prior_consultant_id, new_consultant_id, actor_id, reason)
    values (p_student_id, v_prior, p_new_consultant_id, p_admin_id, p_reason);
  end if;
end;
$$;
revoke execute on function public.admin_set_student_consultant(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_set_student_consultant(uuid, uuid, uuid, text) to service_role;

-- =========================================================================
-- 6. create_direct_onboarding_link_multi — p_students 각 항목에 담당
--    컨설턴트(consultant_id)를 필수로 받는다. 컨설턴트 미지정이면 링크 자체를
--    발급하지 않는다(= 안내 메일도 나가지 않는다, 호출부가 이 에러를 먼저
--    받아 발송 전에 막는다).
-- =========================================================================
drop function if exists public.create_direct_onboarding_link_multi(text, text, jsonb, uuid);
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
  v_consultant_id uuid;
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

  -- 발급 전 전수 검증(부분 발급 방지) — 이름/이메일/담당 컨설턴트 전부 필수.
  for v_student in select * from jsonb_array_elements(p_students)
  loop
    if coalesce(v_student->>'name', '') = '' or coalesce(v_student->>'email', '') = '' then
      raise exception '학생 이름과 이메일은 필수입니다.';
    end if;
    if coalesce(v_student->>'consultantId', '') = '' then
      raise exception '담당 컨설턴트를 지정해야 발송할 수 있습니다(학생: %).', v_student->>'name';
    end if;
    if not exists (
      select 1 from profiles where id = (v_student->>'consultantId')::uuid and role = 'consultant'
    ) then
      raise exception '담당 컨설턴트 계정을 찾을 수 없습니다(학생: %).', v_student->>'name';
    end if;
  end loop;

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
    v_consultant_id := (v_student->>'consultantId')::uuid;
    insert into trial_onboarding_link_students (
      link_id, student_name, student_email, student_grade, student_subject,
      consultant_id, consultant_assigned_by, consultant_assigned_at
    )
    values (
      v_id, v_student->>'name', v_student->>'email', v_student->>'grade', v_student->>'subject',
      v_consultant_id, p_admin_id, now()
    );
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
  '2026-09-23(R15-A): 학생마다 담당 컨설턴트(consultantId)를 필수로 받는다 —
  미지정이면 발급·발송 자체를 막는다. 그 외 동작은 이전과 동일.';

-- =========================================================================
-- 7. finalize_trial_onboarding_students — 직접생성 분기(consultation_id is
--    null)에서 학생 계정이 실제로 만들어지는 순간, link_student.consultant_id를
--    consultant_assignments로 그대로 이어 붙인다(수동 재배정 단계 제거).
--    그 외 로직은 20261214000000 버전과 동일 — 상담 경로(consultation_id not
--    null) 분기는 이번 변경 대상이 아니다(그대로 둠).
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
  '2026-09-23(R15-A) — 직접생성 경로(consultation_id is null) 학생 계정 생성 성공 시
  link_student.consultant_id를 consultant_assignments로 이어 붙인다(+이력 기록).
  그 외 동작은 2026-09-06 버전과 동일.';

-- =========================================================================
-- 8. retry_trial_onboarding_student — 계정 생성 재시도 성공 시에도 동일하게
--    담당자 이어 붙이기 반영.
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
  '2026-09-23(R15-A) — 계정 재시도 성공 시에도 담당자 이어 붙이기 반영. 그 외
  동작은 2026-09-06 버전과 동일.';

-- =========================================================================
-- 9. 컨설턴트 포털 "가입 대기" 조회 — 아직 계정이 안 만들어진(status<>created,
--    cancelled 아님) 본인 담당 학생 목록. 컨설턴트가 직접 읽을 수 있어야
--    하므로 SECURITY DEFINER 함수로 노출(trial_onboarding_link_students 원본
--    테이블은 RLS로 막혀 있음 — 관리자만 조회 가능한 상태 그대로 유지).
-- =========================================================================
create or replace function public.list_my_pending_onboarding_students()
returns table (
  link_student_id uuid,
  link_id uuid,
  student_name text,
  student_email text,
  student_grade text,
  status text,
  guardian_name text,
  guardian_email text,
  link_status text,
  notice_delivery_status text,
  created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    s.id, s.link_id, s.student_name, s.student_email, s.student_grade, s.status,
    l.guardian_name, l.guardian_email, l.status, l.notice_delivery_status, s.created_at
  from trial_onboarding_link_students s
  join trial_onboarding_links l on l.id = s.link_id
  where s.consultant_id = auth.uid()
    and s.status <> 'created'
    and l.status not in ('revoked', 'expired')
  order by s.created_at desc;
$$;
revoke execute on function public.list_my_pending_onboarding_students() from public, anon;
grant execute on function public.list_my_pending_onboarding_students() to authenticated;

comment on function public.list_my_pending_onboarding_students() is
  '2026-09-23(R15-A) — 컨설턴트 포털 "가입 대기" 카드용. 본인이 담당 컨설턴트로
  지정된, 아직 실제 계정이 생성되지 않은 직접생성 경로 학생만 반환.';
