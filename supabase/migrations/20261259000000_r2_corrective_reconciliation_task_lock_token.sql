-- 배치 2-3 corrective — bypass_reconciliation_task_lock GUC를
-- status_transition_tokens 1회용 토큰으로 교체 (docs/superpowers/plans/
-- 2026-09-08-bypass-guc-security-cleanup.md "배치 2 상세 실행 계획 > 배치 2-3"
-- 참고, 5차/6차 개정 반영).
--
-- 대상(실제 호출자 3개): resolve_session_reconciliation_task(),
-- set_reconciliation_task_student_cancelled_disposition(), recomplete_session()
-- (재판정 시 이전 pending 대사 작업을 superseded로 전환하는 부분만 — 그 외
-- recomplete_session() 로직은 손대지 않는다).
--
-- action 값 4개(5차 개정 — needs_review/superseded 공유 폐기, 완전히 분리):
-- 'reconciliation_task_resolve' (pending → resolved),
-- 'reconciliation_task_needs_review' (pending → needs_review, 3가지 원인 공유),
-- 'reconciliation_task_supersede' (pending → superseded, recomplete_session() 전용),
-- 'reconciliation_task_set_disposition' (status 컬럼이 아니라
-- expected_entitlement_disposition/required_entitlement_adjustment_amount/
-- admin_disposition_reason 3개 컬럼 UPDATE). 어느 action 값도 자기 자신이
-- 지정한 전이 외의 전이를 열 수 없다 — 트리거가 new.status 값(또는
-- disposition 필드 변경 여부)만으로 어느 action을 확인할지 분기한다.
--
-- 경합 정책(6차 개정, product-owner 확정): "행 잠금(for update)을 먼저 획득하고
-- 정상 완료하는 쪽이 이긴다". resolve_session_reconciliation_task()는 이미
-- select ... for update를 먼저 실행한 뒤 그 결과(v_task)로 상태 분기하므로
-- (잠금 후 재조회가 이미 구조적으로 보장됨), 대상 행이 recomplete_session()에
-- 의해 먼저 superseded로 전환된 경우 v_task.status = 'superseded' 분기가 이미
-- 존재해 자연스럽게 명시적으로 반려한다(결과 A) — 이 함수는 토큰 교체 외에
-- 추가 재조회 로직이 필요 없다. recomplete_session()은 반대로 지금까지 대상
-- 행을 잠그지 않은 채 조건부 UPDATE만 실행했으므로, 이번에 candidates를
-- select ... for update로 먼저 잠그고(mark_expired_invites()와 동일한
-- candidates → tokens → 배치 UPDATE 3단 CTE 패턴), 그 WHERE절(status = 'pending')이
-- 잠금 획득 후 EvalPlanQual로 재평가되므로 다른 트랜잭션이 먼저 그 행을
-- resolved/needs_review로 전환했다면 후보에서 자동으로 제외된다(결과 B) —
-- recomplete_session()은 그 행을 전혀 mutate하지 않고, 함수 말미의 기존
-- 무조건 INSERT(이번 재판정 결과를 반영하는 새 대사 작업 행)가 그대로 실행되어
-- "새 행 INSERT" 요구사항을 충족한다(이 INSERT는 원래도 매 호출마다 무조건
-- 실행되던 로직이라 이 corrective에서 별도로 추가하지 않았다).
--
-- 배치 1/2-1/2-2 corrective와 동일한 두 규칙을 처음부터 적용한다: (a)
-- status_transition_tokens 참조는 반드시 public.status_transition_tokens로
-- 완전히 스키마 한정한다. (b) 4개 함수(트리거 포함) 전부 search_path를
-- 'public, pg_temp'로 명시 고정한다(기존 4개 모두 'public'뿐, 트리거 함수는
-- SECURITY DEFINER/search_path 지정이 아예 없었다).

-- ---------------------------------------------------------------------------
-- reconciliation_task_update_guard(): GUC 분기를 완전히 제거하고, new.status가
-- 무엇으로 바뀌는지(또는 disposition 필드가 바뀌는지)에 따라 정확히 그 전이에
-- 대응하는 action 값의 토큰만 확인한다. reject_reconciliation_task_direct_mutation()
-- (DELETE 차단)은 변경하지 않는다 — GUC 무관하게 항상 거부이므로 그대로 유지.
-- ---------------------------------------------------------------------------
create or replace function public.reconciliation_task_update_guard()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_action text;
begin
  if new.status is distinct from old.status then
    if new.status = 'resolved' then
      v_action := 'reconciliation_task_resolve';
    elsif new.status = 'needs_review' then
      v_action := 'reconciliation_task_needs_review';
    elsif new.status = 'superseded' then
      v_action := 'reconciliation_task_supersede';
    else
      raise exception 'session_judgment_reconciliation_tasks.status는 resolved/needs_review/superseded로만 전이할 수 있습니다(시도: %).', new.status;
    end if;

    if not public.consume_status_transition_token('session_judgment_reconciliation_tasks', new.id, v_action) then
      raise exception 'session_judgment_reconciliation_tasks는 지정된 함수를 통해서만 갱신할 수 있습니다.';
    end if;
    return new;
  end if;

  if new.expected_entitlement_disposition is distinct from old.expected_entitlement_disposition
     or new.required_entitlement_adjustment_amount is distinct from old.required_entitlement_adjustment_amount
     or new.admin_disposition_reason is distinct from old.admin_disposition_reason then
    if not public.consume_status_transition_token('session_judgment_reconciliation_tasks', new.id, 'reconciliation_task_set_disposition') then
      raise exception 'session_judgment_reconciliation_tasks의 처리방식 필드는 지정된 함수를 통해서만 변경할 수 있습니다.';
    end if;
    return new;
  end if;

  if new is distinct from old then
    raise exception 'session_judgment_reconciliation_tasks는 지정된 함수를 통해서만 갱신할 수 있습니다.';
  end if;
  return new;
end;
$$;
revoke execute on function public.reconciliation_task_update_guard() from public, anon, authenticated, service_role;

comment on function public.reconciliation_task_update_guard() is
  'session_judgment_reconciliation_tasks 갱신 보호 트리거. (corrective)
  GUC(app.bypass_reconciliation_task_lock) 분기를 제거하고
  status_transition_tokens 1회용 토큰 확인/소비로 대체했다 — 4개 action 값
  (reconciliation_task_resolve/needs_review/supersede/set_disposition)이 서로
  배타적이며, new.status가 무엇으로 바뀌는지(또는 disposition 필드가 바뀌는지)에
  따라 정확히 그 전이에 대응하는 action 값의 토큰만 확인한다 — 어느 action도
  자기 자신이 지정한 전이보다 더 많은 것을 열 수 없다.
  consume_status_transition_token()이 public.status_transition_tokens로 완전히
  스키마 한정되어 있고 search_path가 public, pg_temp로 고정되어 있으므로 temp
  table 가로채기가 통하지 않는다.';

-- ---------------------------------------------------------------------------
-- resolve_session_reconciliation_task(): 최신(20261124000000) 정의 기준.
-- select ... for update가 이미 잠금 획득과 동시에 최신 커밋 상태를 반환하므로
-- (PostgreSQL FOR UPDATE의 기본 동작), 이어지는 status 분기(resolved/superseded/
-- needs_review 재반영 차단)가 이미 "잠금 후 재검증"을 구조적으로 만족한다 —
-- 별도 재조회 코드를 추가할 필요가 없다. GUC set_config() 호출 4곳을 각각
-- 대응하는 action 값의 토큰 인라인 INSERT로 교체한다.
-- ---------------------------------------------------------------------------
create or replace function public.resolve_session_reconciliation_task(p_task_id uuid, p_reason text)
returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_task session_judgment_reconciliation_tasks%rowtype;
  v_session sessions%rowtype;
  v_reservation_id uuid;
  v_actual_current_disposition text;
  v_adjust_since_created int;
begin
  if not public.is_admin() then
    raise exception '관리자만 대사 작업을 반영할 수 있습니다.';
  end if;

  select * into v_task from session_judgment_reconciliation_tasks where id = p_task_id for update;
  if v_task.id is null then
    raise exception '대사 작업을 찾을 수 없습니다.' using errcode = 'P0001';
  end if;
  -- (경합 결과 A) recomplete_session()이 먼저 잠금을 잡고 superseded로 전환한
  -- 뒤 커밋했다면, 이 select ... for update가 잠금을 얻은 시점에 이미 최신
  -- 커밋 상태(superseded)를 돌려주므로 아래 분기가 명시적으로 반려한다.
  if v_task.status = 'resolved' then
    raise exception '이미 반영된 대사 작업입니다.' using errcode = 'P0001';
  end if;
  if v_task.status = 'superseded' then
    raise exception '이 대사 작업은 같은 세션의 새 재판정으로 대체(superseded)됐습니다 — 반영할 수 없습니다.'
      using errcode = 'P0001';
  end if;
  if v_task.status = 'needs_review' then
    raise exception '이 대사 작업은 반영 시점에 전제가 깨져 needs_review 상태입니다 — 관리자 재검토 없이 반영할 수 없습니다.'
      using errcode = 'P0001';
  end if;

  if v_task.new_final_status = 'student_cancelled' and v_task.expected_entitlement_disposition is null then
    raise exception '학생 취소 재판정은 관리자가 소진/해제 여부를 먼저 선택해야 합니다 — set_reconciliation_task_student_cancelled_disposition()를 먼저 호출하세요.'
      using errcode = 'P0001';
  end if;

  select * into v_session from sessions where id = v_task.session_id for update;

  if v_session.final_status is distinct from v_task.new_final_status
     or v_session.payable_minutes is distinct from v_task.new_payable_minutes then
    insert into public.status_transition_tokens (table_name, row_id, action)
      values ('session_judgment_reconciliation_tasks', p_task_id, 'reconciliation_task_needs_review');
    update session_judgment_reconciliation_tasks
      set status = 'needs_review', reason = coalesce(p_reason, reason)
      where id = p_task_id;
    return 'needs_review';
  end if;

  v_reservation_id := v_session.reservation_id;
  select event_type into v_actual_current_disposition from entitlement_ledger
    where reservation_id = v_reservation_id and event_type in ('consume', 'release')
    limit 1;

  if v_actual_current_disposition is distinct from v_task.current_entitlement_disposition then
    insert into public.status_transition_tokens (table_name, row_id, action)
      values ('session_judgment_reconciliation_tasks', p_task_id, 'reconciliation_task_needs_review');
    update session_judgment_reconciliation_tasks
      set status = 'needs_review', reason = coalesce(p_reason, reason)
      where id = p_task_id;
    return 'needs_review';
  end if;

  if v_task.entitlement_grant_id is not null then
    select coalesce(sum(amount), 0) into v_adjust_since_created from entitlement_ledger
      where grant_id = v_task.entitlement_grant_id
        and event_type = 'adjust'
        and created_at > v_task.created_at;
    if v_adjust_since_created <> 0 then
      insert into public.status_transition_tokens (table_name, row_id, action)
        values ('session_judgment_reconciliation_tasks', p_task_id, 'reconciliation_task_needs_review');
      update session_judgment_reconciliation_tasks
        set status = 'needs_review', reason = coalesce(p_reason, reason)
        where id = p_task_id;
      return 'needs_review';
    end if;
  end if;

  if v_task.required_entitlement_adjustment_amount <> 0 and v_task.entitlement_grant_id is not null then
    perform public.adjust_entitlement(
      v_task.entitlement_grant_id,
      v_task.required_entitlement_adjustment_amount,
      'reconciliation_task:' || p_task_id
    );
  end if;

  insert into public.status_transition_tokens (table_name, row_id, action)
    values ('session_judgment_reconciliation_tasks', p_task_id, 'reconciliation_task_resolve');
  update session_judgment_reconciliation_tasks
    set status = 'resolved', resolved_at = now(), resolved_by = auth.uid(), reason = coalesce(p_reason, reason)
    where id = p_task_id;
  return 'resolved';
end;
$$;
revoke execute on function public.resolve_session_reconciliation_task(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.resolve_session_reconciliation_task(uuid, text) to authenticated;

comment on function public.resolve_session_reconciliation_task(uuid, text) is
  '(corrective) GUC(app.bypass_reconciliation_task_lock) set_config() 호출을
  제거하고, 4개 분기 각각의 UPDATE 직전 status_transition_tokens에 1회용
  토큰을 인라인 INSERT한다 — needs_review 3개 원인은 모두
  ''reconciliation_task_needs_review''를, 정상 반영은
  ''reconciliation_task_resolve''를 쓴다(''reconciliation_task_supersede''는
  이 함수가 절대 쓰지 않는다 — recomplete_session() 전용). select ... for
  update가 잠금 획득과 동시에 최신 커밋 상태를 반환하므로, 대상 행이 이미
  recomplete_session()에 의해 superseded로 전환됐다면 위 상태 분기가 그
  사실을 그대로 재조회해 명시적으로 반려한다(경합 결과 A). 그 외 검증(전제
  재확인, resolved/superseded/needs_review 재반영 차단)은 기존과 동일.
  status_transition_tokens 참조를 public.status_transition_tokens로 완전히
  스키마 한정하고 search_path를 public, pg_temp로 고정했다.';

-- ---------------------------------------------------------------------------
-- set_reconciliation_task_student_cancelled_disposition(): 최신(20261124000000)
-- 정의 기준(hold 금액을 reservation_id로 한정하는 2026-09-06 수정 포함). GUC
-- set_config() 호출만 'reconciliation_task_set_disposition' 토큰으로 교체한다.
-- ---------------------------------------------------------------------------
create or replace function public.set_reconciliation_task_student_cancelled_disposition(
  p_task_id uuid,
  p_disposition text,
  p_reason text
) returns void
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_task session_judgment_reconciliation_tasks%rowtype;
  v_reservation_id uuid;
  v_held_amount int;
  v_required_amount int;
begin
  if not public.is_admin() then
    raise exception '관리자만 대사 작업의 수업권 처리 방식을 선택할 수 있습니다.';
  end if;
  if p_disposition not in ('consume', 'release') then
    raise exception 'p_disposition은 consume 또는 release여야 합니다.' using errcode = 'P0001';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception '학생 취소 수업권 처리를 직접 선택할 때는 사유를 반드시 입력해야 합니다.' using errcode = 'P0001';
  end if;

  select * into v_task from session_judgment_reconciliation_tasks where id = p_task_id for update;
  if v_task.id is null then
    raise exception '대사 작업을 찾을 수 없습니다.' using errcode = 'P0001';
  end if;
  if v_task.status <> 'pending' then
    raise exception 'pending 상태의 대사 작업에만 수업권 처리 방식을 선택할 수 있습니다(현재 상태: %).', v_task.status
      using errcode = 'P0001';
  end if;
  if v_task.new_final_status <> 'student_cancelled' then
    raise exception '이 함수는 student_cancelled 재판정 작업에만 사용할 수 있습니다.' using errcode = 'P0001';
  end if;
  if v_task.expected_entitlement_disposition is not null then
    raise exception '이미 취소 기록으로 자동 판정된 작업입니다 — 수동 선택이 필요하지 않습니다.' using errcode = 'P0001';
  end if;

  select reservation_id into v_reservation_id from sessions where id = v_task.session_id;

  v_required_amount := 0;
  if v_task.entitlement_grant_id is not null and v_reservation_id is not null then
    select abs(amount) into v_held_amount from entitlement_ledger
      where reservation_id = v_reservation_id and event_type = 'hold';
    if v_task.current_entitlement_disposition is distinct from p_disposition then
      if v_task.current_entitlement_disposition = 'consume' and p_disposition = 'release' then
        v_required_amount := coalesce(v_held_amount, 0);
      elsif v_task.current_entitlement_disposition = 'release' and p_disposition = 'consume' then
        v_required_amount := -coalesce(v_held_amount, 0);
      end if;
    end if;
  end if;

  insert into public.status_transition_tokens (table_name, row_id, action)
    values ('session_judgment_reconciliation_tasks', p_task_id, 'reconciliation_task_set_disposition');
  update session_judgment_reconciliation_tasks
    set expected_entitlement_disposition = p_disposition,
        required_entitlement_adjustment_amount = v_required_amount,
        admin_disposition_reason = p_reason
    where id = p_task_id;
end;
$$;
revoke execute on function public.set_reconciliation_task_student_cancelled_disposition(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.set_reconciliation_task_student_cancelled_disposition(uuid, text, text) to authenticated;

comment on function public.set_reconciliation_task_student_cancelled_disposition(uuid, text, text) is
  '(corrective) GUC(app.bypass_reconciliation_task_lock) set_config() 호출을
  제거하고, disposition 필드 UPDATE 직전 status_transition_tokens에
  ''reconciliation_task_set_disposition'' 1회용 토큰을 인라인 INSERT한다. 그 외
  동작(hold 금액을 reservation_id로 한정하는 2026-09-06 수정 포함)은 기존과 동일.
  status_transition_tokens 참조를 public.status_transition_tokens로 완전히
  스키마 한정하고 search_path를 public, pg_temp로 고정했다.';

-- ---------------------------------------------------------------------------
-- recomplete_session(): 최신(20261123000000) 정의 기준. 유일한 변경 지점은
-- 이전 pending 대사 작업을 superseded로 전환하는 부분뿐이다 — 그 외 로직
-- (sessions UPDATE, session_status_events/payout_items 처리,
-- student_cancelled 24시간 자동 판정, 새 대사 작업 INSERT 등)은 전혀 손대지
-- 않는다.
--
-- 기존: GUC 우회 설정 후 `where session_id = ... and status = 'pending'` 조건부
-- UPDATE 한 문장(잠금 없음, 토큰 없음).
--
-- 변경: mark_expired_invites()와 동일한 candidates(for update로 후보 잠금,
-- id 오름차순 — 데드락 방지 안정적 순서) → tokens(후보별 개별 토큰 INSERT) →
-- superseded(확정된 후보 집합에만 배치 UPDATE) 3단 CTE 체인. candidates의
-- `for update`가 잠금을 얻은 뒤 PostgreSQL이 EvalPlanQual로 WHERE절(status =
-- 'pending')을 재평가하므로, 잠금을 기다리는 동안 다른 트랜잭션
-- (resolve_session_reconciliation_task())이 그 행을 이미 resolved/needs_review로
-- 전환하고 커밋했다면 그 행은 candidates에서 자동으로 제외된다(경합 결과 B) —
-- 이 함수는 그 행을 전혀 UPDATE하지 않는다. 함수 말미의 기존 무조건 INSERT(이번
-- 재판정 결과를 반영하는 새 session_judgment_reconciliation_tasks 행, 이 corrective
-- 이전부터 매 호출마다 실행되던 로직)가 그대로 실행되어 "새 행 INSERT" 요구사항을
-- 이미 충족한다 — 별도 분기 코드가 필요 없다.
-- ---------------------------------------------------------------------------
create or replace function public.recomplete_session(p_session_id uuid, p_new_final_status v3_session_final_status, p_reason text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_prev v3_session_final_status;
  v_session sessions%rowtype;
  v_new_payable int;
  v_reservation_id uuid;
  v_current_disposition text;
  v_expected_disposition text;
  v_grant_id uuid;
  v_held_amount int;
  v_required_amount int;
  v_task_id uuid;
  v_paid_payout_item_id uuid;
begin
  if not public.is_admin() then
    raise exception '관리자만 세션을 재확정할 수 있습니다.';
  end if;

  select * into v_session from sessions where id = p_session_id for update;
  v_prev := v_session.final_status;
  if v_prev is distinct from 'live' then
    raise exception 'reopen_session() 이후에만 recomplete_session()을 호출할 수 있습니다.';
  end if;

  if p_new_final_status in ('scheduled', 'live') then
    raise exception 'recomplete_session()은 scheduled/live로 되돌릴 수 없습니다. 확정 가능한 종료 상태만 허용됩니다.';
  end if;

  select previous_final_status into v_prev
    from session_status_events
    where session_id = p_session_id and event_type = 'reopened'
    order by occurred_at desc limit 1;

  v_new_payable := case
    when p_new_final_status in ('completed', 'student_no_show')
      then v_session.scheduled_duration_minutes - coalesce(v_session.late_start_minutes, 0)
    else 0
  end;

  update sessions
    set final_status = p_new_final_status,
        finalized_at = now(),
        payable_minutes = v_new_payable
    where id = p_session_id;

  insert into session_status_events (session_id, event_type, previous_final_status, new_final_status, actor_profile_id, reason)
  values (p_session_id, 'recompleted', v_prev, p_new_final_status, auth.uid(), p_reason);

  select id into v_paid_payout_item_id from payout_items where session_id = p_session_id and status = 'paid';

  perform public.upsert_session_payout_item(p_session_id);

  -- (corrective) GUC 우회 대신, 후보 행을 id 오름차순으로 for update 잠근 뒤
  -- (mark_expired_invites()와 동일한 패턴) 후보별 개별 supersede 토큰을 발급하고,
  -- 그 확정된 후보 집합에만 배치 UPDATE를 실행한다. candidates의 for update
  -- 재평가로 그 사이 resolved/needs_review로 바뀐 행은 자동 제외된다(경합 결과 B).
  with candidates as (
    select id from session_judgment_reconciliation_tasks
    where session_id = p_session_id and status = 'pending'
    order by id
    for update
  ),
  tokens as (
    insert into public.status_transition_tokens (table_name, row_id, action)
    select 'session_judgment_reconciliation_tasks', id, 'reconciliation_task_supersede' from candidates
    returning row_id
  )
  update session_judgment_reconciliation_tasks
  set status = 'superseded'
  where id in (select row_id from tokens);

  -- ===== entitlement 대사 작업 자동 생성 =====
  v_reservation_id := v_session.reservation_id;
  select event_type into v_current_disposition from entitlement_ledger
    where reservation_id = v_reservation_id and event_type in ('consume', 'release')
    limit 1;

  if p_new_final_status = 'student_cancelled' then
    v_expected_disposition := public.expected_entitlement_disposition_for_student_cancelled(p_session_id);
  else
    v_expected_disposition := public.expected_entitlement_disposition_for_outcome(p_new_final_status);
  end if;

  select grant_id into v_grant_id from entitlement_ledger
    where reservation_id = v_reservation_id and event_type = 'hold';
  if v_grant_id is not null then
    select abs(amount) into v_held_amount from entitlement_ledger
      where reservation_id = v_reservation_id and event_type = 'hold';
  end if;

  v_required_amount := 0;
  if v_expected_disposition is not null and v_current_disposition is distinct from v_expected_disposition and v_grant_id is not null then
    if v_current_disposition = 'consume' and v_expected_disposition = 'release' then
      v_required_amount := v_held_amount;
    elsif v_current_disposition = 'release' and v_expected_disposition = 'consume' then
      v_required_amount := -v_held_amount;
    end if;
  end if;

  insert into session_judgment_reconciliation_tasks (
    session_id, prior_final_status, new_final_status, prior_payable_minutes, new_payable_minutes,
    current_entitlement_disposition, expected_entitlement_disposition, entitlement_grant_id,
    required_entitlement_adjustment_amount, reason
  ) values (
    p_session_id, v_prev, p_new_final_status, v_session.payable_minutes, v_new_payable,
    v_current_disposition, v_expected_disposition, v_grant_id, v_required_amount, p_reason
  ) returning id into v_task_id;

  if v_paid_payout_item_id is not null then
    update payout_items set superseded_by_reconciliation_task_id = v_task_id where id = v_paid_payout_item_id;
  end if;
end;
$$;
revoke execute on function public.recomplete_session(uuid, v3_session_final_status, text) from public, anon, authenticated, service_role;
grant execute on function public.recomplete_session(uuid, v3_session_final_status, text) to authenticated;

comment on function public.recomplete_session(uuid, v3_session_final_status, text) is
  '(corrective) 이전 pending 대사 작업을 superseded로 전환하는 부분만 GUC
  (app.bypass_reconciliation_task_lock) 대신 status_transition_tokens 1회용
  토큰으로 교체했다 — candidates(id 오름차순 for update 잠금) → tokens(후보별
  개별 ''reconciliation_task_supersede'' 토큰 INSERT) → 배치 UPDATE 3단 CTE
  체인(mark_expired_invites()와 동일 패턴)으로 다건 pending 작업도 행당 정확히
  1개 토큰만 소비한다. candidates의 for update가 EvalPlanQual로 WHERE절을
  재평가하므로, 잠금 대기 중 다른 트랜잭션이 그 행을 이미 resolved/needs_review로
  전환했다면 자동으로 후보에서 제외된다(경합 결과 B — 이 함수는 그 행을 전혀
  mutate하지 않는다). 함수 말미의 새 대사 작업 INSERT는 이 corrective 이전부터
  매 호출마다 무조건 실행되던 기존 로직 그대로다. 그 외 로직(sessions UPDATE,
  session_status_events/payout_items 처리, student_cancelled 24시간 자동 판정)은
  전혀 손대지 않았다. status_transition_tokens 참조를 public.status_transition_tokens로
  완전히 스키마 한정하고 search_path를 public, pg_temp로 고정했다.';
