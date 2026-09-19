-- 대학 진학 정보 DB Part 5 — 비용/재정지원, 캠퍼스 생활, 입시 제도 세부, 합격자 프로필,
-- 에세이 프롬프트(2026-09-19 제품 오너 지시 — "College Board 대비 너무 빈약하다").
--
-- College Board(BigFuture) 대학 프로필과 대조해 빠진 카테고리를 채운다. 정책은 기존과 동일 —
-- 합격 확률/가능성 예측 필드는 없음.

-- =========================================================================
-- 1) 대학 기본 정보(자주 안 바뀜) — 캠퍼스 생활·학사 제도
-- =========================================================================
alter table universities
  add column if not exists overview_text text,
  add column if not exists setting text check (setting is null or setting in ('urban', 'suburban', 'rural', 'town')),
  add column if not exists campus_size_acres integer,
  add column if not exists ncaa_division text,
  add column if not exists religious_affiliation text,
  add column if not exists calendar_system text check (calendar_system is null or calendar_system in ('semester', 'quarter', 'trimester', '4-1-4', 'other')),
  add column if not exists honors_college boolean;
comment on column universities.overview_text is 'P5(2026-09-19): 학교 소개 서술문(3~5문장) — 위치·특성·강점·분위기. 자유 텍스트, 관리자 검수 전제.';
comment on column universities.setting is 'P5(2026-09-19): 캠퍼스 소재 유형(도시/교외/시골/소도시).';
comment on column universities.ncaa_division is 'P5: NCAA 디비전(예: Division I, Division III) 또는 비NCAA면 null.';

-- =========================================================================
-- 2) 연도별 사이클 확장 — 비용·재정지원, ED/EA 제도 세부, 합격자 학업 프로필
-- =========================================================================
alter table university_admission_cycles
  -- 비용과 재정지원
  add column if not exists tuition_in_state numeric(10, 2),
  add column if not exists tuition_out_state numeric(10, 2),
  add column if not exists room_board_cost numeric(10, 2),
  add column if not exists avg_net_price numeric(10, 2),
  add column if not exists pct_receiving_aid numeric(5, 2),
  add column if not exists avg_aid_award numeric(10, 2),
  -- ED/EA 제도 세부(단순 마감일 이상의 정책 성격)
  add column if not exists ea_restrictive boolean, -- REA/SCEA(다른 학교 EA 동시지원 제한) 여부
  add column if not exists ed2_deadline date,
  add column if not exists ed2_decision_date date,
  -- 학사 상세
  add column if not exists class_size_under_20_pct numeric(5, 2),
  add column if not exists class_size_over_50_pct numeric(5, 2),
  add column if not exists study_abroad_pct numeric(5, 2),
  -- 합격자 학업 프로필(CollegeVine류 "합격생 스펙" — 확률 예측이 아니라 과거 실적 수치)
  add column if not exists admitted_avg_ap_exams numeric(4, 1),
  add column if not exists admitted_weighted_gpa_avg numeric(4, 2),
  add column if not exists admitted_top10pct_class_rank_pct numeric(5, 2);
comment on column university_admission_cycles.ea_restrictive is 'P5(2026-09-19): Restrictive/Single-Choice EA(다른 사립대 EA·ED 동시지원 제한) 여부. 일반 비제한 EA는 false.';
comment on column university_admission_cycles.admitted_avg_ap_exams is 'P5: 합격자 평균 AP 시험 응시 개수(과거 실적 통계, 확률 예측 아님) — 정책상 확률 필드와 구분.';

-- =========================================================================
-- 3) 에세이 프롬프트 — 학교 자체 supplement 문항(연도별로 바뀔 수 있어 사이클에 종속)
-- =========================================================================
create table university_essay_prompts (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references universities(id) on delete cascade,
  cycle_year integer not null,
  prompt_text text not null,
  word_limit integer,
  is_required boolean not null default true,
  created_at timestamptz not null default now()
);
comment on table university_essay_prompts is 'P5(2026-09-19): 학교 자체 supplement 에세이 문항. Common App 공용 에세이는 별도 테이블 불필요(모든 학교 공통).';

create index if not exists idx_university_essay_prompts_university_cycle on university_essay_prompts(university_id, cycle_year);

alter table university_essay_prompts enable row level security;

drop policy if exists "university_essay_prompts 읽기: 인증 사용자 전원" on university_essay_prompts;
create policy "university_essay_prompts 읽기: 인증 사용자 전원" on university_essay_prompts for select
  using (auth.role() = 'authenticated');

drop policy if exists "university_essay_prompts 쓰기: 관리자만" on university_essay_prompts;
create policy "university_essay_prompts 쓰기: 관리자만" on university_essay_prompts for all
  using (is_admin()) with check (is_admin());
