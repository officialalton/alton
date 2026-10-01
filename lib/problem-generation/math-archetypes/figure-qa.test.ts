// 시각 검수의 구조 검사 — (1) 파일럿 15항목의 실제 생성물이 전부 통과하고 (2) 오너가 든 네 가지 결함을 일부러 만들면 각각 잡힌다(돌연변이).
import { describe, expect, it } from "vitest";
import { figureArchetypes } from "./figure-coverage-gate";
import { generateOne } from "./sweep";
import { checkChoiceInstance } from "./figure-verify";
import { checkChoiceDistinct, checkInstanceFigureQa, checkMultiFigure, checkRenderedFigure, readScale } from "./figure-qa";
import { renderFigureSvg } from "@/lib/problem-figures/render";
import type { FigureSpec } from "@/lib/problem-figures/spec";
import type { Instance } from "./types";

const A = figureArchetypes(); const find = (id: string) => A.find((a) => a.id === id)!;
const inst = (id: string, seed = 3): Instance => { for (let s = seed; s < seed + 60; s++) { const g = generateOne(find(id), s); if (g.ok) return g.inst; } throw new Error(id); };
const codes = (is: { code: string }[]) => is.map((i) => i.code);
type Spec = Record<string, unknown> & { type: string };

describe("구조 검사: 파일럿 15항목의 실제 생성물은 전부 통과한다", () => {
  it("모든 원형(hard·easy/medium) × 시드 12개 — 자료 존재·값 충실도·축·단위·라벨·복수 그림 일관성·선택지 구별", () => {
    const bad: string[] = []; let n = 0;
    for (const a of A) for (let s = 0; s < 12; s++) { const g = generateOne(a, s); if (!g.ok) continue; n++; const q = checkInstanceFigureQa(g.inst); if (q.length) bad.push(`${a.id}#${s}: ${q.map((x) => `${x.code} ${x.message}`).join(" | ").slice(0, 200)}`); }
    expect(n).toBeGreaterThan(900); expect(bad.slice(0, 5)).toEqual([]);
  }, 120_000);
});

describe("오너 결함 (a) 길이·값 대비 그림 비율 불일치 — 그림이 데이터와 다른 비율로 그려지면 잡는다", () => {
  const i = inst("tvd.scatter_equation.SC.P.inverse"); const spec = i.figure as Spec; const svg = renderFigureSvg(spec as unknown as FigureSpec);
  const base = (() => { const s = readScale(svg); return (0 - s.y!.b) / s.y!.a; })();
  it("원본은 통과", () => expect(checkRenderedFigure(spec, svg)).toEqual([]));
  it("점의 높이를 25% 늘려 그리면(축 눈금은 그대로) 값 불일치", () => {
    const bad = svg.replace(/<circle cx="([^"]+)" cy="([^"]+)" r="3.5"/g, (_m, cx, cy) => `<circle cx="${cx}" cy="${base + (Number(cy) - base) * 1.25}" r="3.5"`);
    expect(codes(checkRenderedFigure(spec, bad))).toContain("render_value_mismatch");
  });
  it("추세선의 기울기를 바꿔 그리면 추세선 불일치", () => {
    const bad = svg.replace(/(<polyline points=")([^"]+)(" fill="none" stroke="#C8102E")/, (_m, a, pts, c) => { const p = pts.split(" ").map((q: string) => q.split(",").map(Number)); p[p.length - 1][1] += 40; return `${a}${p.map((q: number[]) => q.join(",")).join(" ")}${c}`; });
    expect(codes(checkRenderedFigure(spec, bad))).toContain("fitline_mismatch");
  });
  it("선그래프의 값 하나를 다른 높이로 그리면 값 불일치", () => {
    const li = inst("tvd.scatter_equation.LG.P.inverse"); const lspec = li.figure as Spec; const lsvg = renderFigureSvg(lspec as unknown as FigureSpec);
    const bad = lsvg.replace(/(<circle cx="[^"]+" cy=")([^"]+)(" r="3.5")/, (_m, a, cy, c) => `${a}${Number(cy) - 25}${c}`);
    expect(codes(checkRenderedFigure(lspec, lsvg))).toEqual([]); expect(codes(checkRenderedFigure(lspec, bad))).toContain("render_value_mismatch");
  });
  it("표 칸 숫자를 다른 값으로 그리면 표 값 불일치", () => {
    const ti = inst("tvd.cell.TW.P.easy_read_cell"); const tspec = ti.figure as Spec; const html = renderFigureSvg(tspec as unknown as FigureSpec);
    const first = (tspec.cells as number[][])[0][0]; const bad = html.replace(new RegExp(`>${first}</td>`), `>${first + 1}</td>`);
    expect(codes(checkRenderedFigure(tspec, html))).toEqual([]); expect(codes(checkRenderedFigure(tspec, bad))).toContain("table_value_mismatch");
  });
});

describe("오너 결함 (b) 길이·값 표시 숫자의 위치 불일치 — 숫자가 제 격자선·제 자리에서 벗어나면 잡는다", () => {
  const i = inst("tvd.scatter_predict.SC.P.chain2"); const spec = i.figure as Spec; const svg = renderFigureSvg(spec as unknown as FigureSpec);
  it("세로축 눈금 숫자 하나를 아래로 18px 옮기면 격자선과 어긋남", () => {
    const bad = svg.replace(/(<text x="[^"]+" y=")([^"]+)("[^>]*text-anchor="end"[^>]*>)(\d+)(<\/text>)/, (_m, a, y, b, v, e) => `${a}${Number(y) + 18}${b}${v}${e}`);
    expect(codes(checkRenderedFigure(spec, bad))).toContain("label_misaligned");
  });
  it("눈금 숫자 두 개를 서로 바꿔 쓰면 눈금 간격이 일정하지 않다고 잡는다", () => {
    const ys = [...svg.matchAll(/(<text x="[^"]+" y="[^"]+"[^>]*text-anchor="end"[^>]*>)(\d+)(<\/text>)/g)];
    const a = ys[1], b = ys[2]; let bad = svg.replace(a[0], `${a[1]}${b[2]}${a[3]}`); bad = bad.replace(b[0], `${b[1]}${a[2]}${b[3]}`);
    expect(codes(checkRenderedFigure(spec, bad)).some((c) => c === "render_scale_nonlinear" || c === "render_value_mismatch")).toBe(true);
  });
  it("글자가 겹치면(눈금 숫자 위에 축 제목) 잡는다", () => {
    const bad = svg.replace(/(<text x=")([^"]+)(" y=")([^"]+)("[^>]*text-anchor="middle"[^>]*fill="#111">)([A-Z][^<]*\([^<]+\))(<\/text>)/, (_m, a, x, b, _y, c, t, e) => `${a}${x}${b}${Number(svg.match(/<text x="[^"]+" y="([^"]+)"[^>]*text-anchor="middle"[^>]*>\d+<\/text>/)![1])}${c}${t}${e}`);
    expect(codes(checkRenderedFigure(spec, bad))).toContain("label_overlap");
  });
  it("축 제목에 단위가 없으면 잡는다", () => {
    const bad = { ...spec, yTitle: "Exam score" }; expect(codes(checkRenderedFigure(bad, svg))).toContain("unit_missing_in_title");
  });
});

describe("오너 결함 (c) 복수 자료에서 두 그림 간 숫자·비율 불일치", () => {
  const set = inst("tvd.association_direction_strength.SC.P.compare_scenarios"); const fset = set.figure as { figures: { spec: Spec }[] };
  it("원본 figure_set 은 같은 축척이라 통과", () => expect(checkInstanceFigureQa(set)).toEqual([]));
  it("Plot B 의 세로축 범위·눈금을 두 배로 하면(같은 단위인데 축척이 다름) 잡는다", () => {
    const b = { ...fset.figures[1].spec, yMax: 200, yStep: 40 }; expect(codes(checkMultiFigure([fset.figures[0].spec, b], "figure_set"))).toContain("scale_mismatch_between_figures");
  });
  it("선택지 그래프 하나의 축 범위가 다르면 잡는다", () => {
    const c = inst("tvd.scatter_equation.SC.C.repr_shift"); const ch = JSON.parse(JSON.stringify((c.figure as { choices: Spec[] }).choices)) as { axes: { y: { max: number; step: number } } }[]; ch[2].axes.y = { ...ch[2].axes.y, max: ch[2].axes.y.max * 2, step: ch[2].axes.y.step * 2 };
    expect(codes(checkMultiFigure(ch as unknown as Spec[], "figure_choice"))).toContain("choice_axes_differ");
  });
  it("선택지 그림의 축 제목(단위)이 하나만 다르면 잡는다", () => {
    const c = inst("tvd.scatter_count_above.SC.C.constraint_select"); const ch = JSON.parse(JSON.stringify((c.figure as { choices: Spec[] }).choices)) as { axes: { y: { title: string } } }[]; ch[1].axes.y.title = "Speed (miles per hour)";
    expect(codes(checkMultiFigure(ch as unknown as Spec[], "figure_choice"))).toContain("choice_axes_differ");
  });
  it("표 선택지는 열 이름이 하나만 달라도 렌더가 다르므로(내용 비교는 verify) 구조 검사는 통과하되 값 충실도는 각각 확인한다", () => {
    const c = inst("tvd.conditional_share.TW.C.inverse"); expect(checkInstanceFigureQa(c)).toEqual([]);
  });
});

describe("오너 결함 (d) 자료가 아예 없음", () => {
  it("지문이 그림을 가리키는데 figure 가 없으면 잡는다", () => { const i = inst("tvd.scatter_equation.SC.P.inverse"); expect(codes(checkInstanceFigureQa({ ...i, figure: null }))).toContain("figure_missing"); expect(codes(checkInstanceFigureQa({ ...i, figure: undefined }))).toContain("figure_missing"); });
  it("그림은 있지만 렌더 결과가 비어 있으면(점이 하나도 없는 SVG) 잡는다", () => {
    const i = inst("tvd.scatter_equation.SC.P.inverse"); const spec = i.figure as Spec; const svg = renderFigureSvg(spec as unknown as FigureSpec); const bad = svg.replace(/<circle[^>]*\/>/g, "");
    expect(codes(checkRenderedFigure(spec, bad))).toContain("render_empty"); expect(codes(checkRenderedFigure(spec, ""))).toContain("render_empty");
  });
  it("표가 비어 있으면(칸 값이 하나도 없는 HTML) 잡는다", () => { const i = inst("tvd.cell.TW.P.easy_read_cell"); expect(codes(checkRenderedFigure(i.figure as Spec, "<div class=\"figure-table\"><table></table></div>".padEnd(80, " ")))).toContain("table_value_mismatch"); });
});

describe("선택지형: 오답 그림은 정답과 구별되고 '정확히 하나의 규칙'만 어긴다", () => {
  const id = "tvd.scatter_equation.SC.C.repr_shift";
  it("원본: 서로 눈으로 구별되고 규칙 진단이 선언과 같다", () => { const c = inst(id); expect(checkChoiceDistinct((c.figure as { choices: Spec[] }).choices)).toEqual([]); expect(checkChoiceInstance(c, c.correctIndex)).toEqual([]); });
  it("두 오답이 같은 점·거의 같은 추세선이면(눈으로 구별 불가) 잡는다", () => {
    const c = inst(id); const ch = JSON.parse(JSON.stringify((c.figure as { choices: { objects: { points: number[][]; fitLine: { slope: number; intercept: number } }[] }[] }).choices)); const w = [0, 1, 2, 3].filter((k) => k !== c.correctIndex);
    ch[w[1]].objects[0] = { ...ch[w[0]].objects[0], fitLine: { ...ch[w[0]].objects[0].fitLine, intercept: ch[w[0]].objects[0].fitLine.intercept + 0.5 } };
    expect(codes(checkChoiceDistinct(ch))).toContain("choice_indistinct");
  });
  it("오답이 규칙 둘을 동시에 어기면(기울기 부호 반전 + 절편 이동) 진단이 선언과 어긋나 잡는다", () => {
    const c = inst(id); const fig = c.figure as { choices: { objects: { fitLine: { slope: number; intercept: number } }[] }[] }; const ch = JSON.parse(JSON.stringify(fig.choices)); const w = [0, 1, 2, 3].filter((k) => k !== c.correctIndex)[0];
    const ok = ch[c.correctIndex].objects[0].fitLine; ch[w].objects[0].fitLine = { slope: -ok.slope, intercept: ok.intercept + 10 * (ok.intercept > 40 ? -1 : 1) };
    const bad = { ...c, figure: { ...fig, choices: ch }, verificationJs: c.verificationJs.replace(/^const CHOICES = .*;$/m, `const CHOICES = ${JSON.stringify(ch)};`) };
    expect(checkChoiceInstance(bad, c.correctIndex).join("|")).toMatch(/진단은|같은 그림/);
  });
});
