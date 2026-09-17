import { describe, expect, it } from "vitest";
import { generateOneVarDataModel, renderOneVarDataProblem, validateOneVarDataModel } from "./one-variable-data";

describe("generateOneVarDataModel — 결정적 계산", () => {
  const kinds = ["mean", "median", "range"] as const;
  for (const kind of kinds) {
    it(`${kind} — validate 통과, 오답 3개, 정답과 중복 없음(50회, 전 난이도)`, () => {
      const difficulties = ["easy", "medium", "hard"] as const;
      for (let i = 0; i < 50; i++) {
        const model = generateOneVarDataModel({ difficulty: difficulties[i % 3], questionKind: kind });
        expect(validateOneVarDataModel(model)).toEqual({ ok: true });
        expect(model.distractors).toHaveLength(3);
        const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
        expect(new Set(values).size).toBe(4);
      }
    });
  }
});

describe("renderOneVarDataProblem — 렌더링·해설", () => {
  it("영어 지문/질문과 $/^ 없는 해설을 낸다", () => {
    const kinds = ["mean", "median", "range"] as const;
    for (const kind of kinds) {
      for (let i = 0; i < 10; i++) {
        const model = generateOneVarDataModel({ difficulty: "hard", questionKind: kind });
        const rendered = renderOneVarDataProblem(model);
        expect(rendered.options).toHaveLength(4);
        expect(rendered.options[rendered.correctIndex]).toBe(model.correctAnswer);
        expect(rendered.explanation).not.toMatch(/[$^]/);
        expect(rendered.explanationEn).not.toMatch(/[$^]/);
      }
    }
  });

  it("figure(number_list)를 실제로 채운다(2026-09-17 버그 수정 — 이전엔 표/그래프 필수 유형인데 figure가 항상 null이었다)", () => {
    const model = generateOneVarDataModel({ difficulty: "medium", questionKind: "mean" });
    const rendered = renderOneVarDataProblem(model);
    expect(rendered.figure).toEqual({ type: "data", kind: "number_list", values: model.values, label: "Value" });
    expect(rendered.passage).toMatch(/shown below/i);
  });
});
