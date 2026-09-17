import { describe, expect, it } from "vitest";
import {
  generateEquivalentExpressionsModel,
  renderEquivalentExpressionsProblem,
  validateEquivalentExpressionsModel,
} from "./equivalent-expressions";

describe("generateEquivalentExpressionsModel — 결정적 계산", () => {
  it("m=a+c, n=a*b+c*d를 항상 정확히 계산한다(100회 반복)", () => {
    for (let i = 0; i < 100; i++) {
      const model = generateEquivalentExpressionsModel({ difficulty: "medium" });
      expect(model.m).toBe(model.a + model.c);
      expect(model.n).toBe(model.a * model.b + model.c * model.d);
      expect(validateEquivalentExpressionsModel(model)).toEqual({ ok: true });
    }
  });

  it("오답은 항상 정확히 3개이고 정답과 겹치지 않는다(전 난이도, 100회 반복)", () => {
    const difficulties = ["easy", "medium", "hard"] as const;
    for (let i = 0; i < 100; i++) {
      const model = generateEquivalentExpressionsModel({ difficulty: difficulties[i % 3] });
      expect(model.distractors).toHaveLength(3);
      const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
      expect(new Set(values).size).toBe(4);
    }
  });

  it("x항이 사라지는(m=0) 경우는 만들지 않는다(50회 반복)", () => {
    for (let i = 0; i < 50; i++) {
      const model = generateEquivalentExpressionsModel({ difficulty: "medium" });
      expect(model.m).not.toBe(0);
    }
  });
});

describe("renderEquivalentExpressionsProblem — 렌더링·해설", () => {
  it("해설이 실제 분배·동류항 정리 단계를 보여주고 결론이 정답과 일치한다", () => {
    for (let i = 0; i < 20; i++) {
      const model = generateEquivalentExpressionsModel({ difficulty: "medium" });
      const rendered = renderEquivalentExpressionsProblem(model);
      expect(rendered.options).toHaveLength(4);
      expect(rendered.options[rendered.correctIndex]).toBe(model.correctAnswer);
      expect(rendered.explanation).toContain(model.correctAnswer);
      expect(rendered.explanation).toMatch(/분배하면/);
    }
  });
});
