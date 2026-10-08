// AP 샘플 생성·자동 검수 파이프라인(2026-10-08, 총괄 승인: 안 B, 비용 상한 $80).
//   npx tsx scripts/ap-generation/pipeline.ts <stage> [--limit N] [--sync] [--run run1] [--only ap_biology]
// 단계: gen → check(로컬 결정적 검증) → solve(Opus, 키 비공개) → review(Sonnet, 5기준) → difficulty(Sonnet, 별도) → spot(Fable, 상위 10%) → decide → report
// 모든 후보는 초안 파일(data/ap/sample-2027/<run>/)에만 남는다. 학생 비노출, DB 접근 없음. 호출 장부는 data/ap/sample-2027/ledger.json.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { runBatch, toolInput, estimate, ledger, type BatchReq } from "../mock-exam-generation/batch-lib";
import type { Cell } from "./cells";
import { MODELS, subjectPrompt, toolFor, userPrompt, think } from "./prompts";
import type { ApCurriculumFile } from "../../lib/ap-curriculum/types";
import { loadEnvLocal } from "../keywords/db";

loadEnvLocal();
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const stage = process.argv[2];
const RUN = arg("--run") ?? "run1";
const LIMIT = arg("--limit") ? Number(arg("--limit")) : undefined;
const ONLY = arg("--only");
const SYNC = process.argv.includes("--sync");
const BUDGET = 80; // 총괄 승인 상한(USD) — 누적이 넘으면 중단
const ROOT = path.resolve(process.cwd(), "data/ap/sample-2027");
const DIR = path.join(ROOT, RUN);
mkdirSync(DIR, { recursive: true });
const PY = process.env.AP_PY ?? "/private/tmp/claude-501/-Users-jangjiman-Developer-ALTON/d05b2ffe-5d6e-4058-a909-5e3b8827cbe2/scratchpad/apvenv/bin/python";
const SYS_CACHE = { type: "ephemeral", ttl: "1h" };

type Json = Record<string, unknown>;
type Cand = { key: string; cellId: string; subject: string; kind: "mc" | "frq_bundle"; structure: Cell["structure"]; unitCode: string; keywordCode: string; skill: string; idx: number; payload: Json | null; genCost: number };
const OPTION_COUNT: Record<string, number> = { ap_calculus_ab: 4, ap_biology: 4, ap_microeconomics: 5 };

const readJson = <T>(f: string): T => JSON.parse(readFileSync(f, "utf-8")) as T;
const curr = new Map<string, { f: ApCurriculumFile; topic: Map<string, string>; skill: Map<string, string> }>();
function cur(code: string) {
  if (!curr.has(code)) {
    const f = readJson<ApCurriculumFile>(path.resolve(process.cwd(), `data/ap/curriculum-2027/${code}.json`));
    curr.set(code, { f, topic: new Map(f.units.flatMap((u) => u.topics.map((t) => [t.code, t.title] as const))), skill: new Map(f.skills.map((s) => [s.code, `${s.category}: ${s.label}`])) });
  }
  return curr.get(code)!;
}
const CELLS = arg("--cells")?.split(",");
const allCells = (): Cell[] => readJson<Cell[]>(path.join(ROOT, "cells.json")).filter((c) => (!ONLY || c.subject === ONLY) && (!CELLS || CELLS.includes(c.cellId)));
const readJsonl = (f: string) => (existsSync(f) ? readFileSync(f, "utf-8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Json) : []);
const resultMap = (name: string) => { const m = new Map<string, Json>(); for (const r of readJsonl(path.join(DIR, `${name}.results.jsonl`))) if (r.ok) m.set(r.custom_id as string, r); return m; };
const costOfRes = (r?: Json) => (r?.cost as number | undefined) ?? 0;

// ---------- gen ----------
const GEN_TOK = { in: 3200, out: 3500 };
function candIds(): { cell: Cell; i: number; id: string }[] {
  const out: { cell: Cell; i: number; id: string }[] = [];
  let cells = allCells();
  if (LIMIT) cells = cells.slice(0, LIMIT);
  for (const cell of cells) for (let i = 0; i < cell.candidates; i++) out.push({ cell, i, id: `${cell.cellId}-k${i}` });
  return out;
}
async function genStage() {
  const list = candIds();
  const reqs: BatchReq[] = list.map(({ cell, i, id }) => {
    const c = cur(cell.subject);
    const note = cell.structure === "shared_stimulus_set" ? `The set must contain exactly ${cell.itemsPerCandidate} items on ONE shared stimulus (topics: ${[cell.keywordCode, ...cell.extraKeywordCodes].join(", ")}).` : "";
    return {
      custom_id: id,
      params: { model: MODELS.gen, ...think(MODELS.gen), max_tokens: cell.kind === "frq_bundle" ? 9000 : cell.structure === "shared_stimulus_set" ? 8000 : 6000,
        system: [{ type: "text", text: subjectPrompt(cell.subject), cache_control: SYS_CACHE }], tools: [toolFor(cell)], tool_choice: { type: "auto" },
        messages: [{ role: "user", content: userPrompt(cell, c.topic.get(cell.keywordCode) ?? "", c.skill.get(cell.skill) ?? cell.skill, OPTION_COUNT[cell.subject] ?? 4, i, note) }] },
    };
  });
  const est = estimate(MODELS.gen, reqs.length, GEN_TOK.in, GEN_TOK.out);
  console.log(`gen: ${reqs.length} 요청, 추정 $${est.toFixed(2)} (배치${SYNC ? "→동기 2배" : ""}), 상한 $${BUDGET}, 누적 $${ledger(DIR).spent().toFixed(2)}`);
  await runBatch({ dir: DIR, name: "gen", requests: reqs, budgetUsd: BUDGET, estimateUsd: est, sync: SYNC });
}

function loadCands(): Cand[] {
  const res = resultMap("gen");
  return candIds().map(({ cell, i, id }) => {
    const r = res.get(id);
    return { key: id, cellId: cell.cellId, subject: cell.subject, kind: cell.kind, structure: cell.structure, unitCode: cell.unitCode, keywordCode: cell.keywordCode, skill: cell.skill, idx: i, payload: r ? (toolInput(r as never) as Json | null) : null, genCost: costOfRes(r) };
  });
}

// ---------- check (구조 + 결정적 검증) ----------
type Check = { ok: boolean; reasons: string[]; verification: Json };
const items = (c: Cand): Json[] => (c.kind === "mc" ? (c.structure === "shared_stimulus_set" ? ((c.payload?.items as Json[]) ?? []) : c.payload ? [c.payload] : []) : []);
function structure(c: Cand): string[] {
  const rs: string[] = [];
  const p = c.payload;
  if (!p) return ["generation_failed"];
  const { f } = cur(c.subject);
  const skills = new Set(f.skills.map((s) => s.code));
  const want = OPTION_COUNT[c.subject] ?? 4;
  if (c.kind === "mc") {
    const its = items(c);
    const need = c.structure === "shared_stimulus_set" ? Number((allCells().find((x) => x.cellId === c.cellId) ?? { itemsPerCandidate: 1 }).itemsPerCandidate) : 1;
    if (its.length !== need) rs.push(`item_count_${its.length}_expected_${need}`);
    if (!(p.stimulus as Json | undefined)?.description && c.structure === "shared_stimulus_set") rs.push("missing_set_stimulus");
    its.forEach((it, n) => {
      const opts = (it.options as string[]) ?? [];
      const tag = its.length > 1 ? `item${n + 1}_` : "";
      if (opts.length !== want) rs.push(`${tag}option_count_${opts.length}_expected_${want}`);
      if (new Set(opts.map((o) => o.trim().toLowerCase())).size !== opts.length) rs.push(`${tag}duplicate_options`);
      const k = it.key_index as number;
      if (!Number.isInteger(k) || k < 0 || k >= opts.length) rs.push(`${tag}key_out_of_range`);
      if (opts.some((o) => /\b(all|none) of the above\b/i.test(o))) rs.push(`${tag}all_none_of_above`);
      if (((it.option_rationale as string[]) ?? []).length !== opts.length) rs.push(`${tag}rationale_per_option_missing`);
      if (!String(it.explanation_en ?? "").trim() || !String(it.stem ?? "").trim()) rs.push(`${tag}missing_stem_or_explanation`);
      if (/\b(option|choice|answer)s?\s*\(?[A-E]\)?\b|\([A-E]\)/i.test(String(it.explanation_en ?? "") + (it.option_rationale as string[] ?? []).join(" "))) rs.push(`${tag}explanation_references_option_letter`);
      if (!skills.has(it.skill_primary as string)) rs.push(`${tag}unknown_skill_${it.skill_primary}`);
      if (opts.length && Number.isInteger(k) && opts[k] !== undefined) {
        const lens = opts.map((o) => o.length);
        const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
        if (lens[k] === Math.max(...lens) && lens[k] > mean * 1.6) rs.push(`${tag}key_is_much_longer_giveaway`);
      }
    });
  } else {
    const parts = (p.parts as Json[]) ?? [];
    if (!parts.length) rs.push("no_parts");
    let total = 0;
    for (const part of parts) {
      const rows = (part.rubric_rows as Json[]) ?? [];
      const sum = rows.reduce((s, r) => s + Number(r.points ?? 0), 0);
      total += Number(part.points ?? 0);
      if (!rows.length) rs.push(`part_${part.label}_no_rubric_rows`);
      if (sum !== Number(part.points)) rs.push(`part_${part.label}_rubric_sum_${sum}_vs_${part.points}`);
      for (const s of (part.skill_codes as string[]) ?? []) if (!skills.has(s)) rs.push(`part_${part.label}_unknown_skill_${s}`);
      for (const r of rows) { const dep = r.requires_row_id as string | null | undefined; if (dep && !parts.some((pp) => ((pp.rubric_rows as Json[]) ?? []).some((x) => x.row_id === dep))) rs.push(`part_${part.label}_bad_requires_${dep}`); }
    }
    if (total !== Number(p.total_points)) rs.push(`total_points_${total}_vs_${p.total_points}`);
  }
  return rs;
}
function runPython(code: string): { ok: boolean; out: Json | null; err: string } {
  const tmp = path.join(DIR, ".verify.py");
  writeFileSync(tmp, code);
  const r = spawnSync(PY, ["-I", tmp], { timeout: 25000, encoding: "utf-8", env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "" } as unknown as NodeJS.ProcessEnv });
  if (r.error || r.status !== 0) return { ok: false, out: null, err: (r.error?.message ?? r.stderr ?? "").slice(0, 300) };
  const lines = (r.stdout ?? "").trim().split("\n").filter(Boolean);
  try { return { ok: true, out: JSON.parse(lines[lines.length - 1]) as Json, err: "" }; } catch { return { ok: false, out: null, err: `unparseable output: ${(r.stdout ?? "").slice(-200)}` }; }
}
function checkCand(c: Cand): Check {
  const reasons = structure(c);
  const verification: Json = { structure: reasons.length === 0 };
  if (reasons.length || !c.payload) return { ok: false, reasons, verification };
  const code = c.kind === "mc" && c.structure !== "shared_stimulus_set" ? (c.payload.verification_code as string) : c.kind === "frq_bundle" ? (c.payload.verification_code as string) : "";
  const setCodes = c.structure === "shared_stimulus_set" ? items(c).map((i) => i.verification_code as string) : [];
  if (c.kind === "mc") {
    if (c.structure === "shared_stimulus_set") {
      const outs = setCodes.map((cd) => runPython(cd));
      verification.python = outs.map((o) => o.out ?? o.err);
      outs.forEach((o, n) => {
        if (!o.ok) reasons.push(`item${n + 1}_verification_error`);
        else if (o.out && o.out.conceptual_only !== true && o.out.computed_key_index !== items(c)[n].key_index) reasons.push(`item${n + 1}_key_mismatch_deterministic`);
      });
      verification.conceptualOnly = outs.map((o) => o.out?.conceptual_only === true);
    } else {
      const o = runPython(code);
      verification.python = o.out ?? o.err;
      if (!o.ok) reasons.push("verification_error");
      else if (o.out?.conceptual_only !== true && o.out?.computed_key_index !== c.payload.key_index) reasons.push("key_mismatch_deterministic");
      verification.conceptualOnly = o.out?.conceptual_only === true;
    }
  } else {
    const o = runPython(code);
    verification.python = o.out ?? o.err;
    if (!o.ok) reasons.push("verification_error");
    else {
      const checks = (o.out?.checks as { part: string; pass: boolean }[]) ?? [];
      if (!checks.length && !((o.out?.conceptual_parts as unknown[]) ?? []).length) reasons.push("verification_no_checks");
      for (const k of checks) if (!k.pass) reasons.push(`part_${k.part}_numeric_check_failed`);
    }
  }
  return { ok: reasons.length === 0, reasons, verification };
}
function checkStage() {
  const cands = loadCands();
  const out: Record<string, Check> = {};
  for (const c of cands) out[c.key] = checkCand(c);
  writeFileSync(path.join(DIR, "check.json"), JSON.stringify(out, null, 1));
  const ok = Object.values(out).filter((x) => x.ok).length;
  console.log(`check: ${cands.length} 후보 중 통과 ${ok} (${((ok / cands.length) * 100).toFixed(0)}%)`);
  const tally: Record<string, number> = {};
  Object.values(out).forEach((x) => x.reasons.forEach((r) => { const k = r.replace(/\d+/g, "N"); tally[k] = (tally[k] ?? 0) + 1; }));
  console.log(tally);
}
const checks = (): Record<string, Check> => (existsSync(path.join(DIR, "check.json")) ? readJson(path.join(DIR, "check.json")) : {});
const alive = (): Cand[] => { const ch = checks(); return loadCands().filter((c) => c.payload && ch[c.key]?.ok); };

// ---------- 후보를 모델에 보여 줄 때(키·해설 가림/표시) ----------
const blind = (c: Cand): Json => {
  const strip = (it: Json) => ({ stem: it.stem, options: it.options, calculator_part: it.calculator_part });
  if (c.kind === "frq_bundle") return { title: c.payload?.title, stimulus: c.payload?.stimulus, calculator_part: c.payload?.calculator_part, parts: ((c.payload?.parts as Json[]) ?? []).map((p) => ({ label: p.label, prompt: p.prompt, points: p.points })) };
  return c.structure === "shared_stimulus_set" ? { stimulus: c.payload?.stimulus, items: items(c).map(strip) } : { stimulus: c.payload?.stimulus, ...strip(c.payload!) };
};
const solveTool = { name: "submit_solution", description: "Submit your independent solution.", input_schema: { type: "object", properties: {
  answers: { type: "array", items: { type: "object", properties: { item: { type: "string" }, choice_index: { type: ["integer", "null"] }, final_answer: { type: "string" }, brief_reasoning: { type: "string" }, ambiguous_or_flawed: { type: "boolean" }, flaw_note: { type: "string" } }, required: ["item", "brief_reasoning", "ambiguous_or_flawed"] } } }, required: ["answers"] } };
const reviewTool = { name: "submit_review", description: "Submit the quality review.", input_schema: { type: "object", properties: {
  scope_skill: { type: "object", properties: { pass: { type: "boolean" }, notes: { type: "string" } }, required: ["pass", "notes"] },
  key_scoring: { type: "object", properties: { pass: { type: "boolean" }, notes: { type: "string" } }, required: ["pass", "notes"] },
  stimulus_expression: { type: "object", properties: { pass: { type: "boolean" }, notes: { type: "string" } }, required: ["pass", "notes"] },
  distractor_explanation: { type: "object", properties: { pass: { type: "boolean" }, notes: { type: "string" } }, required: ["pass", "notes"] },
  exam_suitability: { type: "object", properties: { pass: { type: "boolean" }, notes: { type: "string" } }, required: ["pass", "notes"] },
  instant_reject: { type: "array", items: { type: "string", enum: ["wrong_key", "multiple_correct", "missing_condition", "wrong_stimulus", "out_of_scope_knowledge"] } },
  resembles_known_exam_item: { type: "boolean" }, summary: { type: "string" } }, required: ["scope_skill", "key_scoring", "stimulus_expression", "distractor_explanation", "exam_suitability", "instant_reject", "resembles_known_exam_item", "summary"] } };
const diffTool = { name: "submit_difficulty", description: "Submit provisional difficulty tag.", input_schema: { type: "object", properties: {
  label: { type: "string", enum: ["basic_learning", "exam_prep", "advanced_supplement"] }, rationale: { type: "string" },
  reading_load: { type: "string", enum: ["low", "medium", "high"] }, computation_load: { type: "string", enum: ["low", "medium", "high"] }, reasoning_steps: { type: "integer" }, representation_changes: { type: "integer" },
  difficulty_from_unfair_sources: { type: "boolean", description: "true if difficulty comes from long arithmetic, vagueness, reading load or out-of-scope knowledge" }, est_seconds: { type: "integer" } }, required: ["label", "rationale", "reading_load", "computation_load", "reasoning_steps", "representation_changes", "difficulty_from_unfair_sources", "est_seconds"] } };
const SOLVE_SYS = "You are an AP course expert solving a practice item as a student would. Solve independently; do not assume the item is well-formed. For multiple choice give choice_index (0-based). For free response give a concise final answer per part. If the item is ambiguous, has two defensible answers, lacks a needed condition or contradicts its stimulus, set ambiguous_or_flawed true and say why.";
const REVIEW_SYS = `You are a strict AP content reviewer. Apply five acceptance criteria: (1) scope/skill fit to the given official unit topic and skill; (2) key and scoring correctness (unique key; numbers/units consistent; FRQ rubric consistent, alternatives valid); (3) stimulus/expression completeness (the stimulus "data" object is the machine-readable specification a figure/table will be rendered from and "description" is only alt text: judge the completeness of the DATA — axes, ranges, units, labels, every number used — not whether a picture is attached; clear US English); (4) distractor/explanation quality (misconception-based, no length/format giveaways, explains why wrong); (5) exam suitability (time, reading/calculator load, no needless arithmetic). Any instant-reject condition must be listed in instant_reject. You also receive an independent solver's answer: its agreement is supporting evidence only, never proof of quality or difficulty. Flag resembles_known_exam_item if it looks like a recollection of a real released AP item. Be conservative: fail when unsure.`;
const DIFF_SYS = "You tag provisional internal difficulty for AP practice items: basic_learning, exam_prep (target for full mocks) or advanced_supplement. Judge only from concept depth, reasoning steps, representation changes, reading and computation load. Do NOT infer difficulty from model agreement or from any claim of AP score level. Never use the words 'AP 3-level/5-level'. Flag difficulty_from_unfair_sources if the item is hard only because of long arithmetic, vagueness, heavy reading or out-of-scope knowledge.";
const ctx = (c: Cand) => { const cell = allCells().find((x) => x.cellId === c.cellId)!; const k = cur(c.subject); return `Subject ${c.subject}. Unit ${c.unitCode}; topic ${c.keywordCode} "${k.topic.get(c.keywordCode)}"; target skill ${c.skill} (${k.skill.get(c.skill)}); structure ${c.structure}; calculator ${cell.calculator}.`; };
const mk = (id: string, model: string, sys: string, tool: Json, user: string, max: number): BatchReq => ({ custom_id: id, params: { model, ...think(model), max_tokens: max, system: [{ type: "text", text: sys, cache_control: SYS_CACHE }], tools: [tool], tool_choice: { type: "auto" }, messages: [{ role: "user", content: user }] } });

async function solveStage() {
  const cs = alive();
  const reqs = cs.map((c) => mk(`s-${c.key}`, MODELS.solve, SOLVE_SYS, solveTool, `${ctx(c).replace(/target skill.*?;/, "")}\n\n${JSON.stringify(blind(c))}\n\nSolve every item/part and submit via submit_solution (answers[].item = "1","2"… or part label).`, 3500));
  const est = estimate(MODELS.solve, reqs.length, 1800, 2500);
  console.log(`solve: ${reqs.length} 요청 추정 $${est.toFixed(2)} 누적 $${ledger(DIR).spent().toFixed(2)}`);
  await runBatch({ dir: DIR, name: "solve", requests: reqs, budgetUsd: BUDGET, estimateUsd: est, sync: SYNC });
}
const solved = (c: Cand) => { const r = resultMap("solve").get(`s-${c.key}`); return r ? (toolInput(r as never) as Json | null) : null; };
async function reviewStage() {
  const cs = alive().filter((c) => solved(c));
  const reqs = cs.map((c) => mk(`r-${c.key}`, MODELS.review, REVIEW_SYS, reviewTool, `${ctx(c)}\n\nCANDIDATE (with key, rationale, rubric):\n${JSON.stringify(c.payload).replace(/"verification_code":"[^"]*"/g, '"verification_code":"(omitted)"')}\n\nINDEPENDENT SOLVER OUTPUT:\n${JSON.stringify(solved(c))}`, 3000));
  const est = estimate(MODELS.review, reqs.length, 2800, 1200);
  console.log(`review: ${reqs.length} 요청 추정 $${est.toFixed(2)} 누적 $${ledger(DIR).spent().toFixed(2)}`);
  await runBatch({ dir: DIR, name: "review", requests: reqs, budgetUsd: BUDGET, estimateUsd: est, sync: SYNC });
}
async function difficultyStage() {
  const rev = resultMap("review");
  const cs = alive().filter((c) => rev.has(`r-${c.key}`));
  const reqs = cs.map((c) => mk(`d-${c.key}`, MODELS.difficulty, DIFF_SYS, diffTool, `${ctx(c)}\n\n${JSON.stringify(blind(c))}`, 1500));
  const est = estimate(MODELS.difficulty, reqs.length, 1500, 700);
  console.log(`difficulty: ${reqs.length} 요청 추정 $${est.toFixed(2)} 누적 $${ledger(DIR).spent().toFixed(2)}`);
  await runBatch({ dir: DIR, name: "difficulty", requests: reqs, budgetUsd: BUDGET, estimateUsd: est, sync: SYNC });
}

// ---------- 판정 ----------
type Verdict = { key: string; cellId: string; subject: string; passed: boolean; reasons: string[]; difficulty?: Json | null; review?: Json | null; solver?: Json | null; conceptualOnly?: boolean };
function solverAgrees(c: Cand, sol: Json | null): boolean | null {
  if (!sol) return null;
  const ans = (sol.answers as Json[]) ?? [];
  if (c.kind !== "mc") return ans.every((a) => !a.ambiguous_or_flawed);
  const its = items(c);
  return its.every((it, n) => { const a = ans.find((x) => String(x.item) === String(n + 1)) ?? ans[n]; return a && !a.ambiguous_or_flawed && a.choice_index === it.key_index; });
}
function decide(): Verdict[] {
  const ch = checks();
  const rev = resultMap("review");
  const dif = resultMap("difficulty");
  return loadCands().map((c) => {
    const reasons: string[] = [...(ch[c.key]?.reasons ?? [])];
    const v: Verdict = { key: c.key, cellId: c.cellId, subject: c.subject, passed: false, reasons };
    if (!c.payload) { reasons.push("generation_failed"); return v; }
    if (reasons.length) return v;
    v.conceptualOnly = [ch[c.key]?.verification?.conceptualOnly].flat().some((x) => x === true);
    v.solver = solved(c);
    if (!v.solver) { reasons.push("solver_missing"); return v; }
    if (solverAgrees(c, v.solver) === false) reasons.push("solver_disagrees_or_flags_flaw");
    const r = rev.get(`r-${c.key}`);
    v.review = r ? (toolInput(r as never) as Json | null) : null;
    if (!v.review) { reasons.push("review_missing"); return v; }
    for (const k of ["scope_skill", "key_scoring", "stimulus_expression", "distractor_explanation", "exam_suitability"]) if (!(v.review[k] as Json | undefined)?.pass) reasons.push(`criterion_failed_${k}`);
    for (const x of (v.review.instant_reject as string[]) ?? []) reasons.push(`instant_reject_${x}`);
    if (v.review.resembles_known_exam_item) reasons.push("resembles_known_exam_item");
    const d = dif.get(`d-${c.key}`);
    v.difficulty = d ? (toolInput(d as never) as Json | null) : null;
    if (v.difficulty?.difficulty_from_unfair_sources) reasons.push("difficulty_from_unfair_sources");
    if (v.difficulty?.label === "basic_learning" && false) reasons.push("n/a");
    v.passed = reasons.length === 0;
    return v;
  });
}
// ---------- spot (Fable, 통과 후보의 상위 10%) ----------
async function spotStage() {
  const verd = decide().filter((v) => v.passed);
  const n = Math.max(1, Math.ceil(verd.length * 0.1));
  const rank = (v: Verdict) => ((v.difficulty?.label === "advanced_supplement" ? 2 : v.difficulty?.label === "exam_prep" ? 1 : 0) * 100 + Number(v.difficulty?.reasoning_steps ?? 0));
  const pick = [...verd].sort((a, b) => rank(b) - rank(a)).slice(0, n);
  const byKey = new Map(loadCands().map((c) => [c.key, c]));
  const reqs = pick.map((v) => { const c = byKey.get(v.key)!; return mk(`x-${c.key}`, MODELS.spot, SOLVE_SYS, solveTool, `${ctx(c).replace(/target skill.*?;/, "")}\n\n${JSON.stringify(blind(c))}\n\nSolve independently and flag any flaw.`, 3500); });
  const est = estimate(MODELS.spot, reqs.length, 1800, 2500);
  console.log(`spot: ${reqs.length}/${verd.length} 요청(상위 난이도 10%) 추정 $${est.toFixed(2)} 누적 $${ledger(DIR).spent().toFixed(2)}`);
  await runBatch({ dir: DIR, name: "spot", requests: reqs, budgetUsd: BUDGET, estimateUsd: est, sync: SYNC });
}
function finalDecide(): Verdict[] {
  const spot = resultMap("spot");
  const byKey = new Map(loadCands().map((c) => [c.key, c]));
  return decide().map((v) => {
    const r = spot.get(`x-${v.key}`);
    if (r && v.passed) {
      const sol = toolInput(r as never) as Json | null;
      if (solverAgrees(byKey.get(v.key)!, sol) === false) { v.passed = false; v.reasons.push("fable_spot_check_disagrees"); }
    }
    return v;
  });
}
// ---------- report / export ----------
const shingles = (s: string) => { const t = s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean); const out = new Set<string>(); for (let i = 0; i + 2 < t.length; i++) out.add(t.slice(i, i + 3).join(" ")); return out; };
const jacc = (a: Set<string>, b: Set<string>) => { let i = 0; a.forEach((x) => b.has(x) && i++); return a.size + b.size - i ? i / (a.size + b.size - i) : 0; };
function reportStage() {
  const verd = finalDecide();
  const cands = new Map(loadCands().map((c) => [c.key, c]));
  const cells = allCells();
  const calls = [...["gen", "solve", "review", "difficulty", "spot"].flatMap((st) => readJsonl(path.join(DIR, `${st}.results.jsonl`)).filter((r) => r.ok).map((r) => ({ stage: st, id: r.custom_id as string, model: r.model as string, cost: (r.cost as number) ?? 0, usage: r.usage as Json })))];
  const total = calls.reduce((s, c) => s + c.cost, 0);
  // 셀당 1개 채택(우선: 통과 + exam_prep 선호 + 비 conceptual), 나머지 통과는 reserve
  const adopted: string[] = [];
  const reserve: string[] = [];
  for (const cell of cells) {
    const pass = verd.filter((v) => v.cellId === cell.cellId && v.passed).sort((a, b) => Number(b.difficulty?.label === "exam_prep") - Number(a.difficulty?.label === "exam_prep") || a.key.localeCompare(b.key));
    if (pass[0]) adopted.push(pass[0].key);
    pass.slice(1).forEach((p) => reserve.push(p.key));
  }
  // 중복률(채택 후보끼리 3-gram 자카드 > 0.5)
  const text = (k: string) => JSON.stringify([cands.get(k)?.payload?.stimulus, cands.get(k)?.payload?.stem, (cands.get(k)?.payload?.items as Json[] | undefined)?.map((i) => i.stem), (cands.get(k)?.payload?.parts as Json[] | undefined)?.map((p) => p.prompt)]);
  let dupPairs = 0; let pairs = 0;
  const sh = adopted.map((k) => shingles(text(k)));
  for (let i = 0; i < sh.length; i++) for (let j = i + 1; j < sh.length; j++) { pairs++; if (jacc(sh[i], sh[j]) > 0.5) dupPairs++; }
  const rej: Record<string, number> = {};
  verd.filter((v) => !v.passed).forEach((v) => v.reasons.forEach((r) => { const k = r.replace(/\d+/g, "N"); rej[k] = (rej[k] ?? 0) + 1; }));
  const bySubject: Record<string, Json> = {};
  for (const s of [...new Set(cells.map((c) => c.subject))]) {
    const vs = verd.filter((v) => v.subject === s);
    const ad = adopted.filter((k) => cands.get(k)?.subject === s);
    const cellsS = cells.filter((c) => c.subject === s);
    const itemsAdopted = ad.reduce((n, k) => n + (cands.get(k)!.kind === "mc" ? items(cands.get(k)!).length : 0), 0);
    const frqAdopted = ad.filter((k) => cands.get(k)!.kind === "frq_bundle").length;
    const spent = calls.filter((c) => c.id.replace(/^[a-z]-/, "").startsWith(s)).reduce((n, c) => n + c.cost, 0);
    bySubject[s] = { candidates: vs.length, passedAll: vs.filter((v) => v.passed).length, adoptedCandidates: ad.length, mcItemsAdopted: itemsAdopted, frqBundlesAdopted: frqAdopted, cellsTotal: cellsS.length, cellsFilled: ad.length, yieldAdoptedOverCandidates: Number((ad.length / Math.max(1, vs.length)).toFixed(3)), costUsd: Number(spent.toFixed(2)), callsPerAdopted: Number((calls.filter((c) => c.id.replace(/^[a-z]-/, "").startsWith(s)).length / Math.max(1, ad.length)).toFixed(1)), unfilledCells: cellsS.filter((c) => !ad.some((k) => cands.get(k)!.cellId === c.cellId)).map((c) => c.cellId) };
  }
  const out = { run: RUN, generatedAt: new Date().toISOString(), totalCostUsd: Number(total.toFixed(2)), ledgerSpent: ledger(DIR).spent(), cap: BUDGET, calls: calls.length, candidates: verd.length, passedAll: verd.filter((v) => v.passed).length, adopted: adopted.length, reserve: reserve.length, duplicate: { adoptedPairs: pairs, similarPairs: dupPairs }, rejectionReasons: rej, bySubject, spotChecked: resultMap("spot").size };
  writeFileSync(path.join(DIR, "report.json"), JSON.stringify(out, null, 1));
  // 정답 위치 균형: 채택·reserve 문항의 선택지를 결정적으로 재배열(키가 항상 앞쪽에 몰리는 것 방지). 해설은 글자 참조 금지 규칙으로 안전.
  const posCount: Record<string, number> = {};
  const balance = (it: Json, subject: string) => {
    const opts = [...((it.options as string[]) ?? [])]; const why = [...((it.option_rationale as string[]) ?? [])]; const k = it.key_index as number;
    const n = opts.length; const used = posCount[subject] ?? 0; posCount[subject] = used + 1;
    const target = used % n;
    if (!n || target === k) { it.key_index_final = k; return; }
    [opts[k], opts[target]] = [opts[target], opts[k]]; [why[k], why[target]] = [why[target], why[k]];
    it.options = opts; it.option_rationale = why; it.key_index_before_shuffle = k; it.key_index = target;
  };
  for (const key of [...adopted, ...reserve]) { const c = cands.get(key); if (c?.payload && c.kind === "mc") items(c).forEach((it) => balance(it, c.subject)); }
  // 후보 파일(초안, 전문가 검수 대기)
  const exported = verd.map((v) => { const c = cands.get(v.key)!; const cell = cells.find((x) => x.cellId === c.cellId)!; return { candidateKey: v.key, cellId: v.cellId, apSubjectCode: c.subject, kind: c.kind, keywordCode: c.keywordCode, unitCode: c.unitCode, skillPrimary: c.skill, structure: c.structure, calculator: cell.calculator, reviewState: adopted.includes(v.key) ? "pending_expert_review" : reserve.includes(v.key) ? "pending_expert_review" : v.reasons.length ? "rejected" : "candidate", reserve: reserve.includes(v.key), rejectionReason: v.passed ? null : v.reasons.join("; "), difficultyProvisional: v.difficulty?.label ?? null, difficultyRationale: v.difficulty?.rationale ?? null, payload: (() => { const p = { ...(c.payload ?? {}) } as Json; return p; })(), verification: { conceptualOnly: v.conceptualOnly ?? null, solverAgrees: v.solver ? solverAgrees(c, v.solver) : null }, review: v.review ?? null, difficulty: v.difficulty ?? null }; });
  writeFileSync(path.join(DIR, "candidates.json"), JSON.stringify(exported, null, 1));
  appendFileSync(path.join(DIR, "calls.jsonl"), "");
  console.log(JSON.stringify(out, null, 1));
}

(async () => {
  if (stage === "gen") await genStage();
  else if (stage === "check") checkStage();
  else if (stage === "solve") await solveStage();
  else if (stage === "review") await reviewStage();
  else if (stage === "difficulty") await difficultyStage();
  else if (stage === "spot") await spotStage();
  else if (stage === "report") reportStage();
  else console.log("stage: gen | check | solve | review | difficulty | spot | report");
})().catch((e) => { console.error(e); process.exit(1); });
