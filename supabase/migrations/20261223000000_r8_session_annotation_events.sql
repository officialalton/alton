-- R8 follow-up (2026-09-07) — 화이트보드/주석을 이벤트 로그로 기록하는 source of truth.
--
-- 배경: 현재 WhiteboardCanvas(app/session/[id]/WhiteboardCanvas.tsx)는 stroke를
-- Supabase Realtime broadcast로만 전파하고, 600ms debounce 후 legacy_sessions.
-- whiteboard_strokes(jsonb 배열, 마지막 상태만 보관)에 통짜로 덮어쓴다. 이 방식은
-- (1) 재접속 시 재생(replay)이 아니라 "마지막 스냅샷"만 복구 가능하고, (2) 두 명이
-- 동시에 그리면 나중에 저장을 마친 쪽이 먼저 그린 사람의 stroke를 통째로 덮어쓸 수
-- 있으며, (3) 감사 추적(누가 언제 무엇을 그렸는지)이 없다.
--
-- 이 마이그레이션은 v3 sessions 전용 append-only 이벤트 테이블을 새로 만든다.
-- 레거시 legacy_sessions.whiteboard_strokes는 그대로 두고 이 테이블에서 다루지
-- 않는다 — 두 트랙이 당분간 공존한다(레거시는 읽기 호환만 유지, 신규 쓰기는 v3
-- 세션에 대해서만 이 테이블에 쌓는다). 프론트엔드(WhiteboardCanvas)를 이 테이블에
-- 연결하는 작업과 레거시→신규 백필은 이번 라운드 범위가 아니다 — docs/CURRENT.md
-- "세션 주석 이벤트 로그 — 2-트랙 상태" 참고.

create table session_annotation_events (
  -- 서버가 부여하는 전역 단조 증가 시퀀스(bigserial/IDENTITY). 클라이언트 타임스탬프가
  -- 아니라 이 컬럼이 동시 편집 순서의 유일한 근거다: 두 클라이언트의 시계가 어긋나거나
  -- 같은 밀리초에 이벤트를 보내도, Postgres는 동시 INSERT를 반드시 직렬화하므로 이
  -- 컬럼 값의 대소 비교만으로 전체 순서가 always well-defined다. 세션별로 별도 카운터를
  -- 두지 않고 전역 시퀀스를 쓰는 이유: 세션별 카운터는 "다음 값 배정"에 행 잠금이
  -- 필요해 동시 세션 간에도 불필요한 직렬화를 유발하지만, 여기서는 세션 내부 순서만
  -- 보존하면 되므로 전역 시퀀스를 session_id로 필터링해서 읽는 것으로 충분하다.
  seq bigserial primary key,
  id uuid not null default gen_random_uuid(),
  session_id uuid not null references sessions (id),
  author_id uuid not null,
  -- 프론트엔드가 이미 broadcast하는 모양(WhiteboardCanvas.tsx)에 맞춘 이벤트 타입.
  -- 'clear_all'은 실제 삭제가 아니라 "여기까지의 모든 stroke를 리플레이 시 무시하라"는
  -- 이벤트로만 기록된다 — 아래 트리거가 UPDATE/DELETE를 전면 차단하므로 이전 stroke
  -- 행 자체는 영구 보존된다(append-only 감사 추적).
  event_type text not null check (event_type in ('stroke', 'clear_all')),
  -- 정규화 좌표(0.0~1.0, 캔버스 폭/높이에 독립적) + 도구별 부가 데이터를 담는다.
  -- stroke: {x0,y0,x1,y1,color,tool}, clear_all: {} (또는 {note}).
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index on session_annotation_events (session_id, seq);
create unique index on session_annotation_events (id);

comment on table session_annotation_events is
  'R8 follow-up: v3 세션 화이트보드/주석의 append-only 이벤트 로그(source of truth).
  seq(전역 bigserial)가 동시 편집의 유일한 순서 근거. clear_all은 삭제가 아니라
  이벤트로 기록되며, 이전 stroke는 영구 보존된다(트리거로 UPDATE/DELETE 전면 차단).
  레거시 legacy_sessions.whiteboard_strokes와는 별도 트랙 — 백필/통합은 이후 라운드.';

-- ---------------------------------------------------------------------------
-- append-only 강제: RLS로 UPDATE/DELETE 정책을 아예 안 주는 것만으로는 service_role
-- 경유 코드(관리자 도구, 향후 배치 등)가 RLS를 우회해 수정/삭제할 수 있다. 감사
-- 추적으로서 의미가 있으려면 role과 무관하게 원천 차단해야 하므로 트리거로 이중 방어한다.
create or replace function public.prevent_annotation_event_mutation()
returns trigger
language plpgsql as $$
begin
  -- 20261219000000_r8_material_version_lock.sql과 동일한 패턴: 앱 코드/RLS로는
  -- 절대 켤 수 없는 세션 로컬 GUC bypass만 정리/마이그레이션 작업(예: 테스트 fixture
  -- 정리, 탈퇴 회원 데이터 파기)에서 superuser가 명시적으로 사용한다.
  if coalesce(current_setting('app.bypass_annotation_lock', true), 'false') = 'true' then
    return coalesce(new, old);
  end if;
  raise exception 'session_annotation_events는 append-only입니다 — 수정/삭제할 수 없습니다.';
end;
$$;

create trigger session_annotation_events_no_update
  before update on session_annotation_events
  for each row execute function public.prevent_annotation_event_mutation();

create trigger session_annotation_events_no_delete
  before delete on session_annotation_events
  for each row execute function public.prevent_annotation_event_mutation();

revoke execute on function public.prevent_annotation_event_mutation() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- v3 세션의 담당 선생님인지 판정하는 헬퍼. is_session_related_v3(20260930 마이그레이션)는
-- 학생/보호자/선생님을 모두 포함하므로, "선생님만" 게이트인 clear_all 권한 체크에는
-- 별도로 좁힌 함수가 필요하다.
create or replace function public.is_session_teacher_v3(p_session_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.sessions s
    where s.id = p_session_id and s.teacher_id = auth.uid()
  );
$$;

alter table session_annotation_events enable row level security;

create policy "세션 당사자/관리자 조회" on session_annotation_events for select
  using (is_session_related_v3(session_id) or is_admin() or current_user_has_capability('예약관리권한'));

-- INSERT만 허용(UPDATE/DELETE 정책 없음 = RLS 기본 거부, 트리거로도 이중 차단).
-- clear_all은 선생님(또는 관리자)만 기록할 수 있다 — "전체 지우기"가 학생/보호자에게
-- 노출되지 않는 것과 별개로 DB 레이어에서도 role을 강제한다.
create policy "세션 당사자 기록, clear_all은 선생님만" on session_annotation_events for insert
  with check (
    author_id = auth.uid()
    and (is_session_related_v3(session_id) or is_admin())
    and (event_type <> 'clear_all' or is_session_teacher_v3(session_id) or is_admin())
  );

revoke all on session_annotation_events from public, anon;
grant select, insert on session_annotation_events to authenticated;
