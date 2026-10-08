// AP 코드 우선(verification-first) 생성 파이프라인 v2 (2026-10-08). 정답·표·그래프 수치·루브릭 구조는 Python 원형(scripts/ap-generation/archetypes)이 계산하고
// LLM 은 문장(stem/context/해설)만 쓴다. 결정적 게이트(lib/ap-generation/gates.ts) → 독립 풀이(Opus, 정답 비공개) → 5기준 검토 + 참조 패턴 대조(Sonnet) → 난이도(별도) → 표본(Fable).
//   npx tsx scripts/ap-generation/pipeline2.ts plan|gen|check|solve|review|difficulty|spot|report --run run2 [--sync]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { runBatch, toolInput, estimate, ledger, type BatchReq } from "../mock-exam-generation/batch-lib";
import { calibrateFrq, calibrateMc, gateDuplicate, gateFrq, gateMc, gateNoCalcExact, wordingPreserves, type FrqPack, type McPack } from "../../lib/ap-generation/gates";
import { loadEnvLocal } from "../keywords/db";
import { createHash } from "node:crypto";
import { POLICY, manifestIssues, type RunManifest } from "../../lib/ap-generation/pipeline-policy";
import { gateGuideFrq, gateGuideMc } from "../../lib/ap-generation/guide-gates";
import { guideReviewRules as _grr, guideWordingRules as _gwr } from "../../lib/ap-generation/subjects/calc-ab";
import { GUIDES } from "../../lib/ap-generation/subjects/calc-bc";
import type { ApCurriculumFile } from "../../lib/ap-curriculum/types";

loadEnvLocal();
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const stage = process.argv[2];
const RUN = arg("--run") ?? "run2";
const SUBJECT = arg("--subject") ?? "ap_calculus_ab";
const SYNC = process.argv.includes("--sync");
const SEED0 = Number(arg("--seed0") ?? process.env.AP_SEED0 ?? 0); // 새 시드 구간(이전 튜닝 후보와 겹치지 않게; 비교 실험은 1000 이상)
const ROOT = path.resolve(process.cwd(), "data/ap/sample-2027");
const DIR = path.join(ROOT, RUN);
mkdirSync(DIR, { recursive: true });
const PY = process.env.AP_PY ?? "/private/tmp/claude-501/-Users-jangjiman-Developer-ALTON/d05b2ffe-5d6e-4058-a909-5e3b8827cbe2/scratchpad/apvenv/bin/python";
const ARCH = path.resolve(process.cwd(), "scripts/ap-generation/archetypes");
const CAP_NEW = Number(process.env.AP_CAP_NEW ?? 50); // 이번 라운드 신규 지출 상한(USD) — 도달 시 중단
const BASE_F = path.join(DIR, "baseline.json");
const baseline = (): number => { if (!existsSync(BASE_F)) writeFileSync(BASE_F, JSON.stringify({ spent: ledger(DIR).spent() })); return JSON.parse(readFileSync(BASE_F, "utf-8")).spent as number; };
const BUDGET = () => baseline() + CAP_NEW;
const SYS_CACHE = { type: "ephemeral", ttl: "1h" };
const MODELS = { gen: "claude-sonnet-5-5", solve: "claude-opus-5-5", review: "claude-sonnet-5-5", difficulty: "claude-sonnet-5-5", spot: "claude-fable-5-1" } as const;
const think = (m: string) => ({ thinking: m.includes("sonnet") ? { type: "between_tools" } : { type: "adaptive" }, output_config: { effort: "low" } });
type Json = Record<string, unknown>;
const readJson = <T>(f: string): T => JSON.parse(readFileSync(f, "utf-8")) as T;
const readJsonl = (f: string) => (existsSync(f) ? readFileSync(f, "utf-8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Json) : []);
const resultMap = (name: string) => { const m = new Map<string, Json>(); for (const r of readJsonl(path.join(DIR, `${name}.results.jsonl`))) if (r.ok) m.set(r.custom_id as string, r); return m; };

const GUIDE = GUIDES[SUBJECT as keyof typeof GUIDES];
const guideWordingRules = () => _gwr().replace(/ap_calculus_ab|AP Calculus AB/g, GUIDE.subject).replace(/for AB/g, SUBJECT === "ap_calculus_bc" ? "for BC" : "for AB");
const guideReviewRules = (u: string) => { const un = GUIDE.units.find((x) => x.unit === u); return un ? `UNIT ${un.unit} SCOPE for ${SUBJECT === "ap_calculus_bc" ? "BC" : "AB"} — in scope: ${un.inScope.join("; ")}. OUT of scope: ${un.outOfScope.join("; ")}. Difficulty levers allowed: ${GUIDE.difficultyAllowed.join("; ")}. Banned difficulty sources: ${GUIDE.difficultyBanned.join("; ")}.` : _grr(u); };
const calcAbGuide = GUIDE;
const curriculum = readJson<ApCurriculumFile>(path.resolve(process.cwd(), `data/ap/curriculum-2027/${SUBJECT}.json`));
const skillSet = new Set(curriculum.skills.map((s) => s.code));
const skillLabel = new Map(curriculum.skills.map((s) => [s.code, `${s.category}: ${s.label}`]));
const topicTitle = new Map(curriculum.units.flatMap((u) => u.topics.map((t) => [t.code, t.title] as const)));
const unitOf = new Map(curriculum.units.flatMap((u) => u.topics.map((t) => [t.code, u.code] as const)));

function py(args: string[]): unknown {
  const r = spawnSync(PY, ["-B", "registry.py", ...args], { cwd: ARCH, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024, timeout: 120000 });
  if (r.status !== 0) throw new Error(`python failed: ${(r.stderr ?? "").slice(-300)}`);
  return JSON.parse(r.stdout);
}

type Cell = { cellId: string; archetype: string; kind: "mc" | "frq_bundle"; unitCode: string; topic: string; skill: string; calculator: string; candidates: number; extraTopics: string[]; template?: string };
type Cand = { key: string; cellId: string; archetype: string; kind: "mc" | "frq_bundle"; pack: Json; polished?: Json; item: McPack | FrqPack | null; wording: "llm" | "template" };

const SEEDS_PER_CELL = Number(process.env.AP_MC_CANDS ?? 4);
const FRQ_CANDS = Number(process.env.AP_FRQ_CANDS ?? 4);
function writeManifest(extra: Partial<RunManifest> = {}) {
  const sha = (t: string) => createHash("sha1").update(t).digest("hex").slice(0, 12);
  const commit = spawnSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf-8" }).stdout.trim();
  const dirty = spawnSync("git", ["status", "--porcelain", "scripts/ap-generation", "lib/ap-generation"], { encoding: "utf-8" }).stdout.trim() ? "+dirty" : "";
  const m: RunManifest = { run: RUN, subject: SUBJECT, generatorCommit: commit + dirty, gateVersion: "v2-code-first-final-2026-10-08", reviewerPromptHash: sha(REVIEW_SYS + JSON.stringify(reviewTool)), difficultyPromptHash: sha(DIFF_SYS + JSON.stringify(diffTool)),
    models: { ...MODELS }, policy: POLICY, seeds: { first: [SEED0], note: "seed0 = first seed tried per archetype; packs.json records pack_id = archetype-sSEED" }, frozenAt: new Date().toISOString(), ...extra };
  const issues = manifestIssues(m); if (issues.length) throw new Error(issues.join(", "));
  writeFileSync(path.join(DIR, POLICY.manifestFile), JSON.stringify(m, null, 1));
}
function planStage() {
  const lst = py(["list", SUBJECT === "ap_calculus_bc" ? "bc" : "ab"]) as { mc: string[]; frq: string[] };
  const cells: Cell[] = [];
  lst.mc.forEach((a, i) => {
    const p = (py(["batch", a, "1", "0"]) as Json[])[0];
    cells.push({ cellId: `${SUBJECT}-m${String(i + 1).padStart(2, "0")}`, archetype: a, kind: "mc", unitCode: unitOf.get(p.topic as string) ?? "", topic: p.topic as string, skill: p.skill as string, calculator: p.calculator as string, candidates: SEEDS_PER_CELL, extraTopics: [] });
  });
  const frqs = lst.frq;
  frqs.forEach((a, i) => {
    const p = (py(["batch", a, "1", "0"]) as Json[])[0];
    cells.push({ cellId: `${SUBJECT}-f${String(i + 1).padStart(2, "0")}`, archetype: a, kind: "frq_bundle", unitCode: unitOf.get(p.topic as string) ?? "", topic: p.topic as string, skill: p.skill as string, calculator: p.calculator as string, candidates: FRQ_CANDS, extraTopics: p.extra_topics as string[], template: p.template as string });
  });
  writeFileSync(path.join(DIR, "cells.json"), JSON.stringify(cells, null, 1));
  baseline(); writeManifest();
  const byUnit = cells.filter((c) => c.kind === "mc").reduce<Record<string, number>>((m, c) => ((m[c.unitCode] = (m[c.unitCode] ?? 0) + 1), m), {});
  const calc = cells.filter((c) => c.kind === "mc" && c.calculator === "required").length;
  console.log(`plan: MC 칸 ${cells.filter((c) => c.kind === "mc").length}(단원별 ${JSON.stringify(byUnit)}, 계산기 필요 ${calc}), FRQ 칸 ${cells.filter((c) => c.kind !== "mc").length}, 기준 지출 $${baseline().toFixed(2)}, 신규 상한 $${CAP_NEW}`);
}
const cells = (): Cell[] => readJson<Cell[]>(path.join(DIR, "cells.json"));

// ---------- 후보 팩(코드 계산) ----------
function packsFile() { return path.join(DIR, "packs.json"); }
function genPacks() {
  const out: Record<string, Json[]> = existsSync(packsFile()) ? readJson<Record<string, Json[]>>(packsFile()) : {};
  let changed = false;
  for (const c of cells()) if (!out[c.cellId]) { out[c.cellId] = py(["batch", c.archetype, String(c.candidates), String(SEED0)]) as Json[]; changed = true; }
  if (changed) writeFileSync(packsFile(), JSON.stringify(out));
  return out;
}

// ---------- LLM 문장 다듬기 ----------
const WORD_SYS = `You are a careful AP Calculus item writer. A CODE generator has already computed and verified every number, table value, option and misconception. Your job is only the WORDING:
- polish the stem so it reads like a clean AP exam stem (US English). You MUST keep every number, symbol and every $...$ math block of the base stem exactly as given; you may rephrase the plain words and may add a short realistic context ONLY if no numbers/quantities change. Never mention a table that the base stem does not mention. Never reveal the answer.
- do NOT write an explanation (the code writes it); submit only the stem.
For free-response bundles you rewrite part prompts in the same way (keep every number and $...$ block) and add a one-sentence design_note.`;
const mcWordTool = { name: "submit_wording", description: "Submit polished stem and explanation.", input_schema: { type: "object", properties: { stem: { type: "string" }, explanation_en: { type: "string" } }, required: ["stem"] } };
const frqWordTool = { name: "submit_frq_wording", description: "Submit polished prompts.", input_schema: { type: "object", properties: { prompts: { type: "object", additionalProperties: { type: "string" } }, design_note: { type: "string" } }, required: ["prompts", "design_note"] } };
function wordReq(c: Cell, pack: Json, id: string): BatchReq {
  const body = c.kind === "mc"
    ? `BASE STEM:\n${pack.stem}\n\nSTIMULUS (already shown to the student): ${JSON.stringify(pack.stimulus)}\n\nOPTIONS WITH RATIONALE (do not change options):\n${(pack.options as Json[]).map((o, i) => `${i === pack.key_index ? "KEY" : "WRONG"}: ${o.text} — ${o.why}`).join("\n")}\n\nSubmit via submit_wording.`
    : `BUNDLE: ${pack.title}\nSTIMULUS: ${JSON.stringify(pack.stimulus)}\nPART PROMPTS (keep numbers and math blocks):\n${(pack.parts as Json[]).map((p) => `(${p.label}) ${p.prompt}`).join("\n")}\n\nSubmit via submit_frq_wording with prompts keyed by part label.`;
  return { custom_id: id, params: { model: MODELS.gen, ...think(MODELS.gen), max_tokens: c.kind === "mc" ? 2500 : 4000, system: [{ type: "text", text: WORD_SYS + "\n" + guideWordingRules(), cache_control: SYS_CACHE }], tools: [c.kind === "mc" ? mcWordTool : frqWordTool], tool_choice: { type: "auto" }, messages: [{ role: "user", content: body }] } };
}
async function genStage() {
  const packs = genPacks();
  const reqs: BatchReq[] = [];
  for (const c of cells()) packs[c.cellId].forEach((p, i) => reqs.push(wordReq(c, p, `${c.cellId}-k${i}`)));
  const est = estimate(MODELS.gen, reqs.length, 1800, 1100);
  console.log(`gen(문장): ${reqs.length}건 추정 $${est.toFixed(2)} (동기 2배), 누적 $${ledger(DIR).spent().toFixed(2)}, 신규 상한 $${BUDGET().toFixed(2)}`);
  await runBatch({ dir: DIR, name: "gen", requests: reqs, budgetUsd: BUDGET(), estimateUsd: est, sync: SYNC, syncConcurrency: Number(process.env.AP_SYNC_CONC ?? 10) });
}

// ---------- 후보 조립 ----------
const plainTxt = (t: string) => t.replace(/\$/g, "");
/** 해설은 코드가 만든다(정답 근거 + 선택지별 오개념). LLM 은 stem 문장만 다듬는다 — 해설 속 파생 수치 환각을 막기 위해. */
const structuredExplanation = (p: Json) => {
  const o = p.options as { text: string; why: string }[]; const k = p.key_index as number;
  return `The correct answer is ${plainTxt(o[k].text)}. ${o[k].why}\n` + o.filter((_, i) => i !== k).map((x) => `${plainTxt(x.text)} is incorrect: ${x.why}`).join("\n");
};
function buildCands(): Cand[] {
  const packs = genPacks(); const gen = resultMap("gen"); const out: Cand[] = [];
  for (const c of cells()) packs[c.cellId].forEach((pack, i) => {
    const key = `${c.cellId}-k${i}`; const r = gen.get(key); const polished = r ? (toolInput(r as never) as Json | null) : null;
    let item: McPack | FrqPack | null = null; let wording: "llm" | "template" = "template";
    if (c.kind === "mc") {
      const mp = { ...(pack as unknown as McPack) } as McPack;
      let stem = mp.stem; const expl = structuredExplanation(pack);
      if (polished && typeof polished.stem === "string" && typeof polished.explanation_en === "string" && wordingPreserves(mp.stem, polished.stem).length === 0) { stem = polished.stem; wording = "llm"; }
      item = { ...mp, stem, explanation_en: expl };
    } else {
      const fp = JSON.parse(JSON.stringify(pack)) as FrqPack;
      if (polished && polished.prompts && typeof polished.prompts === "object") {
        const pr = polished.prompts as Record<string, string>; let ok = true;
        for (const pt of fp.parts) { const np = pr[pt.label]; if (typeof np !== "string" || wordingPreserves(pt.prompt, np).length) { ok = false; break; } }
        if (ok) { for (const pt of fp.parts) pt.prompt = pr[pt.label]; wording = "llm"; }
      }
      item = fp;
    }
    out.push({ key, cellId: c.cellId, archetype: c.archetype, kind: c.kind, pack, polished: polished ?? undefined, item, wording });
  });
  return out;
}

// ---------- 결정적 검사 ----------
function checkStage() {
  const cs = buildCands(); const cm = new Map(cells().map((c) => [c.cellId, c]));
  const out: Record<string, { reasons: string[]; wording: string }> = {};
  for (const c of cs) {
    const cell = cm.get(c.cellId)!;
    const reasons = c.kind === "mc" ? [...gateMc(SUBJECT, c.item as McPack), ...calibrateMc(SUBJECT, c.item as McPack), ...gateGuideMc(calcAbGuide, c.item as McPack), ...gateNoCalcExact(c.item as McPack)] : [...gateFrq(SUBJECT, c.item as FrqPack, skillSet, { requirePartTopics: SUBJECT === "ap_biology", topics: new Set(topicTitle.keys()) }), ...calibrateFrq(c.item as FrqPack, SUBJECT), ...gateGuideFrq(calcAbGuide, c.item as FrqPack)];
    if (!c.polished) reasons.push("wording_missing");
    out[c.key] = { reasons, wording: c.wording };
    void cell;
  }
  writeFileSync(path.join(DIR, "check.json"), JSON.stringify(out, null, 1));
  const ok = Object.values(out).filter((x) => x.reasons.length === 0).length;
  const llm = Object.values(out).filter((x) => x.wording === "llm").length;
  const tally: Record<string, number> = {}; Object.values(out).forEach((x) => x.reasons.forEach((r) => (tally[r.replace(/\d+/g, "N")] = (tally[r.replace(/\d+/g, "N")] ?? 0) + 1)));
  console.log(`check: ${cs.length}건 중 결정적 게이트 통과 ${ok}, LLM 문장 채택 ${llm}`, tally);
}
const checks = () => (existsSync(path.join(DIR, "check.json")) ? readJson<Record<string, { reasons: string[]; wording: string }>>(path.join(DIR, "check.json")) : {});
const alive = () => buildCands().filter((c) => c.item && (checks()[c.key]?.reasons.length ?? 1) === 0);

const blind = (c: Cand): Json => {
  if (c.kind === "mc") { const m = c.item as McPack; return { stimulus: m.stimulus, stem: m.stem, options: m.options.map((o) => o.text) }; }
  const f = c.item as FrqPack; return { title: f.title, stimulus: f.stimulus, calculator_part: f.calculator, parts: f.parts.map((p) => ({ label: p.label, prompt: p.prompt, points: p.points })) };
};
const solveTool = { name: "submit_solution", description: "Submit your independent solution.", input_schema: { type: "object", properties: { answers: { type: "array", items: { type: "object", properties: { item: { type: "string" }, choice_index: { type: ["integer", "null"] }, final_answer: { type: "string" }, brief_reasoning: { type: "string" }, ambiguous_or_flawed: { type: "boolean" }, flaw_note: { type: "string" } }, required: ["item", "brief_reasoning", "ambiguous_or_flawed"] } } }, required: ["answers"] } };
const SOLVE_SYS = "You are an AP course expert solving a practice item as a student would. Solve independently from the stated data only. For multiple choice give choice_index (0-based). For free response give the final answer per part (numbers with units where asked). If the item is ambiguous, has two defensible answers, lacks a needed condition or contradicts its stimulus, set ambiguous_or_flawed true and say why.";
const ctx = (c: Cand) => { const cell = cells().find((x) => x.cellId === c.cellId)!; return `Subject ${SUBJECT}. Unit ${cell.unitCode}; topic ${cell.topic} "${topicTitle.get(cell.topic)}"; target skill ${cell.skill} (${skillLabel.get(cell.skill)}); calculator ${cell.calculator}. ${guideReviewRules(cell.unitCode)}${cell.extraTopics.length ? ` The bundle legitimately spans related topics ${[cell.topic, ...cell.extraTopics].join(", ")}.` : ""}`; };
const mk = (id: string, model: string, sys: string, tool: Json, user: string, max: number): BatchReq => ({ custom_id: id, params: { model, ...think(model), max_tokens: max, system: [{ type: "text", text: sys, cache_control: SYS_CACHE }], tools: [tool], tool_choice: { type: "auto" }, messages: [{ role: "user", content: user }] } });
async function solveStage() {
  const cs = alive(); const reqs = cs.map((c) => mk(`s-${c.key}`, MODELS.solve, SOLVE_SYS, solveTool, `${JSON.stringify(blind(c))}\n\nSolve every item/part and submit via submit_solution (answers[].item = "1" for MC or the part label).`, c.kind === "mc" ? 3000 : 5000));
  const est = estimate(MODELS.solve, reqs.length, 1500, 2200);
  console.log(`solve: ${reqs.length}건 추정 $${est.toFixed(2)} 누적 $${ledger(DIR).spent().toFixed(2)}`);
  await runBatch({ dir: DIR, name: "solve", requests: reqs, budgetUsd: BUDGET(), estimateUsd: est, sync: SYNC, syncConcurrency: Number(process.env.AP_SYNC_CONC ?? 10) });
}
const solved = (c: Cand) => { const r = resultMap("solve").get(`s-${c.key}`); return r ? (toolInput(r as never) as Json | null) : null; };
const numsIn = (s: string) => (s.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
function solverAgrees(c: Cand, sol: Json | null): { ok: boolean | null; note: string } {
  if (!sol) return { ok: null, note: "no_solution" };
  const ans = (sol.answers as Json[]) ?? [];
  if (c.kind === "mc") { const a = ans[0]; const k = (c.item as McPack).key_index; return { ok: !!a && !a.ambiguous_or_flawed && a.choice_index === k, note: a?.ambiguous_or_flawed ? String(a.flaw_note ?? "flagged") : "" }; }
  const f = c.item as FrqPack; const bad: string[] = [];
  for (const pt of f.parts) {
    const a = ans.find((x) => String(x.item).toLowerCase() === pt.label.toLowerCase()); if (!a) { bad.push(`${pt.label}:missing`); continue; }
    if (a.ambiguous_or_flawed) { bad.push(`${pt.label}:flagged`); continue; }
    const exp = pt.rubric_rows.filter((r) => r.requires_numbers && r.points >= 1).flatMap((r) => r.required_elements.flatMap((e) => numsIn(e))).filter((n) => Math.abs(n) > 0);
    if (!exp.length) continue;
    const got = numsIn(String(a.final_answer ?? "") + " " + String(a.brief_reasoning ?? ""));
    const hit = exp.filter((e) => got.some((g) => Math.abs(g - e) <= Math.max(0.0015, Math.abs(e) * 0.0015))).length;
    if (hit / exp.length < 0.5) bad.push(`${pt.label}:numeric`);
  }
  return { ok: bad.length === 0, note: bad.join(",") };
}

const REVIEW_SYS = `You are a strict AP content reviewer. NOTE: numeric keys, table values and rubric structure were computed and independently verified by code, so do not re-derive arithmetic; judge the following five acceptance criteria and set instant_reject for the listed conditions:
(1) scope/skill fit to the given official topic and skill (an item may use prerequisite skills but its dominant demand must be the target topic/skill; no content from later units); (2) key and scoring: the key is the unique defensible answer given the stem and stimulus; FRQ rubric rows are consistent, alternatives valid; (3) stimulus/expression completeness: the stimulus "data" object is the machine-readable specification a figure/table will be rendered from; judge completeness of the DATA and clarity of wording (US English); (4) distractors encode distinct, realistic misconceptions, no length/format giveaway, and the explanation explains each wrong option; (5) exam suitability: time, reading and calculator load typical of the AP exam, no needless arithmetic, calculator designation consistent.
REFERENCE PATTERN (derived from the official CED sample items): MC ~60-100 seconds, four options, a stimulus only when it is needed, options that are values or short parallel expressions, one dominant skill; FRQ 9 points = 3-6 parts whose point values vary from 1 to 5 (for example 1/1/2/5 or 2/2/3/2), rows split into setup/answer/justification/units with explicit conditions for theorems, calculators only where numerical integration/solving is needed. For free-response bundles: each PART has its own assessed skill and topic; judge each part against ITS OWN skill and rubric rows, never against one bundle-level skill (official FRQs mix skills across parts; the bundle's representative skill is only a label). Official point/time grain to respect: Calculus FRQ = 9 points (parts of 1-5 points) in about 15 minutes; Biology long FRQ = 9 points (parts of 1-4 points, a 1-point calculation or reading part is normal) in about 24 minutes; Biology short FRQ = exactly four 1-point parts in about 10 minutes. Do not fail an item for these official grains. Set matches_reference_pattern false only for material deviations (not for correct items with unusual but valid wording). Non-calculator items must have exact-form options. Do not fail an item for being generic or for a context that is a standard textbook scenario.
Agreement of an independent solver is supporting evidence only. Fail when unsure.`;
const reviewTool = { name: "submit_review", description: "Submit the review.", input_schema: { type: "object", properties: {
  scope_skill: { type: "object", properties: { pass: { type: "boolean" }, notes: { type: "string" } }, required: ["pass", "notes"] }, key_scoring: { type: "object", properties: { pass: { type: "boolean" }, notes: { type: "string" } }, required: ["pass", "notes"] },
  stimulus_expression: { type: "object", properties: { pass: { type: "boolean" }, notes: { type: "string" } }, required: ["pass", "notes"] }, distractor_explanation: { type: "object", properties: { pass: { type: "boolean" }, notes: { type: "string" } }, required: ["pass", "notes"] },
  exam_suitability: { type: "object", properties: { pass: { type: "boolean" }, notes: { type: "string" } }, required: ["pass", "notes"] },
  instant_reject: { type: "array", items: { type: "string", enum: ["wrong_key", "multiple_correct", "missing_condition", "wrong_stimulus", "out_of_scope_knowledge"] } },
  matches_reference_pattern: { type: "boolean" }, resembles_known_exam_item: { type: "boolean", description: "true ONLY if the item reproduces a specific recognizable released AP item (same numbers, context and wording). Generic textbook forms (product rule from a table, Riemann sums) are NOT a resemblance." }, summary: { type: "string" } }, required: ["scope_skill", "key_scoring", "stimulus_expression", "distractor_explanation", "exam_suitability", "instant_reject", "matches_reference_pattern", "resembles_known_exam_item", "summary"] } };
const diffTool = { name: "submit_difficulty", description: "Submit provisional difficulty.", input_schema: { type: "object", properties: { label: { type: "string", enum: ["basic_learning", "exam_prep", "advanced_supplement"] }, rationale: { type: "string" }, reading_load: { type: "string", enum: ["low", "medium", "high"] }, computation_load: { type: "string", enum: ["low", "medium", "high"] }, reasoning_steps: { type: "integer" }, representation_changes: { type: "integer" }, difficulty_from_unfair_sources: { type: "boolean" }, est_seconds: { type: "integer" } }, required: ["label", "rationale", "reading_load", "computation_load", "reasoning_steps", "representation_changes", "difficulty_from_unfair_sources", "est_seconds"] } };
const DIFF_SYS = "You tag provisional internal difficulty for AP practice items: basic_learning, exam_prep (target for full mocks) or advanced_supplement. Judge only from concept depth, reasoning steps, representation changes, reading and computation load. Do NOT infer difficulty from any claim of AP score level or from model agreement. Flag difficulty_from_unfair_sources if the item is hard only because of long arithmetic, vagueness, heavy reading or out-of-scope knowledge.";
const full = (c: Cand) => JSON.stringify(c.kind === "mc" ? { ...(c.item as McPack), facts: undefined } : { ...(c.item as FrqPack), facts: undefined });
async function reviewStage() {
  const cs = alive().filter((c) => solved(c));
  const reqs = cs.map((c) => mk(`r-${c.key}`, MODELS.review, REVIEW_SYS, reviewTool, `${ctx(c)}\n\nITEM (with key, rationale/rubric):\n${full(c)}\n\nINDEPENDENT SOLVER OUTPUT:\n${JSON.stringify(solved(c))}`, 3000));
  const est = estimate(MODELS.review, reqs.length, 2800, 1100);
  console.log(`review: ${reqs.length}건 추정 $${est.toFixed(2)} 누적 $${ledger(DIR).spent().toFixed(2)}`);
  await runBatch({ dir: DIR, name: "review", requests: reqs, budgetUsd: BUDGET(), estimateUsd: est, sync: SYNC, syncConcurrency: Number(process.env.AP_SYNC_CONC ?? 10) });
}
async function difficultyStage() {
  const rev = resultMap("review"); const cs = alive().filter((c) => rev.has(`r-${c.key}`));
  const reqs = cs.map((c) => mk(`d-${c.key}`, MODELS.difficulty, DIFF_SYS, diffTool, `${ctx(c)}\n\n${JSON.stringify(blind(c))}`, 1500));
  const est = estimate(MODELS.difficulty, reqs.length, 1400, 600);
  console.log(`difficulty: ${reqs.length}건 추정 $${est.toFixed(2)} 누적 $${ledger(DIR).spent().toFixed(2)}`);
  await runBatch({ dir: DIR, name: "difficulty", requests: reqs, budgetUsd: BUDGET(), estimateUsd: est, sync: SYNC, syncConcurrency: Number(process.env.AP_SYNC_CONC ?? 10) });
}

type Verdict = { key: string; cellId: string; passed: boolean; reasons: string[]; solver?: Json | null; review?: Json | null; difficulty?: Json | null };
function decide(): Verdict[] {
  const ch = checks(); const rev = resultMap("review"); const dif = resultMap("difficulty");
  return buildCands().map((c) => {
    const reasons = [...(ch[c.key]?.reasons ?? ["not_checked"])]; const v: Verdict = { key: c.key, cellId: c.cellId, passed: false, reasons };
    if (reasons.length) return v;
    v.solver = solved(c); const ag = solverAgrees(c, v.solver ?? null);
    if (ag.ok === null) { reasons.push("solver_missing"); return v; }
    if (!ag.ok) reasons.push(`solver_disagrees:${ag.note}`);
    const r = rev.get(`r-${c.key}`); v.review = r ? (toolInput(r as never) as Json | null) : null;
    if (!v.review) { reasons.push("review_missing"); return v; }
    for (const k of ["scope_skill", "key_scoring", "stimulus_expression", "distractor_explanation", "exam_suitability"]) if (!(v.review[k] as Json | undefined)?.pass) reasons.push(`criterion_failed_${k}`);
    for (const x of (v.review.instant_reject as string[]) ?? []) reasons.push(`instant_reject_${x}`);
    if (v.review.matches_reference_pattern === false) reasons.push("reference_pattern_mismatch");
    if (v.review.resembles_known_exam_item) reasons.push("resembles_known_exam_item");
    const d = dif.get(`d-${c.key}`); v.difficulty = d ? (toolInput(d as never) as Json | null) : null;
    if (v.difficulty?.difficulty_from_unfair_sources) reasons.push("difficulty_from_unfair_sources");
    v.passed = reasons.length === 0; return v;
  });
}
async function spotStage() {
  const verd = decide().filter((v) => v.passed); const n = Math.max(1, Math.ceil(verd.length * 0.1));
  const rank = (v: Verdict) => (v.difficulty?.label === "advanced_supplement" ? 200 : v.difficulty?.label === "exam_prep" ? 100 : 0) + Number(v.difficulty?.reasoning_steps ?? 0);
  const by = new Map(buildCands().map((c) => [c.key, c])); const pick = [...verd].sort((a, b) => rank(b) - rank(a)).slice(0, n);
  const reqs = pick.map((v) => mk(`x-${v.key}`, MODELS.spot, SOLVE_SYS, solveTool, `${JSON.stringify(blind(by.get(v.key)!))}\n\nSolve independently and flag any flaw.`, 5000));
  const est = estimate(MODELS.spot, reqs.length, 1500, 2200);
  console.log(`spot: ${reqs.length}건 추정 $${est.toFixed(2)} 누적 $${ledger(DIR).spent().toFixed(2)}`);
  await runBatch({ dir: DIR, name: "spot", requests: reqs, budgetUsd: BUDGET(), estimateUsd: est, sync: SYNC, syncConcurrency: 6 });
}
function reportStage() {
  const by = new Map(buildCands().map((c) => [c.key, c])); const spot = resultMap("spot");
  const verd = decide().map((v) => { const r = spot.get(`x-${v.key}`); if (r && v.passed) { const ag = solverAgrees(by.get(v.key)!, toolInput(r as never) as Json | null); if (ag.ok === false) { v.passed = false; v.reasons.push("fable_spot_check_disagrees"); } } return v; });
  const cs = cells(); const adopted: string[] = []; const reserve: string[] = []; const acceptedItems: (McPack | FrqPack)[] = []; const dupRejected: string[] = [];
  for (const cell of cs) {
    const pass = verd.filter((v) => v.cellId === cell.cellId && v.passed).sort((a, b) => Number(b.difficulty?.label === "exam_prep") - Number(a.difficulty?.label === "exam_prep") || a.key.localeCompare(b.key));
    let got = false;
    for (const v of pass) {
      const it = by.get(v.key)!.item as McPack | FrqPack; const d = gateDuplicate(it, acceptedItems);
      if (d.length) { v.passed = false; v.reasons.push(`duplicate_gate_${d[0]}`); dupRejected.push(v.key); continue; }
      if (!got) { adopted.push(v.key); acceptedItems.push(it); got = true; } else reserve.push(v.key);
    }
  }
  const calls = ["gen", "solve", "review", "difficulty", "spot"].flatMap((st) => readJsonl(path.join(DIR, `${st}.results.jsonl`)).filter((r) => r.ok).map((r) => ({ stage: st, id: r.custom_id as string, model: r.model as string, cost: (r.cost as number) ?? 0 })));
  const total = calls.reduce((s, c) => s + c.cost, 0); const rej: Record<string, number> = {};
  verd.filter((v) => !v.passed).forEach((v) => v.reasons.forEach((r) => { const k = r.replace(/\d+/g, "N").replace(/:.*/, ""); rej[k] = (rej[k] ?? 0) + 1; }));
  const mcAd = adopted.filter((k) => by.get(k)!.kind === "mc").length; const frqAd = adopted.length - mcAd;
  const mcC = verd.filter((v) => by.get(v.key)!.kind === "mc").length; const frqC = verd.length - mcC;
  const wording = { llm: buildCands().filter((c) => c.wording === "llm").length, template: buildCands().filter((c) => c.wording !== "llm").length };
  const unfilled = cs.filter((c) => !adopted.some((k) => by.get(k)!.cellId === c.cellId)).map((c) => c.cellId);
  const report = { run: RUN, subject: SUBJECT, generatedAt: new Date().toISOString(), totalCostUsd: Number(total.toFixed(2)), newSpendSinceBaseline: Number((ledger(DIR).spent() - baseline()).toFixed(2)), cap: CAP_NEW, calls: calls.length, candidates: verd.length, mcCandidates: mcC, frqCandidates: frqC, passedAll: verd.filter((v) => v.passed).length, adopted: adopted.length, mcAdopted: mcAd, frqAdopted: frqAd, reserve: reserve.length, yield: Number((adopted.length / Math.max(1, verd.length)).toFixed(3)), costPerAdopted: Number((total / Math.max(1, adopted.length)).toFixed(3)), callsPerAdopted: Number((calls.length / Math.max(1, adopted.length)).toFixed(1)), duplicateRejected: dupRejected.length, spotChecked: spot.size, wording, rejectionReasons: rej, unfilledCells: unfilled };
  writeFileSync(path.join(DIR, "report.json"), JSON.stringify(report, null, 1));
  const exported = verd.map((v) => { const c = by.get(v.key)!; const cell = cs.find((x) => x.cellId === c.cellId)!; return { candidateKey: v.key, cellId: v.cellId, apSubjectCode: SUBJECT, kind: c.kind, keywordCode: cell.topic, unitCode: cell.unitCode, skillPrimary: cell.skill, structure: c.kind === "mc" ? "standalone" : "frq_multipart", calculator: cell.calculator, archetype: c.archetype, wording: c.wording, reviewState: v.passed ? "auto_passed" : v.reasons.length ? "rejected" : "candidate", gateVersion: "v2-code-first-final-2026-10-08", selectedForSample: adopted.includes(v.key), reserve: reserve.includes(v.key), rejectionReason: v.passed ? null : v.reasons.join("; "), difficultyProvisional: v.difficulty?.label ?? null, difficultyRationale: v.difficulty?.rationale ?? null, payload: c.item, verification: { generatedByCode: true, archetype: c.archetype, facts: (c.pack as Json).facts, seed: (c.pack as Json).seed }, review: v.review ?? null, difficulty: v.difficulty ?? null }; });
  writeFileSync(path.join(DIR, "candidates.json"), JSON.stringify(exported, null, 1));
  console.log(JSON.stringify(report, null, 1));
}
(async () => {
  if (stage === "plan") planStage(); else if (stage === "gen") await genStage(); else if (stage === "check") checkStage(); else if (stage === "solve") await solveStage();
  else if (stage === "review") await reviewStage(); else if (stage === "difficulty") await difficultyStage(); else if (stage === "spot") await spotStage(); else if (stage === "report") reportStage();
  else console.log("stage: plan | gen | check | solve | review | difficulty | spot | report");
})().catch((e) => { console.error(e); process.exit(1); });
