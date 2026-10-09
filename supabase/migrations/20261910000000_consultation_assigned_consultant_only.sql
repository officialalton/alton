-- 2026-09-29 오너 규칙: 상담(과 상담 시간 슬롯)은 고객과 "배정된 컨설턴트" 사이에만 존재한다.
-- 회사 공용('공용') 슬롯 풀을 아무 방문자·보호자가 예약하는 경로는 없어야 한다.
--
-- 이 마이그레이션이 하는 일(추가 전용, 기존 이력은 삭제·수정하지 않는다):
--   1) consultations 트리거: 컨설턴트 없이 'scheduled' 이거나, requested/scheduled 이면서 시간(starts_at/
--      ends_at)이 있는 행의 신규 기록을 막는다. 종료 상태(completed/cancelled 등)의 옛 행은 그대로 둔다.
--   2) consultations_unassigned_no_overlap(전사 배타) 제약 제거 — (1)로 "시간이 있는 미배정 활성 행"이
--      더는 생길 수 없어 도달 불가능한 제약이 됐다. 원격 실측: requested/scheduled 이면서 시간이 있는
--      미배정 행 0건이라 제거해도 데이터 영향 없음.
--   3) submit_homepage_consult_request: 시간(p_starts_at)을 받으면 거절. 신청은 항상 시간 없이 들어가고
--      (자동배정 켜짐이면 컨설턴트 자동 배정) 관리자 배정 → 스케줄링 링크 → 고객이 그 컨설턴트 슬롯에서
--      시간을 고른다.
--   4) 공용 슬롯 RPC 제거: list_open_consult_slots, list_open_meeting_slots,
--      submit_guardian_portal_consult_request(앱 호출자 없음) drop.
--   5) list_open_consultant_meeting_slots: 조회자가 그 컨설턴트의 담당 학생/보호자(또는 본인·관리자)일
--      때만 슬롯을 돌려주도록 좁힌다(예전엔 로그인만 하면 아무 컨설턴트 슬롯을 조회 가능).
--   6) meeting_requests RLS: 보호자·학생이 시간을 넣어 신청하려면 담당 컨설턴트를 지정해야 한다
--      (시간 없는 신청은 컨설턴트 없이도 가능 — 관리자 배정 큐로 간다).
--
-- 롤백: 트리거·함수는 drop/replace 로 되돌릴 수 있다. 제거한 함수 본문은 20261009000000/20261217000000/
--   20261209000000/20261207010000 마이그레이션에 있고, 제약은 20261908000000 본문으로 복원한다.
--   데이터 변경은 없다.

-- =========================================================================
-- 1) consultations: 컨설턴트 없이 확정/시간 보유 금지 (신규 기록에만 적용)
--    UPDATE 는 관련 컬럼이 바뀔 때만 발동 — 옛 위반 행의 무관한 수정(메모 등)은 막지 않는다.
-- =========================================================================
create or replace function public.consultations_require_assigned_consultant()
returns trigger
language plpgsql
as $$
begin
  if new.admissions_consultant_id is null then
    if new.status = 'scheduled' then
      raise exception '담당 컨설턴트가 배정되지 않은 상담은 확정할 수 없습니다. 먼저 컨설턴트를 배정해 주세요.' using errcode = 'P0001';
    end if;
    if new.status = 'requested' and (new.starts_at is not null or new.ends_at is not null) then
      raise exception '담당 컨설턴트가 배정되지 않은 상담에는 시간을 지정할 수 없습니다. 먼저 컨설턴트를 배정해 주세요.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists consultations_require_assigned_consultant on consultations;
create trigger consultations_require_assigned_consultant
  before insert or update of status, starts_at, ends_at, admissions_consultant_id on consultations
  for each row execute function public.consultations_require_assigned_consultant();

comment on function public.consultations_require_assigned_consultant() is
  '2026-09-29 오너 규칙: 상담은 배정된 컨설턴트와 고객 사이에만 존재한다. 컨설턴트 없는 scheduled, '
  '컨설턴트 없이 시간이 있는 requested 는 신규 기록 불가(종료 상태의 옛 행은 영향 없음).';

-- =========================================================================
-- 2) 전사 단위 미배정 겹침 제약 제거(위 트리거로 도달 불가능해짐)
-- =========================================================================
alter table consultations drop constraint if exists consultations_unassigned_no_overlap;

-- =========================================================================
-- 3) 홈페이지 신청: 시간을 받지 않는다. (시그니처는 유지 — p_starts_at 은 항상 null 이어야 한다)
-- =========================================================================
create or replace function public.submit_homepage_consult_request(p_full_name text, p_email text, p_phone text, p_starts_at timestamp with time zone, p_student_grade text, p_concerns text, p_idempotency_key text)
 returns consultations
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_prospect prospect_contacts;
  v_consultation consultations;
  v_existing consultations;
  v_auto_assign_enabled boolean;
  v_candidate_id uuid;
begin
  if p_starts_at is not null then
    raise exception '상담 시간은 신청 시 정할 수 없습니다. 담당 컨설턴트가 배정된 뒤 안내되는 링크에서 선택해 주세요.' using errcode = 'P0001';
  end if;

  if p_idempotency_key is not null then
    select * into v_existing from consultations where idempotency_key = p_idempotency_key;
    if found then
      return v_existing;
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
    student_grade, category, concerns, status, requested_at, idempotency_key
  ) values (
    v_prospect.id, 'homepage', p_full_name, p_email, p_phone,
    p_student_grade, 'family', p_concerns, 'requested', now(), p_idempotency_key
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
    -- 대상이 없으면 조용히 미배정으로 남는다 — 관리자 큐에서 그대로 보인다.
  end if;

  return v_consultation;
end;
$function$;

-- =========================================================================
-- 4) 공용 슬롯 RPC 제거
-- =========================================================================
drop function if exists public.list_open_consult_slots(timestamptz, timestamptz);
drop function if exists public.list_open_meeting_slots(timestamptz, timestamptz);
drop function if exists public.submit_guardian_portal_consult_request(uuid, uuid, text, text, timestamptz, jsonb, text);

-- =========================================================================
-- 5) 컨설턴트 슬롯 조회는 그 컨설턴트의 담당 대상만
-- =========================================================================
create or replace function public.list_open_consultant_meeting_slots(
  p_consultant_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (slot_starts_at timestamptz)
language plpgsql stable
security definer
set search_path = public
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

revoke execute on function public.list_open_consultant_meeting_slots(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.list_open_consultant_meeting_slots(uuid, timestamptz, timestamptz) to authenticated, service_role;

-- =========================================================================
-- 6) meeting_requests: 시간을 넣은 신청은 담당 컨설턴트가 있어야 한다(보호자·학생 INSERT)
-- =========================================================================
drop policy if exists "보호자 본인 household 신청" on meeting_requests;
create policy "보호자 본인 household 신청" on meeting_requests for insert
  with check (
    requested_by = auth.uid()
    and exists (
      select 1 from household_members hm
      where hm.household_id = meeting_requests.household_id
        and hm.profile_id = auth.uid()
        and hm.role = 'guardian'
    )
    and (starts_at is null or consultant_id is not null)
    and (
      consultant_id is null
      or exists (
        select 1 from consultant_assignments ca
        join household_members child on child.profile_id = ca.student_id and child.role = 'child'
        where child.household_id = meeting_requests.household_id
          and ca.consultant_id = meeting_requests.consultant_id
      )
    )
  );

drop policy if exists "학생 본인 신청" on meeting_requests;
create policy "학생 본인 신청" on meeting_requests for insert
  with check (
    requested_by = auth.uid() and child_id = auth.uid()
    and (starts_at is null or consultant_id is not null)
    and (
      consultant_id is null
      or exists (
        select 1 from consultant_assignments ca
        where ca.student_id = auth.uid() and ca.consultant_id = meeting_requests.consultant_id
      )
    )
  );
