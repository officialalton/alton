-- 2026-09-14 문제 템플릿 ③ — 도형·그래프를 데이터(figure spec)로 저장하고 우리가 SVG 로 그린다.
-- 이미지 파일이 아니라 점·선·곡선·라벨 데이터다(lib/problem-figures). AI 가 만든 그림은 관리자가 미리보기에서
-- '그림 확인함'을 켜야 공개할 수 있다.

alter table problem_versions
  add column if not exists figure jsonb,
  add column if not exists figure_checked boolean not null default false;
comment on column problem_versions.figure is
  '도형·그래프 데이터(coordinate_plane | geometry). 렌더는 앱(lib/problem-figures). null 이면 그림 없음.';
comment on column problem_versions.figure_checked is
  '관리자가 렌더된 그림을 눈으로 확인했다. 그림이 있는 버전은 이것이 true 여야 공개된다.';

drop function if exists public.create_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb);
create or replace function public.create_problem_draft_version(
  p_problem_id uuid,
  p_passage text,
  p_options jsonb,
  p_correct_index int,
  p_explanation text,
  p_difficulty text,
  p_actor_id uuid,
  p_answers jsonb default null,
  p_figure jsonb default null,
  p_figure_checked boolean default false
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
    problem_id, version_no, passage, options, correct_index, explanation, difficulty, answers, figure, figure_checked, status, created_by
  ) values (
    p_problem_id, v_next, p_passage, p_options, p_correct_index, p_explanation, p_difficulty, p_answers, p_figure,
    coalesce(p_figure_checked, false), 'draft', p_actor_id
  ) returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.create_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.create_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb, jsonb, boolean) to service_role;

drop function if exists public.save_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb);
create or replace function public.save_problem_draft_version(
  p_problem_id uuid,
  p_passage text,
  p_options jsonb,
  p_correct_index int,
  p_explanation text,
  p_difficulty text,
  p_actor_id uuid,
  p_answers jsonb default null,
  p_figure jsonb default null,
  p_figure_checked boolean default false
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
          figure = p_figure,
          -- 그림 데이터가 바뀌면 확인은 다시 해야 한다.
          figure_checked = case when p_figure is distinct from v_existing.figure then false else coalesce(p_figure_checked, v_existing.figure_checked) end,
          created_by = p_actor_id
      where id = v_existing.id;
    return v_existing.id;
  end if;
  return create_problem_draft_version(
    p_problem_id, p_passage, p_options, p_correct_index, p_explanation, p_difficulty, p_actor_id, p_answers, p_figure, p_figure_checked
  );
end;
$$;
revoke execute on function public.save_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.save_problem_draft_version(uuid, text, jsonb, int, text, text, uuid, jsonb, jsonb, boolean) to service_role;

-- 관리자가 미리보기를 보고 확인했다고 표시한다(초안만).
create or replace function public.mark_problem_figure_checked(p_version_id uuid, p_checked boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update problem_versions set figure_checked = coalesce(p_checked, false)
  where id = p_version_id and status in ('draft', 'in_review');
  if not found then
    raise exception '초안·검수 중 버전만 그림 확인을 바꿀 수 있습니다.';
  end if;
end;
$$;
revoke execute on function public.mark_problem_figure_checked(uuid, boolean) from public, anon, authenticated;
grant execute on function public.mark_problem_figure_checked(uuid, boolean) to service_role;

-- 공개 검사에 그림 확인을 더한다.
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
  if v_version.figure is not null and not v_version.figure_checked then
    raise exception '그림이 있는 문제는 미리보기에서 그림을 확인해야 공개할 수 있습니다.';
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
