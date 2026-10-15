// US History Stage B 독립 검증(2026-10-15): 샘플 답안 3단계 × 독립 채점기 2(Opus, Sonnet) + 사실 점검(Fable, 시각 자료 이미지 첨부; 문서·프롬프트·증거 지도·루브릭·샘플·외부 증거 전부). DB 접근 없음.
// 예산: 이 스크립트 상한 CAP(USD), 누적 중단선 CUM_STOP. ANTHROPIC_API_KEY 는 환경 변수로만 받는다:
//   bash -c 'set -a; . ~/Developer/ALTON/.env.local; set +a; npx tsx scripts/ap-generation/ush-real-b-verify.ts [--only grade|fact]'
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { runBatch, toolInput, estimate, ledger, type BatchReq } from "../mock-exam-generation/batch-lib";
import { ledgerTotal } from "./ledger-total";
import * as P from "../../lib/ap-generation/ushistory-prompts";
import { frqTaskText, USH_RUBRIC_ROWS, USH_SAMPLE_BAND, type UshFrqPayload } from "../../lib/ap-generation/ushistory-frq";
import { tableMarkdown } from "../../lib/ap-generation/ushistory-gates";
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const MODELS = { graders: ["claude-opus-5-5", "claude-sonnet-5-5"], fact: "claude-fable-5-1" };
const CAP = 4.5; const CUM_STOP = 226; const DIR = "data/ap/sample-2027/ush-real-b"; const OUT = "data/ap/ush-sources/real-b-verification.json";
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : "";
const draft = JSON.parse(readFileSync("data/ap/ush-sources/real-b-draft.json", "utf-8")) as Json[];
const registry = new Map((JSON.parse(readFileSync("data/ap/ush-sources/registry.json", "utf-8")).sources as Json[]).map((s) => [s.id, s]));
const imgBlock = (id: string) => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: readFileSync(path.join("data/ap/ush-sources", registry.get(id)!.file)).toString("base64") } });
const FACT_SYS = `You are an independent fact-checker and test-design reviewer for an AP U.S. History DBQ (document-based question) built ENTIRELY from real historical sources: seven real documents with provenance are supplied (text excerpts cut by code from the repository text; tables copied from Census Bureau publications; the images of the visual documents are attached). Everything else (context lines, prompt, evidence map, document-use and sourcing notes, rubric text, outside-evidence list, facts, sample essays) was written by ALTON. Report ONLY genuine problems: (1) any statement in the ALTON-written context lines, doc-use or sourcing notes, evidence map, rubric text, outside-evidence list, facts list or sample essays that is historically inaccurate, anachronistic, unsupported by the document, or contested when presented as settled; (2) any description of what an image shows (the notes, the sample essays, the alt text) that does not match the attached image; (3) any claim about what a document says (quotes, numbers, comparisons) that is wrong; (4) design problems: a document that supports no defensible line of reasoning for the prompt, a prompt that cannot be answered with a defensible thesis from these documents, an evidence map that misstates how a document bears on a line of reasoning, or a lack of balance among perspectives; (5) a sample essay whose claims go beyond what its documents show. Also give a verdict per item: "sound", "fix" or "unsound". Use "where" values exactly: Doc1..Doc7, Prompt, EvidenceMap, Rubric, OutsideEvidence, Facts, SampleHigh, SampleMid, SampleLow. Do not flag style. Call submit_fact_check2.`;
const FACT_TOOL = { name: "submit_fact_check2", description: "Submit verdicts and flags.", input_schema: { type: "object", properties: { verdicts: { type: "array", items: { type: "object", properties: { where: { type: "string" }, verdict: { type: "string", enum: ["sound", "fix", "unsound"] }, note: { type: "string" } }, required: ["where", "verdict", "note"] } }, flags: { type: "array", items: { type: "object", properties: { where: { type: "string" }, kind: { type: "string", enum: ["inaccurate", "anachronism", "contested", "image_mismatch", "source_misread", "no_line_of_reasoning", "unanswerable", "unbalanced", "overclaims_documents", "other"] }, detail: { type: "string" } }, required: ["where", "kind", "detail"] } } }, required: ["verdicts", "flags"] } };
const think = (model: string) => ({ thinking: model.includes("sonnet") ? { type: "between_tools" } : { type: "adaptive" }, output_config: { effort: "medium" } });
const mk = (id: string, model: string, sys: string, tool: Json, content: Json[], max: number): BatchReq => ({ custom_id: id, params: { model, ...think(model), max_tokens: max, system: sys, tools: [tool], tool_choice: { type: "auto" }, messages: [{ role: "user", content }] } });
const rubricText = (p: UshFrqPayload) => p.rubric.rows.map((r) => `${r.name} (0-${r.max}): ${r.task_specific}\n${Object.entries(r.descriptors).sort().map(([k, v]) => `  ${k}: ${v}`).join("\n")}`).join("\n") + "\n" + p.rubric.scoring_notes.map((n) => `Note: ${n}`).join("\n");
const material = (p: UshFrqPayload) => p.sources.map((s) => `Document ${s.id} (${s.kind === "image" ? "image; description supplied because you cannot see it" : s.kind})\n${s.title}\n${s.attribution}\n${s.body ?? ""}${s.table ? "\n" + tableMarkdown(s.table) : ""}`).join("\n\n");
const median2 = (a: number[]) => { const s = a.slice().sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2); };
const BAD = /^(inaccurate|anachronism|contested|image_mismatch|source_misread|no_line_of_reasoning|unanswerable|unbalanced|overclaims_documents)$/;

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY 환경 변수가 필요합니다."); process.exit(3); }
  const t0 = ledgerTotal(); const spent0 = ledger(DIR).spent(); console.log(`start cumulative $${t0.cumulativeUsd}`);
  if (t0.cumulativeUsd >= CUM_STOP) { console.error(`누적 $${t0.cumulativeUsd} >= 중단 ${CUM_STOP}`); process.exit(4); }
  const budget = () => spent0 + CAP;
  const out: Json = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf-8")) : { models: MODELS, grades: {}, facts: {}, frq: {} };
  out.models = MODELS; const rows = USH_RUBRIC_ROWS.dbq;
  if (!only || only === "grade") {
    const reqs: BatchReq[] = [];
    draft.forEach((c, fi) => { const p = c.payload.ush_frq as UshFrqPayload; for (const s of p.samples) MODELS.graders.forEach((m, g) => reqs.push(mk(`grade-${fi}-${s.tier}-${g}`, m, P.GRADE_SYSTEMS[g % P.GRADE_SYSTEMS.length], P.GRADE_TOOL(rows), [{ type: "text", text: P.gradeUser(frqTaskText(p), material(p), rubricText(p), s.essay) }], 3500))); });
    const graded = await runBatch({ dir: DIR, name: "grade", requests: reqs, estimateUsd: MODELS.graders.reduce((a, m) => a + estimate(m, reqs.length / 2, 6500, 1500), 0), budgetUsd: budget(), sync: true });
    for (const [id, r] of graded) out.grades[id] = toolInput(r);
  }
  if (!only || only === "fact") {
    const freqs: BatchReq[] = [];
    draft.forEach((c, fi) => {
      const p = c.payload.ush_frq as UshFrqPayload; const ef = p.expected_features;
      const imgs = p.sources.filter((s) => s.kind === "image").flatMap((s) => [{ type: "text", text: `ATTACHED IMAGE for Document ${s.id}: ${s.title}` }, imgBlock(String(s.source_registry_id))]);
      const body = [`PROMPT\n${frqTaskText(p)}`, `DOCUMENTS (as shown to students, with registry provenance)\n${c.payload.set_intro}`, `IMAGE DESCRIPTIONS (alt text written by ALTON)\n${p.sources.filter((s) => s.kind === "image").map((s) => `Document ${s.id}: ${s.image!.alt}`).join("\n")}`,
        `THESIS SPACE (defensible theses)\n${(ef.defensible_theses ?? []).map((t) => `- ${t}`).join("\n")}`, `EVIDENCE MAP\n${(ef.evidence_map ?? []).map((l) => `- ${l.line} | supports: ${l.supports.join(",")} | complicates: ${l.complicates.join(",") || "-"}`).join("\n")}`,
        `DOCUMENT USES AND SOURCING NOTES\n${(ef.doc_uses ?? []).map((u) => `Doc ${u.source_id}: ${u.usable_for}\n   SOURCING: ${u.sourcing}`).join("\n")}`, `RUBRIC TASK-SPECIFIC TEXT\n${p.rubric.rows.map((r) => `${r.name}: ${r.task_specific}`).join("\n")}\n${p.rubric.scoring_notes.map((n) => `Note: ${n}`).join("\n")}`,
        `CONTEXTUALIZATION IDEAS\n${(ef.contextualization_ideas ?? []).map((t) => `- ${t}`).join("\n")}`, `OUTSIDE EVIDENCE LIST\n${(ef.outside_evidence ?? []).map((t) => `- ${t}`).join("\n")}`, `FACTS LIST\n${(ef.facts ?? []).map((t) => `- ${t}`).join("\n")}`,
        ...p.samples.map((s) => `SAMPLE ESSAY (${s.tier}; intended score ${s.target_total})\n${s.essay}`)].join("\n\n");
      freqs.push(mk(`fact-dbq-${fi}`, MODELS.fact, FACT_SYS, FACT_TOOL, [...imgs, { type: "text", text: body }], 5000));
    });
    const fact = await runBatch({ dir: DIR, name: "fact-dbq", requests: freqs, estimateUsd: estimate(MODELS.fact, freqs.length, 14000, 4500), budgetUsd: budget(), sync: true });
    for (const [id, r] of fact) out.facts[id] = toolInput(r);
  }
  // 합격 판정: 채점기 둘 다 대역 안, 중앙값 총점이 대역 안·단계 순서 엄격, 사실 점검 전부 sound·BAD 플래그 없음
  draft.forEach((c, fi) => {
    const p = c.payload.ush_frq as UshFrqPayload; const scores: Json = {}; const totals: Json = {}; const graderTotals: Json = {}; let ok = true; const why: string[] = [];
    for (const s of p.samples) {
      const gs = MODELS.graders.map((_, g) => out.grades[`grade-${fi}-${s.tier}-${g}`]).filter(Boolean) as Json[];
      const sc: Json = {}; for (const r of rows) sc[r.row_id] = Math.min(r.max, Math.max(0, median2(gs.map((x) => Number(x[r.row_id]))))); const tot = Object.values(sc).reduce((a: number, b) => a + Number(b), 0);
      const gt = gs.map((x) => rows.reduce((a, r) => a + Number(x[r.row_id] ?? 0), 0)); scores[s.tier] = sc; totals[s.tier] = tot; graderTotals[s.tier] = gt;
      const [lo, hi] = USH_SAMPLE_BAND.dbq[s.tier]; if (gs.length < MODELS.graders.length) { ok = false; why.push(`${s.tier}: missing grader`); }
      if (gt.some((t) => t < lo || t > hi) || tot < lo || tot > hi) { ok = false; why.push(`${s.tier}: grader totals ${gt.join("/")} median ${tot} outside ${lo}-${hi}`); }
    }
    if (!(totals.high > totals.mid && totals.mid > totals.low)) { ok = false; why.push("not strictly ordered"); }
    const f = out.facts[`fact-dbq-${fi}`] as Json | undefined; const flags = ((f?.flags as Json[]) ?? []).filter((x) => BAD.test(String(x.kind))); const vs = (f?.verdicts as Json[]) ?? [];
    if (!f) { ok = false; why.push("no fact check"); } if (flags.length) { ok = false; why.push(`${flags.length} flags`); } if (vs.some((v) => v.verdict !== "sound")) { ok = false; why.push("verdict not sound"); }
    out.frq[c.cellId] = { scores, totals, graderTotals, factVerdicts: f?.verdicts ?? null, flags: f?.flags ?? [], ok, why };
  });
  writeFileSync(OUT, JSON.stringify(out, null, 1));
  const t1 = ledgerTotal(); console.log(`end cumulative $${t1.cumulativeUsd} (delta $${(t1.cumulativeUsd - t0.cumulativeUsd).toFixed(4)}; cap $${CAP}, cumulative stop ${CUM_STOP})`);
  for (const [k, v] of Object.entries(out.frq as Json)) console.log(k, v.ok ? "ok" : "UNRESOLVED", "totals", JSON.stringify(v.totals), "graders", JSON.stringify(v.graderTotals), "flags", (v.flags ?? []).length, v.why?.join("; ") ?? "");
}
main().catch((e) => { console.error(e); process.exit(1); });
