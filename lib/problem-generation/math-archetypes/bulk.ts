// 대량 산출기: 원형(또는 기존 컴파일러)·skill·난이도·개수·시드 → passed.json 호환 레코드 배열.
// - 같은 실행 안 + 기존 은행 대비 본문 유사도(숫자 마스킹 3-gram Jaccard) 0.6 미만만 채택.
// - 유사문항 그룹(= subpattern)당 최대 개수 상한으로 한 그룹 쏠림을 막는다(모의고사 세트당 그룹 1문항 제약 → 그룹당 30개 이하).
// - 원형 간 라운드 로빈으로 같은 원형·구조 쏠림을 방지한다.
// 실제 대량 실행은 총괄 승인 후. 이 모듈은 DB·네트워크·유료 API 를 쓰지 않는다.
import { createHash } from "node:crypto";
import type { Archetype, Instance } from "./types";
import { verifyInstance } from "./verify";
import { verifyLevel, type LArch } from "./levels-d";
import { bodyShingles, generateOne, jaccard, shingles, type Fmt } from "./sweep";
import { hashSeed, makeRng } from "./rng";
import { plainNumberOf, sprAnswerSet, sprSlot } from "./spr";
import { levelOf, sprCapability } from "./spr-capability";
import { assertCoverageGate, type GateReport } from "./figure-coverage";
import { SKILL_BY_CODE } from "@/lib/problem-taxonomy";
import { attemptOne, SPR_ELIGIBLE_SKILLS, type MathCompilerSkill } from "../math-compilers/batch";
import { getMathSkillKinds } from "../math-compilers/kind-catalog";

export type Difficulty = "easy" | "medium" | "hard";
export type PassedRecord = {
  gid: string; runId: string; skill: string; domain: string; examSystem: "sat_math"; difficulty: Difficulty; format: "mc" | "spr";
  problem: Record<string, unknown>; quality: Record<string, unknown>;
  recipeId: string | null; recipeCheck: unknown; createdVia: "compiler"; subpattern: string;
};
const uuidFrom = (s: string) => { const h = createHash("sha1").update(s).digest("hex"); return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`; };
const domainOf = (skill: string) => SKILL_BY_CODE.get(skill)?.domain ?? "unknown";

const baseQuality = () => ({
  contract: { ok: true, issues: [] }, estimatedDifficulty: "medium", requestedDifficulty: "medium", difficultyReasons: [], distractors: [],
  independentReview: { pickedIndex: null, pickedAnswer: null, agrees: true, confidence: "high", flags: [] }, needsReview: false, needsReviewReasons: [], calibrated: false, reviewedAt: new Date(0).toISOString(),
});

/** 원형 인스턴스 → passed.json 레코드. hard 는 잠정(provisional_ai)+원형 근거, easy/medium 은 confirmed. 자료(figure)·SPR(answers)을 그대로 싣는다.
 *  유사문항 그룹 키(subpattern)는 groupId(생략 시 id)/변형이라 같은 원형·변형의 mc/spr 문항은 같은 그룹이다(한 세트에 하나만 뽑힌다). */
export function archetypeRecord(a: Archetype, inst: Instance, seed: number, runId: string, verified: number | null): PassedRecord {
  const diff: Difficulty = levelOf(a); const hard = diff === "hard"; const spr = inst.format === "spr";
  const subpattern = `${a.groupId ?? a.id}/${inst.variant}`;
  const passage = `${inst.stimulus}\n\n${inst.question}`;
  return {
    gid: uuidFrom(spr ? `${a.id}:spr:${seed}` : `${a.id}:${seed}`), runId, skill: a.skill, domain: domainOf(a.skill), examSystem: "sat_math", difficulty: diff, format: spr ? "spr" : "mc",
    problem: {
      format: spr ? "spr" : "mc", figure: inst.figure ?? null, passage, stimulus: inst.stimulus, question: inst.question, needsFigure: !!inst.figure, options: spr ? null : inst.options, correctIndex: spr ? null : inst.correctIndex, answers: spr ? inst.answers ?? null : null, statements: null,
      explanation: inst.explanation, explanationEn: inst.explanationEn, difficulty: diff,
      distractorRationales: spr ? [] : inst.distractors.map((d) => ({ index: d.index, plausible_because: "실제 풀이 과정에서 나올 수 있는 오류 경로다.", matches: "같은 식·수치에서 계산되었다.", why_wrong: d.reason, kind: d.kind })),
      difficultyRationale: a.extraThinking, design: null, subpattern,
    },
    quality: {
      ...baseQuality(), estimatedDifficulty: diff, requestedDifficulty: diff, difficultyReasons: [a.extraThinking],
      mockExamGeneration: { difficultyStatus: hard ? "provisional_ai" : "confirmed", source: "compiler_archetype", archetypeId: a.id, operator: a.operator, kind: a.kind, extraThinking: a.extraThinking, concepts: a.concepts, steps: inst.trace.length, mediumSteps: a.mediumSteps, seed, variant: inst.variant, verification: { method: "verification_js", verified, correctOption: spr ? inst.answers?.[0] ?? null : inst.options[inst.correctIndex] }, ...(a.figureItem ? { figureItem: a.figureItem } : {}) },
    },
    recipeId: a.id, recipeCheck: { source: "compiler_archetype", compliance: { met: a.concepts.length, minMet: 2, of: a.concepts.length, ok: true } }, createdVia: "compiler", subpattern,
  };
}

/** 형식 쿼터 집계: 버킷 = skill|난이도. target 은 그 버킷 채택 수에 대한 SPR 목표(누적 half-up 반올림), shortfalls 는 SPR 자리를 SPR 로 못 채운 기록(조용히 mc 로 바꾸지 않고 여기에 남긴다). */
export type FormatStats = { quota: number; buckets: Record<string, { accepted: number; spr: number; target: number }>; shortfalls: { bucket: string; slot: number; reason: string }[] };
export type BulkStats = { attempts: number; genFail: number; verifyFail: number; duplicate: number; groupCap: number; accepted: number; byArchetype: Record<string, { attempts: number; accepted: number }>; byGroup: Record<string, number>; format: FormatStats };
export type BulkRequest = {
  runId: string; count: number; seedStart?: number;
  /** 기존 은행 본문 shingle (skill 별) — 유사도 0.6 이상이면 제외 */
  existing?: Map<string, Set<string>[]>;
  threshold?: number; maxPerGroup?: number; maxAttemptsPerItem?: number;
  /** (skill × 난이도) 버킷별 SPR 비율(기본 0.25 — 수량의 25% 는 항상 SPR). 0 이면 쿼터를 끈다(전부 mc). 버킷의 i 번째 채택 문항이 SPR 인지는 sprSlot(i) 로 결정론적으로 정해진다. */
  sprQuota?: number;
  /** true 면 SPR 자리를 채울 SPR 가능 원형이 없을 때 mc 로 대체하지 않고 오류를 던진다(기본: mc 로 채우되 stats.format.shortfalls 에 기록). */
  strictSpr?: boolean;
  /** 자료 원형이 섞이면 시작 전에 커버리지 게이트 보고서를 확인한다(기본: coverage-gate-report.json). 오너 승인 부분집합은 allowItems. */
  coverageReport?: GateReport | null; allowItems?: string[];
};
const pushStat = (st: BulkStats, id: string, ok: boolean) => { const r = (st.byArchetype[id] ??= { attempts: 0, accepted: 0 }); r.attempts++; if (ok) r.accepted++; };

const bucketOf = (a: Archetype) => `${a.skill}|${levelOf(a)}`;
const verifyAny = (a: Archetype, inst: Instance) => ((a as LArch).level ? verifyLevel(a as LArch, inst) : verifyInstance(a, inst));

/** 원형 기반 산출(hard 와 easy/medium 틀 모두). archetypes 를 라운드 로빈으로 돌며 시드를 올리고, (skill×난이도) 버킷마다 SPR 쿼터를 결정론적으로 지킨다.
 *  자료(figure) 원형이 섞여 있으면 커버리지 게이트를 먼저 확인한다. */
export function produceFromArchetypes(archetypes: Archetype[], req: BulkRequest): { records: PassedRecord[]; stats: BulkStats } {
  assertCoverageGate(archetypes, { report: req.coverageReport, allowItems: req.allowItems });
  const thr = req.threshold ?? 0.6, cap = req.maxPerGroup ?? 30, maxAttempts = (req.maxAttemptsPerItem ?? 60) * req.count; const q = req.sprQuota ?? 0.25;
  const stats: BulkStats = { attempts: 0, genFail: 0, verifyFail: 0, duplicate: 0, groupCap: 0, accepted: 0, byArchetype: {}, byGroup: {}, format: { quota: q, buckets: {}, shortfalls: [] } };
  const records: PassedRecord[] = []; const accepted = new Map<string, Set<string>[]>(); const seeds = new Map<string, number>();
  const capablePool = new Map<string, Archetype[]>(); const rr = new Map<string, number>(); const shortSeen = new Set<string>();
  const capableIn = (b: string) => { let l = capablePool.get(b); if (!l) { l = archetypes.filter((x) => bucketOf(x) === b && sprCapability(x).capable); capablePool.set(b, l); } return l; };
  let i = 0;
  while (records.length < req.count && stats.attempts < maxAttempts && archetypes.length) {
    let a = archetypes[i++ % archetypes.length]; const b = bucketOf(a);
    const bs = (stats.format.buckets[b] ??= { accepted: 0, spr: 0, target: 0 }); const slot = bs.accepted + 1;
    let fmt: Fmt = "mc";
    if (q > 0 && sprSlot(slot, q)) {
      if (sprCapability(a).capable) fmt = "spr";
      else {
        const pool = capableIn(b);
        if (pool.length) { const k = rr.get(b) ?? 0; rr.set(b, k + 1); a = pool[k % pool.length]; fmt = "spr"; }
        else {
          const key = `${b}#${slot}`; if (!shortSeen.has(key)) { shortSeen.add(key); stats.format.shortfalls.push({ bucket: b, slot, reason: "이 (skill×난이도)에 SPR 가능한 원형이 없다" }); }
          if (req.strictSpr) throw new Error(`SPR 쿼터를 채울 수 없다: ${b} 에 SPR 가능한 원형이 없음(슬롯 ${slot})`);
        }
      }
    }
    const sk = `${a.id}|${fmt}`; const seed = (seeds.get(sk) ?? (req.seedStart ?? 0)); seeds.set(sk, seed + 1);
    stats.attempts++;
    const g = generateOne(a, seed, fmt);
    if (!g.ok) { stats.genFail++; pushStat(stats, a.id, false); continue; }
    const v = verifyAny(a, g.inst);
    if (!v.ok) { stats.verifyFail++; pushStat(stats, a.id, false); continue; }
    const sub = `${a.groupId ?? a.id}/${g.inst.variant}`;
    if ((stats.byGroup[sub] ?? 0) >= cap) { stats.groupCap++; pushStat(stats, a.id, false); continue; }
    const sh = bodyShingles(g.inst); const pool = [...(accepted.get(a.skill) ?? []), ...(req.existing?.get(a.skill) ?? [])];
    if (pool.some((p) => jaccard(p, sh) >= thr)) { stats.duplicate++; pushStat(stats, a.id, false); continue; }
    (accepted.get(a.skill) ?? accepted.set(a.skill, []).get(a.skill)!).push(sh);
    stats.byGroup[sub] = (stats.byGroup[sub] ?? 0) + 1; stats.accepted++; pushStat(stats, a.id, true);
    bs.accepted++; if (fmt === "spr") bs.spr++; bs.target = Math.floor(bs.accepted * q + 0.5 + 1e-9);
    records.push(archetypeRecord(a, g.inst, seed, req.runId, v.verified));
  }
  return { records, stats };
}

/** 기존 결정론 컴파일러(easy/medium) 산출 — 세부 패턴을 라운드 로빈, Math.random 을 시드로 교체해 재현 가능하게 한다. 정답 검증은 컴파일러 자체 검증(validate*Model·렌더/내용 검사)이며 verification_js 는 없다. */
export function produceFromCompilers(skill: MathCompilerSkill, difficulty: "easy" | "medium", req: BulkRequest): { records: PassedRecord[]; stats: BulkStats } {
  const thr = req.threshold ?? 0.6, cap = req.maxPerGroup ?? 30, maxAttempts = (req.maxAttemptsPerItem ?? 60) * req.count; const q = req.sprQuota ?? 0.25;
  const kinds = getMathSkillKinds(skill).map((k) => k.value); const order: (string | undefined)[] = kinds.length ? kinds : [undefined];
  const stats: BulkStats = { attempts: 0, genFail: 0, verifyFail: 0, duplicate: 0, groupCap: 0, accepted: 0, byArchetype: {}, byGroup: {}, format: { quota: q, buckets: {}, shortfalls: [] } };
  const bucket = `${skill}|${difficulty}`; const bs = (stats.format.buckets[bucket] = { accepted: 0, spr: 0, target: 0 });
  const records: PassedRecord[] = []; const pool: Set<string>[] = [...(req.existing?.get(skill) ?? [])]; const orig = Math.random; const shortSeen = new Set<number>();
  const policies: (string | undefined)[] = [undefined, "require_data"]; let k = 0, seed = req.seedStart ?? 0;
  try {
    while (records.length < req.count && stats.attempts < maxAttempts) {
      const kind = order[k++ % order.length]; const s = seed++; stats.attempts++;
      const slot = bs.accepted + 1; let fmt: "mc" | "spr" = "mc";
      if (q > 0 && sprSlot(slot, q)) {
        if (SPR_ELIGIBLE_SKILLS.has(skill)) fmt = "spr";
        else { if (!shortSeen.has(slot)) { shortSeen.add(slot); stats.format.shortfalls.push({ bucket, slot, reason: "이 skill 은 컴파일러 SPR 1차 범위 밖이다(SPR_ELIGIBLE_SKILLS)" }); } if (req.strictSpr) throw new Error(`SPR 쿼터를 채울 수 없다: ${bucket}`); }
      }
      Math.random = makeRng(hashSeed(`${skill}:${difficulty}:${kind}:${s}${fmt === "spr" ? ":spr" : ""}`)).next;
      let out: ReturnType<typeof attemptOne> = { ok: false, reason: "" };
      for (const pol of policies) { try { out = attemptOne(skill, difficulty, { compileMs: 0, renderCheckMs: 0 }, pol, fmt, kind); } catch (e) { out = { ok: false, reason: String(e) }; } if (out.ok || !out.reason.includes("자료 필수")) break; }
      if (!out.ok) { stats.genFail++; pushStat(stats, `${skill}.${kind ?? "-"}`, false); continue; }
      const g = out.problem as unknown as { stimulus?: string; question?: string; options: string[] | null; subpattern?: string | null; explanation: string; correctIndex: number | null; answers?: string[] | null };
      if (fmt === "spr") {
        // 컴파일러의 sprFromAnswerText 는 소수 0~2자리 반올림·절사값(예: 7/2 → "4","3")까지 정답에 넣는다 — 정확한 표기만 남기도록 재계산한다.
        const exactVal = g.answers?.length ? plainNumberOf(g.answers[0]) : null; const exact = exactVal === null ? null : sprAnswerSet(exactVal);
        if (!exact) { stats.genFail++; pushStat(stats, `${skill}.${kind ?? "-"}`, false); continue; }
        g.answers = exact; (out.problem as unknown as { answers: string[] }).answers = exact;
      }
      const sub = `c:${skill}:${g.subpattern ?? kind ?? "-"}`;
      if ((stats.byGroup[sub] ?? 0) >= cap) { stats.groupCap++; pushStat(stats, `${skill}.${kind ?? "-"}`, false); continue; }
      const sh = shingles(`${g.stimulus ?? ""} ${g.question ?? ""} ${(g.options ?? []).join(" ")}`);
      if (pool.some((p) => jaccard(p, sh) >= thr)) { stats.duplicate++; pushStat(stats, `${skill}.${kind ?? "-"}`, false); continue; }
      pool.push(sh); stats.byGroup[sub] = (stats.byGroup[sub] ?? 0) + 1; stats.accepted++; pushStat(stats, `${skill}.${kind ?? "-"}`, true);
      bs.accepted++; if (fmt === "spr") bs.spr++; bs.target = Math.floor(bs.accepted * q + 0.5 + 1e-9);
      records.push({
        gid: uuidFrom(`${skill}:${difficulty}:${kind}:${s}${fmt === "spr" ? ":spr" : ""}`), runId: req.runId, skill, domain: domainOf(skill), examSystem: "sat_math", difficulty, format: fmt,
        problem: out.problem as unknown as Record<string, unknown>, quality: { ...(out.quality as unknown as Record<string, unknown>), mockExamGeneration: { difficultyStatus: "confirmed", source: "existing_compiler", kind: kind ?? null, seed: s, verification: { method: "compiler_model_validation" } } },
        recipeId: null, recipeCheck: null, createdVia: "compiler", subpattern: g.subpattern ?? (kind ?? ""),
      });
    }
  } finally { Math.random = orig; }
  return { records, stats };
}
