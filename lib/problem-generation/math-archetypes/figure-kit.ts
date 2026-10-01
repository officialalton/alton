// 자료(그림·표) 원형 공용 도구 — figure 빌더·장면 생성기·통계 보조·선택지 배치.
//
// 생성기 규칙(조사 문서 5-1): 수치 파라미터를 먼저 뽑고 → figure 객체를 만들고 → 지문은 값을 되풀이하지 않고 "the table/graph shown" 으로 가리킨다.
// 정보는 자료에만 있다. verification_js 는 `const FIGURE = ...;`(또는 `const CHOICES = ...;`)로 자료를 받아 읽는다.
import { GenFail, type Instance } from "./types";
import type { Rng } from "./rng";
import { finish, type Draft } from "./text";
import { SE_TOPICS, TW_TOPICS, type SeTopic, type TwTopic } from "./figure-topics";

export const cap1 = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const isInt = Number.isInteger;
export const r1d = (n: number) => Math.round(n * 10) / 10;
/** 소수 한 자리 이하인가. */
export const oneDec = (n: number) => Math.abs(n * 10 - Math.round(n * 10)) < 1e-9;

/** verification_js 조립: P(지문에 인쇄된 값) 한 줄 → FIGURE/CHOICES 한 줄 → 본문. */
export function figJs(params: Record<string, number | string | number[] | string[]>, figure: unknown, body: string) {
  return `const P = ${JSON.stringify(params)};\nconst FIGURE = ${JSON.stringify(figure)};\n${body}`;
}
export function choiceJs(params: Record<string, number | string | number[] | string[]>, choices: unknown[], body: string) {
  return `const P = ${JSON.stringify(params)};\nconst CHOICES = ${JSON.stringify(choices)};\n${body}`;
}

/** finish() 결과에 자료를 붙인다. */
export const withFigure = (inst: Instance, figure: unknown): Instance => ({ ...inst, figure });
export function figInst(rng: Rng, d: Draft, figure: unknown): Instance { return withFigure(finish(rng, d), figure); }

// ───────────────────────── 통계 보조 ─────────────────────────
export const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
export function pearson(pts: [number, number][]): number {
  const mx = mean(pts.map((p) => p[0])), my = mean(pts.map((p) => p[1]));
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  return sxy / Math.sqrt(sxx * syy);
}
export function ols(pts: [number, number][]): { slope: number; intercept: number } {
  const mx = mean(pts.map((p) => p[0])), my = mean(pts.map((p) => p[1]));
  let sxy = 0, sxx = 0;
  for (const [x, y] of pts) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; }
  const slope = sxy / sxx; return { slope, intercept: my - slope * mx };
}

// ───────────────────────── 이원표 ─────────────────────────
export type TwScene = { t: TwTopic; cells: number[][]; fig: Record<string, unknown>; r1: number; r2: number; cy: number; cn: number; N: number };
export const twFig = (t: TwTopic, cells: number[][]) => ({ type: "data", kind: "two_way", title: t.title, rowHeader: t.rowHeader, rowLabels: [cap1(t.r1), cap1(t.r2)], colLabels: [t.yLabel, t.nLabel], cells });
export function makeTw(rng: Rng, o: { topic?: TwTopic; lo?: number; hi?: number } = {}): TwScene {
  const t = o.topic ?? rng.pick(TW_TOPICS); const lo = o.lo ?? 8, hi = o.hi ?? 60;
  const cells = [[rng.int(lo, hi), rng.int(lo, hi)], [rng.int(lo, hi), rng.int(lo, hi)]];
  const r1 = cells[0][0] + cells[0][1], r2 = cells[1][0] + cells[1][1];
  return { t, cells, fig: twFig(t, cells), r1, r2, cy: cells[0][0] + cells[1][0], cn: cells[0][1] + cells[1][1], N: r1 + r2 };
}
/** FIGURE(two_way)에서 칸·합계를 읽는 JS. */
export const TW_JS = "const c=FIGURE.cells; const c11=c[0][0], c12=c[0][1], c21=c[1][0], c22=c[1][1]; const r1=c11+c12, r2=c21+c22, N=r1+r2, cy=c11+c21, cn=c12+c22;\n";

// ───────────────────────── 산점도·선그래프(직선 모형) ─────────────────────────
export type LineSrc = {
  shape: "SC" | "LG"; figure: Record<string, unknown>; m: number; b: number; topic: SeTopic; X: number; S: number;
  /** FIGURE 에서 const m, const b 를 읽는 JS(산점도: 추세선 / 선그래프: 첫·끝 값에서 계산). */
  extractJs: string; noun: string;
  /** "the line of best fit shown" / "the linear relationship shown in the graph" */
  lineRef: string; intro: string;
  points?: [number, number][]; xs: number[];
  /** 사람이 그림에서 읽는 두 격자점(풀이 해설용). */
  p1: [number, number]; p2: [number, number];
};
export const SC_JS = "const m=FIGURE.fitLine.slope, b=FIGURE.fitLine.intercept;\n";
export const LG_JS = "const xs=FIGURE.categories.map(Number), ys=FIGURE.series[0].values; const m=(ys[ys.length-1]-ys[0])/(xs[xs.length-1]-xs[0]); const b=ys[0]-m*xs[0];\n";
const axisTitle = (a: string, u: string) => `${a} (${u})`;

/** frac: 기울기가 분수(소수)가 되는 장면만(정수 조건 개수 세기용). */
export type ScOpts = { topic?: SeTopic; n?: number; convNote?: boolean; frac?: boolean };
/** 산점도: 추세선은 (0,b)와 (X,e) 두 격자점을 지난다. 점은 추세선에서 분명히 떨어진다(위·아래 판독 가능). */
export function makeScatter(rng: Rng, o: ScOpts = {}): LineSrc {
  const topic = o.topic ?? rng.pick(SE_TOPICS);
  for (let tries = 0; tries < 60; tries++) {
    const X = o.frac ? 10 : rng.pick([10, 10, 20]); const S = o.frac ? 5 : rng.pick([5, 10, 10, 20]); const k = o.frac ? rng.pick([-3, -1, 1, 3]) : rng.nz(-4, 4); const j = rng.int(1, 6);
    const b = j * S, e = b + k * S, m = (k * S) / X;
    if (e < S || e > 8 * S || !oneDec(m) || b > 8 * S) continue;
    const n = o.n ?? (X === 10 ? rng.int(8, 10) : rng.int(10, 14));
    if (n > X) continue;
    const xsAll = Array.from({ length: X - 1 }, (_, i) => i + 1); const chosen = rng.shuffle(xsAll).slice(0, n - 1).concat([X]).sort((p, q) => p - q);
    const rmin = Math.max(2, Math.ceil(0.25 * S)), rmax = Math.max(rmin + 1, Math.round(0.55 * S));
    const pts: [number, number][] = []; let bad = false;
    for (const x of chosen) { const r = rng.int(rmin, rmax) * (rng.chance(0.5) ? 1 : -1); const y = Math.round(m * x + b) + r; if (y < 1 || y > 9 * S) { bad = true; break; } pts.push([x, y]); }
    if (bad) continue;
    const yMax = Math.ceil((Math.max(...pts.map((p) => p[1]), b, e) + 1) / S) * S; if (yMax / S > 10) continue;
    const figure = { type: "data", kind: "scatter", ...(o.convNote && topic.conv ? { title: `1 ${topic.xu.replace(/s$/, "")} = ${topic.conv.per} ${topic.conv.small}` } : {}), xTitle: axisTitle(topic.xa, topic.xu), yTitle: axisTitle(topic.ya, topic.yu), points: pts, fitLine: { slope: m, intercept: b }, yMin: 0, yMax, yStep: S };
    return { shape: "SC", figure, m, b, topic, X, S, extractJs: SC_JS, noun: "scatterplot", lineRef: "the line of best fit shown", intro: rng.pick([`The scatterplot shows ${topic.x} and ${topic.y} for ${n} data points, along with a line of best fit.`, `A scatterplot of ${n} observations relates ${topic.x} to ${topic.y}; a line of best fit is also drawn.`, `Researchers recorded ${topic.x} and ${topic.y} for ${n} cases. The scatterplot shows the data and its line of best fit.`]), points: pts, xs: chosen, p1: [0, b], p2: [X, e] };
  }
  throw new GenFail("산점도 장면 표집 실패");
}

/** 선그래프(직선 모양 자료): 범주 = x 값, 모든 값이 y 격자 위(S 의 배수)에 놓인다. */
export function makeLineGraph(rng: Rng, o: ScOpts = {}): LineSrc {
  const topic = o.topic ?? rng.pick(SE_TOPICS);
  for (let tries = 0; tries < 60; tries++) {
    const d = o.frac ? 2 : rng.pick([1, 2, 5]); const n = rng.int(5, 7); const x0 = rng.pick([0, 0, d]); const S = o.frac ? 5 : rng.pick([5, 10, 10, 20]); const k = rng.nz(-3, 3); const j = rng.int(0, 6);
    const xs = Array.from({ length: n }, (_, i) => x0 + d * i); const ys = xs.map((_, i) => j * S + k * S * i);
    if (ys.some((y) => y < 0 || y > 8 * S) || ys.every((y) => y === 0)) continue;
    const m = (k * S) / d; if (!oneDec(m)) continue; const b = ys[0] - m * x0; if (!oneDec(b)) continue;
    const yMax = Math.ceil((Math.max(...ys) + 1) / S) * S; if (yMax / S > 10) continue;
    const figure = { type: "data", kind: "line", ...(o.convNote && topic.conv ? { title: `1 ${topic.xu.replace(/s$/, "")} = ${topic.conv.per} ${topic.conv.small}` } : {}), categories: xs.map(String), series: [{ values: ys }], xTitle: axisTitle(topic.xa, topic.xu), yTitle: axisTitle(topic.ya, topic.yu), yMin: 0, yMax, yStep: S };
    return { shape: "LG", figure, m, b, topic, X: xs[xs.length - 1], S, extractJs: LG_JS, noun: "line graph", lineRef: "the linear relationship shown in the graph", intro: rng.pick([`The line graph shows ${topic.y} at ${n} different values of ${topic.x}; the values follow a linear pattern.`, `A line graph displays ${topic.y} for ${n} values of ${topic.x}. The points lie on a straight line.`, `The graph shown gives ${topic.y} for ${n} values of ${topic.x}, and the relationship is linear.`]), xs, p1: [xs[0], ys[0]], p2: [xs[n - 1], ys[n - 1]] };
  }
  throw new GenFail("선그래프 장면 표집 실패");
}
export const makeLineSrc = (shape: "SC" | "LG", rng: Rng, o: ScOpts = {}) => (shape === "SC" ? makeScatter(rng, o) : makeLineGraph(rng, o));

// ───────────────────────── 선택지형(그림 4개) ─────────────────────────
export const PLANE_X = { min: 0, max: 12, step: 2 };
export function planeScatter(topic: SeTopic, S: number, yMax: number, points: [number, number][], fit: { slope: number; intercept: number } | null) {
  return {
    type: "plane", axes: { x: { ...PLANE_X, title: axisTitle(topic.xa, topic.xu) }, y: { min: 0, max: yMax, step: S, title: axisTitle(topic.ya, topic.yu) } },
    objects: [{ id: "S1", kind: "scatter", points, ...(fit ? { fitLine: fit } : {}) }],
  };
}
/** 정답 1 + 오답 3 을 섞어 4개 선택지로 — correctIndex 와 규칙 배열(rules[i])을 함께 낸다. 같은 그림이 둘이면 GenFail. */
export function placeChoices(rng: Rng, correct: unknown, wrong: { fig: unknown; rule: string }[]): { choices: unknown[]; correctIndex: number; rules: string[] } {
  if (wrong.length !== 3) throw new GenFail("오답 3개 필요");
  const all = rng.shuffle([{ fig: correct, rule: "correct" }, ...wrong]);
  if (new Set(all.map((a) => JSON.stringify(a.fig))).size !== 4) throw new GenFail("선택지 그림 중복");
  return { choices: all.map((a) => a.fig), correctIndex: all.findIndex((a) => a.rule === "correct"), rules: all.map((a) => a.rule) };
}
export const ABCD = ["A", "B", "C", "D"];
export { isInt };
export { SE_TOPICS, TW_TOPICS };
