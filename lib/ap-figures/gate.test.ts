import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compileExpr } from "../problem-figures/templates/ap-expr";
import { renderFigureSvg } from "../problem-figures/render";
import { checkFigure } from "../problem-figures/check";
import { gateCandidate, type ApCandidateLike } from "./gate";

const cand = (stimulus: unknown, stem: string, subject = "ap_calculus_ab"): ApCandidateLike => ({ candidateKey: "t", apSubjectCode: subject, kind: "mc", payload: { stem, options: ["a", "b", "c", "d"], stimulus } });

describe("ap-expr", () => {
  it("evaluates implicit multiplication and functions without eval", () => {
    expect(compileExpr("100 - 2Q", ["Q"])!.fn({ Q: 10 })).toBe(80);
    expect(compileExpr("2*sqrt(x)", ["x"])!.fn({ x: 4 })).toBe(4);
    expect(compileExpr("0.5x^2 - 3", ["x"])!.fn({ x: 2 })).toBe(-1);
    expect(compileExpr("process.exit()", ["x"])).toBeNull();
  });
});

describe("ap figure gate", () => {
  const graph = (points: number[][], extra = {}) => ({ kind: "graph", description: "g", data: { x_axis: { label: "x", min: 0, max: 8, tick_step: 1 }, y_axis: { label: "f'(x)", min: -3, max: 4, tick_step: 1 }, type: "piecewise_linear", points, ...extra } });
  it("passes a piecewise-linear derivative graph whose cited points lie on the curve", () => {
    const r = gateCandidate(cand(graph([[0, 2], [2, 0], [4, -2], [6, 0], [8, 3]]), "The graph of f' is shown and consists of line segments joining the points (0,2), (2,0), (4,-2), (6,0), and (8,3)."));
    expect(r.status).toBe("pass");
    expect(r.need).toBe("required");
  });
  it("fails when a cited point is not on the drawn curve", () => {
    const r = gateCandidate(cand(graph([[0, 2], [2, 0], [4, -2], [6, 0], [8, 3]]), "The graph of f' is shown and passes through the points (0,2), (2,1), (4,-2)."));
    expect(r.status).toBe("fail");
    expect(r.issues.some((i) => i.code === "cited_point_off_curve")).toBe(true);
  });
  it("fails when a declared intersection is wrong (code-computed)", () => {
    const d = { x_axis: { label: "x", min: -3, max: 3 }, y_axis: { label: "y", min: -2, max: 6 }, curves: [{ label: "f", expression: "x^2" }, { label: "g", expression: "4-x^2" }], intersections: [[1.0, 2]] };
    const r = gateCandidate(cand({ kind: "graph", description: "g", data: d }, "The graphs of f and g are shown."));
    expect(r.status).toBe("fail");
    expect(r.issues.some((i) => i.code === "declared_intersection_mismatch")).toBe(true);
  });
  it("flags a stem that points at a figure when only text data exists", () => {
    const r = gateCandidate(cand({ kind: "none", description: "none" }, "The graph shown below depicts f."));
    expect(r.status).toBe("fail");
    expect(r.issues.some((i) => i.code === "figure_referenced_but_missing")).toBe(true);
  });
  it("renders tables and classifies need; repairs truncated JSON strings", () => {
    const stim = '{"kind":"table","description":"d","data":{"title":"T","columns":["x","f(x)"],"rows":[[1,2.5],[2,3.5]]}';
    const r = gateCandidate(cand(stim, "The table shows values of f. What is f(2)?"));
    expect(r.status).toBe("pass");
    expect(r.issues.some((i) => i.code === "stimulus_json_repaired")).toBe(true);
    expect(r.output).toContain("<table");
  });
  it("is wired into the standard figure pipeline", () => {
    const r = gateCandidate(cand(graph([[0, 2], [8, 3]]), "The graph is shown."));
    expect(r.spec).not.toBeNull();
    const svg = renderFigureSvg(r.spec as never);
    expect(svg).toContain("<svg");
    expect(checkFigure(r.spec, "The graph is shown.").ok).toBe(true);
  });
});

describe("stock render snapshot", () => {
  it("no current stock candidate fails the render gate except known data defects", () => {
    const items = JSON.parse(readFileSync(path.resolve(process.cwd(), "data/ap/stock/items.json"), "utf-8")) as ApCandidateLike[];
    const bad = items.map((c) => gateCandidate(c)).filter((r) => r.status === "fail").map((r) => r.key);
    expect(bad.length).toBeLessThanOrEqual(3);
  });
});
