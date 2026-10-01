import { describe, expect, it } from "vitest";
import { generateEvalClaimsModel, renderEvalClaimsProblem, validateEvalClaimsModel } from "./evaluating-statistical-claims";

describe("generateEvalClaimsModel — 결정적 계산", () => {
  it("무작위 배정/표집 네 조합 모두 validate를 통과하고 정답 문구가 고유하다(100회 반복)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const model = generateEvalClaimsModel({ difficulty: "medium" });
      expect(validateEvalClaimsModel(model)).toEqual({ ok: true });
      expect(model.distractors).toHaveLength(3);
      const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
      expect(new Set(values).size).toBe(4);
      seen.add(`${model.randomAssignment}-${model.randomSampling}`);
    }
    expect(seen.size).toBe(4); // 네 조합이 실제로 다 나온다.
  });

  it("무작위 배정만 있고 표집이 없으면 '인과관계는 가능하나 일반화 불가' 문구가 정답이다", () => {
    for (let i = 0; i < 200; i++) {
      const model = generateEvalClaimsModel({ difficulty: "medium" });
      if (model.randomAssignment && !model.randomSampling) {
        expect(model.correctAnswer).toMatch(/cannot be generalized/);
        expect(model.correctAnswer).toMatch(/cause-and-effect relationship can be concluded/);
        return;
      }
    }
    throw new Error("해당 조합이 200회 시도에서 나오지 않았습니다(생성 로직 확인 필요).");
  });
});

describe("renderEvalClaimsProblem — 렌더링·해설", () => {
  it("영어 지문/질문과 $/^ 없는 해설을 낸다", () => {
    for (let i = 0; i < 20; i++) {
      const model = generateEvalClaimsModel({ difficulty: "hard" });
      const rendered = renderEvalClaimsProblem(model);
      expect(rendered.options).toHaveLength(4);
      expect(rendered.options[rendered.correctIndex]).toBe(model.correctAnswer);
      expect(rendered.explanation).not.toMatch(/[$^]/);
      expect(rendered.explanationEn).not.toMatch(/[$^]/);
      expect(rendered.passage).toMatch(/[A-Za-z]/);
    }
  });
});
