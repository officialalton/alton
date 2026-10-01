// 난이도(easy/medium/hard)별 원형 공용 도구 — 담당 D(lines_angles_triangles·right_triangles_trigonometry·one_variable_data·
// two_variable_data·inference_margin_error·evaluating_statistical_claims) 전용.
// - easy/medium 원형은 hard 와 같은 프레임워크(원형 ID + 시드로 재현, verification_js 재계산, 그룹 키 = 원형ID/변형)를 쓰되
//   hard 전용 기계 검사(풀이 단계 ≥5·결합 개념 ≥2)는 난이도에 맞는 기준(easy ≥2·medium ≥3 단계)으로 바꾼다.
// - 문장-변수 의미 일치(명사-수식 매핑표) 기계 검사: 생성기가 Instance.bindings 로 '명사 → 값' 표를 내보내면, 같은 문장 안에서
//   명사와 값이 가까이 놓였는지 검사한다.
// - 정성형(선지가 서술문) 문항은 선지 수식 평가를 건너뛰고, verification_js 가 '인쇄된 지문'을 직접 읽어 정답 선지를 고른다.
import { createHash } from "node:crypto";
import type { Archetype, Instance } from "./types";
import { GenFail } from "./types";
import { checkNotation, runVerification, verifyInstance, type VerifyResult } from "./verify";
import { bodyShingles, generateOne, jaccard, type Fmt } from "./sweep";
import { checkContent } from "@/lib/problem-content-check";
import { composeProblemText } from "@/lib/problem-question";
import { findBannedWords } from "@/lib/problem-generation/common-quality-gate";
import { SKILL_BY_CODE } from "@/lib/problem-taxonomy";

export type Level = "easy" | "medium" | "hard";
export type Binding = { noun: string | string[]; value: string | number };
export type BInstance = Instance & { bindings?: Binding[] };
export type LArch = Archetype & { level: Level; qualitative?: boolean };

/** 생성기가 finish() 결과에 명사→값 매핑표를 붙인다. */
export const withBind = (inst: Instance, bindings: Binding[]): BInstance => ({ ...inst, bindings });
export const asLevel = (a: Archetype, level: Level = "hard"): LArch => ({ ...a, level });

const sentences = (t: string) => t.replace(/\$/g, "").split(/(?<=[.?!])\s+/);
const WINDOW = 80;
const NUMWORDS: Record<number, string[]> = { 2: ["two", "twice", "double", "half"], 3: ["three", "triple", "third"], 4: ["four", "fourth"], 5: ["five", "fifth"], 6: ["six"], 7: ["seven"], 8: ["eight"], 9: ["nine"], 10: ["ten"], 11: ["eleven"], 12: ["twelve"] };
const esc = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** 명사(들 중 하나)와 값이 같은 문장에서 WINDOW 글자 안에 있는지. 표에 선언된 모든 쌍이 만족해야 한다. 숫자 값은 영어 단어 표기(two·twice·half…)도 인정한다. */
export function checkBindings(inst: BInstance): string[] {
  const issues: string[] = [];
  const text = `${inst.stimulus} ${inst.question}`;
  const sents = sentences(text);
  for (const b of inst.bindings ?? []) {
    const nouns = (Array.isArray(b.noun) ? b.noun : [b.noun]).map((n) => n.toLowerCase()); const val = String(b.value);
    const forms = [val, ...(typeof b.value === "number" ? NUMWORDS[b.value] ?? [] : [])];
    const re = new RegExp(forms.map((f) => (/^\d/.test(f) ? `(?<![\\d.])${esc(f)}(?![\\d])` : /^\w/.test(f) ? `\\b${esc(f)}` : esc(f))).join("|"), "gi");
    const ok = sents.some((s) => {
      const ls = s.toLowerCase();
      return nouns.some((noun) => {
        let from = 0;
        for (;;) {
          const ni = ls.indexOf(noun, from); if (ni < 0) return false; from = ni + 1;
          re.lastIndex = 0; let m: RegExpExecArray | null;
          while ((m = re.exec(s))) if (Math.abs(m.index - ni) <= WINDOW) return true;
        }
      });
    });
    if (!ok) issues.push(`의미 일치: '${nouns.join("|")}' 와(과) 값 ${val} 이(가) 같은 문장에 가까이 놓이지 않음`);
  }
  return issues;
}

const MIN_STEPS: Record<Level, number> = { easy: 2, medium: 3, hard: 5 };
const DROP = /^(풀이 단계|결합 개념)/;

export function verifyLevel(a: LArch, inst: BInstance): VerifyResult {
  let r: VerifyResult;
  if (a.qualitative) r = verifyQualitative(a, inst);
  else {
    r = verifyInstance(a.level === "hard" ? a : { ...a, mediumSteps: 0 }, inst);
    if (a.level !== "hard") r = { ...r, failures: r.failures.filter((f) => !DROP.test(f)) };
  }
  const failures = [...r.failures];
  if (a.level !== "hard" && inst.trace.length < MIN_STEPS[a.level]) failures.push(`풀이 단계 ${inst.trace.length} < ${MIN_STEPS[a.level]}(${a.level})`);
  failures.push(...checkBindings(inst));
  return { ...r, failures, ok: failures.length === 0 };
}

/** 정성형: 선지는 서술문. verification_js 는 const P = {stimulus, options}; 를 읽어 지문 키워드만으로 정답 선지 번호(0-기준)를 계산한다. */
function verifyQualitative(a: LArch, inst: BInstance): VerifyResult {
  const failures: string[] = []; let verified: number | null = null;
  if (inst.options.length !== 4) failures.push(`선택지 ${inst.options.length}개`);
  if (new Set(inst.options.map((o) => o.trim())).size !== inst.options.length) failures.push("선택지 문자열 중복");
  try {
    verified = runVerification(inst.verificationJs);
    if (verified !== inst.correctIndex) failures.push(`정답 재계산 ${verified} ≠ 표기 정답 ${inst.correctIndex}`);
  } catch (e) { failures.push(`verification_js 실패: ${(e as Error).message}`); }
  const m = inst.verificationJs.match(/^const P = (\{.*\});/);
  if (!m) failures.push("verification_js 에 const P 없음");
  else { const P = JSON.parse(m[1]) as { stimulus?: string; options?: string[] }; if (P.stimulus !== inst.stimulus || JSON.stringify(P.options) !== JSON.stringify(inst.options)) failures.push("verification_js 가 인쇄된 지문·선지를 그대로 읽지 않음"); }
  failures.push(...checkNotation({ stimulus: inst.stimulus, question: inst.question, ...Object.fromEntries(inst.options.map((o, i) => [`option${i + 1}`, o])), explanation: inst.explanation, explanationEn: inst.explanationEn }));
  const text = composeProblemText(inst.stimulus, inst.question);
  for (const f of checkContent({ format: "mc", passage: text, options: inst.options, correctIndex: inst.correctIndex, explanation: inst.explanation, answers: null, statements: null, skillCode: a.skill, figure: null })) failures.push(`내용 검사 ${f.code}: ${f.message}`);
  for (const b of findBannedWords({ 지문: inst.stimulus, 질문: inst.question, 해설: inst.explanation })) failures.push(`금칙어: ${b.message}`);
  if (a.level === "hard" && inst.trace.length < Math.max(5, a.mediumSteps + 1)) failures.push(`풀이 단계 ${inst.trace.length} 부족`);
  return { ok: failures.length === 0, failures, optionValues: [], verified };
}

export type LevelSweep = { id: string; level: Level; seeds: number; produced: number; genFail: number; thrown: number; verifyFail: number; failSeeds: { seed: number; why: string }[]; thrownSamples: string[]; variants: Record<string, number>; independent: number; independentByVariant: Record<string, number> };
export function sweepLevel(a: LArch, seeds: number, opts: { seedStart?: number; cap?: number; fmt?: Fmt } = {}): LevelSweep {
  const st: LevelSweep = { id: a.id, level: a.level, seeds, produced: 0, genFail: 0, thrown: 0, verifyFail: 0, failSeeds: [], thrownSamples: [], variants: {}, independent: 0, independentByVariant: {} };
  const keepAll: Set<string>[] = []; const keepBy = new Map<string, Set<string>[]>(); const cap = opts.cap ?? 400;
  for (let s = opts.seedStart ?? 0; s < (opts.seedStart ?? 0) + seeds; s++) {
    const g = generateOne(a, s, opts.fmt);
    if (!g.ok) { if (g.why === "genfail") st.genFail++; else { st.thrown++; if (st.thrownSamples.length < 3) st.thrownSamples.push(g.msg); } continue; }
    const v = verifyLevel(a, g.inst as BInstance);
    if (!v.ok) { st.verifyFail++; if (st.failSeeds.length < 5) st.failSeeds.push({ seed: s, why: v.failures.join(" | ").slice(0, 240) }); continue; }
    st.produced++; st.variants[g.inst.variant] = (st.variants[g.inst.variant] ?? 0) + 1;
    const sh = bodyShingles(g.inst);
    if (keepAll.length < cap && keepAll.every((k) => jaccard(k, sh) < 0.6)) keepAll.push(sh);
    const arr = keepBy.get(g.inst.variant) ?? []; if (arr.length < cap && arr.every((k) => jaccard(k, sh) < 0.6)) { arr.push(sh); keepBy.set(g.inst.variant, arr); }
  }
  st.independent = keepAll.length; for (const [k, v] of keepBy) st.independentByVariant[k] = v.length;
  return st;
}

// ── passed.json 호환 레코드(easy/medium 은 confirmed, hard 는 bulk.ts 의 archetypeRecord 사용) ──
const uuidFrom = (s: string) => { const h = createHash("sha1").update(s).digest("hex"); return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`; };
export function levelRecord(a: LArch, inst: BInstance, seed: number, runId: string, verified: number | null) {
  const subpattern = `${a.groupId ?? a.id}/${inst.variant}`; const passage = `${inst.stimulus}\n\n${inst.question}`;
  const spr = inst.format === "spr";
  return {
    gid: uuidFrom(spr ? `${a.id}:spr:${seed}` : `${a.id}:${seed}`), runId, skill: a.skill, domain: SKILL_BY_CODE.get(a.skill)?.domain ?? "unknown", examSystem: "sat_math" as const, difficulty: a.level, format: (spr ? "spr" : "mc") as "mc" | "spr",
    problem: { format: spr ? "spr" : "mc", figure: inst.figure ?? null, passage, stimulus: inst.stimulus, question: inst.question, needsFigure: !!inst.figure, options: spr ? null : inst.options, correctIndex: spr ? null : inst.correctIndex, answers: spr ? inst.answers ?? null : null, statements: null, explanation: inst.explanation, explanationEn: inst.explanationEn, difficulty: a.level,
      distractorRationales: inst.distractors.map((d) => ({ index: d.index, plausible_because: "실제 풀이 과정에서 나올 수 있는 오류 경로다.", matches: "같은 식·수치에서 계산되었다.", why_wrong: d.reason, kind: d.kind })), difficultyRationale: a.extraThinking, design: null, subpattern },
    quality: { contract: { ok: true, issues: [] }, estimatedDifficulty: a.level, requestedDifficulty: a.level, difficultyReasons: [a.extraThinking], distractors: [], independentReview: { pickedIndex: null, pickedAnswer: null, agrees: true, confidence: "high", flags: [] }, needsReview: false, needsReviewReasons: [], calibrated: false, reviewedAt: new Date(0).toISOString(),
      mockExamGeneration: { difficultyStatus: "confirmed", source: "compiler_archetype", archetypeId: a.id, operator: a.operator, kind: a.kind, level: a.level, concepts: a.concepts, steps: inst.trace.length, seed, variant: inst.variant, verification: { method: "verification_js", verified, correctOption: spr ? inst.answers?.[0] ?? null : inst.options[inst.correctIndex] } } },
    recipeId: a.id, recipeCheck: { source: "compiler_archetype", level: a.level }, createdVia: "compiler" as const, subpattern,
  };
}
export { GenFail };
