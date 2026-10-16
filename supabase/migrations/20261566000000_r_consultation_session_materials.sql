-- Phase C(2026-09-23, 사용자 지시) — 상담 세션 화면.
-- "관리자가 상담용 기초자료를 등록·분류·공개합니다. 컨설턴트는 상담 세션
-- 안에서 허용된 자료를 열어 고객에게 설명할 수 있어야 합니다."
-- "자료 원본 다운로드와 공개 링크 노출을 제한하고 접근을 기록합니다."
--
-- 1차 범위(사용자 확정): 컨설턴트 개인 파일 업로드·고객 발송은 범위 밖.
-- 자료는 관리자가 등록한 것만, 전체 컨설턴트에게 공개(카테고리 분류는
-- 있지만 세분화된 공개 대상 지정은 다음 라운드) — 그래도 "분류"는
-- category 컬럼으로 충족한다.

create table consultation_materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  -- 원본은 회사 Drive에 둔다(프로젝트 확정 정책) — 여기는 파일 자체가 아니라
  -- 참조만 가진다. drive_file_id가 있으면 서버 경유 다운로드(document-access-audit
  -- 패턴)로, 없고 external_url만 있으면 새 탭 열람만 허용한다(원본 다운로드 경로
  -- 자체가 없음).
  drive_file_id text,
  external_url text,
  description text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint consultation_materials_has_source check (drive_file_id is not null or external_url is not null)
);
create index on consultation_materials (archived_at);

comment on table consultation_materials is
  '2026-09-23(Phase C) — 관리자가 등록하는 상담 기초자료. 전체 컨설턴트에게
  공개된다(archived_at is null인 것만). 컨설턴트 개인 업로드는 없다.';

alter table consultation_materials enable row level security;
create policy "관리자 전체 관리" on consultation_materials for all using (is_admin()) with check (is_admin());
create policy "컨설턴트 공개 자료 조회" on consultation_materials for select
  using (archived_at is null and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'consultant'));

-- =========================================================================
-- 상담 세션 메모 — 상담(consultations) 또는 개인 면담(meeting_requests) 하나당
-- 컨설턴트가 남기는 메모·다음 행동. 새 상태 컬럼을 두지 않는다 — "시작 전/
-- 진행 중/종료 후"는 starts_at/ends_at 기준으로 화면이 계산한다(사용자
-- 지시와 달리 별도 상태 머신을 만들 필요가 없어 더 단순한 설계).
-- =========================================================================
create table consultation_session_notes (
  id uuid primary key default gen_random_uuid(),
  source_kind text not null check (source_kind in ('consultation', 'meeting_request')),
  source_id uuid not null,
  consultant_id uuid not null references profiles (id),
  note text,
  next_action text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (source_kind, source_id)
);

comment on table consultation_session_notes is
  '2026-09-23(Phase C) — 상담 세션 화면에서 컨설턴트가 남기는 메모·다음
  행동. source_kind/source_id로 consultations 또는 meeting_requests 한
  건을 가리킨다(둘 중 FK 하나만 유효하므로 다형 참조 — 더 어긋나지 않게
  앱 레이어에서 존재 여부를 검사한다).';

alter table consultation_session_notes enable row level security;
create policy "관리자 전체 조회" on consultation_session_notes for select using (is_admin());
create policy "본인 컨설턴트 조회·기록" on consultation_session_notes for all
  using (consultant_id = auth.uid()) with check (consultant_id = auth.uid());

-- document_access_events(P4-3)의 target_kind에 상담 자료 열람 기록을
-- 추가한다(사용자 지시: "접근을 기록합니다") — 기존 계약·서류 감사와
-- 같은 테이블·같은 패턴을 재사용한다.
alter table document_access_events
  drop constraint if exists document_access_events_target_kind_check;
alter table document_access_events
  add constraint document_access_events_target_kind_check
  check (target_kind in ('contract_artifact', 'teacher_document', 'company_document', 'consultation_material'));
