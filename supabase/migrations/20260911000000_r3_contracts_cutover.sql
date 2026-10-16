-- R3 — 계약 cutover: 레거시 `contracts` → `legacy_contracts`, `contracts_v3` → `contracts`
--
-- 배경(master-roadmap-v3.md R3, product-architecture-v3.md §4.13): R1에서 `contracts_v3`를
-- shadow 테이블로 만들 때 예고한 대로, 이번 마이그레이션에서 레거시 `contracts`를
-- `legacy_contracts`로 rename하고 `contracts_v3`를 최종 이름 `contracts`로 rename하는
-- 작업을 앱 코드 전환과 함께 원자적으로 수행한다. 이 시점의 레거시 `contracts`/
-- `contract_versions` 데이터는 오픈 전 테스트 데이터이므로 앞으로 이관하지 않는다(§4.13,
-- "이관 불필요" 확정) — DROP하지 않고 `legacy_contracts`로 남겨 조회만 가능하게 둔다.

-- 1) 레거시 `contracts` → `legacy_contracts`
--    (레거시 스키마에는 별도 `contract_versions` 테이블이 없음 — 위에서 확인됨.
--     v3용 `contract_versions`만 존재하므로 이름 충돌 없음.)
alter table contracts rename to legacy_contracts;
alter index contracts_pkey rename to legacy_contracts_pkey;
alter table legacy_contracts rename constraint contracts_parent_id_fkey to legacy_contracts_parent_id_fkey;
alter table legacy_contracts rename constraint contracts_student_id_fkey to legacy_contracts_student_id_fkey;

comment on table legacy_contracts is
  'R3 cutover(2026-09-11)로 동결된 레거시(v1) 계약 테이블. 새 앱 코드는 더 이상 이 테이블을 쓰지 않는다. '
  '오픈 전 테스트 데이터이며 v3 계약(현재의 public.contracts)으로 이관하지 않기로 확정됨(product-architecture-v3.md §4.13). '
  '조회 전용으로만 남겨둔다 — DROP하지 않음.';

-- 2) `contracts_v3` → `contracts` (contract_versions는 이미 최종 이름이므로 그대로 둔다)
alter table contracts_v3 rename to contracts;
alter index contracts_v3_pkey rename to contracts_pkey;
alter index contracts_v3_household_id_idx rename to contracts_household_id_idx;
alter index contracts_v3_child_id_idx rename to contracts_child_id_idx;
alter table contracts rename constraint contracts_v3_household_id_fkey to contracts_household_id_fkey;
alter table contracts rename constraint contracts_v3_child_id_fkey to contracts_child_id_fkey;
-- contracts_one_active_per_child was already given an explicit, non-v3 name at creation time.

comment on table contracts is
  'R3 cutover(2026-09-11)로 확정된 v3 계약 테이블(R1에서는 contracts_v3라는 shadow 이름으로 생성됨). '
  '레거시 계약 테이블은 legacy_contracts를 참고.';

-- 3) RLS 정책 이름 정리(contracts_v3라는 옛 이름이 정책명에 남아 혼동을 주지 않도록).
--    ALTER POLICY ... RENAME은 정책이 실제로 바라보는 테이블(oid)에는 영향이 없으므로
--    순수 cosmetic 변경이며, rename 자체로 인한 동작 변화는 없다.
alter policy "contracts_v3 조회" on contracts rename to "contracts 조회";
alter policy "contracts_v3 쓰기" on contracts rename to "contracts 쓰기";

-- 4) merge_accounts()가 옛 이름(contracts_v3)과 이제는 의미가 바뀐 이름(contracts,
--    과거엔 레거시 스키마를 가리켰음)을 참조하고 있어 이번 rename 이후에는 깨진다.
--    새 테이블 이름에 맞춰 본문만 갱신한 동일 시그니처 함수로 교체한다(로직 변경 없음,
--    contracts_v3→contracts, 레거시 contracts→legacy_contracts로 대상만 바뀜).
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

  -- R3 cutover: contracts_v3 → contracts(v3 계약, child_id 기준)로 이름이 바뀌었다.
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

  update sessions_v3 set teacher_id = p_survivor_id where teacher_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('sessions_v3', v_count);

  update supervisor_capabilities set profile_id = p_survivor_id where profile_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('supervisor_capabilities', v_count);

  update teacher_assignments set teacher_id = p_survivor_id where teacher_id = p_merged_id;
  get diagnostics v_count = row_count; v_summary := v_summary || jsonb_build_object('teacher_assignments', v_count);

  -- R3 cutover: 레거시(v1) contracts → legacy_contracts로 이름이 바뀌었다. 이 테이블은
  -- 더 이상 앱이 쓰지 않는 동결된 테스트 데이터지만, 과거 병합 이력과의 일관성을 위해
  -- 계속 갱신한다(§4.13 — 조회는 계속 가능하게 유지하기로 함).
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
