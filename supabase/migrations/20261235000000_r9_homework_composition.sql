-- R9 — 레슨 준비 Task 4: 과제 구성(homework composition) — 두 개의 독립 토글 +
-- 발급 시점 재검증.
--
-- 배경(docs/superpowers/plans/2026-09-08-lesson-prep-session-selection.md Task 4,
-- v4 확정): composeHomeworkFromSession(sessionId, keywordIds, count,
-- { includeUsedInLesson, includeAlreadyAttempted })가 문제를 골라 과제로
-- 발급하는 유일한 쓰기 경로. 후보 풀은 problem_keywords_selectable(코렉티브 2)을
-- "이 순간 다시" 확인해야 한다 — pin 시점(Task 2)과는 별개의, 이 계획서에서
-- 요구하는 두 번째 재검증 지점이다.
--
-- 스키마 결정(Task 4 체크리스트가 명시적으로 요구하는 사전 검토 — 가정하지 않고
-- 실제로 확인함):
--   기존 homework_items(20260827120000_initial_schema.sql)의 session_id는
--   `references sessions(id)`로 선언돼 있었지만, R6 cutover
--   (20260928000000_r6_sessions_cutover.sql)가 그 시점의 `sessions`를
--   `legacy_sessions`로 rename했다 — Postgres의 RENAME TABLE은 OID 기반이라
--   기존 FK 제약은 새 이름을 그대로 따라가므로, homework_items.session_id는
--   지금도 `legacy_sessions.id`를 참조한다(session_problem_attempts.session_id도
--   마찬가지). 반면 이번 라운드가 쓰는 세션 개념 — session_content_manifest
--   (Task 2)/session_content_use_events(Task 3)의 session_id — 는 전부 새
--   `sessions`(구 sessions_v3, subject_enrollment_id/teacher_id/final_status를
--   가진 테이블)를 참조한다. 즉 homework_items는 이번 계획서의 세션 개념과
--   FK 타겟 자체가 다른 완전히 별개의(레거시) 테이블이다 — 컬럼을 추가해도
--   session_id가 여전히 legacy_sessions를 가리키므로 재사용할 수 없다.
--   그래서 homework_items에 컬럼을 얹지 않고, 새 join 테이블
--   `session_homework_items`를 만든다(계획서 Task 4의 "또는 기존 스키마가 두
--   토글 플래그를 담을 수 없다면 새 join 테이블" 대안을 그대로 취함). 두 토글의
--   "담을 플래그"는 각 발급된 문제 행에 대해 "이 문제가 이 세션에서 실제로
--   used-in-lesson 처리됐었는지"/"이 학생이 이미 풀어본 적이 있는지"를
--   발급 시점 감사 기록으로 남기는 boolean 두 개로 구현한다(토글 자체는 후보
--   풀 필터링에 쓰이고, 이 두 컬럼은 "그 필터링 결과 이 문제가 어느 쪽에
--   해당했는지"의 스냅샷이다).

-- =========================================================================
-- 1. session_homework_items
-- =========================================================================

create table session_homework_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id),
  problem_id uuid not null references problems (id),
  student_id uuid not null references students (id),
  position int not null,
  -- 발급 시점 감사 스냅샷(토글 자체의 저장이 아니라 "이 문제가 그 순간 각
  -- 카테고리에 해당했는가") — composeHomeworkFromSession()만 채운다.
  was_used_in_lesson boolean not null default false,
  was_already_attempted boolean not null default false,
  composed_by uuid not null references profiles (id),
  composed_at timestamptz not null default now(),
  unique (session_id, problem_id)
);
create index on session_homework_items (session_id);
create index on session_homework_items (student_id);

comment on table session_homework_items is
  'R9(레슨 준비 Task 4): composeHomeworkFromSession()이 발급한 과제 문제 목록.
  기존 homework_items는 legacy_sessions를 참조하는 별개 테이블이라(위 주석 참고)
  재사용하지 않는다. 이 테이블은 항상 confirmed 문제만 참조하도록 트리거로
  DB 레벨에서 강제된다(앱 코드의 재검증과는 별개의 방어선).';

-- =========================================================================
-- 2. confirmed 게이트 — 발급 시점에 confirmed가 아닌 문제는 DB 레벨에서 거부.
--    check_problem_keyword_confirmed()와 같은 성격(이름은 다르지만 같은 엄격도)의
--    독립 트리거 — 앱 코드가 필터링을 실수하거나, 이 테이블에 직접 SQL로
--    insert를 시도해도 뚫리지 않는다.
-- =========================================================================

-- security definer로 선언한다: 이 트리거는 "problems.status가 confirmed인가"라는
-- 순수한 무결성 검사이지 가시성(RLS) 검사가 아니다. plain trigger로 두면
-- INSERT를 실행하는 호출자 role의 problems RLS(예: 담당 아닌 다른 선생님에게는
-- published 교재의 문제도 enrollment가 없으면 안 보임, 20260829000000)가 먼저
-- 적용되어 "confirmed가 아님"이 아니라 "존재하지 않음"으로 오탐하거나, 반대로
-- 검사 자체가 조용히 스킵될 수 있다 — 항상 실제 상태를 정확히 봐야 한다.
create or replace function public.check_homework_item_problem_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status problem_status;
begin
  select status into v_status from problems where id = new.problem_id;
  if v_status is null then
    raise exception '존재하지 않는 문제입니다: %', new.problem_id;
  end if;
  if v_status <> 'confirmed' then
    raise exception 'confirmed 상태가 아닌 문제는 과제로 발급할 수 없습니다: %', new.problem_id;
  end if;
  return new;
end;
$$;

comment on function public.check_homework_item_problem_confirmed() is
  'R9 Task 4: session_homework_items에 들어오는 problem_id가 항상 confirmed인지
  INSERT/UPDATE 시점에 DB 레벨로 강제한다 — 앱 레이어의 problem_keywords_selectable
  재검증과 별개의, 우회 불가능한 방어선.';

create trigger session_homework_items_check_confirmed
  before insert or update of problem_id on session_homework_items
  for each row execute function public.check_homework_item_problem_confirmed();

-- =========================================================================
-- 3. RLS — 세션 담당 선생님/관리자만 쓰기·읽기(session_content_use_events와
--    동일한 결정 5 — 학생은 이번 라운드에서 제외, 추후 별도 확장).
--    is_session_teacher_v3(session_id)를 그대로 재사용한다(새 인가 메커니즘을
--    만들지 않는다).
-- =========================================================================

alter table session_homework_items enable row level security;

create policy "선생님/관리자 조회" on session_homework_items for select
  using (is_session_teacher_v3(session_id) or is_admin());

create policy "선생님/관리자 생성" on session_homework_items for insert
  with check (is_session_teacher_v3(session_id) or is_admin());

revoke all on session_homework_items from public, anon;
grant select, insert on session_homework_items to authenticated;
