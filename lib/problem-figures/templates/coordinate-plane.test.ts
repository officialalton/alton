import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { checkFigure } from "../check";
import { lintPlaneAgainstText, renderPlane, validatePlane, type PlaneSpec } from "./coordinate-plane";

// 표준 렌더링 엔진 템플릿 3 — 좌표평면(객체 id 기반). 대표 10문항 통과, 참조 불일치·범위 밖·라벨 자리 없음은 거부.

const P = (objects: PlaneSpec["objects"], axes: Partial<PlaneSpec["axes"]> = {}, extra: Partial<PlaneSpec> = {}): PlaneSpec => ({
  type: "plane",
  axes: { x: { min: -6, max: 6 }, y: { min: -6, max: 6 }, ...axes },
  objects,
  ...extra,
});

export const SAMPLES: { name: string; spec: PlaneSpec; passage: string }[] = [
  { name: "직선과 점", spec: P([{ id: "L", kind: "line", slope: 2, intercept: -3, label: "ℓ" }, { id: "P", kind: "point", at: [2, 1], label: "P" }]), passage: "The graph of line ℓ, y = 2x − 3, is shown in the xy-plane. Point P has coordinates (2, 1). What is the y-intercept of line ℓ?" },
  { name: "두 직선 교점(연립)", spec: P([{ id: "a", kind: "line", slope: 1, intercept: 1, label: "y = x + 1" }, { id: "b", kind: "line", slope: -1, intercept: 3, label: "y = -x + 3" }, { id: "Q", kind: "point", at: [1, 2] }]), passage: "The system y = x + 1 and y = -x + 3 is graphed. What is the solution (x, y) of the system?" },
  { name: "포물선", spec: P([{ id: "f", kind: "function", fn: "quadratic", params: [1, -2, -3], label: "f" }], { x: { min: -4, max: 6 }, y: { min: -5, max: 7 } }), passage: "The graph of f(x) = x² − 2x − 3 is shown. What are the x-intercepts of the graph of y = x^2 - 2x - 3?" },
  { name: "지수함수", spec: P([{ id: "g", kind: "function", fn: "exponential", params: [1, 2, 0], label: "g" }], { x: { min: -3, max: 4 }, y: { min: -1, max: 9 } }), passage: "The graph of g(x) = 2^x is shown. Which point lies on the graph?" },
  { name: "절댓값", spec: P([{ id: "h", kind: "function", fn: "abs", params: [1, 2, -1], label: "h" }], { x: { min: -4, max: 8 }, y: { min: -3, max: 6 } }), passage: "The function h(x) = |x − 2| − 1 is graphed. What is the minimum value of h?" },
  { name: "선분과 두 점", spec: P([{ id: "A", kind: "point", at: [-3, -2], label: "A" }, { id: "B", kind: "point", at: [3, 4], label: "B" }, { id: "s", kind: "segment", from: "A", to: "B" }]), passage: "Points A (-3, -2) and B (3, 4) are shown. What is the length of segment AB?" },
  { name: "산점도와 추세선", spec: P([{ id: "d", kind: "scatter", points: [[1, 2.1], [2, 2.9], [3, 4.2], [4, 4.8], [5, 6.1], [6, 6.8]], fitLine: { slope: 0.95, intercept: 1.1 } }], { x: { min: 0, max: 8, title: "Hours studied" }, y: { min: 0, max: 8, title: "Score (points)" } }), passage: "The scatterplot shows hours studied and scores for 6 students, with a line of best fit. Which is closest to the predicted score for 7 hours?" },
  { name: "제1사분면 응용(축 제목)", spec: P([{ id: "c", kind: "function", fn: "linear", params: [15, 20], label: "C" }], { x: { min: 0, max: 10, step: 2, title: "Time (hours)" }, y: { min: 0, max: 200, step: 40, title: "Cost (dollars)" } }), passage: "The graph shows the cost C, in dollars, of renting a boat for x hours. What is the meaning of the y-intercept?" },
  { name: "수직선과 수평선", spec: P([{ id: "v", kind: "line", through: [[2, -6], [2, 6]], label: "x = 2" }, { id: "w", kind: "line", slope: 0, intercept: -1, label: "y = -1" }]), passage: "Lines x = 2 and y = -1 are graphed. At what point do they intersect?" },
  { name: "제곱근 함수", spec: P([{ id: "r", kind: "function", fn: "sqrt", params: [2, 1, 0], label: "y = 2√(x − 1)" }], { x: { min: -1, max: 10 }, y: { min: -1, max: 7 } }), passage: "The graph of y = 2√(x − 1) is shown. For what value of x is y = 4?" },
];

describe("템플릿 3 — 대표 문제 10개는 검증을 통과한다", () => {
  for (const s of SAMPLES) {
    it(s.name, () => {
      const r = renderPlane(s.spec);
      expect(r.issues).toEqual([]);
      expect(r.svg).toContain('role="img"');
      expect(r.alt).toContain("좌표평면");
      for (const o of s.spec.objects) if ("label" in o && o.label) expect(r.svg).toContain(">" + o.label.replace(/ - /g, " − ").replace(/</g, "&lt;") + "<");
      expect(lintPlaneAgainstText(s.spec, s.passage)).toEqual([]);
      expect(checkFigure(s.spec, s.passage).ok).toBe(true);
    });
  }
  it("표본 페이지를 남긴다(스크린샷용)", () => {
    if (!process.env.T3_SAMPLES_OUT) return;
    const cards = SAMPLES.map((s) => { const r = renderPlane(s.spec); return `<div class="card"><h3>${s.name}</h3>${r.svg}<p class="alt">${r.alt}</p><p class="iss">${r.issues.length ? r.issues.map((x) => x.message).join("<br>") : "검증 통과"}</p></div>`; });
    writeFileSync(process.env.T3_SAMPLES_OUT, `<!doctype html><meta charset="utf-8"><style>body{font-family:-apple-system,sans-serif;margin:0;padding:16px;background:#fff;color:#111}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:16px}.card{border:1.5px solid #ddd;border-radius:12px;padding:12px}.card h3{font-size:13px;margin:0 0 6px}.card svg{max-width:100%;height:auto;display:block}.alt{font-size:11px;color:#666;margin:6px 0 0}.iss{font-size:11px;color:#0a7;margin:4px 0 0}</style><h2 style="font-size:15px;margin:0 0 10px">템플릿 3 표준 렌더러 — 대표 10문항 (std-1)</h2><div class="grid">${cards.join("")}</div>`);
  });
});

describe("템플릿 3 — 거부", () => {
  it("지문의 좌표·점·직선·식이 그림과 어긋나면 참조 불일치", () => {
    const issues = lintPlaneAgainstText(
      P([{ id: "L", kind: "line", slope: 2, intercept: -3, label: "ℓ" }]),
      "Line k, y = 3x + 1, passes through point P (2, 5). Line ℓ is also shown."
    );
    const msgs = issues.map((i) => i.message).join("\n");
    expect(msgs).toContain("(2, 5)");
    expect(msgs).toContain("'P'");
    expect(msgs).toContain("'k'");
    expect(msgs).toContain("y = 3x + 1");
  });
  it("범위 밖 점·보이지 않는 직선, 눈금 과다, id 중복·모르는 참조는 거부", () => {
    const r = renderPlane(P([{ id: "P", kind: "point", at: [20, 20], label: "P" }, { id: "L", kind: "line", slope: 0, intercept: 50 }]));
    expect(r.issues.map((i) => i.code)).toEqual(expect.arrayContaining(["out_of_range"]));
    expect(validatePlane({ type: "plane", axes: { x: { min: 0, max: 100, step: 1 }, y: { min: 0, max: 1 } }, objects: [{ id: "a", kind: "point", at: [1, 1] }] }).ok).toBe(false);
    expect(validatePlane(P([{ id: "a", kind: "point", at: [1, 1] }, { id: "a", kind: "point", at: [2, 2] }])).ok).toBe(false);
    expect(validatePlane(P([{ id: "s", kind: "segment", from: "A", to: [1, 1] }])).ok).toBe(false);
    expect(validatePlane(P([{ id: "f", kind: "function", fn: "quadratic", params: [1, 2] }])).ok).toBe(false);
  });
  it("라벨을 놓을 자리가 없으면 거부한다(점이 빽빽하고 라벨이 길 때)", () => {
    const objs: PlaneSpec["objects"] = [];
    for (let i = 0; i < 6; i++) objs.push({ id: `p${i}`, kind: "point", at: [0.2 * i, 0.2 * i], label: `Point number ${i} with a very long label` });
    const r = renderPlane(P(objs, { x: { min: -1, max: 2 }, y: { min: -1, max: 2 } }));
    expect(r.issues.some((i) => i.code === "label_collision")).toBe(true);
  });
  it("축 제목에 변수 글자('x', 'y,')만 오면 무시한다 — 축 끝 라벨과 겹친다(E2E 실례)", () => {
    const r = renderPlane(P([{ id: "l", kind: "line", slope: 1, intercept: 0 }], { x: { min: -5, max: 5, title: "x" }, y: { min: -5, max: 5, title: "y," } }));
    expect(r.svg).not.toContain("rotate(-90)");
    expect(r.issues).toEqual([]);
  });

  it("옛 좌표형(coordinate_plane) 은 재생성 필요", () => {
    const c = checkFigure({ type: "coordinate_plane", xRange: [-2, 8], yRange: [-2, 8], items: [{ kind: "line", slope: 1, intercept: 0 }] }, "x");
    expect(c.ok).toBe(false);
    expect(c.issues[0].code).toBe("legacy");
  });
});
