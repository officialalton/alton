// 자료 그래프 계열(점도표 DP · 히스토그램 HG · 상자그림 BX · 막대 BR) 공용 장면 키트 — G6 묶음의 조합 파일들이 함께 쓴다.
// 규칙(표·그래프 계열과 같음): 수치를 먼저 뽑고 → figure(data)를 만들고 → 지문은 값을 되풀이하지 않고 "the dot plot shown" 처럼 자료를 가리킨다. 정보는 자료에만 있다.
// verification_js 는 FIGURE 의 dots/bins/boxes/series 만 읽어 다시 계산하고, 자료가 장면의 전제(정수 도수 등)를 어기면 던진다.
import { GenFail } from "../../types";
import type { Rng } from "../../rng";
import { FQ_TOPICS, expand, medianOfList, type FqTopic } from "./table-kit";

export { expand, medianOfList };

// ───────────────────────── 점도표(DP) ─────────────────────────
export type DotScene = { t: FqTopic; vals: number[]; freqs: number[]; N: number; sum: number; fig: { type: "data"; kind: "dot_plot"; dots: { value: number; count: number }[]; xTitle: string } };
export const dotFig = (t: FqTopic, vals: number[], freqs: number[]) => ({ type: "data" as const, kind: "dot_plot" as const, dots: vals.map((v, i) => ({ value: v, count: freqs[i] })), xTitle: `${t.col} (${t.unit})` });
/** 점도표용 주제: 값의 범위가 6 이상이어야 엔진이 정수 눈금(간격 1·2)을 쓴다(범위가 좁으면 0.5 눈금이 나와 어색하다). */
export const DOT_TOPICS: FqTopic[] = FQ_TOPICS.filter((t) => t.hi - t.lo >= 6);
/** 점도표: 연속한 k 개 값(간격 step)이고 값 범위(최대-최소)가 6 이상·눈금 20 칸 이하. 점 개수 1~fmax(≤9; 엔진은 값마다 15 개까지). */
export function makeDot(rng: Rng, o: { k?: number; fmax?: number; topic?: FqTopic; /** 모든 값의 점이 하나(값이 서로 다름) */ distinct?: boolean; /** 전체 점 개수가 홀수 */ odd?: boolean; /** 값 사이 간격이 일정하지 않음(1~3 칸) */ irregular?: boolean } = {}): DotScene {
  const t = o.topic ?? rng.pick(DOT_TOPICS); const span = Math.floor((t.hi - t.lo) / t.step) + 1; const kMin = Math.max(4, Math.ceil(6 / t.step) + 1); const kMax = Math.min(span, 9, Math.floor(20 / t.step) + 1);
  if (kMin > kMax) throw new GenFail("점도표 값 범위");
  const k = o.k !== undefined ? Math.min(Math.max(o.k, kMin), kMax) : rng.int(kMin, kMax);
  let vals: number[];
  if (o.irregular) {
    for (let tr = 0; ; tr++) { if (tr > 80) throw new GenFail("불규칙 점도표 표집 실패"); const g = Array.from({ length: k - 1 }, () => rng.int(1, 3)); const total = g.reduce((a, b) => a + b, 0); if (total + 1 > span || total * t.step < 6 || total * t.step > 20 * t.step) continue; const start = t.lo + t.step * rng.int(0, span - 1 - total); vals = [start]; for (const d of g) vals.push(vals[vals.length - 1] + d * t.step); if (new Set(g).size < 2) continue; break; }
  } else { const start = t.lo + t.step * rng.int(0, span - k); vals = Array.from({ length: k }, (_, i) => start + t.step * i); }
  let freqs = vals.map(() => (o.distinct ? 1 : rng.int(1, Math.min(9, o.fmax ?? 9)))); if (o.odd) for (let tr = 0; tr < 60 && freqs.reduce((a, b) => a + b, 0) % 2 === 0; tr++) freqs = vals.map(() => (o.distinct ? 1 : rng.int(1, Math.min(9, o.fmax ?? 9))));
  const N = freqs.reduce((a, b) => a + b, 0); if (o.odd && N % 2 === 0) throw new GenFail("홀수 개"); const sum = vals.reduce((a, v, i) => a + v * freqs[i], 0);
  return { t, vals, freqs, N, sum, fig: dotFig(t, vals, freqs) };
}
/** FIGURE(점도표)에서 값·점 개수·전체 개수·합·정렬된 펼친 목록·중앙값을 읽는 JS(FQ_JS 와 같은 변수 이름). */
export const DP_JS = "const vals=FIGURE.dots.map(d=>d.value), fr=FIGURE.dots.map(d=>d.count); if (fr.some(f=>f<0||!Number.isInteger(f))) throw new Error('점 개수 오류'); const N=fr.reduce((a,b)=>a+b,0); const S=vals.reduce((a,v,i)=>a+v*fr[i],0); const list=[]; vals.forEach((v,i)=>{ for(let k=0;k<fr[i];k++) list.push(v); }); list.sort((p,q)=>p-q); const med=list.length%2?list[(list.length-1)/2]:(list[list.length/2-1]+list[list.length/2])/2;\n";
export const dpIntro = (rng: Rng, s: DotScene) => rng.pick([
  `The dot plot shows the ${s.t.what} for ${s.t.ent} ${s.t.where}. Each dot represents one of them.`,
  `The dot plot shown summarizes the ${s.t.what} for a group of ${s.t.ent} ${s.t.where}. Each dot stands for one of them.`,
  `A survey recorded the ${s.t.what} for ${s.t.ent} ${s.t.where}. The results are shown in the dot plot, where each dot is one of them.`,
  `In the dot plot shown, each dot is one of a group of ${s.t.ent} ${s.t.where}, and its position shows the ${s.t.what}.`,
]);
export const dpRead = (s: DotScene): [string, string] => [`점도표에서 값과 점 개수를 읽는다: ${s.vals.map((v, i) => `${v}(${s.freqs[i]})`).join(", ")} — 전체 ${s.N}개.`, "Read each value and its number of dots from the dot plot."];
export { gInst } from "./graph-kit";

/** 값 목록 문항 틀(범위·중앙값 등)을 점도표에 쓰기 위한 변환 — vals 가 점 하나하나의 값(오름차순)이다. */
export type DotList = { t: FqTopic; vals: number[]; fig: DotScene["fig"]; base: DotScene };
export const toList = (s: DotScene): DotList => ({ t: s.t, vals: expand(s), fig: s.fig, base: s });
/** DP_JS 에 목록 문항용 이름을 더한다: v(점 하나하나의 값), n(개수), sv(오름차순 정렬). S(합)는 DP_JS 가 이미 정의한다. */
export const DPL_JS = `${DP_JS}const v=list, n=list.length, sv=list;\n`;
export const dlRead = (s: DotList): [string, string] => [`점도표에서 점의 위치를 읽는다: ${s.base.vals.map((v, i) => `${v}(${s.base.freqs[i]}개)`).join(", ")} — 전체 ${s.vals.length}개.`, "Read the position of every dot in the dot plot."];

// ───────────────────────── 막대그래프(BR) ─────────────────────────
// 개수 장면(행 이름 × 개수, _t4-kit)을 막대로 그린다. 막대 높이를 눈금(격자선)에서 정확히 읽도록 값은 세로 눈금 간격의 배수로만 만든다.
import { COUNT_TOPICS, retry, lcFirst, type CountTopic, type CountScene } from "./items/_t4-kit";
export type BarScene = CountScene & { yStep: number; yMax: number; fig: { type: "data"; kind: "bar"; categories: string[]; series: { values: number[] }[]; xTitle: string; yTitle: string; yMin: number; yMax: number; yStep: number } };
export const barFig = (s: { t: CountTopic; names: string[]; vals: number[]; yStep: number; yMax: number }) => ({ type: "data" as const, kind: "bar" as const, categories: s.names, series: [{ values: s.vals }], xTitle: s.t.rowHead, yTitle: `${s.t.col} (${s.t.unit})`, yMin: 0, yMax: s.yMax, yStep: s.yStep });
/** 범주 이름에 숫자가 있으면(Route 1·Line 2) 지문이 두 범주를 말할 때 엔진의 값 대조(lint)가 다른 범주의 숫자를 값으로 오인하고, 이름이 길면(12자 초과) 축 아래에 놓이지 않는다. */
export const BAR_TOPICS = COUNT_TOPICS.filter((t) => t.rows.every((r) => !/\d/.test(r) && r.length <= 12));
const Y_STEPS = [5, 10, 20, 25, 40, 50, 100, 200];
/** 막대 장면: n 개 막대, 값은 lo~hi 안의 세로 눈금 간격(step 의 배수) 배수이고 서로 다르다. */
export function barScene(rng: Rng, n: number, lo: number, hi: number, step: number, topic?: CountTopic): BarScene {
  const t = topic ?? rng.pick(BAR_TOPICS); const names = rng.shuffle(t.rows).slice(0, n).sort((a, b) => t.rows.indexOf(a) - t.rows.indexOf(b));
  const steps = Y_STEPS.filter((y) => y % step === 0 && hi / y >= 4 && hi / y <= 10 && Math.floor(hi / y) - Math.ceil(lo / y) + 1 >= n);
  if (!steps.length) throw new GenFail("막대 눈금 간격 없음"); const yStep = rng.pick(steps);
  return retry(40, () => { const vals = names.map(() => yStep * rng.int(Math.ceil(lo / yStep), Math.floor(hi / yStep))); if (new Set(vals).size !== n) return null; const yMax = (Math.floor(Math.max(...vals) / yStep) + 1) * yStep; return { t, names, vals, yStep, yMax, fig: barFig({ t, names, vals, yStep, yMax }) }; }, "막대 장면");
}
export const bar = (s: BarScene) => s.fig;
export const barIntro = (rng: Rng, s: CountScene, when = rng.pick(["last month", "last week", "on one Saturday", "during one month", "last year", "during a holiday weekend"])) => rng.pick([
  `${s.t.who} recorded the number of ${s.t.what} ${s.t.prep} each of ${s.names.length} ${s.t.many} ${when}. The results are shown in the graph.`,
  `The graph shows the number of ${s.t.what} ${s.t.prep} each of ${s.names.length} ${s.t.many} ${when}.`,
  `The number of ${s.t.what} ${s.t.prep} each of several ${s.t.many} ${when} is given in the graph shown.`,
  `For a report, ${lcFirst(s.t.who)} charted the number of ${s.t.what} ${s.t.prep} several ${s.t.many} ${when}, as shown in the graph.`,
]);
/** FIGURE(막대)에서 이름 nm·값 v·합 S·조회 at 을 읽는 JS(ROW_JS 와 같은 변수 이름). */
export const BAR_ROW_JS = "const nm=FIGURE.categories; const v=FIGURE.series[0].values; if (v.some(x=>typeof x!=='number')||v.length!==nm.length) throw new Error('값 오류'); const S=v.reduce((a,b)=>a+b,0); const at=(k)=>{ const i=nm.indexOf(k); if (i<0) throw new Error('막대 없음'); return v[i]; };\n";

// ── 두 기간 묶음 막대(범례 있음): 기간 1·기간 2 의 값이 모두 세로 눈금 간격의 배수 ──
import { PERIODS, pLow, type TwoScene } from "./items/_t4-kit";
export type TwoBar = TwoScene & { yStep: number; yMax: number; fig: { type: "data"; kind: "bar"; categories: string[]; series: { name: string; values: number[] }[]; xTitle: string; yTitle: string; yMin: number; yMax: number; yStep: number } };
export const twoBarFig = (s: { t: CountTopic; names: string[]; vals: number[]; v2: number[]; p: [string, string]; yStep: number; yMax: number }) => ({ type: "data" as const, kind: "bar" as const, categories: s.names, series: [{ name: s.p[0], values: s.vals }, { name: s.p[1], values: s.v2 }], xTitle: s.t.rowHead, yTitle: `${s.t.col} (${s.t.unit})`, yMin: 0, yMax: s.yMax, yStep: s.yStep });
/** 두 기간 막대 장면: 막대 높이는 눈금 칸 수(1~10)의 정수배, 행마다 변화율이 pcts 안에 든다(칸 수 a→b 의 정확한 퍼센트 변화). */
export function twoSceneBar(rng: Rng, n: number, pcts: number[]): TwoBar {
  const t = rng.pick(BAR_TOPICS); const names = rng.shuffle(t.rows).slice(0, n).sort((a, b) => t.rows.indexOf(a) - t.rows.indexOf(b)); const p = rng.pick(PERIODS.filter((q) => q.every((x) => !/\d/.test(x)))) as [string, string];
  const pairs: [number, number, number][] = []; for (let a = 2; a <= 10; a++) for (let b = 1; b <= 10; b++) { if (a === b) continue; const pc = ((b - a) * 100) / a; if (Number.isInteger(pc) && pcts.includes(pc)) pairs.push([a, b, pc]); }
  if (pairs.length < n) throw new GenFail("두 기간 막대 쌍 부족");
  const yStep = rng.pick([10, 20, 25, 50]);
  return retry(60, () => {
    const pick = rng.shuffle(pairs).slice(0, n); if (new Set(pick.map((q) => q[0])).size !== n) return null;
    const vals = pick.map((q) => q[0] * yStep), v2 = pick.map((q) => q[1] * yStep), pct = pick.map((q) => q[2]); const yMax = (Math.max(...pick.map((q) => Math.max(q[0], q[1]))) + 1) * yStep;
    return { t, names, vals, p, v2, pct, yStep, yMax, fig: twoBarFig({ t, names, vals, v2, p, yStep, yMax }) };
  }, "두 기간 막대 장면");
}
export const twoBar = (s: TwoBar) => s.fig;
export const twoBarIntro = (rng: Rng, s: TwoScene) => rng.pick([
  `The graph shows the number of ${s.t.what} ${s.t.prep} each of ${s.names.length} ${s.t.many} in two time periods.`,
  `${s.t.who} compared the number of ${s.t.what} ${s.t.prep} several ${s.t.many} in two periods, as shown in the graph.`,
  `The graph shown gives the number of ${s.t.what} ${s.t.prep} ${s.names.length} ${s.t.many}, for ${pLow(s.p[0])} and for ${pLow(s.p[1])}.`,
  `For each of several ${s.t.many}, the graph shown gives the number of ${s.t.what} in two periods.`,
]);
/** FIGURE(묶음 막대)에서 이름 nm·a(기간 1)·b(기간 2)·idx·pc 를 읽는 JS(TWO_JS 와 같은 변수 이름). */
export const BAR_TWO_JS = "const nm=FIGURE.categories; const a=FIGURE.series[0].values, b=FIGURE.series[1].values; if (a.some(x=>typeof x!=='number'||x<=0)||b.some(x=>typeof x!=='number')||a.length!==nm.length||b.length!==nm.length) throw new Error('값 오류'); const idx=(k)=>{ const i=nm.indexOf(k); if (i<0) throw new Error('막대 없음'); return i; }; const pc=(i)=>(b[i]-a[i])/a[i]*100;\n";

// ── 도수 막대(값 × 개수): 도수표(FQ)와 같은 장면을 막대로 — 값이 가로축 범주, 막대 높이가 도수 ──
import { FQ_TOPICS as _FQ, type FqTopic as _FqT } from "./table-kit";
export type BarFqScene = { t: _FqT; vals: number[]; freqs: number[]; N: number; sum: number; fig: { type: "data"; kind: "bar"; categories: string[]; series: { values: number[] }[]; xTitle: string; yTitle: string; yMin: number; yMax: number; yStep: number } };
export const barFqFig = (t: _FqT, vals: number[], freqs: number[]) => ({ type: "data" as const, kind: "bar" as const, categories: vals.map(String), series: [{ values: freqs }], xTitle: `${t.col} (${t.unit})`, yTitle: `${t.cnt} (${t.ent})`, yMin: 0, yMax: Math.max(...freqs) + 1, yStep: 1 });
/** 도수 막대 장면: 연속한 k(4~6)개 값, 도수 1~fmax(≤9 — 세로 눈금을 1 칸 간격으로 두어 정확히 읽는다). */
export function makeBarFq(rng: Rng, o: { k?: number; fmax?: number; topic?: _FqT } = {}): BarFqScene {
  const t = o.topic ?? rng.pick(_FQ); const span = Math.floor((t.hi - t.lo) / t.step) + 1; const k = Math.min(o.k ?? rng.int(4, 6), span);
  const start = t.lo + t.step * rng.int(0, span - k); const vals = Array.from({ length: k }, (_, i) => start + t.step * i);
  const freqs = vals.map(() => rng.int(1, Math.min(9, o.fmax ?? 9))); const N = freqs.reduce((a, b) => a + b, 0); const sum = vals.reduce((a, v, i) => a + v * freqs[i], 0);
  return { t, vals, freqs, N, sum, fig: barFqFig(t, vals, freqs) };
}
/** FIGURE(도수 막대)에서 값·도수·전체·합·목록·중앙값을 읽는 JS(FQ_JS 와 같은 변수 이름). */
export const BF_JS = "const vals=FIGURE.categories.map(Number), fr=FIGURE.series[0].values; if (vals.some(v=>!Number.isFinite(v))||fr.some(f=>f<0||!Number.isInteger(f))) throw new Error('값·도수 오류'); const N=fr.reduce((a,b)=>a+b,0); const S=vals.reduce((a,v,i)=>a+v*fr[i],0); const list=[]; vals.forEach((v,i)=>{ for(let k=0;k<fr[i];k++) list.push(v); }); list.sort((p,q)=>p-q); const med=list.length%2?list[(list.length-1)/2]:(list[list.length/2-1]+list[list.length/2])/2;\n";
export const bfIntro = (rng: Rng, s: BarFqScene) => rng.pick([
  `The graph shown gives the ${s.t.what} for ${s.t.ent} ${s.t.where}. Bar heights give the number of ${s.t.ent} with each value.`,
  `The graph shown summarizes the ${s.t.what} for a group of ${s.t.ent} ${s.t.where}; bar heights give how many ${s.t.ent} had each value.`,
  `A survey recorded the ${s.t.what} for ${s.t.ent} ${s.t.where}. The results are shown in the graph, with bar heights counting ${s.t.ent}.`,
]);
export const bfRead = (s: BarFqScene): [string, string] => [`그래프에서 값과 막대 높이(도수)를 읽는다: ${s.vals.map((v, i) => `${v}(${s.freqs[i]})`).join(", ")} — 전체 ${s.N}개.`, "Read each value and its bar height."];

// ───────────────────────── 상자그림(BX) ─────────────────────────
// 다섯 수 요약(최솟값·Q1·중앙값·Q3·최댓값)을 눈금 간격의 배수로 만든다 — 엔진의 가로 눈금 간격(niceStep(범위, 8))이 s 가 되도록 범위를 s 의 5~8 배로 둔다.
export type BoxTopic = { what: string; ent: string; where: string; unit: string; col: string; names: [string, string]; lo: number };
export const BOX_TOPICS: BoxTopic[] = [
  { what: "scores on a math test", ent: "students", where: "in a school", unit: "points", col: "Test score", names: ["Morning section", "Afternoon section"], lo: 40 },
  { what: "times to finish a race", ent: "runners", where: "in a city race", unit: "minutes", col: "Finish time", names: ["Men's race", "Women's race"], lo: 20 },
  { what: "daily sales", ent: "days", where: "at a bakery", unit: "dollars", col: "Daily sales", names: ["Spring", "Fall"], lo: 100 },
  { what: "heights of plants", ent: "plants", where: "in a greenhouse", unit: "centimeters", col: "Plant height", names: ["Variety A", "Variety B"], lo: 10 },
  { what: "waiting times for appointments", ent: "patients", where: "at a clinic", unit: "minutes", col: "Waiting time", names: ["Clinic A", "Clinic B"], lo: 5 },
  { what: "lengths of phone calls", ent: "calls", where: "at a help desk", unit: "minutes", col: "Call length", names: ["Weekday", "Weekend"], lo: 2 },
  { what: "weights of packages", ent: "packages", where: "at a shipping center", unit: "pounds", col: "Package weight", names: ["Ground", "Air"], lo: 4 },
  { what: "monthly electricity bills", ent: "households", where: "in a neighborhood", unit: "dollars", col: "Monthly bill", names: ["Summer", "Winter"], lo: 40 },
  { what: "battery lives", ent: "phones", where: "in a product test", unit: "hours", col: "Battery life", names: ["Model X", "Model Y"], lo: 6 },
  { what: "commute distances", ent: "workers", where: "at a company", unit: "miles", col: "Commute distance", names: ["Office A", "Office B"], lo: 2 },
  { what: "typing speeds", ent: "applicants", where: "for an office job", unit: "words per minute", col: "Typing speed", names: ["Team A", "Team B"], lo: 20 },
  { what: "resting heart rates", ent: "athletes", where: "on a team", unit: "beats per minute", col: "Heart rate", names: ["Sprinters", "Distance runners"], lo: 40 },
];
export type BoxFive = { min: number; q1: number; median: number; q3: number; max: number };
export type BoxScene = { t: BoxTopic; s: number; R: number; boxes: BoxFive[]; names: string[]; fig: { type: "data"; kind: "boxplot"; boxes: { name: string; min: number; q1: number; median: number; q3: number; max: number }[]; xTitle: string } };
const SS = [1, 2, 5, 10];
/**
 * 상자그림 장면: 모든 수가 눈금 간격 s 의 배수. 첫 상자의 범위 = s×R(R 5~8) 로 두어 엔진의 눈금 간격이 s 가 된다.
 * 둘째 상자(groups=2)는 같은 축 안(첫 상자의 최솟값~최댓값)에 놓인다. 이름은 두 집단일 때만 의미가 있다.
 */
export function makeBox(rng: Rng, o: { groups?: 1 | 2; topic?: BoxTopic; /** 한 상자의 구간(최소~Q1 등)이 모두 달라 서로 구별되게 */ strict?: boolean } = {}): BoxScene {
  const t = o.topic ?? rng.pick(BOX_TOPICS); const s = rng.pick(SS); const R = rng.int(5, 8); const g = o.groups ?? 1;
  const base = Math.ceil(t.lo / s) * s + s * rng.int(0, 3);
  const five = (lo: number, hi: number): BoxFive | null => { const p = [lo, ...rng.shuffle(Array.from({ length: hi - lo - 1 }, (_, i) => lo + 1 + i)).slice(0, 3).sort((a, b) => a - b), hi]; if (p.length !== 5 || new Set(p).size !== 5) return null; return { min: base + p[0] * s, q1: base + p[1] * s, median: base + p[2] * s, q3: base + p[3] * s, max: base + p[4] * s }; };
  const boxes: BoxFive[] = []; const b1 = five(0, R); if (!b1) throw new GenFail("상자 표집 실패"); boxes.push(b1);
  if (g === 2) { for (let tr = 0; tr < 40; tr++) { const lo = rng.int(0, 2), hi = rng.int(R - 2, R); if (hi - lo < 4) continue; const b = five(lo, hi); if (b && JSON.stringify(b) !== JSON.stringify(b1)) { boxes.push(b); break; } } if (boxes.length < 2) throw new GenFail("둘째 상자 표집 실패"); }
  const names = g === 2 ? [...t.names] : [t.ent.charAt(0).toUpperCase() + t.ent.slice(1)];
  return { t, s, R, boxes, names, fig: { type: "data", kind: "boxplot", boxes: boxes.map((b, i) => ({ name: names[i], ...b })), xTitle: `${t.col} (${t.unit})` } };
}
/** FIGURE(상자그림)에서 상자 배열 B 와 다섯 수 이름 배열 K 를 읽는 JS. 값이 min ≤ q1 ≤ median ≤ q3 ≤ max 가 아니면 던진다. */
export const BX_JS = "const B=FIGURE.boxes; if (!B||!B.length) throw new Error('상자 없음'); for (const b of B) { const v=[b.min,b.q1,b.median,b.q3,b.max]; if (v.some(x=>typeof x!=='number')) throw new Error('값 오류'); for (let i=1;i<5;i++) if (v[i]<v[i-1]) throw new Error('다섯 수 순서 오류'); } const K=['min','q1','median','q3','max'];\n";
export const bxIntro = (rng: Rng, s: BoxScene) => rng.pick([
  `The box plot shown summarizes the ${s.t.what} for ${s.t.ent} ${s.t.where}.`,
  `A box plot is shown for the ${s.t.what} of ${s.t.ent} ${s.t.where}.`,
  `The box plot shown gives the five-number summary of the ${s.t.what} for ${s.t.ent} ${s.t.where}.`,
]);
export const bxIntro2 = (rng: Rng, s: BoxScene) => rng.pick([
  `The box plots shown compare the ${s.t.what} for ${s.t.ent} ${s.t.where} in two groups.`,
  `Two box plots are shown, one for each of two groups of ${s.t.ent} ${s.t.where}, for the ${s.t.what}.`,
  `The box plots shown summarize the ${s.t.what} of two groups of ${s.t.ent} ${s.t.where}.`,
]);
export const bxRead = (s: BoxScene, i = 0): [string, string] => { const b = s.boxes[i]; return [`상자그림${s.boxes.length > 1 ? `(${s.names[i]})` : ""}에서 다섯 수를 읽는다: 최솟값 ${b.min}, Q1 ${b.q1}, 중앙값 ${b.median}, Q3 ${b.q3}, 최댓값 ${b.max}.`, "Read the five-number summary from the box plot."]; };
