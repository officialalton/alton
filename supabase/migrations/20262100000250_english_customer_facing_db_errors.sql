-- Customer-facing DB error messages: Korean -> English (US customers).
-- Re-creates the latest definition of each function with only the RAISE message literals translated.
-- Idempotent: create or replace; SQLSTATE/errcode and logic unchanged. App matchers accept both texts during transition.

CREATE OR REPLACE FUNCTION public.create_weekly_lesson_series(p_child_id uuid, p_subject_enrollment_id uuid, p_teacher_id uuid, p_lesson_type_id uuid, p_first_starts_at timestamp with time zone, p_duration_minutes integer, p_occurrences smallint, p_series_timezone text, p_idempotency_key_prefix text, p_created_by uuid, p_admin_override boolean DEFAULT false)
 RETURNS TABLE(occurrence_index smallint, reservation_id uuid, session_id uuid, starts_at timestamp with time zone, failure_reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_series_id uuid;
  v_day_of_week smallint;
  v_i smallint;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_result record;
begin
  if p_occurrences < 1 or p_occurrences > 8 then
    raise exception 'Weekly recurring bookings must be between 1 and 8 occurrences (received: %).', p_occurrences using errcode = 'P0001';
  end if;

  v_day_of_week := extract(dow from (p_first_starts_at at time zone p_series_timezone));

  insert into booking_series (
    subject_enrollment_id, teacher_id, lesson_type_id, day_of_week, start_time_local, timezone,
    occurrences_planned, created_by
  ) values (
    p_subject_enrollment_id, p_teacher_id, p_lesson_type_id, v_day_of_week,
    (p_first_starts_at at time zone p_series_timezone)::time, p_series_timezone,
    p_occurrences, p_created_by
  )
  returning id into v_series_id;

  for v_i in 0..(p_occurrences - 1) loop
    v_starts_at := p_first_starts_at + (v_i || ' weeks')::interval;
    v_ends_at := v_starts_at + (p_duration_minutes || ' minutes')::interval;

    begin
      select * into v_result from confirm_lesson_booking(
        p_child_id, p_subject_enrollment_id, p_teacher_id, p_lesson_type_id,
        v_starts_at, v_ends_at,
        p_idempotency_key_prefix || ':' || v_i,
        v_series_id, v_i::smallint, p_admin_override
      );
      occurrence_index := v_i;
      reservation_id := v_result.reservation_id;
      session_id := v_result.session_id;
      starts_at := v_starts_at;
      failure_reason := null;
      return next;
    exception when others then
      -- 수업권 부족(hold_entitlement의 '사용 가능한 수업권이 없습니다.')이든 다른
      -- 실패(버퍼/가용성/window)든, 이 회차에서 멈추고 이후 회차는 시도하지 않는다
      -- ("가능한 회차까지만 생성" — 실패 지점 이후를 건너뛰고 계속하면 어느 회차가
      -- 왜 비었는지 안내가 모호해진다). 이미 만든 앞선 회차는 롤백하지 않는다(각
      -- 회차가 독립 예약이라는 스펙 요구사항).
      occurrence_index := v_i;
      reservation_id := null;
      session_id := null;
      starts_at := v_starts_at;
      failure_reason := sqlerrm;
      return next;
      exit;
    end;
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_lesson_booking(p_reservation_id uuid, p_cancelled_by_role text, p_cancelled_by_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_reservation reservations%rowtype;
  v_session sessions%rowtype;
  v_hours_until numeric;
  v_grant_id uuid;
  v_current_expires_at timestamptz;
  v_min_expires_at timestamptz;
  v_disposition text;
  v_final_status v3_session_final_status;
begin
  if p_cancelled_by_role not in ('student', 'teacher', 'company') then
    raise exception 'Unknown cancellation actor: %', p_cancelled_by_role using errcode = 'P0001';
  end if;

  select * into v_reservation from reservations where id = p_reservation_id for update;
  if v_reservation.id is null then
    raise exception 'Reservation not found.' using errcode = 'P0001';
  end if;
  if v_reservation.status <> 'confirmed' then
    raise exception 'Only confirmed reservations can be canceled (current status: %).', v_reservation.status using errcode = 'P0001';
  end if;

  v_hours_until := extract(epoch from (v_reservation.starts_at - now())) / 3600;

  -- 예약을 먼저 cancelled로 전환(덮어쓰지 않음 — 이 행 자체가 취소 이력이 된다).
  update reservations set status = 'cancelled' where id = p_reservation_id;

  if p_cancelled_by_role = 'student' and v_hours_until < 24 then
    perform consume_entitlement(p_reservation_id);
    v_disposition := 'consumed';
    v_final_status := 'student_cancelled';
  else
    perform release_entitlement(p_reservation_id);
    v_disposition := 'released';
    v_final_status := case p_cancelled_by_role
      when 'student' then 'student_cancelled'
      when 'teacher' then 'teacher_cancelled'
      else 'company_cancelled'
    end;

    if p_cancelled_by_role in ('teacher', 'company') then
      select grant_id into v_grant_id from entitlement_ledger
        where reservation_id = p_reservation_id and event_type = 'release';
      if v_grant_id is not null then
        select expires_at into v_current_expires_at from entitlement_grants where id = v_grant_id;
        v_min_expires_at := now() + interval '30 days';
        if v_current_expires_at < v_min_expires_at then
          perform extend_entitlement(v_grant_id, v_min_expires_at, 'r6_teacher_or_company_cancel:' || p_reservation_id);
        end if;
      end if;
    end if;
  end if;

  insert into reservation_cancellations (reservation_id, cancelled_by_role, cancelled_by_id, reason, entitlement_disposition)
  values (p_reservation_id, p_cancelled_by_role, p_cancelled_by_id, p_reason, v_disposition);

  -- M5-a 신규: kind='lesson' 예약이면 연결된 세션도 최종판정한다. 세션이 아직
  -- 'scheduled'일 때만(수업이 이미 시작·완료됐으면 이 취소 경로 대상이 아니다 —
  -- 그 경우는 finalize_lesson_session()/recomplete_session()의 영역).
  if v_reservation.kind = 'lesson' then
    select * into v_session from sessions where reservation_id = p_reservation_id for update;
    if v_session.id is not null and v_session.final_status = 'scheduled' then
      update sessions
        set final_status = v_final_status,
            payable_minutes = case when v_disposition = 'consumed' then v_session.scheduled_duration_minutes else 0 end,
            final_reason = p_reason,
            final_actor_id = p_cancelled_by_id,
            finalized_at = now()
        where id = v_session.id;

      insert into session_status_events (session_id, event_type, previous_final_status, new_final_status, actor_profile_id, reason)
      values (v_session.id, v_final_status::text::v3_session_status_event_type, 'scheduled', v_final_status, p_cancelled_by_id, p_reason);

      perform public.upsert_session_payout_item(v_session.id);
    end if;
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.hold_entitlement(p_child_id uuid, p_reservation_id uuid, p_lesson_start_at timestamp with time zone, p_needed integer DEFAULT 1, p_lesson_type_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_grant record;
  v_remaining int;
begin
  if p_needed <= 0 then
    raise exception 'p_needed must be greater than 0 (received: %).', p_needed;
  end if;

  for v_grant in
    select g.id from entitlement_grants g
    join entitlement_products ep on ep.id = g.entitlement_product_id
    join entitlement_types et on et.id = ep.entitlement_type_id
    where g.child_id = p_child_id and g.expires_at > p_lesson_start_at
      and (p_lesson_type_id is null or et.lesson_type_id = p_lesson_type_id)
    order by g.expires_at asc, g.created_at asc
    for update of g
  loop
    select coalesce(sum(amount), 0) into v_remaining from entitlement_ledger where grant_id = v_grant.id;
    if v_remaining >= p_needed then
      insert into entitlement_ledger (grant_id, event_type, amount, reservation_id)
      values (v_grant.id, 'hold', -p_needed, p_reservation_id);
      return v_grant.id;
    end if;
  end loop;
  raise exception 'No lesson credits are available.';
end;
$function$;

CREATE OR REPLACE FUNCTION public.consume_entitlement(p_reservation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_grant_id uuid;
begin
  select grant_id into v_grant_id from entitlement_ledger
    where reservation_id = p_reservation_id and event_type = 'hold';
  if v_grant_id is null then
    raise exception 'No hold found for this reservation.';
  end if;

  -- grant를 먼저 잠근다: 동시에 들어온 consume()/release() 요청이 여기서 직렬화된다.
  perform 1 from entitlement_grants where id = v_grant_id for update;

  -- 잠금 획득 *후* 재검사 — 대기하는 동안 상대 트랜잭션이 먼저 커밋했을 수 있다.
  if exists (select 1 from entitlement_ledger where reservation_id = p_reservation_id and event_type = 'consume') then
    raise exception 'Already consumed.';
  end if;
  if exists (select 1 from entitlement_ledger where reservation_id = p_reservation_id and event_type = 'release') then
    raise exception 'A released reservation cannot be consumed.';
  end if;

  insert into entitlement_ledger (grant_id, event_type, amount, reservation_id)
  values (v_grant_id, 'consume', 0, p_reservation_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.release_entitlement(p_reservation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_hold record;
begin
  select grant_id, -amount as held_amount into v_hold from entitlement_ledger
    where reservation_id = p_reservation_id and event_type = 'hold';
  if v_hold.grant_id is null then
    raise exception 'No hold found for this reservation.';
  end if;

  -- grant를 먼저 잠근다(consume_entitlement()와 동일한 원리 — 위 주석 참고).
  perform 1 from entitlement_grants where id = v_hold.grant_id for update;

  if exists (select 1 from entitlement_ledger where reservation_id = p_reservation_id and event_type = 'release') then
    raise exception 'Already released.';
  end if;
  if exists (select 1 from entitlement_ledger where reservation_id = p_reservation_id and event_type = 'consume') then
    raise exception 'A consumed reservation cannot be released.';
  end if;

  insert into entitlement_ledger (grant_id, event_type, amount, reservation_id)
  values (v_hold.grant_id, 'release', v_hold.held_amount, p_reservation_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.request_reservation_reschedule(p_reservation_id uuid, p_proposed_starts_at timestamp with time zone, p_proposed_ends_at timestamp with time zone, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_res reservations%rowtype; v_id uuid;
begin
  select * into v_res from reservations where id = p_reservation_id;
  if v_res.id is null then raise exception 'Reservation not found.'; end if;
  if v_res.owner_profile_id <> auth.uid() then raise exception 'You can only request to reschedule your own reservation.'; end if;
  if v_res.status <> 'confirmed' then raise exception 'Only confirmed reservations can be rescheduled.'; end if;
  if v_res.starts_at <= now() then raise exception 'A reservation that has already started or passed cannot be rescheduled.'; end if;
  if p_proposed_ends_at <= p_proposed_starts_at then raise exception 'The end time must be after the start time.'; end if;

  insert into reservation_reschedule_requests (reservation_id, requested_by, reason, proposed_starts_at, proposed_ends_at)
  values (p_reservation_id, auth.uid(), nullif(trim(p_reason), ''), p_proposed_starts_at, p_proposed_ends_at)
  returning id into v_id;
  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.respond_to_reservation_reschedule(p_request_id uuid, p_accept boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_req reservation_reschedule_requests%rowtype; v_child_id uuid;
begin
  select * into v_req from reservation_reschedule_requests where id = p_request_id;
  if v_req.id is null then raise exception 'Request not found.'; end if;
  if v_req.status <> 'pending' then raise exception 'This request has already been handled.'; end if;

  select se.child_id into v_child_id
  from reservations r join subject_enrollments se on se.id = r.subject_enrollment_id
  where r.id = v_req.reservation_id;
  if v_child_id is null or not (v_child_id = auth.uid() or is_guardian_of(v_child_id)) then
    raise exception 'You can only respond for your own or your child''s reservation.';
  end if;

  if p_accept then
    update reservations set starts_at = v_req.proposed_starts_at, ends_at = v_req.proposed_ends_at
    where id = v_req.reservation_id;
    update reservation_reschedule_requests
    set status = 'accepted', resolved_at = now(), resolved_by = auth.uid()
    where id = p_request_id;
  else
    update reservation_reschedule_requests
    set status = 'declined', resolved_at = now(), resolved_by = auth.uid()
    where id = p_request_id;
  end if;
end $function$;

CREATE OR REPLACE FUNCTION public.reservations_student_overlap_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_child uuid;
begin
  if new.kind <> 'lesson' or new.subject_enrollment_id is null
     or new.status not in ('holding', 'confirmed') then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.starts_at = old.starts_at and new.ends_at = old.ends_at
     and new.status = old.status and new.kind = old.kind
     and new.subject_enrollment_id is not distinct from old.subject_enrollment_id then
    return new; -- 시간·상태가 그대로인 갱신(구글 동기화 등)은 검사하지 않는다(기존 데이터 보존)
  end if;

  select child_id into v_child from subject_enrollments where id = new.subject_enrollment_id;
  if v_child is null then
    return new;
  end if;

  -- 같은 학생의 동시 예약 경합 직렬화
  perform pg_advisory_xact_lock(hashtextextended('student_overlap:' || v_child::text, 0));

  if violates_student_overlap(v_child, new.starts_at, new.ends_at, new.id) then
    raise exception 'student_time_overlap: You already have another lesson at the same time.' using errcode = 'P0001';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.consultations_no_meeting_overlap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.admissions_consultant_id is not null
     and new.status in ('requested', 'scheduled')
     and new.starts_at is not null and new.ends_at is not null then
    perform pg_advisory_xact_lock(hashtextextended('meeting-consultant-' || new.admissions_consultant_id::text, 0));
    if exists (
      select 1 from meeting_requests m
      where m.consultant_id = new.admissions_consultant_id
        and m.status in ('requested', 'confirming', 'scheduling', 'scheduled')
        and m.starts_at is not null and m.ends_at is not null
        and tstzrange(m.starts_at, m.ends_at) && tstzrange(new.starts_at, new.ends_at)
    ) then
      raise exception 'This time overlaps another meeting with the same consultant. Please choose a different time.' using errcode = '23P01';
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.meeting_requests_enforce_consultant()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_active boolean := new.status in ('requested', 'confirming', 'scheduling', 'scheduled');
begin
  if new.consultant_id is null then
    if new.status = 'scheduled' or (v_active and (new.starts_at is not null or new.ends_at is not null)) then
      raise exception 'Please assign a consultant first. A meeting without an assigned consultant cannot be scheduled.' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if v_active and new.starts_at is not null and new.ends_at is not null then
    perform pg_advisory_xact_lock(hashtextextended('meeting-consultant-' || new.consultant_id::text, 0));
    if exists (
      select 1 from meeting_requests m
      where m.consultant_id = new.consultant_id and m.id <> new.id
        and m.status in ('requested', 'confirming', 'scheduling', 'scheduled')
        and m.starts_at is not null and m.ends_at is not null
        and tstzrange(m.starts_at, m.ends_at) && tstzrange(new.starts_at, new.ends_at)
    ) then
      raise exception 'This time overlaps another meeting with the same consultant. Please choose a different time.' using errcode = '23P01';
    end if;
    if exists (
      select 1 from consultations c
      where c.admissions_consultant_id = new.consultant_id
        and c.status in ('requested', 'scheduled')
        and c.starts_at is not null and c.ends_at is not null
        and tstzrange(c.starts_at, c.ends_at) && tstzrange(new.starts_at, new.ends_at)
    ) then
      raise exception 'This time overlaps a consultation with the same consultant. Please choose a different time.' using errcode = '23P01';
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_meeting_request_core(p_meeting_request_id uuid, p_actor uuid, p_rerequest boolean DEFAULT false, p_reason text DEFAULT NULL::text)
 RETURNS TABLE(new_request_id uuid, was_already_cancelled boolean, consultant_id uuid, google_event_id text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row meeting_requests;
  v_new uuid := null;
begin
  select * into v_row from meeting_requests where id = p_meeting_request_id for update;
  if not found then
    raise exception 'Meeting request not found.' using errcode = 'P0001';
  end if;
  if v_row.status = 'completed' then
    raise exception 'A completed meeting cannot be canceled.' using errcode = 'P0001';
  end if;
  if v_row.status = 'cancelled' then
    if p_rerequest then
      raise exception 'This meeting is already canceled. A new request can only be made from an active meeting.' using errcode = 'P0001';
    end if;
    return query select null::uuid, true, v_row.consultant_id, v_row.google_event_id;
    return;
  end if;

  update meeting_requests set status = 'cancelled', updated_at = now() where id = p_meeting_request_id;

  if p_rerequest then
    insert into meeting_requests (
      household_id, child_id, subject, content, contact_preference, preferred_contact_time,
      requested_by, source_message_id, status, rescheduled_from_id
    ) values (
      v_row.household_id, v_row.child_id, v_row.subject, v_row.content, v_row.contact_preference, v_row.preferred_contact_time,
      v_row.requested_by, v_row.source_message_id, 'requested', v_row.id
    ) returning id into v_new;

    insert into meeting_request_assignment_history (meeting_request_id, prior_consultant_id, new_consultant_id, actor_id, reason)
    values (v_row.id, v_row.consultant_id, null, p_actor, coalesce(nullif(trim(p_reason), ''), '취소 후 재신청') || ' → 새 요청 ' || v_new::text);
  end if;

  return query select v_new, false, v_row.consultant_id, v_row.google_event_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.redeem_consultation_scheduling_link(p_token text, p_starts_at timestamp with time zone)
 RETURNS consultations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_link consultation_scheduling_links;
  v_row consultations;
  v_ends_at timestamptz := p_starts_at + interval '60 minutes';
begin
  select * into v_link from consultation_scheduling_links where token = p_token for update;
  if not found or v_link.expires_at < now() or v_link.used_at is not null then
    raise exception 'This scheduling link is invalid or has expired.';
  end if;

  select * into v_row from consultations where id = v_link.consultation_id for update;
  if not found then
    raise exception 'Consultation request not found.';
  end if;
  if v_row.status <> 'requested' or v_row.starts_at is not null then
    raise exception 'This consultation request has already been handled.';
  end if;
  if v_row.admissions_consultant_id is distinct from v_link.consultant_id then
    raise exception 'The assigned consultant has changed, so this link can no longer be used.';
  end if;

  if p_starts_at <= now() then
    raise exception 'A time in the past cannot be selected. Please choose a different time.' using errcode = 'P0001';
  end if;
  if consultant_slot_blocked(v_link.consultant_id, p_starts_at, v_ends_at) then
    raise exception 'The consultant is not available at that time. Please choose a different time.' using errcode = 'P0001';
  end if;

  perform 1 from consultations c
  where c.starts_at is not null
    and c.status in ('requested', 'scheduled')
    and c.admissions_consultant_id = v_link.consultant_id
    and tstzrange(c.starts_at, c.ends_at) && tstzrange(p_starts_at, v_ends_at)
  for update;
  if found then
    raise exception 'Another consultation is already scheduled at that time. Please choose a different time.';
  end if;

  update consultations set
    starts_at = p_starts_at,
    ends_at = v_ends_at,
    status = 'scheduled',
    scheduled_at = p_starts_at,
    updated_at = now()
  where id = v_row.id
  returning * into v_row;

  update consultation_scheduling_links set used_at = now() where id = v_link.id;

  insert into consultation_status_events (consultation_id, previous_status, new_status, reason)
  values (v_row.id, 'requested', 'scheduled', '고객 셀프 스케줄링(컨설턴트 전용 링크)');

  return v_row;
end;
$function$;

CREATE OR REPLACE FUNCTION public.list_consultant_open_slots(p_token text, p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS TABLE(slot_starts_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_link consultation_scheduling_links;
  v_row consultations;
begin
  select * into v_link from consultation_scheduling_links where token = p_token;
  if not found or v_link.expires_at < now() or v_link.used_at is not null then
    raise exception 'This scheduling link is invalid or has expired.';
  end if;

  -- 담당 컨설턴트가 바뀌었거나 상담이 이미 처리된(시간 확정·취소) 링크는 무효다.
  select * into v_row from consultations where id = v_link.consultation_id;
  if not found
     or v_row.status <> 'requested'
     or v_row.starts_at is not null
     or v_row.admissions_consultant_id is distinct from v_link.consultant_id then
    raise exception 'This scheduling link is invalid or has expired.';
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
$function$;

CREATE OR REPLACE FUNCTION public.list_open_consultant_meeting_slots(p_consultant_id uuid, p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS TABLE(slot_starts_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    raise exception 'Only the assigned consultant''s available times can be viewed.' using errcode = 'P0001';
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
$function$;

CREATE OR REPLACE FUNCTION public.confirm_consult_consent_by_token(p_token_plain text)
 RETURNS TABLE(consultation_id uuid, consent_version_id uuid, confirmed_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_token consult_consent_tokens;
  v_consultation consultations;
begin
  select * into v_token from consult_consent_tokens
  where token_hash = encode(extensions.digest(p_token_plain, 'sha256'), 'hex') and expires_at > now()
  for update;
  if not found then
    raise exception 'This confirmation link is invalid or has expired.';
  end if;

  select * into v_consultation from consultations where id = v_token.consultation_id for update;
  if not found then
    raise exception 'Consultation request not found.';
  end if;

  if v_token.used_at is null then
    update consult_consent_tokens set used_at = now() where id = v_token.id;
  end if;

  if v_consultation.consent_confirmed_at is null then
    update consultations set
      consent_confirmed_at = now(),
      consent_confirmed_ip = null -- IP는 앱 레이어(요청 헤더 접근 가능한 서버 액션)에서 별도 UPDATE로 기록한다.
    where id = v_consultation.id
    returning * into v_consultation;
  end if;

  return query select v_consultation.id, v_consultation.consent_version_id, v_consultation.consent_confirmed_at;
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_homepage_consult_request(p_full_name text, p_email text, p_phone text, p_starts_at timestamp with time zone, p_student_grade text, p_concerns text, p_idempotency_key text, p_ai_notes_consent_version text DEFAULT NULL::text)
 RETURNS consultations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_prospect prospect_contacts;
  v_consultation consultations;
  v_existing consultations;
begin
  if p_starts_at is not null then
    raise exception 'A consultation time cannot be chosen when submitting the request. Please choose a time from the link sent after a consultant is assigned.' using errcode = 'P0001';
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
    raise exception 'You already have a consultation request pending. Please wait until our team reviews it.';
  end if;

  insert into prospect_contacts (full_name, primary_email, primary_phone)
  values (p_full_name, p_email, p_phone)
  returning * into v_prospect;

  insert into consultations (
    prospect_contact_id, source, contact_name, contact_email, contact_phone,
    student_grade, category, concerns, status, requested_at, idempotency_key,
    ai_notes_consent_version, ai_notes_consent_at
  ) values (
    v_prospect.id, 'homepage', p_full_name, p_email, p_phone,
    p_student_grade, 'family', p_concerns, 'requested', now(), p_idempotency_key,
    nullif(trim(p_ai_notes_consent_version), ''),
    case when nullif(trim(p_ai_notes_consent_version), '') is not null then now() end
  )
  returning * into v_consultation;

  insert into consultation_status_events (consultation_id, previous_status, new_status, reason)
  values (v_consultation.id, null, 'requested', '홈페이지 상담 신청');

  if _auto_assign_consultation(v_consultation.id) is not null then
    select * into v_consultation from consultations where id = v_consultation.id;
  end if;

  return v_consultation;
end;
$function$;

CREATE OR REPLACE FUNCTION public.consent_as_guardian(p_student_id uuid, p_policy_version_id uuid, p_notice_delivered_at timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
  v_existing_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Login required.';
  end if;
  if auth.uid() = p_student_id then
    raise exception 'Students cannot give guardian consent for themselves.';
  end if;
  if not exists (
    select 1 from household_members hm
    join household_members child
      on child.household_id = hm.household_id and child.role = 'child' and child.profile_id = p_student_id
    where hm.role = 'guardian' and hm.profile_id = auth.uid()
  ) then
    raise exception 'Only this student''s guardian can give consent.';
  end if;
  if not exists (select 1 from consent_policy_versions where id = p_policy_version_id and retired_at is null) then
    raise exception 'Invalid policy version.';
  end if;

  select id into v_existing_id
  from guardian_consents
  where student_id = p_student_id and policy_version_id = p_policy_version_id and revoked_at is null
  limit 1;
  if v_existing_id is not null then
    return v_existing_id;
  end if;

  insert into guardian_consents (
    student_id, policy_version_id, consented_by, verification_method, notice_delivered_at
  ) values (
    p_student_id, p_policy_version_id, auth.uid(), 'household_guardian_session', p_notice_delivered_at
  )
  returning id into v_id;

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.revoke_guardian_consent(p_consent_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_consent guardian_consents%rowtype;
  v_is_active_guardian boolean;
begin
  select * into v_consent from guardian_consents where id = p_consent_id;
  if not found then
    raise exception 'Consent record not found.';
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
    raise exception 'Only the guardian who gave consent, or an admin, can withdraw it.';
  end if;

  insert into public.status_transition_tokens (table_name, row_id, action)
  values ('guardian_consents', p_consent_id, 'revoke_consent');

  update guardian_consents
  set revoked_at = now(), revoked_by = auth.uid(), revocation_reason = p_reason
  where id = p_consent_id;

  insert into privacy_review_tasks (student_id, reason, created_by)
  values (
    v_consent.student_id,
    coalesce('guardian consent revoked: ' || p_reason, 'guardian consent revoked'),
    auth.uid()
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.protect_guardian_consent()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'guardian_consents rows cannot be deleted.';
  end if;

  if new.id is distinct from old.id
     or new.student_id is distinct from old.student_id
     or new.policy_version_id is distinct from old.policy_version_id
     or new.consented_by is distinct from old.consented_by
     or new.consented_at is distinct from old.consented_at
     or new.verification_method is distinct from old.verification_method
     or new.verification_reference is distinct from old.verification_reference
     or new.notice_delivered_at is distinct from old.notice_delivered_at then
    raise exception 'The consent-time record in guardian_consents (policy version, verification method, timestamp) cannot be modified.';
  end if;

  -- 철회 3필드(revoked_at/revoked_by/revocation_reason)만 바뀌는 UPDATE.
  -- revoke_guardian_consent()가 심어 둔 1회용 토큰이 없으면 거부한다 — 이
  -- 함수를 거치지 않은 직접 UPDATE는 필드 집합이 우연히 일치하더라도 더 이상
  -- 통과할 수 없다(privacy_review_tasks 생성을 건너뛸 수 없게 됨).
  if not public.consume_status_transition_token('guardian_consents', old.id, 'revoke_consent') then
    raise exception 'guardian_consents can only be modified through revoke_guardian_consent().';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.protect_date_of_birth()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
      or (old.date_of_birth is null and new.id = auth.uid())
    ) then
      raise exception 'Date of birth cannot be edited directly. Only a guardian or an admin can change it.';
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_student_date_of_birth(p_student_id uuid, p_date_of_birth date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    raise exception 'Only this student''s guardian or an admin can change the date of birth.';
  end if;
  if not exists (select 1 from profiles where id = p_student_id and role = 'student') then
    raise exception 'Not a student profile: %', p_student_id;
  end if;

  update profiles set date_of_birth = p_date_of_birth where id = p_student_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.assert_guardian_consent_ok(p_student_id uuid, p_context text)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if is_under_13(p_student_id) and not has_valid_guardian_consent(p_student_id) then
    raise exception '%: Students under 13 need valid guardian consent to proceed (student id: %).', p_context, p_student_id;
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.record_trial_smart_notes_consent(p_child_id uuid, p_policy_version text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_guardian_id uuid := auth.uid();
  v_existing_id uuid;
  v_new_id uuid;
  v_consultation_id uuid;
  v_link_student_id uuid;
  v_grant_id uuid;
begin
  if v_guardian_id is null then
    raise exception 'Login required.';
  end if;
  if not exists (
    select 1 from household_members hm
    join household_members hc on hc.household_id = hm.household_id
    where hm.profile_id = v_guardian_id and hm.role = 'guardian'
      and hc.profile_id = p_child_id and hc.role = 'child'
  ) then
    raise exception 'Consent can only be recorded for a child in your own family.';
  end if;

  select id into v_existing_id from trial_smart_notes_consents where child_id = p_child_id;
  if v_existing_id is not null then
    v_new_id := v_existing_id; -- 멱등: 이미 동의했으면 그대로 반환(재확인 요구 안 함).
  else
    insert into trial_smart_notes_consents (child_id, guardian_id, policy_version, confirmed_ip)
    values (
      p_child_id, v_guardian_id, p_policy_version,
      nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-forwarded-for'
    )
    returning id into v_new_id;
  end if;

  -- 이 동의로 지급 가능해진 체험수업권을 즉시 시도한다. 실패해도 동의 기록
  -- 자체는 되돌리지 않는다 — 관리자 화면의 "지급 재시도" 버튼이 여전히
  -- fallback으로 남아있다.
  select id into v_consultation_id
  from consultations
  where child_id = p_child_id and outcome = 'trial_recommended'
    and coalesce(trial_entitlement_grant_status, 'not_applicable') != 'granted'
  order by created_at desc
  limit 1;

  if v_consultation_id is not null then
    update consultations set trial_entitlement_grant_status = 'pending' where id = v_consultation_id;
    begin
      v_grant_id := grant_trial_entitlement_for_consultation(v_consultation_id);
      update consultations set
        trial_entitlement_grant_id = v_grant_id,
        trial_entitlement_grant_status = 'granted',
        trial_entitlement_grant_error = null
      where id = v_consultation_id;
    exception when others then
      update consultations set
        trial_entitlement_grant_status = 'failed',
        trial_entitlement_grant_error = sqlerrm
      where id = v_consultation_id;
    end;
  else
    -- 2026-09-10: 상담이 없으면(직접생성 경로) trial_onboarding_link_students에서
    -- 이 학생을 찾아 동일한 pending→granted/failed 기록 패턴으로 지급을 시도한다.
    select id into v_link_student_id
    from trial_onboarding_link_students
    where child_auth_user_id = p_child_id and status = 'created'
      and coalesce(trial_entitlement_grant_status, 'not_applicable') != 'granted'
    order by created_at desc
    limit 1;

    if v_link_student_id is not null then
      update trial_onboarding_link_students set trial_entitlement_grant_status = 'pending' where id = v_link_student_id;
      begin
        v_grant_id := grant_trial_entitlement_for_student(p_child_id);
        update trial_onboarding_link_students set
          trial_entitlement_grant_id = v_grant_id,
          trial_entitlement_grant_status = 'granted',
          trial_entitlement_grant_error = null
        where id = v_link_student_id;
      exception when others then
        update trial_onboarding_link_students set
          trial_entitlement_grant_status = 'failed',
          trial_entitlement_grant_error = sqlerrm
        where id = v_link_student_id;
      end;
    end if;
  end if;

  return v_new_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.confirm_regular_progress_intent(p_subject_enrollment_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_guardian_id uuid := auth.uid();
  v_existing_id uuid;
  v_new_id uuid;
begin
  if v_guardian_id is null or not exists (select 1 from parents where id = v_guardian_id) then
    raise exception 'Only a signed-in guardian can confirm intent to continue with regular lessons.';
  end if;
  if not exists (
    select 1 from subject_enrollments se
    join household_members hc on hc.household_id = (
      select hm.household_id from household_members hm
      where hm.profile_id = se.child_id and hm.role = 'child' limit 1
    )
    where se.id = p_subject_enrollment_id and hc.profile_id = v_guardian_id and hc.role = 'guardian'
  ) then
    raise exception 'You can only confirm intent to continue for a subject enrollment in your own family.';
  end if;

  select id into v_existing_id from trial_regular_progress_selections where subject_enrollment_id = p_subject_enrollment_id;
  if v_existing_id is not null then
    return v_existing_id;
  end if;

  insert into trial_regular_progress_selections (subject_enrollment_id, guardian_id)
  values (p_subject_enrollment_id, v_guardian_id)
  returning id into v_new_id;
  return v_new_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_household_default_timezone(p_household_id uuid, p_timezone text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_timezone is null or length(trim(p_timezone)) = 0 then
    raise exception 'The time zone value is empty.';
  end if;

  if not (
    is_admin()
    or exists (
      select 1 from household_members
      where household_id = p_household_id
        and profile_id = auth.uid()
        and role = 'guardian'
        and is_primary = true
    )
  ) then
    raise exception 'Only the primary guardian of this family can change the default time zone.';
  end if;

  update households set default_timezone = p_timezone where id = p_household_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.request_child_deletion(p_child_id uuid, p_household_id uuid, p_scope text[], p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Login required.'; end if;
  if not (is_admin() or exists (select 1 from household_members hm
        where hm.household_id = p_household_id and hm.profile_id = auth.uid() and hm.role = 'guardian')) then
    raise exception 'Only a guardian of this family, or an admin, can request deletion.';
  end if;
  if not exists (select 1 from household_members hm where hm.household_id = p_household_id and hm.profile_id = p_child_id) then
    raise exception 'This child does not belong to this family.';
  end if;
  insert into child_deletion_requests (child_id, household_id, requested_by, target_scope, reason)
  values (p_child_id, p_household_id, auth.uid(), p_scope, p_reason) returning id into v_id;
  perform _notify_legal_hold_holders('Child data deletion request received. Review it in the admin queue.');
  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.get_or_create_draft_contract_for_child(p_child_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_household_id uuid;
  v_existing_id uuid;
  v_new_id uuid;
begin
  select id into v_existing_id from contracts
  where child_id = p_child_id and status not in ('void', 'superseded', 'terminated', 'expired')
  order by created_at desc limit 1;
  if v_existing_id is not null then
    return v_existing_id;
  end if;

  select hm.household_id into v_household_id
  from household_members hm where hm.profile_id = p_child_id and hm.role = 'child' limit 1;
  if v_household_id is null then
    raise exception 'Could not find the family for this student.';
  end if;

  insert into contracts (household_id, child_id, status) values (v_household_id, p_child_id, 'draft')
  returning id into v_new_id;
  return v_new_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.complete_student_profile(p_date_of_birth date, p_school_name text, p_grade text, p_sat_score integer, p_gpa numeric, p_target_colleges text[], p_intended_majors text[], p_gpa_scale text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_student_id uuid := auth.uid();
  v_current_dob date;
begin
  if v_student_id is null then
    raise exception 'Login required.';
  end if;
  if not exists (select 1 from profiles where id = v_student_id and role = 'student') then
    raise exception 'Only student accounts can complete a student profile.';
  end if;
  if not exists (select 1 from students where id = v_student_id) then
    raise exception 'No student data found: %', v_student_id;
  end if;

  select date_of_birth into v_current_dob from profiles where id = v_student_id;
  if v_current_dob is null then
    if p_date_of_birth is null then
      raise exception 'Date of birth is required.';
    end if;
    update profiles set date_of_birth = p_date_of_birth where id = v_student_id;
  end if;

  if p_school_name is null or btrim(p_school_name) = '' then
    raise exception 'School name is required.';
  end if;
  if p_grade is null or btrim(p_grade) = '' then
    raise exception 'Grade is required.';
  end if;

  -- SAT: 입력값이 있으면 유효 범위(400~1600)만 허용.
  if p_sat_score is not null and (p_sat_score < 400 or p_sat_score > 1600) then
    raise exception 'SAT score must be between 400 and 1600.';
  end if;

  -- 2026-09-06 추가: GPA는 음수일 수 없다(DB CHECK와 함께 서버에서도 명시적으로 거부).
  if p_gpa is not null and p_gpa < 0 then
    raise exception 'GPA must be 0 or greater.';
  end if;

  -- GPA ↔ 척도: 값이 있으면 척도 필수, 척도만 있고 값이 없는 상태는 금지,
  -- 값은 선택한 척도의 만점을 초과할 수 없음(척도 텍스트 값=만점 숫자값).
  if p_gpa is not null and p_gpa_scale is null then
    raise exception 'To enter a GPA, you must also select a GPA scale.';
  end if;
  if p_gpa is null and p_gpa_scale is not null then
    raise exception 'A GPA scale without a GPA value is not allowed.';
  end if;
  if p_gpa is not null and p_gpa_scale is not null and p_gpa > p_gpa_scale::numeric then
    raise exception 'GPA (%) cannot exceed the selected scale (%).', p_gpa, p_gpa_scale;
  end if;

  update students set
    school_name = btrim(p_school_name),
    grade = btrim(p_grade),
    sat_score = p_sat_score,
    gpa = p_gpa,
    gpa_scale = p_gpa_scale,
    target_colleges = coalesce(p_target_colleges, '{}'),
    intended_majors = coalesce(p_intended_majors, '{}'),
    profile_completed_at = now()
  where id = v_student_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.provision_free_member(p_name text, p_birthdate date, p_grade text, p_school text DEFAULT NULL::text, p_terms_version text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_confirmed timestamptz;
  v_meta jsonb;
  v_existing_member_type text;
  v_existing_source text;
begin
  if v_uid is null then
    raise exception 'Login required.';
  end if;

  select u.email_confirmed_at, u.raw_user_meta_data
    into v_confirmed, v_meta
  from auth.users u where u.id = v_uid;
  if not found then
    raise exception 'Account not found.';
  end if;
  if v_confirmed is null then
    raise exception 'Email verification is required.';
  end if;

  -- 멱등: 같은 사용자가 이미 무료 회원으로 프로비저닝됨 → 그대로 반환.
  select s.member_type, s.signup_source into v_existing_member_type, v_existing_source
  from students s where s.id = v_uid;
  if exists (select 1 from profiles p where p.id = v_uid) then
    if v_existing_member_type = 'free' and v_existing_source = 'self_signup' then
      return v_uid;
    end if;
    raise exception 'This account is already registered.';
  end if;

  if coalesce(v_meta->>'signup_source', '') <> 'self_signup' then
    raise exception 'Only accounts created through self sign-up can be registered here.';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'Name is required.';
  end if;
  if p_grade is null or btrim(p_grade) = '' then
    raise exception 'Grade is required.';
  end if;
  if p_birthdate is null then
    raise exception 'Date of birth is required.';
  end if;
  if p_birthdate > (now() at time zone 'utc')::date then
    raise exception 'Date of birth is not valid.';
  end if;
  if (p_birthdate + interval '13 years') > (now() at time zone 'utc')::date then
    raise exception 'Students under 13 cannot sign up directly. A parent or guardian should request a consultation.';
  end if;
  if p_terms_version is null or btrim(p_terms_version) = '' then
    raise exception 'You must agree to the terms.';
  end if;

  insert into profiles (id, role, name, date_of_birth)
  values (v_uid, 'student', btrim(p_name), p_birthdate);

  -- 학교는 선택(오너 결정 7-4) → profile_completed_at을 바로 채워 /complete-profile 게이트를 지난다.
  insert into students (id, grade, school_name, status, member_type, signup_source, profile_completed_at)
  values (v_uid, btrim(p_grade), nullif(btrim(coalesce(p_school, '')), ''), 'active', 'free', 'self_signup', now());

  insert into student_terms_acceptances (student_id, terms_version, source)
  values (v_uid, btrim(p_terms_version), 'self_signup');

  return v_uid;
end;
$function$;

CREATE OR REPLACE FUNCTION public.protect_student_member_type()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if (new.member_type is distinct from old.member_type or new.signup_source is distinct from old.signup_source)
     and coalesce(current_setting('app.allow_member_type_change', true), 'false') <> 'true'
     and auth.uid() is not null
     and not is_admin() then
    raise exception 'member_type/signup_source can only be changed by an admin or the conversion process.';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.activate_subject_enrollment_if_ready(p_subject_enrollment_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_child_id uuid;
begin
  select child_id into v_child_id from subject_enrollments where id = p_subject_enrollment_id;
  if v_child_id is null then
    raise exception 'Subject enrollment not found: %', p_subject_enrollment_id;
  end if;

  if not (
    v_child_id = auth.uid()
    or is_guardian_of(v_child_id)
    or is_household_guardian_of(v_child_id)
    or is_admin()
    or current_user_has_capability('매칭권한')
  ) then
    raise exception 'You do not have permission to access this enrollment.';
  end if;

  -- 기존 활성화 판정 경로(R5/M4)를 그대로 재사용한다 — 새 조건을 만들지 않는다.
  if not subject_enrollment_activation_ready(p_subject_enrollment_id) then
    return false;
  end if;

  update subject_enrollments
    set status = 'active', updated_at = now()
    where id = p_subject_enrollment_id and status = 'planned';

  return found;
end;
$function$;

CREATE OR REPLACE FUNCTION public.finalize_account_invite(p_invite_id uuid, p_auth_user_id uuid)
 RETURNS TABLE(target_profile_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row account_invites%rowtype;
begin
  select * into v_row from account_invites where id = p_invite_id for update;
  if not found then
    raise exception 'Invite not found.';
  end if;
  if v_row.status <> 'accepted' then
    raise exception 'Only accepted invites can be finalized (current: %).', v_row.status;
  end if;

  if v_row.target_profile_id is not null then
    return query select v_row.target_profile_id;
    return;
  end if;

  insert into profiles (id, role, name) values (p_auth_user_id, v_row.role::text::profile_role, v_row.invitee_name);

  if v_row.role = 'parent' then
    insert into parents (id) values (p_auth_user_id);
    -- household_id가 있으면(공동 보호자 초대) 기존 household에 합류한다 —
    -- 주 보호자는 이미 있으므로 is_primary=false. household_id가 없으면
    -- (기존과 동일) 여기서는 household를 만들지 않는다 — 그 보호자가 첫
    -- 자녀를 초대할 때 findOrCreateHouseholdForGuardian()이 지연 생성한다.
    if v_row.household_id is not null then
      insert into household_members (household_id, profile_id, role, is_primary)
      values (v_row.household_id, p_auth_user_id, 'guardian', false)
      on conflict (household_id, profile_id) do nothing;
    end if;
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
$function$;

CREATE OR REPLACE FUNCTION public.redeem_trial_onboarding_link(p_token text)
 RETURNS TABLE(link_id uuid, consultation_id uuid, guardian_email text, guardian_name text, student_name text, student_email text, student_grade text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row trial_onboarding_links%rowtype;
  v_token_hash text := encode(extensions.digest(p_token, 'sha256'), 'hex');
begin
  select * into v_row from trial_onboarding_links where token_hash = v_token_hash for update;
  if not found then
    raise exception 'This onboarding link is not valid.';
  end if;
  if v_row.status = 'revoked' then
    raise exception 'This onboarding link has been canceled.';
  end if;
  if v_row.status = 'pending' and v_row.expires_at <= now() then
    update trial_onboarding_links set status = 'expired' where id = v_row.id;
    raise exception 'This onboarding link has expired.';
  end if;
  -- status가 'redeemed'여도(=이미 성공적으로 완료된 링크를 다시 여는 경우)
  -- 여기서는 막지 않는다 — 아래에서 그대로 데이터를 돌려주고, 실제 재사용
  -- 가능 여부 판정은 claim_trial_onboarding_link_finalize()에 맡긴다.

  return query select v_row.id, v_row.consultation_id, v_row.guardian_email, v_row.guardian_name,
    v_row.student_name, v_row.student_email, v_row.student_grade;
end;
$function$;

CREATE OR REPLACE FUNCTION public.finalize_trial_onboarding_new_guardian(p_link_id uuid, p_auth_user_id uuid, p_child_auth_user_id uuid)
 RETURNS TABLE(household_id uuid, guardian_id uuid, child_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row trial_onboarding_links%rowtype;
  v_household_id uuid;
  v_child_id uuid;
begin
  select * into v_row from trial_onboarding_links where id = p_link_id for update;
  if not found then
    raise exception 'Onboarding link not found.';
  end if;
  if v_row.status = 'redeemed' then
    -- 재시도 안전: 이미 완료된 링크면 기존 결과를 그대로 반환(중복 계정 생성 방지).
    select c.child_id into v_child_id from consultations c where c.id = v_row.consultation_id;
    select hm.household_id into v_household_id
    from household_members hm where hm.profile_id = v_child_id and hm.role = 'child'
    limit 1;
    return query select v_household_id, v_row.redeemed_auth_user_id, v_child_id;
    return;
  end if;
  if v_row.status <> 'pending' then
    raise exception 'Only pending onboarding links can be finalized (current: %).', v_row.status;
  end if;

  insert into profiles (id, role, name) values (p_auth_user_id, 'parent', v_row.guardian_name)
  on conflict (id) do nothing;
  insert into parents (id) values (p_auth_user_id) on conflict (id) do nothing;

  insert into households (primary_guardian_id) values (p_auth_user_id) returning id into v_household_id;
  insert into household_members (household_id, profile_id, role, is_primary)
  values (v_household_id, p_auth_user_id, 'guardian', true);

  v_child_id := p_child_auth_user_id;
  insert into profiles (id, role, name) values (v_child_id, 'student', v_row.student_name) on conflict (id) do nothing;
  insert into students (id, grade, status) values (v_child_id, v_row.student_grade, 'pending') on conflict (id) do nothing;
  insert into household_members (household_id, profile_id, role, is_primary)
  values (v_household_id, v_child_id, 'child', true);

  update trial_onboarding_links
  set status = 'redeemed', redeemed_at = now(), redeemed_auth_user_id = p_auth_user_id
  where id = p_link_id;

  update prospect_contacts
  set converted_guardian_id = p_auth_user_id, converted_at = now(), converted_by = p_auth_user_id,
      conversion_note = 'M4 신규 보호자 온보딩 링크로 연결(link_id=' || p_link_id::text || ')'
  where id = v_row.prospect_contact_id;

  update consultations set child_id = v_child_id where id = v_row.consultation_id;

  insert into trial_onboarding_link_events (link_id, event_type, actor_id, detail)
  values (p_link_id, 'finalized', p_auth_user_id, jsonb_build_object('household_id', v_household_id, 'child_id', v_child_id));

  return query select v_household_id, p_auth_user_id, v_child_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.finalize_trial_onboarding_existing_guardian(p_link_id uuid, p_existing_guardian_id uuid, p_child_auth_user_id uuid)
 RETURNS TABLE(household_id uuid, guardian_id uuid, child_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row trial_onboarding_links%rowtype;
  v_household_id uuid;
  v_child_id uuid;
begin
  select * into v_row from trial_onboarding_links where id = p_link_id for update;
  if not found then
    raise exception 'Onboarding link not found.';
  end if;

  if v_row.status = 'redeemed' then
    -- 재시도 안전: 이미 완료된 링크면 기존 결과를 그대로 반환(중복 생성 방지).
    select c.child_id into v_child_id from consultations c where c.id = v_row.consultation_id;
    select hm.household_id into v_household_id
      from household_members hm where hm.profile_id = v_child_id and hm.role = 'child'
      limit 1;
    return query select v_household_id, v_row.redeemed_auth_user_id, v_child_id;
    return;
  end if;
  if v_row.status <> 'pending' then
    raise exception 'Only pending onboarding links can be finalized (current: %).', v_row.status using errcode = 'P0001';
  end if;

  if not exists (select 1 from profiles where id = p_existing_guardian_id and role = 'parent') then
    raise exception 'This is not a guardian account.' using errcode = 'P0001';
  end if;

  select id into v_household_id from households where primary_guardian_id = p_existing_guardian_id
    order by created_at asc limit 1;
  if v_household_id is null then
    raise exception 'No family is linked to this guardian account. Please contact support.' using errcode = 'P0001';
  end if;

  v_child_id := p_child_auth_user_id;
  insert into profiles (id, role, name) values (v_child_id, 'student', v_row.student_name) on conflict (id) do nothing;
  insert into students (id, grade, status) values (v_child_id, v_row.student_grade, 'pending') on conflict (id) do nothing;
  insert into household_members (household_id, profile_id, role, is_primary)
  values (v_household_id, v_child_id, 'child', false)
  on conflict on constraint household_members_household_id_profile_id_key do nothing;

  update trial_onboarding_links
  set status = 'redeemed', redeemed_at = now(), redeemed_auth_user_id = p_existing_guardian_id
  where id = p_link_id;

  update prospect_contacts
  set converted_guardian_id = p_existing_guardian_id, converted_at = now(), converted_by = p_existing_guardian_id,
      conversion_note = '재상담 — 기존 보호자 계정에 연결(link_id=' || p_link_id::text || ')'
  where id = v_row.prospect_contact_id;

  update consultations set child_id = v_child_id where id = v_row.consultation_id;

  insert into trial_onboarding_link_events (link_id, event_type, actor_id, detail)
  values (p_link_id, 'linked_existing_guardian', p_existing_guardian_id, jsonb_build_object('household_id', v_household_id, 'child_id', v_child_id));

  return query select v_household_id, p_existing_guardian_id, v_child_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.finalize_trial_onboarding_students(p_link_id uuid, p_new_guardian boolean, p_guardian_auth_user_id uuid, p_guardian_name text, p_students jsonb, p_claim_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(household_id uuid, guardian_id uuid, created_count integer, failed_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row trial_onboarding_links%rowtype;
  v_household_id uuid;
  v_item jsonb;
  v_link_student_id uuid;
  v_child_auth_user_id uuid;
  v_student trial_onboarding_link_students%rowtype;
  v_created int := 0;
  v_failed int := 0;
  v_grant_id uuid;
  v_child_household uuid;
begin
  select * into v_row from trial_onboarding_links where id = p_link_id for update;
  if not found then
    raise exception 'Onboarding link not found.';
  end if;
  if v_row.status not in ('pending', 'redeemed') then
    raise exception 'Only pending or redeemed onboarding links can be processed (current: %).', v_row.status;
  end if;

  -- 직접생성(상담 없음) 경로는 기존 무료 회원 자녀 연결을 거절한다(무료->과외 전환은 상담 경로 전용).
  if v_row.consultation_id is null
     and exists (select 1 from trial_onboarding_link_students where link_id = p_link_id and is_existing_child) then
    raise exception 'existing_child_not_allowed_in_direct_path: A free-member child can only convert to tutoring through the consultation onboarding path.';
  end if;

  if p_new_guardian and v_row.status = 'pending' then
    if v_row.finalize_claim_id is distinct from p_claim_id then
      raise exception 'stale_claim: Another request is already processing or has completed this onboarding link.';
    end if;
  end if;
  if p_new_guardian and v_row.status = 'redeemed' and v_row.redeemed_claim_id is not null
     and v_row.redeemed_claim_id is distinct from p_claim_id then
    raise exception 'stale_claim: Another request has already completed this onboarding link.';
  end if;

  if p_new_guardian then
    insert into profiles (id, role, name) values (p_guardian_auth_user_id, 'parent', p_guardian_name)
      on conflict (id) do nothing;
    insert into parents (id) values (p_guardian_auth_user_id) on conflict (id) do nothing;

    select id into v_household_id from households where primary_guardian_id = p_guardian_auth_user_id
      order by created_at asc limit 1;
    if v_household_id is null then
      insert into households (primary_guardian_id) values (p_guardian_auth_user_id) returning id into v_household_id;
      insert into household_members (household_id, profile_id, role, is_primary)
        values (v_household_id, p_guardian_auth_user_id, 'guardian', true)
        on conflict on constraint household_members_household_id_profile_id_key do nothing;
    end if;
  else
    if not exists (select 1 from profiles where id = p_guardian_auth_user_id and role = 'parent') then
      raise exception 'This is not a guardian account.';
    end if;
    select id into v_household_id from households where primary_guardian_id = p_guardian_auth_user_id
      order by created_at asc limit 1;
    if v_household_id is null then
      raise exception 'No family is linked to this guardian account. Please contact support.';
    end if;
  end if;

  update trial_onboarding_links
  set status = 'redeemed', redeemed_at = coalesce(redeemed_at, now()), redeemed_auth_user_id = p_guardian_auth_user_id,
      redeemed_claim_id = case when p_new_guardian then coalesce(redeemed_claim_id, p_claim_id) else redeemed_claim_id end
  where id = p_link_id;

  if v_row.prospect_contact_id is not null then
    update prospect_contacts
    set converted_guardian_id = p_guardian_auth_user_id, converted_at = coalesce(converted_at, now()),
        converted_by = p_guardian_auth_user_id,
        conversion_note = coalesce(conversion_note, '복수자녀 온보딩(link_id=' || p_link_id::text || ')')
    where id = v_row.prospect_contact_id;
  end if;

  for v_item in select * from jsonb_array_elements(p_students)
  loop
    v_link_student_id := (v_item->>'link_student_id')::uuid;
    v_child_auth_user_id := (v_item->>'child_auth_user_id')::uuid;

    select * into v_student from trial_onboarding_link_students where id = v_link_student_id and link_id = p_link_id for update;
    if not found then
      continue;
    end if;
    if v_student.status = 'created' then
      v_created := v_created + 1;
      if v_student.is_existing_child then
        -- 기존 무료 회원 자녀(2026-10-05 S5) — 계정은 이미 있다. household 연결(없을 때만)·칸반 카드(멱등)·free->tutoring 전환.
        select hm.household_id into v_child_household from household_members hm
          where hm.profile_id = v_student.child_auth_user_id and hm.role = 'child' order by hm.household_id limit 1;
        if v_child_household is null then
          insert into household_members (household_id, profile_id, role, is_primary)
            values (v_household_id, v_student.child_auth_user_id, 'child', false)
            on conflict on constraint household_members_household_id_profile_id_key do nothing;
          v_child_household := v_household_id;
        end if;
        perform public._create_student_kanban_card(v_row.consultation_id, v_link_student_id, v_student.child_auth_user_id, v_child_household);
        perform public.convert_free_member_to_tutoring(v_student.child_auth_user_id, v_row.consultation_id);
        insert into trial_onboarding_link_events (link_id, event_type, actor_id, detail)
        values (p_link_id, 'finalized', p_guardian_auth_user_id,
          jsonb_build_object('household_id', v_child_household, 'child_id', v_student.child_auth_user_id, 'link_student_id', v_link_student_id, 'existing_free_member', true));
        continue;
      end if;
      if v_row.consultation_id is null and v_student.consultant_id is not null and v_student.child_auth_user_id is not null
         and not exists (select 1 from consultant_assignments where student_id = v_student.child_auth_user_id) then
        insert into consultant_assignments (consultant_id, student_id, assigned_by, assigned_at)
        values (v_student.consultant_id, v_student.child_auth_user_id, v_student.consultant_assigned_by, now())
        on conflict (student_id) do nothing;
        insert into consultant_assignment_history (student_id, prior_consultant_id, new_consultant_id, actor_id, reason)
        values (v_student.child_auth_user_id, null, v_student.consultant_id, v_student.consultant_assigned_by, '가입 대기 단계 담당자 이어받음(계정 이미 생성됨 — 결함 수정 백필)');
      end if;
      continue;
    end if;
    if v_student.status = 'cancelled' then
      continue;
    end if;

    begin
      insert into profiles (id, role, name) values (v_child_auth_user_id, 'student', v_student.student_name)
        on conflict (id) do nothing;
      insert into students (id, grade, status) values (v_child_auth_user_id, v_student.student_grade, 'pending')
        on conflict (id) do nothing;
      insert into household_members (household_id, profile_id, role, is_primary)
        values (v_household_id, v_child_auth_user_id, 'child', false)
        on conflict on constraint household_members_household_id_profile_id_key do nothing;

      update trial_onboarding_link_students
      set status = 'created', child_auth_user_id = v_child_auth_user_id, error = null, updated_at = now()
      where id = v_link_student_id;

      if v_row.consultation_id is not null then
        perform public._create_student_kanban_card(v_row.consultation_id, v_link_student_id, v_child_auth_user_id, v_household_id);
      else
        -- 지인/추천 직접생성 경로 — 담당 컨설턴트를 그대로 이어 붙인다(R15-A).
        if v_student.consultant_id is not null then
          insert into consultant_assignments (consultant_id, student_id, assigned_by, assigned_at)
          values (v_student.consultant_id, v_child_auth_user_id, v_student.consultant_assigned_by, now())
          on conflict (student_id) do nothing;
          insert into consultant_assignment_history (student_id, prior_consultant_id, new_consultant_id, actor_id, reason)
          values (v_child_auth_user_id, null, v_student.consultant_id, v_student.consultant_assigned_by, '가입 대기 단계 담당자 이어받음(계정 생성)');
        end if;

        update trial_onboarding_link_students set trial_entitlement_grant_status = 'pending' where id = v_link_student_id;
        begin
          v_grant_id := grant_trial_entitlement_for_student(v_child_auth_user_id);
          update trial_onboarding_link_students set
            trial_entitlement_grant_id = v_grant_id,
            trial_entitlement_grant_status = 'granted',
            trial_entitlement_grant_error = null
          where id = v_link_student_id;
        exception when others then
          update trial_onboarding_link_students set
            trial_entitlement_grant_status = 'failed',
            trial_entitlement_grant_error = sqlerrm
          where id = v_link_student_id;
        end;
      end if;

      insert into trial_onboarding_link_events (link_id, event_type, actor_id, detail)
      values (p_link_id, 'finalized', p_guardian_auth_user_id,
        jsonb_build_object('household_id', v_household_id, 'child_id', v_child_auth_user_id, 'link_student_id', v_link_student_id));

      v_created := v_created + 1;
    exception when others then
      update trial_onboarding_link_students
      set status = 'failed', error = sqlerrm, updated_at = now()
      where id = v_link_student_id;
      v_failed := v_failed + 1;
    end;
  end loop;

  return query select v_household_id, p_guardian_auth_user_id, v_created, v_failed;
end;
$function$;

CREATE OR REPLACE FUNCTION public.link_existing_guardian_to_trial_onboarding(p_link_id uuid, p_existing_child_id uuid)
 RETURNS TABLE(household_id uuid, child_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row trial_onboarding_links%rowtype;
  v_guardian_id uuid := auth.uid();
  v_household_id uuid;
  v_child_id uuid;
begin
  if v_guardian_id is null then
    raise exception 'Login required.';
  end if;
  if not exists (select 1 from parents where id = v_guardian_id) then
    raise exception 'Only a guardian account can connect this onboarding link.';
  end if;
  if p_existing_child_id is null then
    raise exception 'You must specify a child to connect. To add a new child, create their account through the existing child invite flow first.';
  end if;

  select * into v_row from trial_onboarding_links where id = p_link_id for update;
  if not found then
    raise exception 'Onboarding link not found.';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'Only pending onboarding links can be connected (current: %).', v_row.status;
  end if;

  select hm.household_id into v_household_id
  from household_members hm
  where hm.profile_id = v_guardian_id and hm.role = 'guardian'
  limit 1;
  if v_household_id is null then
    raise exception 'No family is linked to this account. An admin needs to review it.';
  end if;

  if not exists (
    select 1 from household_members
    where household_id = v_household_id and profile_id = p_existing_child_id and role = 'child'
  ) then
    raise exception 'You can only connect a child in your own family.';
  end if;
  v_child_id := p_existing_child_id;

  update trial_onboarding_links
  set status = 'redeemed', redeemed_at = now(), redeemed_auth_user_id = v_guardian_id
  where id = p_link_id;

  update prospect_contacts
  set converted_guardian_id = v_guardian_id, converted_at = now(), converted_by = v_guardian_id,
      conversion_note = 'M4 기존 보호자 본인 확인으로 연결(link_id=' || p_link_id::text || ')'
  where id = v_row.prospect_contact_id;

  update consultations set child_id = v_child_id where id = v_row.consultation_id;

  insert into trial_onboarding_link_events (link_id, event_type, actor_id, detail)
  values (p_link_id, 'linked_existing_guardian', v_guardian_id, jsonb_build_object('household_id', v_household_id, 'child_id', v_child_id, 'reused_existing_child', p_existing_child_id is not null));

  return query select v_household_id, v_child_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.request_trial_login_email_change(p_link_id uuid, p_new_email text)
 RETURNS TABLE(request_id uuid, raw_token text, conflict boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_link trial_onboarding_links%rowtype;
  v_normalized text := lower(trim(p_new_email));
  v_existing_user_id uuid;
  v_raw_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash text := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');
  v_id uuid;
begin
  select * into v_link from trial_onboarding_links where id = p_link_id;
  if not found then
    raise exception 'Onboarding link not found.';
  end if;
  if v_link.status <> 'pending' then
    raise exception 'This onboarding link has already been used or has expired.';
  end if;

  select id into v_existing_user_id from auth.users where lower(email) = v_normalized limit 1;

  if v_existing_user_id is not null then
    insert into trial_login_email_change_requests (link_id, requested_email, token_hash, status, expires_at)
    values (p_link_id, p_new_email, v_token_hash, 'conflict', now() + interval '24 hours')
    returning id into v_id;

    insert into trial_onboarding_link_events (link_id, event_type, detail)
    values (p_link_id, 'conflict_manual_review', jsonb_build_object('requested_email', p_new_email, 'reason', 'login_email_already_in_use'));

    return query select v_id, null::text, true;
    return;
  end if;

  insert into trial_login_email_change_requests (link_id, requested_email, token_hash, expires_at)
  values (p_link_id, p_new_email, v_token_hash, now() + interval '24 hours')
  returning id into v_id;

  insert into trial_onboarding_link_events (link_id, event_type, detail)
  values (p_link_id, 'login_email_change_requested', jsonb_build_object('requested_email', p_new_email));

  return query select v_id, v_raw_token, false;
end;
$function$;

CREATE OR REPLACE FUNCTION public.confirm_trial_login_email_change(p_token text)
 RETURNS TABLE(link_id uuid, requested_email text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row trial_login_email_change_requests%rowtype;
  v_token_hash text := encode(extensions.digest(p_token, 'sha256'), 'hex');
begin
  select * into v_row from trial_login_email_change_requests where token_hash = v_token_hash for update;
  if not found then
    raise exception 'This confirmation link is not valid.';
  end if;
  if v_row.status = 'confirmed' then
    return query select v_row.link_id, v_row.requested_email;
    return;
  end if;
  if v_row.status <> 'pending' then
    raise exception 'This confirmation link has already been used or has expired.';
  end if;
  if v_row.expires_at <= now() then
    update trial_login_email_change_requests set status = 'expired' where id = v_row.id;
    raise exception 'This confirmation link has expired.';
  end if;

  update trial_login_email_change_requests set status = 'confirmed', confirmed_at = now() where id = v_row.id;

  insert into trial_onboarding_link_events (link_id, event_type, detail)
  values (v_row.link_id, 'login_email_change_confirmed', jsonb_build_object('requested_email', v_row.requested_email));

  return query select v_row.link_id, v_row.requested_email;
end;
$function$;

CREATE OR REPLACE FUNCTION public.peek_trial_login_email_change(p_token text)
 RETURNS TABLE(link_id uuid, requested_email text, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row trial_login_email_change_requests%rowtype;
  v_token_hash text := encode(extensions.digest(p_token, 'sha256'), 'hex');
begin
  select * into v_row from trial_login_email_change_requests where token_hash = v_token_hash;
  if not found then
    raise exception 'This confirmation link is not valid.';
  end if;

  if v_row.status = 'pending' and v_row.expires_at <= now() then
    return query select v_row.link_id, v_row.requested_email, 'expired'::text;
    return;
  end if;

  return query select v_row.link_id, v_row.requested_email, v_row.status::text;
end;
$function$;

CREATE OR REPLACE FUNCTION public.mock_exam_save_answer(p_attempt_id uuid, p_set_item_id uuid, p_response text, p_time_spent_seconds integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_a mock_exam_attempts%rowtype; v_i mock_exam_set_items%rowtype; v_c jsonb; v_format text; v_correct boolean;
  v_mst boolean; v_m mock_exam_attempt_modules%rowtype;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  if v_a.id is null or v_a.student_id <> auth.uid() then raise exception 'You can only continue your own attempt.'; end if;
  v_mst := _mock_exam_is_mst(p_attempt_id);
  if v_mst then
    perform _mock_exam_settle(p_attempt_id);
    select * into v_a from mock_exam_attempts where id = p_attempt_id;
  end if;
  if v_a.status in ('submitted', 'graded') then raise exception 'This exam has already been submitted, so answers cannot be changed.'; end if;
  select * into v_i from mock_exam_set_items where id = p_set_item_id and exam_set_id = v_a.exam_set_id;
  if v_i.id is null or (v_mst and not _mock_exam_item_in_route(v_i, v_a)) then raise exception 'Question not found.'; end if;
  if v_mst then
    if v_a.status <> 'in_progress' then raise exception 'You need to start the exam first.'; end if;
    select * into v_m from mock_exam_attempt_modules where attempt_id = p_attempt_id and module_key = v_i.module_key;
    if v_i.module_key is distinct from v_a.current_module or v_m.locked or v_m.started_at is null then
      raise exception 'This module has already been submitted, so answers cannot be saved.';
    end if;
  end if;
  v_c := _mock_exam_item_content(v_i);
  select format::text into v_format from problems where id = v_i.problem_id;
  v_correct := _answer_auto_grade(coalesce(v_format, 'mc'), p_response, nullif(v_c->>'correct_index', '')::int, v_c->'answers');

  insert into mock_exam_answers (attempt_id, set_item_id, response, correct, time_spent_seconds, updated_at)
  values (p_attempt_id, p_set_item_id, to_jsonb(p_response), v_correct, p_time_spent_seconds, now())
  on conflict (attempt_id, set_item_id) do update
    set response = excluded.response, correct = excluded.correct,
        time_spent_seconds = coalesce(excluded.time_spent_seconds, mock_exam_answers.time_spent_seconds),
        updated_at = now();

  if v_a.status = 'assigned' then
    update mock_exam_attempts set status = 'in_progress', started_at = coalesce(started_at, now()) where id = p_attempt_id;
  end if;
end $function$;

CREATE OR REPLACE FUNCTION public.mock_exam_toggle_flag(p_attempt_id uuid, p_set_item_id uuid, p_flagged boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_a mock_exam_attempts%rowtype; v_i mock_exam_set_items%rowtype; v_m mock_exam_attempt_modules%rowtype;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  if v_a.id is null or v_a.student_id <> auth.uid() then raise exception 'You can only continue your own attempt.'; end if;
  if _mock_exam_is_mst(p_attempt_id) then
    perform _mock_exam_settle(p_attempt_id);
    select * into v_a from mock_exam_attempts where id = p_attempt_id;
  end if;
  if v_a.status in ('submitted', 'graded') then raise exception 'This exam has already been submitted and cannot be changed.'; end if;
  select * into v_i from mock_exam_set_items where id = p_set_item_id and exam_set_id = v_a.exam_set_id;
  if v_i.id is null or not _mock_exam_item_in_route(v_i, v_a) then raise exception 'Question not found.'; end if;
  if v_i.module_key is not null then
    select * into v_m from mock_exam_attempt_modules where attempt_id = p_attempt_id and module_key = v_i.module_key;
    if v_i.module_key is distinct from v_a.current_module or coalesce(v_m.locked, true) then
      raise exception 'This module has already been submitted, so marks cannot be changed.';
    end if;
  end if;
  insert into mock_exam_answers (attempt_id, set_item_id, flagged, updated_at)
  values (p_attempt_id, p_set_item_id, p_flagged, now())
  on conflict (attempt_id, set_item_id) do update set flagged = excluded.flagged, updated_at = now();
end $function$;

CREATE OR REPLACE FUNCTION public.mock_exam_toggle_guessed(p_attempt_id uuid, p_set_item_id uuid, p_guessed boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_a mock_exam_attempts%rowtype; v_i mock_exam_set_items%rowtype; v_m mock_exam_attempt_modules%rowtype;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  if v_a.id is null or v_a.student_id <> auth.uid() then raise exception 'You can only continue your own attempt.'; end if;
  if _mock_exam_is_mst(p_attempt_id) then
    perform _mock_exam_settle(p_attempt_id);
    select * into v_a from mock_exam_attempts where id = p_attempt_id;
  end if;
  if v_a.status in ('submitted', 'graded') then raise exception 'This exam has already been submitted and cannot be changed.'; end if;
  select * into v_i from mock_exam_set_items where id = p_set_item_id and exam_set_id = v_a.exam_set_id;
  if v_i.id is null or not _mock_exam_item_in_route(v_i, v_a) then raise exception 'Question not found.'; end if;
  if v_i.module_key is not null then
    select * into v_m from mock_exam_attempt_modules where attempt_id = p_attempt_id and module_key = v_i.module_key;
    if v_i.module_key is distinct from v_a.current_module or coalesce(v_m.locked, true) then
      raise exception 'This module has already been submitted, so marks cannot be changed.';
    end if;
  end if;
  insert into mock_exam_answers (attempt_id, set_item_id, guessed, updated_at)
  values (p_attempt_id, p_set_item_id, p_guessed, now())
  on conflict (attempt_id, set_item_id) do update set guessed = excluded.guessed, updated_at = now();
end $function$;

CREATE OR REPLACE FUNCTION public.mock_exam_save_section_time(p_attempt_id uuid, p_section text, p_remaining_seconds integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_a mock_exam_attempts%rowtype;
begin
  if p_section not in ('rw', 'math') then raise exception 'Section must be rw or math.'; end if;
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  if v_a.id is null or v_a.student_id <> auth.uid() then raise exception 'You can only continue your own attempt.'; end if;
  if v_a.status in ('submitted', 'graded') then return; end if;
  update mock_exam_attempts
    set time_remaining_seconds = coalesce(time_remaining_seconds, '{}'::jsonb) || jsonb_build_object(p_section, greatest(0, p_remaining_seconds))
    where id = p_attempt_id;
end $function$;

CREATE OR REPLACE FUNCTION public.mock_exam_submit(p_attempt_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_a mock_exam_attempts%rowtype;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  if v_a.id is null or v_a.student_id <> auth.uid() then raise exception 'You can only submit your own attempt.'; end if;
  if _mock_exam_is_mst(p_attempt_id) then raise exception 'This exam is submitted module by module.'; end if;
  if v_a.status not in ('assigned', 'in_progress') then raise exception 'This exam has already been submitted.'; end if;
  update mock_exam_attempts
    set status = 'graded', submitted_at = now(), graded_at = now(), attempt_count = 1
    where id = p_attempt_id;
end $function$;

CREATE OR REPLACE FUNCTION public.mock_exam_submit_module(p_attempt_id uuid, p_expected_module mock_exam_module_key)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_a mock_exam_attempts%rowtype; v_cur mock_exam_attempt_modules%rowtype;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  if v_a.id is null or v_a.student_id <> auth.uid() then raise exception 'You can only submit your own attempt.'; end if;
  perform _mock_exam_settle(p_attempt_id);
  select * into v_a from mock_exam_attempts where id = p_attempt_id for update;
  if v_a.status <> 'in_progress' or v_a.current_module is distinct from p_expected_module then return; end if;
  select * into v_cur from mock_exam_attempt_modules where attempt_id = p_attempt_id and module_key = v_a.current_module;
  if v_cur.locked then return; end if;
  perform _mock_exam_lock_module(v_cur.id, false);
  perform _mock_exam_open_next_module(p_attempt_id);
end $function$;

CREATE OR REPLACE FUNCTION public.mock_exam_start_mst(p_attempt_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_a mock_exam_attempts%rowtype; v_s mock_exam_sets%rowtype; v_limits jsonb; v_key text; v_pos int := 0; v_first uuid; v_check jsonb;
  v_rw_v int; v_math_v int;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id for update;
  if v_a.id is null or v_a.student_id <> auth.uid() then raise exception 'You can only continue your own attempt.'; end if;
  select * into v_s from mock_exam_sets where id = v_a.exam_set_id;
  if v_s.format <> 'mst' then raise exception 'This is not a four-module exam.'; end if;
  if v_a.status <> 'assigned' then perform _mock_exam_settle(p_attempt_id); return; end if;
  if v_a.start_by is not null and now() < v_a.start_by then raise exception 'This exam is not open yet.'; end if;
  if v_a.due_at is not null and now() > v_a.due_at then raise exception 'The deadline for this exam has passed.'; end if;

  v_check := mock_exam_validate_mst_set(v_s.id);
  if not (v_check->>'ready')::boolean then
    raise exception 'This exam is not fully assembled yet, so it cannot be started. Please contact support.';
  end if;

  v_limits := coalesce(v_s.module_time_limits, '{"rw_m1":1920,"rw_m2":1920,"break":600,"math_m1":2100,"math_m2":2100}'::jsonb);
  foreach v_key in array array['rw_m1', 'rw_m2', 'break', 'math_m1', 'math_m2'] loop
    v_pos := v_pos + 1;
    insert into mock_exam_attempt_modules (attempt_id, module_key, position, time_limit_seconds, item_count)
    values (p_attempt_id, v_key::mock_exam_module_key, v_pos, (v_limits->>v_key)::int,
            _mock_exam_module_item_count(v_a.exam_set_id, v_key::mock_exam_module_key));
  end loop;

  if _mock_exam_set_routing_enabled(v_s.id) then
    select version into v_rw_v from mock_exam_routing_policies where section = 'rw' and active;
    select version into v_math_v from mock_exam_routing_policies where section = 'math' and active;
    update mock_exam_attempts set rw_m2_route_policy_version = v_rw_v, math_m2_route_policy_version = v_math_v where id = p_attempt_id;
  end if;

  select id into v_first from mock_exam_attempt_modules where attempt_id = p_attempt_id and position = 1;
  update mock_exam_attempt_modules set started_at = now(), ends_at = now() + make_interval(secs => time_limit_seconds) where id = v_first;
  update mock_exam_attempts
  set status = 'in_progress', started_at = coalesce(started_at, now()), current_module = 'rw_m1'
  where id = p_attempt_id;
end $function$;

CREATE OR REPLACE FUNCTION public.mock_exam_record_entry(p_attempt_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_a mock_exam_attempts%rowtype;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  if v_a.id is null or v_a.student_id <> auth.uid() then raise exception 'You can only record your own attempt.'; end if;
  if v_a.status in ('submitted', 'graded') then return; end if;
  update mock_exam_attempts set entry_count = entry_count + 1 where id = p_attempt_id;
end $function$;

CREATE OR REPLACE FUNCTION public.mock_exam_toggle_saved_to_practice(p_attempt_id uuid, p_set_item_id uuid, p_saved boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_a mock_exam_attempts%rowtype;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  if v_a.id is null or v_a.student_id <> auth.uid() then raise exception 'You can only save from your own attempt.'; end if;
  if not exists (select 1 from mock_exam_set_items where id = p_set_item_id and exam_set_id = v_a.exam_set_id) then
    raise exception 'Question not found.';
  end if;
  insert into mock_exam_answers (attempt_id, set_item_id, saved_to_practice, updated_at)
  values (p_attempt_id, p_set_item_id, p_saved, now())
  on conflict (attempt_id, set_item_id) do update set saved_to_practice = excluded.saved_to_practice, updated_at = now();
end $function$;

CREATE OR REPLACE FUNCTION public.mock_exam_open_start(p_exam_set_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_s mock_exam_sets%rowtype;
  v_id uuid;
  v_free boolean;
  v_today_count integer;
begin
  if v_uid is null then raise exception 'Login required.'; end if;
  if not exists (select 1 from students where id = v_uid and status = 'active') then
    raise exception 'Only active students can start a mock exam.';
  end if;
  select * into v_s from mock_exam_sets where id = p_exam_set_id;
  if v_s.id is null then raise exception 'Exam not found.'; end if;

  -- 멱등: 이 시험(세트 계열)의 응시가 이미 있으면(기존 배정분 포함) 그대로 돌려준다.
  select id into v_id from mock_exam_attempts where student_id = v_uid and exam_set_group_id = v_s.set_group_id;
  if v_id is not null then return v_id; end if;

  if v_s.status <> 'published' or v_s.archived_at is not null then
    raise exception 'Only published exams can be started.';
  end if;
  if v_s.format = 'mst' and v_s.readiness_status <> 'ready' then
    raise exception 'This exam is not fully assembled yet, so it cannot be started. Please contact support.';
  end if;

  -- 2026-10-05 무료 회원: 무료 공개 세트만, 하루(UTC) 2회까지 시작.
  v_free := is_free_member(v_uid);
  if v_free then
    if v_s.access_tier <> 'free' then
      raise exception 'This exam is available to tutoring members only.';
    end if;
    select count(*) into v_today_count from mock_exam_attempts
      where student_id = v_uid
        and created_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc');
    if v_today_count >= 2 then
      raise exception 'Free members can start up to 2 mock exams per day. Please try again tomorrow.';
    end if;
  end if;

  insert into mock_exam_attempts (student_id, exam_set_id, exam_set_group_id)
  values (v_uid, v_s.id, v_s.set_group_id)
  on conflict (student_id, exam_set_group_id) do nothing
  returning id into v_id;
  if v_id is null then
    -- 동시 시작 경쟁에서 진 쪽: 먼저 들어간 응시를 돌려준다.
    select id into v_id from mock_exam_attempts where student_id = v_uid and exam_set_group_id = v_s.set_group_id;
  end if;
  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.mock_exam_open_catalog(p_student_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_free boolean;
begin
  if not _mock_exam_can_view(p_student_id) then
    raise exception 'You do not have permission to view this student''s mock exam information.';
  end if;
  v_free := is_free_member(p_student_id);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'examSetId', s.id, 'setGroupId', s.set_group_id, 'name', s.name, 'description', s.description,
      'difficultyTier', s.difficulty_tier, 'format', s.format, 'publishedAt', s.published_at,
      'accessTier', s.access_tier,
      'attemptId', a.id, 'attemptStatus', a.status
    ) order by s.published_at desc nulls last, s.name)
    from mock_exam_sets s
    left join mock_exam_attempts a on a.exam_set_group_id = s.set_group_id and a.student_id = p_student_id
    where s.status = 'published' and s.archived_at is null
      and (s.format <> 'mst' or s.readiness_status = 'ready')
      -- 2026-10-05 무료 회원은 무료 공개 세트만(이미 응시한 세트는 티어와 무관하게 계속 보인다).
      and (not v_free or s.access_tier = 'free' or a.id is not null)
  ), '[]'::jsonb);
end $function$;

CREATE OR REPLACE FUNCTION public.mock_exam_weakness_summary(p_student_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_attempts integer;
  v_graded integer;
  v_domain jsonb;
  v_skill jsonb;
begin
  if not _mock_exam_can_view(p_student_id) then
    raise exception 'You do not have permission to view this student''s mock exam records.';
  end if;
  select count(*), count(*) filter (where status = 'graded') into v_attempts, v_graded
    from mock_exam_attempts where student_id = p_student_id;

  with graded as (
    select ans.set_item_id, i.section, i.sat_domain, i.skill_code,
           coalesce(adj.adjusted_correct, ans.correct) as correct
    from mock_exam_attempts a
    join mock_exam_answers ans on ans.attempt_id = a.id
    join mock_exam_set_items i on i.id = ans.set_item_id
    left join mock_exam_answer_adjustments adj
      on adj.attempt_id = a.id and adj.set_item_id = ans.set_item_id and adj.superseded_at is null
    where a.student_id = p_student_id and a.status = 'graded' and ans.correct is not null
  ),
  dom as (
    select sat_domain as key, min(section) as section, count(*) as total, count(*) filter (where correct) as correct
    from graded where sat_domain is not null group by sat_domain
  ),
  skl as (
    select skill_code as key, min(section) as section, count(*) as total, count(*) filter (where correct) as correct
    from graded where skill_code is not null group by skill_code
  )
  select
    coalesce((select jsonb_agg(jsonb_build_object('key', key, 'section', section, 'total', total, 'correct', correct) order by key) from dom), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('key', key, 'section', section, 'total', total, 'correct', correct) order by key) from skl), '[]'::jsonb)
    into v_domain, v_skill;

  return jsonb_build_object(
    'attemptCount', v_attempts,
    'gradedAttemptCount', v_graded,
    'byDomain', v_domain,
    'bySkill', v_skill
  );
end $function$;

CREATE OR REPLACE FUNCTION public.mock_exam_attempt_summaries(p_student_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not _mock_exam_can_view(p_student_id) then
    raise exception 'You do not have permission to view this student''s mock exam records.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'examSetId', a.exam_set_id, 'examSetName', s.name, 'difficultyTier', s.difficulty_tier,
      'studentId', a.student_id, 'studentName', pr.name, 'status', a.status,
      'assignedByName', ap.name,
      'dueAt', a.due_at, 'startBy', a.start_by, 'startedAt', a.started_at, 'submittedAt', a.submitted_at, 'gradedAt', a.graded_at,
      'entryCount', a.entry_count,
      'totalCount', _mock_exam_expected_item_count(a.exam_set_id),
      'correctCount', case
        when _mock_exam_results_visible(a.student_id, a.status) and a.status = 'graded'
          then (select count(*) from mock_exam_answers ans
                 where ans.attempt_id = a.id and ans.correct = true
                   and not exists (select 1 from mock_exam_answer_adjustments x where x.attempt_id = a.id and x.set_item_id = ans.set_item_id and x.superseded_at is null))
             + (select count(*) from mock_exam_answer_adjustments x where x.attempt_id = a.id and x.superseded_at is null and x.adjusted_correct)
        else null end,
      'scoreAdjusted', case
        when _mock_exam_results_visible(a.student_id, a.status) and a.status = 'graded'
          then exists (select 1 from mock_exam_answer_adjustments x where x.attempt_id = a.id and x.superseded_at is null)
        else false end
    ) order by a.created_at desc)
    from mock_exam_attempts a
    join mock_exam_sets s on s.id = a.exam_set_id
    left join profiles pr on pr.id = a.student_id
    left join profiles ap on ap.id = a.assigned_by
    where a.student_id = p_student_id
  ), '[]'::jsonb);
end $function$;

CREATE OR REPLACE FUNCTION public._mock_exam_attempt_detail_v1(p_attempt_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_a mock_exam_attempts%rowtype; v_s mock_exam_sets%rowtype; v_visible boolean; v_name text;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  if v_a.id is null then return null; end if;
  if not _mock_exam_can_view(v_a.student_id) then
    raise exception 'You do not have permission to view this attempt.';
  end if;
  select * into v_s from mock_exam_sets where id = v_a.exam_set_id;
  v_visible := _mock_exam_results_visible(v_a.student_id, v_a.status);
  select name into v_name from profiles where id = v_a.student_id;

  return jsonb_build_object(
    'id', v_a.id, 'examSetId', v_a.exam_set_id, 'examSetName', coalesce(v_s.name, '모의고사'),
    'difficultyTier', coalesce(v_s.difficulty_tier, 'standard'),
    'studentId', v_a.student_id, 'studentName', v_name, 'status', v_a.status,
    'dueAt', v_a.due_at, 'startBy', v_a.start_by, 'maxAttempts', v_a.max_attempts, 'attemptCount', v_a.attempt_count,
    'startedAt', v_a.started_at, 'submittedAt', v_a.submitted_at, 'gradedAt', v_a.graded_at,
    'entryCount', v_a.entry_count,
    'rwTimeLimitMinutes', coalesce(v_s.rw_time_limit_minutes, 64),
    'mathTimeLimitMinutes', coalesce(v_s.math_time_limit_minutes, 70),
    'mathCalculatorAllowed', coalesce(v_s.math_calculator_allowed, true),
    'mathReferenceSheetAllowed', coalesce(v_s.math_reference_sheet_allowed, true),
    'timeRemainingSeconds', v_a.time_remaining_seconds,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'setItemId', i.id, 'section', i.section, 'position', i.position, 'problemId', i.problem_id,
        'satDomain', i.sat_domain, 'skillCode', i.skill_code, 'difficulty', i.difficulty,
        'format', coalesce(p.format::text, 'mc'),
        'passage', v.passage, 'question', v.question, 'options', v.options, 'figure', v.figure,
        'correctIndex', case when v_visible then v.correct_index else null end,
        'answers', case when v_visible then v.answers else null end,
        'explanation', case when v_visible then v.explanation else null end,
        'response', case when ans.response is null then null else ans.response #>> '{}' end,
        'correct', case when v_visible then ans.correct else null end,
        'flagged', coalesce(ans.flagged, false),
        'savedToPractice', coalesce(ans.saved_to_practice, false),
        'timeSpentSeconds', ans.time_spent_seconds
      ) order by i.section, i.position)
      from mock_exam_set_items i
      join problem_versions v on v.id = i.problem_version_id
      left join problems p on p.id = i.problem_id
      left join mock_exam_answers ans on ans.attempt_id = v_a.id and ans.set_item_id = i.id
      where i.exam_set_id = v_a.exam_set_id
    ), '[]'::jsonb)
  );
end $function$;

CREATE OR REPLACE FUNCTION public._mock_exam_mst_state_v2(p_attempt_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_a mock_exam_attempts%rowtype; v_modules jsonb; v_items jsonb; v_viewer boolean;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  if v_a.id is null or not _mock_exam_can_view(v_a.student_id) then raise exception 'You do not have permission to view this attempt.'; end if;
  if not _mock_exam_is_mst(p_attempt_id) then raise exception 'This is not a four-module exam.'; end if;
  if v_a.student_id = auth.uid() then perform _mock_exam_settle(p_attempt_id); end if;
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  v_viewer := _is_service_role() or is_admin() or teaches_student(v_a.student_id) or is_assigned_consultant_of(v_a.student_id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'moduleKey', m.module_key, 'position', m.position, 'timeLimitSeconds', m.time_limit_seconds,
    'itemCount', m.item_count, 'startedAt', m.started_at, 'endsAt', m.ends_at, 'locked', m.locked,
    'remainingSeconds', case when m.ends_at is null then null else greatest(0, floor(extract(epoch from (m.ends_at - now()))))::int end
  ) order by m.position), '[]'::jsonb) into v_modules
  from mock_exam_attempt_modules m where m.attempt_id = p_attempt_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'setItemId', i.id, 'section', i.section,
    -- 변형 문항의 원래 position(rw 28..54 / 55..81)은 경로를 드러내므로 응시 경로 안 섹션 순번으로 다시 매긴다.
    'position', (select count(*) from mock_exam_set_items y
                 where y.exam_set_id = i.exam_set_id and y.section = i.section and y.position <= i.position and _mock_exam_item_in_route(y, v_a)),
    'moduleKey', i.module_key,
    'moduleSeq', i.position - (select min(position) from mock_exam_set_items x
                               where x.exam_set_id = i.exam_set_id and x.module_key = i.module_key and x.route is not distinct from i.route) + 1,
    'problemId', i.problem_id, 'satDomain', i.sat_domain, 'skillCode', i.skill_code,
    'difficulty', case when v_viewer then i.difficulty else null end,
    'format', coalesce(p.format::text, 'mc'),
    'passage', c.content->>'passage', 'question', c.content->>'question', 'options', c.content->'options', 'figure', c.content->'figure',
    'correctIndex', null, 'answers', null, 'explanation', null, 'correct', null,
    'response', case when ans.response is null then null else ans.response #>> '{}' end,
    'flagged', coalesce(ans.flagged, false), 'savedToPractice', coalesce(ans.saved_to_practice, false),
    'timeSpentSeconds', ans.time_spent_seconds
  ) order by i.position), '[]'::jsonb) into v_items
  from mock_exam_set_items i
  cross join lateral (select _mock_exam_item_content(i) as content) c
  left join problems p on p.id = i.problem_id
  left join mock_exam_answers ans on ans.attempt_id = v_a.id and ans.set_item_id = i.id
  join mock_exam_attempt_modules m on m.attempt_id = v_a.id and m.module_key = i.module_key
  where i.exam_set_id = v_a.exam_set_id and v_a.status = 'in_progress'
    and i.module_key = v_a.current_module and not m.locked
    and _mock_exam_item_in_route(i, v_a);

  return jsonb_build_object(
    'attemptId', v_a.id, 'status', v_a.status, 'currentModule', v_a.current_module,
    'serverNow', now(), 'modules', v_modules, 'items', v_items
  );
end $function$;

CREATE OR REPLACE FUNCTION public._mock_exam_attempts_route_guard()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if tg_op = 'INSERT' then
    if (new.rw_m2_route is not null or new.math_m2_route is not null
        or new.rw_m2_route_policy_version is not null or new.math_m2_route_policy_version is not null)
       and current_user in ('anon', 'authenticated') then
      raise exception 'Routing information cannot be set directly.';
    end if;
    return new;
  end if;
  if (new.rw_m2_route is distinct from old.rw_m2_route or new.math_m2_route is distinct from old.math_m2_route
      or new.rw_m2_route_policy_version is distinct from old.rw_m2_route_policy_version
      or new.math_m2_route_policy_version is distinct from old.math_m2_route_policy_version) then
    if current_user in ('anon', 'authenticated') then
      raise exception 'Routing information cannot be modified directly.';
    end if;
    if (old.rw_m2_route is not null and (new.rw_m2_route is distinct from old.rw_m2_route
          or new.rw_m2_route_policy_version is distinct from old.rw_m2_route_policy_version))
       or (old.math_m2_route is not null and (new.math_m2_route is distinct from old.math_m2_route
          or new.math_m2_route_policy_version is distinct from old.math_m2_route_policy_version)) then
      raise exception 'The Module 2 route has already been decided and cannot be changed.';
    end if;
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public._mock_exam_attempts_assign_gate()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare v_format text; v_ready text;
begin
  if tg_op = 'UPDATE' and new.exam_set_id = old.exam_set_id then return new; end if;
  select format, readiness_status into v_format, v_ready from mock_exam_sets where id = new.exam_set_id;
  if v_format = 'mst' and v_ready <> 'ready' then
    raise exception 'A four-module exam that is not fully assembled cannot be assigned (please contact support).';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.mock_exam_attempts_fill_set_group()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  select set_group_id into new.exam_set_group_id from mock_exam_sets where id = new.exam_set_id;
  if new.exam_set_group_id is null then
    raise exception 'Exam set not found: %', new.exam_set_id;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.save_mock_exam_annotations(p_attempt_id uuid, p_set_item_id uuid, p_highlights jsonb, p_eliminated jsonb DEFAULT '[]'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_a mock_exam_attempts%rowtype; v_i mock_exam_set_items%rowtype; v_m mock_exam_attempt_modules%rowtype; v_h jsonb; v_hl jsonb := coalesce(p_highlights, '[]'::jsonb); v_el jsonb := coalesce(p_eliminated, '[]'::jsonb); v_e jsonb;
begin
  select * into v_a from mock_exam_attempts where id = p_attempt_id;
  if v_a.id is null or v_a.student_id <> auth.uid() then raise exception 'You can only continue your own attempt.'; end if;
  if jsonb_typeof(v_hl) <> 'array' or jsonb_array_length(v_hl) > 60 then raise exception 'Invalid highlight format.'; end if;
  for v_h in select * from jsonb_array_elements(v_hl) loop
    if jsonb_typeof(v_h) <> 'object'
       or jsonb_typeof(v_h->'start') <> 'number' or jsonb_typeof(v_h->'end') <> 'number'
       or (v_h->>'start')::numeric < 0 or (v_h->>'end')::numeric <= (v_h->>'start')::numeric
       or (v_h ? 'note' and (jsonb_typeof(v_h->'note') <> 'string' or char_length(v_h->>'note') > 120))
       or char_length(coalesce(v_h->>'text', '')) > 2000 then
      raise exception 'Invalid highlight format.';
    end if;
  end loop;
  if jsonb_typeof(v_el) <> 'array' or jsonb_array_length(v_el) > 8 then raise exception 'Invalid elimination format.'; end if;
  for v_e in select * from jsonb_array_elements(v_el) loop
    if jsonb_typeof(v_e) <> 'number' or (v_e#>>'{}')::numeric not between 0 and 7 then raise exception 'Invalid elimination format.'; end if;
  end loop;
  if _mock_exam_is_mst(p_attempt_id) then
    perform _mock_exam_settle(p_attempt_id);
    select * into v_a from mock_exam_attempts where id = p_attempt_id;
  end if;
  if v_a.status in ('submitted', 'graded') then raise exception 'This exam has already been submitted and cannot be changed.'; end if;
  select * into v_i from mock_exam_set_items where id = p_set_item_id and exam_set_id = v_a.exam_set_id;
  if v_i.id is null or not _mock_exam_item_in_route(v_i, v_a) then raise exception 'Question not found.'; end if;
  if v_i.module_key is not null then
    select * into v_m from mock_exam_attempt_modules where attempt_id = p_attempt_id and module_key = v_i.module_key;
    if v_i.module_key is distinct from v_a.current_module or coalesce(v_m.locked, true) then
      raise exception 'This module has already been submitted, so marks cannot be changed.';
    end if;
  end if;
  insert into mock_exam_annotations (attempt_id, set_item_id, student_id, highlights, eliminated, updated_at)
  values (p_attempt_id, p_set_item_id, auth.uid(), v_hl, v_el, now())
  on conflict (attempt_id, set_item_id) do update set highlights = excluded.highlights, eliminated = excluded.eliminated, updated_at = now();
end $function$;

CREATE OR REPLACE FUNCTION public.load_mock_exam_annotations(p_attempt_id uuid, p_set_item_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_student uuid;
begin
  select student_id into v_student from mock_exam_attempts where id = p_attempt_id;
  if v_student is null then raise exception 'Attempt not found.'; end if;
  if v_student <> auth.uid() then
    if is_admin() or teaches_student(v_student) then
      null;
    elsif is_guardian_of(v_student) then
      return '{"highlights":[],"eliminated":[]}'::jsonb;
    else
      raise exception 'You do not have permission to view these marks.';
    end if;
  end if;
  return coalesce(
    (select jsonb_build_object('highlights', highlights, 'eliminated', eliminated)
       from mock_exam_annotations where attempt_id = p_attempt_id and set_item_id = p_set_item_id),
    '{"highlights":[],"eliminated":[]}'::jsonb);
end $function$;

CREATE OR REPLACE FUNCTION public.save_problem_note_strokes(p_context text, p_target_id uuid, p_item_id uuid, p_strokes jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_student uuid; v_a mock_exam_attempts%rowtype; v_i mock_exam_set_items%rowtype; v_m mock_exam_attempt_modules%rowtype;
begin
  if p_context not in ('mock_exam', 'homework', 'problem') then
    raise exception 'Unknown context: %', p_context;
  end if;
  v_student := _problem_note_target_student(p_context, p_target_id);
  if v_student is null or v_student <> auth.uid() then
    raise exception 'You can only save notes on your own attempts and homework.';
  end if;

  if p_context = 'mock_exam' then
    -- item_id 는 mock_exam_set_items.id(응시 화면이 setItemId 를 넘긴다).
    if _mock_exam_is_mst(p_target_id) then perform _mock_exam_settle(p_target_id); end if;
    select * into v_a from mock_exam_attempts where id = p_target_id;
    if v_a.status in ('submitted', 'graded') then raise exception 'This exam has already been submitted, so notes cannot be changed.'; end if;
    select * into v_i from mock_exam_set_items where id = p_item_id and exam_set_id = v_a.exam_set_id;
    if v_i.id is null then raise exception 'Question not found.'; end if;
    if v_i.module_key is not null then
      select * into v_m from mock_exam_attempt_modules where attempt_id = p_target_id and module_key = v_i.module_key;
      if v_i.module_key is distinct from v_a.current_module or coalesce(v_m.locked, true) then
        raise exception 'This module has already been submitted, so notes cannot be changed.';
      end if;
    end if;
  end if;

  insert into problem_note_strokes (context, target_id, item_id, author_id, strokes, updated_at)
  values (p_context, p_target_id, p_item_id, auth.uid(), coalesce(p_strokes, '[]'::jsonb), now())
  on conflict (context, target_id, item_id, author_id)
  do update set strokes = excluded.strokes, updated_at = now();
end $function$;

CREATE OR REPLACE FUNCTION public.load_problem_note_strokes(p_context text, p_target_id uuid, p_item_id uuid, p_author_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_student uuid; v_author uuid := coalesce(p_author_id, auth.uid());
begin
  if v_author <> auth.uid() then
    v_student := _problem_note_target_student(p_context, p_target_id);
    if v_student is null then
      raise exception 'You do not have permission to view these notes.';
    end if;
    if not (is_admin() or teaches_student(v_student)) then
      if is_guardian_of(v_student) and p_context = 'mock_exam' then
        return '[]'::jsonb;
      elsif not is_guardian_of(v_student) then
        raise exception 'You do not have permission to view these notes.';
      end if;
    end if;
  end if;
  return coalesce(
    (select strokes from problem_note_strokes
      where context = p_context and target_id = p_target_id and item_id = p_item_id and author_id = v_author),
    '[]'::jsonb
  );
end $function$;

CREATE OR REPLACE FUNCTION public.homework_submit_answer(p_batch_id uuid, p_problem_id uuid, p_response text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_b homework_batches%rowtype; v_items jsonb := '[]'::jsonb; v_it jsonb; v_found boolean := false; v_auto boolean;
  v_ver uuid; v_vid uuid; v_dec text;
begin
  select * into v_b from homework_batches where id = p_batch_id;
  if v_b.id is null or v_b.student_id <> auth.uid() then raise exception 'You can only answer your own homework.'; end if;
  for v_it in select value from jsonb_array_elements(v_b.items) loop
    if (v_it->>'problemId')::uuid = p_problem_id then
      v_found := true;
      if coalesce((v_it->>'graded')::boolean, false) then raise exception 'This homework has already been graded, so the answer cannot be changed.'; end if;
      v_auto := _answer_auto_grade(v_it->>'format', p_response, (v_it->>'correctIndex')::int, v_it->'answers');
      v_it := (v_it - 'errorAdjustmentVerdictId' - 'errorAdjustedAt' - 'errorAdjustmentPending')
              || jsonb_build_object('response', p_response, 'submittedAt', now(), 'autoCorrect', v_auto);
      if v_it->>'format' in ('mc', 'spr') then
        v_ver := coalesce(nullif(v_it->>'problemVersionId', '')::uuid, (select published_version_id from problems where id = p_problem_id));
        select v.id, v.decision into v_vid, v_dec from problem_error_verdicts v
         where v.problem_id = p_problem_id and v.problem_version_id = v_ver
         order by v.decided_at desc, v.id desc limit 1;
        if v_dec in ('key_wrong_confirmed', 'flawed_confirmed') then
          v_it := v_it || jsonb_build_object('autoCorrect', true, 'errorAdjustmentVerdictId', v_vid,
                                             'errorAdjustedAt', now(), 'errorAdjustmentPending', false);
        end if;
      end if;
    end if;
    v_items := v_items || jsonb_build_array(v_it);
  end loop;
  if not v_found then raise exception 'Question not found.'; end if;
  update homework_batches set items = v_items where id = p_batch_id;
end $function$;

CREATE OR REPLACE FUNCTION public.homework_batches_for_viewer(p_student_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_self boolean; v_guardian boolean; v_admin boolean; v_teacher boolean; v_consultant boolean;
begin
  v_self := p_student_id = auth.uid();
  v_admin := is_admin() or _is_service_role();
  v_teacher := teaches_student(p_student_id);
  v_guardian := is_guardian_of(p_student_id);
  v_consultant := is_assigned_consultant_of(p_student_id);
  if not (v_self or v_admin or v_teacher or v_guardian or v_consultant) then
    raise exception 'You do not have permission to view this student''s homework.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', b.id, 'teacherId', b.teacher_id, 'teacherName', tp.name,
      'studentId', b.student_id, 'label', b.label, 'subjectId', b.subject_id, 'subjectName', sj.name,
      'createdAt', b.created_at, 'dueAt', b.due_at,
      'items', coalesce((
        select jsonb_agg(_homework_item_for_viewer(it, not (v_admin or b.teacher_id = auth.uid())) order by (it->>'position')::int)
        from jsonb_array_elements(b.items) it
      ), '[]'::jsonb)
    ) order by b.created_at desc)
    from (
      select * from homework_batches hb
      where hb.student_id = p_student_id
        and (v_self or v_admin or v_guardian or v_consultant or hb.teacher_id = auth.uid())
      order by hb.created_at desc limit 50
    ) b
    left join profiles tp on tp.id = b.teacher_id
    left join subjects sj on sj.id = b.subject_id
  ), '[]'::jsonb);
end;
$function$;

CREATE OR REPLACE FUNCTION public.check_homework_attempt_assigned_to_student()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_assigned_student_id uuid;
begin
  select student_id into v_assigned_student_id
  from session_homework_items where id = new.homework_item_id;
  if v_assigned_student_id is null then
    raise exception 'Homework item not found: %', new.homework_item_id;
  end if;
  if v_assigned_student_id <> new.student_id then
    raise exception 'You cannot answer a homework item that is not assigned to you: %', new.homework_item_id;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.prevent_homework_attempt_update_after_submit()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if old.submitted then
    raise exception 'A submitted homework answer can no longer be changed.';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.freeze_problem_attempt_on_submit()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if old.submitted_at is not null then
    if new.submitted_at is distinct from old.submitted_at
       or new.submitted_stroke_seq is distinct from old.submitted_stroke_seq then
      raise exception 'This attempt has already been submitted, and its submitted notes cannot be changed. To try again, start a new attempt.';
    end if;
    if (new.submitted_choice_index is distinct from old.submitted_choice_index
        or new.submitted_text is distinct from old.submitted_text)
       and old.graded_at is not null then
      raise exception 'This problem has already been graded, so the answer cannot be changed.';
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_problem_attempt(p_work_id uuid, p_actor_id uuid, p_choice_index integer DEFAULT NULL::integer, p_text text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_work session_problem_work%rowtype;
  v_seq bigint;
  v_correct int;
  v_answers jsonb;
  v_auto boolean;
  v_version uuid;
begin
  select * into v_work from session_problem_work where id = p_work_id for update;
  if not found then
    raise exception 'Work area not found.';
  end if;
  if v_work.student_id <> p_actor_id then
    raise exception 'You can only submit your own work.';
  end if;

  v_version := coalesce(v_work.problem_version_id, (select p.published_version_id from problems p where p.id = v_work.problem_id));
  select v.correct_index, v.answers into v_correct, v_answers from problem_versions v where v.id = v_version;

  if p_choice_index is not null then
    v_auto := case when v_correct is null then null else (v_correct = p_choice_index) end;
  elsif p_text is not null and v_answers is not null and jsonb_typeof(v_answers) = 'array' and jsonb_array_length(v_answers) > 0 then
    v_auto := public.spr_answer_matches(p_text, v_answers);
  end if;

  if v_work.submitted_at is not null then
    if v_work.graded_at is not null then
      if (p_choice_index is not null and p_choice_index is distinct from v_work.submitted_choice_index)
         or (p_text is not null and p_text is distinct from v_work.submitted_text) then
        raise exception 'This problem has already been graded, so the answer cannot be changed.';
      end if;
      return;
    end if;
    if p_choice_index is not null and p_choice_index is distinct from v_work.submitted_choice_index then
      update session_problem_work set submitted_choice_index = p_choice_index, auto_correct = v_auto where id = p_work_id;
    elsif p_text is not null and p_text is distinct from v_work.submitted_text then
      update session_problem_work set submitted_text = p_text, auto_correct = v_auto where id = p_work_id;
    end if;
    return;
  end if;

  select max(seq) into v_seq
  from session_annotation_events
  where problem_work_id = p_work_id and scope = 'problem_student';

  update session_problem_work
  set submitted_at = now(),
      submitted_choice_index = p_choice_index,
      submitted_text = p_text,
      submitted_stroke_seq = v_seq,
      auto_correct = v_auto
  where id = p_work_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.start_problem_work(p_session_id uuid, p_student_id uuid, p_problem_id uuid, p_new_attempt boolean DEFAULT false, p_source text DEFAULT 'lesson'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_existing session_problem_work%rowtype;
  v_next int;
  v_version_id uuid;
  v_id uuid;
  v_status text;
  v_assigned boolean;
begin
  if p_source not in ('lesson', 'homework') then
    raise exception 'Work source must be lesson or homework: %', p_source;
  end if;
  select final_status into v_status from sessions where id = p_session_id;
  if v_status is null then
    raise exception 'Lesson not found.';
  end if;
  if v_status not in ('scheduled', 'live') then
    raise exception 'An answer cannot be created for a lesson that has already ended.';
  end if;

  if p_source = 'homework' then
    select exists (
      select 1 from session_homework_items h where h.session_id = p_session_id and h.problem_id = p_problem_id
    ) into v_assigned;
    if not v_assigned then raise exception 'This problem was not issued as homework for this lesson.'; end if;
  else
    select exists (
      select 1 from session_content_manifest m
      where m.session_id = p_session_id and m.content_type = 'problem' and m.content_id = p_problem_id
    ) into v_assigned;
    if not v_assigned then raise exception 'This problem is not assigned to this lesson.'; end if;
  end if;

  select * into v_existing from session_problem_work
    where session_id = p_session_id and student_id = p_student_id and problem_id = p_problem_id and source = p_source
    order by attempt_no desc limit 1;
  if found and not p_new_attempt then
    return v_existing.id;
  end if;
  v_next := coalesce(v_existing.attempt_no, 0) + 1;
  -- 버전: 과제면 발급본, 수업이면 고정본. 그 행에 버전이 비어 있는 경우만 현재 공개본을 쓴다.
  if p_source = 'homework' then
    select coalesce(
      (select h.problem_version_id from session_homework_items h
        where h.session_id = p_session_id and h.problem_id = p_problem_id and h.problem_version_id is not null limit 1),
      (select p.published_version_id from problems p where p.id = p_problem_id)
    ) into v_version_id;
  else
    select coalesce(
      (select m.problem_version_id from session_content_manifest m
        where m.session_id = p_session_id and m.content_id = p_problem_id and m.problem_version_id is not null limit 1),
      (select p.published_version_id from problems p where p.id = p_problem_id)
    ) into v_version_id;
  end if;
  insert into session_problem_work (session_id, student_id, problem_id, problem_version_id, attempt_no, source)
  values (p_session_id, p_student_id, p_problem_id, v_version_id, v_next, p_source)
  returning id into v_id;
  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.toggle_problem_work_saved_to_practice(p_work_id uuid, p_saved boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_w session_problem_work%rowtype;
begin
  select * into v_w from session_problem_work where id = p_work_id;
  if v_w.id is null or v_w.student_id <> auth.uid() then raise exception 'You can only save your own work.'; end if;
  update session_problem_work set saved_to_practice = p_saved where id = p_work_id;
end $function$;

CREATE OR REPLACE FUNCTION public.toggle_homework_item_saved_to_practice(p_batch_id uuid, p_problem_id uuid, p_saved boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_student_id uuid;
begin
  select student_id into v_student_id from homework_batches where id = p_batch_id;
  if v_student_id is null or v_student_id <> auth.uid() then raise exception 'You can only save your own homework.'; end if;
  update homework_batches
  set items = (
    select jsonb_agg(
      case when (item ->> 'problemId') = p_problem_id::text
        then item || jsonb_build_object('savedToPractice', p_saved)
        else item end
    )
    from jsonb_array_elements(items) as item
  )
  where id = p_batch_id;
end $function$;

CREATE OR REPLACE FUNCTION public.append_stroke_events(p_session_id uuid, p_segments jsonb)
 RETURNS SETOF session_annotation_events
 LANGUAGE plpgsql
AS $function$
declare
  v_author uuid := auth.uid();
  v_seg jsonb;
  v_row session_annotation_events;
begin
  if v_author is null then
    raise exception 'Not authenticated.';
  end if;

  if jsonb_typeof(p_segments) is distinct from 'array' or jsonb_array_length(p_segments) = 0 then
    raise exception 'p_segments must be a non-empty jsonb array.';
  end if;

  -- 입력 순서(ord) 그대로 한 행씩 INSERT — bigserial seq가 이 순서 그대로
  -- 단조 증가 배정된다. 도중에 raise exception이 나면(예: 세그먼트 payload
  -- 모양이 깨짐) 이 함수 호출 전체(=하나의 문장, 하나의 트랜잭션)가 롤백되어
  -- 그 앞서 이미 INSERT한 세그먼트까지 전부 함께 사라진다(all-or-nothing).
  for v_seg in
    select value
    from jsonb_array_elements(p_segments) with ordinality as t(value, ord)
    order by ord
  loop
    if not (
      v_seg ? 'x0' and v_seg ? 'y0' and v_seg ? 'x1' and v_seg ? 'y1'
      and v_seg ? 'color' and v_seg ? 'tool'
    ) then
      raise exception 'Stroke segment payload is missing required fields (x0,y0,x1,y1,color,tool): %', v_seg;
    end if;

    insert into session_annotation_events (session_id, author_id, event_type, payload)
    values (p_session_id, v_author, 'stroke', v_seg)
    returning * into v_row;

    return next v_row;
  end loop;

  return;
end;
$function$;

CREATE OR REPLACE FUNCTION public.append_scoped_stroke_events(p_session_id uuid, p_segments jsonb, p_scope text, p_curriculum_doc_id uuid DEFAULT NULL::uuid, p_problem_id uuid DEFAULT NULL::uuid, p_problem_work_id uuid DEFAULT NULL::uuid)
 RETURNS SETOF session_annotation_events
 LANGUAGE plpgsql
AS $function$
declare
  v_author uuid := auth.uid();
  v_owner uuid;
  v_seg jsonb;
  v_row session_annotation_events;
begin
  if v_author is null then
    raise exception 'Not authenticated.';
  end if;

  if p_scope not in ('teacher_shared', 'student_shared', 'problem_student', 'problem_teacher_feedback') then
    raise exception 'Unknown annotation scope: %', p_scope;
  end if;

  if jsonb_typeof(p_segments) is distinct from 'array' or jsonb_array_length(p_segments) = 0 then
    raise exception 'p_segments must be a non-empty jsonb array.';
  end if;

  -- 주인은 클라이언트가 정하지 못한다. 학생 필기의 주인은 쓰는 본인이고,
  -- 문제 풀이 범위의 주인은 그 풀이판의 학생이다(교사 피드백도 마찬가지).
  if p_scope = 'student_shared' then
    v_owner := v_author;
  elsif p_scope in ('problem_student', 'problem_teacher_feedback') then
    if p_problem_work_id is null then
      raise exception 'Problem work notes must specify which work area they belong to.';
    end if;
    select student_id into v_owner from session_problem_work where id = p_problem_work_id;
    if v_owner is null then
      raise exception 'Work area does not exist.';
    end if;
  else
    v_owner := null;
  end if;

  for v_seg in
    select value
    from jsonb_array_elements(p_segments) with ordinality as t(value, ord)
    order by ord
  loop
    if not (
      v_seg ? 'x0' and v_seg ? 'y0' and v_seg ? 'x1' and v_seg ? 'y1'
      and v_seg ? 'color' and v_seg ? 'tool'
    ) then
      raise exception 'Stroke segment payload is missing required fields (x0,y0,x1,y1,color,tool): %', v_seg;
    end if;

    insert into session_annotation_events
      (session_id, author_id, event_type, payload, scope, curriculum_doc_id, problem_id, problem_work_id, owner_student_id)
    values
      (p_session_id, v_author, 'stroke', v_seg, p_scope, p_curriculum_doc_id, p_problem_id, p_problem_work_id, v_owner)
    returning * into v_row;

    return next v_row;
  end loop;

  return;
end;
$function$;

CREATE OR REPLACE FUNCTION public.append_page_stroke_events(p_session_id uuid, p_segments jsonb, p_scope text, p_curriculum_doc_id uuid, p_curriculum_doc_version_id uuid, p_page_number integer)
 RETURNS SETOF session_annotation_events
 LANGUAGE plpgsql
AS $function$
declare
  v_author uuid := auth.uid();
  v_owner uuid;
  v_seg jsonb;
  v_row session_annotation_events;
  v_snapshot jsonb;
  v_version_doc uuid;
  v_page_count int;
  v_client_id uuid;
  v_type text;
begin
  if v_author is null then
    raise exception 'Not authenticated.';
  end if;
  if p_scope not in ('teacher_shared', 'student_shared') then
    raise exception 'Page notes only support the teacher-shared and student-shared scopes: %', p_scope;
  end if;
  if jsonb_typeof(p_segments) is distinct from 'array' or jsonb_array_length(p_segments) = 0 then
    raise exception 'p_segments must be a non-empty jsonb array.';
  end if;

  select v.curriculum_doc_id, v.snapshot into v_version_doc, v_snapshot
  from curriculum_doc_versions v where v.id = p_curriculum_doc_version_id;
  if v_version_doc is null or v_version_doc <> p_curriculum_doc_id then
    raise exception 'This is not a published version of this material.';
  end if;
  if coalesce(v_snapshot->>'kind', 'html') <> 'pdf' then
    raise exception 'Page notes can only be added to PDF materials.';
  end if;
  v_page_count := (v_snapshot->'asset'->>'pageCount')::int;
  if p_page_number is null or p_page_number < 1 or p_page_number > coalesce(v_page_count, 0) then
    raise exception 'Page % does not exist in this material (% pages).', p_page_number, coalesce(v_page_count, 0);
  end if;

  if not exists (
    select 1 from session_content_manifest cm
    where cm.session_id = p_session_id and cm.content_type = 'material_doc'
      and cm.content_id = p_curriculum_doc_id
  ) and not exists (
    select 1 from session_curriculum_units scu
    join curriculum_overlay_unit_materials m on m.overlay_unit_id = scu.overlay_unit_id
    where scu.session_id = p_session_id and m.curriculum_doc_id = p_curriculum_doc_id
  ) then
    raise exception 'This material does not belong to this lesson.';
  end if;

  v_owner := case when p_scope = 'student_shared' then v_author else null end;

  for v_seg in
    select value from jsonb_array_elements(p_segments) with ordinality as t(value, ord) order by ord
  loop
    if v_seg->>'tool' = 'clear' then
      v_type := 'clear_all';
    else
      v_type := 'stroke';
      if not (v_seg ? 'x0' and v_seg ? 'y0' and v_seg ? 'x1' and v_seg ? 'y1'
              and v_seg ? 'color' and v_seg ? 'tool') then
        raise exception 'Stroke segment payload is missing required fields (x0,y0,x1,y1,color,tool): %', v_seg;
      end if;
      if v_seg->>'tool' = 'text' and coalesce(btrim(v_seg->>'text'), '') = '' then
        raise exception 'The text note is empty.';
      end if;
    end if;
    v_client_id := null;
    begin
      v_client_id := (v_seg->>'eventId')::uuid;
    exception when others then
      v_client_id := null;
    end;

    insert into session_annotation_events
      (session_id, author_id, event_type, payload, scope, curriculum_doc_id,
       owner_student_id, curriculum_doc_version_id, page_number, client_event_id)
    values
      (p_session_id, v_author, v_type, v_seg - 'eventId', p_scope, p_curriculum_doc_id,
       v_owner, p_curriculum_doc_version_id, p_page_number, v_client_id)
    on conflict (session_id, client_event_id) where client_event_id is not null do nothing
    returning * into v_row;

    if v_row.seq is not null then
      return next v_row;
    end if;
    v_row := null;
  end loop;
  return;
end;
$function$;

CREATE OR REPLACE FUNCTION public.append_problem_page_stroke_events(p_session_id uuid, p_segments jsonb, p_scope text, p_problem_id uuid, p_context text DEFAULT 'lesson'::text)
 RETURNS SETOF session_annotation_events
 LANGUAGE plpgsql
AS $function$
declare
  v_author uuid := auth.uid();
  v_owner uuid;
  v_seg jsonb;
  v_row session_annotation_events;
  v_client_id uuid;
  v_type text;
begin
  if v_author is null then
    raise exception 'Not authenticated.';
  end if;
  if p_scope not in ('teacher_shared', 'student_shared') then
    raise exception 'Problem notes only support the teacher-shared and student-shared scopes: %', p_scope;
  end if;
  if p_context not in ('lesson', 'homework') then
    raise exception 'Problem note context must be lesson or homework: %', p_context;
  end if;
  if jsonb_typeof(p_segments) is distinct from 'array' or jsonb_array_length(p_segments) = 0 then
    raise exception 'p_segments must be a non-empty jsonb array.';
  end if;
  if p_context = 'lesson' and not exists (
    select 1 from session_content_manifest cm
    where cm.session_id = p_session_id and cm.content_type = 'problem' and cm.content_id = p_problem_id
  ) then
    raise exception 'This problem does not belong to this lesson.';
  end if;
  if p_context = 'homework' and not exists (
    select 1 from session_homework_items h where h.session_id = p_session_id and h.problem_id = p_problem_id
  ) then
    raise exception 'This homework does not belong to this lesson.';
  end if;

  v_owner := case when p_scope = 'student_shared' then v_author else null end;

  for v_seg in
    select value from jsonb_array_elements(p_segments) with ordinality as t(value, ord) order by ord
  loop
    if v_seg->>'tool' = 'clear' then
      v_type := 'clear_all';
    else
      v_type := 'stroke';
      if not (v_seg ? 'x0' and v_seg ? 'y0' and v_seg ? 'x1' and v_seg ? 'y1' and v_seg ? 'color' and v_seg ? 'tool') then
        raise exception 'Stroke segment payload is missing required fields (x0,y0,x1,y1,color,tool): %', v_seg;
      end if;
      if v_seg->>'tool' = 'text' and coalesce(btrim(v_seg->>'text'), '') = '' then
        raise exception 'The text note is empty.';
      end if;
    end if;
    v_client_id := null;
    begin
      v_client_id := (v_seg->>'eventId')::uuid;
    exception when others then
      v_client_id := null;
    end;

    insert into session_annotation_events
      (session_id, author_id, event_type, payload, scope, problem_id, owner_student_id, client_event_id, problem_context)
    values
      (p_session_id, v_author, v_type, v_seg - 'eventId', p_scope, p_problem_id, v_owner, v_client_id, p_context)
    on conflict (session_id, client_event_id) where client_event_id is not null do nothing
    returning * into v_row;

    if v_row.seq is not null then
      return next v_row;
    end if;
    v_row := null;
  end loop;
  return;
end;
$function$;

CREATE OR REPLACE FUNCTION public.save_material_reading_position(p_doc_id uuid, p_section_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_section_id is not null and not exists (
    select 1 from curriculum_doc_sections where id = p_section_id and curriculum_doc_id = p_doc_id
  ) then
    raise exception 'That section does not belong to this material.';
  end if;
  insert into material_reading_positions (user_id, curriculum_doc_id, section_id, updated_at)
  values (auth.uid(), p_doc_id, p_section_id, now())
  on conflict (user_id, curriculum_doc_id)
  do update set section_id = excluded.section_id, updated_at = excluded.updated_at;
end; $function$;

CREATE OR REPLACE FUNCTION public.create_named_vocab_folder(p_student_id uuid, p_name text)
 RETURNS vocab_word_folders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_row vocab_word_folders%rowtype; v_name text;
begin
  if not (p_student_id = auth.uid() or teaches_student(p_student_id) or is_admin()) then
    raise exception 'Only the student or their assigned teacher can create a folder.';
  end if;
  v_name := trim(p_name);
  if v_name = '' then raise exception 'Enter a folder name.'; end if;

  select * into v_row from vocab_word_folders where student_id = p_student_id and name = v_name;
  if v_row.id is not null then
    return v_row;
  end if;

  insert into vocab_word_folders (student_id, name, position)
  values (p_student_id, v_name, coalesce((select max(position) + 1 from vocab_word_folders where student_id = p_student_id), 0))
  returning * into v_row;
  return v_row;
end $function$;

CREATE OR REPLACE FUNCTION public.ensure_default_vocab_folder(p_student_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_id uuid;
begin
  if not (p_student_id = auth.uid() or teaches_student(p_student_id) or is_admin()) then
    raise exception 'Only the student or their assigned teacher can create a folder.';
  end if;
  select id into v_id from vocab_word_folders where student_id = p_student_id and is_default limit 1;
  if v_id is not null then
    return v_id;
  end if;
  insert into vocab_word_folders (student_id, name, is_default, position)
  values (p_student_id, 'Missed Words', true, -1)
  on conflict (student_id, name) do update set is_default = true
  returning id into v_id;
  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.roadmap_save_grades(p_student_id uuid, p_grade text, p_school_name text, p_gpa numeric, p_gpa_scale text, p_class_rank integer, p_class_size integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not _roadmap_can_write(p_student_id) then
    raise exception 'You do not have permission to do this.';
  end if;
  if p_gpa is not null and p_gpa_scale is null then
    raise exception 'To enter a GPA, you must also select a GPA scale.';
  end if;
  if p_gpa is not null and p_gpa_scale is not null and p_gpa > p_gpa_scale::numeric then
    raise exception 'GPA (%) cannot exceed the selected scale (%).', p_gpa, p_gpa_scale;
  end if;
  if p_gpa_scale is not null and p_gpa_scale not in ('4.0', '4.3', '4.5', '5.0') then
    raise exception 'GPA scale not allowed: %', p_gpa_scale;
  end if;

  update students
  set grade = p_grade,
      school_name = p_school_name,
      gpa = p_gpa,
      gpa_scale = p_gpa_scale,
      class_rank = p_class_rank,
      class_size = p_class_size
  where id = p_student_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.problem_error_report_submit(p_source text, p_report_type text, p_memo text DEFAULT NULL::text, p_session_id uuid DEFAULT NULL::uuid, p_session_source text DEFAULT NULL::text, p_problem_id uuid DEFAULT NULL::uuid, p_attempt_id uuid DEFAULT NULL::uuid, p_set_item_id uuid DEFAULT NULL::uuid, p_homework_batch_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_memo text := nullif(btrim(coalesce(p_memo, '')), '');
  v_problem uuid;
  v_version uuid;
  v_a mock_exam_attempts%rowtype;
  v_i mock_exam_set_items%rowtype;
  v_id uuid;
  v_b homework_batches%rowtype;
  v_it jsonb;
begin
  if v_uid is null then raise exception 'Login required.'; end if;
  select role::text into v_role from profiles where id = v_uid;
  if v_role not in ('student', 'teacher') then
    raise exception 'Only students and teachers can report a problem error.';
  end if;
  if p_report_type not in ('wrong_key', 'flawed_problem', 'bad_explanation', 'other') then
    raise exception 'Please choose a report type.';
  end if;
  if p_report_type = 'bad_explanation' and v_role <> 'teacher' then
    raise exception 'Only teachers can report an explanation error.';
  end if;
  if p_report_type = 'other' and v_memo is null then
    raise exception 'Please describe the issue for the "other" reason.';
  end if;
  if v_memo is not null and char_length(v_memo) > 1000 then
    raise exception 'Please keep the note within 1,000 characters.';
  end if;

  if p_source = 'session_assignment' then
    if p_session_id is null or p_problem_id is null or p_session_source not in ('lesson', 'homework') then
      raise exception 'Problem to report not found.';
    end if;
    if not ((v_role = 'student' and is_session_student_v3(p_session_id)) or (v_role = 'teacher' and is_session_teacher_v3(p_session_id))) then
      raise exception 'Only problems from this lesson can be reported.';
    end if;
    v_problem := p_problem_id;
    if p_session_source = 'lesson' then
      select m.problem_version_id into v_version from session_content_manifest m
       where m.session_id = p_session_id and m.content_type = 'problem' and m.content_id = p_problem_id limit 1;
      if not found then raise exception 'Only problems pinned to this lesson can be reported.'; end if;
    else
      select h.problem_version_id into v_version from session_homework_items h
       where h.session_id = p_session_id and h.problem_id = p_problem_id
         and (v_role = 'teacher' or h.student_id = v_uid) limit 1;
      if not found then raise exception 'Only problems issued in this homework can be reported.'; end if;
    end if;
    v_version := coalesce(v_version, (select published_version_id from problems where id = p_problem_id));
    if v_version is null then raise exception 'Problem version to report not found.'; end if;
    insert into problem_error_reports (problem_id, problem_version_id, source, session_id, session_source, reporter_id, reporter_role, report_type, memo)
    values (v_problem, v_version, 'session_assignment', p_session_id, p_session_source, v_uid, v_role, p_report_type, v_memo)
    on conflict (reporter_id, problem_id, problem_version_id) do nothing
    returning id into v_id;

  elsif p_source = 'mock_exam' then
    select * into v_a from mock_exam_attempts where id = p_attempt_id;
    if v_a.id is null then raise exception 'Question not found.'; end if;
    if not ((v_role = 'student' and v_a.student_id = v_uid) or (v_role = 'teacher' and teaches_student(v_a.student_id))) then
      raise exception 'Question not found.';
    end if;
    select * into v_i from mock_exam_set_items where id = p_set_item_id and exam_set_id = v_a.exam_set_id;
    -- 존재·경로 비노출: 다른 경로 문항·아직 열리지 않은 모듈 문항은 "없음"과 같은 메시지.
    if v_i.id is null or not _mock_exam_item_in_route(v_i, v_a) then raise exception 'Question not found.'; end if;
    if v_role = 'student' then
      if v_a.status = 'assigned' then raise exception 'Question not found.'; end if;
      if v_a.status = 'in_progress' and v_i.module_key is not null and not exists (
           select 1 from mock_exam_attempt_modules m
            where m.attempt_id = v_a.id and m.module_key = v_i.module_key and m.started_at is not null) then
        raise exception 'Question not found.';
      end if;
    end if;
    v_problem := v_i.problem_id;
    v_version := v_i.problem_version_id;
    insert into problem_error_reports (problem_id, problem_version_id, source, mock_attempt_id, mock_set_item_id, reporter_id, reporter_role, report_type, memo)
    values (v_problem, v_version, 'mock_exam', v_a.id, v_i.id, v_uid, v_role, p_report_type, v_memo)
    on conflict (reporter_id, problem_id, problem_version_id) do nothing
    returning id into v_id;
  elsif p_source = 'homework_batch' then
    -- 과제 묶음(homework_batches): 학생=본인 배치, 선생님=자기가 발급한 배치만. 배치 밖 문항·타인 배치는 모두 같은 메시지.
    if p_homework_batch_id is null or p_problem_id is null then raise exception 'Problem to report not found.'; end if;
    select * into v_b from homework_batches where id = p_homework_batch_id;
    if v_b.id is null or not ((v_role = 'student' and v_b.student_id = v_uid) or (v_role = 'teacher' and v_b.teacher_id = v_uid)) then
      raise exception 'Only problems issued in this homework can be reported.';
    end if;
    select it into v_it from jsonb_array_elements(v_b.items) it where it->>'problemId' = p_problem_id::text limit 1;
    if v_it is null then raise exception 'Only problems issued in this homework can be reported.'; end if;
    v_problem := p_problem_id;
    -- 스냅샷에 버전이 기록돼 있으면 그것, 없으면(이전 발급분) 문항의 현재 공개 버전.
    v_version := coalesce(nullif(v_it->>'problemVersionId', '')::uuid, (select published_version_id from problems where id = p_problem_id));
    if v_version is null then raise exception 'Problem version to report not found.'; end if;
    insert into problem_error_reports (problem_id, problem_version_id, source, homework_batch_id, reporter_id, reporter_role, report_type, memo)
    values (v_problem, v_version, 'homework_batch', v_b.id, v_uid, v_role, p_report_type, v_memo)
    on conflict (reporter_id, problem_id, problem_version_id) do nothing
    returning id into v_id;
  else
    raise exception 'Unknown report source.';
  end if;

  if v_id is null then
    return jsonb_build_object('duplicate', true,
      'reportId', (select id from problem_error_reports where reporter_id = v_uid and problem_id = v_problem and problem_version_id = v_version));
  end if;
  return jsonb_build_object('duplicate', false, 'reportId', v_id);
end $function$;
