-- 문제은행 목록·질문 집계를 정확한 SQL 집계로(2026-10-08). PostgREST max_rows(1000)에 걸려 건수가 1000 으로 잘리던 문제 해결.
--  1) problem_question_audit(subject): 질문 있음 / 질문 없는 초안 / 질문 없는 공개본(보관 제외) — 행을 가져오지 않고 DB 에서 센다.
--  2) problem_bank_list_page(filter, bucket, offset, limit): 필터·버킷(공개/작업중/보관)에 맞는 정확한 전체 건수 + 한 페이지의 문제 id.
--     같은 RPC 가 재분류 대상 id 해석(상한 포함)에도 쓰인다 — total 이 정확하므로 대상이 잘렸는지 호출자가 알 수 있다.
-- service_role 전용(서버 액션이 requireAdmin 뒤에 호출). 읽기 전용.
-- 되돌리기: drop function public.problem_question_audit(uuid), public.problem_bank_list_page(jsonb,text,int,int);

create or replace function public.problem_question_audit(p_subject uuid default null) returns jsonb
language sql stable security definer set search_path = public as $$
  with pick as (
    select distinct on (v.problem_id) v.problem_id, v.status, public.problem_version_has_question(v.passage, v.question) as has
      from problem_versions v join problems p on p.id = v.problem_id
     where p.archived_at is null and (p_subject is null or p.subject_id = p_subject) and v.status in ('published', 'draft', 'in_review')
     order by v.problem_id, (v.status = 'published') desc, v.version_no desc)
  select jsonb_build_object(
    'withQuestion', count(*) filter (where has),
    'draftWithout', count(*) filter (where not has and status <> 'published'),
    'publishedWithout', count(*) filter (where not has and status = 'published'))
  from pick;
$$;
revoke execute on function public.problem_question_audit(uuid) from public, anon, authenticated;
grant execute on function public.problem_question_audit(uuid) to service_role;

-- 필터 키: archived(bool) subjectId format satDomain skillCode examSystem usageScope difficulty query keywordId workState repairStatus
-- p_bucket: 'published' | 'working' | 'archived' | null(무시). 작업 상태·보강 상태는 목록 loader 의 기존 규칙과 같다.
create or replace function public.problem_bank_list_page(p_filter jsonb, p_bucket text, p_offset int, p_limit int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_term text := nullif(btrim(coalesce(p_filter ->> 'query', '')), '');
begin
  if v_term is not null then v_term := '%' || replace(replace(replace(v_term, '\', '\\'), '%', '\%'), '_', '\_') || '%'; end if;
  return (
    with base as (
      select p.id, p.created_at,
             case when exists (select 1 from problem_versions v where v.problem_id = p.id and v.status = 'in_review') then 'in_review'
                  when exists (select 1 from problem_versions v where v.problem_id = p.id and v.status = 'draft') then 'draft'
                  when exists (select 1 from problem_versions v where v.problem_id = p.id and v.status = 'published') then 'published'
                  else 'none' end as ws,
             coalesce((select v.repair_status from problem_versions v where v.problem_id = p.id and v.status in ('draft', 'in_review')
                        order by v.version_no desc limit 1), 'none') as repair
        from problems p
       where (case when coalesce((p_filter ->> 'archived')::boolean, false) then p.archived_at is not null else p.archived_at is null end)
         and (p_filter ->> 'subjectId' is null or p.subject_id = (p_filter ->> 'subjectId')::uuid)
         and (p_filter ->> 'format' is null or p.format::text = p_filter ->> 'format')
         and (p_filter ->> 'satDomain' is null or p.sat_domain = p_filter ->> 'satDomain')
         and (p_filter ->> 'skillCode' is null or p.skill_code = p_filter ->> 'skillCode')
         and (p_filter ->> 'examSystem' is null or p.exam_system::text = p_filter ->> 'examSystem')
         and (p_filter ->> 'usageScope' is null or p.usage_scope = p_filter ->> 'usageScope')
         and (p_filter ->> 'difficulty' is null or p.difficulty::text = p_filter ->> 'difficulty')
         and (v_term is null or p.passage ilike v_term or p.topic ilike v_term)
         and (p_filter ->> 'keywordId' is null or exists (select 1 from problem_keywords k where k.problem_id = p.id and k.keyword_id = (p_filter ->> 'keywordId')::uuid))
    ), f as (
      select * from base b
       where (p_filter ->> 'workState' is null or b.ws = p_filter ->> 'workState')
         and (case when p_filter ->> 'repairStatus' is not null then b.repair = p_filter ->> 'repairStatus' else b.repair = 'none' end)
         and (case p_bucket when 'published' then b.ws = 'published' when 'working' then b.ws in ('draft', 'in_review', 'none') else true end)
    )
    select jsonb_build_object(
      'total', (select count(*) from f),
      'ids', coalesce((select jsonb_agg(x.id order by x.created_at desc, x.id) from (select id, created_at from f order by created_at desc, id offset greatest(p_offset, 0) limit least(greatest(p_limit, 0), 5000)) x), '[]'::jsonb)));
end $$;
revoke execute on function public.problem_bank_list_page(jsonb, text, int, int) from public, anon, authenticated;
grant execute on function public.problem_bank_list_page(jsonb, text, int, int) to service_role;
