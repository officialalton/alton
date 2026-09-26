import { describe, expect, it } from "vitest";
import { runMathCompilerBatch } from "./batch";
import { figureSatisfies } from "@/lib/problem-material-need";

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

  // 2026-09-17 — 식·함수 엔진(2단계 A) 첫 세부 기술.
  it("linear_equations_one_var는 요청 수만큼 자동 통과 문항을 만든다(medium·hard)", async () => {
    for (const difficulty of ["medium", "hard"] as const) {
      const result = await runMathCompilerBatch({ skillCode: "linear_equations_one_var", difficulty, count: 10 });
      expect(result.accepted).toHaveLength(10);
      expect(result.stats.shortfall).toBe(0);
      expect(result.stats.stoppedReason).toBe("target_met");
      for (const item of result.accepted) {
        expect(item.problem.figure).toBeNull();
        expect(item.problem.options).toHaveLength(4);
      }
    }
  });

  it("linear_functions는 요청 수만큼 자동 통과 문항을 만든다(medium·hard)", async () => {
    for (const difficulty of ["medium", "hard"] as const) {
      const result = await runMathCompilerBatch({ skillCode: "linear_functions", difficulty, count: 10 });
      expect(result.accepted).toHaveLength(10);
      expect(result.stats.shortfall).toBe(0);
      expect(result.stats.stoppedReason).toBe("target_met");
      for (const item of result.accepted) {
        expect(item.problem.figure).toBeNull();
        expect(item.problem.options).toHaveLength(4);
      }
    }
  });

  it("equivalent_expressions는 요청 수만큼 자동 통과 문항을 만든다(medium·hard)", async () => {
    for (const difficulty of ["medium", "hard"] as const) {
      const result = await runMathCompilerBatch({ skillCode: "equivalent_expressions", difficulty, count: 10 });
      expect(result.accepted).toHaveLength(10);
      expect(result.stats.shortfall).toBe(0);
      expect(result.stats.stoppedReason).toBe("target_met");
      for (const item of result.accepted) {
        expect(item.problem.figure).toBeNull();
        expect(item.problem.options).toHaveLength(4);
      }
    }
  });

  it("nonlinear_equations_systems는 요청 수만큼 자동 통과 문항을 만든다(medium·hard)", async () => {
    for (const difficulty of ["medium", "hard"] as const) {
      const result = await runMathCompilerBatch({ skillCode: "nonlinear_equations_systems", difficulty, count: 10 });
      expect(result.accepted).toHaveLength(10);
      expect(result.stats.shortfall).toBe(0);
      expect(result.stats.stoppedReason).toBe("target_met");
      for (const item of result.accepted) {
        expect(item.problem.figure).toBeNull();
        expect(item.problem.options).toHaveLength(4);
      }
    }
  });

  it("nonlinear_functions는 요청 수만큼 자동 통과 문항을 만든다(medium·hard)", async () => {
    for (const difficulty of ["medium", "hard"] as const) {
      const result = await runMathCompilerBatch({ skillCode: "nonlinear_functions", difficulty, count: 10 });
      expect(result.accepted).toHaveLength(10);
      expect(result.stats.shortfall).toBe(0);
      expect(result.stats.stoppedReason).toBe("target_met");
      for (const item of result.accepted) {
        expect(item.problem.figure).toBeNull();
        expect(item.problem.options).toHaveLength(4);
      }
    }
  });

  it("nonlinear_functions에서 그래프 선택지 4개를 강제하면 모든 채택 문항에 실제 그림 선택지가 있다", async () => {
    const result = await runMathCompilerBatch({ skillCode: "nonlinear_functions", difficulty: "medium", count: 7, figurePolicy: "require_figure_choice" });
    expect(result.accepted).toHaveLength(7);
    for (const { problem } of result.accepted) {
      expect((problem.figure as { type: string }).type).toBe("figure_choice");
      const choices = (problem.figure as { choices: { type: string }[] }).choices;
      expect(choices).toHaveLength(4);
      expect(choices.every((choice) => choice.type === "plane")).toBe(true);
      expect(problem.options).toEqual(["A", "B", "C", "D"]);
      expect(problem.question).toMatch(/Which of the following graphs/i);
    }
  });

  it("미지원 필수 자료 정책은 텍스트 문항으로 대체하지 않는다", async () => {
    const result = await runMathCompilerBatch({ skillCode: "nonlinear_functions", difficulty: "medium", count: 1, figurePolicy: "require_data" });
    expect(result.accepted).toHaveLength(0);
    expect(result.failures.some((f) => f.reason.includes("자료"))).toBe(true);
  });

  it("기존 좌표평면·표·도형 필수 정책은 해당 자료를 가진 문항만 채택한다", async () => {
    const cases = [
      { skillCode: "nonlinear_functions", figurePolicy: "require_plane", type: "plane" },
      { skillCode: "two_variable_data", figurePolicy: "require_data", type: "data" },
      { skillCode: "lines_angles_triangles", figurePolicy: "require_geometry", type: "geometry" },
    ] as const;
    for (const c of cases) {
      const result = await runMathCompilerBatch({ ...c, difficulty: "medium", count: 1 });
      expect(result.accepted).toHaveLength(1);
      expect(figureSatisfies(c.type, result.accepted[0].problem.figure)).toBe(true);
    }
  });
});

describe("runMathCompilerBatch — SPR(그리드 입력) 1차 지원(2026-09-17)", () => {
  it("SPR 지원 유형(linear_equations_one_var)에 format:'spr'을 요청하면 answers가 있는 spr 문항을 만든다", async () => {
    const result = await runMathCompilerBatch({ skillCode: "linear_equations_one_var", difficulty: "medium", count: 3, format: "spr" });
    expect(result.accepted.length).toBeGreaterThan(0);
    for (const item of result.accepted) {
      expect(item.problem.format).toBe("spr");
      expect(item.problem.options).toBeNull();
      expect(item.problem.correctIndex).toBeNull();
      expect(Array.isArray(item.problem.answers)).toBe(true);
      expect((item.problem.answers as string[]).length).toBeGreaterThan(0);
    }
  });

  it("SPR 지원 유형(one_variable_data: mean/median/range)도 spr을 채택한다 — 숫자형 kind만 남는다", async () => {
    const result = await runMathCompilerBatch({ skillCode: "one_variable_data", difficulty: "medium", count: 5, format: "spr" });
    expect(result.accepted.length).toBeGreaterThan(0);
    for (const item of result.accepted) {
      expect(item.problem.format).toBe("spr");
      expect((item.problem.answers as string[]).length).toBeGreaterThan(0);
    }
  });

  it("SPR 지원 유형(nonlinear_equations_systems)은 num_real_solutions 같은 문장형 정답을 자동으로 걸러낸다", async () => {
    const result = await runMathCompilerBatch({ skillCode: "nonlinear_equations_systems", difficulty: "medium", count: 5, format: "spr" });
    expect(result.accepted.length).toBeGreaterThan(0);
    for (const item of result.accepted) {
      const answers = item.problem.answers as string[];
      expect(answers.every((a) => /^-?\d+(?:\.\d+)?(?:\/\d+)?$/.test(a))).toBe(true);
    }
  });

  it("SPR을 지원하지 않는 유형(probability)에 spr을 요청하면 0건 채택 + 사유가 남는다", async () => {
    const result = await runMathCompilerBatch({ skillCode: "probability", difficulty: "medium", count: 2, format: "spr" });
    expect(result.accepted).toHaveLength(0);
    expect(result.stats.shortfall).toBe(2);
    expect(result.failures.some((f) => f.reason.includes("SPR"))).toBe(true);
  });
});

// 2026-09-18(제품 오너 지시) — "세부 패턴" 드롭다운. kind를 지정하면 배치 안의 채택된
// 문항이 전부(무작위 재시도로 채워진 나머지 후보까지 포함해) 정확히 그 kind여야 하고,
// 각 문항 객체에도 subpattern으로 그대로 남아야 한다(저장 경로가 그 값을 읽어 DB에 태깅함).
// kind를 생략하면 기존처럼 여러 kind가 섞여 나온다(회귀 없음 확인).
describe("runMathCompilerBatch — 세부 패턴(kind) 강제 지정", () => {
  it("nonlinear_equations_systems: kind='parameter_discriminant'을 지정하면 채택된 문항이 전부 그 kind다", async () => {
    const result = await runMathCompilerBatch({
      skillCode: "nonlinear_equations_systems", difficulty: "medium", count: 5, kind: "parameter_discriminant",
    });
    expect(result.accepted.length).toBeGreaterThan(0);
    for (const item of result.accepted) {
      expect((item.problem as unknown as { subpattern: string }).subpattern).toBe("parameter_discriminant");
    }
  });

  it("linear_inequalities: kind='table_verification'을 지정하면 채택된 문항이 전부 그 kind다", async () => {
    const result = await runMathCompilerBatch({
      skillCode: "linear_inequalities", difficulty: "medium", count: 5, kind: "table_verification",
    });
    expect(result.accepted.length).toBeGreaterThan(0);
    for (const item of result.accepted) {
      expect((item.problem as unknown as { subpattern: string }).subpattern).toBe("table_verification");
    }
  });

  it("percentages: kind='compound_change'를 지정하면 채택된 문항이 전부 그 kind다", async () => {
    const result = await runMathCompilerBatch({
      skillCode: "percentages", difficulty: "medium", count: 5, kind: "compound_change",
    });
    expect(result.accepted.length).toBeGreaterThan(0);
    for (const item of result.accepted) {
      expect((item.problem as unknown as { subpattern: string }).subpattern).toBe("compound_change");
    }
  });

  it("equivalent_expressions: kind='rational_equivalence'를 지정하면 채택된 문항이 전부 그 kind다(kind 파라미터명이 다른 컴파일러)", async () => {
    const result = await runMathCompilerBatch({
      skillCode: "equivalent_expressions", difficulty: "medium", count: 5, kind: "rational_equivalence",
    });
    expect(result.accepted.length).toBeGreaterThan(0);
    for (const item of result.accepted) {
      expect((item.problem as unknown as { subpattern: string }).subpattern).toBe("rational_equivalence");
    }
  });

  it("카탈로그에 없는 값(오타)을 kind로 주면 무시하고 무작위 선택으로 폴백한다 — 배치가 실패하지 않는다", async () => {
    const result = await runMathCompilerBatch({
      skillCode: "percentages", difficulty: "medium", count: 10, kind: "no_such_kind",
    });
    expect(result.accepted.length).toBeGreaterThan(0);
  });

  it("kind를 지정하지 않으면(기존 동작) 10문항 배치 안에 둘 이상의 kind가 섞여 나온다(회귀 없음)", async () => {
    const result = await runMathCompilerBatch({ skillCode: "percentages", difficulty: "medium", count: 10 });
    const kinds = new Set(result.accepted.map((item) => (item.problem as unknown as { subpattern: string | null }).subpattern));
    expect(kinds.size).toBeGreaterThan(1);
  });
});
