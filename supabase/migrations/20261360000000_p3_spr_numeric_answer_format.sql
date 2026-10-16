-- 2026-09-14 제품 오너 승인 — 문제 템플릿 ① SPR(Student-Produced Response, 숫자 직접 입력).
-- docs/2026-09-14-problem-template-design.md. SAT Math의 약 25%. 서술형(essay, AP용)과 별도 유형이다.
--   · problem_format 에 'spr' 추가
--   · problem_versions.answers jsonb — 동치 정답 목록(예: ["7/2","3.5"])
--   · 답 정규화 비교(spr_answer_matches): 공백·쉼표·$·% 제거, 분수 a/b, 소수 4자리 반올림/절사 허용
--   · submit_problem_attempt 가 텍스트 답을 자동 채점(정답 목록이 있을 때), 채점 전 재입력 허용
--   · 공개 시 spr 은 정답이 하나 이상 있어야 한다

alter type problem_format add value if not exists 'spr';

alter table problem_versions add column if not exists answers jsonb;
comment on column problem_versions.answers is
  'spr(숫자 입력) 문제의 동치 정답 목록(문자열 배열). 서버가 정규화해 비교한다. 다른 형식은 null.';

-- 텍스트 답을 숫자로: "1,440" → 1440, "$3.5" → 3.5, "7/2" → 3.5, " -0.75 " → -0.75. 숫자가 아니면 null.
create or replace function public.spr_to_numeric(p_text text)
returns numeric
language plpgsql immutable as $$
declare
  v text;
  v_num text;
  v_den text;
begin
  if p_text is null then return null; end if;
  v := regexp_replace(lower(p_text), '[\s,$%]', '', 'g');
  if v = '' then return null; end if;
  if v ~ '^-?\d+/\d+$' then
    v_num := split_part(v, '/', 1);
    v_den := split_part(v, '/', 2);
    if v_den::numeric = 0 then return null; end if;
    return v_num::numeric / v_den::numeric;
  end if;
  if v ~ '^-?(\d+\.?\d*|\.\d+)$' then
    return v::numeric;
  end if;
  return null;
exception when others then
  return null;
end;
$$;

-- SAT 규칙: 정답과 같거나, 소수 4자리에서 반올림·절사한 값이 같으면 정답.
create or replace function public.spr_answer_matches(p_answer text, p_accepted jsonb)
returns boolean
language plpgsql immutable as $$
declare
  v_x numeric := public.spr_to_numeric(p_answer);
  v_a text;
  v_an numeric;
begin
  if p_accepted is null or jsonb_typeof(p_accepted) <> 'array' then return false; end if;
  for v_a in select value #>> '{}' from jsonb_array_elements(p_accepted) loop
    v_an := public.spr_to_numeric(v_a);
    if v_x is not null and v_an is not null then
      if v_x = v_an
         or round(v_x, 4) = round(v_an, 4)
         or trunc(v_x, 4) = trunc(v_an, 4)
         or round(v_x, 4) = trunc(v_an, 4)
         or trunc(v_x, 4) = round(v_an, 4) then
        return true;
      end if;
    elsif regexp_replace(lower(coalesce(p_answer, '')), '\s', '', 'g') = regexp_replace(lower(coalesce(v_a, '')), '\s', '', 'g')
          and coalesce(v_a, '') <> '' then
      return true;
    end if;
  end loop;
  return false;
end;
$$;

-- 초안 생성·저장에 정답 목록을 받는다. 7인수 버전은 지운다(기본값 있는 8인수와 겹치면 not unique).
drop function if exists public.create_problem_draft_version(uuid, text, jsonb, int, text, text, uuid);
create or replace function public.create_problem_draft_version(
  p_problem_id uuid,
  p_passage text,
  p_options jsonb,
  p_correct_index int,
  p_explanation text,
  p_difficulty text,
  p_actor_id uuid,
  p_answers jsonb default null
)
returns uuid
language plpgsql
security definer set search_path = public as $$
declare
  v_next int;
  v_id uuid;
begin
  if not exists (select 1 from problems where id = p_problem_id) then
    raise exception '존재하지 않는 문제입니다.';
  end if;
  if exists (select 1 from problem_versions where problem_id = p_problem_id and status in ('draft', 'in_review')) then
    raise exception '이미 작업 중인 버전이 있습니다. 그 버전을 수정하거나 공개·보류한 뒤에 새로 만드세요.';
  end if;
  select coalesce(max(version_no), 0) + 1 into v_next from problem_versions where problem_id = p_problem_id;
  insert into problem_versions (
    problem_id, version_no, passage, options, correct_index, explanation, difficulty, answers, status, created_by
  ) values (
    p_problem_id, v_next, p_passage, p_options, p_correct_index, p_explanation, p_difficulty, p_answers, 'draft', p_actor_id
  ) returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.create_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb) to service_role;

drop function if exists public.save_problem_draft_version(uuid, text, jsonb, int, text, text, uuid);
create or replace function public.save_problem_draft_version(
  p_problem_id uuid,
  p_passage text,
  p_options jsonb,
  p_correct_index int,
  p_explanation text,
  p_difficulty text,
  p_actor_id uuid,
  p_answers jsonb default null
)
returns uuid
language plpgsql
security definer set search_path = public as $$
declare
  v_existing problem_versions;
begin
  if not exists (select 1 from problems where id = p_problem_id) then
    raise exception '존재하지 않는 문제입니다.';
  end if;
  select * into v_existing
  from problem_versions
  where problem_id = p_problem_id and status in ('draft', 'in_review')
  order by version_no desc
  limit 1;
  if v_existing.id is not null and v_existing.status = 'in_review' then
    raise exception '검수 중인 버전은 고칠 수 없습니다. 공개하거나 새 초안을 만드세요.';
  end if;
  if v_existing.id is not null then
    update problem_versions
      set passage = p_passage,
          options = p_options,
          correct_index = p_correct_index,
          explanation = p_explanation,
          difficulty = p_difficulty,
          answers = p_answers,
          created_by = p_actor_id
      where id = v_existing.id;
    return v_existing.id;
  end if;
  return create_problem_draft_version(
    p_problem_id, p_passage, p_options, p_correct_index, p_explanation, p_difficulty, p_actor_id, p_answers
  );
end;
$$;
revoke execute on function public.save_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb) to service_role;

-- 공개 전 검사: spr 은 정답이 하나 이상, mc 는 선택지·정답 인덱스.
create or replace function public.confirm_and_publish_problem_version(
  p_version_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
security definer set search_path = public as $$
declare
  v_problem_id uuid;
  v_status text;
  v_format text;
  v_version problem_versions%rowtype;
begin
  select problem_id, status into v_problem_id, v_status
  from problem_versions where id = p_version_id;
  if v_problem_id is null then
    raise exception '존재하지 않는 문제 버전입니다.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_problem_id::text, 91));
  select * into v_version from problem_versions where id = p_version_id for update;
  v_status := v_version.status;
  if v_status = 'published' then
    return;
  end if;
  if v_status = 'archived' then
    raise exception '지난 공개본은 다시 공개할 수 없습니다. 수정 초안을 만들어 공개하세요.';
  end if;

  select p.format::text into v_format from problems p where p.id = v_problem_id;
  if v_format = 'spr' and (v_version.answers is null or jsonb_typeof(v_version.answers) <> 'array' or jsonb_array_length(v_version.answers) = 0) then
    raise exception '숫자 입력(SPR) 문제는 정답을 하나 이상 적어야 공개할 수 있습니다.';
  end if;
  if v_format = 'mc' and (v_version.options is null or jsonb_array_length(v_version.options) < 2 or v_version.correct_index is null) then
    raise exception '객관식은 선택지와 정답을 정해야 공개할 수 있습니다.';
  end if;

  if v_status = 'draft' then
    update problem_versions
      set status = 'in_review', submitted_at = now(), submitted_by = p_actor_id
      where id = p_version_id;
  end if;
  perform public.publish_problem_version(p_version_id, p_actor_id);
  update problem_versions
    set review_kind = case
          when submitted_by is null or submitted_by = p_actor_id then 'self_confirmed'
          else 'separate_reviewer'
        end
    where id = p_version_id;
end;
$$;

-- 고정 트리거: 채점 전이면 객관식 선택지와 텍스트 답(spr)을 바꿀 수 있다. 필기 경계·제출 시각은 고정.
create or replace function public.freeze_problem_attempt_on_submit()
returns trigger language plpgsql as $$
begin
  if old.submitted_at is not null then
    if new.submitted_at is distinct from old.submitted_at
       or new.submitted_stroke_seq is distinct from old.submitted_stroke_seq then
      raise exception '이미 제출한 풀이입니다 — 제출 시점 필기는 바꿀 수 없습니다. 다시 풀려면 새 풀이를 시작하세요.';
    end if;
    if (new.submitted_choice_index is distinct from old.submitted_choice_index
        or new.submitted_text is distinct from old.submitted_text)
       and old.graded_at is not null then
      raise exception '채점이 끝난 문제의 답은 바꿀 수 없습니다.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.submit_problem_attempt(
  p_work_id uuid,
  p_actor_id uuid,
  p_choice_index int default null,
  p_text text default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_work session_problem_work%rowtype;
  v_seq bigint;
  v_correct int;
  v_answers jsonb;
  v_auto boolean;
  v_version uuid;
begin
  select * into v_work from session_problem_work where id = p_work_id for update;
  if not found then
    raise exception '풀이판을 찾을 수 없습니다.';
  end if;
  if v_work.student_id <> p_actor_id then
    raise exception '본인 풀이만 제출할 수 있습니다.';
  end if;

  v_version := coalesce(v_work.problem_version_id, (select p.published_version_id from problems p where p.id = v_work.problem_id));
  select v.correct_index, v.answers into v_correct, v_answers from problem_versions v where v.id = v_version;

  if p_choice_index is not null then
    v_auto := case when v_correct is null then null else (v_correct = p_choice_index) end;
  elsif p_text is not null and v_answers is not null and jsonb_typeof(v_answers) = 'array' and jsonb_array_length(v_answers) > 0 then
    v_auto := public.spr_answer_matches(p_text, v_answers);
  end if;

  if v_work.submitted_at is not null then
    if v_work.graded_at is not null then
      if (p_choice_index is not null and p_choice_index is distinct from v_work.submitted_choice_index)
         or (p_text is not null and p_text is distinct from v_work.submitted_text) then
        raise exception '채점이 끝난 문제의 답은 바꿀 수 없습니다.';
      end if;
      return;
    end if;
    if p_choice_index is not null and p_choice_index is distinct from v_work.submitted_choice_index then
      update session_problem_work set submitted_choice_index = p_choice_index, auto_correct = v_auto where id = p_work_id;
    elsif p_text is not null and p_text is distinct from v_work.submitted_text then
      update session_problem_work set submitted_text = p_text, auto_correct = v_auto where id = p_work_id;
    end if;
    return;
  end if;

  select max(seq) into v_seq
  from session_annotation_events
  where problem_work_id = p_work_id and scope = 'problem_student';

  update session_problem_work
  set submitted_at = now(),
      submitted_choice_index = p_choice_index,
      submitted_text = p_text,
      submitted_stroke_seq = v_seq,
      auto_correct = v_auto
  where id = p_work_id;
end;
$$;
