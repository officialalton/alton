import { describe, expect, it } from "vitest";
import { renderTriangle, type TriangleSpec } from "./triangle";
import { renderParallelTransversal, type ParallelTransversalSpec } from "./parallel-transversal";

// 2026-10-02(오너 UAT C6) — 숫자로 표기된 각은 그림에서도 그 각(±3°)이어야 한다. 그린 SVG 좌표에서 각을 다시 계산해 라벨과 비교한다.

type P = [number, number];
const lines = (svg: string): [P, P][] =>
  [...svg.matchAll(/<line x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"/g)].map((m) => [[+m[1], +m[2]], [+m[3], +m[4]]]);
const angleAt = (c: P, p: P, q: P) => {
  const a = Math.atan2(p[1] - c[1], p[0] - c[0]), b = Math.atan2(q[1] - c[1], q[0] - c[0]);
  let d = Math.abs(a - b) * (180 / Math.PI);
  if (d > 180) d = 360 - d;
  return d;
};
/** 삼각형 세 변은 맨 먼저 그려진다: v0-v1, v1-v2, v2-v0. */
function drawnAngles(spec: TriangleSpec): Record<string, number> {
  const ls = lines(renderTriangle(spec).svg);
  const [v0, v1, v2]: P[] = [ls[0][0], ls[1][0], ls[2][0]];
  const [n0, n1, n2] = spec.vertices;
  return { [n0]: angleAt(v0, v1, v2), [n1]: angleAt(v1, v0, v2), [n2]: angleAt(v2, v0, v1) };
}
const T = (over: Partial<TriangleSpec>): TriangleSpec => ({ type: "triangle", vertices: ["A", "B", "C"], notToScale: true, ...over });

describe("삼각형 — 숫자 각 라벨대로 그린다", () => {
  it("이등변 꼭지각 76° → 꼭지각 76°, 밑각 52°(오너 사례)", () => {
    const a = drawnAngles(T({ kind: "isosceles", sides: [{ between: ["A", "B"], tick: 1 }, { between: ["A", "C"], tick: 1 }], angles: [{ at: "A", label: "76°" }, { at: "B", label: "x°" }] }));
    expect(Math.abs(a.A - 76)).toBeLessThan(3);
    expect(Math.abs(a.B - 52)).toBeLessThan(3);
    expect(Math.abs(a.C - 52)).toBeLessThan(3);
  });
  for (const theta of [30, 50, 100, 120]) {
    it(`이등변 꼭지각 ${theta}°`, () => {
      const a = drawnAngles(T({ kind: "isosceles", angles: [{ at: "A", label: `${theta}°` }] }));
      expect(Math.abs(a.A - theta)).toBeLessThan(3);
    });
  }
  it("이등변 밑각 70°", () => {
    const a = drawnAngles(T({ kind: "isosceles", angles: [{ at: "B", label: "70°" }, { at: "C", label: "x°" }] }));
    expect(Math.abs(a.B - 70)).toBeLessThan(3);
    expect(Math.abs(a.A - 40)).toBeLessThan(3);
  });
  it("일반 삼각형 두 각 50°·60° (둔각 포함 사례 30°·110°도)", () => {
    const a = drawnAngles(T({ kind: "scalene", angles: [{ at: "A", label: "50°" }, { at: "B", label: "60°" }, { at: "C", label: "x°" }] }));
    expect(Math.abs(a.A - 50)).toBeLessThan(3);
    expect(Math.abs(a.B - 60)).toBeLessThan(3);
    const b = drawnAngles(T({ kind: "scalene", angles: [{ at: "B", label: "30°" }, { at: "C", label: "110°" }] }));
    expect(Math.abs(b.B - 30)).toBeLessThan(3);
    expect(Math.abs(b.C - 110)).toBeLessThan(3);
  });
  it("직각삼각형 예각 37°", () => {
    const a = drawnAngles(T({ kind: "right", rightAngleAt: "B", angles: [{ at: "C", label: "37°" }], sides: [{ between: ["A", "C"], label: "10" }] }));
    expect(Math.abs(a.B - 90)).toBeLessThan(1);
    expect(Math.abs(a.C - 37)).toBeLessThan(3);
  });
  it("미지수 각 하나뿐이면 정답 각이 아니라 중립 모양(기존 고정 비율)으로 그린다", () => {
    const a = drawnAngles(T({ kind: "scalene", angles: [{ at: "A", label: "x°" }] }));
    const b = drawnAngles(T({ kind: "scalene" }));
    expect(a.A).toBeCloseTo(b.A, 5);
  });
});

describe("평행선·횡단선 — 숫자 각 라벨대로 기울인다", () => {
  const base = (label: string, region: "NE" | "NW" | "SE" | "SW"): ParallelTransversalSpec => ({
    type: "parallel_transversal", parallel: ["m", "n"], transversals: [{ id: "k" }],
    angles: [{ at: ["m", "k"], region, label }, { at: ["n", "k"], region: "NE", label: "x°" }], notToScale: true,
  });
  const drawnSlant = (spec: ParallelTransversalSpec) => {
    const [, , t] = lines(renderParallelTransversal(spec).svg);
    return Math.atan2(Math.abs(t[1][1] - t[0][1]), Math.abs(t[1][0] - t[0][0])) * (180 / Math.PI);
  };
  it("예각 쐐기 37° → 횡단선이 37°", () => expect(Math.abs(drawnSlant(base("37°", "NW")) - 37)).toBeLessThan(3));
  it("둔각 쐐기 115° → 횡단선이 65°", () => expect(Math.abs(drawnSlant(base("115°", "NE")) - 65)).toBeLessThan(3));
  it("미지수 라벨만 있으면 기본 기울기(55°)", () => expect(Math.abs(drawnSlant(base("y°", "NW")) - 55)).toBeLessThan(0.5));
  it("식 라벨('(2x + 10)°')이어도 value(비인쇄 참값 48°)가 있으면 그 각대로 그린다", () => {
    const spec = base("(2x + 10)°", "NW"); spec.angles[0] = { ...spec.angles[0], value: 48 };
    expect(Math.abs(drawnSlant(spec) - 48)).toBeLessThan(3);
    const obtuse = base("(2x + 10)°", "NE"); obtuse.angles[0] = { ...obtuse.angles[0], value: 118 };
    expect(Math.abs(drawnSlant(obtuse) - 62)).toBeLessThan(3);
  });
});

describe("평행선·횡단선 — 횡단선끼리 만나는 그림(crossing.slants)은 두 횡단선을 각자의 각대로 그린다", () => {
  const spec = (slants: [number, number]): ParallelTransversalSpec => ({
    type: "parallel_transversal", parallel: ["m", "n"], transversals: [{ id: "p" }, { id: "q" }], crossing: { side: "below", slants },
    points: [{ id: "X", on: ["p", "q"] }], angles: [{ at: ["p", "q"], region: "N", label: "x°" }], notToScale: true,
  });
  const slantsOf = (sp: ParallelTransversalSpec) => { const ls = lines(renderParallelTransversal(sp).svg); return [ls[2], ls[3]].map((t) => Math.atan2(Math.abs(t[1][1] - t[0][1]), Math.abs(t[1][0] - t[0][0])) * (180 / Math.PI)); };
  for (const sl of [[55, 55], [48, 70], [66, 44], [80, 52]] as [number, number][]) {
    it(`각 ${sl.join("°·")}°`, () => {
      const r = renderParallelTransversal(spec(sl)); expect(r.issues).toEqual([]);
      const [a, b] = slantsOf(spec(sl)); expect(Math.abs(a - sl[0])).toBeLessThan(2); expect(Math.abs(b - sl[1])).toBeLessThan(2);
    });
  }
  it("slants 가 없으면 기존 그림과 같다(둘 다 55°·가로 360)", () => {
    const sp = spec([55, 55]); delete (sp.crossing as { slants?: unknown }).slants;
    const r = renderParallelTransversal(sp); expect(r.svg).toContain('viewBox="0 0 360'); const [a, b] = slantsOf(sp); expect(Math.abs(a - 55)).toBeLessThan(0.5); expect(Math.abs(b - 55)).toBeLessThan(0.5);
  });
});
