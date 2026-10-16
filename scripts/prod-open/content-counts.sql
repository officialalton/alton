-- READ-ONLY. DRY-RUN-FIRST helper (not executed by the author).
-- Run against the SOURCE (non-prod) before export and against the TARGET after import; diff the two outputs.
-- Usage: npx supabase db query --linked -f scripts/prod-open/content-counts.sql   (from a worktree linked to the intended project;
--        check `cat supabase/.temp/project-ref` first)
select 'problems' t, count(*) n from public.problems
union all select 'problem_versions', count(*) from public.problem_versions
union all select 'problem_keywords', count(*) from public.problem_keywords
union all select 'subjects', count(*) from public.subjects
union all select 'subject_keywords', count(*) from public.subject_keywords
union all select 'mock_exam_sets[published]', count(*) from public.mock_exam_sets where status='published'
union all select 'mock_exam_sets[all]', count(*) from public.mock_exam_sets
union all select 'mock_exam_set_items', count(*) from public.mock_exam_set_items
union all select 'ap_candidate_items', count(*) from public.ap_candidate_items
union all select 'ap_candidate_problems', count(*) from public.ap_candidate_problems
union all select 'ap_load_batches', count(*) from public.ap_load_batches
union all select 'ap_skills', count(*) from public.ap_skills
union all select 'ap_curriculum_editions', count(*) from public.ap_curriculum_editions
union all select 'ap_exam_weights', count(*) from public.ap_exam_weights
union all select 'figure.type=image versions', count(*) from public.problem_versions where figure->>'type'='image'
union all select 'orphan set_items (no version)', count(*) from public.mock_exam_set_items i
  where not exists (select 1 from public.problem_versions v where v.id = i.problem_version_id)
order by 1;
