-- 2026-09-14 수식·선택지 블록 — 로마숫자 진술(statements) 저장, 내용 검증도 render_check 게이트에 태운다.
--   * problem_versions.statements: ["$a > 0$", "$b < 0$", ...] — 선택지가 'I only', 'I and II' 조합인 문항.
--   * 초안 RPC 에 p_statements 추가(옛 10-인자 오버로드는 내린다).
--   * 공개 게이트: render_check 가 있으면 ok 여야 한다(그림 없는 문항도 내용 검증 결과가 실린다). 앱이 저장한 초안은 항상 render_check 가 있다.

alter table problem_versions add column if not exists statements jsonb;
comment on column problem_versions.statements is '로마숫자 진술 목록(I, II, III …). 선택지가 조합("I only")일 때만. 렌더는 앱.';

drop function if exists public.create_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb, jsonb, boolean);
create or replace function public.create_problem_draft_version(
  p_problem_id uuid, p_passage text, p_options jsonb, p_correct_index int, p_explanation text, p_difficulty text, p_actor_id uuid,
  p_answers jsonb default null, p_figure jsonb default null, p_figure_checked boolean default false, p_statements jsonb default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_next int; v_id uuid;
begin
  if not exists (select 1 from problems where id = p_problem_id) then raise exception '존재하지 않는 문제입니다.'; end if;
  if exists (select 1 from problem_versions where problem_id = p_problem_id and status in ('draft', 'in_review')) then
    raise exception '이미 작업 중인 버전이 있습니다. 그 버전을 수정하거나 공개·보류한 뒤에 새로 만드세요.';
  end if;
  select coalesce(max(version_no), 0) + 1 into v_next from problem_versions where problem_id = p_problem_id;
  insert into problem_versions (problem_id, version_no, passage, options, correct_index, explanation, difficulty, answers, figure, figure_checked, statements, status, created_by)
  values (p_problem_id, v_next, p_passage, p_options, p_correct_index, p_explanation, p_difficulty, p_answers, p_figure, coalesce(p_figure_checked, false), p_statements, 'draft', p_actor_id)
  returning id into v_id;
  return v_id;
end; $$;
revoke execute on function public.create_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb, jsonb, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.create_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb, jsonb, boolean, jsonb) to service_role;

drop function if exists public.save_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb, jsonb, boolean);
create or replace function public.save_problem_draft_version(
  p_problem_id uuid, p_passage text, p_options jsonb, p_correct_index int, p_explanation text, p_difficulty text, p_actor_id uuid,
  p_answers jsonb default null, p_figure jsonb default null, p_figure_checked boolean default false, p_statements jsonb default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_existing problem_versions;
begin
  if not exists (select 1 from problems where id = p_problem_id) then raise exception '존재하지 않는 문제입니다.'; end if;
  select * into v_existing from problem_versions where problem_id = p_problem_id and status in ('draft', 'in_review') order by version_no desc limit 1;
  if v_existing.id is not null and v_existing.status = 'in_review' then raise exception '검수 중인 버전은 고칠 수 없습니다. 공개하거나 새 초안을 만드세요.'; end if;
  if v_existing.id is not null then
    update problem_versions
      set passage = p_passage, options = p_options, correct_index = p_correct_index, explanation = p_explanation, difficulty = p_difficulty,
          answers = p_answers, figure = p_figure, statements = p_statements,
          figure_checked = case when p_figure is distinct from v_existing.figure then false else coalesce(p_figure_checked, v_existing.figure_checked) end,
          created_by = p_actor_id
      where id = v_existing.id;
    return v_existing.id;
  end if;
  return create_problem_draft_version(p_problem_id, p_passage, p_options, p_correct_index, p_explanation, p_difficulty, p_actor_id, p_answers, p_figure, p_figure_checked, p_statements);
end; $$;
revoke execute on function public.save_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb, jsonb, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.save_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb, jsonb, boolean, jsonb) to service_role;
