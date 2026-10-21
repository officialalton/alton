// US History Stage G 독립 검증(2026-10-21, US3 MC 14세트): 블라인드 풀이(Opus, Sonnet; 선택지 순서 역순) + 사실 점검(Fable: 키·근거를 보여 줌). DB 접근 없음.
// 예산: 이 스크립트 상한 CAP(USD), 누적 중단선 CUM_STOP(= 작업 시작 장부 + 오너 승인 MC 상한). ANTHROPIC_API_KEY 는 환경 변수로만 받는다:
//   npx tsx --env-file=.env.local scripts/ap-generation/ush-real-g-verify.ts [--only <cellId 정규식>]   (USH_ROUND=n 이면 재검증 회차 표지)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { runBatch, toolInput, estimate, ledger, type BatchReq } from "../mock-exam-generation/batch-lib";
import { ledgerTotal } from "./ledger-total";
import * as P from "../../lib/ap-generation/ushistory-prompts";
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const MODELS = { solvers: ["claude-opus-5-5", "claude-sonnet-5-5"], fact: "claude-fable-5-1" };
const CAP = Number(process.env.USH_CAP ?? 4.5); const CUM_STOP = Number(process.env.USH_CUM_STOP ?? 513); const DIR = "data/ap/sample-2027/ush-real-g"; const OUT = "data/ap/ush-sources/real-g-verification.json";
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : "";
const R = process.env.USH_ROUND ? `-r${process.env.USH_ROUND}` : "";
const draft = (JSON.parse(readFileSync("data/ap/ush-sources/real-g-draft.json", "utf-8")) as Json[]).filter((c) => !only || new RegExp(only).test(c.cellId));
const perm = (k: number) => (k === 0 ? [0, 1, 2, 3] : [3, 2, 1, 0]);
const SOLVE_SYS = "You answer AP U.S. History multiple-choice questions about a REAL historical source (a primary or secondary text excerpt, a pair of text excerpts, or a statistics table). Use the source together with your knowledge of U.S. history. Choose ONE best answer per question. Be honest: if a second option is also defensible, report it; if a question is flawed, inaccurate or ambiguous, say so and lower confidence. Call submit_answers once.";
const FACT_SYS = `You are an independent fact-checker for AP U.S. History practice material built FROM REAL historical sources (a real text excerpt, pair of excerpts or census table is supplied; it is not fictional). You see the intended key and rationales. Report ONLY genuine problems: (1) any historical statement in the stem, options, key rationale or distractor rationale that is inaccurate, anachronistic or contested; (2) a key that the source plus standard knowledge does not clearly support as the single best answer, or a distractor that is actually defensible; (3) any claim about what the source says or shows (quotes, numbers, comparisons) that you can check and that is wrong, including the ALTON-written context line shown with the source. Also set verdict per question: "sound", "fix" or "unsound". Do not flag style. Call submit_fact_check2.`;
const FACT_TOOL = { name: "submit_fact_check2", description: "Submit verdicts and flags.", input_schema: { type: "object", properties: { verdicts: { type: "array", items: { type: "object", properties: { where: { type: "string" }, verdict: { type: "string", enum: ["sound", "fix", "unsound"] }, note: { type: "string" } }, required: ["where", "verdict", "note"] } }, flags: { type: "array", items: { type: "object", properties: { where: { type: "string" }, kind: { type: "string", enum: ["inaccurate", "anachronism", "contested", "ambiguous_key", "second_defensible", "source_misread", "other"] }, detail: { type: "string" } }, required: ["where", "kind", "detail"] } } }, required: ["verdicts", "flags"] } };
const think = (model: string) => ({ thinking: model.includes("sonnet") ? { type: "between_tools" } : { type: "adaptive" }, output_config: { effort: "medium" } });
const mk = (id: string, model: string, sys: string, tool: Json, content: Json[], max: number): BatchReq => ({ custom_id: id, params: { model, ...think(model), max_tokens: max, system: sys, tools: [tool], tool_choice: { type: "auto" }, messages: [{ role: "user", content }] } });
const tableText = (p: Json) => (p.stimulus?.kind === "table" ? "\n\n" + [p.stimulus.data.columns.join(" | "), ...p.stimulus.data.rows.map((r: string[]) => r.join(" | "))].join("\n") : "");
const sourceText = (p: Json) => String(p.set_intro) + tableText(p);
const BAD = /^(inaccurate|anachronism|contested|ambiguous_key|second_defensible|source_misread)$/;

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY 환경 변수가 필요합니다."); process.exit(3); }
  const t0 = ledgerTotal(); const spent0 = ledger(DIR).spent(); console.log(`start cumulative $${t0.cumulativeUsd}`);
  if (t0.cumulativeUsd >= CUM_STOP) { console.error(`누적 $${t0.cumulativeUsd} >= 중단 ${CUM_STOP}`); process.exit(4); }
  const budget = () => spent0 + CAP;
  const out: Json = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf-8")) : { models: MODELS, solve: {}, fact: {}, items: {} };
  out.models = MODELS;
  const reqs: BatchReq[] = []; const meta: { id: string; c: Json; k: number }[] = [];
  draft.forEach((c) => { const items = c.payload.items as Json[]; MODELS.solvers.forEach((m, k) => { const p = perm(k); const q = items.map((it, i) => `${i + 1}. ${it.stem}\n${p.map((j, n) => `   [${n}] ${it.options[j].text}`).join("\n")}`).join("\n\n"); const id = `solve-${c.cellId}-${k}${R}`;
    reqs.push(mk(id, m, SOLVE_SYS, P.SOLVER_TOOL, [{ type: "text", text: `STIMULUS\n${sourceText(c.payload)}\n\nQUESTIONS\n${q}\n\nAnswer with the 0-based index shown in brackets. Call submit_answers.` }], 12000)); meta.push({ id, c, k }); }); });
  const solved = await runBatch({ dir: DIR, name: "solve", requests: reqs, estimateUsd: MODELS.solvers.reduce((a, m) => a + estimate(m, draft.length, 3500, 3000), 0), budgetUsd: budget(), sync: true });
  for (const m of meta) { const r = solved.get(m.id); const inp = r ? toolInput(r) : null; out.solve[m.id] = ((inp?.answers as Json[]) ?? []).map((a) => ({ q: a.question, choice: perm(m.k)[Number(a.choice)], confidence: a.confidence, also: a.also_defensible == null ? null : perm(m.k)[Number(a.also_defensible)], note: a.reasoning ?? null })); }
  const freqs: BatchReq[] = [];
  draft.forEach((c) => { const items = c.payload.items as Json[]; const txt = items.map((it, i) => `Q${i + 1} (skill ${it.skill}, topic ${it.topic}) ${it.stem}\n${it.options.map((o: Json, j: number) => `  [${j}]${j === it.key_index ? " (KEY)" : ""} ${o.text}\n      rationale: ${o.why}`).join("\n")}\n  evidence the designer cites in the source: ${it.design.key_evidence_in_source}`).join("\n\n");
    freqs.push(mk(`fact-${c.cellId}${R}`, MODELS.fact, FACT_SYS, FACT_TOOL, [{ type: "text", text: `SOURCE (real)\n${sourceText(c.payload)}\n\nQUESTIONS WITH INTENDED KEY AND RATIONALES\n${txt}\n\nVerdict per question (where = "Q1".."Q${items.length}"). Call submit_fact_check2.` }], 9000)); });
  const fact = await runBatch({ dir: DIR, name: "fact", requests: freqs, estimateUsd: estimate(MODELS.fact, freqs.length, 4500, 3500), budgetUsd: budget(), sync: true });
  for (const [id, r] of fact) out.fact[id] = toolInput(r);
  draft.forEach((c) => (c.payload.items as Json[]).forEach((it, i) => {
    const votes = MODELS.solvers.map((_, k) => (out.solve[`solve-${c.cellId}-${k}${R}`] as Json[] | undefined)?.find((a) => a.q === i + 1)); const agree = votes.every((v) => v && v.choice === it.key_index);
    const alsoBad = votes.some((v) => v && v.also !== null && v.also !== it.key_index && Number(v.confidence ?? 1) < 1 && false);
    const f = out.fact[`fact-${c.cellId}${R}`] as Json | null; const fv = ((f?.verdicts as Json[] | undefined) ?? []).find((v) => String(v.where).toUpperCase() === `Q${i + 1}`); const verdict = fv?.verdict ?? "missing";
    const flags = ((f?.flags as Json[]) ?? []).filter((x) => String(x.where).toUpperCase().startsWith(`Q${i + 1}`) && BAD.test(String(x.kind)));
    out.items[`${c.cellId}#${i + 1}`] = { keyIndex: it.key_index, solverChoices: votes.map((v) => v?.choice ?? null), solverConfidence: votes.map((v) => v?.confidence ?? null), solverAlso: votes.map((v) => v?.also ?? null), factVerdict: verdict, factNote: fv?.note ?? null, flags, status: agree && verdict === "sound" && !flags.length && !alsoBad ? "verified" : "unresolved" };
  }));
  writeFileSync(OUT, JSON.stringify(out, null, 1));
  const t1 = ledgerTotal(); console.log(`end cumulative $${t1.cumulativeUsd} (delta $${(t1.cumulativeUsd - t0.cumulativeUsd).toFixed(4)}; cap $${CAP}, cumulative stop ${CUM_STOP})`);
  for (const [k, v] of Object.entries(out.items as Json)) if (!only || new RegExp(only).test(k)) console.log(k, v.status, "key", v.keyIndex, "solvers", JSON.stringify(v.solverChoices), (v.solverConfidence ?? []).join("/"), "also", JSON.stringify(v.solverAlso), "fact", v.factVerdict, "flags", v.flags.length);
}
main().catch((e) => { console.error(e); process.exit(1); });
