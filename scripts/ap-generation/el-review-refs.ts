// EL 읽기 문항 해설의 숨은 문장 번호 제거(2026-10-14): 읽기 지문은 문단 번호(¶N)만 보이는데 일부 해설이 'Sentence 19'·'(13-15)' 처럼 보이지 않는 번호를 가리킨다.
// 입력: data/audit/el-review-merged-mc.json (el-review-build-fixes.ts 1단계 산출). 실행: npx tsx scripts/ap-generation/el-review-refs.ts
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runBatch, toolInput, estimate, ledger, type BatchReq } from "../mock-exam-generation/batch-lib";
import { ledgerTotal } from "./ledger-total";
import { passageDisplay } from "../../lib/ap-generation/englang-gates";

const DIR = path.resolve("data/ap/sample-2027/englang-review");
const merged = JSON.parse(readFileSync("data/audit/el-review-merged-mc.json", "utf-8")) as Record<string, any>;
const HIDDEN = /\b[Ss]entences?\s+\d|\(\d+(?:\s*[-–]\s*\d+)?\)|\bsentence\s+\d/;
const TOOL = { name: "submit_fix", description: "Return the cleaned reasons.", input_schema: { type: "object", properties: { items: { type: "array", items: { type: "object", properties: { q: { type: "integer" }, whys: { type: "array", items: { type: "string" }, description: "The four reasons, in option order, with no sentence numbers" } }, required: ["q", "whys"] } } }, required: ["items"] } };
const SYS = `You edit answer explanations for AP English Language reading questions. The student's passage shows only PARAGRAPH numbers (¶1, ¶2, ...); sentence numbers are NOT visible. Rewrite each option's one-sentence reason so it never mentions a sentence number or a parenthetical sentence range such as "Sentence 19", "sentences 23-26", "(13-15)". Point to the paragraph ("paragraph 4"), or quote a short exact phrase from the passage, instead. Keep the meaning, the verdict (why it is right or wrong) and the length about the same. Do not change what any option claims. Return all four reasons in option order for every question listed.`;
const reqs: BatchReq[] = [];
for (const [key, m] of Object.entries(merged)) {
  if (m.kind !== "reading") continue;
  const need = m.items.map((it: any, i: number) => ({ it, i })).filter(({ it }: any) => it.options.some((o: any) => HIDDEN.test(o.why)));
  if (!need.length) continue;
  const disp = passageDisplay({ kind: "reading", title: m.title, paragraphs: m.paragraphs, provenance: m.provenance });
  const user = `PASSAGE\n${disp}\n\n${need.map(({ it, i }: any) => `QUESTION ${i + 1}: ${it.stem}\n${it.options.map((o: any, j: number) => `  [${j}]${j === it.key_index ? " (KEY)" : ""} ${o.text}\n      reason: ${o.why}`).join("\n")}`).join("\n\n")}\n\nCall submit_fix.`;
  reqs.push({ custom_id: `rf__${key.replace(/[^a-zA-Z0-9]/g, "_").slice(-48)}`, params: { model: "claude-opus-5-5", thinking: { type: "adaptive" }, output_config: { effort: "low" }, max_tokens: 8000, system: [{ type: "text", text: SYS }], tools: [TOOL], tool_choice: { type: "auto" }, messages: [{ role: "user", content: user }] } });
}
(async () => {
  const est = estimate("claude-opus-5-5", reqs.length, 3500, 1500); const t = ledgerTotal(); if (t.cumulativeUsd + est >= 185) throw new Error("HARD STOP"); console.log(`requests ${reqs.length}; cumulative ${t.cumulativeUsd}; est ${est.toFixed(2)}`);
  const got = await runBatch({ dir: DIR, name: "refs", requests: reqs, budgetUsd: ledger(DIR).spent() + 5, estimateUsd: est, sync: true, syncConcurrency: 4, pollMs: 15000 });
  const out: Record<string, unknown> = {}; for (const rq of reqs) { const g = got.get(rq.custom_id); out[rq.custom_id] = g ? toolInput(g) : null; }
  writeFileSync("data/audit/el-review-raw-refs.json", JSON.stringify(out, null, 1)); console.log("done refs");
})();
