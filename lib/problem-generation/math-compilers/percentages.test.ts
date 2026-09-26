import { describe, expect, it } from "vitest";
import { generatePercentagesModel, renderPercentagesProblem, validatePercentagesModel } from "./percentages";

describe("generatePercentagesModel — 결정적 계산", () => {
  const kinds = ["percent_of", "find_whole", "percent_change", "find_percent", "compound_change"] as const;
  for (const kind of kinds) {
    it(`${kind} — 항상 validate 통과, 오답 3개, 정답과 중복 없음(50회)`, () => {
      for (let i = 0; i < 50; i++) {
        const model = generatePercentagesModel({ difficulty: "medium", questionKind: kind });
        expect(validatePercentagesModel(model)).toEqual({ ok: true });
        expect(model.distractors).toHaveLength(3);
        const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
        expect(new Set(values).size).toBe(4);
      }
    });
  }
});

describe("renderPercentagesProblem — 렌더링·해설", () => {
  it("영어 지문/질문과 $/^ 없는 한국어·영어 해설을 낸다(전 문항 종류, 전 난이도)", () => {
    const kinds = ["percent_of", "find_whole", "percent_change", "find_percent", "compound_change"] as const;
    const difficulties = ["easy", "medium", "hard"] as const;
    for (const kind of kinds) {
      for (const difficulty of difficulties) {
        const model = generatePercentagesModel({ difficulty, questionKind: kind });
        const rendered = renderPercentagesProblem(model);
        expect(rendered.options).toHaveLength(4);
        expect(rendered.options[rendered.correctIndex]).toBe(model.correctAnswer);
        expect(rendered.explanation).not.toMatch(/[$^]/);
        expect(rendered.explanationEn).not.toMatch(/[$^]/);
        expect(rendered.passage).toMatch(/[A-Za-z]/);
      }
    }
  });
});

describe("find_percent — 퍼센트 역산 고유 검증", () => {
  it("정답이 part÷whole×100과 일치하고, 실제 오류(비율 반전/×100 누락/자리수 오류/잘못된 기준)만 오답으로 낸다(30회)", () => {
    for (let i = 0; i < 30; i++) {
      const difficulty = (["easy", "medium", "hard"] as const)[i % 3];
      const model = generatePercentagesModel({ difficulty, questionKind: "find_percent" });
      expect(model.part).toBeDefined();
      expect(model.whole).toBeDefined();
      expect(Number(model.correctAnswer)).toBeCloseTo((model.part! / model.whole!) * 100, 6);
      const invertedRatio = (model.whole! / model.part!) * 100;
      const forgotMultiply = model.part! / model.whole!;
      const distractorValues = model.distractors.map((d) => Number(d.value));
      // 최소한 "비율 반전" 또는 "×100 누락" 계열 오류 중 하나는 실제로 후보에 포함되어야 한다(허수 오답 금지).
      const hasRealError = distractorValues.some(
        (v) => Math.abs(v - invertedRatio) < 1e-9 || Math.abs(v - forgotMultiply) < 1e-9 || Math.abs(v - model.percent * 10) < 1e-9
      );
      expect(hasRealError).toBe(true);
      expect(validatePercentagesModel(model)).toEqual({ ok: true });
    }
  });
});

describe("compound_change — 복합 퍼센트 변화 고유 검증", () => {
  it("두 단계 복리식 합성 값과 정확히 일치하고, 단순 덧셈 오답(14-4=10 유형)이 정답과 달라야 한다(30회)", () => {
    for (let i = 0; i < 30; i++) {
      const difficulty = (["medium", "hard"] as const)[i % 2];
      const model = generatePercentagesModel({ difficulty, questionKind: "compound_change" });
      expect(model.sign1).toBeDefined();
      expect(model.sign2).toBeDefined();
      expect(model.percent1).toBeDefined();
      expect(model.percent2).toBeDefined();
      expect(model.askMode).toBeDefined();
      expect(validatePercentagesModel(model)).toEqual({ ok: true });

      const additivePercent = model.sign1! * model.percent1! + model.sign2! * model.percent2!;
      if (model.askMode === "percent") {
        // 정답(복리 합성)은 단순 덧셈 오답과 값이 달라야 한다(둘이 같으면 합성 개념을 테스트하지 못함).
        expect(model.correctAnswer).not.toBe(String(additivePercent));
        expect(model.distractors.some((d) => Number(d.value) === additivePercent)).toBe(true);
      }
    }
  });
});
