-- R15-A(3/3) — 컨설턴트 → 선생님 배정 요청(구조화된 업무 요청, 수락 전에는
-- 실제 teacher_assignments를 만들지 않는다). 학생·보호자에게는 이 요청·대화가
-- 보이지 않는다(RLS에 학생/보호자 정책을 아예 두지 않음 = 기본 거부).
--
-- 실제 계정이 생기기 전(가입 대기, link_student_id만 있음) 요청은 교사가
-- "사전 문의"로 수락해도 실제 배정이 확정되지 않는다 — student_id가 아직
-- null이면 confirm_student_teacher_subject_match를 호출하지 않고 accepted만
-- 기록한다. 학생 계정이 실제로 생성되는 시점(finalize_trial_onboarding_students의
-- 직접생성 분기)에 student_id를 이어 붙이고 needs_reprocessing=true로 표시해
-- 관리자·컨설턴트가 재처리(실제 배정 확정)할 수 있게 한다.

create type teacher_assignment_request_status as enum ('pending', 'accepted', 'rejected', 'cancelled');

create table teacher_assignment_requests (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references profiles (id),
  student_id uuid references profiles (id),
  link_student_id uuid references trial_onboarding_link_students (id),
  subject_id uuid not null references subjects (id),
  teacher_id uuid not null references profiles (id),
  student_name text not null,
  grade text,
  current_score text,
  goal text,
  is_new_student boolean not null default true,
  preferred_schedule text,
  request_note text,
  status teacher_assignment_request_status not null default 'pending',
  reject_reason text,
  responded_at timestamptz,
  responded_by uuid references profiles (id),
  -- 수락됐지만(가입 대기 → 계정 생성 전이 등으로) 실제 배정 확정이 아직 안
  -- 끝난 경우. 관리자/컨설턴트 화면에 "재처리 필요"로 노출된다.
  needs_reprocessing boolean not null default false,
  reprocessing_error text,
  subject_enrollment_id uuid references subject_enrollments (id),
  teacher_assignment_id uuid references teacher_assignments (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teacher_assignment_requests_target_check check (
    (student_id is not null) or (link_student_id is not null)
  )
);
create index on teacher_assignment_requests (teacher_id, status);
create index on teacher_assignment_requests (consultant_id);
create index on teacher_assignment_requests (student_id);
create index on teacher_assignment_requests (link_student_id);

-- 같은 학생(또는 가입 대기 학생)·과목에 동시에 유효한(pending) 요청은 하나만.
create unique index teacher_assignment_requests_one_pending_per_student_subject
  on teacher_assignment_requests (student_id, subject_id)
  where status = 'pending' and student_id is not null;
create unique index teacher_assignment_requests_one_pending_per_link_subject
  on teacher_assignment_requests (link_student_id, subject_id)
  where status = 'pending' and link_student_id is not null;

alter table teacher_assignment_requests enable row level security;

create policy "관리자 전체 조회" on teacher_assignment_requests for select using (is_admin());
create policy "담당 컨설턴트 본인 요청 조회" on teacher_assignment_requests for select
  using (consultant_id = auth.uid());
create policy "요청받은 선생님 조회" on teacher_assignment_requests for select
  using (teacher_id = auth.uid());
-- 쓰기는 전부 아래 SECURITY DEFINER RPC를 통해서만(직접 insert/update 정책 없음).

comment on table teacher_assignment_requests is
  '2026-09-23(R15-A) — 컨설턴트가 선생님에게 보내는 구조화된 체험 과목·배정
  요청. 학생/보호자에게는 노출되지 않는다(RLS에 그 역할 정책 자체가 없음).';

-- =========================================================================
-- 1. 요청 생성 — 컨설턴트 전용. 담당 관계 확인 + 같은 학생·과목 중복 방지
--    (이미 pending인 요청 또는 이미 active인 실제 배정이 있으면 거부).
-- =========================================================================
create or replace function public.request_teacher_assignment(
  p_student_id uuid,
  p_link_student_id uuid,
  p_subject_id uuid,
  p_teacher_id uuid,
  p_student_name text,
  p_grade text,
  p_current_score text,
  p_goal text,
  p_is_new_student boolean,
  p_preferred_schedule text,
  p_request_note text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_existing_enrollment_status text;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'consultant') then
    raise exception '컨설턴트 계정만 배정 요청을 보낼 수 있습니다.';
  end if;
  if (p_student_id is null) = (p_link_student_id is null) then
    raise exception '실제 학생 또는 가입 대기 학생 중 정확히 하나만 지정해야 합니다.';
  end if;
  if not exists (select 1 from profiles where id = p_teacher_id and role = 'teacher') then
    raise exception '선생님 계정이 아닙니다.';
  end if;
  if not exists (select 1 from subjects where id = p_subject_id) then
    raise exception '존재하지 않는 과목입니다.';
  end if;

  if p_student_id is not null then
    if not exists (select 1 from consultant_assignments where consultant_id = auth.uid() and student_id = p_student_id) then
      raise exception '담당 학생이 아닙니다.';
    end if;
    select status into v_existing_enrollment_status
    from subject_enrollments
    where child_id = p_student_id and subject_id = p_subject_id and status in ('planned', 'active', 'paused')
    limit 1;
    if v_existing_enrollment_status is not null then
      raise exception '이미 이 과목에 수강 배정이 있습니다(상태: %) — 중복 요청할 수 없습니다.', v_existing_enrollment_status;
    end if;
  else
    if not exists (
      select 1 from trial_onboarding_link_students where id = p_link_student_id and consultant_id = auth.uid()
    ) then
      raise exception '담당 학생(가입 대기)이 아닙니다.';
    end if;
  end if;

  insert into teacher_assignment_requests (
    consultant_id, student_id, link_student_id, subject_id, teacher_id, student_name,
    grade, current_score, goal, is_new_student, preferred_schedule, request_note
  ) values (
    auth.uid(), p_student_id, p_link_student_id, p_subject_id, p_teacher_id, p_student_name,
    p_grade, p_current_score, p_goal, p_is_new_student, p_preferred_schedule, p_request_note
  )
  returning id into v_id;

  return v_id;
exception when unique_violation then
  raise exception '이미 같은 학생·과목으로 응답 대기 중인 요청이 있습니다 — 응답을 기다리거나 취소한 뒤 다시 요청하세요.';
end;
$$;
revoke execute on function public.request_teacher_assignment(uuid, uuid, uuid, uuid, text, text, text, text, boolean, text, text) from public, anon;
grant execute on function public.request_teacher_assignment(uuid, uuid, uuid, uuid, text, text, text, text, boolean, text, text) to authenticated;

-- =========================================================================
-- 2. 요청 취소 — 컨설턴트(본인) 또는 관리자. pending 상태만.
-- =========================================================================
create or replace function public.cancel_teacher_assignment_request(p_request_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_row teacher_assignment_requests%rowtype;
begin
  select * into v_row from teacher_assignment_requests where id = p_request_id for update;
  if not found then
    raise exception '존재하지 않는 요청입니다.';
  end if;
  if not (is_admin() or v_row.consultant_id = auth.uid()) then
    raise exception '요청을 보낸 컨설턴트 또는 관리자만 취소할 수 있습니다.';
  end if;
  if v_row.status <> 'pending' then
    raise exception '응답 대기 중인 요청만 취소할 수 있습니다(현재: %).', v_row.status;
  end if;
  update teacher_assignment_requests
  set status = 'cancelled', responded_at = now(), responded_by = auth.uid(), updated_at = now()
  where id = p_request_id;
end;
$$;
revoke execute on function public.cancel_teacher_assignment_request(uuid) from public, anon;
grant execute on function public.cancel_teacher_assignment_request(uuid) to authenticated;

-- =========================================================================
-- 3. 선생님 응답 — 수락/거절. 수락 시 실제 학생이면 바로 공통 매칭 경로로
--    확정, 가입 대기 학생이면 accepted만 기록(needs_reprocessing 아님 — 계정
--    생성을 기다리는 정상 상태). 거절 시 사유 필수, 컨설턴트가 다른 후보에게
--    다시 요청할 수 있도록 pending 유니크 인덱스에서 즉시 빠진다.
-- =========================================================================
create or replace function public.respond_teacher_assignment_request(
  p_request_id uuid,
  p_accept boolean,
  p_reject_reason text default null
) returns teacher_assignment_requests
language plpgsql security definer set search_path = public as $$
declare
  v_row teacher_assignment_requests%rowtype;
  v_match record;
begin
  select * into v_row from teacher_assignment_requests where id = p_request_id for update;
  if not found then
    raise exception '존재하지 않는 요청입니다.';
  end if;
  if v_row.teacher_id <> auth.uid() then
    raise exception '이 요청을 받은 선생님만 응답할 수 있습니다.';
  end if;
  if v_row.status <> 'pending' then
    raise exception '이미 응답한 요청입니다(현재: %).', v_row.status;
  end if;

  if not p_accept then
    if coalesce(btrim(p_reject_reason), '') = '' then
      raise exception '거절 사유를 입력해야 합니다.';
    end if;
    update teacher_assignment_requests
    set status = 'rejected', reject_reason = p_reject_reason, responded_at = now(), responded_by = auth.uid(), updated_at = now()
    where id = p_request_id
    returning * into v_row;
    return v_row;
  end if;

  -- 수락. 실제 학생(student_id)이 아직 없으면(가입 대기) 배정을 확정하지 않고
  -- 여기서 멈춘다 — 계정 생성 시 finalize_trial_onboarding_students가 이어받는다.
  if v_row.student_id is null then
    update teacher_assignment_requests
    set status = 'accepted', responded_at = now(), responded_by = auth.uid(), updated_at = now()
    where id = p_request_id
    returning * into v_row;
    return v_row;
  end if;

  update teacher_assignment_requests
  set status = 'accepted', responded_at = now(), responded_by = auth.uid(), updated_at = now()
  where id = p_request_id;

  begin
    select * into v_match from confirm_student_teacher_subject_match(v_row.student_id, v_row.teacher_id, v_row.subject_id);
    update teacher_assignment_requests
    set subject_enrollment_id = v_match.out_subject_enrollment_id,
        teacher_assignment_id = v_match.out_teacher_assignment_id,
        needs_reprocessing = (v_match.out_activation_warning is not null or v_match.out_curriculum_warning is not null),
        reprocessing_error = coalesce(v_match.out_activation_warning, v_match.out_curriculum_warning),
        updated_at = now()
    where id = p_request_id
    returning * into v_row;
  exception when others then
    update teacher_assignment_requests
    set needs_reprocessing = true, reprocessing_error = sqlerrm, updated_at = now()
    where id = p_request_id
    returning * into v_row;
  end;

  return v_row;
end;
$$;
revoke execute on function public.respond_teacher_assignment_request(uuid, boolean, text) from public, anon;
grant execute on function public.respond_teacher_assignment_request(uuid, boolean, text) to authenticated;

-- =========================================================================
-- 4. 재처리 — 배정 확정에 실패했거나(needs_reprocessing) 가입 대기 학생이
--    실제 계정 생성 후 대기 중인 accepted 요청을 관리자 또는 담당 컨설턴트가
--    다시 시도한다. confirm_student_teacher_subject_match가 멱등이라 중복
--    배정 없이 안전하게 재시도된다.
-- =========================================================================
create or replace function public.reprocess_teacher_assignment_request(p_request_id uuid)
returns teacher_assignment_requests
language plpgsql security definer set search_path = public as $$
declare
  v_row teacher_assignment_requests%rowtype;
  v_match record;
begin
  select * into v_row from teacher_assignment_requests where id = p_request_id for update;
  if not found then
    raise exception '존재하지 않는 요청입니다.';
  end if;
  if not (is_admin() or v_row.consultant_id = auth.uid()) then
    raise exception '관리자 또는 담당 컨설턴트만 재처리할 수 있습니다.';
  end if;
  if v_row.status <> 'accepted' then
    raise exception '수락된 요청만 재처리할 수 있습니다(현재: %).', v_row.status;
  end if;
  if v_row.student_id is null then
    raise exception '아직 학생 계정이 생성되지 않았습니다 — 계정 생성 후에만 재처리할 수 있습니다.';
  end if;

  begin
    select * into v_match from confirm_student_teacher_subject_match(v_row.student_id, v_row.teacher_id, v_row.subject_id);
    update teacher_assignment_requests
    set subject_enrollment_id = v_match.out_subject_enrollment_id,
        teacher_assignment_id = v_match.out_teacher_assignment_id,
        needs_reprocessing = (v_match.out_activation_warning is not null or v_match.out_curriculum_warning is not null),
        reprocessing_error = coalesce(v_match.out_activation_warning, v_match.out_curriculum_warning),
        updated_at = now()
    where id = p_request_id
    returning * into v_row;
  exception when others then
    update teacher_assignment_requests
    set needs_reprocessing = true, reprocessing_error = sqlerrm, updated_at = now()
    where id = p_request_id
    returning * into v_row;
  end;

  return v_row;
end;
$$;
revoke execute on function public.reprocess_teacher_assignment_request(uuid) from public, anon;
grant execute on function public.reprocess_teacher_assignment_request(uuid) to authenticated;

-- =========================================================================
-- 5. confirm_student_teacher_subject_match — 선생님이 본인이 수락한 구조화된
--    요청 범위 안에서만 스스로 이 공통 매칭 경로를 호출할 수 있도록 권한
--    조건을 하나 추가한다(그 외 조건은 2026-09-17 버전과 완전히 동일 —
--    본문 로직은 손대지 않음).
-- =========================================================================
create or replace function public.confirm_student_teacher_subject_match(
  p_child_id uuid,
  p_teacher_id uuid,
  p_subject_id uuid
)
returns table (
  out_subject_enrollment_id uuid,
  out_teacher_assignment_id uuid,
  out_overlay_id uuid,
  out_activation_warning text,
  out_curriculum_warning text
)
language plpgsql security definer set search_path = public as $$
declare
  v_contract_id uuid;
  v_enrollment_id uuid;
  v_assignment_id uuid;
  v_overlay_id uuid;
  v_child_status text;
  v_activation_warning text := null;
  v_curriculum_warning text := null;
begin
  if not (
    is_admin()
    or current_user_has_capability('매칭권한')
    or (
      auth.uid() = p_teacher_id
      and exists (
        select 1 from teacher_assignment_requests
        where teacher_id = p_teacher_id and student_id = p_child_id and subject_id = p_subject_id
          and status = 'accepted'
      )
    )
  ) then
    raise exception '이 작업을 수행할 권한이 없습니다.';
  end if;

  if not exists (
    select 1 from subject_template_units u where u.subject_id = p_subject_id
  ) then
    raise exception '이 과목은 아직 공용 커리큘럼(회차)이 없어 배정할 수 없습니다.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_child_id::text || ':' || p_subject_id::text, 43));

  select id into v_enrollment_id
  from subject_enrollments
  where child_id = p_child_id and subject_id = p_subject_id
    and status in ('planned', 'active', 'paused')
  limit 1;

  if v_enrollment_id is null then
    select get_or_create_draft_contract_for_child(p_child_id) into v_contract_id;
    insert into subject_enrollments (child_id, subject_id, contract_id, status)
    values (p_child_id, p_subject_id, v_contract_id, 'planned')
    returning id into v_enrollment_id;
  end if;

  select id into v_assignment_id
  from teacher_assignments
  where subject_enrollment_id = v_enrollment_id and teacher_id = p_teacher_id and status = 'active';

  if v_assignment_id is null then
    insert into teacher_assignments (subject_enrollment_id, teacher_id, status, effective_from, changed_by, source)
    values (v_enrollment_id, p_teacher_id, 'active', now(), auth.uid(), 'app')
    returning id into v_assignment_id;
  end if;

  select status into v_child_status from students where id = p_child_id;
  if v_child_status = 'pending' then
    begin
      perform transition_account_status(p_child_id, 'active', '과목·선생님 배정 완료(자동 전환)');
    exception when others then
      v_activation_warning := '선생님 배정은 완료됐지만, 학생 계정을 활성 상태로 전환하지 못했습니다(' || sqlerrm || '). 관리자가 직접 확인·재처리해야 합니다.';
    end;
  end if;

  begin
    perform activate_subject_enrollment_if_ready(v_enrollment_id);
  exception when others then
    null;
  end;

  begin
    v_overlay_id := public.ensure_active_curriculum_overlay(v_enrollment_id);
  exception when others then
    v_curriculum_warning := '선생님 배정은 완료됐지만, 학생별 커리큘럼을 만들지 못했습니다(' || sqlerrm || '). 관리자가 직접 확인·재처리해야 합니다.';
  end;

  return query select v_enrollment_id, v_assignment_id, v_overlay_id, v_activation_warning, v_curriculum_warning;
end;
$$;

-- =========================================================================
-- 6. finalize_trial_onboarding_students — 직접생성 학생 계정이 실제로 만들어지면
--    그 link_student_id에 걸린 accepted 요청에 student_id를 이어 붙이고
--    needs_reprocessing=true로 표시한다(관리자·컨설턴트가 재처리 버튼으로
--    실제 배정을 확정). 그 외 로직은 20261473000000 버전과 동일 — 담당
--    컨설턴트 이어 붙이기 다음에 이 처리를 추가했을 뿐이다.
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
        if v_student.consultant_id is not null then
          insert into consultant_assignments (consultant_id, student_id, assigned_by, assigned_at)
          values (v_student.consultant_id, v_child_auth_user_id, v_student.consultant_assigned_by, now())
          on conflict (student_id) do nothing;
          insert into consultant_assignment_history (student_id, prior_consultant_id, new_consultant_id, actor_id, reason)
          values (v_child_auth_user_id, null, v_student.consultant_id, v_student.consultant_assigned_by, '가입 대기 단계 담당자 이어받음(계정 생성)');
        end if;

        -- R15-A(3/3) — 이 가입 대기 학생에게 걸려있던 accepted 배정 요청을
        -- 이제 실제 학생 id로 이어 붙이고 재처리 대상으로 표시한다.
        update teacher_assignment_requests
        set student_id = v_child_auth_user_id, needs_reprocessing = true,
            reprocessing_error = '계정 생성 완료 — 실제 배정 확정 재처리 필요', updated_at = now()
        where link_student_id = v_link_student_id and status = 'accepted' and student_id is null;

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

-- =========================================================================
-- 7. 조회 헬퍼 — 컨설턴트 본인 요청 목록, 선생님 본인 받은 요청 목록.
-- =========================================================================
create or replace function public.list_my_sent_teacher_assignment_requests()
returns setof teacher_assignment_requests
language sql stable security definer set search_path = public as $$
  select * from teacher_assignment_requests where consultant_id = auth.uid() order by created_at desc;
$$;
revoke execute on function public.list_my_sent_teacher_assignment_requests() from public, anon;
grant execute on function public.list_my_sent_teacher_assignment_requests() to authenticated;

create or replace function public.list_my_received_teacher_assignment_requests()
returns setof teacher_assignment_requests
language sql stable security definer set search_path = public as $$
  select * from teacher_assignment_requests where teacher_id = auth.uid() order by created_at desc;
$$;
revoke execute on function public.list_my_received_teacher_assignment_requests() from public, anon;
grant execute on function public.list_my_received_teacher_assignment_requests() to authenticated;
