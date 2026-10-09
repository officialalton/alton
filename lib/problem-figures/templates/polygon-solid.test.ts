import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { checkFigure } from "../check";
import { lintPolygonAgainstText, renderPolygon, validatePolygon, type PolygonSpec } from "./polygon";
import { lintSolidAgainstText, renderSolid, validateSolid, type SolidSpec } from "./solid";

const Q = (over: Partial<PolygonSpec>): PolygonSpec => ({ type: "polygon", kind: "rectangle", vertices: ["A", "B", "C", "D"], notToScale: true, ...over });
export const POLY_SAMPLES: { name: string; spec: PolygonSpec; passage: string }[] = [
  { name: "직사각형 넓이", spec: Q({ sideLabels: [{ between: ["A", "B"], label: "12" }, { between: ["B", "C"], label: "5" }] }), passage: "Rectangle ABCD has AB = 12 and BC = 5. What is the length of diagonal AC?" .replace("diagonal AC", "the diagonal") },
  { name: "정사각형 대각선", spec: Q({ kind: "square", sideLabels: [{ between: ["A", "B"], label: "6" }], diagonals: [{ between: ["A", "C"], label: "d" }] }), passage: "Square ABCD has side length 6. What is the length of diagonal AC?" },
  { name: "평행사변형 높이", spec: Q({ kind: "parallelogram", sideLabels: [{ between: ["A", "B"], label: "10" }], height: { from: "D", label: "6", foot: "E" } }), passage: "In parallelogram ABCD, AB = 10 and the height from D to side AB is 6. What is the area?" },
  { name: "사다리꼴 두 밑변", spec: Q({ kind: "trapezoid", sideLabels: [{ between: ["A", "B"], label: "14" }, { between: ["C", "D"], label: "8" }], height: { from: "C", label: "5" } }), passage: "Trapezoid ABCD has bases AB = 14 and CD = 8, and height 5. What is its area?" },
  { name: "마름모 대각선", spec: Q({ kind: "rhombus", sideLabels: [{ between: ["A", "B"], tick: 1 }, { between: ["B", "C"], tick: 1 }, { between: ["C", "D"], tick: 1 }, { between: ["D", "A"], tick: 1 }], diagonals: [{ between: ["A", "C"], label: "16" }, { between: ["B", "D"], label: "12" }] }), passage: "Rhombus ABCD has diagonals AC = 16 and BD = 12. What is the perimeter?" },
  { name: "평행사변형 각", spec: Q({ kind: "parallelogram", angles: [{ at: "A", label: "70°" }, { at: "B", label: "x°" }] }), passage: "In parallelogram ABCD, angle A measures 70°. What is the value of x?" },
  { name: "정오각형 내각", spec: Q({ kind: "regular", sides: 5, vertices: ["P", "Q", "R", "S", "T"], angles: [{ at: "Q", label: "x°" }] }), passage: "PQRST is a regular pentagon. What is the value of x?" },
  { name: "정육각형 변", spec: Q({ kind: "regular", sides: 6, vertices: ["A", "B", "C", "D", "E", "F"], sideLabels: [{ between: ["A", "B"], label: "4" }], diagonals: [{ between: ["A", "D"], label: "8" }] }), passage: "Regular hexagon ABCDEF has side AB = 4 and AD = 8. What is the area?" },
  { name: "직사각형 대각선 각", spec: Q({ sideLabels: [{ between: ["A", "B"], label: "8" }], diagonals: [{ between: ["A", "C"] }], angles: [{ at: "A", label: "θ" }] }), passage: "In rectangle ABCD, AB = 8 and the diagonal AC makes angle θ with side AB. If tan θ = 3/4, what is BC?" },
  { name: "사다리꼴 직각", spec: Q({ kind: "trapezoid", angles: [{ at: "A", label: "x°" }, { at: "D", label: "110°" }], sideLabels: [{ between: ["A", "B"], label: "20" }] }), passage: "In trapezoid ABCD with AB = 20, angle D is 110°. What is the value of x?" },
];

const S = (kind: SolidSpec["kind"], dims: SolidSpec["dims"]): SolidSpec => ({ type: "solid", kind, dims, notToScale: true });
export const SOLID_SAMPLES: { name: string; spec: SolidSpec; passage: string }[] = [
  { name: "직육면체 부피", spec: S("rectangular_prism", { length: "8", width: "5", height: "3" }), passage: "A rectangular box has length 8, width 5, and height 3. What is its volume?" },
  { name: "정육면체 겉넓이", spec: S("cube", { edge: "4" }), passage: "A cube has edge length 4 centimeters. What is its surface area?" },
  { name: "원기둥 부피", spec: S("cylinder", { radius: "3", height: "10" }), passage: "A cylinder has a radius of 3 and a height of 10. What is its volume?" },
  { name: "원기둥 지름", spec: S("cylinder", { diameter: "12", height: "h" }), passage: "A cylindrical tank has a diameter of 12 feet and height h. If its volume is 720π cubic feet, what is h?" },
  { name: "원뿔 모선", spec: S("cone", { radius: "5", height: "12", slant: "l" }), passage: "A cone has a radius of 5 and a height of 12. What is the slant height l?" },
  { name: "구 부피", spec: S("sphere", { radius: "6" }), passage: "A sphere has a radius of 6 inches. What is its volume?" },
  { name: "사각뿔 부피", spec: S("square_pyramid", { edge: "6", height: "4" }), passage: "A pyramid has a square base with edge length 6 and a height of 4. What is its volume?" },
  { name: "원뿔 미지수 반지름", spec: S("cone", { radius: "r", height: "9" }), passage: "A cone has a height of 9 and radius r. If its volume is 48π, what is r?" },
  { name: "직육면체 미지수", spec: S("rectangular_prism", { length: "x", width: "4", height: "6" }), passage: "A rectangular prism has width 4, height 6, and length x. Its volume is 240. What is x?" },
  { name: "구 지름", spec: S("sphere", { diameter: "10" }), passage: "A sphere has a diameter of 10. What is its surface area?" },
];

describe("템플릿 6 사각형·다각형 — 대표 10문항", () => {
  for (const s of POLY_SAMPLES) it(s.name, () => {
    const r = renderPolygon(s.spec);
    expect(r.issues).toEqual([]);
    for (const v of s.spec.vertices) expect(r.svg).toContain(`>${v}<`);
    expect(lintPolygonAgainstText(s.spec, s.passage)).toEqual([]);
    expect(checkFigure(s.spec, s.passage).ok).toBe(true);
  });
  it("거부: 변이 아닌 sideLabel, 이름 중복, 도형 종류·길이 불일치, 직각이 아닌 곳의 직각", () => {
    expect(validatePolygon(Q({ sideLabels: [{ between: ["A", "C"], label: "1" }] })).ok).toBe(false);
    expect(validatePolygon(Q({ vertices: ["A", "A", "C", "D"] })).ok).toBe(false);
    const m = lintPolygonAgainstText(Q({ sideLabels: [{ between: ["A", "B"], label: "12" }] }), "Parallelogram ABCD has AB = 10 and diagonal BD.").map((i) => i.message).join("\n");
    expect(m).toContain("parallelogram");
    expect(m).toContain("AB = 10");
    expect(m).toContain("대각선 BD");
    expect(renderPolygon(Q({ kind: "parallelogram", angles: [{ at: "A", right: true }] })).issues.some((i) => i.code === "impossible")).toBe(true);
  });
  it("표본 페이지", () => {
    if (!process.env.T6_SAMPLES_OUT) return;
    const cards = [...POLY_SAMPLES.map((s) => ({ name: s.name, r: renderPolygon(s.spec) })), ...SOLID_SAMPLES.map((s) => ({ name: s.name, r: renderSolid(s.spec) }))].map(({ name, r }) => `<div class="card"><h3>${name}</h3>${r.svg}<p class="alt">${r.alt}</p><p class="iss">${r.issues.length ? r.issues.map((x) => x.message).join("<br>") : "검증 통과"}</p></div>`);
    writeFileSync(process.env.T6_SAMPLES_OUT, `<!doctype html><meta charset="utf-8"><style>body{font-family:-apple-system,sans-serif;margin:0;padding:16px;background:#fff;color:#111}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px}.card{border:1.5px solid #ddd;border-radius:12px;padding:12px}.card h3{font-size:13px;margin:0 0 6px}.card svg{max-width:100%;height:auto;display:block}.alt{font-size:11px;color:#666;margin:6px 0 0}.iss{font-size:11px;color:#0a7;margin:4px 0 0}</style><h2 style="font-size:15px;margin:0 0 10px">템플릿 6·7 — 사각형·다각형 / 입체 대표 문항 (std-1)</h2><div class="grid">${cards.join("")}</div>`);
  });
});

describe("템플릿 7 입체 — 대표 10문항", () => {
  for (const s of SOLID_SAMPLES) it(s.name, () => {
    const r = renderSolid(s.spec);
    expect(r.issues).toEqual([]);
    expect(r.svg).toContain("stroke-dasharray"); // 숨은 모서리 점선
    expect(lintSolidAgainstText(s.spec, s.passage)).toEqual([]);
    expect(checkFigure(s.spec, s.passage).ok).toBe(true);
  });
  it("거부: 종류에 없는 치수, radius+diameter 동시, 종류·값 불일치", () => {
    expect(validateSolid({ type: "solid", kind: "sphere", dims: { height: "3" } }).ok).toBe(false);
    expect(validateSolid({ type: "solid", kind: "cylinder", dims: { radius: "3", diameter: "6" } }).ok).toBe(false);
    const m = lintSolidAgainstText(S("cylinder", { radius: "3", height: "10" }), "A cone has a radius of 4 and a height of 10.").map((i) => i.message).join("\n");
    expect(m).toContain("cone");
    expect(m).toContain("반지름 4");
  });
});
