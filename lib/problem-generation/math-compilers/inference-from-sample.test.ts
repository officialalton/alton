import { describe, expect, it } from "vitest";
import { generateInferenceModel, renderInferenceProblem, validateInferenceModel } from "./inference-from-sample";

describe("generateInferenceModel — 결정적 계산", () => {
  it("항상 population×sampleCount/sampleSize와 일치하는 정수 추정치를 낸다(100회 반복, 전 난이도)", () => {
    const difficulties = ["easy", "medium", "hard"] as const;
    for (let i = 0; i < 100; i++) {
      const model = generateInferenceModel({ difficulty: difficulties[i % 3] });
      const expected = (model.population * model.sampleCount) / model.sampleSize;
      expect(model.correctAnswer).toBe(String(expected));
      expect(validateInferenceModel(model)).toEqual({ ok: true });
      expect(model.distractors).toHaveLength(3);
      const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
      expect(new Set(values).size).toBe(4);
    }
  });
});

describe("renderInferenceProblem — 렌더링·해설", () => {
  it("영어 지문/질문과 $/^ 없는 해설을 낸다", () => {
    for (let i = 0; i < 20; i++) {
      const model = generateInferenceModel({ difficulty: "hard" });
      const rendered = renderInferenceProblem(model);
      expect(rendered.options).toHaveLength(4);
      expect(rendered.options[rendered.correctIndex]).toBe(model.correctAnswer);
      expect(rendered.explanation).not.toMatch(/[$^]/);
      expect(rendered.explanationEn).not.toMatch(/[$^]/);
      expect(rendered.explanationEn).toContain(model.correctAnswer);
    }
  });
});
