-- 2026-09-17(사용자 지시) — 해설을 한국어/영어 토글로 볼 수 있게 한다. 정답·오답·
-- 문제 참값은 바뀌지 않는다 — 같은 해설의 언어 버전만 하나 더 저장한다. 계산형
-- Math 컴파일러는 코드가 직접 영어 버전을 만들고(번역이 아니라 같은 계산에서 나온
-- 문구), AI 생성·수동 문항은 아직 영어 해설이 없으면 null로 둔다(관리자 화면은
-- null이면 토글 버튼 자체를 숨긴다).
alter table public.problem_versions add column if not exists explanation_en text;
comment on column public.problem_versions.explanation_en is
  '해설의 영어 버전(선택). null이면 한국어만 있다는 뜻 — 화면에서 토글을 숨긴다.';

drop function if exists public.create_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb, jsonb, boolean, jsonb, text, text);
create or replace function public.create_problem_draft_version(
  p_problem_id uuid, p_passage text, p_options jsonb, p_correct_index int, p_explanation text, p_difficulty text, p_actor_id uuid,
  p_answers jsonb default null, p_figure jsonb default null, p_figure_checked boolean default false, p_statements jsonb default null,
  p_question text default null, p_repair_status text default 'none', p_explanation_en text default null
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
  insert into problem_versions (problem_id, version_no, passage, question, options, correct_index, explanation, explanation_en, difficulty, answers, figure, figure_checked, statements, status, created_by, repair_status)
  values (p_problem_id, v_next, p_passage, nullif(btrim(p_question), ''), p_options, p_correct_index, p_explanation, p_explanation_en, p_difficulty, p_answers, p_figure, coalesce(p_figure_checked, false), p_statements, 'draft', p_actor_id, p_repair_status)
  returning id into v_id;
  return v_id;
end; $$;
revoke execute on function public.create_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb, jsonb, boolean, jsonb, text, text, text) from public, anon, authenticated;
grant execute on function public.create_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb, jsonb, boolean, jsonb, text, text, text) to service_role;

drop function if exists public.save_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb, jsonb, boolean, jsonb, text, text);
create or replace function public.save_problem_draft_version(
  p_problem_id uuid, p_passage text, p_options jsonb, p_correct_index int, p_explanation text, p_difficulty text, p_actor_id uuid,
  p_answers jsonb default null, p_figure jsonb default null, p_figure_checked boolean default false, p_statements jsonb default null,
  p_question text default null, p_repair_status text default null, p_explanation_en text default null
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
      set passage = p_passage, question = nullif(btrim(p_question), ''), options = p_options, correct_index = p_correct_index, explanation = p_explanation, explanation_en = p_explanation_en, difficulty = p_difficulty,
          answers = p_answers, figure = p_figure, statements = p_statements,
          figure_checked = case when p_figure is distinct from v_existing.figure then false else coalesce(p_figure_checked, v_existing.figure_checked) end,
          repair_status = coalesce(p_repair_status, v_existing.repair_status),
          created_by = p_actor_id
      where id = v_existing.id;
    return v_existing.id;
  end if;
  return create_problem_draft_version(p_problem_id, p_passage, p_options, p_correct_index, p_explanation, p_difficulty, p_actor_id, p_answers, p_figure, p_figure_checked, p_statements, p_question, coalesce(p_repair_status, 'none'), p_explanation_en);
end; $$;
revoke execute on function public.save_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb, jsonb, boolean, jsonb, text, text, text) from public, anon, authenticated;
grant execute on function public.save_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb, jsonb, boolean, jsonb, text, text, text) to service_role;
