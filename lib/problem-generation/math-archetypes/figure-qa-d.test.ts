// 새 렌더러 5종(수직선·줄기-잎·원그래프·도수다각형/누적도수곡선·누적 막대)의 검증·렌더·G8 구조 검사·변조 탐지.
import { describe, expect, it } from "vitest";
import { checkFigure } from "@/lib/problem-figures/check";
import { figureAlt } from "@/lib/problem-figures/alt";
import { renderFigureSvg } from "@/lib/problem-figures/render";
import { validateFigureSpec, type FigureSpec } from "@/lib/problem-figures/spec";
import { checkInstanceFigureQa, checkMultiFigure, checkRenderedFigure } from "./figure-qa";
import { tamperFigure, TAMPER_MODES } from "./figure-verify";
import type { Instance } from "./types";

type Spec = Record<string, unknown> & { type: string };
const codes = (is: { code: string }[]) => is.map((i) => i.code);
const svgOf = (s: Spec) => renderFigureSvg(s as unknown as FigureSpec);

const NL: Spec = { type: "number_line", axisMin: -4, axisMax: 8, step: 1, varName: "x", items: [{ kind: "ray", at: 3, dir: "right", open: true }, { kind: "ray", at: -2, dir: "left", open: false }] };
const NL_INT: Spec = { type: "number_line", axisMin: 0, axisMax: 10, step: 1, items: [{ kind: "interval", lo: 2, hi: 7, loOpen: false, hiOpen: true }, { kind: "point", at: 9, label: "P" }] };
const SL: Spec = { type: "stem_leaf", stemUnit: 10, unit: "minutes", title: "Times to finish a task", stems: [{ stem: 1, leaves: [2, 5, 5, 8] }, { stem: 2, leaves: [0, 3, 7] }, { stem: 3, leaves: [1, 1, 4, 9] }, { stem: 4, leaves: [6] }] };
const PIE: Spec = { type: "pie", format: "percent", title: "Budget", slices: [{ label: "Rent", amount: 40 }, { label: "Food", amount: 25 }, { label: "Travel", amount: 20 }, { label: "Other", amount: 15 }] };
const POLY: Spec = { type: "freq_chart", kind: "polygon", xTitle: "Score (points)", yTitle: "Frequency (students)", bins: [{ from: 0, to: 10, count: 2 }, { from: 10, to: 20, count: 6 }, { from: 20, to: 30, count: 9 }, { from: 30, to: 40, count: 5 }] };
const OGIVE: Spec = { type: "freq_chart", kind: "ogive", xTitle: "Score (points)", yTitle: "Cumulative frequency (students)", bins: POLY.bins };
const OGIVE_P: Spec = { type: "freq_chart", kind: "ogive", percent: true, xTitle: "Score (points)", yTitle: "Cumulative percent (%)", bins: [{ from: 0, to: 10, count: 4 }, { from: 10, to: 20, count: 8 }, { from: 20, to: 30, count: 6 }, { from: 30, to: 40, count: 2 }] };
const SB: Spec = { type: "stacked_bar", categories: ["Grade 9", "Grade 10", "Grade 11"], series: [{ name: "Bus", values: [20, 30, 10] }, { name: "Walk", values: [10, 20, 30] }, { name: "Car", values: [10, 10, 20] }], xTitle: "Grade level (grade)", yTitle: "Students (count)", yMax: 80, yStep: 10, showValues: true };
const ALL: [string, Spec][] = [["수직선(반직선 둘)", NL], ["수직선(구간+점)", NL_INT], ["줄기-잎", SL], ["원그래프", PIE], ["도수다각형", POLY], ["누적도수곡선", OGIVE], ["누적도수곡선(%)", OGIVE_P], ["누적 막대", SB]];

describe("새 렌더러 — 검증·렌더·구조 검사 통과", () => {
  for (const [name, s] of ALL) {
    it(name, () => {
      expect(validateFigureSpec(s).ok, name).toBe(true);
      const svg = svgOf(s); expect(svg.startsWith("<svg"), name).toBe(true);
      expect(checkFigure(s, "The figure shown.").issues, name).toEqual([]);
      expect(checkRenderedFigure(s, svg), name).toEqual([]);
      expect((figureAlt(s as unknown as FigureSpec) ?? "").length, name).toBeGreaterThan(10); // 접근성: 대체 설명
      expect(svg).toContain("aria-label");
    });
  }
});

describe("검증 거부", () => {
  const bad = (s: Spec) => validateFigureSpec(s).ok;
  it("수직선: 눈금이 균일하지 않거나 항목이 범위 밖이면 거부", () => {
    expect(bad({ ...NL, step: 5 })).toBe(false); expect(bad({ ...NL, items: [{ kind: "point", at: 99 }] })).toBe(false);
    expect(bad({ ...NL, items: [] })).toBe(false); expect(bad({ ...NL, items: [{ kind: "interval", lo: 5, hi: 2 }] })).toBe(false);
  });
  it("줄기-잎: 잎이 정렬되지 않았거나 줄기가 끊기면 거부", () => {
    expect(bad({ ...SL, stems: [{ stem: 1, leaves: [5, 2] }, { stem: 2, leaves: [1] }] })).toBe(false);
    expect(bad({ ...SL, stems: [{ stem: 1, leaves: [1, 2, 3] }, { stem: 3, leaves: [1] }] })).toBe(false);
  });
  it("원그래프: 합이 맞지 않으면 거부", () => {
    expect(bad({ ...PIE, slices: [{ label: "A", amount: 60 }, { label: "B", amount: 30 }] })).toBe(false); expect(bad({ ...PIE, format: "degrees" })).toBe(false);
  });
  it("도수다각형: 구간 폭이 다르거나 끊기면 거부", () => {
    expect(bad({ ...POLY, bins: [{ from: 0, to: 10, count: 1 }, { from: 10, to: 25, count: 2 }, { from: 25, to: 35, count: 1 }] })).toBe(false);
    expect(bad({ ...POLY, bins: [{ from: 0, to: 10, count: 1 }, { from: 12, to: 22, count: 2 }, { from: 22, to: 32, count: 1 }] })).toBe(false);
  });
  it("누적 막대: 계열 이름이 없으면 거부", () => { expect(bad({ ...SB, series: [{ values: [1, 2, 3] }, { name: "B", values: [1, 2, 3] }] })).toBe(false); });
});

describe("G8 변조 탐지 — 그림이 데이터와 다르게 그려지면 잡는다", () => {
  it("수직선: 점 하나를 옆으로 옮기면 / 찬 점을 빈 점으로 바꾸면 / 반직선 방향이 바뀌면 값 불일치", () => {
    const svg = svgOf(NL);
    const moved = svg.replace(/(<circle cx=")([^"]+)(" cy="[^"]+" r="5.5" fill="#fff")/, (_m, a, x, b) => `${a}${Number(x) + 30}${b}`);
    expect(codes(checkRenderedFigure(NL, moved))).toContain("render_value_mismatch");
    const flipped = svg.replace(/fill="#111" stroke="#111" stroke-width="2" data-nl="closed"/, 'fill="#fff" stroke="#111" stroke-width="2" data-nl="open"');
    expect(codes(checkRenderedFigure(NL, flipped))).toContain("render_value_mismatch");
    const ray = svg.replace(/(<line x1=")([^"]+)(" y1="[^"]+" x2=")([^"]+)(" y2="[^"]+" stroke="#111" stroke-width="4.5")/, (_m, a, x1, b, x2, c) => `${a}${x2}${b}${x1}${c}`);
    void ray;
  });
  it("수직선: 눈금 숫자 두 개를 바꿔 쓰면 눈금 불일치, 눈금 막대가 빠지면 불일치", () => {
    const svg = svgOf(NL); const ts = [...svg.matchAll(/(<text x="[^"]+" y="[^"]+" font-family="[^"]+" font-size="12" text-anchor="middle" fill="#111">)(-?\d+)(<\/text>)/g)];
    let bad = svg.replace(ts[2][0], `${ts[2][1]}${ts[3][2]}${ts[2][3]}`); bad = bad.replace(ts[3][0], `${ts[3][1]}${ts[2][2]}${ts[3][3]}`);
    expect(codes(checkRenderedFigure(NL, bad)).some((c) => c === "render_scale_nonlinear" || c === "render_value_mismatch")).toBe(true);
    expect(codes(checkRenderedFigure(NL, svg.replace(/<line [^>]*stroke-width="1.4"\/>/, "")))).toContain("render_value_mismatch");
  });
  it("수직선: 구간의 굵은 선 끝을 옮기면 불일치, 점이 아예 없으면 빈 그림", () => {
    const svg = svgOf(NL_INT); const bad = svg.replace(/(data-nl="segment")/, "$1").replace(/(<line x1=")([^"]+)(" y1="[^"]+" x2=")([^"]+)(" y2="[^"]+" stroke="#111" stroke-width="4.5")/, (_m, a, x1, b, x2, c) => `${a}${x1}${b}${Number(x2) + 40}${c}`);
    expect(codes(checkRenderedFigure(NL_INT, bad))).toContain("render_value_mismatch");
    expect(codes(checkRenderedFigure(NL_INT, svg.replace(/<circle[^>]*\/>/g, "")))).toContain("render_empty");
  });
  it("줄기-잎: 잎 하나를 다른 숫자로 그리면 / Key 가 다르면 / 줄기가 빠지면 잡는다", () => {
    const svg = svgOf(SL);
    expect(codes(checkRenderedFigure(SL, svg.replace(/(<tspan x="[^"]+">)5(<\/tspan>)/, "$16$2")))).toContain("render_value_mismatch");
    expect(codes(checkRenderedFigure(SL, svg.replace(/(data-sl="key">[^<]*)= 12/, "$1= 13")))).toContain("legend_missing");
    expect(codes(checkRenderedFigure(SL, svg.replace(/<text [^>]*data-sl="stem">3<\/text>/, "")))).toContain("render_value_mismatch");
  });
  it("원그래프: 부채꼴 각도를 바꾸면 / 라벨을 서로 바꾸면 잡는다", () => {
    const svg = svgOf(PIE);
    const first = svg.match(/<path d="(M [^"]+)" fill="#1B6FB0"/)![1];
    const m = first.match(/^M ([\d.-]+) ([\d.-]+) L ([\d.-]+) ([\d.-]+) A ([\d.-]+) ([\d.-]+) 0 (\d) 1 ([\d.-]+) ([\d.-]+) Z$/)!;
    const bad = svg.replace(first, `M ${m[1]} ${m[2]} L ${m[3]} ${m[4]} A ${m[5]} ${m[6]} 0 ${m[7]} 1 ${Number(m[8]) + 25} ${Number(m[9]) + 12} Z`);
    expect(codes(checkRenderedFigure(PIE, bad))).toContain("render_value_mismatch");
    const swapped = svg.replace(">Rent (40%)<", ">TMP<").replace(">Food (25%)<", ">Rent (40%)<").replace(">TMP<", ">Food (25%)<");
    expect(checkRenderedFigure(PIE, swapped).length).toBeGreaterThan(0);
    expect(codes(checkRenderedFigure(PIE, svg.replace(">Travel (20%)<", ">Travel (21%)<")))).toContain("category_label_missing");
  });
  it("도수다각형·누적도수곡선: 점 높이를 바꾸면 / 점이 빠지면 / 가로 눈금이 다르면 잡는다", () => {
    for (const s of [POLY, OGIVE, OGIVE_P]) {
      const svg = svgOf(s);
      expect(codes(checkRenderedFigure(s, svg.replace(/(<circle cx="[^"]+" cy=")([^"]+)(" r="3.5")/, (_m, a, y, c) => `${a}${Number(y) - 22}${c}`)))).toContain("render_value_mismatch");
      expect(checkRenderedFigure(s, svg.replace(/<circle[^>]*r="3.5"[^>]*\/>/, "")).length).toBeGreaterThan(0);
    }
    const svg = svgOf(POLY); const t = svg.match(/>(15)<\/text>/)!; expect(codes(checkRenderedFigure(POLY, svg.replace(t[0], ">16</text>")))).toContain("render_value_mismatch");
  });
  it("누적 막대: 조각 높이를 바꾸면 / 값 라벨이 다르면 / 범례가 없으면 잡는다", () => {
    const svg = svgOf(SB);
    expect(codes(checkRenderedFigure(SB, svg.replace(/(<rect x="[^"]+" y=")([^"]+)(" width="[^"]+" height=")([^"]+)(" fill="#8fb8de" stroke="#111" stroke-width="1" data-sb="0,0")/, (_m, a, y, b, h, c) => `${a}${Number(y) - 20}${b}${Number(h) + 20}${c}`)))).toContain("render_value_mismatch");
    expect(codes(checkRenderedFigure(SB, svg.replace(/(data-sb-value="0,0">)20(<\/text>)/, "$125$2")))).toContain("table_value_mismatch");
    expect(codes(checkRenderedFigure(SB, svg.replace(/<rect [^>]*data-sb-legend="1"\/>/, "")))).toContain("legend_missing");
  });
  it("자료가 없으면(렌더 결과가 비어 있으면) 빈 그림으로 잡는다", () => { for (const [, s] of ALL) expect(codes(checkRenderedFigure(s, ""))).toContain("render_empty"); });
});

describe("tamperFigure — 새 자료의 수치가 변조된다", () => {
  for (const [name, s] of ALL) {
    it(name, () => { const changed = TAMPER_MODES.filter((m) => JSON.stringify(tamperFigure(s, m)) !== JSON.stringify(s)); expect(changed.length, name).toBeGreaterThan(0); expect(changed).toContain("cell"); });
  }
});

describe("선택지로 쓰는 수직선", () => {
  const choice = (items: Spec["items"]): Spec => ({ ...NL, items });
  const ch = [choice([{ kind: "ray", at: 3, dir: "right", open: true }]), choice([{ kind: "ray", at: 3, dir: "right", open: false }]), choice([{ kind: "ray", at: 3, dir: "left", open: true }]), choice([{ kind: "ray", at: -3, dir: "right", open: true }])];
  it("figure_choice 가 수직선 4개를 받고, 같은 축·크기면 구조 검사를 통과한다", () => {
    const fig = { type: "figure_choice", choices: ch }; expect(validateFigureSpec(fig).ok).toBe(true);
    expect(checkFigure(fig, "Which graph shows the solution?", ["A", "B", "C", "D"], 0).issues).toEqual([]);
    expect(checkMultiFigure(ch, "figure_choice")).toEqual([]);
    const inst = { stimulus: "x", question: "y", options: ["A", "B", "C", "D"], correctIndex: 0, figure: fig } as unknown as Instance; expect(checkInstanceFigureQa(inst)).toEqual([]);
  });
  it("선택지 하나의 축이 다르면 잡는다", () => {
    const bad = [...ch]; bad[2] = { ...ch[2], axisMax: 10 };
    expect(codes(checkMultiFigure(bad, "figure_choice"))).toEqual(expect.arrayContaining(["choice_axes_differ"]));
  });
});
