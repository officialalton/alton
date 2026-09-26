-- 2026-09-14 제품 오너 지시 — 문제 분류 모델: SAT 영역(sat_domain) + 세부 기술 코드(skill_code).
-- 문제은행(만들기·찾기)·회차 자동 구성(배정)·학생 성취 기록이 같은 분류를 쓴다. 표시용 태그가 아니라 기준이다.
-- 화면 사본: lib/problem-taxonomy.ts (테스트로 이 표와 같은지 확인).

create table if not exists problem_skill_codes (
  code text primary key,
  domain text not null check (domain in (
    'algebra','advanced_math','problem_solving_data','geometry_trig',
    'rw_information_ideas','rw_craft_structure','rw_expression_ideas','rw_standard_english')),
  label text not null,
  sort int not null default 0
);
alter table problem_skill_codes enable row level security;
drop policy if exists "기술 코드 조회" on problem_skill_codes;
create policy "기술 코드 조회" on problem_skill_codes for select to authenticated using (true);

insert into problem_skill_codes (code, domain, label, sort) values
  ('linear_equations_one_var','algebra','Linear equations in one variable',10),
  ('linear_functions','algebra','Linear functions',11),
  ('linear_equations_two_var','algebra','Linear equations in two variables',12),
  ('systems_linear','algebra','Systems of two linear equations',13),
  ('linear_inequalities','algebra','Linear inequalities',14),
  ('equivalent_expressions','advanced_math','Equivalent expressions',20),
  ('nonlinear_equations_systems','advanced_math','Nonlinear equations and systems',21),
  ('nonlinear_functions','advanced_math','Nonlinear functions',22),
  ('ratios_rates_units','problem_solving_data','Ratios, rates, proportional relationships, and units',30),
  ('percentages','problem_solving_data','Percentages',31),
  ('one_variable_data','problem_solving_data','One-variable data: distributions and measures',32),
  ('two_variable_data','problem_solving_data','Two-variable data: models and scatterplots',33),
  ('probability','problem_solving_data','Probability and conditional probability',34),
  ('inference_margin_error','problem_solving_data','Inference from sample statistics and margin of error',35),
  ('evaluating_statistical_claims','problem_solving_data','Evaluating statistical claims: observational studies and experiments',36),
  ('area_volume','geometry_trig','Area and volume',40),
  ('lines_angles_triangles','geometry_trig','Lines, angles, and triangles',41),
  ('right_triangles_trigonometry','geometry_trig','Right triangles and trigonometry',42),
  ('circles','geometry_trig','Circles',43),
  ('central_ideas_details','rw_information_ideas','Central Ideas and Details',50),
  ('inferences','rw_information_ideas','Inferences',51),
  ('command_of_evidence_text','rw_information_ideas','Command of Evidence (Textual)',52),
  ('command_of_evidence_quant','rw_information_ideas','Command of Evidence (Quantitative)',53),
  ('words_in_context','rw_craft_structure','Words in Context',60),
  ('text_structure_purpose','rw_craft_structure','Text Structure and Purpose',61),
  ('cross_text_connections','rw_craft_structure','Cross-Text Connections',62),
  ('rhetorical_synthesis','rw_expression_ideas','Rhetorical Synthesis',70),
  ('transitions','rw_expression_ideas','Transitions',71),
  ('boundaries','rw_standard_english','Boundaries',80),
  ('form_structure_sense','rw_standard_english','Form, Structure, and Sense',81)
on conflict (code) do update set domain = excluded.domain, label = excluded.label, sort = excluded.sort;

alter table problems
  add column if not exists sat_domain text check (sat_domain is null or sat_domain in (
    'algebra','advanced_math','problem_solving_data','geometry_trig',
    'rw_information_ideas','rw_craft_structure','rw_expression_ideas','rw_standard_english')),
  add column if not exists skill_code text references problem_skill_codes (code);
comment on column problems.sat_domain is 'SAT 영역(2026-09-14). skill_code 가 있으면 그 영역과 같아야 한다(트리거).';
comment on column problems.skill_code is '세부 기술 코드(problem_skill_codes). 문제은행·자동 구성·성취 기록의 공통 기준.';
create index if not exists problems_skill_code_idx on problems (skill_code) where archived_at is null;
create index if not exists problems_sat_domain_idx on problems (sat_domain) where archived_at is null;

-- skill_code 를 정하면 영역은 그 코드의 영역으로 맞춘다(불일치 방지).
create or replace function public.problems_sync_domain_from_skill()
returns trigger language plpgsql as $$
begin
  if new.skill_code is not null then
    select domain into new.sat_domain from problem_skill_codes where code = new.skill_code;
  end if;
  return new;
end;
$$;
drop trigger if exists problems_sync_domain_from_skill on problems;
create trigger problems_sync_domain_from_skill before insert or update of skill_code on problems
  for each row execute function public.problems_sync_domain_from_skill();

-- 옛 자유 입력 유형(skill_type)에서 영역만 추정해 채운다. 세부 기술은 사람이 고른다.
update problems set sat_domain = case
    when skill_type ilike '%advanced%' then 'advanced_math'
    when skill_type ilike '%algebra%' then 'algebra'
    when skill_type ilike '%problem-solving%' or skill_type ilike '%data analysis%' then 'problem_solving_data'
    when skill_type ilike '%geometry%' or skill_type ilike '%trigonometry%' then 'geometry_trig'
    else sat_domain end
  where sat_domain is null and skill_type is not null;
update problems p set skill_code = c.code
  from problem_skill_codes c
  where p.skill_code is null and p.skill_type is not null and lower(p.skill_type) = lower(c.label);

-- 문제 만들기: 기술 코드를 받는다(옛 6-인자 함수는 내린다 — 오버로드 모호성 방지).
drop function if exists public.create_bank_problem(uuid, text, text, text, text, uuid);
create or replace function public.create_bank_problem(
  p_subject_id uuid,
  p_format text,
  p_skill_type text,
  p_topic text,
  p_difficulty text,
  p_actor_id uuid,
  p_skill_code text default null
)
returns uuid
language plpgsql
security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from subjects where id = p_subject_id and archived_at is null) then
    raise exception '보관되지 않은 과목을 골라야 합니다.';
  end if;
  if nullif(p_skill_code, '') is not null and not exists (select 1 from problem_skill_codes where code = p_skill_code) then
    raise exception '알 수 없는 기술 코드입니다: %', p_skill_code;
  end if;
  insert into problems (format, subject_id, status, created_by, skill_type, topic, difficulty, skill_code)
  values (p_format::problem_format, p_subject_id, 'draft', p_actor_id, nullif(p_skill_type, ''), nullif(p_topic, ''),
          nullif(p_difficulty, '')::problem_difficulty, nullif(p_skill_code, ''))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.create_bank_problem(uuid, text, text, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.create_bank_problem(uuid, text, text, text, text, uuid, text) to service_role;

-- 자동 구성 후보에 분류를 싣는다.
create or replace view public.problem_auto_composition_candidates
with (security_invoker = true) as
select pk.problem_id, pk.keyword_id, p.format, p.difficulty, p.created_at, p.sat_domain, p.skill_code
from problem_keywords_selectable pk
join problems p on p.id = pk.problem_id
where exists (select 1 from problem_versions v where v.problem_id = pk.problem_id and v.status = 'published');

-- 회차 조건에 기술 코드 목록을 추가한다(null 이면 제한 없음).
alter table subject_template_unit_problem_criteria add column if not exists skill_codes text[];
alter table teacher_curriculum_template_unit_problem_criteria add column if not exists skill_codes text[];

create or replace function sync_catalog_unit_auto_problems(p_unit_id uuid)
returns table (added int, removed int, available int)
language plpgsql
as $$
declare
  v_added int := 0; v_removed int := 0; v_available int := 0; v_next int;
  v_formats text[]; v_difficulties text[]; v_skills text[]; v_target int; v_cap int;
begin
  select formats, difficulties, skill_codes, target_count into v_formats, v_difficulties, v_skills, v_target
  from subject_template_unit_problem_criteria where unit_id = p_unit_id;
  v_cap := coalesce(v_target, 20);

  select count(*) into v_available
  from problem_auto_composition_candidates c
  where c.keyword_id in (select keyword_id from subject_template_unit_keywords where unit_id = p_unit_id)
    and (v_formats is null or c.format::text = any (v_formats))
    and (v_difficulties is null or c.difficulty::text = any (v_difficulties))
    and (v_skills is null or c.skill_code = any (v_skills));

  with gone as (
    delete from subject_template_unit_problems m
    where m.unit_id = p_unit_id and m.source = 'auto'
      and not exists (
        select 1 from problem_auto_composition_candidates c
        where c.problem_id = m.problem_id
          and c.keyword_id in (select keyword_id from subject_template_unit_keywords where unit_id = p_unit_id)
          and (v_formats is null or c.format::text = any (v_formats))
          and (v_difficulties is null or c.difficulty::text = any (v_difficulties))
          and (v_skills is null or c.skill_code = any (v_skills)))
    returning 1)
  select count(*) into v_removed from gone;

  select coalesce(max(position), 0) into v_next from subject_template_unit_problems where unit_id = p_unit_id;

  with candidates as (
    select distinct c.problem_id, c.created_at
    from problem_auto_composition_candidates c
    where c.keyword_id in (select keyword_id from subject_template_unit_keywords where unit_id = p_unit_id)
      and (v_formats is null or c.format::text = any (v_formats))
      and (v_difficulties is null or c.difficulty::text = any (v_difficulties))
      and (v_skills is null or c.skill_code = any (v_skills))
      and not exists (select 1 from subject_template_unit_problems e where e.unit_id = p_unit_id and e.problem_id = c.problem_id)
      and not exists (select 1 from subject_template_unit_problem_exclusions x where x.unit_id = p_unit_id and x.problem_id = c.problem_id)
  ), room as (
    select greatest(v_cap - (select count(*) from subject_template_unit_problems where unit_id = p_unit_id and source = 'auto'), 0) as slots
  ), picked as (
    select c.problem_id, c.created_at from candidates c, room r where r.slots > 0
    order by c.created_at, c.problem_id limit (select slots from room)
  ), ins as (
    insert into subject_template_unit_problems (unit_id, problem_id, position, source, created_by)
    select p_unit_id, pk.problem_id, v_next + row_number() over (order by pk.created_at, pk.problem_id), 'auto', auth.uid()
    from picked pk on conflict do nothing returning 1)
  select count(*) into v_added from ins;

  return query select v_added, v_removed, v_available;
end;
$$;

create or replace function sync_teacher_unit_auto_problems(p_unit_id uuid)
returns table (added int, removed int, available int)
language plpgsql
as $$
declare
  v_added int := 0; v_removed int := 0; v_available int := 0; v_next int;
  v_formats text[]; v_difficulties text[]; v_skills text[]; v_target int; v_cap int;
begin
  select formats, difficulties, skill_codes, target_count into v_formats, v_difficulties, v_skills, v_target
  from teacher_curriculum_template_unit_problem_criteria where unit_id = p_unit_id;
  v_cap := coalesce(v_target, 20);

  select count(*) into v_available
  from problem_auto_composition_candidates c
  where c.keyword_id in (select keyword_id from teacher_curriculum_template_unit_keywords where unit_id = p_unit_id)
    and (v_formats is null or c.format::text = any (v_formats))
    and (v_difficulties is null or c.difficulty::text = any (v_difficulties))
    and (v_skills is null or c.skill_code = any (v_skills));

  with gone as (
    delete from teacher_curriculum_template_unit_problems m
    where m.unit_id = p_unit_id and m.source = 'auto'
      and not exists (
        select 1 from problem_auto_composition_candidates c
        where c.problem_id = m.problem_id
          and c.keyword_id in (select keyword_id from teacher_curriculum_template_unit_keywords where unit_id = p_unit_id)
          and (v_formats is null or c.format::text = any (v_formats))
          and (v_difficulties is null or c.difficulty::text = any (v_difficulties))
          and (v_skills is null or c.skill_code = any (v_skills)))
    returning 1)
  select count(*) into v_removed from gone;

  select coalesce(max(position), 0) into v_next from teacher_curriculum_template_unit_problems where unit_id = p_unit_id;

  with candidates as (
    select distinct c.problem_id, c.created_at
    from problem_auto_composition_candidates c
    where c.keyword_id in (select keyword_id from teacher_curriculum_template_unit_keywords where unit_id = p_unit_id)
      and (v_formats is null or c.format::text = any (v_formats))
      and (v_difficulties is null or c.difficulty::text = any (v_difficulties))
      and (v_skills is null or c.skill_code = any (v_skills))
      and not exists (select 1 from teacher_curriculum_template_unit_problems e where e.unit_id = p_unit_id and e.problem_id = c.problem_id)
      and not exists (select 1 from teacher_curriculum_template_unit_problem_exclusions x where x.unit_id = p_unit_id and x.problem_id = c.problem_id)
  ), room as (
    select greatest(v_cap - (select count(*) from teacher_curriculum_template_unit_problems where unit_id = p_unit_id and source = 'auto'), 0) as slots
  ), picked as (
    select c.problem_id, c.created_at from candidates c, room r where r.slots > 0
    order by c.created_at, c.problem_id limit (select slots from room)
  ), ins as (
    insert into teacher_curriculum_template_unit_problems (unit_id, problem_id, position, source, created_by)
    select p_unit_id, pk.problem_id, v_next + row_number() over (order by pk.created_at, pk.problem_id), 'auto', auth.uid()
    from picked pk on conflict do nothing returning 1)
  select count(*) into v_added from ins;

  return query select v_added, v_removed, v_available;
end;
$$;

-- 수업 관계자용 문제 유형 조회에 분류도 싣는다(학생 성취 기록·문제 화면 배지).
create or replace function public.session_problem_classification(p_session_id uuid)
returns table (problem_id uuid, format text, sat_domain text, skill_code text)
language sql
security definer set search_path = public
stable as $$
  select p.id, p.format::text, p.sat_domain, p.skill_code
  from problems p
  where public.is_session_participant(p_session_id)
    and (exists (select 1 from session_content_manifest m where m.session_id = p_session_id and m.content_type = 'problem' and m.content_id = p.id)
      or exists (select 1 from session_homework_items h where h.session_id = p_session_id and h.problem_id = p.id));
$$;
revoke all on function public.session_problem_classification(uuid) from public, anon;
grant execute on function public.session_problem_classification(uuid) to authenticated;
