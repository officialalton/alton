-- 배치 2-1 corrective — bypass_status_protect GUC를 status_transition_tokens
-- 1회용 토큰으로 교체 (docs/superpowers/plans/2026-09-08-bypass-guc-security-cleanup.md
-- "배치 2 상세 실행 계획 > 배치 2-1" 참고).
--
-- 대상: protect_account_status() 트리거(students/teachers/parents.status를
-- 보호), transition_account_status(), merge_accounts() — 이 항목의 실제
-- 호출자는 이 2개 함수뿐이다(recomplete_session()은 bypass_reconciliation_task_lock을
-- 쓰며 이 항목의 대상이 아니다 — 그 함수는 이 마이그레이션에서 손대지 않는다).
--
-- action 값은 'status_transition' 단일 값을 쓴다 — 두 호출자 모두 전이 종류가
-- 하나뿐이고 서로 다른 대상 테이블(students/teachers/parents)이라
-- table_name 컬럼만으로 충분히 구분된다.
--
-- 토큰 발급 단위(merge_accounts()): 이 함수는 한 호출당 병합 대상(merged_id)
-- 역할별 단일 테이블의 단일 행만 'closed'로 UPDATE한다(생존 계정의 status는
-- 바뀌지 않는다) — 따라서 "행당 1개 토큰" 원칙과 "호출당 1개 토큰"이 이
-- 함수에서는 정확히 같은 것이 된다. 별도 결정이 필요한 다중 행 케이스는
-- 없다.
--
-- 배치 1 corrective(20261255000000)와 동일한 두 규칙을 처음부터 적용한다:
-- (a) status_transition_tokens 참조는 반드시 public.status_transition_tokens로
--     완전히 스키마 한정한다(unqualified 참조는 세션 로컬 temp table로 가로채기
--     당할 수 있다 — 배치 1에서 발견된 취약점과 동일 패턴).
-- (b) 두 함수(transition_account_status/merge_accounts)의 search_path를
--     'public, pg_temp'로 명시 고정한다.
-- protect_account_status() 트리거 함수도 토큰 테이블을 쿼리하므로 동일 규칙을
-- 적용한다.

-- ---------------------------------------------------------------------------
-- protect_account_status(): GUC 분기를 완전히 제거하고, status_transition_tokens에
-- 일치하는 미소비 토큰이 있는지만 확인한다. consume_status_transition_token()
-- 헬퍼(배치 1에서 이미 완전 스키마 한정 + search_path 고정 완료)를 그대로
-- 재사용한다.
-- ---------------------------------------------------------------------------
create or replace function public.protect_account_status()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status is distinct from old.status
     and not public.consume_status_transition_token(tg_table_name, new.id, 'status_transition') then
    raise exception '계정 상태(status)는 transition_account_status()를 통해서만 변경할 수 있습니다.';
  end if;
  return new;
end;
$$;
revoke execute on function public.protect_account_status() from public, anon, authenticated, service_role;

comment on function public.protect_account_status() is
  '계정 상태(status) 보호 트리거. (corrective) GUC(app.bypass_status_protect)
  분기를 제거하고 status_transition_tokens 1회용 토큰 확인/소비로 대체했다
  — consume_status_transition_token()이 public.status_transition_tokens로
  완전히 스키마 한정되어 있고 search_path가 public, pg_temp로 고정되어 있으므로
  temp table 가로채기가 통하지 않는다.';

-- ---------------------------------------------------------------------------
-- transition_account_status(): GUC set_config() 호출을 제거하고, 상태 UPDATE
-- 직전에 토큰을 인라인 INSERT한다. 그 외 로직(게이트/유효 전이 목록/체크리스트
-- 검사/감사 이력)은 20260908000000_r2_teacher_reactivation_gate_fix.sql의
-- 최신 버전과 완전히 동일하다.
-- ---------------------------------------------------------------------------
create or replace function public.transition_account_status(p_profile_id uuid, p_new_status text, p_reason text default null)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_role profile_role;
  v_current text;
  v_valid boolean;
  v_checklist record;
  v_missing text[] := array[]::text[];
begin
  if not is_admin() then
    raise exception '계정 상태 전환은 관리자만 할 수 있습니다.';
  end if;

  select role into v_role from profiles where id = p_profile_id;
  if v_role is null then
    raise exception '해당 프로필(%)을 찾을 수 없습니다.', p_profile_id;
  end if;
  if v_role = 'admin' then
    raise exception '관리자 계정은 이 함수의 대상이 아닙니다.';
  end if;
  if v_role not in ('student', 'teacher', 'parent') then
    raise exception '지원하지 않는 역할입니다: %', v_role;
  end if;

  v_current := get_account_status(p_profile_id);

  v_valid := (v_current, p_new_status) in (
    ('pending', 'active'),
    ('pending', 'inactive'),
    ('active', 'suspended'),
    ('suspended', 'active'),
    ('active', 'closure_pending'),
    ('suspended', 'closure_pending'),
    ('closure_pending', 'closed'),
    ('active', 'inactive'),
    ('suspended', 'inactive'),
    ('inactive', 'active')
  );

  if not v_valid then
    raise exception '허용되지 않는 상태 전이입니다: % → %', v_current, p_new_status;
  end if;

  if v_role = 'student' and p_new_status = 'active' and is_under_13(p_profile_id) and not has_valid_guardian_consent(p_profile_id) then
    raise exception '13세 미만 학생은 유효한 보호자 동의 없이 active로 전환할 수 없습니다.';
  end if;

  if v_role = 'teacher' and p_new_status = 'active' then
    for v_checklist in select * from get_teacher_activation_checklist(p_profile_id) loop
      if not v_checklist.satisfied then
        v_missing := array_append(v_missing, v_checklist.condition);
      end if;
    end loop;
    if array_length(v_missing, 1) > 0 then
      raise exception '선생님 활성화 선행조건이 충족되지 않았습니다: %', array_to_string(v_missing, ', ');
    end if;
  end if;

  if v_role = 'student' then
    insert into public.status_transition_tokens (table_name, row_id, action) values ('students', p_profile_id, 'status_transition');
    update students set status = p_new_status::student_status where id = p_profile_id;
  elsif v_role = 'teacher' then
    insert into public.status_transition_tokens (table_name, row_id, action) values ('teachers', p_profile_id, 'status_transition');
    update teachers set status = p_new_status::teacher_status where id = p_profile_id;
  elsif v_role = 'parent' then
    insert into public.status_transition_tokens (table_name, row_id, action) values ('parents', p_profile_id, 'status_transition');
    update parents set status = p_new_status::parent_status where id = p_profile_id;
  end if;

  insert into account_status_events (profile_id, previous_status, new_status, changed_by, reason)
  values (p_profile_id, v_current, p_new_status, auth.uid(), p_reason);
end;
$$;

comment on function public.transition_account_status(uuid, text, text) is
  '계정 상태 전환의 유일한 정상 경로. (corrective) 상태 UPDATE 직전
  status_transition_tokens에 1회용 토큰을 인라인 INSERT한다(action =
  ''status_transition'') — GUC(app.bypass_status_protect) set_config() 호출
  제거. status_transition_tokens 참조를 public.status_transition_tokens로
  완전히 스키마 한정하고 search_path를 public, pg_temp로 고정했다 — temp table
  가로채기 방지.';

-- ---------------------------------------------------------------------------
-- merge_accounts(): 최신 버전(20260928000000_r6_sessions_cutover.sql:151-338,
-- sessions_v3 → sessions 참조 갱신판)과 완전히 동일한 로직이되, 병합 대상 계정을
-- closed로 전환하는 마지막 UPDATE 직전 GUC 대신 토큰을 인라인 INSERT한다.
-- ---------------------------------------------------------------------------
create or replace function public.merge_accounts(p_survivor_id uuid, p_merged_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
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

  update sessions set teacher_id = p_survivor_id where teacher_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('sessions', v_count);

  update supervisor_capabilities set profile_id = p_survivor_id where profile_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('supervisor_capabilities', v_count);

  update teacher_assignments set teacher_id = p_survivor_id where teacher_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('teacher_assignments', v_count);

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

  if v_merged_role = 'student' then
    insert into public.status_transition_tokens (table_name, row_id, action) values ('students', p_merged_id, 'status_transition');
    update students set status = 'closed' where id = p_merged_id;
  elsif v_merged_role = 'teacher' then
    insert into public.status_transition_tokens (table_name, row_id, action) values ('teachers', p_merged_id, 'status_transition');
    update teachers set status = 'closed' where id = p_merged_id;
  elsif v_merged_role = 'parent' then
    insert into public.status_transition_tokens (table_name, row_id, action) values ('parents', p_merged_id, 'status_transition');
    update parents set status = 'closed' where id = p_merged_id;
  end if;

  insert into account_status_events (profile_id, previous_status, new_status, changed_by, reason)
  values (p_merged_id, v_merged_status, 'closed', auth.uid(), coalesce('merged: ' || p_reason, 'merged'));

  insert into account_merges (survivor_id, merged_id, merged_by, reason, affected_tables_summary)
  values (p_survivor_id, p_merged_id, auth.uid(), p_reason, v_summary);
end;
$$;

comment on function public.merge_accounts(uuid, uuid, text) is
  '계정 병합의 유일한 정상 경로. (corrective) 병합 대상 계정을 closed로
  전환하는 마지막 UPDATE 직전 status_transition_tokens에 1회용 토큰을 인라인
  INSERT한다(action = ''status_transition'') — GUC(app.bypass_status_protect)
  set_config() 호출 제거. 이 함수는 호출당 병합 대상 1개 행만 상태를
  바꾸므로 "행당 1개 토큰"과 "호출당 1개 토큰"이 동일하다.
  status_transition_tokens 참조를 public.status_transition_tokens로 완전히
  스키마 한정하고 search_path를 public, pg_temp로 고정했다 — temp table
  가로채기 방지.';
