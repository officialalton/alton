-- 관리자 모의고사 화면용 AP 인식 읽기 함수(2026-10-08). 모두 읽기 전용·추가만.
--  1) mock_exam_set_item_totals: 세트별 전체 문항 수 + 섹션별 문항 수(AP 세트는 R&W/Math 열이 아니라 섹션 구성으로 표시).
--  2) mock_exam_ap_pool_subjects: 재고가 있는 AP 과목 목록(풀 화면 과목 전환기).
--  3) mock_exam_ap_pool(subject): 한 과목의 풀 현황 한 번에(단원·토픽·형식별 + 스킬·구조·계산기 + 용도·단계 + 칸 부족).
-- service_role 전용(기존 mock_exam_pool_usage 와 같은 패턴 — 서버 액션이 requireAdmin 뒤에 호출).
-- 되돌리기: drop function public.mock_exam_set_item_totals(), public.mock_exam_ap_pool_subjects(), public.mock_exam_ap_pool(text);

create or replace function public.mock_exam_set_item_totals()
returns table (exam_set_id uuid, total_count int, section_counts jsonb)
language sql stable security definer set search_path = public as $$
  select x.exam_set_id, sum(x.n)::int, jsonb_object_agg(x.section, x.n)
    from (select exam_set_id, section, count(*)::int as n from mock_exam_set_items group by 1, 2) x
   group by x.exam_set_id;
$$;
revoke execute on function public.mock_exam_set_item_totals() from public, anon, authenticated;
grant execute on function public.mock_exam_set_item_totals() to service_role;

-- 재고(stock) = 현재 배치 + 자동 검증 통과 + 결함 없음.
create or replace function public.mock_exam_ap_pool_subjects()
returns table (subject text, stock int, converted int)
language sql stable security definer set search_path = public as $$
  select i.ap_subject_code,
         count(*) filter (where i.review_state = 'auto_passed' and cardinality(i.defect_flags) = 0)::int,
         count(*) filter (where i.purpose is not null and i.release_tier in ('review_env', 'launch'))::int
    from ap_candidate_items i where i.is_current
   group by i.ap_subject_code
  having count(*) filter (where i.review_state = 'auto_passed' and cardinality(i.defect_flags) = 0) > 0
      or count(*) filter (where i.purpose is not null and i.release_tier in ('review_env', 'launch')) > 0
   order by 1;
$$;
revoke execute on function public.mock_exam_ap_pool_subjects() from public, anon, authenticated;
grant execute on function public.mock_exam_ap_pool_subjects() to service_role;

create or replace function public.mock_exam_ap_pool(p_subject text) returns jsonb
language sql stable security definer set search_path = public as $$
  with base as (
    select i.candidate_key, i.kind, i.keyword_code, split_part(i.keyword_code, '.', 1) as unit, i.skill_primary, i.structure,
           i.calculator, i.purpose, i.release_tier, i.expert_status,
           (i.review_state = 'auto_passed' and cardinality(i.defect_flags) = 0) as stock,
           (i.purpose is not null and i.release_tier in ('review_env', 'launch')) as converted,
           (select case when bool_or(s.status = 'published') then 'published' when count(*) > 0 then 'draft' end
              from problems pr join mock_exam_set_items x on x.problem_id = pr.id
              join mock_exam_sets s on s.id = x.exam_set_id and s.archived_at is null and s.status in ('draft', 'published')
             where pr.ap_candidate_key = i.candidate_key) as assigned
      from ap_candidate_items i where i.is_current and i.ap_subject_code = p_subject
  ), counted as (
    select b.*, (b.purpose = 'mock_exam' and b.converted) as mock_conv, (b.purpose = 'lesson' and b.converted) as lesson_conv from base b
  )
  select jsonb_build_object(
    'subject', p_subject,
    'topics', coalesce((
      select jsonb_agg(t order by t.unit, t.keyword_code, t.kind) from (
        select c.unit, c.keyword_code, c.kind, max(k.label) as topic_label,
               count(*) filter (where c.stock)::int as stock,
               count(*) filter (where c.stock and c.release_tier = 'candidate')::int as candidate,
               count(*) filter (where c.mock_conv)::int as mock_exam,
               count(*) filter (where c.lesson_conv)::int as lesson,
               count(*) filter (where c.mock_conv and c.release_tier = 'review_env')::int as review_env,
               count(*) filter (where c.mock_conv and c.release_tier = 'launch')::int as launch,
               count(*) filter (where c.mock_conv and c.assigned = 'published')::int as assigned_published,
               count(*) filter (where c.mock_conv and c.assigned = 'draft')::int as assigned_draft
          from counted c
          left join subjects sj on sj.ap_subject_code = p_subject
          left join subject_keywords k on k.subject_id = sj.id and k.content_code = c.keyword_code
         where c.stock or c.converted
         group by c.unit, c.keyword_code, c.kind) t), '[]'::jsonb),
    'bySkill', coalesce((select jsonb_agg(x order by x.key) from (
        select split_part(skill_primary, '.', 1) as key, count(*) filter (where stock)::int as stock, count(*) filter (where mock_conv)::int as mock_exam, count(*) filter (where lesson_conv)::int as lesson
          from counted where stock or converted group by 1) x), '[]'::jsonb),
    'byStructure', coalesce((select jsonb_agg(x order by x.key) from (
        select structure as key, count(*) filter (where stock)::int as stock, count(*) filter (where mock_conv)::int as mock_exam, count(*) filter (where lesson_conv)::int as lesson
          from counted where stock or converted group by 1) x), '[]'::jsonb),
    'byCalculator', coalesce((select jsonb_agg(x order by x.key) from (
        select calculator as key, count(*) filter (where stock)::int as stock, count(*) filter (where mock_conv)::int as mock_exam, count(*) filter (where lesson_conv)::int as lesson
          from counted where stock or converted group by 1) x), '[]'::jsonb),
    'purposes', coalesce((select jsonb_agg(jsonb_build_object('kind', v.kind, 'purpose', v.purpose, 'target', v.target, 'converted', v.converted,
        'inReviewEnv', v.in_review_env, 'launched', v.launched, 'shortfall', v.shortfall, 'unallocatedReady', v.unallocated_ready) order by v.kind, v.purpose)
        from ap_stock_by_purpose_v v where v.subject = p_subject), '[]'::jsonb),
    'shortfalls', coalesce((select jsonb_agg(jsonb_build_object('dimension', f.dimension, 'kind', f.kind, 'unitCode', f.unit_code, 'skillCategory', f.skill_category,
        'keywordCode', f.keyword_code, 'calculatorUse', f.calculator_use, 'representation', f.representation, 'target', f.target, 'achieved', f.achieved, 'shortfall', f.shortfall)
        order by f.shortfall desc, f.dimension, f.unit_code nulls last)
        from ap_stock_cell_shortfall_v f join subjects sj on sj.id = f.subject_id and sj.ap_subject_code = p_subject where f.shortfall > 0), '[]'::jsonb),
    'totals', jsonb_build_object(
      'stock', (select count(*) from counted where stock), 'mockExam', (select count(*) from counted where mock_conv),
      'lesson', (select count(*) from counted where lesson_conv),
      'assignedPublished', (select count(*) from counted where mock_conv and assigned = 'published'),
      'assignedDraft', (select count(*) from counted where mock_conv and assigned = 'draft'))
  );
$$;
revoke execute on function public.mock_exam_ap_pool(text) from public, anon, authenticated;
grant execute on function public.mock_exam_ap_pool(text) to service_role;
