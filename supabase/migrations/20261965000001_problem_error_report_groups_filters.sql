-- 신고 내역 필터 (2026-09-30) — 통계 '상위 문제 칸' 행에서 해당 조건으로 신고 내역을 열기 위한 선택 필터.
-- problem_error_report_groups 에 skill/difficulty/domain/기간(일) 필터를 추가한다. 기존 호출(p_status,p_limit,p_offset)은 그대로 동작.
-- 시그니처가 바뀌므로 이전 정의를 지우고 다시 만든다(오버로드가 남으면 PostgREST 이름 호출이 모호해진다).
-- 되돌리기: 20261940000001 의 problem_error_report_groups(text,int,int) 본문으로 새 번호 마이그레이션에서 재적용.
drop function if exists public.problem_error_report_groups(text, int, int);
create or replace function public.problem_error_report_groups(
  p_status text default 'open', p_limit int default 50, p_offset int default 0,
  p_skill text default null, p_difficulty text default null, p_domain text default null, p_days int default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_total int; v_rows jsonb; v_limit int := least(greatest(coalesce(p_limit, 50), 1), 200); v_open boolean := coalesce(p_status, 'open') <> 'all';
begin
  if not is_admin() then raise exception '관리자만 볼 수 있습니다.'; end if;
  select count(*) into v_total from (
    select 1 from problem_error_reports r
    join problems p on p.id = r.problem_id
    join problem_versions v on v.id = r.problem_version_id
    where (not v_open or r.resolved_verdict_id is null)
      and (p_skill is null or coalesce(p.skill_code, 'unknown') = p_skill)
      and (p_domain is null or coalesce(p.sat_domain, 'unknown') = p_domain)
      and (p_difficulty is null or coalesce(v.difficulty::text, 'unknown') = p_difficulty)
      and (p_days is null or r.created_at >= now() - make_interval(days => p_days))
    group by r.problem_id, r.problem_version_id) x;
  select coalesce(jsonb_agg(g.item order by g.last_at desc), '[]'::jsonb) into v_rows from (
    select c.last_at, jsonb_build_object(
      'problemId', c.problem_id, 'versionId', c.problem_version_id,
      'format', p.format, 'satDomain', p.sat_domain, 'skillCode', p.skill_code, 'difficulty', v.difficulty,
      'snippet', left(coalesce(nullif(v.question, ''), v.passage, ''), 140),
      'reportCount', c.n, 'openCount', c.n_open,
      'typeCounts', jsonb_build_object('wrong_key', c.n_key, 'flawed_problem', c.n_flawed, 'bad_explanation', c.n_expl, 'other', c.n_other),
      'sourceCounts', jsonb_build_object('session_assignment', c.n_session, 'mock_exam', c.n_mock),
      'firstAt', c.first_at, 'lastAt', c.last_at,
      'archived', p.archived_at is not null,
      'latestDecision', (select lv.decision from problem_error_verdicts lv where lv.problem_id = c.problem_id and lv.problem_version_id = c.problem_version_id
                          order by lv.decided_at desc, lv.id desc limit 1)
    ) as item
    from (
      select r.problem_id, r.problem_version_id, count(*) n, count(*) filter (where r.resolved_verdict_id is null) n_open,
             count(*) filter (where r.report_type = 'wrong_key') n_key, count(*) filter (where r.report_type = 'flawed_problem') n_flawed,
             count(*) filter (where r.report_type = 'bad_explanation') n_expl, count(*) filter (where r.report_type = 'other') n_other,
             count(*) filter (where r.source = 'session_assignment') n_session, count(*) filter (where r.source = 'mock_exam') n_mock,
             min(r.created_at) first_at, max(r.created_at) last_at
      from problem_error_reports r
      join problems fp on fp.id = r.problem_id
      join problem_versions fv on fv.id = r.problem_version_id
      where (not v_open or r.resolved_verdict_id is null)
        and (p_skill is null or coalesce(fp.skill_code, 'unknown') = p_skill)
        and (p_domain is null or coalesce(fp.sat_domain, 'unknown') = p_domain)
        and (p_difficulty is null or coalesce(fv.difficulty::text, 'unknown') = p_difficulty)
        and (p_days is null or r.created_at >= now() - make_interval(days => p_days))
      group by r.problem_id, r.problem_version_id
      order by max(r.created_at) desc
      limit v_limit offset greatest(coalesce(p_offset, 0), 0)
    ) c
    join problems p on p.id = c.problem_id
    join problem_versions v on v.id = c.problem_version_id
  ) g;
  return jsonb_build_object('total', v_total, 'rows', v_rows);
end $$;
revoke execute on function public.problem_error_report_groups(text, int, int, text, text, text, int) from public, anon;
grant execute on function public.problem_error_report_groups(text, int, int, text, text, text, int) to authenticated;
