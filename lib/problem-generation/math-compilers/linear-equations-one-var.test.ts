import { describe, expect, it } from "vitest";
import {
  generateLinearOneVarModel,
  renderLinearOneVarProblem,
  validateLinearOneVarModel,
} from "./linear-equations-one-var";

describe("generateLinearOneVarModel — 결정적 계산", () => {
  it("항상 실제 방정식(a x + b = c x + d)에 들어맞는 정수해를 낸다(100회 반복)", () => {
    for (let i = 0; i < 100; i++) {
      const model = generateLinearOneVarModel({ difficulty: "medium" });
      expect(model.a * model.x + model.b).toBe(model.c * model.x + model.d);
      expect(Number.isInteger(model.x)).toBe(true);
      expect(model.correctAnswer).toBe(String(model.x));
      expect(validateLinearOneVarModel(model)).toEqual({ ok: true });
    }
  });

  it("오답은 항상 정확히 3개이고 정답과 겹치지 않으며, 실제 오류 경로 종류에서만 나온다(100회 반복, 전 난이도)", () => {
    const difficulties = ["easy", "medium", "hard"] as const;
    const allowedKinds = new Set(["sign_error", "formula_misuse", "condition_ignored"]);
    for (let i = 0; i < 100; i++) {
      const model = generateLinearOneVarModel({ difficulty: difficulties[i % 3] });
      expect(model.distractors).toHaveLength(3);
      const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
      expect(new Set(values).size).toBe(4);
      for (const d of model.distractors) expect(allowedKinds.has(d.kind)).toBe(true);
    }
  });

  it("hard 난이도는 계수 크기가 medium보다 크다(평균 비교, 200회 표본)", () => {
    const avgAbs = (difficulty: "medium" | "hard") => {
      let total = 0;
      for (let i = 0; i < 200; i++) {
        const m = generateLinearOneVarModel({ difficulty });
        total += Math.abs(m.a) + Math.abs(m.c);
      }
      return total / 200;
    };
    expect(avgAbs("hard")).toBeGreaterThan(avgAbs("medium"));
  });
});

describe("renderLinearOneVarProblem — 렌더링·해설", () => {
  it("해설이 실제 이항·소거 중간 단계를 보여주고 결론이 정답과 일치한다", () => {
    for (let i = 0; i < 20; i++) {
      const model = generateLinearOneVarModel({ difficulty: "medium" });
      const rendered = renderLinearOneVarProblem(model);
      expect(rendered.options).toHaveLength(4);
      expect(rendered.options[rendered.correctIndex]).toBe(model.correctAnswer);
      expect(rendered.explanation).toContain(model.correctAnswer);
      expect(rendered.explanation).toMatch(/이항하면|정리하면/);
    }
  });
});
