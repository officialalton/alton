-- 대학 진학 정보 DB Part 11 — Overview/Admissions/Cost & Aid 확장(2026-09-23 지시서).
-- 기존 universities/university_admission_cycles/university_admission_metrics/
-- university_majors/university_essay_prompts/university_source_urls는 그대로 두고
-- (지시서: "기존 데이터를 보존하는 방식으로 확장"), 부족한 항목만 additive로 늘린다.
--
-- 새로 필요한 개념 4가지:
--   1) 학교 기본 연락처(주소·전화) — universities에 컬럼 추가(설정성 정보, 자주 안 바뀜).
--   2) 소속·인증 태그(Ivy League, NCAA 종목 등) — 항목마다 개별 출처가 필요해서
--      (지시서: "확인되지 않은 홍보성 태그는 만들지 않음") 별도 테이블로 분리.
--   3) 재학생 구성(성별·인종/민족) — 입시 코호트(지원자/합격자/등록자)와는 다른 개념
--      (재학 중인 전체 학생 구성)이고, 집계 대상(전체 학생 vs 미국 내 학생)이 값마다
--      다를 수 있어 population_scope 차원이 필요 — university_admission_metrics의
--      cohort(지원자/합격자/등록자) 개념과 안 맞아 별도 테이블로 분리.
--   4) 재정지원 프로그램(장학금·대출·근로장학) — 이름·자격요건·시민권 범위·갱신조건 등
--      스칼라 값 하나로 표현 안 되는 구조라 별도 테이블.
-- 그 외 단순 수치(재학생 총수 등)는 기존 university_admission_metrics에 metric_key만
-- 추가해서 재사용한다(지시서: "기존 테이블을 먼저 검토하고 재사용").

-- =========================================================================
-- 1. universities — 공식 주소·전화(설정성 정보, additive 컬럼).
-- =========================================================================
alter table universities
  add column if not exists official_address text,
  add column if not exists official_phone text;

comment on column universities.official_address is '학교가 공식 발행한 주소 원문(우편번호 포함) — 공식 출처 확인 후에만 입력.';
comment on column universities.official_phone is '학교 공식 대표 전화번호.';

-- =========================================================================
-- 2. university_admission_metrics — "0/해당없음/미공개/미수집" 구분 + 신규 metric_key.
-- =========================================================================

-- 값이 없는 이유가 "실제로 0"인지 "그 학교엔 해당 없음"인지 "학교가 공개 안 함"인지
-- "우리가 아직 못 모음"인지 구분한다. 마지막 경우는 행 자체가 없는 것으로 표현하므로
-- (이미 그렇게 쓰고 있었음) 여기서는 나머지 세 가지만 명시적으로 구분한다.
alter table university_admission_metrics
  add column if not exists value_status text not null default 'reported'
    check (value_status in ('reported', 'not_applicable', 'not_disclosed_by_school'));

comment on column university_admission_metrics.value_status is
  '''reported''(value/value_text에 실제 값 있음) / ''not_applicable''(그 학교엔 해당 없는 항목,
  예: 커뮤니티칼리지의 SAT 요구) / ''not_disclosed_by_school''(학교가 공개하지 않음, 0이 아님).
  "아직 수집하지 못함"은 행 자체가 없는 것으로 표현(추측 삽입 금지 원칙과 일치).';

alter table university_admission_metrics
  drop constraint university_admission_metrics_metric_key_check;

alter table university_admission_metrics
  add constraint university_admission_metrics_metric_key_check
  check (
    metric_key = any (array[
      'sat_total_25','sat_total_50','sat_total_75',
      'sat_ebrw_25','sat_ebrw_50','sat_ebrw_75',
      'sat_math_25','sat_math_50','sat_math_75',
      'act_composite_25','act_composite_50','act_composite_75',
      'act_math_25','act_math_50','act_math_75',
      'act_english_25','act_english_50','act_english_75',
      'act_writing_25','act_writing_50','act_writing_75',
      'act_science_25','act_science_50','act_science_75',
      'act_reading_25','act_reading_50','act_reading_75',
      'sat_submitted_pct','act_submitted_pct',
      'gpa_average','top10pct_pct','ap_ib_indicator',
      'gpa_4_0_pct_all','gpa_4_0_pct_submitters','gpa_4_0_pct_nonsubmitters',
      'applicants_count','admitted_count','enrolled_count',
      'admit_rate','yield_rate',
      'waitlist_offered','waitlist_accepted','waitlist_admitted',
      'retention_rate_year1','grad_rate_6yr',
      'tuition_total',
      -- Part 11 신규: 재학생 총수(입시 코호트와 무관한 "현재 재학 중" 개념).
      'total_undergrad_enrollment'
    ])
  );

-- =========================================================================
-- 3. university_affiliations — 소속·태그(Ivy League, NCAA 종목 등). 항목마다
--    개별 출처·검증상태를 요구해 뭉뚱그린 배열 컬럼 대신 테이블로 둔다.
-- =========================================================================
create table if not exists university_affiliations (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references universities(id) on delete cascade,
  kind text not null check (kind in ('ncaa_sport', 'athletic_conference', 'ivy_league', 'consortium', 'other')),
  label text not null,
  division text, -- NCAA Division I/II/III 등(kind='ncaa_sport'일 때만 의미 있음)
  source_url_id uuid references university_source_urls(id) on delete set null,
  verification_status text not null default 'unverified' check (verification_status in ('official', 'secondary', 'unverified')),
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table university_affiliations is
  '학교 소속·인증 태그(Ivy League, NCAA 종목 등) — 홍보성 문구를 그대로 옮기지 않고
  항목마다 공식 출처를 연결한다. verification_status=''unverified''인 항목은
  공개 화면에 노출하지 않는다(RLS는 university_source_urls와 같은 패턴).';

create index if not exists idx_university_affiliations_university on university_affiliations(university_id);

alter table university_affiliations enable row level security;

create policy "university_affiliations_select_verified"
  on university_affiliations for select
  using (verification_status in ('official', 'secondary'));

create policy "university_affiliations_admin_all"
  on university_affiliations for all
  using (is_admin())
  with check (is_admin());

-- =========================================================================
-- 4. university_demographics — 재학생 구성(성별·인종/민족). 입시 코호트가 아니라
--    "현재 재학 중" 학생 집단의 구성이고, 집계 대상(전체 학생 vs 미국 내 학생만)이
--    항목마다 다를 수 있어 population_scope로 명시한다.
-- =========================================================================
create table if not exists university_demographics (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references universities(id) on delete cascade,
  cycle_year integer not null,
  category text not null check (category in (
    'gender_male', 'gender_female', 'gender_other',
    'race_white', 'race_black', 'race_hispanic', 'race_asian_pacific_islander',
    'race_native_american', 'race_two_or_more', 'race_unknown', 'race_international'
  )),
  -- 'all_students'=전체 재학생 대상 집계, 'us_students_only'=미국 내(국내) 학생만 대상
  -- (원문이 "Among domestic students"처럼 범위를 명시하는 경우가 많음 — 그 범위를 보존).
  population_scope text not null default 'all_students' check (population_scope in ('all_students', 'us_students_only')),
  pct numeric,
  value_status text not null default 'reported' check (value_status in ('reported', 'not_applicable', 'not_disclosed_by_school')),
  source_url_id uuid references university_source_urls(id) on delete set null,
  verification_status text not null default 'unverified' check (verification_status in ('official', 'secondary', 'unverified')),
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (university_id, cycle_year, category, population_scope)
);

comment on table university_demographics is
  '재학생 구성(성별·인종/민족) — university_admission_metrics의 지원자/합격자/등록자
  코호트와는 다른 개념(현재 재학 중인 학생 집단)이라 분리했다. population_scope로
  "전체 학생" vs "미국 내 학생만" 집계 대상을 명시(원문 분류 보존, 섞지 않음).';

create index if not exists idx_university_demographics_university on university_demographics(university_id, cycle_year);

alter table university_demographics enable row level security;

create policy "university_demographics_select_verified"
  on university_demographics for select
  using (verification_status in ('official', 'secondary'));

create policy "university_demographics_admin_all"
  on university_demographics for all
  using (is_admin())
  with check (is_admin());

-- =========================================================================
-- 5. university_financial_aid_programs — 장학금·대출·근로장학. 이름·자격요건·
--    시민권 범위·갱신조건이 있는 구조라 스칼라 수치 하나로 표현할 수 없다.
-- =========================================================================
create table if not exists university_financial_aid_programs (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references universities(id) on delete cascade,
  program_type text not null check (program_type in ('need_based_grant', 'merit_scholarship', 'federal_loan', 'work_study')),
  name text not null,
  description text,
  -- 'us_citizen_permanent_resident'=미국 시민·영주권자만 대상(연방 대출·근로장학 등이 보통 여기),
  -- 'all_students'=국제학생 포함 전원 대상, 'other'=학교별 별도 조건(설명에 명시).
  eligibility_scope text not null default 'other' check (eligibility_scope in ('us_citizen_permanent_resident', 'all_students', 'other')),
  recipient_pct numeric,
  avg_award_amount numeric,
  award_amount_min numeric,
  award_amount_max numeric,
  renewal_condition text,
  cycle_year integer,
  value_status text not null default 'reported' check (value_status in ('reported', 'not_applicable', 'not_disclosed_by_school')),
  source_url_id uuid references university_source_urls(id) on delete set null,
  verification_status text not null default 'unverified' check (verification_status in ('official', 'secondary', 'unverified')),
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table university_financial_aid_programs is
  '장학금(need_based_grant/merit_scholarship)·연방 대출(federal_loan)·근로장학(work_study).
  eligibility_scope=''us_citizen_permanent_resident''인 프로그램은 국제학생 화면에서
  적용 가능한 것처럼 보이지 않게 반드시 구분 표시한다(지시서 요구사항).';

create index if not exists idx_university_financial_aid_programs_university on university_financial_aid_programs(university_id, cycle_year);

alter table university_financial_aid_programs enable row level security;

create policy "university_financial_aid_programs_select_verified"
  on university_financial_aid_programs for select
  using (verification_status in ('official', 'secondary'));

create policy "university_financial_aid_programs_admin_all"
  on university_financial_aid_programs for all
  using (is_admin())
  with check (is_admin());

-- =========================================================================
-- 6. university_majors — 전공/학위/트랙 구분(지시서: "혼동하지 않도록 데이터 구분").
-- =========================================================================
alter table university_majors
  add column if not exists degree_level text, -- 예: 'BA','BS','BFA','BEng' — 학교가 공식 표기한 그대로
  add column if not exists is_track boolean not null default false,
  add column if not exists parent_major_id uuid references university_majors(id) on delete set null;

comment on column university_majors.degree_level is '학교 카탈로그가 표기한 학위 레벨(예: BA/BS) — 확인 안 되면 null(추측 금지).';
comment on column university_majors.is_track is 'true면 이 행은 독립 전공이 아니라 상위 전공(parent_major_id) 아래의 세부 트랙.';
comment on column university_majors.parent_major_id is 'is_track=true일 때 상위 전공 id. 독립 전공이면 null.';

-- =========================================================================
-- 7. university_update_proposals — 새 테이블도 봇/관리자 변경안 검토 대상에 포함.
-- =========================================================================
alter table university_update_proposals
  drop constraint university_update_proposals_target_table_check;

alter table university_update_proposals
  add constraint university_update_proposals_target_table_check
  check (target_table in (
    'university_admission_metrics', 'university_essay_prompts', 'university_admission_cycles',
    'universities', 'university_affiliations', 'university_demographics',
    'university_financial_aid_programs', 'university_majors', 'other'
  ));

-- =========================================================================
-- 8. university_source_urls — 새 항목(재학생 구성·재정지원)을 가리키는 출처 유형 추가.
-- =========================================================================
alter table university_source_urls
  drop constraint university_source_urls_source_type_check;

alter table university_source_urls
  add constraint university_source_urls_source_type_check
  check (source_type in (
    'admissions_homepage', 'common_data_set', 'catalog_programs', 'deadlines',
    'essay_prompts', 'admitted_profile', 'financial_aid', 'demographics', 'other'
  ));
