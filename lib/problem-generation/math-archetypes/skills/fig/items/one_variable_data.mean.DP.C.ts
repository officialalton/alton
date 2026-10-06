// one_variable_data.mean.DP.C — 조건(평균·개수·합계·중앙값·최빈값)을 만족하는 점도표를 4개 중에서 고른다.
// 네 점도표는 같은 값(같은 가로 눈금)에 점이 하나 이상씩 있고 가장 높은 점 개수가 같아 크기·축이 같다. 오답은 조건 A 만 / B 만 / 둘 다 어긋난 그림이다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { defineItem } from "../item-kit";
import { dotFig, makeDot } from "../data-kit";
import { SPR_NO_DATA_CHOICE, cInst, oneCond, poolChoices, twoCond } from "../data-c-kit";

const STATS = "const d=c.dots; const fr=d.map(x=>x.count), v=d.map(x=>x.value); const N=fr.reduce((a,b)=>a+b,0); const S=v.reduce((a,x,i)=>a+x*fr[i],0); const list=[]; v.forEach((x,i)=>{for(let k=0;k<fr[i];k++)list.push(x)}); list.sort((p,q)=>p-q); const med=N%2?list[(N-1)/2]:(list[N/2-1]+list[N/2])/2; const mx=Math.max(...fr); const top=v.filter((x,i)=>fr[i]===mx); const mode=top.length===1?top[0]:null; return {N,S,mean:S/N,med,mode};";
type Sc = { t: ReturnType<typeof makeDot>["t"]; vals: number[]; Fm: number };
const vec = (rng: Rng, s: Sc) => { const f = s.vals.map(() => rng.int(1, s.Fm)); f[rng.int(0, f.length - 1)] = s.Fm; return f; };
const stat = (s: Sc, f: number[]) => { const N = f.reduce((a, b) => a + b, 0), S = f.reduce((a, c, i) => a + c * s.vals[i], 0); const list: number[] = []; f.forEach((c, i) => { for (let k = 0; k < c; k++) list.push(s.vals[i]); }); const med = N % 2 ? list[(N - 1) / 2] : (list[N / 2 - 1] + list[N / 2]) / 2; const top = s.vals.filter((_, i) => f[i] === Math.max(...f)); return { N, S, mean: S / N, med, mode: top.length === 1 ? top[0] : null }; };
function scene(rng: Rng): Sc { const d = makeDot(rng, { k: rng.int(5, 6) }); return { t: d.t, vals: d.vals, Fm: rng.int(4, 6) }; }
const fig = (s: Sc, f: number[]) => dotFig(s.t, s.vals, f);
const pool = (rng: Rng, s: Sc, n = 1600) => Array.from({ length: n }, () => fig(s, vec(rng, s)));
/** 조건을 만족하는 정답 벡터를 찾는다. */
function okVec(rng: Rng, s: Sc, good: (st: ReturnType<typeof stat>) => boolean): number[] { for (let i = 0; i < 600; i++) { const f = vec(rng, s); const st = stat(s, f); if (st.N >= 12 && st.N <= 30 && good(st)) return f; } throw new GenFail("정답 점도표 표집 실패"); }
const intro = (s: Sc, rng: Rng) => rng.pick([
  `The ${s.t.what} was recorded for a group of ${s.t.ent} ${s.t.where}.`,
  `A researcher collected data on the ${s.t.what} for ${s.t.ent} ${s.t.where}, and four possible dot plots of the data are shown.`,
  `Four dot plots are shown as candidates for a data set: the ${s.t.what} for ${s.t.ent} ${s.t.where}.`,
  `A survey of ${s.t.ent} ${s.t.where} asked about the ${s.t.what}. Each dot in a plot below stands for one of them.`,
]);
const Q = ["Which of the following dot plots could show these data?", "Which dot plot is consistent with the information given?", "Which of the dot plots shown matches this description?"];
const TAIL: [string, string] = ["다른 점도표는 조건 하나 이상이 어긋난다.", "Each other dot plot violates at least one condition."];
const readOk = (s: Sc, f: number[]): [string, string] => [`정답 점도표: ${s.vals.map((v, i) => `${v}(${f[i]})`).join(", ")}.`, "The correct dot plot."];

export const ITEM = defineItem({
  prefix: "ovd", itemId: "one_variable_data.mean.DP.C",
  hard: [
    {
      op: "inverse", sprNo: SPR_NO_DATA_CHOICE, structure: "평균과 전체 개수를 서술로 주고, 값×점 개수의 합이 평균×개수와 같은 점도표를 4개 중에서 고름", extra: "평균 × 개수 = 합을 세워 네 점도표의 가중 합과 개수를 모두 대조해야 함(개수만 맞거나 평균만 맞는 그림이 함정) — medium 은 평균 하나",
      concepts: ["점도표", "평균", "합 = 평균 × 개수"],
      gen(rng) {
        const s = scene(rng); const f = okVec(rng, s, (st) => st.S % st.N === 0); const st = stat(s, f); const M = st.S / st.N, n = st.N;
        const P = { M, n }; const c = twoCond(STATS, "s.S === P.M * s.N", "s.N === P.n", ["mean_off", "count_off", "both_off"]);
        const ch = poolChoices(rng, { ok: fig(s, f), pool: pool(rng, s), P, ...c });
        return cInst(rng, ch, { stimulus: `${intro(s, rng)} ${rng.pick([`The mean of the data is ${M} ${s.t.unit}, and there are ${n} values in all.`, `There are ${n} values, and their mean is ${M} ${s.t.unit}.`, `The data set has ${n} values with an average of ${M} ${s.t.unit}.`])}`, question: rng.pick(Q), P, ...c, variant: "dot_plot_by_mean_and_count", trace: [[`평균이 ${M} 이고 개수가 ${n} 이므로 합은 ${M} × ${n} = ${st.S} 이어야 한다.`, "Sum = mean × count."], [`각 점도표에서 점 개수의 합이 ${n} 인지, 값×점 개수의 합이 ${st.S} 인지 확인한다.`, "Check the count and the weighted sum."], ["조건을 만족하지 못하는 점도표를 하나씩 지워 나간다.", "Eliminate the plots that fail a condition."], readOk(s, f)] }, TAIL);
      },
    },
    {
      op: "chain2", sprNo: SPR_NO_DATA_CHOICE, structure: "모든 값의 합과 중앙값을 서술로 주고, 두 조건을 동시에 만족하는 점도표를 4개 중에서 고름", extra: "합을 점 개수 가중으로 계산하고 중앙값 위치를 따로 찾아 네 점도표를 두 조건으로 걸러야 함 — medium 은 평균 하나",
      concepts: ["점도표", "합", "중앙값"],
      gen(rng) {
        const s = scene(rng); const f = okVec(rng, s, () => true); const st = stat(s, f); const T = st.S, m = st.med;
        const P = { T, m }; const c = twoCond(STATS, "s.S === P.T", "s.med === P.m", ["total_off", "median_off", "both_off"]);
        const ch = poolChoices(rng, { ok: fig(s, f), pool: pool(rng, s), P, ...c });
        return cInst(rng, ch, { stimulus: `${intro(s, rng)} ${rng.pick([`The values in the data have a total of ${T} ${s.t.unit}, and the median of the data is ${m} ${s.t.unit}.`, `Adding up every value gives ${T} ${s.t.unit}; the middle value of the ordered data is ${m} ${s.t.unit}.`, `The sum of all the values is ${T} ${s.t.unit}, and the median is ${m} ${s.t.unit}.`])}`, question: rng.pick(Q), P, ...c, variant: "dot_plot_by_total_and_median", trace: [[`각 점도표에서 값×점 개수를 더해 합이 ${T} 인지 본다.`, "Compute the weighted total of each plot."], [`점을 왼쪽부터 세어 가운데 값(중앙값)이 ${m} 인지 본다.`, "Locate the middle value."], ["조건을 만족하지 못하는 점도표를 하나씩 지워 나간다.", "Eliminate the plots that fail a condition."], readOk(s, f)] }, TAIL);
      },
    },
    {
      op: "compare_scenarios", sprNo: SPR_NO_DATA_CHOICE, structure: "모든 값에 a 를 더하면 평균이 M2 가 된다는 상황과 전체 개수를 주고, 원래 평균이 M2-a 인 점도표를 고름", extra: "덧셈 변환 후의 평균에서 원래 평균을 거꾸로 구한 뒤 합·개수를 점도표와 대조해야 함 — medium 은 평균 하나",
      concepts: ["점도표", "평균", "자료 변환(덧셈)"],
      gen(rng) {
        const s = scene(rng); const f = okVec(rng, s, (st) => st.S % st.N === 0); const st = stat(s, f); const a = rng.int(2, 9), M0 = st.S / st.N, n = st.N, M2 = M0 + a;
        const P = { a, M2, n }; const c = twoCond(STATS, "s.S + P.a * s.N === P.M2 * s.N", "s.N === P.n", ["mean_off", "count_off", "both_off"]);
        const ch = poolChoices(rng, { ok: fig(s, f), pool: pool(rng, s), P, ...c });
        return cInst(rng, ch, { stimulus: `${intro(s, rng)} ${rng.pick([`There are ${n} values in all. If ${a} ${s.t.unit} were added to every value, the mean of the new values would be ${M2} ${s.t.unit}.`, `The data set has ${n} values. After raising each value by ${a} ${s.t.unit}, the mean becomes ${M2} ${s.t.unit}.`, `Suppose every one of the ${n} values is increased by ${a} ${s.t.unit}; the new average would be ${M2} ${s.t.unit}.`])}`, question: rng.pick(["Which dot plot could show the original data?", ...Q]), P, ...c, variant: "dot_plot_by_shifted_mean", trace: [[`모든 값에 ${a} 를 더하면 평균도 ${a} 늘므로 원래 평균은 ${M2} - ${a} = ${M0} 이다.`, "Adding a constant shifts the mean by that constant."], [`원래 합은 ${M0} × ${n} = ${st.S} 이어야 한다.`, "Original sum = mean × count."], ["조건을 만족하지 못하는 점도표를 하나씩 지워 나간다.", "Eliminate the plots that fail a condition."], readOk(s, f)] }, TAIL);
      },
    },
    {
      op: "param_condition", sprNo: SPR_NO_DATA_CHOICE, structure: "평균이 L 보다 크고 U 보다 작으며 가장 많은 점이 있는 값이 m 인 점도표를 4개 중에서 고름", extra: "평균의 범위 조건(부등식)과 최빈값을 함께 만족하는지 네 점도표를 검사해야 함 — medium 은 평균 하나",
      concepts: ["점도표", "평균의 범위", "최빈값"],
      gen(rng) {
        const s = scene(rng); const f = okVec(rng, s, (st) => st.mode !== null); const st = stat(s, f); const L = Math.ceil(st.mean) - 1, U = Math.floor(st.mean) + 1, m = st.mode as number;
        const P = { L, U, m }; const c = twoCond(STATS, "s.mean > P.L && s.mean < P.U", "s.mode === P.m", ["mean_range_off", "mode_off", "both_off"]);
        const ch = poolChoices(rng, { ok: fig(s, f), pool: pool(rng, s), P, ...c });
        return cInst(rng, ch, { stimulus: `${intro(s, rng)} ${rng.pick([`The mean of the data is greater than ${L} ${s.t.unit} and less than ${U} ${s.t.unit}, and the value that occurs most often is ${m} ${s.t.unit}.`, `The most common value is ${m} ${s.t.unit}, and the mean falls between ${L} and ${U} ${s.t.unit}, not including either.`, `Between ${L} and ${U} ${s.t.unit} (exclusive) lies the mean, and ${m} ${s.t.unit} is the value with the most data points.`])}`, question: rng.pick(Q), P, ...c, variant: "dot_plot_by_mean_range_and_mode", trace: [[`각 점도표의 평균이 ${L} 와 ${U} 사이인지 가중 합으로 확인한다.`, "Check that the mean lies between the bounds."], [`점이 가장 많이 쌓인 값이 ${m} 인지 확인한다.`, "Check the most frequent value."], ["조건을 만족하지 못하는 점도표를 하나씩 지워 나간다.", "Eliminate the plots that fail a condition."], readOk(s, f)] }, TAIL);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "total_dots", sprNo: SPR_NO_DATA_CHOICE, structure: "전체 개수가 n 인 점도표를 4개 중에서 고름", extra: "easy: 점 개수 합", concepts: ["점도표", "전체 개수"],
      gen(rng) {
        const s = scene(rng); const f = okVec(rng, s, () => true); const n = stat(s, f).N; const P = { n }; const c = oneCond(STATS, "s.N", "P.n", "3");
        const ch = poolChoices(rng, { ok: fig(s, f), pool: pool(rng, s), P, ...c });
        return cInst(rng, ch, { stimulus: `${intro(s, rng)} ${rng.pick([`The data set has ${n} values in all.`, `There are ${n} ${s.t.ent} in the data.`, `The total number of values is ${n}.`])}`, question: "Which of the following dot plots shows exactly this many values?", P, ...c, variant: "dot_plot_by_count", trace: [[`각 점도표의 점 개수를 모두 더한다.`, "Add the dots in each plot."], readOk(s, f)] }, ["개수가 다른 점도표는 정답이 아니다.", "A plot with a different count is not correct."]);
      },
    },
    {
      lv: "medium", name: "mean_only", sprNo: SPR_NO_DATA_CHOICE, structure: "평균이 M 인 점도표를 4개 중에서 고름", extra: "medium: 가중 합 ÷ 개수", concepts: ["점도표", "평균"],
      gen(rng) {
        const s = scene(rng); const f = okVec(rng, s, (st) => st.S % st.N === 0); const st = stat(s, f); const M = st.S / st.N; const P = { M }; const c = oneCond(STATS, "s.mean", "P.M", "1");
        const ch = poolChoices(rng, { ok: fig(s, f), pool: pool(rng, s), P, ...c });
        return cInst(rng, ch, { stimulus: `${intro(s, rng)} ${rng.pick([`The mean of the data is ${M} ${s.t.unit}.`, `The average value is ${M} ${s.t.unit}.`, `The data have a mean of ${M} ${s.t.unit}.`])}`, question: rng.pick(Q), P, ...c, variant: "dot_plot_by_mean", trace: [[`각 점도표에서 값×점 개수의 합을 개수로 나눠 평균을 구한다.`, "Mean = weighted sum ÷ count."], readOk(s, f)] }, ["평균이 ${M} 이 아닌 점도표는 정답이 아니다.".replace("${M}", String(M)), "A plot with a different mean is not correct."]);
      },
    },
  ],
});
