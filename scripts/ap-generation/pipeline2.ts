// AP 코드 우선(verification-first) 생성 파이프라인 v2 (2026-10-08). 정답·표·그래프 수치·루브릭 구조는 Python 원형(scripts/ap-generation/archetypes)이 계산하고
// LLM 은 문장(stem/context/해설)만 쓴다. 결정적 게이트(lib/ap-generation/gates.ts) → 독립 풀이(Opus, 정답 비공개) → 5기준 검토 + 참조 패턴 대조(Sonnet) → 난이도(별도) → 표본(Fable).
//   npx tsx scripts/ap-generation/pipeline2.ts plan|gen|check|solve|review|difficulty|spot|report --run run2 [--sync]
import { describePhysSceneForReview } from "../../lib/problem-figures/templates/ap-phys-scene";
import { describeChemSceneForReview } from "../../lib/problem-figures/templates/ap-chem-scene";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { runBatch, toolInput, estimate, ledger, type BatchReq } from "../mock-exam-generation/batch-lib";
import { validateBlueprint, type Blueprint } from "../../lib/ap-generation/blueprint";
import { bundleReferenceChecks, refineParts } from "../../lib/ap-generation/part-refine";
import { bioDataShortDesignChecks } from "../../lib/ap-generation/archetype-checks/bio-data-short";
import { gateBioFrq } from "../../lib/ap-generation/bio-frq-checks";
import { gateMicroFrq } from "../../lib/ap-generation/micro-frq-checks";
import { gateStatsFrq } from "../../lib/ap-generation/stats-frq-checks";
import { generatorDefects } from "../../lib/ap-generation/generator-defects";
import { normalizeReview, numsIn, recoverFromBlocks, reviewFromToolBlocks } from "../../lib/ap-generation/review-parse";
import { difficultyContext } from "../../lib/ap-generation/stats-difficulty";
import { calibrateFrq, calibrateMc, gateDuplicate, gateFrq, gateMc, gateNoCalcExact, wordingPreserves, type FrqPack, type McPack } from "../../lib/ap-generation/gates";
import { gateMathWrapping } from "../../lib/ap-generation/math-wrapping";
import { flattenSet, gateStatsSet, isSetPack, mergeSet, setSizeOf, setVerdict, type SetMember, type SetMeta } from "../../lib/ap-generation/stats-set";
import { loadEnvLocal } from "../keywords/db";
import { createHash } from "node:crypto";
import { POLICY, manifestIssues, type RunManifest } from "../../lib/ap-generation/pipeline-policy";
import { gateGuideFrq, gateGuideMc } from "../../lib/ap-generation/guide-gates";
import { guideReviewRules as _grr, guideWordingRules as _gwr } from "../../lib/ap-generation/subjects/calc-ab";
import { GUIDES } from "../../lib/ap-generation/subjects/calc-bc";
import { statsReviewRules, statsWordingRules } from "../../lib/ap-generation/subjects/stats";
import { physicsGuide, physicsWordingRules } from "../../lib/ap-generation/subjects/physics1";
import { physicsCGuide, physicsCWordingRules } from "../../lib/ap-generation/subjects/physics-c-mech";
import { precalcGuide, precalcWordingRules } from "../../lib/ap-generation/subjects/precalculus";
import { chemistryGuide, chemistryWordingRules } from "../../lib/ap-generation/subjects/chem";
import { biologyGuide, biologyWordingRules } from "../../lib/ap-generation/subjects/bio";
import { csaGuide, csaWordingRules } from "../../lib/ap-generation/subjects/csa";
import { microGuide, microWordingRules } from "../../lib/ap-generation/subjects/micro";
import { macroGuide, macroWordingRules } from "../../lib/ap-generation/subjects/macro";
import { psychGuide, psychWordingRules } from "../../lib/ap-generation/subjects/psych";
import { gatePsychFrq } from "../../lib/ap-generation/psych-frq-checks";
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
import { AP_PYTHON as PY } from "./py";
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

const GUIDE = GUIDES[SUBJECT as keyof typeof GUIDES]; // Bio/Micro 는 과목 가이드가 아직 없다(S2 재검증은 가이드 없이 공식 과목 기준으로 평가)
const guideWordingRules = () => SUBJECT === "ap_biology" && !process.env.AP_LEGACY_ITEMS ? biologyWordingRules() : SUBJECT === "ap_computer_science_a" ? csaWordingRules() : SUBJECT === "ap_microeconomics" ? microWordingRules() : SUBJECT === "ap_macroeconomics" ? macroWordingRules() : SUBJECT === "ap_psychology" ? psychWordingRules() : SUBJECT === "ap_chemistry" ? chemistryWordingRules() : SUBJECT === "ap_precalculus" ? precalcWordingRules() : SUBJECT === "ap_physics_c_mechanics" ? physicsCWordingRules() : SUBJECT === "ap_physics_1" ? physicsWordingRules() : SUBJECT === "ap_statistics" ? statsWordingRules() : !GUIDE ? "" : _gwr().replace(/ap_calculus_ab|AP Calculus AB/g, GUIDE.subject).replace(/for AB/g, SUBJECT === "ap_calculus_bc" ? "for BC" : "for AB");
const guideReviewRules = (u: string) => { if (SUBJECT === "ap_biology" && !process.env.AP_LEGACY_ITEMS) { const un = biologyGuide.units.find((x) => x.unit === u); return un ? `UNIT ${un.unit} SCOPE for AP Biology — in scope: ${un.inScope.join("; ")}. OUT of scope: ${un.outOfScope.join("; ")}. Difficulty levers allowed: ${biologyGuide.difficultyAllowed.join("; ")}. Banned difficulty sources: ${biologyGuide.difficultyBanned.join("; ")}.` : ""; } if (SUBJECT === "ap_computer_science_a") { const un = csaGuide.units.find((x) => x.unit === u); return un ? `UNIT ${un.unit} SCOPE for AP Computer Science A — in scope: ${un.inScope.join("; ")}. OUT of scope: ${un.outOfScope.join("; ")}. Difficulty levers allowed: ${csaGuide.difficultyAllowed.join("; ")}. Banned difficulty sources: ${csaGuide.difficultyBanned.join("; ")}.` : ""; } if (SUBJECT === "ap_psychology") { const un = psychGuide.units.find((x) => x.unit === u); return un ? `UNIT ${un.unit} SCOPE for AP Psychology — in scope: ${un.inScope.join("; ")}. OUT of scope: ${un.outOfScope.join("; ")}. Difficulty levers allowed: ${psychGuide.difficultyAllowed.join("; ")}. Banned difficulty sources: ${psychGuide.difficultyBanned.join("; ")}.` : ""; } if (SUBJECT === "ap_macroeconomics") { const un = macroGuide.units.find((x) => x.unit === u); return un ? `UNIT ${un.unit} SCOPE for AP Macroeconomics — in scope: ${un.inScope.join("; ")}. OUT of scope: ${un.outOfScope.join("; ")}. Difficulty levers allowed: ${macroGuide.difficultyAllowed.join("; ")}. Banned difficulty sources: ${macroGuide.difficultyBanned.join("; ")}.` : ""; } if (SUBJECT === "ap_microeconomics") { const un = microGuide.units.find((x) => x.unit === u); return un ? `UNIT ${un.unit} SCOPE for AP Microeconomics — in scope: ${un.inScope.join("; ")}. OUT of scope: ${un.outOfScope.join("; ")}. Difficulty levers allowed: ${microGuide.difficultyAllowed.join("; ")}. Banned difficulty sources: ${microGuide.difficultyBanned.join("; ")}.` : ""; } if (SUBJECT === "ap_chemistry") { const un = chemistryGuide.units.find((x) => x.unit === u); return un ? `UNIT ${un.unit} SCOPE for AP Chemistry — in scope: ${un.inScope.join("; ")}. OUT of scope: ${un.outOfScope.join("; ")}. Difficulty levers allowed: ${chemistryGuide.difficultyAllowed.join("; ")}. Banned difficulty sources: ${chemistryGuide.difficultyBanned.join("; ")}.` : ""; } if (SUBJECT === "ap_precalculus") { const un = precalcGuide.units.find((x) => x.unit === u); return un ? `UNIT ${un.unit} SCOPE for AP Precalculus — in scope: ${un.inScope.join("; ")}. OUT of scope: ${un.outOfScope.join("; ")}. Difficulty levers allowed: ${precalcGuide.difficultyAllowed.join("; ")}. Banned difficulty sources: ${precalcGuide.difficultyBanned.join("; ")}.` : ""; } if (SUBJECT === "ap_physics_c_mechanics") { const un = physicsCGuide.units.find((x) => x.unit === u); return un ? `UNIT ${un.unit} SCOPE for AP Physics C: Mechanics — in scope: ${un.inScope.join("; ")}. OUT of scope: ${un.outOfScope.join("; ")}. Difficulty levers allowed: ${physicsCGuide.difficultyAllowed.join("; ")}. Banned difficulty sources: ${physicsCGuide.difficultyBanned.join("; ")}.` : ""; } if (SUBJECT === "ap_physics_1") { const un = physicsGuide.units.find((x) => x.unit === u); return un ? `UNIT ${un.unit} SCOPE for AP Physics 1 — in scope: ${un.inScope.join("; ")}. OUT of scope: ${un.outOfScope.join("; ")}. Difficulty levers allowed: ${physicsGuide.difficultyAllowed.join("; ")}. Banned difficulty sources: ${physicsGuide.difficultyBanned.join("; ")}.` : ""; } if (SUBJECT === "ap_statistics") return statsReviewRules(u); if (!GUIDE) return ""; const un = GUIDE.units.find((x) => x.unit === u); return un ? `UNIT ${un.unit} SCOPE for ${SUBJECT === "ap_calculus_bc" ? "BC" : "AB"} — in scope: ${un.inScope.join("; ")}. OUT of scope: ${un.outOfScope.join("; ")}. Difficulty levers allowed: ${GUIDE.difficultyAllowed.join("; ")}. Banned difficulty sources: ${GUIDE.difficultyBanned.join("; ")}.` : _grr(u); };
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
type Cand = { set?: SetMeta; key: string; cellId: string; archetype: string; kind: "mc" | "frq_bundle"; pack: Json; polished?: Json; item: McPack | FrqPack | null; wording: "llm" | "mixed" | "template" };

const SEEDS_PER_CELL = Number(process.env.AP_MC_CANDS ?? 4);
const FRQ_CANDS = Number(process.env.AP_FRQ_CANDS ?? 4);
function writeManifest(extra: Partial<RunManifest> = {}) {
  const sha = (t: string) => createHash("sha1").update(t).digest("hex").slice(0, 12);
  const commit = spawnSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf-8" }).stdout.trim();
  const dirty = spawnSync("git", ["status", "--porcelain", "scripts/ap-generation", "lib/ap-generation"], { encoding: "utf-8" }).stdout.trim() ? "+dirty" : "";
  const m: RunManifest = { run: RUN, subject: SUBJECT, generatorCommit: commit + dirty, gateVersion: "v2-code-first-final-2026-10-08", reviewerPromptHash: sha(REVIEW_SYS + JSON.stringify(reviewTool)), difficultyPromptHash: sha(DIFF_SYS + JSON.stringify(diffTool)),
    flags: { flatReview: Boolean(process.env.AP_FLAT_REVIEW), subjectNotes: Boolean(process.env.AP_SUBJECT_NOTES), requireBlueprint: Boolean(process.env.AP_REQUIRE_BLUEPRINT), legacyItems: Boolean(process.env.AP_LEGACY_ITEMS), repair: Boolean(process.env.AP_REPAIR) }, arm: process.env.AP_ARM, repairDefinition: process.env.AP_REPAIR_DEF, parserHash: sha(readFileSync(path.resolve(process.cwd(), "lib/ap-generation/review-parse.ts"), "utf-8")), models: { ...MODELS }, policy: POLICY, seeds: { first: [SEED0], note: "seed0 = first seed tried per archetype; packs.json records pack_id = archetype-sSEED" }, frozenAt: new Date().toISOString(), ...extra };
  const issues = manifestIssues(m); if (issues.length) throw new Error(issues.join(", "));
  writeFileSync(path.join(DIR, POLICY.manifestFile), JSON.stringify(m, null, 1));
}
function planStage() {
  const lst = py(["list", process.env.AP_LIST ?? (SUBJECT === "ap_calculus_bc" ? "bc" : "ab")]) as { mc: string[]; frq: string[] };
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
const SUBJ_LABEL: Record<string, string> = { ap_calculus_ab: "AP Calculus", ap_calculus_bc: "AP Calculus", ap_biology: "AP Biology", ap_microeconomics: "AP Microeconomics", ap_macroeconomics: "AP Macroeconomics", ap_psychology: "AP Psychology", ap_statistics: "AP Statistics", ap_physics_1: "AP Physics 1", ap_physics_c_mechanics: "AP Physics C: Mechanics", ap_precalculus: "AP Precalculus", ap_chemistry: "AP Chemistry", ap_computer_science_a: "AP Computer Science A" };
const WORD_SYS = `You are a careful ${SUBJ_LABEL[SUBJECT] ?? "AP"} item writer. A CODE generator has already computed and verified every number, table value, option and misconception. Your job is only the WORDING:
- polish the stem so it reads like a clean AP exam stem (US English). You MUST keep every number, symbol and every $...$ math block of the base stem exactly as given; you may rephrase the plain words and may add a short realistic context ONLY if no numbers/quantities change. Never mention a table that the base stem does not mention. Never reveal the answer.
- do NOT write an explanation (the code writes it); submit only the stem.
For free-response bundles you rewrite part prompts in the same way (keep every number and $...$ block) and add a one-sentence design_note.`;
const mcWordTool = { name: "submit_wording", description: "Submit polished stem and explanation.", input_schema: { type: "object", properties: { stem: { type: "string" }, explanation_en: { type: "string" } }, required: ["stem"] } };
const frqWordTool = { name: "submit_frq_wording", description: "Submit polished prompts.", input_schema: { type: "object", properties: { prompts: { type: "object", additionalProperties: { type: "string" } }, design_note: { type: "string" } }, required: ["prompts", "design_note"] } };
const FEEDBACK: Record<string, string> = process.env.AP_FEEDBACK_FILE && existsSync(process.env.AP_FEEDBACK_FILE) ? JSON.parse(readFileSync(process.env.AP_FEEDBACK_FILE, "utf-8")) : {};
function wordReq(c: Cell, pack: Json, id: string): BatchReq {
  const fbText = FEEDBACK[id] ? `\n\nREPAIR (single attempt): the previous wording of this item was rejected for the reasons below. Rewrite ONLY the failing wording (the stem and/or, if the feedback concerns the explanation, a rewritten explanation_en that shows the worked computation for the key and why each distractor is wrong); every number, symbol, $...$ block, option and key is fixed by code and must stay exactly as given. Submit stem and explanation_en.\nREVIEW FEEDBACK:\n${FEEDBACK[id]}` : "";
  const body0 = c.kind === "mc"
    ? `BASE STEM:\n${pack.stem}\n\nSTIMULUS (already shown to the student): ${JSON.stringify(pack.stimulus)}\n\nOPTIONS WITH RATIONALE (do not change options):\n${(pack.options as Json[]).map((o, i) => `${i === pack.key_index ? "KEY" : "WRONG"}: ${o.text} — ${o.why}`).join("\n")}\n\nSubmit via submit_wording.`
    : `BUNDLE: ${pack.title}\nSTIMULUS: ${JSON.stringify(pack.stimulus)}\nPART PROMPTS (keep numbers and math blocks):\n${(pack.parts as Json[]).map((p) => `(${p.label}) ${p.prompt}`).join("\n")}\n\nSubmit via submit_frq_wording with prompts keyed by part label.`;
  const body = body0 + fbText;
  return { custom_id: id, params: { model: MODELS.gen, ...think(MODELS.gen), max_tokens: c.kind === "mc" ? 2500 : 4000, system: [{ type: "text", text: WORD_SYS + "\n" + guideWordingRules(), cache_control: SYS_CACHE }], tools: [c.kind === "mc" ? mcWordTool : frqWordTool], tool_choice: { type: "auto" }, messages: [{ role: "user", content: body }] } };
}
const bpFile = () => path.join(DIR, "blueprint-check.json");
const bpCheck = (): Record<string, string[]> => (existsSync(bpFile()) ? readJson<Record<string, string[]>>(bpFile()) : {});
/** 설계도 검증(생성 전, LLM 호출 없음). AP_REQUIRE_BLUEPRINT=1 이면 설계도 없는 팩도 실패. 실패한 팩은 문장 생성·검토에 가지 않는다(비용 0). */
function blueprintStage() {
  const packs = genPacks(); const ctx = { skills: skillSet, topicUnit: unitOf as Map<string, string> }; const out: Record<string, string[]> = {};
  const issuesOf = (p: Json): string[] => { const bp = p.blueprint as Partial<Blueprint> | undefined; return bp ? validateBlueprint(bp, ctx).map((x) => x.code) : (process.env.AP_REQUIRE_BLUEPRINT ? ["missing_blueprint"] : []); };
  for (const c of cells()) packs[c.cellId].forEach((p, i) => {
    if (isSetPack(p)) { const set = gateStatsSet(p, { size: setSizeOf(SUBJECT) }).map((x) => `set:${x}`); p.items.forEach((m, j) => { out[`${c.cellId}-k${i}-q${j + 1}`] = [...issuesOf(m as unknown as Json), ...set]; }); return; } // 공유 세트: 문항마다 설계도 + 세트 수준 검사(무료)
    out[`${c.cellId}-k${i}`] = issuesOf(p as Json);
  });
  writeFileSync(bpFile(), JSON.stringify(out, null, 1)); const bad = Object.entries(out).filter(([, v]) => v.length);
  console.log(`blueprint: ${Object.keys(out).length}건 중 실패 ${bad.length}건(호출 비용 0)`, bad.slice(0, 6));
}
async function genStage() {
  const packs = genPacks(); const bp = bpCheck();
  const reqs: BatchReq[] = [];
  for (const c of cells()) packs[c.cellId].forEach((p, i) => { if (isSetPack(p)) return; if ((bp[`${c.cellId}-k${i}`] ?? []).length) return; reqs.push(wordReq(c, p, `${c.cellId}-k${i}`)); });
  const est = estimate(MODELS.gen, reqs.length, 1800, 1100);
  console.log(`gen(문장): ${reqs.length}건 추정 $${est.toFixed(2)} (동기 2배), 누적 $${ledger(DIR).spent().toFixed(2)}, 신규 상한 $${BUDGET().toFixed(2)}`);
  await runBatch({ dir: DIR, name: "gen", requests: reqs, budgetUsd: BUDGET(), estimateUsd: est, sync: SYNC, syncConcurrency: Number(process.env.AP_SYNC_CONC ?? 10) });
}

// ---------- 후보 조립 ----------
// 2026-10-12 TeX 위생(R3): 해설에서 선택지 텍스트의 $ 를 벗기지 않는다(수식이 $...$ 밖으로 노출되던 문제). 게이트는 비교 시 자체적으로 plain 처리한다.
/** 해설은 코드가 만든다(정답 근거 + 선택지별 오개념). LLM 은 stem 문장만 다듬는다 — 해설 속 파생 수치 환각을 막기 위해. */
const structuredExplanation = (p: Json) => {
  const o = p.options as { text: string; why: string }[]; const k = p.key_index as number;
  return `The correct answer is ${o[k].text}. ${o[k].why}\n` + o.filter((_, i) => i !== k).map((x) => `${x.text} is incorrect: ${x.why}`).join("\n");
};
function buildCands(): Cand[] {
  const packs = genPacks(); const gen = resultMap("gen"); const out: Cand[] = [];
  for (const c of cells()) packs[c.cellId].forEach((pack, i) => {
    if (isSetPack(pack)) { // 공유 세트: 문항 3개로 펼쳐 같은 단계(풀이·검토·난이도)를 통과시키고, 보고 단계에서 세트로 합친다
      flattenSet(pack, `${c.cellId}-k${i}`).forEach((m, j) => { const mp = m as unknown as McPack & { seed?: number }; mp.seed = (pack as unknown as Json).seed as number; out.push({ key: `${c.cellId}-k${i}-q${j + 1}`, set: m.set, cellId: c.cellId, archetype: m.archetype, kind: "mc", pack: { ...(m as unknown as Json), seed: (pack as unknown as Json).seed }, item: { ...mp, explanation_en: structuredExplanation(m as unknown as Json) } as McPack, wording: "template" }); });
      return;
    }
    const key = `${c.cellId}-k${i}`; const r = gen.get(key); const polished = r ? (toolInput(r as never) as Json | null) : null;
    let item: McPack | FrqPack | null = null; let wording: "llm" | "mixed" | "template" = "template";
    if (c.kind === "mc") {
      const mp = { ...(pack as unknown as McPack) } as McPack;
      let stem = mp.stem; const expl = structuredExplanation(pack);
      if (polished && typeof polished.stem === "string" && typeof polished.explanation_en === "string" && wordingPreserves(mp.stem, polished.stem).length === 0) { stem = polished.stem; wording = "llm"; }
      let explF = process.env.AP_KEEP_EXPLANATION && typeof (pack as Json).explanation_en === "string" ? ((pack as Json).explanation_en as string) : expl; // 구방식 arm: LLM 이 쓴 해설을 그대로 평가
      if (false) explF = expl; if (process.env.AP_REPAIR && polished && typeof polished.explanation_en === "string" && polished.explanation_en.length > 60 && wordingPreserves(expl, polished.explanation_en).length === 0) explF = polished.explanation_en as string; // 수선 모드: 해설 문장 재작성 허용(수치 보존 확인)
      item = { ...mp, stem, explanation_en: explF };
    } else {
      const fp = JSON.parse(JSON.stringify(pack)) as FrqPack;
      if (polished && polished.prompts && typeof polished.prompts === "object") {
        // 파트 단위 채택(무료 재검사): 수치·수식·동사·자료 참조가 맞는 파트만 새 문장을 쓰고 번들 일관성이 깨지면 전부 되돌린다. 번들 검증 상태는 번들 전체 통과로만 결정된다.
        const rr = refineParts(fp, polished.prompts as Record<string, string>); for (let i = 0; i < fp.parts.length; i++) fp.parts[i].prompt = rr.pack.parts[i].prompt; wording = rr.wording;
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
    let reasons = c.kind === "mc" ? [...gateMc(SUBJECT, c.item as McPack), ...calibrateMc(SUBJECT, c.item as McPack), ...(calcAbGuide ? gateGuideMc(calcAbGuide, c.item as McPack) : []), ...gateNoCalcExact(c.item as McPack), ...gateMathWrapping(c.item as never)] : [...gateMathWrapping(c.item as never), ...gateFrq(SUBJECT, c.item as FrqPack, skillSet, { requirePartTopics: SUBJECT === "ap_biology" && !process.env.AP_LEGACY_ITEMS, topics: new Set(topicTitle.keys()) }), ...calibrateFrq(c.item as FrqPack, SUBJECT), ...(calcAbGuide ? gateGuideFrq(calcAbGuide, c.item as FrqPack) : [])];
    for (const code of bpCheck()[c.key] ?? []) reasons.push(`blueprint:${code}`); // 설계도 실패는 LLM 단계 전에 차단
    if (c.item && c.kind === "frq_bundle" && SUBJECT === "ap_biology" && !process.env.AP_LEGACY_ITEMS) reasons.push(...gateBioFrq(c.item as unknown as Record<string, unknown>, { topics: new Set(topicTitle.keys()) }).map((x) => `bio_free:${x.code}`)); // Bio FRQ 무료 결정적 검사 (공통 (a)(c) 규칙)
    if (c.item && c.kind === "frq_bundle" && (c.item as unknown as { archetype?: string }).archetype === "frq_bio_data_short") reasons.push(...bioDataShortDesignChecks(c.item as unknown as Record<string, unknown>).map((x) => x.code)); // 원형 내부 설계 조건 (b): 전역 게이트 아님
    if (c.item && c.kind === "frq_bundle" && (SUBJECT === "ap_microeconomics" || SUBJECT === "ap_macroeconomics") && !process.env.AP_LEGACY_ITEMS) reasons.push(...gateMicroFrq(c.item as unknown as Record<string, unknown>, { topics: new Set(topicTitle.keys()), skills: skillSet }).map((x) => `micro_free:${x.code}`)); // Micro FRQ 무료 결정적 설계 검사
    if (c.item && c.kind === "frq_bundle" && SUBJECT === "ap_psychology") reasons.push(...gatePsychFrq(c.pack as unknown as Record<string, unknown>).map((x) => `psych_free:${x.code}`)); // Psychology FRQ 무료 결정적 설계 검사(AAQ·EBQ 구조·지문 숫자 일관성)
    if (c.item && c.kind === "frq_bundle" && SUBJECT === "ap_statistics") reasons.push(...gateStatsFrq(c.item as unknown as FrqPack).map((x) => `stats_free:${x}`)); // Statistics FRQ 무료 결정적 설계 검사(10점·1점 행 10개·유형별 필수 요소·키보드 입력)
    if (c.item && c.kind === "frq_bundle" && !process.env.AP_LEGACY_ITEMS) reasons.push(...bundleReferenceChecks(c.item as unknown as FrqPack).map((x) => `bundle_ref:${x}`)); // 번들 수준 참조·조건 일관성
    if (c.item) reasons.push(...generatorDefects(c.item as unknown as Record<string, unknown>).map((d) => `generator_defect:${d.code}`)); // 생성기 결함(중괄호 미닫힘·표 본문 누락 등)은 LLM 단계 전에 차단
    if (process.env.AP_EVAL_BYPASS) reasons = reasons.filter((r) => r.startsWith("generator_defect")); // 결함 주입 평가: 주입과 무관한 구형식 품질 게이트로 평가에서 빠지지 않게 한다
    if (process.env.AP_SKIP_GUIDE_MEMBERSHIP) reasons = reasons.filter((r) => !["archetype_not_in_guide", "frq_template_not_in_guide"].includes(r)); // 구방식 arm 은 코드 원형 목록 밖이 당연하다(구조 규칙만 면제)
    const soft: string[] = process.env.AP_SOFT_COVERAGE ? reasons.filter((r) => r === "explanation_does_not_cover_distractors") : []; // 민감도 분석: 해설 문구 일치 규칙을 비차단으로 두고 LLM 단계까지 진행
    if (soft.length) reasons = reasons.filter((r) => !soft.includes(r));
    const extraF = path.join(DIR, "extra_reasons.json"); if (existsSync(extraF)) reasons.push(...((readJson<Record<string, string[]>>(extraF)[c.key]) ?? [])); // 구방식 arm 의 자체 검증 코드 결과
    if (!c.polished && !process.env.AP_FIXED_WORDING) reasons.push("wording_missing"); // 결함 주입 평가(S1c)는 이미 완성된 문항을 그대로 쓴다
    out[c.key] = { reasons, wording: c.wording, soft } as { reasons: string[]; wording: string };
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

// 렌더 이미지 모드(S1c 그림·표 결함 평가): 학생이 보는 렌더 PNG 를 입력으로 주고 데이터 명세는 숨긴다. 이 모드는 검토기의 입력 변경(= 수정된 검토기)이므로 결과를 별도로 보고한다.
const IMG_DIR = process.env.AP_IMAGE_DIR; const imgOf = (c: Cand): unknown[] | null => { if (!IMG_DIR) return null; const f = path.join(IMG_DIR, `${c.key}.png`); return existsSync(f) ? [{ type: "image", source: { type: "base64", media_type: "image/png", data: readFileSync(f).toString("base64") } }] : null; };
const hideSpec = (m: McPack): McPack => (IMG_DIR && imgOf({ key: "" } as Cand) === null && false ? m : m);
const withImg = (c: Cand, text: string): string | unknown[] => { const im = imgOf(c); return im ? [...im, { type: "text", text: `The figure/table for this item is shown in the attached image (rendered exactly as a student sees it).\n\n${text}` }] : text; };
const stimFor = (c: Cand, st: McPack["stimulus"]) => (imgOf(c) ? { kind: st.kind, description: "(shown in the attached image)" } : st);
// AP Physics 1: 장면 그림을 LLM 이 읽을 수 있게 결정적 텍스트 설명으로 덧붙인다(AP_FIGURE_TEXT=1). 장면 모델에서만 파생하며 화면에 보이지 않는 값은 쓰지 않는다. 검토기·풀이기의 입력이 바뀌므로 결과 보고에 명시한다.
const figText = (m: McPack): Json | undefined => {
  if (!process.env.AP_FIGURE_TEXT) return undefined;
  const o: Json = {}; const sc = (m.stimulus as { data?: { variant?: string; scene?: unknown } } | undefined)?.data;
  if (sc?.variant === "phys_scene" && sc.scene) o.figure_shown_to_student = describePhysSceneForReview(sc.scene as never);
  if (sc?.variant === "chem_pes" && Array.isArray((sc as { peaks?: unknown }).peaks)) o.figure_shown_to_student = describeChemSceneForReview("chem_pes", { type: "pes", peaks: (sc as { peaks: { energy: number; electrons: number }[] }).peaks, unit: (sc as { unit?: string }).unit });
  if (sc?.variant === "chem_particles" && sc.scene) o.figure_shown_to_student = describeChemSceneForReview("chem_particles", sc.scene as never);
  const os = (m as unknown as { option_scenes?: unknown[] }).option_scenes;
  if (Array.isArray(os)) o.option_figures_shown_to_student = os.map((x, i) => `Diagram ${String.fromCharCode(65 + i)}: ${describePhysSceneForReview(x as never)}`);
  return Object.keys(o).length ? o : undefined;
};
const blind = (c: Cand): Json => {
  if (c.kind === "mc") { const m = c.item as McPack; return { stimulus: stimFor(c, m.stimulus), ...figText(m), stem: m.stem, options: m.options.map((o) => o.text) }; }
  const f = c.item as FrqPack; const src = (f as unknown as { set_intro?: string }).set_intro; return { title: f.title, ...(src ? { source_text: src } : {}), stimulus: f.stimulus, calculator_part: f.calculator, parts: f.parts.map((p) => ({ label: p.label, prompt: p.prompt, points: p.points })) }; // set_intro(논문·출처 본문, Psychology FRQ)가 있으면 풀이기에게도 보인다
};
const solveTool = { name: "submit_solution", description: "Submit your independent solution.", input_schema: { type: "object", properties: { answers: { type: "array", items: { type: "object", properties: { item: { type: "string" }, choice_index: { type: ["integer", "null"] }, final_answer: { type: "string" }, brief_reasoning: { type: "string" }, ambiguous_or_flawed: { type: "boolean" }, flaw_note: { type: "string" } }, required: ["item", "brief_reasoning", "ambiguous_or_flawed"] } } }, required: ["answers"] } };
const SOLVE_SYS = "You are an AP course expert solving a practice item as a student would. Solve independently from the stated data only. For multiple choice give choice_index (0-based). For free response give the final answer per part (numbers with units where asked). If the item is ambiguous, has two defensible answers, lacks a needed condition or contradicts its stimulus, set ambiguous_or_flawed true and say why.";
const ctx = (c: Cand) => { const cell0 = cells().find((x) => x.cellId === c.cellId)!; const cell = c.set ? { ...cell0, topic: (c.item as McPack).topic, skill: (c.item as McPack).skill, unitCode: unitOf.get((c.item as McPack).topic) ?? cell0.unitCode } : cell0; return `Subject ${SUBJECT}. Unit ${cell.unitCode}; topic ${cell.topic} "${topicTitle.get(cell.topic)}"; target skill ${cell.skill} (${skillLabel.get(cell.skill)}); calculator ${cell.calculator}. ${guideReviewRules(cell.unitCode)}${cell.extraTopics.length ? ` The bundle legitimately spans related topics ${[cell.topic, ...cell.extraTopics].join(", ")}.` : ""}`; };
const mk = (id: string, model: string, sys: string, tool: Json, user: string | unknown[], max: number): BatchReq => ({ custom_id: id, params: { model, ...think(model), max_tokens: max, system: [{ type: "text", text: sys, cache_control: SYS_CACHE }], tools: [tool], tool_choice: { type: "auto" }, messages: [{ role: "user", content: user }] } });
async function solveStage() {
  const cs = alive(); const reqs = cs.map((c) => mk(`s-${c.key}`, MODELS.solve, SOLVE_SYS, solveTool, withImg(c, `${JSON.stringify(blind(c))}\n\nSolve every item/part and submit via submit_solution (answers[].item = "1" for MC or the part label).`), c.kind === "mc" ? 3000 : 5000));
  const est = estimate(MODELS.solve, reqs.length, 1500, 2200);
  console.log(`solve: ${reqs.length}건 추정 $${est.toFixed(2)} 누적 $${ledger(DIR).spent().toFixed(2)}`);
  await runBatch({ dir: DIR, name: "solve", requests: reqs, budgetUsd: BUDGET(), estimateUsd: est, sync: SYNC, syncConcurrency: Number(process.env.AP_SYNC_CONC ?? 10) });
}
/** 검토 결과 한 건의 입력 객체: 단일 도구 블록이 정상이면 그것, 필드별로 쪼개진 블록이면 복원(recoverFromBlocks). */
const reviewInput = (r: Json | undefined): Json | null => { if (!r) return null; const content = ((r.message as Json | undefined)?.content as Json[] | undefined) ?? []; const blocks = content.filter((c) => c.type === "tool_use").map((c) => c.input as Record<string, unknown>); return (reviewFromToolBlocks(blocks.length ? blocks : [toolInput(r as never) as Record<string, unknown>]) as Json | null); };
const reviewMap = () => { const m = resultMap("review"); for (const [k, v] of resultMap("review3")) m.set(k, v); for (const [k, v] of resultMap("review2")) m.set(k, v); for (const [k, v] of resultMap("review4")) m.set(k, v); return m; }; // review2 = 불완전 출력 재요청분(원 결과 보존)
const solved = (c: Cand) => { const r = resultMap("solve").get(`s-${c.key}`) ?? resultMap("solve2").get(`s-${c.key}`); return r ? (toolInput(r as never) as Json | null) : null; };
function solverAgrees(c: Cand, sol: Json | null): { ok: boolean | null; note: string } {
  if (!sol) return { ok: null, note: "no_solution" };
  const ans = (sol.answers as Json[]) ?? [];
  if (c.kind === "mc") { const a = ans[0]; const k = (c.item as McPack).key_index; return { ok: !!a && !a.ambiguous_or_flawed && a.choice_index === k, note: a?.ambiguous_or_flawed ? String(a.flaw_note ?? "flagged") : "" }; }
  const f = c.item as FrqPack; const bad: string[] = [];
  for (const pt of f.parts) {
    const a = ans.find((x) => String(x.item).toLowerCase() === pt.label.toLowerCase()); if (!a) { bad.push(`${pt.label}:missing`); continue; }
    if (a.ambiguous_or_flawed) { bad.push(`${pt.label}:flagged`); continue; }
    const ev = (f.expected_values ?? []).filter((e) => e.part.toLowerCase() === pt.label.toLowerCase()); if (f.expected_values && !ev.length) continue; // 구조화 기대값이 있는 번들: 해당 파트에 기대값이 없으면 수치 비교를 하지 않는다
    const exp = f.expected_values ? ev.map((e) => e.value).filter((n) => Math.abs(n) > 0) : pt.rubric_rows.filter((r) => r.requires_numbers && r.points >= 1).flatMap((r) => r.required_elements.filter((e) => /^\s*[-−]?\d[\d.,]*\s*%?\s*$/.test(e)).flatMap((e) => numsIn(e))).filter((n) => Math.abs(n) > 0); // 구형 번들만 루브릭의 순수 수치 요소(설명 문장 제외)
    if (!exp.length) continue;
    const got = numsIn(String(a.final_answer ?? "") + " " + String(a.brief_reasoning ?? ""));
    const tolOf = (e: number) => ev.find((x) => x.value === e)?.tolerance ?? 0; const hit = exp.filter((e) => got.some((g) => Math.abs(g - e) <= Math.max(0.0015, Math.abs(e) * 0.0015, tolOf(e)))).length;
    if (hit / exp.length < 0.5) bad.push(`${pt.label}:numeric`);
  }
  return { ok: bad.length === 0, note: bad.join(",") };
}

const REVIEW_SYS_BASE = `You are a strict AP content reviewer. NOTE: numeric keys, table values and rubric structure were computed and independently verified by code, so do not re-derive arithmetic; judge the following five acceptance criteria and set instant_reject for the listed conditions:
(1) scope/skill fit to the given official topic and skill (an item may use prerequisite skills but its dominant demand must be the target topic/skill; no content from later units); (2) key and scoring: the key is the unique defensible answer given the stem and stimulus; FRQ rubric rows are consistent, alternatives valid; (3) stimulus/expression completeness: the stimulus "data" object is the machine-readable specification a figure/table will be rendered from; judge completeness of the DATA and clarity of wording (US English); (4) distractors encode distinct, realistic misconceptions, no length/format giveaway, and the explanation explains each wrong option; (5) exam suitability: time, reading and calculator load typical of the AP exam, no needless arithmetic, calculator designation consistent.
REFERENCE PATTERN (derived from the official CED sample items): MC ~60-100 seconds, four options, a stimulus only when it is needed, options that are values or short parallel expressions, one dominant skill; FRQ 9 points = 3-6 parts whose point values vary from 1 to 5 (for example 1/1/2/5 or 2/2/3/2), rows split into setup/answer/justification/units with explicit conditions for theorems, calculators only where numerical integration/solving is needed. Time estimates (per-point minutes) are an internal reference only, never an official per-item time: do NOT reject or penalize an item merely because its estimated minutes differ; judge the actual task load (steps, data reading, writing required) and review the solution. For free-response bundles: each PART has its own assessed skill and topic; judge each part against ITS OWN skill and rubric rows, never against one bundle-level skill (official FRQs mix skills across parts; the bundle's representative skill is only a label). Official point/time grain to respect: Calculus FRQ = 9 points (parts of 1-5 points) in about 15 minutes; Biology long FRQ = 9 points (parts of 1-4 points, a 1-point calculation or reading part is normal) in about 24 minutes; Biology short FRQ = exactly four 1-point parts in about 10 minutes. Do not fail an item for these official grains. Set matches_reference_pattern false only for material deviations (not for correct items with unusual but valid wording). Non-calculator items must have exact-form options. Do not fail an item for being generic or for a context that is a standard textbook scenario.
Agreement of an independent solver is supporting evidence only. Fail when unsure.`;
// 재검증(S2): 코드가 키를 검증하지 않은 기존(LLM 직접 생성) 문항용. 코드 우선 전제 문장을 바꾸고 과목별 공식 기준 메모를 덧붙인다. S1a/S1b(칼큘러스 동결 검토기)에는 영향 없음.
const SUBJECT_NOTES: Record<string, string> = {
  ap_biology: "SUBJECT NOTES (AP Biology, 2027 CED, eight units): four options; a four-function, scientific or graphing calculator is allowed and the AP Biology Equations and Formulas sheet is provided (mean, standard deviation, standard error, chi-square with its table, Hardy-Weinberg, rate, exponential and logistic growth, water potential with R = 0.0831 liter bars per mole K, Simpson's diversity index, surface area and volume), so judge the biology (relationship choice, data and model reading, prediction and argumentation), not arithmetic. Interpretation, claim and prediction items use fixed sentences: exactly one is correct and each wrong sentence encodes a distinct named misconception. Standard conventions: degrees of freedom for chi-square = number of outcomes minus one; mean ± 2SE ranges that do not overlap support a difference; temperature in kelvins = Celsius + 273 in water potential. Quantitative enzyme-kinetics equations are out of scope; qualitative saturation, inhibition and optimum curves are in scope. A graph, bar chart, table or strand diagram is generated from the same variables as the stem numbers. Items must test data/experiment interpretation, prediction or argumentation, not rote recall, and reject conclusions the data do not support. Every number the item uses must appear in the stimulus data. Free response: judge each PART against its own skill and its own rubric rows (the bundle skill is only a label); long FRQ = 9 points, short FRQ = four 1-point parts. Per-point time estimates are an internal reference only: never reject for estimated minutes. The bundle's representative skill is only a label: NEVER fail scope_skill because the parts assess different official skills. Alternative accepted phrasings listed in a rubric row (alt_solutions) count as accepted answers; do not call a rubric rigid when equivalent wordings are listed. TOPIC FIT is judged at the level of the whole bundle, not per part: data-analysis parts that assess the official data skills (describing a table, calculating, statistical reasoning) are legitimate even when they can be answered from the table; do NOT fail scope_skill because some parts do not require the topic concept. Fail scope_skill only if the bundle as a whole never requires the topic concept or the content belongs to another topic. OFFICIAL FRQ PART PURPOSES (CED Exam Information, AP Biology): a short FRQ has exactly four 1-point parts (this is the official structure, it is not a 9-point FRQ). Q3 Scientific Investigation: A describe a concept or process, B identify an experimental procedure (variable, control), C state a null hypothesis or predict results, D justify the prediction. Q4 Conceptual Analysis: A describe, B explain, C predict the cause or effect of a change or disruption, D justify the prediction. Q5 Analyze a Model or Visual: A describe characteristics of the visual, B explain relationships between characteristics, C represent a relationship (draw, complete, write), D explain how the model relates to a larger principle. Q6 Analyze Data: A and B describe data (B may be a calculation), C use data to evaluate a hypothesis or prediction, D explain how the results relate to biological principles. Describe and explain parts of a short FRQ legitimately ask for a concept that the scenario names, so do NOT fail a short FRQ because such a part can be answered from biology knowledge without data. A long FRQ is 9 points: Q1 A1 B3 C3 D2, Q2 A1 B4 (graph construction, scored on paper by a checklist) C2 D2. For multiple choice, data-skill items (4.B, 5.A to 5.D) whose data context belongs to the stated topic are legitimate even if the topic concept itself is not required; do not fail scope_skill only because the answer can be found from the table or a formula. In multiple choice, each wrong option encodes a named misconception; judge whether the rationale is accurate and specific to the option and do not fail it merely because the correct option is the most detailed one when it is not more than a few words longer than the others.",
  ap_macroeconomics: "SUBJECT NOTES (AP Macroeconomics): FIVE options (A-E), options may be short sentences or direction combinations; graphs (AD-AS, money market, loanable funds, foreign exchange, Phillips curve, production possibilities) must be fully specified as data with labeled axes, curves and labeled points; calculations (GDP, unemployment and inflation rates, multipliers, money creation, exchange conversion) must be unambiguous. Monetary actions that change the money supply are stated for an economy with limited reserves; an economy with ample reserves is described through administered interest rates. The bundle's representative skill is only a label: never fail scope_skill because the parts assess different official skills. Rubric rows are judged on meaning; listed alternative wordings count as accepted. Free response: long FRQ = 10 points, short FRQ = 5 points with parts of 1-3 points mixing graphing, calculation and explanation (setup and answer rows are normal); judge each part against its own rubric rows, and do not reject for low per-part demand when the grain matches the official short-FRQ format.",
  ap_psychology: "SUBJECT NOTES (AP Psychology, CED effective Fall 2025, five units): FOUR options (A-D); no calculator or reference sheet is part of the exam, so statistics values must be hand-computable and no formula is assumed. This item was written by a human author from the CED required content and its key is NOT code-verified (except the descriptive-statistics items): you are one of the independent checks. Judge psychological ACCURACY against mainstream, CED-aligned textbook psychology: the key must be correct under standard terminology, every wrong option must be clearly wrong for a student who knows the concept (watch for a second defensible concept, a distractor that is also true of the scenario, and terms used loosely), the stem must not need outside knowledge beyond the CED required content, and findings that are contested or failed to replicate must not be stated as fact. Concept-application items give a short original scenario and one named concept; research-method items must be decidable from the procedure described; set-based items share a research scenario and each question must depend on it. FRQ: Article Analysis (Q1: parts A-F, 7 points) and Evidence-Based (Q2: parts A-E mapped from the official A, B(i), B(ii), C(i), C(ii), 7 points) with an original (fictional) study or three sources; rubric rows are analytic and meaning-based, every number in a model answer must be readable from the source text or table, and the sources must give enough evidence for at least two different, correct claims and two different course concepts. SCOPE CONVENTIONS (do not fail an item for these): the five units are numbered 1-5 exactly as listed in the unit scope line; research methods and design (Practice 2), data interpretation and statistics (Practice 3) are assessed inside the content of every unit, so for a Practice 2 or 3 item the topic is the context in which the skill is used and an item passes scope when its scenario belongs to the topic OR to another topic of the same unit, or when it is a generic research or statistics scenario whose only fault is a loose topic label (note the label issue in the notes but do not fail scope for it); a figure or table is not required for every 3.x item (a stated coefficient, p value, or effect size is a legitimate representation); in a shared-stimulus set the questions share one study description, and it is normal (as in the official sample sets) for one question to be answerable from concept knowledge alone, so judge each question on its own key, its distractors, and whether the set as a whole uses the shared scenario; for the Evidence-Based question the official task assesses practices 1 and 4, so parts C and E are tagged 1.A and parts A, B and D tagged 4.x by design (do not fail scope for it), the bank does not include a refute-or-modify task, a source with a stated limitation (no random assignment, a confound) may legitimately be cited as evidence if the model answer does not overclaim from it, and a model answer must support a defensible claim while the rubric accepts any other defensible claim and any correct concept; recall-style items are acceptable when the stem presents a short scenario, but fail an item whose stem merely restates the definition of the keyed term or whose distractors are trivially implausible.",
  ap_microeconomics: "SUBJECT NOTES (AP Microeconomics): FIVE options (A-E), options may be short sentences; graphs must be fully specified as data (curves or labeled points with prices and quantities); calculations (elasticity, surplus, profit, MR=MC, payoff matrices) must be unambiguous. The bundle's representative skill is only a label: never fail scope_skill because the parts assess different official skills. Rubric rows are judged on meaning; listed alternative wordings count as accepted. Free response: long FRQ = 10 points, short FRQ = 5 points with parts of 1-2 points mixing calculation and explanation (setup and answer rows are normal); judge each part against its own rubric rows, and do not reject for low per-part demand when the grain matches the official short-FRQ format.",
  ap_calculus_ab: "",
  ap_chemistry: "SUBJECT NOTES (AP Chemistry, 2027 CED, nine units): four options; scientific or graphing calculators are recommended so judge the chemistry (relationship choice, representation reading, error direction, proportional reasoning), not arithmetic. Interpretation, claim, error-direction and model-evaluation items use fixed sentences: exactly one is correct and each wrong sentence encodes a distinct named misconception. Standard assumptions apply unless stated (25 degC, ideal gases and dilute ideal solutions, Kw = 1.0e-14, R = 8.314 J/(mol K) = 0.08206 L atm/(mol K), F = 96,485 C/mol). Organic chemistry and Arrhenius-equation calculations are out of scope. A graph, spectrum or particle diagram is generated from the same variables as the stem numbers: judge whether the described figure supports the question. Free response is fixed: three long questions of 10 points and four short questions of 4 points (46 points); rubric rows are mostly 1 point (expression, numeric with units, diagram or graph checklist, claim, justification) and every model answer is an ALTON self-review reference, not official AP scoring. The bundle's representative skill is only a label: never fail scope_skill because the parts assess different official skills; judge each part against its own tagged skill and its own rubric rows. A short question is four points made of parts worth one or two points (four 1-point parts or a 1/2/1 split are normal) and a long question is ten points; do not reject a bundle only because it is a sequence of short parts. Drawings (Lewis diagrams, sketches, graphs) are answered on paper and scored from the checklist row, so a stimulus with no figure data is complete when the part asks the student to draw it. Photoelectron-spectrum binding energies are in MJ per mole (1 eV = 0.0965 MJ/mol): realistic values are 1s about 52.6 for O, 104 for Na, 178 for Si and 273 for Cl, so large 1s values are correct. Standard textbook molecules and scenarios (CH3OH versus C2H6, XeF4, titration of a weak acid) are acceptable.",
  ap_computer_science_a: "SUBJECT NOTES (AP Computer Science A, 2027 CED, four units, Java): four options; no calculator is part of the exam, so judge the programming (tracing, boundary conditions, named misconceptions such as off-by-one, integer division, aliasing, short-circuit evaluation, shadowing), not arithmetic. The code in the stimulus was compiled and run with a real JDK: every output-prediction key is the printed result and every wrong option is the result of executing mutated code that embodies a named misconception, so do not re-trace long loops by hand beyond what you need to judge clarity. Code-completion, bug-fix, description and precondition items were verified by compiling every candidate and running boundary tests: exactly one option passes. Inheritance and polymorphism are not in the 2027 topic list. Free response is fixed: four questions of 9 points (Methods and Control Structures, Class Design, Data Analysis with ArrayList, 2D Array), typed Java; the reference solution and an independent alternative both passed the stored unit tests and each wrong solution failed at least one, and every model answer is an ALTON self-review reference, not official AP scoring. Rubric rows are 1 point each and judge one behavior (loop bounds, condition, accumulation, guard, return, header). The bundle's representative skill is only a label.",
  ap_physics_c_mechanics: "SUBJECT NOTES (AP Physics C: Mechanics, 2027, calculus-based): four options; four-function, scientific and graphing calculators are allowed so judge the physics (law selection, derivative or integral set-up, representation reading, proportional reasoning), not arithmetic. Position, velocity, force, torque and potential-energy functions are given explicitly in the stem and use only polynomial, exponential, sine and cosine forms; reject calculus beyond that. Interpretation and claim items use fixed sentences: exactly one is correct and each wrong sentence encodes a distinct named misconception. Standard model assumptions apply unless stated otherwise (negligible air resistance, ideal strings, pulleys and springs, g = 9.8 m/s^2). The course has NO circuits, waves, optics, thermodynamics, fluids or electrostatics; reject such content. A graph is generated from the same variables as the stem numbers: judge whether the described figure supports the question. When an item has figure_shown_to_student or option_figures_shown_to_student, those fields describe exactly what the student sees. Free response weights are fixed by type (provisional, same as the sibling Physics C courses): Mathematical Routines 10 points, Translation Between Representations 12, Experimental Design and Analysis 10, Qualitative/Quantitative Translation 8; rubric rows are mostly 1 point (expression, numeric with units, diagram or graph checklist, claim, justification, design) and every model answer is an ALTON self-review reference, not official AP scoring.",
  ap_precalculus: "SUBJECT NOTES (AP Precalculus, 2027, three units: polynomial and rational, exponential and logarithmic, trigonometric and polar functions): four options. Items marked no-calculator (Part A of multiple choice, Part B of free response) must have exact answers computable by hand: integers, fractions, radicals, exact multiples of pi or expressions, never three-decimal options. Items marked graphing-calculator-required (Part B of multiple choice, Part A of free response) use the calculator for regression, zeros, intersections, extrema or evaluation in radian mode and give three-decimal answers; judge the mathematics (choosing a model, reading a representation, interpreting a result), not arithmetic. Functions, tables and graphs are fully specified by the stem or the figure: judge whether the described table or graph supports the question. Options with expressions or interval sets are fixed text: exactly one is correct and each wrong option encodes a distinct named misconception. The course has NO calculus (no limits, derivatives or integrals), no matrices, vectors or parametric equations; reject such content. Free response has four fixed types, each 6 points with 1-point rubric rows: Function Concepts and Modeling a Non-Periodic Context (graphing calculator required), Modeling a Periodic Context and Symbolic Manipulations (no calculator); answers are handwritten on paper.",
  ap_physics_1: "SUBJECT NOTES (AP Physics 1, 2027 CED, algebra-based): four options; four-function, scientific and graphing calculators are allowed so judge the physics (law selection, representation reading, proportional reasoning), not arithmetic. Interpretation and claim items use fixed sentences: exactly one is correct and each wrong sentence encodes a distinct named misconception. Standard model assumptions apply unless stated otherwise (negligible air resistance, ideal strings, pulleys and springs, g = 9.8 m/s^2). The course has NO circuits, waves, optics, thermodynamics or electrostatics; reject such content. A diagram or graph is generated from the same variables as the stem numbers: judge whether the described figure supports the question and whether choice figures give away the key. When an item has figure_shown_to_student or option_figures_shown_to_student, those fields describe exactly what the student sees (labels, directions, relative arrow lengths); judge the figure from them, and treat raw scene numbers such as mag, scale or ymax as internal drawing data that the student cannot read. Choice items label the four figures Diagram A to D in order. Free response weights are fixed by type: Mathematical Routines 10 points, Translation Between Representations 12, Experimental Design and Analysis 10, Qualitative/Quantitative Translation 8; rubric rows are mostly 1 point (expression, numeric with units, diagram or graph checklist, claim, justification, design) and every model answer is an ALTON self-review reference, not official AP scoring.",
  ap_statistics: "SUBJECT NOTES (AP Statistics, 2027 CED): four options; a graphing calculator with statistics functions is allowed and the formula sheet and tables are provided, so judge the statistical decision, not arithmetic. Interpretation items use fixed sentences: exactly one is correct in context and each wrong sentence encodes a distinct named misinterpretation. Conditions (random, 10%, large counts, normality) must follow the CED wording. Rounding convention must be stated when options are decimals. Deleted topics (geometric distribution, chi-square goodness-of-fit, inference for a slope, nonlinear transformations, combining random variables) must not appear. Reject observational-study items whose key draws a causal conclusion. Figures are specified as data and rendered by the platform; judge the completeness of the data (axes, units, labels). Free response (STATISTICS STANDARD, overrides the calculus and biology point grains stated above): each FRQ is exactly 10 points = ten 1-point rubric rows over 4-5 parts, four FRQs per exam, about 22 minutes each; Question 1 is a multi-focus question whose parts assess different skills and topics (including a part asking for a valid investigative question, skill 1.A); never fail an FRQ because it is not 9 points, and judge each part against its own skill and topic. A table or figure in an FRQ must belong to the same study or context as the parts that use it. Student responses are typed, never drawn.",
};
const CONCEPT_ITEMS = SUBJECT === "ap_psychology"; // 사람이 쓴 개념 문항: 키는 코드로 검증되지 않았다 — 검토기에게 사실을 직접 확인시킨다(통계 문항의 수치는 코드 검증)
const REVIEW_SYS = CONCEPT_ITEMS ? REVIEW_SYS_BASE.replace("NOTE: numeric keys, table values and rubric structure were computed and independently verified by code, so do not re-derive arithmetic; judge", "NOTE: this item was written by a human author and its key was NOT verified by code (except numeric values in descriptive-statistics items, which were recomputed by code). An independent blind solver output is provided; check the key and the psychological facts yourself. Judge") + "\n" + (SUBJECT_NOTES[SUBJECT] ?? "") : !process.env.AP_LEGACY_ITEMS && process.env.AP_SUBJECT_NOTES ? REVIEW_SYS_BASE + "\n" + (SUBJECT_NOTES[SUBJECT] ?? "") : process.env.AP_LEGACY_ITEMS
  ? REVIEW_SYS_BASE.replace("NOTE: numeric keys, table values and rubric structure were computed and independently verified by code, so do not re-derive arithmetic; judge", "NOTE: this item was written by an LLM and its key was NOT verified by code. An independent solver output is provided; check the key, the arithmetic and the stimulus data yourself. Judge") + "\n" + (SUBJECT_NOTES[SUBJECT] ?? "")
  : REVIEW_SYS_BASE;
const reviewTool = { name: "submit_review", description: "Submit the review.", input_schema: { type: "object", properties: {
  scope_skill: { type: "object", properties: { pass: { type: "boolean" }, notes: { type: "string" } }, required: ["pass", "notes"] }, key_scoring: { type: "object", properties: { pass: { type: "boolean" }, notes: { type: "string" } }, required: ["pass", "notes"] },
  stimulus_expression: { type: "object", properties: { pass: { type: "boolean" }, notes: { type: "string" } }, required: ["pass", "notes"] }, distractor_explanation: { type: "object", properties: { pass: { type: "boolean" }, notes: { type: "string" } }, required: ["pass", "notes"] },
  exam_suitability: { type: "object", properties: { pass: { type: "boolean" }, notes: { type: "string" } }, required: ["pass", "notes"] },
  instant_reject: { type: "array", items: { type: "string", enum: ["wrong_key", "multiple_correct", "missing_condition", "wrong_stimulus", "out_of_scope_knowledge"] } },
  matches_reference_pattern: { type: "boolean" }, resembles_known_exam_item: { type: "boolean", description: "true ONLY if the item reproduces a specific recognizable released AP item (same numbers, context and wording). Generic textbook forms (product rule from a table, Riemann sums) are NOT a resemblance." }, summary: { type: "string" } }, required: ["scope_skill", "key_scoring", "stimulus_expression", "distractor_explanation", "exam_suitability", "instant_reject", "matches_reference_pattern", "resembles_known_exam_item", "summary"] } };
const diffTool = { name: "submit_difficulty", description: "Submit provisional difficulty.", input_schema: { type: "object", properties: { label: { type: "string", enum: ["basic_learning", "exam_prep", "advanced_supplement"] }, rationale: { type: "string" }, reading_load: { type: "string", enum: ["low", "medium", "high"] }, computation_load: { type: "string", enum: ["low", "medium", "high"] }, reasoning_steps: { type: "integer" }, representation_changes: { type: "integer" }, difficulty_from_unfair_sources: { type: "boolean" }, est_seconds: { type: "integer" } }, required: ["label", "rationale", "reading_load", "computation_load", "reasoning_steps", "representation_changes", "difficulty_from_unfair_sources", "est_seconds"] } };
const DIFF_SYS = "You tag provisional internal difficulty for AP practice items: basic_learning, exam_prep (target for full mocks) or advanced_supplement. Judge only from concept depth, reasoning steps, representation changes, reading and computation load. Do NOT infer difficulty from any claim of AP score level or from model agreement. Flag difficulty_from_unfair_sources if the item is hard only because of long arithmetic, vagueness, heavy reading or out-of-scope knowledge.";
const full = (c: Cand) => JSON.stringify(c.kind === "mc" ? { ...(c.item as McPack), set: undefined, stimulus: stimFor(c, (c.item as McPack).stimulus), ...figText(c.item as McPack), facts: undefined } : { ...(c.item as FrqPack), facts: undefined });
async function reviewStage() {
  const cs = alive().filter((c) => solved(c));
  const reqs = cs.map((c) => { const q = mk(`r-${c.key}`, MODELS.review, REVIEW_SYS, reviewTool, withImg(c, `${ctx(c)}\n\nITEM (with key, rationale/rubric):\n${full(c)}\n\nINDEPENDENT SOLVER OUTPUT:\n${JSON.stringify(solved(c))}`), c.kind === "mc" ? 3000 : 6000); if (c.kind !== "mc" && process.env.AP_FLAT_REVIEW) (q.params as Json).tools = [flatReviewTool]; return q; }); // 다음 라운드부터: FRQ 검토는 평탄 도구로 처음부터 받아 재요청 비용을 줄인다(AP_FLAT_REVIEW=1)
  const est = estimate(MODELS.review, reqs.length, 2800, 1100);
  console.log(`review: ${reqs.length}건 추정 $${est.toFixed(2)} 누적 $${ledger(DIR).spent().toFixed(2)}`);
  await runBatch({ dir: DIR, name: "review", requests: reqs, budgetUsd: BUDGET(), estimateUsd: est, sync: SYNC, syncConcurrency: Number(process.env.AP_SYNC_CONC ?? 10) });
}
async function solveMoreStage() { // 이미 끝난 solve 에 없는 후보만 추가 요청(원 결과 보존): 평가 대상이 늘었을 때
  const have = resultMap("solve"); const cs = alive().filter((c) => !have.has(`s-${c.key}`));
  const reqs = cs.map((c) => mk(`s-${c.key}`, MODELS.solve, SOLVE_SYS, solveTool, withImg(c, `${JSON.stringify(blind(c))}\n\nSolve every item/part and submit via submit_solution (answers[].item = "1" for MC or the part label).`), c.kind === "mc" ? 3000 : 5000));
  console.log(`solve-more: ${reqs.length}건`); if (!reqs.length) return;
  await runBatch({ dir: DIR, name: "solve2", requests: reqs, budgetUsd: BUDGET(), estimateUsd: estimate(MODELS.solve, reqs.length, 1500, 2200), sync: SYNC, syncConcurrency: 10 });
}
async function reviewMoreStage() { // review 도 같은 방식으로 새 후보만(review2 와 별개 이름 review3)
  const have = reviewMap(); const cs = alive().filter((c) => solved(c) && !have.has(`r-${c.key}`));
  const reqs = cs.map((c) => mk(`r-${c.key}`, MODELS.review, REVIEW_SYS, reviewTool, withImg(c, `${ctx(c)}\n\nITEM (with key, rationale/rubric):\n${full(c)}\n\nINDEPENDENT SOLVER OUTPUT:\n${JSON.stringify(solved(c))}`), c.kind === "mc" ? 3000 : 6000));
  console.log(`review-more: ${reqs.length}건`); if (!reqs.length) return;
  await runBatch({ dir: DIR, name: "review3", requests: reqs, budgetUsd: BUDGET(), estimateUsd: estimate(MODELS.review, reqs.length, 2800, 1100), sync: SYNC, syncConcurrency: 10 });
}
async function reviewRetryStage() { // 불완전·깨진 검토 출력만 한 번 다시 요청한다(같은 프롬프트·같은 후보; 최초 후보 수에는 영향 없음)
  const rev = resultMap("review"); const cs = alive().filter((c) => solved(c) && normalizeReview(reviewInput(rev.get(`r-${c.key}`))).malformed.length > 0);
  const reqs = cs.map((c) => mk(`r-${c.key}`, MODELS.review, REVIEW_SYS, reviewTool, withImg(c, `${ctx(c)}\n\nITEM (with key, rationale/rubric):\n${full(c)}\n\nINDEPENDENT SOLVER OUTPUT:\n${JSON.stringify(solved(c))}`), c.kind === "mc" ? 3000 : 6000));
  console.log(`review-retry: ${reqs.length}건`); if (!reqs.length) return;
  await runBatch({ dir: DIR, name: "review2", requests: reqs, budgetUsd: BUDGET(), estimateUsd: estimate(MODELS.review, reqs.length, 2800, 1100), sync: SYNC, syncConcurrency: 10 });
}
const flatReviewTool = { name: "submit_review", description: "Submit the review as ONE flat call (all fields in this single call).", input_schema: { type: "object", properties: Object.fromEntries([...["scope_skill", "key_scoring", "stimulus_expression", "distractor_explanation", "exam_suitability"].flatMap((k) => [[`${k}_pass`, { type: "boolean" }], [`${k}_notes`, { type: "string" }]]), ["instant_reject", { type: "array", items: { type: "string", enum: ["wrong_key", "multiple_correct", "missing_condition", "wrong_stimulus", "out_of_scope_knowledge"] } }], ["matches_reference_pattern", { type: "boolean" }], ["resembles_known_exam_item", { type: "boolean" }], ["summary", { type: "string" }]]), required: ["scope_skill_pass", "key_scoring_pass", "stimulus_expression_pass", "distractor_explanation_pass", "exam_suitability_pass", "instant_reject", "matches_reference_pattern", "resembles_known_exam_item", "summary"] } };
async function reviewRetry2Stage() { // 2차 재요청: 여전히 읽을 수 없는 검토만, 도구 호출을 강제(tool_choice=tool, 사고 없음)해 한 블록으로 받는다. 같은 프롬프트·같은 후보.
  const rev = reviewMap(); const cs = alive().filter((c) => solved(c) && normalizeReview(reviewInput(rev.get(`r-${c.key}`))).malformed.length > 0);
  const reqs = cs.map((c) => { const q = mk(`r-${c.key}`, MODELS.review, REVIEW_SYS, reviewTool, withImg(c, `${ctx(c)}\n\nITEM (with key, rationale/rubric):\n${full(c)}\n\nINDEPENDENT SOLVER OUTPUT:\n${JSON.stringify(solved(c))}`), c.kind === "mc" ? 3000 : 6000); (q.params as Json).tools = [flatReviewTool]; return q; });
  console.log(`review-retry2: ${reqs.length}건`); if (!reqs.length) return;
  await runBatch({ dir: DIR, name: "review4", requests: reqs, budgetUsd: BUDGET(), estimateUsd: estimate(MODELS.review, reqs.length, 2800, 1100), sync: SYNC, syncConcurrency: 10 });
}
/** Statistics: 원형이 선언한 구조 사실(단계·개념·자료 수)을 판정 입력에 덧붙인다(docs/ap/statistics-difficulty.md). 선언이 없거나 다른 과목이면 빈 문자열. */
const diffBrief = (c: Cand): string => difficultyContext(SUBJECT, c.kind, c.item);
async function difficultyStage() {
  const rev = reviewMap(); const cs = alive().filter((c) => rev.has(`r-${c.key}`));
  const reqs = cs.map((c) => mk(`d-${c.key}`, MODELS.difficulty, DIFF_SYS, diffTool, `${ctx(c)}\n\n${JSON.stringify(blind(c))}${diffBrief(c)}`, 1500));
  const est = estimate(MODELS.difficulty, reqs.length, 1400, 600);
  console.log(`difficulty: ${reqs.length}건 추정 $${est.toFixed(2)} 누적 $${ledger(DIR).spent().toFixed(2)}`);
  await runBatch({ dir: DIR, name: "difficulty", requests: reqs, budgetUsd: BUDGET(), estimateUsd: est, sync: SYNC, syncConcurrency: Number(process.env.AP_SYNC_CONC ?? 10) });
}

type Verdict = { soft?: string[]; key: string; cellId: string; passed: boolean; reasons: string[]; solver?: Json | null; review?: Json | null; difficulty?: Json | null };
function decide(): Verdict[] {
  const ch = checks(); const rev = reviewMap(); const dif = resultMap("difficulty");
  return buildCands().map((c) => {
    const reasons = [...(ch[c.key]?.reasons ?? ["not_checked"])]; const v: Verdict = { key: c.key, cellId: c.cellId, passed: false, reasons, soft: (ch[c.key] as { soft?: string[] } | undefined)?.soft ?? [] };
    if (reasons.length) return v;
    v.solver = solved(c); const ag = solverAgrees(c, v.solver ?? null);
    if (ag.ok === null) { reasons.push("solver_missing"); return v; }
    if (!ag.ok) reasons.push(`solver_disagrees:${ag.note}`);
    const r = rev.get(`r-${c.key}`); const nr = normalizeReview(reviewInput(r)); v.review = nr.review;
    if (!v.review) { reasons.push("review_missing"); return v; }
    if (nr.malformed.length) { reasons.push(`review_malformed:${nr.malformed.join(",")}`); return v; }
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
  // 공유 세트: 세 문항이 모두 통과해야 세트 통과. 한 문항이라도 반려면 문항 전부에 같은 반려를 적는다(부분 통과 세트는 재고에 들어가지 않는다).
  const setIds = [...new Set([...by.values()].filter((c) => c.set).map((c) => c.set!.id))];
  for (const sid of setIds) { const mem = verd.filter((v) => by.get(v.key)?.set?.id === sid); const sv = setVerdict(mem.map((v) => ({ passed: v.passed, reasons: v.reasons })), setSizeOf(SUBJECT)); if (!sv.passed) for (const v of mem) { v.passed = false; for (const r of sv.reasons) if (!v.reasons.includes(r)) v.reasons.push(r); } }
  const cs = cells(); const adopted: string[] = []; const reserve: string[] = []; const acceptedItems: (McPack | FrqPack)[] = []; const dupRejected: string[] = [];
  for (const cell of cs) {
    const pass = verd.filter((v) => v.cellId === cell.cellId && v.passed && (!by.get(v.key)?.set || by.get(v.key)!.set!.index === 0)).sort((a, b) => Number(b.difficulty?.label === "exam_prep") - Number(a.difficulty?.label === "exam_prep") || a.key.localeCompare(b.key));
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
  const hardest = (xs: Verdict[]) => { const o = ["advanced_supplement", "exam_prep", "basic_learning"]; return xs.map((x) => x.difficulty?.label as string | undefined).filter((l): l is string => !!l).sort((a, b) => o.indexOf(a) - o.indexOf(b))[0] ?? null; };
  const exported = verd.filter((v) => !by.get(v.key)?.set || by.get(v.key)!.set!.index === 0).map((v) => { const c = by.get(v.key)!; const mem = c.set ? verd.filter((x) => by.get(x.key)?.set?.id === c.set!.id) : [v]; const cell = cs.find((x) => x.cellId === c.cellId)!; return { candidateKey: c.set ? c.set.id : v.key, cellId: v.cellId, apSubjectCode: SUBJECT, kind: c.kind, keywordCode: cell.topic, unitCode: cell.unitCode, skillPrimary: cell.skill, structure: c.set ? "shared_stimulus_set" : c.kind === "mc" ? "standalone" : "frq_multipart", calculator: cell.calculator, archetype: c.archetype, wording: c.wording, reviewState: v.passed ? "auto_passed" : v.reasons.length ? "rejected" : "candidate", gateVersion: "v2-code-first-final-2026-10-08", selectedForSample: adopted.includes(v.key), reserve: reserve.includes(v.key), rejectionReason: v.passed ? null : (c.set ? [...new Set(mem.flatMap((x) => x.reasons))] : v.reasons).join("; "), difficultyProvisional: c.set ? hardest(mem) : v.difficulty?.label ?? null, difficultyRationale: v.difficulty?.rationale ?? null, payload: c.set ? mergeSet(mem.map((x) => by.get(x.key)!.item as unknown as SetMember)) : c.item, verification: { generatedByCode: true, archetype: c.archetype, facts: (c.pack as Json).facts, seed: (c.pack as Json).seed }, review: c.set ? mem.map((x) => x.review ?? null) : v.review ?? null, difficulty: c.set ? mem.map((x) => x.difficulty ?? null) : v.difficulty ?? null }; });
  writeFileSync(path.join(DIR, "candidates.json"), JSON.stringify(exported, null, 1));
  console.log(JSON.stringify(report, null, 1));
}
(async () => {
  if (stage === "plan") planStage(); else if (stage === "blueprint") blueprintStage(); else if (stage === "gen") await genStage(); else if (stage === "check") checkStage(); else if (stage === "solve") await solveStage();
  else if (stage === "review") await reviewStage(); else if (stage === "difficulty") await difficultyStage(); else if (stage === "spot") await spotStage(); else if (stage === "report") reportStage(); else if (stage === "solve-more") await solveMoreStage(); else if (stage === "review-more") await reviewMoreStage(); else if (stage === "review-retry2") await reviewRetry2Stage(); else if (stage === "review-retry") await reviewRetryStage(); else if (stage === "verdicts") { writeFileSync(path.join(DIR, "verdicts.json"), JSON.stringify(decide(), null, 1)); console.log("verdicts.json 기록"); } else if (stage === "manifest") { baseline(); writeManifest(); console.log("manifest 기록: " + path.join(DIR, POLICY.manifestFile)); }
  else console.log("stage: plan | gen | check | solve | review | difficulty | spot | report");
})().catch((e) => { console.error(e); process.exit(1); });
