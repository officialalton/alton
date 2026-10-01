-- SAT 공용 키워드를 College Board 스킬 단위로 묶기 위한 컬럼(2026-10-01, additive).
-- 기존(거친) 키워드는 domain_code/skill_code 가 null 인 채로 남는다. 재실행 안전.
alter table subject_keywords add column if not exists domain_code text;
alter table subject_keywords add column if not exists skill_code text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'subject_keywords_domain_skill_pair') then
    alter table subject_keywords add constraint subject_keywords_domain_skill_pair
      check ((domain_code is null) = (skill_code is null));
  end if;
end $$;

create unique index if not exists subject_keywords_subject_skill_code_key
  on subject_keywords (subject_id, skill_code) where skill_code is not null;

comment on column subject_keywords.domain_code is
  'SAT 도메인 코드(lib/problem-taxonomy SAT_DOMAINS). skill_code 와 함께 null 이거나 함께 채운다. 표시 라벨은 앱 상수.';
comment on column subject_keywords.skill_code is
  'College Board 스킬 코드(problems.skill_code 와 같은 값). 과목 안에서 유일. null = 스킬 체계 이전의 구 키워드.';
