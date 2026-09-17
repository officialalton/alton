import { describe, expect, it } from "vitest";
import { runMathCompilerBatch } from "./batch";

describe("runMathCompilerBatch — 최소 10문항 배치 실행", () => {
  it("요청이 1개여도 내부적으로 최소 10문항 단위로 후보를 평가한다", async () => {
    const result = await runMathCompilerBatch({ skillCode: "linear_equations_two_var", difficulty: "medium", count: 1 });
    expect(result.accepted).toHaveLength(1);
    expect(result.stats.candidatesEvaluated).toBeGreaterThanOrEqual(10);
    expect(result.stats.shortfall).toBe(0);
    expect(result.stats.stoppedReason).toBe("target_met");
  });

  it("요청 수만큼 정확히 자동 통과 문항을 채택하고, 후보 통과분이 요청 수를 넘으면 반환하지 않는다", async () => {
    const result = await runMathCompilerBatch({ skillCode: "linear_equations_two_var", difficulty: "easy", count: 5 });
    expect(result.accepted).toHaveLength(5);
    expect(result.stats.requested).toBe(5);
  });

  it("onAccepted 콜백이 accepted 문항 수만큼 즉시 호출된다", async () => {
    const seen: number[] = [];
    const result = await runMathCompilerBatch({
      skillCode: "linear_equations_two_var", difficulty: "medium", count: 3,
      onAccepted: async () => { seen.push(1); },
    });
    expect(seen.length).toBe(result.accepted.length);
    expect(seen.length).toBe(3);
  });

  it("지원하지 않는 skillCode는 매 시도마다 실패로 집계되고 부족 상태로 끝난다", async () => {
    const result = await runMathCompilerBatch({ skillCode: "unsupported_skill" as never, difficulty: "medium", count: 2 });
    expect(result.accepted).toHaveLength(0);
    expect(result.stats.shortfall).toBe(2);
    expect(result.failures.length).toBeGreaterThan(0);
  });

  it("생성된 문항은 MaterialTab/session view가 기대하는 GeneratedProblem 모양(4지선다, correctIndex, figure)을 갖는다", async () => {
    const result = await runMathCompilerBatch({ skillCode: "linear_equations_two_var", difficulty: "hard", count: 1 });
    const item = result.accepted[0];
    expect(item.problem.format).toBe("mc");
    expect(item.problem.options).toHaveLength(4);
    expect(item.problem.correctIndex).toBeGreaterThanOrEqual(0);
    expect(item.problem.correctIndex).toBeLessThan(4);
    expect(typeof item.problem.explanation).toBe("string");
  });

  // 2026-09-17 — 같은 일차식 공통 엔진 확장: systems_linear는 linear_equations_two_var와
  // 같은 계산 함수를 쓰고(문제은행 skillCode만 다르게 태깅), linear_inequalities는 새
  // 모델이지만 같은 배치 실행기·상한·no-held 정책을 그대로 따른다.
  it("systems_linear는 같은 엔진으로 요청 수만큼 자동 통과 문항을 만든다", async () => {
    const result = await runMathCompilerBatch({ skillCode: "systems_linear", difficulty: "medium", count: 10 });
    expect(result.accepted).toHaveLength(10);
    expect(result.stats.shortfall).toBe(0);
    expect(result.stats.stoppedReason).toBe("target_met");
  });

  it("linear_inequalities는 요청 수만큼 자동 통과 문항을 만든다(medium·hard)", async () => {
    for (const difficulty of ["medium", "hard"] as const) {
      const result = await runMathCompilerBatch({ skillCode: "linear_inequalities", difficulty, count: 10 });
      expect(result.accepted).toHaveLength(10);
      expect(result.stats.shortfall).toBe(0);
      expect(result.stats.stoppedReason).toBe("target_met");
      for (const item of result.accepted) {
        expect(item.problem.options).toHaveLength(4);
        expect(item.problem.correctIndex).toBeGreaterThanOrEqual(0);
        expect(item.problem.correctIndex).toBeLessThan(4);
      }
    }
  });
});
