// 시각 검수의 구조 검사 — (1) 파일럿 15항목의 실제 생성물이 전부 통과하고 (2) 오너가 든 네 가지 결함을 일부러 만들면 각각 잡힌다(돌연변이).
import { describe, expect, it } from "vitest";
import { figureArchetypes } from "./figure-coverage-gate";
import { generateOne } from "./sweep";
import { checkChoiceInstance, tamperFigure } from "./figure-verify";
import { mutantsOf } from "./figure-coverage-gate";
import { verifyLevel } from "./levels-d";
import { checkChoiceDistinct, checkInstanceFigureQa, checkMultiFigure, checkRenderedFigure, readScale } from "./figure-qa";
import { renderFigureSvg } from "@/lib/problem-figures/render";
import type { FigureSpec } from "@/lib/problem-figures/spec";
import type { Instance } from "./types";

const A = figureArchetypes(); const find = (id: string) => A.find((a) => a.id === id)!;
const inst = (id: string, seed = 3): Instance => { for (let s = seed; s < seed + 60; s++) { const g = generateOne(find(id), s); if (g.ok) return g.inst; } throw new Error(id); };
const codes = (is: { code: string }[]) => is.map((i) => i.code);
type Spec = Record<string, unknown> & { type: string };

describe("구조 검사: 자료 원형(파일럿 15항목 + 1단계 조합)의 실제 생성물은 전부 통과한다", () => {
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

describe("표 계열(1단계): 일반 표·문장형 자료의 구조 검사와 칸 변조", () => {
  const ti = inst("lf.evaluate.TB.P.chain2"); const tspec = ti.figure as Spec; const thtml = renderFigureSvg(tspec as unknown as FigureSpec);
  it("원본 표는 통과", () => expect(checkRenderedFigure(tspec, thtml)).toEqual([]));
  it("(a) 칸 숫자 하나를 다르게 그리면 값 불일치", () => {
    const rows = tspec.rows as number[][]; const v = String(rows[rows.length - 1][1]);
    const i = thtml.lastIndexOf(`>${v}<`); const bad = `${thtml.slice(0, i)}>${Number(v) + 7}<${thtml.slice(i + v.length + 2)}`;
    expect(codes(checkRenderedFigure(tspec, bad))).toContain("table_value_mismatch");
  });
  it("(b) 열 이름(단위 포함)이 빠지면 머리글 누락", () => { const cols = tspec.columns as string[]; expect(codes(checkRenderedFigure(tspec, thtml.replace(`>${cols[1]}<`, "><")))).toContain("table_header_missing"); });
  it("(d) 행이 없는 표·빈 마크업은 자료 없음", () => { expect(codes(checkRenderedFigure({ ...tspec, rows: [] }, thtml))).toContain("render_empty"); expect(codes(checkRenderedFigure(tspec, ""))).toContain("render_empty"); });
  it("문장형 자료: 항목 값이 그려지지 않으면 잡는다", () => {
    const st = { type: "data", kind: "statement", facts: [{ label: "Sample size", value: 400 }, { label: "Margin of error", value: 3, unit: "percent" }] } as Spec; const html = renderFigureSvg(st as unknown as FigureSpec);
    expect(checkRenderedFigure(st, html)).toEqual([]); expect(codes(checkRenderedFigure(st, html.replace(">400<", ">40<")))).toContain("table_value_mismatch");
  });
  it("'cell' 변조(칸 하나 +1)는 기울기처럼 평행이동·배율에 불변인 답도 바꾼다(일차 표 전제 위반 → 재계산이 던짐)", () => {
    const a = find("lf.slope_from_two_points.TB.P.med_slope"); const i0 = inst(a.id);
    const mutated = mutantsOf(i0); expect(mutated.length).toBeGreaterThanOrEqual(4); expect(mutated.some((m) => !verifyLevel(a, m).ok)).toBe(true);
    const cellOnly = { ...i0, figure: tamperFigure(i0.figure, "cell") }; expect(JSON.stringify(cellOnly.figure)).not.toBe(JSON.stringify(i0.figure));
  });
});

describe("그래프 계열(G 묶음): 좌표평면 직선(line)의 비율 충실도 검사와 변조", () => {
  const spec = { type: "plane", axes: { x: { min: 0, max: 10, step: 2, title: "Time (hours)" }, y: { min: 0, max: 60, step: 10, title: "Cost (dollars)" } }, objects: [{ id: "L1", kind: "line", through: [[0, 20], [10, 50]] }, { id: "L2", kind: "line", through: [[0, 50], [10, 10]] }] } as Spec;
  const svg = renderFigureSvg(spec as unknown as FigureSpec);
  it("원본 두 직선은 통과", () => expect(checkRenderedFigure(spec, svg)).toEqual([]));
  it("(a) 한 직선의 끝점을 위로 옮겨 그리면(기울기 불일치) line_mismatch", () => {
    const bad = svg.replace(/(<polyline points="[^"]+ )([\d.]+),([\d.]+)(" fill="none" stroke="#111")/, (_m, a, x, y, c) => `${a}${x},${Number(y) - 30}${c}`);
    expect(bad).not.toBe(svg); expect(codes(checkRenderedFigure(spec, bad))).toContain("line_mismatch");
  });
  it("(d) 직선이 그려지지 않으면 render_empty", () => {
    const bad = svg.replace(/<polyline points="[^"]+" fill="none" stroke="#C8102E"[^>]*\/>/, "");
    expect(bad).not.toBe(svg); expect(codes(checkRenderedFigure(spec, bad))).toContain("render_empty");
  });
  it("자료 변조: 직선 좌표(through)도 변조 대상이다(DATA_KEYS)", () => {
    const mut = tamperFigure(spec, "add") as Spec; expect(JSON.stringify(mut)).not.toBe(JSON.stringify(spec));
  });
});

describe("그래프 계열(G6): 막대·히스토그램·점도표·상자그림의 비율 충실도 검사와 돌연변이", () => {
  const bar = { type: "data", kind: "bar", categories: ["Mon", "Tue", "Wed"], series: [{ values: [12, 20, 8] }], xTitle: "Day (day)", yTitle: "Visitors (people)", yMin: 0, yMax: 24, yStep: 4 } as Spec;
  const hist = { type: "data", kind: "histogram", bins: [{ from: 0, to: 10, count: 3 }, { from: 10, to: 20, count: 7 }, { from: 20, to: 30, count: 5 }], xTitle: "Time (minutes)", yTitle: "Frequency (students)" } as Spec;
  const dot = { type: "data", kind: "dot_plot", dots: [{ value: 1, count: 3 }, { value: 2, count: 5 }, { value: 4, count: 2 }], xTitle: "Books (books)" } as Spec;
  const box = { type: "data", kind: "boxplot", boxes: [{ name: "Class A", min: 2, q1: 5, median: 8, q3: 12, max: 20 }, { name: "Class B", min: 4, q1: 6, median: 9, q3: 11, max: 15 }], xTitle: "Score (points)" } as Spec;
  const R = (s: Spec) => renderFigureSvg(s as unknown as FigureSpec);
  it("원본은 모두 통과", () => { for (const s of [bar, hist, dot, box]) expect(checkRenderedFigure(s, R(s)), String(s.kind)).toEqual([]); });
  it("(a) 막대 높이를 눈금 대비 늘려 그리면 값 불일치", () => {
    const svg = R(bar); const bad = svg.replace(/(<rect x="[^"]+" y=")([\d.]+)(" width="[^"]+" height=")([\d.]+)/, (_m, a, y, b, h) => `${a}${Number(y) - 30}${b}${Number(h) + 30}`); expect(bad).not.toBe(svg);
    expect(codes(checkRenderedFigure(bar, bad))).toContain("render_value_mismatch");
  });
  it("(a) 히스토그램 막대의 너비·위치가 구간과 다르면 값 불일치", () => {
    const svg = R(hist); const bad = svg.replace(/(<rect x=")([\d.]+)(" y="[^"]+" width=")([\d.]+)/, (_m, a, x, b, w) => `${a}${x}${b}${Number(w) * 0.7}`); expect(bad).not.toBe(svg);
    expect(codes(checkRenderedFigure(hist, bad))).toContain("render_value_mismatch");
  });
  it("(a) 점도표의 점 하나를 지우면 점 개수 불일치", () => {
    const svg = R(dot); const bad = svg.replace(/<circle cx="[^"]+" cy="[^"]+" r="6" fill="#111"\/>/, ""); expect(bad).not.toBe(svg);
    expect(codes(checkRenderedFigure(dot, bad))).toContain("render_value_mismatch");
  });
  it("(a) 상자그림의 중앙값 선을 옮기면 값 불일치", () => {
    const svg = R(box); const bad = svg.replace(/(<line x1=")([\d.]+)(" y1="[\d.]+" x2=")([\d.]+)(" y2="[\d.]+" stroke="#111" stroke-width="2.2")/, (_m, a, x1, b, x2, c) => `${a}${Number(x1) + 20}${b}${Number(x2) + 20}${c}`); expect(bad).not.toBe(svg);
    expect(codes(checkRenderedFigure(box, bad))).toContain("render_value_mismatch");
  });
  it("(a) 묶음 막대(범례 있음)의 둘째 계열 막대를 늘려 그리면 값 불일치, 범례 견본은 막대로 세지 않는다", () => {
    const g2 = { ...bar, series: [{ name: "Last year", values: [12, 20, 8] }, { name: "This year", values: [16, 8, 12] }] } as Spec; const svg = R(g2);
    expect(checkRenderedFigure(g2, svg)).toEqual([]);
    const reds = [...svg.matchAll(/<rect x="[^"]+" y="([\d.]+)" width="[^"]+" height="([\d.]+)" fill="#C8102E"\/>/g)]; const last = reds[reds.length - 1]; // 마지막 빨간 사각형 = 막대(범례 견본이 아님)
    const bad = svg.replace(last[0], last[0].replace(`y="${last[1]}"`, `y="${Number(last[1]) - 30}"`).replace(`height="${last[2]}"`, `height="${Number(last[2]) + 30}"`)); expect(bad).not.toBe(svg);
    expect(codes(checkRenderedFigure(g2, bad))).toContain("render_value_mismatch");
  });
  it("(b) 축 제목의 단위(괄호)가 빠지면 잡는다", () => { expect(codes(checkRenderedFigure({ ...bar, yTitle: "Visitors" }, R({ ...bar, yTitle: "Visitors" })))).toContain("unit_missing_in_title"); });
  it("(d) 범주 이름이 그려지지 않으면 잡는다", () => { const svg = R(bar); expect(codes(checkRenderedFigure(bar, svg.replace(">Tue<", "><")))).toContain("category_label_missing"); });
});

describe("그래프 계열(G7): 삼각형의 각·변 비율 충실도 검사와 돌연변이", () => {
  const ang = { type: "triangle", vertices: ["A", "B", "C"], angles: [{ at: "A", label: "(2x + 10)°", value: 50 }, { at: "B", label: "(3x - 5)°", value: 70 }, { at: "C", label: "(x + 20)°", value: 60 }] } as Spec;
  const rt = { type: "triangle", vertices: ["P", "Q", "R"], kind: "right", rightAngleAt: "Q", horizontal: ["Q", "R"], sides: [{ between: ["Q", "R"], label: "12" }, { between: ["P", "Q"], label: "5" }, { between: ["P", "R"], label: "x" }] } as Spec;
  const R = (s: Spec) => renderFigureSvg(s as unknown as FigureSpec);
  it("원본은 통과", () => { expect(checkRenderedFigure(ang, R(ang))).toEqual([]); expect(checkRenderedFigure(rt, R(rt))).toEqual([]); });
  it("(a) 각의 참값(value)과 다르게 그려진 삼각형은 잡는다(그림에 40°·꼭지각 120° 로 그리기)", () => {
    const bad = { ...ang, angles: [{ at: "A", label: "(2x + 10)°", value: 50 }, { at: "B", label: "(3x - 5)°", value: 70 }, { at: "C", label: "(x + 20)°", value: 60 }] } as Spec;
    const svg = R(bad).replace(/<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)" stroke="#111" stroke-width="2"/, (_m, a, b, c, d) => `<line x1="${Number(a) + 25}" y1="${b}" x2="${c}" y2="${d}" stroke="#111" stroke-width="2"`);
    expect(codes(checkRenderedFigure(bad, svg))).toContain("render_value_mismatch");
  });
  it("(a) 두 직각변 라벨 12:5 의 비율과 다르게 그려지면 잡는다", () => {
    const svg = R(rt).replace(/(<line x1="58" y1=")([\d.]+)(" x2="58" y2=")([\d.]+)/, (_m, a, y1, b, y2) => `${a}${Number(y1) - 40}${b}${y2}`);
    expect(svg).not.toBe(R(rt)); expect(codes(checkRenderedFigure(rt, svg))).toContain("render_value_mismatch");
  });
  it("'label' 변조: 숫자가 든 첫 라벨의 마지막 정수가 바뀐다", () => {
    const m = tamperFigure(rt, "label") as { sides: { label: string }[] }; expect(m.sides[0].label).toBe("13");
  });
});
