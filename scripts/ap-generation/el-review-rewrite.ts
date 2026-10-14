// EL1/EL2 선지 길이 단서 제거(2026-10-14): 키 텍스트·키 위치·문항 줄기는 그대로 두고 오답 선지를 키와 비슷한 길이로 다듬는다.
// 실행: set -a; . ~/Developer/ALTON/.env.local; set +a; npx tsx scripts/ap-generation/el-review-rewrite.ts
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runBatch, toolInput, estimate, ledger, type BatchReq } from "../mock-exam-generation/batch-lib";
import { ledgerTotal } from "./ledger-total";
import { passageDisplay } from "../../lib/ap-generation/englang-gates";

const DIR = path.resolve("data/ap/sample-2027/englang-review");
const stock: Record<string, any> = {};
for (const f of readdirSync("data/ap/stock").filter((x) => /^el-.*-items\.json$/.test(x))) for (const it of JSON.parse(readFileSync(path.join("data/ap/stock", f), "utf-8"))) stock[it.stockKey] = it;
const assign = JSON.parse(readFileSync("data/ap/stock/exact-assign-el-el1-el2.json", "utf-8")).sets as { id: string; mcA: string[] }[];
const HARD = 185;
const TOOL = { name: "submit_rewrite", description: "Return the rewritten distractors.", input_schema: { type: "object", properties: { items: { type: "array", items: { type: "object", properties: { q: { type: "integer" }, options: { type: "array", description: "All four options in the ORIGINAL order; the keyed option text must be returned unchanged", items: { type: "object", properties: { text: { type: "string" }, why: { type: "string", description: "One-sentence reason this option is wrong (or, for the key, why it is right); keep the original unless the text changed" } }, required: ["text", "why"] } } }, required: ["q", "options"] } } }, required: ["items"] } };
const SYS = `You are a psychometric item editor for AP English Language and Composition multiple-choice questions. A reviewer found a test-wiseness cue: the keyed option is almost always the longest, most elaborated option. Your job is to remove that cue WITHOUT changing what any item tests.
Rules for every question:
1. Do NOT change the stem, the order of options, or the keyed option's text.
2. Rewrite each WRONG option so its word count is within about 85%-115% of the keyed option's word count, and in roughly 1 of every 3 questions make one wrong option slightly LONGER than the key. Lengthen by adding a specific, plausible-sounding but still wrong clause that fits the option's existing flaw (misreading, unsupported claim, reversed relation, wrong scope, wrong tone). If a wrong option is already as long as the key, leave it alone.
3. Keep every wrong option clearly wrong from the passage: never make a distractor more defensible, never repeat words from the key's justification, never add a hedge that makes it true. Keep options grammatically parallel to the stem and to each other (same sentence shape as the key).
4. No option may exceed 46 words. Do not use letters ("A", "both of the above"), the dollar sign, or markup characters.
5. Keep each wrong option's flaw type unchanged; update its "why" only if you changed what the option claims.
Call submit_rewrite once with every question.`;
const reqs: BatchReq[] = [];
for (const s of assign) for (const k of s.mcA) {
  const p = stock[k].payload; const ps = p.el_passage; const disp = passageDisplay({ kind: ps.kind, title: ps.title, paragraphs: ps.paragraphs, provenance: p.provenance });
  const user = `PASSAGE\n${disp}\n\nQUESTIONS\n${p.items.map((it: any, i: number) => `${i + 1}. ${it.stem}\n${it.options.map((o: any, j: number) => `   [${j}] (${o.label}${j === it.key_index ? ", KEY" : ""}; ${o.text.split(/\s+/).length} words) ${o.text}\n        why: ${o.why}`).join("\n")}`).join("\n\n")}\n\nCall submit_rewrite.`;
  reqs.push({ custom_id: `rw__${k.replace(/[^a-zA-Z0-9]/g, "_").slice(-48)}`, params: { model: "claude-opus-5-5", thinking: { type: "adaptive" }, output_config: { effort: "medium" }, max_tokens: 12000, system: [{ type: "text", text: SYS }], tools: [TOOL], tool_choice: { type: "auto" }, messages: [{ role: "user", content: user }] } });
}
(async () => {
  const est = estimate("claude-opus-5-5", reqs.length, 4000, 5000);
  const t = ledgerTotal(); if (t.cumulativeUsd + est >= HARD) throw new Error("HARD STOP"); console.log(`cumulative ${t.cumulativeUsd}; est ${est.toFixed(2)}`);
  const got = await runBatch({ dir: DIR, name: "rewrite", requests: reqs, budgetUsd: ledger(DIR).spent() + 14, estimateUsd: est, pollMs: 20000 });
  const out: Record<string, unknown> = {}; let miss = 0;
  for (const rq of reqs) { const g = got.get(rq.custom_id); const ti = g ? toolInput(g) : null; if (!ti) miss++; out[rq.custom_id] = ti; }
  writeFileSync("data/audit/el-review-raw-rewrite.json", JSON.stringify(out, null, 1)); console.log(`done ${reqs.length - miss}/${reqs.length}`);
})();
