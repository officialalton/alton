import { describe, expect, it } from "vitest";
import { validateFigureSpec, type FigureSpec } from "../spec";
import { renderFigureSvg } from "../render";
import { figureAlt } from "../alt";
import { renderSolidX, validateSolidX, type SolidXSpec } from "./solid-x";
import { checkRenderedFigure } from "@/lib/problem-generation/math-archetypes/figure-qa";
import { tamperFigure } from "@/lib/problem-generation/math-archetypes/figure-verify";

const d = (o: Record<string, string>) => Object.entries(o).map(([id, label]) => ({ id, label }));
const box = (): SolidXSpec => ({ type: "solid_x", kind: "box_diagonal", diagonal: "space", dims: d({ length: "12", width: "4", height: "3", diag: "x" }), notToScale: true });
const cyl = (): SolidXSpec => ({ type: "solid_x", kind: "cylinder_section", dims: d({ radius: "6", height: "x", diag: "20" }), notToScale: true });
const prism = (): SolidXSpec => ({ type: "solid_x", kind: "triangular_prism", dims: d({ legA: "6", legB: "8", hyp: "x", length: "15" }), notToScale: true });
const comp = (): SolidXSpec => ({ type: "solid_x", kind: "cylinder_hemisphere", dims: d({ radius: "5", height: "12" }), notToScale: true });
const R = (s: SolidXSpec) => renderFigureSvg(s as FigureSpec);
const codes = (is: { code: string }[]) => is.map((i) => i.code);

describe("solid_x", () => {
  it("스펙·렌더·alt", () => {
    for (const s of [box(), cyl(), prism(), comp()]) { expect(validateFigureSpec(s).ok).toBe(true); expect(renderSolidX(s).issues, s.kind).toEqual([]); expect(figureAlt(s as FigureSpec)).toBeTruthy(); }
    expect(validateSolidX({ ...box(), dims: d({ foo: "1" }) }).ok).toBe(false);
    expect(validateSolidX({ ...cyl(), diagonal: "space" }).ok).toBe(false);
    expect(validateSolidX({ ...box(), dims: d({ length: "123456789012345" }) }).ok).toBe(false);
  });
  it("G8: 원본 통과, 라벨 누락·대각선 끝점 이탈·대각선 누락·축척 표기 누락을 잡는다", () => {
    for (const s of [box(), cyl(), prism(), comp()]) expect(checkRenderedFigure(s as never, R(s)), s.kind).toEqual([]);
    expect(codes(checkRenderedFigure(box() as never, R(box()).replace(">12<", "><")))).toContain("label_missing");
    const moved = R(box()).replace(/(<line x1="[\d.]+" y1="[\d.]+" x2=")([\d.]+)(" y2="[\d.]+" stroke="#111" stroke-width="2.2")/, (_m, a, x, c) => `${a}${Number(x) + 20}${c}`);
    expect(codes(checkRenderedFigure(box() as never, moved))).toContain("render_value_mismatch");
    expect(codes(checkRenderedFigure(cyl() as never, R(cyl()).replace(/stroke-width="2.2"/, 'stroke-width="1"')))).toContain("render_empty");
    expect(codes(checkRenderedFigure(box() as never, R(box()).replace("Figure not drawn to scale", "x")))).toContain("render_value_mismatch");
  });
  it("'label' 변조", () => { expect((tamperFigure(box(), "label") as SolidXSpec).dims[0].label).toBe("13"); });
});
