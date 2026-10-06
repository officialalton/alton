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

// ───────────────────────── 두 직선(연립·교점) 그래프 ─────────────────────────
export type PairTopic = { x: string; xa: string; xu: string; ya: string; yu: string; A: string; B: string; what: string };
export const PAIR_TOPICS: PairTopic[] = [
  { x: "the number of months", xa: "Months", xu: "months", ya: "total cost", yu: "dollars", A: "Plan A", B: "Plan B", what: "the total cost of two phone plans" },
  { x: "the number of weeks", xa: "Weeks", xu: "weeks", ya: "savings", yu: "dollars", A: "Maya", B: "Theo", what: "the savings of two friends" },
  { x: "the number of days", xa: "Days", xu: "days", ya: "height", yu: "centimeters", A: "Plant P", B: "Plant Q", what: "the heights of two plants" },
  { x: "the number of miles driven", xa: "Distance", xu: "miles", ya: "rental charge", yu: "dollars", A: "Company R", B: "Company S", what: "the charges of two car rental companies" },
  { x: "the number of visits", xa: "Visits", xu: "visits", ya: "total fee", yu: "dollars", A: "Gym A", B: "Gym B", what: "the total fees at two gyms" },
  { x: "the number of minutes", xa: "Time", xu: "minutes", ya: "distance from home", yu: "meters", A: "Runner 1", B: "Runner 2", what: "the distances of two runners from home" },
  { x: "the number of hours worked", xa: "Hours worked", xu: "hours", ya: "pay", yu: "dollars", A: "Job A", B: "Job B", what: "the pay for two part-time jobs" },
  { x: "the number of weeks", xa: "Weeks", xu: "weeks", ya: "pages read", yu: "pages", A: "Reader 1", B: "Reader 2", what: "the pages read by two students" },
  { x: "the number of guests", xa: "Guests", xu: "guests", ya: "catering cost", yu: "dollars", A: "Caterer A", B: "Caterer B", what: "the costs of two caterers" },
  { x: "the number of months", xa: "Months", xu: "months", ya: "members", yu: "members", A: "Club A", B: "Club B", what: "the membership of two clubs" },
  { x: "the number of uses", xa: "Uses", xu: "uses", ya: "total cost", yu: "dollars", A: "Pass A", B: "Pass B", what: "the costs of two transit passes" },
  { x: "the number of seconds", xa: "Time", xu: "seconds", ya: "altitude", yu: "meters", A: "Balloon A", B: "Balloon B", what: "the altitudes of two weather balloons" },
  { x: "the number of lessons", xa: "Lessons", xu: "lessons", ya: "total charge", yu: "dollars", A: "Studio A", B: "Studio B", what: "the charges of two music studios" },
  { x: "the number of months", xa: "Months", xu: "months", ya: "subscribers", yu: "thousands", A: "Channel A", B: "Channel B", what: "the subscribers of two video channels" },
  { x: "the number of shirts printed", xa: "Shirts", xu: "shirts", ya: "order cost", yu: "dollars", A: "Printer A", B: "Printer B", what: "the order costs at two print shops" },
  { x: "the number of weeks", xa: "Weeks", xu: "weeks", ya: "weight", yu: "pounds", A: "Calf A", B: "Calf B", what: "the weights of two calves" },
  { x: "the number of hours", xa: "Time", xu: "hours", ya: "distance traveled", yu: "miles", A: "Bus A", B: "Bus B", what: "the distances traveled by two buses" },
  { x: "the number of years", xa: "Years", xu: "years", ya: "tree height", yu: "feet", A: "Oak", B: "Maple", what: "the heights of two trees" },
  { x: "the number of tickets", xa: "Tickets", xu: "tickets", ya: "total price", yu: "dollars", A: "Theater A", B: "Theater B", what: "the total ticket prices at two theaters" },
  { x: "the number of hours", xa: "Time", xu: "hours", ya: "pool water", yu: "hundreds of gallons", A: "Pool A", B: "Pool B", what: "the water in two pools being filled" },
];
export type LinePair = { t: PairTopic; X: number; xStep: number; yMax: number; S: number; m1: number; b1: number; m2: number; b2: number; xi: number; yi: number; fig: PlaneFig };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export type PairOpts = {
  /** 교점이 그림 안(격자점)인가 — 기본은 그림 오른쪽 밖(연장해야 만남). */
  inside?: boolean;
  /** 교점의 x 가 정수가 아님(그림 밖만) — 올림 문항용. */
  fracX?: boolean;
  /** 두 직선이 평행(기울기 같음, 절편 다름) */
  parallel?: boolean;
  /** 두 직선이 같은 직선(겹침) */
  same?: boolean;
  topic?: PairTopic;
};
/**
 * 직선 둘의 그래프. 두 직선은 모두 y 절편(0, b)과 그림 안의 격자점 하나를 지나 눈금으로 읽을 수 있다(점은 찍지 않는다).
 * 직선 1 은 기울기가 크고 처음 값이 작아 교점 이후 위로 올라선다. 직선 라벨(이름)은 지문이 가리킬 때만 남는다(label-rule).
 */
export function makeLinePair(rng: Rng, o: PairOpts = {}): LinePair {
  for (let tr = 0; tr < 800; tr++) {
    const t = o.topic ?? rng.pick(PAIR_TOPICS); const xStep = rng.pick([1, 1, 2]); const nx = rng.int(5, 8); const X = xStep * nx; const S = rng.pick([5, 10, 10, 20]);
    let m1 = rng.int(3, 12), m2 = rng.int(1, m1 - 1), b1 = rng.int(0, 5) * S, b2: number, xi: number;
    if (o.same) { m2 = m1; b2 = b1; xi = NaN; }
    else if (o.parallel) { m2 = m1; b2 = b1 + rng.int(1, 4) * S; xi = NaN; }
    else {
      xi = o.inside ? xStep * rng.int(2, nx - 1) : (o.fracX ? X + rng.int(1, 8) + 0.5 : X + rng.int(1, 8)); b2 = b1 + (m1 - m2) * xi;
      if (!Number.isInteger(b2) && !o.fracX) continue; if (o.fracX) { b2 = Math.round(b2 / S) * S; xi = (b2 - b1) / (m1 - m2); if (Number.isInteger(xi) || b2 <= b1) continue; }
    }
    if (b2 % S !== 0 || b2 < 0) continue;
    const v = [b1 + m1 * X, b2 + m2 * X]; const top = Math.max(...v, o.inside ? m1 * xi + b1 : 0); const yMax = Math.ceil((top + 1) / S) * S; if (yMax / S < 4 || yMax / S > 9) continue;
    const yi = o.same || o.parallel ? NaN : m1 * xi + b1; if (o.inside && yi % S !== 0) continue;
    const second = (m: number, b: number): [number, number] | null => { for (let i = nx; i >= 1; i--) { const x = i * xStep, y = b + m * x; if (y % S === 0 && y <= yMax) return [x, y]; } return null; };
    const p1 = second(m1, b1), p2 = second(m2, b2); if (!p1 || !p2) continue;
    if (!o.inside && !o.same && !o.parallel && p1[0] >= xi) continue;
    const fig: PlaneFig = {
      type: "plane", axes: { x: { min: 0, max: X, step: xStep, title: axisTitle(t.xa, t.xu) }, y: { min: 0, max: yMax, step: S, title: axisTitle(cap(t.ya), t.yu) } },
      objects: [{ id: "A1", kind: "line", through: [[0, b1], p1], label: t.A }, { id: "B1", kind: "line", through: [[0, b2], p2], label: t.B }],
    };
    return { t, X, xStep, yMax, S, m1, b1, m2, b2, xi, yi, fig };
  }
  throw new GenFail("두 직선 그래프 장면 표집 실패");
}
/** FIGURE(plane)에서 두 직선(objects[0], [1])의 기울기·절편을 읽는다. 변수: m1, b1, m2, b2. 교점은 호출 쪽이 필요하면 계산한다. */
export const PAIR_JS = "const Ls=FIGURE.objects.filter(o=>o.kind==='line'); if (Ls.length!==2) throw new Error('직선 2개 아님'); const fit=(L)=>{const p=L.through[0], q=L.through[1]; const m=(q[1]-p[1])/(q[0]-p[0]); return [m, p[1]-m*p[0]];}; const [m1,b1]=fit(Ls[0]), [m2,b2]=fit(Ls[1]);\n";
/** 위에 더해: m1 ≠ m2 를 요구하고 교점(xi, yi)을 계산한다. */
export const PAIR_X_JS = `${PAIR_JS}if (m1===m2) throw new Error('평행'); const xi=(b2-b1)/(m1-m2), yi=m1*xi+b1;\n`;
export const pairIntro = (rng: Rng, s: LinePair) => rng.pick([
  `The graph shows ${s.t.what} for several values of ${s.t.x}. Each relationship is linear.`,
  `The graph shown compares ${s.t.what}. For each, the relationship with ${s.t.x} is linear.`,
  `Two linear relationships are shown in the graph: ${s.t.what} as ${s.t.x} varies.`,
  `A report tracked ${s.t.what}. The graph shown gives both relationships, and both change linearly with ${s.t.x}.`,
  `In the graph shown, ${s.t.what} change at constant rates as ${s.t.x} increases.`,
]);
export const ifCont = (rng: Rng) => rng.pick(["If both relationships continue", "Assuming the linear patterns continue", "If the lines in the graph are extended", "Extending both relationships"]);
export const pairRead = (s: LinePair): [string, string][] => [
  [`${s.t.A}: 그래프에서 y 절편 ${s.b1} 과 격자점을 읽어 기울기 ${s.m1} 을 구한다.`, `${s.t.A}: starting value and slope from the graph.`],
  [`${s.t.B}: 그래프에서 y 절편 ${s.b2} 과 격자점을 읽어 기울기 ${s.m2} 를 구한다.`, `${s.t.B}: starting value and slope from the graph.`],
  [`${s.m1}x + ${s.b1} = ${s.m2}x + ${s.b2} 로 놓는다.`, "Set the two expressions equal."],
];
