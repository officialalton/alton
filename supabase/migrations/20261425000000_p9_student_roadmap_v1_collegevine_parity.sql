-- P9 로드맵 V1 — CollegeVine 온보딩과 동일한 수준으로 수집 항목 확장(2026-09-19 제품 오너 지시).
--
-- 배경: 최초 구현(20261423000000)은 CollegeVine 참고 스크린샷 지시(2026-09-19, 프로필 상세화 addendum)
-- 이전에 만들어져 시험 섹션별 점수·PSAT·활동 Tier·수강과목 개수·인구통계가 빠져 있었다. 제품 오너가
-- "그들이 모집하는 정보를 전부 다 동일하게 모집해"라고 명시적으로 지시 — 기존 V1 스펙의 "재정·가족·
-- 민감정보 미수집" 원칙을 이 항목들에 한해 뒤집는 결정이다(전부 선택 입력이라는 전제).
--
-- 민감도 처리: 새로 추가하는 student_demographics는 학생/보호자/관리자만 조회·수정 가능하고
-- **교사는 조회 권한에서 제외**한다(_roadmap_can_read 대신 별도 함수) — 다른 로드맵 테이블은
-- 교사도 읽기 전용으로 보지만, 인종·재정·종교 같은 민감정보는 원래 원칙대로 교사 시야 밖에 둔다.

-- =========================================================================
-- 1) 인구통계 (Demographics) — 1인 1행, 전부 선택 입력
-- =========================================================================
create table student_demographics (
  student_id uuid primary key references students (id) on delete cascade,
  home_country text,
  zip_code text,
  residency_status text check (residency_status is null or residency_status in ('us_resident', 'international')),
  gender text,
  race_ethnicity text,
  financial_aid_intent text check (financial_aid_intent is null or financial_aid_intent in ('planning', 'not_planning', 'not_sure')),
  max_annual_budget numeric(10, 2),
  household_income_range text,
  first_generation text check (first_generation is null or first_generation in ('yes', 'no', 'prefer_not_to_say')),
  legacy_schools text[] not null default '{}',
  religious_affiliation text,
  recruited_athlete text check (recruited_athlete is null or recruited_athlete in ('yes', 'maybe', 'no')),
  special_school_interests text[] not null default '{}',
  updated_at timestamptz not null default now()
);
comment on table student_demographics is
  'P9 로드맵 V1 확장(2026-09-19): CollegeVine Demographics 탭과 동일 항목. 전부 선택 입력, 교사는 조회 불가(민감정보).';

-- =========================================================================
-- 2) 시험 정보 확장 — PSAT 추가 + 섹션별 점수(SAT: math/rw, ACT: math/reading/english/science)
-- =========================================================================
alter table student_test_records drop constraint student_test_records_test_type_check;
alter table student_test_records add constraint student_test_records_test_type_check
  check (test_type in ('SAT', 'ACT', 'PSAT'));
alter table student_test_records
  add column score_math integer,
  add column score_reading_writing integer, -- SAT/PSAT의 Reading and Writing 섹션
  add column score_english integer, -- ACT English
  add column score_science integer; -- ACT Science
comment on column student_test_records.score is '전체 합산 점수(기존 컬럼, 그대로 유지). 섹션 컬럼은 참고용 세부값 — 필수 아님.';

-- =========================================================================
-- 3) 수강과목 개수 — Coursework(Honors/AP/지역대학/IB HL·SL, 학교 제공 AP·IB 과목 수)
-- =========================================================================
alter table student_academic_profile
  add column honors_count integer check (honors_count is null or honors_count >= 0),
  add column ap_count integer check (ap_count is null or ap_count >= 0),
  add column college_courses_count integer check (college_courses_count is null or college_courses_count >= 0),
  add column ib_hl_count integer check (ib_hl_count is null or ib_hl_count >= 0),
  add column ib_sl_count integer check (ib_sl_count is null or ib_sl_count >= 0),
  add column school_ap_ib_offered_count integer check (school_ap_ib_offered_count is null or school_ap_ib_offered_count >= 0);

-- =========================================================================
-- 4) 활동 등급(Tier) — CollegeVine의 Exceptional~Standard 4단계 피라미드를 텍스트 enum으로.
-- =========================================================================
alter table student_extracurricular_activities
  add column tier text check (tier is null or tier in ('exceptional', 'strong', 'solid', 'standard'));
comment on column student_extracurricular_activities.tier is
  'P9 확장(2026-09-19): exceptional(전국/국제 최상위) > strong(주/지역 상위 또는 학교 내 최고 직책) > solid(꾸준한 참여+일부 성과) > standard(일반 참여). 학생 자기평가, 정답 채점 아님.';

-- =========================================================================
-- RLS — student_demographics: 교사 제외(학생/보호자/관리자만 조회·쓰기).
-- =========================================================================
create or replace function public._demographics_can_read(p_student_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_student_id = auth.uid()
    or is_admin()
    or is_guardian_of(p_student_id);
$$;
comment on function public._demographics_can_read(uuid) is
  'P9 확장(2026-09-19): 다른 로드맵 테이블(_roadmap_can_read)과 달리 교사를 뺀다 — 인구통계는 민감정보라 교사 시야 밖.';

alter table student_demographics enable row level security;
create policy "학생/보호자/관리자만 조회" on student_demographics for select
  using (_demographics_can_read(student_id));
create policy "학생/보호자/관리자만 추가" on student_demographics for insert
  with check (_roadmap_can_write(student_id));
create policy "학생/보호자/관리자만 수정" on student_demographics for update
  using (_roadmap_can_write(student_id));
create policy "학생/보호자/관리자만 삭제" on student_demographics for delete
  using (_roadmap_can_write(student_id));
