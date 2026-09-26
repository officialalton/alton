-- M4 후속 정정(2026-09-06, 제품 오너 검수 지적 반영) — additive.
--
-- 지적 1: 계정 생성 성공한 학생마다 기존 단일 칸반에 카드 1개가 나타나야
--   하는데 실제로는 consultations 테이블에 아무것도 insert되지 않고 있었다
--   (consultations.child_id가 finalize_trial_onboarding_students()/
--   retry_trial_onboarding_student()에서 전혀 설정되지 않아 pipeline이 영원히
--   "account_linked=false"로 멈춰 있었다 — 별도 카드는커녕 원 카드조차
--   전혀 진행되지 않았다).
-- 지적 2: 학생별 초대(비밀번호 설정 메일) 발송 상태가 trial_onboarding_links
--   (링크=가족 단위) 컬럼에 저장돼 형제자매 결과가 서로 덮어써지고 있었다.
--
-- 정책(변경 없음, 재확인): 별도 관리자 보드 신설 금지. 원 상담(가족) 카드는
-- 이력으로 유지하고 더 이상 단계 이동하지 않는다 — child_id를 원 카드에는
-- 절대 설정하지 않음으로써(항상 null 유지) 자동으로 달성된다(pipeline이
-- account_linked=false로 고정되어 trial_requested 컬럼에 박제됨).

-- =========================================================================
-- 1. 학생별 초대 상태를 trial_onboarding_link_students로 이전(행 단위 독립).
--    기존 status/child_auth_user_id/error는 "계정 생성" 단계를 이미 행 단위로
--    추적하고 있었다(이 부분은 원래도 정상이었다) — 새로 추가하는 것은
--    "초대 발송" 단계만이다. 중복 컬럼을 만들지 않기 위해 계정 생성 관련
--    컬럼명은 그대로 두고 초대 관련 컬럼만 추가한다.
-- =========================================================================
alter table trial_onboarding_link_students
  add column invite_status text not null default 'pending' check (invite_status in ('pending', 'sent', 'failed')),
  add column invite_error text,
  add column invite_sent_at timestamptz,
  add column invite_retry_count int not null default 0;

comment on column trial_onboarding_link_students.invite_status is
  '2026-09-06: 이 학생 본인 앞 "비밀번호 설정" 이메일의 발송 상태 — 행 단위로 독립 저장(형제자매 결과가 서로 덮어쓰지 않음). status(계정 생성)와는 별개 단계.';

-- =========================================================================
-- 2. 학생별 칸반 카드 — consultations에 가족 원본 카드와 연결되는 컬럼 추가.
-- =========================================================================
alter table consultations
  add column family_root_consultation_id uuid references consultations (id),
  add column is_child_onboarding_card boolean not null default false,
  add column source_link_child_id uuid references trial_onboarding_link_students (id);

-- 동일 상담·동일 자녀 조합으로 후속 카드가 중복 생성되지 않도록(멱등 insert의
-- 근거) 유니크 제약.
create unique index consultations_source_link_child_id_unique
  on consultations (source_link_child_id) where source_link_child_id is not null;
create index on consultations (family_root_consultation_id) where family_root_consultation_id is not null;

comment on column consultations.is_child_onboarding_card is
  '2026-09-06: true면 이 행은 학생 계정 생성 성공 직후 자동 생성된 "학생별 진행 카드"다 — 관리자 칸반에 형제자매마다 별도 카드로 보이게 하기 위함(요구사항: 별도 보드 신설 금지, 기존 단일 칸반 안에서 카드만 늘어남). family_root_consultation_id가 원래의 가족 단위 상담(이력, 더 이상 단계 이동 없음)을 가리킨다.';

-- =========================================================================
-- 3. 학생별 카드 생성 헬퍼 — finalize/retry 양쪽에서 공유. 이미 카드가
--    있으면(source_link_child_id 유니크 위반) 조용히 건너뛴다(멱등 — 동시
--    재시도/재호출에도 카드 중복 없음).
-- =========================================================================
create or replace function public._create_student_kanban_card(
  p_root_consultation_id uuid,
  p_link_student_id uuid,
  p_child_auth_user_id uuid,
  p_household_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_root consultations%rowtype;
  v_student trial_onboarding_link_students%rowtype;
begin
  select * into v_root from consultations where id = p_root_consultation_id;
  if not found then
    return; -- 방어적: 원 상담이 사라진 비정상 상태면 카드도 만들지 않는다.
  end if;
  select * into v_student from trial_onboarding_link_students where id = p_link_student_id;
  if not found then
    return;
  end if;

  insert into consultations (
    household_id, child_id, contact_name, contact_email, contact_phone,
    student_grade, category, concerns, status, source, starts_at, ends_at,
    scheduled_at, completed_at, outcome, outcome_notes, prospect_contact_id,
    trial_intent_confirmed_at, family_root_consultation_id, is_child_onboarding_card,
    source_link_child_id
  )
  values (
    p_household_id, p_child_auth_user_id, v_student.student_name, v_root.contact_email, v_root.contact_phone,
    coalesce(v_student.student_grade, v_root.student_grade), v_root.category, v_root.concerns,
    'completed', v_root.source, v_root.starts_at, v_root.ends_at,
    v_root.scheduled_at, v_root.completed_at, 'trial_recommended', v_root.outcome_notes, v_root.prospect_contact_id,
    coalesce(v_root.trial_intent_confirmed_at, now()), p_root_consultation_id, true,
    p_link_student_id
  )
  on conflict (source_link_child_id) where source_link_child_id is not null do nothing;
end;
$$;
revoke execute on function public._create_student_kanban_card(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public._create_student_kanban_card(uuid, uuid, uuid, uuid) to service_role;

comment on function public._create_student_kanban_card(uuid, uuid, uuid, uuid) is
  '2026-09-06: 학생 계정 생성 성공 직후 호출되는 내부 헬퍼(finalize_trial_onboarding_students/retry_trial_onboarding_student 전용) — 학생별 독립 칸반 카드를 consultations에 1건 insert한다. source_link_child_id 유니크 제약으로 멱등(중복 호출/동시 호출에도 카드 중복 없음).';

-- =========================================================================
-- 4. finalize_trial_onboarding_students — 학생 성공 처리 직후 카드 생성 호출
--    추가(그 외 로직은 동일).
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

  update prospect_contacts
  set converted_guardian_id = p_guardian_auth_user_id, converted_at = coalesce(converted_at, now()),
      converted_by = p_guardian_auth_user_id,
      conversion_note = coalesce(conversion_note, '복수자녀 온보딩(link_id=' || p_link_id::text || ')')
  where id = v_row.prospect_contact_id;

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

      perform public._create_student_kanban_card(v_row.consultation_id, v_link_student_id, v_child_auth_user_id, v_household_id);

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
  '2026-09-06 정정: 학생별 실패는 개별 savepoint로 격리, child_auth_user_id 유니크 인덱스+status=created 확인으로 중복 계정 연결 방지(기존과 동일) + 학생 계정 생성 성공 시 _create_student_kanban_card()로 학생별 독립 칸반 카드를 생성한다(이번 라운드 수정 — 이전에는 카드가 전혀 생성되지 않았다).';

-- =========================================================================
-- 5. retry_trial_onboarding_student — 계정 생성 실패 재시도 시에도 카드 생성.
--    p_stage로 "account"(계정 생성 재시도, 기존 동작) 또는 "invite"(초대만
--    재발송, 계정은 이미 있음)를 구분한다 — 두 실패 모드를 독립적으로 재시도
--    할 수 있어야 한다는 요구사항 반영. 기존 시그니처(3-인자) 호출부와의
--    하위 호환을 위해 p_stage는 기본값 'account'.
-- =========================================================================
-- 기존 3-인자 버전은 인자 타입 목록이 달라 create or replace로 대체되지 않고
-- 오버로드로 남아 호출이 모호해진다 — 명시적으로 지운다.
drop function if exists public.retry_trial_onboarding_student(uuid, uuid, uuid);
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
    -- 계정은 이미 존재해야 한다(초대만 재시도) — 계정 생성 자체가 안 됐으면
    -- account 재시도를 먼저 해야 한다.
    if v_student.status <> 'created' or v_student.child_auth_user_id is null then
      raise exception '학생 계정이 아직 생성되지 않았습니다 — 계정 생성 재시도가 먼저 필요합니다.';
    end if;
    update trial_onboarding_link_students
    set invite_retry_count = invite_retry_count + 1, updated_at = now()
    where id = p_link_student_id;
    return query select v_student.child_auth_user_id, v_student.status;
    return; -- 실제 이메일 발송은 앱 레이어(lib/trial-onboarding-finalize.ts)가 이어서 수행한다.
  end if;

  if v_student.status = 'created' then
    return query select v_student.child_auth_user_id, v_student.status;
    return; -- 멱등: 이미 성공한 학생은 재처리하지 않는다.
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

    perform public._create_student_kanban_card(v_row.consultation_id, p_link_student_id, p_child_auth_user_id, v_household_id);

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
  '2026-09-06 정정: p_stage=account(기본값, 기존 동작 + 카드 생성 추가)/invite(계정은 그대로 두고 invite_retry_count만 증가, 실제 재발송은 앱 레이어) — 계정 생성 실패와 초대 발송 실패를 독립적으로 재시도할 수 있다.';

-- =========================================================================
-- 6. get_trial_onboarding_link_students — 초대 상태 컬럼도 함께 반환(관리자
--    화면이 학생별 초대 상태를 조회할 수 있도록).
-- =========================================================================
drop function if exists public.get_trial_onboarding_link_students(uuid);
create function public.get_trial_onboarding_link_students(p_link_id uuid)
returns table (
  id uuid, student_name text, student_email text, student_grade text, student_subject text,
  status text, child_auth_user_id uuid, error text,
  invite_status text, invite_error text, invite_sent_at timestamptz, invite_retry_count int
)
language sql stable security definer set search_path = public as $$
  select id, student_name, student_email, student_grade, student_subject, status, child_auth_user_id, error,
         invite_status, invite_error, invite_sent_at, invite_retry_count
  from trial_onboarding_link_students
  where link_id = p_link_id
  order by created_at asc;
$$;
revoke execute on function public.get_trial_onboarding_link_students(uuid) from public, anon, authenticated;
grant execute on function public.get_trial_onboarding_link_students(uuid) to service_role;
