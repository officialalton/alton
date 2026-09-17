import { describe, expect, it } from "vitest";
import {
  generateLinearFunctionModel,
  renderLinearFunctionProblem,
  validateLinearFunctionModel,
} from "./linear-functions";

describe("generateLinearFunctionModel — 결정적 계산", () => {
  it("evaluate는 f(x0) = m*x0+b를 그대로 정답으로 낸다(100회 반복)", () => {
    for (let i = 0; i < 100; i++) {
      const model = generateLinearFunctionModel({ difficulty: "medium", questionKind: "evaluate" });
      expect(model.correctAnswer).toBe(String(model.m * model.x0! + model.b));
      expect(validateLinearFunctionModel(model)).toEqual({ ok: true });
    }
  });

  it("find_x_for_value는 f(x)=target을 만족하는 x를 정답으로 낸다(100회 반복)", () => {
    for (let i = 0; i < 100; i++) {
      const model = generateLinearFunctionModel({ difficulty: "medium", questionKind: "find_x_for_value" });
      const x = Number(model.correctAnswer);
      expect(model.m * x + model.b).toBe(model.target);
      expect(validateLinearFunctionModel(model)).toEqual({ ok: true });
    }
  });

  it("slope_from_two_points는 두 점에서 실제로 계산한 기울기를 정답으로 낸다(100회 반복)", () => {
    for (let i = 0; i < 100; i++) {
      const model = generateLinearFunctionModel({ difficulty: "medium", questionKind: "slope_from_two_points" });
      const { p1, p2 } = model;
      const slope = (p2!.y - p1!.y) / (p2!.x - p1!.x);
      expect(model.correctAnswer).toBe(String(slope));
      expect(validateLinearFunctionModel(model)).toEqual({ ok: true });
    }
  });

  it("오답은 항상 정확히 3개이고 정답과 겹치지 않는다(전 유형·난이도, 150회 반복)", () => {
    const kinds = ["evaluate", "find_x_for_value", "slope_from_two_points"] as const;
    const difficulties = ["easy", "medium", "hard"] as const;
    for (let i = 0; i < 150; i++) {
      const model = generateLinearFunctionModel({ difficulty: difficulties[i % 3], questionKind: kinds[i % 3] });
      expect(model.distractors).toHaveLength(3);
      const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
      expect(new Set(values).size).toBe(4);
    }
  });
});

describe("renderLinearFunctionProblem — 렌더링·해설", () => {
  it("세 유형 모두 선택지 4개·정답 인덱스가 유효하고 해설에 정답이 포함된다", () => {
    const kinds = ["evaluate", "find_x_for_value", "slope_from_two_points"] as const;
    for (const kind of kinds) {
      for (let i = 0; i < 10; i++) {
        const model = generateLinearFunctionModel({ difficulty: "medium", questionKind: kind });
        const rendered = renderLinearFunctionProblem(model);
        expect(rendered.figure).toBeNull();
        expect(rendered.options).toHaveLength(4);
        expect(rendered.options[rendered.correctIndex]).toBe(model.correctAnswer);
        expect(rendered.explanation).toContain(model.correctAnswer);
      }
    }
  });
});
