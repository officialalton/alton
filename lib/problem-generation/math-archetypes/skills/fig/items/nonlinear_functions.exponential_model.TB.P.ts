// nonlinear_functions.exponential_model.TB.P — 지수 성장·감소 값표에서 모형 y = a·b^x 의 상수(초깃값·비·증가율)를 구하고 예측한다(카탈로그 부록 B 신규 패턴).
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { EXP_JS, expTab, fmtR, isInt, xsRun, type Exp } from "./_t5-kit";

type Scene = { xa: string; xu: string; one: string; ya: string; ctx: string; noun: string; grow: boolean };
const SCENES: Scene[] = [
  { xa: "Time", xu: "hours", one: "hour", ya: "Number of bacteria", ctx: "A biologist counts the bacteria in a culture", noun: "the number of bacteria", grow: true },
  { xa: "Time", xu: "days", one: "day", ya: "Number of algae cells", ctx: "A scientist records the algae cells in a sample of pond water", noun: "the number of algae cells", grow: true },
  { xa: "Time", xu: "weeks", one: "week", ya: "Number of followers", ctx: "A new online account tracks its followers", noun: "the number of followers", grow: true },
  { xa: "Time", xu: "years", one: "year", ya: "Number of rabbits", ctx: "Ecologists estimate the rabbit population on an island", noun: "the number of rabbits", grow: true },
  { xa: "Time", xu: "months", one: "month", ya: "Number of app users", ctx: "A company records the users of a new app", noun: "the number of users", grow: true },
  { xa: "Time", xu: "minutes", one: "minute", ya: "Number of yeast cells", ctx: "A baker's lab tracks yeast cells in a dough sample", noun: "the number of yeast cells", grow: true },
  { xa: "Time", xu: "hours", one: "hour", ya: "Medicine in body (milligrams)", ctx: "A nurse records the amount of a medicine remaining in a patient's body", noun: "the amount of medicine", grow: false },
  { xa: "Time", xu: "years", one: "year", ya: "Value of machine (hundreds of dollars)", ctx: "An accountant tracks the value of a factory machine", noun: "the value of the machine", grow: false },
  { xa: "Time", xu: "days", one: "day", ya: "Mass of sample (grams)", ctx: "A lab measures the mass of a radioactive sample", noun: "the mass of the sample", grow: false },
  { xa: "Bounce number", xu: "bounces", one: "bounce", ya: "Bounce height (centimeters)", ctx: "A physics student drops a ball and measures the height of each bounce", noun: "the bounce height", grow: false },
  { xa: "Time", xu: "weeks", one: "week", ya: "Number of plants infected", ctx: "A farmer tracks the plants infected by a spreading blight", noun: "the number of infected plants", grow: true },
  { xa: "Time", xu: "hours", one: "hour", ya: "Water in tank (liters)", ctx: "Water drains from a leaking tank", noun: "the amount of water", grow: false },
  { xa: "Time", xu: "days", one: "day", ya: "Number of fruit flies", ctx: "A biology class tracks a population of fruit flies in a jar", noun: "the number of fruit flies", grow: true },
  { xa: "Time", xu: "years", one: "year", ya: "Number of deer", ctx: "A wildlife agency estimates the deer population in a park", noun: "the number of deer", grow: true },
  { xa: "Time", xu: "hours", one: "hour", ya: "Number of shares of a video", ctx: "A video spreads online, and its shares are counted", noun: "the number of shares", grow: true },
  { xa: "Time", xu: "months", one: "month", ya: "Number of subscribers", ctx: "A podcast records its subscribers each month", noun: "the number of subscribers", grow: true },
  { xa: "Time", xu: "weeks", one: "week", ya: "Area of mold (square millimeters)", ctx: "A student measures the area covered by mold on a slice of bread", noun: "the area covered by mold", grow: true },
  { xa: "Time", xu: "years", one: "year", ya: "Number of trees", ctx: "A forest service counts the young trees in a replanted area", noun: "the number of trees", grow: true },
  { xa: "Time", xu: "days", one: "day", ya: "Number of people who heard a rumor", ctx: "A sociologist studies how a rumor spreads through a school", noun: "the number of people who heard the rumor", grow: true },
  { xa: "Time", xu: "minutes", one: "minute", ya: "Temperature difference (degrees)", ctx: "A cup of hot tea cools, and the difference between its temperature and the room temperature is recorded", noun: "the temperature difference", grow: false },
  { xa: "Time", xu: "years", one: "year", ya: "Value of car (hundreds of dollars)", ctx: "A dealer tracks the value of a used car", noun: "the value of the car", grow: false },
  { xa: "Time", xu: "hours", one: "hour", ya: "Caffeine in body (milligrams)", ctx: "A study measures the caffeine remaining in a person's body after a drink", noun: "the amount of caffeine", grow: false },
  { xa: "Time", xu: "weeks", one: "week", ya: "Number of fish in a pond", ctx: "A pond is affected by pollution, and the fish are counted", noun: "the number of fish", grow: false },
  { xa: "Time", xu: "days", one: "day", ya: "Air in a balloon (cubic inches)", ctx: "A slowly leaking balloon loses air, and its volume is measured", noun: "the volume of air", grow: false },
  { xa: "Filter number", xu: "filters", one: "filter", ya: "Light passing through (lumens)", ctx: "Light passes through a stack of identical filters", noun: "the amount of light", grow: false },
];
/** 증가 비·감소 비(per 한 단위)와 그 비에서 a 의 배수 조건. */
const GROW = [{ r: 2, den: 1 }, { r: 3, den: 1 }, { r: 1.5, den: 2 }, { r: 1.25, den: 4 }];
const DECAY = [{ r: 0.5, den: 2 }, { r: 0.75, den: 4 }, { r: 0.8, den: 5 }];
function scene(rng: Rng, o: { x0?: number; d?: number; rs?: { r: number; den: number }[] } = {}): Exp & { s: Scene; d: number } {
  for (let t = 0; t < 120; t++) {
    const s = rng.pick(SCENES); const pool = o.rs ?? (s.grow ? GROW : DECAY); const { r, den } = rng.pick(pool); const d = o.d ?? 1; const n = 4; const x0 = o.x0 ?? 0; const xs = xsRun(x0, n, d);
    const steps = x0 + d * (n - 1); const a = den ** steps * rng.int(1, 12);
    try { const e = expTab("f", a, r, xs, [`${s.xa} (${s.xu})`, s.ya]); return { ...e, s, d }; } catch { continue; }
  }
  throw new GenFail("지수 장면 표집 실패");
}
const intro = (rng: Rng, e: { s: Scene }) => rng.pick([
  `${e.s.ctx}. The table shows ${e.s.noun} at several times.`,
  `${e.s.ctx}, and the results are shown in the table.`,
  `${e.s.ctx}. According to the table shown, ${e.s.noun} changes by the same factor over equal intervals.`,
  `${e.s.ctx}. The data in the table can be modeled by an exponential function.`,
  `The table shown gives ${e.s.noun} recorded at equal intervals. ${e.s.ctx}.`,
  `Based on data in the table, ${e.s.noun} follows an exponential pattern. ${e.s.ctx}.`,
  `${e.s.ctx}. Each measurement is listed in the table, and ${e.s.noun} is multiplied by the same amount between consecutive entries.`,
  `For a project, ${lcF(e.s.ctx)}. The measurements are in the table shown.`,
]).replace(/at several times/, e.s.xa === "Time" ? "at several times" : "for several bounces");
const modelSent = (rng: Rng, e: { s: Scene }) => rng.pick([
  `The relationship can be modeled by $y = a(b)^x$, where $y$ is ${e.s.noun}, $x$ is the number of ${e.s.xu}, and $a$ and $b$ are positive constants.`,
  `An exponential model of the form $y = a(b)^x$, where $a$ and $b$ are positive constants, fits the data, with $x$ the number of ${e.s.xu}.`,
]);
const lcF = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
const readR = (e: Exp & { s: Scene }): [string, string] => [`연속한 값의 비가 ${fmtR(e.ys[1] / e.ys[0])} 로 일정하다.`, "Consecutive values have a constant ratio."];

export const ITEM = defineItem({
  prefix: "nf", itemId: "nonlinear_functions.exponential_model.TB.P",
  hard: [
    {
      op: "repr_shift", structure: "x = 0 이 없는 지수 값표에서 비 b 를 구하고 거슬러 나눠 모형 y = a·b^x 의 a(초깃값)를 구함", extra: "표의 첫 값이 x = 0 이 아니라 비로 거슬러 나눠 a 로 바꿔야 함(첫 값을 a 로 쓰는 것이 함정) — medium 은 비 b",
      concepts: ["지수 값표의 일정한 비", "지수 모형 y = a·b^x", "초깃값 역산"],
      gen(rng) {
        const e = scene(rng, { x0: rng.int(1, 2) }); const ans = e.a; if (!isInt(ans)) throw new GenFail("a");
        return figInst(rng, {
          stimulus: `${intro(rng, e)} ${modelSent(rng, e)}`, question: `What is the value of $a$?`, correct: ans,
          wrongs: [W(e.ys[0], "axis_misread", "표 첫 값을 a 로 썼다."), W(e.ys[0] * e.r, "sign_error", "비를 거꾸로 적용했다."), W(e.ys[0] - (e.ys[1] - e.ys[0]) * e.xs[0], "formula_misuse", "일정한 차로 거슬러 계산했다."), W(ans * e.r, "other", "한 번 덜 나눴다."), W(e.r, "axis_misread", "b 를 답했다.")].filter((w) => w.v !== ans && w.v > 0),
          verificationJs: figJs({}, e.fig, `${EXP_JS}return E0;`),
          trace: [[`표에서 (${e.xs[0]}, ${e.ys[0]}), (${e.xs[1]}, ${e.ys[1]}) 을 읽는다.`, "Read the table."], readR(e), [`b = ${fmtR(e.r)} 이다.`, "The base is the common ratio per unit."], [`x = ${e.xs[0]} 에서 x = 0 까지 ${e.xs[0]} 번 거슬러 b 로 나눈다.`, "Work backward to x = 0."], [`a = ${e.ys[0]} ÷ ${fmtR(e.r)}^${e.xs[0]} = ${fmtNum(ans)} 이다.`, "Divide to find a."]], variant: "initial_value_backward",
        }, e.fig);
      },
    },
    {
      op: "unit_ratio", structure: "x 간격이 2 인 지수 값표에서 한 단위(1)당 비를 구해 한 단위당 증가(감소) 백분율을 구함", extra: "표의 한 칸 비(2 단위)를 제곱근으로 한 단위 비로 바꾼 뒤 백분율로 환산해야 함(한 칸 비로 백분율을 내는 것이 함정) — medium 은 1 단위 표의 비",
      concepts: ["지수 값표의 일정한 비", "구간 길이와 비(제곱근)", "백분율 증가·감소"],
      gen(rng) {
        const e = scene(rng, { d: 2, rs: undefined }); const pct = Math.round(Math.abs(e.r - 1) * 100); const pct2 = Math.round(Math.abs(e.r * e.r - 1) * 100); const up = e.r > 1;
        return figInst(rng, {
          stimulus: `${intro(rng, e)} ${rng.pick([`Assume ${e.s.noun} ${up ? "increases" : "decreases"} by the same percent each ${e.s.one}.`, `The percent change per ${e.s.one} is constant.`, `Over each ${e.s.one}, ${e.s.noun} changes by a fixed percent.`, `Suppose the ${up ? "growth" : "decay"} rate per ${e.s.one} stays the same.`])}`, question: rng.pick([`By what percent does ${e.s.noun} ${up ? "increase" : "decrease"} each ${e.s.one}?`, `What is the percent ${up ? "increase" : "decrease"} in ${e.s.noun} per ${e.s.one}?`, `If ${e.s.noun} ${up ? "increases" : "decreases"} by $p$ percent each ${e.s.one}, what is the value of $p$?`]), correct: pct,
          wrongs: [W(pct2, "unit_error", "표의 한 칸(2 단위) 변화율을 답했다."), W(pct2 / 2, "formula_misuse", "2 단위 변화율을 반으로 나눴다."), W(Math.round(e.r * 100), "formula_misuse", "비 자체를 백분율로 답했다."), W(100 - pct, "sign_error", "남는 비율을 답했다."), W(Math.round(Math.abs(e.ys[1] - e.ys[0]) / e.ys[0] * 100 / 2), "formula_misuse", "차를 첫 값으로 나눠 반으로 했다.")].filter((w) => w.v !== pct && w.v > 0),
          verificationJs: figJs({}, e.fig, `${EXP_JS}return Math.round(Math.abs(R - 1) * 1e6) / 1e4;`),
          trace: [[`표의 x 는 2 ${e.s.xu} 간격이다.`, "The table uses 2-unit steps."], [`연속한 값의 비(2 단위) = ${fmtR(e.r * e.r)} 이다.`, "Ratio per step."], [`한 단위 비 = √${fmtR(e.r * e.r)} = ${fmtR(e.r)} 이다.`, "Take the square root for one unit."], [`변화율 = |${fmtR(e.r)} - 1| = ${fmtR(Math.abs(e.r - 1))} 이다.`, "Subtract 1."], [`백분율 = ${pct}% 이다.`, "Convert to a percent."]], variant: "percent_per_unit",
        }, e.fig);
      },
    },
    {
      op: "chain2", structure: "지수 값표의 비로 모형을 이어 가, 값이 처음으로 기준 T 보다 커지는(작아지는) 정수 x 를 구함", extra: "비 → 표 밖으로 이어 계산 → 기준과 비교, 2단 연쇄(기준을 넘기 직전 x 를 답하는 것이 함정) — medium 은 비",
      concepts: ["지수 값표의 일정한 비", "지수 모형 예측", "부등식(기준 넘기)"],
      gen(rng) {
        const e = scene(rng, { rs: undefined }); const last = e.xs[e.xs.length - 1]; const k = rng.int(1, 3); const f = (x: number) => e.a * e.r ** x;
        const up = e.r > 1; const lo = f(last + k - 1), hi = f(last + k); const T = up ? Math.floor((lo + hi) / 2) : Math.ceil((lo + hi) / 2); if (T > 999 || T < 1 || (up ? !(lo < T && T < hi) : !(hi < T && T < lo))) throw new GenFail("T");
        const ans = last + k;
        return figInst(rng, {
          stimulus: `${intro(rng, e)} Assume the pattern in the table continues.`, question: `What is the least number of ${e.s.xu} after which ${e.s.noun} is ${up ? "greater" : "less"} than ${T}?`, correct: ans,
          wrongs: [W(ans - 1, "step_missing", "기준을 넘기 직전 x 를 답했다."), W(ans + 1, "other", "한 단위 더 갔다."), W(last, "condition_ignored", "표의 마지막 x 를 답했다."), W(Math.ceil((T - e.ys[0]) / Math.max(1, Math.abs(e.ys[1] - e.ys[0]))), "formula_misuse", "일정한 차로 계산했다.")].filter((w) => w.v !== ans && w.v > 0),
          verificationJs: figJs({ T, up: up ? 1 : 0 }, e.fig, `${EXP_JS}for (let x = 0; x < 60; x++) { const v = g(x); if (P.up ? v > P.T + 1e-9 : v < P.T - 1e-9) return x; } throw new Error('넘지 않음');`),
          trace: [[`표의 값을 읽는다.`, "Read the table."], readR(e), [`표 밖 값: ${Array.from({ length: k }, (_, i) => `${last + i + 1} → ${fmtR(f(last + i + 1))}`).join(", ")} 이다.`, "Continue the pattern."], [`${fmtR(lo)} 은 ${T} 를 넘지 않고 ${fmtR(hi)} 에서 넘는다.`, "Compare with the threshold."], [`따라서 x = ${ans} 이다.`, "The first x past the threshold."]], variant: "first_past_threshold",
        }, e.fig);
      },
    },
    {
      op: "inverse", structure: "x 간격이 d 인 지수 값표를 모형 y = a·m^(x/k) 로 쓸 때 k(같은 배수가 되는 데 걸리는 단위 수)를 역으로 구함", extra: "표 간격에서 비가 m 이 되는 데 걸리는 길이로 지수 x/k 를 해석해 k 를 거꾸로 구해야 함 — medium 은 비",
      concepts: ["지수 값표의 일정한 비", "지수 모형의 지수 해석", "배가 시간(반감기)"],
      gen(rng) {
        const j = rng.pick([1, 1, 2]); const d = j === 1 ? rng.pick([2, 3, 4, 5]) : rng.pick([2, 4, 6]); const k = d / j;
        const s = rng.pick(SCENES); const m = s.grow ? rng.pick([2, 3]) : 0.5; const step = m ** j; const n = 4; const xs = xsRun(0, n, d);
        const a = (s.grow ? 1 : 2 ** (j * (n - 1))) * rng.int(1, s.grow ? 9 : 3); const ys = xs.map((_, i) => Math.round(a * step ** i)); if (ys.some((y) => y > 999 || y < 1)) throw new GenFail("big");
        const fig = { type: "data" as const, kind: "table" as const, columns: [`${s.xa} (${s.xu})`, s.ya], rows: xs.map((x, i) => [x, ys[i]]) }; const e = { s };
        const mt = m === 0.5 ? "\\frac{1}{2}" : String(m);
        return figInst(rng, {
          stimulus: `${intro(rng, e)} ${rng.pick([`The relationship can be modeled by $y = a\\left(${mt}\\right)^{x/k}$, where $y$ is ${s.noun}, $x$ is the number of ${s.xu}, and $a$ and $k$ are positive constants.`, `A model for the data is $y = a\\left(${mt}\\right)^{x/k}$, where $a$ and $k$ are positive constants and $x$ is the number of ${s.xu}.`, `An analyst writes ${s.noun} after $x$ ${s.xu} as $y = a\\left(${mt}\\right)^{x/k}$, where $a$ and $k$ are positive constants.`])}`, question: rng.pick([`What is the value of $k$?`, `Which value of $k$ makes the model fit the table?`, `According to the table, what is $k$?`]), correct: k,
          wrongs: [W(d * j === k ? d + 1 : d * j, "formula_misuse", "지수를 거꾸로 해석했다."), W(1 / k, "sign_error", "k 의 역수를 답했다."), W(j === 1 ? d / 2 : d, "unit_error", "한 칸 비와 밑의 관계를 놓쳤다."), W(step, "axis_misread", "한 칸 비를 답했다."), W(a, "axis_misread", "a 를 답했다."), W(k + 1, "other", "어긋났다.")].filter((w) => Math.abs(w.v - k) > 1e-9 && w.v > 0),
          verificationJs: figJs({ m }, fig, `${EXP_JS}return Math.round(ed * Math.log(P.m) / Math.log(er) * 1e6) / 1e6;`),
          trace: [[`표의 x 는 ${d} ${s.xu} 간격이다.`, "Read the step of the table."], [`한 칸마다 값이 ${fmtR(step)} 배가 된다.`, "Find the ratio per step."], [`${fmtR(step)} = (${fmtR(m)})^${j} 이므로 ${d} ${s.xu} 동안 지수 x/k 가 ${j} 늘어야 한다.`, "Match the ratio to a power of the base."], [`${d} ÷ k = ${j} 이다.`, "Set up the exponent equation."], [`k = ${fmtNum(k)} 이다.`, "Solve for k."]], variant: "exponent_period",
        }, fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "next_value", structure: "지수 값표의 일정한 비로 다음 값을 구함", extra: "easy: 비를 한 번 곱함", concepts: ["지수 값표", "일정한 비"],
      gen(rng) {
        const e = scene(rng); const x = e.xs[e.xs.length - 1] + 1; const y = e.a * e.r ** x; if (!isInt(Math.round(y * 1e9) / 1e9) || y > 999) throw new GenFail("y");
        const n = e.ys.length - 1; const diff = e.ys[n] + (e.ys[n] - e.ys[n - 1]);
        return figInst(rng, { stimulus: `${intro(rng, e)} Assume the pattern in the table continues.`, question: `What is ${e.s.noun} after ${x} ${e.s.xu}?`, correct: Math.round(y), wrongs: [W(diff, "formula_misuse", "일정한 차로 이어 갔다."), W(e.ys[n], "axis_misread", "마지막 값을 답했다."), W(Math.round(y * e.r), "other", "한 번 더 곱했다."), W(e.ys[n] * 2, "formula_misuse", "두 배로 했다.")].filter((w) => w.v !== Math.round(y) && w.v > 0), verificationJs: figJs({ x }, e.fig, `${EXP_JS}return Math.round(g(P.x) * 1e6) / 1e6;`), trace: [readR(e), [`다음 값 = ${e.ys[n]} × ${fmtR(e.r)} = ${fmtNum(Math.round(y))} 이다.`, "Multiply by the ratio."]], variant: "next_by_ratio",
        }, e.fig);
      },
    },
    {
      lv: "medium", name: "base", structure: "x = 0 부터인 지수 값표에서 모형 y = a·b^x 의 b 를 구함", extra: "medium: 비 = b", concepts: ["지수 값표", "지수 모형의 밑"],
      gen(rng) {
        const e = scene(rng, { x0: 0 }); const ans = e.r;
        return figInst(rng, { stimulus: `${intro(rng, e)} ${modelSent(rng, e)}`, question: `What is the value of $b$?`, correct: ans, wrongs: [W(e.ys[1] - e.ys[0], "formula_misuse", "차를 답했다."), W(e.ys[0], "axis_misread", "a 를 답했다."), W(1 / e.r, "sign_error", "비를 뒤집었다."), W(Math.abs(e.r - 1), "formula_misuse", "변화율을 답했다."), W(e.r + 1, "other", "어긋났다.")].filter((w) => Math.abs(w.v - ans) > 1e-9 && w.v > 0), verificationJs: figJs({}, e.fig, `${EXP_JS}return Math.round(R * 1e6) / 1e6;`), trace: [[`x = 0 의 값 ${e.ys[0]} 이 a 이다.`, "The value at x = 0 is a."], readR(e), [`b = ${fmtR(ans)} 이다.`, "The ratio is b."]], variant: "base_from_ratio",
        }, e.fig);
      },
    },
  ],
});
