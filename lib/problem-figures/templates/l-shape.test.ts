import { describe, expect, it } from "vitest";
import { validateFigureSpec, type FigureSpec } from "../spec";
import { renderFigureSvg } from "../render";
import { figureAlt } from "../alt";
import { renderLShape, validateLShape, type LShapeSpec } from "./l-shape";
import { checkRenderedFigure } from "@/lib/problem-generation/math-archetypes/figure-qa";
import { tamperFigure } from "@/lib/problem-generation/math-archetypes/figure-verify";

const ls = (): LShapeSpec => ({ type: "l_shape", shape: { W: 12, H: 10, w1: 5, h1: 4 }, sides: [{ edge: 0, label: "12" }, { edge: 5, label: "10" }, { edge: 4, label: "5" }, { edge: 1, label: "4" }] });
const R = (s: LShapeSpec) => renderFigureSvg(s as FigureSpec);
const codes = (is: { code: string }[]) => is.map((i) => i.code);

describe("l_shape", () => {
  it("스펙·렌더·alt", () => {
    expect(validateFigureSpec(ls()).ok).toBe(true); expect(renderLShape(ls()).issues).toEqual([]); expect(figureAlt(ls() as FigureSpec)).toContain("L자형");
    expect(validateLShape({ ...ls(), shape: { W: 12, H: 10, w1: 12, h1: 4 } }).ok).toBe(false);
    expect(validateLShape({ ...ls(), sides: [{ edge: 7, label: "1" }] }).ok).toBe(false);
  });
  it("G8: 원본 통과, 비례가 틀린 라벨·그려지지 않은 라벨을 잡는다", () => {
    expect(checkRenderedFigure(ls() as never, R(ls()))).toEqual([]);
    const bad = { ...ls(), sides: [{ edge: 0, label: "12" }, { edge: 5, label: "20" }] } as LShapeSpec; expect(codes(checkRenderedFigure(bad as never, R(bad)))).toContain("render_value_mismatch");
    expect(codes(checkRenderedFigure(ls() as never, R(ls()).replace(">12<", "><")))).toContain("label_missing");
  });
  it("'label' 변조", () => { expect((tamperFigure(ls(), "label") as LShapeSpec).sides![0].label).toBe("13"); });
});
