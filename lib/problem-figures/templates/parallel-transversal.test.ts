import { describe, expect, it } from "vitest";
import { checkFigure } from "../check";
import { renderFigureSvg } from "../render";
import { validateFigureSpec } from "../spec";
import {
  lintParallelTransversalAgainstText,
  renderParallelTransversal,
  validateParallelTransversal,
  type ParallelTransversalSpec,
} from "./parallel-transversal";

// 표준 렌더링 엔진 템플릿 1 — 대표 문제 10개는 **문제 없이** 그려져야 하고, 참조 불일치·중복·충돌·잘림은 거부돼야 한다.

const base = (over: Partial<ParallelTransversalSpec> = {}): ParallelTransversalSpec => ({
  type: "parallel_transversal",
  parallel: ["m", "n"],
  transversals: [{ id: "k" }],
  angles: [{ at: ["m", "k"], region: "NW", label: "x°" }, { at: ["n", "k"], region: "SE", label: "37°" }],
  notToScale: true,
  ...over,
});

const SAMPLES: { name: string; spec: ParallelTransversalSpec; passage: string }[] = [
  { name: "대응각 x/37", spec: base(), passage: "In the figure, lines m and n are parallel and line k is a transversal. If one angle measures 37°, what is the value of x?" },
  { name: "엇각", spec: base({ angles: [{ at: ["m", "k"], region: "SW", label: "x°" }, { at: ["n", "k"], region: "NE", label: "118°" }] }), passage: "Lines m and n are parallel. What is the value of x if the marked angle is 118°?" },
  { name: "동측내각", spec: base({ angles: [{ at: ["m", "k"], region: "SE", label: "(2x + 10)°" }, { at: ["n", "k"], region: "NE", label: "110°" }] }), passage: "Lines m and n are parallel. One angle is (2x + 10)° and another is 110°." },
  { name: "교점 이름 A/B", spec: base({ points: [{ id: "A", on: ["m", "k"] }, { id: "B", on: ["n", "k"] }], angles: [{ at: ["m", "k"], region: "NE", label: "y°" }, { at: ["n", "k"], region: "SW", label: "65°" }] }), passage: "Transversal k intersects line m at point A and line n at point B. The angle at B is 65°. Find y." },
  { name: "왼쪽 기울기", spec: base({ transversals: [{ id: "t", slant: "left" }], angles: [{ at: ["m", "t"], region: "NE", label: "x°" }, { at: ["n", "t"], region: "SW", label: "52°" }] }), passage: "Lines m and n are parallel, and t is a transversal. If the angle is 52°, find x." },
  { name: "ℓ 표기", spec: base({ parallel: ["ℓ", "m"], transversals: [{ id: "p" }], angles: [{ at: ["ℓ", "p"], region: "NW", label: "a°" }, { at: ["m", "p"], region: "SE", label: "b°" }] }), passage: "Lines ℓ and m are parallel. Angles a° and b° are marked." },
  { name: "각 3개", spec: base({ angles: [{ at: ["m", "k"], region: "NW", label: "x°" }, { at: ["m", "k"], region: "SE", label: "y°" }, { at: ["n", "k"], region: "NE", label: "40°" }] }), passage: "Lines m and n are parallel. If the angle is 40°, what are x and y?" },
  { name: "횡단선 2개", spec: base({ transversals: [{ id: "k" }, { id: "j" }], angles: [{ at: ["m", "k"], region: "NW", label: "x°" }, { at: ["n", "j"], region: "SE", label: "45°" }] }), passage: "Lines m and n are parallel; k and j are transversals. One angle is 45°. Find x." },
  { name: "네 각 중 하나만", spec: base({ angles: [{ at: ["n", "k"], region: "SW", label: "125°" }] }), passage: "Lines m and n are parallel. The marked angle is 125°. What is the measure of its corresponding angle?" },
  { name: "비율 표기 없이", spec: base({ notToScale: false, angles: [{ at: ["m", "k"], region: "NE", label: "z°" }, { at: ["n", "k"], region: "SW", label: "z°" }] }), passage: "Lines m and n are parallel. Both marked angles are z°." },
];

describe("템플릿 1 — 대표 문제 10개는 검증을 통과하고 라벨이 모두 그려진다", () => {
  for (const s of SAMPLES) {
    it(s.name, () => {
      const r = renderParallelTransversal(s.spec);
      expect(r.issues).toEqual([]);
      for (const a of s.spec.angles) if (a.label) expect(r.svg).toContain(a.label.replace(/</g, "&lt;"));
      for (const l of [...s.spec.parallel, ...s.spec.transversals.map((t) => t.id)]) expect(r.svg).toContain(`>${l}<`);
      expect(r.svg).toContain('role="img"');
      expect(r.alt).toContain("평행선");
      expect(r.svg.includes("Figure not drawn to scale")).toBe(Boolean(s.spec.notToScale));
      // 지문 참조도 맞다.
      expect(lintParallelTransversalAgainstText(s.spec, s.passage)).toEqual([]);
      expect(checkFigure(s.spec, s.passage).ok).toBe(true);
    });
  }
});

describe("템플릿 1 — 거부", () => {
  it("지문의 선·점·각이 데이터에 없으면 참조 불일치", () => {
    const issues = lintParallelTransversalAgainstText(base(), "Lines m and q are parallel. Transversal k meets m at point C. The angle at C is 118°.");
    expect(issues.map((i) => i.code)).toEqual(expect.arrayContaining(["ref_missing"]));
    expect(issues.some((i) => i.message.includes("'q'"))).toBe(true);
    expect(issues.some((i) => i.message.includes("'C'"))).toBe(true);
    expect(issues.some((i) => i.message.includes("118°"))).toBe(true);
  });

  it("지문에 방위·사분면 표현이 새면 거부한다(AI 가 배치 용어를 문제에 쓴 실례, 2026-09-14)", () => {
    const issues = lintParallelTransversalAgainstText(base(), "Lines m and n are parallel. The angle at the northeast region measures 37°. Find x.");
    expect(issues.some((i) => i.code === "wording")).toBe(true);
  });

  it("같은 교점·같은 사분면에 각 2개, 점 이름 중복은 거부", () => {
    const r = renderParallelTransversal(base({
      points: [{ id: "A", on: ["m", "k"] }, { id: "A", on: ["n", "k"] }],
      angles: [{ at: ["m", "k"], region: "NW", label: "x°" }, { at: ["m", "k"], region: "NW", label: "y°" }],
    }));
    const codes = r.issues.map((i) => i.code);
    expect(codes).toContain("duplicate_angle");
    expect(codes).toContain("duplicate_label");
    expect(codes).toContain("label_collision");
  });

  it("너무 긴 라벨은 겹침·잘림으로 잡힌다", () => {
    const r = renderParallelTransversal(base({ angles: [{ at: ["n", "k"], region: "SE", label: "(12x − 345 + 678)° and more" }] }));
    expect(r.issues.some((i) => i.code === "label_collision" || i.code === "clipped")).toBe(true);
  });

  it("직각은 이 템플릿에서 만들 수 없다(평행선과 횡단선은 55°)", () => {
    const r = renderParallelTransversal(base({ angles: [{ at: ["m", "k"], region: "NE", right: true }] }));
    expect(r.issues.some((i) => i.code === "impossible")).toBe(true);
  });

  it("스키마: 평행선 3개·횡단선 3개·모르는 선 참조는 거부", () => {
    expect(validateParallelTransversal({ type: "parallel_transversal", parallel: ["a", "b", "c"], transversals: [{ id: "k" }], angles: [] }).ok).toBe(false);
    expect(validateParallelTransversal({ ...base(), transversals: [{ id: "a" }, { id: "b" }, { id: "c" }] }).ok).toBe(false);
    expect(validateParallelTransversal({ ...base(), angles: [{ at: ["m", "z"], region: "NE", label: "x°" }] }).ok).toBe(false);
    expect(validateFigureSpec(base()).ok).toBe(true);
    expect(renderFigureSvg(base())).toContain("<svg");
  });
});

describe("검증 계층 checkFigure", () => {
  it("좌표형 geometry 는 재생성 필요, 올린 그림은 alt 필수, 지문이 그림을 요구하면 그림 없음도 거부", () => {
    const legacy = checkFigure({ type: "geometry", shapes: [{ kind: "segment", from: [0, 0], to: [1, 1] }] }, "x");
    expect(legacy.ok).toBe(false);
    expect(legacy.issues[0].code).toBe("legacy");
    expect(checkFigure({ type: "image", bucket: "problem-assets", path: "p/1.png" }, "x").issues[0].code).toBe("alt_required");
    expect(checkFigure({ type: "image", bucket: "problem-assets", path: "p/1.png", alt: "삼각형 ABC" }, "x").ok).toBe(true);
    expect(checkFigure(null, "In the figure shown, what is x?").issues[0].code).toBe("figure_required");
    expect(checkFigure(null, "What is 2 + 2?").ok).toBe(true);
  });
});

describe("옛 각 표기 정규화(2026-09-15)", () => {
  it("{line, quadrant, text, at:'A'} 를 points 로 풀어 표준 모양으로 옮긴다", () => {
    const v = validateParallelTransversal({
      type: "parallel_transversal", parallel: ["m", "n"], transversals: [{ id: "k" }],
      points: [{ id: "A", on: ["m", "k"] }, { id: "B", on: ["n", "k"] }],
      angles: [{ line: "k", quadrant: "SE", text: "(3x + 10)°", at: "A" }, { line: "k", quadrant: "NE", text: "(5x - 30)°", at: "B" }],
      notToScale: true,
    });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.spec.angles).toEqual([{ at: ["m", "k"], region: "SE", label: "(3x + 10)°" }, { at: ["n", "k"], region: "NE", label: "(5x - 30)°" }]);
  });
});

describe("점 정규화(2026-09-15)", () => {
  it("교점이 아닌 점은 빼고, 선 3개에 걸친 점은 평행선+첫 횡단선으로 줄인다", () => {
    const v = validateParallelTransversal({
      type: "parallel_transversal", parallel: ["m", "n"], transversals: [{ id: "k" }, { id: "AC" }],
      points: [{ id: "A", on: ["m", "k", "AC"] }, { id: "B", on: ["n", "k"] }, { id: "C", on: ["n"] }],
      angles: [{ at: ["m", "AC"], region: "NE", label: "128°" }, { at: ["n", "AC"], region: "SW", label: "x°" }],
    });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.spec.points).toEqual([{ id: "A", on: ["m", "k"] }, { id: "B", on: ["n", "k"] }]);
  });
});

describe("횡단선끼리의 교점·삼각형(2026-09-15 확장)", () => {
  const below = {
    type: "parallel_transversal", parallel: ["m", "n"], transversals: [{ id: "k" }, { id: "j" }],
    points: [{ id: "A", on: ["m", "k"] }, { id: "B", on: ["n", "k"] }, { id: "C", on: ["m", "j"] }, { id: "D", on: ["n", "j"] }, { id: "E", on: ["k", "j"] }],
    angles: [{ at: ["m", "k"], region: "SE", label: "128°" }, { at: ["k", "j"], region: "N", label: "x°" }, { at: ["n", "j"], region: "SW", label: "70°" }],
    notToScale: true,
  };
  it("교점 E 와 삼각형 안의 각을 그리고, 지문의 점 E·삼각형 참조가 통과한다", () => {
    const r = checkFigure(below, "In the figure, lines m and n are parallel. Line k intersects m at point A and n at point B; line j intersects m at point C and n at point D. Lines k and j meet at point E below line n, forming triangle BDE. The angle marked 128° is at A and the angle at D is 70°. What is the value of x?");
    expect(r.issues).toEqual([]);
    expect(r.alt).toMatch(/두 횡단선은 n 아래에서 만난다/);
    expect(renderFigureSvg(below as never)).toContain("<svg");
  });
  it("위에서 만나는 경우도 그린다(crossing above)", () => {
    const above = { ...below, crossing: { side: "above" }, angles: [{ at: ["k", "j"], region: "N", label: "y°" }, { at: ["n", "k"], region: "NE", label: "35°" }, { at: ["m", "j"], region: "NW", label: "(2y)°" }] };
    expect(checkFigure(above, "Lines m and n are parallel; lines k and j meet at point E above line m. What is y?").issues).toEqual([]);
  });
  it("횡단선이 하나면 crossing 을 거부하고, 교점 각의 region 은 N|S|E|W 여야 한다", () => {
    expect(validateParallelTransversal({ ...below, transversals: [{ id: "k" }], points: [], angles: [], crossing: { side: "below" } }).ok).toBe(false);
    expect(validateParallelTransversal({ ...below, angles: [{ at: ["k", "j"], region: "NE", label: "x°" }] }).ok).toBe(false);
  });
});

describe("수직 횡단선·직각 표시(2026-09-15)", () => {
  const spec = {
    type: "parallel_transversal", parallel: ["m", "n"], transversals: [{ id: "k", perpendicular: true }, { id: "j" }],
    points: [{ id: "A", on: ["m", "k"] }, { id: "B", on: ["n", "k"] }, { id: "C", on: ["n", "j"] }],
    angles: [{ at: ["m", "k"], region: "NE", right: true }, { at: ["n", "j"], region: "NE", label: "x°" }, { at: ["m", "j"], region: "SW", label: "48°" }],
    notToScale: true,
  };
  it("수직 횡단선을 그리고 그 교점의 직각 표시가 통과한다; 지문의 perpendicular 참조도 맞는다", () => {
    const r = checkFigure(spec, "In the figure, lines m and n are parallel. Line k is perpendicular to line m at point A and meets line n at point B. Line j meets n at point C. The angle marked 48° … What is the value of x?");
    expect(r.issues).toEqual([]);
    expect(r.alt).toMatch(/k\(수직\)/);
  });
  it("기울어진 횡단선에 직각 표시를 두면 거부하고, 지문이 perpendicular 인데 수직 횡단선이 없으면 불일치", () => {
    const slanted = { ...spec, transversals: [{ id: "k" }, { id: "j" }] };
    expect(checkFigure(slanted, "Lines m and n are parallel. What is x?").issues.some((i) => i.code === "impossible")).toBe(true);
    expect(checkFigure({ ...slanted, angles: [{ at: ["n", "j"], region: "NE", label: "x°" }] }, "Line k is perpendicular to m. What is x?").issues.some((i) => i.code === "ref_mismatch")).toBe(true);
  });
  it("slant:'vertical' 옛 표기는 perpendicular 로 읽고, 수직 횡단선 둘은 거부", () => {
    const v = validateParallelTransversal({ ...spec, transversals: [{ id: "k", slant: "vertical" }, { id: "j" }] });
    expect(v.ok && v.spec.transversals[0].perpendicular).toBe(true);
    expect(validateParallelTransversal({ ...spec, transversals: [{ id: "k", perpendicular: true }, { id: "j", perpendicular: true }] }).ok).toBe(false);
  });
});
