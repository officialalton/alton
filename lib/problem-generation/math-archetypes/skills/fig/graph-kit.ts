// 그래프 계열(직선 LN · 함수 곡선 FN …) 자료 원형 공용 장면 키트 — 그래프 묶음(G1~)의 조합 파일들이 함께 쓴다.
// 규칙(표 계열과 같음): 수치를 먼저 뽑고 → figure(plane)를 만들고 → 지문은 값을 되풀이하지 않고 "the graph shown" 으로 가리킨다.
// 그림 규칙: 눈금 격자 위의 점(lattice)을 직선이 지나고, 그 점에 점(dot)을 찍어 사람이 읽을 수 있게 한다. 직선 라벨은 지문이 가리킬 때만(label-rule) 붙인다.
// verification_js 는 FIGURE.objects 의 직선·점만 읽어 다시 계산하고, 점이 직선 위에 없으면 던진다 — 점 하나만 바뀌어도(G6 'line' 변조) 검출된다.
import { GenFail } from "../../types";
import type { Rng } from "../../rng";
import { SE_TOPICS, type SeTopic } from "../../figure-topics";
import { fmtNum } from "../../text";
import { figInst } from "../../figure-kit";
import type { Draft } from "../../text";
import type { Instance } from "../../types";
import { sing, capFirst, lc } from "./table-kit";

export { sing, capFirst, lc };
const isInt = Number.isInteger;

/** 의미상 x 가 늘면 y 가 줄어드는 장면(양의 기울기로 쓰면 어색하다) — 이 목록 밖은 모두 y 가 늘어난다. 직선 그래프의 기울기 부호는 장면이 정한다. */
const NEG_PAIRS = new Set(["Daily use|Battery remaining", "Days burning|Candle height", "Flight time|Battery remaining", "Running time|Freezer temperature", "Ticket price|Tickets sold", "Price|Pens sold", "Ride cost|Riders", "Price|Sandwiches sold", "Apps installed|Free storage", "Age|Resale value", "Backpack weight|Walking speed", "Days since baking|Freshness score"]);
export const topicSign = (t: SeTopic): 1 | -1 => (NEG_PAIRS.has(`${t.xa}|${t.ya}`) ? -1 : 1);
export const LIN_G_TOPICS: SeTopic[] = SE_TOPICS.filter((t) => !/ of | per /.test(t.xu) && t.xa !== t.ya);
export const CONV_LIN_G_TOPICS: SeTopic[] = LIN_G_TOPICS.filter((t) => t.conv);

export type PlaneAxisSpec = { min: number; max: number; step: number; title: string };
export type LinGraph = {
  t: SeTopic;
  /** 그림에 점으로 찍힌 격자점 세 개(왼쪽부터). */
  xs: number[]; ys: number[]; m: number; b: number; d: number;
  /** 가로축 끝값·간격, 세로축 끝값·간격. */
  X: number; xStep: number; yMax: number; S: number;
  fig: PlaneFig; xq: string; yq: string;
};
export type PlaneFig = { type: "plane"; axes: { x: PlaneAxisSpec; y: PlaneAxisSpec }; objects: Record<string, unknown>[] };

export const axisTitle = (a: string, u: string) => `${a} (${u})`;
/**
 * 직선 하나 + 격자점 두 개를 담은 plane figure. 엔진의 scatter(점) + fitLine(검은 직선)으로 그려 SAT 지면처럼 검은 점·검은 직선이 된다(line·point 객체는 객체 순서대로 색이 달라진다).
 * 직선 라벨(label)은 지문이 그 글자를 가리킬 때만 남는다(label-rule).
 */
export function lineFig(t: SeTopic, X: number, xStep: number, yMax: number, S: number, pts: [number, number][], o: { label?: string } = {}): PlaneFig {
  const m = (pts[1][1] - pts[0][1]) / (pts[1][0] - pts[0][0]); const b = pts[0][1] - m * pts[0][0];
  return {
    type: "plane", axes: { x: { min: 0, max: X, step: xStep, title: axisTitle(t.xa, t.xu) }, y: { min: 0, max: yMax, step: S, title: axisTitle(t.ya, t.yu) } },
    objects: [{ id: "S1", kind: "scatter", points: pts, fitLine: { slope: m, intercept: b, ...(o.label ? { label: o.label } : {}) } }],
  };
}

export type LinGOpts = { topic?: SeTopic; conv?: boolean; mSign?: 1 | -1; /** 점 하나가 y 절편(x=0) 격자점 */ x0Zero?: boolean; /** y 절편이 격자 위가 아님(점은 x>0) */ noZeroX?: boolean; mMax?: number };
/** 일차 관계 y = m x + b 의 그래프: 세 격자점에 점이 찍히고 직선은 축 전 구간을 지난다. 값은 모두 0 이상 정수. */
export function makeLinGraph(rng: Rng, o: LinGOpts = {}): LinGraph {
  const pool = o.conv ? CONV_LIN_G_TOPICS : LIN_G_TOPICS;
  for (let tr = 0; tr < 400; tr++) {
    const t = o.topic ?? rng.pick(o.mSign ? pool.filter((q) => topicSign(q) === o.mSign) : pool); const xStep = rng.pick([1, 1, 2]); const nx = rng.int(5, 8); const X = xStep * nx;
    const sign = topicSign(t); const m = sign * rng.int(2, sign > 0 ? (o.mMax ?? 12) : Math.min(o.mMax ?? 12, 6));
    const b = sign > 0 ? rng.int(0, 60) : Math.abs(m) * (X + rng.int(3, 6)) + rng.int(0, 20); const top = Math.max(b, b + m * X);
    const Ss = [5, 10, 20, 25, 50].filter((S) => { const ym = Math.ceil((top + 1) / S) * S; return ym / S >= 4 && ym / S <= 9; });
    if (!Ss.length) continue; const S = rng.pick(Ss); const yMax = Math.ceil((top + 1) / S) * S;
    if (!isInt(b) || b < 0) continue;
    const lat: number[] = []; for (let i = 0; i <= nx; i++) { const x = i * xStep; const y = b + m * x; if (y >= 0 && y <= yMax && y % S === 0) lat.push(x); }
    const cand = o.noZeroX ? lat.filter((x) => x > 0) : lat; if (o.noZeroX && b % S === 0) continue;
    if (cand.length < 3) continue; if (o.x0Zero && !cand.includes(0)) continue;
    const pick = o.x0Zero ? [0, ...rng.shuffle(cand.filter((x) => x > 0)).slice(0, 2)] : rng.shuffle(cand).slice(0, 3); const px = pick.sort((p, q) => p - q);
    const py = px.map((x) => b + m * x);
    return { t, xs: px, ys: py, m, b, d: px[1] - px[0], X, xStep, yMax, S, fig: lineFig(t, X, xStep, yMax, S, px.map((x, i) => [x, py[i]] as [number, number])), xq: t.x, yq: t.y };
  }
  throw new GenFail("일차 그래프 장면 표집 실패");
}
/** FIGURE(plane)에서 점 두 개(S1.points)와 직선(S1.fitLine)을 읽고 점이 직선 위인지 확인하는 JS. 변수: xs, ys(그림의 두 격자점), m, b. */
export const GL_JS = "const S1=FIGURE.objects.find(o=>o.kind==='scatter'); const xs=S1.points.map(p=>p[0]), ys=S1.points.map(p=>p[1]); const m=S1.fitLine.slope, b=S1.fitLine.intercept; for (let i=0;i<xs.length;i++) if (Math.abs(m*xs[i]+b-ys[i])>1e-9) throw new Error('점이 직선 위에 없음');\n";
export const glIntro = (rng: Rng, s: LinGraph) => rng.pick([
  `The graph shows ${s.yq} for values of ${s.xq}. The relationship between the two quantities is linear.`,
  `The graph shown gives ${s.yq} at different values of ${s.xq}. There is a linear relationship between these quantities.`,
  `A linear relationship relates ${s.xq} to ${s.yq}. Its graph is shown.`,
  `For a linear model, the graph shown relates ${s.yq} to ${s.xq}.`,
  `An analyst models ${s.yq} as a linear function of ${s.xq}. The graph of the model is shown.`,
  `In the graph shown, ${s.yq} depends linearly on ${s.xq}.`,
  `The line in the graph shown represents the linear relationship between ${s.xq} and ${s.yq}.`,
  `Data collected by a research group show that ${s.yq} is related to ${s.xq} by a linear model, whose graph is shown.`,
  `A technician plotted a linear model for ${s.yq} against ${s.xq}; the plot is shown.`,
  `The graph shown models ${s.yq} as ${s.xq} varies, and the model is linear.`,
]);
/** 사람이 그래프에서 읽는 두 점과 기울기 계산(해설용). 그림에는 점이 세 개 있다 — 그중 앞의 두 점으로 기울기를 구한다. */
export const glRead = (s: LinGraph): [string, string][] => [
  [`그래프에 표시된 두 점 (${s.xs[0]}, ${s.ys[0]}) 과 (${s.xs[1]}, ${s.ys[1]}) 을 읽는다.`, "Read two marked points on the graph."],
  [`기울기 = (${s.ys[1]} - ${s.ys[0]}) ÷ (${s.xs[1]} - ${s.xs[0]}) = ${fmtNum(s.m)} 이다.`, "Compute the rate of change."],
];
export const glIntercept = (s: LinGraph): [string, string] => [`x = 0 일 때 값: ${s.ys[0]} - (${fmtNum(s.m)}) × ${s.xs[0]} = ${fmtNum(s.b)} 이다.`, "Find the value at x = 0."];
/** 그래프 밖(가로축 끝 X 보다 큰) 정수 x. */
export function offXg(rng: Rng, s: LinGraph, lo = 1, hi = 8): number {
  const h = s.m < 0 ? Math.min(hi, Math.floor((s.b - 1) / Math.abs(s.m)) - s.X) : hi; if (h < lo) throw new GenFail("그래프 밖 x 가 값 0 이하");
  return s.X + rng.int(lo, h);
}
/** 단위 환산 장면: 환산 비율은 지문(인쇄된 수)에 둔다. */
export const convNote = (s: LinGraph) => `Note that 1 ${sing(s.t.xu)} = ${s.t.conv!.per} ${s.t.conv!.small}.`;
/** figInst 와 같고, 정답이 0 이상인 양일 때 음수 오답 후보(의미 없는 음의 개수·값)를 뺀다. */
export function gInst(rng: Rng, d: Draft, fig: unknown): Instance {
  return figInst(rng, d.correct !== undefined && d.correct >= 0 && d.wrongs ? { ...d, wrongs: d.wrongs.filter((w) => w.v >= 0) } : d, fig);
}
