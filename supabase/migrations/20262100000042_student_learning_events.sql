-- 2026-10-06 Free Accounts S6 — 학습 이용 이벤트(오답노트 열람·단어 학습·자료 열람). PII 없음(학생·종류·ref·시각).
create table if not exists student_learning_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  kind text not null check (kind in ('mistake_review_opened', 'vocab_study_opened', 'material_opened')),
  ref_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists student_learning_events_student_idx on student_learning_events (student_id, kind, created_at desc);
create index if not exists student_learning_events_created_idx on student_learning_events (created_at);
alter table student_learning_events enable row level security;
comment on table student_learning_events is '학생 학습 이용 이벤트. 정책 없음 — log_learning_event RPC와 관리자 DEFINER RPC만 접근.';

-- 학생 본인만 기록. 같은 학생·종류·ref 의 10분 내 중복은 무시(직렬화해 동시 호출도 1행). 학생이 아니면(교사·보호자 등) 조용히 무시.
create or replace function public.log_learning_event(p_kind text, p_ref_id uuid default null) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return false; end if;
  if p_kind not in ('mistake_review_opened', 'vocab_study_opened', 'material_opened') then raise exception 'invalid_kind'; end if;
  if not exists (select 1 from students where id = v_uid) then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || p_kind || coalesce(p_ref_id::text, ''), 0));
  if exists (select 1 from student_learning_events where student_id = v_uid and kind = p_kind
               and ref_id is not distinct from p_ref_id and created_at > now() - interval '10 minutes') then
    return false;
  end if;
  insert into student_learning_events (student_id, kind, ref_id) values (v_uid, p_kind, p_ref_id);
  return true;
end $$;
revoke execute on function public.log_learning_event(text, uuid) from public, anon;
grant execute on function public.log_learning_event(text, uuid) to authenticated;
