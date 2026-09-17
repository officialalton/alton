-- 2026-09-17(제품 오너 지시) — "얇은 근거 모델"(Evidence Model). R&W 5개 세부 기술
-- (words_in_context, central_ideas_details, inferences, command_of_evidence_text,
-- cross_text_connections)에 한해, 기존 구조화 자료 블록(Text1/2·표/그래프 근거·밑줄/
-- 빈칸)은 그대로 두고 그 위에 target/evidence_span/answer_rationale/
-- distractor_error_types 네 필드를 추가한다. 다른 6개 R&W 세부 기술과 19개 Math
-- 세부 기술은 항상 null이다 — 이 필드들은 학생 화면에 절대 노출하지 않는 내부/관리자
-- 전용 데이터다(app/admin/ProblemDraftEditor.tsx 검수 화면에서만 읽기 전용으로 보인다).
alter table public.problem_versions add column if not exists evidence_target text;
alter table public.problem_versions add column if not exists evidence_span text;
alter table public.problem_versions add column if not exists answer_rationale text;
alter table public.problem_versions add column if not exists distractor_error_types jsonb;

comment on column public.problem_versions.evidence_target is
  '근거 모델(내부/관리자 전용, 2026-09-17): 이 문항이 실제로 묻는 대상. null이면 근거 모델 대상 세부 기술이 아니다.';
comment on column public.problem_versions.evidence_span is
  '근거 모델(내부/관리자 전용): 정답 근거가 되는 지문의 축자 그대로의 부분 문자열(생성 시점에 결정적으로 검증됨). 학생에게 노출하지 않는다.';
comment on column public.problem_versions.answer_rationale is
  '근거 모델(내부/관리자 전용): evidence_span이 정답을 어떻게 뒷받침하는지의 짧은 구조화 문장. explanation(학생 노출 해설 산문)과 다른 필드다.';
comment on column public.problem_versions.distractor_error_types is
  '근거 모델(내부/관리자 전용): 오답(정답 제외) 옵션 순서대로 오류 유형 태그 배열(고정 enum, lib/problem-generation/evidence-model-check.ts). 학생에게 노출하지 않는다.';

drop function if exists public.create_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb, jsonb, boolean, jsonb, text, text, text);
create or replace function public.create_problem_draft_version(
  p_problem_id uuid, p_passage text, p_options jsonb, p_correct_index int, p_explanation text, p_difficulty text, p_actor_id uuid,
  p_answers jsonb default null, p_figure jsonb default null, p_figure_checked boolean default false, p_statements jsonb default null,
  p_question text default null, p_repair_status text default 'none', p_explanation_en text default null,
  p_evidence_target text default null, p_evidence_span text default null, p_answer_rationale text default null, p_distractor_error_types jsonb default null
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
  insert into problem_versions (
    problem_id, version_no, passage, question, options, correct_index, explanation, explanation_en, difficulty, answers, figure, figure_checked, statements, status, created_by, repair_status,
    evidence_target, evidence_span, answer_rationale, distractor_error_types
  )
  values (
    p_problem_id, v_next, p_passage, nullif(btrim(p_question), ''), p_options, p_correct_index, p_explanation, p_explanation_en, p_difficulty, p_answers, p_figure, coalesce(p_figure_checked, false), p_statements, 'draft', p_actor_id, p_repair_status,
    p_evidence_target, p_evidence_span, p_answer_rationale, p_distractor_error_types
  )
  returning id into v_id;
  return v_id;
end; $$;
revoke execute on function public.create_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb, jsonb, boolean, jsonb, text, text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb, jsonb, boolean, jsonb, text, text, text, text, text, text, jsonb) to service_role;

drop function if exists public.save_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb, jsonb, boolean, jsonb, text, text, text);
create or replace function public.save_problem_draft_version(
  p_problem_id uuid, p_passage text, p_options jsonb, p_correct_index int, p_explanation text, p_difficulty text, p_actor_id uuid,
  p_answers jsonb default null, p_figure jsonb default null, p_figure_checked boolean default false, p_statements jsonb default null,
  p_question text default null, p_repair_status text default null, p_explanation_en text default null,
  p_evidence_target text default null, p_evidence_span text default null, p_answer_rationale text default null, p_distractor_error_types jsonb default null
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
          created_by = p_actor_id,
          evidence_target = p_evidence_target, evidence_span = p_evidence_span, answer_rationale = p_answer_rationale, distractor_error_types = p_distractor_error_types
      where id = v_existing.id;
    return v_existing.id;
  end if;
  return create_problem_draft_version(p_problem_id, p_passage, p_options, p_correct_index, p_explanation, p_difficulty, p_actor_id, p_answers, p_figure, p_figure_checked, p_statements, p_question, coalesce(p_repair_status, 'none'), p_explanation_en, p_evidence_target, p_evidence_span, p_answer_rationale, p_distractor_error_types);
end; $$;
revoke execute on function public.save_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb, jsonb, boolean, jsonb, text, text, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.save_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb, jsonb, boolean, jsonb, text, text, text, text, text, text, jsonb) to service_role;
