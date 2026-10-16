import { describe, expect, it } from "vitest";
import { validateFigureSpec, type FigureSpec } from "../spec";
import { renderFigureSvg } from "../render";
import { figureAlt } from "../alt";
import { checkFigure } from "../check";
import { piLabel, renderTrigCurve, trigValue, validateTrigCurve, type TrigCurveSpec } from "./trig-curve";
import { checkRenderedFigure, parseTcNum } from "@/lib/problem-generation/math-archetypes/figure-qa";
import { tamperFigure } from "@/lib/problem-generation/math-archetypes/figure-verify";

const pure = (): TrigCurveSpec => ({ type: "trig_curve", fn: "sin", amp: 1, period: 2, xUnit: "pi", xRange: [0, 2], xStep: 0.5, yRange: [-1, 1], yStep: 0.5, xTitle: "x", yTitle: "y", points: [{ x: 0.2952, label: "(a, 4/5)", name: "P" }] });
const ctx = (): TrigCurveSpec => ({ type: "trig_curve", fn: "cos", amp: 4, period: 12, mid: 5, xUnit: "plain", xRange: [0, 24], xStep: 3, yRange: [0, 10], yStep: 1, xTitle: "Time (hours)", yTitle: "Height (feet)", points: [{ x: 0, label: "(0, 9)" }, { x: 6, label: "(6, 1)" }] });
const R = (s: TrigCurveSpec) => renderFigureSvg(s as FigureSpec);
const codes = (is: { code: string }[]) => is.map((i) => i.code);

describe("trig_curve 템플릿", () => {
  it("스펙 검증", () => {
    expect(validateFigureSpec(pure()).ok).toBe(true);
    expect(validateTrigCurve({ ...pure(), fn: "tan" }).ok).toBe(false);
    expect(validateTrigCurve({ ...pure(), amp: 0 }).ok).toBe(false);
    expect(validateTrigCurve({ ...pure(), xRange: [2, 0] }).ok).toBe(false);
    expect(validateTrigCurve({ ...pure(), points: [{ x: 5 }] }).ok).toBe(false);
    expect(validateTrigCurve({ ...pure(), xStep: 0.01 }).ok).toBe(false);
  });
  it("값·눈금 라벨", () => {
    expect(trigValue({ fn: "sin", amp: 2, period: 4, mid: 1, shift: 0 }, 1)).toBeCloseTo(3, 9);
    expect(trigValue({ fn: "cos", amp: 4, period: 12, mid: 5 }, 6)).toBeCloseTo(1, 9);
    expect(["0", "π/2", "π", "3π/2", "−π/4", "5π/6"].map((l, i) => piLabel([0, 0.5, 1, 1.5, -0.25, 5 / 6][i]))).toEqual(["0", "π/2", "π", "3π/2", "−π/4", "5π/6"]);
    expect([parseTcNum("π/6"), parseTcNum("−3π/2"), parseTcNum("1/2"), parseTcNum("9"), parseTcNum("a")]).toEqual([1 / 6, -1.5, 0.5, 9, null]);
  });
  it("그림: 충돌 없음·대체 설명·검사 통과, 지문의 점 이름 확인", () => {
    for (const s of [pure(), ctx()]) { const r = renderTrigCurve(s); expect(r.issues).toEqual([]); expect(figureAlt(s as FigureSpec)).toBe(r.alt); }
    expect(checkFigure(pure(), "Point $P$ is on the graph.").ok).toBe(true);
    expect(codes(checkFigure(pure(), "Point $Q$ is on the graph.").issues)).toContain("ref_missing");
    expect(codes(renderTrigCurve({ ...ctx(), amp: 6 }).issues)).toContain("clipped");
  });
});

describe("G8 충실도 검사와 돌연변이(trig_curve)", () => {
  it("원본은 통과", () => { expect(checkRenderedFigure(pure() as never, R(pure()))).toEqual([]); expect(checkRenderedFigure(ctx() as never, R(ctx()))).toEqual([]); });
  it("(a) 곡선의 진폭이 데이터와 다르게 그려지면 잡는다(폴리라인 높이를 늘림)", () => {
    const svg = R(ctx()).replace(/(<polyline points=")([^"]+)(")/, (_m, a, pts, c) => `${a}${pts.split(" ").map((p: string) => { const [x, y] = p.split(",").map(Number); return `${x},${(y - 150) * 1.3 + 150}`; }).join(" ")}${c}`);
    expect(codes(checkRenderedFigure(ctx() as never, svg))).toContain("render_value_mismatch");
  });
  it("(b) 곡선의 주기가 다르게 그려지면 잡는다(데이터 period 를 바꿔 그린 그림을 원래 데이터로 검사)", () => {
    expect(codes(checkRenderedFigure(ctx() as never, R({ ...ctx(), period: 8 })))).toContain("render_value_mismatch");
  });
  it("(c) 표시점이 곡선 위 제 자리에서 벗어나면 잡는다", () => {
    const svg = R(ctx()).replace(/(<circle cx=")([\d.]+)(" cy="[\d.]+" r="4")/, (_m, a, x, c) => `${a}${Number(x) + 15}${c}`);
    expect(codes(checkRenderedFigure(ctx() as never, svg))).toContain("render_value_mismatch");
  });
  it("(d) 표시점 라벨의 좌표가 곡선 위 점과 다르면 잡는다", () => {
    const bad = { ...ctx(), points: [{ x: 0, label: "(0, 8)" }, { x: 6, label: "(6, 1)" }] } as TrigCurveSpec;
    expect(codes(checkRenderedFigure(bad as never, R(bad)))).toContain("render_value_mismatch");
    const badPi = { ...pure(), points: [{ x: 1 / 6, label: "(π/4, 1/2)" }] } as TrigCurveSpec;
    expect(codes(checkRenderedFigure(badPi as never, R(badPi)))).toContain("render_value_mismatch");
  });
  it("(e) 축 제목이 없거나 단위 괄호가 없으면 잡는다(순수 x/y 는 허용)", () => {
    expect(codes(checkRenderedFigure({ ...ctx(), yTitle: undefined } as never, R({ ...ctx(), yTitle: undefined })))).toContain("axis_title_missing");
    expect(codes(checkRenderedFigure({ ...ctx(), yTitle: "Height" } as never, R({ ...ctx(), yTitle: "Height" })))).toContain("unit_missing_in_title");
  });
  it("'label' 변조 모드: 표시점 라벨의 마지막 정수가 바뀐다", () => {
    const m = tamperFigure(ctx(), "label") as TrigCurveSpec; expect(m.points![0].label).toBe("(0, 10)");
  });
});
