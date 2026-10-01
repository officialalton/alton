-- 2026-09-15 제품 오너 — 관리자 검수 예외는 문제은행 초안과 분리한다.
--   게이트 실패 문항을 일반 초안·자동 구성 후보·공개 목록에 남기지 않는다. 다만 지문·질문·정답·자료는 통과했고
--   오답만 보강하면 되는 경우는 별도 '오답 보강 대기' 로 표시해 기본 화면에서 숨긴다. 통과해야만 일반 초안(none)으로 바뀐다.

alter table problem_versions add column if not exists repair_status text not null default 'none' check (repair_status in ('none', 'needs_distractor_repair'));
comment on column problem_versions.repair_status is '2026-09-15: needs_distractor_repair 면 지문·질문·정답·자료는 통과했으나 오답만 보강이 필요 — 기본 초안 목록·자동 구성·공개에서 숨긴다. 관리자가 고쳐 다시 검사를 통과하면 none 으로 바뀐다.';
create index if not exists problem_versions_repair_status_idx on problem_versions (repair_status) where repair_status <> 'none';

drop function if exists public.create_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb, jsonb, boolean, jsonb, text);
create or replace function public.create_problem_draft_version(
  p_problem_id uuid, p_passage text, p_options jsonb, p_correct_index int, p_explanation text, p_difficulty text, p_actor_id uuid,
  p_answers jsonb default null, p_figure jsonb default null, p_figure_checked boolean default false, p_statements jsonb default null,
  p_question text default null, p_repair_status text default 'none'
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_next int; v_id uuid;
begin
  if not exists (select 1 from problems where id = p_problem_id) then raise exception '존재하지 않는 문제입니다.'; end if;
  if exists (select 1 from problem_versions where problem_id = p_problem_id and status in ('draft', 'in_review')) then
    raise exception '이미 작업 중인 버전이 있습니다. 그 버전을 수정하거나 공개·보류한 뒤에 새로 만드세요.';
  end if;
  if p_repair_status not in ('none', 'needs_distractor_repair') then raise exception '알 수 없는 repair_status 입니다: %', p_repair_status; end if;
  select coalesce(max(version_no), 0) + 1 into v_next from problem_versions where problem_id = p_problem_id;
  insert into problem_versions (problem_id, version_no, passage, question, options, correct_index, explanation, difficulty, answers, figure, figure_checked, statements, status, created_by, repair_status)
  values (p_problem_id, v_next, p_passage, nullif(btrim(p_question), ''), p_options, p_correct_index, p_explanation, p_difficulty, p_answers, p_figure, coalesce(p_figure_checked, false), p_statements, 'draft', p_actor_id, p_repair_status)
  returning id into v_id;
  return v_id;
end; $$;
revoke execute on function public.create_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb, jsonb, boolean, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.create_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb, jsonb, boolean, jsonb, text, text) to service_role;

drop function if exists public.save_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb, jsonb, boolean, jsonb, text);
create or replace function public.save_problem_draft_version(
  p_problem_id uuid, p_passage text, p_options jsonb, p_correct_index int, p_explanation text, p_difficulty text, p_actor_id uuid,
  p_answers jsonb default null, p_figure jsonb default null, p_figure_checked boolean default false, p_statements jsonb default null,
  p_question text default null, p_repair_status text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_existing problem_versions;
begin
  if not exists (select 1 from problems where id = p_problem_id) then raise exception '존재하지 않는 문제입니다.'; end if;
  if p_repair_status is not null and p_repair_status not in ('none', 'needs_distractor_repair') then raise exception '알 수 없는 repair_status 입니다: %', p_repair_status; end if;
  select * into v_existing from problem_versions where problem_id = p_problem_id and status in ('draft', 'in_review') order by version_no desc limit 1;
  if v_existing.id is not null and v_existing.status = 'in_review' then raise exception '검수 중인 버전은 고칠 수 없습니다. 공개하거나 새 초안을 만드세요.'; end if;
  if v_existing.id is not null then
    update problem_versions
      set passage = p_passage, question = nullif(btrim(p_question), ''), options = p_options, correct_index = p_correct_index, explanation = p_explanation, difficulty = p_difficulty,
          answers = p_answers, figure = p_figure, statements = p_statements,
          figure_checked = case when p_figure is distinct from v_existing.figure then false else coalesce(p_figure_checked, v_existing.figure_checked) end,
          repair_status = coalesce(p_repair_status, v_existing.repair_status),
          created_by = p_actor_id
      where id = v_existing.id;
    return v_existing.id;
  end if;
  return create_problem_draft_version(p_problem_id, p_passage, p_options, p_correct_index, p_explanation, p_difficulty, p_actor_id, p_answers, p_figure, p_figure_checked, p_statements, p_question, coalesce(p_repair_status, 'none'));
end; $$;
revoke execute on function public.save_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb, jsonb, boolean, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.save_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb, jsonb, boolean, jsonb, text, text) to service_role;

-- 오답 보강 대기 문항은 자동 구성 후보에 들어가지 않는다(published 만 후보이므로 이미 안전하지만 명시적으로 방어).
create or replace view public.problem_auto_composition_candidates
with (security_invoker = true) as
select pk.problem_id, pk.keyword_id, p.format, p.difficulty, p.created_at, p.sat_domain, p.skill_code, p.exam_system
from problem_keywords_selectable pk
join problems p on p.id = pk.problem_id
where exists (
  select 1 from problem_versions v
  where v.problem_id = pk.problem_id and v.status = 'published' and v.repair_status = 'none'
    and problem_version_has_question(v.passage, v.question)
);
