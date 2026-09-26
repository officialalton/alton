-- 대학 진학 정보 DB Part 3 — 전공 목록 + 재학생/입시 통계 확장(2026-09-19 제품 오너 지시).
-- 배경: docs/2026-09-19-college-db-part3-detail-page-scope.md
-- 정책: Part 2와 동일 — 합격 확률/가능성 예측 필드는 없음.

create table university_majors (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references universities(id) on delete cascade,
  name text not null,
  category text, -- 자유 텍스트 대분류(STEM/Business/Humanities 등), 정규화 테이블은 범위 밖(V1)
  created_at timestamptz not null default now(),
  unique (university_id, name)
);
comment on table university_majors is 'P3: 학교별 제공 전공 목록. 전공 상세 커리큘럼은 범위 밖.';

-- 연도별로 바뀔 수 있는 재학생/입시 통계이므로 university_admission_cycles에 추가한다(Part 2와 같은 원칙).
alter table university_admission_cycles
  add column pell_grant_pct numeric(5,2),
  add column student_faculty_ratio text,
  add column grad_rate_4yr numeric(5,2),
  add column grad_rate_6yr numeric(5,2),
  add column retention_rate numeric(5,2),
  add column total_applicants integer,
  add column yield_rate numeric(5,2),
  add column international_pct numeric(5,2),
  add column women_pct numeric(5,2);

create index if not exists idx_university_majors_university on university_majors(university_id);

alter table university_majors enable row level security;

drop policy if exists "university_majors 읽기: 인증 사용자 전원" on university_majors;
create policy "university_majors 읽기: 인증 사용자 전원" on university_majors for select
  using (auth.role() = 'authenticated');

drop policy if exists "university_majors 쓰기: 관리자만" on university_majors;
create policy "university_majors 쓰기: 관리자만" on university_majors for all
  using (is_admin()) with check (is_admin());
