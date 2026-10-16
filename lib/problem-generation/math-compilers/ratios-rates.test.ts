import { describe, expect, it } from "vitest";
import { generateRatiosRatesModel, renderRatiosRatesProblem, validateRatiosRatesModel } from "./ratios-rates";

describe("generateRatiosRatesModel — 결정적 계산", () => {
  it("항상 실제 비례식(a/b = c/x)을 만족하는 정수해를 낸다(100회 반복)", () => {
    for (let i = 0; i < 100; i++) {
      const model = generateRatiosRatesModel({ difficulty: "medium", questionKind: "proportion" });
      if (model.questionKind !== "proportion") throw new Error("unreachable");
      expect(model.a * model.x).toBe(model.b * model.c);
      expect(Number.isInteger(model.x)).toBe(true);
      expect(model.correctAnswer).toBe(String(model.x));
      expect(validateRatiosRatesModel(model)).toEqual({ ok: true });
    }
  });

  it("오답은 항상 정확히 3개이고 정답과 겹치지 않는다(전 난이도, 100회)", () => {
    const difficulties = ["easy", "medium", "hard"] as const;
    for (let i = 0; i < 100; i++) {
      const model = generateRatiosRatesModel({ difficulty: difficulties[i % 3], questionKind: "proportion" });
      expect(model.distractors).toHaveLength(3);
      const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
      expect(new Set(values).size).toBe(4);
    }
  });
});

describe("renderRatiosRatesProblem — 렌더링·해설", () => {
  it("영어 지문/질문, 한국어 해설 없이 $/^ 오염이 없는 영어 해설이 함께 나온다", () => {
    for (let i = 0; i < 20; i++) {
      const model = generateRatiosRatesModel({ difficulty: "hard", questionKind: "proportion" });
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

describe("chained_conversion — 연쇄 단위환산(2단계 이상)", () => {
  it("validate 통과, 오답 3개, 정답과 중복 없음(전 난이도, 60회)", () => {
    const difficulties = ["easy", "medium", "hard"] as const;
    for (let i = 0; i < 60; i++) {
      const model = generateRatiosRatesModel({ difficulty: difficulties[i % 3], questionKind: "chained_conversion" });
      expect(validateRatiosRatesModel(model)).toEqual({ ok: true });
      expect(model.distractors).toHaveLength(3);
      const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
      expect(new Set(values).size).toBe(4);
    }
  });

  it("linear 모드: rawValue×f1×f2가 실제로 correctAnswer와 일치한다(정수 답)", () => {
    for (let i = 0; i < 40; i++) {
      const model = generateRatiosRatesModel({ difficulty: "medium", questionKind: "chained_conversion" });
      if (model.questionKind !== "chained_conversion") throw new Error("unreachable");
      if (model.mode !== "linear") continue;
      const expected = model.rawValue * model.f1 * model.f2;
      expect(model.correctAnswer).toBe(String(Math.round(expected)));
      expect(Number.isInteger(expected)).toBe(true);
    }
  });

  it("rate 모드(hard 전용): rawValue×f1÷f2가 correctAnswer와 일치한다", () => {
    let sawRate = false;
    for (let i = 0; i < 60; i++) {
      const model = generateRatiosRatesModel({ difficulty: "hard", questionKind: "chained_conversion" });
      if (model.questionKind !== "chained_conversion" || model.mode !== "rate") continue;
      sawRate = true;
      const expected = (model.rawValue * model.f1) / model.f2;
      expect(model.correctAnswer).toBe(String(Math.round(expected)));
    }
    expect(sawRate).toBe(true);
  });

  it("영어 지문/질문과 두 단계 환산을 모두 언급하는 해설을 낸다($/^ 오염 없음)", () => {
    for (let i = 0; i < 20; i++) {
      const model = generateRatiosRatesModel({ difficulty: "medium", questionKind: "chained_conversion" });
      if (model.questionKind !== "chained_conversion") throw new Error("unreachable");
      const rendered = renderRatiosRatesProblem(model);
      expect(rendered.options).toHaveLength(4);
      expect(new Set(rendered.options).size).toBe(4);
      expect(rendered.options[rendered.correctIndex]).toBe(model.correctAnswer);
      expect(rendered.explanation).not.toMatch(/[$^]/);
      expect(rendered.explanationEn).not.toMatch(/[$^]/);
      expect(rendered.explanation).toContain(model.unit0);
      expect(rendered.explanation).toContain(model.unit1);
      expect(rendered.explanation).toContain(model.unit2);
      expect(rendered.explanationEn).toContain(model.correctAnswer);
      expect(rendered.figure).toBeNull();
    }
  });
});
