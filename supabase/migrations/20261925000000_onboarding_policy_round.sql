-- 2026-09-29 온보딩 정책 라운드(오너 확정) — 추가 전용.
--  B5  확정(scheduled)+Google 일정 있는 상담의 담당자 재배정은 서버에서 거절("취소 후 새 링크").
--  B7  컨설턴트 비활성화: 미확정 상담 자동 미배정 + 링크 회수 + 관리자 큐, 비활성 컨설턴트에게 배정·링크 발송 차단.
--  B2  컨설턴트가 체험을 확정하면 관리자 "온보딩 안내 발송 대기" 큐(admin_onboarding_attention_queue).
--  E1/E2/E4 체험권 소진·만료 후 재지급은 관리자가 사유를 남기고 종류별 1회 수동(append-only 이력, 자동 재지급 없음).
--  F2  상담 경로로 만든 자녀도 담당 컨설턴트를 consultant_assignments 로 이어받는다(그 자녀 한정).
--
-- 롤백: 각 함수를 이전 정의(assign_consultation_owner=20261922, _create_student_kanban_card=20261922,
--   set_consultant_accepting_new_work=20261459)로 되돌리고 새 함수·트리거·테이블·컬럼을 drop.

-- ---------------------------------------------------------------------------
-- B7 기반: 비활성 컨설턴트
-- ---------------------------------------------------------------------------
alter table public.consultant_settings add column if not exists deactivated_at timestamptz;
alter table public.consultant_settings add column if not exists deactivated_reason text;

alter table public.consultations add column if not exists unassigned_from_consultant_id uuid references public.profiles(id);
alter table public.consultations add column if not exists unassigned_reason text;
alter table public.consultations add column if not exists unassigned_at timestamptz;

create or replace function public.is_consultant_inactive(p_consultant_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select p_consultant_id is not null and (
    exists (select 1 from consultant_settings s where s.consultant_id = p_consultant_id and s.deactivated_at is not null)
    or not exists (select 1 from profiles p where p.id = p_consultant_id and p.role = 'consultant')
  );
$$;
revoke all on function public.is_consultant_inactive(uuid) from public, anon;
grant execute on function public.is_consultant_inactive(uuid) to authenticated, service_role;

-- 컨설턴트가 자기 설정 행으로 비활성 표시를 지우거나 "새 업무 받기"를 켤 수 없다(관리자·시스템만).
create or replace function public.consultant_settings_guard_deactivation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' or new.deactivated_at is distinct from old.deactivated_at then
    if new.deactivated_at is distinct from (case when tg_op = 'UPDATE' then old.deactivated_at else null end)
       and not (is_admin() or coalesce(auth.role(), '') = 'service_role' or auth.uid() is null) then
      raise exception '컨설턴트 활성 상태는 관리자만 바꿀 수 있습니다.' using errcode = 'P0001';
    end if;
  end if;
  if new.deactivated_at is not null then
    new.accepting_new_work := false;
  end if;
  return new;
end;
$$;
drop trigger if exists consultant_settings_guard_deactivation on public.consultant_settings;
create trigger consultant_settings_guard_deactivation
  before insert or update on public.consultant_settings
  for each row execute function public.consultant_settings_guard_deactivation();

-- 비활성 컨설턴트에게는 (카드 상속 제외) 상담을 배정할 수 없다. 새 담당자가 지정되면 미배정 표시를 지운다.
create or replace function public.consultations_block_inactive_consultant()
returns trigger
language plpgsql
as $$
begin
  if new.admissions_consultant_id is not null
     and (tg_op = 'INSERT' or new.admissions_consultant_id is distinct from old.admissions_consultant_id) then
    -- 학생 카드는 원 상담의 담당을 그대로 복사한다(이미 진행 중인 흐름이라 막지 않는다).
    if not (tg_op = 'INSERT' and coalesce(new.is_child_onboarding_card, false))
       and is_consultant_inactive(new.admissions_consultant_id) then
      raise exception '비활성화된 컨설턴트에게는 상담을 배정할 수 없습니다.' using errcode = 'P0001';
    end if;
    new.unassigned_from_consultant_id := null;
    new.unassigned_reason := null;
    new.unassigned_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists consultations_block_inactive_consultant on public.consultations;
create trigger consultations_block_inactive_consultant
  before insert or update of admissions_consultant_id on public.consultations
  for each row execute function public.consultations_block_inactive_consultant();

-- 비활성 컨설턴트 이름으로는 예약 링크를 만들 수 없다.
create or replace function public.scheduling_links_block_inactive_consultant()
returns trigger
language plpgsql
as $$
begin
  if is_consultant_inactive(new.consultant_id) then
    raise exception '비활성화된 컨설턴트의 예약 링크는 발송할 수 없습니다.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists scheduling_links_block_inactive_consultant on public.consultation_scheduling_links;
create trigger scheduling_links_block_inactive_consultant
  before insert on public.consultation_scheduling_links
  for each row execute function public.scheduling_links_block_inactive_consultant();

-- 컨설턴트 본인의 "새 업무 받기" 토글은 비활성 상태에서 켤 수 없다.
create or replace function public.set_consultant_accepting_new_work(p_accepting boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'consultant') then
    raise exception '컨설턴트 계정만 이 설정을 바꿀 수 있습니다.';
  end if;
  if p_accepting and is_consultant_inactive(auth.uid()) then
    raise exception '비활성화된 계정은 새 업무를 받을 수 없습니다. 관리자에게 문의해 주세요.';
  end if;
  insert into consultant_settings (consultant_id, accepting_new_work, updated_at)
  values (auth.uid(), p_accepting, now())
  on conflict (consultant_id) do update set accepting_new_work = p_accepting, updated_at = now();
end;
$$;

-- 관리자: 컨설턴트 비활성화/재활성화. 비활성화 시 미확정(requested) 상담은 자동 미배정(시간·링크 회수),
-- 확정(scheduled) 상담은 그대로 두고 관리자 큐에 "취소 후 새 링크"로 올린다.
create or replace function public.admin_set_consultant_active(p_consultant_id uuid, p_active boolean, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_unassigned integer := 0;
  v_scheduled integer := 0;
  r record;
begin
  if not is_admin() then
    raise exception '관리자만 컨설턴트 활성 상태를 바꿀 수 있습니다.';
  end if;
  if not exists (select 1 from profiles where id = p_consultant_id and role = 'consultant') then
    raise exception '컨설턴트 계정을 찾을 수 없습니다.';
  end if;

  if p_active then
    insert into consultant_settings (consultant_id, accepting_new_work, deactivated_at, deactivated_reason, updated_at)
    values (p_consultant_id, true, null, null, now())
    on conflict (consultant_id) do update
      set deactivated_at = null, deactivated_reason = null, accepting_new_work = true, updated_at = now();
    return jsonb_build_object('active', true, 'unassigned', 0, 'scheduled_remaining', 0);
  end if;

  insert into consultant_settings (consultant_id, accepting_new_work, deactivated_at, deactivated_reason, updated_at)
  values (p_consultant_id, false, now(), nullif(btrim(coalesce(p_reason, '')), ''), now())
  on conflict (consultant_id) do update
    set deactivated_at = coalesce(consultant_settings.deactivated_at, now()),
        deactivated_reason = nullif(btrim(coalesce(p_reason, '')), ''),
        accepting_new_work = false, updated_at = now();

  for r in
    select id from consultations
    where admissions_consultant_id = p_consultant_id and status = 'requested'
    for update
  loop
    update consultations
    set unassigned_from_consultant_id = p_consultant_id,
        unassigned_reason = '담당 컨설턴트 비활성화로 자동 미배정',
        unassigned_at = now(),
        admissions_consultant_id = null,
        starts_at = null, ends_at = null, scheduled_at = null, hold_expires_at = null,
        assigned_at = now(), assigned_by = auth.uid()
    where id = r.id;
    -- 위 update 가 consultations_block_inactive_consultant 의 "담당 지정 시 표시 해제"를 타지 않도록
    -- (담당이 null 이므로 타지 않는다) 표시는 그대로 남는다.
    update consultation_scheduling_links
    set expires_at = least(expires_at, now())
    where consultation_id = r.id and used_at is null and expires_at > now();
    insert into consultation_assignment_history (consultation_id, field, prior_owner_id, new_owner_id, actor_id, reason)
    values (r.id, 'admissions_consultant', p_consultant_id, null, auth.uid(), '담당 컨설턴트 비활성화로 자동 미배정');
    v_unassigned := v_unassigned + 1;
  end loop;

  select count(*) into v_scheduled from consultations
  where admissions_consultant_id = p_consultant_id and status = 'scheduled';

  return jsonb_build_object('active', false, 'unassigned', v_unassigned, 'scheduled_remaining', v_scheduled);
end;
$$;
revoke all on function public.admin_set_consultant_active(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_consultant_active(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- B5 + B7: assign_consultation_owner (20261922 정의 + 확정 상담 재배정 거절 + 비활성 배정 거절 메시지)
-- ---------------------------------------------------------------------------
create or replace function public.assign_consultation_owner(p_consultation_id uuid, p_field text, p_new_owner_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_prior_owner_id uuid;
  v_can_assign boolean;
  v_row consultations;
begin
  if p_field not in ('intake_owner', 'admissions_consultant') then
    raise exception 'invalid field: %', p_field;
  end if;

  v_can_assign := is_admin() or current_user_has_capability('assign_admissions_consultant');
  if not v_can_assign and p_field = 'intake_owner' and p_new_owner_id = auth.uid() then
    v_can_assign := current_user_has_capability('manage_consultation_intake');
  end if;
  if not v_can_assign then
    raise exception '이 요청의 담당자를 배정할 권한이 없습니다.';
  end if;

  if p_new_owner_id is not null and not exists (select 1 from profiles where id = p_new_owner_id and role = 'consultant') then
    raise exception '컨설턴트 계정만 담당자로 배정할 수 있습니다.' using errcode = 'P0001';
  end if;
  if p_field = 'admissions_consultant' and p_new_owner_id is not null and is_consultant_inactive(p_new_owner_id) then
    raise exception '비활성화된 컨설턴트에게는 상담을 배정할 수 없습니다.' using errcode = 'P0001';
  end if;

  if p_field = 'intake_owner' then
    select intake_owner_id into v_prior_owner_id from consultations where id = p_consultation_id;
    update consultations
    set intake_owner_id = p_new_owner_id, assigned_at = now(), assigned_by = auth.uid()
    where id = p_consultation_id;
  else
    select * into v_row from consultations where id = p_consultation_id for update;
    v_prior_owner_id := v_row.admissions_consultant_id;
    -- B5: 확정되어 Google 일정(organizer=담당 컨설턴트)이 있는 상담은 담당자를 바꿀 수 없다.
    if found and v_row.status = 'scheduled' and v_row.google_event_id is not null
       and p_new_owner_id is distinct from v_prior_owner_id then
      raise exception '이미 확정되어 Google 일정이 만들어진 상담은 담당 컨설턴트를 바꿀 수 없습니다. 상담을 취소한 뒤 새 예약 링크를 보내 주세요.' using errcode = 'P0001';
    end if;
    if found and p_new_owner_id is not null and v_row.starts_at is not null
       and v_row.status in ('requested', 'scheduled') then
      perform 1 from consultations c
      where c.id <> p_consultation_id
        and c.starts_at is not null
        and c.status in ('requested', 'scheduled')
        and c.admissions_consultant_id = p_new_owner_id
        and tstzrange(c.starts_at, c.ends_at) && tstzrange(v_row.starts_at, v_row.ends_at);
      if found then
        raise exception '해당 컨설턴트에게 이미 같은 시간의 다른 상담이 있어 배정할 수 없습니다.' using errcode = 'P0001';
      end if;
    end if;
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

-- ---------------------------------------------------------------------------
-- F2: 학생 카드 생성 시 담당 컨설턴트를 학생 단위로도 이어받는다(그 자녀 한정, 멱등).
-- (20261922 정의 + 상단 이어받기 블록)
-- ---------------------------------------------------------------------------
create or replace function public._create_student_kanban_card(p_root_consultation_id uuid, p_link_student_id uuid, p_child_auth_user_id uuid, p_household_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_root consultations%rowtype;
  v_student trial_onboarding_link_students%rowtype;
  v_new_card_id uuid;
  v_grant_id uuid;
  v_outcome consult_outcome;
begin
  select * into v_root from consultations where id = p_root_consultation_id;
  if not found then
    return;
  end if;
  select * into v_student from trial_onboarding_link_students where id = p_link_student_id;
  if not found then
    return;
  end if;

  v_outcome := coalesce(v_root.outcome, 'trial_recommended');

  -- F2: 상담 경로로 만든 자녀도 담당 컨설턴트 배정을 이어받는다. 열람 범위는 이 자녀 한정(student_id 단위).
  -- 이미 다른 배정이 있으면 덮어쓰지 않고, 담당이 비활성이면 이어받지 않는다.
  if v_root.admissions_consultant_id is not null
     and not is_consultant_inactive(v_root.admissions_consultant_id)
     and not exists (select 1 from consultant_assignments where student_id = p_child_auth_user_id) then
    insert into consultant_assignments (consultant_id, student_id, assigned_by, assigned_at)
    values (v_root.admissions_consultant_id, p_child_auth_user_id, v_root.assigned_by, now())
    on conflict (student_id) do nothing;
    insert into consultant_assignment_history (student_id, prior_consultant_id, new_consultant_id, actor_id, reason)
    values (p_child_auth_user_id, null, v_root.admissions_consultant_id, v_root.assigned_by, '상담 경로 자녀 — 담당 컨설턴트 이어받음');
  end if;

  insert into consultations (
    household_id, child_id, contact_name, contact_email, contact_phone,
    student_grade, category, concerns, status, source, starts_at, ends_at,
    scheduled_at, completed_at, outcome, outcome_notes, prospect_contact_id,
    trial_intent_confirmed_at, family_root_consultation_id, is_child_onboarding_card,
    source_link_child_id,
    intake_owner_id, admissions_consultant_id, assigned_at, assigned_by
  )
  values (
    p_household_id, p_child_auth_user_id, v_student.student_name, v_root.contact_email, v_root.contact_phone,
    coalesce(v_student.student_grade, v_root.student_grade), v_root.category, v_root.concerns,
    'completed', v_root.source, v_root.starts_at, v_root.ends_at,
    v_root.scheduled_at, v_root.completed_at, v_outcome, v_root.outcome_notes, v_root.prospect_contact_id,
    coalesce(v_root.trial_intent_confirmed_at, now()), p_root_consultation_id, true,
    p_link_student_id,
    v_root.intake_owner_id, v_root.admissions_consultant_id, v_root.assigned_at, v_root.assigned_by
  )
  on conflict (source_link_child_id) where source_link_child_id is not null do nothing
  returning id into v_new_card_id;

  if v_new_card_id is null then
    return; -- 이미 카드가 있었다(멱등 재호출) — 지급 시도도 중복하지 않는다.
  end if;

  if v_outcome <> 'trial_recommended' then
    return; -- regular_recommended(체험 생략) 등은 체험수업권 지급 대상이 아니다.
  end if;

  update consultations set trial_entitlement_grant_status = 'pending' where id = v_new_card_id;
  begin
    v_grant_id := grant_trial_entitlement_for_consultation(v_new_card_id);
    update consultations set
      trial_entitlement_grant_id = v_grant_id,
      trial_entitlement_grant_status = 'granted',
      trial_entitlement_grant_error = null
    where id = v_new_card_id;
  exception when others then
    update consultations set
      trial_entitlement_grant_status = 'failed',
      trial_entitlement_grant_error = sqlerrm
    where id = v_new_card_id;
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- E1/E2/E4: 체험권 상태 + 관리자 수동 재지급(사유 기록, 종류별 1회, append-only 이력)
-- ---------------------------------------------------------------------------
-- 자녀의 가장 최근 체험권 상태: none | active | exhausted | expired.
create or replace function public.trial_entitlement_state(p_child_id uuid)
returns text
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_grant entitlement_grants;
  v_balance integer;
begin
  select eg.* into v_grant
  from entitlement_grants eg
  join entitlement_products ep on ep.id = eg.entitlement_product_id
  where eg.child_id = p_child_id and ep.code = 'trial_lesson_grant'
  order by eg.created_at desc, eg.id desc
  limit 1;
  if not found then
    return 'none';
  end if;
  select coalesce(sum(amount), 0) into v_balance from entitlement_ledger where grant_id = v_grant.id;
  if v_balance <= 0 then
    return 'exhausted';
  end if;
  if v_grant.expires_at <= now() then
    return 'expired';
  end if;
  return 'active';
end;
$$;
revoke all on function public.trial_entitlement_state(uuid) from public, anon;
grant execute on function public.trial_entitlement_state(uuid) to authenticated, service_role;

create table if not exists public.trial_entitlement_regrants (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.profiles(id),
  kind text not null check (kind in ('exhausted', 'expired')),
  prior_grant_id uuid not null references public.entitlement_grants(id),
  new_grant_id uuid not null references public.entitlement_grants(id),
  reason text not null check (char_length(btrim(reason)) >= 5),
  actor_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (child_id, kind)
);
alter table public.trial_entitlement_regrants enable row level security;
create policy "관리자만 조회" on public.trial_entitlement_regrants for select using (is_admin());

create or replace function public.reject_trial_regrant_mutation()
returns trigger language plpgsql as $$
begin
  raise exception '체험권 재지급 이력은 수정·삭제할 수 없습니다(append-only).';
end;
$$;
drop trigger if exists trial_entitlement_regrants_no_update on public.trial_entitlement_regrants;
create trigger trial_entitlement_regrants_no_update
  before update or delete on public.trial_entitlement_regrants
  for each row execute function public.reject_trial_regrant_mutation();

create or replace function public.admin_regrant_trial_entitlement(p_child_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_state text;
  v_prior entitlement_grants;
  v_product uuid;
  v_new uuid;
begin
  if not is_admin() then
    raise exception '관리자만 체험권을 재지급할 수 있습니다.';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception '재지급 사유를 5자 이상 입력해 주세요.';
  end if;

  -- 같은 자녀에 대한 동시 재지급을 직렬화한다.
  perform pg_advisory_xact_lock(hashtextextended('trial_regrant:' || p_child_id::text, 0));

  v_state := trial_entitlement_state(p_child_id);
  if v_state = 'none' then
    raise exception '이 자녀에게는 지급된 체험권이 없습니다. 재지급이 아니라 일반 지급 경로를 사용해 주세요.';
  end if;
  if v_state = 'active' then
    raise exception '사용 가능한 체험권이 아직 남아 있어 재지급할 수 없습니다.';
  end if;
  if exists (select 1 from trial_entitlement_regrants where child_id = p_child_id and kind = v_state) then
    raise exception '이 자녀는 이미 "%" 사유로 체험권을 1회 재지급받았습니다. 추가 재지급은 할 수 없습니다.',
      case v_state when 'exhausted' then '소진' else '만료' end;
  end if;

  select eg.* into v_prior
  from entitlement_grants eg
  join entitlement_products ep on ep.id = eg.entitlement_product_id
  where eg.child_id = p_child_id and ep.code = 'trial_lesson_grant'
  order by eg.created_at desc, eg.id desc
  limit 1;
  select id into v_product from entitlement_products where code = 'trial_lesson_grant';

  insert into entitlement_grants (child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at, is_paid, source_consultation_id)
  values (p_child_id, v_product, null, 1, now() + interval '90 days', false, null)
  returning id into v_new;

  insert into entitlement_ledger (grant_id, event_type, amount, business_event_id)
  values (v_new, 'grant', 1, 'trial_regrant:' || v_new::text);

  insert into trial_entitlement_regrants (child_id, kind, prior_grant_id, new_grant_id, reason, actor_id)
  values (p_child_id, v_state, v_prior.id, v_new, btrim(p_reason), auth.uid());

  return v_new;
end;
$$;
revoke all on function public.admin_regrant_trial_entitlement(uuid, text) from public, anon;
grant execute on function public.admin_regrant_trial_entitlement(uuid, text) to authenticated;

-- 기존 지급 조회가 "가장 최근 체험권"을 돌려주도록(재지급 후 옛 체험권을 가리키지 않게).
create or replace function public.grant_trial_entitlement_for_consultation(p_consultation_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
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

  select id into v_existing_grant_id from entitlement_grants where source_consultation_id = p_consultation_id;
  if v_existing_grant_id is not null then
    return v_existing_grant_id;
  end if;

  select eg.id into v_existing_grant_id
  from entitlement_grants eg
  join entitlement_products ep on ep.id = eg.entitlement_product_id
  where eg.child_id = v_child_id and ep.code = 'trial_lesson_grant'
  order by eg.created_at desc, eg.id desc
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

-- ---------------------------------------------------------------------------
-- 관리자 주의 큐(B2 온보딩 안내 발송 대기, B7 미배정·확정 상담, E1/E2/E4 체험권 소진·만료)
-- ---------------------------------------------------------------------------
create or replace function public.admin_onboarding_attention_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_send jsonb;
  v_unassigned jsonb;
  v_scheduled jsonb;
  v_trial jsonb;
begin
  if not (is_admin() or current_user_has_capability('manage_consultations')) then
    raise exception '관리자만 조회할 수 있습니다.';
  end if;

  -- B2: 체험 진행이 확정됐지만 온보딩 안내가 아직 나가지 않은 상담(컨설턴트가 확정했을 때 특히 관리자 처리 필요).
  select coalesce(jsonb_agg(jsonb_build_object(
      'consultation_id', c.id,
      'contact_name', c.contact_name,
      'confirmed_at', c.trial_intent_confirmed_at,
      'confirmed_by_name', p.name,
      'confirmed_by_consultant', (p.role = 'consultant')
    ) order by c.trial_intent_confirmed_at), '[]'::jsonb)
  into v_send
  from consultations c
  left join profiles p on p.id = c.trial_intent_confirmed_by
  where c.is_child_onboarding_card = false
    and c.outcome = 'trial_recommended'
    and c.trial_intent_confirmed_at is not null
    and c.status <> 'cancelled'
    and not exists (
      select 1 from trial_onboarding_links l
      where l.consultation_id = c.id and (l.notice_delivery_status = 'sent' or l.status = 'redeemed')
    );

  select coalesce(jsonb_agg(jsonb_build_object(
      'consultation_id', c.id,
      'contact_name', c.contact_name,
      'from_consultant_id', c.unassigned_from_consultant_id,
      'from_consultant_name', p.name,
      'unassigned_at', c.unassigned_at,
      'reason', c.unassigned_reason
    ) order by c.unassigned_at), '[]'::jsonb)
  into v_unassigned
  from consultations c
  left join profiles p on p.id = c.unassigned_from_consultant_id
  where c.admissions_consultant_id is null and c.unassigned_reason is not null and c.status = 'requested';

  select coalesce(jsonb_agg(jsonb_build_object(
      'consultation_id', c.id,
      'contact_name', c.contact_name,
      'consultant_id', c.admissions_consultant_id,
      'consultant_name', p.name,
      'starts_at', c.starts_at
    ) order by c.starts_at), '[]'::jsonb)
  into v_scheduled
  from consultations c
  join profiles p on p.id = c.admissions_consultant_id
  where c.status = 'scheduled' and is_consultant_inactive(c.admissions_consultant_id);

  -- E4: 체험 추천 상담인데 자녀의 체험권이 소진·만료 상태 — 화면에 정직하게 표시, 재지급은 관리자 수동 1회.
  select coalesce(jsonb_agg(jsonb_build_object(
      'consultation_id', t.id,
      'contact_name', t.contact_name,
      'child_id', t.child_id,
      'state', t.state
    )), '[]'::jsonb)
  into v_trial
  from (
    select c.id, c.contact_name, c.child_id, trial_entitlement_state(c.child_id) as state
    from consultations c
    where c.outcome = 'trial_recommended' and c.child_id is not null and c.status <> 'cancelled'
  ) t
  where t.state in ('exhausted', 'expired');

  return jsonb_build_object(
    'onboarding_send_pending', v_send,
    'unassigned_inactive_consultant', v_unassigned,
    'scheduled_inactive_consultant', v_scheduled,
    'trial_entitlement_unavailable', v_trial
  );
end;
$$;
revoke all on function public.admin_onboarding_attention_queue() from public, anon;
grant execute on function public.admin_onboarding_attention_queue() to authenticated;
