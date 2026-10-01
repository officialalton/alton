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
    if (model.questionKind === "grouped_median_interval") throw new Error("unreachable");
    expect(rendered.figure).toEqual({ type: "data", kind: "number_list", values: model.values, label: "Value" });
    expect(rendered.passage).toMatch(/shown below/i);
  });
});

describe("grouped_median_interval — 그룹화 도수분포표 중앙값 구간", () => {
  it("validate 통과, 오답 3개, 정답과 중복 없음(50회, 전 난이도)", () => {
    const difficulties = ["easy", "medium", "hard"] as const;
    for (let i = 0; i < 50; i++) {
      const model = generateOneVarDataModel({ difficulty: difficulties[i % 3], questionKind: "grouped_median_interval" });
      expect(validateOneVarDataModel(model)).toEqual({ ok: true });
      expect(model.distractors).toHaveLength(3);
      const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
      expect(new Set(values).size).toBe(4);
    }
  });

  it("전체 개수(N)는 항상 홀수이고, 정답은 실제로 누적도수가 순위에 처음 도달하는 구간이다", () => {
    for (let i = 0; i < 30; i++) {
      const model = generateOneVarDataModel({ difficulty: "hard", questionKind: "grouped_median_interval" });
      if (model.questionKind !== "grouped_median_interval") throw new Error("unreachable");
      expect(model.totalCount % 2).toBe(1);
      let cum = 0;
      let expectedIndex = -1;
      for (let idx = 0; idx < model.intervals.length; idx++) {
        cum += model.intervals[idx].frequency;
        if (cum >= model.medianRank) { expectedIndex = idx; break; }
      }
      expect(model.medianIntervalIndex).toBe(expectedIndex);
      expect(model.intervals[expectedIndex].label).toBe(model.correctAnswer);
    }
  });

  it("구간 라벨이 서로 겹치거나 중복되지 않는다(라벨 충돌 스트레스 테스트, hard=6구간 최대치)", () => {
    for (let i = 0; i < 40; i++) {
      const model = generateOneVarDataModel({ difficulty: "hard", questionKind: "grouped_median_interval" });
      if (model.questionKind !== "grouped_median_interval") throw new Error("unreachable");
      const labels = model.intervals.map((iv) => iv.label);
      expect(new Set(labels).size).toBe(labels.length);
      // 구간은 이어지고 겹치지 않아야 한다: 다음 구간의 lower = 이전 구간의 upper + 1.
      for (let idx = 1; idx < model.intervals.length; idx++) {
        expect(model.intervals[idx].lower).toBe(model.intervals[idx - 1].upper + 1);
      }
      const rendered = renderOneVarDataProblem(model);
      expect(rendered.figure).toEqual({
        type: "data", kind: "table",
        columns: ["Interval", "Frequency"],
        rows: model.intervals.map((iv) => [iv.label, iv.frequency]),
      });
      expect(rendered.options).toHaveLength(4);
      expect(new Set(rendered.options).size).toBe(4);
      expect(rendered.passage).toMatch(/below/i);
      expect(rendered.explanation).not.toMatch(/[$^]/);
      expect(rendered.explanationEn).not.toMatch(/[$^]/);
    }
  });

  it("영어 지문/질문과 해설을 낸다", () => {
    for (let i = 0; i < 10; i++) {
      const model = generateOneVarDataModel({ difficulty: "medium", questionKind: "grouped_median_interval" });
      const rendered = renderOneVarDataProblem(model);
      expect(rendered.question).toMatch(/which interval contains the median/i);
      expect(rendered.explanation).toContain(rendered.options[rendered.correctIndex]);
      expect(rendered.explanationEn).toContain(rendered.options[rendered.correctIndex]);
    }
  });
});
