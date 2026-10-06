-- 2026-10-07 보존 관리자 화면 — 삭제 큐 '지금 재시도'(실패 건을 다시 대기열로) + 이벤트 기록. 추가 전용.
-- 배치·cron·Drive 삭제 플래그는 건드리지 않는다. 수동 삭제·완료 처리 경로는 만들지 않는다.
-- 롤백: retention_retry_deletion_target 함수·retention_deletion_events 테이블 drop.

create table retention_deletion_events (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references retention_deletion_targets (id),
  event_type text not null check (event_type in ('manual_retry')),
  actor_id uuid references profiles (id),
  note text,
  created_at timestamptz not null default now()
);
create index on retention_deletion_events (target_id, created_at);

create or replace function public.reject_retention_deletion_events_mutation() returns trigger
language plpgsql as $$ begin raise exception 'retention_deletion_events는 INSERT-only입니다.'; end $$;
create trigger retention_deletion_events_no_update before update or delete on retention_deletion_events
  for each row execute function public.reject_retention_deletion_events_mutation();
revoke execute on function public.reject_retention_deletion_events_mutation() from public, anon, authenticated, service_role;

alter table retention_deletion_events enable row level security;
create policy "관리자 조회" on retention_deletion_events for select using (is_admin());
-- insert 정책 없음: 아래 DEFINER 함수로만 기록.

-- failed 건만 다시 대기열(pending, 즉시 대상)로. 지정자·마스터 관리자만. 활성 hold 가 걸린 건은 거부.
-- 삭제 실행 자체는 기존 워커(claim)가 한다 — 여기서는 상태 되돌림과 기록만.
create or replace function public.retention_retry_deletion_target(p_id uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare t retention_deletion_targets%rowtype; v_child uuid; v_enr uuid;
begin
  if not (is_legal_hold_holder() or is_master_admin()) then
    raise exception '지정된 legal hold 담당자 또는 마스터 관리자만 재시도할 수 있습니다.';
  end if;
  select * into t from retention_deletion_targets where id = p_id for update;
  if not found then raise exception '삭제 대기 건을 찾을 수 없습니다.'; end if;
  if t.status <> 'failed' then raise exception '실패(failed) 상태의 건만 재시도할 수 있습니다.'; end if;
  if has_active_legal_hold('global', null) then raise exception '활성 legal hold(전체)가 있어 재시도할 수 없습니다.'; end if;
  if t.session_id is not null then
    select se.id, se.child_id into v_enr, v_child
      from sessions s left join subject_enrollments se on se.id = s.subject_enrollment_id where s.id = t.session_id;
    if has_active_legal_hold('session', t.session_id) or has_active_legal_hold('enrollment', v_enr)
       or has_active_legal_hold('student', v_child) then
      raise exception '활성 legal hold가 걸린 건은 재시도할 수 없습니다.';
    end if;
  end if;
  update retention_deletion_targets set status = 'pending', next_attempt_at = now() where id = p_id;
  insert into retention_deletion_events (target_id, event_type, actor_id, note) values (p_id, 'manual_retry', auth.uid(), p_note);
end $$;
revoke execute on function public.retention_retry_deletion_target(uuid, text) from public, anon;
grant execute on function public.retention_retry_deletion_target(uuid, text) to authenticated;
