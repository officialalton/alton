import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { checkFigure } from "../check";
import { lintTriangleAgainstText, renderTriangle, validateTriangle, type TriangleSpec } from "./triangle";

// 표준 렌더링 엔진 템플릿 2 — 삼각형. 대표 10문항은 문제 없이 그려지고, 참조 불일치·중복·충돌은 거부된다.

const T = (over: Partial<TriangleSpec>): TriangleSpec => ({ type: "triangle", vertices: ["A", "B", "C"], notToScale: true, ...over });

export const SAMPLES: { name: string; spec: TriangleSpec; passage: string }[] = [
  { name: "직각삼각형 6·8·x", spec: T({ kind: "right", rightAngleAt: "B", sides: [{ between: ["A", "B"], label: "6" }, { between: ["B", "C"], label: "8" }, { between: ["C", "A"], label: "x" }] }), passage: "In right triangle ABC, the right angle is at B. AB = 6 and BC = 8. What is the length of side AC?" },
  { name: "직각삼각형 삼각비 θ", spec: T({ kind: "right", rightAngleAt: "C", sides: [{ between: ["A", "B"], label: "13" }, { between: ["B", "C"], label: "5" }], angles: [{ at: "A", label: "θ" }] }), passage: "In right triangle ABC shown, angle C is a right angle, AB = 13 and BC = 5. What is the value of sin θ?" },
  { name: "이등변 밑각", spec: T({ kind: "isosceles", sides: [{ between: ["A", "B"], tick: 1 }, { between: ["A", "C"], tick: 1 }], angles: [{ at: "B", label: "70°" }, { at: "C", label: "x°" }] }), passage: "In triangle ABC, AB = AC. If angle B measures 70°, what is the value of x?" },
  { name: "정삼각형 변 길이", spec: T({ kind: "equilateral", sides: [{ between: ["B", "C"], label: "10" }], altitude: { from: "A", foot: "D", label: "h" } }), passage: "Equilateral triangle ABC has side BC = 10. AD is the altitude from A to side BC. What is the value of h?" },
  { name: "일반 삼각형 외각", spec: T({ kind: "scalene", angles: [{ at: "A", label: "50°" }, { at: "B", label: "60°" }, { at: "C", label: "x°" }] }), passage: "In triangle ABC, angle A is 50° and angle B is 60°. What is the value of x?" },
  { name: "닮음 두 삼각형", spec: T({ kind: "scalene", sides: [{ between: ["B", "C"], label: "12" }, { between: ["A", "B"], label: "9" }], angles: [{ at: "A", tick: 1 }, { at: "B", tick: 2 }], second: { vertices: ["D", "E", "F"], kind: "scalene", scale: 0.6, sides: [{ between: ["E", "F"], label: "8" }, { between: ["D", "E"], label: "y" }], angles: [{ at: "D", tick: 1 }, { at: "E", tick: 2 }] } }), passage: "Triangles ABC and DEF are similar, with angle A corresponding to angle D and angle B to angle E. BC = 12, AB = 9, and EF = 8. What is the value of y?" },
  { name: "합동 표기", spec: T({ kind: "scalene", sides: [{ between: ["A", "B"], tick: 1 }, { between: ["B", "C"], tick: 2 }], angles: [{ at: "B", tick: 1 }], second: { vertices: ["P", "Q", "R"], kind: "scalene", scale: 1, sides: [{ between: ["P", "Q"], tick: 1 }, { between: ["Q", "R"], tick: 2 }], angles: [{ at: "Q", tick: 1 }] } }), passage: "Triangles ABC and PQR are congruent by SAS. Which angle corresponds to angle B?" },
  { name: "직각 + 각 하나", spec: T({ kind: "right", rightAngleAt: "B", angles: [{ at: "C", label: "37°" }], sides: [{ between: ["A", "C"], label: "10" }] }), passage: "In the right triangle shown, angle B is the right angle, angle C is 37°, and AC = 10. What is the length of side AB?" },
  { name: "높이와 밑변", spec: T({ kind: "scalene", sides: [{ between: ["B", "C"], label: "14" }], altitude: { from: "A", label: "6" } }), passage: "Triangle ABC has base BC = 14 and height 6 from A to BC. What is the area?" },
  { name: "변 세 개 라벨", spec: T({ kind: "scalene", notToScale: false, sides: [{ between: ["A", "B"], label: "7" }, { between: ["B", "C"], label: "9" }, { between: ["C", "A"], label: "5" }] }), passage: "The sides of triangle ABC are AB = 7, BC = 9, and CA = 5. Which angle is the largest?" },
];

describe("템플릿 2 — 대표 문제 10개는 검증을 통과하고 라벨이 모두 그려진다", () => {
  for (const s of SAMPLES) {
    it(s.name, () => {
      const r = renderTriangle(s.spec);
      expect(r.issues).toEqual([]);
      for (const v of s.spec.vertices) expect(r.svg).toContain(`>${v}<`);
      for (const sd of s.spec.sides ?? []) if (sd.label) expect(r.svg).toContain(`>${sd.label}<`);
      expect(r.svg).toContain('role="img"');
      expect(r.svg.includes("Figure not drawn to scale")).toBe(Boolean(s.spec.notToScale));
      expect(lintTriangleAgainstText(s.spec, s.passage)).toEqual([]);
      expect(checkFigure(s.spec, s.passage).ok).toBe(true);
    });
  }
  it("표본 페이지를 남긴다(스크린샷용)", () => {
    if (!process.env.T2_SAMPLES_OUT) return;
    const cards = SAMPLES.map((s) => { const r = renderTriangle(s.spec); return `<div class="card"><h3>${s.name}</h3>${r.svg}<p class="alt">${r.alt}</p><p class="iss">${r.issues.length ? r.issues.map((x) => x.message).join("<br>") : "검증 통과"}</p></div>`; });
    writeFileSync(process.env.T2_SAMPLES_OUT, `<!doctype html><meta charset="utf-8"><style>body{font-family:-apple-system,sans-serif;margin:0;padding:16px;background:#fff;color:#111}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px}.card{border:1.5px solid #ddd;border-radius:12px;padding:12px}.card h3{font-size:13px;margin:0 0 6px}.card svg{max-width:100%;height:auto;display:block}.alt{font-size:11px;color:#666;margin:6px 0 0}.iss{font-size:11px;color:#0a7;margin:4px 0 0}</style><h2 style="font-size:15px;margin:0 0 10px">템플릿 2 표준 렌더러 — 대표 10문항 (std-1)</h2><div class="grid">${cards.join("")}</div>`);
  });
});

describe("템플릿 2 — 거부", () => {
  it("지문의 삼각형·변·각·직각·길이가 데이터와 어긋나면 참조 불일치", () => {
    const issues = lintTriangleAgainstText(
      T({ kind: "right", rightAngleAt: "B", sides: [{ between: ["A", "B"], label: "6" }] }),
      "In right triangle ABD, the right angle is at C. AB = 8 and side BC has length 3. Angle D measures 40°."
    );
    const msgs = issues.map((i) => i.message).join("\n");
    expect(msgs).toContain("'D'");
    expect(msgs).toContain("C 에서 직각");
    expect(msgs).toContain("AB = 8");
    expect(msgs).toContain("40°");
  });
  it("꼭짓점 이름 중복·두 삼각형 이름 중복·직각 꼭짓점의 각 라벨·모르는 꼭짓점은 스키마에서 거부", () => {
    expect(validateTriangle({ type: "triangle", vertices: ["A", "A", "C"] }).ok).toBe(false);
    expect(validateTriangle({ type: "triangle", vertices: ["A", "B", "C"], rightAngleAt: "Z" }).ok).toBe(false);
    expect(validateTriangle({ type: "triangle", vertices: ["A", "B", "C"], rightAngleAt: "B", angles: [{ at: "B", label: "90°" }] }).ok).toBe(false);
    expect(validateTriangle({ type: "triangle", vertices: ["A", "B", "C"], sides: [{ between: ["A", "Q"] }] }).ok).toBe(false);
    const r = renderTriangle(T({ second: { vertices: ["A", "E", "F"] } }));
    expect(r.issues.some((i) => i.code === "duplicate_label")).toBe(true);
  });
  it("긴 라벨은 겹침·잘림으로 잡힌다", () => {
    const r = renderTriangle(T({ kind: "right", rightAngleAt: "B", sides: [{ between: ["A", "B"], label: "(3x + 25) centimeters long" }], angles: [{ at: "A", label: "(2x + 10)° exactly here" }] }));
    expect(r.issues.some((i) => i.code === "label_collision" || i.code === "clipped")).toBe(true);
  });
});
