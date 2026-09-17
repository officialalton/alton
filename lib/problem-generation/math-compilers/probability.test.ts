import { describe, expect, it } from "vitest";
import { generateProbabilityModel, renderProbabilityProblem, validateProbabilityModel } from "./probability";

describe("generateProbabilityModel — 결정적 계산", () => {
  const kinds = ["simple", "conditional", "sequential_without_replacement"] as const;
  for (const kind of kinds) {
    it(`${kind} — validate 통과, 오답 3개, 정답과 중복 없음(50회, 전 난이도)`, () => {
      const difficulties = ["easy", "medium", "hard"] as const;
      for (let i = 0; i < 50; i++) {
        const model = generateProbabilityModel({ difficulty: difficulties[i % 3], questionKind: kind });
        expect(validateProbabilityModel(model)).toEqual({ ok: true });
        expect(model.distractors).toHaveLength(3);
        const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
        expect(new Set(values).size).toBe(4);
      }
    });
  }

  it("비복원추출은 독립사건(복원추출) 오답과 값이 달라야 한다(실제 오류 경로 구분)", () => {
    for (let i = 0; i < 30; i++) {
      const model = generateProbabilityModel({ difficulty: "medium", questionKind: "sequential_without_replacement" });
      const independentWrong = (model.success! * model.success!) / (model.total! * model.total!);
      const correctNum = model.success! * (model.success! - 1);
      const correctDen = model.total! * (model.total! - 1);
      expect(correctNum / correctDen).not.toBeCloseTo(independentWrong, 6);
    }
  });
});

describe("renderProbabilityProblem — 렌더링·해설", () => {
  it("영어 지문/질문과 $/^ 없는 해설을 낸다", () => {
    const kinds = ["simple", "conditional", "sequential_without_replacement"] as const;
    for (const kind of kinds) {
      for (let i = 0; i < 10; i++) {
        const model = generateProbabilityModel({ difficulty: "hard", questionKind: kind });
        const rendered = renderProbabilityProblem(model);
        expect(rendered.options).toHaveLength(4);
        expect(rendered.options[rendered.correctIndex]).toBe(model.correctAnswer);
        expect(rendered.explanation).not.toMatch(/[$^]/);
        expect(rendered.explanationEn).not.toMatch(/[$^]/);
      }
    }
  });
});
