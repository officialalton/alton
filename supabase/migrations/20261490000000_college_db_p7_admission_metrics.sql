-- 대학 진학 정보 DB Part 7 — 합격·등록 학생 학업 지표(Admitted Student Profile) 정규화.
--
-- 배경: university_admission_cycles의 기존 flat 컬럼(sat_ebrw_25/75, act_composite_25/75,
-- gpa_average, total_applicants, acceptance_rate, yield_rate 등)은 연도별로는 나뉘지만
-- 대상집단(지원자/합격자/등록자)·전체 응시자 vs 제출자만·공식/2차/미검증 여부·출처·확인일을
-- 구분하지 못한다. 이 마이그레이션은 그 값들을 대체하지 않고(기존 컬럼은 그대로 둔다),
-- 옆에 정규화 테이블을 additive로 추가한다.
--
-- 정책: 개인 합격확률 계산/변환 기능은 이 테이블/화면에 없다(정책상 금지, 기존 원칙과 동일).

create table if not exists university_admission_metrics (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references universities(id) on delete cascade,
  cycle_year integer not null,
  cohort text not null check (cohort in ('applicant', 'admitted', 'enrolled')),
  metric_key text not null check (metric_key in (
    'sat_total_25', 'sat_total_75',
    'sat_ebrw_25', 'sat_ebrw_75',
    'sat_math_25', 'sat_math_75',
    'act_composite_25', 'act_composite_75',
    'gpa_average',
    'top10pct_pct',
    'ap_ib_indicator',
    'applicants_count', 'admitted_count', 'enrolled_count',
    'admit_rate', 'yield_rate'
  )),
  value numeric,
  value_text text,
  unit text,
  submitters_only boolean not null default false,
  gpa_weighted boolean,
  verification_status text not null default 'unverified' check (verification_status in ('official', 'secondary', 'unverified')),
  source_url_id uuid references university_source_urls(id) on delete set null,
  verified_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (university_id, cycle_year, cohort, metric_key)
);

comment on table university_admission_metrics is
  'P7(2026-09-23): 합격·등록 학생 학업 지표 — 연도×대상집단×지표 단위로 값·단위·전체/제출자만·검증상태·출처·확인일을 구분. university_admission_cycles의 기존 flat 컬럼은 변경 없이 그대로 둔다(이 테이블이 대체하지 않음).';
comment on column university_admission_metrics.cohort is '대상집단: applicant(지원자)/admitted(합격자)/enrolled(등록자).';
comment on column university_admission_metrics.value is '숫자형 값(점수/비율/인원수). ap_ib_indicator처럼 숫자가 아닌 경우 value_text 사용.';
comment on column university_admission_metrics.value_text is '숫자로 표현하기 어려운 값(예: ap_ib_indicator의 서술형 표기). value와 동시 사용 가능.';
comment on column university_admission_metrics.submitters_only is 'true면 "시험 제출자만" 기준 값(test-optional 학교의 SAT/ACT 등). false=전체 응시자/재학생 기준.';
comment on column university_admission_metrics.gpa_weighted is 'gpa_average 지표에서만 의미 있음: true=가중 GPA, false=비가중, null=확인 안 됨.';
comment on column university_admission_metrics.verification_status is 'official=1차 공식 출처(CDS/대학 발표), secondary=2차 집계 출처, unverified=미검증(정책상 숨기지 않고 화면에 배지로 노출).';
comment on column university_admission_metrics.source_url_id is 'university_source_urls 참조 — 승인된 출처가 아니어도 저장은 가능(그 경우 화면에서 링크 없이 표시).';

create index if not exists idx_university_admission_metrics_university_cycle
  on university_admission_metrics(university_id, cycle_year, cohort);

alter table university_admission_metrics enable row level security;

-- 공개 지표이므로 미검증 포함 전원 읽기 가능(RLS로 숨기지 않음 — UI에서 배지로 명시).
drop policy if exists "university_admission_metrics_select_all" on university_admission_metrics;
create policy "university_admission_metrics_select_all"
  on university_admission_metrics for select
  using (auth.role() = 'authenticated');

-- 쓰기는 관리자만.
drop policy if exists "university_admission_metrics_write_admin" on university_admission_metrics;
create policy "university_admission_metrics_write_admin"
  on university_admission_metrics for all
  using (is_admin())
  with check (is_admin());

create trigger set_updated_at_university_admission_metrics
  before update on university_admission_metrics
  for each row execute function set_updated_at();

-- =========================================================================
-- 백필 — 기존 university_admission_cycles(2027 사이클) 값 중 재검토를 거친 일부를
-- 새 정규화 테이블로 이관(추측 채우기 금지 — 원본 source_notes를 그대로 notes에 옮기고,
-- source_notes에서 "미검증/미확인"으로 명시한 값만 verification_status='unverified',
-- 나머지 2차자료 성격 값은 'secondary'로 표시. official 값은 이 백필 대상에 없음
-- (CDS 원문 직접 대조 전까지는 official로 표시하지 않는다).
-- =========================================================================

-- Princeton University(2027) — source_notes: "2차자료 다수, SAT/ACT는 test-ninjas 미검증."
insert into university_admission_metrics (university_id, cycle_year, cohort, metric_key, value, unit, submitters_only, verification_status, notes)
select u.id, 2027, 'admitted', m.metric_key, m.value, 'score', true, 'unverified', 'P4(2026-09-19) 조사 이관: SAT/ACT는 test-ninjas 미검증(원 source_notes 그대로).'
from universities u
cross join (values
  ('sat_ebrw_25', 740::numeric), ('sat_ebrw_75', 780::numeric),
  ('sat_math_25', 770::numeric), ('sat_math_75', 800::numeric),
  ('act_composite_25', 34::numeric), ('act_composite_75', 35::numeric)
) as m(metric_key, value)
where u.name = 'Princeton University' and u.country = 'United States'
on conflict (university_id, cycle_year, cohort, metric_key) do nothing;

insert into university_admission_metrics (university_id, cycle_year, cohort, metric_key, value, unit, verification_status, notes)
select u.id, 2027, 'applicant', 'applicants_count', 42303, 'count', 'secondary', 'P4(2026-09-19) 조사 이관.'
from universities u where u.name = 'Princeton University' and u.country = 'United States'
on conflict (university_id, cycle_year, cohort, metric_key) do nothing;

insert into university_admission_metrics (university_id, cycle_year, cohort, metric_key, value, unit, verification_status, notes)
select u.id, 2027, 'admitted', 'admit_rate', 4.40, 'pct', 'secondary', 'P4(2026-09-19) 조사 이관.'
from universities u where u.name = 'Princeton University' and u.country = 'United States'
on conflict (university_id, cycle_year, cohort, metric_key) do nothing;

-- Massachusetts Institute of Technology(2027) — source_notes: "SAT 합산 1520-1570만 확인
-- (섹션분리 미확인, null 처리)."
insert into university_admission_metrics (university_id, cycle_year, cohort, metric_key, value, unit, submitters_only, verification_status, notes)
select u.id, 2027, 'admitted', m.metric_key, m.value, 'score', true, 'unverified', 'P4(2026-09-19) 조사 이관: SAT는 합산만 확인, 섹션분리 미확인(원 source_notes).'
from universities u
cross join (values ('sat_total_25', 1520::numeric), ('sat_total_75', 1570::numeric)) as m(metric_key, value)
where u.name = 'Massachusetts Institute of Technology' and u.country = 'United States'
on conflict (university_id, cycle_year, cohort, metric_key) do nothing;

insert into university_admission_metrics (university_id, cycle_year, cohort, metric_key, value, unit, submitters_only, verification_status, notes)
select u.id, 2027, 'admitted', m.metric_key, m.value, 'score', true, 'secondary', 'P4(2026-09-19) 조사 이관.'
from universities u
cross join (values ('act_composite_25', 34::numeric), ('act_composite_75', 36::numeric)) as m(metric_key, value)
where u.name = 'Massachusetts Institute of Technology' and u.country = 'United States'
on conflict (university_id, cycle_year, cohort, metric_key) do nothing;

insert into university_admission_metrics (university_id, cycle_year, cohort, metric_key, value, unit, verification_status, notes)
select u.id, 2027, 'applicant', 'applicants_count', 28349, 'count', 'secondary', 'P4(2026-09-19) 조사 이관.'
from universities u where u.name = 'Massachusetts Institute of Technology' and u.country = 'United States'
on conflict (university_id, cycle_year, cohort, metric_key) do nothing;

insert into university_admission_metrics (university_id, cycle_year, cohort, metric_key, value, unit, verification_status, notes)
select u.id, 2027, 'admitted', 'admit_rate', 4.58, 'pct', 'secondary', 'P4(2026-09-19) 조사 이관.'
from universities u where u.name = 'Massachusetts Institute of Technology' and u.country = 'United States'
on conflict (university_id, cycle_year, cohort, metric_key) do nothing;

-- Harvard University(2027) — source_notes: "SAT 합산 1450-1560만 확인(...CDS 미열람으로
-- 대부분 null)."
insert into university_admission_metrics (university_id, cycle_year, cohort, metric_key, value, unit, submitters_only, verification_status, notes)
select u.id, 2027, 'admitted', m.metric_key, m.value, 'score', true, 'unverified', 'P4(2026-09-19) 조사 이관: CDS 미열람, 2차자료 기반(원 source_notes).'
from universities u
cross join (values ('sat_total_25', 1450::numeric), ('sat_total_75', 1560::numeric)) as m(metric_key, value)
where u.name = 'Harvard University' and u.country = 'United States'
on conflict (university_id, cycle_year, cohort, metric_key) do nothing;

insert into university_admission_metrics (university_id, cycle_year, cohort, metric_key, value, unit, submitters_only, verification_status, notes)
select u.id, 2027, 'admitted', m.metric_key, m.value, 'score', true, 'secondary', 'P4(2026-09-19) 조사 이관.'
from universities u
cross join (values ('act_composite_25', 33::numeric), ('act_composite_75', 35::numeric)) as m(metric_key, value)
where u.name = 'Harvard University' and u.country = 'United States'
on conflict (university_id, cycle_year, cohort, metric_key) do nothing;

insert into university_admission_metrics (university_id, cycle_year, cohort, metric_key, value, unit, verification_status, notes)
select u.id, 2027, 'applicant', 'applicants_count', 47893, 'count', 'secondary', 'P4(2026-09-19) 조사 이관.'
from universities u where u.name = 'Harvard University' and u.country = 'United States'
on conflict (university_id, cycle_year, cohort, metric_key) do nothing;

insert into university_admission_metrics (university_id, cycle_year, cohort, metric_key, value, unit, verification_status, notes)
select u.id, 2027, 'admitted', 'admit_rate', 4.20, 'pct', 'secondary', 'P4(2026-09-19) 조사 이관.'
from universities u where u.name = 'Harvard University' and u.country = 'United States'
on conflict (university_id, cycle_year, cohort, metric_key) do nothing;

insert into university_admission_metrics (university_id, cycle_year, cohort, metric_key, value, unit, verification_status, notes)
select u.id, 2027, 'enrolled', 'yield_rate', 83.60, 'pct', 'secondary', 'P4(2026-09-19) 조사 이관.'
from universities u where u.name = 'Harvard University' and u.country = 'United States'
on conflict (university_id, cycle_year, cohort, metric_key) do nothing;

-- Stanford University(2027) — source_notes: "SAT 합산만 확인(자료 편차 있어 null),
-- GPA 25/75는 미확인." (SAT 실제 값은 편차로 인해 원본에서도 null 처리돼 있어 이관하지 않음)
insert into university_admission_metrics (university_id, cycle_year, cohort, metric_key, value, unit, submitters_only, verification_status, notes)
select u.id, 2027, 'admitted', m.metric_key, m.value, 'score', true, 'secondary', 'P4(2026-09-19) 조사 이관.'
from universities u
cross join (values ('act_composite_25', 34::numeric), ('act_composite_75', 35::numeric)) as m(metric_key, value)
where u.name = 'Stanford University' and u.country = 'United States'
on conflict (university_id, cycle_year, cohort, metric_key) do nothing;

insert into university_admission_metrics (university_id, cycle_year, cohort, metric_key, value, unit, verification_status, notes)
select u.id, 2027, 'admitted', 'gpa_average', 3.94, 'GPA(4.0)', 'secondary', 'P4(2026-09-19) 조사 이관: GPA 25/75는 미확인, 평균만 확인(원 source_notes).'
from universities u where u.name = 'Stanford University' and u.country = 'United States'
on conflict (university_id, cycle_year, cohort, metric_key) do nothing;

insert into university_admission_metrics (university_id, cycle_year, cohort, metric_key, value, unit, verification_status, notes)
select u.id, 2027, 'applicant', 'applicants_count', 60646, 'count', 'secondary', 'P4(2026-09-19) 조사 이관.'
from universities u where u.name = 'Stanford University' and u.country = 'United States'
on conflict (university_id, cycle_year, cohort, metric_key) do nothing;

insert into university_admission_metrics (university_id, cycle_year, cohort, metric_key, value, unit, verification_status, notes)
select u.id, 2027, 'admitted', 'admit_rate', 3.80, 'pct', 'secondary', 'P4(2026-09-19) 조사 이관.'
from universities u where u.name = 'Stanford University' and u.country = 'United States'
on conflict (university_id, cycle_year, cohort, metric_key) do nothing;

insert into university_admission_metrics (university_id, cycle_year, cohort, metric_key, value, unit, verification_status, notes)
select u.id, 2027, 'enrolled', 'yield_rate', 79.90, 'pct', 'secondary', 'P4(2026-09-19) 조사 이관.'
from universities u where u.name = 'Stanford University' and u.country = 'United States'
on conflict (university_id, cycle_year, cohort, metric_key) do nothing;

-- Yale University(2027) — source_notes: "SAT 합산 1480-1560만 확인."
insert into university_admission_metrics (university_id, cycle_year, cohort, metric_key, value, unit, submitters_only, verification_status, notes)
select u.id, 2027, 'admitted', m.metric_key, m.value, 'score', true, 'secondary', 'P4(2026-09-19) 조사 이관.'
from universities u
cross join (values ('sat_total_25', 1480::numeric), ('sat_total_75', 1560::numeric)) as m(metric_key, value)
where u.name = 'Yale University' and u.country = 'United States'
on conflict (university_id, cycle_year, cohort, metric_key) do nothing;

insert into university_admission_metrics (university_id, cycle_year, cohort, metric_key, value, unit, submitters_only, verification_status, notes)
select u.id, 2027, 'admitted', m.metric_key, m.value, 'score', true, 'secondary', 'P4(2026-09-19) 조사 이관.'
from universities u
cross join (values ('act_composite_25', 33::numeric), ('act_composite_75', 35::numeric)) as m(metric_key, value)
where u.name = 'Yale University' and u.country = 'United States'
on conflict (university_id, cycle_year, cohort, metric_key) do nothing;

insert into university_admission_metrics (university_id, cycle_year, cohort, metric_key, value, unit, verification_status, notes)
select u.id, 2027, 'applicant', 'applicants_count', 50264, 'count', 'secondary', 'P4(2026-09-19) 조사 이관.'
from universities u where u.name = 'Yale University' and u.country = 'United States'
on conflict (university_id, cycle_year, cohort, metric_key) do nothing;

insert into university_admission_metrics (university_id, cycle_year, cohort, metric_key, value, unit, verification_status, notes)
select u.id, 2027, 'admitted', 'admit_rate', 4.90, 'pct', 'secondary', 'P4(2026-09-19) 조사 이관.'
from universities u where u.name = 'Yale University' and u.country = 'United States'
on conflict (university_id, cycle_year, cohort, metric_key) do nothing;
