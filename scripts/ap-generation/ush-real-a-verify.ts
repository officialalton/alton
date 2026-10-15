// US History Stage A 독립 검증(2026-10-15): MC 세트 블라인드 풀이(Opus, Sonnet; 선택지 순서 역순) + 사실 점검(Fable: 키·근거를 보여 줌) + SAQ 샘플 답안 독립 채점(Opus, Sonnet) + SAQ 사실 점검(Fable).
// DB 접근 없음. 예산: 이 스크립트 상한 CAP(USD), 누적 중단선 CUM_STOP. ANTHROPIC_API_KEY 는 환경 변수로만 받는다:
//   set -a; . ~/Developer/ALTON/.env.local; set +a; npx tsx scripts/ap-generation/ush-real-a-verify.ts [--only mc|saq]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { runBatch, toolInput, estimate, ledger, type BatchReq } from "../mock-exam-generation/batch-lib";
import { ledgerTotal } from "./ledger-total";
import * as P from "../../lib/ap-generation/ushistory-prompts";
import { frqTaskText, USH_RUBRIC_ROWS, type UshFrqPayload } from "../../lib/ap-generation/ushistory-frq";
import { tableMarkdown } from "../../lib/ap-generation/ushistory-gates";
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const MODELS = { solvers: ["claude-opus-5-5", "claude-sonnet-5-5"], graders: ["claude-opus-5-5", "claude-sonnet-5-5"], fact: "claude-fable-5-1" };
const CAP = 4.5; const CUM_STOP = 220; const DIR = "data/ap/sample-2027/ush-real-a"; const OUT = "data/ap/ush-sources/real-a-verification.json";
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : "";
const draft = JSON.parse(readFileSync("data/ap/ush-sources/real-a-draft.json", "utf-8")) as Json[];
const mc = draft.filter((c) => c.kind === "mc"); const frq = draft.filter((c) => c.kind === "frq_bundle");
const perm = (k: number) => (k === 0 ? [0, 1, 2, 3] : [3, 2, 1, 0]);
const SOLVE_SYS = "You answer AP U.S. History multiple-choice questions about a REAL historical source (a statistics table from the U.S. Census Bureau). Use the source together with your knowledge of U.S. history. Choose ONE best answer per question. Be honest: if a second option is also defensible, report it; if a question is flawed, inaccurate or ambiguous, say so and lower confidence. Call submit_answers once.";
const FACT_SYS = `You are an independent fact-checker for AP U.S. History practice material built FROM REAL historical sources (a real Census Bureau table is supplied; it is not fictional). You see the intended key and rationales. Report ONLY genuine problems: (1) any historical statement in the stem, options, key rationale or distractor rationale that is inaccurate, anachronistic or contested; (2) a key that the source plus standard knowledge does not clearly support as the single best answer; a distractor that is actually defensible; (3) any claim about what the table shows (numbers, comparisons, percentages) that you can check and that is wrong; (4) in FRQ material: acceptable answers, rubric elements or sample responses that are historically wrong. Also set verdict per question or part: "sound", "fix" or "unsound". Do not flag style. Call submit_fact_check2.`;
const FACT_TOOL = { name: "submit_fact_check2", description: "Submit verdicts and flags.", input_schema: { type: "object", properties: { verdicts: { type: "array", items: { type: "object", properties: { where: { type: "string" }, verdict: { type: "string", enum: ["sound", "fix", "unsound"] }, note: { type: "string" } }, required: ["where", "verdict", "note"] } }, flags: { type: "array", items: { type: "object", properties: { where: { type: "string" }, kind: { type: "string", enum: ["inaccurate", "anachronism", "contested", "ambiguous_key", "second_defensible", "source_misread", "other"] }, detail: { type: "string" } }, required: ["where", "kind", "detail"] } } }, required: ["verdicts", "flags"] } };
const think = (model: string) => ({ thinking: model.includes("sonnet") ? { type: "between_tools" } : { type: "adaptive" }, output_config: { effort: "medium" } });
const mk = (id: string, model: string, sys: string, tool: Json, content: Json[], max: number): BatchReq => ({ custom_id: id, params: { model, ...think(model), max_tokens: max, system: sys, tools: [tool], tool_choice: { type: "auto" }, messages: [{ role: "user", content }] } });
const tableText = (p: Json) => (p.stimulus?.data?.rows ? "\n\n" + [p.stimulus.data.columns.join(" | "), ...p.stimulus.data.rows.map((r: string[]) => r.join(" | "))].join("\n") : "");
const sourceText = (p: Json) => String(p.set_intro) + tableText(p);
const rubricText = (p: UshFrqPayload) => p.rubric.rows.map((r) => `${r.name} (0-${r.max}): ${r.task_specific}\n${Object.entries(r.descriptors).sort().map(([k, v]) => `  ${k}: ${v}`).join("\n")}`).join("\n") + "\n" + p.rubric.scoring_notes.map((n) => `Note: ${n}`).join("\n");
const frqMaterial = (p: UshFrqPayload) => p.sources.map((s) => `Source ${s.id} (${s.kind})\n${s.title}\n${s.attribution}\n${s.body ?? ""}${s.table ? "\n" + tableMarkdown(s.table) : ""}`).join("\n\n");
const median2 = (a: number[]) => { const s = a.slice().sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2); };
const BAD = /^(inaccurate|anachronism|contested|ambiguous_key|second_defensible|source_misread)$/;

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY 환경 변수가 필요합니다."); process.exit(3); }
  const t0 = ledgerTotal(); const spent0 = ledger(DIR).spent(); console.log(`start cumulative $${t0.cumulativeUsd}`);
  if (t0.cumulativeUsd >= CUM_STOP) { console.error(`누적 $${t0.cumulativeUsd} >= 중단 ${CUM_STOP}`); process.exit(4); }
  const budget = () => spent0 + CAP;
  const out: Json = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf-8")) : { models: MODELS, solve: {}, fact: {}, items: {}, frq: {}, grades: {} };
  out.models = MODELS;
  // ── MC 블라인드 풀이 ──
  if (!only || only === "mc") {
    const reqs: BatchReq[] = []; const meta: { id: string; si: number; k: number }[] = [];
    mc.forEach((c, si) => { const items = c.payload.items as Json[]; MODELS.solvers.forEach((m, k) => { const p = perm(k); const q = items.map((it, i) => `${i + 1}. ${it.stem}\n${p.map((j, n) => `   [${n}] ${it.options[j].text}`).join("\n")}`).join("\n\n"); const id = `solve-${si}-${k}`; reqs.push(mk(id, m, SOLVE_SYS, P.SOLVER_TOOL, [{ type: "text", text: `STIMULUS\n${sourceText(c.payload)}\n\nQUESTIONS\n${q}\n\nAnswer with the 0-based index shown in brackets. Call submit_answers.` }], 12000)); meta.push({ id, si, k }); }); });
    const solved = await runBatch({ dir: DIR, name: "solve", requests: reqs, estimateUsd: MODELS.solvers.reduce((a, m) => a + estimate(m, mc.length, 3000, 3000), 0), budgetUsd: budget(), sync: true });
    for (const m of meta) { const r = solved.get(m.id); const inp = r ? toolInput(r) : null; out.solve[m.id] = ((inp?.answers as Json[]) ?? []).map((a) => ({ q: a.question, choice: perm(m.k)[Number(a.choice)], confidence: a.confidence, also: a.also_defensible ?? null, note: a.note ?? null })); }
    const freqs: BatchReq[] = [];
    mc.forEach((c, si) => { const items = c.payload.items as Json[]; const txt = items.map((it, i) => `Q${i + 1} (skill ${it.skill}, topic ${it.topic}) ${it.stem}\n${it.options.map((o: Json, j: number) => `  [${j}]${j === it.key_index ? " (KEY)" : ""} ${o.text}\n      rationale: ${o.why}`).join("\n")}`).join("\n\n"); freqs.push(mk(`fact-mc-${si}`, MODELS.fact, FACT_SYS, FACT_TOOL, [{ type: "text", text: `SOURCE (real)\n${sourceText(c.payload)}\n\nQUESTIONS WITH INTENDED KEY AND RATIONALES\n${txt}\n\nVerdict per question (where = "Q1".."Q${items.length}"). Call submit_fact_check2.` }], 9000)); });
    const fact = await runBatch({ dir: DIR, name: "fact-mc", requests: freqs, estimateUsd: estimate(MODELS.fact, freqs.length, 3000, 3500), budgetUsd: budget(), sync: true });
    for (const [id, r] of fact) out.fact[id] = toolInput(r);
    mc.forEach((c, si) => (c.payload.items as Json[]).forEach((it, i) => {
      const votes = MODELS.solvers.map((_, k) => (out.solve[`solve-${si}-${k}`] as Json[]).find((a) => a.q === i + 1)); const agree = votes.every((v) => v && v.choice === it.key_index);
      const f = out.fact[`fact-mc-${si}`] as Json | null; const verdict = (f?.verdicts as Json[] | undefined)?.find((v) => String(v.where).toUpperCase() === `Q${i + 1}`)?.verdict ?? "missing"; const flags = ((f?.flags as Json[]) ?? []).filter((x) => String(x.where).toUpperCase().startsWith(`Q${i + 1}`) && BAD.test(String(x.kind)));
      out.items[`${c.cellId}#${i + 1}`] = { keyIndex: it.key_index, solverChoices: votes.map((v) => v?.choice ?? null), solverConfidence: votes.map((v) => v?.confidence ?? null), factVerdict: verdict, flags, status: agree && verdict === "sound" && !flags.length ? "verified" : "unresolved" };
    }));
  }
  // ── SAQ: 샘플 채점 + 사실 점검 ──
  if (!only || only === "saq") {
    const rows = USH_RUBRIC_ROWS.saq; const reqs: BatchReq[] = [];
    frq.forEach((c, fi) => { const p = c.payload.ush_frq as UshFrqPayload; for (const s of p.samples) MODELS.graders.forEach((m, g) => reqs.push(mk(`grade-${fi}-${s.tier}-${g}`, m, P.GRADE_SYSTEMS[g % P.GRADE_SYSTEMS.length], P.GRADE_TOOL(rows), [{ type: "text", text: P.gradeUser(frqTaskText(p), frqMaterial(p), rubricText(p), s.essay) }], 3500))); });
    const graded = await runBatch({ dir: DIR, name: "grade", requests: reqs, estimateUsd: MODELS.graders.reduce((a, m) => a + estimate(m, reqs.length / 2, 3800, 1500), 0), budgetUsd: budget(), sync: true });
    const freqs: BatchReq[] = [];
    frq.forEach((c, fi) => { const p = c.payload.ush_frq as UshFrqPayload; const body = [`TASK\n${frqTaskText(p)}`, `SOURCE (real)\n${c.payload.set_intro}${tableText(c.payload)}`, "ACCEPTABLE ANSWERS AND RUBRIC CRITERIA", ...p.prompt.parts!.map((x) => `Part ${x.label} criterion: ${p.rubric.rows.find((r) => r.row_id === x.label.toLowerCase())!.task_specific}\n  acceptable answers:\n${(p.expected_features.saq_answers![x.label.toLowerCase()] ?? []).map((a) => `   - ${a}`).join("\n")}`), "SAMPLE STUDENT RESPONSES (weakness may be vagueness; historical claims in them should still be accurate)", ...p.samples.map((s) => `[${s.tier}]\n${s.essay}`)].join("\n\n"); freqs.push(mk(`fact-frq-${fi}`, MODELS.fact, FACT_SYS, FACT_TOOL, [{ type: "text", text: `${body}\n\nVerdict per part (where = "A","B","C") and for "samples". Call submit_fact_check2.` }], 9000)); });
    const fact = await runBatch({ dir: DIR, name: "fact-frq", requests: freqs, estimateUsd: estimate(MODELS.fact, freqs.length, 4500, 3500), budgetUsd: budget(), sync: true });
    frq.forEach((c, fi) => {
      const p = c.payload.ush_frq as UshFrqPayload; const scores: Json = {}; const totals: Json = {}; const graderTotals: Json = {}; let ok = true;
      for (const s of p.samples) {
        const gs = MODELS.graders.map((_, g) => graded.get(`grade-${fi}-${s.tier}-${g}`)).map((r) => (r ? toolInput(r) : null)).filter(Boolean) as Json[];
        const sc: Json = {}; for (const r of rows) sc[r.row_id] = Math.min(r.max, Math.max(0, median2(gs.map((x) => Number(x[r.row_id]))))); const tot = Object.values(sc).reduce((a: number, b) => a + Number(b), 0);
        const gt = gs.map((x) => rows.reduce((a, r) => a + Number(x[r.row_id] ?? 0), 0)); scores[s.tier] = sc; totals[s.tier] = tot; graderTotals[s.tier] = gt;
        const target = { high: 3, mid: 2, low: 1 }[s.tier]; if (gs.length < MODELS.graders.length || tot !== target || Math.max(...gt) - Math.min(...gt) > 1) ok = false;
      }
      const f = toolInput(fact.get(`fact-frq-${fi}`)!) as Json | null; const flags = ((f?.flags as Json[]) ?? []).filter((x) => BAD.test(String(x.kind))); if (flags.length || !f) ok = false;
      if (((f?.verdicts as Json[]) ?? []).some((v) => v.verdict !== "sound")) ok = false;
      out.frq[c.cellId] = { scores, totals, graderTotals, factVerdicts: f?.verdicts ?? null, flags: f?.flags ?? [], ok };
    });
  }
  writeFileSync(OUT, JSON.stringify(out, null, 1));
  const t1 = ledgerTotal(); console.log(`end cumulative $${t1.cumulativeUsd} (delta $${(t1.cumulativeUsd - t0.cumulativeUsd).toFixed(4)}; cap $${CAP}, cumulative stop ${CUM_STOP})`);
  for (const [k, v] of Object.entries(out.items as Json)) console.log(k, v.status, "key", v.keyIndex, "solvers", JSON.stringify(v.solverChoices), (v.solverConfidence ?? []).join("/"), "fact", v.factVerdict, "flags", v.flags.length);
  for (const [k, v] of Object.entries(out.frq as Json)) console.log(k, v.ok ? "ok" : "UNRESOLVED", "totals", JSON.stringify(v.totals), "graders", JSON.stringify(v.graderTotals), "flags", (v.flags ?? []).length);
}
main().catch((e) => { console.error(e); process.exit(1); });
