import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { checkFigure } from "../check";
import { lintCompositeAgainstText, renderComposite, validateComposite, type CompositeSpec } from "./composite";

export const SAMPLES: { name: string; spec: CompositeSpec; passage: string }[] = [
  { name: "정사각형 안 원(바깥 음영)", spec: { type: "composite", outer: { kind: "square", side: "10" }, inner: { kind: "circle", radius: "5" }, shaded: "outer_minus_inner", notToScale: true }, passage: "A circle with radius 5 is inscribed in a square with side length 10. What is the area of the shaded region?" },
  { name: "원 안 정사각형(안쪽 음영)", spec: { type: "composite", outer: { kind: "circle", radius: "6" }, inner: { kind: "square" }, shaded: "inner" }, passage: "A square is inscribed in a circle of radius 6. What is the area of the shaded square?" },
  { name: "직사각형 위 반원", spec: { type: "composite", outer: { kind: "rectangle", width: "8", height: "5" }, inner: { kind: "semicircle", radius: "4" }, shaded: "none" }, passage: "A semicircle with radius 4 sits on top of a rectangle with width 8 and height 5. What is the perimeter of the figure?" },
  { name: "직사각형 안 직사각형(테두리 음영)", spec: { type: "composite", outer: { kind: "rectangle", width: "12", height: "8" }, inner: { kind: "rectangle", width: "8", height: "4" }, shaded: "outer_minus_inner", notToScale: true }, passage: "A rectangular frame is formed by a rectangle 12 by 8 with a rectangular hole 8 by 4 cut from its center. What is the area of the shaded frame?" },
  { name: "원 안 삼각형", spec: { type: "composite", outer: { kind: "circle", radius: "r" }, inner: { kind: "triangle" }, shaded: "outer_minus_inner" }, passage: "An equilateral triangle is inscribed in a circle with radius r. Which expression gives the area of the shaded region?" },
];

describe("템플릿 8 복합 도형(음영 영역)", () => {
  for (const s of SAMPLES) it(s.name, () => {
    const r = renderComposite(s.spec);
    expect(r.issues).toEqual([]);
    expect(lintCompositeAgainstText(s.spec, s.passage)).toEqual([]);
    expect(checkFigure(s.spec, s.passage).ok).toBe(true);
    if (s.spec.shaded !== "none") expect(r.svg).toContain("fill-opacity");
  });
  it("거부: 지원 밖 조합, 지문 도형·치수 불일치, 음영 언급인데 음영 없음", () => {
    expect(validateComposite({ type: "composite", outer: { kind: "circle" }, inner: { kind: "semicircle" }, shaded: "inner" }).ok).toBe(false);
    const m = lintCompositeAgainstText(SAMPLES[0].spec, "A triangle with side 7 is inside a square. The shaded region …").map((i) => i.message).join("\n");
    expect(m).toContain("circle");
    expect(m).toContain("7");
    expect(lintCompositeAgainstText({ ...SAMPLES[0].spec, shaded: "none" }, "What is the area of the shaded region in the square with the circle?").some((i) => i.code === "ref_mismatch")).toBe(true);
  });
  it("표본 페이지", () => {
    if (!process.env.T8_SAMPLES_OUT) return;
    writeFileSync(process.env.T8_SAMPLES_OUT, `<!doctype html><meta charset="utf-8"><style>body{font-family:-apple-system,sans-serif;padding:16px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px}.card{border:1.5px solid #ddd;border-radius:12px;padding:12px}.card h3{font-size:13px;margin:0 0 6px}.card svg{max-width:100%;height:auto}</style><h2 style="font-size:15px">템플릿 8 복합 도형</h2><div class="grid">${SAMPLES.map((s) => { const r = renderComposite(s.spec); return `<div class="card"><h3>${s.name}</h3>${r.svg}<p style="font-size:11px;color:#666">${r.alt}</p></div>`; }).join("")}</div>`);
  });
});
