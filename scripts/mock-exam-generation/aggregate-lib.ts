// 검수 결과 → 최종 판정(통과/보관 후보, 최종 난이도 라벨). repair.ts·aggregate.ts 가 공유한다. DB·AI 호출 없음.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { findDuplicates, deterministicIssues, type Raw, type ReviewResult } from "./review";

export type Diff = "easy" | "medium" | "hard";
export type Weak = { gid: string; system: string; acc: number; rubric: { score: number }; strong: { n: number; correct: number } | null };
export type RecipeCheck = { gid: string; recipeId: string | null; adopted: boolean; compliance: { met: number | null; minMet: number; of: number; ok: boolean } | null; hardFit: { ok: boolean; which?: string[]; note?: string }; strong3: number };
export type Run = { recipe?: Map<string, RecipeCheck>; weak?: Map<string, Weak>; raws: Raw[]; reviews: Map<string, ReviewResult>; repairs: Map<string, { ok: boolean; after: { options: string[]; explanation: string } | null }>; repairedReviews: Map<string, ReviewResult> };
export type Eval = { hardTier?: HardTier; recipe?: RecipeCheck; raw: Raw; verdict: "pass" | "archive" | "unreviewed"; reasons: string[]; finalDifficulty: Diff; relabeled: boolean; repaired: boolean; review: ReviewResult | null };

const readDir = <T>(dir: string, into: (o: T) => [string, unknown]) => { const m = new Map<string, unknown>(); if (existsSync(dir)) for (const f of readdirSync(dir)) if (f.endsWith(".json")) { const [k, v] = into(JSON.parse(readFileSync(path.join(dir, f), "utf-8")) as T); m.set(k, v); } return m; };
export function loadRun(base: string): Run {
  const raws = readdirSync(path.join(base, "raw")).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(path.join(base, "raw", f), "utf-8")) as Raw);
  return {
    raws,
    reviews: readDir<ReviewResult>(path.join(base, "review"), (r) => [r.gid, r]) as Map<string, ReviewResult>,
    repairs: readDir<{ gid: string; ok: boolean; after: { options: string[]; explanation: string } | null }>(path.join(base, "repair"), (r) => [r.gid, r]) as Run["repairs"],
    repairedReviews: readDir<ReviewResult>(path.join(base, "review-repaired"), (r) => [r.gid, r]) as Map<string, ReviewResult>,
    weak: readDir<Weak>(path.join(base, "weak"), (r) => [r.gid, r]) as Map<string, Weak>,
    recipe: readDir<RecipeCheck>(path.join(base, "recipe-check"), (r) => [r.gid, r]) as Map<string, RecipeCheck>,
  };
}

/** 재라벨 방식: consensus(기본 — 블라인드·파이프라인 추정 일치 시 재라벨) | literal(블라인드 추정으로 무조건 재라벨). */
export const RELABEL_MODE = process.env.RELABEL_MODE === "literal" ? "literal" : "consensus";
export const DEFAULT_WEAK: Record<string, number> = { easy: 4, medium: 3, hard: 2 };
const DET = new Set(["weak_distractors", "difficulty_label_mismatch", "difficulty_unstable", "raw_latex_in_body", "unbalanced_dollar_in_body", "raw_latex_in_explanation", "unbalanced_dollar_in_explanation", "internal_field_name_exposed", "empty_explanation"]);

/** 한 버전(원본 또는 보수본)을 현재 규칙으로 판정한다. 난이도: 블라인드 추정이 라벨과 다르면 추정으로 재라벨, 추정이 불안정하면 보관. */
/** hard 판정 등급(2026-09-30). A: 강한 모델 다수 일치 + 약한 모델(haiku) 5회 정답률 <= 0.4(경험적). B: 강한 모델 일치 + 정답률 <= 0.8 + 구조 루브릭 상위.
 *  C: 강한 모델 일치 + 구조 루브릭 상위만(경험적 근거 없음 — 잠정). 없음: null. 루브릭 상위 기준: RW 11점 / Math 10점. */
export type HardTier = "A" | "B" | "C" | null;
export function hardTier(w: Weak | undefined, blindOk: boolean): HardTier {
  if (!w) return null;
  const strongOk = w.strong ? w.strong.correct === w.strong.n : blindOk;
  if (!strongOk) return null;
  const top = w.rubric.score >= (w.system === "sat_rw" ? 11 : 10);
  if (w.acc <= 0.4) return "A";
  if (w.acc <= 0.8 && top) return "B";
  return top ? "C" : null;
}
export const HARD_MIN_TIER: HardTier = "C";

export function evalOne(r: Raw, rev: ReviewResult | undefined, weak = DEFAULT_WEAK, recipe?: RecipeCheck): Omit<Eval, "repaired"> {
  if (!rev) return { raw: r, verdict: "unreviewed", reasons: ["not_reviewed"], finalDifficulty: r.difficulty, relabeled: false, review: null };
  const reasons = [...rev.reasons.filter((x) => !DET.has(x) && !x.startsWith("near_duplicate_of")), ...deterministicIssues(r)];
  if (!rev.blind) reasons.push(...rev.reasons.filter((x) => x.startsWith("near_duplicate_of")));
  let finalDifficulty: Diff = r.difficulty;
  let relabeled = false;
  if (rev.blind) {
    const est = rev.blind.estimatedDifficulty as Diff;
    const pipe = (r.quality as { estimatedDifficulty?: string } | undefined)?.estimatedDifficulty;
    if (est !== r.difficulty) {
      const ord = { easy: 0, medium: 1, hard: 2 } as Record<string, number>;
      if (RELABEL_MODE === "literal") {
        // 총괄 원안: 블라인드 추정으로 무조건 재라벨. 불안정(확신 낮음, 또는 파이프라인 추정과 두 단계 차)만 보관.
        if (rev.blind.confidence === "low" || (pipe && Math.abs(ord[pipe] - ord[est]) >= 2)) reasons.push("difficulty_unstable");
        else { finalDifficulty = est; relabeled = true; }
      } else if (rev.blind.confidence === "low") reasons.push("difficulty_unstable");
      else if (!pipe || pipe === est) { finalDifficulty = est; relabeled = true; } // 두 추정(블라인드·파이프라인)이 일치 -> 그 난이도로 재라벨
      else if (pipe === r.difficulty) { /* 추정이 갈리고 라벨은 파이프라인 쪽 -> 라벨 유지(풀이 모델의 쉬움 편향 보정) */ }
      else {
        // 라벨·파이프라인·블라인드가 모두 다름 -> 세 추정의 중앙값으로 재라벨(극단값 하나에 끌려가지 않게).
        const names = ["easy", "medium", "hard"] as Diff[];
        const med = names[[ord[r.difficulty], ord[pipe], ord[est]].sort((a, b) => a - b)[1]];
        finalDifficulty = med; relabeled = med !== r.difficulty;
      }
    }
    const elim = (rev.blind.easilyEliminated ?? []).filter((i) => i !== r.problem.correctIndex).length;
    if (r.format === "mc" && elim >= weak[finalDifficulty]) reasons.push("weak_distractors");
  }
  // hard 는 '레시피 채택'(레시피 준수 + 정답 검수 + hard 적합성, recipe-check.ts)을 통과한 문항만 인정한다(2026-09-30 총괄·오너). 그 밖은 hard 로 두지 않는다.
  // (약한 모델 정답률 기반 A/B/C 등급은 폐기 — hardTier 함수는 이력용으로만 남아 있고 쓰지 않는다.)
  if (recipe?.adopted && reasons.length === 0) { if (finalDifficulty !== "hard") relabeled = true; finalDifficulty = "hard"; }
  else if (finalDifficulty === "hard") { finalDifficulty = "medium"; relabeled = r.difficulty !== "medium"; }
  return { raw: r, verdict: reasons.length ? "archive" : "pass", reasons, finalDifficulty, relabeled, review: rev, hardTier: null, recipe: recipe?.adopted ? recipe : undefined };
}

/** 임포트 시험에서 렌더 검사(rw_question)를 통과하지 못한 문항 — 총괄 결정으로 passed 에서 제외. */
export const EXCLUDED_GIDS = new Set(["eabd2b5b-8d5f-46a0-b1ce-732e5e4360b2"]);
export function evaluateAll(run: Run, weak = DEFAULT_WEAK): Eval[] {
  const effective: Eval[] = run.raws.map((r) => {
    if (EXCLUDED_GIDS.has(r.gid)) return { raw: r, verdict: "archive" as const, reasons: ["render_check_failed"], finalDifficulty: r.difficulty, relabeled: false, repaired: false, review: run.reviews.get(r.gid) ?? null };
    const e0 = evalOne(r, run.reviews.get(r.gid), weak, run.recipe?.get(r.gid));
    const rp = run.repairs.get(r.gid);
    const rr = run.repairedReviews.get(r.gid);
    if (e0.verdict === "archive" && e0.reasons.length === 1 && e0.reasons[0] === "weak_distractors" && rp?.ok && rp.after) {
      const fixed: Raw = { ...r, problem: { ...r.problem, options: rp.after.options, explanation: rp.after.explanation } };
      const e1 = evalOne(fixed, rr, weak, run.recipe?.get(r.gid));
      return { ...e1, repaired: true, reasons: e1.verdict === "archive" && e1.reasons.length === 0 ? ["repair_unreviewed"] : e1.reasons };
    }
    return { ...e0, repaired: false };
  });
  const dups = findDuplicates(effective.filter((e) => e.verdict === "pass").map((e) => e.raw));
  return effective.map((e) => { const d = dups.get(e.raw.gid); return e.verdict === "pass" && d ? { ...e, verdict: "archive", reasons: [`near_duplicate_of:${d.of}@${d.score}`] } : e; });
}
