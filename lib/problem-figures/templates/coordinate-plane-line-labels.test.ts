import { describe, expect, it } from "vitest";
import { renderPlane, type PlaneSpec } from "./coordinate-plane";

// 2026-10-05(오너 UAT) — 직선 라벨(l1·l2…)은 해당 직선 바로 옆에 있어야 한다.
const spec = (objects: PlaneSpec["objects"], r = 6): PlaneSpec => ({ type: "plane", axes: { x: { min: -r, max: r }, y: { min: -r, max: r } }, objects });
function labelDist(svg: string, label: string, k: number): number {
  const l = [...svg.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)"[^>]*stroke-width="4"[^>]*>([^<]+)<\/text>/g)].map((m) => ({ x: +m[1], y: +m[2], t: m[3] })).find((x) => x.t === label)!;
  const lines = [...svg.matchAll(/<polyline points="([^"]+)"/g)].map((m) => m[1].split(" ").map((p) => p.split(",").map(Number)));
  const [a, b] = lines[k];
  const dx = b[0] - a[0], dy = b[1] - a[1];
  return Math.abs(dy * (l.x - a[0]) - dx * (l.y - a[1])) / Math.hypot(dx, dy);
}

describe("좌표평면 직선 라벨 — 선 바로 옆", () => {
  const s = spec([{ id: "l1", kind: "line", slope: 3, intercept: -4, label: "l1" }, { id: "l2", kind: "line", slope: -2, intercept: 1, label: "l2" }]);
  const r = renderPlane(s);
  it("충돌·잘림 문제 없음", () => expect(r.issues).toEqual([]));
  it("각 라벨 중심이 자기 직선에서 17px 이내(이전 최대 21.7px)", () => {
    expect(labelDist(r.svg, "l1", 0)).toBeLessThan(17);
    expect(labelDist(r.svg, "l2", 1)).toBeLessThan(17);
  });
});
