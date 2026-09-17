import { describe, expect, it } from "vitest";
import { generatePercentagesModel, renderPercentagesProblem, validatePercentagesModel } from "./percentages";

describe("generatePercentagesModel — 결정적 계산", () => {
  const kinds = ["percent_of", "find_whole", "percent_change"] as const;
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
    const kinds = ["percent_of", "find_whole", "percent_change"] as const;
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
