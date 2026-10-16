// 라운드 6 독립 검증(유료, 배치 단가): (1) 키가 바뀌거나 문안이 바뀐 MC 5건을 Opus·Sonnet 이 키 없이 푼다(키·해설 비공개), (2) 고친 FRQ 지문·참고답을 Opus 가 적대적으로 검토한다.
//   npx tsx scripts/audit/r6-verify-models.ts [--cap 1.2]   결과: data/audit/2026-10-15-r6-model-verify.json (키는 읽지 않는다: process.env 로만)
import { readFileSync, writeFileSync } from "node:fs";
import { runBatch, toolInput, estimate, ledger, type BatchReq } from "../mock-exam-generation/batch-lib";
import { loadEnvLocal } from "../keywords/db";
import { ledgerTotal } from "../ap-generation/ledger-total";
import type { Patch, ProblemReadout } from "../../lib/audit-fix/plan";
loadEnvLocal();
const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const ro = JSON.parse(readFileSync("data/audit/2026-10-15-r6-readout.json", "utf-8")) as { problems: ProblemReadout[] };
const patches = (JSON.parse(readFileSync("data/audit/2026-10-15-r6-patches.json", "utf-8")) as { patches: Patch[] }).patches;
const byId = new Map(ro.problems.map((p) => [p.problem_id, p]));
type Json = Record<string, any>;
const after = (p: Patch): Json => { const cur = byId.get(p.problemId!)!.pub as unknown as Json; const o: Json = { ...cur }; for (const c of p.changes) o[c.field] = c.new; return o; };

const MC = ["R6-STAT2-MC28", "R6-PHYS1-MC9", "R6-MICRO1-MC53", "R6-MACRO1-MC28", "R6-CHEM2-MC29"];
const MODELS = ["claude-opus-5-5", "claude-sonnet-5-5"] as const;
const SYS_MC = "You are an AP exam expert solving a practice question blind. You are NOT given the author's key or explanation. Choose the single best option using standard College Board course content and ONLY the information in the question and the data shown. If two options are defensible, or none is, or information needed is missing, set ambiguous=true and say why in note. Always answer by calling the submit_answer tool.";
const tool = { name: "submit_answer", description: "Submit the answer.", input_schema: { type: "object", properties: { choice_index: { type: "integer", description: "0-based index of the best option" }, ambiguous: { type: "boolean" }, note: { type: "string" } }, required: ["choice_index", "ambiguous", "note"] } };
const ftool = { name: "submit_review", description: "Submit review.", input_schema: { type: "object", properties: { resolved: { type: "boolean", description: "true if the new text resolves the stated issue" }, new_errors: { type: "array", items: { type: "string" }, description: "real factual, numerical or logical errors in the NEW text (empty if none)" }, note: { type: "string" } }, required: ["resolved", "new_errors", "note"] } };
const SYS_FR = "You are a hostile QA reviewer of AP practice free-response material (prompt parts, reference answers, rubric lines). You get the issue that was reported, the changes made (old -> new), and the full new prompt/data. Decide whether the new text resolves the reported issue and whether it introduced any real error (a number that does not follow from the data, a claim that contradicts the prompt, a rubric line that no longer matches the reference answer). Do not report style preferences. Always answer by calling the submit_review tool.";

const ONLY = arg("--only") ? arg("--only").split(",") : null;
const reqs: BatchReq[] = [];
for (const id of ONLY ? [] : MC) {
  const p = patches.find((x) => x.id === id)!; const a = after(p);
  const body = `${a.passage ? `${a.passage}\n\n` : ""}QUESTION: ${a.question}\n${a.figure ? `\nDATA SHOWN (JSON): ${JSON.stringify(a.figure)}\n` : ""}\nOPTIONS:\n${(a.options as string[]).map((o, i) => `${i}: ${o}`).join("\n")}`;
  for (const m of MODELS) reqs.push({ custom_id: `${m.includes("opus") ? "op" : "so"}__${id}`, params: { model: m, max_tokens: 1500, system: [{ type: "text", text: SYS_MC }], tools: [tool], tool_choice: { type: "auto" }, messages: [{ role: "user", content: body }] } });
}
const FR = patches.filter((p) => !MC.includes(p.id) && !p.id.startsWith("R6-PSY2-MC") && !p.id.endsWith("FRQ2T") && (!ONLY || ONLY.includes(p.id)));
for (const p of FR) {
  const a = after(p);
  // 긴 해설은 바뀐 줄만(옛 줄 → 새 줄) 보낸다: 전체를 자르면 새 문안이 잘려 나간다.
  const lineDiff = (o: string, n: string) => { const ol = o.split("\n"), nl = n.split("\n"); const os = new Set(ol), ns = new Set(nl); return `${ol.filter((l) => !ns.has(l)).map((l) => `OLD LINE: ${l}`).join("\n")}\n${nl.filter((l) => !os.has(l)).map((l) => `NEW LINE: ${l}`).join("\n")}`; };
  const changes = p.changes.map((c) => (typeof c.old === "string" && typeof c.new === "string" ? `FIELD ${c.field} (changed lines only)\n${lineDiff(c.old, c.new)}` : `FIELD ${c.field}\nOLD: ${JSON.stringify(c.old)}\nNEW: ${JSON.stringify(c.new)}`)).join("\n\n");
  const full = `PROMPT PARTS: ${JSON.stringify(a.statements)}\n${a.passage ? `PASSAGE/SETUP (first 5000 chars): ${String(a.passage).slice(0, 5000)}\n` : ""}${a.figure ? `DATA SHOWN: ${JSON.stringify(a.figure).slice(0, 2500)}\n` : ""}`;
  const body = `REPORTED ISSUE: ${p.why}\n\nCHANGES MADE:\n${changes.slice(0, 14000)}\n\nFULL NEW CONTEXT:\n${full}`;
  reqs.push({ custom_id: `fr__${p.id}`, params: { model: "claude-opus-5-5", max_tokens: 1500, system: [{ type: "text", text: SYS_FR }], tools: [ftool], tool_choice: { type: "auto" }, messages: [{ role: "user", content: body }] } });
}
(async () => {
  const est = reqs.reduce((s, r) => s + estimate(r.params.model, 1, 3500, 500), 0); const cap = Number(arg("--cap", "1.2"));
  const t = ledgerTotal(); console.log(`audit-r6 verify: ${reqs.length}건 추정 $${est.toFixed(3)} 누적 $${t.cumulativeUsd}`);
  if (est > cap || t.cumulativeUsd + est > 208) throw new Error(`추정 ${est} > 상한`);
  const DIR = "data/ap/sample-2027/audit-r6";
  if (ONLY) console.log("only", ONLY.join(","));
  const res = await runBatch({ dir: DIR, name: ONLY ? "audit-r6-verify-2" : "audit-r6-verify", requests: reqs, budgetUsd: ledger(DIR).spent() + cap, estimateUsd: est, pollMs: 20000, sync: process.argv.includes("--sync") });
  const out: Json = ONLY ? JSON.parse(readFileSync("data/audit/2026-10-15-r6-model-verify.json", "utf-8")) : { mc: {}, frq: {} };
  for (const id of ONLY ? [] : MC) { const p = patches.find((x) => x.id === id)!; const cur = byId.get(p.problemId!)!.pub!; const key = cur.correct_index; // 옵션 텍스트는 바뀌어도 위치는 그대로(키 위치 유지 패치)
    out.mc[id] = { keyIndex: key }; for (const [pre, m] of [["op", "opus"], ["so", "sonnet"]] as const) { const r = res.get(`${pre}__${id}`); const i = r ? (toolInput(r as never) as Json | null) : null; out.mc[id][m] = i ? { choice: i.choice_index, ambiguous: i.ambiguous, note: String(i.note).slice(0, 300) } : null; } }
  for (const p of FR) { const r = res.get(`fr__${p.id}`); const i = r ? (toolInput(r as never) as Json | null) : null; out.frq[p.id] = i ? { resolved: i.resolved, new_errors: i.new_errors, note: String(i.note).slice(0, 400) } : null; }
  writeFileSync("data/audit/2026-10-15-r6-model-verify.json", JSON.stringify(out, null, 1) + "\n");
  console.log(JSON.stringify(out, null, 1).slice(0, 6000));
})();
