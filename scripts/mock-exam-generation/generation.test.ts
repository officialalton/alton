import { describe, it, expect } from "vitest";
import { buildPlan } from "./plan";
import { deterministicIssues, findDuplicates, type Raw } from "./review";

const raw = (over: Partial<Raw["problem"]> & { gid?: string; skill?: string }): Raw => ({
  gid: over.gid ?? "a", runId: "t", skill: over.skill ?? "transitions", domain: "d", examSystem: "sat_rw", difficulty: "easy", format: "mc",
  problem: { stimulus: "x", question: "Which choice?", options: ["a", "b", "c", "d"], correctIndex: 0, explanation: "ok", ...over },
});

describe("모의고사 생성 계획", () => {
  it("3배 풀 목표합이 RW 243 · Math 198 이다", () => {
    const cells = buildPlan();
    const sum = (sys: string) => cells.filter((c) => c.system === sys).reduce((a, c) => a + c.target, 0);
    expect(sum("sat_rw")).toBe(243);
    expect(sum("sat_math")).toBe(198);
  });
  it("hard 는 전체의 약 1/9~1/8 이고 부족분이 음수가 아니다", () => {
    for (const c of buildPlan()) { expect(c.shortfall).toBeGreaterThanOrEqual(0); expect(c.generate).toBeGreaterThanOrEqual(c.shortfall); }
  });
});

describe("검수 결정론 검사", () => {
  it("지문의 $…$ 는 허용, 밖의 LaTeX 명령은 결함", () => {
    expect(deterministicIssues(raw({ stimulus: "Solve $x^2=4$." }))).toEqual([]);
    expect(deterministicIssues(raw({ stimulus: "Solve \\frac{1}{2}." }))).toContain("raw_latex_in_body");
  });
  it("해설의 $…$ 는 허용하되 짝이 안 맞으면 결함", () => {
    expect(deterministicIssues(raw({ explanation: "따라서 $x=2$." }))).toEqual([]);
    expect(deterministicIssues(raw({ explanation: "따라서 $x=2." }))).toContain("unbalanced_dollar_in_explanation");
  });
  it("숫자만 다른 같은 틀은 중복, 다른 지문은 아니다", () => {
    const long = "The committee reviewed the proposal for the new library wing and concluded that the budget was adequate for the stated goals";
    const dups = findDuplicates([raw({ gid: "a", stimulus: `${long} in 2010.` }), raw({ gid: "b", stimulus: `${long} in 2015.` }), raw({ gid: "c", stimulus: "A completely different passage about marine biology and coral reefs today." })]);
    expect(dups.get("b")?.of).toBe("a");
    expect(dups.has("c")).toBe(false);
  });
});

import { evalOne } from "./aggregate-lib";
import type { ReviewResult } from "./review";
const rev = (est: string, confidence = "high", elim: number[] = []): ReviewResult => ({ gid: "a", verdict: "pass", reasons: [], notes: [], reviewedAt: "", blind: { pickedIndex: 0, pickedAnswer: null, agrees: true, otherDefensible: false, confidence, estimatedDifficulty: est, easilyEliminated: elim } });
describe("난이도 재라벨·오답 제거 판정", () => {
  const base = { ...raw({}), difficulty: "hard" as const, quality: { estimatedDifficulty: "medium" } };
  it("블라인드·파이프라인 추정이 일치하면 그 난이도로 재라벨", () => {
    const e = evalOne(base, rev("medium"));
    expect(e.finalDifficulty).toBe("medium"); expect(e.relabeled).toBe(true); expect(e.verdict).toBe("pass");
  });
  it("세 추정이 모두 다르면 중앙값, 확신 낮으면 보관", () => {
    expect(evalOne(base, rev("easy")).finalDifficulty).toBe("medium");
    expect(evalOne(base, rev("easy", "low")).reasons).toContain("difficulty_unstable");
  });
  it("난이도별 임계값으로 쉽게 지워지는 오답을 보관", () => {
    const med = { ...raw({}), difficulty: "medium" as const, quality: { estimatedDifficulty: "medium" } };
    expect(evalOne(med, rev("medium", "high", [1, 2, 3])).reasons).toContain("weak_distractors");
    expect(evalOne(med, rev("medium", "high", [1, 2])).verdict).toBe("pass");
  });
});

import { hardTier } from "./aggregate-lib";
describe("hard 판정 등급", () => {
  const w = (acc: number, score: number, strongCorrect = 3, system = "sat_rw") => ({ gid: "a", system, acc, rubric: { score }, strong: { n: 3, correct: strongCorrect } });
  it("강한 모델 다수 일치가 없으면 등급 없음(모호·오답 키 제외)", () => { expect(hardTier(w(0, 12, 2), true)).toBeNull(); });
  it("A: 약한 모델 정답률 40% 이하", () => { expect(hardTier(w(0.2, 6), true)).toBe("A"); });
  it("B: 정답률 80% 이하 + 루브릭 상위, C: 루브릭만", () => {
    expect(hardTier(w(0.8, 11), true)).toBe("B");
    expect(hardTier(w(1, 11), true)).toBe("C");
    expect(hardTier(w(1, 9), true)).toBeNull();
    expect(hardTier(w(1, 10, 3, "sat_math"), true)).toBe("C");
  });
});
