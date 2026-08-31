-- R2 Task 6 — 13세 미만 보호자 동의
--
-- 원칙(2026-08-31 확정):
--   * 계정 lifecycle(current_account_active())과 이용 자격(동의 포함)을 분리한다.
--     current_account_active()의 의미는 바꾸지 않고, 별도
--     current_account_access_allowed()를 신설해 26개 자기서비스 쓰기 정책을
--     이걸로 교체한다.
--   * 동의는 검증된 보호자(활성 household guardian) 또는 관리자(수동 검증,
--     증빙 필수)만 기록할 수 있다 — 학생 본인·타 household 보호자는 차단.
--   * 동의 자체가 계정을 active로 만들지 않는다 — 13세 미만 학생의 active
--     전환에 필요한 "조건"일 뿐이다(계정 lifecycle과 동의 상태는 별개).
--   * 정책 문구의 "본질적 변경"에만 재동의를 요구한다(consent_policy_versions.
--     requires_reconsent).
--   * "인증된 보호자 계정 + 검증된 household 관계"가 COPPA verifiable parental
--     consent 요건을 충분히 충족하는지는 **정식 오픈 전 법률 검토 대상**이다 —
--     이 마이그레이션은 그 확정을 전제하지 않는다.

-- =========================================================================
-- 1) 정책 버전 + 동의 원장
-- =========================================================================
create table consent_policy_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  title text not null,
  document_url text,
  content_hash text not null,
  effective_from timestamptz not null,
  retired_at timestamptz,
  requires_reconsent boolean not null default true,
  created_at timestamptz not null default now()
);

create table guardian_consents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles (id),
  policy_version_id uuid not null references consent_policy_versions (id),
  consented_by uuid not null references profiles (id),
  consented_at timestamptz not null default now(),
  verification_method text not null,
  verification_reference text,
  notice_delivered_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references profiles (id),
  revocation_reason text,
  created_at timestamptz not null default now()
);
create index on guardian_consents (student_id);

-- 철회 관련 3개 필드 외에는 직접 UPDATE 불가, DELETE도 불가 — 동의 당시
-- 정책 버전·검증 방법·시각은 사후에 절대 바뀌지 않아야 "당시 무엇에
-- 동의했는지"를 증명할 수 있다. 철회는 revoke_guardian_consent()를 통해서만.
create or replace function public.protect_guardian_consent()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'guardian_consents 행은 삭제할 수 없습니다.';
  end if;
  if coalesce(current_setting('app.bypass_consent_protect', true), 'false') = 'true' then
    if new.id is distinct from old.id
       or new.student_id is distinct from old.student_id
       or new.policy_version_id is distinct from old.policy_version_id
       or new.consented_by is distinct from old.consented_by
       or new.consented_at is distinct from old.consented_at
       or new.verification_method is distinct from old.verification_method
       or new.verification_reference is distinct from old.verification_reference
       or new.notice_delivered_at is distinct from old.notice_delivered_at then
      raise exception 'guardian_consents의 동의 당시 기록(정책 버전·검증 방법·시각)은 수정할 수 없습니다.';
    end if;
    return new;
  end if;
  raise exception 'guardian_consents는 revoke_guardian_consent()를 통해서만 수정할 수 있습니다.';
end;
$$;
create trigger guardian_consents_protect
  before update or delete on guardian_consents
  for each row execute function public.protect_guardian_consent();

create table privacy_review_tasks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles (id),
  reason text not null,
  created_at timestamptz not null default now(),
  created_by uuid references profiles (id),
  resolved_at timestamptz,
  resolved_by uuid references profiles (id),
  resolution_note text
);
create index on privacy_review_tasks (student_id);

alter table consent_policy_versions enable row level security;
create policy "누구나 조회" on consent_policy_versions for select using (true);
-- 정책 버전 관리(추가/폐지)는 이 마이그레이션에서 앱 서버 액션을 만들지 않는다
-- (초기에는 관리자가 마이그레이션/수동 SQL로 게시 — 향후 관리자 UI 필요 시
-- 별도 SECURITY DEFINER 함수로 추가).

alter table guardian_consents enable row level security;
create policy "관리자/본인학생/보호자 조회" on guardian_consents for select
  using (
    is_admin()
    or student_id = auth.uid()
    or exists (
      select 1 from household_members hm
      join household_members child
        on child.household_id = hm.household_id and child.role = 'child' and child.profile_id = guardian_consents.student_id
      where hm.role = 'guardian' and hm.profile_id = auth.uid()
    )
  );

alter table privacy_review_tasks enable row level security;
create policy "관리자만 조회" on privacy_review_tasks for select using (is_admin());

-- =========================================================================
-- 2) 판정 함수
-- =========================================================================

-- 학생인데 date_of_birth가 없으면 fail-closed(13세 미만으로 취급 — 차단).
-- 비학생 역할은 이 판정과 무관(항상 false). 서버 시간대 차이로 결과가
-- 달라지지 않도록 UTC 기준 날짜로 고정 비교한다.
create or replace function public.is_under_13(p_student_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (
      select case
        when p.role <> 'student' then false
        when p.date_of_birth is null then true
        else (p.date_of_birth + interval '13 years') > (now() at time zone 'utc')::date
      end
      from profiles p where p.id = p_student_id
    ),
    true
  );
$$;
revoke execute on function public.is_under_13(uuid) from public;
grant execute on function public.is_under_13(uuid) to authenticated, anon;
-- (has_capability류와 달리 이 함수는 대상 학생의 민감 정보를 직접 반환하지
-- 않고 boolean 하나만 반환하며, 아래 게이트 함수들이 반드시 self-only로
-- 감싸 쓰므로 anon에도 열어도 안전하다 — current_account_access_allowed()가
-- 그 예다.)

create or replace function public.has_valid_guardian_consent(p_student_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from guardian_consents gc
    join consent_policy_versions consented_ver on consented_ver.id = gc.policy_version_id
    where gc.student_id = p_student_id
      and gc.revoked_at is null
      and not exists (
        select 1 from consent_policy_versions newer
        where newer.requires_reconsent
          and newer.effective_from > consented_ver.effective_from
      )
  );
$$;
revoke execute on function public.has_valid_guardian_consent(uuid) from public;
grant execute on function public.has_valid_guardian_consent(uuid) to authenticated, anon;

-- 최종 이용 가능 여부 = 계정 lifecycle(active) AND (13세 이상이거나 유효한
-- 동의가 있음). self-only(auth.uid() 고정)라 anon/authenticated에 안전하게
-- 열 수 있다 — R1의 current_user_has_capability()와 동일 패턴.
create or replace function public.current_account_access_allowed()
returns boolean
language sql stable security definer set search_path = public as $$
  select current_account_active()
    and (not is_under_13(auth.uid()) or has_valid_guardian_consent(auth.uid()));
$$;
grant execute on function public.current_account_access_allowed() to anon, authenticated;

-- =========================================================================
-- 3) 동의 기록·철회
-- =========================================================================

-- 보호자 본인이 인증된 세션으로 자기 household의 자녀에게만 동의를 기록한다.
-- 학생 본인, 다른 household의 보호자, 일반 관리자(이 함수로는)는 차단된다 —
-- 관리자의 수동 확인 경로는 record_manual_guardian_consent()로 별도 분리.
create or replace function public.consent_as_guardian(
  p_student_id uuid,
  p_policy_version_id uuid,
  p_notice_delivered_at timestamptz
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if auth.uid() = p_student_id then
    raise exception '학생 본인은 동의할 수 없습니다.';
  end if;
  if not exists (
    select 1 from household_members hm
    join household_members child
      on child.household_id = hm.household_id and child.role = 'child' and child.profile_id = p_student_id
    where hm.role = 'guardian' and hm.profile_id = auth.uid()
  ) then
    raise exception '해당 학생의 보호자만 동의할 수 있습니다.';
  end if;
  if not exists (select 1 from consent_policy_versions where id = p_policy_version_id and retired_at is null) then
    raise exception '유효하지 않은 정책 버전입니다.';
  end if;

  insert into guardian_consents (
    student_id, policy_version_id, consented_by, verification_method, notice_delivered_at
  ) values (
    p_student_id, p_policy_version_id, auth.uid(), 'household_guardian_session', p_notice_delivered_at
  )
  returning id into v_id;

  return v_id;
end;
$$;
revoke execute on function public.consent_as_guardian(uuid, uuid, timestamptz) from public;
grant execute on function public.consent_as_guardian(uuid, uuid, timestamptz) to authenticated;

-- 관리자가 (예: 오프라인으로 확인된 서면 동의 등) 수동으로 검증한 경우의
-- 별도 경로. 증빙 참조(verification_reference)를 필수로 요구해 "일반
-- 관리자의 임의 동의 생성"과 구분되는 감사 흔적을 남긴다.
create or replace function public.record_manual_guardian_consent(
  p_student_id uuid,
  p_policy_version_id uuid,
  p_consented_by uuid,
  p_verification_reference text,
  p_notice_delivered_at timestamptz
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not is_admin() then
    raise exception '관리자만 수동 동의를 기록할 수 있습니다.';
  end if;
  if p_verification_reference is null or length(trim(p_verification_reference)) = 0 then
    raise exception '수동 확인 증빙(verification_reference)이 필요합니다.';
  end if;
  if not exists (select 1 from consent_policy_versions where id = p_policy_version_id and retired_at is null) then
    raise exception '유효하지 않은 정책 버전입니다.';
  end if;

  insert into guardian_consents (
    student_id, policy_version_id, consented_by, verification_method, verification_reference, notice_delivered_at
  ) values (
    p_student_id, p_policy_version_id, p_consented_by, 'manual_admin_verification', p_verification_reference, p_notice_delivered_at
  )
  returning id into v_id;

  return v_id;
end;
$$;
revoke execute on function public.record_manual_guardian_consent(uuid, uuid, uuid, text, timestamptz) from public;
grant execute on function public.record_manual_guardian_consent(uuid, uuid, uuid, text, timestamptz) to authenticated;

-- 철회: 본인(동의를 기록한 보호자, 여전히 활성 guardian이어야 함) 또는
-- 관리자만. 즉시 이용 자격을 차단하되(current_account_access_allowed()가
-- 다음 요청부터 false) account status는 건드리지 않는다 — 계정 lifecycle과
-- 분리 원칙. privacy_review_tasks를 자동 생성해 보관정책 재검토를 유도한다.
create or replace function public.revoke_guardian_consent(p_consent_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_consent guardian_consents%rowtype;
  v_is_active_guardian boolean;
begin
  select * into v_consent from guardian_consents where id = p_consent_id;
  if not found then
    raise exception '존재하지 않는 동의 기록입니다.';
  end if;
  if v_consent.revoked_at is not null then
    return; -- 이미 철회됨 — 멱등
  end if;

  v_is_active_guardian := exists (
    select 1 from household_members hm
    join household_members child
      on child.household_id = hm.household_id and child.role = 'child' and child.profile_id = v_consent.student_id
    where hm.role = 'guardian' and hm.profile_id = auth.uid()
  );
  if not (is_admin() or (auth.uid() = v_consent.consented_by and v_is_active_guardian)) then
    raise exception '본인(동의를 기록한 보호자) 또는 관리자만 철회할 수 있습니다.';
  end if;

  perform set_config('app.bypass_consent_protect', 'true', true);
  update guardian_consents
  set revoked_at = now(), revoked_by = auth.uid(), revocation_reason = p_reason
  where id = p_consent_id;
  perform set_config('app.bypass_consent_protect', 'false', true);

  insert into privacy_review_tasks (student_id, reason, created_by)
  values (
    v_consent.student_id,
    coalesce('guardian consent revoked: ' || p_reason, 'guardian consent revoked'),
    auth.uid()
  );
end;
$$;
revoke execute on function public.revoke_guardian_consent(uuid, text) from public;
grant execute on function public.revoke_guardian_consent(uuid, text) to authenticated;

-- =========================================================================
-- 4) date_of_birth 자기수정 차단 — 보호자/관리자 경로로만 변경 가능
-- =========================================================================
create or replace function public.protect_date_of_birth()
returns trigger language plpgsql as $$
begin
  if new.date_of_birth is distinct from old.date_of_birth then
    if not (
      is_admin()
      or exists (
        select 1 from household_members hm
        join household_members child
          on child.household_id = hm.household_id and child.role = 'child' and child.profile_id = new.id
        where hm.role = 'guardian' and hm.profile_id = auth.uid()
      )
    ) then
      raise exception '생년월일은 본인이 직접 수정할 수 없습니다 — 보호자 또는 관리자만 변경할 수 있습니다.';
    end if;
  end if;
  return new;
end;
$$;
create trigger profiles_protect_date_of_birth
  before update of date_of_birth on profiles
  for each row execute function public.protect_date_of_birth();

-- "본인 프로필 수정" RLS는 self-only(id = auth.uid()) 또는 관리자만 허용한다.
-- 보호자는 자신이 그 행의 주인이 아니므로 profiles에 대한 일반 UPDATE 권한이
-- 전혀 없다 — 위 protect_date_of_birth의 보호자 분기까지 도달할 direct UPDATE
-- 경로 자체가 없다는 뜻이다. 그래서 보호자가 자녀 생년월일만 좁게 변경할 수
-- 있는 전용 함수를 별도로 둔다(다른 프로필 컬럼까지 열어주지 않기 위해
-- 일부러 이 함수 하나로 제한한다). protect_date_of_birth 트리거는 이 함수를
-- 통한 경로에도 그대로 적용되어 이중 방어선 역할을 한다.
create or replace function public.set_student_date_of_birth(p_student_id uuid, p_date_of_birth date)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (
    is_admin()
    or exists (
      select 1 from household_members hm
      join household_members child
        on child.household_id = hm.household_id and child.role = 'child' and child.profile_id = p_student_id
      where hm.role = 'guardian' and hm.profile_id = auth.uid()
    )
  ) then
    raise exception '해당 학생의 보호자 또는 관리자만 생년월일을 변경할 수 있습니다.';
  end if;
  if not exists (select 1 from profiles where id = p_student_id and role = 'student') then
    raise exception '학생 프로필이 아닙니다: %', p_student_id;
  end if;

  update profiles set date_of_birth = p_date_of_birth where id = p_student_id;
end;
$$;
revoke execute on function public.set_student_date_of_birth(uuid, date) from public;
grant execute on function public.set_student_date_of_birth(uuid, date) to authenticated;

-- =========================================================================
-- 5) transition_account_status() 확장 — 13세 미만 학생의 active 전환에는
--    유효한 보호자 동의가 필요하다(계정 lifecycle의 "진입 조건"으로만
--    결합하고, 동의 자체가 상태를 바꾸지는 않는다 — 반대 방향 결합 없음).
-- =========================================================================
create or replace function public.transition_account_status(p_profile_id uuid, p_new_status text, p_reason text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_role profile_role;
  v_current text;
  v_valid boolean;
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
    ('closure_pending', 'closed')
  );

  if not v_valid then
    raise exception '허용되지 않는 상태 전이입니다: % → %', v_current, p_new_status;
  end if;

  if v_role = 'student' and p_new_status = 'active' and is_under_13(p_profile_id) and not has_valid_guardian_consent(p_profile_id) then
    raise exception '13세 미만 학생은 유효한 보호자 동의 없이 active로 전환할 수 없습니다.';
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
