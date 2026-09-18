-- 대학 진학 정보 DB Part 2 — 마스터 테이블 + 연도별 입시 사이클 + 업데이트 타임라인.
-- 배경: docs/2026-09-19-top200-us-universities-source-registry.csv (Part 1, 200개교 소스 레지스트리).
-- 정책: 합격 확률/가능성 예측 기능은 이번 범위에 없음(로드맵 V1과 동일 원칙 — 실 결과 데이터 +
-- 검증된 모델 없이는 금지). 이 마이그레이션은 데이터만 다룬다.
--
-- 스키마 설계:
--   universities                 — 자주 안 바뀌는 기본 정보(이름/국가/소재지/랭킹/공사립/지원플랫폼) + 소스 레지스트리
--   university_admission_cycles  — (university_id, cycle_year) 단위로 매년 바뀌는 시험정책/학업요건/일정/서류요건/합격률
--   university_updates           — 대학별 뉴스·정책변경 타임라인(자유 텍스트)
--
-- 향후 통합 지점: `feature/student-roadmap-v1`(미병합)이 만들 관심 대학 기능은
-- `college_interests.university_id -> universities.id` FK로 이 테이블을 참조하면 된다.
-- 이 마이그레이션은 그 테이블을 만들지 않는다(다른 브랜치 소관).

create table if not exists universities (
  id uuid primary key default gen_random_uuid(),
  rank_final integer,
  rank_confidence text,
  name text not null,
  country text not null default 'United States',
  city text,
  state text,
  public_private text check (public_private in ('Public', 'Private')),
  application_platform text, -- 'Common App' | 'Coalition' | '자체' 등 자유 텍스트(V1)
  strengths_programs text[], -- 강점 전공·특화 프로그램(자유 목록, 정규화 테이블은 범위 밖)
  admissions_homepage_url text,
  common_data_set_url text,
  catalog_programs_url text,
  deadlines_url text,
  url_verification_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, country)
);

comment on table universities is '대학 마스터 정보 — 자주 안 바뀌는 필드만. 연도별 데이터는 university_admission_cycles.';

create table if not exists university_admission_cycles (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references universities(id) on delete cascade,
  cycle_year integer not null, -- 예: 2027 = 2026-2027 지원 사이클(2027년 가을 입학)

  -- 시험 정책
  test_policy text check (test_policy in ('required', 'optional', 'not_considered')),
  sat_ebrw_25 integer,
  sat_ebrw_75 integer,
  sat_math_25 integer,
  sat_math_75 integer,
  act_composite_25 integer,
  act_composite_75 integer,
  toefl_min integer,
  ielts_min numeric(3,1),

  -- 학업 요건
  gpa_25 numeric(3,2),
  gpa_75 numeric(3,2),
  gpa_average numeric(3,2),
  recommended_coursework text,
  ap_ib_policy text,

  -- 지원 일정
  ed_deadline date,
  ea_deadline date,
  rd_deadline date,
  ed_decision_date date,
  ea_decision_date date,
  rd_decision_date date,
  application_fee numeric(8,2),

  -- 서류 요건
  essay_count integer,
  essay_topics text,
  recommendation_letter_count integer,
  portfolio_required boolean not null default false,
  interview_required boolean,

  -- 종합 평가 참고(선택) — 확률/가능성 예측 아님, 공개된 과거 실적 수치일 뿐.
  acceptance_rate numeric(5,2),
  cds_factors_weighting jsonb, -- Common Data Set에 공개된 평가요소 비중 원문 그대로 구조화

  source_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (university_id, cycle_year)
);

comment on table university_admission_cycles is '대학×입시연도 단위 가변 데이터. 합격확률 예측 필드는 의도적으로 없음(정책상 금지).';

create table if not exists university_updates (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references universities(id) on delete cascade,
  title text not null,
  update_date date not null,
  summary text,
  source_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_university_admission_cycles_university on university_admission_cycles(university_id);
create index if not exists idx_university_updates_university on university_updates(university_id);
create index if not exists idx_universities_rank on universities(rank_final);
create index if not exists idx_universities_name_lower on universities (lower(name));

-- updated_at 자동 갱신 (다른 마이그레이션들과 동일 패턴)
create or replace function trg_set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at_universities on universities;
create trigger set_updated_at_universities before update on universities
  for each row execute function trg_set_updated_at();

drop trigger if exists set_updated_at_university_admission_cycles on university_admission_cycles;
create trigger set_updated_at_university_admission_cycles before update on university_admission_cycles
  for each row execute function trg_set_updated_at();

alter table universities enable row level security;
alter table university_admission_cycles enable row level security;
alter table university_updates enable row level security;

-- 공개 참고 데이터: 인증된 사용자는 전원 읽기 가능(학생/학부모/선생님/관리자), 쓰기는 관리자만.
drop policy if exists "universities 읽기: 인증 사용자 전원" on universities;
create policy "universities 읽기: 인증 사용자 전원" on universities for select
  using (auth.role() = 'authenticated');

drop policy if exists "universities 쓰기: 관리자만" on universities;
create policy "universities 쓰기: 관리자만" on universities for all
  using (is_admin()) with check (is_admin());

drop policy if exists "university_admission_cycles 읽기: 인증 사용자 전원" on university_admission_cycles;
create policy "university_admission_cycles 읽기: 인증 사용자 전원" on university_admission_cycles for select
  using (auth.role() = 'authenticated');

drop policy if exists "university_admission_cycles 쓰기: 관리자만" on university_admission_cycles;
create policy "university_admission_cycles 쓰기: 관리자만" on university_admission_cycles for all
  using (is_admin()) with check (is_admin());

drop policy if exists "university_updates 읽기: 인증 사용자 전원" on university_updates;
create policy "university_updates 읽기: 인증 사용자 전원" on university_updates for select
  using (auth.role() = 'authenticated');

drop policy if exists "university_updates 쓰기: 관리자만" on university_updates;
create policy "university_updates 쓰기: 관리자만" on university_updates for all
  using (is_admin()) with check (is_admin());
