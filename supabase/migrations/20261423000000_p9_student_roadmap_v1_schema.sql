-- P9 학생 프로필 · 대학 준비 로드맵 V1 — 스키마(2026-09-19 제품 오너 승인)
--
-- 설계 근거: docs/2026-09-19-student-roadmap-v1-design-report.md
-- 방침: 기존 students.sat_score/target_colleges/intended_majors는 그대로 두고(읽기
-- 호환만 유지, 새 UI는 사용하지 않음), 스펙 5개 섹션을 독립 신규 테이블로 분리.
-- RLS는 student_ap_courses 패턴(학생 쓰기·교사 읽기전용)을 보호자 쓰기까지 확장.

-- =========================================================================
-- 1) 기본 학업 정보 보완(졸업 예정 연도·교육과정·현재 수강 과목) — 1인 1행
-- =========================================================================
create table student_academic_profile (
  student_id uuid primary key references students (id) on delete cascade,
  graduation_year integer check (graduation_year is null or (graduation_year between 2020 and 2100)),
  curriculum_type text,
  current_subjects text[] not null default '{}',
  updated_at timestamptz not null default now()
);
comment on table student_academic_profile is
  'P9 로드맵 V1: 학년/학교/GPA는 기존 students 컬럼을 그대로 쓰고, 여기는 졸업 예정 연도·교육과정·현재 수강 과목(자유 텍스트, 학원 과목 마스터와 무관)만 보완.';

-- =========================================================================
-- 2) 시험 정보 — 응시 이력/목표 점수/다음 응시 계획(같은 테이블, kind로 구분)
-- =========================================================================
create table student_test_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  test_type text not null check (test_type in ('SAT', 'ACT')),
  record_kind text not null check (record_kind in ('actual', 'target', 'planned')),
  test_date date,
  score integer,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on student_test_records (student_id);
comment on table student_test_records is
  'P9 로드맵 V1: record_kind=actual(응시 이력, test_date+score) / target(목표 점수, score만) / planned(다음 응시 계획, test_date만). 기존 students.sat_score(단일값)는 대체하지 않고 방치.';

-- =========================================================================
-- 3) 관심 분야와 대학 목표 — 1인 1행
-- =========================================================================
create table student_college_interests (
  student_id uuid primary key references students (id) on delete cascade,
  intended_majors text[] not null default '{}',
  career_interests text[] not null default '{}',
  target_countries text[] not null default '{}',
  target_college_types text[] not null default '{}',
  target_colleges text[] not null default '{}',
  target_application_timing text,
  updated_at timestamptz not null default now()
);
comment on table student_college_interests is
  'P9 로드맵 V1: 기존 students.intended_majors/target_colleges(text[])는 방치하고 이 테이블을 새 원본으로 쓴다.';

-- =========================================================================
-- 4) 활동과 수상 — 기존 활동 테이블 컬럼 보강 + 수상 신규 분리
-- =========================================================================
alter table student_extracurricular_activities
  add column if not exists field text,
  add column if not exists role text,
  add column if not exists total_hours numeric(6, 1),
  add column if not exists leadership_summary text,
  add column if not exists achievement_summary text;
comment on column student_extracurricular_activities.field is 'P9 로드맵 V1: 활동 분야.';
comment on column student_extracurricular_activities.role is 'P9 로드맵 V1: 학생의 역할.';
comment on column student_extracurricular_activities.total_hours is 'P9 로드맵 V1: 누적 참여 시간(선택 입력).';
comment on column student_extracurricular_activities.leadership_summary is 'P9 로드맵 V1: 리더십 경험 요약.';
comment on column student_extracurricular_activities.achievement_summary is 'P9 로드맵 V1: 성과 요약.';

create table student_awards (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  award_name text not null,
  award_level text,
  awarded_date date,
  related_activity_id uuid references student_extracurricular_activities (id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);
create index on student_awards (student_id);
comment on table student_awards is
  'P9 로드맵 V1: 수상은 활동과 분리(교내 경시대회처럼 특정 활동에 종속되지 않는 경우가 있어 1:1 강제 안 함), related_activity_id는 선택 연결.';

-- =========================================================================
-- 5) 준비 현황 — 에세이/추천서/포트폴리오/봉사·인턴십 등
-- =========================================================================
create table student_prep_items (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  item_type text not null check (item_type in ('essay', 'recommendation', 'portfolio', 'volunteering', 'internship', 'other')),
  custom_label text,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'done')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_prep_items_custom_label_required
    check (item_type <> 'other' or (custom_label is not null and btrim(custom_label) <> ''))
);
create index on student_prep_items (student_id);

-- =========================================================================
-- 6) 로드맵 마일스톤
-- =========================================================================
create table student_roadmap_milestones (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  title text not null,
  description text,
  target_period text,
  target_date date,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  notes text,
  related_links text[] not null default '{}',
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on student_roadmap_milestones (student_id);
comment on table student_roadmap_milestones is
  'P9 로드맵 V1: target_period는 "2026년 11월"/"2026 2학기" 같은 표시용 자유 텍스트, target_date는 정렬·다음 마일스톤 계산용 선택 입력.';

-- =========================================================================
-- 7) AI 월간 종합 리뷰 — V1은 생성 로직 없음, 자리만
-- =========================================================================
create table student_roadmap_monthly_reviews (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  period text not null,
  status text not null default 'not_generated' check (status in ('not_generated', 'generated')),
  content text,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (student_id, period)
);
comment on table student_roadmap_monthly_reviews is
  'P9 로드맵 V1: 생성 로직은 후속 작업. V1은 항상 not_generated로 남고 화면에는 "아직 생성된 리뷰가 없습니다" 정적 문구만 표시. 입학 가능성 점수·합격 확률 컬럼은 의도적으로 만들지 않음.';

-- =========================================================================
-- 8) RLS — 학생 본인·보호자 쓰기, 교사 읽기전용, 관리자 전체
-- =========================================================================
create or replace function public._roadmap_can_read(p_student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_student_id = auth.uid()
    or teaches_student(p_student_id)
    or is_guardian_of(p_student_id)
    or is_admin();
$$;
comment on function public._roadmap_can_read(uuid) is
  'P9 로드맵 V1 공통 select 조건(학생 본인/담당 교사/보호자/관리자) — 여러 테이블에서 재사용.';

create or replace function public._roadmap_can_write(p_student_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_student_id = auth.uid()
    or is_guardian_of(p_student_id)
    or is_admin();
$$;
comment on function public._roadmap_can_write(uuid) is
  'P9 로드맵 V1 공통 insert/update/delete 조건(학생 본인/보호자/관리자, 교사 제외) — 여러 테이블에서 재사용.';

do $$
declare
  t text;
  tables text[] := array[
    'student_academic_profile',
    'student_test_records',
    'student_college_interests',
    'student_awards',
    'student_prep_items',
    'student_roadmap_milestones',
    'student_roadmap_monthly_reviews'
  ];
begin
  foreach t in array tables loop
    execute format('alter table %I enable row level security', t);
    if t = 'student_academic_profile' or t = 'student_college_interests' then
      -- primary key 컬럼명이 student_id
      execute format(
        'create policy "학생/교사/보호자/관리자 조회" on %I for select using (_roadmap_can_read(student_id))', t);
      execute format(
        'create policy "학생/보호자/관리자 추가" on %I for insert with check (_roadmap_can_write(student_id))', t);
      execute format(
        'create policy "학생/보호자/관리자 수정" on %I for update using (_roadmap_can_write(student_id))', t);
      execute format(
        'create policy "학생/보호자/관리자 삭제" on %I for delete using (_roadmap_can_write(student_id))', t);
    else
      execute format(
        'create policy "학생/교사/보호자/관리자 조회" on %I for select using (_roadmap_can_read(student_id))', t);
      execute format(
        'create policy "학생/보호자/관리자 추가" on %I for insert with check (_roadmap_can_write(student_id))', t);
      execute format(
        'create policy "학생/보호자/관리자 수정" on %I for update using (_roadmap_can_write(student_id))', t);
      execute format(
        'create policy "학생/보호자/관리자 삭제" on %I for delete using (_roadmap_can_write(student_id))', t);
    end if;
  end loop;
end $$;

-- student_roadmap_monthly_reviews는 생성 로직이 없는 V1에서는 서버(관리자/시스템)만
-- 써야 하므로 학생/보호자 쓰기 정책을 별도로 좁힌다(위 루프의 범용 쓰기 정책 대체).
drop policy "학생/보호자/관리자 추가" on student_roadmap_monthly_reviews;
drop policy "학생/보호자/관리자 수정" on student_roadmap_monthly_reviews;
drop policy "학생/보호자/관리자 삭제" on student_roadmap_monthly_reviews;
create policy "관리자만 추가" on student_roadmap_monthly_reviews for insert with check (is_admin());
create policy "관리자만 수정" on student_roadmap_monthly_reviews for update using (is_admin());
create policy "관리자만 삭제" on student_roadmap_monthly_reviews for delete using (is_admin());

-- =========================================================================
-- 9) 기존 student_ap_courses / student_extracurricular_activities 쓰기 정책을
--    보호자까지 확장(설계 보고 결정 필요 항목 — 스펙이 "학생·학부모 작성/수정"을
--    요구하므로 기존 "본인만" 정책을 보호자 포함으로 넓힌다. 20261026000000 참고).
-- =========================================================================
drop policy "본인/관리자만 추가" on student_ap_courses;
drop policy "본인/관리자만 수정" on student_ap_courses;
drop policy "본인/관리자만 삭제" on student_ap_courses;
create policy "본인/보호자/관리자만 추가" on student_ap_courses for insert
  with check (_roadmap_can_write(student_id));
create policy "본인/보호자/관리자만 수정" on student_ap_courses for update
  using (_roadmap_can_write(student_id));
create policy "본인/보호자/관리자만 삭제" on student_ap_courses for delete
  using (_roadmap_can_write(student_id));

drop policy "본인/관리자만 추가" on student_extracurricular_activities;
drop policy "본인/관리자만 수정" on student_extracurricular_activities;
drop policy "본인/관리자만 삭제" on student_extracurricular_activities;
create policy "본인/보호자/관리자만 추가" on student_extracurricular_activities for insert
  with check (_roadmap_can_write(student_id));
create policy "본인/보호자/관리자만 수정" on student_extracurricular_activities for update
  using (_roadmap_can_write(student_id));
create policy "본인/보호자/관리자만 삭제" on student_extracurricular_activities for delete
  using (_roadmap_can_write(student_id));
