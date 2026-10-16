import { describe, expect, it } from "vitest";
import { renderSolid, type SolidSpec } from "./solid";

// 2026-10-02(오너 UAT C5) — 값이 같은 치수는 같은 픽셀 길이의 치수선으로 그린다. 높이는 양끝 눈금이 있는 치수선이 있어야 한다.

const dim = (svg: string, kind: string): number | null => {
  const m = svg.match(new RegExp(`<line data-dim="${kind}" x1="([-\\d.]+)" y1="([-\\d.]+)" x2="([-\\d.]+)" y2="([-\\d.]+)"`));
  return m ? Math.hypot(+m[3] - +m[1], +m[4] - +m[2]) : null;
};
const S = (kind: SolidSpec["kind"], dims: SolidSpec["dims"]): SolidSpec => ({ type: "solid", kind, dims });

describe("입체 치수선 — 같은 값 = 같은 px", () => {
  for (const v of ["12", "5", "30"]) {
    it(`원기둥 지름 ${v} = 높이 ${v} → 지름선 px == 높이 치수선 px`, () => {
      const r = renderSolid(S("cylinder", { diameter: v, height: v }));
      expect(r.issues).toEqual([]);
      const dpx = dim(r.svg, "diameter"), hpx = dim(r.svg, "height");
      expect(dpx).not.toBeNull();
      expect(hpx).toBeCloseTo(dpx!, 1);
    });
  }
  it("원기둥 반지름 6·높이 12 → 반지름선 px × 2 == 높이 치수선 px", () => {
    const r = renderSolid(S("cylinder", { radius: "6", height: "12" }));
    expect(r.issues).toEqual([]);
    expect(dim(r.svg, "height")).toBeCloseTo(dim(r.svg, "radius")! * 2, 1);
  });
  it("원기둥 높이 치수선 양끝은 윗면·아랫면 타원 중심 높이에 맞춘다", () => {
    const r = renderSolid(S("cylinder", { diameter: "12", height: "8" }));
    const cy = [...r.svg.matchAll(/<ellipse cx="[-\d.]+" cy="([-\d.]+)"/g)].map((m) => +m[1]);
    const m = r.svg.match(/<line data-dim="height" x1="[-\d.]+" y1="([-\d.]+)" x2="[-\d.]+" y2="([-\d.]+)"/)!;
    const arcs = [...r.svg.matchAll(/<path d="M [-\d.]+ ([-\d.]+) A/g)].map((a) => +a[1]);
    expect(+m[1]).toBeCloseTo(cy[0], 1);
    expect(+m[2]).toBeCloseTo(arcs[0], 1);
  });
  it("원뿔 지름 10 = 높이 10 → 지름선 px == 높이(꼭짓점–밑면 중심) px", () => {
    const r = renderSolid(S("cone", { diameter: "10", height: "10" }));
    expect(r.issues).toEqual([]);
    const dashed = r.svg.match(/<line x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"[^>]*stroke-dasharray/)!;
    const hpx = Math.hypot(+dashed[3] - +dashed[1], +dashed[4] - +dashed[2]);
    expect(hpx).toBeCloseTo(dim(r.svg, "diameter")!, 0);
  });
});
