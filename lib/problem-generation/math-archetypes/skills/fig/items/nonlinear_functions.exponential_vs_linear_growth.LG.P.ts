// nonlinear_functions.exponential_vs_linear_growth.LG.P — 한 선그래프에 일차(같은 차)와 지수(같은 비) 성장 두 선이 함께 있고(범례), 지문은 선 이름 대신 '지수적으로/일차로 늘어나는 쪽'으로 가리킨다.
// 두 성장을 표 밖으로 이어 역전 시점·값의 차·역산을 구한다. 선 이름(범례)과 숫자가 한 절에 있으면 자료 값 참조 lint 가 오탐하므로 이름은 지문에 쓰지 않는다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst } from "../graph-kit";

type Topic = { xu: string; one: string; yu: string; A: string; B: string; what: string; noun: string };
const TOPICS: Topic[] = [
  { xu: "weeks", one: "week", yu: "dollars", A: "Plan A", B: "Plan B", what: "the balances of two savings plans", noun: "balance" },
  { xu: "months", one: "month", yu: "members", A: "Club A", B: "Club B", what: "the membership of two clubs", noun: "membership" },
  { xu: "days", one: "day", yu: "views", A: "Video A", B: "Video B", what: "the total views of two online videos", noun: "number of views" },
  { xu: "years", one: "year", yu: "animals", A: "Herd A", B: "Herd B", what: "the sizes of two animal herds", noun: "size" },
  { xu: "hours", one: "hour", yu: "cells", A: "Sample A", B: "Sample B", what: "the cell counts in two lab samples", noun: "cell count" },
  { xu: "weeks", one: "week", yu: "downloads", A: "App A", B: "App B", what: "the total downloads of two apps", noun: "number of downloads" },
  { xu: "months", one: "month", yu: "customers", A: "Store A", B: "Store B", what: "the customers of two new stores", noun: "number of customers" },
  { xu: "days", one: "day", yu: "plants", A: "Garden A", B: "Garden B", what: "the plant counts in two gardens", noun: "number of plants" },
  { xu: "weeks", one: "week", yu: "followers", A: "Account A", B: "Account B", what: "the followers of two online accounts", noun: "number of followers" },
  { xu: "months", one: "month", yu: "subscribers", A: "Channel A", B: "Channel B", what: "the subscribers of two video channels", noun: "number of subscribers" },
  { xu: "days", one: "day", yu: "signatures", A: "Petition A", B: "Petition B", what: "the signatures on two petitions", noun: "number of signatures" },
  { xu: "years", one: "year", yu: "trees", A: "Forest A", B: "Forest B", what: "the young trees in two replanted forests", noun: "number of trees" },
];
type Fig = { type: "data"; kind: "line"; categories: string[]; series: { name: string; values: number[] }[]; xTitle: string; yTitle: string; yMin: number; yMax: number; yStep: number };
type Sc = { t: Topic; xs: number[]; m: number; b: number; a: number; r: number; fig: Fig; L: (x: number) => number; G: (x: number) => number; cross: number; linFirst: boolean };
/** 일차 L(x) = m x + b, 지수 G(x) = a r^x. 그래프 안(x ≤ 마지막 점)에서는 L ≥ G, 밖 cross 에서 처음 G > L. 값은 모두 눈금 간격의 배수. */
function make(rng: Rng): Sc {
  for (let tr = 0; tr < 400; tr++) {
    const t = rng.pick(TOPICS); const s = rng.pick([10, 20, 25, 50]); const r = rng.pick([2, 2, 3]); const n = rng.int(4, 5); const xs = Array.from({ length: n }, (_, i) => i);
    const a = s * rng.int(1, 2); const m = s * rng.int(1, 4); const b = s * rng.int(2, 8);
    const L = (x: number) => m * x + b, G = (x: number) => a * r ** x; const last = xs[n - 1];
    if (xs.some((x) => G(x) > L(x)) || G(last) === L(last)) continue; if (xs.some((x) => G(x) > 999 || L(x) > 999)) continue;
    let cross = -1; for (let x = last + 1; x < last + 12; x++) if (G(x) > L(x)) { cross = x; break; }
    if (cross < 0 || cross - last > 4 || G(cross) > 999 || L(cross) > 999) continue;
    const top = Math.max(L(last), G(last)); const yMax = (Math.floor(top / s) + 1) * s; if (yMax / s > 12) continue;
    const linFirst = rng.chance(0.5); const lv = xs.map(L), gv = xs.map(G);
    const fig: Fig = { type: "data", kind: "line", categories: xs.map(String), series: linFirst ? [{ name: t.A, values: lv }, { name: t.B, values: gv }] : [{ name: t.A, values: gv }, { name: t.B, values: lv }], xTitle: `Time (${t.xu})`, yTitle: `${t.noun[0].toUpperCase()}${t.noun.slice(1)} (${t.yu})`, yMin: 0, yMax, yStep: s };
    return { t, xs, m, b, a, r, fig, L, G, cross, linFirst };
  }
  throw new GenFail("일차·지수 선그래프 장면 표집 실패");
}
/** FIGURE 의 두 계열 중 같은 차인 쪽(일차)과 같은 비인 쪽(지수)을 가려 L(x)·G(x) 를 만든다. */
const JS = "const S=FIGURE.series; if (S.length!==2) throw new Error('계열 둘 아님'); const xs=FIGURE.categories.map(Number); if (xs.length<4) throw new Error('점 부족'); const isLin=(v)=>v.every((x,i)=>i<2||Math.abs((x-v[i-1])-(v[1]-v[0]))<1e-9); const isExp=(v)=>v.every((x,i)=>i<2||Math.abs(x/v[i-1]-v[1]/v[0])<1e-9); const li=[0,1].filter(i=>isLin(S[i].values)&&!isExp(S[i].values)), ei=[0,1].filter(i=>isExp(S[i].values)&&!isLin(S[i].values)); if (li.length!==1||ei.length!==1||li[0]===ei[0]) throw new Error('일차·지수 구분 실패'); const lv=S[li[0]].values, ev=S[ei[0]].values; if (lv.some(x=>x<=0)||ev.some(x=>x<=0)) throw new Error('값 오류'); const d=xs[1]-xs[0]; const m=(lv[1]-lv[0])/d, b=lv[0]-m*xs[0]; const Rr=Math.pow(ev[1]/ev[0],1/d), E0=ev[0]/Math.pow(Rr,xs[0]); const L=(x)=>m*x+b, G=(x)=>E0*Math.pow(Rr,x); for (let i=0;i<xs.length;i++) if (Math.abs(L(xs[i])-lv[i])>1e-9||Math.abs(G(xs[i])-ev[i])>1e-6) throw new Error('식과 점 불일치'); if (xs.some(x=>G(x)>L(x)+1e-9)) throw new Error('그래프 안에서 역전');\n";
const intro = (rng: Rng, s: Sc) => rng.pick([
  `The graph shows ${s.t.what} over time. One of them grows linearly and the other grows exponentially.`,
  `The line graph shown compares ${s.t.what}. For one, the ${s.t.noun} increases by the same amount each ${s.t.one}; for the other, it is multiplied by the same factor each ${s.t.one}.`,
  `A report tracked ${s.t.what}, as shown in the graph. One pattern is linear and the other is exponential.`,
  `Data on ${s.t.what} are plotted in the graph. One of the two lines is a linear pattern, and the other is an exponential pattern.`,
  `An analyst compared ${s.t.what} using the graph shown. The patterns in the graph are a linear one and an exponential one.`,
  `The graph records ${s.t.what} at the end of each ${s.t.one}. One quantity follows a linear pattern and the other an exponential pattern.`,
]);
const cont = (rng: Rng) => rng.pick(["Assume both patterns continue.", "Suppose each pattern continues.", "Assume the patterns shown in the graph continue.", "Both patterns continue beyond the graph."]);
const rd = (n: number) => Math.round(n * 1e6) / 1e6;
const readBoth = (s: Sc): [string, string][] => [
  [`일차인 선: 한 ${s.t.one}마다 ${s.m} 씩 늘어 L(x) = ${s.m}x + ${s.b} 이다.`, "The linear line has a constant difference."],
  [`지수인 선: 한 ${s.t.one}마다 ${s.r} 배가 되어 G(x) = ${s.a}·${s.r}^x 이다.`, "The exponential line has a constant ratio."],
];

export const ITEM = defineItem({
  prefix: "nf", itemId: "nonlinear_functions.exponential_vs_linear_growth.LG.P",
  hard: [
    {
      op: "compare_scenarios", structure: "그래프의 일차·지수 두 선을 구분해 식으로 세워 이어 가며, 지수 쪽이 처음으로 일차 쪽보다 커지는 x 를 구함", extra: "두 선을 같은 차·같은 비로 구분해 그래프 밖까지 이어 비교해야 함(역전 직전 x 를 답하는 것이 함정) — medium 은 다음 칸의 차",
      concepts: ["일차 관계(같은 차)", "지수 관계(같은 비)", "두 성장의 비교·역전"],
      gen(rng) {
        const s = make(rng); const ans = s.cross;
        return gInst(rng, {
          stimulus: `${intro(rng, s)} ${cont(rng)}`, question: `What is the least number of ${s.t.xu} for which the ${s.t.noun} of the exponentially growing one is greater than the ${s.t.noun} of the linearly growing one?`, correct: ans,
          wrongs: [W(ans - 1, "step_missing", "역전 직전 시점을 답했다."), W(ans + 1, "other", "한 단위 늦게 잡았다."), W(s.xs[s.xs.length - 1], "condition_ignored", "그래프의 마지막 시점을 답했다."), W(ans + 3, "other", "어긋났다."), W(ans + 2, "formula_misuse", "지수 쪽도 일정한 차로 늘렸다.")].filter((w) => w.v !== ans && w.v > 0),
          verificationJs: figJs({}, s.fig, `${JS}for (let x = xs[0]; x < xs[0] + 60; x++) if (G(x) > L(x) + 1e-9) return x; throw new Error('역전 없음');`),
          trace: [...readBoth(s), [`그래프 밖으로 이어 계산: ${Array.from({ length: ans - s.xs[s.xs.length - 1] }, (_, i) => { const x = s.xs[s.xs.length - 1] + i + 1; return `x=${x}: 일차 ${s.L(x)}, 지수 ${s.G(x)}`; }).join("; ")}.`, "Continue both patterns."], [`x = ${ans - 1} 에서는 지수 ≤ 일차, x = ${ans} 에서 지수 > 일차 이다.`, "Find where the exponential first exceeds."], [`따라서 ${ans} ${s.t.xu} 이다.`, "State the time."]], variant: "first_overtake_line",
        }, s.fig);
      },
    },
    {
      op: "repr_shift", structure: "그래프의 두 선을 각각 식(mx + b, a·r^x)으로 바꿔 그래프 밖 시점의 두 값의 차를 구함", extra: "두 선을 서로 다른 식으로 표현해 같은 시점에서 계산해야 함(지수 쪽을 같은 차로 늘리는 것이 함정) — medium 은 바로 다음 칸",
      concepts: ["일차 관계(같은 차)", "지수 관계(같은 비)", "식으로 예측"],
      gen(rng) {
        const s = make(rng); const x = s.xs[s.xs.length - 1] + rng.int(2, 3); const gv = s.G(x), lv = s.L(x); const ans = gv - lv; if (gv > 999 || lv > 999 || ans === 0) throw new GenFail("big");
        const n = s.xs.length - 1; const linB = s.G(s.xs[n]) + (s.G(s.xs[n]) - s.G(s.xs[n - 1])) * (x - s.xs[n]);
        return gInst(rng, {
          stimulus: `${intro(rng, s)} ${cont(rng)}`, question: `At ${x} ${s.t.xu}, how much greater is the ${s.t.noun} of the exponentially growing one than the ${s.t.noun} of the linearly growing one? (A negative answer means it is less.)`, correct: ans,
          wrongs: [W(linB - lv, "formula_misuse", "지수 쪽을 같은 차로 늘렸다."), W(-ans, "sign_error", "순서를 바꿔 뺐다."), W(gv, "step_missing", "한쪽 값만 답했다."), W(s.G(x - 1) - s.L(x - 1), "other", "한 단위 앞을 계산했다."), W(gv - s.L(x - 1), "other", "일차 쪽을 한 단위 덜 늘렸다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ x }, s.fig, `${JS}return Math.round((G(P.x) - L(P.x)) * 1e6) / 1e6;`),
          trace: [...readBoth(s), [`L(${x}) = ${s.m} × ${x} + ${s.b} = ${lv} 이다.`, "Evaluate the linear model."], [`G(${x}) = ${s.a} × ${s.r}^${x} = ${gv} 이다.`, "Evaluate the exponential model."], [`차 = ${gv} - ${lv} = ${fmtNum(ans)} 이다.`, "Subtract."]], variant: "difference_later_line",
        }, s.fig);
      },
    },
    {
      op: "chain2", structure: "지수 쪽이 처음으로 일차 쪽을 넘는 시점을 구한 뒤, 그 시점의 일차 쪽 값을 구함", extra: "역전 시점 → 그 시점의 값, 2단 연쇄(역전 시점 자체나 지수 쪽 값을 답하는 것이 함정) — medium 은 다음 칸의 차",
      concepts: ["일차 관계(같은 차)", "지수 관계(같은 비)", "역전 시점과 함숫값"],
      gen(rng) {
        const s = make(rng); const x = s.cross; const ans = s.L(x); if (ans > 999) throw new GenFail("big");
        return gInst(rng, {
          stimulus: `${intro(rng, s)} ${cont(rng)} Let $t$ be the least number of ${s.t.xu} for which the ${s.t.noun} of the exponentially growing one is greater than the ${s.t.noun} of the linearly growing one.`, question: `What is the ${s.t.noun} of the linearly growing one, in ${s.t.yu}, at $t$ ${s.t.xu}?`, correct: ans,
          wrongs: [W(x, "step_missing", "t 를 답했다."), W(s.G(x), "condition_ignored", "지수 쪽 값을 답했다."), W(s.L(x - 1), "other", "역전 직전 값을 답했다."), W(s.L(x + 1), "other", "한 단위 늦게 계산했다."), W(s.G(x) - s.L(x), "formula_misuse", "차를 답했다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({}, s.fig, `${JS}for (let x = xs[0]; x < xs[0] + 60; x++) if (G(x) > L(x) + 1e-9) return Math.round(L(x) * 1e6) / 1e6; throw new Error('역전 없음');`),
          trace: [...readBoth(s), [`그래프 밖으로 이어 지수 쪽이 일차 쪽보다 처음 커지는 x 를 찾는다.`, "Continue both patterns."], [`t = ${x} (일차 ${s.L(x)}, 지수 ${s.G(x)}) 이다.`, "Find t."], [`L(${x}) = ${ans} 이다.`, "Evaluate the linear one at t."]], variant: "value_at_overtake_line",
        }, s.fig);
      },
    },
    {
      op: "inverse", structure: "그래프의 지수 선의 비로, 지수 쪽 값이 주어진 값 V 가 되는 시점(그래프 밖)을 역으로 구함", extra: "두 선 중 지수 쪽을 골라 비를 찾고 V 에 도달하는 x 를 거꾸로 구해야 함(일차 쪽 규칙을 쓰는 것이 함정) — medium 은 다음 칸",
      concepts: ["두 관계의 구분", "지수 관계(같은 비)", "출력에서 입력 역산"],
      gen(rng) {
        const s = make(rng); const x = s.xs[s.xs.length - 1] + rng.int(1, 3); const V = s.G(x); if (V > 999) throw new GenFail("V"); const linX = (V - s.b) / s.m;
        return gInst(rng, {
          stimulus: `${intro(rng, s)} ${cont(rng)}`, question: `After how many ${s.t.xu} will the ${s.t.noun} of the exponentially growing one be ${V} ${s.t.yu}?`, correct: x,
          wrongs: [W(Math.round(linX), "condition_ignored", "일차 쪽 규칙으로 계산했다."), W(x - 1, "other", "한 단위 덜 갔다."), W(x + 1, "other", "한 단위 더 갔다."), W(s.xs[s.xs.length - 1], "step_missing", "그래프의 마지막 시점을 답했다.")].filter((w) => w.v !== x && w.v > 0),
          verificationJs: figJs({ V }, s.fig, `${JS}const x = Math.log(P.V / E0) / Math.log(Rr); if (Math.abs(x - Math.round(x)) > 1e-9) throw new Error('정수 아님'); return Math.round(x);`),
          trace: [readBoth(s)[0], readBoth(s)[1], [`지수인 선은 한 ${s.t.one}마다 ${s.r} 배이다.`, "Use the exponential pattern."], [`${s.G(s.xs[s.xs.length - 1])} 에서 ${s.r} 를 ${x - s.xs[s.xs.length - 1]} 번 곱하면 ${V} 이다.`, "Multiply until the value is reached."], [`따라서 ${x} ${s.t.xu} 이다.`, "State the time."]], variant: "exp_inverse_line",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "next_exponential", structure: "그래프의 지수 쪽 다음 값을 구함", extra: "easy: 비를 한 번 곱함", concepts: ["지수 관계", "같은 비"],
      gen(rng) {
        const s = make(rng); const x = s.xs[s.xs.length - 1] + 1; const y = s.G(x); if (y > 999) throw new GenFail("y"); const n = s.xs.length - 1; const lin = s.G(s.xs[n]) * 2 - s.G(s.xs[n - 1]);
        return gInst(rng, { stimulus: `${intro(rng, s)} ${cont(rng)}`, question: `What will the ${s.t.noun} of the exponentially growing one be at ${x} ${s.t.xu}?`, correct: y, wrongs: [W(lin, "formula_misuse", "같은 차로 늘렸다."), W(s.L(x), "condition_ignored", "일차 쪽 값을 답했다."), W(s.G(s.xs[n]), "axis_misread", "마지막 값을 답했다."), W(y * s.r, "other", "한 번 더 곱했다.")].filter((w) => w.v !== y), verificationJs: figJs({ x }, s.fig, `${JS}return Math.round(G(P.x) * 1e6) / 1e6;`), trace: [readBoth(s)[1], [`${s.G(s.xs[n])} × ${s.r} = ${y} 이다.`, "Multiply by the ratio once."]], variant: "next_exponential_line" }, s.fig);
      },
    },
    {
      lv: "medium", name: "next_difference", structure: "그래프 바로 다음 시점에서 두 값의 차를 구함", extra: "medium: 두 규칙으로 한 칸씩", concepts: ["일차 관계", "지수 관계"],
      gen(rng) {
        const s = make(rng); const x = s.xs[s.xs.length - 1] + 1; const ans = s.L(x) - s.G(x);
        return gInst(rng, { stimulus: `${intro(rng, s)} ${cont(rng)}`, question: `At ${x} ${s.t.xu}, how much greater is the ${s.t.noun} of the linearly growing one than the ${s.t.noun} of the exponentially growing one? (A negative answer means it is less.)`, correct: ans, wrongs: [W(-ans, "sign_error", "순서를 바꿨다."), W(s.L(x - 1) - s.G(x - 1), "axis_misread", "그래프의 마지막 차를 답했다."), W(s.L(x), "step_missing", "한쪽만 답했다."), W(ans + s.m, "other", "어긋났다.")].filter((w) => w.v !== ans), verificationJs: figJs({ x }, s.fig, `${JS}return Math.round((L(P.x) - G(P.x)) * 1e6) / 1e6;`), trace: [...readBoth(s), [`L(${x}) = ${s.L(x)}, G(${x}) = ${s.G(x)} 이다.`, "Evaluate both."], [`차 = ${s.L(x)} - ${s.G(x)} = ${ans} 이다.`, "Subtract."]], variant: "next_difference_line" }, s.fig);
      },
    },
  ],
});
void rd;
