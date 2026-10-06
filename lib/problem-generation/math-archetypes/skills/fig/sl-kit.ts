// 줄기-잎 그림(SL) 공용 장면 키트 — one_variable_data.{mean,median,range,outlier_effect,quartile_percentile_from_plot}.SL.P 가 함께 쓴다.
// 규칙(자료 계열 공통): 수치를 먼저 뽑고 → figure(stem_leaf)를 만들고 → 지문은 값을 되풀이하지 않고 "the stem-and-leaf plot shown" 으로 가리킨다. 정보는 자료에만 있다.
// verification_js 는 FIGURE 의 stems·stemUnit 만 읽어 값 목록을 다시 만든다.
import { GenFail, type Instance } from "../../types";
import type { Rng } from "../../rng";
import { fmtNum } from "../../text";
import { W } from "../d-kit";
import { figJs } from "../../figure-kit";
import { defineItem, type HardDef, type EmDef } from "./item-kit";
import { gInst } from "./graph-kit";

export type SlTopic = { ph: string; what: string; ent: string; where: string; unit: string; title: string; lo: number; hi: number; decUnit?: string };
export const SL_TOPICS: SlTopic[] = [
  { ph: "the times to finish a puzzle for players in a game club", what: "times to finish a puzzle", ent: "players", where: "in a game club", unit: "minutes", title: "Puzzle times", lo: 1, hi: 6 },
  { ph: "the scores on a quiz for students in a class", what: "scores on a quiz", ent: "students", where: "in a class", unit: "points", title: "Quiz scores", lo: 4, hi: 9 },
  { ph: "the ages of the members of a hiking club", what: "ages of the members", ent: "members", where: "of a hiking club", unit: "years", title: "Member ages", lo: 2, hi: 7 },
  { ph: "the number of customers each day at a cafe", what: "number of customers each day", ent: "days", where: "at a cafe", unit: "customers", title: "Daily customers", lo: 2, hi: 8 },
  { ph: "the lengths of phone calls at a help desk", what: "lengths of phone calls", ent: "calls", where: "at a help desk", unit: "minutes", title: "Call lengths", lo: 1, hi: 6 },
  { ph: "the heights of plants in a greenhouse", what: "heights of plants", ent: "plants", where: "in a greenhouse", unit: "centimeters", title: "Plant heights", lo: 2, hi: 8 },
  { ph: "the weights of packages at a shipping center", what: "weights of packages", ent: "packages", where: "at a shipping center", unit: "pounds", title: "Package weights", lo: 1, hi: 6 },
  { ph: "the number of pages read each week by a reader", what: "number of pages read each week", ent: "weeks", where: "by a reader", unit: "pages", title: "Pages read", lo: 3, hi: 8 },
  { ph: "the waiting times for patients at a clinic", what: "waiting times for appointments", ent: "patients", where: "at a clinic", unit: "minutes", title: "Waiting times", lo: 1, hi: 6 },
  { ph: "the distances jumped by athletes in a school meet", what: "distances jumped in a contest", ent: "athletes", where: "in a school meet", unit: "inches", title: "Jump distances", lo: 3, hi: 8 },
  { ph: "the number of emails received each day by an office", what: "number of emails received each day", ent: "days", where: "by an office", unit: "emails", title: "Daily emails", lo: 2, hi: 7 },
  { ph: "the battery lives of phones in a product test", what: "battery lives", ent: "phones", where: "in a product test", unit: "hours", title: "Battery lives", lo: 2, hi: 7 },
];
export const SL_DEC_TOPICS: SlTopic[] = [
  { ph: "the masses of rock samples from a quarry", what: "masses of rock samples", ent: "samples", where: "from a quarry", unit: "kilograms", title: "Sample masses", lo: 1, hi: 8 },
  { ph: "the lengths of leaves from one tree", what: "lengths of leaves", ent: "leaves", where: "from one tree", unit: "inches", title: "Leaf lengths", lo: 1, hi: 8 },
  { ph: "the amounts of rainfall on days in a rainy month", what: "rainfall amounts", ent: "days", where: "in a rainy month", unit: "centimeters", title: "Daily rainfall", lo: 1, hi: 8 },
  { ph: "the race times of runners in a sprint", what: "race times", ent: "runners", where: "in a sprint", unit: "seconds", title: "Race times", lo: 1, hi: 8 },
];

export type SlScene = { t: SlTopic; vals: number[]; n: number; unit10: 10 | 1; fig: { type: "stem_leaf"; title: string; stemUnit: 10 | 1; unit: string; stems: { stem: number; leaves: number[] }[] } };
const r1 = (x: number) => Math.round(x * 10) / 10;
export const med = (a: number[]) => { const s = [...a].sort((p, q) => p - q), m = s.length; return Math.round((m % 2 ? s[(m - 1) / 2] : (s[m / 2 - 1] + s[m / 2]) / 2) * 100) / 100; };
export const quart = (sv: number[]) => { const n = sv.length; return { q1: med(sv.slice(0, Math.floor(n / 2))), q3: med(sv.slice(Math.ceil(n / 2))) }; };
export const sum = (a: number[]) => r1(a.reduce((x, y) => x + y, 0));

export type SlOpts = { n?: number; parity?: "odd" | "even"; distinct?: boolean; outlier?: boolean; dec?: boolean; spread?: number };
/** 줄기-잎 장면: 값은 오름차순. outlier 면 한 값만 나머지에서 멀리 떨어진 줄기에 있다(사이 줄기는 잎 없는 줄). */
export function makeSL(rng: Rng, o: SlOpts = {}): SlScene {
  const t = rng.pick(o.dec ? SL_DEC_TOPICS : SL_TOPICS); const unit10: 10 | 1 = o.dec ? 1 : 10;
  const k = o.outlier ? rng.int(2, 3) : rng.int(3, 5);
  let n = o.n ?? rng.int(9, 15); if (o.parity === "odd" && n % 2 === 0) n++; if (o.parity === "even" && n % 2 === 1) n--;
  const gap = o.outlier ? rng.int(2, 3) : 0; const span = k + gap + (o.outlier ? 1 : 0);
  const lo = t.lo, hi = Math.max(t.hi, lo + span); const s0 = rng.int(lo, Math.max(lo, Math.min(hi - span + 1, 9 - span + 1)));
  if (s0 + span - 1 > 9) throw new GenFail("줄기 범위");
  const vals: number[] = []; const used = new Set<number>();
  const body = o.outlier ? n - 1 : n;
  for (let i = 0; i < body; i++) {
    let v = 0;
    for (let tr = 0; tr < 30; tr++) { const st = i < k ? s0 + i : s0 + rng.int(0, k - 1); const lf = rng.int(0, 9); v = st * 10 + lf; if (!o.distinct || !used.has(v)) break; if (tr === 29) throw new GenFail("중복"); }
    used.add(v); vals.push(v);
  }
  if (o.outlier) { const ot = (s0 + k + gap) * 10 + rng.int(0, 9); vals.push(ot); }
  vals.sort((a, b) => a - b);
  const stems: { stem: number; leaves: number[] }[] = [];
  for (let s = Math.floor(vals[0] / 10); s <= Math.floor(vals[vals.length - 1] / 10); s++) stems.push({ stem: s, leaves: vals.filter((v) => Math.floor(v / 10) === s).map((v) => v % 10) });
  if (stems.some((s) => s.leaves.length > 14)) throw new GenFail("잎 많음");
  const real = vals.map((v) => (unit10 === 10 ? v : v / 10));
  return { t, vals: real, n: real.length, unit10, fig: { type: "stem_leaf", title: t.title, stemUnit: unit10, unit: t.unit, stems } };
}
export const SL_JS = "const v=[]; for (const r of FIGURE.stems) for (const l of r.leaves) v.push(Math.round((r.stem*FIGURE.stemUnit + l*FIGURE.stemUnit/10)*10)/10); v.sort((a,b)=>a-b); const n=v.length, sv=v; const r6=(x)=>Math.round(x*1e6)/1e6; const S=r6(v.reduce((a,b)=>a+b,0)); const med=(a)=>{ a=[...a].sort((x,y)=>x-y); const m=a.length; return m%2?a[(m-1)/2]:(a[m/2-1]+a[m/2])/2; }; const md=med(sv); const q1=med(sv.slice(0,Math.floor(n/2))), q3=med(sv.slice(Math.ceil(n/2)));\n";
export const rd = (j: string) => `${SL_JS}${j}`;
const capP = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
export const slIntro = (rng: Rng, s: SlScene) => rng.pick([
  `The stem-and-leaf plot shown gives ${s.t.ph}.`,
  `A stem-and-leaf plot is shown for ${s.t.ph}. Each leaf is one value.`,
  `${capP(s.t.ph)} are displayed in the stem-and-leaf plot shown.`,
  `In the stem-and-leaf plot shown, each leaf represents one of ${s.t.ph}.`,
  `Data were collected on ${s.t.ph}, and the results are organized in the stem-and-leaf plot shown.`,
  `Researchers recorded ${s.t.ph}. Every recorded value appears as a leaf in the stem-and-leaf plot shown.`,
  `For a class project, a student displayed ${s.t.ph} in the stem-and-leaf plot shown.`,
  `Each leaf in the stem-and-leaf plot shown stands for a single entry among ${s.t.ph}.`,
]);
/** 문장 변주(독립 변형 수를 늘리는 중립 문장) — 정보를 더하지 않고 말투만 바꾼다. */
export const LEADS = [
  "Use the information in the plot to answer the question.", "Refer to the plot when answering the question that follows.", "Answer the question using only the data in the plot.", "Study the plot carefully before answering.",
  "The plot contains all of the data needed for this question.", "Consider the data displayed in the plot.", "Examine the plot and then answer the question below.", "Base your answer on the data the plot displays.",
  "Look at how the leaves are arranged beside each stem.", "Note that every leaf in the plot is a separate data value.", "Read the key at the bottom of the plot before you begin.", "Keep in mind that each row of the plot lists the values for one stem.",
];
export const slRead = (s: SlScene): [string, string] => [`줄기-잎 그림에서 모든 값을 읽는다: ${s.vals.map(fmtNum).join(", ")} — 전체 ${s.n}개.`, "Read every value from the stem-and-leaf plot (stem and leaf together)."];
export const sortStep = (s: SlScene): [string, string] => [`크기순: ${s.vals.map(fmtNum).join(", ")} 이다.`, "The leaves are already in order within each stem."];
const QDEFS = [
  " The first quartile is the median of the lower half of the values, and the third quartile is the median of the upper half; when the number of values is odd, the overall median is left out of both halves.",
  " To find quartiles, split the ordered values into a lower half and an upper half (leave out the middle value when there is an odd number of values). The first quartile is the median of the lower half, and the third quartile is the median of the upper half.",
  " Quartiles are computed this way: the first quartile is the median of the values below the overall median, and the third quartile is the median of the values above it, with an overall median that is itself a data value excluded from both groups.",
];
const qdef = (rng: Rng) => rng.pick(QDEFS).trim();
const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v >= 0);
const f = fmtNum;
const D = (rng: Rng, s: SlScene, d: { stim?: string; question: string; correct: number; wrongs: ReturnType<typeof W>[]; js: string; P?: Record<string, number | string>; trace: [string, string][]; variant: string }): Instance =>
  gInst(rng, { stimulus: `${slIntro(rng, s)}${d.stim ? ` ${d.stim}` : ""} ${rng.pick(LEADS)}`, question: d.question, correct: d.correct, wrongs: pos(d.wrongs).filter((w) => Math.abs(w.v - d.correct) > 1e-9), verificationJs: figJs(d.P ?? {}, s.fig, rd(d.js)), trace: d.trace.length >= 4 ? [...d.trace, [`따라서 답은 ${fmtNum(d.correct)} 이다.`, "That is the requested value."]] : d.trace, variant: d.variant }, s.fig);
const mean = (s: SlScene) => s.vals.reduce((a, b) => a + b, 0) / s.n;
function intMean(rng: Rng, o: SlOpts = {}): SlScene { for (let t = 0; t < 300; t++) { const s = makeSL(rng, o); if (Math.round(s.vals.reduce((a, b) => a + b, 0)) % s.n === 0) return s; } throw new GenFail("정수 평균"); }

// ───────────────────────── mean ─────────────────────────
export const meanItem = () => defineItem({
  prefix: "ovd", itemId: "one_variable_data.mean.SL.P",
  hard: [
    { op: "inverse", structure: "줄기-잎 그림의 합·개수를 구한 뒤, 새 값 하나가 더해져 평균이 M 이 될 때 그 값을 역으로 구함", extra: "합을 구하고 목표 평균에서 새 합을 세워 역산해야 함 — medium 은 평균 계산까지", concepts: ["줄기-잎 그림", "평균의 역산"],
      gen(rng) { for (let t = 0; t < 80; t++) { const s = makeSL(rng); const S = s.vals.reduce((a, b) => a + b, 0); const x = rng.int(Math.min(...s.vals) - 5, Math.max(...s.vals) + 15); if ((S + x) % (s.n + 1) !== 0 || x <= 0) continue; const M = (S + x) / (s.n + 1); if (M === x) continue;
        return D(rng, s, { stim: `${rng.pick(["One more value is then added to the data.", "A new value is recorded and added to the plot's data.", "Later, one additional value is included."])} After it is included, the mean of all the values is ${M} ${s.t.unit}.`, question: rng.pick([`What is the new value, in ${s.t.unit}?`, `What value, in ${s.t.unit}, was added?`]), correct: x, wrongs: [W(M, "step_missing", "목표 평균을 그대로 답했다."), W(M * (s.n + 1) - S + 1, "other", "1 어긋났다."), W(M * s.n - S, "formula_misuse", "새 개수를 쓰지 않았다."), W(Math.round(S / s.n), "step_missing", "원래 평균을 답했다."), W(x + 1, "other", "1 어긋났다."), W(x - 1, "other", "1 어긋났다.")], P: { M }, js: `return P.M * (n + 1) - S;`, trace: [slRead(s), [`합 = ${S}, 개수 = ${s.n} 이다.`, "Add the values and count them."], [`새 합 = ${M} × ${s.n + 1} = ${M * (s.n + 1)} 이다.`, "New total = target mean × new count."], [`새 값 = ${M * (s.n + 1)} - ${S} = ${x} 이다.`, "Subtract the original sum."]], variant: "added_value_for_target_mean" }); } throw new GenFail("inverse"); } },
    { op: "chain2", structure: "줄기-잎 그림의 평균을 구한 뒤 평균보다 큰 값의 개수를 셈", extra: "합 → 평균 → 조건에 맞는 잎 세기의 연쇄 — medium 은 평균까지", concepts: ["줄기-잎 그림", "평균", "조건 개수"],
      gen(rng) { const s = makeSL(rng); const m = mean(s); const above = s.vals.filter((v) => v > m).length; if (above === 0 || above === s.n || s.vals.some((v) => v === m)) throw new GenFail("above");
        return D(rng, s, { question: rng.pick([`How many of the ${s.t.ent} have a value greater than the mean of all the values?`, `For how many ${s.t.ent} is the value greater than the mean?`]), correct: above, wrongs: [W(s.n - above, "opposite", "평균보다 작은 개수를 셌다."), W(s.n, "condition_ignored", "전체를 답했다."), W(above + 1, "other", "경계를 잘못 잡았다."), W(above - 1, "other", "하나를 빠뜨렸다."), W(Math.round(m), "step_missing", "평균을 답했다.")], js: `return v.filter(x => x > S / n).length;`, trace: [slRead(s), [`합 = ${sum(s.vals)}, 개수 = ${s.n} 이다.`, "Sum and count."], [`평균 = ${sum(s.vals)} ÷ ${s.n} ≈ ${f(Math.round(m * 100) / 100)} 이다.`, "Compute the mean."], [`평균보다 큰 값은 ${above} 개이다.`, "Count the values above the mean."]], variant: "count_above_mean" }); } },
    { op: "compare_scenarios", structure: "평균을 구하고 모든 값에 a 를 더하는 상황과 b 배 하는 상황의 새 평균의 차를 구함", extra: "더하기와 곱하기가 평균에 미치는 영향을 비교 — medium 은 평균 하나", concepts: ["줄기-잎 그림", "평균", "자료 변환"],
      gen(rng) { const s = intMean(rng); const m = mean(s); const a = rng.int(2, 12), b = rng.int(2, 4); const p1 = m + a, p2 = m * b; if (p1 === p2) throw new GenFail("same"); const c = Math.abs(p2 - p1);
        return D(rng, s, { stim: `${rng.pick(["Consider two ways to change the data.", "Two adjustments to the data are proposed."])} In plan 1, ${a} is added to every value. In plan 2, every value is multiplied by ${b}.`, question: "What is the positive difference between the mean under plan 1 and the mean under plan 2?", correct: c, wrongs: [W(Math.abs(b - a), "step_missing", "평균 없이 a, b 만 비교했다."), W(p2, "step_missing", "plan 2 의 평균만 답했다."), W(p1, "step_missing", "plan 1 의 평균만 답했다."), W(c + a, "other", "덧셈을 두 번 반영했다."), W(Math.abs(m * b - m), "step_missing", "plan 1 에서 a 를 더하지 않았다.")], P: { a, b }, js: `return Math.abs((S / n + P.a) - (S / n) * P.b);`, trace: [slRead(s), [`평균 = ${S(s)} ÷ ${s.n} = ${m} 이다.`, "Compute the mean."], [`plan 1 = ${m} + ${a} = ${p1}, plan 2 = ${m} × ${b} = ${p2} 이다.`, "Shift vs scale."], [`차 = |${p1} - ${p2}| = ${c} 이다.`, "Positive difference."]], variant: "shift_vs_scale_mean" }); } },
    { op: "param_condition", structure: "k 개의 같은 값 x 가 더해져 평균이 M 이상이 되는 최소 정수 x 를 구함", extra: "목표 평균 조건을 부등식으로 세우고 올림해야 함 — medium 은 평균 계산까지", concepts: ["줄기-잎 그림", "평균", "부등식과 정수"],
      gen(rng) { for (let t = 0; t < 80; t++) { const s = makeSL(rng); const S = s.vals.reduce((a, b) => a + b, 0); const k = rng.int(2, 6); const M = Math.ceil(S / s.n) + rng.int(1, 5); const need = M * (s.n + k) - S; if (need % k === 0) continue; const x = Math.ceil(need / k); if (x > 999 || x <= 0) continue;
        return D(rng, s, { stim: `${rng.pick(["Suppose", "Assume that", "Imagine that"])} ${k} more ${s.t.ent} are added, each with the same whole-number value.`, question: `What is the least whole-number value, in ${s.t.unit}, each new one could have so that the mean of all the values is at least ${M} ${s.t.unit}?`, correct: x, wrongs: [W(x - 1, "condition_ignored", "올림 대신 내림했다."), W(M, "step_missing", "목표 평균을 답했다."), W(need, "step_missing", "k 로 나누지 않았다."), W(Math.ceil((M * s.n - S) / k), "formula_misuse", "새 개수에 k 를 더하지 않았다."), W(x + 1, "other", "하나 더 올렸다.")], P: { k, M }, js: `return Math.ceil((P.M * (n + P.k) - S) / P.k);`, trace: [slRead(s), [`합 = ${S}, 개수 = ${s.n} 이다.`, "Sum and count."], [`(${S} + ${k}x) ÷ ${s.n + k} ≥ ${M} 이므로 ${k}x ≥ ${need} 이다.`, "Set up the inequality."], [`x ≥ ${f(need / k)} 이므로 가장 작은 정수는 ${x} 이다.`, "Round up."]], variant: "least_value_for_target_mean" }); } throw new GenFail("param"); } },
  ],
  em: [
    { lv: "easy", name: "total_count", structure: "줄기-잎 그림의 잎의 개수를 세어 전체 개수를 구함", extra: "easy: 잎 세기", concepts: ["줄기-잎 그림", "개수"],
      gen(rng) { const s = makeSL(rng); return D(rng, s, { question: rng.pick([`How many ${s.t.ent} are represented in the plot?`, `What is the total number of values in the plot?`]), correct: s.n, wrongs: [W(s.fig.stems.length, "axis_misread", "줄기의 개수를 셌다."), W(s.n + 1, "other", "1 어긋났다."), W(s.n - 1, "other", "하나를 빠뜨렸다."), W(Math.max(...s.fig.stems.map((x) => x.leaves.length)), "step_missing", "가장 긴 줄의 잎만 셌다.")], js: `return n;`, trace: [slRead(s), [`잎을 모두 세면 ${s.n} 개이다.`, "Count the leaves."]], variant: "count_leaves" }); } },
    { lv: "medium", name: "mean", structure: "줄기-잎 그림의 값을 모두 더해 개수로 나눠 평균을 구함", extra: "medium: 합 ÷ 개수", concepts: ["줄기-잎 그림", "평균"],
      gen(rng) { const s = intMean(rng); const m = mean(s); return D(rng, s, { question: rng.pick([`What is the mean of the values in the plot, in ${s.t.unit}?`, `What is the mean value, in ${s.t.unit}?`]), correct: m, wrongs: [W(med(s.vals), "step_missing", "중앙값을 답했다."), W(S(s), "step_missing", "합을 나누지 않았다."), W(m + 1, "other", "1 어긋났다."), W(m - 1, "other", "1 어긋났다."), W(s.vals[0], "axis_misread", "첫 값을 답했다.")], js: `return S / n;`, trace: [slRead(s), [`합 = ${S(s)} 이다.`, "Add."], [`평균 = ${S(s)} ÷ ${s.n} = ${m} 이다.`, "Divide by the count."]], variant: "list_mean" }); } },
  ],
});
const S = (s: SlScene) => sum(s.vals);

// ───────────────────────── median ─────────────────────────
export const medianItem = () => defineItem({
  prefix: "ovd", itemId: "one_variable_data.median.SL.P",
  hard: [
    { op: "chain2", structure: "가장 큰 값 k 개를 제거한 뒤 남은 값들의 중앙값을 구함", extra: "제거 후 개수의 홀짝에 따라 중앙값 위치가 달라짐 — medium 은 중앙값 하나", concepts: ["줄기-잎 그림", "중앙값", "자료 제거"],
      gen(rng) { const s = makeSL(rng, { n: rng.int(10, 15) }); const k = rng.int(2, 3); const rest = s.vals.slice(0, s.n - k); const c = med(rest); if (c === med(s.vals)) throw new GenFail("same");
        return D(rng, s, { stim: `${rng.pick(["Then the", "Later, the", "After a review, the"])} ${k} greatest values are removed from the data.`, question: rng.pick(["What is the median of the remaining values?", `What is the median, in ${s.t.unit}, of the data after the removal?`]), correct: c, wrongs: [W(med(s.vals), "step_missing", "제거 전 중앙값을 답했다."), W(med(s.vals.slice(k)), "opposite", "가장 작은 값들을 뺐다."), W(rest[rest.length - 1], "axis_misread", "남은 값의 최댓값을 답했다."), W(r1((c + 1)), "other", "1 어긋났다."), W(rest[(rest.length - 1) >> 1] === c ? c + 2 : rest[(rest.length - 1) >> 1], "formula_misuse", "짝수 개일 때 평균을 내지 않았다.")], P: { k }, js: `return med(sv.slice(0, n - P.k));`, trace: [slRead(s), [`가장 큰 ${k} 개를 빼면 ${rest.length} 개가 남는다: ${rest.map(f).join(", ")}.`, "Remove the greatest values."], [rest.length % 2 ? `가운데(${(rest.length + 1) / 2} 번째) 값이 중앙값이다.` : `가운데 두 값의 평균이 중앙값이다.`, "Locate the middle."], [`중앙값 = ${f(c)} 이다.`, "Median."]], variant: "median_after_removing_top" }); } },
    { op: "compare_scenarios", structure: "원래 자료보다 작은 값을 더한 경우와 큰 값을 더한 경우의 중앙값의 차를 구함", extra: "값이 하나 더해질 때 중앙값 위치가 어느 쪽으로 이동하는지 비교 — medium 은 중앙값 하나", concepts: ["줄기-잎 그림", "중앙값", "두 상황 비교"],
      gen(rng) { const s = makeSL(rng); const lo = s.vals[0] - 5, hi = s.vals[s.n - 1] + 5; const a = med([...s.vals, lo]), b = med([...s.vals, hi]); if (a === b) throw new GenFail("same"); const c = Math.abs(b - a);
        return D(rng, s, { stim: `Two possible changes are considered. In option 1, one new value of ${lo} ${s.t.unit}, which is less than every value in the plot, is added. In option 2, one new value of ${hi} ${s.t.unit}, which is greater than every value in the plot, is added.`, question: "What is the positive difference between the median under option 1 and the median under option 2?", correct: c, wrongs: [W(a, "step_missing", "option 1 의 중앙값만 답했다."), W(b, "step_missing", "option 2 의 중앙값만 답했다."), W(c + 1, "other", "1 어긋났다."), W(Math.abs(hi - lo), "step_missing", "새 값의 차를 답했다."), W(r1(c / 2), "formula_misuse", "차를 둘로 나눴다.")], P: { lo, hi }, js: `return Math.abs(med([...sv, P.hi]) - med([...sv, P.lo]));`, trace: [slRead(s), [`option 1 의 중앙값 = ${f(a)} 이다.`, "Median with a small value added."], [`option 2 의 중앙값 = ${f(b)} 이다.`, "Median with a large value added."], [`차 = ${f(c)} 이다.`, "Positive difference."]], variant: "median_add_low_vs_high" }); } },
    { op: "compose_kind", structure: "줄기-잎 그림의 평균과 중앙값을 각각 구해 차를 구함", extra: "서로 다른 대푯값을 모두 계산해 비교 — medium 은 중앙값 하나", concepts: ["줄기-잎 그림", "평균", "중앙값"],
      gen(rng) { for (let t = 0; t < 100; t++) { const s = makeSL(rng); if ((2 * Math.round(S(s))) % s.n !== 0) continue; const m = mean(s), d = med(s.vals); if (m === d) continue; const c = Math.abs(m - d);
        return D(rng, s, { question: `What is the positive difference between the mean and the median of the values, in ${s.t.unit}?`, correct: c, wrongs: [W(m, "step_missing", "평균만 답했다."), W(d, "step_missing", "중앙값만 답했다."), W(m + d, "sign_error", "합을 구했다."), W(c + 1, "other", "1 어긋났다."), W(Math.abs(m - s.vals[(s.n - 1) >> 1]), "formula_misuse", "짝수 개일 때 평균을 내지 않았다.")].filter((w) => w.v !== c), js: `return Math.abs(S / n - md);`, trace: [slRead(s), [`평균 = ${S(s)} ÷ ${s.n} = ${f(m)} 이다.`, "Mean."], [`중앙값 = ${f(d)} 이다.`, "Median."], [`차 = ${f(c)} 이다.`, "Positive difference."]], variant: "mean_vs_median" }); } throw new GenFail("compose"); } },
    { op: "inverse", structure: "원래 중앙값보다 큰 새 값 하나가 더해져 새 중앙값이 M 일 때 그 값을 역으로 구함", extra: "더해진 값이 가운데에 놓이는 위치를 거꾸로 써야 함 — medium 은 중앙값 계산", concepts: ["줄기-잎 그림", "중앙값의 역산"],
      gen(rng) { for (let t = 0; t < 80; t++) { const s = makeSL(rng, { parity: "odd", distinct: true }); const mid = (s.n - 1) / 2; const a = s.vals[mid], b = s.vals[mid + 1]; if (b - a < 2) continue; const x = a + rng.int(1, b - a - 1); const M = (a + x) / 2;
        return D(rng, s, { stim: `One new value, greater than the median of the values in the plot, is added. The median of all the values is then ${f(M)} ${s.t.unit}.`, question: `What is the new value, in ${s.t.unit}?`, correct: x, wrongs: [W(M, "step_missing", "새 중앙값을 답했다."), W(2 * M - b, "other", "다음 값과 짝지었다."), W(b, "scope", "다음 값을 답했다."), W(x + 1, "other", "1 어긋났다."), W(2 * M, "formula_misuse", "중앙값의 두 배를 답했다.")], P: { M }, js: `if (n % 2 === 0) throw new Error('짝수 개'); const mid = sv[(n - 1) / 2], nx = sv[(n + 1) / 2]; const x = 2 * P.M - mid; if (!(x > mid && x < nx)) throw new Error('범위'); return x;`, trace: [slRead(s), [`홀수 개이므로 원래 중앙값은 ${a}, 그 다음 값은 ${b} 이다.`, "Original median and the next value."], [`새 값이 ${a} 와 ${b} 사이면 새 중앙값 = (${a} + 새 값) ÷ 2 이다.`, "The new median is the mean of the two middle values."], [`새 값 = 2 × ${f(M)} - ${a} = ${x} 이다.`, "Solve."]], variant: "added_value_for_new_median" }); } throw new GenFail("inverse"); } },
  ],
  em: [
    { lv: "easy", name: "median_odd", structure: "홀수 개인 줄기-잎 그림에서 가운데 값을 찾음", extra: "easy: 가운데 위치", concepts: ["줄기-잎 그림", "중앙값"],
      gen(rng) { const s = makeSL(rng, { parity: "odd", dec: rng.chance(0.4) }); const c = med(s.vals); return D(rng, s, { question: `What is the median of the values in the plot, in ${s.t.unit}?`, correct: c, wrongs: [W(mean(s), "formula_misuse", "평균을 답했다."), W(s.vals[0], "axis_misread", "최솟값을 답했다."), W(s.vals[s.n - 1], "axis_misread", "최댓값을 답했다."), W(s.vals[(s.n - 1) / 2 + 1], "other", "한 칸 어긋났다."), W(s.vals[(s.n - 1) / 2 - 1], "other", "한 칸 어긋났다.")].map((w) => ({ ...w, v: r1(w.v) })), js: `if (n % 2 === 0) throw new Error('짝수 개'); return r6(sv[(n - 1) / 2]);`, trace: [slRead(s), [`홀수 개(${s.n})이므로 ${(s.n + 1) / 2} 번째 값이 중앙값이다.`, "Middle position."], [`중앙값 = ${f(c)} 이다.`, "Read it."]], variant: "median_odd_count" }); } },
    { lv: "medium", name: "median_even", structure: "짝수 개인 줄기-잎 그림에서 가운데 두 값의 평균을 구함", extra: "medium: 가운데 두 값의 평균", concepts: ["줄기-잎 그림", "중앙값"],
      gen(rng) { const s = makeSL(rng, { parity: "even", dec: rng.chance(0.4) }); const c = med(s.vals); const a = s.vals[s.n / 2 - 1], b = s.vals[s.n / 2]; if (a === b) throw new GenFail("eq"); return D(rng, s, { question: `What is the median of the values in the plot, in ${s.t.unit}?`, correct: c, wrongs: [W(a, "step_missing", "가운데 두 값 중 작은 값만 답했다."), W(b, "step_missing", "가운데 두 값 중 큰 값만 답했다."), W(mean(s), "formula_misuse", "평균을 답했다."), W(r1(c + 1), "other", "1 어긋났다."), W(r1(b - a), "formula_misuse", "차를 구했다.")].map((w) => ({ ...w, v: r1(w.v) })), js: `if (n % 2 === 1) throw new Error('홀수 개'); return r6(md);`, trace: [slRead(s), [`짝수 개(${s.n})이므로 ${s.n / 2} 번째와 ${s.n / 2 + 1} 번째 값 ${f(a)}, ${f(b)} 의 평균이다.`, "Average the two middle values."], [`중앙값 = ${f(c)} 이다.`, "Compute."]], variant: "median_even_count" }); } },
  ],
});

// ───────────────────────── range ─────────────────────────
export const rangeItem = () => defineItem({
  prefix: "ovd", itemId: "one_variable_data.range.SL.P",
  hard: [
    { op: "inverse", structure: "최솟값을 읽고 모든 값보다 큰 새 값이 더해진 뒤 범위가 R 일 때 새 값을 역산", extra: "새 범위의 정의를 거꾸로 써야 함 — medium 은 범위 계산", concepts: ["줄기-잎 그림", "범위", "역산"],
      gen(rng) { const s = makeSL(rng); const mn = s.vals[0], mx = s.vals[s.n - 1]; const x = mx + rng.int(2, 20); const R = x - mn;
        return D(rng, s, { stim: `One more value, greater than every value in the plot, is added. The range of the new data is ${R} ${s.t.unit}.`, question: "What is the new value?", correct: x, wrongs: [W(mx + R, "formula_misuse", "최댓값에 범위를 더했다."), W(R, "step_missing", "범위를 답했다."), W(R - (mx - mn), "step_missing", "증가량만 답했다."), W(x - 1, "other", "1 어긋났다."), W(x + 1, "other", "1 어긋났다.")], P: { R }, js: `const x = sv[0] + P.R; if (x <= sv[n - 1]) throw new Error('최댓값 이하'); return x;`, trace: [slRead(s), [`최솟값 ${mn}, 원래 최댓값 ${mx} 이다.`, "Least and greatest."], [`새 값이 최댓값이 되므로 새 범위 = 새 값 - ${mn} 이다.`, "The new value is the maximum."], [`새 값 = ${mn} + ${R} = ${x} 이다.`, "Solve."]], variant: "new_max_from_range" }); } },
    { op: "compare_scenarios", structure: "최댓값 하나를 뺀 경우와 최솟값 하나를 뺀 경우의 범위의 차를 구함", extra: "두 번째로 큰·작은 값까지 찾아야 함 — medium 은 한 상황", concepts: ["줄기-잎 그림", "범위", "두 상황 비교"],
      gen(rng) { const s = makeSL(rng, { distinct: true }); const sv = s.vals, n = s.n; const r1_ = sv[n - 2] - sv[0], r2_ = sv[n - 1] - sv[1]; if (r1_ === r2_) throw new GenFail("eq"); const c = Math.abs(r1_ - r2_);
        return D(rng, s, { stim: "Two options are compared. In option 1, only the greatest value is removed. In option 2, only the least value is removed.", question: "What is the positive difference between the range under option 1 and the range under option 2?", correct: c, wrongs: [W(r1_, "step_missing", "option 1 의 범위만 답했다."), W(r2_, "step_missing", "option 2 의 범위만 답했다."), W(sv[n - 1] - sv[0], "step_missing", "원래 범위를 답했다."), W(c + 1, "other", "1 어긋났다."), W(r1_ + r2_, "sign_error", "합을 구했다.")], js: `if (new Set(v).size !== n) throw new Error('같은 값'); return Math.abs((sv[n - 2] - sv[0]) - (sv[n - 1] - sv[1]));`, trace: [slRead(s), [`option 1: ${sv[n - 2]} - ${sv[0]} = ${r1_} 이다.`, "Range without the maximum."], [`option 2: ${sv[n - 1]} - ${sv[1]} = ${r2_} 이다.`, "Range without the minimum."], [`차 = ${c} 이다.`, "Positive difference."]], variant: "trim_max_vs_min" }); } },
    { op: "chain2", structure: "모든 값을 b 배 한 뒤 c 를 더한 새 자료의 범위를 구함", extra: "범위가 곱셈에는 b 배, 덧셈에는 불변임을 연쇄로 적용 — medium 은 원래 범위", concepts: ["줄기-잎 그림", "범위", "자료 변환"],
      gen(rng) { const s = makeSL(rng); const R = s.vals[s.n - 1] - s.vals[0]; const b = rng.int(2, 4), c = rng.int(2, 30); const ans = b * R;
        return D(rng, s, { stim: `${rng.pick(["To create new data, each value is", "Every value in the plot is"])} multiplied by ${b}, and then ${c} is added to the result.`, question: "What is the range of the new data?", correct: ans, wrongs: [W(R, "step_missing", "곱셈 효과를 무시했다."), W(ans + c, "formula_misuse", "덧셈도 범위를 바꾼다고 보았다."), W(R + c, "formula_misuse", "곱셈을 빼먹었다."), W(b * (R + c), "formula_misuse", "더한 뒤 곱했다."), W(b * s.vals[s.n - 1] + c, "axis_misread", "새 최댓값을 답했다.")], P: { b, c }, js: `const w = v.map(x => x * P.b + P.c); return Math.max(...w) - Math.min(...w);`, trace: [slRead(s), [`원래 범위 = ${s.vals[s.n - 1]} - ${s.vals[0]} = ${R} 이다.`, "Original range."], [`${b} 배 하면 범위도 ${b} 배: ${ans} 이다.`, "Scaling."], [`${c} 를 더해도 범위는 그대로 ${ans} 이다.`, "Shifting leaves the range unchanged."]], variant: "range_after_linear_transform" }); } },
    { op: "compose_kind", structure: "줄기-잎 그림에서 범위와 중앙값을 각각 구해 그 차(양수)를 구함", extra: "산포(범위)와 중심(중앙값)을 모두 계산 — medium 은 범위 하나", concepts: ["줄기-잎 그림", "범위", "중앙값"],
      gen(rng) { const s = makeSL(rng, { parity: "odd" }); const R = s.vals[s.n - 1] - s.vals[0]; const d = med(s.vals); if (R === d) throw new GenFail("eq"); const c = Math.abs(R - d);
        return D(rng, s, { question: "What is the positive difference between the range and the median of the values?", correct: c, wrongs: [W(R, "step_missing", "범위만 답했다."), W(d, "step_missing", "중앙값만 답했다."), W(R + d, "sign_error", "합을 구했다."), W(c + 1, "other", "1 어긋났다."), W(Math.abs(R - mean(s)), "formula_misuse", "평균을 썼다.")], js: `return Math.abs((sv[n - 1] - sv[0]) - md);`, trace: [slRead(s), [`범위 = ${s.vals[s.n - 1]} - ${s.vals[0]} = ${R} 이다.`, "Range."], [`중앙값 = ${d} 이다.`, "Median."], [`차 = ${c} 이다.`, "Positive difference."]], variant: "range_vs_median" }); } },
  ],
  em: [
    { lv: "easy", name: "range", structure: "줄기-잎 그림의 최댓값과 최솟값으로 범위를 구함", extra: "easy: 최댓값 - 최솟값", concepts: ["줄기-잎 그림", "범위"],
      gen(rng) { const s = makeSL(rng, { dec: rng.chance(0.4) }); const mx = s.vals[s.n - 1], mn = s.vals[0]; const R = r1(mx - mn); return D(rng, s, { question: `What is the range of the values in the plot, in ${s.t.unit}?`, correct: R, wrongs: [W(mx, "step_missing", "최댓값을 답했다."), W(mn, "step_missing", "최솟값을 답했다."), W(r1(mx + mn), "sign_error", "합을 구했다."), W(r1(R + 1), "other", "1 어긋났다."), W(r1(R - 1), "other", "1 어긋났다."), W(s.fig.stems.length, "axis_misread", "줄기 수를 답했다.")], js: `return r6(sv[n - 1] - sv[0]);`, trace: [slRead(s), [`최댓값 ${f(mx)}, 최솟값 ${f(mn)} 이다.`, "Greatest and least."], [`범위 = ${f(R)} 이다.`, "Subtract."]], variant: "list_range" }); } },
    { lv: "medium", name: "range_without_max", structure: "가장 큰 값을 뺀 나머지의 범위를 구함", extra: "medium: 두 번째로 큰 값", concepts: ["줄기-잎 그림", "범위"],
      gen(rng) { const s = makeSL(rng, { distinct: true }); const sv = s.vals, n = s.n; const r = sv[n - 2] - sv[0]; return D(rng, s, { stim: "The greatest value is then removed from the data.", question: "What is the range of the remaining values?", correct: r, wrongs: [W(sv[n - 1] - sv[0], "step_missing", "제거 전 범위를 답했다."), W(sv[n - 1] - sv[1], "opposite", "가장 작은 값을 뺐다."), W(sv[n - 2], "step_missing", "새 최댓값을 답했다."), W(r + 1, "other", "1 어긋났다."), W(sv[n - 2] - sv[1], "formula_misuse", "양쪽을 뺐다.")], js: `if (new Set(v).size !== n) throw new Error('같은 값'); return sv[n - 2] - sv[0];`, trace: [slRead(s), [`최댓값 ${sv[n - 1]} 을 빼면 새 최댓값은 ${sv[n - 2]} 이다.`, "New greatest value."], [`범위 = ${sv[n - 2]} - ${sv[0]} = ${r} 이다.`, "Subtract."]], variant: "range_without_max" }); } },
  ],
});

// ───────────────────────── outlier_effect ─────────────────────────
export const outlierItem = () => defineItem({
  prefix: "ovd", itemId: "one_variable_data.outlier_effect.SL.P",
  hard: [
    { op: "chain2", structure: "이상값(한 값만 멀리 떨어진 값)을 포함한 평균과 뺀 평균의 차를 구함", extra: "두 평균을 각각 구해 이상값의 영향을 수치로 비교 — medium 은 평균 하나", concepts: ["줄기-잎 그림", "이상값", "평균"],
      gen(rng) { for (let t = 0; t < 120; t++) { const s = makeSL(rng, { outlier: true }); const o = s.vals[s.n - 1]; const S0 = Math.round(S(s)); if (S0 % s.n !== 0 || (S0 - o) % (s.n - 1) !== 0) continue; const a = S0 / s.n, b = (S0 - o) / (s.n - 1); const c = a - b; if (c <= 0) continue;
        return D(rng, s, { stim: `One value in the plot is much greater than all the others.`, question: `By how many ${s.t.unit} is the mean of all the values greater than the mean of the values without that greatest value?`, correct: c, wrongs: [W(a, "step_missing", "이상값을 포함한 평균만 답했다."), W(b, "step_missing", "이상값을 뺀 평균만 답했다."), W(o - b, "formula_misuse", "이상값과 평균의 차를 답했다."), W(c + 1, "other", "1 어긋났다."), W(Math.abs(med(s.vals) - med(s.vals.slice(0, s.n - 1))), "scope", "중앙값의 변화를 답했다.")], js: `return S / n - (S - sv[n - 1]) / (n - 1);`, trace: [slRead(s), [`이상값은 ${o} 이다.`, "Identify the outlier."], [`포함한 평균 = ${S0} ÷ ${s.n} = ${a} 이다.`, "Mean with the outlier."], [`뺀 평균 = ${S0 - o} ÷ ${s.n - 1} = ${b} 이다.`, "Mean without it."], [`차 = ${c} 이다.`, "Difference."]], variant: "mean_with_vs_without_outlier" }); } throw new GenFail("chain2"); } },
    { op: "compare_scenarios", structure: "이상값을 뺐을 때 평균의 변화량과 중앙값의 변화량을 비교해 차를 구함", extra: "평균은 크게, 중앙값은 적게 변한다는 성질을 두 수치로 비교 — medium 은 한 대푯값", concepts: ["줄기-잎 그림", "이상값", "평균과 중앙값"],
      gen(rng) { for (let t = 0; t < 120; t++) { const s = makeSL(rng, { outlier: true }); const o = s.vals[s.n - 1]; const S0 = Math.round(S(s)); if ((2 * S0) % s.n !== 0 || (2 * (S0 - o)) % (s.n - 1) !== 0) continue; const dm = S0 / s.n - (S0 - o) / (s.n - 1); const dd = med(s.vals) - med(s.vals.slice(0, s.n - 1)); const c = dm - dd; if (c <= 0) continue;
        return D(rng, s, { stim: "One value in the plot is much greater than all the others, and it is then removed.", question: "By how many units does the decrease in the mean exceed the decrease in the median?", correct: c, wrongs: [W(dm, "step_missing", "평균의 변화만 답했다."), W(dd, "step_missing", "중앙값의 변화만 답했다."), W(dm + dd, "sign_error", "합을 구했다."), W(c + 1, "other", "1 어긋났다."), W(o - med(s.vals), "scope", "이상값과 중앙값의 차를 답했다.")].filter((w) => w.v > 0), js: `const m0 = med(sv.slice(0, n - 1)); return (S / n - (S - sv[n - 1]) / (n - 1)) - (md - m0);`, trace: [slRead(s), [`평균: ${f(S0 / s.n)} → ${f((S0 - o) / (s.n - 1))}, 변화 ${f(dm)} 이다.`, "Change in the mean."], [`중앙값: ${f(med(s.vals))} → ${f(med(s.vals.slice(0, s.n - 1)))}, 변화 ${f(dd)} 이다.`, "Change in the median."], [`평균의 변화 - 중앙값의 변화 = ${f(c)} 이다.`, "Compare."]], variant: "mean_vs_median_change" }); } throw new GenFail("cmp"); } },
    { op: "inverse", structure: "이상값을 다른 값 x 로 바꿔 평균이 M 이 될 때 x 를 역으로 구함", extra: "합의 변화를 평균의 변화로 거꾸로 써야 함 — medium 은 평균 계산", concepts: ["줄기-잎 그림", "이상값", "평균의 역산"],
      gen(rng) { for (let t = 0; t < 120; t++) { const s = makeSL(rng, { outlier: true }); const o = s.vals[s.n - 1]; const S0 = Math.round(S(s)); const x = rng.int(s.vals[0], s.vals[s.n - 2]); const tot = S0 - o + x; if (tot % s.n !== 0) continue; const M = tot / s.n;
        return D(rng, s, { stim: `The greatest value in the plot is replaced by a new value, and the mean of the ${s.n} values becomes ${M} ${s.t.unit}.`, question: `What is the new value, in ${s.t.unit}?`, correct: x, wrongs: [W(M, "step_missing", "새 평균을 답했다."), W(o, "scope", "이상값을 답했다."), W(M * s.n - S0, "formula_misuse", "합의 차를 답했다."), W(x + 1, "other", "1 어긋났다."), W(x - 1, "other", "1 어긋났다.")], P: { M }, js: `return P.M * n - (S - sv[n - 1]);`, trace: [slRead(s), [`이상값 ${o} 을 뺀 합 = ${S0 - o} 이다.`, "Sum without the outlier."], [`새 합 = ${M} × ${s.n} = ${M * s.n} 이다.`, "New total."], [`새 값 = ${M * s.n} - ${S0 - o} = ${x} 이다.`, "Solve."]], variant: "replace_outlier_for_mean" }); } throw new GenFail("inverse"); } },
    { op: "compose_kind", structure: "이상값을 포함한 범위와 뺀 범위의 차를 구함", extra: "범위가 이상값에 얼마나 민감한지 수치로 확인 — medium 은 범위 하나", concepts: ["줄기-잎 그림", "이상값", "범위"],
      gen(rng) { const s = makeSL(rng, { outlier: true }); const sv = s.vals, n = s.n; const c = (sv[n - 1] - sv[0]) - (sv[n - 2] - sv[0]); if (c <= 0) throw new GenFail("c");
        return D(rng, s, { stim: "One value in the plot is much greater than all the others.", question: "By how much does the range decrease when that greatest value is removed?", correct: c, wrongs: [W(sv[n - 1] - sv[0], "step_missing", "원래 범위를 답했다."), W(sv[n - 2] - sv[0], "step_missing", "뺀 범위를 답했다."), W(sv[n - 1], "axis_misread", "최댓값을 답했다."), W(c + 1, "other", "1 어긋났다."), W(med(sv) === c ? c + 2 : Math.round(med(sv)), "scope", "중앙값을 답했다.")], js: `return (sv[n - 1] - sv[0]) - (sv[n - 2] - sv[0]);`, trace: [slRead(s), [`이상값은 ${sv[n - 1]} 이다.`, "Identify the outlier."], [`뺀 뒤 범위 = ${sv[n - 2]} - ${sv[0]} = ${sv[n - 2] - sv[0]} 이다.`, "Range after removal."], [`원래 범위 = ${sv[n - 1] - sv[0]} 이므로 줄어든 양 = ${c} 이다.`, "Decrease."]], variant: "range_drop_without_outlier" }); } },
  ],
  em: [
    { lv: "easy", name: "identify_outlier", structure: "줄기-잎 그림에서 다른 값들과 멀리 떨어진 값을 찾음", extra: "easy: 이상값 읽기", concepts: ["줄기-잎 그림", "이상값"],
      gen(rng) { const s = makeSL(rng, { outlier: true }); const o = s.vals[s.n - 1]; return D(rng, s, { stim: "One value in the plot is much greater than all the others.", question: `What is that value, in ${s.t.unit}?`, correct: o, wrongs: [W(s.vals[s.n - 2], "axis_misread", "둘째로 큰 값을 답했다."), W(s.vals[0], "axis_misread", "최솟값을 답했다."), W(Math.floor(o / 10), "axis_misread", "줄기만 읽었다."), W(o + 1, "other", "1 어긋났다."), W(o % 10, "axis_misread", "잎만 읽었다.")], js: `return sv[n - 1];`, trace: [slRead(s), [`가장 멀리 떨어진 값은 ${o} 이다.`, "The outlier."]], variant: "read_outlier" }); } },
    { lv: "medium", name: "median_without_outlier", structure: "이상값을 뺀 값들의 중앙값을 구함", extra: "medium: 제거 후 중앙값", concepts: ["줄기-잎 그림", "이상값", "중앙값"],
      gen(rng) { const s = makeSL(rng, { outlier: true }); const rest = s.vals.slice(0, s.n - 1); const c = med(rest); return D(rng, s, { stim: "One value in the plot is much greater than all the others, and it is removed.", question: "What is the median of the remaining values?", correct: c, wrongs: [W(med(s.vals), "step_missing", "제거 전 중앙값을 답했다."), W(r1(S(s) / s.n), "scope", "평균을 답했다."), W(rest[rest.length - 1], "axis_misread", "남은 최댓값을 답했다."), W(r1(c + 1), "other", "1 어긋났다."), W(r1(c - 1), "other", "1 어긋났다.")], js: `return med(sv.slice(0, n - 1));`, trace: [slRead(s), [`이상값 ${s.vals[s.n - 1]} 을 빼면 ${rest.length} 개가 남는다.`, "Remove it."], [`중앙값 = ${f(c)} 이다.`, "Median."]], variant: "median_without_outlier" }); } },
  ],
});

// ───────────────────────── quartile_percentile_from_plot ─────────────────────────
export const quartileItem = () => defineItem({
  prefix: "ovd", itemId: "one_variable_data.quartile_percentile_from_plot.SL.P",
  hard: [
    { op: "chain2", structure: "제1사분위수와 제3사분위수를 구해 사분위범위(IQR)를 구함", extra: "중앙값으로 자료를 반으로 나눠 각각의 중앙값을 구하는 2단계 — medium 은 Q1 하나", concepts: ["줄기-잎 그림", "사분위수", "IQR"],
      gen(rng) { const s = makeSL(rng); const { q1, q3 } = quart(s.vals); const c = r1(q3 - q1); if (c <= 0) throw new GenFail("c");
        return D(rng, s, { stim: qdef(rng), question: "What is the interquartile range of the values?", correct: c, wrongs: [W(r1(s.vals[s.n - 1] - s.vals[0]), "step_missing", "범위를 답했다."), W(q3, "step_missing", "Q3 만 답했다."), W(q1, "step_missing", "Q1 만 답했다."), W(r1(c + 1), "other", "1 어긋났다."), W(r1(q3 + q1), "sign_error", "합을 구했다.")], js: `return r6(q3 - q1);`, trace: [slRead(s), [`아래 절반의 중앙값 Q1 = ${f(q1)} 이다.`, "First quartile."], [`위 절반의 중앙값 Q3 = ${f(q3)} 이다.`, "Third quartile."], [`IQR = ${f(q3)} - ${f(q1)} = ${f(c)} 이다.`, "Subtract."]], variant: "iqr_from_plot" }); } },
    { op: "compare_scenarios", structure: "(Q3 - 중앙값)과 (중앙값 - Q1)을 비교해 그 차를 구함", extra: "세 위치 값을 모두 구해 위·아래 쪽 퍼짐을 비교 — medium 은 한 구간", concepts: ["줄기-잎 그림", "사분위수", "분포의 비대칭"],
      gen(rng) { const s = makeSL(rng); const { q1, q3 } = quart(s.vals); const m = med(s.vals); const up = r1(q3 - m), dn = r1(m - q1); if (up === dn) throw new GenFail("eq"); const c = Math.abs(r1(up - dn));
        return D(rng, s, { stim: qdef(rng), question: "What is the positive difference between the distance from the median to the third quartile and the distance from the first quartile to the median?", correct: c, wrongs: [W(up, "step_missing", "위쪽 거리만 답했다."), W(dn, "step_missing", "아래쪽 거리만 답했다."), W(r1(up + dn), "sign_error", "합을 구했다."), W(r1(c + 1), "other", "1 어긋났다."), W(r1(q3 - q1), "scope", "IQR 을 답했다.")], js: `return Math.abs(r6((q3 - md) - (md - q1)));`, trace: [slRead(s), [`Q1 = ${f(q1)}, 중앙값 = ${f(m)}, Q3 = ${f(q3)} 이다.`, "Quartiles and median."], [`Q3 - 중앙값 = ${f(up)}, 중앙값 - Q1 = ${f(dn)} 이다.`, "The two distances."], [`차 = ${f(c)} 이다.`, "Positive difference."]], variant: "upper_vs_lower_spread" }); } },
    { op: "constraint_select", structure: "Q1 - 1.5·IQR 보다 작거나 Q3 + 1.5·IQR 보다 큰 값의 개수를 셈", extra: "사분위수·IQR 로 두 경계를 만들고 경계 밖 잎을 세야 함 — medium 은 IQR", concepts: ["줄기-잎 그림", "사분위수", "이상값 규칙"],
      gen(rng) { for (let t = 0; t < 100; t++) { const s = makeSL(rng, { outlier: rng.chance(0.6) }); const { q1, q3 } = quart(s.vals); const iqr = q3 - q1; const lo = q1 - 1.5 * iqr, hi = q3 + 1.5 * iqr; const cnt = s.vals.filter((v) => v < lo || v > hi).length; if (cnt < 1 || cnt > 3) continue; if (s.vals.some((v) => v === lo || v === hi)) continue;
        return D(rng, s, { stim: `${qdef(rng)} A value is considered an outlier if it is less than the first quartile minus 1.5 times the interquartile range, or greater than the third quartile plus 1.5 times the interquartile range.`, question: rng.pick(["How many of the values are outliers?", "According to this rule, how many of the values would be classified as outliers?", "How many values in the plot satisfy the outlier rule?"]), correct: cnt, wrongs: [W(0, "condition_ignored", "경계 밖 값이 없다고 보았다."), W(cnt + 1, "other", "경계를 잘못 잡았다."), W(s.vals.filter((v) => v > hi).length === cnt ? cnt + 2 : s.vals.filter((v) => v > hi).length, "step_missing", "위쪽 경계만 썼다."), W(s.vals.filter((v) => v < q1 || v > q3).length, "scope", "사분위수 밖의 개수를 셌다."), W(Math.max(1, cnt - 1), "other", "하나를 빠뜨렸다.")], js: `const iqr = q3 - q1; return v.filter(x => x < q1 - 1.5 * iqr || x > q3 + 1.5 * iqr).length;`, trace: [slRead(s), [`Q1 = ${f(q1)}, Q3 = ${f(q3)}, IQR = ${f(iqr)} 이다.`, "Quartiles and IQR."], [`경계: ${f(lo)} 보다 작거나 ${f(hi)} 보다 크면 이상값이다.`, "Fences."], [`경계 밖 값은 ${cnt} 개이다.`, "Count."]], variant: "count_outliers_iqr_rule" }); } throw new GenFail("select"); } },
    { op: "compose_kind", structure: "(Q1 + Q3) ÷ 2 와 중앙값의 차를 구함", extra: "사분위수의 평균(중간 힌지)과 중앙값을 모두 계산해 비교 — medium 은 Q1 하나", concepts: ["줄기-잎 그림", "사분위수", "중앙값"],
      gen(rng) { for (let t = 0; t < 80; t++) { const s = makeSL(rng); const { q1, q3 } = quart(s.vals); const m = med(s.vals); const h = (q1 + q3) / 2; if (h === m) continue; const c = Math.abs(h - m);
        return D(rng, s, { stim: qdef(rng), question: "What is the positive difference between the median and the mean of the first and third quartiles?", correct: c, wrongs: [W(h, "step_missing", "Q1 과 Q3 의 평균만 답했다."), W(m, "step_missing", "중앙값만 답했다."), W(r1(q3 - q1), "scope", "IQR 을 답했다."), W(c + 1, "other", "1 어긋났다."), W(Math.abs(mean(s) - m), "formula_misuse", "자료의 평균을 썼다.")], js: `return Math.abs((q1 + q3) / 2 - md);`, trace: [slRead(s), [`Q1 = ${f(q1)}, Q3 = ${f(q3)}, 중앙값 = ${f(m)} 이다.`, "Quartiles and median."], [`(Q1 + Q3) ÷ 2 = ${f(h)} 이다.`, "Midpoint of the quartiles."], [`차 = ${f(c)} 이다.`, "Positive difference."]], variant: "midhinge_vs_median" }); } throw new GenFail("compose"); } },
  ],
  em: [
    { lv: "easy", name: "median", structure: "줄기-잎 그림의 중앙값을 구함", extra: "easy: 가운데 값", concepts: ["줄기-잎 그림", "중앙값"],
      gen(rng) { const s = makeSL(rng, { parity: "odd" }); const c = med(s.vals); return D(rng, s, { question: `What is the median of the values, in ${s.t.unit}?`, correct: c, wrongs: [W(s.vals[0], "axis_misread", "최솟값을 답했다."), W(s.vals[s.n - 1], "axis_misread", "최댓값을 답했다."), W(r1(mean(s)), "formula_misuse", "평균을 답했다."), W(c + 1, "other", "1 어긋났다.")], js: `if (n % 2 === 0) throw new Error('짝수 개'); return md;`, trace: [slRead(s), [`가운데 값은 ${f(c)} 이다.`, "Median."]], variant: "median_for_quartiles" }); } },
    { lv: "medium", name: "first_quartile", structure: "아래 절반의 중앙값으로 제1사분위수를 구함", extra: "medium: Q1", concepts: ["줄기-잎 그림", "사분위수"],
      gen(rng) { const s = makeSL(rng); const { q1 } = quart(s.vals); return D(rng, s, { stim: qdef(rng), question: "What is the first quartile of the values?", correct: q1, wrongs: [W(s.vals[0], "axis_misread", "최솟값을 답했다."), W(med(s.vals), "step_missing", "중앙값을 답했다."), W(quart(s.vals).q3, "opposite", "Q3 를 답했다."), W(r1(q1 + 1), "other", "1 어긋났다."), W(s.vals[Math.floor(s.n / 4)], "formula_misuse", "위치로 읽었다.")], js: `return q1;`, trace: [slRead(s), [`개수 ${s.n} 이므로 아래 절반은 가장 작은 ${Math.floor(s.n / 2)} 개이다.`, "Take the lower half."], [`아래 절반의 중앙값 = ${f(q1)} 이다.`, "First quartile."]], variant: "first_quartile" }); } },
  ],
});
export type { HardDef, EmDef };
