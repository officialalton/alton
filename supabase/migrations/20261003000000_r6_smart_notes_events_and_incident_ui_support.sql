-- R6 10/N — Smart Notes 생성 이벤트 수신·연결 스키마. Workspace Events API가 보내는
-- Smart Notes 산출물 이벤트를 받아 세션·Drive file ID에 연결하는 자리를 만든다. 파일을
-- 실제 세션 폴더로 옮기거나 Drive ACL을 부여하는 것은 R8, 리뷰 생성·공개는 R9 범위이므로
-- 이 마이그레이션은 "받아서 연결"까지만 한다.
--
-- 정확한 Workspace Events/Meet API 페이로드 필드명은 이 마이그레이션 시점에는 실제
-- Sandbox 이벤트로 검증되지 않았다(제품 오너 승인 대기 중) — 스키마는 합리적인 최소
-- 컬럼(원본 payload 보존 jsonb 포함)으로 만들고, 실제 필드 매핑은 Sandbox 검증 단계에서
-- 확정한다(아래 lib/google-meet-events.ts 주석 참고).

create table smart_notes_generation_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions (id),
  google_meeting_code text,
  google_conference_record_name text,
  drive_file_id text,
  event_type text not null check (event_type in ('transcript_generated', 'smart_notes_document_generated', 'unrecognized')),
  linked boolean not null default false,
  raw_payload jsonb not null default '{}',
  received_at timestamptz not null default now()
);
create index on smart_notes_generation_events (session_id);
create index on smart_notes_generation_events (google_meeting_code);

comment on table smart_notes_generation_events is
  'R6: Workspace Events API로 수신한 Smart Notes/전사 산출물 이벤트의 원본 로그 + 세션 연결
  결과. 파일 이동·Drive ACL 부여는 R8, 리뷰 생성·학생/보호자 공개는 R9 범위 — 이 테이블은
  "받아서 연결"까지만 담당한다. linked=false인 채로 남은 행은 세션을 찾지 못한 경우(관리자
  수동 확인 대상, R9 GW-12 인수 기준과 동일한 성격).';

alter table smart_notes_generation_events enable row level security;
create policy "관련 세션 참여자/관리자 조회" on smart_notes_generation_events for select
  using (
    (session_id is not null and is_session_related_v3(session_id))
    or is_admin() or current_user_has_capability('예약관리권한')
  );
-- 쓰기는 client에서 하지 않는다 — webhook 핸들러가 service_role로만 insert/update한다.

-- sessions에 Smart Notes 산출물이 최종적으로 가리키는 Drive file ID를 기록할 자리.
-- R8이 이 파일을 세션 폴더로 옮긴 뒤 참조를 갱신할 수도 있으므로 nullable·update 가능.
alter table sessions add column smart_notes_drive_file_id text;

-- Meet 참가 기록 수집이 실제로 어느 세션의 것인지 찾을 때 reservations.google_event_id
-- (Calendar 이벤트 ID)만으로는 Meet API의 conferenceRecord/participant 이벤트와 바로
-- 매칭되지 않는 경우를 대비해, 세션이 실제로 사용한 Meet 회의 코드를 별도로 남겨둔다
-- (reservations.google_meet_link에서 파싱 가능하지만, 원본 문자열을 그대로도 보관).
alter table reservations add column google_meeting_code text;
