# AI essay grader — real-model calibration (2026-10-14)

Script: `scripts/essay-calibration.ts` (stock JSON only, no DB). Real `processEssay` path (2 runs, lower per row), leave-one-out anchors (each prompt has only 3 samples, so every graded sample had 2 anchors + prompt/sources). Raw output: `data/ap/essay-calibration-result.json`. Model: default generation model (claude-sonnet-5-5). Cost via `costs.ts` (default $3/$15 per M — assumed rates).

| Prompt | Tier | Target | AI | Note |
|---|---|---|---|---|
| fa1 | high | 6 | 6 | |
| fa1 | mid | 5 | – | invalid_output |
| fa1 | low | 1 | 2 | +1 |
| fa2 | high | 6 | 6 | |
| fa2 | mid | 4 | 4 | |
| fa2 | low | 2 | 2 | |
| fa3 | high | 6 | – | invalid_output |
| fa3 | mid | 4 | 4 | |
| fa3 | low | 1 | 2 | +1 |
| fb1 | high/mid/low | 6/4/2 | 6/4/2 | exact |
| fb2 | high/mid/low | 6/4/2 | 6/3/2 | mid -1 |
| fb3 | high/mid/low | 6/5/1 | 5/4/3 | low +2 |

- MAE (16 scored of 18): 0.44; mean signed error +0.06.
- Tier ordering (high>mid>low): preserved in 4 of 6 prompts (fa2, fb1, fb2, fb3); the other two could not be evaluated because one sample each failed. No inversions observed.
- Failures: 2 of 18 essays ended `invalid_output` (both runs' validation; cause not diagnosed — likely truncation/format; fa1 mid, fa3 high). No refusals/skips. Disagreement flag raised 0 times.
- Spend: $0.98 over 37 calls (~$0.026/call, ~$0.053/essay); ledger appended (stage essay-calibration).
- **Prompt-injection test NOT run**: the $1.00 cap was reached before it (each injected essay needs ~$0.05). Still open.

## Observations / recommendations
1. Good on high/mid; the grader never gives sophistication to non-high essays and was exact on 10 of 16.
2. Weak lows are over-scored (+1/+2: fa1, fa3, fb3 lows got evidence 2 where target 1). Consider tightening rubric evidence 1-vs-2 guidance (e.g., summary/paraphrase-only = 1; "some specific" requires quoted detail), then re-measure.
3. Investigate the `invalid_output` rate (~11% of essays) before enabling: log validator reason (`bad_score_*`/`bad_rationale_*`/not_object) in-memory, check max output tokens (1500 incl. thinking on the new model) — a retry cap already exists (3 attempts) but cost doubles per failure.
4. Run the injection test (2 essays, ~$0.12) with a fresh budget before enabling for students.
5. Sample is tiny and LOO anchors were only 2 (prompts have 3 samples); production will have 3 anchors, so results are slightly pessimistic.
