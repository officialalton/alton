// right_triangles_trigonometry.sinusoid_graph.TC.C — 식·말·변환으로 주어진 사인곡선 모형에 맞는 그래프를 같은 축의 그래프 4개 중에서 고른다.
// 오답 규칙(정답과 한 가지만 다름): TCR1_amplitude(진폭만 다름)·TCR2_period(주기만 다름: 절반 또는 두 배)·TCR3_midline(중심선만 다름). 선택지 그래프는 같은 축·눈금·제목을 쓴다.
import { GenFail, type Instance } from "../../../types";
import type { Rng } from "../../../rng";
import { placeChoices } from "../../../figure-kit";
import { choiceInst } from "../../tvd-fig-choice";
import { defineItem } from "../item-kit";
import { TC_CTX, type TcCtx } from "../tc-kit";

const SPR_NO = "정답이 선택지(그래프 4개 중 하나)를 고르는 것이 문제의 핵심이라 선택지 없이는 성립하지 않는다";
type Sc = { ctx: TcCtx; kind: "cos" | "sin"; A: number; k: number; T: number };
type Cf = { fn: "cos" | "sin"; A: number; k: number; T: number };
const FN = ["f", "g", "h", "p", "q", "d"];
const piTex = (T: number) => `\\frac{\\pi}{${T / 2}}`;
const curve = (c: Cf, ctx: TcCtx, Y: number, S: number) => ({ type: "trig_curve" as const, fn: c.fn, amp: c.A, period: c.T, mid: c.k, xUnit: "plain" as const, xRange: [0, 24] as [number, number], xStep: 2, yRange: [0, Y] as [number, number], yStep: S, xTitle: ctx.xt, yTitle: ctx.yt });
const DIAG = `const A=(x)=>Math.round(x*1e6); const same=(u,v)=>A(u)===A(v);
const dA=!same(c.amp,ok.amp), dT=!same(c.period,ok.period), dK=!same(c.mid,ok.mid);
if (dA&&!dT&&!dK) return "TCR1_amplitude"; if (!dA&&dT&&!dK) return "TCR2_period"; if (!dA&&!dT&&dK) return "TCR3_midline"; return null;`;
const PRED_HT = `const A=(x)=>Math.round(x*1e6); return c.fn===P.fn && A(c.amp)===A(P.A) && A(c.period)===A(2*P.hT) && A(c.mid)===A(P.k);`;
const PRED_EXT = `const A=(x)=>Math.round(x*1e6); return c.fn===P.fn && A(c.amp)===A((P.hi-P.lo)/2) && A(c.period)===A(P.T) && A(c.mid)===A((P.hi+P.lo)/2);`;
const PRED_CMP = `const A=(x)=>Math.round(x*1e6); return c.fn===P.fn && A(c.amp)===A(P.A) && A(c.period)===A(P.half?P.hTb:P.hTb*4) && A(c.mid)===A(P.k);`;
const PRED = `const A=(x)=>Math.round(x*1e6); return c.fn===P.fn && A(c.amp)===A(P.A) && A(c.period)===A(P.T) && A(c.mid)===A(P.k);`;
function scene(rng: Rng, o: { kind?: "cos" | "sin" } = {}): Sc {
  const ctx = rng.pick(TC_CTX); const kind = o.kind ?? rng.pick(["cos", "sin"] as const);
  return { ctx, kind, A: rng.pick([2, 3, 4, 5]), k: 0, T: rng.pick([8, 12, 24]) };
}
/** 정답 곡선 + 한 가지만 다른 오답 3개 → 같은 축의 4개 선택지. */
function makeChoices(rng: Rng, sc: Sc) {
  const ok: Cf = { fn: sc.kind, A: sc.A, k: sc.k, T: sc.T };
  const ampW = [sc.A - 1, sc.A + 1].filter((a) => a >= 1 && sc.k - a >= 0); const perW = [sc.T / 2, 2 * sc.T].filter((t) => t >= 4 && t <= 24); const midW = [sc.k - 2, sc.k + 2, sc.k - 1, sc.k + 1].filter((m) => m - sc.A >= 0);
  if (!ampW.length || !perW.length || !midW.length) throw new GenFail("오답 후보 부족");
  const wrong: { c: Cf; rule: string }[] = [{ c: { ...ok, A: rng.pick(ampW) }, rule: "TCR1_amplitude" }, { c: { ...ok, T: rng.pick(perW) }, rule: "TCR2_period" }, { c: { ...ok, k: rng.pick(midW) }, rule: "TCR3_midline" }];
  const top = Math.max(...[ok, ...wrong.map((w) => w.c)].map((c) => c.k + c.A)); const S = [1, 2, 5].find((s) => Math.ceil((top + 1) / s) <= 12) ?? 5; const Y = Math.ceil((top + 1) / S) * S;
  return { ok, ...placeChoices(rng, curve(ok, sc.ctx, Y, S), wrong.map((w) => ({ fig: curve(w.c, sc.ctx, Y, S), rule: w.rule }))) };
}
function build(rng: Rng, sc: Sc, o: { stim: string; question: string; trace: [string, string][]; variant: string; ko: string; en: string; P?: Record<string, number | string>; pred?: string }): Instance {
  const { choices, correctIndex, rules } = makeChoices(rng, sc);
  return choiceInst(rng, { stimulus: o.stim, question: o.question, choices, correctIndex, rules, P: o.P ?? { fn: sc.kind, A: sc.A, T: sc.T, k: sc.k }, predicateJs: o.pred ?? PRED, diagnoseJs: DIAG, trace: o.trace, variant: o.variant, explainKo: o.ko, explainEn: o.en });
}
const Q = ["Which of the following graphs represents the function?", "Which graph shown below could represent this function?", "Which of the graphs matches the function described above?"];
const EQ_FRAME = (rng: Rng, sc: Sc, fn: string, form: string) => {
  const eq = `$${fn}(t) = ${sc.A}\\${form}\\left(${piTex(sc.T)}t\\right) + ${sc.k}$`;
  return rng.pick([
    `The function $${fn}$ models ${sc.ctx.ent}: ${eq}, where $t$ is time in ${sc.ctx.xu}. Four graphs are shown.`,
    `A model of ${sc.ctx.ent} is given by ${eq}, with $t$ measured in ${sc.ctx.xu}. The choices show four graphs.`,
    `Let ${eq} model ${sc.ctx.ent}, where $t$ is in ${sc.ctx.xu}. Each of the four graphs below uses the same axes.`,
    `Data on ${sc.ctx.ent} are fit by the equation ${eq}, with time $t$ in ${sc.ctx.xu}. Four candidate graphs are shown.`,
    `The equation ${eq} describes ${sc.ctx.ent}, where $t$ is time in ${sc.ctx.xu}. Four graphs appear below.`,
  ]);
};
const lead = (rng: Rng, sc: Sc) => `${sc.ctx.lead} `;
const trSteps = (sc: Sc): [string, string][] => [[`진폭 ${sc.A}, 중심선 y = ${sc.k}, 주기 ${sc.T} 를 구한다.`, "Find amplitude, midline, and period."], [`${sc.kind === "cos" ? "코사인형은 t = 0 에서 최댓값" : "사인형은 t = 0 에서 중심선"} 이다.`, "The form fixes the starting point."], [`최댓값 ${sc.k + sc.A}, 최솟값 ${sc.k - sc.A} 이다.`, "Maximum and minimum."], [`네 그래프 중 진폭·중심선·주기가 모두 맞는 것을 고른다.`, "Match all three."]];
const fin: [string, string] = ["다른 그래프는 진폭, 주기, 중심선 중 하나만 다르다.", "Each other graph differs in exactly one feature."];

export const ITEM = defineItem({
  prefix: "rtt", itemId: "right_triangles_trigonometry.sinusoid_graph.TC.C",
  hard: [
    {
      op: "repr_shift", structure: "코사인·사인 식 a·cos(bt)+c 의 계수에서 진폭·주기·중심선을 읽어 그래프 4개 중에서 고름", extra: "b 에서 주기 2π÷b 를 구하고 c 를 중심선으로 읽어야 함(주기를 b 로 착각하거나 진폭·중심선을 바꿔 읽는 함정) — medium 은 말로 주어진 모형", sprNo: SPR_NO,
      concepts: ["삼각함수 그래프", "진폭·주기·중심선", "식 → 그래프"],
      gen(rng) {
        const sc = scene(rng); sc.k = sc.A + rng.int(1, 4); const fn = rng.pick(FN); const form = sc.kind === "cos" ? "\\cos" : "\\sin";
        return build(rng, sc, { stim: `${lead(rng, sc)}${rng.pick([`The function $${fn}$ models ${sc.ctx.ent} and is defined by $${fn}(t) = ${sc.A}${form}\\left(${piTex(sc.T)}t\\right) + ${sc.k}$, where $t$ is time in ${sc.ctx.xu}. Four graphs are shown.`, `A model of ${sc.ctx.ent} is $${fn}(t) = ${sc.A}${form}\\left(${piTex(sc.T)}t\\right) + ${sc.k}$ for $0 \\le t \\le 24$, with $t$ in ${sc.ctx.xu}. The choices show four graphs.`, `For $0 \\le t \\le 24$, where $t$ is measured in ${sc.ctx.xu}, ${sc.ctx.ent} is given by $${fn}(t) = ${sc.A}${form}\\left(${piTex(sc.T)}t\\right) + ${sc.k}$. Each of the four graphs below uses the same axes.`, `Researchers fit the equation $${fn}(t) = ${sc.A}${form}\\left(${piTex(sc.T)}t\\right) + ${sc.k}$ to data on ${sc.ctx.ent}, with time $t$ in ${sc.ctx.xu}. Four candidate graphs are shown.`])}`, question: rng.pick(Q), trace: [[`식에서 진폭 ${sc.A}, 중심선 y = ${sc.k} 를 읽는다.`, "Read amplitude and midline from the equation."], [`주기 = 2π ÷ (π/${sc.T / 2}) = ${sc.T} 이다.`, "Period is 2π over b."], ...trSteps(sc).slice(1), fin], P: { fn: sc.kind, A: sc.A, hT: sc.T / 2, k: sc.k }, pred: PRED_HT, variant: `equation_${sc.kind}`, ko: "식의 계수에서 읽은 값과 같은 그래프를 고른다.", en: "Choose the graph that matches the equation." });
      },
    },
    {
      op: "inverse", structure: "최댓값·최솟값·주기가 말로 주어질 때 진폭·중심선을 거꾸로 구해 그래프 4개 중에서 고름", extra: "최댓값과 최솟값에서 진폭과 중심선을 구해야 함(진폭을 최댓값으로 착각하는 함정) — medium 은 진폭·중심선·주기가 직접 주어진 모형", sprNo: SPR_NO,
      concepts: ["삼각함수 그래프", "최댓값·최솟값", "역산"],
      gen(rng) {
        const sc = scene(rng); sc.k = sc.A + rng.int(1, 4); const start = sc.kind === "cos" ? "its maximum at time 0" : "the midline value at time 0 and is increasing";
        return build(rng, sc, { stim: `${lead(rng, sc)}${rng.pick([`A sinusoidal model of ${sc.ctx.ent} has a maximum value of ${sc.k + sc.A} ${sc.ctx.yu}, a minimum value of ${sc.k - sc.A} ${sc.ctx.yu}, and a period of ${sc.T} ${sc.ctx.xu}. At time 0, the model has ${start}. Four graphs are shown.`, `The model for ${sc.ctx.ent} oscillates between ${sc.k - sc.A} and ${sc.k + sc.A} ${sc.ctx.yu} and repeats every ${sc.T} ${sc.ctx.xu}. It has ${start}. The choices show graphs of four functions.`, `The values of ${sc.ctx.ent} repeat every ${sc.T} ${sc.ctx.xu}, ranging from a low of ${sc.k - sc.A} to a high of ${sc.k + sc.A} ${sc.ctx.yu}. At time 0 the model has ${start}. Four graphs are shown with the same axes.`, `A periodic function models ${sc.ctx.ent}. Its minimum is ${sc.k - sc.A}, its maximum is ${sc.k + sc.A}, and its period is ${sc.T} ${sc.ctx.xu}; at time 0 it has ${start}. Which graph is shown below? Four choices are given.`])}`, question: rng.pick(Q), trace: [[`진폭 = (${sc.k + sc.A} - ${sc.k - sc.A}) ÷ 2 = ${sc.A} 이다.`, "Amplitude from the extremes."], [`중심선 = (${sc.k + sc.A} + ${sc.k - sc.A}) ÷ 2 = ${sc.k} 이다.`, "Midline from the extremes."], [`주기는 ${sc.T} 이고 ${sc.kind === "cos" ? "t = 0 에서 최댓값" : "t = 0 에서 중심선을 올라가며 지남"} 이다.`, "Period and starting behavior."], [`최댓값 ${sc.k + sc.A}, 최솟값 ${sc.k - sc.A} 를 갖는 그래프를 고른다.`, "Match the extremes."], fin], P: { fn: sc.kind, hi: sc.k + sc.A, lo: sc.k - sc.A, T: sc.T }, pred: PRED_EXT, variant: `extremes_${sc.kind}`, ko: "최댓값·최솟값·주기에 맞는 그래프를 고른다.", en: "Choose the graph with these extremes and period." });
      },
    },
    {
      op: "compare_scenarios", structure: "기준 모형의 진폭·중심선은 같고 주기만 바뀐 모형(주기의 절반·두 배)의 그래프를 4개 중에서 고름", extra: "기준 모형에서 한 특징만 바뀐 함수를 따로 구해야 함(기준 모형 그래프를 고르는 함정) — medium 은 기준 모형", sprNo: SPR_NO,
      concepts: ["삼각함수 그래프", "주기 변환", "두 모형 비교"],
      gen(rng) {
        const base = scene(rng); base.k = base.A + rng.int(1, 4); const half = rng.chance(0.5) && base.T / 2 >= 4; const T2 = half ? base.T / 2 : 2 * base.T; if (T2 > 24) throw new GenFail("범위"); const sc: Sc = { ...base, T: T2 };
        const fn = rng.pick(FN); const form = base.kind === "cos" ? "\\cos" : "\\sin"; const word = half ? "half" : "twice";
        return build(rng, sc, { stim: `${lead(rng, sc)}${rng.pick([`A model of ${base.ctx.ent} is $${fn}(t) = ${base.A}${form}\\left(${piTex(base.T)}t\\right) + ${base.k}$, where $t$ is time in ${base.ctx.xu}. A second model, $g$, has the same amplitude and midline as $${fn}$ but its period is ${word} the period of $${fn}$. Four graphs are shown.`, `The function $${fn}(t) = ${base.A}${form}\\left(${piTex(base.T)}t\\right) + ${base.k}$ describes ${base.ctx.ent}, with $t$ in ${base.ctx.xu}. Function $g$ keeps the amplitude and midline of $${fn}$, but its period is ${word} as long as the period of $${fn}$. Each of four graphs below uses the same axes.`, `Two models describe ${base.ctx.ent}. The first is $${fn}(t) = ${base.A}${form}\\left(${piTex(base.T)}t\\right) + ${base.k}$ ($t$ in ${base.ctx.xu}). The second, $g$, differs only in its period, which is ${word} the period of $${fn}$. The choices show four graphs.`])}`, question: `Which graph shows $g$?`, trace: [[`${fn} 의 진폭 ${base.A}, 중심선 y = ${base.k}, 주기 ${base.T} 를 읽는다.`, "Read the base model."], [`g 의 주기는 ${base.T} 의 ${half ? "절반" : "2 배"} = ${T2} 이다.`, "Change only the period."], [`진폭 ${base.A} 와 중심선 ${base.k} 는 그대로이다.`, "Amplitude and midline are unchanged."], [`${sc.kind === "cos" ? "코사인형은 t = 0 에서 최댓값" : "사인형은 t = 0 에서 중심선"} 이다.`, "Same form."], fin], P: { fn: sc.kind, A: sc.A, hTb: base.T / 2, half: half ? 1 : 0, k: sc.k }, pred: PRED_CMP, variant: `period_${half ? "half" : "double"}_${sc.kind}`, ko: "주기만 바뀐 함수의 그래프를 고른다.", en: "Choose the graph with the changed period." });
      },
    },
    {
      op: "chain2", structure: "진폭·중심선·주기를 말로 주고 식을 거치지 않고 최댓값·최솟값을 구해 그래프 4개 중에서 고름", extra: "진폭과 중심선에서 최댓값·최솟값을 구해 눈금에서 확인해야 함(진폭을 최댓값으로 착각하는 함정) — medium 은 식으로 주어진 모형", sprNo: SPR_NO,
      concepts: ["삼각함수 그래프", "진폭·중심선", "최댓값·최솟값"],
      gen(rng) {
        const sc = scene(rng); sc.k = sc.A + rng.int(1, 4);
        return build(rng, sc, { stim: `${lead(rng, sc)}${rng.pick([`A ${sc.kind === "cos" ? "cosine" : "sine"} model of ${sc.ctx.ent} has amplitude ${sc.A}, midline $y = ${sc.k}$, and period ${sc.T} ${sc.ctx.xu}. Four graphs are shown.`, `The graph of a ${sc.kind === "cos" ? "cosine" : "sine"} function modeling ${sc.ctx.ent} has an amplitude of ${sc.A}, a midline of $y = ${sc.k}$, and a period of ${sc.T} ${sc.ctx.xu}. The choices show four graphs.`, `Researchers describe ${sc.ctx.ent} with a ${sc.kind === "cos" ? "cosine" : "sine"} model whose amplitude is ${sc.A} and whose midline is $y = ${sc.k}$; one full cycle takes ${sc.T} ${sc.ctx.xu}. Four graphs are shown.`, `Four graphs are shown. One of them models ${sc.ctx.ent} with a ${sc.kind === "cos" ? "cosine" : "sine"} function of amplitude ${sc.A}, midline $y = ${sc.k}$, and period ${sc.T} ${sc.ctx.xu}.`])}`, question: rng.pick(Q), trace: [[`진폭 ${sc.A}, 중심선 y = ${sc.k} 에서 최댓값 = ${sc.k} + ${sc.A} = ${sc.k + sc.A} 이다.`, "Maximum from the midline and amplitude."], [`최솟값 = ${sc.k} - ${sc.A} = ${sc.k - sc.A} 이다.`, "Minimum."], [`주기 ${sc.T} 에서 한 번 반복되는 길이를 확인한다.`, "Check the cycle length."], [`${sc.kind === "cos" ? "코사인형은 t = 0 에서 최댓값" : "사인형은 t = 0 에서 중심선을 올라가며 지남"} 이다.`, "The form fixes the start."], fin], variant: `described_${sc.kind}`, ko: "말로 주어진 진폭·중심선·주기에 맞는 그래프를 고른다.", en: "Choose the graph that matches the description." });
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "equation_cos", structure: "코사인 식의 진폭·주기·중심선에 맞는 그래프를 고름", extra: "easy: 식의 계수를 그대로 읽음", sprNo: SPR_NO, concepts: ["삼각함수 그래프", "식 → 그래프"],
      gen(rng) {
        const sc = scene(rng, { kind: "cos" }); sc.k = sc.A + rng.int(1, 4); const fn = rng.pick(FN);
        return build(rng, sc, { stim: `${lead(rng, sc)}${EQ_FRAME(rng, sc, fn, "cos")}`, question: rng.pick(Q), trace: [[`식에서 진폭 ${sc.A}, 중심선 y = ${sc.k}, 주기 ${sc.T} 를 읽는다.`, "Read the three features."], [`t = 0 에서 최댓값 ${sc.k + sc.A} 이다.`, "Cosine starts at the maximum."]], P: { fn: sc.kind, A: sc.A, hT: sc.T / 2, k: sc.k }, pred: PRED_HT, variant: "easy_equation_cos", ko: "식에서 읽은 값에 맞는 그래프를 고른다.", en: "Choose the matching graph." });
      },
    },
    {
      lv: "medium", name: "equation_sin", structure: "사인 식의 진폭·주기·중심선에 맞는 그래프를 고름", extra: "medium: 사인형의 시작점", sprNo: SPR_NO, concepts: ["삼각함수 그래프", "식 → 그래프", "사인형"],
      gen(rng) {
        const sc = scene(rng, { kind: "sin" }); sc.k = sc.A + rng.int(1, 4); const fn = rng.pick(FN);
        return build(rng, sc, { stim: `${lead(rng, sc)}${EQ_FRAME(rng, sc, fn, "sin")}`, question: rng.pick(Q), trace: [[`식에서 진폭 ${sc.A}, 중심선 y = ${sc.k}, 주기 ${sc.T} 를 읽는다.`, "Read the three features."], [`사인형이므로 t = 0 에서 중심선 ${sc.k} 을 올라가며 지난다.`, "Sine starts at the midline."], [`최댓값 ${sc.k + sc.A}, 최솟값 ${sc.k - sc.A} 이다.`, "Maximum and minimum."]], P: { fn: sc.kind, A: sc.A, hT: sc.T / 2, k: sc.k }, pred: PRED_HT, variant: "med_equation_sin", ko: "식에서 읽은 값에 맞는 그래프를 고른다.", en: "Choose the matching graph." });
      },
    },
  ],
});
