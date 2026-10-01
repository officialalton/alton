import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { checkFigure } from "../check";
import { lintCircleAgainstText, renderCircle, validateCircle, type CircleSpec } from "./circle";

const C = (over: Partial<CircleSpec>): CircleSpec => ({ type: "circle", points: [], notToScale: true, ...over });

export const SAMPLES: { name: string; spec: CircleSpec; passage: string }[] = [
  { name: "반지름·중심각·호 길이", spec: C({ points: [{ id: "A", angle: 20 }, { id: "B", angle: 140 }], radii: [{ to: "A", label: "6" }, { to: "B" }], centralAngles: [{ between: ["A", "B"], label: "120°" }], arcs: [{ from: "A", to: "B" }] }), passage: "In the circle with center O, OA = 6 and the measure of angle AOB is 120°. What is the length of arc AB?" },
  { name: "부채꼴 넓이", spec: C({ points: [{ id: "P", angle: 0 }, { id: "Q", angle: 90 }], sector: { from: "P", to: "Q" }, radii: [{ to: "P", label: "4" }], centralAngles: [{ between: ["P", "Q"], right: true }] }), passage: "The circle has center O and radius OP = 4. What is the area of the shaded sector POQ?" },
  { name: "지름과 원주각(직각)", spec: C({ points: [{ id: "A", angle: 180 }, { id: "B", angle: 0 }, { id: "C", angle: 60 }], chords: [{ between: ["A", "B"], diameter: true }, { between: ["A", "C"] }, { between: ["B", "C"] }], inscribedAngles: [{ at: "C", between: ["A", "B"], label: "x°" }] }), passage: "In the circle, segment AB is a diameter and point C lies on the circle. What is the value of x?" },
  { name: "현과 수직 이등분", spec: C({ points: [{ id: "A", angle: 210 }, { id: "B", angle: 330 }], chords: [{ between: ["A", "B"], label: "16" }], radii: [{ to: "A", label: "10" }] }), passage: "In the circle with center O, chord AB = 16 and OA = 10. What is the distance from O to chord AB?" },
  { name: "접선과 반지름", spec: C({ points: [{ id: "T", angle: 40 }], radii: [{ to: "T", label: "5" }], tangents: [{ at: "T", external: "P", label: "12" }] }), passage: "Line PT is tangent to the circle at point T. OT = 5 and PT = 12. What is the length of OP?" },
  { name: "원주각 두 개(같은 호)", spec: C({ points: [{ id: "A", angle: 200 }, { id: "B", angle: 340 }, { id: "C", angle: 80 }, { id: "D", angle: 120 }], inscribedAngles: [{ at: "C", between: ["A", "B"], label: "35°" }, { at: "D", between: ["A", "B"], label: "y°" }] }), passage: "Points A, B, C, and D lie on the circle. If angle ACB is 35°, what is the value of y?" },
  { name: "호의 각(도)", spec: C({ points: [{ id: "M", angle: 30 }, { id: "N", angle: 100 }], arcs: [{ from: "M", to: "N", label: "70°" }], radii: [{ to: "M" }, { to: "N" }] }), passage: "In the circle with center O, arc MN measures 70°. What is the measure of angle MON?" },
  { name: "중심 없는 원(원주각만)", spec: C({ center: null, points: [{ id: "A", angle: 150 }, { id: "B", angle: 30 }, { id: "C", angle: 270 }], chords: [{ between: ["A", "C"] }, { between: ["B", "C"] }, { between: ["A", "B"] }], inscribedAngles: [{ at: "C", between: ["A", "B"], label: "50°" }] }), passage: "Points A, B, and C lie on the circle. Angle ACB measures 50°. What is the measure of arc AB?" },
  { name: "두 반지름·이등변", spec: C({ points: [{ id: "A", angle: 60 }, { id: "B", angle: 300 }], radii: [{ to: "A", label: "r" }, { to: "B", label: "r" }], chords: [{ between: ["A", "B"], label: "9" }], centralAngles: [{ between: ["A", "B"], label: "θ" }] }), passage: "In the circle with center O, OA = OB = r and chord AB = 9. Express cos θ in terms of r." },
  { name: "지름 위 원주각 + 길이", spec: C({ points: [{ id: "A", angle: 180 }, { id: "B", angle: 0 }, { id: "C", angle: 50 }], chords: [{ between: ["A", "B"], diameter: true, label: "10" }, { between: ["A", "C"], label: "6" }, { between: ["B", "C"], label: "x" }] }), passage: "AB = 10 is a diameter of the circle and AC = 6. What is the length of BC?" },
];

describe("템플릿 5 원 — 대표 문제 10개는 검증을 통과한다", () => {
  for (const s of SAMPLES) {
    it(s.name, () => {
      const r = renderCircle(s.spec);
      expect(r.issues).toEqual([]);
      for (const p of s.spec.points) expect(r.svg).toContain(`>${p.id}<`);
      expect(lintCircleAgainstText(s.spec, s.passage)).toEqual([]);
      expect(checkFigure(s.spec, s.passage).ok).toBe(true);
    });
  }
  it("표본 페이지를 남긴다(스크린샷용)", () => {
    if (!process.env.T5_SAMPLES_OUT) return;
    const cards = SAMPLES.map((s) => { const r = renderCircle(s.spec); return `<div class="card"><h3>${s.name}</h3>${r.svg}<p class="alt">${r.alt}</p><p class="iss">${r.issues.length ? r.issues.map((x) => x.message).join("<br>") : "검증 통과"}</p></div>`; });
    writeFileSync(process.env.T5_SAMPLES_OUT, `<!doctype html><meta charset="utf-8"><style>body{font-family:-apple-system,sans-serif;margin:0;padding:16px;background:#fff;color:#111}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:16px}.card{border:1.5px solid #ddd;border-radius:12px;padding:12px}.card h3{font-size:13px;margin:0 0 6px}.card svg{max-width:100%;height:auto;display:block}.alt{font-size:11px;color:#666;margin:6px 0 0}.iss{font-size:11px;color:#0a7;margin:4px 0 0}</style><h2 style="font-size:15px;margin:0 0 10px">템플릿 5 표준 렌더러 — 원 대표 10문항 (std-1)</h2><div class="grid">${cards.join("")}</div>`);
  });
});

describe("템플릿 5 원 — 거부", () => {
  it("지문의 점·현·지름·접선·각·길이가 데이터와 어긋나면 참조 불일치", () => {
    const spec = SAMPLES[0].spec;
    const msgs = lintCircleAgainstText(spec, "In the circle with center P, chord AC = 5 and AB is a diameter. Line tangent at B. Angle AOB is 100°.").map((i) => i.message).join("\n");
    expect(msgs).toContain("중심 'P'");
    expect(msgs).toContain("chord AC");
    expect(msgs).toContain("diameter AB");
    expect(msgs).toContain("접선");
    expect(msgs).toContain("100°");
  });
  it("지름인데 두 점의 각이 180° 차이가 아니면, 이름 중복·모르는 점은 스키마 거부", () => {
    expect(validateCircle(C({ points: [{ id: "A", angle: 0 }, { id: "B", angle: 100 }], chords: [{ between: ["A", "B"], diameter: true }] })).ok).toBe(false);
    expect(validateCircle(C({ points: [{ id: "A", angle: 0 }, { id: "A", angle: 90 }] })).ok).toBe(false);
    expect(validateCircle(C({ points: [{ id: "A", angle: 0 }], radii: [{ to: "Z" }] })).ok).toBe(false);
    expect(validateCircle(C({ points: [{ id: "O", angle: 0 }] })).ok).toBe(false);
  });
  it("직각으로 표시한 중심각이 90° 가 아니면 거부", () => {
    const r = renderCircle(C({ points: [{ id: "A", angle: 0 }, { id: "B", angle: 120 }], centralAngles: [{ between: ["A", "B"], right: true }] }));
    expect(r.issues.some((i) => i.code === "impossible")).toBe(true);
  });
});
