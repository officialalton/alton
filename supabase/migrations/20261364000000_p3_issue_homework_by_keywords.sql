-- 2026-09-14 UAT(제품 오너): "과제 생성할 때, 선생님이 개별 문제를 클릭해서 하는 게 아니고, 키워드별로(해당 수업에
-- 링크되어 있는 키워드) 담을 수 있는 총 문제수(문제 은행에 등록된) 뜨고, 각각 몇 개 입력할지 써서 랜덤으로
-- 긁어오는 식으로 해야될 거 같다."
--
-- 키워드별 개수 요청 → 그 키워드의 후보(problem_auto_composition_candidates: 확정·미보관·공개 버전 있음)에서
-- 무작위로 뽑아 issue_homework_items 로 발급한다. 검증(담당·확정·범위·중복·버전 고정)은 그 함수가 그대로 한다.
--   * 이미 이 수업에 발급된 문제는 뽑지 않는다.
--   * p_exclude_used = true(기본)면 수업 고정본에 있는(수업에서 다룬) 문제도 뽑지 않는다.
--   * 후보가 요청 수보다 적으면 있는 만큼만 — 없는 것을 만들어 채우지 않는다.
--   * 요청 키워드가 이 수업 회차의 키워드가 아니면 거절한다.

create or replace function public.issue_homework_by_keywords(
  p_session_id uuid,
  p_requests jsonb,
  p_exclude_used boolean default true
)
returns int
language plpgsql
security definer set search_path = public as $$
declare
  v_unit uuid;
  v_req jsonb;
  v_keyword uuid;
  v_count int;
  v_ids uuid[] := array[]::uuid[];
  v_picked uuid[];
begin
  if auth.uid() is null then
    raise exception '인증되지 않은 사용자입니다.';
  end if;
  if p_requests is null or jsonb_typeof(p_requests) <> 'array' then
    raise exception '키워드별 개수 목록이 필요합니다.';
  end if;
  select overlay_unit_id into v_unit
  from session_curriculum_units where session_id = p_session_id and role = 'primary' limit 1;
  if v_unit is null then
    raise exception '이 수업에 연결된 회차가 없어 과제 풀을 정할 수 없습니다.';
  end if;

  for v_req in select * from jsonb_array_elements(p_requests) loop
    v_keyword := (v_req->>'keyword_id')::uuid;
    v_count := coalesce((v_req->>'count')::int, 0);
    if v_count <= 0 then
      continue;
    end if;
    if not exists (
      select 1 from curriculum_overlay_unit_keywords k where k.overlay_unit_id = v_unit and k.keyword_id = v_keyword
    ) then
      raise exception '이 회차의 키워드가 아닙니다.';
    end if;

    select coalesce(array_agg(problem_id), array[]::uuid[]) into v_picked
    from (
      select c.problem_id
      from problem_auto_composition_candidates c
      where c.keyword_id = v_keyword
        and c.problem_id <> all (v_ids)
        and not exists (
          select 1 from session_homework_items h where h.session_id = p_session_id and h.problem_id = c.problem_id
        )
        and (
          not p_exclude_used
          or not exists (
            select 1 from session_content_manifest m
            where m.session_id = p_session_id and m.content_type = 'problem' and m.content_id = c.problem_id
          )
        )
      group by c.problem_id
      order by random()
      limit v_count
    ) s;
    v_ids := v_ids || v_picked;
  end loop;

  if cardinality(v_ids) = 0 then
    return 0;
  end if;
  return public.issue_homework_items(p_session_id, v_ids);
end;
$$;
revoke all on function public.issue_homework_by_keywords(uuid, jsonb, boolean) from public, anon;
grant execute on function public.issue_homework_by_keywords(uuid, jsonb, boolean) to authenticated;
comment on function public.issue_homework_by_keywords(uuid, jsonb, boolean) is
  '키워드별 개수를 받아 회차 키워드 풀에서 무작위로 골라 과제로 발급한다(2026-09-14). 검증은 issue_homework_items.';
