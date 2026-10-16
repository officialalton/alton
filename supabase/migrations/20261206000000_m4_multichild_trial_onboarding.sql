-- M4 후속(2026-09-06, 제품 오너 최종 확정안) — 복수 자녀 온보딩.
--
-- 정책: 기존 단일 칸반을 그대로 유지한다(별도 보드 분리 없음). 관리자는 기존
-- "체험 온보딩 안내 발송" 화면에서 학생 1~N명을 개별 입력하고, 보호자에게는
-- 가족당 온보딩 이메일/링크 1개만 발송한다. 보호자가 링크를 확인하면(신규
-- 보호자는 계정·household 1회 생성, 기존 보호자는 재사용) 시스템이 입력된 N명의
-- 학생 계정을 만들어 같은 household에 연결한다. 학생 1명 생성 실패가 형제자매
-- 처리를 막지 않고, 성공한 학생마다 기존 단일 칸반에 진행 카드 1개를 만든다.
--
-- 기존 단일 학생 컬럼(student_name/student_email/student_grade)과
-- create_trial_onboarding_link()/finalize_trial_onboarding_new_guardian()/
-- finalize_trial_onboarding_existing_guardian()는 삭제하지 않는다 — 기존
-- 통합테스트(app/consult/existing-guardian-reconsult.integration.test.ts)와
-- 기존 트리거·정책 코드가 그대로 참조한다. 이 마이그레이션은 그 위에 "여러 학생"
-- 지원을 추가하는 새 테이블·새 함수만 더한다(가산적).

-- =========================================================================
-- 1. trial_onboarding_link_students — 온보딩 링크 1개에 딸린 학생 명단(1~N).
--    기존 단일 학생 컬럼은 "첫 번째 학생"의 스냅샷으로 계속 채워 하위 호환을
--    보존한다(레거시 리포트/화면이 참조할 수 있게). 실제 계정 생성 진행상황은
--    이 테이블의 status/child_auth_user_id로만 추적한다.
-- =========================================================================
create table trial_onboarding_link_students (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references trial_onboarding_links (id),
  student_name text not null,
  student_email text not null,
  student_email_normalized text generated always as (lower(trim(student_email))) stored,
  student_grade text,
  student_subject text,
  -- pending: 아직 계정 생성 시도 전/재시도 대상. created: 계정 생성+household
  -- 연결 완료(칸반 카드 대상). failed: 이번 시도 실패, 재시도 가능.
  status text not null default 'pending' check (status in ('pending', 'created', 'failed')),
  child_auth_user_id uuid,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- 같은 링크 안에서 같은 학생 이메일 중복 입력 방지(관리자 입력 실수 방어).
create unique index trial_onboarding_link_students_link_email_unique
  on trial_onboarding_link_students (link_id, student_email_normalized);
-- 같은 Auth 계정이 두 번 "created"로 기록되는 것을 DB 제약으로 원천 차단
-- (동시 재시도/이중 클릭에도 중복 학생 계정 연결 불가 — 요구사항 8번).
create unique index trial_onboarding_link_students_child_auth_unique
  on trial_onboarding_link_students (child_auth_user_id) where child_auth_user_id is not null;
create index on trial_onboarding_link_students (link_id);
create index on trial_onboarding_link_students (status);

alter table trial_onboarding_link_students enable row level security;
create policy "관리자 조회" on trial_onboarding_link_students for select using (is_admin());
-- 쓰기는 아래 SECURITY DEFINER 함수로만.

comment on table trial_onboarding_link_students is
  '2026-09-06: 온보딩 링크 1개(=가족 1건)에 딸린 학생 1~N명의 명단과 계정 생성 진행상황. 가족당 링크는 여전히 1개(trial_onboarding_links), 학생은 이 테이블에서 N명.';

-- 기존 단일 학생 컬럼은 이제 "레거시 스냅샷"일 뿐 필수 입력이 아니다 — 새 경로는
-- 항상 최소 1개의 trial_onboarding_link_students 행을 만들고, 그 첫 번째 값으로
-- 이 컬럼들을 채운다(레거시 조회 코드가 깨지지 않도록).
alter table trial_onboarding_links alter column student_name drop not null;
alter table trial_onboarding_links alter column student_email drop not null;

-- =========================================================================
-- 2. create_trial_onboarding_link_multi — 학생 1~N명을 한 번에 등록하고 링크
--    1개를 발급한다. p_students는 [{"name":..,"email":..,"grade":..(선택),
--    "subject":..(선택)}, ...] 형태의 jsonb 배열. 기존 6-인자
--    create_trial_onboarding_link()는 그대로 남겨두되(하위 호환), 관리자 화면은
--    이 함수로 전환한다.
-- =========================================================================
create or replace function public.create_trial_onboarding_link_multi(
  p_consultation_id uuid,
  p_guardian_email text,
  p_guardian_name text,
  p_students jsonb
) returns table (link_id uuid, raw_token text)
language plpgsql security definer set search_path = public as $$
declare
  v_prospect_contact_id uuid;
  v_confirmed timestamptz;
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
  if p_students is null or jsonb_typeof(p_students) <> 'array' or jsonb_array_length(p_students) < 1 then
    raise exception '학생을 최소 1명 입력해야 합니다.';
  end if;

  select prospect_contact_id, trial_intent_confirmed_at into v_prospect_contact_id, v_confirmed
  from consultations where id = p_consultation_id;
  if not found then
    raise exception '상담을 찾을 수 없습니다: %', p_consultation_id;
  end if;
  if v_prospect_contact_id is null then
    raise exception '잠재고객(prospect_contact) 연결이 없는 상담입니다.';
  end if;
  if v_confirmed is null then
    raise exception '보호자의 체험 진행 확정(confirm_trial_intent) 이후에만 온보딩 링크를 발급할 수 있습니다.';
  end if;

  select v->>'name', v->>'email', v->>'grade'
    into v_first_name, v_first_email, v_first_grade
  from jsonb_array_elements(p_students) v limit 1;

  insert into trial_onboarding_links (
    consultation_id, prospect_contact_id, guardian_email, guardian_name,
    student_name, student_email, student_grade, token_hash, expires_at, created_by
  ) values (
    p_consultation_id, v_prospect_contact_id, p_guardian_email, p_guardian_name,
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
  values (v_id, 'created', auth.uid(), jsonb_build_object('guardian_email', p_guardian_email, 'student_count', v_count));

  return query select v_id, v_raw_token;
end;
$$;
revoke execute on function public.create_trial_onboarding_link_multi(uuid, text, text, jsonb) from public, anon;
grant execute on function public.create_trial_onboarding_link_multi(uuid, text, text, jsonb) to authenticated, service_role;

-- =========================================================================
-- 3. get_trial_onboarding_link_students — service_role 전용. 온보딩 라우트가
--    링크를 redeem한 뒤 Auth 계정을 만들어야 할 학생 명단을 가져온다.
-- =========================================================================
create or replace function public.get_trial_onboarding_link_students(p_link_id uuid)
returns table (
  id uuid, student_name text, student_email text, student_grade text, student_subject text,
  status text, child_auth_user_id uuid, error text
)
language sql stable security definer set search_path = public as $$
  select id, student_name, student_email, student_grade, student_subject, status, child_auth_user_id, error
  from trial_onboarding_link_students
  where link_id = p_link_id
  order by created_at asc;
$$;
revoke execute on function public.get_trial_onboarding_link_students(uuid) from public, anon, authenticated;
grant execute on function public.get_trial_onboarding_link_students(uuid) to service_role;

-- =========================================================================
-- 4. finalize_trial_onboarding_students — 신규/기존 보호자 공용 다자녀 finalize.
--    p_new_guardian이 true면 신규 보호자 계정(household 신규 생성), false면
--    p_existing_guardian_id 재사용. p_students는
--    [{"link_student_id":..,"child_auth_user_id":..}, ...] — 앱 레이어가 이미
--    Node에서 Auth 계정을 만든 뒤 그 결과만 넘긴다(SQL은 Auth 계정을 만들지
--    않는다, 기존 finalize_* 함수와 동일한 경계).
--
--    학생 1명의 처리 실패가 형제자매 처리를 막지 않도록 각 학생을 중첩
--    BEGIN/EXCEPTION 블록(암묵적 savepoint)으로 감싼다 — 한 학생만 롤백되고
--    나머지는 계속 진행된다(요구사항 7). 이미 status='created'인 학생은
--    다시 처리하지 않는다(멱등, 요구사항 8 — 동시 재시도 안전은
--    child_auth_user_id 유니크 인덱스가 이중 방어).
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

  -- 링크 자체는 household가 확정되는 즉시 redeemed로 소진한다(개별 학생 성공
  -- 여부와 무관) — 재시도(retry_trial_onboarding_student)가 이 시점 이후에는
  -- household를 다시 찾을 필요 없이 항상 존재한다고 가정할 수 있게 하기 위함.
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
      continue; -- 알 수 없는 학생 항목은 조용히 건너뛴다(방어적 — 정상 경로에서는 발생 안 함).
    end if;
    if v_student.status = 'created' then
      v_created := v_created + 1;
      continue; -- 이미 완료 — 재처리 안 함(멱등).
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
  '2026-09-06: 복수 자녀 온보딩 finalize. 학생별 실패는 개별 savepoint로 격리(형제자매 롤백 없음), child_auth_user_id 유니크 인덱스+status=created 확인으로 재시도/동시성에도 중복 계정 연결을 만들지 않는다.';

-- =========================================================================
-- 5. retry_trial_onboarding_student — 실패한 학생 1명만 재시도. 링크가 이미
--    redeemed 상태(= household 확정)라는 전제로 동작 — 재시도는 새 Auth 계정을
--    Node에서 새로 만들거나 이전 실패 시도의 계정을 재사용해 그 id를 넘긴다.
-- =========================================================================
create or replace function public.retry_trial_onboarding_student(
  p_link_id uuid,
  p_link_student_id uuid,
  p_child_auth_user_id uuid
) returns table (child_id uuid, status text)
language plpgsql security definer set search_path = public as $$
declare
  v_row trial_onboarding_links%rowtype;
  v_student trial_onboarding_link_students%rowtype;
  v_household_id uuid;
begin
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
revoke execute on function public.retry_trial_onboarding_student(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.retry_trial_onboarding_student(uuid, uuid, uuid) to service_role;

comment on function public.retry_trial_onboarding_student(uuid, uuid, uuid) is
  '2026-09-06: 실패한 학생 1명만 재시도. 링크가 redeemed(= household 확정) 상태여야 하며, 이미 created인 학생은 멱등하게 그대로 반환한다.';
