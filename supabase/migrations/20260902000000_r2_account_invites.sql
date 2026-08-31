-- R2 Task 4 — 계정 초대(account_invites) 상태 모델
--
-- 범위: 관리자→보호자 초대, 관리자/보호자→자녀 초대만 다룬다. 선생님 초대는
-- Google Workspace 프로비저닝(R2 Task 7)에서 완전히 다른 방식(개인 이메일 수집
-- → Workspace 계정 발급 → 최초 로그인 연결)으로 대체될 예정이라 이 테이블에
-- role='teacher'는 아예 허용하지 않는다(app/admin/users-actions.ts의
-- inviteTeacher()는 이 마이그레이션과 별개로 앱 레벨에서 비활성화한다).
--
-- 토큰 설계: Supabase 기본 초대 링크(자체 만료 정책)에 의존하지 않고 ALTON 자체
-- 랜덤 토큰을 발급해 해시만 저장한다(원문은 이메일 발송 시점에만 존재, DB에는
-- 절대 남지 않는다). 만료 7일, 재발송마다 새 generation(=새 행)을 만들고 이전
-- 토큰은 즉시 superseded 처리해 구 토큰으로는 수락할 수 없다.

create type account_invite_role as enum ('parent', 'student');
create type account_invite_status as enum ('pending', 'accepted', 'expired', 'revoked', 'superseded', 'failed', 'manual_review');
create type account_invite_event_type as enum ('sent', 'resent', 'accepted', 'revoked', 'expired', 'failed', 'manual_review', 'superseded');

create table account_invites (
  id uuid primary key default gen_random_uuid(),
  email_normalized text not null,
  email_original text not null,
  invitee_name text not null,
  invitee_grade text,
  role account_invite_role not null,
  household_id uuid references households (id),
  invited_by uuid not null references profiles (id),
  status account_invite_status not null default 'pending',
  token_hash text not null,
  token_generation int not null default 1,
  expires_at timestamptz not null,
  last_sent_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  superseded_by_id uuid references account_invites (id),
  auth_user_id uuid,
  target_profile_id uuid references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_invites_student_requires_household
    check (role <> 'student' or household_id is not null),
  constraint account_invites_parent_has_no_household
    check (role <> 'parent' or household_id is null)
);
create index on account_invites (token_hash);
create index on account_invites (email_normalized, role);
create index on account_invites (household_id) where household_id is not null;
create index on account_invites (invited_by);

-- 동일 이메일·역할·household에 활성 pending 초대 최대 1개. household_id가 NULL인
-- 보호자 초대에도 실제로 작동해야 하므로 NULLS NOT DISTINCT를 쓴다(PG15+) — 그냥
-- (email_normalized, role, household_id) where status='pending'만 쓰면 NULL은
-- 서로 다른 값으로 취급돼 같은 이메일로 보호자 초대를 몇 번이든 중복 생성할 수 있다.
create unique index account_invites_pending_unique
  on account_invites (email_normalized, role, household_id) nulls not distinct
  where status = 'pending';

create table account_invite_events (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references account_invites (id),
  event_type account_invite_event_type not null,
  actor_id uuid references profiles (id),
  detail jsonb,
  created_at timestamptz not null default now()
);
create index on account_invite_events (invite_id, created_at desc);

alter table account_invites enable row level security;
alter table account_invite_events enable row level security;

-- 관리자는 전체 조회, 보호자는 본인이 발송한 것만. 수락(로그인 전, anon)은 이
-- RLS를 거치지 않고 token hash를 검증하는 claim_account_invite()로만 처리한다.
create policy "관리자/발송자 조회" on account_invites for select
  using (is_admin() or invited_by = auth.uid());
create policy "관리자/발송자 이벤트 조회" on account_invite_events for select
  using (
    is_admin()
    or exists (select 1 from account_invites ai where ai.id = account_invite_events.invite_id and ai.invited_by = auth.uid())
  );

-- 이 두 테이블은 모든 쓰기가 아래 SECURITY DEFINER 함수를 통해서만 일어난다 —
-- INSERT/UPDATE/DELETE에 대한 RLS 정책을 아예 만들지 않는다(authenticated/anon은
-- 기본적으로 거부, service_role은 RLS를 우회하므로 별도 보호가 필요한 부분만
-- 아래 protect 트리거로 막는다).

create or replace function public.protect_account_invite_status()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status
     and coalesce(current_setting('app.bypass_invite_protect', true), '') <> 'true' then
    raise exception '초대 상태는 지정된 함수(create/resend/accept/finalize/revoke)를 통해서만 변경할 수 있습니다.';
  end if;
  return new;
end;
$$;

create trigger account_invites_protect_status
  before update of status on account_invites
  for each row execute function public.protect_account_invite_status();

-- =========================================================================
-- create_account_invite — 최초 발송(관리자→보호자, 관리자/보호자→자녀)
-- =========================================================================
create or replace function public.create_account_invite(
  p_email text,
  p_name text,
  p_role text,
  p_household_id uuid,
  p_grade text default null
) returns table (invite_id uuid, raw_token text)
language plpgsql security definer set search_path = public as $$
declare
  v_email_normalized text := lower(trim(p_email));
  v_raw_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash text := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  if p_role = 'parent' then
    if not is_admin() then
      raise exception '보호자 초대는 관리자만 할 수 있습니다.';
    end if;
    if p_household_id is not null then
      raise exception '보호자 초대는 household_id를 지정할 수 없습니다.';
    end if;
  elsif p_role = 'student' then
    if p_household_id is null then
      raise exception '학생(자녀) 초대는 household_id가 필요합니다.';
    end if;
    if not (
      is_admin()
      or exists (
        select 1 from household_members hm
        where hm.household_id = p_household_id and hm.profile_id = auth.uid() and hm.role = 'guardian'
      )
    ) then
      raise exception '본인 household에만 자녀를 초대할 수 있습니다.';
    end if;
  else
    raise exception '지원하지 않는 초대 역할입니다: %(선생님 초대는 이 테이블 범위 밖입니다)', p_role;
  end if;

  insert into account_invites (
    email_normalized, email_original, invitee_name, invitee_grade, role, household_id, invited_by,
    token_hash, expires_at, last_sent_at
  ) values (
    v_email_normalized, p_email, p_name, p_grade, p_role::account_invite_role, p_household_id, auth.uid(),
    v_token_hash, now() + interval '7 days', now()
  )
  returning id into v_id;

  insert into account_invite_events (invite_id, event_type, actor_id, detail)
  values (v_id, 'sent', auth.uid(), jsonb_build_object('email', p_email));

  return query select v_id, v_raw_token;
end;
$$;
revoke execute on function public.create_account_invite(text, text, text, uuid, text) from public;
grant execute on function public.create_account_invite(text, text, text, uuid, text) to authenticated;

-- =========================================================================
-- resend_account_invite — 재발송(새 generation 발급, 이전 토큰 즉시 superseded)
-- =========================================================================
create or replace function public.resend_account_invite(p_invite_id uuid)
returns table (invite_id uuid, raw_token text)
language plpgsql security definer set search_path = public as $$
declare
  v_row account_invites%rowtype;
  v_resend_count int;
  v_new_id uuid;
  v_raw_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash text := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');
begin
  select * into v_row from account_invites where id = p_invite_id for update;
  if not found then
    raise exception '존재하지 않는 초대입니다.';
  end if;
  if not (is_admin() or v_row.invited_by = auth.uid()) then
    raise exception '본인이 보낸 초대만 재발송할 수 있습니다.';
  end if;
  if v_row.status <> 'pending' then
    raise exception '대기 중(pending) 상태의 초대만 재발송할 수 있습니다(현재: %).', v_row.status;
  end if;
  if v_row.expires_at <= now() then
    -- status를 여기서 'expired'로 미리 갱신해도 바로 이어지는 RAISE EXCEPTION이
    -- 함수 전체를 롤백시켜 무의미하다 — 시간 검사만으로 재발송을 막으면 충분하고,
    -- status 컬럼 갱신은 mark_expired_invites()가 담당한다.
    raise exception '이미 만료된 초대입니다. 새로 초대해주세요.';
  end if;

  -- 24시간 내 재발송 최대 3회 — 최초 발송(sent)은 제외하고 같은 lineage(이메일+역할
  -- +household, NULL household도 안전하게 비교)의 resent 이벤트만 센다.
  select count(*) into v_resend_count
  from account_invite_events e
  join account_invites ai on ai.id = e.invite_id
  where e.event_type = 'resent'
    and e.created_at > now() - interval '24 hours'
    and ai.email_normalized = v_row.email_normalized
    and ai.role = v_row.role
    and ai.household_id is not distinct from v_row.household_id;
  if v_resend_count >= 3 then
    raise exception '24시간 내 재발송은 최대 3회까지 가능합니다.';
  end if;

  -- 이전 pending 행을 먼저 superseded로 바꿔야(email_normalized, role,
  -- household_id) 부분 unique 인덱스와 충돌 없이 새 pending 행을 넣을 수 있다.
  -- superseded_by_id는 새 행이 실제로 생긴 뒤 두 번째 UPDATE로 채운다(새 행 id를
  -- FK가 걸린 컬럼에 INSERT보다 먼저 채우면 참조 무결성 위반이 난다).
  perform set_config('app.bypass_invite_protect', 'true', true);
  update account_invites set status = 'superseded', updated_at = now() where id = v_row.id;
  perform set_config('app.bypass_invite_protect', 'false', true);

  insert into account_invites (
    email_normalized, email_original, invitee_name, invitee_grade, role, household_id, invited_by,
    token_hash, token_generation, expires_at, last_sent_at
  ) values (
    v_row.email_normalized, v_row.email_original, v_row.invitee_name, v_row.invitee_grade, v_row.role, v_row.household_id, v_row.invited_by,
    v_token_hash, v_row.token_generation + 1, now() + interval '7 days', now()
  )
  returning id into v_new_id;

  update account_invites set superseded_by_id = v_new_id where id = v_row.id;

  insert into account_invite_events (invite_id, event_type, actor_id) values (v_row.id, 'superseded', auth.uid());
  insert into account_invite_events (invite_id, event_type, actor_id) values (v_new_id, 'resent', auth.uid());

  return query select v_new_id, v_raw_token;
end;
$$;
revoke execute on function public.resend_account_invite(uuid) from public;
grant execute on function public.resend_account_invite(uuid) to authenticated;

-- =========================================================================
-- revoke_account_invite — 철회(기본은 상태만 변경, Auth 계정 삭제는 별도 함수)
-- =========================================================================
create or replace function public.revoke_account_invite(p_invite_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_row account_invites%rowtype;
begin
  select * into v_row from account_invites where id = p_invite_id for update;
  if not found then
    raise exception '존재하지 않는 초대입니다.';
  end if;
  if not (is_admin() or v_row.invited_by = auth.uid()) then
    raise exception '본인이 보낸 초대만 철회할 수 있습니다.';
  end if;
  if v_row.status not in ('pending', 'manual_review') then
    raise exception 'pending 또는 manual_review 상태의 초대만 철회할 수 있습니다(현재: %).', v_row.status;
  end if;

  perform set_config('app.bypass_invite_protect', 'true', true);
  update account_invites set status = 'revoked', revoked_at = now(), updated_at = now() where id = v_row.id;
  perform set_config('app.bypass_invite_protect', 'false', true);

  insert into account_invite_events (invite_id, event_type, actor_id) values (v_row.id, 'revoked', auth.uid());
end;
$$;
revoke execute on function public.revoke_account_invite(uuid) from public;
grant execute on function public.revoke_account_invite(uuid) to authenticated;

-- =========================================================================
-- claim_account_invite — 수락 1단계(토큰 검증 + 잠금 + 상태 전이).
-- 로그인 전 방문자가 이메일 링크를 클릭해서 호출하므로 anon도 실행 가능해야
-- 한다 — auth.uid()에 의존하지 않고 오직 토큰 소유 여부로만 인가한다.
-- =========================================================================
create or replace function public.claim_account_invite(p_token text)
returns table (
  invite_id uuid, status account_invite_status, role account_invite_role,
  email_normalized text, invitee_name text, household_id uuid,
  target_profile_id uuid, auth_user_id uuid
)
language plpgsql security definer set search_path = public as $$
declare
  v_hash text := encode(extensions.digest(p_token, 'sha256'), 'hex');
  v_row account_invites%rowtype;
  v_existing_auth_id uuid;
begin
  select * into v_row from account_invites where token_hash = v_hash for update;
  if not found then
    raise exception 'invalid_token';
  end if;

  -- 만료는 저장된 status와 무관하게 항상 시간으로 직접 검사한다 — 정기 정리
  -- 작업(mark_expired_invites())이 아직 안 돌았어도(=status가 여전히 pending
  -- 이어도) 만료된 토큰은 통과시키지 않는다. 이 함수 안에서 status를 'expired'로
  -- 미리 갱신해두려는 시도는 무의미하다 — 바로 이어지는 RAISE EXCEPTION이 함수
  -- 전체를 롤백시켜 그 UPDATE도 함께 취소되기 때문이다. status 컬럼을 실제로
  -- 'expired'로 바꾸는 건 mark_expired_invites()의 역할이고, 그게 아직 안
  -- 돌았어도 여기 시간 검사만으로 만료 토큰 수락은 항상 막힌다.
  if v_row.expires_at <= now() then
    raise exception 'expired';
  end if;

  if v_row.status = 'accepted' then
    -- 멱등: 이미 수락된 같은 토큰 재제출은 에러 없이 같은 결과를 반환한다.
    return query select v_row.id, v_row.status, v_row.role, v_row.email_normalized,
      v_row.invitee_name, v_row.household_id, v_row.target_profile_id, v_row.auth_user_id;
    return;
  end if;

  if v_row.status <> 'pending' then
    raise exception '%', v_row.status;
  end if;

  select id into v_existing_auth_id from auth.users where lower(email) = v_row.email_normalized limit 1;

  if v_existing_auth_id is not null then
    perform set_config('app.bypass_invite_protect', 'true', true);
    update account_invites set status = 'manual_review', updated_at = now() where id = v_row.id;
    perform set_config('app.bypass_invite_protect', 'false', true);
    insert into account_invite_events (invite_id, event_type, detail)
    values (v_row.id, 'manual_review', jsonb_build_object('existing_auth_user_id', v_existing_auth_id));

    return query select v_row.id, 'manual_review'::account_invite_status, v_row.role, v_row.email_normalized,
      v_row.invitee_name, v_row.household_id, v_row.target_profile_id, v_existing_auth_id;
    return;
  end if;

  perform set_config('app.bypass_invite_protect', 'true', true);
  update account_invites set status = 'accepted', accepted_at = now(), updated_at = now() where id = v_row.id;
  perform set_config('app.bypass_invite_protect', 'false', true);
  insert into account_invite_events (invite_id, event_type) values (v_row.id, 'accepted');

  return query select v_row.id, 'accepted'::account_invite_status, v_row.role, v_row.email_normalized,
    v_row.invitee_name, v_row.household_id, v_row.target_profile_id, v_row.auth_user_id;
end;
$$;
revoke execute on function public.claim_account_invite(text) from public;
grant execute on function public.claim_account_invite(text) to anon, authenticated;

-- =========================================================================
-- finalize_account_invite — 수락 2단계. Auth 사용자 생성(Node 서버 액션에서
-- admin API로 처리)이 끝난 뒤에만 호출된다. 멱등 — target_profile_id가 이미
-- 있으면 그대로 반환하고 재생성하지 않는다(수락 재시도로 인한 중복 생성 방지).
-- service_role 전용 — 신뢰된 서버 경로(Auth 계정 생성 직후)에서만 호출한다.
-- =========================================================================
create or replace function public.finalize_account_invite(p_invite_id uuid, p_auth_user_id uuid)
returns table (target_profile_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_row account_invites%rowtype;
begin
  select * into v_row from account_invites where id = p_invite_id for update;
  if not found then
    raise exception '존재하지 않는 초대입니다.';
  end if;
  if v_row.status <> 'accepted' then
    raise exception '수락(accepted) 상태의 초대만 finalize할 수 있습니다(현재: %).', v_row.status;
  end if;

  if v_row.target_profile_id is not null then
    return query select v_row.target_profile_id;
    return;
  end if;

  insert into profiles (id, role, name) values (p_auth_user_id, v_row.role::text::profile_role, v_row.invitee_name);

  if v_row.role = 'parent' then
    insert into parents (id) values (p_auth_user_id);
  elsif v_row.role = 'student' then
    insert into students (id, grade, status) values (p_auth_user_id, v_row.invitee_grade, 'pending');
    insert into household_members (household_id, profile_id, role, is_primary)
    values (v_row.household_id, p_auth_user_id, 'child', true);
  end if;

  update account_invites
  set target_profile_id = p_auth_user_id, auth_user_id = p_auth_user_id, updated_at = now()
  where id = p_invite_id;

  return query select p_auth_user_id;
end;
$$;
revoke execute on function public.finalize_account_invite(uuid, uuid) from public;
grant execute on function public.finalize_account_invite(uuid, uuid) to service_role;

-- =========================================================================
-- resolve_manual_review_invite — 관리자가 기존 계정과 안전하게 연결하거나 철회.
-- 이메일이 이미 가입돼 있다는 이유만으로 무조건 새 계정을 만들거나 기존 계정을
-- 지우지 않는다 — 관리자가 명시적으로 확인한 target_profile_id/auth_user_id로만
-- 연결한다.
-- =========================================================================
create or replace function public.resolve_manual_review_invite(
  p_invite_id uuid,
  p_action text,
  p_target_profile_id uuid,
  p_auth_user_id uuid
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_row account_invites%rowtype;
begin
  if not is_admin() then
    raise exception '관리자만 처리할 수 있습니다.';
  end if;

  select * into v_row from account_invites where id = p_invite_id for update;
  if not found then
    raise exception '존재하지 않는 초대입니다.';
  end if;
  if v_row.status <> 'manual_review' then
    raise exception 'manual_review 상태의 초대만 처리할 수 있습니다(현재: %).', v_row.status;
  end if;

  if p_action = 'revoke' then
    perform set_config('app.bypass_invite_protect', 'true', true);
    update account_invites set status = 'revoked', revoked_at = now(), updated_at = now() where id = v_row.id;
    perform set_config('app.bypass_invite_protect', 'false', true);
    insert into account_invite_events (invite_id, event_type, actor_id) values (v_row.id, 'revoked', auth.uid());
    return;
  elsif p_action = 'link' then
    if p_target_profile_id is null or p_auth_user_id is null then
      raise exception 'link 처리에는 target_profile_id와 auth_user_id가 모두 필요합니다.';
    end if;

    if v_row.role = 'student' then
      insert into household_members (household_id, profile_id, role, is_primary)
      values (v_row.household_id, p_target_profile_id, 'child', true)
      on conflict (household_id, profile_id) do nothing;
    end if;

    perform set_config('app.bypass_invite_protect', 'true', true);
    update account_invites
    set status = 'accepted', accepted_at = now(), target_profile_id = p_target_profile_id,
        auth_user_id = p_auth_user_id, updated_at = now()
    where id = v_row.id;
    perform set_config('app.bypass_invite_protect', 'false', true);

    insert into account_invite_events (invite_id, event_type, actor_id, detail)
    values (v_row.id, 'accepted', auth.uid(), jsonb_build_object('resolved_from', 'manual_review'));
  else
    raise exception '지원하지 않는 action입니다: %(link 또는 revoke만 가능)', p_action;
  end if;
end;
$$;
revoke execute on function public.resolve_manual_review_invite(uuid, text, uuid, uuid) from public;
grant execute on function public.resolve_manual_review_invite(uuid, text, uuid, uuid) to authenticated;

-- =========================================================================
-- mark_expired_invites — 정기 정리(또는 목록 조회 시점)용 배치. 시간 경과만으로
-- 자동 실행되지 않으므로 명시적으로 호출해야 한다 — claim_account_invite()는
-- 이 배치가 아직 안 돌았어도 expires_at을 직접 검사하므로 만료 토큰이 새는
-- 일은 없다(이 함수는 목록/통계 화면에 정확한 상태를 보여주기 위한 것).
-- =========================================================================
create or replace function public.mark_expired_invites()
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  if not is_admin() then
    raise exception '관리자만 실행할 수 있습니다.';
  end if;

  perform set_config('app.bypass_invite_protect', 'true', true);
  with expired as (
    update account_invites
    set status = 'expired', updated_at = now()
    where status = 'pending' and expires_at <= now()
    returning id
  )
  insert into account_invite_events (invite_id, event_type)
  select id, 'expired' from expired;
  get diagnostics v_count = row_count;
  perform set_config('app.bypass_invite_protect', 'false', true);

  return v_count;
end;
$$;
revoke execute on function public.mark_expired_invites() from public;
grant execute on function public.mark_expired_invites() to authenticated;
