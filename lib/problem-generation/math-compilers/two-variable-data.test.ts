import { describe, expect, it } from "vitest";
import { generateTwoVarDataModel, renderTwoVarDataProblem, validateTwoVarDataModel } from "./two-variable-data";
import { checkFigure } from "@/lib/problem-figures/check";

describe("generateTwoVarDataModel — 결정적 계산(양방향표)", () => {
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

describe("renderTwoVarDataProblem — 렌더링·해설(양방향표)", () => {
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
        expect(rendered.figure).toMatchObject({ type: "data", kind: "two_way" });
      }
    }
  });
});

// 2026-09-17(Step 4 항목 5) — 산점도·최적합선. CollegeBoard 실기출 매핑에서 가장 빈번한(8회) 갭.
describe("generateTwoVarDataModel — 결정적 계산(산점도)", () => {
  const kinds = ["scatter_equation", "scatter_predict", "scatter_slope_context", "scatter_count_above"] as const;
  for (const kind of kinds) {
    it(`${kind} — validate 통과, 오답 3개, 정답과 중복 없음(80회, 전 난이도)`, () => {
      const difficulties = ["easy", "medium", "hard"] as const;
      for (let i = 0; i < 80; i++) {
        const model = generateTwoVarDataModel({ difficulty: difficulties[i % 3], questionKind: kind });
        expect(validateTwoVarDataModel(model)).toEqual({ ok: true });
        expect(model.distractors).toHaveLength(3);
        const values = [model.correctAnswer, ...model.distractors.map((d) => d.value)];
        expect(new Set(values).size).toBe(4);
      }
    });
  }
});

describe("renderTwoVarDataProblem — 렌더링·해설(산점도)", () => {
  it("영어 지문/질문과 $/^ 없는 해설, plane+scatter figure가 실제로 채워지고 렌더 검증(checkFigure)을 통과한다", () => {
    const kinds = ["scatter_equation", "scatter_predict", "scatter_slope_context", "scatter_count_above"] as const;
    for (const kind of kinds) {
      for (let i = 0; i < 15; i++) {
        const difficulty = i % 2 === 0 ? "medium" : "hard";
        const model = generateTwoVarDataModel({ difficulty, questionKind: kind });
        const rendered = renderTwoVarDataProblem(model);
        expect(rendered.options).toHaveLength(4);
        expect(new Set(rendered.options).size).toBe(4);
        expect(rendered.options[rendered.correctIndex]).toBe(model.correctAnswer);
        expect(rendered.explanation).not.toMatch(/[$^]/);
        expect(rendered.explanationEn).not.toMatch(/[$^]/);
        expect(rendered.passage).toMatch(/as shown/i);
        expect(rendered.figure).toMatchObject({ type: "plane" });
        const figure = rendered.figure as { type: "plane"; objects: { kind: string; points?: unknown[]; fitLine?: unknown }[] };
        const scatterObj = figure.objects.find((o) => o.kind === "scatter");
        expect(scatterObj).toBeDefined();
        expect((scatterObj?.points ?? []).length).toBeGreaterThanOrEqual(6);
        expect(scatterObj?.fitLine).toBeTruthy();

        // 실제 렌더링 검증(admin/학생 화면이 쓰는 것과 같은 검사 경로) — 그림이 실제로
        // 그려지는지(축 밖 이탈, 라벨 충돌 등 없음)까지 확인한다. figure JSON만 보고
        // "괜찮아 보인다"고 넘기지 않는다.
        const check = checkFigure(rendered.figure, rendered.passage, rendered.options, rendered.correctIndex);
        expect(check.ok, JSON.stringify(check.issues)).toBe(true);
        expect(check.alt).toContain("산점도");
      }
    }
  });

  it("라벨 충돌 스트레스 — 300회 생성해도 매번 렌더 검증을 통과한다(새 figure 유형 — 점이 많아 라벨이 겹칠 위험)", () => {
    const kinds = ["scatter_equation", "scatter_predict", "scatter_slope_context", "scatter_count_above"] as const;
    for (let i = 0; i < 300; i++) {
      const kind = kinds[i % kinds.length];
      const difficulty = (["easy", "medium", "hard"] as const)[i % 3];
      const model = generateTwoVarDataModel({ difficulty, questionKind: kind });
      const rendered = renderTwoVarDataProblem(model);
      const check = checkFigure(rendered.figure, rendered.passage, rendered.options, rendered.correctIndex);
      expect(check.ok, JSON.stringify({ i, kind, difficulty, issues: check.issues })).toBe(true);
    }
  });

  it("scatter_count_above — 정답이 실제로 추세선보다 엄격히 위에 있는 점의 개수와 일치한다(결정적 재계산)", () => {
    for (let i = 0; i < 30; i++) {
      const model = generateTwoVarDataModel({ difficulty: "hard", questionKind: "scatter_count_above" });
      if (!("slope" in model)) throw new Error("unexpected table model");
      const above = model.points.filter(([x, y]) => y > model.slope * x + model.intercept).length;
      expect(model.correctAnswer).toBe(String(above));
    }
  });

  it("scatter_predict — 정답이 slope*x+intercept 로 정확히 재계산된다", () => {
    for (let i = 0; i < 30; i++) {
      const model = generateTwoVarDataModel({ difficulty: "medium", questionKind: "scatter_predict" });
      if (!("slope" in model) || model.predictX === undefined) throw new Error("unexpected model shape");
      const expected = model.slope * model.predictX + model.intercept;
      expect(Number(model.correctAnswer)).toBeCloseTo(expected, 6);
    }
  });
});
