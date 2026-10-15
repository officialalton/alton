// AP Psychology 두 번째 독립 모델 패널(키 맹검): 통과한 재고 문항을 Fable·Sonnet 이 키 없이 풀고, 한쪽이라도 키와 다르거나 '모호/결함'으로 표시하면 반려 목록(data/ap/stock/psych-panel-flags.json)에 올린다.
// FRQ 는 Fable 이 지문·루브릭·모범 답안의 사실·수치 결함을 찾는다(blocker 면 반려). Message Batches(절반 단가). psych-pool.ts 가 반려 목록을 읽어 재고에서 뺀다.
//   npx tsx scripts/ap-generation/psych-panel.ts [--files psych-p1a-items,...] [--cap 2.5]
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { runBatch, toolInput, estimate, ledger, type BatchReq } from "../mock-exam-generation/batch-lib";
import { loadEnvLocal } from "../keywords/db";
import { ledgerTotal } from "./ledger-total";
loadEnvLocal();
const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const DIR = path.resolve("data/ap/sample-2027/psych-panel"); mkdirSync(DIR, { recursive: true });
const OUT = path.resolve("data/ap/stock/psych-panel-flags.json");
const files = arg("--files") ? arg("--files").split(",") : readdirSync("data/ap/stock").filter((f) => /^psych-.*-items\.json$/.test(f)).map((f) => f.replace(".json", ""));
type Json = Record<string, any>;
const items: Json[] = []; for (const f of files) for (const r of JSON.parse(readFileSync(`data/ap/stock/${f}.json`, "utf-8")) as Json[]) if (r.apSubjectCode === "ap_psychology" && r.validation === "auto_passed") items.push(r);
const MODELS = ["claude-fable-5-1", "claude-sonnet-5-5"] as const;
const SYS = "You are an AP Psychology expert (College Board CED, effective Fall 2025) solving practice questions blind. You are NOT told the author's key. For each question choose the single best option by standard, mainstream, CED-aligned psychology. Flag a question as ambiguous if a second option is also defensible, if a stated option is factually wrong in a way that matters, if the stem needs outside knowledge, or if it relies on a contested or non-replicated finding stated as fact.";
const tool = { name: "submit_answers", description: "Submit answers.", input_schema: { type: "object", properties: { answers: { type: "array", items: { type: "object", properties: { q: { type: "integer" }, choice_index: { type: "integer" }, ambiguous: { type: "boolean" }, note: { type: "string" } }, required: ["q", "choice_index", "ambiguous", "note"] } } }, required: ["answers"] } };
const ftool = { name: "submit_review", description: "Submit review.", input_schema: { type: "object", properties: { findings: { type: "array", items: { type: "object", properties: { severity: { type: "string", enum: ["blocker", "major", "minor"] }, where: { type: "string" }, issue: { type: "string" } }, required: ["severity", "where", "issue"] } } }, required: ["findings"] } };
const FSYS = "You are a hostile QA reviewer of an AP Psychology free-response package (fictional source(s), prompt parts, analytic rubric rows, model answers). Report only real defects: numbers in an answer that do not follow from the source or table, a rubric row that would credit a wrong answer or reject a right one, a psychological-accuracy error, a source that does not support at least two different defensible claims (EBQ), a part whose answer is revealed by the source wording, or an unfair ambiguity. 'blocker' = would mislead a student or grader.";
const reqs: BatchReq[] = []; const keyOf = new Map<string, string>();
for (const it of items) {
  const p = it.payload; const id = String(it.stockKey).replace(/[^a-zA-Z0-9_-]/g, "_").slice(-60);
  keyOf.set(id, it.stockKey);
  if (it.kind === "mc") {
    const qs = Array.isArray(p.items) ? p.items : [p];
    const body = `${p.set_intro ? `STUDY DESCRIPTION\n${p.set_intro}\n\n` : ""}${p.stimulus && p.stimulus.kind !== "none" && p.stimulus.kind !== "text" ? `DATA SHOWN: ${JSON.stringify(p.stimulus.data)}\n\n` : ""}${qs.map((q: Json, i: number) => `Q${i + 1}. ${p.set_intro ? "" : ""}${q.stem}\n${q.options.map((o: Json, j: number) => `[${j}] ${typeof o === "string" ? o : o.text}`).join("\n")}`).join("\n\n")}\n\nCall submit_answers (q is 1-based).`;
    for (const m of MODELS) reqs.push({ custom_id: `${m.includes("fable") ? "fa" : "so"}__${id}`, params: { model: m, thinking: m.includes("sonnet") ? { type: "between_tools" } : { type: "adaptive" }, output_config: { effort: "low" }, max_tokens: 3000, system: [{ type: "text", text: SYS }], tools: [tool], tool_choice: { type: "auto" }, messages: [{ role: "user", content: body }] } });
  } else {
    const body = `${p.set_intro}\n\nSTIMULUS: ${JSON.stringify(p.stimulus)}\n\nPARTS AND ANSWERS\n${JSON.stringify(p.parts.map((x: Json) => ({ label: x.label, points: x.points, prompt: x.prompt, model_answer: x.model_answer, rubric: x.rubric_rows.map((r: Json) => `${r.points}pt: ${r.criterion} | ${r.required_elements.join("; ")}`) })))}\n\nCall submit_review.`;
    reqs.push({ custom_id: `fr__${id}`, params: { model: MODELS[0], thinking: { type: "adaptive" }, output_config: { effort: "low" }, max_tokens: 4000, system: [{ type: "text", text: FSYS }], tools: [ftool], tool_choice: { type: "auto" }, messages: [{ role: "user", content: body }] } });
  }
}
(async () => {
  const est = reqs.reduce((a, r) => a + estimate(r.params.model, 1, 1200, 900), 0); const cap = Number(arg("--cap", "2.8"));
  const t = ledgerTotal(); console.log(`panel: ${reqs.length}건 추정 $${est.toFixed(2)} 누적 $${t.cumulativeUsd}`);
  if (est > cap) throw new Error(`추정 ${est} > 상한 ${cap}`);
  const res = await runBatch({ dir: DIR, name: "panel", requests: reqs, budgetUsd: ledger(DIR).spent() + cap, estimateUsd: est, sync: false });
  const flags: Record<string, string[]> = {};
  const add = (k: string, why: string) => { const key = keyOf.get(k)!; (flags[key] ??= []).push(why); };
  for (const it of items) {
    const id = String(it.stockKey).replace(/[^a-zA-Z0-9_-]/g, "_").slice(-60); const p = it.payload;
    if (it.kind === "mc") {
      const qs = Array.isArray(p.items) ? p.items : [p];
      for (const [pre, nm] of [["fa", "fable"], ["so", "sonnet"]] as const) {
        const r = res.get(`${pre}__${id}`); const inp = r ? (toolInput(r as never) as Json | null) : null;
        if (!inp) { add(id, `${nm}_missing`); continue; }
        qs.forEach((q: Json, i: number) => { const a = (inp.answers as Json[]).find((x) => x.q === i + 1); if (!a) add(id, `${nm}_q${i + 1}_missing`); else if (a.choice_index !== q.key_index) add(id, `${nm}_q${i + 1}_disagrees:${String(a.note).slice(0, 120)}`); else if (a.ambiguous) add(id, `${nm}_q${i + 1}_ambiguous:${String(a.note).slice(0, 120)}`); });
      }
    } else {
      const r = res.get(`fr__${id}`); const inp = r ? (toolInput(r as never) as Json | null) : null;
      if (!inp) add(id, "fable_frq_missing"); else for (const f of (inp.findings as Json[])) if (f.severity === "blocker") add(id, `frq_blocker:${f.where}:${String(f.issue).slice(0, 160)}`);
    }
  }
  writeFileSync(OUT, JSON.stringify(flags, null, 1)); console.log(`flagged ${Object.keys(flags).length}/${items.length}`, JSON.stringify(Object.values(flags).flat().map((x) => x.split(":")[0].replace(/\d+/g, "N")).reduce((m: Record<string, number>, k) => ((m[k] = (m[k] ?? 0) + 1), m), {})));
})();
