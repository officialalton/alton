# Hotfix: AP result screen (English Language / blank responses) — 2026-10-21

Branch `hotfix/ap-result-screen`, based on origin/main `f0194c028` (= current Production). NOT merged to main; Preview only. Merge decision is the owner's.

## Included (files taken from origin/preview/m4-integration-verification; main is an ancestor of it, so no main-only edits are overwritten)
- app/student/mock-exam/[attemptId]/page.tsx — read saved score rows whenever the subject supports AI scoring (the flag only gates *starting* grading); passes `essayScoringSupported`
- app/parent/mock-exam/[studentId]/[attemptId]/page.tsx — same for the parent screen
- app/student/mock-exam/[attemptId]/ApExamResultView.tsx (+ ApExamResultScore.test.tsx) — no more "not scored for this subject" on supported subjects; paused / unavailable-with-reason texts; blank answer = 0 only after submit
- lib/ap-exam/result-score.ts (+ result-score.test.ts) — states `paused`, `reason`, `submitted`/`scoringActive` inputs
- lib/ap-exam/section-weights.ts — needed by result-score.test (`frqSplit`); also sets Micro/Macro to the owner-confirmed 66.65/33.35 (affects displayed weighted total)
- lib/essay-grading/view.ts — also selects `next_retry_at` (column exists since migration 20262100000600)

Equivalent to the fixes in 73d3950d4 line ('not scored' fix), 5568b94c3 (blank = 0 only if submitted) and the display part of 82d84e69e (limit-wait / no_reference_answers states). Files were taken at integration-branch state rather than cherry-picked, because those commits are merges mixed with Stripe and stock data.

## Excluded
Stripe (webhook route, refund board, migrations, actions); 54ffb064a / f6a219cc8 cost accumulation (lib/essay-grading store/queue/costs: server-side grading behavior, not needed for display, can follow separately); lib/essay-grading queue.ts / actions.ts / store.ts / costs.ts (the code that writes the new `daily_cap` / `monthly_budget` / `no_reference_answers` row states — the UI handles them if they appear; the old queue just does not write them); checklist.ts / review-policy.ts; European History; new-set publish settings; admin AP result and refund screens; SEO; stock data JSON.

## Dependencies
- No new migration, no new column. Uses `mock_exam_essay_scores.next_retry_at` (already in migration 20262100000600, on main / shared DB).
- No new env vars. No API or server-action change.

## Behavior by `AI_ESSAY_GRADING_ENABLED` (flag = starts grading; "supported" = subject has AI grading, e.g. AP English Language/Literature)
| Case | Result screen |
|---|---|
| Supported subject, flag ON | Saved rows shown; page auto-starts grading as before; in progress while rows pending |
| Supported subject, flag OFF, rows exist | Saved scores shown (previously hidden / "not scored") |
| Supported subject, flag OFF, no rows | FRQ "AI scoring temporarily unavailable" (paused), weighted total withheld, no 0 |
| Unsupported subject (Calculus AB, Euro History) | "not scored for this subject" as before; MC section score only |
| Blank FRQ answer, attempt graded | 0 / max, "No response" |
| Blank FRQ answer, attempt not submitted | in progress (not 0) |

The Production flag value was not read; check it in Vercel.

## Compatibility
- Current Production code writes only `failed` / `skipped` rows; the new UI reads them correctly (known `last_error` values mapped, unknown -> "Score unavailable").
- Shared DB: read-only select of existing columns; no write path changed.
- UI-only, no data-format change.

## Tests (run on this branch)
- `npx tsc --noEmit`: only pre-existing errors (`@portabletext/react` missing, `LayoutProps` in app/layout.tsx — environment/Sanity related; node_modules not installed in this worktree).
- `vitest --project unit lib/ap-exam lib/essay-grading app/student/mock-exam app/parent`: 572 pass, 1 fail = `lib/ap-exam/tex-corrections-gen.test.ts` (stock data vs correction file; not touched by this branch, unrelated).

## Preview verification
1. Open the Vercel Preview of `hotfix/ap-result-screen`; the user logs in directly.
2. English Language attempt `5b9952b6`: no "not scored for this subject"; FRQ rows show scores or paused/unavailable text; weighted total available or withheld with a reason.
3. Calculus AB `7020773d`: FRQ shows "not scored for this subject" (expected, unsupported); MC score visible.
4. Parent view `/parent/mock-exam/<studentId>/<attemptId>` for 5b9952b6: read-only, same states, no grading trigger.
5. An unsubmitted attempt with a blank FRQ: shows in progress, not 0.

## Rollback
Not on main, so nothing to roll back until merged. If merged: `git revert -m 1 <merge sha>` (or `git revert <commit sha>`) and push; or in Vercel promote/redeploy the previous Production deployment of `f0194c028`. No DB action needed.
