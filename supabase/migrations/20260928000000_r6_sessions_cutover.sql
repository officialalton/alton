-- R6 3/N — 구조적 cutover: 레거시 `sessions` → `legacy_sessions`, `sessions_v3` → `sessions`
--
-- 배경(master-roadmap-v3.md R6, product-architecture-v3.md §4.13, R3 contracts cutover
-- `20260911000000_r3_contracts_cutover.sql`와 동일한 패턴): R1에서 `sessions_v3`를
-- shadow 이름으로 만들 때 예고한 대로, 레거시 `sessions`(교재/화이트보드/과제/리뷰 —
-- app/student/*, app/teacher/*, app/session/[id]/* 8개 파일이 실사용 중, R8/R9에서
-- 정식으로 v3 세션뷰에 통합 예정)를 `legacy_sessions`로 rename하고 `sessions_v3`를
-- 최종 이름 `sessions`로 rename한다. 이 시점의 레거시 `sessions` 데이터는 오픈 전
-- 테스트 데이터이므로 이관하지 않는다(§4.13과 동일 원칙) — DROP하지 않고 조회·계속
-- 사용 가능하게 둔다(세션뷰 기능 자체가 아직 R8/R9로 v3 전환되지 않았으므로).
--
-- 조사 결과(영향 범위, cutover 전 확인):
-- - `sessions`를 FK로 참조하는 테이블 11개(makeup_credits, session_files, canvas_annotations,
--   session_problem_attempts, session_reviews, session_student_feedback, vocab_words,
--   teacher_qc_warnings, chat_threads 등) — Postgres RENAME TABLE은 OID 기반이라 FK·
--   RLS 정책·뷰·인덱스·트리거는 전부 자동으로 새 이름을 따라간다(별도 조치 불필요).
-- - PL/pgSQL 함수 본문은 텍스트로 저장되어 rename을 자동으로 따라가지 않는다 —
--   `session_student_id`/`session_teacher_id`/`is_session_participant`/`is_session_related`
--   (legacy `sessions` 참조), `reopen_session`/`recomplete_session`/`merge_accounts`
--   (`sessions_v3` 참조), R6 1/N `confirm_lesson_booking`(`sessions_v3` 참조) — 전부 이
--   마이그레이션에서 CREATE OR REPLACE로 갱신한다.
-- - 트리거 정의(`sessions_v3_enforce_and_snapshot_teacher_rate`, `sessions_prevent_direct_update`)
--   와 그 트리거 함수 본문은 테이블명을 텍스트로 참조하지 않아 rename 후에도 그대로 동작한다.
-- - 앱 코드 14개 파일의 `.from("sessions")`(17곳)는 전부 레거시 세션뷰 기능(교재/화이트보드/
--   과제/스크래치패드/AI문제생성/리뷰/Calendly 웹훅)이며, 같은 배포에서 `.from("legacy_sessions")`
--   로 전환한다(이 마이그레이션과 별도 커밋이지만 같은 배포 단위).

-- =========================================================================
-- 1) 레거시 sessions → legacy_sessions
-- =========================================================================
alter table sessions rename to legacy_sessions;
alter index sessions_pkey rename to legacy_sessions_pkey;
alter table legacy_sessions rename constraint sessions_enrollment_id_fkey to legacy_sessions_enrollment_id_fkey;
alter table legacy_sessions rename constraint sessions_source_template_unit_id_fkey to legacy_sessions_source_template_unit_id_fkey;
alter table legacy_sessions rename constraint sessions_curriculum_doc_id_fkey to legacy_sessions_curriculum_doc_id_fkey;
alter table legacy_sessions rename constraint sessions_enrollment_id_session_number_key to legacy_sessions_enrollment_id_session_number_key;

comment on table legacy_sessions is
  'R6 cutover(2026-09-28)로 rename된 레거시(v1) 세션 테이블. 교재/화이트보드/과제/스크래치패드/'
  'AI문제생성/리뷰 등 세션뷰 기능이 R8/R9에서 v3로 통합되기 전까지 계속 이 테이블을 쓴다. '
  '예약/수업권/Calendar 흐름(R6)은 이 테이블을 쓰지 않는다 — 새 예약은 sessions(구 sessions_v3)를 쓴다.';

-- legacy sessions 관련 헬퍼 함수 4개: 본문의 public.sessions 참조를 legacy_sessions로 갱신.
create or replace function public.session_student_id(p_session_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select e.student_id from public.legacy_sessions s join public.enrollments e on e.id = s.enrollment_id
  where s.id = p_session_id;
$$;

create or replace function public.session_teacher_id(p_session_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select e.teacher_id from public.legacy_sessions s join public.enrollments e on e.id = s.enrollment_id
  where s.id = p_session_id;
$$;

create or replace function public.is_session_participant(p_session_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.legacy_sessions s join public.enrollments e on e.id = s.enrollment_id
    where s.id = p_session_id and (e.student_id = auth.uid() or e.teacher_id = auth.uid())
  );
$$;

create or replace function public.is_session_related(p_session_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_session_participant(p_session_id)
    or public.is_guardian_of(public.session_student_id(p_session_id))
    or public.is_admin();
$$;

-- =========================================================================
-- 2) sessions_v3 → sessions (session_status_events는 session_id로만 참조 — rename 불필요)
-- =========================================================================
alter table sessions_v3 rename to sessions;
alter index sessions_v3_pkey rename to sessions_pkey;
alter index sessions_v3_reservation_id_key rename to sessions_reservation_id_key;
alter index sessions_v3_subject_enrollment_id_idx rename to sessions_subject_enrollment_id_idx;
alter index sessions_v3_teacher_id_idx rename to sessions_teacher_id_idx;
alter table sessions rename constraint sessions_v3_final_actor_id_fkey to sessions_final_actor_id_fkey;
alter table sessions rename constraint sessions_v3_lesson_type_id_fkey to sessions_lesson_type_id_fkey;
alter table sessions rename constraint sessions_v3_material_version_id_fkey to sessions_material_version_id_fkey;
alter table sessions rename constraint sessions_v3_reservation_id_fkey to sessions_reservation_id_fkey;
alter table sessions rename constraint sessions_v3_smart_notes_status_check to sessions_smart_notes_status_check;
alter table sessions rename constraint sessions_v3_subject_enrollment_id_fkey to sessions_subject_enrollment_id_fkey;
alter table sessions rename constraint sessions_v3_teacher_id_fkey to sessions_teacher_id_fkey;

comment on table sessions is
  'R6 cutover(2026-09-28)로 확정된 v3 세션 테이블(R1에서는 sessions_v3라는 shadow 이름으로 생성됨). '
  '자체 예약(R6)이 만드는 실제 수업 세션 — 레거시 세션뷰 테이블은 legacy_sessions를 참고.';

-- RLS 정책 이름 정리(cosmetic, R3 contracts cutover와 동일한 원칙 — 정책이 바라보는
-- 테이블(oid)에는 영향 없음).
alter policy "sessions_v3 조회" on sessions rename to "sessions 조회";
alter policy "sessions_v3 쓰기" on sessions rename to "sessions 쓰기";

-- v3 세션 관련 함수 3개: 본문의 sessions_v3 참조를 sessions로 갱신(로직 변경 없음).
create or replace function public.reopen_session(p_session_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_prev v3_session_final_status;
begin
  if not public.is_admin() then
    raise exception '관리자만 세션을 재개방할 수 있습니다.';
  end if;

  select final_status into v_prev from sessions where id = p_session_id for update;
  if v_prev is null then
    raise exception '세션을 찾을 수 없습니다.';
  end if;
  if v_prev in ('scheduled', 'live') then
    raise exception '아직 확정되지 않은 세션은 재개방할 필요가 없습니다.';
  end if;

  insert into session_status_events (session_id, event_type, previous_final_status, new_final_status, actor_profile_id, reason)
  values (p_session_id, 'reopened', v_prev, 'live', auth.uid(), p_reason);

  perform set_config('app.bypass_session_lock', 'true', true);
  update sessions set final_status = 'live' where id = p_session_id;
end;
$$;

create or replace function public.recomplete_session(p_session_id uuid, p_new_final_status v3_session_final_status, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_prev v3_session_final_status;
begin
  if not public.is_admin() then
    raise exception '관리자만 세션을 재확정할 수 있습니다.';
  end if;

  select final_status into v_prev from sessions where id = p_session_id for update;
  if v_prev is distinct from 'live' then
    raise exception 'reopen_session() 이후에만 recomplete_session()을 호출할 수 있습니다.';
  end if;

  if p_new_final_status in ('scheduled', 'live') then
    raise exception 'recomplete_session()은 scheduled/live로 되돌릴 수 없습니다. 확정 가능한 종료 상태만 허용됩니다.';
  end if;

  update sessions set final_status = p_new_final_status, finalized_at = now() where id = p_session_id;

  insert into session_status_events (session_id, event_type, previous_final_status, new_final_status, actor_profile_id, reason)
  values (p_session_id, 'recompleted', v_prev, p_new_final_status, auth.uid(), p_reason);
end;
$$;

-- merge_accounts(): 현재 유효 정의(20260911000000_r3_contracts_cutover.sql의 버전)와 완전히
-- 동일한 로직이되 sessions_v3 → sessions 참조만 갱신.
CREATE OR REPLACE FUNCTION public.merge_accounts(p_survivor_id uuid, p_merged_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_first uuid;
  v_second uuid;
  v_survivor_role profile_role;
  v_merged_role profile_role;
  v_merged_status text;
  v_summary jsonb := '{}'::jsonb;
  v_count int;
begin
  if not (is_admin() or current_user_has_capability('manage_account_merges')) then
    raise exception '관리자만 계정을 병합할 수 있습니다.';
  end if;
  if p_survivor_id is null or p_merged_id is null then
    raise exception 'survivor_id/merged_id는 필수입니다.';
  end if;
  if p_survivor_id = p_merged_id then
    raise exception '같은 계정을 병합할 수 없습니다.';
  end if;

  if p_survivor_id < p_merged_id then
    v_first := p_survivor_id; v_second := p_merged_id;
  else
    v_first := p_merged_id; v_second := p_survivor_id;
  end if;
  perform 1 from profiles where id = v_first for update;
  perform 1 from profiles where id = v_second for update;

  select role into v_survivor_role from profiles where id = p_survivor_id;
  select role into v_merged_role from profiles where id = p_merged_id;
  if v_survivor_role is null or v_merged_role is null then
    raise exception '존재하지 않는 계정입니다.';
  end if;
  if v_survivor_role <> v_merged_role then
    raise exception '같은 역할의 계정만 병합할 수 있습니다(생존: %, 병합대상: %).', v_survivor_role, v_merged_role;
  end if;
  if v_survivor_role = 'admin' then
    raise exception '관리자 계정은 이 기능으로 병합할 수 없습니다.';
  end if;

  if exists (select 1 from account_merges where merged_id = p_merged_id) then
    raise exception '이미 병합된 계정입니다.';
  end if;
  if exists (select 1 from account_merges where merged_id = p_survivor_id) then
    raise exception '생존 계정으로 지정한 계정이 이미 다른 계정에 병합된 원본입니다.';
  end if;

  v_merged_status := get_account_status(p_merged_id);
  if v_merged_status = 'inactive' then
    raise exception 'inactive 계정은 병합할 수 없습니다.';
  end if;
  if v_merged_status = 'closed' then
    raise exception '이미 closed된 계정은 병합할 수 없습니다.';
  end if;

  delete from household_members hm
  where hm.profile_id = p_merged_id
    and exists (
      select 1 from household_members hm2
      where hm2.household_id = hm.household_id and hm2.profile_id = p_survivor_id
    );
  update household_members set profile_id = p_survivor_id where profile_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('household_members', v_count);

  update households set primary_guardian_id = p_survivor_id where primary_guardian_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('households_primary_guardian', v_count);

  update contracts set child_id = p_survivor_id where child_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('contracts', v_count);

  update entitlement_grants set child_id = p_survivor_id where child_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('entitlement_grants', v_count);

  update subject_enrollments set child_id = p_survivor_id where child_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('subject_enrollments', v_count);

  update makeup_obligations set child_id = p_survivor_id where child_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('makeup_obligations_child', v_count);
  update makeup_obligations set teacher_id = p_survivor_id where teacher_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('makeup_obligations_teacher', v_count);

  update notifications set recipient_id = p_survivor_id where recipient_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('notifications', v_count);

  update payout_batches set teacher_id = p_survivor_id where teacher_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('payout_batches', v_count);
  update payout_items set teacher_id = p_survivor_id where teacher_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('payout_items', v_count);

  update reservations set owner_profile_id = p_survivor_id where owner_profile_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('reservations', v_count);

  update session_files set uploaded_by_id = p_survivor_id where uploaded_by_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('session_files', v_count);

  -- R6 cutover: sessions_v3 → sessions로 이름이 바뀌었다(v3 세션).
  update sessions set teacher_id = p_survivor_id where teacher_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('sessions', v_count);

  update supervisor_capabilities set profile_id = p_survivor_id where profile_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('supervisor_capabilities', v_count);

  update teacher_assignments set teacher_id = p_survivor_id where teacher_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('teacher_assignments', v_count);

  -- R6 cutover: 레거시(v1) sessions → legacy_sessions로 이름이 바뀌었다. session_files/
  -- session_problem_attempts 등은 여전히 legacy_sessions를 참조하지만 이 함수는 그 테이블들의
  -- profile_id 컬럼(uploaded_by_id/student_id 등)만 갱신하므로 legacy_sessions 자체를 직접
  -- update하지 않는다(기존 로직 그대로).
  update legacy_contracts set parent_id = p_survivor_id where parent_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('legacy_contracts_parent', v_count);
  update legacy_contracts set student_id = p_survivor_id where student_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('legacy_contracts_student', v_count);

  update credit_purchases set student_id = p_survivor_id where student_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('credit_purchases', v_count);
  update credit_transactions set student_id = p_survivor_id where student_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('credit_transactions', v_count);

  update enrollments set student_id = p_survivor_id where student_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('enrollments_student', v_count);
  update enrollments set teacher_id = p_survivor_id where teacher_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('enrollments_teacher', v_count);

  update makeup_credits set student_id = p_survivor_id where student_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('makeup_credits_student', v_count);
  update makeup_credits set teacher_id = p_survivor_id where teacher_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('makeup_credits_teacher', v_count);

  update parent_requests set parent_id = p_survivor_id where parent_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('parent_requests_parent', v_count);
  update parent_requests set student_id = p_survivor_id where student_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('parent_requests_student', v_count);
  update parent_requests set teacher_id = p_survivor_id where teacher_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('parent_requests_teacher', v_count);

  update payment_methods set parent_id = p_survivor_id where parent_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('payment_methods', v_count);

  update session_problem_attempts set student_id = p_survivor_id where student_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('session_problem_attempts', v_count);
  update session_student_feedback set student_id = p_survivor_id where student_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('session_student_feedback', v_count);
  update vocab_words set student_id = p_survivor_id where student_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('vocab_words', v_count);

  update teacher_qc_warnings set student_id = p_survivor_id where student_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('teacher_qc_warnings_student', v_count);
  update teacher_qc_warnings set teacher_id = p_survivor_id where teacher_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('teacher_qc_warnings_teacher', v_count);

  update chat_threads set student_id = p_survivor_id where student_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('chat_threads_student', v_count);
  update chat_threads set teacher_id = p_survivor_id where teacher_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('chat_threads_teacher', v_count);

  update teacher_curriculum_templates set teacher_id = p_survivor_id where teacher_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('teacher_curriculum_templates', v_count);
  update curriculum_docs set owner_teacher_id = p_survivor_id where owner_teacher_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('curriculum_docs', v_count);
  update curriculum_doc_adoptions set teacher_id = p_survivor_id where teacher_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('curriculum_doc_adoptions', v_count);
  update teacher_problem_tags set teacher_id = p_survivor_id where teacher_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('teacher_problem_tags', v_count);
  update teacher_contracts set teacher_id = p_survivor_id where teacher_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('teacher_contracts', v_count);

  perform set_config('app.bypass_status_protect', 'true', true);
  if v_merged_role = 'student' then
    update students set status = 'closed' where id = p_merged_id;
  elsif v_merged_role = 'teacher' then
    update teachers set status = 'closed' where id = p_merged_id;
  elsif v_merged_role = 'parent' then
    update parents set status = 'closed' where id = p_merged_id;
  end if;
  perform set_config('app.bypass_status_protect', 'false', true);

  insert into account_status_events (profile_id, previous_status, new_status, changed_by, reason)
  values (p_merged_id, v_merged_status, 'closed', auth.uid(), coalesce('merged: ' || p_reason, 'merged'));

  insert into account_merges (survivor_id, merged_id, merged_by, reason, affected_tables_summary)
  values (p_survivor_id, p_merged_id, auth.uid(), p_reason, v_summary);
end;
$function$
;

-- R6 1/N confirm_lesson_booking(): sessions_v3 → sessions insert 갱신(로직 변경 없음).
create or replace function public.confirm_lesson_booking(
  p_child_id uuid,
  p_subject_enrollment_id uuid,
  p_teacher_id uuid,
  p_lesson_type_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_idempotency_key text,
  p_booking_series_id uuid default null,
  p_series_occurrence_index smallint default null
) returns table (reservation_id uuid, session_id uuid)
  language plpgsql security definer set search_path = public as $$
declare
  v_reservation_id uuid;
  v_session_id uuid;
  v_grant_id uuid;
begin
  if not is_within_booking_window(p_starts_at) then
    raise exception 'booking_window_violation' using errcode = 'P0001';
  end if;
  if not is_teacher_slot_open(p_teacher_id, p_starts_at, p_ends_at) then
    raise exception 'teacher_slot_not_open' using errcode = 'P0001';
  end if;
  if violates_teacher_buffer(p_teacher_id, p_starts_at, p_ends_at) then
    raise exception 'teacher_buffer_violation' using errcode = 'P0001';
  end if;

  insert into reservations (
    kind, subject_enrollment_id, owner_profile_id, starts_at, ends_at, status,
    idempotency_key, booking_series_id, series_occurrence_index
  ) values (
    'lesson', p_subject_enrollment_id, p_teacher_id, p_starts_at, p_ends_at, 'confirmed',
    p_idempotency_key, p_booking_series_id, p_series_occurrence_index
  )
  returning id into v_reservation_id;

  insert into sessions (
    reservation_id, subject_enrollment_id, teacher_id, lesson_type_id, scheduled_duration_minutes
  ) values (
    v_reservation_id, p_subject_enrollment_id, p_teacher_id, p_lesson_type_id,
    extract(epoch from (p_ends_at - p_starts_at))::int / 60
  )
  returning id into v_session_id;

  v_grant_id := hold_entitlement(p_child_id, v_reservation_id, p_starts_at, 1);

  return query select v_reservation_id, v_session_id;
end;
$$;
