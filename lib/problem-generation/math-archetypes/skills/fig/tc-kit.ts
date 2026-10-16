// 삼각함수 곡선(TC) 계열 자료 원형 공용 장면 키트 — 삼각비(trig_ratio.TC.P)·사인곡선 읽기(sinusoid_graph.TC.P/C) 조합 파일이 함께 쓴다.
// 규칙: 곡선의 진폭·주기·중심선은 그림의 표시점 라벨(최댓점·최솟점의 좌표)로만 읽히고 지문은 "the graph shown" 으로 가리킨다. 그림은 데이터(amp·period·mid)대로 그려진다(엔진 규칙, G8 가 곡선 표본·점·라벨을 대조).
// verification_js 는 FIGURE.points[].label 만 읽어 다시 계산한다(라벨이 바뀌면 답이 달라져 변조가 검출된다).
import { GenFail } from "../../types";
import type { Rng } from "../../rng";
import { gcd } from "../../rng";

// ───────────────────────── 맥락(사인곡선 읽기) ─────────────────────────
export type TcCtx = { ent: string; y: string; yu: string; xu: string; xt: string; yt: string; x0: string; lead: string };
export const TC_CTX: TcCtx[] = [
  { ent: "the depth of water at a harbor dock", y: "depth", yu: "feet", xu: "hours", xt: "Time (hours)", yt: "Depth (feet)", x0: "the start of the measurement", lead: "A harbor master records tides." },
  { ent: "the height of a rider on a Ferris wheel above the ground", y: "height", yu: "feet", xu: "seconds", xt: "Time (seconds)", yt: "Height (feet)", x0: "the moment the ride starts", lead: "A park designer studies a Ferris wheel." },
  { ent: "the daily high temperature in a mountain town", y: "temperature", yu: "degrees Fahrenheit", xu: "months", xt: "Time (months)", yt: "Temperature (°F)", x0: "the start of the year", lead: "A climate student charts monthly temperatures." },
  { ent: "the height of a weight hanging on a spring", y: "height", yu: "centimeters", xu: "seconds", xt: "Time (seconds)", yt: "Height (cm)", x0: "the moment the weight is released", lead: "A physics class observes a bouncing spring." },
  { ent: "the number of hours of daylight in a northern city", y: "daylight", yu: "hours", xu: "months", xt: "Time (months)", yt: "Daylight (hours)", x0: "the start of the year", lead: "An astronomy club tracks daylight over a year." },
  { ent: "the voltage across a component in an alternating-current circuit", y: "voltage", yu: "volts", xu: "milliseconds", xt: "Time (milliseconds)", yt: "Voltage (volts)", x0: "the instant the circuit is switched on", lead: "An engineering student records a circuit." },
  { ent: "the position of a buoy relative to the sea floor", y: "height", yu: "meters", xu: "seconds", xt: "Time (seconds)", yt: "Height (meters)", x0: "the moment the first reading is taken", lead: "An oceanographer tracks a buoy in rolling waves." },
  { ent: "the monthly sales of a seasonal ice cream shop", y: "sales", yu: "hundreds of dollars", xu: "months", xt: "Time (months)", yt: "Sales (hundreds of dollars)", x0: "the start of the year", lead: "A shop owner plots a year of sales." },
  { ent: "the depth of the water in a wave pool", y: "depth", yu: "feet", xu: "seconds", xt: "Time (seconds)", yt: "Depth (feet)", x0: "the moment the wave machine starts", lead: "A water park engineer measures a wave pool." },
  { ent: "the number of customers in a cafe over a day", y: "number of customers", yu: "customers", xu: "hours", xt: "Time (hours)", yt: "Customers (people)", x0: "6 a.m.", lead: "A cafe manager tracks customers through the day." },
  { ent: "the height of a point on a windmill blade above the ground", y: "height", yu: "meters", xu: "seconds", xt: "Time (seconds)", yt: "Height (meters)", x0: "the moment the blade is at its highest point", lead: "A technician monitors a wind turbine." },
  { ent: "the population of a predator species in a nature reserve", y: "population", yu: "animals", xu: "years", xt: "Time (years)", yt: "Population (animals)", x0: "the start of the study", lead: "A biologist models a predator population." },
];

export type SinScene = {
  ctx: TcCtx; kind: "cos" | "sin"; A: number; k: number; T: number; xmax: number; xmin: number; ymax: number; ymin: number; S: number; Y: number;
  fig: { type: "trig_curve"; fn: "sin" | "cos"; amp: number; period: number; mid: number; xUnit: "plain"; xRange: [number, number]; xStep: number; yRange: [number, number]; yStep: number; xTitle: string; yTitle: string; points: { x: number; label: string }[] };
};
/** 사인곡선 장면: 진폭 A, 중심선 k(최솟값 ≥ 1), 주기 T(두 주기를 그림). 최댓점·최솟점이 표시점이고 라벨은 좌표다. */
export function makeSinScene(rng: Rng, o: { T?: number[]; A?: number[]; kind?: "cos" | "sin"; ctx?: TcCtx } = {}): SinScene {
  const ctx = o.ctx ?? rng.pick(TC_CTX); const kind = o.kind ?? rng.pick(["cos", "sin"] as const);
  for (let tr = 0; tr < 200; tr++) {
    const T = rng.pick(o.T ?? [8, 12, 24]); const A = rng.pick(o.A ?? [2, 3, 4, 5, 6]); const k = A + rng.int(1, 6);
    const ymax = k + A, ymin = k - A; const S = [1, 2, 5].find((s) => Math.ceil((ymax + 1) / s) <= 12) ?? 5; const Y = Math.ceil((ymax + 1) / S) * S;
    const xmax = kind === "cos" ? 0 : T / 4, xmin = xmax + T / 2;
    const fig = { type: "trig_curve" as const, fn: kind, amp: A, period: T, mid: k, xUnit: "plain" as const, xRange: [0, 2 * T] as [number, number], xStep: T / 4, yRange: [0, Y] as [number, number], yStep: S, xTitle: ctx.xt, yTitle: ctx.yt, points: [{ x: xmax, label: `(${xmax}, ${ymax})` }, { x: xmin, label: `(${xmin}, ${ymin})` }] };
    if (!Number.isInteger(T / 4)) continue;
    return { ctx, kind, A, k, T, xmax, xmin, ymax, ymin, S, Y, fig };
  }
  throw new GenFail("사인곡선 장면 표집 실패");
}
/** FIGURE(trig_curve, plain)의 두 표시점 라벨 → 진폭·중심선·주기·최댓점 위치와 f(t). */
export const SIN_JS = `if (!FIGURE||FIGURE.type!=='trig_curve') throw new Error('삼각함수 곡선 자료 필요'); const PT=FIGURE.points||[]; if (PT.length<2) throw new Error('표시점 둘 필요');
const pl=(l)=>{ const m=String(l).replace(/−/g,'-').match(/^\\(\\s*(-?\\d+(?:\\.\\d+)?)\\s*,\\s*(-?\\d+(?:\\.\\d+)?)\\s*\\)$/); if(!m) throw new Error('좌표 라벨 형식 오류'); return [Number(m[1]),Number(m[2])]; };
const q1=pl(PT[0].label), q2=pl(PT[1].label); const hi=q1[1]>q2[1]?q1:q2, lo=q1[1]>q2[1]?q2:q1; if (!(hi[1]>lo[1])) throw new Error('최댓·최솟 구분 불가'); const AMP=(hi[1]-lo[1])/2, MID=(hi[1]+lo[1])/2, PER=2*Math.abs(lo[0]-hi[0]); if (!(PER>0)) throw new Error('주기 오류'); const XMAX=hi[0]; const ff=(t)=>{ const v=MID+AMP*Math.cos(2*Math.PI*(t-XMAX)/PER); return Math.abs(v-Math.round(v))<1e-9?Math.round(v):v; };
`;

// ───────────────────────── 삼각비(사인·코사인 곡선의 표시점) ─────────────────────────
const TRIPLES: [number, number, number][] = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]];
export type Rat = [number, number];
export const rat = (n: number, d: number): Rat => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); return [n / g, d / g]; };
export const ratLab = (r: Rat) => `${r[0] < 0 ? "−" : ""}${Math.abs(r[0])}${r[1] === 1 ? "" : `/${r[1]}`}`;
export const ratTxt = (r: Rat) => `${r[0] < 0 ? "-" : ""}${Math.abs(r[0])}${r[1] === 1 ? "" : `/${r[1]}`}`;
export const addR = (a: Rat, b: Rat): Rat => rat(a[0] * b[1] + b[0] * a[1], a[1] * b[1]);
export const subR = (a: Rat, b: Rat): Rat => rat(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
export const mulR = (a: Rat, b: Rat): Rat => rat(a[0] * b[0], a[1] * b[1]);
export const divR = (a: Rat, b: Rat): Rat => rat(a[0] * b[1], a[1] * b[0]);
export const negR = (r: Rat): Rat => [-r[0], r[1]];
export const absR = (r: Rat): Rat => [Math.abs(r[0]), r[1]];
export const invR = (r: Rat): Rat => (r[0] < 0 ? [-r[1], -r[0]] : [r[1], r[0]]);
/** 곡선 y = sin x 또는 cos x (0 ≤ x ≤ 2π) 위의 점: 각 θ(도) = x(π 단위 × 180). 유리 좌표(cos θ, sin θ) 점. */
export type TcPoint = { x: Rat; y: Rat; deg: number; xPi: number };
export function makeTcPoint(rng: Rng, o: { not?: TcPoint } = {}): TcPoint {
  for (let tr = 0; tr < 200; tr++) {
    const [a, b, c] = TRIPLES[rng.int(0, TRIPLES.length - 1)]; const swap = rng.chance(0.5); const sx = rng.chance(0.5) ? 1 : -1, sy = rng.chance(0.5) ? 1 : -1;
    const xn = (swap ? b : a) * sx, yn = (swap ? a : b) * sy; let deg = (Math.atan2(yn, xn) * 180) / Math.PI; if (deg < 0) deg += 360; deg = Math.round(deg * 1000) / 1000;
    const p: TcPoint = { x: rat(xn, c), y: rat(yn, c), deg, xPi: deg / 180 };
    if (o.not && Math.abs(o.not.xPi - p.xPi) < 0.12) continue;
    return p;
  }
  throw new GenFail("곡선 위 점 표집 실패");
}
export type TcTrigFig = { type: "trig_curve"; fn: "sin" | "cos"; amp: 1; period: 2; mid: 0; xUnit: "pi"; xRange: [number, number]; xStep: 0.5; yRange: [number, number]; yStep: 0.5; xTitle: "x"; yTitle: "y"; points: { x: number; label: string; name?: string }[] };
/** 0 ≤ x ≤ 2π 의 사인(또는 코사인) 곡선과 점들. label 은 (a, y) 형태(a 는 문자). */
export const trigFig = (fn: "sin" | "cos", pts: { p: TcPoint; name?: string; label: string }[]): TcTrigFig => ({ type: "trig_curve", fn, amp: 1, period: 2, mid: 0, xUnit: "pi", xRange: [0, 2], xStep: 0.5, yRange: [-1, 1], yStep: 0.5, xTitle: "x", yTitle: "y", points: pts.map((q) => ({ x: q.p.xPi, label: q.label, ...(q.name ? { name: q.name } : {}) })) });
/** 곡선 위 점 라벨에서 y 값(분수)을 읽는 JS — 점 i 의 y(Y_i), 점의 x 위치(XP_i, π 단위)로 부호를 정한다. */
export const TCP_JS = `const pn=(t)=>{ const m=String(t).replace(/−/g,'-').replace(/\\s+/g,'').match(/^(-?)(\\d*)(?:\\/(\\d+))?$/); if(!m||m[2]==='') return NaN; return (m[1]==='-'?-1:1)*Number(m[2])/(m[3]===undefined?1:Number(m[3])); };
if (!FIGURE||FIGURE.type!=='trig_curve') throw new Error('삼각함수 곡선 자료 필요'); const PTS=FIGURE.points||[]; const FN=FIGURE.fn;
const lab=(i)=>{ const q=PTS[i]; if(!q||!q.label) throw new Error('점 라벨 필요'); const m=String(q.label).replace(/−/g,'-').match(/^\\(\\s*([^,]+?)\\s*,\\s*([^)]+?)\\s*\\)$/); if(!m) throw new Error('좌표 라벨 형식 오류'); return [m[1],m[2]]; };
const yv=(i)=>{ const v=pn(lab(i)[1]); if(Number.isNaN(v)) throw new Error('y 값 해석 불가'); if (Math.abs(v)>1) throw new Error('y 값이 곡선 범위 밖'); return v; };
const ang=(i)=>PTS[i].x*Math.PI;
const sgn=(v)=>v<0?-1:1;
const pairAt=(i)=>{ const y=yv(i); const o=Math.sqrt(Math.max(0,1-y*y)); const a=ang(i); const other=FN==='sin'?sgn(Math.cos(a))*o:sgn(Math.sin(a))*o; if (FN==='sin'&&y*Math.sin(a)<-1e-9) throw new Error('y 부호가 곡선과 다름'); if (FN==='cos'&&y*Math.cos(a)<-1e-9) throw new Error('y 부호가 곡선과 다름'); return FN==='sin'?{s:y,c:other}:{c:y,s:other}; };
`;
