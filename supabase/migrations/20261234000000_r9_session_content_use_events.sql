-- R9 — 레슨 준비 Task 3: "사용 처리" 이벤트 — 교사 전용, 세션 스코프, append-only.
--
-- 배경(docs/superpowers/plans/2026-09-08-lesson-prep-session-selection.md Task 3,
-- v4 확정): 세션 콘텐츠 매니페스트(Task 2, session_content_manifest)에 포함된
-- 교재 섹션/문제 중 실제로 수업 중 다뤘음을 선생님이 명시적으로 표시하는
-- 이벤트 로그. "봤다"(뷰/스크롤/탭 열기)는 절대 이 테이블에 자동으로 기록되지
-- 않는다 — 오직 명시적인 "사용 처리" 버튼 클릭(markMaterialUsedInLesson/
-- markProblemUsedInLesson)만 한 행을 남긴다. 범위(duration/구간)도 기록하지
-- 않는다 — 단일 시점 행이 전부다.
--
-- 핵심 설계 결정(계획서 그대로):
--   1) append-only: session_annotation_events(20261223000000_r8_session_
--      annotation_events.sql)와 동일한 패턴 — RLS에 UPDATE/DELETE 정책을 두지
--      않는 것(기본 거부)에 더해, role과 무관하게(service_role 경유 우회까지)
--      원천 차단하는 BEFORE UPDATE/DELETE 트리거로 이중 방어한다.
--   2) 매니페스트 멤버십 강제(이번 라운드 제품 오너가 지목한 핵심 구멍): 이
--      세션의 session_content_manifest에 존재하지 않는 (content_type,
--      content_id)를 "사용 처리"하는 것은 DB 레벨에서 거부되어야 한다. 다행히
--      session_content_manifest는 이미 unique(session_id, content_type,
--      content_id) 제약을 갖고 있으므로(Task 2), 별도 트리거 없이 그 제약을
--      그대로 겨냥하는 복합 외래키 하나로 충분하다 — 앱 레벨 체크가 아니라
--      진짜 FK 제약이다.
--   3) 권한: 세션 담당 선생님/관리자만 쓰기·읽기 모두 가능. 학생은 이 테이블을
--      전혀 읽거나 쓸 수 없다(decision 5 — annotation_events보다 좁다, 학생
--      확장은 이후 별도 라운드). "이 선생님이 이 세션 담당인가" 판정은 새
--      메커니즘을 만들지 않고 r8이 이미 도입한 is_session_teacher_v3(session_id)
--      (sessions.teacher_id = auth.uid())를 그대로 재사용한다.
--   4) content_type enum은 새로 만들지 않는다 — Task 1(20261232000000_r9_
--      session_prepared_selection.sql)이 이미 정의한
--      session_prepared_selection_content_type('material_section', 'problem')이
--      정확히 같은 값 집합이므로 그대로 재사용한다.

-- =========================================================================
-- 1. session_content_use_events — append-only 사용 처리 이벤트 로그.
-- =========================================================================

create table session_content_use_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id),
  content_type session_prepared_selection_content_type not null,
  content_id uuid not null,
  recorded_by uuid not null,
  recorded_at timestamptz not null default now(),
  -- 매니페스트 멤버십 강제: 이 세션의 매니페스트에 실제로 존재하는
  -- (content_type, content_id)만 참조할 수 있다. session_content_manifest의
  -- unique(session_id, content_type, content_id)(Task 2)를 그대로 겨냥한다.
  -- 대상 매니페스트 행이 삭제되는 일은 없으므로(불변 테이블, on delete cascade는
  -- 세션 삭제 시에만) ON DELETE 액션은 지정하지 않는다(기본 NO ACTION으로 충분).
  foreign key (session_id, content_type, content_id)
    references session_content_manifest (session_id, content_type, content_id)
);

create index on session_content_use_events (session_id, recorded_at);

comment on table session_content_use_events is
  'R9(레슨 준비 Task 3): 세션별 "사용 처리" append-only 이벤트 로그 — 선생님의
  명시적 버튼 클릭 한 번당 한 행. 뷰/스크롤 등 수동적 신호로는 절대 기록되지
  않는다. (session_id, content_type, content_id)는 그 세션의
  session_content_manifest에 실제로 존재하는 항목만 참조 가능(복합 FK). 교사/
  관리자만 읽기·쓰기 가능 — 학생은 전혀 접근 불가(annotation_events보다 좁은
  권한 경계, decision 5).';

-- ---------------------------------------------------------------------------
-- append-only 강제: session_annotation_events와 동일한 패턴 — RLS로 UPDATE/
-- DELETE 정책을 아예 안 주는 것(기본 거부)에 더해, role과 무관하게 원천
-- 차단하는 트리거로 이중 방어한다.
create or replace function public.prevent_content_use_event_mutation()
returns trigger
language plpgsql as $$
begin
  -- 어떤 설정 가능한 탈출구도 두지 않는다 — PostgreSQL 커스텀 GUC는
  -- authenticated를 포함한 어떤 역할이든 자신의 세션에서 SET으로 켤 수 있으므로
  -- (20261236000000_r9_corrective_remove_pin_lock_bypass.sql에서 실제로 증명된
  -- 취약점), "app.bypass_..." 류의 조건부 우회는 절대 사용하지 않는다. 테스트
  -- fixture 정리는 이 append-only 불변식을 우회하지 않고, 정리 대상에서
  -- 제외(excludeFromCleanup)한 뒤 supabase db reset --local에 맡긴다.
  raise exception 'session_content_use_events는 append-only입니다 — 수정/삭제할 수 없습니다.';
end;
$$;

create trigger session_content_use_events_no_update
  before update on session_content_use_events
  for each row execute function public.prevent_content_use_event_mutation();

create trigger session_content_use_events_no_delete
  before delete on session_content_use_events
  for each row execute function public.prevent_content_use_event_mutation();

revoke execute on function public.prevent_content_use_event_mutation() from public, anon, authenticated, service_role;

-- =========================================================================
-- 2. RLS — 교사(세션 담당)/관리자만 읽기·쓰기. 학생은 정책이 아예 없으므로
-- (select/insert 모두) RLS 기본 거부로 전혀 접근할 수 없다.
-- =========================================================================

alter table session_content_use_events enable row level security;

create policy "담당 선생님/관리자만 조회" on session_content_use_events for select
  using (is_session_teacher_v3(session_id) or is_admin());

create policy "담당 선생님/관리자만 기록" on session_content_use_events for insert
  with check (
    recorded_by = auth.uid()
    and (is_session_teacher_v3(session_id) or is_admin())
  );

-- UPDATE/DELETE 정책 없음 = RLS 기본 거부(위 트리거로 이중 방어).
revoke all on session_content_use_events from public, anon;
grant select, insert on session_content_use_events to authenticated;
