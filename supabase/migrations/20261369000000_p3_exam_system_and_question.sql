-- 2026-09-14 제품 오너 지시 — 문제은행 생성·편집 재구성.
--   * 관리 과목(라이브러리)과 **문항 체계**(sat_rw / sat_math / ap)를 분리한다. 시험 분류(sat_domain·skill_code)는 문항 체계의 하위다.
--     관리 과목·키워드를 바꿔도 문항 체계·시험 분류는 바뀌지 않고, 문항 체계를 바꿔도 관리 과목·키워드는 유지된다(서로 다른 컬럼).
--   * AP 는 자리만 — problems.ap_subject(코드). AP 과목 목록은 앱(lib/problem-taxonomy AP_SUBJECTS).
--   * problem_versions.question — 질문을 지문/자료와 분리해 저장한다. 옛 버전은 null 이고 지문 안의 질문 문장을 그대로 읽는다.
--   * 질문이 없는 문제는 자동 구성 후보(problem_auto_composition_candidates)에서 뺀다. 공개본은 자동으로 고치지 않는다.
--   * create_bank_problem(+p_exam_system, p_ap_subject), create/save_problem_draft_version(+p_question). 옛 오버로드는 내린다.

alter table problems add column if not exists exam_system text check (exam_system in ('sat_rw', 'sat_math', 'ap'));
alter table problems add column if not exists ap_subject text;
comment on column problems.exam_system is '문항 체계(2026-09-14): sat_rw | sat_math | ap. 관리 과목(subject_id)과 독립. 시험 분류(sat_domain·skill_code)는 이 체계의 하위.';
comment on column problems.ap_subject is 'AP 과목 코드(exam_system = ap 일 때). 목록은 앱 lib/problem-taxonomy AP_SUBJECTS.';
create index if not exists problems_exam_system_idx on problems (exam_system) where archived_at is null;

alter table problem_versions add column if not exists question text;
comment on column problem_versions.question is '질문 문장(2026-09-14). 지문/자료(passage)와 분리. null 이면 옛 버전 — 지문 안의 마지막 질문 단락을 그대로 읽는다.';

-- 시험 영역이 이미 있는 문제는 체계가 결정적으로 따라온다(rw_* → sat_rw, 그 외 SAT 영역 → sat_math). 영역이 없는 문제는 비워 둔다 — 자동 분류하지 않는다.
update problems set exam_system = case when sat_domain like 'rw\_%' then 'sat_rw' else 'sat_math' end
where exam_system is null and sat_domain is not null;

-- skill_code 를 정하면 영역과 체계가 그 코드에 맞춰진다(불일치 방지). 옛 트리거를 대체한다.
create or replace function public.problems_sync_domain_from_skill()
returns trigger language plpgsql as $$
begin
  if new.skill_code is not null then
    select domain into new.sat_domain from problem_skill_codes where code = new.skill_code;
    new.exam_system := case when new.sat_domain like 'rw\_%' then 'sat_rw' else 'sat_math' end;
    new.ap_subject := null;
  elsif new.exam_system = 'ap' then
    new.sat_domain := null;
  elsif new.sat_domain is not null and new.exam_system is null then
    new.exam_system := case when new.sat_domain like 'rw\_%' then 'sat_rw' else 'sat_math' end;
  end if;
  if new.exam_system is distinct from 'ap' then new.ap_subject := null; end if;
  return new;
end;
$$;
drop trigger if exists problems_sync_domain_from_skill on problems;
create trigger problems_sync_domain_from_skill before insert or update of skill_code, sat_domain, exam_system, ap_subject on problems
  for each row execute function public.problems_sync_domain_from_skill();

-- 질문이 있는가 — 분리된 question 이 있거나, 지문 안에 SAT 문항 말투의 물음 문장이 있다.
create or replace function public.problem_version_has_question(p_passage text, p_question text)
returns boolean language sql immutable as $$
  select coalesce(nullif(btrim(p_question), ''), '') <> ''
      or coalesce(p_passage, '') ~ '\?\s*$'
      or coalesce(p_passage, '') ~ '(^|\n)\s*(Which|What|Based on|According to|As used|The student wants|How|Why|If |In the|Text [12]|The (author|text|passage))[^\n]*\?';
$$;

create or replace view public.problem_auto_composition_candidates
with (security_invoker = true) as
select pk.problem_id, pk.keyword_id, p.format, p.difficulty, p.created_at, p.sat_domain, p.skill_code, p.exam_system
from problem_keywords_selectable pk
join problems p on p.id = pk.problem_id
where exists (
  select 1 from problem_versions v
  where v.problem_id = pk.problem_id and v.status = 'published'
    and problem_version_has_question(v.passage, v.question)
);

-- 문제 만들기: 문항 체계·AP 과목을 함께 받는다.
drop function if exists public.create_bank_problem(uuid, text, text, text, text, uuid, text);
create or replace function public.create_bank_problem(
  p_subject_id uuid,
  p_format text,
  p_skill_type text,
  p_topic text,
  p_difficulty text,
  p_actor_id uuid,
  p_skill_code text default null,
  p_exam_system text default null,
  p_ap_subject text default null
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
  if nullif(p_exam_system, '') is not null and p_exam_system not in ('sat_rw', 'sat_math', 'ap') then
    raise exception '알 수 없는 문항 체계입니다: %', p_exam_system;
  end if;
  insert into problems (format, subject_id, status, created_by, skill_type, topic, difficulty, skill_code, exam_system, ap_subject)
  values (p_format::problem_format, p_subject_id, 'draft', p_actor_id, nullif(p_skill_type, ''), nullif(p_topic, ''),
          nullif(p_difficulty, '')::problem_difficulty, nullif(p_skill_code, ''), nullif(p_exam_system, ''), nullif(p_ap_subject, ''))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.create_bank_problem(uuid, text, text, text, text, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.create_bank_problem(uuid, text, text, text, text, uuid, text, text, text) to service_role;

-- 초안 RPC: 질문을 따로 받는다.
drop function if exists public.create_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb, jsonb, boolean, jsonb);
create or replace function public.create_problem_draft_version(
  p_problem_id uuid, p_passage text, p_options jsonb, p_correct_index int, p_explanation text, p_difficulty text, p_actor_id uuid,
  p_answers jsonb default null, p_figure jsonb default null, p_figure_checked boolean default false, p_statements jsonb default null,
  p_question text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_next int; v_id uuid;
begin
  if not exists (select 1 from problems where id = p_problem_id) then raise exception '존재하지 않는 문제입니다.'; end if;
  if exists (select 1 from problem_versions where problem_id = p_problem_id and status in ('draft', 'in_review')) then
    raise exception '이미 작업 중인 버전이 있습니다. 그 버전을 수정하거나 공개·보류한 뒤에 새로 만드세요.';
  end if;
  select coalesce(max(version_no), 0) + 1 into v_next from problem_versions where problem_id = p_problem_id;
  insert into problem_versions (problem_id, version_no, passage, question, options, correct_index, explanation, difficulty, answers, figure, figure_checked, statements, status, created_by)
  values (p_problem_id, v_next, p_passage, nullif(btrim(p_question), ''), p_options, p_correct_index, p_explanation, p_difficulty, p_answers, p_figure, coalesce(p_figure_checked, false), p_statements, 'draft', p_actor_id)
  returning id into v_id;
  return v_id;
end; $$;
revoke execute on function public.create_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb, jsonb, boolean, jsonb, text) from public, anon, authenticated;
grant execute on function public.create_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb, jsonb, boolean, jsonb, text) to service_role;

drop function if exists public.save_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb, jsonb, boolean, jsonb);
create or replace function public.save_problem_draft_version(
  p_problem_id uuid, p_passage text, p_options jsonb, p_correct_index int, p_explanation text, p_difficulty text, p_actor_id uuid,
  p_answers jsonb default null, p_figure jsonb default null, p_figure_checked boolean default false, p_statements jsonb default null,
  p_question text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_existing problem_versions;
begin
  if not exists (select 1 from problems where id = p_problem_id) then raise exception '존재하지 않는 문제입니다.'; end if;
  select * into v_existing from problem_versions where problem_id = p_problem_id and status in ('draft', 'in_review') order by version_no desc limit 1;
  if v_existing.id is not null and v_existing.status = 'in_review' then raise exception '검수 중인 버전은 고칠 수 없습니다. 공개하거나 새 초안을 만드세요.'; end if;
  if v_existing.id is not null then
    update problem_versions
      set passage = p_passage, question = nullif(btrim(p_question), ''), options = p_options, correct_index = p_correct_index, explanation = p_explanation, difficulty = p_difficulty,
          answers = p_answers, figure = p_figure, statements = p_statements,
          figure_checked = case when p_figure is distinct from v_existing.figure then false else coalesce(p_figure_checked, v_existing.figure_checked) end,
          created_by = p_actor_id
      where id = v_existing.id;
    return v_existing.id;
  end if;
  return create_problem_draft_version(p_problem_id, p_passage, p_options, p_correct_index, p_explanation, p_difficulty, p_actor_id, p_answers, p_figure, p_figure_checked, p_statements, p_question);
end; $$;
revoke execute on function public.save_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb, jsonb, boolean, jsonb, text) from public, anon, authenticated;
grant execute on function public.save_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb, jsonb, boolean, jsonb, text) to service_role;

-- 수정 초안이 공개본을 복사할 때 question 도 따라가야 한다(create_draft_from_published 류가 있으면 앱에서 복사한다 — 여기서는 컬럼만).
