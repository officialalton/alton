import { describe, expect, it } from "vitest";
import { validateFigureSpec, type FigureSpec } from "../spec";
import { renderFigureSvg } from "../render";
import { figureAlt } from "../alt";
import { renderParallelThree, validateParallelThree, type ParallelThreeSpec } from "./parallel-three";
import { checkRenderedFigure } from "@/lib/problem-generation/math-archetypes/figure-qa";
import { tamperFigure } from "@/lib/problem-generation/math-archetypes/figure-verify";

const p3 = (): ParallelThreeSpec => ({ type: "parallel_three", lines: ["j", "k", "l"], transversal: "t", angle: 62, gaps: [1, 1.3], labels: [{ line: 0, region: "NE", label: "62°" }, { line: 2, region: "SW", label: "(5x+2)°" }, { line: 1, region: "NW", label: "y°" }] });
const R = (s: ParallelThreeSpec) => renderFigureSvg(s as FigureSpec);
const codes = (is: { code: string }[]) => is.map((i) => i.code);

describe("parallel_three", () => {
  it("스펙·렌더·alt", () => {
    expect(validateFigureSpec(p3()).ok).toBe(true); expect(renderParallelThree(p3()).issues).toEqual([]); expect(figureAlt(p3() as FigureSpec)).toContain("평행선");
    expect(validateParallelThree({ ...p3(), angle: 90 }).ok).toBe(false);
    expect(validateParallelThree({ ...p3(), lines: ["j", "j", "l"] }).ok).toBe(false);
    expect(validateParallelThree({ ...p3(), labels: [] }).ok).toBe(false);
  });
  it("G8: 원본 통과, 라벨 각이 그려진 각과 다르거나 기울기·간격이 어긋나면 잡는다", () => {
    expect(checkRenderedFigure(p3() as never, R(p3()))).toEqual([]);
    const bad = { ...p3(), labels: [{ line: 0, region: "NE", label: "80°" }] } as ParallelThreeSpec; expect(codes(checkRenderedFigure(bad as never, R(bad)))).toContain("render_value_mismatch");
    const nw = { ...p3(), labels: [{ line: 0, region: "NW", label: "62°" }] } as ParallelThreeSpec; expect(codes(checkRenderedFigure(nw as never, R(nw)))).toContain("render_value_mismatch");
    expect(codes(checkRenderedFigure(p3() as never, R({ ...p3(), angle: 80 })))).toContain("render_value_mismatch");
    expect(codes(checkRenderedFigure(p3() as never, R({ ...p3(), gaps: [1, 2] })))).toContain("render_value_mismatch");
  });
  it("'label' 변조", () => { expect((tamperFigure(p3(), "label") as ParallelThreeSpec).labels[0].label).toBe("63°"); });
});
