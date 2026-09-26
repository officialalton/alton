-- P2 12차 정정 — 관리자 기준본 층의 '기본 구성 업데이트'가 실패했다.
--
-- 2026-09-14 Preview 재현: 기준본 회차에서 미리보기가 "변경 내용을 확인하지 못했습니다".
-- 원인: update_unit_composition 이 상위가 없는 catalog 층에서 v_inherit 레코드를 채우지 않은 채
-- 읽었다("record is not assigned yet"). 그래서 키워드의 기본 교재(PDF)가 업데이트로 들어오지
-- 못했다. 숫자 변수로 바꿔 상위가 없으면 0 으로 둔다. 규칙은 그대로다.

create or replace function public.update_unit_composition(p_layer text, p_unit_id uuid)
returns jsonb
language plpgsql
as $$
declare
  v_withdrawn jsonb;
  v_kw int := 0;
  v_mat int := 0;
  v_prob int := 0;
  v_order jsonb;
  v_goal jsonb;
  v_recompose jsonb;
begin
  v_withdrawn := public.withdraw_parent_removals(p_layer, p_unit_id);

  if p_layer = 'teacher' then
    select keywords_added, materials_added, problems_added into v_kw, v_mat, v_prob
    from public.inherit_teacher_unit_defaults_from_template(p_unit_id);
  elsif p_layer = 'student' then
    select keywords_added, materials_added, problems_added into v_kw, v_mat, v_prob
    from public.inherit_unit_defaults_from_template(p_unit_id);
  end if;

  v_order := public.realign_inherited_order(p_layer, p_unit_id);
  v_goal := public.adopt_parent_goal(p_layer, p_unit_id);
  v_recompose := public.recompose_unit(p_layer, p_unit_id);

  return v_recompose || v_withdrawn || v_order || v_goal || jsonb_build_object(
    'inheritedKeywords', coalesce(v_kw, 0),
    'inheritedMaterials', coalesce(v_mat, 0),
    'inheritedProblems', coalesce(v_prob, 0)
  );
end;
$$;
