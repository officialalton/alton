-- 컨설턴트 역할 Phase 1(2026-09-22 스펙 문서: docs/superpowers/specs/
-- 2026-09-22-consultant-role-and-intake-design.md) — 인테이크(intake_owner)와
-- 어드미션 컨설턴트(admissions_consultant) 책임을 분리해서 저장하되, MVP에서는
-- 둘 다 같은 사람(jiman@alton.education)을 가리켜도 된다. 이메일 자동 발송·
-- 자동배정·스케줄링 링크·메신저 라우팅은 Phase 2로 미룬다(사용자 승인:
-- "Phase 1 — 핵심만 먼저").
--
-- capability는 새 테이블을 만들지 않고 기존 supervisor_capabilities(R1,
-- profile_id+capability text pk, current_user_has_capability() RPC)를 그대로
-- 재사용한다 — 이 테이블은 role 문자열과 무관하게 임의 프로필에 capability를
-- 부여하도록 이미 설계돼 있다(20260830000000_r1_enums_and_capabilities.sql).

alter table consultations add column if not exists intake_owner_id uuid references profiles (id);
alter table consultations add column if not exists admissions_consultant_id uuid references profiles (id);
alter table consultations add column if not exists assigned_at timestamptz;
alter table consultations add column if not exists assigned_by uuid references profiles (id);
alter table consultations add column if not exists contacted_at timestamptz;

comment on column consultations.intake_owner_id is
  '스펙 §Ownership Fields — 신규 요청을 온보딩까지 진행시키는 책임자. admissions_consultant_id와 독립된 필드(MVP에서는 보통 동일인).';
comment on column consultations.admissions_consultant_id is
  '스펙 §Ownership Fields — 배정 이후 이 학생의 지속 어드미션 플랜을 담당하는 컨설턴트.';
comment on column consultations.contacted_at is
  '스펙 §Access Rules by Surface — 담당 컨설턴트가 최초 연락을 완료한 시각(연락 진행 상태 표시용).';

create index if not exists consultations_intake_owner_idx on consultations (intake_owner_id) where intake_owner_id is not null;
create index if not exists consultations_admissions_consultant_idx on consultations (admissions_consultant_id) where admissions_consultant_id is not null;

-- =========================================================================
-- 배정 이력(감사 추적) — 스펙 §Access Control and Auditing
-- =========================================================================
create table if not exists consultation_assignment_history (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references consultations (id) on delete cascade,
  field text not null check (field in ('intake_owner', 'admissions_consultant')),
  prior_owner_id uuid references profiles (id),
  new_owner_id uuid references profiles (id),
  actor_id uuid references profiles (id),
  reason text,
  changed_at timestamptz not null default now()
);
create index on consultation_assignment_history (consultation_id, changed_at desc);

comment on table consultation_assignment_history is
  '스펙 §Assignment and Handoff Rules — intake_owner/admissions_consultant 변경 감사 이력. assign_consultation_owner() RPC를 통해서만 기록된다.';

alter table consultation_assignment_history enable row level security;
create policy "관리자/인테이크 담당 조회" on consultation_assignment_history for select
  using (
    is_admin()
    or current_user_has_capability('manage_consultation_intake')
    or current_user_has_capability('assign_admissions_consultant')
  );
-- 쓰기는 assign_consultation_owner() RPC(security definer)를 통해서만 — 직접 insert 정책 없음.

-- =========================================================================
-- 배정 RPC — intake_owner/admissions_consultant를 원자적으로 바꾸고 이력을 남긴다.
-- =========================================================================
create or replace function public.assign_consultation_owner(
  p_consultation_id uuid,
  p_field text,
  p_new_owner_id uuid,
  p_reason text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_prior_owner_id uuid;
  v_can_assign boolean;
begin
  if p_field not in ('intake_owner', 'admissions_consultant') then
    raise exception 'invalid field: %', p_field;
  end if;

  -- 관리자·assign_admissions_consultant 보유자는 임의로 배정/재배정할 수 있다.
  -- manage_consultation_intake 보유자는 "미배정 요청을 자기 자신에게" 인테이크
  -- 오너로만 셀프 클레임할 수 있다(스펙 §Screen Scope — 인테이크 큐에서 직접 집는 흐름).
  v_can_assign := is_admin() or current_user_has_capability('assign_admissions_consultant');
  if not v_can_assign and p_field = 'intake_owner' and p_new_owner_id = auth.uid() then
    v_can_assign := current_user_has_capability('manage_consultation_intake');
  end if;
  if not v_can_assign then
    raise exception '이 요청의 담당자를 배정할 권한이 없습니다.';
  end if;

  if p_field = 'intake_owner' then
    select intake_owner_id into v_prior_owner_id from consultations where id = p_consultation_id;
    update consultations
    set intake_owner_id = p_new_owner_id, assigned_at = now(), assigned_by = auth.uid()
    where id = p_consultation_id;
  else
    select admissions_consultant_id into v_prior_owner_id from consultations where id = p_consultation_id;
    update consultations
    set admissions_consultant_id = p_new_owner_id, assigned_at = now(), assigned_by = auth.uid()
    where id = p_consultation_id;
  end if;

  if not found then
    raise exception '상담 요청을 찾을 수 없습니다: %', p_consultation_id;
  end if;

  insert into consultation_assignment_history (consultation_id, field, prior_owner_id, new_owner_id, actor_id, reason)
  values (p_consultation_id, p_field, v_prior_owner_id, p_new_owner_id, auth.uid(), p_reason);
end;
$$;

comment on function public.assign_consultation_owner(uuid, text, uuid, text) is
  '스펙 §Assignment and Handoff Rules — intake_owner/admissions_consultant 배정·재배정을 이력과 함께 원자적으로 처리. Phase 1은 수동 배정만 지원(자동배정 모드는 Phase 2).';

create or replace function public.mark_consultation_contacted(p_consultation_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (
    is_admin()
    or exists (select 1 from consultations where id = p_consultation_id and admissions_consultant_id = auth.uid())
  ) then
    raise exception '이 요청의 연락 상태를 바꿀 권한이 없습니다.';
  end if;
  update consultations set contacted_at = now() where id = p_consultation_id and contacted_at is null;
end;
$$;

comment on function public.mark_consultation_contacted(uuid) is
  '스펙 §Consultation Lifecycle "Contact required" → 담당 컨설턴트가 최초 연락 완료를 기록.';

-- =========================================================================
-- consultations RLS 확장 — 배정된 컨설턴트·인테이크 담당자도 조회 가능하게.
-- 기존 정책(20260912000000)을 대체한다(같은 이름 정책 drop 후 재생성 — additive
-- 마이그레이션 규칙: 이미 적용된 과거 파일은 건드리지 않고 새 파일에서 재정의).
-- =========================================================================
drop policy if exists "관리자/운영자/본인가족 조회" on consultations;
create policy "관리자/운영자/본인가족/배정컨설턴트 조회" on consultations for select
  using (
    is_admin()
    or current_user_has_capability('manage_consultations')
    or (child_id is not null and (child_id = auth.uid() or is_household_guardian_of(child_id)))
    or intake_owner_id = auth.uid()
    or admissions_consultant_id = auth.uid()
    or current_user_has_capability('manage_consultation_intake')
    or current_user_has_capability('manage_admissions_students')
  );

-- =========================================================================
-- Phase 1 초기 셋업 — jiman@alton.education에게 consultant role + 두 capability.
-- (스펙 §Decision) 신규 auth 계정 발급은 범위 밖 — 기존 계정이 있어야 한다.
-- =========================================================================
do $$
declare
  v_profile_id uuid;
begin
  select p.id into v_profile_id
  from profiles p join auth.users u on u.id = p.id
  where u.email = 'jiman@alton.education';

  if v_profile_id is not null then
    update profiles set role = 'consultant' where id = v_profile_id;
    insert into supervisor_capabilities (profile_id, capability, granted_by)
    values
      (v_profile_id, 'manage_consultation_intake', v_profile_id),
      (v_profile_id, 'manage_admissions_students', v_profile_id)
    on conflict (profile_id, capability) do nothing;
  end if;
  -- 계정이 아직 없으면 조용히 건너뛴다 — 나중에 계정이 생기면 관리자 화면에서
  -- 수동으로 role/capability를 부여할 수 있다(ConsultantAssignmentsTab).
end $$;
