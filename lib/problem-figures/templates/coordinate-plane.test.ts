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
  // 2026-09-14 보완(SAT Test 6~11 대조): 부등식·조각함수·유리함수
  { name: "부등식 두 개(공통 영역)", spec: P([{ id: "a", kind: "inequality", op: "<=", slope: 1, intercept: 2, label: "y ≤ x + 2" }, { id: "b", kind: "inequality", op: ">", slope: -1, intercept: -1, label: "y > -x - 1" }]), passage: "The system y ≤ x + 2 and y > -x - 1 is graphed in the xy-plane. Which point is a solution to the system?" },
  { name: "조각함수(열린/닫힌 점)", spec: P([{ id: "g", kind: "piecewise", pieces: [{ from: -4, to: 0, slope: 1, intercept: 2, openTo: true }, { from: 0, to: 4, slope: -0.5, intercept: 3 }], label: "g" }]), passage: "The graph of the piecewise function g is shown. What is g(0)?" },
  { name: "유리함수(점근선)", spec: P([{ id: "r", kind: "function", fn: "rational", params: [1, 0, 1, -2], label: "f" }], { x: { min: -6, max: 8 }, y: { min: -6, max: 8 } }), passage: "The graph of f(x) = x / (x − 2) is shown. What is the equation of the vertical asymptote?" },
  // 2026-09-14 좌표기하·복합 도형
  { name: "좌표 위 삼각형 넓이", spec: P([{ id: "A", kind: "point", at: [-2, 1], label: "A" }, { id: "B", kind: "point", at: [4, 1], label: "B" }, { id: "C", kind: "point", at: [1, 5], label: "C" }, { id: "T", kind: "polygon", vertices: ["A", "B", "C"], fill: true }]), passage: "Triangle ABC has vertices A(-2, 1), B(4, 1), and C(1, 5). The area of triangle ABC is 12. What is the length of the altitude from C?" },
  { name: "선분 중점과 길이", spec: P([{ id: "P", kind: "point", at: [-3, -1], label: "P" }, { id: "Q", kind: "point", at: [3, 7], label: "Q" }, { id: "s", kind: "segment", from: "P", to: "Q" }, { id: "M", kind: "midpoint", of: ["P", "Q"], label: "M" }], { x: { min: -6, max: 6 }, y: { min: -4, max: 8 } }), passage: "Segment PQ has endpoints P(-3, -1) and Q(3, 7). The midpoint of PQ is (0, 3) and PQ = 10. What is the slope of PQ?" },
  { name: "두 직선 교점", spec: P([{ id: "l1", kind: "line", slope: 2, intercept: -1, label: "ℓ" }, { id: "l2", kind: "line", slope: -1, intercept: 5, label: "m" }, { id: "X", kind: "intersection", of: ["l1", "l2"], label: "X" }]), passage: "Lines ℓ and m intersect at point X. The slope of ℓ is 2. What are the coordinates of X?" },
  { name: "평행이동 상", spec: P([{ id: "A", kind: "point", at: [-4, 1] }, { id: "B", kind: "point", at: [-1, 1] }, { id: "C", kind: "point", at: [-1, 3] }, { id: "T", kind: "polygon", vertices: ["A", "B", "C"] }, { id: "T2", kind: "transform", of: "T", op: { type: "translate", dx: 5, dy: 2 } }]), passage: "Triangle ABC is translated 5 units to the right and 2 units up to form triangle A′B′C′. What are the coordinates of C′?" },
  { name: "x축 대칭", spec: P([{ id: "A", kind: "point", at: [1, 1] }, { id: "B", kind: "point", at: [4, 1] }, { id: "C", kind: "point", at: [4, 3] }, { id: "D", kind: "point", at: [1, 3] }, { id: "R", kind: "polygon", vertices: ["A", "B", "C", "D"] }, { id: "R2", kind: "transform", of: "R", op: { type: "reflect", over: "x-axis" } }]), passage: "Rectangle ABCD is reflected across the x-axis. What are the coordinates of the image of D?" },
  { name: "원과 직선(원의 방정식)", spec: P([{ id: "O", kind: "point", at: [2, -1], label: "(2, -1)" }, { id: "c", kind: "circle", center: "O", radius: 3 }, { id: "l", kind: "line", slope: 0, intercept: 2, label: "y = 2", style: "dashed" }], { x: { min: -3, max: 7 }, y: { min: -5, max: 5 } }), passage: "The circle has center (2, -1) and radius 3, and the line y = 2 is tangent to it. What is the equation of the circle?" },
  { name: "평행·수직 관계", spec: P([{ id: "A", kind: "point", at: [0, 0], label: "A" }, { id: "B", kind: "point", at: [4, 2], label: "B" }, { id: "C", kind: "point", at: [2, 6], label: "C" }, { id: "D", kind: "point", at: [-2, 4], label: "D" }, { id: "Q", kind: "polygon", vertices: ["A", "B", "C", "D"] }]), passage: "Quadrilateral ABCD is shown. AB is parallel to DC and AB is perpendicular to AD. AB = √20. What is the area of ABCD?".replace("√20", "√20") },
  { name: "확대 변환", spec: P([{ id: "A", kind: "point", at: [1, 1] }, { id: "B", kind: "point", at: [2, 1] }, { id: "C", kind: "point", at: [1, 2] }, { id: "T", kind: "polygon", vertices: ["A", "B", "C"] }, { id: "T2", kind: "transform", of: "T", op: { type: "dilate", k: 2 } }]), passage: "Triangle ABC is dilated by a scale factor of 2 with center at the origin. What is the area of the image?" },
  // 매트릭스 '부분' 해소 — 비선형 연립(포물선+직선 교점)
  { name: "비선형 연립 교점", spec: P([{ id: "f", kind: "function", fn: "quadratic", params: [1, 0, -1], label: "y = x² − 1" }, { id: "l", kind: "line", slope: 1, intercept: 1, label: "y = x + 1" }, { id: "P", kind: "point", at: [-1, 0], label: "(-1, 0)" }, { id: "Q", kind: "point", at: [2, 3], label: "(2, 3)" }], { x: { min: -4, max: 5 }, y: { min: -3, max: 6 } }), passage: "The graphs of y = x² − 1 and y = x + 1 intersect at the points (-1, 0) and (2, 3). What is the sum of the x-coordinates of the intersection points?" },
];

describe("템플릿 3 — 대표 문제 10개는 검증을 통과한다", () => {
  for (const s of SAMPLES) {
    it(s.name, () => {
      const r = renderPlane(s.spec);
      expect(r.issues).toEqual([]);
      expect(r.svg).toContain('role="img"');
      expect(r.alt).toContain("좌표평면");
      for (const o of s.spec.objects) if ("label" in o && o.label) expect(r.svg).toContain(">" + o.label.replace(/ - /g, " − ").replace(/</g, "&lt;").replace(/>/g, "&gt;") + "<");
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
  it("지문의 부등식이 그림의 음영과 다르면 참조 불일치, 겹치는 조각·분모 0 유리함수는 스키마 거부", () => {
    const sp = SAMPLES.find((x) => x.name.startsWith("부등식"))!.spec;
    expect(lintPlaneAgainstText(sp, "The inequality y ≥ x + 2 is shown.").some((i) => i.code === "ref_mismatch")).toBe(true);
    expect(validatePlane(P([{ id: "g", kind: "piecewise", pieces: [{ from: 0, to: 3, slope: 1, intercept: 0 }, { from: 2, to: 5, slope: 1, intercept: 0 }] }])).ok).toBe(false);
    expect(validatePlane(P([{ id: "r", kind: "function", fn: "rational", params: [1, 0, 0, 2] }])).ok).toBe(false);
    const r = renderPlane(sp);
    expect(r.svg).toContain("fill-opacity");
    expect(r.svg).toContain("stroke-dasharray");
  });
  it("좌표기하: 넓이·길이·중점·기울기·평행/수직·변환의 지문 값이 계산과 다르면 거부", () => {
    const tri = SAMPLES.find((x) => x.name.startsWith("좌표 위 삼각형"))!.spec;
    expect(lintPlaneAgainstText(tri, "The area of triangle ABC is 15.").some((i) => i.code === "ref_mismatch")).toBe(true);
    const seg = SAMPLES.find((x) => x.name.startsWith("선분 중점"))!.spec;
    const m = lintPlaneAgainstText(seg, "The midpoint of PQ is (1, 3) and PQ = 8. The slope of PQ is 2.").map((i) => i.message).join("\n");
    expect(m).toContain("중점");
    expect(m).toContain("길이");
    expect(m).toContain("기울기");
    const quad = SAMPLES.find((x) => x.name.startsWith("평행·수직"))!.spec;
    expect(lintPlaneAgainstText(quad, "AB is perpendicular to DC.").some((i) => i.code === "ref_mismatch")).toBe(true);
    const tr = SAMPLES.find((x) => x.name.startsWith("평행이동"))!.spec;
    expect(lintPlaneAgainstText(tr, "Triangle ABC is translated 3 units to the right and 2 units up.").some((i) => i.code === "ref_mismatch")).toBe(true);
    expect(validatePlane(P([{ id: "X", kind: "intersection", of: ["a", "b"] }])).ok).toBe(false);
    expect(validatePlane(P([{ id: "T2", kind: "transform", of: "nope", op: { type: "translate", dx: 1, dy: 1 } }])).ok).toBe(false);
    // 평행한 두 직선의 교점은 만들 수 없다.
    const r = renderPlane(P([{ id: "a", kind: "line", slope: 1, intercept: 0 }, { id: "b", kind: "line", slope: 1, intercept: 2 }, { id: "X", kind: "intersection", of: ["a", "b"], label: "X" }]));
    expect(r.issues.some((i) => i.code === "impossible")).toBe(true);
  });
  it("선택지의 좌표를 그림에 점으로 찍으면 정답 노출로 거부한다(E2E 실례)", () => {
    const sp = P([{ id: "a", kind: "inequality", op: "<=", slope: 1, intercept: 2 }, { id: "p", kind: "point", at: [1, 1], label: "(1, 1)" }]);
    expect(lintPlaneAgainstText(sp, "Which point is a solution?", ["(0, 3)", "(1, 1)"]).some((i) => i.code === "option_leak")).toBe(true);
    expect(lintPlaneAgainstText(sp, "Which point is a solution?", ["(0, 3)", "(2, 2)"]).some((i) => i.code === "option_leak")).toBe(false);
  });
  it("눈금 숫자는 간격의 배수에만 붙는다 — step 1 에 -8~8 이면 -6, -3, 3, 6 (E2E 실례: -8, -5, -2 …)", () => {
    const r = renderPlane(P([{ id: "l", kind: "line", slope: 1, intercept: 0 }], { x: { min: -8, max: 8, step: 1 }, y: { min: -8, max: 8, step: 1 } }));
    const nums = Array.from(r.svg.matchAll(/font-size="12" text-anchor="middle" fill="#111">(-?\d+)<\/text>/g)).map((m) => Number(m[1]));
    expect(nums).toEqual([-6, -3, 3, 6]);
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
