// EL1/EL2 독립 검수(2026-10-14): 키를 숨긴 적대적 풀이(MC 22세트) + FRQ 샘플 맹검 채점(18편).
// 실행: set -a; . ~/Developer/ALTON/.env.local; set +a; npx tsx scripts/ap-generation/el-review-run.ts [mc|frq]
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runBatch, toolInput, estimate, ledger, type BatchReq } from "../mock-exam-generation/batch-lib";
import { ledgerTotal } from "./ledger-total";
import { passageDisplay } from "../../lib/ap-generation/englang-gates";
import { frqPassageDisplay, frqTaskText, type ElFrqPayload } from "../../lib/ap-generation/englang-frq";

const DIR = path.resolve("data/ap/sample-2027/englang-review");
const OUT = path.resolve("data/audit/el-review-raw");
const stock: Record<string, any> = {};
for (const f of readdirSync("data/ap/stock").filter((x) => /^el-.*-items\.json$/.test(x))) for (const it of JSON.parse(readFileSync(path.join("data/ap/stock", f), "utf-8"))) stock[it.stockKey] = it;
const assign = JSON.parse(readFileSync("data/ap/stock/exact-assign-el-el1-el2.json", "utf-8")).sets as { id: string; mcA: string[]; frqA: string[] }[];
const mode = process.argv[2] ?? "mc";
const HARD = 185; // 누적 $190 도달 전 안전 마진
const guard = (est: number) => { const t = ledgerTotal(); if (t.cumulativeUsd + est >= HARD) throw new Error(`HARD STOP cumulative ${t.cumulativeUsd} + est ${est} >= ${HARD}`); console.log(`cumulative ${t.cumulativeUsd}; est ${est.toFixed(2)}`); };

const MC_TOOL = { name: "submit_review", description: "Submit the review.", input_schema: { type: "object", properties: {
  passage_flags: { type: "array", items: { type: "string" }, description: "Passage-level problems: factual/historical error, internal inconsistency, offensive or biased content, resemblance to a famous real text, unclear rhetorical situation, unnatural register. Empty if none." },
  questions: { type: "array", items: { type: "object", properties: {
    q: { type: "integer" }, best: { type: "integer", description: "0-based index of the single best option" },
    defensible: { type: "array", items: { type: "integer" }, description: "ALL 0-based options that a careful AP English teacher could defend as correct (include best)" },
    clarity: { type: "string", enum: ["clear", "narrow", "ambiguous", "flawed"], description: "clear: one option clearly best; narrow: best wins by a small margin; ambiguous: two options equally defensible; flawed: no option or a stem/option defect makes it unanswerable" },
    flaws: { type: "array", items: { type: "string" }, description: "Concrete defects: second defensible answer, stem ambiguity, needs outside knowledge, answerable without passage, factual error, grammar/usage error in an option, length or pattern giveaway, non-parallel options, wrong sentence/paragraph reference" },
    reasoning: { type: "string" } }, required: ["q", "best", "defensible", "clarity", "flaws", "reasoning"] } } }, required: ["passage_flags", "questions"] } };
const MC_SYS = `You are a hostile external reviewer commissioned to find defective items in a set of AP English Language and Composition practice questions before they ship to students. You are NOT told which option the author keyed. For every question: solve it from the passage, then actively search for a SECOND defensible answer, a stem that is ambiguous or misreferenced, a distractor that is actually true, an option with a grammar or usage error, or a giveaway (longest option, pattern). For writing (revision) questions, check each option for grammar, concision, tone and whether it satisfies EVERY condition of the stem. Be calibrated: rate "clear" when one option is plainly best even if a distractor is partly plausible; reserve "ambiguous" for cases where an expert panel would split. Also review the passage itself. Call submit_review once.`;
const FRQ_TOOL = { name: "submit_score", description: "Submit the score.", input_schema: { type: "object", properties: { thesis_A: { type: "integer" }, evidence_commentary_B: { type: "integer" }, sophistication_C: { type: "integer" }, total: { type: "integer" }, rationale: { type: "string" } }, required: ["thesis_A", "evidence_commentary_B", "sophistication_C", "total", "rationale"] } };
const FRQ_SYS = `You are an experienced AP English Language and Composition exam reader. Score the student essay holistically against the three-row 6-point analytic rubric: Row A Thesis 0-1; Row B Evidence and commentary 0-4; Row C Sophistication 0-1. Apply the usual conservative reader conventions (a thesis that merely restates the prompt earns 0; evidence without commentary caps Row B; sophistication is awarded rarely and only for sustained, not isolated, nuance). Score only what is on the page. Call submit_score once.`;

function mcReqs(verify = false): BatchReq[] {
  const r: BatchReq[] = [];
  const merged = verify ? (JSON.parse(readFileSync("data/audit/el-review-merged-mc.json", "utf-8")) as Record<string, any>) : {};
  for (const s of assign) for (const k of s.mcA) {
    const p = verify ? { ...stock[k].payload, items: merged[k].items } : stock[k].payload; const ps = p.el_passage; const disp = passageDisplay({ kind: ps.kind, title: ps.title, paragraphs: ps.paragraphs, provenance: p.provenance });
    const user = `PASSAGE\n${disp}\n\nQUESTIONS\n${p.items.map((it: any, i: number) => `${i + 1}. ${it.stem}\n${it.options.map((o: any, j: number) => `   [${j}] ${o.text}`).join("\n")}`).join("\n\n")}\n\nCall submit_review.`;
    for (const model of verify ? ["claude-opus-5-5"] : ["claude-opus-5-5", "claude-fable-5-1"]) r.push({ custom_id: `${model.includes("opus") ? "opus" : "fable"}__${k.replace(/[^a-zA-Z0-9]/g, "_").slice(-48)}`, params: { model, thinking: { type: "adaptive" }, output_config: { effort: "high" }, max_tokens: 16000, system: [{ type: "text", text: MC_SYS }], tools: [MC_TOOL], tool_choice: { type: "auto" }, messages: [{ role: "user", content: user }] } });
  }
  return r;
}
function frqReqs(fixed = false): BatchReq[] {
  const r: BatchReq[] = [];
  const fx: Record<string, any> = {}; if (fixed) for (const c of JSON.parse(readFileSync("data/audit/el-review-fix-items.json", "utf-8")) as any[]) fx[c.stockKey] = c;
  for (const s of assign) for (const k of s.frqA) {
    if (fixed && !fx[`el-review-fix:${stock[k].candidateKey}`]) continue;
    const e: ElFrqPayload = fixed ? fx[`el-review-fix:${stock[k].candidateKey}`].payload.el_frq : stock[k].payload.el_frq; const disp = frqPassageDisplay(e); const task = frqTaskText(e);
    for (const sm of e.samples) {
      const user = `ESSAY TASK\n${task}\n\nSOURCES / PASSAGE\n${disp}\n\nSTUDENT ESSAY\n${sm.essay}\n\nCall submit_score.`;
      r.push({ custom_id: `${k.replace(/[^a-zA-Z0-9]/g, "_").slice(-48)}__${sm.tier}`, params: { model: "claude-opus-5-5", thinking: { type: "adaptive" }, output_config: { effort: "high" }, max_tokens: 12000, system: [{ type: "text", text: FRQ_SYS }], tools: [FRQ_TOOL], tool_choice: { type: "auto" }, messages: [{ role: "user", content: user }] } });
    }
  }
  return r;
}
const FRQR_TOOL = { name: "submit_frq_review", description: "Submit the FRQ package review.", input_schema: { type: "object", properties: { findings: { type: "array", items: { type: "object", properties: { where: { type: "string", description: "prompt | source X | rubric | sample high/mid/low | annotation | expected_features" }, severity: { type: "string", enum: ["blocker", "major", "minor", "nit"] }, issue: { type: "string" }, evidence: { type: "string", description: "Quote the exact text and, for numbers, show the arithmetic" }, fix: { type: "string" } }, required: ["where", "severity", "issue", "evidence"] } }, verdict: { type: "string" } }, required: ["findings", "verdict"] } };
const FRQR_SYS = `You are a hostile QA reviewer of an AP English Language and Composition free-response package (prompt, sources, rubric, and three sample essays with annotations) built for a private tutoring company. Find real defects: (1) numeric or factual inconsistencies between sources, table, chart, prompt and samples (recompute every figure a sample quotes or derives); (2) sources that quote or contradict each other; (3) prompt flaws: ambiguity, leaking the answer, task not matching the sources, wrong source count or labeling; (4) rubric problems: a descriptor that cannot be applied, contradictions with the exam's published 6-point structure; (5) samples that misquote a source, misstate a figure, or whose annotation contradicts its score; (6) content that is offensive, biased, or too close to a real famous text. Do NOT invent defects: report only what you can support with quoted text or arithmetic, and rate severity honestly. Call submit_frq_review once.`;
function frqReviewReqs(): BatchReq[] {
  const r: BatchReq[] = [];
  for (const s of assign) for (const k of s.frqA) {
    const e: ElFrqPayload = stock[k].payload.el_frq;
    const user = `TASK TYPE: ${e.task_type}\nTITLE: ${e.title}\n\nESSAY TASK (student sees)\n${frqTaskText(e)}\n\nSOURCES / PASSAGE (student sees)\n${frqPassageDisplay(e)}\n\nRUBRIC ROWS\n${JSON.stringify(e.rubric.rows.map((x) => ({ row: x.row_id, name: x.name, max: x.max, task_specific: x.task_specific })))}\n\nSAMPLES\n${e.samples.map((sm) => `## ${sm.tier} (target ${sm.target_total}; scores ${JSON.stringify(sm.rubric_scores)})\n${sm.essay}\nANNOTATIONS: ${JSON.stringify(sm.annotations)}`).join("\n\n")}\n\nCall submit_frq_review.`;
    r.push({ custom_id: `fq__${k.replace(/[^a-zA-Z0-9]/g, "_").slice(-48)}`, params: { model: "claude-fable-5-1", thinking: { type: "adaptive" }, output_config: { effort: "high" }, max_tokens: 16000, system: [{ type: "text", text: FRQR_SYS }], tools: [FRQR_TOOL], tool_choice: { type: "auto" }, messages: [{ role: "user", content: user }] } });
  }
  return r;
}
(async () => {
  const reqs = mode === "frqreview" ? frqReviewReqs() : mode === "mc" ? mcReqs() : mode === "verify" ? mcReqs(true) : frqReqs(mode === "frqfix");
  const est = mode === "frqreview" ? estimate("claude-fable-5-1", reqs.length, 9000, 9000) : mode === "verify" ? estimate("claude-opus-5-5", reqs.length, 3500, 8000) : mode === "mc" ? estimate("claude-opus-5-5", reqs.length / 2, 3500, 9000) + estimate("claude-fable-5-1", reqs.length / 2, 3500, 9000) : estimate("claude-opus-5-5", reqs.length, 7000, 7000);
  guard(est);
  const sync = process.env.EL_SYNC === "1";
  const got = await runBatch({ dir: DIR, name: mode, requests: reqs, budgetUsd: ledger(DIR).spent() + 14, estimateUsd: est, sync, syncConcurrency: 6, pollMs: 20000 });
  const out: Record<string, unknown> = {}; let miss = 0;
  for (const rq of reqs) { const g = got.get(rq.custom_id); const t = g ? toolInput(g) : null; if (!t) miss++; out[rq.custom_id] = t; (out as any)["_key_" + rq.custom_id] = rq.custom_id; }
  writeFileSync(`${OUT}-${mode}.json`, JSON.stringify(out, null, 1)); console.log(`done ${reqs.length - miss}/${reqs.length}`); const t = ledgerTotal(); console.log(`cumulative ${t.cumulativeUsd}`);
})();
