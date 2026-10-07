-- 2026-10-07 customer-facing English policy follow-up (docs/qa/korean-db-errors-customer-reach-2026-10-07.md).
-- Translates the RAISE messages of 17 functions/triggers that customer roles (student/guardian/anonymous) can reach
-- directly or through customer RPCs/RLS writes. Logic, ERRCODE and signatures are unchanged (create or replace of the latest definitions).

CREATE OR REPLACE FUNCTION public.assign_library_words_to_student(p_student_id uuid, p_library_word_ids uuid[], p_folder_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (teaches_student(p_student_id) or p_student_id = auth.uid() or is_admin()) then
    raise exception 'You can only assign words to your own students.';
  end if;
  insert into vocab_words (student_id, word, definition, definition_en, example, example2, similar_words, antonym_words, assigned_by, folder_id)
  select p_student_id, lw.word, lw.definition_ko, lw.definition_en, lw.example1, lw.example2, lw.synonym_words, lw.antonym_words,
         case when p_student_id = auth.uid() then null else auth.uid() end, p_folder_id
  from vocab_library_words lw
  where lw.id = any(p_library_word_ids)
  on conflict (student_id, word) do update
    set folder_id = excluded.folder_id,
        definition_en = coalesce(vocab_words.definition_en, excluded.definition_en);
end;
$function$;

CREATE OR REPLACE FUNCTION public.check_annotation_problem_work_consistency()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  v_session_id uuid;
  v_student_id uuid;
  v_problem_id uuid;
begin
  if new.problem_work_id is null then
    return new;
  end if;
  select w.session_id, w.student_id, w.problem_id into v_session_id, v_student_id, v_problem_id
    from session_problem_work w where w.id = new.problem_work_id;
  if not found then
    raise exception 'That problem work board does not exist.';
  end if;
  if v_session_id <> new.session_id then
    raise exception 'The session of the problem work board (%) does not match the session of the annotation (%).', v_session_id, new.session_id;
  end if;
  if v_student_id <> new.owner_student_id then
    raise exception 'The student of the problem work board does not match the owner of the annotation.';
  end if;
  if v_problem_id <> new.problem_id then
    raise exception 'The problem of the problem work board does not match the problem of the annotation.';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.consultations_block_inactive_consultant()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.admissions_consultant_id is not null
     and (tg_op = 'INSERT' or new.admissions_consultant_id is distinct from old.admissions_consultant_id) then
    -- 학생 카드는 원 상담의 담당을 그대로 복사한다(이미 진행 중인 흐름이라 막지 않는다).
    if not (tg_op = 'INSERT' and coalesce(new.is_child_onboarding_card, false))
       and is_consultant_inactive(new.admissions_consultant_id) then
      raise exception 'A consultation cannot be assigned to a deactivated consultant.' using errcode = 'P0001';
    end if;
    new.unassigned_from_consultant_id := null;
    new.unassigned_reason := null;
    new.unassigned_at := null;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.consultations_require_assigned_consultant()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.admissions_consultant_id is null then
    if new.status = 'scheduled' then
      raise exception 'A consultation without an assigned consultant cannot be confirmed. Assign a consultant first.' using errcode = 'P0001';
    end if;
    if new.status = 'requested' and (new.starts_at is not null or new.ends_at is not null) then
      raise exception 'A time cannot be set on a consultation without an assigned consultant. Assign a consultant first.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.convert_free_member_to_tutoring(p_student_id uuid, p_consultation_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_c consultations%rowtype;
  v_type text;
begin
  select * into v_c from consultations where id = p_consultation_id;
  if not found or v_c.child_id is distinct from p_student_id or v_c.source <> 'free_member' then
    raise exception 'convert_free_member_to_tutoring: this consultation is not the free-member consultation linked to this student.';
  end if;
  select member_type into v_type from students where id = p_student_id for update;
  if not found then
    raise exception 'convert_free_member_to_tutoring: student not found.';
  end if;
  if v_type = 'tutoring' then
    return false; -- 이미 전환됨(멱등)
  end if;
  perform set_config('app.allow_member_type_change', 'true', true);
  update students set member_type = 'tutoring', converted_at = coalesce(converted_at, now()) where id = p_student_id and member_type = 'free';
  perform set_config('app.allow_member_type_change', 'false', true);
  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_and_snapshot_teacher_rate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_rate record;
  v_at timestamptz;
begin
  select r.starts_at into v_at from reservations r where r.id = new.reservation_id;
  v_at := coalesce(v_at, now());

  select amount_minor, currency into v_rate from teacher_rate_history
   where teacher_id = new.teacher_id and effective_from <= v_at and (effective_until is null or effective_until > v_at)
   order by effective_from desc limit 1;
  if v_rate.amount_minor is null then
    select amount_minor, currency into v_rate from teacher_rate_history
     where teacher_id = new.teacher_id and effective_until is null;
  end if;
  if v_rate.amount_minor is null then
    raise exception 'Teacher (%) has no valid current rate history, so the session cannot be created.', new.teacher_id;
  end if;
  new.hourly_rate_snapshot_minor := v_rate.amount_minor;
  new.hourly_rate_snapshot_currency := v_rate.currency;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_subject_enrollment_activation_preconditions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.status = 'active' and (old.status is null or old.status is distinct from 'active') then
    if not subject_enrollment_activation_ready(new.id) then
      raise exception 'The base contract must be active before subject enrollment (%) can be activated.', new.id;
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.extend_entitlement(p_grant_id uuid, p_new_expires_at timestamp with time zone, p_business_event_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_old_expires_at timestamptz;
begin
  select expires_at into v_old_expires_at from entitlement_grants where id = p_grant_id for update;
  if v_old_expires_at is null then
    raise exception 'Grant does not exist: %', p_grant_id;
  end if;
  if p_new_expires_at <= v_old_expires_at then
    raise exception 'The extended expiry (%) must be later than the current expiry (%).', p_new_expires_at, v_old_expires_at;
  end if;

  update entitlement_grants set expires_at = p_new_expires_at where id = p_grant_id;
  insert into entitlement_ledger (grant_id, event_type, amount, business_event_id)
  values (p_grant_id, 'adjust', 0, p_business_event_id)
  on conflict do nothing;
end;
$function$;

CREATE OR REPLACE FUNCTION public.grant_trial_entitlement_for_consultation(p_consultation_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_child_id uuid;
  v_existing_grant_id uuid;
  v_new_grant_id uuid;
  v_trial_product_id uuid;
  v_expires_at timestamptz;
begin
  select child_id into v_child_id from consultations where id = p_consultation_id for update;
  if not found then
    raise exception 'Consultation request not found: %', p_consultation_id;
  end if;
  if v_child_id is null then
    raise exception 'No student account is linked, so the trial lesson entitlement cannot be granted (prospect stage; retry after a student account is linked).';
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
    raise exception 'The trial lesson product (trial_lesson_grant) does not exist; migration ordering problem.';
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
$function$;

CREATE OR REPLACE FUNCTION public.grant_trial_entitlement_for_student(p_child_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_existing_grant_id uuid;
  v_new_grant_id uuid;
  v_trial_product_id uuid;
  v_expires_at timestamptz;
begin
  if not exists (select 1 from profiles where id = p_child_id and role = 'student') then
    raise exception 'Student account not found: %', p_child_id;
  end if;

  select eg.id into v_existing_grant_id
  from entitlement_grants eg
  join entitlement_products ep on ep.id = eg.entitlement_product_id
  where eg.child_id = p_child_id and ep.code = 'trial_lesson_grant'
  limit 1;
  if v_existing_grant_id is not null then
    return v_existing_grant_id;
  end if;

  select id into v_trial_product_id from entitlement_products where code = 'trial_lesson_grant';
  if v_trial_product_id is null then
    raise exception 'The trial lesson product (trial_lesson_grant) does not exist; migration ordering problem.';
  end if;

  v_expires_at := now() + interval '90 days';

  insert into entitlement_grants (
    child_id, entitlement_product_id, purchase_id_ref, original_quantity, expires_at,
    is_paid, source_consultation_id
  ) values (
    p_child_id, v_trial_product_id, null, 1, v_expires_at, false, null
  )
  returning id into v_new_grant_id;

  insert into entitlement_ledger (grant_id, event_type, amount, business_event_id)
  values (v_new_grant_id, 'grant', 1, 'trial_grant_direct:' || p_child_id::text)
  on conflict do nothing;

  -- 2026-09-28: 직접생성 경로 전용 함수이므로, 체험수업권이 처음 지급되는
  -- 이 순간이 "직접 계정 생성 완료"의 안전한 대리 신호다(finalize_trial_
  -- onboarding_students/retry_trial_onboarding_student가 이 함수를 계정 생성
  -- 직후 즉시 호출하므로 — 20261481000000).
  perform enqueue_contract_dispatch_job(p_child_id, 'direct_account_created');

  return v_new_grant_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.mock_exam_validate_mst_set(p_exam_set_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_s mock_exam_sets%rowtype; v_counts jsonb; v_key text; v_needed int; v_found int;
  v_modules jsonb := '[]'::jsonb; v_ready boolean := true; v_route mock_exam_route; v_routes mock_exam_route[];
  v_dup int; v_rules jsonb; v_share numeric; v_skill jsonb := '[]'::jsonb; v_elig jsonb := '[]'::jsonb;
  v_sim jsonb := '[]'::jsonb; v_nosnap int; v_hard boolean;
  v_routing boolean; v_shape int := 0; v_var jsonb := '[]'::jsonb; v_polmiss jsonb := '[]'::jsonb; v_sec text;
begin
  select * into v_s from mock_exam_sets where id = p_exam_set_id;
  if v_s.id is null then raise exception 'Set not found.'; end if;
  if v_s.format <> 'mst' then return jsonb_build_object('ready', true, 'modules', '[]'::jsonb, 'applicable', false); end if;
  v_counts := coalesce(v_s.module_item_counts, '{"rw_m1":27,"rw_m2":27,"math_m1":22,"math_m2":22}'::jsonb);
  v_rules := coalesce(v_s.assembly_rules, '{}'::jsonb);
  v_routing := coalesce((v_rules->>'routing')::boolean, false);

  foreach v_key in array array['rw_m1', 'rw_m2', 'math_m1', 'math_m2'] loop
    v_needed := (v_counts->>v_key)::int;
    if v_routing and v_key in ('rw_m2', 'math_m2') then
      v_routes := array['lower', 'higher']::mock_exam_route[];      -- 두 변형 모두 있어야 한다(없으면 found=0)
    else
      select coalesce(array_agg(distinct route), array[null::mock_exam_route]) into v_routes
      from mock_exam_set_items where exam_set_id = p_exam_set_id and module_key = v_key::mock_exam_module_key;
      if v_routes is null or array_length(v_routes, 1) is null then v_routes := array[null::mock_exam_route]; end if;
    end if;
    foreach v_route in array v_routes loop
      select count(*) into v_found from mock_exam_set_items
      where exam_set_id = p_exam_set_id and module_key = v_key::mock_exam_module_key and route is not distinct from v_route;
      if v_found <> v_needed then v_ready := false; end if;
      v_modules := v_modules || jsonb_build_object(
        'moduleKey', v_key, 'route', v_route, 'needed', v_needed, 'found', v_found, 'ok', v_found = v_needed
      );
    end loop;
  end loop;

  -- 경로 모양: 라우팅 세트는 M1 문항에 route 없음·M2 문항은 반드시 route 있음. 라우팅이 아닌 세트는 route 문항 자체가 없어야 한다.
  select count(*) into v_shape from mock_exam_set_items i
  where i.exam_set_id = p_exam_set_id and (
    (v_routing and i.module_key in ('rw_m1', 'math_m1') and i.route is not null)
    or (v_routing and i.module_key in ('rw_m2', 'math_m2') and i.route is null)
    or (not v_routing and i.route is not null));
  if v_shape > 0 then v_ready := false; end if;

  if v_routing then
    select coalesce(jsonb_agg(jsonb_build_object('moduleKey', i.module_key, 'route', i.route, 'setItemId', i.id, 'difficulty', i.difficulty)), '[]'::jsonb)
    into v_var
    from mock_exam_set_items i
    where i.exam_set_id = p_exam_set_id
      and ((i.route = 'lower' and not i.m2_lower_eligible) or (i.route = 'higher' and not i.m2_higher_eligible));
    if jsonb_array_length(v_var) > 0 then v_ready := false; end if;
    foreach v_sec in array array['rw', 'math'] loop
      if not exists (select 1 from mock_exam_routing_policies where section = v_sec and active) then
        v_polmiss := v_polmiss || to_jsonb(v_sec);
        v_ready := false;
      end if;
    end loop;
  end if;

  select count(*) - count(distinct problem_id) into v_dup from mock_exam_set_items where exam_set_id = p_exam_set_id;
  if v_dup > 0 then v_ready := false; end if;
  if exists (select 1 from mock_exam_set_items where exam_set_id = p_exam_set_id and module_key is null) then v_ready := false; end if;

  select count(*) into v_nosnap from mock_exam_set_items where exam_set_id = p_exam_set_id and content_snapshot is null;
  if v_nosnap > 0 then v_ready := false; end if;

  if v_rules ? 'skillMaxSharePct' or coalesce((v_rules->>'skillHardGate')::boolean, false) then
    v_hard := coalesce((v_rules->>'skillHardGate')::boolean, false);
    v_share := coalesce((v_rules->>'skillMaxSharePct')::numeric, 50);
    select coalesce(jsonb_agg(jsonb_build_object(
      'moduleKey', g.module_key, 'route', g.route, 'satDomain', g.sat_domain, 'skillCode', g.skill_code,
      'count', g.cnt, 'cap', ceil(g.domain_n * v_share / 100)::int) order by g.module_key, g.sat_domain, g.skill_code), '[]'::jsonb)
    into v_skill
    from (
      select i.module_key, i.route, i.sat_domain, i.skill_code, count(*) cnt,
             sum(count(*)) over (partition by i.module_key, i.route, i.sat_domain) domain_n
      from mock_exam_set_items i
      where i.exam_set_id = p_exam_set_id and i.skill_code is not null
      group by i.module_key, i.route, i.sat_domain, i.skill_code
    ) g
    where g.domain_n >= 3 and g.cnt > ceil(g.domain_n * v_share / 100);
    if v_hard and jsonb_array_length(v_skill) > 0 then v_ready := false; end if;
  end if;

  if coalesce((v_rules->>'enforceM1Eligibility')::boolean, false) then
    select coalesce(jsonb_agg(jsonb_build_object('moduleKey', i.module_key, 'setItemId', i.id, 'difficulty', i.difficulty)), '[]'::jsonb)
    into v_elig
    from mock_exam_set_items i
    where i.exam_set_id = p_exam_set_id and i.module_key in ('rw_m1', 'math_m1') and not i.m1_eligible;
    if jsonb_array_length(v_elig) > 0 then v_ready := false; end if;
  end if;

  if coalesce((v_rules->>'noSimilarGroupRepeat')::boolean, false) then
    select coalesce(jsonb_agg(jsonb_build_object('similarityGroup', g.similarity_group, 'count', g.cnt)), '[]'::jsonb)
    into v_sim
    from (
      select p.similarity_group, count(*) cnt
      from mock_exam_set_items i join problems p on p.id = i.problem_id
      where i.exam_set_id = p_exam_set_id and p.similarity_group is not null
      group by p.similarity_group having count(*) > 1
    ) g;
    if jsonb_array_length(v_sim) > 0 then v_ready := false; end if;
  end if;

  return jsonb_build_object(
    'ready', v_ready, 'applicable', true, 'duplicateCount', v_dup, 'modules', v_modules,
    'missingSnapshotCount', v_nosnap, 'skillViolations', case when v_hard then v_skill else '[]'::jsonb end,
    'skillWarnings', case when v_hard then '[]'::jsonb else v_skill end, 'eligibilityViolations', v_elig,
    'similarityViolations', v_sim,
    'routing', v_routing, 'routeShapeViolationCount', v_shape, 'variantEligibilityViolations', v_var, 'routingPolicyMissing', v_polmiss
  );
end $function$;

CREATE OR REPLACE FUNCTION public.prevent_direct_final_status_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if old.final_status not in ('scheduled', 'live')
     and new.final_status is distinct from old.final_status
     and not public.consume_session_invariant_unlock_token(old.id, 'final_status') then
    raise exception 'The status of a completed session can only be changed through reopen_session() or recomplete_session().';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.protect_account_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if new.status is distinct from old.status
     and not public.consume_status_transition_token(tg_table_name, new.id, 'status_transition') then
    raise exception 'Account status can only be changed through transition_account_status().';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.protect_hire_date()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.hire_date is distinct from old.hire_date then
    if not is_admin() then
      raise exception 'Only an administrator can edit the hire date.';
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.reject_archived_subject_reference()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  v_archived_at timestamptz;
begin
  select archived_at into v_archived_at from subjects where id = new.subject_id;
  if v_archived_at is not null then
    raise exception 'Cannot link to an archived subject (subject id: %).', new.subject_id;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.schedule_reservation_notifications(p_reservation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_reservation reservations%rowtype;
  v_child_id uuid;
  v_recipient uuid;
begin
  select * into v_reservation from reservations where id = p_reservation_id;
  if v_reservation.id is null then
    raise exception 'Reservation not found.' using errcode = 'P0001';
  end if;

  select se.child_id into v_child_id from subject_enrollments se where se.id = v_reservation.subject_enrollment_id;

  for v_recipient in
    select v_child_id
    union
    select hm.profile_id from household_members hm
      join household_members child on child.household_id = hm.household_id and child.role = 'child' and child.profile_id = v_child_id
    where hm.role = 'guardian'
  loop
    insert into booking_notification_outbox (reservation_id, recipient_id, notification_type, scheduled_for, payload)
    values (p_reservation_id, v_recipient, 'booking_confirmed', now(), jsonb_build_object('starts_at', v_reservation.starts_at))
    on conflict (reservation_id, recipient_id, notification_type) do nothing;

    if v_reservation.starts_at - interval '24 hours' > now() then
      insert into booking_notification_outbox (reservation_id, recipient_id, notification_type, scheduled_for, payload)
      values (p_reservation_id, v_recipient, 'reminder_24h', v_reservation.starts_at - interval '24 hours', jsonb_build_object('starts_at', v_reservation.starts_at))
      on conflict (reservation_id, recipient_id, notification_type) do nothing;
    end if;

    if v_reservation.starts_at - interval '2 hours' > now() then
      insert into booking_notification_outbox (reservation_id, recipient_id, notification_type, scheduled_for, payload)
      values (p_reservation_id, v_recipient, 'reminder_2h', v_reservation.starts_at - interval '2 hours', jsonb_build_object('starts_at', v_reservation.starts_at))
      on conflict (reservation_id, recipient_id, notification_type) do nothing;
    end if;
  end loop;

  -- 인앱 표시(스펙 "인앱 표시" 요구) — 기존 R0 notifications 테이블 그대로 재사용.
  insert into notifications (recipient_id, text, link_view)
  select rec.notify_id, '정규수업이 예약되었습니다.', 'booking'
  from (
    select v_child_id as notify_id
    union
    select hm.profile_id from household_members hm
      join household_members child on child.household_id = hm.household_id and child.role = 'child' and child.profile_id = v_child_id
    where hm.role = 'guardian'
  ) rec;
end;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_session_payout_item(p_session_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_session sessions%rowtype;
  v_existing payout_items%rowtype;
  v_amount_minor bigint;
  v_item_type text;
  v_batch_status text;
  v_delta bigint;
begin
  select * into v_session from sessions where id = p_session_id;
  if v_session.id is null then
    raise exception 'Session not found: %', p_session_id;
  end if;

  select * into v_existing from payout_items where session_id = p_session_id;

  v_batch_status := null;
  if v_existing.id is not null and v_existing.batch_id is not null then
    select status::text into v_batch_status from payout_batches where id = v_existing.batch_id;
  end if;

  if coalesce(v_session.payable_minutes, 0) <= 0 then
    if v_existing.id is not null then
      if v_batch_status is not null and v_batch_status not in ('draft', 'calculated', 'reviewing', 'reviewed') then
        -- 이미 승인·지급 단계다. 원본을 지우지 않고 전액을 차감하는 조정 항목을 만든다.
        if v_existing.amount_minor <> 0 then
          insert into payout_items (
            batch_id, session_id, teacher_id, item_type, hourly_rate_snapshot_minor,
            currency, payable_minutes, amount_minor, status,
            adjusts_payout_item_id, adjustment_reason
          ) values (
            null, null, v_existing.teacher_id, 'adjustment', 0,
            v_existing.currency, 0, -v_existing.amount_minor, 'pending',
            v_existing.id, '마감 뒤 수업 무지급 판정 — 다음 정산월 차감'
          );
        end if;
      else
        delete from payout_items where id = v_existing.id and status <> 'paid';
      end if;
    end if;
    return;
  end if;

  v_item_type := public.session_payout_item_type(v_session.lesson_type_id);
  v_amount_minor := round(v_session.hourly_rate_snapshot_minor * v_session.payable_minutes / 60.0);

  if v_existing.id is not null then
    if v_batch_status is not null and v_batch_status not in ('draft', 'calculated', 'reviewing', 'reviewed') then
      -- 승인 이후 묶음: 원본 불변. 차액만 다음 마감으로 넘긴다.
      v_delta := v_amount_minor - v_existing.amount_minor;
      if v_delta <> 0 then
        insert into payout_items (
          batch_id, session_id, teacher_id, item_type, hourly_rate_snapshot_minor,
          currency, payable_minutes, amount_minor, status,
          adjusts_payout_item_id, adjustment_reason
        ) values (
          null, null, v_existing.teacher_id, 'adjustment', 0,
          v_existing.currency, 0, v_delta, 'pending',
          v_existing.id, '마감 뒤 수업 재판정 차액 — 다음 정산월 반영'
        );
      end if;
      return;
    end if;

    update payout_items
      set payable_minutes = v_session.payable_minutes,
          amount_minor = v_amount_minor,
          hourly_rate_snapshot_minor = v_session.hourly_rate_snapshot_minor,
          currency = v_session.hourly_rate_snapshot_currency,
          item_type = v_item_type
      where id = v_existing.id and status <> 'paid';
  else
    insert into payout_items (
      session_id, teacher_id, item_type, hourly_rate_snapshot_minor, currency, payable_minutes, amount_minor, status
    ) values (
      p_session_id, v_session.teacher_id, v_item_type, v_session.hourly_rate_snapshot_minor,
      v_session.hourly_rate_snapshot_currency, v_session.payable_minutes, v_amount_minor, 'pending'
    );
  end if;
end;
$function$;
