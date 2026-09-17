import { describe, expect, it } from "vitest";
import { generateRatiosRatesModel, renderRatiosRatesProblem, validateRatiosRatesModel } from "./ratios-rates";

describe("generateRatiosRatesModel — 결정적 계산", () => {
  it("항상 실제 비례식(a/b = c/x)을 만족하는 정수해를 낸다(100회 반복)", () => {
    for (let i = 0; i < 100; i++) {
      const model = generateRatiosRatesModel({ difficulty: "medium" });
      expect(model.a * model.x).toBe(model.b * model.c);
      expect(Number.isInteger(model.x)).toBe(true);
      expect(model.correctAnswer).toBe(String(model.x));
      expect(validateRatiosRatesModel(model)).toEqual({ ok: true });
    }
  });

  it("오답은 항상 정확히 3개이고 정답과 겹치지 않는다(전 난이도, 100회)", () => {
    const difficulties = ["easy", "medium", "hard"] as const;
    for (let i = 0; i < 100; i++) {
      const model = generateRatiosRatesModel({ difficulty: difficulties[i % 3] });
      expect(model.distractors).toHaveLength(3);
      const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
      expect(new Set(values).size).toBe(4);
    }
  });
});

describe("renderRatiosRatesProblem — 렌더링·해설", () => {
  it("영어 지문/질문, 한국어 해설 없이 $/^ 오염이 없는 영어 해설이 함께 나온다", () => {
    for (let i = 0; i < 20; i++) {
      const model = generateRatiosRatesModel({ difficulty: "hard" });
      const rendered = renderRatiosRatesProblem(model);
      expect(rendered.options).toHaveLength(4);
      expect(rendered.options[rendered.correctIndex]).toBe(model.correctAnswer);
      expect(rendered.explanation).not.toMatch(/[$^]/);
      expect(rendered.explanationEn).not.toMatch(/[$^]/);
      expect(rendered.explanationEn).toContain(model.correctAnswer);
      expect(rendered.passage).toMatch(/[A-Za-z]/);
    }
  });
});
