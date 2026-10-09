import { describe, expect, it } from "vitest";
import { labelMentioned, problemText, pruneUnmentionedLineLabels } from "./label-rule";
import { renderFigureSvg } from "./render";
import type { FigureSpec } from "./spec";

const plane = (objects: unknown[]) => ({ type: "plane", axes: { x: { min: -6, max: 6 }, y: { min: -6, max: 6 } }, objects }) as unknown as FigureSpec;
const line = { id: "L", kind: "line", slope: 2, intercept: -3, label: "ℓ" };
const pt = { id: "P", kind: "point", at: [2, 1], label: "P" };

describe("labelMentioned — 본문에 라벨이 나오는가", () => {
  it("단어 경계로 센다", () => {
    expect(labelMentioned("ℓ", "The graph of line ℓ is shown.")).toBe(true);
    expect(labelMentioned("ℓ", "The graph of line $\\ell$ is shown.")).toBe(true);
    expect(labelMentioned("l1", "Lines l1 and l2 intersect.")).toBe(true);
    expect(labelMentioned("y", "Did they say yes?")).toBe(false);
    expect(labelMentioned("y", "If y = 2x, what is x?")).toBe(true);
    expect(labelMentioned("f", "The function f(x) = x^2 is graphed.")).toBe(true);
    expect(labelMentioned("g", "The function f is graphed.")).toBe(false);
    expect(labelMentioned("y = x + 1", "The line y = x + 1 passes through")).toBe(true);
    expect(labelMentioned("", "anything")).toBe(false);
  });
  it("problemText 는 지문·질문·선택지를 이어 붙인다", () => { expect(problemText("a", null, ["b", "c"], undefined)).toBe("a\nb\nc"); });
});

describe("pruneUnmentionedLineLabels — 직선·곡선 라벨 규칙", () => {
  it("본문에 안 나오는 직선·곡선·부등식·추세선 라벨만 뺀다(점 라벨은 그대로)", () => {
    const spec = plane([line, pt, { id: "f", kind: "function", fn: "quadratic", params: [1, 0, 0], label: "f" }, { id: "s", kind: "scatter", points: [[1, 1]], fitLine: { slope: 1, intercept: 0, label: "m" } }]);
    const out = pruneUnmentionedLineLabels(spec, "Which point is on the graph?") as unknown as { objects: Record<string, unknown>[] };
    expect(out.objects[0].label).toBeUndefined(); expect(out.objects[1].label).toBe("P"); expect(out.objects[2].label).toBeUndefined();
    expect((out.objects[3].fitLine as Record<string, unknown>).label).toBeUndefined();
  });
  it("본문에 나오면 유지하고, 바뀐 게 없으면 같은 객체를 돌려준다", () => {
    const spec = plane([line, pt]);
    expect(pruneUnmentionedLineLabels(spec, "Line ℓ is graphed. Point P lies on it.")).toBe(spec);
  });
  it("원본 데이터는 바꾸지 않는다", () => {
    const spec = plane([{ ...line }]); pruneUnmentionedLineLabels(spec, "nothing"); expect((spec as unknown as { objects: { label: string }[] }).objects[0].label).toBe("ℓ");
  });
  it("선택지 그림(figure_choice)과 자료 묶음(figure_set) 안쪽도 같은 규칙", () => {
    const choice = { type: "figure_choice", choices: [plane([line]), plane([line])] } as unknown as FigureSpec;
    const out = pruneUnmentionedLineLabels(choice, "Which graph?") as unknown as { choices: { objects: { label?: string }[] }[] };
    expect(out.choices.every((c) => c.objects[0].label === undefined)).toBe(true);
    const set = { type: "figure_set", figures: [{ id: "A", spec: plane([line]) }] } as unknown as FigureSpec;
    expect((pruneUnmentionedLineLabels(set, "Plot A") as unknown as { figures: { spec: { objects: { label?: string }[] } }[] }).figures[0].spec.objects[0].label).toBeUndefined();
  });
  it("레거시 coordinate_plane 도 적용된다", () => {
    const old = { type: "coordinate_plane", xRange: [-5, 5], yRange: [-5, 5], items: [{ kind: "line", slope: 1, intercept: 0, label: "l1" }, { kind: "points", points: [[1, 1]], labels: ["A"] }] } as unknown as FigureSpec;
    const out = pruneUnmentionedLineLabels(old, "no mention") as unknown as { items: { label?: string; labels?: string[] }[] };
    expect(out.items[0].label).toBeUndefined(); expect(out.items[1].labels).toEqual(["A"]);
  });
});

describe("renderFigureSvg — 문제 텍스트가 주어지면 라벨 규칙을 적용한다", () => {
  const spec = plane([line, pt]);
  const hasLabel = (svg: string, t: string) => svg.includes(`>${t}<`);
  it("text 가 없으면 데이터의 라벨을 모두 그린다(관리자·저장 검사 경로)", () => { expect(hasLabel(renderFigureSvg(spec), "ℓ")).toBe(true); });
  it("text 에 ℓ 이 없으면 직선 라벨은 빠지고 점 라벨은 남는다", () => {
    const svg = renderFigureSvg(spec, { text: "Which of the following points lies on the graph?" });
    expect(hasLabel(svg, "ℓ")).toBe(false); expect(hasLabel(svg, "P")).toBe(true);
  });
  it("text 에 ℓ 이 있으면 그린다", () => { expect(hasLabel(renderFigureSvg(spec, { text: "The graph of line ℓ is shown." }), "ℓ")).toBe(true); });
});
