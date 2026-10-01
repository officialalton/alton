-- 2026-09-29 온보딩 시나리오 감사(docs/qa/2026-09-29-onboarding-scenarios.md) 수정 — 추가 전용.
-- 정책을 바꾸지 않고 "이미 있는 정책을 우회하거나 막다른 길로 끌고 가는 구멍"만 메운다.
--
--  B1 admin_accept_consultation: 시간이 없는 requested 상담을 수락하면 시간 없는 scheduled 유령 행이 되고,
--     고객의 예약 링크(status='requested'만 허용)도 함께 죽는다 → 시간이 있을 때만 수락.
--  B2 admin_record_consultation_outcome: requested(일정 전)·cancelled 상담에도 결과가 기록되고, cancelled 에
--     trial_recommended 를 기록하면 체험수업권이 실제로 지급됐다 → requested/cancelled 는 거절.
--  B3 admin_reject_consultation / admin_cancel_consultation: 이미 completed·cancelled 인 상담을 다시 거절/취소해
--     결과·체험수업권이 남은 채 cancelled 가 되고 Calendar 삭제 대기가 다시 걸렸다 → requested/scheduled 만 허용.
--  B4 컨설턴트 휴무(consultant_time_off)가 슬롯 계산·확정 어디에서도 쓰이지 않았다 → 슬롯 목록·확정 모두에서 차단.
--     미팅 슬롯 목록(list_open_consultant_meeting_slots)은 종일/부분 휴무 예외(consult_availability_exceptions)도 무시했다.
--  B5 redeem_consultation_scheduling_link: 지난 시각도 확정 가능했다 → 미래 시각만.
--  B6 list_consultant_open_slots: 담당 컨설턴트가 바뀌었거나 이미 처리된 상담의 옛 링크가 옛 컨설턴트의 빈 슬롯을
--     보여 주고 고객이 골라야 비로소 오류가 났다 → 링크 자체를 무효로 취급.
--  B7 create_trial_onboarding_link_multi: 취소된 상담에도 온보딩 링크를 발급할 수 있었다 → 거절.
--  B8 _create_student_kanban_card: 온보딩으로 생기는 학생별 카드가 담당 컨설턴트(admissions_consultant_id)를 물려받지
--     않아, 계정 생성 직후 컨설턴트 칸반에서 카드가 사라지고 "카드로 이동"이 '담당 상담이 아닙니다'로 막혔다
--     → 원 상담의 담당 컨설턴트·배정 정보를 카드에 복사 + 기존 카드 백필(원 상담에 담당자가 있는 경우만).
--  B9 assign_consultation_owner: 컨설턴트 역할이 아닌 계정(학부모 등)도 담당자로 지정할 수 있었다 → 역할 검사.
--
-- 롤백: 각 함수를 이전 정의(20261908/20261910/20261913/20261917 등)로 create or replace 하고
--   drop function public.consultant_slot_blocked(uuid, timestamptz, timestamptz);

-- ---------------------------------------------------------------------------
-- 공용: 컨설턴트가 그 시간에 상담할 수 없는 사유(휴무 등록·닫힌 예외)가 있는가.
-- ---------------------------------------------------------------------------
create or replace function public.consultant_slot_blocked(p_consultant_id uuid, p_start timestamptz, p_end timestamptz)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from consultant_time_off t
    where t.consultant_id = p_consultant_id
      and tstzrange(t.starts_at, t.ends_at) && tstzrange(p_start, p_end)
  ) or exists (
    select 1 from consult_availability_exceptions e
    where e.consultant_id = p_consultant_id
      and e.exception_date = (p_start at time zone 'America/Los_Angeles')::date
      and e.is_closed
      and (
        e.start_time is null
        or (
          (p_start at time zone 'America/Los_Angeles')::time < e.end_time
          and (p_end at time zone 'America/Los_Angeles')::time > e.start_time
        )
      )
  );
$$;
revoke all on function public.consultant_slot_blocked(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.consultant_slot_blocked(uuid, timestamptz, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- B1
-- ---------------------------------------------------------------------------
create or replace function public.admin_accept_consultation(p_consultation_id uuid, p_consent_version_id uuid)
returns consultations
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row consultations;
begin
  select * into v_row from consultations where id = p_consultation_id for update;
  if not found then
    raise exception '상담 신청을 찾을 수 없습니다: %', p_consultation_id;
  end if;
  if not (is_admin() or v_row.admissions_consultant_id = auth.uid()) then
    raise exception '관리자 또는 담당 컨설턴트만 상담을 수락할 수 있습니다.';
  end if;
  if v_row.status not in ('requested') then
    raise exception '이미 처리된 상담입니다(현재 상태: %).', v_row.status;
  end if;
  if v_row.starts_at is null then
    raise exception '아직 상담 시간이 정해지지 않았습니다. 예약 링크를 보내 고객이 시간을 고르게 해 주세요.' using errcode = 'P0001';
  end if;

  update consultations set
    status = 'scheduled',
    scheduled_at = starts_at,
    hold_expires_at = null,
    consent_version_id = coalesce(p_consent_version_id, v_row.consent_version_id),
    created_by = coalesce(created_by, auth.uid()),
    updated_at = now()
  where id = p_consultation_id
  returning * into v_row;

  insert into consultation_status_events (consultation_id, previous_status, new_status, actor_profile_id, reason)
  values (p_consultation_id, 'requested', 'scheduled', auth.uid(), case when is_admin() then '관리자 수락' else '담당 컨설턴트 수락' end);

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- B2 (+ 이벤트 이력의 previous_status 를 실제 이전 상태로)
-- ---------------------------------------------------------------------------
create or replace function public.admin_record_consultation_outcome(p_consultation_id uuid, p_outcome consult_outcome, p_notes text, p_admin_review_summary text)
returns consultations
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row consultations;
  v_prev v3_consultation_status;
  v_grant_id uuid;
begin
  select * into v_row from consultations where id = p_consultation_id for update;
  if not found then
    raise exception '상담 신청을 찾을 수 없습니다: %', p_consultation_id;
  end if;
  if not (is_admin() or v_row.admissions_consultant_id = auth.uid()) then
    raise exception '관리자 또는 담당 컨설턴트만 상담 결과를 기록할 수 있습니다.';
  end if;
  if v_row.status in ('requested', 'cancelled') then
    raise exception '일정이 확정되어 진행된 상담에만 결과를 기록할 수 있습니다(현재 상태: %).', v_row.status using errcode = 'P0001';
  end if;

  if p_admin_review_summary is null or btrim(p_admin_review_summary) = '' then
    raise exception '검토 요약을 작성해야 상담 결과를 기록할 수 있습니다(공백 불가).';
  end if;

  v_prev := v_row.status;

  update consultations set
    status = case when status = 'scheduled' then 'completed' else status end,
    completed_at = coalesce(completed_at, now()),
    outcome = p_outcome,
    outcome_notes = coalesce(p_notes, outcome_notes),
    admin_review_summary = p_admin_review_summary,
    updated_at = now()
  where id = p_consultation_id
  returning * into v_row;

  insert into consultation_status_events (consultation_id, previous_status, new_status, actor_profile_id, reason)
  values (p_consultation_id, v_prev, v_row.status, auth.uid(), '상담 결과 기록: ' || p_outcome::text);

  if p_outcome = 'trial_recommended'
     and coalesce(v_row.trial_entitlement_grant_status, 'not_applicable') != 'granted' then
    update consultations set trial_entitlement_grant_status = 'pending' where id = p_consultation_id;
    begin
      v_grant_id := grant_trial_entitlement_for_consultation(p_consultation_id);
      update consultations set
        trial_entitlement_grant_id = v_grant_id,
        trial_entitlement_grant_status = 'granted',
        trial_entitlement_grant_error = null
      where id = p_consultation_id
      returning * into v_row;
    exception when others then
      update consultations set
        trial_entitlement_grant_status = 'failed',
        trial_entitlement_grant_error = sqlerrm
      where id = p_consultation_id
      returning * into v_row;
    end;
  end if;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- B3
-- ---------------------------------------------------------------------------
create or replace function public.admin_reject_consultation(p_consultation_id uuid, p_reason text)
returns consultations
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row consultations;
  v_prev v3_consultation_status;
begin
  select * into v_row from consultations where id = p_consultation_id for update;
  if not found then
    raise exception '상담 신청을 찾을 수 없습니다: %', p_consultation_id;
  end if;
  if not (is_admin() or v_row.admissions_consultant_id = auth.uid()) then
    raise exception '관리자 또는 담당 컨설턴트만 상담을 거절할 수 있습니다.';
  end if;
  if v_row.status not in ('requested', 'scheduled') then
    raise exception '진행 전(신청·확정) 상담만 거절할 수 있습니다(현재 상태: %).', v_row.status using errcode = 'P0001';
  end if;
  v_prev := v_row.status;

  update consultations set
    status = 'cancelled',
    hold_expires_at = null,
    outcome_notes = coalesce(p_reason, outcome_notes),
    cancelled_at = now(),
    cancellation_reason = p_reason,
    updated_at = now()
  where id = p_consultation_id
  returning * into v_row;

  insert into consultation_status_events (consultation_id, previous_status, new_status, actor_profile_id, reason)
  values (p_consultation_id, v_prev, 'cancelled', auth.uid(), coalesce(p_reason, case when is_admin() then '관리자 거절' else '담당 컨설턴트 거절' end));

  return v_row;
end;
$$;

create or replace function public.admin_cancel_consultation(p_consultation_id uuid, p_reason text)
returns consultations
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row consultations;
  v_prev v3_consultation_status;
begin
  if not is_admin() then
    raise exception '관리자만 상담을 취소할 수 있습니다.';
  end if;

  select * into v_row from consultations where id = p_consultation_id for update;
  if not found then
    raise exception '상담 신청을 찾을 수 없습니다: %', p_consultation_id;
  end if;
  if v_row.status not in ('requested', 'scheduled') then
    raise exception '진행 전(신청·확정) 상담만 취소할 수 있습니다(현재 상태: %).', v_row.status using errcode = 'P0001';
  end if;
  v_prev := v_row.status;

  update consultations set
    status = 'cancelled',
    cancelled_at = now(),
    cancellation_reason = p_reason,
    google_sync_status = case when google_event_id is not null then 'pending' else google_sync_status end,
    updated_at = now()
  where id = p_consultation_id
  returning * into v_row;

  insert into consultation_status_events (consultation_id, previous_status, new_status, actor_profile_id, reason, google_action)
  values (p_consultation_id, v_prev, 'cancelled', auth.uid(), coalesce(p_reason, '관리자 취소'), 'cancelled');

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- B4 미팅 슬롯 목록 — 휴무·닫힌 예외 제외
-- ---------------------------------------------------------------------------
create or replace function public.list_open_consultant_meeting_slots(p_consultant_id uuid, p_from timestamptz, p_to timestamptz)
returns table(slot_starts_at timestamptz)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not (
    coalesce(auth.role(), '') = 'service_role'
    or is_admin()
    or p_consultant_id = auth.uid()
    or exists (
      select 1 from consultant_assignments ca
      where ca.consultant_id = p_consultant_id
        and (
          ca.student_id = auth.uid()
          or exists (
            select 1
            from household_members child
            join household_members guardian on guardian.household_id = child.household_id
            where child.profile_id = ca.student_id and child.role = 'child'
              and guardian.profile_id = auth.uid() and guardian.role = 'guardian'
          )
        )
    )
  ) then
    raise exception '담당 컨설턴트의 상담 가능 시간만 조회할 수 있습니다.' using errcode = 'P0001';
  end if;

  return query
  with weekday_rules as (
    select r.weekday, r.start_time, r.end_time
    from consult_availability_rules r
    where r.active and r.consultant_id = p_consultant_id
  ),
  days as (
    select generate_series(date_trunc('day', p_from), date_trunc('day', p_to), interval '1 day')::date as d
  ),
  candidate_slots as (
    select
      ((d.d + wr.start_time)::timestamp at time zone 'America/Los_Angeles' + (n * interval '60 minutes')) as slot_start,
      ((d.d + wr.start_time)::timestamp at time zone 'America/Los_Angeles' + ((n + 1) * interval '60 minutes')) as slot_end
    from days d
    join weekday_rules wr on wr.weekday = extract(dow from d.d)::smallint
    cross join lateral generate_series(0, (extract(epoch from (wr.end_time - wr.start_time)) / 3600)::int - 1) as n
  )
  select distinct cs.slot_start
  from candidate_slots cs
  where cs.slot_start >= p_from
    and cs.slot_start < p_to
    and cs.slot_start > now()
    and not consultant_slot_blocked(p_consultant_id, cs.slot_start, cs.slot_end)
    and not exists (
      select 1 from consultations c
      where c.admissions_consultant_id = p_consultant_id
        and c.starts_at is not null
        and c.status in ('requested', 'scheduled')
        and tstzrange(c.starts_at, c.ends_at) && tstzrange(cs.slot_start, cs.slot_end)
    )
    and not exists (
      select 1 from meeting_requests mr
      where mr.consultant_id = p_consultant_id
        and mr.starts_at is not null
        and mr.status in ('requested', 'confirming', 'scheduling', 'scheduled')
        and tstzrange(mr.starts_at, mr.ends_at) && tstzrange(cs.slot_start, cs.slot_end)
    )
  order by cs.slot_start;
end;
$$;

-- ---------------------------------------------------------------------------
-- B4 + B6 상담 예약 링크 슬롯 목록
-- ---------------------------------------------------------------------------
create or replace function public.list_consultant_open_slots(p_token text, p_from timestamptz, p_to timestamptz)
returns table(slot_starts_at timestamptz)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_link consultation_scheduling_links;
  v_row consultations;
begin
  select * into v_link from consultation_scheduling_links where token = p_token;
  if not found or v_link.expires_at < now() or v_link.used_at is not null then
    raise exception '유효하지 않거나 만료된 예약 링크입니다.';
  end if;

  -- 담당 컨설턴트가 바뀌었거나 상담이 이미 처리된(시간 확정·취소) 링크는 무효다.
  select * into v_row from consultations where id = v_link.consultation_id;
  if not found
     or v_row.status <> 'requested'
     or v_row.starts_at is not null
     or v_row.admissions_consultant_id is distinct from v_link.consultant_id then
    raise exception '유효하지 않거나 만료된 예약 링크입니다.';
  end if;

  return query
  with weekday_rules as (
    select r.weekday, r.start_time, r.end_time
    from consult_availability_rules r
    where r.active and r.consultant_id = v_link.consultant_id
  ),
  days as (
    select generate_series(date_trunc('day', p_from), date_trunc('day', p_to), interval '1 day')::date as d
  ),
  rule_candidate_slots as (
    select
      ((d.d + wr.start_time)::timestamp at time zone 'America/Los_Angeles' + (n * interval '60 minutes')) as slot_start,
      ((d.d + wr.start_time)::timestamp at time zone 'America/Los_Angeles' + ((n + 1) * interval '60 minutes')) as slot_end
    from days d
    join weekday_rules wr on wr.weekday = extract(dow from d.d)::smallint
    cross join lateral generate_series(0, (extract(epoch from (wr.end_time - wr.start_time)) / 3600)::int - 1) as n
  )
  select distinct cs.slot_start
  from rule_candidate_slots cs
  where cs.slot_start >= p_from
    and cs.slot_start < p_to
    and cs.slot_start > now()
    and not consultant_slot_blocked(v_link.consultant_id, cs.slot_start, cs.slot_end)
    and not exists (
      select 1 from consultations c
      where c.starts_at is not null
        and c.status in ('requested', 'scheduled')
        and c.admissions_consultant_id = v_link.consultant_id
        and tstzrange(c.starts_at, c.ends_at) && tstzrange(cs.slot_start, cs.slot_end)
    )
    and not exists (
      select 1 from meeting_requests mr
      where mr.consultant_id = v_link.consultant_id
        and mr.starts_at is not null and mr.ends_at is not null
        and mr.status in ('requested', 'confirming', 'scheduling', 'scheduled')
        and tstzrange(mr.starts_at, mr.ends_at) && tstzrange(cs.slot_start, cs.slot_end)
    )
  order by cs.slot_start;
end;
$$;

-- ---------------------------------------------------------------------------
-- B4 + B5 확정
-- ---------------------------------------------------------------------------
create or replace function public.redeem_consultation_scheduling_link(p_token text, p_starts_at timestamptz)
returns consultations
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_link consultation_scheduling_links;
  v_row consultations;
  v_ends_at timestamptz := p_starts_at + interval '60 minutes';
  v_active_consent_version_id uuid;
begin
  select * into v_link from consultation_scheduling_links where token = p_token for update;
  if not found or v_link.expires_at < now() or v_link.used_at is not null then
    raise exception '유효하지 않거나 만료된 예약 링크입니다.';
  end if;

  select * into v_row from consultations where id = v_link.consultation_id for update;
  if not found then
    raise exception '상담 요청을 찾을 수 없습니다.';
  end if;
  if v_row.status <> 'requested' or v_row.starts_at is not null then
    raise exception '이미 처리된 상담 요청입니다.';
  end if;
  if v_row.admissions_consultant_id is distinct from v_link.consultant_id then
    raise exception '담당 컨설턴트가 변경되어 이 링크는 더 이상 사용할 수 없습니다.';
  end if;

  if p_starts_at <= now() then
    raise exception '이미 지난 시간은 선택할 수 없습니다. 다른 시간을 선택해 주세요.' using errcode = 'P0001';
  end if;
  if consultant_slot_blocked(v_link.consultant_id, p_starts_at, v_ends_at) then
    raise exception '담당 컨설턴트가 해당 시간에는 상담할 수 없습니다. 다른 시간을 선택해 주세요.' using errcode = 'P0001';
  end if;

  perform 1 from consultations c
  where c.starts_at is not null
    and c.status in ('requested', 'scheduled')
    and c.admissions_consultant_id = v_link.consultant_id
    and tstzrange(c.starts_at, c.ends_at) && tstzrange(p_starts_at, v_ends_at)
  for update;
  if found then
    raise exception '이미 다른 상담이 있는 시간입니다. 다른 시간을 선택해 주세요.';
  end if;

  select id into v_active_consent_version_id
  from consult_consent_versions
  where is_active = true
  order by created_at desc
  limit 1;

  update consultations set
    starts_at = p_starts_at,
    ends_at = v_ends_at,
    status = 'scheduled',
    scheduled_at = p_starts_at,
    consent_version_id = coalesce(v_row.consent_version_id, v_active_consent_version_id),
    updated_at = now()
  where id = v_row.id
  returning * into v_row;

  update consultation_scheduling_links set used_at = now() where id = v_link.id;

  insert into consultation_status_events (consultation_id, previous_status, new_status, reason)
  values (v_row.id, 'requested', 'scheduled', '고객 셀프 스케줄링(컨설턴트 전용 링크)');

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- B7 취소된 상담에는 온보딩 링크를 발급하지 않는다(20261917 정의 + 상태 검사만 추가).
-- ---------------------------------------------------------------------------
create or replace function public.create_trial_onboarding_link_multi(
  p_consultation_id uuid,
  p_guardian_email text,
  p_guardian_name text,
  p_students jsonb,
  p_admin_id uuid
)
returns table(link_id uuid, raw_token text)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_prospect_contact_id uuid;
  v_confirmed timestamptz;
  v_outcome consult_outcome;
  v_status v3_consultation_status;
  v_raw_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash text := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');
  v_id uuid;
  v_student jsonb;
  v_first_name text;
  v_first_email text;
  v_first_grade text;
  v_count int := 0;
begin
  if p_students is null or jsonb_typeof(p_students) <> 'array' or jsonb_array_length(p_students) < 1 then
    raise exception '학생을 최소 1명 입력해야 합니다.';
  end if;

  select prospect_contact_id, trial_intent_confirmed_at, outcome, status
    into v_prospect_contact_id, v_confirmed, v_outcome, v_status
  from consultations where id = p_consultation_id;
  if not found then
    raise exception '상담을 찾을 수 없습니다: %', p_consultation_id;
  end if;
  if v_status = 'cancelled' then
    raise exception '취소된 상담에는 온보딩 링크를 발급할 수 없습니다.';
  end if;
  if v_prospect_contact_id is null then
    raise exception '잠재고객(prospect_contact) 연결이 없는 상담입니다.';
  end if;
  if v_confirmed is null and v_outcome is distinct from 'regular_recommended' then
    raise exception '보호자의 체험 진행 확정(confirm_trial_intent) 이후에만 온보딩 링크를 발급할 수 있습니다.';
  end if;

  select v->>'name', v->>'email', v->>'grade'
    into v_first_name, v_first_email, v_first_grade
  from jsonb_array_elements(p_students) v limit 1;

  insert into trial_onboarding_links (
    consultation_id, prospect_contact_id, guardian_email, guardian_name,
    student_name, student_email, student_grade, token_hash, expires_at, created_by
  ) values (
    p_consultation_id, v_prospect_contact_id, p_guardian_email, p_guardian_name,
    v_first_name, v_first_email, v_first_grade, v_token_hash, now() + interval '72 hours', p_admin_id
  )
  returning id into v_id;

  for v_student in select * from jsonb_array_elements(p_students)
  loop
    if coalesce(v_student->>'name', '') = '' or coalesce(v_student->>'email', '') = '' then
      raise exception '학생 이름과 이메일은 필수입니다.';
    end if;
    insert into trial_onboarding_link_students (link_id, student_name, student_email, student_grade, student_subject)
    values (v_id, v_student->>'name', v_student->>'email', v_student->>'grade', v_student->>'subject');
    v_count := v_count + 1;
  end loop;

  insert into trial_onboarding_link_events (link_id, event_type, actor_id, detail)
  values (v_id, 'created', p_admin_id, jsonb_build_object('guardian_email', p_guardian_email, 'student_count', v_count));

  return query select v_id, v_raw_token;
end;
$$;

-- ---------------------------------------------------------------------------
-- B8 학생별 카드는 원 상담의 담당 컨설턴트를 이어받는다(20260906 정의 + 컬럼 복사만 추가).
-- ---------------------------------------------------------------------------
create or replace function public._create_student_kanban_card(
  p_root_consultation_id uuid,
  p_link_student_id uuid,
  p_child_auth_user_id uuid,
  p_household_id uuid
)
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

-- 기존 카드 백필 — 원 상담에 담당자가 있는데 카드에는 비어 있는 경우만(담당자가 이미 있는 카드는 건드리지 않는다).
update consultations c
set intake_owner_id = coalesce(c.intake_owner_id, r.intake_owner_id),
    admissions_consultant_id = r.admissions_consultant_id,
    assigned_at = coalesce(c.assigned_at, r.assigned_at),
    assigned_by = coalesce(c.assigned_by, r.assigned_by)
from consultations r
where c.is_child_onboarding_card
  and c.family_root_consultation_id = r.id
  and c.admissions_consultant_id is null
  and r.admissions_consultant_id is not null;

-- ---------------------------------------------------------------------------
-- B9 담당자는 컨설턴트 역할이어야 한다(20261910 이후 정의 + 역할 검사만 추가).
-- ---------------------------------------------------------------------------
create or replace function public.assign_consultation_owner(
  p_consultation_id uuid,
  p_field text,
  p_new_owner_id uuid,
  p_reason text default null
)
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
