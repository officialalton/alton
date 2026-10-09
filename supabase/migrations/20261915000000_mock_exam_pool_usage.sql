-- 모의고사 문항 풀 + 세트 배정 현황(2026-09-29). 기존 problem_pool_by_scope 는 그대로 두고(additive),
-- 영역·기술·용도별 공개 문항 수에 "공개 세트 / 초안 세트에 배정된 서로 다른 문항 수"를 더한 자매 RPC.
--  - 풀: 보관 안 된 공개 문항(problem_pool_by_scope 와 같은 정의).
--  - 배정: mock_exam_set_items 의 서로 다른 problem_id. 보관된 세트는 제외. 같은 문항이 공개·초안 세트에 모두 있으면
--    공개로만 센다(두 열이 겹치지 않아 합 = 세트에 배정된 문항 수). 여러 세트에 있어도 1회.
-- 롤백: drop function public.mock_exam_pool_usage();
create or replace function public.mock_exam_pool_usage()
returns table(sat_domain text, skill_code text, usage_scope text, published bigint, assigned_published bigint, assigned_draft bigint)
language sql stable security definer set search_path = public as $$
  with asg as (
    select i.problem_id, bool_or(s.status = 'published') as in_published
    from mock_exam_set_items i
    join mock_exam_sets s on s.id = i.exam_set_id
    where s.archived_at is null and s.status in ('draft', 'published')
    group by i.problem_id
  ), pool as (
    select p.id, p.sat_domain, p.skill_code, p.usage_scope
    from problems p
    where p.archived_at is null and p.sat_domain is not null and p.status = 'confirmed'
      and exists (select 1 from problem_versions v where v.problem_id = p.id and v.status = 'published')
  )
  select pool.sat_domain, pool.skill_code, pool.usage_scope, count(*),
         count(*) filter (where a.in_published),
         count(*) filter (where a.problem_id is not null and not a.in_published)
  from pool left join asg a on a.problem_id = pool.id
  group by 1, 2, 3
$$;
revoke all on function public.mock_exam_pool_usage() from public, anon, authenticated;
grant execute on function public.mock_exam_pool_usage() to service_role;
