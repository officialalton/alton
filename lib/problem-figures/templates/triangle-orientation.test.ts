import { describe, expect, it } from "vitest";
import { lintTriangleAgainstText, renderTriangle, validateTriangle, type TriangleSpec } from "./triangle";

// 2026-10-05(오너 UAT) — 풍선 고도각 문제의 그림이 지문과 반대로 그려졌다(수평 40 m 가 세로변). 그리고 각을 몇 배로 주는 문제의 그림이 참값과 달랐다.
type P = [number, number];
const lines = (svg: string): [P, P][] =>
  [...svg.matchAll(/<line x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"/g)].map((m) => [[+m[1], +m[2]], [+m[3], +m[4]]]);
const pts = (spec: TriangleSpec): Record<string, P> => {
  const ls = lines(renderTriangle(spec).svg);
  const [a, b, c] = spec.vertices;
  return { [a]: ls[0][0], [b]: ls[1][0], [c]: ls[2][0] };
};
const angleAt = (c: P, p: P, q: P) => {
  let d = Math.abs(Math.atan2(p[1] - c[1], p[0] - c[0]) - Math.atan2(q[1] - c[1], q[0] - c[0])) * (180 / Math.PI);
  if (d > 180) d = 360 - d;
  return d;
};

const balloon: TriangleSpec = {
  type: "triangle", vertices: ["A", "B", "C"], kind: "right", rightAngleAt: "B", horizontal: ["A", "B"],
  sides: [{ between: ["A", "B"], label: "40" }, { between: ["B", "C"], label: "h" }],
  angles: [{ at: "A", label: "45°" }], notToScale: true,
};

describe("직각삼각형 horizontal — 지면 방향", () => {
  it("옛 매핑(horizontal 없음)은 A–B 가 세로로 그려진다(회귀 기준)", () => {
    const { horizontal: _h, ...old } = balloon;
    void _h;
    const p = pts(old as TriangleSpec);
    expect(Math.abs(p.A[0] - p.B[0])).toBeLessThan(1); // 세로변
    expect(Math.abs(p.A[1] - p.B[1])).toBeGreaterThan(20);
  });
  it("horizontal ['A','B'] → A–B 가로(관찰자 왼쪽), B–C 세로(기지 바로 위), 고도각은 A", () => {
    const p = pts(balloon);
    expect(Math.abs(p.A[1] - p.B[1])).toBeLessThan(1);
    expect(p.A[0]).toBeLessThan(p.B[0]);
    expect(Math.abs(p.B[0] - p.C[0])).toBeLessThan(1);
    expect(p.C[1]).toBeLessThan(p.B[1]); // 위
    expect(Math.abs(angleAt(p.A, p.B, p.C) - 45)).toBeLessThan(3);
    expect(Math.abs(angleAt(p.B, p.A, p.C) - 90)).toBeLessThan(1);
  });
  it("직각 꼭짓점이 왼쪽 끝이어도 된다", () => {
    const p = pts({ ...balloon, horizontal: ["B", "A"] });
    expect(p.B[0]).toBeLessThan(p.A[0]);
    expect(Math.abs(p.B[0] - p.C[0])).toBeLessThan(1);
  });
  it("검증: horizontal 은 직각 꼭짓점을 포함해야 한다", () => {
    expect(validateTriangle({ ...balloon, horizontal: ["A", "C"] }).ok).toBe(false);
    expect(validateTriangle(balloon).ok).toBe(true);
  });
  it("lint: 고도각 지문에 horizontal 이 없으면 막는다", () => {
    const text = "An observer 40 meters from the base measures the angle of elevation to be 45°. What is the height?";
    const { horizontal: _h, ...old } = balloon;
    void _h;
    expect(lintTriangleAgainstText(old as TriangleSpec, text).some((i) => i.code === "orientation_missing")).toBe(true);
    expect(lintTriangleAgainstText(balloon, text).some((i) => i.code === "orientation_missing")).toBe(false);
  });
});

describe("삼각형 angles[].value — 참값대로 그린다(인쇄하지 않음)", () => {
  const xyz: TriangleSpec = {
    type: "triangle", vertices: ["X", "Y", "Z"], kind: "scalene", notToScale: true,
    angles: [{ at: "X", label: "38°" }, { at: "Y", value: 106.5 }, { at: "Z", value: 35.5 }],
  };
  it("X=38, Y=106.5(둔각), Z=35.5 로 그려지고 값은 라벨에 나오지 않는다", () => {
    const p = pts(xyz);
    expect(Math.abs(angleAt(p.X, p.Y, p.Z) - 38)).toBeLessThan(3);
    expect(Math.abs(angleAt(p.Y, p.X, p.Z) - 106.5)).toBeLessThan(3);
    expect(Math.abs(angleAt(p.Z, p.X, p.Y) - 35.5)).toBeLessThan(3);
    const r = renderTriangle(xyz);
    expect(r.svg).not.toContain("106.5");
    expect(r.issues).toEqual([]);
  });
  it("옛 스펙(X 만 38°)은 Y≈Z≈71° 로 그려져 참값과 어긋난다(회귀 기준)", () => {
    const p = pts({ ...xyz, angles: [{ at: "X", label: "38°" }] });
    expect(Math.abs(angleAt(p.Y, p.X, p.Z) - 106.5)).toBeGreaterThan(20);
  });
  it("lint: 배수 관계 문제인데 value 가 없으면 막는다", () => {
    const text = "In triangle XYZ, the angle at X is 38°, and the angle at Y is 3 times the angle at Z. What is the measure of the angle at Y?";
    expect(lintTriangleAgainstText({ ...xyz, angles: [{ at: "X", label: "38°" }] }, text).some((i) => i.code === "angle_value_missing")).toBe(true);
    expect(lintTriangleAgainstText(xyz, text).some((i) => i.code === "angle_value_missing")).toBe(false);
  });
});
