-- R2 — Task 2 (2/2): 공통 계정 수명주기 — 컬럼 추가 + 강제 로직
-- (2026-08-30 전면 재작성 — 1차 검토에서 지적된 3가지 우회/설계 결함 반영:
--  1. fail-open 제거: NULL/불완전한 계정은 'unknown'으로 반드시 차단한다.
--  2. 임의 사용자 상태 조회 차단: get_account_status(uuid)는 service_role
--     전용으로 좁히고, 본인 상태만 조회하는 current_account_status()를
--     anon/authenticated에 연다(has_capability(uuid,text) 사건과 동일 패턴).
--  3. 상태 전이를 명시적으로 검증하는 transition_account_status()를 유일한
--     정상 경로로 만들고, 감사 이력(account_status_events)을 남긴다 —
--     관리자의 직접 UPDATE도 더 이상 허용하지 않는다(기존엔 관리자는
--     예외로 허용했었다).
--
-- 이 파일은 20260831010000에서 추가한 enum 값을 실제로 쓴다(같은 트랜잭션에서
-- 추가+사용이 불가능한 Postgres 제약 때문에 파일을 분리했다).

-- ---------------------------------------------------------------------------
-- 컬럼 추가
-- ---------------------------------------------------------------------------
alter table parents add column status parent_status not null default 'active';
comment on column parents.status is 'R2 §5.7: 공통 계정 수명주기. 기존 5명 실사용자 데이터는 전부 컬럼이 없던 상태였으므로 기본값 active로 백필된다(기존 동작과 동일 — 지금까지 parents는 사실상 전부 활성 취급이었다).';

alter table profiles add column timezone text;
alter table profiles add column date_of_birth date;
comment on column profiles.timezone is 'R2 §4.21: IANA 타임존(예: Asia/Seoul). NULL이면 앱이 household 기본값 또는 America/Los_Angeles로 대체한다.';
comment on column profiles.date_of_birth is 'R2 §4.13 확장: 13세 미만 판별용(주로 학생). 보호자/선생님/관리자는 사용하지 않는다.';

alter table households add column default_timezone text not null default 'America/Los_Angeles';
comment on column households.default_timezone is 'R2 §4.21: household 기본 타임존. 학생은 이 값을 상속하되 profiles.timezone으로 개별 재정의할 수 있다.';

-- ---------------------------------------------------------------------------
-- account_status_events: 상태 전환 감사 이력. 누가·언제·왜·어떤 전이를
-- 했는지 영구 보존한다(INSERT-only — R1의 entitlement_ledger와 동일 패턴).
-- ---------------------------------------------------------------------------
create table account_status_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id),
  previous_status text not null,
  new_status text not null,
  changed_by uuid references profiles (id),
  reason text,
  created_at timestamptz not null default now()
);
create index on account_status_events (profile_id);

create or replace function public.reject_account_status_event_mutation()
returns trigger
language plpgsql as $$
begin
  raise exception 'account_status_events는 INSERT-only입니다.';
end;
$$;
create trigger account_status_events_no_update
  before update or delete on account_status_events
  for each row execute function public.reject_account_status_event_mutation();
revoke execute on function public.reject_account_status_event_mutation() from public, anon, authenticated, service_role;

alter table account_status_events enable row level security;
create policy "본인/관리자 조회" on account_status_events for select
  using (profile_id = auth.uid() or is_admin());
-- insert 정책 없음(기본 거부) — transition_account_status() SECURITY DEFINER만 기록 가능.

-- ---------------------------------------------------------------------------
-- get_account_status(p_profile_id): 역할별 상태 테이블을 찾아 판정하는 내부
-- 판정 함수. **fail-closed**: p_profile_id가 NULL이거나, profiles에 해당
-- 행이 없거나, role이 매칭되는 상태 테이블에 행이 없으면 전부 'unknown'을
-- 반환한다(예전엔 이 세 경우 전부 'active'를 반환하는 fail-open 버그였다).
-- admin만 예외적으로 'active'로 취급한다(이번 상태 모델의 게이트 대상이
-- 아니라는 명시적 정책 — §5.7/R2 정책 확정 10번, "슈퍼 관리자는 전체 허용").
--
-- **임의 사용자 조회 제한**: 이 함수는 인자로 받은 임의의 p_profile_id를
-- 그대로 조회한다 — has_capability(uuid,text)와 같은 위험(누구든 타인의
-- 계정 상태를 알아낼 수 있음)이 있으므로 anon/authenticated에는 절대 열지
-- 않는다(아래에서 service_role 전용으로 revoke/grant). 일반 사용자는 본인
-- 상태만 조회하는 current_account_status()(아래)를 대신 쓴다.
-- ---------------------------------------------------------------------------
create or replace function public.get_account_status(p_profile_id uuid)
returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v_role profile_role;
  v_status text;
begin
  if p_profile_id is null then
    return 'unknown';
  end if;

  select role into v_role from profiles where id = p_profile_id;
  if v_role is null then
    return 'unknown';
  end if;

  if v_role = 'admin' then
    return 'active';
  elsif v_role = 'student' then
    select status::text into v_status from students where id = p_profile_id;
  elsif v_role = 'teacher' then
    select status::text into v_status from teachers where id = p_profile_id;
  elsif v_role = 'parent' then
    select status::text into v_status from parents where id = p_profile_id;
  else
    return 'unknown';
  end if;

  return coalesce(v_status, 'unknown');
end;
$$;

create or replace function public.is_account_active(p_profile_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select get_account_status(p_profile_id) = 'active';
$$;

comment on function public.get_account_status(uuid) is 'R2 §5.7: 역할별 상태 테이블에서 계정 상태 문자열을 반환한다. fail-closed — NULL/불완전한 계정은 unknown. 임의 프로필 조회가 가능해 service_role 전용(anon/authenticated는 current_account_status() 사용).';
comment on function public.is_account_active(uuid) is 'get_account_status()가 active인지만 확인. get_account_status(uuid)와 동일하게 service_role 전용(anon/authenticated는 current_account_active() 사용).';

revoke execute on function public.get_account_status(uuid) from public, anon, authenticated;
grant execute on function public.get_account_status(uuid) to service_role;
revoke execute on function public.is_account_active(uuid) from public, anon, authenticated;
grant execute on function public.is_account_active(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- current_account_status()/current_account_active(): auth.uid() 기준
-- 본인 상태만 확인하는 안전한 축약형 — 인자가 없어 타인 조회가 구조적으로
-- 불가능하다(is_guardian_of()/current_user_has_capability()와 동일 안전
-- 패턴). RLS 정책과 앱의 로그인 게이트는 전부 이 두 함수만 쓴다.
-- ---------------------------------------------------------------------------
create or replace function public.current_account_status()
returns text
language sql stable security definer set search_path = public as $$
  select get_account_status(auth.uid());
$$;

create or replace function public.current_account_active()
returns boolean
language sql stable security definer set search_path = public as $$
  select current_account_status() = 'active';
$$;

comment on function public.current_account_status() is 'R2 §5.7: 로그인한 본인의 계정 상태만 반환(auth.uid() 고정) — anon은 항상 unknown, 정보 노출 없이 안전하게 anon/authenticated에 연다.';
comment on function public.current_account_active() is 'current_account_status() = active 축약형. RLS 정책에서 쓰는 공식 진입점.';

revoke execute on function public.current_account_status() from public;
grant execute on function public.current_account_status() to anon, authenticated;
revoke execute on function public.current_account_active() from public;
grant execute on function public.current_account_active() to anon, authenticated;
-- anon 포함 — auth.uid()가 고정이라 인자로 임의 타인을 조회할 수 없다.
-- anon 호출 시 auth.uid()가 NULL이라 get_account_status(NULL) = 'unknown'을
-- 반환하지만, RLS에서는 항상 다른 소유권 조건과 AND로 결합해 쓰이므로
-- (예: "본인 스레드 그리고 current_account_active()") 실제 익명 접근은 그
-- 소유권 조건에서 이미 막힌다 — anon을 제외하면 §6-3/§6-7과 같은
-- "permission denied" 하드 오류가 재발한다.

-- ---------------------------------------------------------------------------
-- 상태 컬럼 보호: transition_account_status() 내부의 원자적 UPDATE
-- 한 문장만 통과시키고, 그 외 모든 직접 UPDATE(관리자 포함)를 차단한다 —
-- R1의 teacher_rate_history_protect + set_teacher_rate() 패턴과 동일.
-- 예전 버전은 관리자의 직접 UPDATE를 예외로 허용했지만, 그러면 아래
-- transition_account_status()가 강제하는 "허용된 전이만 통과" 규칙과
-- 감사 이력 기록을 관리자가 그냥 우회할 수 있었다 — 이번에 막는다.
-- ---------------------------------------------------------------------------
create or replace function public.protect_account_status()
returns trigger
language plpgsql as $$
begin
  if new.status is distinct from old.status
     and coalesce(current_setting('app.bypass_status_protect', true), 'false') != 'true' then
    raise exception '계정 상태(status)는 transition_account_status()를 통해서만 변경할 수 있습니다.';
  end if;
  return new;
end;
$$;
revoke execute on function public.protect_account_status() from public, anon, authenticated, service_role;
-- 트리거 전용 — Gate B §7 점검 원칙에 따라 명시적으로 revoke.

create trigger students_protect_status
  before update of status on students
  for each row execute function public.protect_account_status();
create trigger teachers_protect_status
  before update of status on teachers
  for each row execute function public.protect_account_status();
create trigger parents_protect_status
  before update of status on parents
  for each row execute function public.protect_account_status();

-- ---------------------------------------------------------------------------
-- transition_account_status(): 계정 상태 전환의 유일한 정상 경로.
-- 허용된 전이만 통과시키고(그 외 전부 명시적으로 거부), 감사 이력을 남긴다.
--   pending      → active            (승인)
--   active       → suspended         (일시정지)
--   suspended    → active            (재활성화)
--   active       → closure_pending   (탈퇴/폐쇄 시작)
--   suspended    → closure_pending   (탈퇴/폐쇄 시작)
--   closure_pending → closed         (폐쇄 완료)
--   closed → (전이 없음, 종착 상태)
-- 그 외 조합(예: pending→suspended, active→pending, closed→그 무엇이든)은
-- 전부 거부한다. admin 역할 프로필은 이 함수의 대상이 아니다(get_account_status
-- 에서 admin은 항상 active로 취급되며 상태 컬럼 자체가 없다).
-- ---------------------------------------------------------------------------
create or replace function public.transition_account_status(
  p_profile_id uuid,
  p_new_status text,
  p_reason text default null
)
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

comment on function public.transition_account_status(uuid, text, text) is 'R2 §5.7: 계정 상태 전환의 유일한 정상 경로. 허용된 전이만 통과, 감사 이력(account_status_events) 자동 기록. is_admin()을 내부에서 검사하므로 실제 관리자 세션(authenticated)으로 호출해야 한다 — service_role로 호출하면 auth.uid()가 없어 is_admin() 검사에서 거부된다(reopen_session()/recomplete_session()과 동일 설계).';

revoke execute on function public.transition_account_status(uuid, text, text) from public, anon, service_role;
grant execute on function public.transition_account_status(uuid, text, text) to authenticated;
-- reopen_session()/recomplete_session()과 동일 패턴 — 실제 관리자 JWT가
-- 필요하므로 service_role은 일부러 제외한다(불필요하고, 호출해도 auth.uid()
-- 없이는 is_admin() 검사를 통과할 수 없다).

-- ---------------------------------------------------------------------------
-- 메시지 전송 차단: chat_messages "스레드 당사자 전송" INSERT 정책에
-- current_account_active() 추가.
-- ---------------------------------------------------------------------------
drop policy "스레드 당사자 전송" on chat_messages;
create policy "스레드 당사자 전송" on chat_messages for insert
  with check (exists (
    select 1 from chat_threads t where t.id = thread_id
      and (t.student_id = auth.uid() or t.teacher_id = auth.uid())
  ) and current_account_active());
