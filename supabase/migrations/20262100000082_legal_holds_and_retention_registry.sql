-- 2026-10-06 보존 구현 1차 — legal hold(법적 보류), 보존 정책 레지스트리, 모든 보존 삭제 경로의 hold 검사.
-- 추가 전용. RETENTION_BATCH_ENABLED·cron 게이트는 건드리지 않는다.
-- 롤백: retention_* 함수를 20262100000081/20261926000000 정의로 복원, anonymize_merged_account 래퍼 제거 후
--       _core 이름을 원복, 새 테이블·함수 drop.

-- ---------------------------------------------------------------------------
-- 1) legal_holds
create table legal_holds (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in
    ('global','profile','student','household','consultation','enrollment','session','prospect_contact','consult_request')),
  subject_id uuid,
  scope text[] not null default array['all'],
  reason text not null check (length(trim(reason)) >= 10),
  set_by uuid not null references profiles (id),
  set_at timestamptz not null default now(),
  review_by date not null,
  last_review_notice_at timestamptz,
  released_by uuid references profiles (id),
  released_at timestamptz,
  release_note text,
  check ((subject_type = 'global') = (subject_id is null)),
  check (released_at is null or released_by is not null)
);
create index on legal_holds (subject_type, subject_id) where released_at is null;

create table legal_hold_events (
  id uuid primary key default gen_random_uuid(),
  hold_id uuid not null references legal_holds (id),
  event_type text not null check (event_type in ('placed','extended','released','review_notice')),
  actor_id uuid references profiles (id),
  review_by date,
  note text,
  created_at timestamptz not null default now()
);
create index on legal_hold_events (hold_id, created_at);

create or replace function public.reject_legal_hold_events_mutation() returns trigger
language plpgsql as $$ begin raise exception 'legal_hold_events는 INSERT-only입니다.'; end $$;
create trigger legal_hold_events_no_update before update or delete on legal_hold_events
  for each row execute function public.reject_legal_hold_events_mutation();
revoke execute on function public.reject_legal_hold_events_mutation() from public, anon, authenticated, service_role;

-- 대상·사유·설정자는 바꿀 수 없고 review_by 연장·해제만 허용(삭제 금지).
create or replace function public.guard_legal_holds_mutation() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'legal_holds는 삭제할 수 없습니다(해제만 가능).'; end if;
  if new.subject_type is distinct from old.subject_type or new.subject_id is distinct from old.subject_id
     or new.scope is distinct from old.scope or new.reason is distinct from old.reason
     or new.set_by is distinct from old.set_by or new.set_at is distinct from old.set_at then
    raise exception 'legal hold의 대상·범위·사유·설정자는 변경할 수 없습니다. 새 보류를 등록하세요.';
  end if;
  if old.released_at is not null then raise exception '해제된 legal hold는 변경할 수 없습니다.'; end if;
  return new;
end $$;
create trigger legal_holds_guard before update or delete on legal_holds
  for each row execute function public.guard_legal_holds_mutation();
revoke execute on function public.guard_legal_holds_mutation() from public, anon, authenticated, service_role;

alter table legal_holds enable row level security;
alter table legal_hold_events enable row level security;
create policy "관리자 조회" on legal_holds for select using (is_admin());
create policy "관리자 조회" on legal_hold_events for select using (is_admin());
-- insert/update 정책 없음: 아래 DEFINER 함수로만 변경.

-- 활성 hold 여부(해제 전이면 review_by가 지나도 유지 — 자동 해제 없음).
create or replace function public.has_active_legal_hold(p_type text, p_id uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from legal_holds h
    where h.released_at is null
      and (h.subject_type = 'global' or (h.subject_type = p_type and h.subject_id = p_id))
  );
$$;
revoke execute on function public.has_active_legal_hold(text, uuid) from public, anon;
grant execute on function public.has_active_legal_hold(text, uuid) to authenticated, service_role;

create or replace function public.place_legal_hold(p_subject_type text, p_subject_id uuid, p_scope text[], p_reason text, p_review_by date)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if not is_admin() then raise exception '관리자만 legal hold를 설정할 수 있습니다.'; end if;
  if p_review_by is null then raise exception 'review_by(재검토일)는 필수입니다 — 무기한 보류는 설정할 수 없습니다.'; end if;
  if p_review_by <= current_date or p_review_by > current_date + 366 then
    raise exception 'review_by는 내일부터 최대 12개월 이내여야 합니다(연장은 새 기록으로).';
  end if;
  insert into legal_holds (subject_type, subject_id, scope, reason, set_by, review_by)
  values (p_subject_type, p_subject_id, coalesce(p_scope, array['all']), p_reason, auth.uid(), p_review_by)
  returning id into v_id;
  insert into legal_hold_events (hold_id, event_type, actor_id, review_by, note) values (v_id, 'placed', auth.uid(), p_review_by, p_reason);
  return v_id;
end $$;

create or replace function public.extend_legal_hold(p_hold_id uuid, p_new_review_by date, p_note text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not is_admin() then raise exception '관리자만 legal hold를 연장할 수 있습니다.'; end if;
  if p_note is null or length(trim(p_note)) < 10 then raise exception '연장 사유(10자 이상)가 필요합니다.'; end if;
  if p_new_review_by <= current_date or p_new_review_by > current_date + 366 then
    raise exception 'review_by는 내일부터 최대 12개월 이내여야 합니다.';
  end if;
  update legal_holds set review_by = p_new_review_by, last_review_notice_at = null
   where id = p_hold_id and released_at is null;
  if not found then raise exception '활성 legal hold가 아닙니다.'; end if;
  insert into legal_hold_events (hold_id, event_type, actor_id, review_by, note) values (p_hold_id, 'extended', auth.uid(), p_new_review_by, p_note);
end $$;

create or replace function public.release_legal_hold(p_hold_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not is_admin() then raise exception '관리자만 legal hold를 해제할 수 있습니다.'; end if;
  update legal_holds set released_by = auth.uid(), released_at = now(), release_note = p_note
   where id = p_hold_id and released_at is null;
  if not found then raise exception '활성 legal hold가 아닙니다.'; end if;
  insert into legal_hold_events (hold_id, event_type, actor_id, note) values (p_hold_id, 'released', auth.uid(), p_note);
end $$;
revoke execute on function public.place_legal_hold(text, uuid, text[], text, date) from public, anon;
revoke execute on function public.extend_legal_hold(uuid, date, text) from public, anon;
revoke execute on function public.release_legal_hold(uuid, text) from public, anon;
grant execute on function public.place_legal_hold(text, uuid, text[], text, date) to authenticated;
grant execute on function public.extend_legal_hold(uuid, date, text) to authenticated;
grant execute on function public.release_legal_hold(uuid, text) to authenticated;

-- 재검토일 도래 알림: 자동 해제하지 않고 설정자에게 알림 + 기록만 남긴다(7일 간격).
create or replace function public.legal_hold_notify_reviews_due() returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_count integer := 0; r record;
begin
  perform assert_admin_or_service_role();
  for r in select id, set_by, review_by, subject_type from legal_holds
           where released_at is null and review_by <= current_date
             and (last_review_notice_at is null or last_review_notice_at < now() - interval '7 days') loop
    insert into notifications (recipient_id, text)
    values (r.set_by, 'Legal hold review is due (' || r.subject_type || ', review date ' || r.review_by || '). Extend or release it; it is NOT released automatically.');
    update legal_holds set last_review_notice_at = now() where id = r.id;
    insert into legal_hold_events (hold_id, event_type, review_by, note) values (r.id, 'review_notice', r.review_by, 'review due notice');
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
revoke all on function public.legal_hold_notify_reviews_due() from public, anon, authenticated;
grant execute on function public.legal_hold_notify_reviews_due() to service_role;

-- ---------------------------------------------------------------------------
-- 2) 보존 정책 레지스트리(기준표). 향후 녹화 등 새 산출물은 여기에 행을 추가해 같은 일정에 꽂는다.
create table retention_policies (
  class_key text primary key,
  description text not null,
  tables text[] not null default '{}',
  start_event text not null,
  period_months integer,
  basis text not null check (basis in ('operating_standard','statutory_minimum','statutory_to_confirm','not_applicable')),
  legal_note text,
  automation text not null check (automation in ('implemented','queue_implemented','planned','manual_only','no_feature')),
  deletion_automated boolean not null default false
);
alter table retention_policies enable row level security;
create policy "관리자 조회" on retention_policies for select using (is_admin());

insert into retention_policies (class_key, description, tables, start_event, period_months, basis, legal_note, automation, deletion_automated) values
 ('notifications','알림','{notifications}','created_at',3,'operating_standard',null,'implemented',true),
 ('security_access_logs','보안·접근 로그','{session_access_events}','occurred_at',12,'operating_standard','document_access_events는 append-only라 제외(별도 결정)','implemented',true),
 ('consultation_pii','상담 요청·상담·잠재고객 개인정보','{consult_requests,consultations,prospect_contacts}','상담 종료/마지막 갱신',24,'operating_standard',null,'implemented',true),
 ('chat_thread_messages','수업 스레드·교사-관리자 메시지','{subject_thread_messages,teacher_admin_messages}','스레드 archived / 문의 closed',24,'operating_standard',null,'implemented',true),
 ('family_messages','보호자-관리자 메시지','{household_messages}','건별 마지막 메시지(상담 건 종료일이 있으면 그 날짜)',24,'operating_standard','건(case) 단위 묶음 기준 미구현 — 설계 문서 참조','planned',false),
 ('lesson_ai_artifacts','Smart Notes 문서·전사(Drive)','{session_smart_notes,smart_notes_generation_events}','각 수업 종료일(actual_end_at)',12,'operating_standard','수강 지속으로 연장하지 않음. Drive 삭제 큐 경유','queue_implemented',true),
 ('lesson_recordings','수업 영상·음성 녹화','{}','각 수업 종료일',12,'not_applicable','현재 녹화 기능 없음 — 기능 추가 시 같은 큐에 연결','no_feature',false),
 ('tutoring_attendance_learning','과외 출결·예약·수업권 내역·학습 이력','{}','학생 과외 서비스 종료일',36,'operating_standard','활성 수강 여부는 학습이력 판단에만 고려, 오래된 수업자료는 면제하지 않음','planned',false),
 ('free_member_learning','무료회원 학습 이력','{mock_exam_attempts,vocab_words,vocab_quizzes,material_reading_positions,student_learning_events}','실제 학습 활동 마지막 시각(student_last_learning_activity)',36,'operating_standard','로그인·하트비트(last_active_at)·자동 알림은 갱신 사유가 아님','planned',false),
 ('contracts_consents_pricing','계약·가격·동의','{}','계약 종료일',84,'operating_standard','회사 운영 기준. 법정 최소기간은 별도 확인','manual_only',false),
 ('payments_refunds_credit_ledger','결제·환불·수업권 원장','{}','거래 종료일',84,'operating_standard','세무·회계 기록 보존기간은 별도 확인','manual_only',false),
 ('teacher_payout_records','선생님·컨설턴트 정산 기록(해외 송금 포함)','{}','지급 완료일/계약 종료일',84,'statutory_to_confirm','해외 송금 기록은 BSA/세무 등 별도 기간 가능 — 법무 확인','manual_only',false),
 ('staff_personnel_records','직원·선생님 인사 기록','{}','퇴직(계약 종료)일',36,'statutory_to_confirm','California 인사 기록 퇴직 후 최소 3년(법무 확인). 회사 7년은 운영 기준','manual_only',false),
 ('staff_payroll_time_records','급여·근무시간·출결 기록','{}','지급일/근무일',36,'statutory_to_confirm','California 급여·시간 기록 최소 3년, 연방 세무 고용기록 최소 4년(법무 확인)','manual_only',false),
 ('legal_hold','법적 보류','{legal_holds}','해제 시까지',null,'not_applicable','review_by 필수, 자동 해제 없음','implemented',false);

-- ---------------------------------------------------------------------------
-- 3) 무료회원 마지막 "실제 학습" 활동(로그인·하트비트·알림 제외).
create or replace function public.student_last_learning_activity(p_student_id uuid) returns timestamptz
language sql stable security definer set search_path = public, pg_temp as $$
  select greatest(
    (select max(coalesce(submitted_at, started_at)) from mock_exam_attempts where student_id = p_student_id),
    (select max(created_at) from vocab_words where student_id = p_student_id),
    (select max(submitted_at) from vocab_quizzes where owner_id = p_student_id),
    (select max(updated_at) from material_reading_positions where user_id = p_student_id),
    (select max(created_at) from student_learning_events where student_id = p_student_id)
  );
$$;
revoke execute on function public.student_last_learning_activity(uuid) from public, anon, authenticated;
grant execute on function public.student_last_learning_activity(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 4) Drive 삭제 큐 + Smart Notes 보존.
create table retention_deletion_targets (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  source_table text not null,
  source_id text not null,
  session_id uuid,
  drive_file_id text not null,
  due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','deleted','failed')),
  attempts integer not null default 0,
  last_error text,
  next_attempt_at timestamptz not null default now(),
  deleted_at timestamptz,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source_table, source_id, drive_file_id)
);
create index on retention_deletion_targets (status, next_attempt_at);
alter table retention_deletion_targets enable row level security;
create policy "관리자 조회" on retention_deletion_targets for select using (is_admin());

-- 수업 종료일 + 1년이 지난 Smart Notes/전사 파일을 큐에 기록한다. DB 행은 건드리지 않는다(연결 정보 보존).
create or replace function public.retention_enqueue_expired_smart_notes(p_limit integer default 500, p_dry_run boolean default false)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v_count integer := 0; v_ev integer := 0;
begin
  perform assert_admin_or_service_role();
  create temp table if not exists _rt_cand (src text, sid text, session_id uuid, fid text, due timestamptz) on commit drop;
  truncate _rt_cand;
  insert into _rt_cand
  select 'session_smart_notes', n.session_id::text, n.session_id, n.drive_file_id, s.actual_end_at + interval '1 year'
    from session_smart_notes n join sessions s on s.id = n.session_id
    left join subject_enrollments se on se.id = s.subject_enrollment_id
   where s.actual_end_at < now() - interval '1 year'
     and not has_active_legal_hold('session', s.id)
     and not has_active_legal_hold('enrollment', s.subject_enrollment_id)
     and not has_active_legal_hold('student', se.child_id)
  union all
  select 'smart_notes_generation_events', e.id::text, e.session_id, e.drive_file_id,
         coalesce(s.actual_end_at, e.received_at) + interval '1 year'
    from smart_notes_generation_events e left join sessions s on s.id = e.session_id
    left join subject_enrollments se on se.id = s.subject_enrollment_id
   where e.drive_file_id is not null
     and coalesce(s.actual_end_at, e.received_at) < now() - interval '1 year'
     and (e.session_id is null or (not has_active_legal_hold('session', s.id)
          and not has_active_legal_hold('enrollment', s.subject_enrollment_id)
          and not has_active_legal_hold('student', se.child_id)))
     and not has_active_legal_hold('global', null);
  if p_dry_run then
    select count(*) into v_count from (
      select 1 from _rt_cand c where not exists (select 1 from retention_deletion_targets t where t.source_table = c.src and t.source_id = c.sid and t.drive_file_id = c.fid) limit p_limit) x;
  else
    with ins as (
      insert into retention_deletion_targets (category, source_table, source_id, session_id, drive_file_id, due_at)
      select 'lesson_ai_artifacts', src, sid, session_id, fid, due from _rt_cand limit p_limit
      on conflict do nothing returning id)
    select count(*) into v_count from ins;
  end if;
  insert into retention_batch_runs (category, table_name, action, target_count, succeeded_count, dry_run)
  values ('smart_notes_1y_enqueue', 'retention_deletion_targets', 'enqueue', v_count, v_count, p_dry_run);
  return v_count;
exception when others then
  insert into retention_batch_runs (category, table_name, action, target_count, succeeded_count, failed, error_message, dry_run)
  values ('smart_notes_1y_enqueue', 'retention_deletion_targets', 'enqueue', 0, 0, true, sqlerrm, p_dry_run);
  raise;
end $$;

-- 워커가 가져갈 대상. hold가 생긴 건은 건너뛴다(상태 변경 없음 — 해제되면 다시 대상).
create or replace function public.retention_claim_deletion_targets(p_limit integer default 50)
returns table (id uuid, drive_file_id text, attempts integer)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform assert_admin_or_service_role();
  return query
  with c as (
    select t.id from retention_deletion_targets t
    left join sessions s on s.id = t.session_id
    left join subject_enrollments se on se.id = s.subject_enrollment_id
    where t.status in ('pending','failed') and t.next_attempt_at <= now()
      and not has_active_legal_hold('global', null)
      and (t.session_id is null or (not has_active_legal_hold('session', t.session_id)
           and not has_active_legal_hold('enrollment', s.subject_enrollment_id)
           and not has_active_legal_hold('student', se.child_id)))
    order by t.next_attempt_at limit p_limit for update of t skip locked)
  update retention_deletion_targets t set attempts = t.attempts + 1
    from c where t.id = c.id returning t.id, t.drive_file_id, t.attempts;
end $$;

create or replace function public.retention_mark_deletion_result(p_id uuid, p_ok boolean, p_error text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform assert_admin_or_service_role();
  if p_ok then
    update retention_deletion_targets set status = 'deleted', deleted_at = now(), last_error = null where id = p_id;
  else
    -- 실패는 재시도 가능 상태로 남기고(관리자 화면에서 failed 조회) 지수 백오프.
    update retention_deletion_targets set status = 'failed', last_error = left(coalesce(p_error, 'unknown'), 500),
      next_attempt_at = now() + least(interval '7 days', interval '1 hour' * power(2, least(attempts, 8)))
     where id = p_id;
  end if;
end $$;

-- Drive 파일 삭제가 성공한 뒤에만 DB 연결·원문을 정리한다.
create or replace function public.retention_finalize_deleted_smart_notes(p_limit integer default 500, p_dry_run boolean default false)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v_count integer := 0; r record;
begin
  perform assert_admin_or_service_role();
  for r in select * from retention_deletion_targets
           where status = 'deleted' and finalized_at is null limit p_limit loop
    if not p_dry_run then
      if r.source_table = 'session_smart_notes' then
        delete from session_smart_notes where session_id = r.source_id::uuid and drive_file_id = r.drive_file_id;
      else
        update smart_notes_generation_events set raw_payload = '{}', drive_file_id = null, google_meeting_code = null,
               google_conference_record_name = null where id = r.source_id::uuid;
      end if;
      update retention_deletion_targets set finalized_at = now() where id = r.id;
    end if;
    v_count := v_count + 1;
  end loop;
  insert into retention_batch_runs (category, table_name, action, target_count, succeeded_count, dry_run)
  values ('smart_notes_1y_finalize', 'session_smart_notes', 'delete', v_count, v_count, p_dry_run);
  return v_count;
end $$;
revoke all on function public.retention_enqueue_expired_smart_notes(integer, boolean) from public, anon, authenticated;
revoke all on function public.retention_claim_deletion_targets(integer) from public, anon, authenticated;
revoke all on function public.retention_mark_deletion_result(uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.retention_finalize_deleted_smart_notes(integer, boolean) from public, anon, authenticated;
grant execute on function public.retention_enqueue_expired_smart_notes(integer, boolean) to service_role;
grant execute on function public.retention_claim_deletion_targets(integer) to service_role;
grant execute on function public.retention_mark_deletion_result(uuid, boolean, text) to service_role;
grant execute on function public.retention_finalize_deleted_smart_notes(integer, boolean) to service_role;
