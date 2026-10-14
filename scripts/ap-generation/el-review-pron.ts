// EL 검수(2026-10-14): 지문이 성별을 밝히지 않은 필자·화자에 she/her/his 를 쓴 문항을 중립 표현으로 바꾼다. 의미·문항 구조는 그대로.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runBatch, toolInput, estimate, ledger, type BatchReq } from "../mock-exam-generation/batch-lib";
import { ledgerTotal } from "./ledger-total";

const DIR = path.resolve("data/ap/sample-2027/englang-review");
const merged = JSON.parse(readFileSync("data/audit/el-review-merged-mc.json", "utf-8")) as Record<string, any>;
// 키 접미사 → 대상 문항(1부터)
const TARGETS: Record<string, number[]> = { "r04-k0": [1, 2, 3], "r11-k0": [1, 4, 5], "r25-k0": [3], "r10-k0": [1] };
const TOOL = { name: "submit_fix", description: "Return the neutralised items.", input_schema: { type: "object", properties: { items: { type: "array", items: { type: "object", properties: { q: { type: "integer" }, stem: { type: "string" }, options: { type: "array", items: { type: "string" }, description: "four option texts in the original order" }, whys: { type: "array", items: { type: "string" }, description: "four reasons in the original order, same neutralisation" } }, required: ["q", "stem", "options", "whys"] } } }, required: ["items"] } };
const SYS = `You edit AP English Language multiple-choice items. The passage never states the gender of its writer or speaker, so any pronoun (she, her, hers, he, his, him) in a stem, option or reason that refers to the passage's writer/speaker is an unsupported inference. Replace each such pronoun with a neutral phrase ("the writer", "the speaker", "the writer's", "the speaker's") or restructure minimally. Pronouns that refer to OTHER people the passage genuinely gendered (e.g. a named colleague called "she" in the text) must stay. Change nothing else: same meaning, same punctuation, same quotation marks, and keep every option's length within a few words of the original. Return stem, four option texts and four reasons for every question listed.`;
const reqs: BatchReq[] = [];
for (const [key, m] of Object.entries(merged)) {
  const suf = Object.keys(TARGETS).find((s) => key.endsWith(`ap_english_language-${s}`)); if (!suf) continue;
  const disp = `${m.title}\n\n${m.paragraphs.map((p: string[], i: number) => `¶${i + 1} ${p.join(" ")}`).join("\n\n")}`;
  const user = `PASSAGE\n${disp}\n\n${TARGETS[suf].map((q) => { const it = m.items[q - 1]; return `QUESTION ${q}: ${it.stem}\n${it.options.map((o: any, j: number) => `  [${j}]${j === it.key_index ? " (KEY)" : ""} ${o.text}\n      reason: ${o.why}`).join("\n")}`; }).join("\n\n")}\n\nCall submit_fix.`;
  reqs.push({ custom_id: `pn__${key.replace(/[^a-zA-Z0-9]/g, "_").slice(-48)}`, params: { model: "claude-opus-5-5", thinking: { type: "adaptive" }, output_config: { effort: "low" }, max_tokens: 8000, system: [{ type: "text", text: SYS }], tools: [TOOL], tool_choice: { type: "auto" }, messages: [{ role: "user", content: user }] } });
}
(async () => {
  const est = estimate("claude-opus-5-5", reqs.length, 3500, 2500); const t = ledgerTotal(); if (t.cumulativeUsd + est >= 185) throw new Error("HARD STOP"); console.log(`requests ${reqs.length}; cumulative ${t.cumulativeUsd}; est ${est.toFixed(2)}`);
  const got = await runBatch({ dir: DIR, name: "pron", requests: reqs, budgetUsd: ledger(DIR).spent() + 5, estimateUsd: est, sync: true, syncConcurrency: 4, pollMs: 15000 });
  const out: Record<string, unknown> = {}; for (const rq of reqs) { const g = got.get(rq.custom_id); out[rq.custom_id] = g ? toolInput(g) : null; }
  writeFileSync("data/audit/el-review-raw-pron.json", JSON.stringify(out, null, 1)); console.log("done pron");
})();
