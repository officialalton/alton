-- 2026-09-17(보안 결함 — advisor 발견) — public.session_drive_tasks에 Row Level
-- Security가 꺼져 있어 anon/authenticated 키로 모든 행을 읽고 쓸 수 있는 상태였다.
--
-- 실제 접근 주체 조사: 이 테이블은 Drive 폴더 생성·권한 부여/회수·Smart Notes 열람
-- 권한 부여를 처리하는 내부 백그라운드 작업 큐다. 코드 전체(lib/drive-session-tasks.ts,
-- app/api/webhooks/workspace-events/route.ts)에서 이 테이블에 접근하는 경로는 전부
-- createAdminClient()(service_role)뿐이다 — 학생·학부모·교사·관리자 어떤 화면도 이
-- 테이블을 직접 조회하거나 쓰지 않는다(각자 화면은 session_smart_notes, sessions 등
-- 다른 정식 테이블을 통해서만 자료에 접근한다). payload에는 Drive file id·권한 부여
-- 대상 이메일 등 내부 처리 상세가 들어있어 학생 본인 것이라도 직접 노출할 이유가 없다.
--
-- 따라서 필요한 접근 수준은 "service_role만, 그 외 전부 차단"이다 — anon/authenticated
-- 에는 어떤 정책도 주지 않는다(기본값이 곧 전면 거부). service_role은 RLS 자체를
-- 우회하므로 기존 워커 동작에는 영향이 없다. "학생은 자기 자료만/교사는 담당
-- 수업만/관리자는 관리 범위만"에 해당하는 실제 열람 창구는 이미 session_smart_notes
-- RLS(20261388000000)와 sessions/session_curriculum_units 쪽 정책이 맡고 있고, 이
-- 내부 큐 테이블 자체에는 그런 세분화된 열람 권한을 줄 실제 사용처가 없다.
alter table public.session_drive_tasks enable row level security;

comment on table public.session_drive_tasks is
  '2026-09-17: RLS 활성화. anon/authenticated 정책 없음(전면 차단) — service_role
  (createAdminClient) 전용 내부 작업 큐다. 실 사용자 화면은 이 테이블을 직접 읽지
  않는다(session_smart_notes 등 정식 테이블을 통해서만 자료에 접근).';
