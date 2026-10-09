// linear_functions.find_x_for_value.TB.P — 일차 관계 값표에서 식을 세우고, 주어진 값이 되는 x 를 역으로 구한다(표 밖).
import { GenFail } from "../../../types";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { CONV_JS, convFig, LIN_JS, linIntercept, linIntro, linRead, makeLinTab, offX, type LinTab } from "../table-kit";

const ev = (s: LinTab, x: number) => s.m * x + s.b;
const isInt = Number.isInteger;

export const ITEM = defineItem({
  prefix: "lf", itemId: "linear_functions.find_x_for_value.TB.P",
  hard: [
    {
      op: "unit_ratio", structure: "표에서 식을 세워 값이 T 가 되는 x 를 구한 뒤, 답을 다른(작은) 단위로 환산", extra: "역산한 x 를 표 제목의 환산 비율로 바꿔야 함(표 단위로 답하면 오답) — medium 은 표 단위의 x",
      concepts: ["일차 관계 값표", "일차방정식", "단위 환산"],
      gen(rng) {
        const s = makeLinTab(rng, { conv: true }); const c = s.t.conv!; const k = offX(rng, s, 1, 4); const T = ev(s, k); const small = k * c.per; if (small > 999) throw new GenFail("big");
        const fig = convFig(s);
        return figInst(rng, {
          stimulus: `${linIntro(rng, s)} The conversion between units is given above the table.`,
          question: `According to the relationship, ${s.yq} is ${fmtNum(T)} ${s.t.yu} when ${s.xq} is how many ${c.small}?`, correct: small,
          wrongs: [W(k, "unit_error", "표의 단위 그대로 답했다."), W(Math.round(T / s.m) * c.per, "step_missing", "처음 값(절편)을 빼지 않았다."), W((k + 1) * c.per, "other", "한 단위 더 갔다."), W((k - 1) * c.per, "other", "한 단위 덜 갔다."), W(Math.round(k * c.per / 2), "formula_misuse", "환산을 반대로 적용했다.")],
          verificationJs: figJs({ T }, fig, `${LIN_JS}${CONV_JS}return (P.T - b) / m * per;`),
          trace: [...linRead(s), linIntercept(s), [`${fmtNum(s.m)}x + ${fmtNum(s.b)} = ${fmtNum(T)} 에서 x = ${k} ${s.t.xu} 이다.`, "Solve for x in the table's unit."], [`${k} × ${c.per} = ${small} ${c.small} 이다.`, "Convert to the requested unit."]], variant: "solve_then_convert",
        }, fig);
      },
    },
    {
      op: "chain2", structure: "표에서 식을 세우고, 표의 한 x 에서의 값보다 D 만큼 큰 값이 되는 x 를 구함", extra: "기준값을 먼저 계산(표의 행)하고 거기에 D 를 더한 목표로 다시 역산하는 2단 연쇄 — medium 은 주어진 값의 역산",
      concepts: ["일차 관계 값표", "증가량", "역산"],
      gen(rng) {
        const s = makeLinTab(rng); const i = rng.int(0, s.xs.length - 1); const x1 = s.xs[i]; const steps = rng.int(2, 9); const D = s.m * steps; const correct = x1 + steps; if (s.xs.includes(correct)) throw new GenFail("in table");
        const dir = D > 0 ? "greater" : "less";
        return figInst(rng, {
          stimulus: `${linIntro(rng, s)}`,
          question: `For what value of ${s.xq}, in ${s.t.xu}, is ${s.yq} ${fmtNum(Math.abs(D))} ${s.t.yu} ${dir} than its value when ${s.xq} is ${x1} ${s.t.xu}?`, correct,
          wrongs: [W(steps, "step_missing", "증가분에 해당하는 x 변화량만 답했다."), W(x1 - steps, "sign_error", "반대 방향으로 갔다."), W(Math.round((Math.abs(D) - s.b) / s.m), "formula_misuse", "D 를 값 자체로 보고 역산했다."), W(x1 + Math.abs(D), "unit_error", "값의 변화를 x 의 변화로 보았다."), W(correct + 1, "other", "한 단위 어긋났다.")],
          verificationJs: figJs({ x1, D: Math.abs(D) }, s.fig, `${LIN_JS}const y1 = m * P.x1 + b; const tgt = y1 + ${D > 0 ? "" : "-"}P.D; return (tgt - b) / m;`),
          trace: [...linRead(s), linIntercept(s), [`x = ${x1} 일 때 값은 ${fmtNum(ev(s, x1))} 이다.`, "Find the reference value."], [`목표값 = ${fmtNum(ev(s, x1))} ${D > 0 ? "+" : "-"} ${fmtNum(Math.abs(D))} = ${fmtNum(ev(s, x1) + D)} 이다.`, "Shift by the given amount."], [`${fmtNum(s.m)}x + ${fmtNum(s.b)} = ${fmtNum(ev(s, x1) + D)} 에서 x = ${correct} 이다.`, "Solve for x."]], variant: "reach_offset_from_row",
        }, s.fig);
      },
    },
    {
      op: "constraint_select", structure: "표에서 식을 세워 값이 처음으로 T 이상이 되는 가장 작은 정수 x 를 구함(정확한 해는 정수가 아님)", extra: "방정식의 해가 정수가 아니어서 부등식으로 바꾸고 올림해야 함 — medium 은 정수 해의 역산",
      concepts: ["일차 관계 값표", "일차부등식", "정수 조건(올림)"],
      gen(rng) {
        const s = makeLinTab(rng); const k = offX(rng, s, 1, 5); const up = s.m > 0; const T = ev(s, k) + (up ? 1 : -1) * rng.int(1, Math.max(1, Math.abs(s.m) - 1)); const exact = (T - s.b) / s.m; if (isInt(exact)) throw new GenFail("int");
        const correct = up ? Math.ceil(exact) : Math.ceil(exact); // 감소면 '이하'가 되는 최소 x
        const word = up ? "at least" : "at most";
        return figInst(rng, {
          stimulus: `${linIntro(rng, s)}`,
          question: `What is the least whole-number value of ${s.xq}, in ${s.t.xu}, for which ${s.yq} is ${word} ${fmtNum(T)} ${s.t.yu}?`, correct,
          wrongs: [W(Math.floor(exact), "condition_ignored", "올림 대신 내림했다."), W(correct + 1, "other", "한 단위 더 갔다."), W(Math.round(T / s.m), "step_missing", "처음 값(절편)을 빼지 않았다."), W(Math.max(1, correct - 2), "other", "계산 중 어긋났다."), W(Math.ceil(Math.abs(T - s.ys[0]) / Math.abs(s.m)), "step_missing", "표 첫 행의 x 를 더하지 않았다.")],
          verificationJs: figJs({ T }, s.fig, `${LIN_JS}for (let x = 0; x <= 2000; x++) { const y = m * x + b; if (${up ? "y >= P.T" : "y <= P.T"}) return x; } throw new Error('해 없음');`),
          trace: [...linRead(s), linIntercept(s), [`${fmtNum(s.m)}x + ${fmtNum(s.b)} ${up ? "≥" : "≤"} ${fmtNum(T)} 로 놓는다.`, "Write the inequality."], [`x ≥ ${fmtNum(Math.round(exact * 100) / 100)} 이다.`, "Solve for x."], [`가장 작은 정수는 ${correct} 이다.`, "Round up to a whole number."]], variant: "least_whole_input",
        }, s.fig);
      },
    },
    {
      op: "inverse", structure: "표에서 식을 세우고, 값이 x = 0 일 때 값(처음 값)의 r 배가 되는 x 를 구함", extra: "표에 x = 0 이 없어 처음 값을 먼저 구하고, 그 배수를 목표로 역산해야 함 — medium 은 주어진 값의 역산",
      concepts: ["일차 관계 값표", "처음 값(절편)", "배수 목표 역산"],
      gen(rng) {
        const s = makeLinTab(rng, { mSign: 1, noZeroX: true }); const r = rng.pick([2, 3, 4]); const num = (r - 1) * s.b; if (num % s.m !== 0) throw new GenFail("frac"); const correct = num / s.m; if (correct <= 0 || correct > 200 || s.xs.includes(correct)) throw new GenFail("range");
        const times = r === 2 ? "twice" : r === 3 ? "three times" : "four times";
        return figInst(rng, {
          stimulus: `${linIntro(rng, s)}`,
          question: `For what value of ${s.xq}, in ${s.t.xu}, is ${s.yq} ${times} its value when ${s.xq} is 0?`, correct,
          wrongs: [W((r * s.b) / s.m, "step_missing", "처음 값을 빼지 않고 역산했다."), W(r * s.xs[0], "formula_misuse", "표 첫 x 에 배수를 곱했다."), W(correct + s.d, "other", "한 행 더 갔다."), W(Math.round(((r * s.ys[0]) - s.b) / s.m), "formula_misuse", "표 첫 값을 처음 값으로 착각했다."), W(Math.max(1, correct - s.d), "other", "한 행 덜 갔다.")],
          verificationJs: figJs({ r }, s.fig, `${LIN_JS}return (P.r * b - b) / m;`),
          trace: [...linRead(s), linIntercept(s), [`목표값 = ${r} × ${fmtNum(s.b)} = ${fmtNum(r * s.b)} 이다.`, "Target value."], [`${fmtNum(s.m)}x + ${fmtNum(s.b)} = ${fmtNum(r * s.b)} 이다.`, "Set up the equation."], [`x = ${fmtNum((r - 1) * s.b)} ÷ ${fmtNum(s.m)} = ${correct} 이다.`, "Solve for x."]], variant: "multiple_of_initial",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "lookup_x", structure: "값표에서 주어진 값이 나오는 행의 x 를 읽음", extra: "easy: 표 거꾸로 읽기", concepts: ["값표", "읽기"],
      gen(rng) {
        const s = makeLinTab(rng); const i = rng.int(1, s.xs.length - 1); const y = s.ys[i];
        return figInst(rng, { stimulus: linIntro(rng, s), question: `According to the table, what is ${s.xq}, in ${s.t.xu}, when ${s.yq} is ${y} ${s.t.yu}?`, correct: s.xs[i], wrongs: [W(s.xs[i - 1], "axis_misread", "윗 행을 읽었다."), W(s.xs[(i + 1) % s.xs.length], "axis_misread", "다른 행을 읽었다."), W(y, "axis_misread", "값을 그대로 답했다."), W(s.xs[i] + 1, "other", "한 단위 어긋났다.")], verificationJs: figJs({ y }, s.fig, `${LIN_JS}const r = FIGURE.rows.find(q => q[1] === P.y); if (!r) throw new Error('행 없음'); return r[0];`), trace: [[`표에서 값이 ${y} 인 행을 찾는다.`, "Find the row."], [`그 행의 x 는 ${s.xs[i]} 이다.`, "Read its input."]], variant: "reverse_lookup",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "solve_value", structure: "값표에서 식을 세워 표 밖의 값이 되는 x 를 구함", extra: "medium: 식을 세워 한 번 역산", concepts: ["값표", "일차방정식"],
      gen(rng) {
        const s = makeLinTab(rng); const k = offX(rng, s, 1, 6); const T = ev(s, k);
        return figInst(rng, { stimulus: linIntro(rng, s), question: `If the relationship continues, for what value of ${s.xq}, in ${s.t.xu}, is ${s.yq} equal to ${fmtNum(T)} ${s.t.yu}?`, correct: k, wrongs: [W(Math.round(T / s.m), "step_missing", "처음 값을 빼지 않았다."), W(k + 1, "other", "한 단위 더 갔다."), W(k - 1, "other", "한 단위 덜 갔다."), W(Math.round((T + s.b) / s.m), "sign_error", "처음 값을 더했다.")].filter((w) => w.v !== k), verificationJs: figJs({ T }, s.fig, `${LIN_JS}return (P.T - b) / m;`), trace: [linRead(s)[1], linIntercept(s), [`${fmtNum(s.m)}x + ${fmtNum(s.b)} = ${fmtNum(T)} 에서 x = ${k} 이다.`, "Solve for x."]], variant: "solve_for_input",
        }, s.fig);
      },
    },
  ],
});
