-- 2026-09-28 — issue_homework_by_keywords 권한 검사를 함수 맨 앞으로.
--
-- 기존(20261364000000)에는 권한 검사가 끝에서 호출하는 issue_homework_items
-- 안에만 있었다. 그래서 뽑힌 후보가 0개면 권한 검사 전에 0을 반환했고,
-- 담당이 아닌 사용자도 오류 없이 결과를 받거나 회차·키워드 존재 여부를
-- 오류 문구로 알 수 있었다. issue_homework_items와 같은 검사를 앞에 둔다
-- (쓰기 경로의 검사는 그대로 남는다).

CREATE OR REPLACE FUNCTION public.issue_homework_by_keywords(p_session_id uuid, p_requests jsonb, p_exclude_used boolean DEFAULT true)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_unit uuid;
  v_req jsonb;
  v_keyword uuid;
  v_count int;
  v_ids uuid[] := array[]::uuid[];
  v_picked uuid[];
  v_enrollment uuid;
begin
  if auth.uid() is null then
    raise exception '인증되지 않은 사용자입니다.';
  end if;
  select subject_enrollment_id into v_enrollment from sessions where id = p_session_id;
  if v_enrollment is null then
    raise exception '수업을 찾을 수 없습니다.';
  end if;
  if not (public.is_admin() or public.is_active_teacher_for_enrollment(v_enrollment)) then
    raise exception '담당 학생의 수업에만 과제를 발급할 수 있습니다.';
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
$function$;
