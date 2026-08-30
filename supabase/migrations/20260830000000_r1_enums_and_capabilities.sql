-- R1 — v3 스키마 1/12: 신규 enum + supervisor capability 기반
--
-- 명명 규칙: 기존 enum(contract_status, session_status, payout_status 등)과 이름이
-- 겹치지 않도록 신규 v3 enum은 전부 `v3_` 접두어를 쓴다. 기존 테이블·enum은 이
-- 마이그레이션에서 변경·삭제하지 않는다(Gate B §6.2 3단계, DROP 없음).

create type v3_household_member_role as enum ('guardian', 'child');

create type v3_contract_status as enum (
  'draft', 'ready', 'sent', 'awaiting_signature', 'signed', 'active',
  'termination_pending', 'terminated', 'void', 'superseded', 'expired'
);

create type v3_subject_enrollment_status as enum ('planned', 'active', 'paused', 'completed', 'terminated');

create type v3_teacher_assignment_status as enum ('planned', 'active', 'ended');

create type v3_reservation_kind as enum ('consult', 'lesson');
create type v3_reservation_status as enum ('holding', 'confirmed', 'cancelled', 'failed', 'reconciliation_needed');

create type v3_session_final_status as enum (
  'scheduled', 'live', 'completed',
  'student_cancelled', 'teacher_cancelled', 'student_no_show', 'teacher_no_show',
  'company_cancelled', 'interrupted'
);
create type v3_session_status_event_type as enum ('completed', 'reopened', 'recompleted',
  'student_cancelled', 'teacher_cancelled', 'student_no_show', 'teacher_no_show',
  'company_cancelled', 'interrupted');

create type v3_entitlement_event_type as enum ('grant', 'hold', 'release', 'consume', 'expire', 'refund', 'transfer', 'adjust');

create type v3_makeup_reason as enum ('teacher_late', 'teacher_partial_interruption', 'company_meet_interruption');
create type v3_makeup_event_type as enum ('applied', 'adjust');

create type v3_payout_item_status as enum ('pending', 'approved', 'batched', 'paid');
create type v3_payout_batch_status as enum ('draft', 'reviewing', 'approved', 'processing', 'paid', 'failed');

create type v3_drive_job_status as enum ('queued', 'processing', 'succeeded', 'retryable_failed', 'manual_review');

create type v3_payment_attempt_status as enum ('created', 'processing', 'succeeded', 'failed', 'cancelled', 'reconciliation_needed');
create type v3_refund_status as enum ('requested', 'reviewing', 'approved', 'rejected', 'processing', 'succeeded', 'failed');

create type v3_external_event_status as enum ('received', 'processing', 'succeeded', 'retryable_failed', 'manual_review');

create type v3_subject_thread_status as enum ('active', 'archived');
create type v3_subject_thread_participant_role as enum ('child', 'guardian', 'teacher');

-- Supervisor capability 조합(R0 §5.1 원칙 4 — 역할명이 아니라 capability 조합)
create table supervisor_capabilities (
  profile_id uuid not null references profiles (id) on delete cascade,
  capability text not null,
  granted_by uuid references profiles (id),
  granted_at timestamptz not null default now(),
  primary key (profile_id, capability)
);

create or replace function public.has_capability(p_profile_id uuid, p_capability text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from supervisor_capabilities
    where profile_id = p_profile_id and capability = p_capability
  );
$$;

comment on function public.has_capability(uuid, text) is
  'R0 §5.1 원칙 4: Supervisor는 역할 문자열이 아니라 capability 조합으로 권한을 받는다. p_profile_id를 인자로 받아 임의의 프로필을 조회하므로 RLS 정책 안에서는 쓰지 않는다 — 대신 current_user_has_capability()를 쓴다. 관리자 화면에서 특정 사용자의 capability를 조회할 때는 서버 액션이 service_role로만 호출한다(일반 authenticated에는 열지 않음 — 아래 참고).';

-- (2026-08-30 추가) SECURITY DEFINER 함수는 기본적으로 PUBLIC에 EXECUTE가 열려있다.
-- Gate B §7 원칙대로 명시적으로 PUBLIC/anon을 revoke하고 실제 호출 주체에게만
-- grant한다. p_profile_id를 호출자가 임의로 지정할 수 있어(자기 자신의 auth.uid()로
-- 필터링하지 않음) anon에 열면 "다른 프로필이 어떤 capability를 가졌는지" 그대로
-- 조회 가능한 정보 노출이 생긴다.
--
-- (2026-08-30 정정, 사용자 요청) RLS 35건 전부 current_user_has_capability()로
-- 전환되면서 이 함수를 RLS에서 쓸 이유가 없어졌다. 그런데도 authenticated 전체에
-- grant돼 있으면, 일반 로그인 사용자가 RPC로 has_capability('<다른 사용자 uuid>',
-- '결제권한')처럼 직접 호출해 타인의 capability 보유 여부를 알아낼 수 있다 —
-- anon에게만 닫고 authenticated 전체를 열어두면 막히지 않는 바로 그 구멍이다.
-- authenticated에서도 revoke하고 service_role에만 명시적으로 grant한다. 관리자
-- 화면에서 타 사용자의 capability를 조회해야 하면 클라이언트가 이 함수를 직접
-- 호출하지 않고, 서버 액션이 service_role 클라이언트로 호출해 대신 조회한다.
revoke execute on function public.has_capability(uuid, text) from public, anon, authenticated;
grant execute on function public.has_capability(uuid, text) to service_role;

-- (2026-08-30 추가, 사용자 요청) RLS 정책은 전부 has_capability(auth.uid(), ...) 형태로만
-- 호출했는데, 이 함수 자체가 anon에서 revoke돼 있어 anon이 이 정책이 걸린 테이블을
-- 조회하면 빈 결과가 아니라 "permission denied for function has_capability" 하드
-- 오류가 났다(실행 로그 §6-3/§6-7 참고). has_capability(uuid, text)를 그대로 anon에
-- 열면 앞서 설명한 임의 프로필 조회 문제가 생기므로, 대신 auth.uid()만 사용하고
-- anon(= auth.uid() is null)이면 항상 false를 반환하는 별도 헬퍼를 만들어 RLS
-- 정책에서는 이 헬퍼만 쓰도록 전환한다. 다른 사용자의 profile_id를 인자로 넘길 수
-- 없는 구조라 anon에 열어도 정보 노출이 없다(is_admin()/is_guardian_of()와 동일한
-- 안전 패턴).
create or replace function public.current_user_has_capability(p_capability text)
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when auth.uid() is null then false
    else exists (
      select 1 from supervisor_capabilities
      where profile_id = auth.uid() and capability = p_capability
    )
  end;
$$;

comment on function public.current_user_has_capability(text) is
  '현재 로그인 사용자(auth.uid()) 기준으로만 capability를 확인한다. RLS 정책에서는 has_capability(uuid, text) 대신 이 함수를 쓴다 — anon(auth.uid() is null)은 항상 false라 anon에도 안전하게 열 수 있다.';

revoke execute on function public.current_user_has_capability(text) from public;
grant execute on function public.current_user_has_capability(text) to anon, authenticated;
