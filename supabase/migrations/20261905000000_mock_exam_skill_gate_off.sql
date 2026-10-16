-- skill 균형 하드 게이트 OFF (제품 오너 2026-09-29). skill 쏠림은 readiness_report.skillWarnings로만 알리고
-- ready=false·출시/배정 차단 사유로 쓰지 않는다. 다시 켜려면 세트 assembly_rules에 skillHardGate=true(상한은 skillMaxSharePct).
-- 그 밖의 게이트(모듈 정원·중복·유사문항·스냅샷·M1 배정 가능)는 20261901000002와 동일. additive: 함수 재정의만.
create or replace function public.mock_exam_validate_mst_set(p_exam_set_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_s mock_exam_sets%rowtype; v_counts jsonb; v_key text; v_needed int; v_found int;
  v_modules jsonb := '[]'::jsonb; v_ready boolean := true; v_route mock_exam_route; v_routes mock_exam_route[];
  v_dup int; v_rules jsonb; v_share numeric; v_skill jsonb := '[]'::jsonb; v_elig jsonb := '[]'::jsonb;
  v_sim jsonb := '[]'::jsonb; v_nosnap int; v_hard boolean;
begin
  select * into v_s from mock_exam_sets where id = p_exam_set_id;
  if v_s.id is null then raise exception '세트를 찾을 수 없습니다.'; end if;
  if v_s.format <> 'mst' then return jsonb_build_object('ready', true, 'modules', '[]'::jsonb, 'applicable', false); end if;
  v_counts := coalesce(v_s.module_item_counts, '{"rw_m1":27,"rw_m2":27,"math_m1":22,"math_m2":22}'::jsonb);
  v_rules := coalesce(v_s.assembly_rules, '{}'::jsonb);

  foreach v_key in array array['rw_m1', 'rw_m2', 'math_m1', 'math_m2'] loop
    v_needed := (v_counts->>v_key)::int;
    select coalesce(array_agg(distinct route), array[null::mock_exam_route]) into v_routes
    from mock_exam_set_items where exam_set_id = p_exam_set_id and module_key = v_key::mock_exam_module_key;
    if v_routes is null or array_length(v_routes, 1) is null then v_routes := array[null::mock_exam_route]; end if;
    foreach v_route in array v_routes loop
      select count(*) into v_found from mock_exam_set_items
      where exam_set_id = p_exam_set_id and module_key = v_key::mock_exam_module_key and route is not distinct from v_route;
      if v_found <> v_needed then v_ready := false; end if;
      v_modules := v_modules || jsonb_build_object(
        'moduleKey', v_key, 'route', v_route, 'needed', v_needed, 'found', v_found, 'ok', v_found = v_needed
      );
    end loop;
  end loop;

  select count(*) - count(distinct problem_id) into v_dup from mock_exam_set_items where exam_set_id = p_exam_set_id;
  if v_dup > 0 then v_ready := false; end if;
  if exists (select 1 from mock_exam_set_items where exam_set_id = p_exam_set_id and module_key is null) then v_ready := false; end if;

  select count(*) into v_nosnap from mock_exam_set_items where exam_set_id = p_exam_set_id and content_snapshot is null;
  if v_nosnap > 0 then v_ready := false; end if;

  -- skill 균형: 기본은 경고(ready에 영향 없음, 제품 오너 2026-09-29). assembly_rules.skillHardGate=true일 때만 다시 출시 차단.
  -- 상한 비율은 skillMaxSharePct(없으면 50). 문항 3개 미만인 영역은 제외.
  if v_rules ? 'skillMaxSharePct' or coalesce((v_rules->>'skillHardGate')::boolean, false) then
    v_hard := coalesce((v_rules->>'skillHardGate')::boolean, false);
    v_share := coalesce((v_rules->>'skillMaxSharePct')::numeric, 50);
    select coalesce(jsonb_agg(jsonb_build_object(
      'moduleKey', g.module_key, 'route', g.route, 'satDomain', g.sat_domain, 'skillCode', g.skill_code,
      'count', g.cnt, 'cap', ceil(g.domain_n * v_share / 100)::int) order by g.module_key, g.sat_domain, g.skill_code), '[]'::jsonb)
    into v_skill
    from (
      select i.module_key, i.route, i.sat_domain, i.skill_code, count(*) cnt,
             sum(count(*)) over (partition by i.module_key, i.route, i.sat_domain) domain_n
      from mock_exam_set_items i
      where i.exam_set_id = p_exam_set_id and i.skill_code is not null
      group by i.module_key, i.route, i.sat_domain, i.skill_code
    ) g
    where g.domain_n >= 3 and g.cnt > ceil(g.domain_n * v_share / 100);
    if v_hard and jsonb_array_length(v_skill) > 0 then v_ready := false; end if;
  end if;

  -- M1 배정 가능: Module 1 문항은 m1_eligible이어야 한다.
  if coalesce((v_rules->>'enforceM1Eligibility')::boolean, false) then
    select coalesce(jsonb_agg(jsonb_build_object('moduleKey', i.module_key, 'setItemId', i.id, 'difficulty', i.difficulty)), '[]'::jsonb)
    into v_elig
    from mock_exam_set_items i
    where i.exam_set_id = p_exam_set_id and i.module_key in ('rw_m1', 'math_m1') and not i.m1_eligible;
    if jsonb_array_length(v_elig) > 0 then v_ready := false; end if;
  end if;

  -- 유사문항 그룹: 같은 그룹 문항이 한 세트에 둘 이상 들어가면 안 된다.
  if coalesce((v_rules->>'noSimilarGroupRepeat')::boolean, false) then
    select coalesce(jsonb_agg(jsonb_build_object('similarityGroup', g.similarity_group, 'count', g.cnt)), '[]'::jsonb)
    into v_sim
    from (
      select p.similarity_group, count(*) cnt
      from mock_exam_set_items i join problems p on p.id = i.problem_id
      where i.exam_set_id = p_exam_set_id and p.similarity_group is not null
      group by p.similarity_group having count(*) > 1
    ) g;
    if jsonb_array_length(v_sim) > 0 then v_ready := false; end if;
  end if;

  return jsonb_build_object(
    'ready', v_ready, 'applicable', true, 'duplicateCount', v_dup, 'modules', v_modules,
    'missingSnapshotCount', v_nosnap, 'skillViolations', case when v_hard then v_skill else '[]'::jsonb end,
    'skillWarnings', case when v_hard then '[]'::jsonb else v_skill end, 'eligibilityViolations', v_elig,
    'similarityViolations', v_sim
  );
end $$;
revoke execute on function public.mock_exam_validate_mst_set(uuid) from public, anon;
grant execute on function public.mock_exam_validate_mst_set(uuid) to authenticated, service_role;
