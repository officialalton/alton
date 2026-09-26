import { describe, expect, it } from "vitest";
import { checkFigure } from "../check";
import { renderFigureSvg } from "../render";
import { validateFigureSpec } from "../spec";
import type { PlaneSpec } from "./coordinate-plane";
import { placeCorrectChoice } from "./figure-choice";

const axes = { x: { min: -5, max: 5 }, y: { min: -5, max: 5 } };
const line = (id: string, m: number, b: number): PlaneSpec => ({ type: "plane", axes, objects: [{ id, kind: "line", slope: m, intercept: b }] });
const choice = (over: Partial<{ choices: unknown[] }> = {}) => ({ type: "figure_choice", choices: [line("a", 1, 2), line("b", -1, 2), line("c", 1, -2), line("d", 2, 2)], ...over });

describe("figure_choice — 그래프 선택지 4개", () => {
  it("같은 축·같은 객체 수·라벨 없는 4개는 통과하고, 격자로 A~D 캡션과 함께 그려진다", () => {
    const c = checkFigure(choice(), "Which of the following graphs represents y = x + 2?", ["A", "B", "C", "D"]);
    expect(c.ok).toBe(true);
    const html = renderFigureSvg(choice() as never);
    expect(html).toContain('data-testid="figure-choice"');
    expect((html.match(/<figure /g) ?? []).length).toBe(4);
    expect(html).toContain(">A<");
    expect(html).toContain('data-choice="D"');
  });
  it("축이 다르거나 라벨·점이 있거나 객체 수가 다르면 정답 암시로 거부, 선택지 글 수와 다르면 거부", () => {
    const biased = choice({ choices: [line("a", 1, 2), { ...line("b", -1, 2), axes: { x: { min: -6, max: 6 }, y: { min: -5, max: 5 } } }, { type: "plane", axes, objects: [{ id: "c", kind: "line", slope: 1, intercept: -2, label: "answer" }, { id: "p", kind: "point", at: [0, -2] }] }, line("d", 2, 2)] });
    const c = checkFigure(biased, "Which graph?", ["A", "B", "C", "D"]);
    expect(c.ok).toBe(false);
    const codes = c.issues.map((i) => i.code);
    expect(codes.filter((x) => x === "choice_bias").length).toBeGreaterThanOrEqual(3);
    expect(checkFigure(choice(), "Which graph?", ["A", "B", "C"]).issues.some((i) => i.code === "choice_count")).toBe(true);
  });
  it("정답 자리의 그림에 지문의 식이 없거나 다른 선택지에도 있으면 정답 불일치로 거부", () => {
    const passage = "Which of the following graphs represents y = -2x + 3?";
    const fc = { type: "figure_choice", choices: [line("a", -2, 3), line("b", 2, 3), line("c", -2, -3), line("d", 0.5, 3)] };
    expect(checkFigure(fc, passage, ["A", "B", "C", "D"], 0).ok).toBe(true);
    expect(checkFigure(fc, passage, ["A", "B", "C", "D"], 1).issues.some((i) => i.code === "answer_mismatch")).toBe(true);
    const dup = { ...fc, choices: [line("a", -2, 3), line("b", -2, 3), line("c", 1, 1), line("d", 0.5, 3)] };
    expect(checkFigure(dup, passage, ["A", "B", "C", "D"], 0).issues.some((i) => i.message.includes("정답이 둘"))).toBe(true);
  });
  it("정답 그래프를 correct_index 자리로 옮기고, 그림 데이터에 실린 options/correct_index 는 버린다", () => {
    const fc = { type: "figure_choice", choices: [line("a", -2, 3), line("b", 2, 3), line("c", -2, -3), line("d", 0.5, 3)], options: ["A", "B", "C", "D"], correct_index: 0 };
    const v = validateFigureSpec(fc);
    expect(v.ok && !("options" in v.spec)).toBe(true);
    const moved = placeCorrectChoice(fc as never, "Which graph represents y = -2x + 3?", 1);
    expect(checkFigure(moved, "Which graph represents y = -2x + 3?", ["A", "B", "C", "D"], 1).ok).toBe(true);
    // AI 변형 모양(xmin/xmax, type, points)도 표준으로 받아들인다.
    const alt = { type: "plane", axes: { xmin: -5, xmax: 5, ymin: -5, ymax: 5, xstep: 1, ystep: 1 }, objects: [{ type: "line", points: [[-1, 5], [3, -3]] }] };
    expect(validateFigureSpec(alt).ok).toBe(true);
  });
  it("포물선 그래프 선택지: 지문의 y = ax² + bx + c(꼭짓점형 포함)와 같은 그래프가 정답 자리에만 있어야 한다", () => {
    const quad = (a: number, b: number, c: number): PlaneSpec => ({ type: "plane", axes: { x: { min: -5, max: 5 }, y: { min: -6, max: 8 } }, objects: [{ id: "f", kind: "function", fn: "quadratic", params: [a, b, c] }] });
    const fc = { type: "figure_choice", choices: [quad(1, -2, -3), quad(-1, -2, -3), quad(1, 2, -3), quad(1, -2, 3)] };
    expect(checkFigure(fc, "Which graph represents y = x² − 2x − 3?", ["A", "B", "C", "D"], 0).ok).toBe(true);
    expect(checkFigure(fc, "Which graph represents y = x^2 - 2x - 3?", ["A", "B", "C", "D"], 2).issues.some((i) => i.code === "answer_mismatch")).toBe(true);
    // 꼭짓점형 y = (x − 1)² − 4 = x² − 2x − 3
    expect(checkFigure(fc, "Which graph represents y = (x - 1)^2 - 4?", ["A", "B", "C", "D"], 0).ok).toBe(true);
    expect(placeCorrectChoice(fc as never, "y = x² − 2x − 3", 3).choices[3]).toEqual(quad(1, -2, -3));
  });
  it("도형 선택지: 삼각형 4개 — 같은 type·꼭짓점 수면 통과, 라벨은 허용", () => {
    const tri = (labels: [string, string, string], right?: string) => ({ type: "triangle", vertices: ["A", "B", "C"], ...(right ? { kind: "right", rightAngleAt: right } : {}), sides: [{ between: ["A", "B"], label: labels[0] }, { between: ["B", "C"], label: labels[1] }, { between: ["C", "A"], label: labels[2] }], notToScale: true });
    const fc = { type: "figure_choice", choices: [tri(["3", "4", "5"], "B"), tri(["3", "4", "6"]), tri(["5", "5", "5"]), tri(["2", "3", "4"])] };
    expect(checkFigure(fc, "Which of the following triangles is a right triangle?", ["A", "B", "C", "D"], 0).ok).toBe(true);
    expect(renderFigureSvg(fc as never)).toContain('data-choice="D"');
  });
  it("스키마: 선택지 type 이 섞이거나 중첩 선택지·이미지는 거부", () => {
    expect(validateFigureSpec({ type: "figure_choice", choices: [line("a", 1, 0), { type: "triangle", vertices: ["A", "B", "C"] }] }).ok).toBe(false);
    expect(validateFigureSpec({ type: "figure_choice", choices: [choice(), choice()] }).ok).toBe(false);
    expect(validateFigureSpec({ type: "figure_choice", choices: [{ type: "image", bucket: "b", path: "p" }, line("a", 1, 0)] }).ok).toBe(false);
  });
});

describe("figure_set — 복수 자료", () => {
  const set = { type: "figure_set", figures: [{ id: "A", title: "Figure A", spec: line("l", 1, 0) }, { id: "B", title: "Table B", spec: { type: "data", kind: "table", columns: ["x", "y"], rows: [[0, 0], [1, 1]] } }] };
  it("지문의 Figure A / Table B 참조가 있는 자료를 가리키면 통과, 없는 자료면 거부", () => {
    expect(checkFigure(set, "Figure A shows a line and Table B lists values. Which value of y in Table B is not on the line in Figure A?").ok).toBe(true);
    expect(checkFigure(set, "Figure C shows a line.").issues.some((i) => i.code === "ref_missing")).toBe(true);
    expect(validateFigureSpec({ type: "figure_set", figures: [{ id: "A", spec: line("l", 1, 0) }, { id: "A", spec: line("m", 2, 0) }] }).ok).toBe(false);
    expect(renderFigureSvg(set as never)).toContain('data-testid="figure-set"');
  });
});
