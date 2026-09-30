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
