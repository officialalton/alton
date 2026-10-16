-- 2026-09-29 — 온보딩 간소화: 계약 자동 발송 큐 보강
--   1) trigger_type에 'regular_recommended'(상담사가 "바로 정규로 진행" 입력) 추가
--      + consultations 트리거로 큐잉. 이벤트 순서(결과 기록 먼저/자녀 확정 먼저)와
--      무관하게 동작하도록 admin_record_consultation_outcome()을 고치지 않고
--      consultations 행 자체(outcome·child_id 변경)에 건다.
--      자녀 미확정(child_id null)이면 큐잉하지 않고, 자녀가 연결되는 순간(UPDATE of child_id)
--      또는 자녀 카드가 outcome을 물려받아 insert되는 순간 큐잉한다.
--      자녀당·trigger_type당 1건 유니크 유지 — 중복 이벤트·재시도는 no-op.
--   2) 크론 워커용 원자적 claim RPC(for update skip locked) — 동시 실행 방지.
-- 되돌리기: 트리거·함수 drop, 체크 제약을 이전 2값으로 복원(단, 'regular_recommended' 행이 없을 때).
-- 기존 데이터 영향 없음(additive). DocuSign 호출 없음.

alter table contract_dispatch_jobs drop constraint if exists contract_dispatch_jobs_trigger_type_check;
alter table contract_dispatch_jobs add constraint contract_dispatch_jobs_trigger_type_check
  check (trigger_type in ('completed_trial', 'direct_account_created', 'regular_recommended'));

create or replace function public.trg_enqueue_contract_dispatch_on_regular_recommended()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.outcome is distinct from 'regular_recommended' or new.child_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.outcome is not distinct from new.outcome and old.child_id is not distinct from new.child_id then
    return new;
  end if;
  perform enqueue_contract_dispatch_job(new.child_id, 'regular_recommended');
  return new;
end;
$$;

drop trigger if exists consultations_enqueue_contract_dispatch on consultations;
create trigger consultations_enqueue_contract_dispatch
  after insert or update of outcome, child_id on consultations
  for each row execute function public.trg_enqueue_contract_dispatch_on_regular_recommended();

comment on function public.trg_enqueue_contract_dispatch_on_regular_recommended() is
  'outcome=regular_recommended 이고 child_id가 확정된 순간(둘 중 나중에 채워지는 쪽)에 큐잉한다. 큐잉만 하고 발송하지 않는다.';

create or replace function public.claim_contract_dispatch_jobs(p_limit int default 20)
returns setof contract_dispatch_jobs
language sql security definer set search_path = public as $$
  update contract_dispatch_jobs j
  set status = 'processing', updated_at = now()
  where j.id in (
    select id from contract_dispatch_jobs
    where status in ('queued', 'retryable_failed')
       or (status = 'processing' and updated_at < now() - interval '15 minutes')
    order by created_at
    limit greatest(p_limit, 0)
    for update skip locked
  )
  returning j.*;
$$;
revoke execute on function public.claim_contract_dispatch_jobs(int) from public, anon, authenticated;
grant execute on function public.claim_contract_dispatch_jobs(int) to service_role;
