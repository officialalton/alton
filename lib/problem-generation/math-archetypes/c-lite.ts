// easy/medium 원형(lite) — hard 원형과 같은 프레임워크((원형, 난이도, 시드)로 재현·verification_js 정답 재계산·그룹 키 c:<skill>:<원형ID>/<변형>)에서
// hard 전용 검사(풀이 단계 5 이상 등)만 뺀 판. 문장 틀이 서로 다른 원형이 새 유사문항 그룹이 된다. DB·네트워크·유료 API 없음.
import { createHash } from "node:crypto";
import type { Archetype, Instance } from "./types";
import { GenFail } from "./types";
import { hashSeed, makeRng, type Rng } from "./rng";
import { verifyInstance } from "./verify";
import { bodyShingles, jaccard } from "./sweep";
import { SKILL_BY_CODE } from "@/lib/problem-taxonomy";
import type { PassedRecord } from "./bulk";

export type Level = "easy" | "medium";
export type LiteArchetype = {
  /** `<skill 약칭>.<kind>.<틀>` — 틀(frame) 이름이 곧 문장 틀 식별자 */
  id: string; skill: string; kind: string; frame: string;
  levels: Level[];
  /** 문장 틀·풀이 구조 요약 */
  structure: string;
  generate(rng: Rng, level: Level): Instance;
};

const shim = (a: LiteArchetype): Archetype => ({ id: a.id, skill: a.skill, kind: a.kind, operator: "repr_shift", structure: a.structure, extraThinking: "easy/medium 원형", concepts: ["a", "b"], mediumSteps: 0, generate: () => { throw new Error("shim"); } });
/** hard 주장(풀이 단계 수) 외의 모든 공개 게이트를 그대로 적용한다. */
export function verifyLite(a: LiteArchetype, inst: Instance) {
  const r = verifyInstance(shim(a), inst);
  const failures = r.failures.filter((f) => !f.startsWith("풀이 단계"));
  return { ...r, failures, ok: failures.length === 0 };
}

export const liteRng = (a: LiteArchetype, level: Level, seed: number, attempt = 0) => makeRng(hashSeed(`${a.id}:${level}:${seed}${attempt ? `:${attempt}` : ""}`));
export type LiteGen = { ok: true; inst: Instance } | { ok: false; why: "genfail" | "throw"; msg: string };
export function generateLite(a: LiteArchetype, level: Level, seed: number): LiteGen {
  let last = "";
  for (let t = 0; t < 40; t++) {
    try { const inst = a.generate(liteRng(a, level, seed, t), level); return { ok: true, inst: { ...inst, variant: `${level}.${inst.variant}` } }; }
    catch (e) { if (!(e instanceof GenFail)) return { ok: false, why: "throw", msg: (e as Error).message }; last = e.message; }
  }
  return { ok: false, why: "genfail", msg: last };
}

export type LiteSweep = { id: string; level: Level; seeds: number; produced: number; genFail: number; thrown: number; verifyFail: number; failSeeds: { seed: number; why: string }[]; thrownSamples: string[]; variants: Record<string, number>; independent: number };
export function sweepLite(a: LiteArchetype, level: Level, seeds: number, opts: { seedStart?: number; independentCap?: number } = {}): LiteSweep {
  const st: LiteSweep = { id: a.id, level, seeds, produced: 0, genFail: 0, thrown: 0, verifyFail: 0, failSeeds: [], thrownSamples: [], variants: {}, independent: 0 };
  const keep: Set<string>[] = []; const cap = opts.independentCap ?? 400; const s0 = opts.seedStart ?? 0;
  for (let s = s0; s < s0 + seeds; s++) {
    const g = generateLite(a, level, s);
    if (!g.ok) { if (g.why === "genfail") st.genFail++; else { st.thrown++; if (st.thrownSamples.length < 3) st.thrownSamples.push(g.msg); } continue; }
    const v = verifyLite(a, g.inst);
    if (!v.ok) { st.verifyFail++; if (st.failSeeds.length < 5) st.failSeeds.push({ seed: s, why: v.failures.join(" | ").slice(0, 200) }); continue; }
    st.produced++; st.variants[g.inst.variant] = (st.variants[g.inst.variant] ?? 0) + 1;
    if (keep.length < cap) { const sh = bodyShingles(g.inst); if (keep.every((k) => jaccard(k, sh) < 0.6)) keep.push(sh); }
  }
  st.independent = keep.length;
  return st;
}

const uuidFrom = (s: string) => { const h = createHash("sha1").update(s).digest("hex"); return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`; };
const quality = (level: Level, a: LiteArchetype, inst: Instance, seed: number, verified: number | null) => ({
  contract: { ok: true, issues: [] }, estimatedDifficulty: level, requestedDifficulty: level, difficultyReasons: [], distractors: [],
  independentReview: { pickedIndex: null, pickedAnswer: null, agrees: true, confidence: "high", flags: [] }, needsReview: false, needsReviewReasons: [], calibrated: false, reviewedAt: new Date(0).toISOString(),
  mockExamGeneration: { difficultyStatus: "confirmed", source: "compiler_archetype_lite", archetypeId: a.id, kind: a.kind, frame: a.frame, seed, variant: inst.variant, verification: { method: "verification_js", verified, correctOption: inst.options[inst.correctIndex] } },
});
export function liteRecord(a: LiteArchetype, level: Level, inst: Instance, seed: number, runId: string, verified: number | null): PassedRecord {
  const subpattern = `${a.id}/${inst.variant}`;
  return {
    gid: uuidFrom(`${a.id}:${level}:${seed}`), runId, skill: a.skill, domain: SKILL_BY_CODE.get(a.skill)?.domain ?? "unknown", examSystem: "sat_math", difficulty: level, format: "mc",
    problem: {
      format: "mc", figure: null, passage: `${inst.stimulus}\n\n${inst.question}`, stimulus: inst.stimulus, question: inst.question, needsFigure: false, options: inst.options, correctIndex: inst.correctIndex, answers: null, statements: null,
      explanation: inst.explanation, explanationEn: inst.explanationEn, difficulty: level,
      distractorRationales: inst.distractors.map((d) => ({ index: d.index, plausible_because: "실제 풀이 과정에서 나올 수 있는 오류 경로다.", matches: "같은 식·수치에서 계산되었다.", why_wrong: d.reason, kind: d.kind })),
      difficultyRationale: a.structure, design: null, subpattern,
    },
    quality: quality(level, a, inst, seed, verified), recipeId: null, recipeCheck: null, createdVia: "compiler", subpattern,
  };
}

export type LiteBulkStats = { attempts: number; genFail: number; verifyFail: number; duplicate: number; groupCap: number; accepted: number; byGroup: Record<string, number> };
/** easy/medium 원형 산출: 원형 라운드 로빈, 그룹당 상한(기본 30), 본문 유사도 0.6 미만만 채택. */
export function produceFromLite(archs: LiteArchetype[], level: Level, req: { runId: string; count: number; seedStart?: number; maxPerGroup?: number; threshold?: number; existing?: Map<string, Set<string>[]> }) {
  const thr = req.threshold ?? 0.6, cap = req.maxPerGroup ?? 30; const pool = archs.filter((a) => a.levels.includes(level));
  const stats: LiteBulkStats = { attempts: 0, genFail: 0, verifyFail: 0, duplicate: 0, groupCap: 0, accepted: 0, byGroup: {} };
  const records: PassedRecord[] = []; const accepted = new Map<string, Set<string>[]>(); const seeds = new Map<string, number>();
  let i = 0; const maxAttempts = 80 * req.count;
  while (records.length < req.count && stats.attempts < maxAttempts && pool.length) {
    const a = pool[i++ % pool.length]; const seed = seeds.get(a.id) ?? (req.seedStart ?? 0); seeds.set(a.id, seed + 1); stats.attempts++;
    const g = generateLite(a, level, seed); if (!g.ok) { stats.genFail++; continue; }
    const v = verifyLite(a, g.inst); if (!v.ok) { stats.verifyFail++; continue; }
    const sub = `${a.id}/${g.inst.variant}`; if ((stats.byGroup[sub] ?? 0) >= cap) { stats.groupCap++; continue; }
    const sh = bodyShingles(g.inst); const prior = [...(accepted.get(a.skill) ?? []), ...(req.existing?.get(a.skill) ?? [])];
    if (prior.some((p) => jaccard(p, sh) >= thr)) { stats.duplicate++; continue; }
    (accepted.get(a.skill) ?? accepted.set(a.skill, []).get(a.skill)!).push(sh);
    stats.byGroup[sub] = (stats.byGroup[sub] ?? 0) + 1; stats.accepted++;
    records.push(liteRecord(a, level, g.inst, seed, req.runId, v.verified));
  }
  return { records, stats };
}
