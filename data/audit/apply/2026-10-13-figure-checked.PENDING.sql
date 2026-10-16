-- PENDING - DO NOT RUN until the coordinator has looked at every figure below in the Preview/admin editor and confirmed it is correct.
-- Marks the figure of the audit-patched PUBLISHED versions as checked (problem_versions.figure_checked = true). Direct UPDATE is allowed on a published version
-- (figure_checked is not one of the columns protected by problem_versions_published_immutable); mark_problem_figure_checked() only works on drafts.
-- Scope = patches that CHANGED the figure (saved with figure_checked=false by the audit fixes):
--   round 1: S-06 (plane: x=5 boundary line + shading), S-07 (arch polygon), S-08 (scatter C outlier moved), F-f87e641a, F-c27d0f37, F-8329a1bd (axes widened to -20..20),
--            C-aaeb9945, C-445bab61 (candle re-themed: axis titles)
--   round 2: R2-M17 (prepaid-card balance line graph: axis titles), R2-F-c5eb51a6 (axes widened to -20..20; this problem is in no set yet)
-- NOT included (figure_checked was already false before the audit; the audit did not touch their figures): A-d4922e40, AP-f02-k10, AP-f02-k5, AP-f02-k9, C-9939657f, D-18ec5fbb, Q-838ef1c9, Q-e222cbc8, S-01, S-02, S-05, U-efdafa88
-- To arm: delete the RAISE EXCEPTION line below, then run:  npx supabase db query --linked -f data/audit/apply/2026-10-13-figure-checked.PENDING.sql
do $fc$
declare v_n int;
begin
  raise exception 'PENDING: figure_checked has NOT been authorised. Delete this line only after the coordinator visually confirmed the figures.';
  update problem_versions pv set figure_checked = true
   where pv.status = 'published' and coalesce(pv.figure_checked, false) = false and pv.figure is not null
     and pv.quality->'auditFix'->>'patch' = any (array['S-06', 'S-07', 'S-08', 'F-f87e641a', 'F-c27d0f37', 'F-8329a1bd', 'C-aaeb9945', 'C-445bab61', 'R2-M17', 'R2-F-c5eb51a6']);
  get diagnostics v_n = row_count;
  raise notice 'figure_checked set to true on % published versions (expected 10)', v_n;
end
$fc$;
