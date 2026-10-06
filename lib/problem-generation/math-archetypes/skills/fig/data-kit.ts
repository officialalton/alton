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
