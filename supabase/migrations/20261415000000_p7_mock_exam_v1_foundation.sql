-- P7 — 고정형 SAT 모의고사 V1 데이터 모델 (2026-09-18)
--
-- 사양: docs/2026-09-17-fixed-mock-exam-v1-spec.md
-- 이 마이그레이션은 사양 5절(시험 구성과 상태)의 데이터 모델만 다룬다.
-- 적응형 모듈, 점수 추정, 감독 기능은 범위 밖(사양 1절 제외 목록).
--
-- 열린 질문(제품 오너 확인 필요, docs/CURRENT.md/보고 참고):
--   사양 문서는 "영역·난이도 비중을 고정"한다고만 정하고 정확한 퍼센트·세트당
--   문항 수는 정하지 않았다. 이 마이그레이션은 그 비중을 관리자가 조정 가능한
--   설정 테이블(mock_exam_domain_weights / mock_exam_difficulty_weights)로 만들고,
--   기본값은 College Board가 공개한 SAT 영역 배점 비율을 참고해 시드했다 — 이
--   기본값 자체는 제품 정책으로 확정된 숫자가 아니므로 검수 필요.

-- =========================================================================
-- 1. 시험 세트 (버전 관리 — 수정은 새 버전 행을 만든다)
-- =========================================================================
create table mock_exam_sets (
  id uuid primary key default gen_random_uuid(),
  set_group_id uuid not null default gen_random_uuid(), -- 같은 세트의 버전들을 묶는 키
  version_no int not null default 1,
  name text not null,
  description text,
  difficulty_tier text not null check (difficulty_tier in ('foundation', 'standard', 'advanced')), -- 기본/표준/상위
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  rw_time_limit_minutes int not null default 64,
  math_time_limit_minutes int not null default 70,
  math_calculator_allowed boolean not null default true,
  math_reference_sheet_allowed boolean not null default true,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  published_by uuid references profiles (id),
  archived_at timestamptz,
  unique (set_group_id, version_no)
);
create index on mock_exam_sets (difficulty_tier) where archived_at is null;
create index on mock_exam_sets (status) where archived_at is null;
comment on table mock_exam_sets is '고정형 모의고사 세트(버전 단위). 세트 수정은 새 버전 행 — 기존 응시 기록은 시작 시점 버전을 참조해 영향받지 않는다.';
comment on column mock_exam_sets.set_group_id is '같은 이름 계열의 세트 버전을 묶는다. 학생 응시는 특정 version_no(=특정 mock_exam_sets.id)를 고정 참조한다.';

-- 공개된 세트는 set_group_id 당 하나만(최신으로 교체) — 새 버전을 공개하면 이전 공개본은 archived 로 내린다(앱 서버 액션이 트랜잭션으로 처리, 여기서는 부분 유니크로 방지만).
create unique index mock_exam_sets_one_published_per_group
  on mock_exam_sets (set_group_id) where status = 'published';

-- =========================================================================
-- 2. 세트 구성 문항 (조립 시점에 공개 버전을 스냅샷으로 고정)
-- =========================================================================
create table mock_exam_set_items (
  id uuid primary key default gen_random_uuid(),
  exam_set_id uuid not null references mock_exam_sets (id) on delete cascade,
  section text not null check (section in ('rw', 'math')),
  position int not null check (position > 0),
  problem_id uuid not null references problems (id),
  problem_version_id uuid not null references problem_versions (id),
  sat_domain text not null,
  skill_code text references problem_skill_codes (code),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  created_at timestamptz not null default now(),
  unique (exam_set_id, section, position),
  unique (exam_set_id, problem_id) -- 세트 안 중복 문항 금지
);
create index on mock_exam_set_items (exam_set_id);
create index on mock_exam_set_items (problem_id);
comment on table mock_exam_set_items is '세트 조립 시점의 문항 스냅샷(problem_version_id 고정). 이후 새 공개 버전이 나와도 이미 조립된 세트는 바뀌지 않는다.';

-- =========================================================================
-- 3. 비중 설정 (관리자 조정 가능, 조립 로직의 목표값 원본)
-- =========================================================================
create table mock_exam_domain_weights (
  id uuid primary key default gen_random_uuid(),
  difficulty_tier text not null check (difficulty_tier in ('foundation', 'standard', 'advanced')),
  section text not null check (section in ('rw', 'math')),
  sat_domain text not null check (sat_domain in (
    'algebra', 'advanced_math', 'problem_solving_data', 'geometry_trig',
    'rw_information_ideas', 'rw_craft_structure', 'rw_expression_ideas', 'rw_standard_english')),
  weight_pct numeric not null check (weight_pct > 0 and weight_pct <= 100),
  unique (difficulty_tier, section, sat_domain)
);
comment on table mock_exam_domain_weights is '난이도 등급 x 섹션별 SAT 영역 비중(%). 조립 로직의 목표 문항 수 계산 원본 — 값은 제품 오너 확인 전 참고용 기본값.';

create table mock_exam_difficulty_weights (
  id uuid primary key default gen_random_uuid(),
  difficulty_tier text not null check (difficulty_tier in ('foundation', 'standard', 'advanced')),
  section text not null check (section in ('rw', 'math')),
  problem_difficulty text not null check (problem_difficulty in ('easy', 'medium', 'hard')),
  weight_pct numeric not null check (weight_pct > 0 and weight_pct <= 100),
  unique (difficulty_tier, section, problem_difficulty)
);
comment on table mock_exam_difficulty_weights is '난이도 등급 x 섹션별 문항 난이도(easy/medium/hard) 비중(%) — 참고용 기본값, 제품 오너 확인 전.';

-- 참고 기본값 — College Board 공개 SAT 영역 배점 비율 근사치. 정책 확정 아님.
insert into mock_exam_domain_weights (difficulty_tier, section, sat_domain, weight_pct)
select tier, 'rw', domain, pct
from (values
  ('information_ideas', 26), ('craft_structure', 28), ('expression_ideas', 20), ('standard_english', 26)
) as w(domain_key, pct)
cross join (values ('foundation'), ('standard'), ('advanced')) as t(tier)
cross join lateral (select 'rw_' || domain_key as domain) d;

insert into mock_exam_domain_weights (difficulty_tier, section, sat_domain, weight_pct)
select tier, 'math', domain, pct
from (values
  ('algebra', 35), ('advanced_math', 35), ('problem_solving_data', 15), ('geometry_trig', 15)
) as w(domain, pct)
cross join (values ('foundation'), ('standard'), ('advanced')) as t(tier);

insert into mock_exam_difficulty_weights (difficulty_tier, section, problem_difficulty, weight_pct) values
  ('foundation', 'rw', 'easy', 50), ('foundation', 'rw', 'medium', 40), ('foundation', 'rw', 'hard', 10),
  ('foundation', 'math', 'easy', 50), ('foundation', 'math', 'medium', 40), ('foundation', 'math', 'hard', 10),
  ('standard', 'rw', 'easy', 25), ('standard', 'rw', 'medium', 50), ('standard', 'rw', 'hard', 25),
  ('standard', 'math', 'easy', 25), ('standard', 'math', 'medium', 50), ('standard', 'math', 'hard', 25),
  ('advanced', 'rw', 'easy', 10), ('advanced', 'rw', 'medium', 40), ('advanced', 'rw', 'hard', 50),
  ('advanced', 'math', 'easy', 10), ('advanced', 'math', 'medium', 40), ('advanced', 'math', 'hard', 50);

-- =========================================================================
-- 4. 학생 응시 기록 — 학생당 시험(세트 계열)당 하나. 배정은 수업 안/밖 모두 가능.
-- =========================================================================
create table mock_exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_set_id uuid not null references mock_exam_sets (id),
  student_id uuid not null references students (id),
  assigned_by uuid references teachers (id),
  assigning_session_id uuid references sessions (id) on delete set null, -- 배정을 시작한 수업(선택)
  status text not null default 'assigned' check (status in ('assigned', 'in_progress', 'submitted', 'graded')),
  start_by timestamptz,
  due_at timestamptz,
  max_attempts int not null default 1 check (max_attempts > 0),
  attempt_count int not null default 0,
  started_at timestamptz,
  submitted_at timestamptz,
  graded_at timestamptz,
  time_remaining_seconds jsonb, -- 섹션별 남은 시간(중단 후 재개용 스냅샷)
  created_at timestamptz not null default now(),
  -- 응시 기록은 학생당 "시험"(세트 계열=set_group_id) 당 하나 — exam_set_id 가 아니라 세트 계열 단위여야 하므로
  -- set_group_id 를 별도 컬럼으로 복제해 유니크 제약을 건다.
  exam_set_group_id uuid not null
);
create index on mock_exam_attempts (student_id);
create index on mock_exam_attempts (exam_set_id);
create unique index mock_exam_attempts_one_per_student_per_exam
  on mock_exam_attempts (student_id, exam_set_group_id);
comment on table mock_exam_attempts is '학생×시험(세트 계열) 당 하나의 응시 기록. exam_set_id 는 응시 시작 시점에 고정된 특정 버전.';

create or replace function public.mock_exam_attempts_fill_set_group()
returns trigger language plpgsql as $$
begin
  select set_group_id into new.exam_set_group_id from mock_exam_sets where id = new.exam_set_id;
  if new.exam_set_group_id is null then
    raise exception '존재하지 않는 시험 세트입니다: %', new.exam_set_id;
  end if;
  return new;
end;
$$;
drop trigger if exists mock_exam_attempts_fill_set_group on mock_exam_attempts;
create trigger mock_exam_attempts_fill_set_group before insert or update of exam_set_id on mock_exam_attempts
  for each row execute function public.mock_exam_attempts_fill_set_group();

create table mock_exam_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references mock_exam_attempts (id) on delete cascade,
  set_item_id uuid not null references mock_exam_set_items (id),
  response jsonb,
  correct boolean,
  flagged boolean not null default false, -- 학생이 "표시"한 문항(사양 3절 학생 흐름 — 문항 이동/표시)
  time_spent_seconds int,
  updated_at timestamptz not null default now(),
  unique (attempt_id, set_item_id)
);
create index on mock_exam_answers (attempt_id);
comment on table mock_exam_answers is '응시 중/후 문항별 답안. 채점은 기존 문제 답안 모델(정오답 판정)을 재사용한다(사양 7절).';

-- =========================================================================
-- 5. RLS — 문제은행 RLS 관례를 따른다: 관리자 전체, 교사는 담당 학생, 학생/학부모는 본인/자녀 것만.
-- =========================================================================
alter table mock_exam_sets enable row level security;
alter table mock_exam_set_items enable row level security;
alter table mock_exam_domain_weights enable row level security;
alter table mock_exam_difficulty_weights enable row level security;
alter table mock_exam_attempts enable row level security;
alter table mock_exam_answers enable row level security;

drop policy if exists "모의고사 세트 관리자 전체" on mock_exam_sets;
create policy "모의고사 세트 관리자 전체" on mock_exam_sets for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "모의고사 세트 공개본 조회" on mock_exam_sets;
create policy "모의고사 세트 공개본 조회" on mock_exam_sets for select to authenticated using (status = 'published');

drop policy if exists "모의고사 세트 문항 관리자 전체" on mock_exam_set_items;
create policy "모의고사 세트 문항 관리자 전체" on mock_exam_set_items for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "비중 설정 관리자 전체" on mock_exam_domain_weights;
create policy "비중 설정 관리자 전체" on mock_exam_domain_weights for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "비중 설정 조회" on mock_exam_domain_weights;
create policy "비중 설정 조회" on mock_exam_domain_weights for select to authenticated using (true);

drop policy if exists "난이도 비중 설정 관리자 전체" on mock_exam_difficulty_weights;
create policy "난이도 비중 설정 관리자 전체" on mock_exam_difficulty_weights for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "난이도 비중 설정 조회" on mock_exam_difficulty_weights;
create policy "난이도 비중 설정 조회" on mock_exam_difficulty_weights for select to authenticated using (true);

drop policy if exists "응시 기록 관리자 전체" on mock_exam_attempts;
create policy "응시 기록 관리자 전체" on mock_exam_attempts for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "응시 기록 본인 학생 조회" on mock_exam_attempts;
create policy "응시 기록 본인 학생 조회" on mock_exam_attempts for select to authenticated
  using (student_id = auth.uid());

drop policy if exists "응시 기록 담당 교사 조회" on mock_exam_attempts;
create policy "응시 기록 담당 교사 조회" on mock_exam_attempts for select to authenticated
  using (exists (
    select 1 from enrollments e
    where e.student_id = mock_exam_attempts.student_id and e.teacher_id = auth.uid()
  ));

drop policy if exists "응시 기록 보호자 읽기 전용" on mock_exam_attempts;
create policy "응시 기록 보호자 읽기 전용" on mock_exam_attempts for select to authenticated
  using (exists (
    select 1 from guardian_students gs
    where gs.student_id = mock_exam_attempts.student_id and gs.parent_id = auth.uid()
  ));

drop policy if exists "답안 관리자 전체" on mock_exam_answers;
create policy "답안 관리자 전체" on mock_exam_answers for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "답안 본인 학생" on mock_exam_answers;
create policy "답안 본인 학생" on mock_exam_answers for all to authenticated
  using (exists (select 1 from mock_exam_attempts a where a.id = mock_exam_answers.attempt_id and a.student_id = auth.uid()))
  with check (exists (select 1 from mock_exam_attempts a where a.id = mock_exam_answers.attempt_id and a.student_id = auth.uid()));

drop policy if exists "답안 담당 교사 조회" on mock_exam_answers;
create policy "답안 담당 교사 조회" on mock_exam_answers for select to authenticated
  using (exists (
    select 1 from mock_exam_attempts a
    join enrollments e on e.student_id = a.student_id and e.teacher_id = auth.uid()
    where a.id = mock_exam_answers.attempt_id
  ));

drop policy if exists "답안 보호자 조회" on mock_exam_answers;
create policy "답안 보호자 조회" on mock_exam_answers for select to authenticated
  using (exists (
    select 1 from mock_exam_attempts a
    join guardian_students gs on gs.student_id = a.student_id and gs.parent_id = auth.uid()
    where a.id = mock_exam_answers.attempt_id
  ));
