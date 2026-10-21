// SAQ1 B/C 루브릭 회귀 검증(2026-10-21, 유료): 근거 있는 예외 답안이 일괄 0점이 되지 않고 부정확한 답안은 0점인지 독립 채점기 2개로 확인한다. DB 접근 없음.
//   bash -c 'set -a; . ./.env.local; set +a; npx tsx scripts/ap-generation/ush-real-f-saq1-regression.ts'
import { readFileSync, writeFileSync } from "node:fs";
import { runBatch, toolInput, estimate, ledger, type BatchReq } from "../mock-exam-generation/batch-lib";
import { ledgerTotal } from "./ledger-total";
import * as P from "../../lib/ap-generation/ushistory-prompts";
import { frqTaskText, USH_RUBRIC_ROWS, type UshFrqPayload } from "../../lib/ap-generation/ushistory-frq";
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const MODELS = ["claude-opus-5-5", "claude-sonnet-5-5"]; const DIR = "data/ap/sample-2027/ush-real-f";
const CAP = Number(process.env.USH_CAP ?? 3); const CUM_STOP = Number(process.env.USH_CUM_STOP ?? 517); const R = process.env.USH_ROUND ? `-r${process.env.USH_ROUND}` : "";
const cell = (JSON.parse(readFileSync("data/ap/ush-sources/real-f-draft.json", "utf-8")) as Json[]).find((c) => c.cellId === "ap_us_history-real_f_saq1")!;
const p = cell.payload.ush_frq as UshFrqPayload; const cases = JSON.parse(readFileSync("data/ap/ush-sources/real-f-saq1-regression-cases.json", "utf-8")).cases as Json[];
const rubric = p.rubric.rows.map((r) => `${r.name} (0-${r.max}): ${r.task_specific}\n${Object.entries(r.descriptors).sort().map(([k, v]) => `  ${k}: ${v}`).join("\n")}`).join("\n") + "\n" + p.rubric.scoring_notes.map((n) => `Note: ${n}`).join("\n");
const material = p.sources.map((s) => `Source ${s.id} (${s.kind})\n${s.title}\n${s.attribution}\n${s.body ?? ""}`).join("\n\n");
const FILL = "Nothing further.";
const essay = (c: Json) => `(A) Dunning stresses the hostility the Bureau aroused, while Du Bois stresses its protection of freed people's rights.\n\n(B) ${c.row === "b" ? c.text : FILL}\n\n(C) ${c.row === "c" ? c.text : FILL}`;
const think = (m: string) => ({ thinking: m.includes("sonnet") ? { type: "between_tools" } : { type: "adaptive" }, output_config: { effort: "medium" } });
async function main() {
  const t0 = ledgerTotal(); console.log(`start cumulative $${t0.cumulativeUsd}`); if (t0.cumulativeUsd >= CUM_STOP) { console.error("stop line"); process.exit(4); }
  const spent0 = ledger(DIR).spent(); const rows = USH_RUBRIC_ROWS[p.task_type];
  const reqs: BatchReq[] = []; cases.forEach((c) => MODELS.forEach((m, g) => reqs.push({ custom_id: `reg-${c.id}-${g}${R}`, params: { model: m, ...think(m), max_tokens: 3500, system: P.GRADE_SYSTEMS[g % P.GRADE_SYSTEMS.length], tools: [P.GRADE_TOOL(rows)], tool_choice: { type: "auto" }, messages: [{ role: "user", content: [{ type: "text", text: P.gradeUser(frqTaskText(p), material, rubric, essay(c)) }] }] } })));
  const res = await runBatch({ dir: DIR, name: "regression", requests: reqs, estimateUsd: MODELS.reduce((a, m) => a + estimate(m, cases.length, 5500, 1500), 0), budgetUsd: spent0 + CAP, sync: true });
  const out: Json[] = []; let miss = 0;
  for (const c of cases) { const sc = MODELS.map((_, g) => { const t = res.get(`reg-${c.id}-${g}${R}`); return t ? Number((toolInput(t) as Json)[c.row]) : NaN; }); const ok = sc.every((x) => x === c.expect); if (!ok) miss++; out.push({ id: c.id, kind: c.kind, row: c.row, expect: c.expect, scores: sc, ok }); console.log(`${ok ? "OK  " : "MISS"} ${c.id} [${c.kind}] expect ${c.expect} got ${sc.join("/")}`); }
  writeFileSync("data/ap/ush-sources/real-f-saq1-regression-result.json", JSON.stringify({ models: MODELS, generatedAt: new Date().toISOString(), cases: out }, null, 1) + "\n");
  console.log(`mismatches ${miss}/${cases.length}; spent $${(ledger(DIR).spent() - spent0).toFixed(4)}; cumulative $${ledgerTotal().cumulativeUsd}`);
}
main();
