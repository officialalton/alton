-- P4-3 2단계 — 문서 접근 감사(INSERT-only).
--
-- 계약 서명본과 교사 제출 서류는 둘 다 민감하다(교사 서류에는 납세자번호가
-- 담긴다). 누가·무엇을·언제 내려받았는지 남긴다.
--
-- **링크 발급과 실제 다운로드를 구분한다.** 계약은 서버가 바이트를 직접
-- 흘려보내므로 완료를 기록할 수 있지만, 교사 서류는 서명 URL을 내주는 방식이라
-- 발급까지만 보장된다. 같은 표에 담되 action 값으로 무엇을 보장하는 기록인지
-- 구분한다 — 발급을 완료로 기록하지 않는다.
create table document_access_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references profiles (id),
  target_kind text not null check (target_kind in ('contract_artifact', 'teacher_document')),
  -- drive_artifacts.id 또는 teacher_documents.id. 두 표를 가리키므로 FK를 걸지
  -- 않는다(원본이 지워져도 "누가 봤다"는 사실은 남아야 한다).
  target_id uuid not null,
  -- 문서의 귀속 대상(학생 또는 교사). 조회 편의용이다.
  subject_id uuid references profiles (id),
  action text not null check (action in ('download_url_issued', 'download_started', 'download_completed', 'download_failed')),
  -- 파일명·문서 종류·버전 같은 비민감 식별 정보만. 본문 내용은 절대 복제하지 않는다.
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on document_access_events (target_kind, target_id, created_at desc);
create index on document_access_events (actor_id, created_at desc);

comment on table document_access_events is
  'P4-3: 계약 서명본·교사 제출 서류 접근 감사. INSERT-only. action으로 링크 발급/다운로드 시작/완료/실패를 '
  '구분한다 — 발급만으로 완료로 기록하지 않는다. detail에는 비민감 식별 정보만 담는다.';
comment on column document_access_events.action is
  'download_url_issued: 서명 URL을 내줬다(실제 내려받았는지는 보장하지 않는다). '
  'download_started: 서버가 파일을 읽기 시작했다. download_completed: 바이트 전달까지 끝났다. '
  'download_failed: 시작했으나 실패했다.';

create or replace function public.reject_document_access_event_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'document_access_events는 INSERT-only입니다.';
end;
$$;
create trigger document_access_events_no_update
  before update or delete on document_access_events
  for each row execute function public.reject_document_access_event_mutation();
revoke execute on function public.reject_document_access_event_mutation() from public, anon, authenticated, service_role;

alter table document_access_events enable row level security;
-- 조회는 관리자만. 쓰기 정책은 두지 않는다 — 서버 액션(service_role)만 기록한다.
create policy "관리자 조회" on document_access_events for select using (is_admin());
revoke insert, update, delete, truncate on document_access_events from public, anon, authenticated;
grant select on document_access_events to authenticated;
