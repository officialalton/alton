-- P2 9차 — 수업 중의 답안 기록이 실제로 남게 한다.
--
-- 2026-09-13 제품 오너: "수업 시작 후에는 이후 재공개·재구성과 무관하게 당시 버전과
-- **답안·풀이 기록**을 유지해주세요."
--
-- 버전 유지를 만들고 답안 기록을 확인하다 드러난 것:
--
--   session_problem_attempts.session_id → legacy_sessions(id)
--
-- R6 cutover(20260928000000)가 그 시점의 `sessions` 를 `legacy_sessions` 로 rename
-- 했는데, Postgres 의 RENAME 은 OID 기반이라 FK 가 새 이름을 그대로 따라갔다.
-- 20261235000000 이 homework_items 에서 같은 문제를 확인하고 우회했지만,
-- session_problem_attempts 는 그대로 남았다.
--
-- 그런데 앱은 v3 세션 id 를 넣는다(app/session/[id]/actions.ts):
--
--   insert into session_problem_attempts (session_id, ...) values (sessionId, ...)
--
-- 두 테이블은 id 를 공유하지 않으므로 **수업 중 문제를 풀면 FK 위반으로 실패한다.**
-- 세션 없이 푸는 복습(session_id = null)만 동작해 왔다.
--
-- 참조 대상을 지금의 sessions 로 옮긴다. 값은 하나도 버리지 않는다 — 옮길 수 없는
-- 행(레거시 세션을 가리키는 행)은 그 id 를 따로 보관한 뒤 null 로 둔다.

create table if not exists session_problem_attempt_legacy_links (
  attempt_id uuid primary key references session_problem_attempts (id) on delete cascade,
  legacy_session_id uuid not null,
  moved_at timestamptz not null default now()
);

comment on table session_problem_attempt_legacy_links is
  'P2 9차: FK 를 v3 sessions 로 옮기면서 옮길 수 없었던 레거시 세션 참조를 보관한다. '
  '값을 버리지 않기 위한 기록이고, 앱은 읽지 않는다.';

alter table session_problem_attempt_legacy_links enable row level security;
create policy "관리자만 조회" on session_problem_attempt_legacy_links for select using (is_admin());

insert into session_problem_attempt_legacy_links (attempt_id, legacy_session_id)
select a.id, a.session_id
from session_problem_attempts a
where a.session_id is not null
  and not exists (select 1 from sessions s where s.id = a.session_id)
on conflict (attempt_id) do nothing;

update session_problem_attempts a
set session_id = null
where a.session_id is not null
  and not exists (select 1 from sessions s where s.id = a.session_id);

alter table session_problem_attempts
  drop constraint session_problem_attempts_session_id_fkey;
alter table session_problem_attempts
  add constraint session_problem_attempts_session_id_fkey
  foreign key (session_id) references sessions (id) on delete set null;

comment on column session_problem_attempts.session_id is
  'P2 9차: 이 답안이 어느 수업에서 나왔는가. **v3 sessions 를 참조한다** — R6 cutover 뒤 '
  'legacy_sessions 를 가리키고 있어서 수업 중 제출이 FK 위반으로 실패했다. null 은 수업 '
  '밖 복습이다.';
