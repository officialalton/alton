import { describe, expect, it } from "vitest";
import { validateFigureSpec, type FigureSpec } from "../spec";
import { renderFigureSvg } from "../render";
import { figureAlt } from "../alt";
import { checkFigure } from "../check";
import { checkInstanceFigureQa } from "@/lib/problem-generation/math-archetypes/figure-qa";
import { tamperFigure, checkFigureBinding } from "@/lib/problem-generation/math-archetypes/figure-verify";
import { generateOne } from "@/lib/problem-generation/math-archetypes/sweep";
import { figureArchetypes, mutantsOf } from "@/lib/problem-generation/math-archetypes/figure-coverage-gate";
import { verifyLevel } from "@/lib/problem-generation/math-archetypes/levels-d";

const tri = (n: string[], sides: number[]) => ({ type: "triangle", vertices: n, notToScale: true, sides: sides.map((s, i) => ({ between: [n[i], n[(i + 1) % 3]], label: String(s) })) });
const bundle = () => ({ type: "figure_bundle", stem: tri(["A", "B", "C"], [3, 4, 6]), choices: { type: "figure_choice", choices: [tri(["X", "Y", "Z"], [6, 8, 12]), tri(["X", "Y", "Z"], [5, 6, 8]), tri(["X", "Y", "Z"], [6, 8, 11]), tri(["X", "Y", "Z"], [4, 6, 9])] } });

describe("figure_bundle(B형)", () => {
  it("스펙 검증: 기준 그림 + 선택지 4개, 기준 그림이 선택지·묶음이면 거부", () => {
    expect(validateFigureSpec(bundle()).ok).toBe(true);
    expect(validateFigureSpec({ ...bundle(), stem: { type: "figure_choice", choices: [] } }).ok).toBe(false);
    expect(validateFigureSpec({ ...bundle(), choices: { type: "figure_choice", choices: [tri(["X", "Y", "Z"], [1, 1, 1])] } }).ok).toBe(false);
  });
  it("렌더: 기준 그림과 선택지 격자가 한 마크업에 있고 alt 가 둘 다 말한다", () => {
    const html = renderFigureSvg(bundle() as FigureSpec); expect(html).toContain("figure-bundle"); expect(html).toContain("data-choice=\"D\""); expect((html.match(/<svg/g) ?? []).length).toBe(5);
    expect(figureAlt(bundle() as FigureSpec)).toContain("기준 그림");
    expect(checkFigure(bundle(), "Triangle $ABC$ is shown.").ok).toBe(true);
    expect(checkFigure(bundle(), "In triangle $ABQ$ shown.").ok).toBe(false);
  });
  it("G6 변조: 기준 그림 변조와 선택지 변조(뒤집기·첫 선택지 라벨)가 모두 도형을 바꾼다", () => {
    const b = bundle(); const base = JSON.stringify(b);
    expect(JSON.stringify(tamperFigure(b, "label"))).not.toBe(base); expect(JSON.stringify(tamperFigure(b, "swap"))).not.toBe(base); expect(JSON.stringify(tamperFigure(b, "drop"))).not.toBe(base);
    const sw = tamperFigure(b, "swap") as { choices: { choices: unknown[] } }; expect(sw.choices.choices[0]).toEqual(b.choices.choices[3]);
    const lb = tamperFigure(b, "label") as { stem: { sides: { label: string }[] } }; expect(lb.stem.sides[0].label).toBe("4");
  });
  it("실제 B형 원형 하나: 기준·선택지 양쪽 검증 결합, 변조 검출, G8 통과", () => {
    const a = figureArchetypes().find((x) => x.id === "lat.congruent_triangles.TR.B.repr_shift")!; const g = generateOne(a, 3); if (!g.ok) throw new Error(g.msg);
    expect(checkFigureBinding(g.inst)).toEqual([]); expect(checkInstanceFigureQa(g.inst)).toEqual([]);
    const ms = mutantsOf(g.inst); expect(ms.length).toBeGreaterThanOrEqual(2);
    expect(ms.some((m) => !verifyLevel(a, m).ok)).toBe(true);
    const stemOnly = { ...g.inst, figure: { ...(g.inst.figure as object), stem: tamperFigure((g.inst.figure as { stem: unknown }).stem, "label") } }; expect(JSON.stringify(stemOnly.figure)).not.toBe(JSON.stringify(g.inst.figure));
    expect(verifyLevel(a, stemOnly as never).ok).toBe(false); // verification_js 의 STEM 이 인쇄된 기준 그림과 달라진다
  });
});
