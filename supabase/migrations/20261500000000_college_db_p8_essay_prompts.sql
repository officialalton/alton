-- 대학 진학 정보 DB Part 8 — 지원요강·에세이 문항(지원연도/유형/경로별) 확장.
--
-- 배경: university_essay_prompts(P5, 20261428000000)는 "학교 자체 supplement 에세이
-- 문항 텍스트 + 글자수 제한 + 필수여부"만 표현 가능해서, 공통지원서 에세이 구분,
-- 단과대·전공별 조건부 문항, "N개 중 M개 선택" 선택 규칙, 지원 경로(ED/EA/RD/편입/
-- 국제학생) 조건, 출처/확인상태(올해 확인 중 vs 지난 연도 참고)를 표현하지 못한다.
-- 기존 테이블/컬럼은 삭제하지 않고(레거시 read 유지) additive ALTER로 확장한다.
-- university_admission_cycles.essay_count/essay_topics(P2)도 그대로 둔다.
--
-- 정책: 합격 확률/가능성 예측 기능은 여기 없다(기존 원칙과 동일, 이 테이블은 문항 텍스트만).

alter table university_essay_prompts
  alter column prompt_text drop not null; -- common_app 등 원문 미확보 시 topic_summary만 저장 가능해야 함

alter table university_essay_prompts
  add column if not exists prompt_type text not null default 'school_specific' check (prompt_type in (
    'common_app',        -- 공통 지원서 에세이(Common App/Coalition 등 플랫폼 공통 문항)
    'school_specific',   -- 대학 자체 추가 에세이("Why us" 등) — 기존 레거시 행의 기본값
    'short_answer',      -- 짧은 답변·활동 설명
    'program_conditional' -- 단과대/전공/프로그램별 조건부 문항
  )),
  add column if not exists title text,
  add column if not exists topic_summary text, -- 원문 확보 전, 확인 가능한 주제 요약

  -- 선택 규칙: "N개 중 M개 선택". 같은 selection_group_id를 공유하는 행들이 한 그룹이고,
  -- select_count/group_size는 그룹 내 모든 행에 동일하게 채운다(비정규화지만 조회 단순화).
  add column if not exists selection_group_id uuid,
  add column if not exists select_count integer,  -- 그룹에서 골라야 하는 개수(예: 4)
  add column if not exists group_size integer,     -- 그룹 전체 문항 수(예: 8) — null이면 그룹 행 수로 계산

  -- 조건부 적용 범위(program_conditional 등에서 사용, 그 외엔 null=전체 적용)
  add column if not exists applies_to_school text,        -- 단과대(College of Engineering 등)
  add column if not exists applies_to_majors text[],      -- 전공/프로그램 목록
  add column if not exists application_paths text[],      -- ED/EA/RD/transfer/international 등(null=전체)

  add column if not exists word_limit_min integer,
  add column if not exists word_limit_max integer, -- 기존 word_limit과 별개로 상한 명시(레거시 word_limit은 그대로 둠)
  add column if not exists char_limit integer,

  add column if not exists source_url_id uuid references university_source_urls(id) on delete set null,

  add column if not exists prompt_status text not null default 'unconfirmed_current_year' check (prompt_status in (
    'confirmed_current_year',   -- 올해 사이클 문항으로 원문 대조 확인 완료
    'unconfirmed_current_year', -- 올해 문항으로 추정되나 원문 대조 미완료(확인 중)
    'prior_year_reference'      -- 지난 연도 문항(참고용, 올해 문항 아님)
  )),
  add column if not exists last_verified_at date,

  add column if not exists reviewed_by uuid references auth.users(id),
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text,

  add column if not exists notes text,
  add column if not exists updated_at timestamptz not null default now();

comment on table university_essay_prompts is
  'P5(2026-09-19) 원본 + P8(2026-09-23) 확장: 지원연도×유형별 에세이/짧은답변 문항 — 선택규칙(N개 중 M개)·지원경로·조건부 적용범위·확인상태 포함. university_admission_cycles.essay_count/essay_topics는 변경 없이 그대로 둔다(이 테이블이 대체하지 않음).';
comment on column university_essay_prompts.prompt_type is 'common_app=공통지원서 에세이, school_specific=대학 자체 추가 에세이(레거시 기본값), short_answer=짧은 답변/활동 설명, program_conditional=단과대·전공·프로그램별 조건부 문항.';
comment on column university_essay_prompts.selection_group_id is '"N개 중 M개 선택" 그룹 식별자. 같은 값을 가진 행들이 한 그룹.';
comment on column university_essay_prompts.select_count is '그룹에서 실제로 작성해야 하는 문항 수(M). 그룹 전체 행에 동일값.';
comment on column university_essay_prompts.group_size is '그룹 전체 제시 문항 수(N). null이면 조회 시 그룹 행 개수로 계산.';
comment on column university_essay_prompts.prompt_status is 'confirmed_current_year=올해 문항 원문 대조 완료, unconfirmed_current_year=올해 문항 추정(확인 중), prior_year_reference=지난 연도 참고용(올해 문항 아님).';

create index if not exists idx_university_essay_prompts_selection_group
  on university_essay_prompts(selection_group_id);
create index if not exists idx_university_essay_prompts_status
  on university_essay_prompts(prompt_status);

drop trigger if exists set_updated_at_university_essay_prompts on university_essay_prompts;
create trigger set_updated_at_university_essay_prompts
  before update on university_essay_prompts
  for each row execute function set_updated_at();

-- =========================================================================
-- 백필 — 200개교 조사 문서 중 실제 에세이 문항 데이터가 확보된 대학 일부를 새 구조로
-- 이관. 원문 미확보/추측 채우기 금지 — 확인 상태를 정직하게 표시.
-- =========================================================================

-- Common App 공통 에세이 — 2026-2027 사이클(2027 cycle_year) 문항은 공통지원서
-- 플랫폼이 매년 9월경 갱신 발표하며, 이 마이그레이션 작성 시점 기준 원문 대조가 안 돼
-- 있어 전 대학 공통으로 'unconfirmed_current_year' + 선택규칙(7개 중 1개)만 표시.
insert into university_essay_prompts (
  university_id, cycle_year, prompt_type, title, topic_summary,
  selection_group_id, select_count, group_size, is_required,
  word_limit_min, word_limit_max, prompt_status, notes
)
select u.id, 2027, 'common_app', 'Common App Personal Essay', '성장 배경/정체성/도전과 극복/지적 호기심/감사/성장 계기/자유주제 중 택1(2026-2027 사이클 7개 문항 유지 추정)',
  gen_random_uuid(), 1, 7, false,
  250, 650, 'unconfirmed_current_year',
  'P8(2026-09-23) 이관: Common App 공통문항은 공식 사이트 원문 대조 전(추정치). 매년 갱신되므로 확정 전 배지로 "확인 중" 표시 필수.'
from universities u
where u.name in ('Princeton University', 'Massachusetts Institute of Technology', 'Harvard University', 'Stanford University', 'Yale University')
  and u.country = 'United States';

-- MIT — 자체 추가 에세이(원문 문구는 공식 사이트 기준 매년 재확인 필요하므로 주제 요약만 이관,
-- prior_year_reference로 표시: 2025-2026 사이클 기준 확보 자료이며 2026-2027 원문 미대조).
insert into university_essay_prompts (
  university_id, cycle_year, prompt_type, title, topic_summary,
  is_required, word_limit_max, prompt_status, notes
)
select u.id, 2026, 'school_specific', t.title, t.summary, true, t.limit_words, 'prior_year_reference',
  'P8(2026-09-23) 이관: 2025-2026 사이클 자료(작년 문항) — 올해(2027 cycle) 문항 아님, 원문 재확인 전까지 참고용.'
from universities u
cross join (values
  ('세상에 대한 기여(커뮤니티 활동)', '학교/커뮤니티에 기여한 경험', 200),
  ('도전과 배움', '어려움을 겪고 배운 점', 200),
  ('창의성/즐거움', '순수하게 즐거워서 하는 활동', 200),
  ('협업 경험', '다른 사람과 함께 문제를 해결한 경험', 200)
) as t(title, summary, limit_words)
where u.name = 'Massachusetts Institute of Technology' and u.country = 'United States';

-- Stanford — 단과대 조건부 문항 예시(공학 계열 지원 시 추가 질문) — 원문 미확보로
-- topic_summary만, 'unconfirmed_current_year'.
insert into university_essay_prompts (
  university_id, cycle_year, prompt_type, title, topic_summary,
  applies_to_school, application_paths, is_required, word_limit_max, prompt_status, notes
)
select u.id, 2027, 'program_conditional', '공학 전공 관심 분야 서술', '공학 계열(School of Engineering) 지원자 대상 관심 분야/프로젝트 경험 서술 추정',
  'School of Engineering', null, true, 250, 'unconfirmed_current_year',
  'P8(2026-09-23) 이관: 200개교 조사 노트 기반 추정 — 원문 확보 전이라 확인 중으로 표시.'
from universities u where u.name = 'Stanford University' and u.country = 'United States';

-- Yale — 짧은 답변(활동 설명) 예시, 2026-2027 원문 미대조로 unconfirmed.
insert into university_essay_prompts (
  university_id, cycle_year, prompt_type, title, topic_summary,
  is_required, word_limit_max, prompt_status, notes
)
select u.id, 2027, 'short_answer', '활동 설명(가장 의미있었던 경험)', '지원자가 가장 의미 있었다고 느낀 활동/경험을 짧게 서술',
  true, 200, 'unconfirmed_current_year',
  'P8(2026-09-23) 이관: 공식 사이트 원문 대조 전(추정치).'
from universities u where u.name = 'Yale University' and u.country = 'United States';

-- Harvard — 국제학생 조건부 문항 예시(재정보조 서류 관련 서술, application_paths=international).
insert into university_essay_prompts (
  university_id, cycle_year, prompt_type, title, topic_summary,
  application_paths, is_required, word_limit_max, prompt_status, notes
)
select u.id, 2027, 'program_conditional', '국제학생 재정 상황 서술', '국제학생 지원자 대상 재정보조 신청 관련 추가 서술 문항(조건부) — 원문 미확보',
  array['international'], true, 150, 'unconfirmed_current_year',
  'P8(2026-09-23) 이관: 200개교 조사 노트 기반 추정 — 원문 확보 전이라 확인 중으로 표시.'
from universities u where u.name = 'Harvard University' and u.country = 'United States';
