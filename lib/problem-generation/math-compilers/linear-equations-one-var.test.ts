import { describe, expect, it } from "vitest";
import {
  generateLinearOneVarModel,
  generateWordProblemTranslateModel,
  renderLinearOneVarProblem,
  renderWordProblemTranslateProblem,
  validateLinearOneVarModel,
} from "./linear-equations-one-var";

describe("generateLinearOneVarModel — 결정적 계산", () => {
  it("항상 실제 방정식(a x + b = c x + d)에 들어맞는 정수해를 낸다(100회 반복)", () => {
    for (let i = 0; i < 100; i++) {
      const model = generateLinearOneVarModel({ difficulty: "medium", kind: "solve" });
      if (model.kind !== "solve") throw new Error("unreachable");
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
      const model = generateLinearOneVarModel({ difficulty: difficulties[i % 3], kind: "solve" });
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
        const m = generateLinearOneVarModel({ difficulty, kind: "solve" });
        if (m.kind !== "solve") throw new Error("unreachable");
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
      const model = generateLinearOneVarModel({ difficulty: "medium", kind: "solve" });
      const rendered = renderLinearOneVarProblem(model);
      expect(rendered.options).toHaveLength(4);
      expect(rendered.options[rendered.correctIndex]).toBe(model.correctAnswer);
      expect(rendered.explanation).toContain(model.correctAnswer);
      expect(rendered.explanation).toMatch(/이항하면|정리하면/);
    }
  });
});

describe("generateWordProblemTranslateModel — 문장제 → 방정식 세우기(Step 4 고빈도 공백 1번)", () => {
  it("정답 방정식은 실제로 성립하고, x는 항상 정수해다(100회 반복, 전 난이도)", () => {
    const difficulties = ["easy", "medium", "hard"] as const;
    for (let i = 0; i < 100; i++) {
      const model = generateWordProblemTranslateModel({ difficulty: difficulties[i % 3] });
      expect((model.c - model.b) % model.a).toBe(0);
      expect(validateLinearOneVarModel(model)).toEqual({ ok: true });
      expect(model.correctAnswer).toMatch(/^\d*x [+-] \d+ = -?\d+$/);
    }
  });

  it("오답 3개는 정답과 겹치지 않고, 실제 오역 오류(부호 반전/그룹핑/계수-상수 스왑)에서만 나온다(100회 반복)", () => {
    const allowedKinds = new Set(["sign_error", "formula_misuse", "condition_ignored"]);
    for (let i = 0; i < 100; i++) {
      const model = generateWordProblemTranslateModel({ difficulty: "medium" });
      expect(model.distractors.length).toBeGreaterThanOrEqual(2);
      const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
      expect(new Set(values).size).toBe(values.length);
      for (const d of model.distractors) expect(allowedKinds.has(d.kind)).toBe(true);
    }
  });

  it("영어 지문에 more than/less than 관계가 명시되고, 해설이 정답 방정식을 포함한다(20회 반복)", () => {
    for (let i = 0; i < 20; i++) {
      const model = generateWordProblemTranslateModel({ difficulty: "hard" });
      const rendered = renderWordProblemTranslateProblem(model);
      expect(rendered.passage).toMatch(/more than|less than/);
      expect(rendered.passage).not.toMatch(/[$^]/);
      expect(rendered.options).toHaveLength(model.distractors.length + 1);
      expect(rendered.options[rendered.correctIndex]).toBe(model.correctAnswer);
      expect(rendered.explanation).toContain(model.correctAnswer);
      expect(rendered.explanationEn).toContain(model.correctAnswer);
      expect(rendered.explanation).not.toMatch(/[$^]/);
      expect(rendered.explanationEn).not.toMatch(/[$^]/);
    }
  });

  it("generateLinearOneVarModel(kind: word_problem_translate)로도 동일하게 생성된다", () => {
    const model = generateLinearOneVarModel({ difficulty: "medium", kind: "word_problem_translate" });
    expect(model.kind).toBe("word_problem_translate");
  });
});
