import { describe, expect, it } from "vitest";
import {
  generateLinearInequalityModel,
  renderLinearInequalityProblem,
  validateLinearInequalityModel,
} from "./linear-inequalities";

describe("generateLinearInequalityModel — 결정적 계산", () => {
  it("solve_one_var는 계수가 음수면 부등호 방향이 뒤집힌 정답을 낸다(100회 반복)", () => {
    for (let i = 0; i < 100; i++) {
      const model = generateLinearInequalityModel({ difficulty: "medium", questionKind: "solve_one_var" });
      expect(model.questionKind).toBe("solve_one_var");
      const v = validateLinearInequalityModel(model);
      expect(v.ok).toBe(true);
      if (model.m < 0) {
        // 음수로 나눴으므로 원래 부등호와 정답의 부등호가 반대여야 한다.
        const flip: Record<string, string> = { "<": ">", "<=": ">=", ">": "<", ">=": "<=" };
        const opSymbol = model.op === "<=" ? "\\le" : model.op === ">=" ? "\\ge" : model.op;
        expect(model.correctAnswer.includes(flip[model.op] === "<=" ? "\\le" : flip[model.op] === ">=" ? "\\ge" : flip[model.op])).toBe(true);
        expect(model.correctAnswer.includes(opSymbol)).toBe(false);
      }
    }
  });

  it("point_in_solution은 정답 점이 실제로 부등식을 만족하고, 오답 점 셋은 만족하지 않는다(100회 반복)", () => {
    for (let i = 0; i < 100; i++) {
      const model = generateLinearInequalityModel({ difficulty: "medium", questionKind: "point_in_solution" });
      expect(model.questionKind).toBe("point_in_solution");
      const v = validateLinearInequalityModel(model);
      expect(v.ok).toBe(true);
      const satisfies = (x: number, y: number) => {
        const rhs = model.m * x + model.b;
        if (model.op === "<") return y < rhs;
        if (model.op === "<=") return y <= rhs;
        if (model.op === ">") return y > rhs;
        return y >= rhs;
      };
      const [correct, ...wrong] = model.candidatePoints!;
      expect(satisfies(correct.x, correct.y)).toBe(true);
      for (const p of wrong) expect(satisfies(p.x, p.y)).toBe(false);
    }
  });

  it("오답은 항상 정확히 3개이고 정답과 겹치지 않는다(난이도 전체, 100회 반복)", () => {
    const difficulties = ["easy", "medium", "hard"] as const;
    for (let i = 0; i < 100; i++) {
      const difficulty = difficulties[i % 3];
      const model = generateLinearInequalityModel({ difficulty });
      expect(model.distractors.length).toBe(3);
      const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
      expect(new Set(values).size).toBe(4);
    }
  });

  it("hard 난이도는 기울기 크기가 항상 2 이상이다(자명한 |m|=1 배제, 30회 반복)", () => {
    for (let i = 0; i < 30; i++) {
      const model = generateLinearInequalityModel({ difficulty: "hard" });
      expect(Math.abs(model.m)).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("renderLinearInequalityProblem — 렌더링", () => {
  it("solve_one_var는 그림이 없고 선택지 4개·정답 인덱스가 유효하다", () => {
    const model = generateLinearInequalityModel({ difficulty: "medium", questionKind: "solve_one_var" });
    const rendered = renderLinearInequalityProblem(model);
    expect(rendered.figure).toBeNull();
    expect(rendered.options.length).toBe(4);
    expect(rendered.options[rendered.correctIndex]).toBe(model.correctAnswer);
  });

  it("point_in_solution은 부등식 그림(plane, inequality 객체)을 낸다", () => {
    const model = generateLinearInequalityModel({ difficulty: "medium", questionKind: "point_in_solution" });
    const rendered = renderLinearInequalityProblem(model);
    expect(rendered.figure?.type).toBe("plane");
    expect(rendered.options[rendered.correctIndex]).toBe(model.correctAnswer);
  });
});
