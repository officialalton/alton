import { describe, expect, it } from "vitest";
import { validateFigureSpec, type FigureSpec } from "../spec";
import { renderFigureSvg } from "../render";
import { figureAlt } from "../alt";
import { checkFigure } from "../check";
import { renderUnitCircle, validateUnitCircle, type UnitCircleSpec } from "./unit-circle";
import { checkRenderedFigure } from "@/lib/problem-generation/math-archetypes/figure-qa";
import { tamperFigure } from "@/lib/problem-generation/math-archetypes/figure-verify";

const sp = (): UnitCircleSpec => ({ type: "unit_circle", points: [{ name: "P", angle: 126.87, label: "(−3/5, 4/5)" }], arcs: [{ to: 0, label: "θ" }] });
const R = (s: UnitCircleSpec) => renderFigureSvg(s as FigureSpec);
const codes = (is: { code: string }[]) => is.map((i) => i.code);

describe("unit_circle 템플릿", () => {
  it("스펙 검증: 정상·점 없음·각 범위·이름 중복·호 index", () => {
    expect(validateFigureSpec(sp()).ok).toBe(true);
    expect(validateUnitCircle({ type: "unit_circle", points: [] }).ok).toBe(false);
    expect(validateUnitCircle({ type: "unit_circle", points: [{ angle: 360 }] }).ok).toBe(false);
    expect(validateUnitCircle({ type: "unit_circle", points: [{ name: "P", angle: 10 }, { name: "P", angle: 20 }] }).ok).toBe(false);
    expect(validateUnitCircle({ type: "unit_circle", points: [{ angle: 10 }], arcs: [{ to: 3 }] }).ok).toBe(false);
  });
  it("그려진 그림: 충돌 없음·대체 설명·검사 통과", () => {
    const r = renderUnitCircle(sp()); expect(r.issues).toEqual([]); expect(r.alt).toContain("단위원");
    expect(figureAlt(sp() as FigureSpec)).toBe(r.alt);
    const c = checkFigure(sp(), "The unit circle is shown. Point $P$ lies on the circle."); expect(c.ok, JSON.stringify(c.issues)).toBe(true);
    expect(codes(checkFigure(sp(), "Point $Q$ lies on the circle.").issues)).toContain("ref_missing");
  });
  it("전 각도 스윕(3° 간격)에서 라벨 충돌·잘림이 없다", () => {
    const bad: number[] = [];
    for (let a = 3; a < 360; a += 3) if (renderUnitCircle({ type: "unit_circle", points: [{ name: "P", angle: a, label: "(−7/25, 24/25)" }], arcs: [{ to: 0, label: "θ" }] }).issues.length) bad.push(a);
    expect(bad).toEqual([]);
  });
});

describe("G8 충실도 검사와 돌연변이(unit_circle)", () => {
  it("원본은 통과", () => expect(checkRenderedFigure(sp() as never, R(sp()))).toEqual([]));
  it("(a) 점이 제 위치에서 벗어나 그려지면 잡는다", () => {
    const svg = R(sp()).replace(/(<circle cx=")([\d.]+)(" cy="[\d.]+" r="4")/, (_m, a, x, c) => `${a}${Number(x) + 12}${c}`);
    expect(codes(checkRenderedFigure(sp() as never, svg))).toContain("render_value_mismatch");
  });
  it("(b) 좌표 라벨이 그려진 위치의 (cos, sin) 과 다르면 잡는다(라벨 (−3/5, 4/6) 처럼)", () => {
    const bad = { ...sp(), points: [{ name: "P", angle: 126.87, label: "(−3/5, 4/6)" }] } as UnitCircleSpec;
    expect(codes(checkRenderedFigure(bad as never, R(bad)))).toContain("render_value_mismatch");
  });
  it("(c) 호 라벨의 라디안 값이 그려진 각과 다르면 잡는다", () => {
    const ok = { type: "unit_circle", points: [{ name: "P", angle: 150 }], arcs: [{ to: 0, label: "5π/6" }] } as UnitCircleSpec;
    expect(checkRenderedFigure(ok as never, R(ok))).toEqual([]);
    const bad = { ...ok, arcs: [{ to: 0, label: "5π/4" }] } as UnitCircleSpec;
    expect(codes(checkRenderedFigure(bad as never, R(bad)))).toContain("render_value_mismatch");
  });
  it("(d) 반직선이나 점 이름이 빠지면 잡는다", () => {
    expect(codes(checkRenderedFigure(sp() as never, R(sp()).replace(/<circle cx="[\d.]+" cy="[\d.]+" r="4" fill="#111"\/>/, "")))).toContain("render_empty");
    expect(codes(checkRenderedFigure(sp() as never, R(sp()).replace(">P<", "><")))).toContain("label_missing");
  });
  it("'label' 변조 모드: 좌표 라벨의 마지막 정수가 바뀐다", () => {
    const m = tamperFigure(sp(), "label") as UnitCircleSpec; expect(m.points[0].label).toBe("(−3/5, 4/6)");
  });
});
