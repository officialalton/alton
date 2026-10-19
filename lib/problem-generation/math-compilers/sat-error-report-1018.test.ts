// 외부 검수 SAT Practice Test 1 Math 오류 신고(2026-10-18) 회귀 테스트 — 같은 결함이 컴파일러·템플릿에서 다시 나오지 않게 한다.
import { describe, expect, it } from "vitest";
import { hasGraphAndExpressionForSameCurves, explicitEquations, drawnCurveCount } from "../graph-expression-redundancy";
import { generateRightTriModel, renderRightTriProblem } from "./right-triangles-trigonometry";
import { generateInferenceModel, renderInferenceProblem, CONTEXT_PHRASES } from "./inference-from-sample";
import { generateLinearFunctionModel, renderLinearFunctionProblem } from "./linear-functions";
import { generateNonlinearFnModel, renderNonlinearFnProblem } from "./nonlinear-functions";
import { generateNonlinearEqModel, renderNonlinearEqProblem } from "./nonlinear-equations-systems";
import { generateCirclesModel, renderCirclesProblem } from "./circles";
import { generateLinearTwoVarModel, renderLinearTwoVarProblem } from "./linear-two-variables";
import { generateLinearInequalityModel, renderLinearInequalityProblem } from "./linear-inequalities";
import { runMathCompilerBatch } from "./batch";
import { renderData, barLineNeedsValueLabels, type DataSpec } from "@/lib/problem-figures/templates/data";
import { makeRng } from "../math-archetypes/rng";
import { ITEM as POLY_TB } from "../math-archetypes/skills/fig/items/equivalent_expressions.polynomial_distribution.TB.P";

const N = 60;

describe("검출기 graph-expression-redundancy", () => {
  it("그래프와 같은 곡선의 식이 둘 다 있으면 true, 식만/그래프만이면 false", () => {
    const fig = { type: "plane", objects: [{ kind: "function" }] };
    expect(hasGraphAndExpressionForSameCurves(fig, "The graph of $f(x) = (x + 1)(x - 3)$ is shown.")).toBe(true);
    expect(hasGraphAndExpressionForSameCurves(fig, "The graph of y = f(x) is shown in the xy-plane below.")).toBe(false);
    expect(hasGraphAndExpressionForSameCurves(null, "The function f is defined by f(x) = 2x + 1.")).toBe(false);
  });
  it("f(x) = 0 같은 값 조건, g(x) 가 섞인 식, 미지 상수 a·b 식은 곡선 정의로 세지 않는다", () => {
    expect(explicitEquations("The equation $f(x) = 0$ has two solutions. $f(x) = g(x)$. $p(x) = a \\cdot b^x$.")).toEqual([]);
    expect(explicitEquations("line $\\ell$ is $y = 2x - 1$ and line $m$ is $y = -x + 5$")).toHaveLength(2);
    expect(drawnCurveCount({ type: "plane", objects: [{ kind: "line" }, { kind: "scatter" }, { kind: "point" }] })).toBe(1);
  });
});

describe("Math 13번 — 삼각비 표기는 'sin B' (SAT 관례)", () => {
  it("문항·해설 어디에도 sin(angle B) 꼴이 없다", () => {
    let seen = 0;
    for (let i = 0; i < N; i++) {
      const model = generateRightTriModel({ difficulty: "medium", questionKind: "trig_ratio" });
      const r = renderRightTriProblem(model);
      expect(r.question).toMatch(/^What is (sin|cos|tan) [BC] in the right triangle shown\?$/);
      for (const t of [r.passage, r.question, r.explanation, r.explanationEn]) expect(t).not.toMatch(/\b(sin|cos|tan)\s*\(\s*(angle\s+)?[BC]\s*\)/);
      seen++;
    }
    expect(seen).toBe(N);
  });
});

describe("Math 14번 — 표본 추정 문항은 성질을 문장으로 명시한다", () => {
  it("'same characteristic'·'this characteristic' 가 없고 질문이 성질(예: work remotely at least once a week)을 직접 쓴다", () => {
    for (let i = 0; i < N * 2; i++) {
      for (const figureMode of [undefined, "data" as const]) {
        const model = generateInferenceModel({ difficulty: "medium" });
        const r = renderInferenceProblem(model, figureMode ? { figureMode } : undefined);
        const ph = CONTEXT_PHRASES[model.context];
        expect(ph).toBeTruthy();
        for (const t of [r.passage, r.question]) expect(t).not.toMatch(/same characteristic|this characteristic/i);
        expect(r.question).toBe(`Based on the sample, about how many of the ${model.population} ${ph.population} would be expected to ${ph.traitInfinitive}?`);
        expect(r.passage).toContain(`${model.sampleCount} ${ph.trait}.`);
      }
    }
  });
  it("모든 context 가 어휘표에 있다", () => {
    expect(Object.keys(CONTEXT_PHRASES)).toHaveLength(4);
    expect(CONTEXT_PHRASES["employees of a company who work remotely at least once a week"].traitInfinitive).toBe("work remotely at least once a week");
  });
});

describe("Math 10·11·15·19번 — 그래프와 식을 둘 다 주지 않는다(한 표현만)", () => {
  it("linear_functions plane: 그래프만(식·점 목록 없음), 그림은 유지", () => {
    for (const questionKind of ["evaluate", "find_x_for_value", "slope_from_two_points"] as const) {
      for (let i = 0; i < 30; i++) {
        const model = generateLinearFunctionModel({ difficulty: "medium", questionKind, figureMode: "plane" });
        const r = renderLinearFunctionProblem(model, { figureMode: "plane" });
        expect((r.figure as { type: string }).type).toBe("plane");
        expect(r.passage).not.toMatch(/defined by|passes through/);
        expect(explicitEquations(r.passage)).toEqual([]);
        expect(hasGraphAndExpressionForSameCurves(r.figure as never, r.passage)).toBe(false);
        expect(r.options[r.correctIndex]).toBe(model.correctAnswer);
      }
    }
  });
  it("linear_functions text: 식만(그림 없음)", () => {
    const model = generateLinearFunctionModel({ difficulty: "medium", questionKind: "evaluate" });
    const r = renderLinearFunctionProblem(model);
    expect(r.figure).toBeNull();
    expect(r.passage).toMatch(/defined by/);
  });
  it("nonlinear_functions plane: 꼭짓점 읽기는 그래프만, evaluate 는 plane 과 함께 낼 수 없다", () => {
    for (const questionKind of ["vertex_x", "vertex_y"] as const) {
      for (let i = 0; i < 30; i++) {
        const model = generateNonlinearFnModel({ difficulty: "medium", family: "quadratic", questionKind });
        const r = renderNonlinearFnProblem(model, { figureMode: "plane" });
        expect((r.figure as { type: string }).type).toBe("plane");
        expect(explicitEquations(r.passage)).toEqual([]);
        expect(r.passage).not.toMatch(/defined by/);
      }
    }
    const ev = generateNonlinearFnModel({ difficulty: "medium", family: "quadratic", questionKind: "evaluate" });
    expect(() => renderNonlinearFnProblem(ev, { figureMode: "plane" })).toThrow(/evaluate/);
  });
  it("nonlinear_functions 배치 require_plane: 그림이 있고 식이 지문에 없다 / evaluate 지정은 거부", async () => {
    const res = await runMathCompilerBatch({ skillCode: "nonlinear_functions", difficulty: "medium", count: 6, figurePolicy: "require_plane" });
    expect(res.accepted.length).toBeGreaterThan(0);
    for (const a of res.accepted) {
      expect((a.problem.figure as { type: string }).type).toBe("plane");
      expect(hasGraphAndExpressionForSameCurves(a.problem.figure as never, String(a.problem.passage))).toBe(false);
    }
    const bad = await runMathCompilerBatch({ skillCode: "nonlinear_functions", difficulty: "medium", count: 1, figurePolicy: "require_plane", kind: "evaluate" });
    expect(bad.accepted).toHaveLength(0);
  });
  it("nonlinear_equations_systems plane(일차·이차 교점): 그래프만", () => {
    for (let i = 0; i < 40; i++) {
      const model = generateNonlinearEqModel({ difficulty: "medium", figureMode: "plane" });
      const r = renderNonlinearEqProblem(model, { figureMode: "plane" });
      expect((r.figure as { type: string }).type).toBe("plane");
      expect(r.passage).not.toMatch(/\$y =/);
      expect(hasGraphAndExpressionForSameCurves(r.figure as never, r.passage)).toBe(false);
      expect(r.question).toMatch(/graphs? shown|two graphs shown/);
    }
  });
  it("circles plane: 방정식·중심·반지름을 지문에 쓰지 않는다", () => {
    for (let i = 0; i < 60; i++) {
      const model = generateCirclesModel({ difficulty: "medium", questionKind: "circle_equation_transform", figureMode: "plane" });
      const r = renderCirclesProblem(model, { figureMode: "plane" });
      expect((r.figure as { type: string }).type).toBe("plane");
      expect(r.passage).not.toMatch(/defined by the equation|has center|\(x\s*[-+]/);
    }
  });
  it("linear_equations_two_var: 지문에 두 식을 주는 경로는 그래프를 붙이지 않는다", () => {
    for (const questionKind of ["intersection_x", "intersection_y", "intersection_sum", "slope", "intercept", "num_solutions"] as const) {
      const r = renderLinearTwoVarProblem(generateLinearTwoVarModel({ difficulty: "medium", questionKind }));
      expect(r.figure).toBeNull();
    }
  });
  it("linear_inequalities point_in_solution: 식만(그림 없음)", () => {
    const r = renderLinearInequalityProblem(generateLinearInequalityModel({ difficulty: "medium", questionKind: "point_in_solution" }));
    expect(r.figure).toBeNull();
  });
});

describe("Math 2번 — 막대·선그래프는 눈금으로 읽을 수 없는 값에 데이터 라벨을 붙인다", () => {
  const base = { type: "data" as const, kind: "bar" as const, categories: ["2010", "2020"], xTitle: "Year", yTitle: "Population (thousands)", yMin: 0, yMax: 50, yStep: 10 };
  it("값이 눈금선 위에 있지 않으면 라벨(값 텍스트)이 그려진다", () => {
    const off: DataSpec = { ...base, series: [{ values: [20, 37] }] };
    expect(barLineNeedsValueLabels(off)).toBe(true);
    const svg = renderData(off).markup;
    expect(svg).toContain(">37<");
    expect(svg).toContain(">20<".replace(">20<", ">20<"));
  });
  it("모든 값이 눈금선 위면 라벨을 붙이지 않는다(눈금 읽기 문항을 쉽게 만들지 않는다)", () => {
    const on: DataSpec = { ...base, series: [{ values: [20, 30] }] };
    expect(barLineNeedsValueLabels(on)).toBe(false);
    const svg = renderData(on).markup;
    // y축 눈금 텍스트(0..50)만 있고 막대 위 라벨은 없다 — 라벨은 font-size 11, 눈금은 12.
    expect(svg).not.toContain('font-size="11"');
  });
  it("valueLabels 로 명시하면 눈금 위 값에도 라벨을 켜고 끌 수 있다", () => {
    const on: DataSpec = { ...base, series: [{ values: [20, 30] }], valueLabels: true };
    expect(renderData(on).markup).toContain('font-size="11"');
    const off: DataSpec = { ...base, series: [{ values: [20, 37] }], valueLabels: false };
    expect(renderData(off).markup).not.toContain('font-size="11"');
  });
});

describe("Math 7번 — 표준형을 이미 줄 때 차수 안내를 반복하지 않는다", () => {
  it("polynomial_distribution.TB: 지문에 ax² + bx + c 가 있으면 'quadratic'·'degree 2'·'highest power' 가 없다", () => {
    let withStd = 0;
    for (const level of POLY_TB) {
      for (let seed = 1; seed <= 40; seed++) {
        let inst;
        try { inst = level.generate(makeRng(seed * 7919)); } catch { continue; }
        const text = String(inst.stimulus);
        expect(text).not.toMatch(/highest power|second-degree|degree 2|quadratic (polynomial|expression)/i);
        if (/ax\^2 \+ bx \+ c/.test(text)) withStd++;
      }
    }
    expect(withStd).toBeGreaterThan(0);
  });
});
