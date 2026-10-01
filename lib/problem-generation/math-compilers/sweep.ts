// 기존 계산형 컴파일러 전수 시드 스윕 하네스(2026-09-30). 난수에 의존하던 컴파일러를 Math.random 교체로 시드 재현하고,
// skill × 세부 패턴(kind) × 난이도 × 시드마다 attemptOne(생성→자체검증→렌더 검사→내용 검사→금칙어)을 돌려 불변식을 확인한다.
//  - 예외(throw)·선택지 4개 미만/중복·정답 인덱스 범위·오답 근거 인덱스 불일치는 버그다.
//  - 검증기가 거절한 후보(ok=false)는 설계상 정상이다(거절 사유만 집계).
import { attemptOne, type MathCompilerSkill } from "./batch";
import { MATH_SKILL_KINDS } from "./kind-catalog";
import { makeRng } from "../math-archetypes/rng";

export type SweepCell = { skill: string; kind: string | null; difficulty: "easy" | "medium" | "hard"; figurePolicy?: string };
export type SweepResult = { cell: SweepCell; runs: number; accepted: number; rejected: Record<string, number>; bugs: { seed: number; what: string }[] };

export function sweepCell(cell: SweepCell, seeds: number, seedStart = 0): SweepResult {
  const res: SweepResult = { cell, runs: 0, accepted: 0, rejected: {}, bugs: [] };
  const orig = Math.random;
  try {
    for (let s = seedStart; s < seedStart + seeds; s++) {
      Math.random = makeRng(s * 7919 + 13).next;
      res.runs += 1;
      try {
        const out = attemptOne(cell.skill as MathCompilerSkill, cell.difficulty, { compileMs: 0, renderCheckMs: 0 }, cell.figurePolicy, "mc", cell.kind ?? undefined);
        if (!out.ok) { const k = out.reason.replace(/[0-9.]+/g, "#").slice(0, 70); res.rejected[k] = (res.rejected[k] ?? 0) + 1; continue; }
        res.accepted += 1;
        const p = out.problem as unknown as { options: string[]; correctIndex: number; distractorRationales: { index: number }[] };
        const opts = p.options ?? [];
        if (opts.length !== 4) res.bugs.push({ seed: s, what: `선택지 ${opts.length}개` });
        else if (new Set(opts.map((o) => o.trim())).size !== 4) res.bugs.push({ seed: s, what: `선택지 중복 ${JSON.stringify(opts)}` });
        if (!(p.correctIndex >= 0 && p.correctIndex < opts.length)) res.bugs.push({ seed: s, what: `정답 인덱스 ${p.correctIndex}` });
        const idx = (p.distractorRationales ?? []).map((d) => d.index);
        if (new Set(idx).size !== idx.length || idx.includes(p.correctIndex)) res.bugs.push({ seed: s, what: `오답 근거 인덱스 ${JSON.stringify(idx)} vs 정답 ${p.correctIndex}` });
      } catch (e) {
        res.bugs.push({ seed: s, what: `예외: ${(e as Error).message}`.slice(0, 120) });
      }
    }
  } finally { Math.random = orig; }
  return res;
}

/** 카탈로그의 모든 (skill, kind) + kind 가 없는 skill 3종(systems_linear 등) × 난이도 3종. */
export function allSweepCells(): SweepCell[] {
  const cells: SweepCell[] = [];
  const difficulties = ["easy", "medium", "hard"] as const;
  for (const [skill, kinds] of Object.entries(MATH_SKILL_KINDS)) for (const k of kinds) for (const d of difficulties) cells.push({ skill, kind: k.value, difficulty: d });
  for (const skill of ["systems_linear", "inference_margin_error", "evaluating_statistical_claims"]) for (const d of difficulties) cells.push({ skill, kind: null, difficulty: d });
  return cells;
}
