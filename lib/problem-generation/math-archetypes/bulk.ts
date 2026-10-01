// 대량 산출기: 원형(또는 기존 컴파일러)·skill·난이도·개수·시드 → passed.json 호환 레코드 배열.
// - 같은 실행 안 + 기존 은행 대비 본문 유사도(숫자 마스킹 3-gram Jaccard) 0.6 미만만 채택.
// - 유사문항 그룹(= subpattern)당 최대 개수 상한으로 한 그룹 쏠림을 막는다(모의고사 세트당 그룹 1문항 제약 → 그룹당 30개 이하).
// - 원형 간 라운드 로빈으로 같은 원형·구조 쏠림을 방지한다.
// 실제 대량 실행은 총괄 승인 후. 이 모듈은 DB·네트워크·유료 API 를 쓰지 않는다.
import { createHash } from "node:crypto";
import type { Archetype, Instance } from "./types";
import { verifyInstance } from "./verify";
import { bodyShingles, generateOne, jaccard, shingles } from "./sweep";
import { hashSeed, makeRng } from "./rng";
import { SKILL_BY_CODE } from "@/lib/problem-taxonomy";
import { attemptOne, type MathCompilerSkill } from "../math-compilers/batch";
import { getMathSkillKinds } from "../math-compilers/kind-catalog";

export type Difficulty = "easy" | "medium" | "hard";
export type PassedRecord = {
  gid: string; runId: string; skill: string; domain: string; examSystem: "sat_math"; difficulty: Difficulty; format: "mc";
  problem: Record<string, unknown>; quality: Record<string, unknown>;
  recipeId: string | null; recipeCheck: unknown; createdVia: "compiler"; subpattern: string;
};
const uuidFrom = (s: string) => { const h = createHash("sha1").update(s).digest("hex"); return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`; };
const domainOf = (skill: string) => SKILL_BY_CODE.get(skill)?.domain ?? "unknown";

const baseQuality = () => ({
  contract: { ok: true, issues: [] }, estimatedDifficulty: "medium", requestedDifficulty: "medium", difficultyReasons: [], distractors: [],
  independentReview: { pickedIndex: null, pickedAnswer: null, agrees: true, confidence: "high", flags: [] }, needsReview: false, needsReviewReasons: [], calibrated: false, reviewedAt: new Date(0).toISOString(),
});

/** 원형 인스턴스 → passed.json 레코드. hard 는 잠정(provisional_ai)+원형 근거, easy/medium 은 confirmed. */
export function archetypeRecord(a: Archetype, inst: Instance, seed: number, runId: string, verified: number | null): PassedRecord {
  const diff: Difficulty = a.difficulty ?? "hard"; const hard = diff === "hard";
  const subpattern = `${a.id}/${inst.variant}`;
  const passage = `${inst.stimulus}\n\n${inst.question}`;
  return {
    gid: uuidFrom(`${a.id}:${seed}`), runId, skill: a.skill, domain: domainOf(a.skill), examSystem: "sat_math", difficulty: diff, format: "mc",
    problem: {
      format: "mc", figure: null, passage, stimulus: inst.stimulus, question: inst.question, needsFigure: false, options: inst.options, correctIndex: inst.correctIndex, answers: null, statements: null,
      explanation: inst.explanation, explanationEn: inst.explanationEn, difficulty: diff,
      distractorRationales: inst.distractors.map((d) => ({ index: d.index, plausible_because: "실제 풀이 과정에서 나올 수 있는 오류 경로다.", matches: "같은 식·수치에서 계산되었다.", why_wrong: d.reason, kind: d.kind })),
      difficultyRationale: a.extraThinking, design: null, subpattern,
    },
    quality: {
      ...baseQuality(), estimatedDifficulty: diff, requestedDifficulty: diff, difficultyReasons: [a.extraThinking],
      mockExamGeneration: { difficultyStatus: hard ? "provisional_ai" : "confirmed", source: "compiler_archetype", archetypeId: a.id, operator: a.operator, kind: a.kind, extraThinking: a.extraThinking, concepts: a.concepts, steps: inst.trace.length, mediumSteps: a.mediumSteps, seed, variant: inst.variant, verification: { method: "verification_js", verified, correctOption: inst.options[inst.correctIndex] } },
    },
    recipeId: a.id, recipeCheck: { source: "compiler_archetype", compliance: { met: a.concepts.length, minMet: 2, of: a.concepts.length, ok: true } }, createdVia: "compiler", subpattern,
  };
}

export type BulkStats = { attempts: number; genFail: number; verifyFail: number; duplicate: number; groupCap: number; accepted: number; byArchetype: Record<string, { attempts: number; accepted: number }>; byGroup: Record<string, number> };
export type BulkRequest = {
  runId: string; count: number; seedStart?: number;
  /** 기존 은행 본문 shingle (skill 별) — 유사도 0.6 이상이면 제외 */
  existing?: Map<string, Set<string>[]>;
  threshold?: number; maxPerGroup?: number; maxAttemptsPerItem?: number;
};
const pushStat = (st: BulkStats, id: string, ok: boolean) => { const r = (st.byArchetype[id] ??= { attempts: 0, accepted: 0 }); r.attempts++; if (ok) r.accepted++; };

/** 원형 기반 hard 산출. archetypes 를 라운드 로빈으로 돌며 시드를 올린다. */
export function produceFromArchetypes(archetypes: Archetype[], req: BulkRequest): { records: PassedRecord[]; stats: BulkStats } {
  const thr = req.threshold ?? 0.6, cap = req.maxPerGroup ?? 30, maxAttempts = (req.maxAttemptsPerItem ?? 60) * req.count;
  const stats: BulkStats = { attempts: 0, genFail: 0, verifyFail: 0, duplicate: 0, groupCap: 0, accepted: 0, byArchetype: {}, byGroup: {} };
  const records: PassedRecord[] = []; const accepted = new Map<string, Set<string>[]>(); const seeds = new Map<string, number>();
  let i = 0;
  while (records.length < req.count && stats.attempts < maxAttempts && archetypes.length) {
    const a = archetypes[i++ % archetypes.length]; const seed = (seeds.get(a.id) ?? (req.seedStart ?? 0)); seeds.set(a.id, seed + 1);
    stats.attempts++;
    const g = generateOne(a, seed);
    if (!g.ok) { stats.genFail++; pushStat(stats, a.id, false); continue; }
    const v = verifyInstance(a, g.inst);
    if (!v.ok) { stats.verifyFail++; pushStat(stats, a.id, false); continue; }
    const sub = `${a.id}/${g.inst.variant}`;
    if ((stats.byGroup[sub] ?? 0) >= cap) { stats.groupCap++; pushStat(stats, a.id, false); continue; }
    const sh = bodyShingles(g.inst); const pool = [...(accepted.get(a.skill) ?? []), ...(req.existing?.get(a.skill) ?? [])];
    if (pool.some((p) => jaccard(p, sh) >= thr)) { stats.duplicate++; pushStat(stats, a.id, false); continue; }
    (accepted.get(a.skill) ?? accepted.set(a.skill, []).get(a.skill)!).push(sh);
    stats.byGroup[sub] = (stats.byGroup[sub] ?? 0) + 1; stats.accepted++; pushStat(stats, a.id, true);
    records.push(archetypeRecord(a, g.inst, seed, req.runId, v.verified));
  }
  return { records, stats };
}

/** 기존 결정론 컴파일러(easy/medium) 산출 — 세부 패턴을 라운드 로빈, Math.random 을 시드로 교체해 재현 가능하게 한다. 정답 검증은 컴파일러 자체 검증(validate*Model·렌더/내용 검사)이며 verification_js 는 없다. */
export function produceFromCompilers(skill: MathCompilerSkill, difficulty: "easy" | "medium", req: BulkRequest): { records: PassedRecord[]; stats: BulkStats } {
  const thr = req.threshold ?? 0.6, cap = req.maxPerGroup ?? 30, maxAttempts = (req.maxAttemptsPerItem ?? 60) * req.count;
  const kinds = getMathSkillKinds(skill).map((k) => k.value); const order: (string | undefined)[] = kinds.length ? kinds : [undefined];
  const stats: BulkStats = { attempts: 0, genFail: 0, verifyFail: 0, duplicate: 0, groupCap: 0, accepted: 0, byArchetype: {}, byGroup: {} };
  const records: PassedRecord[] = []; const pool: Set<string>[] = [...(req.existing?.get(skill) ?? [])]; const orig = Math.random;
  const policies: (string | undefined)[] = [undefined, "require_data"]; let k = 0, seed = req.seedStart ?? 0;
  try {
    while (records.length < req.count && stats.attempts < maxAttempts) {
      const kind = order[k++ % order.length]; const s = seed++; stats.attempts++;
      Math.random = makeRng(hashSeed(`${skill}:${difficulty}:${kind}:${s}`)).next;
      let out: ReturnType<typeof attemptOne> = { ok: false, reason: "" };
      for (const pol of policies) { try { out = attemptOne(skill, difficulty, { compileMs: 0, renderCheckMs: 0 }, pol, "mc", kind); } catch (e) { out = { ok: false, reason: String(e) }; } if (out.ok || !out.reason.includes("자료 필수")) break; }
      if (!out.ok) { stats.genFail++; pushStat(stats, `${skill}.${kind ?? "-"}`, false); continue; }
      const g = out.problem as unknown as { stimulus?: string; question?: string; options: string[]; subpattern?: string | null; explanation: string; correctIndex: number };
      const sub = `c:${skill}:${g.subpattern ?? kind ?? "-"}`;
      if ((stats.byGroup[sub] ?? 0) >= cap) { stats.groupCap++; pushStat(stats, `${skill}.${kind ?? "-"}`, false); continue; }
      const sh = shingles(`${g.stimulus ?? ""} ${g.question ?? ""} ${(g.options ?? []).join(" ")}`);
      if (pool.some((p) => jaccard(p, sh) >= thr)) { stats.duplicate++; pushStat(stats, `${skill}.${kind ?? "-"}`, false); continue; }
      pool.push(sh); stats.byGroup[sub] = (stats.byGroup[sub] ?? 0) + 1; stats.accepted++; pushStat(stats, `${skill}.${kind ?? "-"}`, true);
      records.push({
        gid: uuidFrom(`${skill}:${difficulty}:${kind}:${s}`), runId: req.runId, skill, domain: domainOf(skill), examSystem: "sat_math", difficulty, format: "mc",
        problem: out.problem as unknown as Record<string, unknown>, quality: { ...(out.quality as unknown as Record<string, unknown>), mockExamGeneration: { difficultyStatus: "confirmed", source: "existing_compiler", kind: kind ?? null, seed: s, verification: { method: "compiler_model_validation" } } },
        recipeId: null, recipeCheck: null, createdVia: "compiler", subpattern: g.subpattern ?? (kind ?? ""),
      });
    }
  } finally { Math.random = orig; }
  return { records, stats };
}
