-- 컨설턴트 Phase 2 마지막 조각 — 자동배정 모드(스펙 §Assignment Modes).
-- 관리자가 전역 설정(수동/자동)을 켜고 끌 수 있고, 자동일 때는 "manage_consultation_intake
-- 보유 + 활성 계정 + accepting_new_work=true"인 컨설턴트 중 무작위로 한 명을
-- intake_owner/admissions_consultant 둘 다로 즉시 배정한다(MVP: capacity/전문분야
-- 라우팅 없음, 스펙 명시).

create table consultant_assignment_settings (
  id boolean primary key default true,
  auto_assign_enabled boolean not null default false,
  updated_by uuid references profiles (id),
  updated_at timestamptz not null default now(),
  constraint consultant_assignment_settings_singleton check (id = true)
);
insert into consultant_assignment_settings (id, auto_assign_enabled) values (true, false);

alter table consultant_assignment_settings enable row level security;
create policy "관리자 조회" on consultant_assignment_settings for select using (is_admin());
create policy "관리자 쓰기" on consultant_assignment_settings for all using (is_admin()) with check (is_admin());

create table consultant_settings (
  consultant_id uuid primary key references profiles (id) on delete cascade,
  accepting_new_work boolean not null default true,
  updated_at timestamptz not null default now()
);

comment on table consultant_settings is
  '스펙 §Assignment Modes "explicit accepting-new-work flag" — 없으면 accepting_new_work=true로 취급(기본 수용).';

alter table consultant_settings enable row level security;
create policy "관리자/본인 조회" on consultant_settings for select
  using (is_admin() or consultant_id = auth.uid());
create policy "관리자/본인 쓰기" on consultant_settings for all
  using (is_admin() or consultant_id = auth.uid())
  with check (is_admin() or consultant_id = auth.uid());

create or replace function public.set_consultant_accepting_new_work(p_accepting boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'consultant') then
    raise exception '컨설턴트 계정만 이 설정을 바꿀 수 있습니다.';
  end if;
  insert into consultant_settings (consultant_id, accepting_new_work, updated_at)
  values (auth.uid(), p_accepting, now())
  on conflict (consultant_id) do update set accepting_new_work = p_accepting, updated_at = now();
end;
$$;
revoke execute on function public.set_consultant_accepting_new_work(boolean) from public;
grant execute on function public.set_consultant_accepting_new_work(boolean) to authenticated;

create or replace function public.set_consultant_auto_assign_enabled(p_enabled boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception '관리자만 자동배정 설정을 바꿀 수 있습니다.';
  end if;
  update consultant_assignment_settings set auto_assign_enabled = p_enabled, updated_by = auth.uid(), updated_at = now();
end;
$$;
revoke execute on function public.set_consultant_auto_assign_enabled(boolean) from public;
grant execute on function public.set_consultant_auto_assign_enabled(boolean) to authenticated;

-- =========================================================================
-- submit_homepage_consult_request() 재정의 — 신청 접수 직후 자동배정 모드가
-- 켜져 있으면 즉시 무작위 배정한다.
-- =========================================================================
create or replace function public.submit_homepage_consult_request(
  p_full_name text,
  p_email text,
  p_phone text,
  p_starts_at timestamptz,
  p_student_grade text,
  p_concerns text,
  p_idempotency_key text
)
returns consultations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ends_at timestamptz;
  v_prospect prospect_contacts;
  v_consultation consultations;
  v_existing consultations;
  v_auto_assign_enabled boolean;
  v_candidate_id uuid;
begin
  if p_idempotency_key is not null then
    select * into v_existing from consultations where idempotency_key = p_idempotency_key;
    if found then
      return v_existing;
    end if;
  end if;

  if p_starts_at is not null then
    v_ends_at := p_starts_at + interval '60 minutes';

    if p_starts_at <= now() then
      raise exception '지난 시간은 상담을 신청할 수 없습니다.';
    end if;

    if extract(minute from p_starts_at) not in (0) or extract(second from p_starts_at) <> 0 then
      raise exception '상담 슬롯은 정시 단위로만 신청할 수 있습니다.';
    end if;

    perform 1 from consultations c
    where c.starts_at is not null
      and c.status in ('requested', 'scheduled')
      and tstzrange(c.starts_at, c.ends_at) && tstzrange(p_starts_at, v_ends_at)
    for update;
    if found then
      raise exception '이미 다른 상담이 신청되었거나 확정된 시간입니다. 다른 시간을 선택해 주세요.';
    end if;
  end if;

  if exists (
    select 1 from consultations c
    where c.status = 'requested'
      and lower(trim(c.contact_email)) = lower(trim(p_email))
  ) then
    raise exception '이미 처리 대기 중인 상담 신청이 있습니다. 관리자가 확인할 때까지 기다려 주세요.';
  end if;

  insert into prospect_contacts (full_name, primary_email, primary_phone)
  values (p_full_name, p_email, p_phone)
  returning * into v_prospect;

  insert into consultations (
    prospect_contact_id, source, contact_name, contact_email, contact_phone,
    student_grade, category, concerns, status, requested_at,
    starts_at, ends_at, idempotency_key
  ) values (
    v_prospect.id, 'homepage', p_full_name, p_email, p_phone,
    p_student_grade, 'family', p_concerns, 'requested', now(),
    p_starts_at, v_ends_at, p_idempotency_key
  )
  returning * into v_consultation;

  insert into consultation_status_events (consultation_id, previous_status, new_status, reason)
  values (v_consultation.id, null, 'requested', '홈페이지 상담 신청');

  select auto_assign_enabled into v_auto_assign_enabled from consultant_assignment_settings where id = true;

  if coalesce(v_auto_assign_enabled, false) then
    select p.id into v_candidate_id
    from profiles p
    where p.role = 'consultant'
      and has_capability(p.id, 'manage_consultation_intake')
      and get_account_status(p.id) = 'active'
      and coalesce((select cs.accepting_new_work from consultant_settings cs where cs.consultant_id = p.id), true)
    order by random()
    limit 1;

    if v_candidate_id is not null then
      update consultations
      set intake_owner_id = v_candidate_id, admissions_consultant_id = v_candidate_id, assigned_at = now()
      where id = v_consultation.id
      returning * into v_consultation;

      insert into consultation_assignment_history (consultation_id, field, prior_owner_id, new_owner_id, actor_id, reason)
      values
        (v_consultation.id, 'intake_owner', null, v_candidate_id, null, '자동배정'),
        (v_consultation.id, 'admissions_consultant', null, v_candidate_id, null, '자동배정');
    end if;
    -- 대상이 없으면(스펙 "가능시간 있는 사람 없으면 예외 상태") 조용히 미배정으로
    -- 남는다 — 관리자 큐에서 그대로 보인다(별도 예외 상태 도입은 Phase 3).
  end if;

  return v_consultation;
end;
$$;
