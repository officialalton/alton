import { describe, expect, it } from "vitest";
import { generateTwoVarDataModel, renderTwoVarDataProblem, validateTwoVarDataModel } from "./two-variable-data";

describe("generateTwoVarDataModel — 결정적 계산", () => {
  const kinds = ["cell", "row_total", "conditional_share"] as const;
  for (const kind of kinds) {
    it(`${kind} — validate 통과, 오답 3개, 정답과 중복 없음(50회, 전 난이도)`, () => {
      const difficulties = ["easy", "medium", "hard"] as const;
      for (let i = 0; i < 50; i++) {
        const model = generateTwoVarDataModel({ difficulty: difficulties[i % 3], questionKind: kind });
        expect(validateTwoVarDataModel(model)).toEqual({ ok: true });
        expect(model.distractors).toHaveLength(3);
        const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
        expect(new Set(values).size).toBe(4);
      }
    });
  }
});

describe("renderTwoVarDataProblem — 렌더링·해설", () => {
  it("영어 지문/질문과 $/^ 없는 해설, 양방향표 figure가 실제로 채워진다(2026-09-17 버그 수정 — 이전엔 표가 지문 안 마크다운으로만 있고 figure가 없었다)", () => {
    const kinds = ["cell", "row_total", "conditional_share"] as const;
    for (const kind of kinds) {
      for (let i = 0; i < 10; i++) {
        const model = generateTwoVarDataModel({ difficulty: "hard", questionKind: kind });
        const rendered = renderTwoVarDataProblem(model);
        expect(rendered.options).toHaveLength(4);
        expect(rendered.options[rendered.correctIndex]).toBe(model.correctAnswer);
        expect(rendered.explanation).not.toMatch(/[$^]/);
        expect(rendered.explanationEn).not.toMatch(/[$^]/);
        expect(rendered.passage).toMatch(/as shown/i);
        expect(rendered.figure).not.toBeNull();
        expect(rendered.figure).toMatchObject({ type: "data", kind: "two_way", rowLabels: model.rowLabels, colLabels: model.colLabels, cells: model.table });
      }
    }
  });
});
