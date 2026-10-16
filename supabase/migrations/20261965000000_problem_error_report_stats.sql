-- 오류 신고 통계 집계 (2026-09-30) — 관리자 '오류 신고 > 통계' 화면용 단일 RPC.
-- 설계
--  - problem_error_report_stats(p_days) 1회 호출로 축별 신고 수·신고 문항 수·활성 문항 수·신고율·주별 추이·상위 칸을 jsonb 로 반환(N+1 없음).
--  - 관리자 전용(is_admin()) SECURITY DEFINER. 다른 역할은 예외.
--  - 기간 p_days: null=전체, 그 외 최근 N일(신고 created_at 기준).
--  - 신고율 = 신고 문항 수(고유 problem_id) ÷ 해당 칸의 활성 문항 수. 활성 문항 = 공개 버전이 있고 보관되지 않은 문항.
--    오류 확정으로 보관된 문항도 분자에 들어가므로, 신고된 보관 문항은 분모에 포함해 신고율이 100% 를 넘지 않게 한다.
--  - 생성 배치: 문항에 생성 배치 실행 ID 가 저장돼 있지 않다(problems 에 컬럼 없음). 생성 경로(created_via)×생성 월(Asia/Seoul)로 대체한다.
--  - 난이도: 신고된 문항 버전의 difficulty(분모는 현재 공개 버전의 difficulty).
-- 인덱스: 기존 problem_error_reports_created_idx(created_at)로 기간 필터, 문항 측은 PK 조인. 신고 수천 건·문항 수천 건 규모는 단일 스캔으로 충분해 새 인덱스는 만들지 않는다.
-- 되돌리기: drop function public.problem_error_report_stats(int);

create or replace function public.problem_error_report_stats(p_days int default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_out jsonb;
  v_tz constant text := 'Asia/Seoul';
begin
  if not is_admin() then raise exception '관리자만 볼 수 있습니다.'; end if;
  if p_days is not null and p_days < 1 then raise exception '기간은 1일 이상이어야 합니다.'; end if;

  with rep as (
    select r.id, r.problem_id, r.report_type, r.source, r.created_at, r.resolved_verdict_id,
           p.format::text as fmt, p.sat_domain as dom, p.skill_code as skill, p.created_via,
           to_char(p.created_at at time zone v_tz, 'YYYY-MM') as cohort,
           v.difficulty::text as diff,
           case when r.resolved_verdict_id is null then 'pending'
                when vd.decision = 'not_error' then 'not_error' else 'confirmed' end as verdict
    from problem_error_reports r
    join problems p on p.id = r.problem_id
    join problem_versions v on v.id = r.problem_version_id
    left join problem_error_verdicts vd on vd.id = r.resolved_verdict_id
    where p_days is null or r.created_at >= now() - make_interval(days => p_days)
  ), pool as (
    select p.id, p.format::text as fmt, p.sat_domain as dom, p.skill_code as skill, p.created_via,
           to_char(p.created_at at time zone v_tz, 'YYYY-MM') as cohort, pv.difficulty::text as diff
    from problems p
    left join problem_versions pv on pv.id = p.published_version_id
    where p.published_version_id is not null
      and (p.archived_at is null or p.id in (select problem_id from rep))
  ), rep_axes as (
    select 'reportType' as axis, report_type as k, count(*) as n, count(distinct problem_id) as np from rep group by 2
    union all select 'source', source, count(*), count(distinct problem_id) from rep group by 2
    union all select 'verdict', verdict, count(*), count(distinct problem_id) from rep group by 2
    union all select 'difficulty', coalesce(diff, 'unknown'), count(*), count(distinct problem_id) from rep group by 2
    union all select 'domain', coalesce(dom, 'unknown'), count(*), count(distinct problem_id) from rep group by 2
    union all select 'skill', coalesce(skill, 'unknown'), count(*), count(distinct problem_id) from rep group by 2
    union all select 'format', fmt, count(*), count(distinct problem_id) from rep group by 2
    union all select 'batch', created_via || '|' || cohort, count(*), count(distinct problem_id) from rep group by 2
  ), pool_axes as (
    select 'difficulty' as axis, coalesce(diff, 'unknown') as k, count(*) as active from pool group by 2
    union all select 'domain', coalesce(dom, 'unknown'), count(*) from pool group by 2
    union all select 'skill', coalesce(skill, 'unknown'), count(*) from pool group by 2
    union all select 'format', fmt, count(*) from pool group by 2
    union all select 'batch', created_via || '|' || cohort, count(*) from pool group by 2
  ), axes as (
    select ra.axis, ra.k, ra.n, ra.np, pa.active
    from rep_axes ra left join pool_axes pa on pa.axis = ra.axis and pa.k = ra.k
  ), axes_json as (
    select axis, jsonb_agg(jsonb_build_object('key', k, 'reports', n, 'reportedProblems', np, 'active', active,
             'rate', case when coalesce(active, 0) > 0 then round(np::numeric / active, 4) end) order by n desc, k) as items
    from axes group by axis
  ), cells as (
    select x.skill, x.diff, x.n, x.np, y.active
    from (select coalesce(skill, 'unknown') as skill, coalesce(diff, 'unknown') as diff, count(*) n, count(distinct problem_id) np from rep group by 1, 2) x
    left join (select coalesce(skill, 'unknown') as skill, coalesce(diff, 'unknown') as diff, count(*) active from pool group by 1, 2) y
      on y.skill = x.skill and y.diff = x.diff
    order by x.n desc, x.np desc, x.skill, x.diff
    limit 20
  ), weeks as (
    select w.wk, count(rep.id) as n
    from generate_series(date_trunc('week', now() at time zone v_tz) - interval '11 weeks', date_trunc('week', now() at time zone v_tz), interval '1 week') as w(wk)
    left join rep on date_trunc('week', rep.created_at at time zone v_tz) = w.wk
    group by w.wk
  )
  select jsonb_build_object(
    'days', p_days,
    'totals', jsonb_build_object(
      'reports', (select count(*) from rep),
      'reportedProblems', (select count(distinct problem_id) from rep),
      'openReports', (select count(*) from rep where verdict = 'pending'),
      'activeProblems', (select count(*) from pool),
      'confirmed', (select count(*) from rep where verdict = 'confirmed'),
      'notError', (select count(*) from rep where verdict = 'not_error')),
    'axes', coalesce((select jsonb_object_agg(axis, items) from axes_json), '{}'::jsonb),
    'topCells', coalesce((select jsonb_agg(jsonb_build_object('skill', skill, 'difficulty', diff, 'reports', n, 'reportedProblems', np, 'active', active,
        'rate', case when coalesce(active, 0) > 0 then round(np::numeric / active, 4) end) order by n desc, np desc, skill, diff) from cells), '[]'::jsonb),
    'weekly', coalesce((select jsonb_agg(jsonb_build_object('weekStart', to_char(wk, 'YYYY-MM-DD'), 'reports', n) order by wk) from weeks), '[]'::jsonb)
  ) into v_out;
  return v_out;
end $$;
revoke execute on function public.problem_error_report_stats(int) from public, anon;
grant execute on function public.problem_error_report_stats(int) to authenticated;
