-- 2026-09-28 — 초기 고객 절차 단순화 4단계: 계약 자동 발송 outbox
-- (docs/2026-09-26-consent-contract-simplification-implementation-plan.md 4단계)
--
-- 계약 발송(DocuSign)을 DB 트리거에서 직접 호출하지 않는다 — durable outbox
-- 테이블에 작업만 쌓고, 실제 발송은 앱 레이어의 워커/관리자 액션이 담당한다
-- (이 마이그레이션은 큐잉만 한다 — 실제 발송 코드는 별도 앱 레이어에서
-- env 플래그로 기본 비활성 상태로 구현된다).
--
-- 트리거 지점 2곳:
--   1) 체험 수업이 실제 completed로 끝나는 순간 — sessions 트리거로 감지.
--      취소/노쇼/미완료에는 작업을 만들지 않는다(final_status='completed'
--      전이만 본다).
--   2) 직접 계정 생성 경로에서 체험수업권이 지급되는 순간 —
--      grant_trial_entitlement_for_student()는 이 경로에서만 호출되므로
--      (finalize_trial_onboarding_students/retry_trial_onboarding_student의
--      "지인/추천 직접생성" 분기 전용, 20261481000000) 안전한 단일 후킹
--      지점이다. 상담 경로(consultation 있음)는 grant_trial_entitlement_for_
--      consultation()을 쓰므로 여기 안 걸린다 — 그쪽은 admin_record_
--      consultation_outcome() 쪽에 이미 별도로 연결돼 있다(20261900000025,
--      task_aab5c4d1에서 정확한 트리거 시점 재검토 중).
--
-- 자녀당·trigger_type당 정확히 1개만 큐잉된다(unique 제약) — 중복 완료
-- 이벤트·재시도가 중복 작업을 만들지 않는다.

create table contract_dispatch_jobs (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references profiles (id),
  -- 참고용일 뿐 유니크 키에 포함되지 않는다 — 계약은 자녀당 1개
  -- (get_or_create_draft_contract_for_child, 20261017000000)이므로 outbox도
  -- 자녀 단위로 dedupe한다.
  subject_enrollment_id uuid references subject_enrollments (id),
  trigger_type text not null check (trigger_type in ('completed_trial', 'direct_account_created')),
  status text not null default 'queued' check (status in ('queued', 'processing', 'sent', 'retryable_failed', 'permanent_failed')),
  attempt_count int not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (child_id, trigger_type)
);
create index on contract_dispatch_jobs (status);

alter table contract_dispatch_jobs enable row level security;
create policy "관리자만 조회" on contract_dispatch_jobs for select using (is_admin());
-- 쓰기는 SECURITY DEFINER 함수(enqueue_contract_dispatch_job, 앱 레이어의
-- service_role 디스패처)로만 — 일반 클라이언트에는 INSERT/UPDATE 정책을
-- 열지 않는다.

comment on table contract_dispatch_jobs is
  '체험 completed 또는 직접 계정 생성 시 자동 계약 발송을 큐잉하는 durable outbox. '
  '실제 DocuSign 호출은 여기서 하지 않는다 — 앱 레이어 워커가 이 테이블을 폴링해 처리한다.';

-- =========================================================================
-- 1) enqueue 헬퍼 — 멱등(이미 있으면 아무것도 안 함)
-- =========================================================================
create or replace function public.enqueue_contract_dispatch_job(
  p_child_id uuid,
  p_trigger_type text,
  p_subject_enrollment_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  insert into contract_dispatch_jobs (child_id, trigger_type, subject_enrollment_id)
  values (p_child_id, p_trigger_type, p_subject_enrollment_id)
  on conflict (child_id, trigger_type) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from contract_dispatch_jobs where child_id = p_child_id and trigger_type = p_trigger_type;
  end if;

  return v_id;
end;
$$;
revoke execute on function public.enqueue_contract_dispatch_job(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.enqueue_contract_dispatch_job(uuid, text, uuid) to service_role;

-- =========================================================================
-- 2) 트리거 지점 1 — 체험 수업 completed 전이
-- =========================================================================
create or replace function public.trg_enqueue_contract_dispatch_on_trial_completion()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_child_id uuid;
  v_is_trial boolean;
begin
  if new.final_status is distinct from 'completed' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.final_status = 'completed' then
    return new; -- 이미 completed였던 행의 다른 컬럼 UPDATE — 중복 큐잉 방지.
  end if;

  select (lt.code = 'trial') into v_is_trial
  from lesson_types lt where lt.id = new.lesson_type_id;
  if not coalesce(v_is_trial, false) then
    return new;
  end if;

  select child_id into v_child_id from subject_enrollments where id = new.subject_enrollment_id;
  if v_child_id is null then
    return new;
  end if;

  perform enqueue_contract_dispatch_job(v_child_id, 'completed_trial', new.subject_enrollment_id);
  return new;
end;
$$;

drop trigger if exists sessions_enqueue_contract_dispatch on sessions;
create trigger sessions_enqueue_contract_dispatch
  after insert or update of final_status on sessions
  for each row execute function public.trg_enqueue_contract_dispatch_on_trial_completion();

comment on function public.trg_enqueue_contract_dispatch_on_trial_completion() is
  '체험(lesson_types.code=''trial'') 세션이 처음으로 final_status=''completed''가 되는 '
  '순간에만 contract_dispatch_jobs에 큐잉한다. 취소·노쇼·기타 종료 상태는 무시한다.';

-- =========================================================================
-- 3) 트리거 지점 2 — 직접생성 경로 체험수업권 지급
-- =========================================================================
create or replace function public.grant_trial_entitlement_for_student(
  p_child_id uuid
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_existing_grant_id uuid;
  v_new_grant_id uuid;
  v_trial_product_id uuid;
  v_expires_at timestamptz;
begin
  if not exists (select 1 from profiles where id = p_child_id and role = 'student') then
    raise exception '학생 계정을 찾을 수 없습니다: %', p_child_id;
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
    raise exception '체험수업권 상품(trial_lesson_grant)이 존재하지 않습니다 — 마이그레이션 순서 문제.';
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
$$;
revoke execute on function public.grant_trial_entitlement_for_student(uuid) from public, anon, authenticated;
grant execute on function public.grant_trial_entitlement_for_student(uuid) to service_role;

comment on function public.grant_trial_entitlement_for_student(uuid) is
  'grant_trial_entitlement_for_consultation()의 지인/추천 직접생성 경로용 — consultation 없이 '
  '학생 id만으로 체험수업권 1장을 지급한다. '
  '2026-09-28: 지급 성공 시 contract_dispatch_jobs에 direct_account_created 작업을 큐잉한다.';
