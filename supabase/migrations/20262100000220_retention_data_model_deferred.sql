-- 2026-10-07 보존 후속(데이터 모델·읽기 전용만, 추가 전용). 삭제·익명화·자동화 없음. 배치/cron 스위치 닫힘 유지.
-- (a) 가족 메시지 "건" 키는 이미 household_messages.inquiry_id -> household_inquiries(status, closed_at, last_message_at) 로 존재한다
--     (설계 문서의 inquiry_case_id 신설은 중복이라 하지 않는다). 보존 후보 조회만 읽기 전용 함수로 제공한다.
-- (b) 레거시 채팅 사용 현황 읽기 전용 리포트. (c) 무료회원 삭제·비식별화 범위(데이터). (d) 아동 조기 삭제 요청 데이터 모델·RPC.
-- 롤백: 새 함수·테이블 drop.

-- (a) 건 단위 2년 보존 후보(읽기 전용). 건 종료 = closed 이면 closed_at, 아니면 last_message_at. hold 대상은 held=true.
create or replace function public.household_message_case_retention_report()
returns table (inquiry_id uuid, household_id uuid, case_status text, case_basis_at timestamptz, message_count bigint, eligible_after timestamptz, held boolean, eligible boolean)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform assert_admin_or_service_role();
  return query
  select hi.id, hi.household_id, hi.status,
         case when hi.status = 'closed' then coalesce(hi.closed_at, hi.last_message_at) else hi.last_message_at end,
         (select count(*) from household_messages m where m.inquiry_id = hi.id),
         (case when hi.status = 'closed' then coalesce(hi.closed_at, hi.last_message_at) else hi.last_message_at end) + interval '2 years',
         has_active_legal_hold('household', hi.household_id),
         ((case when hi.status = 'closed' then coalesce(hi.closed_at, hi.last_message_at) else hi.last_message_at end) + interval '2 years' < now()
           and not has_active_legal_hold('household', hi.household_id))
    from household_inquiries hi;
end $$;
revoke all on function public.household_message_case_retention_report() from public, anon, authenticated;
grant execute on function public.household_message_case_retention_report() to service_role;

-- 건에 묶이지 않은 메시지 수(백필 필요 여부 확인용).
create or replace function public.household_messages_without_case_count() returns bigint
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform assert_admin_or_service_role();
  return (select count(*) from household_messages where inquiry_id is null);
end $$;
revoke all on function public.household_messages_without_case_count() from public, anon, authenticated;
grant execute on function public.household_messages_without_case_count() to service_role;

update retention_policies
   set legal_note = '건 키는 기존 household_messages.inquiry_id(household_inquiries). 종료일=closed_at(없으면 last_message_at)+2년. 조회 전용 household_message_case_retention_report() — 삭제 자동화 없음, inquiry_id 없는 메시지는 별도 확인'
 where class_key = 'family_messages';

-- (b) 레거시 채팅 사용 현황(읽기 전용).
create or replace function public.legacy_chat_usage_report() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform assert_admin_or_service_role();
  return jsonb_build_object(
    'chat_threads', (select count(*) from chat_threads),
    'chat_messages', (select count(*) from chat_messages),
    'chat_messages_last_write', (select max(created_at) from chat_messages),
    'parent_requests', (select count(*) from parent_requests),
    'parent_requests_last_write', (select max(created_at) from parent_requests),
    'subject_thread_messages', (select count(*) from subject_thread_messages),
    'subject_thread_messages_last_write', (select max(created_at) from subject_thread_messages),
    'note', 'chat_* 는 app/student/ChatPanel.tsx 등이 읽고 쓰는 레거시 경로 — 폐기·이관은 별도 결정(보류 설계 문서 §2)'
  );
end $$;
revoke all on function public.legacy_chat_usage_report() from public, anon, authenticated;
grant execute on function public.legacy_chat_usage_report() to service_role;

-- (c) 무료회원 학습 자료 범위(데이터). 삭제 대상 자료군과 처리 방식. 실행 로직은 없다.
create table retention_free_member_scope (
  data_class text primary key,
  tables text[] not null,
  action text not null check (action in ('delete','anonymize','retain_separate_rule','owner_decision')),
  note text
);
alter table retention_free_member_scope enable row level security;
create policy "관리자 조회" on retention_free_member_scope for select using (is_admin());
insert into retention_free_member_scope (data_class, tables, action, note) values
 ('mock_exam_attempts_answers', '{mock_exam_attempts,mock_exam_answers}', 'delete', '개인 학습 기록. 문항 통계는 비식별 집계만 유지'),
 ('mistake_notebook', '{mock_exam_answers}', 'delete', 'saved_to_practice 답안, 위 답안과 함께'),
 ('vocabulary', '{vocab_words,vocab_quizzes}', 'delete', null),
 ('material_reading_and_events', '{material_reading_positions,student_learning_events,student_activity_days}', 'delete', null),
 ('student_profile', '{students,profiles}', 'owner_decision', '장기 미활동만으로 자동 익명화 금지(§4.13). 폐쇄 요청 시 아동 삭제 요청 절차'),
 ('consultation_contract_payment', '{consultations,contracts}', 'retain_separate_rule', '상담 2년, 계약·결제 7년 — 학습 이력 삭제와 별개');

-- (d) 아동 조기 삭제 요청 — 데이터 모델과 권한 RPC만(삭제 실행 없음).
create table child_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references profiles (id),
  household_id uuid not null references households (id),
  requested_by uuid not null references profiles (id),
  requested_at timestamptz not null default now(),
  target_scope text[] not null check (target_scope <@ array['tutoring','free_learning','messages','lesson_materials','all'] and cardinality(target_scope) > 0),
  reason text not null check (length(trim(reason)) >= 10),
  status text not null default 'requested' check (status in ('requested','verified','processing','completed','partially_completed','rejected','cancelled')),
  verified_by uuid references profiles (id),
  verified_at timestamptz,
  decision_note text,
  -- 예외(삭제 보류): 반드시 활성 legal hold와 연결 + 사유·기간 기록
  exception_hold_id uuid references legal_holds (id),
  exception_reason text,
  exception_until date,
  exception_recorded_by uuid references profiles (id),
  check ((exception_hold_id is null) = (exception_reason is null) and (exception_hold_id is null) = (exception_until is null))
);
create index on child_deletion_requests (child_id, status);
alter table child_deletion_requests enable row level security;
create policy "관리자 조회" on child_deletion_requests for select using (is_admin());
create policy "보호자 본인 요청 조회" on child_deletion_requests for select using (requested_by = auth.uid());
-- household_archive_requests 와 연결·연쇄 없음: archive 요청은 이 테이블의 상태를 바꾸지 않는다.

create or replace function public.request_child_deletion(p_child_id uuid, p_household_id uuid, p_scope text[], p_reason text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if not (is_admin() or exists (select 1 from household_members hm
        where hm.household_id = p_household_id and hm.profile_id = auth.uid() and hm.role = 'guardian')) then
    raise exception '해당 가구의 보호자 또는 관리자만 삭제를 요청할 수 있습니다.';
  end if;
  if not exists (select 1 from household_members hm where hm.household_id = p_household_id and hm.profile_id = p_child_id) then
    raise exception '해당 가구에 속한 자녀가 아닙니다.';
  end if;
  insert into child_deletion_requests (child_id, household_id, requested_by, target_scope, reason)
  values (p_child_id, p_household_id, auth.uid(), p_scope, p_reason) returning id into v_id;
  perform _notify_legal_hold_holders('Child data deletion request received. Review it in the admin queue.');
  return v_id;
end $$;

create or replace function public.review_child_deletion_request(p_request_id uuid, p_verify boolean, p_note text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not is_admin() then raise exception '관리자만 처리할 수 있습니다.'; end if;
  update child_deletion_requests
     set status = case when p_verify then 'verified' else 'rejected' end,
         verified_by = auth.uid(), verified_at = now(), decision_note = p_note
   where id = p_request_id and status = 'requested';
  if not found then raise exception '처리할 수 있는 요청이 아닙니다.'; end if;
end $$;

-- 예외 기록은 legal hold 지정자만: 해당 아동(student)에 대한 활성 hold와 연결하고 사유·기간을 남긴다.
create or replace function public.record_child_deletion_exception(p_request_id uuid, p_hold_id uuid, p_reason text, p_until date)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_child uuid;
begin
  if not is_legal_hold_holder() then raise exception '지정된 legal hold 담당자만 예외를 기록할 수 있습니다.'; end if;
  if p_reason is null or length(trim(p_reason)) < 10 or p_until is null or p_until <= current_date then
    raise exception '예외에는 사유(10자 이상)와 미래의 종료 기간이 필요합니다.';
  end if;
  select child_id into v_child from child_deletion_requests where id = p_request_id;
  if not found then raise exception '요청이 없습니다.'; end if;
  if not exists (select 1 from legal_holds h where h.id = p_hold_id and h.released_at is null
                 and h.subject_type = 'student' and h.subject_id = v_child) then
    raise exception '해당 아동에 대한 활성 legal hold와 연결해야 합니다.';
  end if;
  update child_deletion_requests set exception_hold_id = p_hold_id, exception_reason = p_reason,
         exception_until = p_until, exception_recorded_by = auth.uid()
   where id = p_request_id and status in ('requested','verified','processing');
  if not found then raise exception '예외를 기록할 수 없는 상태입니다.'; end if;
end $$;
revoke execute on function public.request_child_deletion(uuid, uuid, text[], text) from public, anon;
revoke execute on function public.review_child_deletion_request(uuid, boolean, text) from public, anon;
revoke execute on function public.record_child_deletion_exception(uuid, uuid, text, date) from public, anon;
grant execute on function public.request_child_deletion(uuid, uuid, text[], text) to authenticated;
grant execute on function public.review_child_deletion_request(uuid, boolean, text) to authenticated;
grant execute on function public.record_child_deletion_exception(uuid, uuid, text, date) to authenticated;
