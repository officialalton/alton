// 장문 EL 묶음 독립 맹검 패널(키 비공개): Opus + Sonnet 풀이, Fable 2차 패널. 정답·설명·블루프린트 없이 지문+문항만 본다.
//   set -a; . ~/Developer/ALTON/.env.local; set +a; npx tsx scripts/ap-generation/el-long-panel.ts --items data/ap/stock/el-long-items.json --out data/audit/el-long-panel.json [--models opus,sonnet,fable] [--keys k1,k2]
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runBatch, toolInput, estimate, ledger, type BatchReq } from "../mock-exam-generation/batch-lib";
import { ledgerTotal } from "./ledger-total";
import { passageDisplay } from "../../lib/ap-generation/englang-gates";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const MODELS: Record<string, string> = { opus: "claude-opus-5-5", sonnet: "claude-sonnet-5-5", fable: "claude-fable-5-1" };
const which = arg("--models", "opus,sonnet,fable").split(","); const HARD = Number(arg("--hard", "228"));
const items = (JSON.parse(readFileSync(arg("--items"), "utf-8")) as Json[]).filter((r) => r.kind === "mc" && (!arg("--keys") || arg("--keys").split(",").includes(r.stockKey)));
const TOOL = { name: "submit_review", description: "Submit the review.", input_schema: { type: "object", properties: {
  passage_flags: { type: "array", items: { type: "string" }, description: "Passage-level problems: factual error, internal inconsistency, offensive or biased content, resemblance to a famous real text, unclear rhetorical situation. Empty if none." },
  questions: { type: "array", items: { type: "object", properties: { q: { type: "integer" }, best: { type: "integer", description: "0-based index of the single best option" }, defensible: { type: "array", items: { type: "integer" }, description: "ALL 0-based options a careful AP English teacher could defend as correct (include best)" },
    clarity: { type: "string", enum: ["clear", "narrow", "ambiguous", "flawed"] }, flaws: { type: "array", items: { type: "string" } }, reasoning: { type: "string" } }, required: ["q", "best", "defensible", "clarity", "flaws", "reasoning"] } } }, required: ["passage_flags", "questions"] } };
const SYS = `You are a hostile external reviewer commissioned to find defective items in a set of AP English Language and Composition practice questions before they ship. You are NOT told which option the author keyed. For every question: solve it from the passage, then actively search for a SECOND defensible answer, a stem that is ambiguous or misreferenced, a distractor that is actually true, an option with a grammar or usage error, or a giveaway (longest option, pattern). For writing (revision) questions, check every option for grammar, concision, tone and whether it satisfies EVERY condition of the stem. Be calibrated: rate "clear" when one option is plainly best even if a distractor is tempting. Use "narrow", "ambiguous", "flawed" only for real defects. Also flag passage-level problems (factual or historical error, bias, anything that resembles a known real text). Call submit_review once.`;
const reqs: BatchReq[] = [];
for (const r of items) { const p = r.payload; const ps = p.el_passage; const disp = passageDisplay({ kind: ps.kind, title: ps.title, paragraphs: ps.paragraphs, provenance: p.provenance });
  const user = `PASSAGE\n${disp}\n\nQUESTIONS\n${p.items.map((it: Json, i: number) => `${i + 1}. ${it.stem}\n${it.options.map((o: Json, j: number) => `   [${j}] ${o.text}`).join("\n")}`).join("\n\n")}\n\nCall submit_review.`;
  for (const m of which) reqs.push({ custom_id: `${m}__${r.stockKey.replace(/[^a-zA-Z0-9]/g, "_").slice(-48)}`, params: { model: MODELS[m], thinking: m === "sonnet" ? { type: "between_tools" } : { type: "adaptive" }, output_config: { effort: "high" }, max_tokens: 16000, system: [{ type: "text", text: SYS }], tools: [TOOL], tool_choice: { type: "auto" }, messages: [{ role: "user", content: user }] } as never }); }
(async () => {
  const est = which.reduce((a, m) => a + estimate(MODELS[m], items.length, 5000, 12000), 0); const t0 = ledgerTotal();
  if (t0.cumulativeUsd + est >= HARD) throw new Error(`HARD STOP cumulative ${t0.cumulativeUsd} + est ${est.toFixed(2)} >= ${HARD}`);
  console.log(`panel ${reqs.length} requests; est $${est.toFixed(2)}; cumulative ${t0.cumulativeUsd}`);
  const DIR = path.resolve("data/ap/sample-2027/englang-long-panel");
  const got = await runBatch({ dir: DIR, name: arg("--name", "panel"), requests: reqs, budgetUsd: ledger(DIR).spent() + Number(arg("--budget", "3")), estimateUsd: est, sync: process.env.EL_SYNC === "1", syncConcurrency: 6, pollMs: 20000 });
  const out: Json = {}; let miss = 0; for (const rq of reqs) { const g = got.get(rq.custom_id); const t = g ? toolInput(g) : null; if (!t) miss++; out[rq.custom_id] = t; }
  writeFileSync(arg("--out"), JSON.stringify(out, null, 1)); console.log(`done ${reqs.length - miss}/${reqs.length}; cumulative ${ledgerTotal().cumulativeUsd}`);
})();
