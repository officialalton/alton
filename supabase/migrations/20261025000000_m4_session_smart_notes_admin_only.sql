-- M4(사용자 확정, 2026-09-05): sessions.smart_notes_drive_file_id는 Smart Notes
-- 원본(Google Drive 문서) 식별자다. docs/CURRENT.md 정책 — "Smart Notes 원본은
-- 학생·보호자에게 직접 노출하지 않는다" — 이 sessions RLS(행 단위, `sessions
-- 조회` 정책)는 이 컬럼을 따로 가리지 않아 학생·보호자 본인 세션이면 직접
-- Supabase API로 원본 식별자를 그대로 조회할 수 있었다(코드 점검 발견, 실제 위반).
--
-- Postgres RLS는 행 단위라 "선생님 본인은 보이고 학생은 안 보이게"를 같은
-- authenticated role 안에서 컬럼 권한(GRANT/REVOKE)만으로는 구분할 수 없다
-- (컬럼 권한은 role 전체에 적용되지, auth.uid() 조건으로 나뉘지 않는다) — 그래서
-- 원본 식별자를 별도 테이블로 분리해 그 테이블의 RLS에서 "이 세션 담당 선생님
-- 또는 관리자/QC만" 조건을 건다.

create table session_smart_notes (
  session_id uuid primary key references sessions (id),
  drive_file_id text not null,
  created_at timestamptz not null default now()
);

alter table session_smart_notes enable row level security;

create policy "session_smart_notes 조회(담당 선생님·관리자·QC만)" on session_smart_notes for select
  using (
    exists (select 1 from sessions s where s.id = session_id and s.teacher_id = auth.uid())
    or is_admin()
    or current_user_has_capability('QC권한')
  );

-- 기존 sessions.smart_notes_drive_file_id에 이미 채워진 값을 그대로 이전한다.
insert into session_smart_notes (session_id, drive_file_id)
  select id, smart_notes_drive_file_id from sessions where smart_notes_drive_file_id is not null;

-- 원본 식별자는 이제 session_smart_notes에서만 산다 — sessions 쪽 컬럼은
-- 학생·보호자도 select 가능한 행 정책 아래 있으므로 완전히 제거한다(앱 코드는
-- 이 컬럼을 더 이상 읽거나 쓰지 않도록 함께 수정됨). smart_notes_status(상태
-- 문자열, 원본 식별자가 아님)는 그대로 sessions에 남는다 — 학생·보호자에게
-- "Smart Notes 연결 완료 여부" 정도는 보여줘도 되는 정보다.
alter table sessions drop column smart_notes_drive_file_id;
