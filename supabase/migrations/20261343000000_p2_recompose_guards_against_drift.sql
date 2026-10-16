-- P2 10차 — 미리 본 것과 다른 결과를 조용히 적용하지 않는다.
--
-- 2026-09-13 제품 오너: "미리보기와 적용 사이에 원본이나 준비안이 변경되면, 다른
-- 결과를 조용히 적용하지 말고 변경분을 다시 확인하도록 합니다. 취소하면 기존 구성은
-- 유지합니다."
--
-- 미리보기는 그 순간의 입력으로 계산한다. 그 사이에 관리자가 교재를 공개하거나 다른
-- 선생님이 키워드를 고치면, 적용은 **다른 결과**를 낸다. 지금은 그것이 조용히
-- 들어간다 — 화면에 "2개 들어옴"이라고 적혀 있는데 5개가 들어가는 식이다.
--
-- 미리보기가 그 시점 입력의 지문을 함께 돌려주고, 적용이 그 지문을 들고 온다.
-- 다르면 적용하지 않고 거절한다. 사람은 다시 확인하고 누르면 된다.
--
-- 부수 효과에 대해: 미리보기는 recompose_unit 을 실행한 뒤 예외로 블록을 되돌린다.
-- 이 경로가 건드리는 표에는 알림·외부 호출 트리거가 없고(전부 값 채우기·소속 확인),
-- 이 데이터베이스에는 pg_net·http 확장이 설치돼 있지도 않다. 되돌아가지 않는 것은
-- 시퀀스 채번뿐인데 여기서 쓰는 키는 전부 gen_random_uuid() 라 해당이 없다.

create or replace function public.unit_composition_fingerprint(p_layer text, p_unit_id uuid)
returns text
language plpgsql
stable
as $$
declare
  v text;
begin
  if p_layer = 'catalog' then
    select coalesce(string_agg(x, '|' order by x), '') into v from (
      select 'k:' || keyword_id::text as x from subject_template_unit_keywords where unit_id = p_unit_id
      union all
      select 'm:' || curriculum_doc_id::text || ':' || position::text || ':' || source
             || ':' || coalesce(curriculum_doc_version_id::text, '-')
      from subject_template_unit_materials where unit_id = p_unit_id
      union all
      select 'p:' || problem_id::text || ':' || position::text || ':' || source
             || ':' || coalesce(problem_version_id::text, '-')
      from subject_template_unit_problems where unit_id = p_unit_id
      union all
      select 'c:' || coalesce(array_to_string(formats, ','), '-') || ':'
             || coalesce(array_to_string(difficulties, ','), '-') || ':'
             || coalesce(target_count::text, '-')
      from subject_template_unit_problem_criteria where unit_id = p_unit_id
      union all
      select 'x:' || curriculum_doc_id::text from subject_template_unit_material_exclusions where unit_id = p_unit_id
      union all
      select 'y:' || problem_id::text from subject_template_unit_problem_exclusions where unit_id = p_unit_id
    ) s;

  elsif p_layer = 'teacher' then
    select coalesce(string_agg(x, '|' order by x), '') into v from (
      select 'k:' || keyword_id::text as x from teacher_curriculum_template_unit_keywords where unit_id = p_unit_id
      union all
      select 'm:' || curriculum_doc_id::text || ':' || position::text || ':' || source
             || ':' || coalesce(curriculum_doc_version_id::text, '-')
      from teacher_curriculum_template_unit_materials where unit_id = p_unit_id
      union all
      select 'p:' || problem_id::text || ':' || position::text || ':' || source
             || ':' || coalesce(problem_version_id::text, '-')
      from teacher_curriculum_template_unit_problems where unit_id = p_unit_id
      union all
      select 'c:' || coalesce(array_to_string(formats, ','), '-') || ':'
             || coalesce(array_to_string(difficulties, ','), '-') || ':'
             || coalesce(target_count::text, '-')
      from teacher_curriculum_template_unit_problem_criteria where unit_id = p_unit_id
      union all
      select 'x:' || curriculum_doc_id::text from teacher_curriculum_template_unit_material_exclusions where unit_id = p_unit_id
      union all
      select 'y:' || problem_id::text from teacher_curriculum_template_unit_problem_exclusions where unit_id = p_unit_id
    ) s;

  else
    select coalesce(string_agg(x, '|' order by x), '') into v from (
      select 'k:' || keyword_id::text as x from curriculum_overlay_unit_keywords where overlay_unit_id = p_unit_id
      union all
      select 'm:' || curriculum_doc_id::text || ':' || position::text || ':' || source
             || ':' || coalesce(curriculum_doc_version_id::text, '-')
      from curriculum_overlay_unit_materials where overlay_unit_id = p_unit_id
      union all
      select 'p:' || i.content_id::text || ':' || i.position::text || ':'
             || coalesce(i.problem_version_id::text, '-')
      from curriculum_unit_prep_items i
      join curriculum_unit_preps pp on pp.id = i.prep_id
      where pp.overlay_unit_id = p_unit_id and i.content_type = 'problem'
      union all
      select 'x:' || curriculum_doc_id::text from curriculum_overlay_unit_material_exclusions where overlay_unit_id = p_unit_id
    ) s;
  end if;

  -- 후보가 되는 **바깥 쪽 사실**도 함께 넣는다. 구성 자체는 그대로여도 교재가 새로
  -- 공개되거나 문제가 새 버전으로 공개되면 '다시 구성'의 결과가 달라지기 때문이다.
  return md5(
    coalesce(v, '')
    || '#docs:' || coalesce((
      select string_agg(d.id::text || ':' || d.status::text
                        || ':' || coalesce(d.primary_keyword_id::text, '-')
                        || ':' || coalesce(public.current_curriculum_doc_version_id(d.id)::text, '-'),
                        ',' order by d.id)
      from curriculum_docs d
      where d.primary_keyword_id in (
        select keyword_id from subject_template_unit_keywords where unit_id = p_unit_id
        union select keyword_id from teacher_curriculum_template_unit_keywords where unit_id = p_unit_id
        union select keyword_id from curriculum_overlay_unit_keywords where overlay_unit_id = p_unit_id
      )
    ), '')
    || '#problems:' || coalesce((
      select string_agg(pr.id::text || ':' || pr.status::text
                        || ':' || coalesce(pr.published_version_id::text, '-')
                        || ':' || coalesce(pr.archived_at::text, '-'),
                        ',' order by pr.id)
      from problems pr
      where pr.id in (
        -- 지금 담겨 있는 문제
        select problem_id from subject_template_unit_problems where unit_id = p_unit_id
        union select problem_id from teacher_curriculum_template_unit_problems where unit_id = p_unit_id
        union select i.content_id from curriculum_unit_prep_items i
              join curriculum_unit_preps pp on pp.id = i.prep_id
              where pp.overlay_unit_id = p_unit_id and i.content_type = 'problem'
        -- 이 회차의 키워드로 들어올 수 있는 문제
        union select k.problem_id from problem_keywords k
              where k.keyword_id in (
                select keyword_id from subject_template_unit_keywords where unit_id = p_unit_id
                union select keyword_id from teacher_curriculum_template_unit_keywords where unit_id = p_unit_id
                union select keyword_id from curriculum_overlay_unit_keywords where overlay_unit_id = p_unit_id
              )
      )
    ), '')
  );
end;
$$;

comment on function public.unit_composition_fingerprint(text, uuid) is
  'P2 10차: 이 회차의 구성과 그 구성을 결정하는 입력의 지문. 미리보기가 돌려주고 적용이 '
  '들고 와서, 그 사이에 무언가 바뀌었으면 적용을 거절하는 데 쓴다.';

-- 적용 — 기대한 지문과 다르면 아무것도 하지 않는다.
create or replace function public.recompose_unit(
  p_layer text,
  p_unit_id uuid,
  p_expected_fingerprint text
)
returns jsonb
language plpgsql
as $$
declare
  v_now text;
begin
  if p_expected_fingerprint is not null then
    v_now := public.unit_composition_fingerprint(p_layer, p_unit_id);
    if v_now is distinct from p_expected_fingerprint then
      raise exception '미리 본 뒤에 구성이나 교재·문제가 바뀌었습니다. 변경분을 다시 확인해주세요.'
        using errcode = 'ALT02';
    end if;
  end if;

  return public.recompose_unit(p_layer, p_unit_id);
end;
$$;

comment on function public.recompose_unit(text, uuid, text) is
  'P2 10차: 미리 본 시점의 지문을 들고 오는 적용 경로. 그 사이에 바뀌었으면 아무것도 '
  '하지 않고 거절한다 — 화면에 적힌 것과 다른 결과가 조용히 들어가지 않는다.';

grant execute on function public.unit_composition_fingerprint(text, uuid) to authenticated, service_role;
grant execute on function public.recompose_unit(text, uuid, text) to authenticated, service_role;

-- 미리보기도 지문을 함께 돌려준다.
create or replace function public.preview_unit_recomposition(p_layer text, p_unit_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_result jsonb;
  v_fingerprint text;
begin
  v_fingerprint := public.unit_composition_fingerprint(p_layer, p_unit_id);

  begin
    v_result := public.recompose_unit(p_layer, p_unit_id);
    raise exception 'PREVIEW_ROLLBACK' using errcode = 'ALT01';
  exception
    when sqlstate 'ALT01' then
      null;
  end;

  return coalesce(v_result, '{}'::jsonb)
         || jsonb_build_object('preview', true, 'fingerprint', v_fingerprint);
end;
$$;
