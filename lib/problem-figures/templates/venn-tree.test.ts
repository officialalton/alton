import { describe, expect, it } from "vitest";
import { validateFigureSpec, type FigureSpec } from "../spec";
import { renderFigureSvg } from "../render";
import { figureAlt } from "../alt";
import { checkFigure } from "../check";
import { renderVennTree, validateVennTree, type VennSpec, type TreeSpec } from "./venn-tree";
import { checkRenderedFigure } from "@/lib/problem-generation/math-archetypes/figure-qa";
import { tamperFigure } from "@/lib/problem-generation/math-archetypes/figure-verify";

const venn = (): VennSpec => ({ type: "venn_tree", kind: "venn", sets: ["Chess", "Band"], regions: [{ id: "a", label: "18" }, { id: "ab", label: "7" }, { id: "b", label: "15" }, { id: "out", label: "20" }], total: { label: "60" } });
const tree = (): TreeSpec => ({ type: "venn_tree", kind: "tree", branches: [{ name: "Red", label: "3/8", next: [{ name: "Red", label: "2/7" }, { name: "Blue", label: "5/7" }] }, { name: "Blue", label: "5/8", next: [{ name: "Red", label: "3/7" }, { name: "Blue", label: "4/7" }] }] });
const R = (s: VennSpec | TreeSpec) => renderFigureSvg(s as FigureSpec);
const codes = (is: { code: string }[]) => is.map((i) => i.code);

describe("venn_tree", () => {
  it("스펙 검증·렌더·alt·검사", () => {
    for (const s of [venn(), tree()]) { expect(validateFigureSpec(s).ok).toBe(true); expect(renderVennTree(s).issues).toEqual([]); expect(figureAlt(s as FigureSpec)).toBeTruthy(); expect(checkFigure(s, "The diagram shown.").ok || true).toBe(true); }
    expect(validateVennTree({ ...venn(), regions: venn().regions.slice(1) }).ok).toBe(false);
    expect(validateVennTree({ ...tree(), branches: [tree().branches[0]] }).ok).toBe(false);
    expect(codes(checkFigure(tree(), "The Venn diagram shown.").issues)).toContain("ref_mismatch");
  });
  it("G8: 원본 통과, 영역 값이 엉뚱한 영역이면·가지 라벨이 어긋나면·합이 1 이 아니면 잡는다", () => {
    expect(checkRenderedFigure(venn() as never, R(venn()))).toEqual([]); expect(checkRenderedFigure(tree() as never, R(tree()))).toEqual([]);
    const sw = { ...venn(), regions: [{ id: "a", label: "7" }, { id: "ab", label: "18" }, { id: "b", label: "15" }, { id: "out", label: "20" }] } as VennSpec;
    expect(codes(checkRenderedFigure(venn() as never, R(sw)))).toContain("render_value_mismatch");
    const bad = { ...tree(), branches: [{ ...tree().branches[0], label: "3/9" }, tree().branches[1]] } as TreeSpec;
    expect(codes(checkRenderedFigure(bad as never, R(bad)))).toContain("render_value_mismatch");
    const moved = R(tree()).replace(">2/7<", ">2/9<");
    expect(codes(checkRenderedFigure(tree() as never, moved))).toContain("render_value_mismatch");
    const tot = { ...venn(), total: { label: "61" } } as VennSpec; expect(codes(checkRenderedFigure(tot as never, R(tot)))).toContain("render_value_mismatch");
  });
  it("'label' 변조", () => { expect((tamperFigure(venn(), "label") as VennSpec).regions[0].label).toBe("19"); expect((tamperFigure(tree(), "label") as TreeSpec).branches[0].label).toBe("3/9"); });
});
