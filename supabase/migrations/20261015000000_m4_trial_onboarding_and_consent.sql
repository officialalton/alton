-- M4 (1/N) — 상담→체험 온보딩 전환의 핵심 신규 부분만 다룬다: 검증된 보호자·학생
-- 계정 연결(만료형·단일사용 온보딩 링크, 신규/기존 보호자 분기, 자동 병합 금지,
-- 감사 이력) + 학생별 체험 Smart Notes 최초 1회 동의(회차마다 재확인 없음, 미동의
-- 시 체험수업권 지급·예약 서버단 차단). 과목 수강/선생님 배정(R5 그대로 재사용),
-- 예약/Calendar/Meet(R6 그대로 재사용), 체험 리뷰·원클릭 계약 발송·구매→활성화는
-- 이 마이그레이션 이후 별도 라운드에서 다룬다(docs/CURRENT.md M4 절 참고).

-- =========================================================================
-- 1. trial_onboarding_links — 상담(prospect_contact)에서 보호자의 "체험 진행
--    희망 확정" 이후에만 발급되는 만료형·단일사용 링크. account_invites(R2)와
--    다른 이유: R2는 "이미 가족이 있는 상태에서 관리자/보호자가 시작하는 초대"고,
--    여기는 "아직 계정이 전혀 없는 잠재고객이 스스로 시작하는 온보딩"이라 발급
--    주체·선행조건(상담 존재, trial_intent_confirmed)이 다르다. 실제 계정 생성은
--    이 링크가 소진된 뒤 Supabase Auth 표준 가입 절차(비밀번호 설정 등)로 이어지고,
--    finalize_trial_onboarding_new_guardian()이 그 이후 1회 호출된다.
create type trial_onboarding_link_status as enum ('pending', 'redeemed', 'expired', 'revoked');

create table trial_onboarding_links (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references consultations (id),
  prospect_contact_id uuid not null references prospect_contacts (id),
  guardian_email text not null,
  guardian_email_normalized text generated always as (lower(trim(guardian_email))) stored,
  guardian_name text not null,
  student_name text not null,
  student_grade text,
  -- 학생도 profiles.id가 auth.users FK라 실제 Auth 계정이 필요하다(R2 자녀
  -- 초대와 동일 전제) — 그 계정을 만들 이메일을 온보딩 시점에 받아둔다.
  student_email text not null,
  token_hash text not null,
  status trial_onboarding_link_status not null default 'pending',
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_auth_user_id uuid,
  revoked_at timestamptz,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);
create index on trial_onboarding_links (token_hash);
create index on trial_onboarding_links (consultation_id);
create index on trial_onboarding_links (prospect_contact_id);
-- 상담 1건당 미소진(pending) 링크는 최대 1개 — 재발급 시 기존 pending을 먼저
-- revoked 처리해야 새로 만들 수 있다(account_invites의 pending 유일성과 동일 설계).
create unique index trial_onboarding_links_pending_unique
  on trial_onboarding_links (consultation_id) where status = 'pending';

create table trial_onboarding_link_events (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references trial_onboarding_links (id),
  event_type text not null check (event_type in ('created', 'redeemed', 'finalized', 'linked_existing_guardian', 'expired', 'revoked', 'conflict_manual_review')),
  actor_id uuid references profiles (id),
  detail jsonb,
  created_at timestamptz not null default now()
);
create index on trial_onboarding_link_events (link_id, created_at desc);

alter table trial_onboarding_links enable row level security;
alter table trial_onboarding_link_events enable row level security;
create policy "관리자 조회" on trial_onboarding_links for select using (is_admin());
create policy "관리자 이벤트 조회" on trial_onboarding_link_events for select using (is_admin());
-- 모든 쓰기는 아래 SECURITY DEFINER 함수로만 — INSERT/UPDATE/DELETE RLS 정책 없음
-- (authenticated/anon 기본 거부, service_role은 함수 내부 검증에 의존).

comment on column consultations.trial_entitlement_grant_status is
  'M2: not_applicable=outcome이 trial_recommended가 아니거나 아직 시도 안 함, pending=시도 중(현재 구현에서는 동기 처리라 사실상 즉시 granted/failed로 전이), granted=지급 완료, failed=지급 실패(관리자 재처리 대상 — 대개 child_id가 아직 없는 잠재고객 단계).';

-- 관리자의 outcome=trial_recommended(추천)와 보호자 본인의 "체험 진행 희망 확정"은
-- 서로 다른 사건이다 — 후자만 이 컬럼에 기록되고, 이 값이 있어야만 온보딩 링크를
-- 발급할 수 있다(요구사항 2번 "추천과 확정 구분").
alter table consultations add column trial_intent_confirmed_at timestamptz;
alter table consultations add column trial_intent_confirmed_by uuid references profiles (id);
comment on column consultations.trial_intent_confirmed_at is
  'M4: 관리자의 outcome=trial_recommended(추천)와 별개로, 보호자 본인이 체험 진행을 확정한 시각. 이 값이 있어야 온보딩 링크 발급이 가능하다.';

-- =========================================================================
-- 2. confirm_trial_intent — 보호자의 체험 진행 희망 확정(관리자 추천과 구분).
--    관리자가 상담 페이지에서 보호자를 대신 기록하거나(전화 확인 등), 향후
--    보호자 셀프서비스 화면이 생기면 그대로 재사용 가능하도록 actor만 감사
--    기록에 남기고 별도 role 분기는 두지 않는다(이번 라운드는 관리자 대행만 노출).
-- =========================================================================
create or replace function public.confirm_trial_intent(p_consultation_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_outcome text;
begin
  if not is_admin() then
    raise exception '관리자만 체험 진행 확정을 기록할 수 있습니다.';
  end if;
  select outcome::text into v_outcome from consultations where id = p_consultation_id for update;
  if not found then
    raise exception '상담을 찾을 수 없습니다: %', p_consultation_id;
  end if;
  if v_outcome is distinct from 'trial_recommended' then
    raise exception '관리자 추천(trial_recommended) 결과가 기록된 상담만 체험 진행을 확정할 수 있습니다(현재: %).', coalesce(v_outcome, 'null');
  end if;

  update consultations
  set trial_intent_confirmed_at = coalesce(trial_intent_confirmed_at, now()),
      trial_intent_confirmed_by = coalesce(trial_intent_confirmed_by, auth.uid())
  where id = p_consultation_id;
end;
$$;
revoke execute on function public.confirm_trial_intent(uuid) from public, anon;
grant execute on function public.confirm_trial_intent(uuid) to authenticated, service_role;

-- =========================================================================
-- 3. create_trial_onboarding_link — 체험 진행 확정된 상담에 대해 만료형(72시간)·
--    단일사용 온보딩 링크를 발급. 관리자 전용(이번 라운드는 실제 이메일 발송 없이
--    raw_token을 관리자 화면에 노출해 로컬 검증만 한다).
-- =========================================================================
create or replace function public.create_trial_onboarding_link(
  p_consultation_id uuid,
  p_guardian_email text,
  p_guardian_name text,
  p_student_name text,
  p_student_email text,
  p_student_grade text default null
) returns table (link_id uuid, raw_token text)
language plpgsql security definer set search_path = public as $$
declare
  v_prospect_contact_id uuid;
  v_confirmed timestamptz;
  v_raw_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash text := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');
  v_id uuid;
begin
  if not is_admin() then
    raise exception '관리자만 온보딩 링크를 발급할 수 있습니다.';
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

  insert into trial_onboarding_links (
    consultation_id, prospect_contact_id, guardian_email, guardian_name,
    student_name, student_email, student_grade, token_hash, expires_at, created_by
  ) values (
    p_consultation_id, v_prospect_contact_id, p_guardian_email, p_guardian_name,
    p_student_name, p_student_email, p_student_grade, v_token_hash, now() + interval '72 hours', auth.uid()
  )
  returning id into v_id;

  insert into trial_onboarding_link_events (link_id, event_type, actor_id, detail)
  values (v_id, 'created', auth.uid(), jsonb_build_object('guardian_email', p_guardian_email));

  return query select v_id, v_raw_token;
end;
$$;
revoke execute on function public.create_trial_onboarding_link(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.create_trial_onboarding_link(uuid, text, text, text, text, text) to authenticated, service_role;

-- =========================================================================
-- 4. redeem_trial_onboarding_link — 비로그인 방문자가 토큰으로 온보딩 정보를
--    조회(anon). 이 시점에는 아직 아무 계정도 만들지 않는다 — 클라이언트는 이
--    결과로 "신규 가입" 또는 "이미 로그인된 기존 보호자로 진행"을 분기한다.
-- =========================================================================
create or replace function public.redeem_trial_onboarding_link(p_token text)
returns table (
  link_id uuid, consultation_id uuid, guardian_email text, guardian_name text,
  student_name text, student_email text, student_grade text
)
language plpgsql security definer set search_path = public as $$
declare
  v_row trial_onboarding_links%rowtype;
  v_token_hash text := encode(extensions.digest(p_token, 'sha256'), 'hex');
begin
  select * into v_row from trial_onboarding_links where token_hash = v_token_hash for update;
  if not found then
    raise exception '유효하지 않은 온보딩 링크입니다.';
  end if;
  if v_row.status = 'redeemed' then
    raise exception '이미 사용된 온보딩 링크입니다.';
  end if;
  if v_row.status = 'revoked' then
    raise exception '취소된 온보딩 링크입니다.';
  end if;
  if v_row.expires_at <= now() then
    update trial_onboarding_links set status = 'expired' where id = v_row.id;
    raise exception '만료된 온보딩 링크입니다.';
  end if;

  return query select v_row.id, v_row.consultation_id, v_row.guardian_email, v_row.guardian_name,
    v_row.student_name, v_row.student_email, v_row.student_grade;
end;
$$;
revoke execute on function public.redeem_trial_onboarding_link(text) from public;
grant execute on function public.redeem_trial_onboarding_link(text) to anon, authenticated, service_role;

-- =========================================================================
-- 5. finalize_trial_onboarding_new_guardian — 신규 보호자 경로. Supabase Auth
--    계정이 실제로 생성된 뒤(service_role 컨텍스트, R2 finalize_account_invite와
--    동일한 신뢰 경계) 1회 호출: profiles/parents/households/students/
--    household_members 생성 + prospect_contacts.converted_* 기록 + consultations
--    에 child_id 연결. 링크를 즉시 redeemed로 소진해 재사용을 막는다.
--
--    `profiles.id`는 `auth.users(id)` FK다 — 보호자뿐 아니라 학생(자녀)도 실제
--    Supabase Auth 계정이 있어야 한다(R2 자녀 초대와 동일한 전제). 그래서 이
--    함수는 SQL 안에서 학생 id를 임의로 만들지 않고, 앱 레이어가
--    `supabase.auth.admin.createUser()`로 학생 계정을 먼저 만든 뒤 그 id를
--    `p_child_auth_user_id`로 넘겨받는다.
-- =========================================================================
create or replace function public.finalize_trial_onboarding_new_guardian(
  p_link_id uuid,
  p_auth_user_id uuid,
  p_child_auth_user_id uuid
) returns table (household_id uuid, guardian_id uuid, child_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_row trial_onboarding_links%rowtype;
  v_household_id uuid;
  v_child_id uuid;
begin
  select * into v_row from trial_onboarding_links where id = p_link_id for update;
  if not found then
    raise exception '존재하지 않는 온보딩 링크입니다.';
  end if;
  if v_row.status = 'redeemed' then
    -- 재시도 안전: 이미 완료된 링크면 기존 결과를 그대로 반환(중복 계정 생성 방지).
    select c.child_id into v_child_id from consultations c where c.id = v_row.consultation_id;
    select hm.household_id into v_household_id
    from household_members hm where hm.profile_id = v_child_id and hm.role = 'child'
    limit 1;
    return query select v_household_id, v_row.redeemed_auth_user_id, v_child_id;
    return;
  end if;
  if v_row.status <> 'pending' then
    raise exception 'pending 상태의 온보딩 링크만 finalize할 수 있습니다(현재: %).', v_row.status;
  end if;

  insert into profiles (id, role, name) values (p_auth_user_id, 'parent', v_row.guardian_name)
  on conflict (id) do nothing;
  insert into parents (id) values (p_auth_user_id) on conflict (id) do nothing;

  insert into households (primary_guardian_id) values (p_auth_user_id) returning id into v_household_id;
  insert into household_members (household_id, profile_id, role, is_primary)
  values (v_household_id, p_auth_user_id, 'guardian', true);

  v_child_id := p_child_auth_user_id;
  insert into profiles (id, role, name) values (v_child_id, 'student', v_row.student_name) on conflict (id) do nothing;
  insert into students (id, grade, status) values (v_child_id, v_row.student_grade, 'pending') on conflict (id) do nothing;
  insert into household_members (household_id, profile_id, role, is_primary)
  values (v_household_id, v_child_id, 'child', true);

  update trial_onboarding_links
  set status = 'redeemed', redeemed_at = now(), redeemed_auth_user_id = p_auth_user_id
  where id = p_link_id;

  update prospect_contacts
  set converted_guardian_id = p_auth_user_id, converted_at = now(), converted_by = p_auth_user_id,
      conversion_note = 'M4 신규 보호자 온보딩 링크로 연결(link_id=' || p_link_id::text || ')'
  where id = v_row.prospect_contact_id;

  update consultations set child_id = v_child_id where id = v_row.consultation_id;

  insert into trial_onboarding_link_events (link_id, event_type, actor_id, detail)
  values (p_link_id, 'finalized', p_auth_user_id, jsonb_build_object('household_id', v_household_id, 'child_id', v_child_id));

  return query select v_household_id, p_auth_user_id, v_child_id;
end;
$$;
revoke execute on function public.finalize_trial_onboarding_new_guardian(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.finalize_trial_onboarding_new_guardian(uuid, uuid, uuid) to service_role;

-- =========================================================================
-- 6. link_existing_guardian_to_trial_onboarding — 이미 로그인된 기존 보호자가
--    본인임을 명시적으로 확인(= 로그인 상태에서 이 함수를 직접 호출)한 뒤에만
--    연결된다. 이메일 문자열 일치만으로는 자동 연결하지 않는다 — 호출 자체가
--    "본인 확인" 행위다. `p_existing_child_id`는 필수다 — 본인 가족의 기존 자녀
--    중 하나를 골라야 한다. 완전히 새 자녀가 필요하면(아직 계정이 없는 자녀)
--    이 함수가 SQL에서 임의로 새 Auth 계정을 만들지 않고, 기존 R2 자녀 초대
--    셀프서비스 흐름(`create_account_invite(role='student')`)을 그대로 먼저
--    거친 뒤 그 결과 child id로 이 함수를 호출해야 한다(중복 로직·중복 계정
--    생성 경로를 만들지 않기 위함). 이미 다른 상담/가족에 연결된 링크나 충돌
--    가능성이 있으면 예외로 막고 관리자 manual review로 남긴다(임의 병합 금지).
-- =========================================================================
create or replace function public.link_existing_guardian_to_trial_onboarding(
  p_link_id uuid,
  p_existing_child_id uuid
) returns table (household_id uuid, child_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_row trial_onboarding_links%rowtype;
  v_guardian_id uuid := auth.uid();
  v_household_id uuid;
  v_child_id uuid;
begin
  if v_guardian_id is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if not exists (select 1 from parents where id = v_guardian_id) then
    raise exception '보호자 계정만 이 온보딩 링크를 연결할 수 있습니다.';
  end if;
  if p_existing_child_id is null then
    raise exception '연결할 자녀를 지정해야 합니다 — 새 자녀는 기존 자녀 초대 흐름으로 먼저 계정을 만드세요.';
  end if;

  select * into v_row from trial_onboarding_links where id = p_link_id for update;
  if not found then
    raise exception '존재하지 않는 온보딩 링크입니다.';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'pending 상태의 온보딩 링크만 연결할 수 있습니다(현재: %).', v_row.status;
  end if;

  select hm.household_id into v_household_id
  from household_members hm
  where hm.profile_id = v_guardian_id and hm.role = 'guardian'
  limit 1;
  if v_household_id is null then
    raise exception '이 계정에 연결된 가족(household)이 없습니다 — 관리자 검토가 필요합니다.';
  end if;

  if not exists (
    select 1 from household_members
    where household_id = v_household_id and profile_id = p_existing_child_id and role = 'child'
  ) then
    raise exception '본인 가족의 자녀만 연결할 수 있습니다.';
  end if;
  v_child_id := p_existing_child_id;

  update trial_onboarding_links
  set status = 'redeemed', redeemed_at = now(), redeemed_auth_user_id = v_guardian_id
  where id = p_link_id;

  update prospect_contacts
  set converted_guardian_id = v_guardian_id, converted_at = now(), converted_by = v_guardian_id,
      conversion_note = 'M4 기존 보호자 본인 확인으로 연결(link_id=' || p_link_id::text || ')'
  where id = v_row.prospect_contact_id;

  update consultations set child_id = v_child_id where id = v_row.consultation_id;

  insert into trial_onboarding_link_events (link_id, event_type, actor_id, detail)
  values (p_link_id, 'linked_existing_guardian', v_guardian_id, jsonb_build_object('household_id', v_household_id, 'child_id', v_child_id, 'reused_existing_child', p_existing_child_id is not null));

  return query select v_household_id, v_child_id;
end;
$$;
revoke execute on function public.link_existing_guardian_to_trial_onboarding(uuid, uuid) from public, anon;
grant execute on function public.link_existing_guardian_to_trial_onboarding(uuid, uuid) to authenticated, service_role;

-- =========================================================================
-- 7. trial_smart_notes_consents — 학생별 최초 1회 능동 동의(회차마다 재확인
--    없음). 미동의 시 체험수업권 지급·예약을 서버·DB에서 막는다(아래 8번).
--    법률 문구 자체는 여기서 만들지 않는다 — policy_version은 기존 R2
--    consent_policy_versions와 별개 네임스페이스 텍스트 키일 뿐이고, 실제 문구
--    확정은 여전히 출시 전 blocker로 남아있다(placeholder를 확정본처럼 표현 금지).
-- =========================================================================
create table trial_smart_notes_consents (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references students (id),
  guardian_id uuid not null references parents (id),
  policy_version text not null,
  confirmed_at timestamptz not null default now(),
  confirmed_ip text,
  created_at timestamptz not null default now()
);
-- 학생당 정확히 1건만 — "회차마다 다시 묻지 않는다"를 유니크 인덱스로 강제.
create unique index trial_smart_notes_consents_one_per_child on trial_smart_notes_consents (child_id);
create index on trial_smart_notes_consents (guardian_id);

alter table trial_smart_notes_consents enable row level security;
create policy "관리자·본인 보호자 조회" on trial_smart_notes_consents for select
  using (is_admin() or guardian_id = auth.uid());
-- INSERT는 아래 함수로만(RLS 정책 없음 — authenticated 기본 거부).

create or replace function public.record_trial_smart_notes_consent(
  p_child_id uuid,
  p_policy_version text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_guardian_id uuid := auth.uid();
  v_existing_id uuid;
  v_new_id uuid;
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
    return v_existing_id; -- 멱등: 이미 동의했으면 그대로 반환(재확인 요구 안 함).
  end if;

  insert into trial_smart_notes_consents (child_id, guardian_id, policy_version, confirmed_ip)
  values (
    p_child_id, v_guardian_id, p_policy_version,
    nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-forwarded-for'
  )
  returning id into v_new_id;

  return v_new_id;
end;
$$;
revoke execute on function public.record_trial_smart_notes_consent(uuid, text) from public, anon;
grant execute on function public.record_trial_smart_notes_consent(uuid, text) to authenticated, service_role;

-- =========================================================================
-- 8. grant_trial_entitlement_for_consultation — 기존 M2 함수에 동의 게이트만
--    추가(시그니처·나머지 로직 불변, CREATE OR REPLACE로 재정의).
-- =========================================================================
create or replace function public.grant_trial_entitlement_for_consultation(
  p_consultation_id uuid
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_child_id uuid;
  v_existing_grant_id uuid;
  v_new_grant_id uuid;
  v_trial_product_id uuid;
  v_expires_at timestamptz;
begin
  select child_id into v_child_id from consultations where id = p_consultation_id for update;
  if not found then
    raise exception '상담 신청을 찾을 수 없습니다: %', p_consultation_id;
  end if;
  if v_child_id is null then
    raise exception '연결된 학생 계정이 없어 체험수업권을 지급할 수 없습니다(잠재고객 단계 — 정식 학생 계정 연결 후 재시도 필요).';
  end if;

  -- M4: 학생별 체험 Smart Notes 동의가 없으면 지급 자체를 막는다(요구사항 4·5).
  if not exists (select 1 from trial_smart_notes_consents where child_id = v_child_id) then
    raise exception '체험 Smart Notes 동의가 없어 체험수업권을 지급할 수 없습니다(학생 id: %).', v_child_id;
  end if;

  select id into v_existing_grant_id from entitlement_grants where source_consultation_id = p_consultation_id;
  if v_existing_grant_id is not null then
    return v_existing_grant_id;
  end if;

  -- M4: 상담 재처리/중복 상담으로 같은 학생에게 반복 지급되지 않도록 학생 기준으로도
  -- 방어(요구사항 5). 이미 이 학생 앞으로 활성 grant가 있으면 그 grant를 반환한다.
  select eg.id into v_existing_grant_id
  from entitlement_grants eg
  join entitlement_products ep on ep.id = eg.entitlement_product_id
  where eg.child_id = v_child_id and ep.code = 'trial_lesson_grant'
  limit 1;
  if v_existing_grant_id is not null then
    return v_existing_grant_id;
  end if;

  select id into v_trial_product_id from entitlement_products where code = 'trial_lesson_grant';
  if v_trial_product_id is null then
    raise exception '체험수업권 상품(trial_lesson_grant)이 존재하지 않습니다 — 마이그레이션 순서 문제.';
  end if;

  v_expires_at := now() + interval '90 days';

  begin
    insert into entitlement_grants (
      child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at,
      is_paid, source_consultation_id
    ) values (
      v_child_id, v_trial_product_id, null, 1, v_expires_at, false, p_consultation_id
    )
    returning id into v_new_grant_id;
  exception when unique_violation then
    select id into v_new_grant_id from entitlement_grants where source_consultation_id = p_consultation_id;
    if v_new_grant_id is not null then
      return v_new_grant_id;
    end if;
    raise;
  end;

  insert into entitlement_ledger (grant_id, event_type, amount, business_event_id)
  values (v_new_grant_id, 'grant', 1, 'trial_grant:' || p_consultation_id::text)
  on conflict do nothing;

  return v_new_grant_id;
end;
$$;
comment on function public.grant_trial_entitlement_for_consultation(uuid) is
  'M2 요구사항 2·4 + M4 동의 게이트: 학생별 체험 Smart Notes 동의(trial_smart_notes_consents)가 있어야만, 그리고 학생당 정확히 1개만 지급. is_paid=false로 생성되므로 환불·이전 대상에서 자동 제외.';
revoke execute on function public.grant_trial_entitlement_for_consultation(uuid) from public, anon, authenticated;
