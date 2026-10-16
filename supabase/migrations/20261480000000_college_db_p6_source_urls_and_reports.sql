-- 대학 진학 정보 DB Part 6 — 출처 URL 레지스트리(유형/연도/공식여부/상태 관리) +
-- 컨설턴트 제안→관리자 승인 흐름 + 공개 화면 오류 신고함.
--
-- 배경: docs/2026-09-19-ui-unification-spec.md 등 이전 라운드에서 마스터
-- 테이블(universities)에 고정 URL 컬럼 4개(admissions_homepage_url 등)만 있었고,
-- 유형별·연도별로 여러 개 URL을 신뢰도 있게 관리할 방법이 없었다. 이 마이그레이션은
-- 그 문제만 다룬다 — 수집봇/큐 등 자동화는 Part 7에서 이어간다.
--
-- 정책:
--   - 미승인(status != 'approved') URL은 공개 화면·수집 대상이 아니다(RLS로 강제).
--   - SSRF 방지: url은 http(s)만 허용(check 제약), 실제 요청은 이 테이블에 없다
--     (수집봇이 호출 시점에 스킴·사설 IP 재검사 — Part 7에서 구현).
--   - 컨설턴트는 pending으로만 insert 가능, 본인이 만든 pending만 조회, 승인/거절은
--     관리자(admin 클라이언트)만.

create table if not exists university_source_urls (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references universities(id) on delete cascade,
  url text not null check (url ~* '^https?://'),
  source_type text not null check (source_type in (
    'admissions_homepage', 'common_data_set', 'catalog_programs', 'deadlines',
    'essay_prompts', 'admitted_profile', 'financial_aid', 'other'
  )),
  cycle_year integer, -- null이면 연도 무관(홈페이지 등)
  is_official boolean not null default true, -- false=제3자 집계(예: CDS 미러 사이트)
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_by uuid references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table university_source_urls is
  '대학별 출처 URL 레지스트리 — 유형/연도/공식여부/승인상태. 미승인은 공개·수집 대상 아님(RLS).';

create index if not exists idx_university_source_urls_university on university_source_urls(university_id);
create index if not exists idx_university_source_urls_status on university_source_urls(status);

alter table university_source_urls enable row level security;

-- 공개 읽기(학생/보호자/컨설턴트 화면 등): 승인된 것만.
create policy "university_source_urls_select_approved"
  on university_source_urls for select
  using (status = 'approved');

-- 컨설턴트: 본인이 제안한 건(어떤 상태든) 조회 가능 — 반려 사유 확인용.
create policy "university_source_urls_select_own_submission"
  on university_source_urls for select
  using (submitted_by = auth.uid());

-- 컨설턴트: pending 상태로만, 본인 제출자 표시로만 insert 가능.
create policy "university_source_urls_insert_consultant"
  on university_source_urls for insert
  with check (
    status = 'pending'
    and submitted_by = auth.uid()
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('consultant', 'admin'))
  );

-- update/delete/승인은 관리자 전용(service_role) — 정책 없음 = RLS 기본 거부.

-- 공개 화면 어디서나 제기 가능한 오류 신고함.
create table if not exists university_data_reports (
  id uuid primary key default gen_random_uuid(),
  university_id uuid references universities(id) on delete set null,
  field_path text, -- 어느 필드/섹션에 대한 신고인지(자유 텍스트, 예: 'admission_cycles.2027.gpa_average')
  reported_value text, -- 신고 시점 화면에 보이던 값(스냅샷)
  message text not null,
  reporter_id uuid references auth.users(id),
  reporter_role text,
  status text not null default 'open' check (status in ('open', 'in_review', 'resolved', 'dismissed')),
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz not null default now()
);

comment on table university_data_reports is
  '공개 대학 정보 화면(학생/보호자/컨설턴트)에서 제기하는 오류 신고 — 관리자 처리함(status).';

create index if not exists idx_university_data_reports_status on university_data_reports(status);
create index if not exists idx_university_data_reports_university on university_data_reports(university_id);

alter table university_data_reports enable row level security;

-- 로그인한 누구나 신고 생성 가능(본인 명의로만).
create policy "university_data_reports_insert_authenticated"
  on university_data_reports for insert
  with check (reporter_id = auth.uid());

-- 본인이 낸 신고는 본인이 조회 가능(처리 상태 확인용).
create policy "university_data_reports_select_own"
  on university_data_reports for select
  using (reporter_id = auth.uid());

-- 처리(update)는 관리자 전용(service_role) — 정책 없음 = RLS 기본 거부.
