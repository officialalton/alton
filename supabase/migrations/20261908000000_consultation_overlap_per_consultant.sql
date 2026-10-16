-- 2026-09-29 오너 결정: 상담 겹침 검사는 전사 단위가 아니라 "컨설턴트별"이다.
-- 컨설턴트마다 캘린더가 따로이므로 서로 다른 컨설턴트는 같은 시각에 상담할 수 있다.
--
-- 배경(e2e에서 발견된 버그): 기존 consultations_no_overlap은 컨설턴트를 무시한 전사 배타
-- 제약이었는데 list_consultant_open_slots / redeem_consultation_scheduling_link는 컨설턴트별로
-- 사전 검사한다. 그래서 컨설턴트가 둘이면 슬롯이 열려 있다고 보이는데 확정 시 23P01이 났다.
--
-- 제약 설계:
--   (1) consultations_no_overlap            : (admissions_consultant_id =, 시간 &&) — 배정된 행, 컨설턴트별.
--   (2) consultations_unassigned_no_overlap : (시간 &&) — 컨설턴트 미배정이면서 시간이 있는 행끼리만.
--       홈페이지/보호자 포털 신청은 시간을 가진 채 미배정으로 들어오므로(자동배정 꺼짐 또는
--       후보 없음) 미배정 행끼리의 중복은 기존처럼 전사 단위로 막는다(주체가 아직 없다).
--   status 조건(requested/scheduled)과 starts_at/ends_at not null 조건은 기존과 동일.
--
-- 영향: 기존 데이터는 새 제약보다 엄격한 옛 제약을 통과했으므로 위반 행이 없다(아래 DO 블록이 재확인).
-- 락: alter table ... drop/add constraint 는 ACCESS EXCLUSIVE 를 잠깐 잡고 gist 인덱스를 새로 만든다
--   (consultations 는 소규모라 짧다). 롤백: 새 제약 둘을 drop 하고 옛 제약
--   exclude using gist (tstzrange(starts_at, ends_at) with &&) where (starts_at is not null and
--   ends_at is not null and status in ('requested','scheduled')) 를 다시 add.

create extension if not exists btree_gist;

do $$
declare v_violations int;
begin
  select count(*) into v_violations
  from consultations a
  join consultations b on a.id < b.id
    and a.admissions_consultant_id is not distinct from b.admissions_consultant_id
    and tstzrange(a.starts_at, a.ends_at) && tstzrange(b.starts_at, b.ends_at)
  where a.starts_at is not null and a.ends_at is not null and a.status in ('requested', 'scheduled')
    and b.starts_at is not null and b.ends_at is not null and b.status in ('requested', 'scheduled');
  if v_violations > 0 then
    raise exception '컨설턴트별 겹침 제약을 만들 수 없습니다: 같은 컨설턴트(또는 미배정) 상담이 겹치는 % 쌍이 있습니다.', v_violations;
  end if;
end $$;

alter table consultations drop constraint if exists consultations_no_overlap;
alter table consultations drop constraint if exists consultations_unassigned_no_overlap;

alter table consultations add constraint consultations_no_overlap
  exclude using gist (
    admissions_consultant_id with =,
    tstzrange(starts_at, ends_at) with &&
  )
  where (
    starts_at is not null and ends_at is not null
    and admissions_consultant_id is not null
    and status in ('requested', 'scheduled')
  );

alter table consultations add constraint consultations_unassigned_no_overlap
  exclude using gist (
    tstzrange(starts_at, ends_at) with &&
  )
  where (
    starts_at is not null and ends_at is not null
    and admissions_consultant_id is null
    and status in ('requested', 'scheduled')
  );

comment on constraint consultations_no_overlap on consultations is
  '2026-09-29: 컨설턴트별 겹침 방지(같은 admissions_consultant_id의 requested/scheduled 상담 시간 겹침 금지). '
  '서로 다른 컨설턴트는 같은 시각에 상담할 수 있다.';
comment on constraint consultations_unassigned_no_overlap on consultations is
  '2026-09-29: 컨설턴트 미배정이면서 시간이 있는 requested/scheduled 상담끼리의 전사 단위 겹침 방지'
  '(홈페이지/보호자 포털 신청은 배정 전에 시간을 잡는다).';

-- 관리자 시간 변경: 같은 컨설턴트의 다른 상담과 겹치면 친절한 문구로 거절(레이스는 제약이 최종 방어).
create or replace function admin_reschedule_consultation(
  p_consultation_id uuid,
  p_new_starts_at timestamptz,
  p_reason text
) returns consultations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row consultations;
  v_new_ends_at timestamptz := p_new_starts_at + interval '60 minutes';
begin
  if not is_admin() then
    raise exception '관리자만 상담 시간을 변경할 수 있습니다.';
  end if;
  if p_new_starts_at <= now() then
    raise exception '지난 시간으로 변경할 수 없습니다.';
  end if;

  select * into v_row from consultations where id = p_consultation_id for update;
  if not found then
    raise exception '상담 신청을 찾을 수 없습니다: %', p_consultation_id;
  end if;
  if v_row.status not in ('requested', 'scheduled') then
    raise exception '진행 중이거나 확정된 상담만 시간을 변경할 수 있습니다(현재 상태: %).', v_row.status;
  end if;

  perform 1 from consultations c
  where c.id <> p_consultation_id
    and c.starts_at is not null
    and c.status in ('requested', 'scheduled')
    and c.admissions_consultant_id is not distinct from v_row.admissions_consultant_id
    and tstzrange(c.starts_at, c.ends_at) && tstzrange(p_new_starts_at, v_new_ends_at);
  if found then
    raise exception '이미 다른 상담이 있는 시간입니다. 다른 시간을 선택해 주세요.' using errcode = 'P0001';
  end if;

  update consultations set
    starts_at = p_new_starts_at,
    ends_at = v_new_ends_at,
    scheduled_at = case when status = 'scheduled' then p_new_starts_at else scheduled_at end,
    google_sync_status = case when google_event_id is not null then 'pending' else google_sync_status end,
    updated_at = now()
  where id = p_consultation_id
  returning * into v_row;

  insert into consultation_status_events (consultation_id, previous_status, new_status, actor_profile_id, reason, google_action)
  values (p_consultation_id, v_row.status, v_row.status, auth.uid(), coalesce(p_reason, '관리자 시간 변경'), 'time_changed');

  return v_row;
end;
$$;

-- 담당 컨설턴트 (재)배정: 이미 시간이 잡힌 상담을 그 시각에 다른 상담이 있는 컨설턴트에게 배정하면 거절.
create or replace function assign_consultation_owner(
  p_consultation_id uuid,
  p_field text,
  p_new_owner_id uuid,
  p_reason text default null
) returns void
language plpgsql
security definer
set search_path = public
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

  if p_field = 'intake_owner' then
    select intake_owner_id into v_prior_owner_id from consultations where id = p_consultation_id;
    update consultations
    set intake_owner_id = p_new_owner_id, assigned_at = now(), assigned_by = auth.uid()
    where id = p_consultation_id;
  else
    select * into v_row from consultations where id = p_consultation_id for update;
    v_prior_owner_id := v_row.admissions_consultant_id;
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

-- 홈페이지 신청 자동배정: 신청 시각에 이미 다른 상담이 있는 컨설턴트는 후보에서 제외(없으면 미배정으로 남는다).
CREATE OR REPLACE FUNCTION public.submit_homepage_consult_request(p_full_name text, p_email text, p_phone text, p_starts_at timestamp with time zone, p_student_grade text, p_concerns text, p_idempotency_key text)
 RETURNS consultations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      and (
        v_consultation.starts_at is null
        or not exists (
          select 1 from consultations c2
          where c2.id <> v_consultation.id
            and c2.admissions_consultant_id = p.id
            and c2.starts_at is not null
            and c2.status in ('requested', 'scheduled')
            and tstzrange(c2.starts_at, c2.ends_at) && tstzrange(v_consultation.starts_at, v_consultation.ends_at)
        )
      )
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
$function$;

