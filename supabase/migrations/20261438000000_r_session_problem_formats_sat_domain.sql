-- 2026-09-21(사용자 지시) — 학생 "문제" 탭에 계산기·참조표가 안 뜨는 문제. 원인:
-- ProblemsPanel의 hasMathProblem이 format(spr/math)만 보고 판단해, SAT Math의
-- 객관식(mc) 문항(예: 부등식 표 문제)은 수학인데도 계산기 버튼이 안 떴다. format이
-- 아니라 sat_domain(수학 4개 도메인 vs rw_ 4개 도메인)으로 판단해야 하므로
-- session_problem_formats가 sat_domain도 같이 돌려주게 확장한다.

drop function if exists public.session_problem_formats(uuid);

create function public.session_problem_formats(p_session_id uuid)
returns table (problem_id uuid, format text, sat_domain text)
language sql stable security definer set search_path = public as $$
  select distinct p.id, p.format::text, p.sat_domain::text
  from problems p
  where (public.is_session_related_v3(p_session_id) or is_admin())
    and (
      p.id in (select cm.content_id from session_content_manifest cm where cm.session_id = p_session_id and cm.content_type = 'problem')
      or p.id in (select h.problem_id from session_homework_items h where h.session_id = p_session_id)
    );
$$;
