-- 2026-09-14 표준 렌더링 엔진 — 검증 계층과 공개 게이트(docs/2026-09-14-standard-rendering-engine-design.md 3절)
--
--   * problem_versions.render_check: 서버(lib/problem-figures/check.ts)가 초안 저장 때 남기는 검증 결과
--     {ok, renderer, checkedAt, issues[], alt?, figure_hash}. figure_hash 는 저장 시점 figure 의 md5(jsonb::text).
--   * 공개 게이트:
--       - 좌표형 그림(type 'geometry')은 지원 종료 — 공개 불가("재생성 필요"). 기존 공개본은 그대로 둔다(고정 화면 유지).
--       - 그림이 있으면 render_check.ok = true 이고 figure_hash 가 지금 figure 와 같아야 한다(검증 뒤 그림이 바뀌면 다시 검증).
--       - 그림이 있으면 관리자가 렌더된 미리보기에서 확인(figure_checked)해야 한다 — 기존 규칙 유지.
--       - 그림이 없어도 render_check 가 실패(지문이 그림을 요구)면 공개 불가.
--       - 올린 그림(type 'image')은 alt 필수.

alter table problem_versions add column if not exists render_check jsonb;
comment on column problem_versions.render_check is
  '표준 렌더링 검증 결과 {ok, renderer, checkedAt, issues[], alt, figure_hash}. 앱 서버가 초안 저장 때 기록. 공개는 ok 와 해시 일치를 요구.';

create or replace function public.set_problem_render_check(p_version_id uuid, p_check jsonb)
returns void
language plpgsql
security definer set search_path = public as $$
declare
  v_figure jsonb;
begin
  select figure into v_figure from problem_versions where id = p_version_id;
  if not found then
    raise exception '존재하지 않는 문제 버전입니다.';
  end if;
  update problem_versions
    set render_check = coalesce(p_check, '{}'::jsonb) || jsonb_build_object('figure_hash', md5(coalesce(v_figure::text, 'null')))
    where id = p_version_id and status in ('draft', 'in_review');
end;
$$;
revoke execute on function public.set_problem_render_check(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.set_problem_render_check(uuid, jsonb) to service_role;

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
  v_issue text;
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

  -- 표준 렌더링 검증(2026-09-14)
  if v_version.figure is not null and v_version.figure->>'type' = 'geometry' then
    raise exception '좌표형 그림(geometry)은 지원이 끝났습니다 — 재생성 필요. 표준 템플릿으로 다시 만든 뒤 공개하세요.';
  end if;
  if v_version.figure is not null and v_version.figure->>'type' = 'image'
     and coalesce(trim(v_version.figure->>'alt'), '') = '' then
    raise exception '올린 그림에는 대체 설명(alt)이 필요합니다.';
  end if;
  if v_version.render_check is null then
    if v_version.figure is not null then
      raise exception '그림 검증 기록이 없습니다. 초안을 다시 저장해 표준 렌더링 검증을 거치세요.';
    end if;
  else
    if coalesce((v_version.render_check->>'ok')::boolean, false) is not true then
      select string_agg(i->>'message', ' / ') into v_issue from jsonb_array_elements(coalesce(v_version.render_check->'issues', '[]'::jsonb)) i;
      raise exception '표준 렌더링 검증을 통과하지 못해 공개할 수 없습니다: %', coalesce(v_issue, '사유 없음');
    end if;
    if v_version.figure is not null
       and v_version.render_check->>'figure_hash' is distinct from md5(v_version.figure::text) then
      raise exception '검증 뒤 그림이 바뀌었습니다. 초안을 다시 저장해 검증을 거치세요.';
    end if;
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
