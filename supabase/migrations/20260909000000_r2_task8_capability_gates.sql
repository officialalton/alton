-- R2 Task 8 — 권한 모델: 관리자 전용 서버 액션에 capability 대안 경로 추가.
--
-- R0 §5.1 원칙 4(Supervisor는 역할 문자열이 아니라 capability 조합으로 권한을
-- 받는다)를 Task 4(초대)/5(계정 병합)/6(보호자 동의)/7(Workspace 프로비저닝)
-- 에서 새로 만든 관리자 전용 함수·RLS에 적용한다. `is_admin()`만 검사하던
-- 곳을 `is_admin() OR current_user_has_capability('...')`로 넓혀, role='admin'
-- 이 아니어도 해당 capability를 부여받은 운영자가 같은 작업을 할 수 있게
-- 한다 — 기존 admin 경로는 그대로 동작(회귀 없음), self-service 조건(예:
-- 본인이 보낸 초대, 본인 학생)도 그대로 보존한다.
--
-- Capability 이름(자유 텍스트, `supervisor_capabilities`에 관리자가 직접
-- 부여): manage_invites(Task 4), manage_account_merges(Task 5),
-- manage_guardian_consent(Task 6), manage_teacher_workspace(Task 7).
--
-- 범위 밖(의도적으로 건드리지 않음, 계획 문서 원칙: "기존 is_admin()만 쓰는
-- 레거시 서버 액션은 이번에 건드리지 않는다 — R12로 이관"과 동일하게 취급):
-- `transition_account_status()`/`set_teacher_rate()`(R1/Task 2 소유, Task
-- 7 액션이 간접 호출하지만 이 함수들 자체의 게이트 확장은 R12로 이관),
-- `workspace_preflight_runs`/`begin_workspace_preflight_run()`/
-- `finish_workspace_preflight_run()`(실제 Google 인프라를 직접 두드리는
-- 운영 점검 도구라 의도적으로 관리자 전용 유지), `get_teacher_activation_checklist()`
-- (원래도 `is_admin()` 자체 검사가 없고 RLS로만 보호되던 조회 함수라 앱
-- 레이어 가드 교체만으로 충분).

CREATE OR REPLACE FUNCTION public.resend_account_invite(p_invite_id uuid)
 RETURNS TABLE(invite_id uuid, raw_token text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row account_invites%rowtype;
  v_resend_count int;
  v_new_id uuid;
  v_raw_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash text := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');
begin
  select * into v_row from account_invites where id = p_invite_id for update;
  if not found then
    raise exception '존재하지 않는 초대입니다.';
  end if;
  if not (is_admin() or current_user_has_capability('manage_invites') or v_row.invited_by = auth.uid()) then
    raise exception '본인이 보낸 초대만 재발송할 수 있습니다.';
  end if;
  if v_row.status <> 'pending' then
    raise exception '대기 중(pending) 상태의 초대만 재발송할 수 있습니다(현재: %).', v_row.status;
  end if;
  if v_row.expires_at <= now() then
    -- status를 여기서 'expired'로 미리 갱신해도 바로 이어지는 RAISE EXCEPTION이
    -- 함수 전체를 롤백시켜 무의미하다 — 시간 검사만으로 재발송을 막으면 충분하고,
    -- status 컬럼 갱신은 mark_expired_invites()가 담당한다.
    raise exception '이미 만료된 초대입니다. 새로 초대해주세요.';
  end if;

  -- 24시간 내 재발송 최대 3회 — 최초 발송(sent)은 제외하고 같은 lineage(이메일+역할
  -- +household, NULL household도 안전하게 비교)의 resent 이벤트만 센다.
  select count(*) into v_resend_count
  from account_invite_events e
  join account_invites ai on ai.id = e.invite_id
  where e.event_type = 'resent'
    and e.created_at > now() - interval '24 hours'
    and ai.email_normalized = v_row.email_normalized
    and ai.role = v_row.role
    and ai.household_id is not distinct from v_row.household_id;
  if v_resend_count >= 3 then
    raise exception '24시간 내 재발송은 최대 3회까지 가능합니다.';
  end if;

  -- 이전 pending 행을 먼저 superseded로 바꿔야(email_normalized, role,
  -- household_id) 부분 unique 인덱스와 충돌 없이 새 pending 행을 넣을 수 있다.
  -- superseded_by_id는 새 행이 실제로 생긴 뒤 두 번째 UPDATE로 채운다(새 행 id를
  -- FK가 걸린 컬럼에 INSERT보다 먼저 채우면 참조 무결성 위반이 난다).
  perform set_config('app.bypass_invite_protect', 'true', true);
  update account_invites set status = 'superseded', updated_at = now() where id = v_row.id;
  perform set_config('app.bypass_invite_protect', 'false', true);

  insert into account_invites (
    email_normalized, email_original, invitee_name, invitee_grade, role, household_id, invited_by,
    token_hash, token_generation, expires_at, last_sent_at
  ) values (
    v_row.email_normalized, v_row.email_original, v_row.invitee_name, v_row.invitee_grade, v_row.role, v_row.household_id, v_row.invited_by,
    v_token_hash, v_row.token_generation + 1, now() + interval '7 days', now()
  )
  returning id into v_new_id;

  update account_invites set superseded_by_id = v_new_id where id = v_row.id;

  insert into account_invite_events (invite_id, event_type, actor_id) values (v_row.id, 'superseded', auth.uid());
  insert into account_invite_events (invite_id, event_type, actor_id) values (v_new_id, 'resent', auth.uid());

  return query select v_new_id, v_raw_token;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.revoke_account_invite(p_invite_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row account_invites%rowtype;
begin
  select * into v_row from account_invites where id = p_invite_id for update;
  if not found then
    raise exception '존재하지 않는 초대입니다.';
  end if;
  if not (is_admin() or current_user_has_capability('manage_invites') or v_row.invited_by = auth.uid()) then
    raise exception '본인이 보낸 초대만 철회할 수 있습니다.';
  end if;
  if v_row.status not in ('pending', 'manual_review') then
    raise exception 'pending 또는 manual_review 상태의 초대만 철회할 수 있습니다(현재: %).', v_row.status;
  end if;

  perform set_config('app.bypass_invite_protect', 'true', true);
  update account_invites set status = 'revoked', revoked_at = now(), updated_at = now() where id = v_row.id;
  perform set_config('app.bypass_invite_protect', 'false', true);

  insert into account_invite_events (invite_id, event_type, actor_id) values (v_row.id, 'revoked', auth.uid());
end;
$function$
;

CREATE OR REPLACE FUNCTION public.resolve_manual_review_invite(p_invite_id uuid, p_action text, p_target_profile_id uuid, p_auth_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row account_invites%rowtype;
begin
  if not (is_admin() or current_user_has_capability('manage_invites')) then
    raise exception '관리자만 처리할 수 있습니다.';
  end if;

  select * into v_row from account_invites where id = p_invite_id for update;
  if not found then
    raise exception '존재하지 않는 초대입니다.';
  end if;
  if v_row.status <> 'manual_review' then
    raise exception 'manual_review 상태의 초대만 처리할 수 있습니다(현재: %).', v_row.status;
  end if;

  if p_action = 'revoke' then
    perform set_config('app.bypass_invite_protect', 'true', true);
    update account_invites set status = 'revoked', revoked_at = now(), updated_at = now() where id = v_row.id;
    perform set_config('app.bypass_invite_protect', 'false', true);
    insert into account_invite_events (invite_id, event_type, actor_id) values (v_row.id, 'revoked', auth.uid());
    return;
  elsif p_action = 'link' then
    if p_target_profile_id is null or p_auth_user_id is null then
      raise exception 'link 처리에는 target_profile_id와 auth_user_id가 모두 필요합니다.';
    end if;

    if v_row.role = 'student' then
      insert into household_members (household_id, profile_id, role, is_primary)
      values (v_row.household_id, p_target_profile_id, 'child', true)
      on conflict (household_id, profile_id) do nothing;
    end if;

    perform set_config('app.bypass_invite_protect', 'true', true);
    update account_invites
    set status = 'accepted', accepted_at = now(), target_profile_id = p_target_profile_id,
        auth_user_id = p_auth_user_id, updated_at = now()
    where id = v_row.id;
    perform set_config('app.bypass_invite_protect', 'false', true);

    insert into account_invite_events (invite_id, event_type, actor_id, detail)
    values (v_row.id, 'accepted', auth.uid(), jsonb_build_object('resolved_from', 'manual_review'));
  else
    raise exception '지원하지 않는 action입니다: %(link 또는 revoke만 가능)', p_action;
  end if;
end;
$function$
;

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
$function$
;

CREATE OR REPLACE FUNCTION public.anonymize_merged_account(p_profile_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_merge account_merges%rowtype;
  v_role profile_role;
  v_status text;
begin
  if not (is_admin() or current_user_has_capability('manage_account_merges')) then
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
$function$
;

CREATE OR REPLACE FUNCTION public.teacher_rate_history_with_merged(p_teacher_id uuid)
 RETURNS TABLE(source_teacher_id uuid, amount_minor bigint, currency text, effective_from timestamp with time zone, effective_until timestamp with time zone, created_by uuid, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- 관리자는 누구든 조회 가능, 그 외에는 본인 것만 — is_admin()이 아닌 임의
  -- teacher_id 조회를 허용하면 R1 has_capability류와 같은 정보 노출 위험이
  -- 생기므로 self-only 조건을 항상 함께 건다.
  if not (is_admin() or current_user_has_capability('manage_account_merges') or auth.uid() = p_teacher_id) then
    raise exception '본인 또는 관리자만 조회할 수 있습니다.';
  end if;

  return query
  select trh.teacher_id, trh.amount_minor, trh.currency, trh.effective_from,
         trh.effective_until, trh.created_by, trh.created_at
  from teacher_rate_history trh
  where trh.teacher_id = p_teacher_id
     or trh.teacher_id in (
       select am.merged_id from account_merges am where am.survivor_id = p_teacher_id
     )
  order by trh.effective_from;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.record_manual_guardian_consent(p_student_id uuid, p_policy_version_id uuid, p_consented_by uuid, p_verification_reference text, p_notice_delivered_at timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
begin
  if not (is_admin() or current_user_has_capability('manage_guardian_consent')) then
    raise exception '관리자만 수동 동의를 기록할 수 있습니다.';
  end if;
  if p_verification_reference is null or length(trim(p_verification_reference)) = 0 then
    raise exception '수동 확인 증빙(verification_reference)이 필요합니다.';
  end if;
  if not exists (select 1 from consent_policy_versions where id = p_policy_version_id and retired_at is null) then
    raise exception '유효하지 않은 정책 버전입니다.';
  end if;

  insert into guardian_consents (
    student_id, policy_version_id, consented_by, verification_method, verification_reference, notice_delivered_at
  ) values (
    p_student_id, p_policy_version_id, p_consented_by, 'manual_admin_verification', p_verification_reference, p_notice_delivered_at
  )
  returning id into v_id;

  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.begin_teacher_workspace_provisioning(p_workspace_email text, p_personal_contact_email text, p_workspace_recovery_email text, p_personal_phone text)
 RETURNS teacher_workspace_provisioning
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row teacher_workspace_provisioning%rowtype;
  v_normalized text := lower(trim(p_workspace_email));
begin
  if not (is_admin() or current_user_has_capability('manage_teacher_workspace')) then
    raise exception '관리자만 프로비저닝을 시작할 수 있습니다.';
  end if;
  if v_normalized is null or v_normalized = '' then
    raise exception 'workspace_email이 필요합니다.';
  end if;
  if p_personal_contact_email is null or trim(p_personal_contact_email) = '' then
    raise exception 'personal_contact_email이 필요합니다.';
  end if;
  if p_workspace_recovery_email is null or trim(p_workspace_recovery_email) = '' then
    raise exception 'workspace_recovery_email이 필요합니다.';
  end if;

  select * into v_row from teacher_workspace_provisioning
  where workspace_email_normalized = v_normalized
  for update;

  if found then
    if v_row.status <> 'retryable_failed' then
      raise exception '이미 진행 중이거나 완료된 프로비저닝입니다(상태: %).', v_row.status;
    end if;
    update teacher_workspace_provisioning
    set status = 'creating'
    where id = v_row.id
    returning * into v_row;
    return v_row;
  end if;

  insert into teacher_workspace_provisioning (
    workspace_email, workspace_email_normalized, personal_contact_email,
    workspace_recovery_email, personal_phone, status, created_by
  ) values (
    p_workspace_email, v_normalized, p_personal_contact_email,
    p_workspace_recovery_email, p_personal_phone, 'creating', auth.uid()
  ) returning * into v_row;

  return v_row;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.record_workspace_created(p_provisioning_id uuid, p_google_user_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (is_admin() or current_user_has_capability('manage_teacher_workspace')) then
    raise exception '관리자만 처리할 수 있습니다.';
  end if;
  update teacher_workspace_provisioning
  set status = 'created', workspace_google_user_id = p_google_user_id, workspace_created_at = now()
  where id = p_provisioning_id and status = 'creating';
  if not found then
    raise exception '유효하지 않은 프로비저닝 상태 전이입니다(id=%).', p_provisioning_id;
  end if;

  insert into workspace_provisioning_events (provisioning_id, event_type, created_by)
  values (p_provisioning_id, 'created', auth.uid());
end;
$function$
;

CREATE OR REPLACE FUNCTION public.record_workspace_creation_failed(p_provisioning_id uuid, p_reason text, p_retryable boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_status workspace_provisioning_status := case when p_retryable then 'retryable_failed' else 'manual_review' end;
begin
  if not (is_admin() or current_user_has_capability('manage_teacher_workspace')) then
    raise exception '관리자만 처리할 수 있습니다.';
  end if;
  update teacher_workspace_provisioning set status = v_status where id = p_provisioning_id;
  if not found then
    raise exception '존재하지 않는 프로비저닝입니다(id=%).', p_provisioning_id;
  end if;

  insert into workspace_provisioning_events (provisioning_id, event_type, detail, created_by)
  values (p_provisioning_id, 'creation_failed', p_reason, auth.uid());
  insert into workspace_provisioning_events (provisioning_id, event_type, detail, created_by)
  values (
    p_provisioning_id,
    case when p_retryable then 'retry_scheduled' else 'manual_review_required' end,
    p_reason, auth.uid()
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.mark_workspace_invite_sent(p_provisioning_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (is_admin() or current_user_has_capability('manage_teacher_workspace')) then
    raise exception '관리자만 처리할 수 있습니다.';
  end if;
  update teacher_workspace_provisioning
  set status = 'first_login_pending'
  where id = p_provisioning_id and status = 'created';
  if not found then
    raise exception '유효하지 않은 프로비저닝 상태 전이입니다(id=%).', p_provisioning_id;
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.suspend_teacher_workspace(p_teacher_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_prov_id uuid;
begin
  if not (is_admin() or current_user_has_capability('manage_teacher_workspace')) then
    raise exception '관리자만 처리할 수 있습니다.';
  end if;
  select id into v_prov_id from teacher_workspace_provisioning where linked_teacher_id = p_teacher_id;
  if v_prov_id is not null then
    update teacher_workspace_provisioning set status = 'suspended' where id = v_prov_id;
    insert into workspace_provisioning_events (provisioning_id, event_type, detail, created_by)
    values (v_prov_id, 'suspended', p_reason, auth.uid());
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.reactivate_teacher_workspace(p_teacher_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_prov_id uuid;
begin
  if not (is_admin() or current_user_has_capability('manage_teacher_workspace')) then
    raise exception '관리자만 처리할 수 있습니다.';
  end if;
  select id into v_prov_id from teacher_workspace_provisioning where linked_teacher_id = p_teacher_id;
  if v_prov_id is not null then
    update teacher_workspace_provisioning set status = 'linked' where id = v_prov_id and status = 'suspended';
    if not found then
      raise exception 'suspended 상태가 아닌 Workspace 프로비저닝은 재활성화할 수 없습니다.';
    end if;
    insert into workspace_provisioning_events (provisioning_id, event_type, detail, created_by)
    values (v_prov_id, 'reactivated', p_reason, auth.uid());
  end if;
end;
$function$
;

drop policy if exists "관리자/발송자 조회" on account_invites;
create policy "관리자/운영자/발송자 조회" on account_invites for select
  using (is_admin() or current_user_has_capability('manage_invites') or invited_by = auth.uid());

drop policy if exists "관리자/발송자 이벤트 조회" on account_invite_events;
create policy "관리자/운영자/발송자 이벤트 조회" on account_invite_events for select
  using (
    is_admin()
    or current_user_has_capability('manage_invites')
    or exists (select 1 from account_invites ai where ai.id = account_invite_events.invite_id and ai.invited_by = auth.uid())
  );

drop policy if exists "관리자만 조회" on account_merges;
create policy "관리자/운영자 조회" on account_merges for select
  using (is_admin() or current_user_has_capability('manage_account_merges'));

drop policy if exists "관리자/본인학생/보호자 조회" on guardian_consents;
create policy "관리자/운영자/본인학생/보호자 조회" on guardian_consents for select
  using (
    is_admin()
    or current_user_has_capability('manage_guardian_consent')
    or student_id = auth.uid()
    or exists (
      select 1 from household_members hm
      join household_members child
        on child.household_id = hm.household_id and child.role = 'child' and child.profile_id = guardian_consents.student_id
      where hm.role = 'guardian' and hm.profile_id = auth.uid()
    )
  );

drop policy if exists "관리자만 조회" on privacy_review_tasks;
create policy "관리자/운영자 조회" on privacy_review_tasks for select
  using (is_admin() or current_user_has_capability('manage_guardian_consent'));

drop policy if exists "관리자/본인 조회" on teacher_workspace_provisioning;
create policy "관리자/운영자/본인 조회" on teacher_workspace_provisioning for select
  using (is_admin() or current_user_has_capability('manage_teacher_workspace') or linked_teacher_id = auth.uid());

drop policy if exists "관리자만 조회" on workspace_provisioning_events;
create policy "관리자/운영자 조회" on workspace_provisioning_events for select
  using (is_admin() or current_user_has_capability('manage_teacher_workspace'));
