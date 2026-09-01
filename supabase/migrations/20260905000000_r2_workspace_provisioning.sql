-- R2 Task 7 — 선생님 Google Workspace 계정 프로비저닝
--
-- 원칙(2026-08-31 확정, 3라운드 정정 반영):
--   * profiles.id는 auth.users.id를 FK로 참조하므로, 실제 Google OAuth 연결
--     전에는 teachers/profiles 행 자체가 존재할 수 없다 — account_invites와
--     동일한 계열로 teacher_workspace_provisioning에 staging한다.
--   * OAuth 연결 자체는 활성화를 의미하지 않는다 — 연결 직후 teachers.status는
--     반드시 pending이다.
--   * 7개 활성화 선행조건은 linked 하나로 뭉개지 않고 각각 별도 증거·시각을
--     남긴다(get_teacher_activation_checklist()).
--   * 운영 인증(Vercel OIDC → GCP WIF → signJwt → DWD → Directory API)은
--     서비스 계정 키·장기 refresh token을 쓰지 않는다 — 이 마이그레이션은
--     그 인증 메커니즘과 무관하게, 앱이 이미 얻은 결과(google_user_id 등)만
--     다룬다.

-- =========================================================================
-- 1) staging 테이블 + 감사 이력
-- =========================================================================

create type workspace_provisioning_status as enum (
  'not_started', 'creating', 'created', 'first_login_pending', 'linked',
  'suspended', 'retryable_failed', 'manual_review'
);

create table teacher_workspace_provisioning (
  id uuid primary key default gen_random_uuid(),
  workspace_email text not null,
  workspace_email_normalized text not null,
  personal_contact_email text not null,
  workspace_recovery_email text not null,
  personal_phone text,
  workspace_google_user_id text,
  status workspace_provisioning_status not null default 'not_started',
  idempotency_key uuid not null default gen_random_uuid(),
  linked_teacher_id uuid references teachers (id),
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now(),
  workspace_created_at timestamptz,
  first_login_at timestamptz,
  linked_at timestamptz,
  unique (idempotency_key)
);
create unique index teacher_workspace_provisioning_email_key
  on teacher_workspace_provisioning (workspace_email_normalized);
create unique index teacher_workspace_provisioning_google_id_key
  on teacher_workspace_provisioning (workspace_google_user_id)
  where workspace_google_user_id is not null;
create unique index teacher_workspace_provisioning_linked_teacher_key
  on teacher_workspace_provisioning (linked_teacher_id)
  where linked_teacher_id is not null;

create table workspace_provisioning_events (
  id uuid primary key default gen_random_uuid(),
  provisioning_id uuid references teacher_workspace_provisioning (id),
  event_type text not null check (event_type in (
    'created', 'linked', 'creation_failed', 'retry_scheduled', 'suspended',
    'reactivated', 'link_rejected', 'manual_review_required'
  )),
  detail text,
  created_at timestamptz not null default now(),
  created_by uuid references profiles (id)
);
create index on workspace_provisioning_events (provisioning_id);

alter table teacher_workspace_provisioning enable row level security;
create policy "관리자/본인 조회" on teacher_workspace_provisioning for select
  using (is_admin() or linked_teacher_id = auth.uid());
-- 직접 INSERT/UPDATE/DELETE 정책은 두지 않는다 — 전부 아래 SECURITY DEFINER
-- 함수를 통해서만 쓴다(account_invites/guardian_consents와 동일 패턴).

alter table workspace_provisioning_events enable row level security;
create policy "관리자만 조회" on workspace_provisioning_events for select using (is_admin());

-- =========================================================================
-- 2) teachers 확장
-- =========================================================================

alter table teachers
  add column workspace_email text,
  add column workspace_google_user_id text,
  add column personal_contact_email text,
  add column workspace_recovery_email text,
  add column personal_phone text,
  add column onboarding_completed_at timestamptz;

create unique index teachers_workspace_google_user_id_key
  on teachers (workspace_google_user_id)
  where workspace_google_user_id is not null;

-- 필수 프로필·온보딩 정보(school/bio/phone) 완료 시각을 원본 데이터에서
-- 자동으로 파생한다(관리자 수동 확인 아님). 조건이 다시 깨지면(예: 관리자가
-- 실수로 school을 지움) completed_at도 함께 초기화한다.
create or replace function public.refresh_teacher_onboarding_completed_at(p_teacher_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_complete boolean;
begin
  select (t.school is not null and t.bio is not null and p.phone is not null)
  into v_complete
  from teachers t join profiles p on p.id = t.id
  where t.id = p_teacher_id;

  if v_complete then
    update teachers set onboarding_completed_at = coalesce(onboarding_completed_at, now())
    where id = p_teacher_id;
  else
    update teachers set onboarding_completed_at = null where id = p_teacher_id;
  end if;
end;
$$;

create or replace function public.teachers_onboarding_check()
returns trigger language plpgsql as $$
begin
  perform refresh_teacher_onboarding_completed_at(new.id);
  return new;
end;
$$;
create trigger teachers_refresh_onboarding
  after insert or update of school, bio on teachers
  for each row execute function public.teachers_onboarding_check();

create or replace function public.profiles_onboarding_check()
returns trigger language plpgsql as $$
begin
  if new.role = 'teacher' then
    perform refresh_teacher_onboarding_completed_at(new.id);
  end if;
  return new;
end;
$$;
create trigger profiles_refresh_teacher_onboarding
  after update of phone on profiles
  for each row execute function public.profiles_onboarding_check();

-- =========================================================================
-- 3) 활성화 선행조건 체크리스트 — 관리자 화면과 transition_account_status()가
--    같은 함수를 공유한다(조건 로직 이중 관리 금지). 7개 중 어느 것도
--    linked 하나로 대체되지 않고 각자의 원본 데이터에서 파생된다.
-- =========================================================================

create or replace function public.get_teacher_activation_checklist(p_teacher_id uuid)
returns table (condition text, satisfied boolean, evidence_at timestamptz)
language sql stable security definer set search_path = public as $$
  with wp as (
    select * from teacher_workspace_provisioning where linked_teacher_id = p_teacher_id
  ), t as (
    select * from teachers where id = p_teacher_id
  )
  select 'workspace_issued'::text, (select workspace_created_at from wp) is not null, (select workspace_created_at from wp)
  union all
  select 'first_login'::text, (select first_login_at from wp) is not null, (select first_login_at from wp)
  union all
  select 'identity_linked'::text, (select linked_at from wp) is not null, (select linked_at from wp)
  union all
  select 'valid_rate'::text, has_valid_current_teacher_rate(p_teacher_id),
    (select effective_from from teacher_rate_history where teacher_id = p_teacher_id and effective_until is null limit 1)
  union all
  select 'onboarding_complete'::text, (select onboarding_completed_at from t) is not null, (select onboarding_completed_at from t)
  union all
  select 'contract_signed'::text, exists (select 1 from teacher_contracts where teacher_id = p_teacher_id and status = 'signed'),
    (select max(signed_at) from teacher_contracts where teacher_id = p_teacher_id and status = 'signed')
  union all
  select 'admin_base_info'::text, (select created_at from wp) is not null, (select created_at from wp);
$$;
revoke execute on function public.get_teacher_activation_checklist(uuid) from public;
grant execute on function public.get_teacher_activation_checklist(uuid) to authenticated;
-- (본인 조회는 teachers RLS "본인/관리자/담당학생/학부모 조회"로 이미 가능한
-- 정보의 파생값뿐이라 authenticated에 안전하게 열어도 된다 — 임의 대상 조회를
-- 관리자 화면 밖에서 막고 싶다면 app 레이어에서 is_admin() 또는 본인만
-- 호출하도록 제한한다.)

-- =========================================================================
-- 4) 프로비저닝 시작·완료·실패·정지·재활성화 — 전부 관리자 전용
-- =========================================================================

-- 재시도 시 같은 idempotency_key를 재사용한다(멱등성) — 이메일 정규화 값이
-- 이미 있으면(재시도 가능 상태일 때만) 새 행을 만들지 않고 기존 행을 이어
-- 쓴다.
create or replace function public.begin_teacher_workspace_provisioning(
  p_workspace_email text,
  p_personal_contact_email text,
  p_workspace_recovery_email text,
  p_personal_phone text
) returns teacher_workspace_provisioning
language plpgsql security definer set search_path = public as $$
declare
  v_row teacher_workspace_provisioning%rowtype;
  v_normalized text := lower(trim(p_workspace_email));
begin
  if not is_admin() then
    raise exception '관리자만 프로비저닝을 시작할 수 있습니다.';
  end if;
  if v_normalized is null or v_normalized = '' then
    raise exception 'workspace_email이 필요합니다.';
  end if;
  if p_personal_contact_email is null or trim(p_personal_contact_email) = '' then
    raise exception 'personal_contact_email이 필요합니다.';
  end if;
  if p_workspace_recovery_email is null or trim(p_workspace_recovery_email) = '' then
    raise exception 'workspace_recovery_email이 필요합니다.';
  end if;

  select * into v_row from teacher_workspace_provisioning
  where workspace_email_normalized = v_normalized
  for update;

  if found then
    if v_row.status <> 'retryable_failed' then
      raise exception '이미 진행 중이거나 완료된 프로비저닝입니다(상태: %).', v_row.status;
    end if;
    update teacher_workspace_provisioning
    set status = 'creating'
    where id = v_row.id
    returning * into v_row;
    return v_row;
  end if;

  insert into teacher_workspace_provisioning (
    workspace_email, workspace_email_normalized, personal_contact_email,
    workspace_recovery_email, personal_phone, status, created_by
  ) values (
    p_workspace_email, v_normalized, p_personal_contact_email,
    p_workspace_recovery_email, p_personal_phone, 'creating', auth.uid()
  ) returning * into v_row;

  return v_row;
end;
$$;
revoke execute on function public.begin_teacher_workspace_provisioning(text, text, text, text) from public;
grant execute on function public.begin_teacher_workspace_provisioning(text, text, text, text) to authenticated;

create or replace function public.record_workspace_created(p_provisioning_id uuid, p_google_user_id text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception '관리자만 처리할 수 있습니다.';
  end if;
  update teacher_workspace_provisioning
  set status = 'created', workspace_google_user_id = p_google_user_id, workspace_created_at = now()
  where id = p_provisioning_id and status = 'creating';
  if not found then
    raise exception '유효하지 않은 프로비저닝 상태 전이입니다(id=%).', p_provisioning_id;
  end if;

  insert into workspace_provisioning_events (provisioning_id, event_type, created_by)
  values (p_provisioning_id, 'created', auth.uid());
end;
$$;
revoke execute on function public.record_workspace_created(uuid, text) from public;
grant execute on function public.record_workspace_created(uuid, text) to authenticated;

create or replace function public.mark_workspace_invite_sent(p_provisioning_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception '관리자만 처리할 수 있습니다.';
  end if;
  update teacher_workspace_provisioning
  set status = 'first_login_pending'
  where id = p_provisioning_id and status = 'created';
  if not found then
    raise exception '유효하지 않은 프로비저닝 상태 전이입니다(id=%).', p_provisioning_id;
  end if;
end;
$$;
revoke execute on function public.mark_workspace_invite_sent(uuid) from public;
grant execute on function public.mark_workspace_invite_sent(uuid) to authenticated;

-- 전파 지연 등 재시도 가능한 실패는 retryable_failed, unmanaged/충돌 계정
-- 등 자동 처리가 위험한 실패는 manual_review로 분리한다. 원인(raw)과
-- 분류 결과를 각각 별도 이벤트로 남긴다.
create or replace function public.record_workspace_creation_failed(
  p_provisioning_id uuid, p_reason text, p_retryable boolean
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_status workspace_provisioning_status := case when p_retryable then 'retryable_failed' else 'manual_review' end;
begin
  if not is_admin() then
    raise exception '관리자만 처리할 수 있습니다.';
  end if;
  update teacher_workspace_provisioning set status = v_status where id = p_provisioning_id;
  if not found then
    raise exception '존재하지 않는 프로비저닝입니다(id=%).', p_provisioning_id;
  end if;

  insert into workspace_provisioning_events (provisioning_id, event_type, detail, created_by)
  values (p_provisioning_id, 'creation_failed', p_reason, auth.uid());
  insert into workspace_provisioning_events (provisioning_id, event_type, detail, created_by)
  values (
    p_provisioning_id,
    case when p_retryable then 'retry_scheduled' else 'manual_review_required' end,
    p_reason, auth.uid()
  );
end;
$$;
revoke execute on function public.record_workspace_creation_failed(uuid, text, boolean) from public;
grant execute on function public.record_workspace_creation_failed(uuid, text, boolean) to authenticated;

create or replace function public.suspend_teacher_workspace(p_teacher_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_prov_id uuid;
begin
  if not is_admin() then
    raise exception '관리자만 처리할 수 있습니다.';
  end if;
  select id into v_prov_id from teacher_workspace_provisioning where linked_teacher_id = p_teacher_id;
  if v_prov_id is not null then
    update teacher_workspace_provisioning set status = 'suspended' where id = v_prov_id;
    insert into workspace_provisioning_events (provisioning_id, event_type, detail, created_by)
    values (v_prov_id, 'suspended', p_reason, auth.uid());
  end if;
end;
$$;
revoke execute on function public.suspend_teacher_workspace(uuid, text) from public;
grant execute on function public.suspend_teacher_workspace(uuid, text) to authenticated;

create or replace function public.reactivate_teacher_workspace(p_teacher_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_prov_id uuid;
begin
  if not is_admin() then
    raise exception '관리자만 처리할 수 있습니다.';
  end if;
  select id into v_prov_id from teacher_workspace_provisioning where linked_teacher_id = p_teacher_id;
  if v_prov_id is not null then
    update teacher_workspace_provisioning set status = 'linked' where id = v_prov_id and status = 'suspended';
    if not found then
      raise exception 'suspended 상태가 아닌 Workspace 프로비저닝은 재활성화할 수 없습니다.';
    end if;
    insert into workspace_provisioning_events (provisioning_id, event_type, detail, created_by)
    values (v_prov_id, 'reactivated', p_reason, auth.uid());
  end if;
end;
$$;
revoke execute on function public.reactivate_teacher_workspace(uuid, text) from public;
grant execute on function public.reactivate_teacher_workspace(uuid, text) to authenticated;

-- =========================================================================
-- 5) OAuth 신원 검증·연결 — Google hd 도메인 클레임이나 이메일만으로
--    신뢰하지 않는다. workspace_google_user_id + workspace_email이 모두
--    일치하는 사전 등록 레코드가 있을 때만 연결한다.
-- =========================================================================

-- self-only 조회(호출자가 이미 아는 자기 자신의 google_user_id/email
-- 조합으로만 조회 가능) — provisioning_id/status만 반환해 PII(연락처 등)
-- 임의 열람을 막는다.
create or replace function public.find_teacher_provisioning_for_identity(
  p_google_user_id text, p_workspace_email text
) returns table (id uuid, status workspace_provisioning_status)
language sql stable security definer set search_path = public as $$
  select twp.id, twp.status from teacher_workspace_provisioning twp
  where twp.workspace_google_user_id = p_google_user_id
    and twp.workspace_email_normalized = lower(trim(p_workspace_email));
$$;
revoke execute on function public.find_teacher_provisioning_for_identity(text, text) from public;
grant execute on function public.find_teacher_provisioning_for_identity(text, text) to authenticated;

-- 사전 등록된 프로비저닝 레코드가 없는 OAuth 시도를 감사에 남긴다(연결은
-- 하지 않는다 — 호출자가 이 함수를 부르기 전에 이미 auth.users 행을
-- 삭제했어야 한다).
create or replace function public.log_workspace_link_rejected(p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into workspace_provisioning_events (provisioning_id, event_type, detail)
  values (null, 'link_rejected', p_reason);
end;
$$;
revoke execute on function public.log_workspace_link_rejected(text) from public;
grant execute on function public.log_workspace_link_rejected(text) to authenticated;

-- 실제 연결. self-only(auth.uid() = p_auth_user_id 강제)로 confused-deputy를
-- 막는다. 연결 직후 teachers.status는 반드시 pending이다 — OAuth 연결
-- 자체가 활성화를 의미하지 않는다.
create or replace function public.link_teacher_workspace_identity(
  p_auth_user_id uuid,
  p_provisioning_id uuid,
  p_google_user_id text,
  p_workspace_email text,
  p_teacher_name text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_prov teacher_workspace_provisioning%rowtype;
begin
  if auth.uid() is distinct from p_auth_user_id then
    raise exception '본인 인증 세션에서만 호출할 수 있습니다.';
  end if;

  select * into v_prov from teacher_workspace_provisioning where id = p_provisioning_id for update;
  if not found then
    raise exception '프로비저닝 레코드를 찾을 수 없습니다.';
  end if;
  if v_prov.workspace_google_user_id is distinct from p_google_user_id
     or v_prov.workspace_email_normalized is distinct from lower(trim(p_workspace_email)) then
    raise exception 'Google 신원이 프로비저닝 레코드와 일치하지 않습니다.';
  end if;

  if v_prov.linked_teacher_id is not null then
    if v_prov.linked_teacher_id = p_auth_user_id then
      return; -- 이미 연결된 계정의 재로그인 — 정상
    end if;
    raise exception '이미 다른 계정에 연결된 프로비저닝 레코드입니다.';
  end if;

  if v_prov.status not in ('created', 'first_login_pending') then
    raise exception '연결할 수 없는 프로비저닝 상태입니다: %', v_prov.status;
  end if;

  if exists (select 1 from profiles where id = p_auth_user_id) then
    raise exception '이미 다른 ALTON 프로필에 연결된 인증 사용자입니다.';
  end if;

  insert into profiles (id, role, name) values (p_auth_user_id, 'teacher', p_teacher_name);
  insert into teachers (
    id, status, workspace_email, workspace_google_user_id,
    personal_contact_email, workspace_recovery_email, personal_phone
  ) values (
    p_auth_user_id, 'pending', v_prov.workspace_email, p_google_user_id,
    v_prov.personal_contact_email, v_prov.workspace_recovery_email, v_prov.personal_phone
  );

  update teacher_workspace_provisioning
  set linked_teacher_id = p_auth_user_id,
      status = 'linked',
      linked_at = now(),
      first_login_at = coalesce(first_login_at, now())
  where id = v_prov.id;

  insert into workspace_provisioning_events (provisioning_id, event_type, detail)
  values (v_prov.id, 'linked', 'auth_user_id linked');
end;
$$;
revoke execute on function public.link_teacher_workspace_identity(uuid, uuid, text, text, text) from public;
grant execute on function public.link_teacher_workspace_identity(uuid, uuid, text, text, text) to authenticated;

-- =========================================================================
-- 6) transition_account_status() 확장 — teacher의 pending→active 전이에만
--    7개 선행조건을 전부 만족해야 한다는 조건을 추가한다(기존
--    active↔suspended 등 다른 전이·다른 역할은 영향받지 않는다). 동시에
--    "선생님 활동 중단=inactive" 요구사항을 반영해 active/suspended↔inactive
--    전이를 valid-transition 목록에 추가한다(R12로 이관된 전체 inactive
--    보관·복귀 정책 자동화와는 별개로, 이 전이 자체는 Task 7이 필요로 하는
--    최소 범위다).
-- =========================================================================

create or replace function public.transition_account_status(p_profile_id uuid, p_new_status text, p_reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_role profile_role;
  v_current text;
  v_valid boolean;
  v_checklist record;
  v_missing text[] := array[]::text[];
begin
  if not is_admin() then
    raise exception '계정 상태 전환은 관리자만 할 수 있습니다.';
  end if;

  select role into v_role from profiles where id = p_profile_id;
  if v_role is null then
    raise exception '해당 프로필(%)을 찾을 수 없습니다.', p_profile_id;
  end if;
  if v_role = 'admin' then
    raise exception '관리자 계정은 이 함수의 대상이 아닙니다.';
  end if;
  if v_role not in ('student', 'teacher', 'parent') then
    raise exception '지원하지 않는 역할입니다: %', v_role;
  end if;

  v_current := get_account_status(p_profile_id);

  v_valid := (v_current, p_new_status) in (
    ('pending', 'active'),
    ('active', 'suspended'),
    ('suspended', 'active'),
    ('active', 'closure_pending'),
    ('suspended', 'closure_pending'),
    ('closure_pending', 'closed'),
    ('active', 'inactive'),
    ('suspended', 'inactive'),
    ('inactive', 'active')
  );

  if not v_valid then
    raise exception '허용되지 않는 상태 전이입니다: % → %', v_current, p_new_status;
  end if;

  if v_role = 'student' and p_new_status = 'active' and is_under_13(p_profile_id) and not has_valid_guardian_consent(p_profile_id) then
    raise exception '13세 미만 학생은 유효한 보호자 동의 없이 active로 전환할 수 없습니다.';
  end if;

  if v_role = 'teacher' and v_current = 'pending' and p_new_status = 'active' then
    for v_checklist in select * from get_teacher_activation_checklist(p_profile_id) loop
      if not v_checklist.satisfied then
        v_missing := array_append(v_missing, v_checklist.condition);
      end if;
    end loop;
    if array_length(v_missing, 1) > 0 then
      raise exception '선생님 활성화 선행조건이 충족되지 않았습니다: %', array_to_string(v_missing, ', ');
    end if;
  end if;

  perform set_config('app.bypass_status_protect', 'true', true);
  if v_role = 'student' then
    update students set status = p_new_status::student_status where id = p_profile_id;
  elsif v_role = 'teacher' then
    update teachers set status = p_new_status::teacher_status where id = p_profile_id;
  elsif v_role = 'parent' then
    update parents set status = p_new_status::parent_status where id = p_profile_id;
  end if;
  perform set_config('app.bypass_status_protect', 'false', true);

  insert into account_status_events (profile_id, previous_status, new_status, changed_by, reason)
  values (p_profile_id, v_current, p_new_status, auth.uid(), p_reason);
end;
$$;
