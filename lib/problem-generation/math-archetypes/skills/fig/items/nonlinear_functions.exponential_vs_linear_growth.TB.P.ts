// nonlinear_functions.exponential_vs_linear_growth.TB.P — 한 표에 일차(같은 차) 관계와 지수(같은 비) 관계가 함께 있고, 두 성장을 비교한다(카탈로그 부록 B 신규 패턴).
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { fmtR, isInt, xsRun } from "./_t5-kit";

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
  { xu: "years", one: "year", yu: "people", A: "Town A", B: "Town B", what: "the populations of two small towns", noun: "population" },
  { xu: "weeks", one: "week", yu: "followers", A: "Account A", B: "Account B", what: "the followers of two online accounts", noun: "number of followers" },
  { xu: "months", one: "month", yu: "subscribers", A: "Channel A", B: "Channel B", what: "the subscribers of two video channels", noun: "number of subscribers" },
  { xu: "days", one: "day", yu: "signatures", A: "Petition A", B: "Petition B", what: "the signatures on two petitions", noun: "number of signatures" },
  { xu: "hours", one: "hour", yu: "insects", A: "Colony A", B: "Colony B", what: "the sizes of two insect colonies", noun: "size" },
  { xu: "weeks", one: "week", yu: "points", A: "Player A", B: "Player B", what: "the total points of two players in an online game", noun: "total points" },
  { xu: "years", one: "year", yu: "trees", A: "Forest A", B: "Forest B", what: "the young trees in two replanted forests", noun: "number of trees" },
  { xu: "months", one: "month", yu: "users", A: "Website A", B: "Website B", what: "the registered users of two websites", noun: "number of users" },
  { xu: "days", one: "day", yu: "tickets", A: "Show A", B: "Show B", what: "the total tickets sold for two shows", noun: "number of tickets sold" },
  { xu: "weeks", one: "week", yu: "dollars", A: "Fund A", B: "Fund B", what: "the amounts raised by two charity funds", noun: "amount raised" },
];
type Sc = { t: Topic; xs: number[]; m: number; b: number; a: number; r: number; fig: { type: "data"; kind: "table"; columns: string[]; rows: number[][] }; L: (x: number) => number; G: (x: number) => number; cross: number };
/** 일차 A(x) = m x + b, 지수 B(x) = a r^x. 표 안에서는 A ≥ B, 표 밖 cross 에서 처음 B > A. */
function make(rng: Rng, o: { crossMin?: number } = {}): Sc {
  for (let tr = 0; tr < 200; tr++) {
    const t = rng.pick(TOPICS); const r = rng.pick([2, 2, 3, 1.5]); const n = rng.int(4, 5); const x0 = rng.int(0, 1); const xs = xsRun(x0, n);
    const a = (r === 1.5 ? 2 ** (x0 + n - 1) : 1) * rng.int(1, r === 1.5 ? 2 : 9); const m = rng.int(4, 40); const b = rng.int(10, 150);
    const L = (x: number) => m * x + b, G = (x: number) => a * r ** x; const last = xs[n - 1];
    if (xs.some((x) => G(x) > L(x)) || xs.some((x) => !isInt(G(x)) || G(x) > 999 || L(x) > 999)) continue;
    let cross = -1; for (let x = last + 1; x < last + 12; x++) if (G(x) > L(x)) { cross = x; break; }
    if (cross < 0 || cross - last < (o.crossMin ?? 1) || cross - last > 5) continue;
    if (G(last) === L(last)) continue;
    const fig = { type: "data" as const, kind: "table" as const, columns: [`Time (${t.xu})`, `${t.A} (${t.yu})`, `${t.B} (${t.yu})`], rows: xs.map((x) => [x, L(x), G(x)]) };
    return { t, xs, m, b, a, r, fig, L, G, cross };
  }
  throw new GenFail("일차·지수 비교 장면 표집 실패");
}
const JS = "const R=FIGURE.rows; const xs=R.map(r=>r[0]); const d=xs[1]-xs[0]; if (R.length<4||!(d>0)) throw new Error('행 부족'); for (let i=1;i<xs.length;i++) if (Math.abs(xs[i]-xs[i-1]-d)>1e-9) throw new Error('x 간격'); const m=(R[1][1]-R[0][1])/d; const b=R[0][1]-m*xs[0]; for (const r of R) if (Math.abs(m*r[0]+b-r[1])>1e-9) throw new Error('일차 아님'); const er=R[1][2]/R[0][2]; if (!(er>0)) throw new Error('지수 아님'); for (let i=1;i<R.length;i++) if (Math.abs(R[i][2]/R[i-1][2]-er)>1e-9) throw new Error('비 일정 아님'); const Rr=Math.pow(er,1/d); const E0=R[0][2]/Math.pow(Rr,xs[0]); const L=(x)=>m*x+b, G=(x)=>E0*Math.pow(Rr,x);\n";
const intro = (rng: Rng, s: Sc) => rng.pick([
  `The table shows ${s.t.what} over time. One of them grows linearly and the other grows exponentially.`,
  `The table shown compares ${s.t.what}. For one, the ${s.t.noun} increases by the same amount each ${s.t.one}; for the other, it is multiplied by the same factor each ${s.t.one}.`,
  `A report tracked ${s.t.what}, as shown in the table. One pattern is linear and the other is exponential.`,
  `Data on ${s.t.what} are given in the table. ${s.t.A} shows linear growth, and ${s.t.B} shows exponential growth.`,
  `An analyst compared ${s.t.what} using the table shown. The patterns in the table are a linear one and an exponential one.`,
  `The table records ${s.t.what} at the end of each ${s.t.one}. One quantity follows a linear pattern and the other an exponential pattern.`,
]);
const cont = (rng: Rng) => rng.pick(["Assume both patterns continue.", "Suppose each pattern continues.", "Assume the patterns shown in the table continue.", "Both patterns continue beyond the table."]);
const readBoth = (s: Sc): [string, string][] => [
  [`${s.t.A}: 한 ${s.t.one}마다 ${s.m} 씩 늘어 A(x) = ${s.m}x + ${s.b} 이다.`, "Plan A has a constant difference, so it is linear."],
  [`${s.t.B}: 한 ${s.t.one}마다 ${fmtR(s.r)} 배가 되어 B(x) = ${fmtNum(s.a)}·${fmtR(s.r)}^x 이다.`, "Plan B has a constant ratio, so it is exponential."],
];

export const ITEM = defineItem({
  prefix: "nf", itemId: "nonlinear_functions.exponential_vs_linear_growth.TB.P",
  hard: [
    {
      op: "compare_scenarios", structure: "표의 일차·지수 관계를 각각 식으로 세워 이어 가며, 지수 쪽이 처음으로 일차 쪽보다 커지는 x 를 구함", extra: "두 관계를 구분해 서로 다른 규칙(차·비)으로 표 밖까지 이어 비교해야 함(같아지기 직전 x 를 답하는 것이 함정) — medium 은 다음 칸의 차",
      concepts: ["일차 관계(같은 차)", "지수 관계(같은 비)", "두 성장의 비교·역전"],
      gen(rng) {
        const s = make(rng); const ans = s.cross;
        return figInst(rng, {
          stimulus: `${intro(rng, s)} ${cont(rng)}`, question: `What is the least number of ${s.t.xu} for which the ${s.t.noun} of ${s.t.B} is greater than the ${s.t.noun} of ${s.t.A}?`, correct: ans,
          wrongs: [W(ans - 1, "step_missing", "역전 직전 시점을 답했다."), W(ans + 1, "other", "한 단위 늦게 잡았다."), W(s.xs[s.xs.length - 1], "condition_ignored", "표의 마지막 시점을 답했다."), W(ans + 3, "other", "어긋났다."), W(ans + 2, "formula_misuse", "지수 쪽도 일정한 차로 늘렸다.")].filter((w) => w.v !== ans && w.v > 0),
          verificationJs: figJs({}, s.fig, `${JS}for (let x = xs[0]; x < xs[0] + 60; x++) if (G(x) > L(x) + 1e-9) return x; throw new Error('역전 없음');`),
          trace: [...readBoth(s), [`표 밖으로 이어 계산: ${Array.from({ length: ans - s.xs[s.xs.length - 1] }, (_, i) => { const x = s.xs[s.xs.length - 1] + i + 1; return `x=${x}: A ${s.L(x)}, B ${fmtR(s.G(x))}`; }).join("; ")}.`, "Continue both patterns."], [`x = ${ans - 1} 에서는 B ≤ A, x = ${ans} 에서 B > A 이다.`, "Find where B first exceeds A."], [`따라서 ${ans} ${s.t.xu} 이다.`, "State the time."]], variant: "first_overtake",
        }, s.fig);
      },
    },
    {
      op: "repr_shift", structure: "표의 두 관계를 각각 식(mx + b, a·r^x)으로 바꿔 표 밖 시점의 두 값의 차를 구함", extra: "두 관계를 서로 다른 식으로 표현해 같은 시점에서 계산해야 함(지수 쪽을 같은 차로 늘리는 것이 함정) — medium 은 바로 다음 칸",
      concepts: ["일차 관계(같은 차)", "지수 관계(같은 비)", "식으로 예측"],
      gen(rng) {
        const s = make(rng); const x = s.xs[s.xs.length - 1] + rng.int(2, 3); const gv = s.G(x), lv = s.L(x); const ans = gv - lv; if (!isInt(gv) || gv > 999 || lv > 999 || Math.abs(ans) > 999) throw new GenFail("big");
        const n = s.xs.length - 1; const linB = s.G(s.xs[n]) + (s.G(s.xs[n]) - s.G(s.xs[n - 1])) * (x - s.xs[n]);
        return figInst(rng, {
          stimulus: `${intro(rng, s)} ${cont(rng)}`, question: `At ${x} ${s.t.xu}, how much greater is the ${s.t.noun} of ${s.t.B} than the ${s.t.noun} of ${s.t.A}? (A negative answer means it is less.)`, correct: ans,
          wrongs: [W(linB - lv, "formula_misuse", "지수 쪽을 같은 차로 늘렸다."), W(-ans, "sign_error", "순서를 바꿔 뺐다."), W(gv, "step_missing", "한쪽 값만 답했다."), W(s.G(x - 1) - s.L(x - 1), "other", "한 단위 앞을 계산했다."), W(gv - s.L(x - 1), "other", "A 를 한 단위 덜 늘렸다.")].filter((w) => w.v !== ans),
          verificationJs: figJs({ x }, s.fig, `${JS}return Math.round((G(P.x) - L(P.x)) * 1e6) / 1e6;`),
          trace: [...readBoth(s), [`A(${x}) = ${s.m} × ${x} + ${s.b} = ${lv} 이다.`, "Evaluate the linear model."], [`B(${x}) = ${fmtNum(s.a)} × ${fmtR(s.r)}^${x} = ${fmtR(gv)} 이다.`, "Evaluate the exponential model."], [`차 = ${fmtR(gv)} - ${lv} = ${fmtR(ans)} 이다.`, "Subtract."]], variant: "difference_later",
        }, s.fig);
      },
    },
    {
      op: "chain2", structure: "지수 쪽이 처음으로 일차 쪽을 넘는 시점을 구한 뒤, 그 시점의 일차 쪽 값을 구함", extra: "역전 시점 → 그 시점의 값, 2단 연쇄(역전 시점 자체나 지수 쪽 값을 답하는 것이 함정) — medium 은 다음 칸의 차",
      concepts: ["일차 관계(같은 차)", "지수 관계(같은 비)", "역전 시점과 함숫값"],
      gen(rng) {
        const s = make(rng); const x = s.cross; const ans = s.L(x); if (ans > 999) throw new GenFail("big");
        return figInst(rng, {
          stimulus: `${intro(rng, s)} ${cont(rng)} Let $t$ be the least number of ${s.t.xu} for which the ${s.t.noun} of ${s.t.B} is greater than the ${s.t.noun} of ${s.t.A}.`, question: `What is the ${s.t.noun} of ${s.t.A}, in ${s.t.yu}, at $t$ ${s.t.xu}?`, correct: ans,
          wrongs: [W(x, "step_missing", "t 를 답했다."), W(s.G(x), "condition_ignored", "B 의 값을 답했다."), W(s.L(x - 1), "other", "역전 직전 값을 답했다."), W(s.L(x + 1), "other", "한 단위 늦게 계산했다."), W(s.G(x) - s.L(x), "formula_misuse", "차를 답했다.")].filter((w) => w.v !== ans && isInt(w.v)),
          verificationJs: figJs({}, s.fig, `${JS}for (let x = xs[0]; x < xs[0] + 60; x++) if (G(x) > L(x) + 1e-9) return L(x); throw new Error('역전 없음');`),
          trace: [...readBoth(s), [`표 밖으로 이어 B 가 A 보다 처음 커지는 x 를 찾는다.`, "Continue both patterns."], [`t = ${x} (A ${s.L(x)}, B ${fmtR(s.G(x))}) 이다.`, "Find t."], [`A(${x}) = ${ans} 이다.`, "Evaluate A at t."]], variant: "value_at_overtake",
        }, s.fig);
      },
    },
    {
      op: "inverse", structure: "표의 지수 관계의 비로, 지수 쪽 값이 주어진 값 V 가 되는 시점(표 밖)을 역으로 구함", extra: "두 관계 중 지수 쪽을 골라 비를 찾고 V 에 도달하는 x 를 거꾸로 구해야 함(일차 쪽 규칙을 쓰는 것이 함정) — medium 은 다음 칸",
      concepts: ["두 관계의 구분", "지수 관계(같은 비)", "출력에서 입력 역산"],
      gen(rng) {
        const s = make(rng); const x = s.xs[s.xs.length - 1] + rng.int(1, 3); const V = s.G(x); if (!isInt(V) || V > 999) throw new GenFail("V");
        const linX = (V - s.b) / s.m;
        return figInst(rng, {
          stimulus: `${intro(rng, s)} ${cont(rng)}`, question: `After how many ${s.t.xu} will the ${s.t.noun} of ${s.t.B} be ${V} ${s.t.yu}?`, correct: x,
          wrongs: [W(Math.round(linX), "condition_ignored", "A 의 규칙으로 계산했다."), W(x - 1, "other", "한 단위 덜 갔다."), W(x + 1, "other", "한 단위 더 갔다."), W(s.xs[s.xs.length - 1], "step_missing", "표의 마지막 시점을 답했다.")].filter((w) => w.v !== x && w.v > 0),
          verificationJs: figJs({ V }, s.fig, `${JS}const x = Math.log(P.V / E0) / Math.log(Rr); if (Math.abs(x - Math.round(x)) > 1e-9) throw new Error('정수 아님'); return Math.round(x);`),
          trace: [readBoth(s)[0], readBoth(s)[1], [`${s.t.B} 는 한 ${s.t.one}마다 ${fmtR(s.r)} 배이다.`, "Use the exponential pattern."], [`${s.G(s.xs[s.xs.length - 1])} 에서 ${fmtR(s.r)} 를 ${x - s.xs[s.xs.length - 1]} 번 곱하면 ${V} 이다.`, "Multiply until the value is reached."], [`따라서 ${x} ${s.t.xu} 이다.`, "State the time."]], variant: "exp_inverse",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "next_exponential", structure: "표의 지수 쪽 다음 값을 구함", extra: "easy: 비를 한 번 곱함", concepts: ["지수 관계", "같은 비"],
      gen(rng) {
        const s = make(rng); const x = s.xs[s.xs.length - 1] + 1; const y = s.G(x); if (!isInt(y) || y > 999) throw new GenFail("y"); const n = s.xs.length - 1; const lin = s.G(s.xs[n]) * 2 - s.G(s.xs[n - 1]);
        return figInst(rng, { stimulus: `${intro(rng, s)} ${cont(rng)}`, question: `What will the ${s.t.noun} of ${s.t.B} be at ${x} ${s.t.xu}?`, correct: y, wrongs: [W(lin, "formula_misuse", "같은 차로 늘렸다."), W(s.L(x), "condition_ignored", "A 의 값을 답했다."), W(s.G(s.xs[n]), "axis_misread", "마지막 값을 답했다."), W(y * s.r, "other", "한 번 더 곱했다.")].filter((w) => w.v !== y && isInt(w.v)), verificationJs: figJs({ x }, s.fig, `${JS}return Math.round(G(P.x) * 1e6) / 1e6;`), trace: [readBoth(s)[1], [`${s.G(s.xs[n])} × ${fmtR(s.r)} = ${y} 이다.`, "Multiply by the ratio."]], variant: "next_b",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "next_difference", structure: "표 바로 다음 시점에서 두 값의 차를 구함", extra: "medium: 두 규칙으로 한 칸씩", concepts: ["일차 관계", "지수 관계"],
      gen(rng) {
        const s = make(rng); const x = s.xs[s.xs.length - 1] + 1; const ans = s.L(x) - s.G(x); if (!isInt(ans)) throw new GenFail("i");
        return figInst(rng, { stimulus: `${intro(rng, s)} ${cont(rng)}`, question: `At ${x} ${s.t.xu}, how much greater is the ${s.t.noun} of ${s.t.A} than the ${s.t.noun} of ${s.t.B}? (A negative answer means it is less.)`, correct: ans, wrongs: [W(-ans, "sign_error", "순서를 바꿨다."), W(s.L(x - 1) - s.G(x - 1), "axis_misread", "표의 마지막 차를 답했다."), W(s.L(x), "step_missing", "한쪽만 답했다."), W(ans + s.m, "other", "어긋났다.")].filter((w) => w.v !== ans), verificationJs: figJs({ x }, s.fig, `${JS}return Math.round((L(P.x) - G(P.x)) * 1e6) / 1e6;`), trace: [...readBoth(s), [`A(${x}) - B(${x}) = ${s.L(x)} - ${fmtR(s.G(x))} = ${ans} 이다.`, "Subtract."]], variant: "next_diff",
        }, s.fig);
      },
    },
  ],
});
