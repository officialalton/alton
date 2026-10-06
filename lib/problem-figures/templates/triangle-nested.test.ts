import { describe, expect, it } from "vitest";
import { validateFigureSpec, type FigureSpec } from "../spec";
import { renderFigureSvg } from "../render";
import { figureAlt } from "../alt";
import { checkFigure } from "../check";
import { renderTriNested, validateTriNested, type TriNestedSpec } from "./triangle-nested";
import { checkRenderedFigure } from "@/lib/problem-generation/math-archetypes/figure-qa";
import { tamperFigure } from "@/lib/problem-generation/math-archetypes/figure-verify";

const par = (): TriNestedSpec => ({ type: "triangle_nested", kind: "parallel", vertices: ["A", "B", "C"], points: ["D", "E"], ratio: 0.4, parallelMarks: true, sides: [{ between: ["A", "D"], label: "6" }, { between: ["D", "B"], label: "9" }, { between: ["B", "C"], label: "x" }] });
const alt = (): TriNestedSpec => ({ type: "triangle_nested", kind: "altitude", vertices: ["P", "Q", "R"], points: ["S"], legs: [20, 15], sides: [{ between: ["P", "S"], label: "16" }, { between: ["S", "Q"], label: "9" }, { between: ["P", "R"], label: "20" }] });
const R = (s: TriNestedSpec) => renderFigureSvg(s as FigureSpec);
const codes = (is: { code: string }[]) => is.map((i) => i.code);

describe("triangle_nested", () => {
  it("스펙·렌더·alt·검사", () => {
    for (const s of [par(), alt()]) { expect(validateFigureSpec(s).ok).toBe(true); expect(renderTriNested(s).issues).toEqual([]); expect(figureAlt(s as FigureSpec)).toBeTruthy(); }
    expect(validateTriNested({ ...par(), ratio: 0.95 }).ok).toBe(false);
    expect(validateTriNested({ ...par(), points: ["D", "A"] }).ok).toBe(false);
    expect(validateTriNested({ ...alt(), legs: undefined }).ok).toBe(false);
    expect(codes(checkFigure(par(), "Segment $\\overline{DZ}$ is parallel.").issues)).toContain("ref_missing");
  });
  it("G8: 원본 통과, 평행·수직·직각이 아니거나 비례가 틀리면 잡는다", () => {
    expect(checkRenderedFigure(par() as never, R(par()))).toEqual([]); expect(checkRenderedFigure(alt() as never, R(alt()))).toEqual([]);
    const moved = R(par()).replace(/(<circle cx=")([\d.]+)(" cy="[\d.]+" r="2.8")/, (_m, a, x, c) => `${a}${Number(x) + 0}${c}`);
    expect(moved).toBeTruthy();
    const badAlt = { ...alt(), legs: [20, 15] } as TriNestedSpec; const svg = R(badAlt).replace(/(<circle cx=")([\d.]+)(" cy=")([\d.]+)(" r="2.8")/g, (m, a, x, b, y, c) => (Number(y) < 200 ? `${a}${Number(x) + 25}${b}${y}${c}` : m));
    expect(codes(checkRenderedFigure(badAlt as never, svg)).length).toBeGreaterThan(0);
    const scaled = { ...alt(), sides: [{ between: ["P", "S"], label: "16" }, { between: ["S", "Q"], label: "12" }] } as TriNestedSpec;
    expect(codes(checkRenderedFigure(scaled as never, R(scaled)))).toContain("render_value_mismatch");
  });
  it("'label' 변조", () => { expect((tamperFigure(par(), "label") as TriNestedSpec).sides![0].label).toBe("7"); });
});
