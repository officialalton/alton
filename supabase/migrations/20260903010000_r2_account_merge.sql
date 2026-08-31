-- R2 Task 5 — 계정 병합(중복 계정 정리 전용)
--
-- 범위: 동일인이 중복으로 가진 계정을 하나로 합치는 기능만 다룬다. 일반적인
-- 서비스 중단(inactive)·장기 복귀·자료 보관 자동화는 이 마이그레이션과
-- 무관하다(master-roadmap-v3.md R12로 이관).
--
-- 원칙(product-architecture-v3.md §4.19):
--   * "현재 관계·소유권"을 나타내는 필드만 생존 계정으로 재배정한다.
--   * "당시 누가 이 작업을 수행했는가"를 기록하는 감사·행위자 필드
--     (created_by/changed_by/actor_id 등)는 실제 역사적 사실이 왜곡되지
--     않도록 원본 UUID를 그대로 둔다.
--   * 병합 원본은 즉시 closed로 전환(일반 closure_pending 경유 없음).
--   * 병합 원본의 PII는 30일 후에만, 그것도 관리자가 명시적으로 호출한
--     anonymize_merged_account()로만 스크럽한다. inactive 계정에는 이 두
--     함수 다 적용할 수 없다.

create table account_merges (
  id uuid primary key default gen_random_uuid(),
  survivor_id uuid not null references profiles (id),
  merged_id uuid not null references profiles (id),
  merged_by uuid not null references profiles (id),
  merged_at timestamptz not null default now(),
  reason text,
  affected_tables_summary jsonb not null default '{}'::jsonb,
  anonymized_at timestamptz,
  anonymized_by uuid references profiles (id),
  -- 한 계정은 병합 원본으로 한 번만 등장할 수 있다 — 이미 병합된 계정을
  -- 다시 병합 대상으로 지정하는 걸 DB 레벨에서도 막는 최종 방어선
  -- (merge_accounts() 안의 명시적 확인과 별개로).
  unique (merged_id)
);
create index on account_merges (survivor_id);

alter table account_merges enable row level security;
create policy "관리자만 조회" on account_merges for select using (is_admin());
-- 쓰기는 merge_accounts()/anonymize_merged_account()(SECURITY DEFINER)를
-- 통해서만 — 이 테이블에 대한 INSERT/UPDATE RLS 정책은 만들지 않는다
-- (authenticated/anon은 기본 거부, service_role의 직접 쓰기는 이 병합
-- 기능 자체가 반드시 is_admin() JWT 세션으로 호출돼야 하므로 애초에
-- 정상 경로가 아니다 — account_invites처럼 별도 freeze 트리거는 두지
-- 않는다. 병합 이력은 자주 바뀌지 않고, 직접 쓰기를 막을 이유가
-- guardian_students만큼 강하지 않기 때문).

create or replace function public.merge_accounts(
  p_survivor_id uuid,
  p_merged_id uuid,
  p_reason text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_first uuid;
  v_second uuid;
  v_survivor_role profile_role;
  v_merged_role profile_role;
  v_merged_status text;
  v_summary jsonb := '{}'::jsonb;
  v_count int;
begin
  if not is_admin() then
    raise exception '관리자만 계정을 병합할 수 있습니다.';
  end if;
  if p_survivor_id is null or p_merged_id is null then
    raise exception 'survivor_id/merged_id는 필수입니다.';
  end if;
  if p_survivor_id = p_merged_id then
    raise exception '같은 계정을 병합할 수 없습니다.';
  end if;

  -- 동시 병합 방지: 항상 작은 id부터 잠가 교착을 피한다. 두 계정 다
  -- 잠근 뒤에야 아래 상태 확인을 하므로, 동시에 들어온 두 병합 시도 중
  -- 하나는 여기서 대기했다가 먼저 커밋된 트랜잭션의 결과(예: 이미
  -- merged_id가 소진됨)를 보고 뒤에서 거부된다.
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

  -- inactive 계정은 장기 중단 상태이지 "중복 계정"이 아니므로 병합
  -- 대상이 될 수 없다(product-architecture-v3.md §4.19).
  v_merged_status := get_account_status(p_merged_id);
  if v_merged_status = 'inactive' then
    raise exception 'inactive 계정은 병합할 수 없습니다.';
  end if;
  if v_merged_status = 'closed' then
    raise exception '이미 closed된 계정은 병합할 수 없습니다.';
  end if;

  -- =====================================================================
  -- 소유권·관계 필드 재배정. 각 UPDATE는 해당 컬럼이 실제로 그 역할의
  -- 테이블에서만 의미가 있으므로(예: student_id는 학생이 아닌 계정을
  -- 병합할 때는 자연히 0행), 역할별로 분기하지 않고 전부 순서대로
  -- 실행해도 안전하다. "당시 누가 이 작업을 했는가"를 기록하는
  -- created_by/changed_by/actor_id류 컬럼(teacher_rate_history.created_by,
  -- account_status_events.changed_by/profile_id, session_status_events.
  -- actor_profile_id, sessions_v3.final_actor_id, teacher_assignments.
  -- changed_by, supervisor_capabilities.granted_by, credit_transactions.
  -- admin_id, problems.created_by, curriculum_doc_versions.created_by,
  -- account_invites.invited_by/target_profile_id, account_invite_events.
  -- actor_id, teacher_payouts.approved_by)는 의도적으로 여기서 건드리지
  -- 않는다 — 실제 역사적 사실이 왜곡되지 않도록 원본 UUID를 유지한다.
  --
  -- guardian_students(parent_id/student_id)는 R2 Task 3에서 동결됐고
  -- 트리거가 모든 쓰기를 거부하므로 애초에 갱신 대상이 아니다(관계
  -- 원본은 household_members로 완전히 대체됨). consult_requests의
  -- converted_parent_id/converted_student_id는 "어느 상담이 이 계정으로
  -- 전환됐는가"라는 1회성 온보딩 이력이라 병합과 무관하게 원본을 유지한다.
  --
  -- 이 목록은 마이그레이션 작성 시점(R2)의 스키마 기준이다 — R3~R10에서
  -- 새 테이블이 profiles/students/teachers/parents를 참조하게 되면 이
  -- 함수도 함께 갱신해야 한다.

  -- household_members: 생존 계정이 같은 household에 이미 멤버라면 중복
  -- 행을 만들지 않도록 병합 대상 쪽을 먼저 정리한다.
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

  update contracts_v3 set child_id = p_survivor_id where child_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('contracts_v3', v_count);

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

  update sessions_v3 set teacher_id = p_survivor_id where teacher_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('sessions_v3', v_count);

  update supervisor_capabilities set profile_id = p_survivor_id where profile_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('supervisor_capabilities', v_count);

  update teacher_assignments set teacher_id = p_survivor_id where teacher_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('teacher_assignments', v_count);

  -- teacher_rate_history.teacher_id는 의도적으로 재배정하지 않는다 — R1의
  -- protect_teacher_rate_history() 트리거가 teacher_id를 (심지어 자기 자신의
  -- bypass 플래그로도) 불변으로 취급한다(실제 실행 중 이 트리거에 막혀 발견).
  -- "이 시급 이력이 누구 것이었는가"는 당시의 역사적 사실이고, 생존 계정은
  -- 이미 자기 자신의 유효한 현재 시급 이력을 갖고 있으므로 병합 대상의
  -- 이력을 굳이 이전할 필요가 없다 — created_by류와 같은 취급.

  -- 레거시(v1) 테이블 — R3~R6 cutover 전까지 여전히 실사용 중이므로 함께 갱신.
  update contracts set parent_id = p_survivor_id where parent_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('contracts_parent', v_count);
  update contracts set student_id = p_survivor_id where student_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('contracts_student', v_count);

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

  -- 병합 원본은 일반 closure_pending 경유 없이 즉시 closed로 전환한다.
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
$$;
revoke execute on function public.merge_accounts(uuid, uuid, text) from public;
grant execute on function public.merge_accounts(uuid, uuid, text) to authenticated;

-- =========================================================================
-- anonymize_merged_account — 병합 원본 전용, 30일 유예 후 PII 비가역 스크럽.
-- inactive 계정에는 절대 적용하지 않는다(애초에 병합 원본만 대상으로
-- account_merges에 있는지부터 확인).
-- =========================================================================
create or replace function public.anonymize_merged_account(p_profile_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_merge account_merges%rowtype;
  v_role profile_role;
  v_status text;
begin
  if not is_admin() then
    raise exception '관리자만 실행할 수 있습니다.';
  end if;

  select * into v_merge from account_merges where merged_id = p_profile_id;
  if not found then
    raise exception '병합 원본 계정이 아닙니다 — anonymize_merged_account()는 merge_accounts()로 병합된 계정에만 적용할 수 있습니다.';
  end if;

  select role into v_role from profiles where id = p_profile_id;
  if v_role is null then
    raise exception '존재하지 않는 계정입니다.';
  end if;

  v_status := get_account_status(p_profile_id);
  if v_status = 'inactive' then
    raise exception 'inactive 계정은 익명화할 수 없습니다.';
  end if;

  if v_merge.merged_at > now() - interval '30 days' then
    raise exception '병합 후 30일이 지나야 익명화할 수 있습니다(오류 확인용 복구 유예기간).';
  end if;

  -- 멱등: 이미 익명화됐으면 조용히 반환(재실행해도 안전, 에러 아님).
  if v_merge.anonymized_at is not null then
    return;
  end if;

  update profiles
  set name = 'Deleted User',
      phone = null,
      date_of_birth = null
  where id = p_profile_id;

  if v_role = 'parent' then
    update parents
    set referral_code = null, location = null
    where id = p_profile_id;
  elsif v_role = 'teacher' then
    -- (Task 7에서 personal_contact_email/workspace_recovery_email/
    -- personal_phone 컬럼이 추가되면 이 함수도 함께 스크럽하도록 갱신한다.)
    update teachers
    set school = null, bio = null, calendly_scheduling_url = null
    where id = p_profile_id;
  elsif v_role = 'student' then
    update students
    set grade = null
    where id = p_profile_id;
  end if;

  -- 인증 계정·세션·복구정보 제거는 이 함수(순수 SQL, service_role 미사용)가
  -- 아니라 이 함수를 호출하는 Node 서버 액션이 admin.auth.admin.deleteUser()로
  -- 처리한다(auth.users는 GoTrue가 관리하므로 관리자 API를 거치는 게 정석).
  -- 여기서는 ALTON DB 쪽 PII만 스크럽한다.

  update account_merges
  set anonymized_at = now(), anonymized_by = auth.uid()
  where merged_id = p_profile_id;
end;
$$;
revoke execute on function public.anonymize_merged_account(uuid) from public;
grant execute on function public.anonymize_merged_account(uuid) to authenticated;
