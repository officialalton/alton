-- 배치 2-3 corrective의 corrective — resolve_session_reconciliation_task()와
-- recomplete_session()의 잠금 순서를 "sessions 먼저, 그다음
-- session_judgment_reconciliation_tasks"로 통일한다.
--
-- 확인된 실제 데드락 버그: recomplete_session()은 이미 sessions 행을 먼저
-- 잠근 뒤 후보 대사 작업 행을 잠근다(정책과 일치, 변경 불필요 — 아래에서
-- 재확인). 반면 resolve_session_reconciliation_task()는 반대로
-- session_judgment_reconciliation_tasks 행을 먼저 잠근 뒤(select ... for
-- update) 그 결과로 상태를 판정한 다음에야 sessions 행을 잠근다(select ...
-- for update). 두 함수가 같은 세션+대사 작업 쌍에 대해 동시에 실행되면,
-- 한쪽은 sessions를 잡고 task를 기다리고 다른 쪽은 task를 잡고 sessions를
-- 기다리는 순환 대기가 만들어질 수 있다 — PostgreSQL이 이를 데드락으로
-- 감지해 한쪽 트랜잭션을 강제 중단시키는 지저분한 실패 모드다(배치 2-1에서
-- 이미 확립한 "잠금 후 재검증, 잠금 전 값은 신뢰하지 않는다" 원칙과 별개로,
-- 이번엔 잠금 "순서" 자체가 문제).
--
-- 수정: resolve_session_reconciliation_task()를 (a) 잠금 없이 task의
-- session_id만 먼저 읽고(이 시점의 다른 필드는 신뢰하지 않는다) (b) sessions
-- 행을 먼저 select ... for update로 잠근 뒤 (c) 그다음 대사 작업 행을 select
-- ... for update로 잠그고 (d) 잠금 이후 다시 읽은 실제 상태(v_task)로만
-- 검증/분기한다 — 순서만 바뀌었을 뿐 검증 로직·action 값·토큰 발급 지점은
-- 배치 2-3에서 확정된 것과 완전히 동일하다.
--
-- recomplete_session()은 이미 `select * into v_session from sessions where
-- id = p_session_id for update`를 함수 최상단에서 실행하고, 대사 작업 후보
-- 잠금(candidates CTE의 for update)은 한참 뒤에 나온다 — "sessions 먼저"
-- 정책과 이미 일치하므로 이 corrective에서 변경하지 않는다(재확인 완료,
-- create or replace 재실행 없음).
--
-- action 값·토큰 발급 지점·다른 검증 로직은 배치 2-3(20261259000000)에서
-- 이미 확정된 것을 그대로 유지한다 — 이 corrective가 건드리는 건
-- resolve_session_reconciliation_task() 안에서 sessions를 언제 잠그는지
-- 뿐이다.

create or replace function public.resolve_session_reconciliation_task(p_task_id uuid, p_reason text)
returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_task session_judgment_reconciliation_tasks%rowtype;
  v_session sessions%rowtype;
  v_unlocked_session_id uuid;
  v_reservation_id uuid;
  v_actual_current_disposition text;
  v_adjust_since_created int;
begin
  if not public.is_admin() then
    raise exception '관리자만 대사 작업을 반영할 수 있습니다.';
  end if;

  -- (a) 잠금 없이 이 task가 어느 세션에 속하는지만 먼저 읽는다 — 어느 sessions
  -- 행을 먼저 잠가야 할지 알기 위한 것뿐, 이 시점에 읽은 session_id 외의 값은
  -- (session_id 자체를 포함해) 절대 신뢰하지 않는다. 존재하지 않는 task라면
  -- 여기서 바로 반려한다(잠글 대상조차 없으므로).
  select session_id into v_unlocked_session_id
    from session_judgment_reconciliation_tasks where id = p_task_id;
  if v_unlocked_session_id is null then
    raise exception '대사 작업을 찾을 수 없습니다.' using errcode = 'P0001';
  end if;

  -- (b) sessions 행을 먼저 잠근다 — recomplete_session()과 동일한 잠금 순서를
  -- 지켜 순환 대기(데드락)를 원천적으로 배제한다.
  select * into v_session from sessions where id = v_unlocked_session_id for update;

  -- (c) 그다음 대사 작업 행을 잠근다. select ... for update가 잠금 획득과
  -- 동시에 최신 커밋 상태를 반환하므로(PostgreSQL FOR UPDATE의 기본 동작),
  -- 아래 (d) 검증은 잠금 전에 읽은 어떤 값도 참조하지 않고 오직 이 v_task로만
  -- 판단한다.
  select * into v_task from session_judgment_reconciliation_tasks where id = p_task_id for update;
  if v_task.id is null then
    raise exception '대사 작업을 찾을 수 없습니다.' using errcode = 'P0001';
  end if;

  -- (d) 잠금 이후 재검증. session_id는 불변 컬럼이라 보통 (a)에서 읽은 값과
  -- 같지만, 혹시라도 달라졌다면(있을 수 없는 상황이지만) 방어적으로 반려한다 —
  -- (b)에서 잠근 sessions 행이 실제로 이 task가 가리키는 세션이 아닐 수 있기
  -- 때문이다.
  if v_task.session_id is distinct from v_unlocked_session_id then
    raise exception '대사 작업의 세션 정보가 잠금 사이에 변경됐습니다 — 다시 시도하세요.' using errcode = 'P0001';
  end if;

  -- (경합 결과 A) recomplete_session()이 먼저 sessions 잠금을 잡고 대상 task를
  -- superseded로 전환한 뒤 커밋했다면, 이 함수는 sessions 잠금을 얻기 위해
  -- 대기하다가(순서가 같으므로 데드락이 아니라 정상적인 순차 대기) 잠금을
  -- 얻은 뒤 이어서 task를 잠그고 재조회하므로 이미 최신 커밋 상태(superseded)를
  -- 돌려받는다 — 아래 분기가 명시적으로 반려한다.
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
  '(corrective, 잠금 순서) sessions와 session_judgment_reconciliation_tasks를
  모두 잠그는 recomplete_session()과 순환 대기(데드락)가 발생하지 않도록,
  잠금 없이 task의 session_id만 먼저 읽은 뒤(그 값 외에는 아무것도 신뢰하지
  않음) sessions 행을 먼저 select ... for update로 잠그고, 그다음
  session_judgment_reconciliation_tasks 행을 잠근다 — recomplete_session()과
  동일한 "sessions 먼저" 순서. 잠금 이후에는 재조회한 v_task/v_session 값으로만
  판정하며, session_id가 잠금 사이에 달라졌다면(있을 수 없지만) 방어적으로
  반려한다. action 값·토큰 발급 지점·needs_review/resolved/superseded 분기
  로직은 배치 2-3(20261259000000)과 완전히 동일하고, 오직 sessions를 잠그는
  시점만 앞당겼다.';
