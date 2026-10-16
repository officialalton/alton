// linear_functions.evaluate.TB.P — 일차 관계 값표에서 표 밖의 x 에 대한 값을 구한다(기울기·절편은 표에서 계산해야 함).
import { GenFail } from "../../../types";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { CONV_JS, convFig, LIN_JS, linIntercept, linIntro, linRead, makeLinTab, offX, type LinTab } from "../table-kit";

const ev = (s: LinTab, x: number) => s.m * x + s.b;
const askAt = (s: LinTab, x: number | string, xu = s.t.xu) => `what is ${s.yq}, in ${s.t.yu}, when ${s.xq} is ${x} ${xu}`;

export const ITEM = defineItem({
  prefix: "lf", itemId: "linear_functions.evaluate.TB.P",
  hard: [
    {
      op: "unit_ratio", structure: "표에서 기울기·절편을 구하고, 다른 단위(작은 단위)로 주어진 x 를 표의 단위로 바꿔 대입", extra: "표의 단위와 지문의 단위가 달라 환산한 뒤 대입해야 함(환산하지 않고 대입하면 오답) — medium 은 표 단위 그대로 대입",
      concepts: ["일차 관계 값표", "단위 환산", "함숫값"],
      gen(rng) {
        const s = makeLinTab(rng, { conv: true }); const c = s.t.conv!; const k = offX(rng, s, 1, 4); const small = k * c.per; if (small > 999) throw new GenFail("big"); const y = ev(s, k);
        const fig = convFig(s);
        return figInst(rng, {
          stimulus: `${linIntro(rng, s)} The conversion between units is given above the table.`,
          question: `Based on the table, ${askAt(s, small, c.small)}?`, correct: y,
          wrongs: [W(ev(s, small), "unit_error", "단위를 바꾸지 않고 그대로 대입했다."), W(s.m * k, "step_missing", "처음 값(절편)을 더하지 않았다."), W(y + s.m, "other", "한 단위 더 갔다."), W(y - s.m, "other", "한 단위 덜 갔다."), W(ev(s, k) + s.b, "formula_misuse", "절편을 두 번 더했다."), W(s.ys[s.ys.length - 1] + s.m * (k - s.xs[s.xs.length - 1]) * 2, "formula_misuse", "기울기를 두 배로 잡았다.")],
          verificationJs: figJs({ small }, fig, `${LIN_JS}${CONV_JS}const x = P.small / per; return m * x + b;`),
          trace: [...linRead(s), linIntercept(s), [`${small} ${c.small} = ${small} ÷ ${c.per} = ${k} ${s.t.xu} 이다.`, "Convert to the table's unit."], [`값 = ${fmtNum(s.m)} × ${k} + ${fmtNum(s.b)} = ${fmtNum(y)} 이다.`, "Substitute into the linear model."]], variant: "convert_then_evaluate",
        }, fig);
      },
    },
    {
      op: "compare_scenarios", structure: "표의 일차 관계와 지문의 식으로 주어진 두 번째 관계를 같은 x 에서 계산해 차를 구함", extra: "표에서 식을 세워 두 관계를 같은 입력에서 비교해야 함(표에 없는 x) — medium 은 한 관계의 값",
      concepts: ["일차 관계 값표", "두 관계 비교", "함숫값"],
      gen(rng) {
        const s = makeLinTab(rng); const a = offX(rng, s, 1, 6); const p = rng.int(2, 9) * (rng.chance(0.5) ? 1 : -1); const q = rng.int(5, 80);
        const y1 = ev(s, a), y2 = p * a + q; if (y2 < 0 || y1 === y2) throw new GenFail("cmp"); const correct = Math.abs(y1 - y2);
        const pe = p < 0 ? `-${Math.abs(p)}x + ${q}` : `${p}x + ${q}`;
        return figInst(rng, {
          stimulus: `${linIntro(rng, s)} A second model gives ${s.yq} as $y = ${pe}$, where $x$ is ${s.xq}, in ${s.t.xu}.`,
          question: `When ${s.xq} is ${a} ${s.t.xu}, what is the positive difference between ${s.yq} predicted by the relationship in the table and by the second model?`, correct,
          wrongs: [W(Math.abs(s.m * a - p * a), "step_missing", "두 처음 값(절편)을 무시했다."), W(y1, "step_missing", "표의 관계 값만 답했다."), W(y2, "step_missing", "두 번째 모델 값만 답했다."), W(y1 + y2, "sign_error", "차가 아니라 합을 구했다."), W(Math.abs(s.m - p) * a, "step_missing", "기울기 차에 x 만 곱했다."), W(correct + Math.abs(s.m), "other", "한 단위 어긋났다.")],
          verificationJs: figJs({ a, p, q }, s.fig, `${LIN_JS}return Math.abs((m * P.a + b) - (P.p * P.a + P.q));`),
          trace: [...linRead(s), linIntercept(s), [`표의 관계: x = ${a} 일 때 ${fmtNum(s.m)}·${a} + ${fmtNum(s.b)} = ${fmtNum(y1)} 이다.`, "Evaluate the table's model."], [`두 번째 모델: ${p}·${a} + ${q} = ${y2} 이다.`, "Evaluate the second model."], [`차 = |${fmtNum(y1)} - ${y2}| = ${fmtNum(correct)} 이다.`, "Take the positive difference."]], variant: "difference_from_second_model",
        }, s.fig);
      },
    },
    {
      op: "constraint_select", structure: "표에서 식을 세우고, 주어진 x 범위의 정수 x 중 값이 기준 T 보다 큰 것의 개수를 셈", extra: "식을 세워 부등식을 풀고 정수 범위와 경계(등호 제외)를 함께 따져 개수를 세야 함 — medium 은 한 x 의 값",
      concepts: ["일차 관계 값표", "일차부등식", "정수 개수"],
      gen(rng) {
        const s = makeLinTab(rng, { mSign: 1 }); const L = s.xs[0] + rng.int(0, 3), U = L + rng.int(10, 25); const T = Math.round(ev(s, rng.int(L + 2, U - 2))) + rng.int(0, Math.max(1, s.m - 1));
        let cnt = 0; for (let x = L; x <= U; x++) if (ev(s, x) > T) cnt++; if (cnt < 2 || cnt > U - L) throw new GenFail("cnt");
        let ge = 0; for (let x = L; x <= U; x++) if (ev(s, x) >= T) ge++;
        return figInst(rng, {
          stimulus: `${linIntro(rng, s)} Consider only whole-number values of ${s.xq} from ${L} to ${U} ${s.t.xu}, inclusive.`,
          question: `For how many of these values is ${s.yq} greater than ${T} ${s.t.yu}?`, correct: cnt,
          wrongs: [W(ge === cnt ? cnt + 1 : ge, "condition_ignored", "등호(같은 경우)까지 셌다."), W(U - L + 1 - cnt, "opposite", "기준 이하인 개수를 셌다."), W(cnt - 1, "other", "끝 하나를 빼먹었다."), W(U - L + 1, "condition_ignored", "조건 없이 전체 개수를 셌다."), W(cnt + 2, "other", "경계를 잘못 잡았다.")],
          verificationJs: figJs({ L, U, T }, s.fig, `${LIN_JS}let c = 0; for (let x = P.L; x <= P.U; x++) if (m * x + b > P.T) c++; return c;`),
          trace: [...linRead(s), linIntercept(s), [`${fmtNum(s.m)}x + ${fmtNum(s.b)} > ${T} 이면 x > ${fmtNum((T - s.b) / s.m)} 이다.`, "Solve the inequality."], [`${L} 부터 ${U} 까지의 정수 중 이를 만족하는 것은 ${cnt} 개이다.`, "Count the whole numbers in range."], [`등호는 포함하지 않으므로 답은 ${cnt} 이다.`, "The boundary is excluded."]], variant: "count_inputs_above_threshold",
        }, s.fig);
      },
    },
    {
      op: "chain2", structure: "표에서 식을 세워 표 밖의 x 에서 값을 구한 뒤, 그 값의 p% 를 구함", extra: "값표 → 식 → 표 밖 함숫값 → 퍼센트의 연쇄(퍼센트의 기준이 계산한 값) — medium 은 함숫값까지",
      concepts: ["일차 관계 값표", "함숫값", "퍼센트"],
      gen(rng) {
        const s = makeLinTab(rng); const a = offX(rng, s, 1, 6); const y = ev(s, a); const p = rng.pick([10, 20, 25, 30, 40, 50, 60, 75]); if ((y * p) % 100 !== 0 || y <= 0) throw new GenFail("pct"); const correct = (y * p) / 100;
        return figInst(rng, {
          stimulus: `${linIntro(rng, s)}`,
          question: `Based on the relationship in the table, what is ${p}% of ${s.yq}, in ${s.t.yu}, when ${s.xq} is ${a} ${s.t.xu}?`, correct,
          wrongs: [W(y, "step_missing", "퍼센트를 적용하지 않았다."), W(y - correct, "opposite", "남는 비율로 계산했다."), W((s.m * a * p) / 100, "step_missing", "절편을 빼고 계산했다."), W(((s.ys[s.ys.length - 1]) * p) / 100, "other", "표의 마지막 값에 퍼센트를 적용했다."), W(correct + p, "other", "계산 중 어긋났다.")],
          verificationJs: figJs({ a, p }, s.fig, `${LIN_JS}return (m * P.a + b) * P.p / 100;`),
          trace: [...linRead(s), linIntercept(s), [`x = ${a} 일 때 값 = ${fmtNum(s.m)}·${a} + ${fmtNum(s.b)} = ${fmtNum(y)} 이다.`, "Evaluate at the new input."], [`그 값의 ${p}% = ${fmtNum(y)} × ${p} ÷ 100 = ${fmtNum(correct)} 이다.`, "Take the percent."]], variant: "percent_of_predicted_value",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "read_row", structure: "값표에서 주어진 x 의 값을 읽음", extra: "easy: 표에서 한 행 읽기", concepts: ["값표", "읽기"],
      gen(rng) {
        const s = makeLinTab(rng); const i = rng.int(1, s.xs.length - 1); const x = s.xs[i], y = s.ys[i];
        return figInst(rng, { stimulus: linIntro(rng, s), question: `According to the table, ${askAt(s, x)}?`, correct: y, wrongs: [W(s.ys[i - 1], "axis_misread", "윗 행을 읽었다."), W(s.ys[(i + 1) % s.ys.length], "axis_misread", "다른 행을 읽었다."), W(x, "axis_misread", "x 값을 답했다."), W(y + s.d, "other", "계산 중 어긋났다.")], verificationJs: figJs({ x }, s.fig, `${LIN_JS}const r = FIGURE.rows.find(q => q[0] === P.x); if (!r) throw new Error('행 없음'); return r[1];`), trace: [[`표에서 x = ${x} 인 행을 찾는다.`, "Find the row."], [`그 행의 값은 ${y} 이다.`, "Read its value."]], variant: "read_value",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "next_value", structure: "값표의 일정한 변화량을 구해 표 다음 x 의 값을 구함", extra: "medium: 변화량을 한 번 더 더하기", concepts: ["값표", "변화율"],
      gen(rng) {
        const s = makeLinTab(rng); const x = s.xs[s.xs.length - 1] + s.d; const y = ev(s, x);
        return figInst(rng, { stimulus: linIntro(rng, s), question: `If the relationship continues, ${askAt(s, x)}?`, correct: y, wrongs: [W(s.ys[s.ys.length - 1], "step_missing", "마지막 값을 답했다."), W(y + s.m * s.d, "other", "두 번 더했다."), W(s.ys[s.ys.length - 1] + s.m, "unit_error", "간격이 1 이라고 보았다."), W(s.m * x, "step_missing", "절편을 무시했다.")].filter((w) => w.v !== y), verificationJs: figJs({ x }, s.fig, `${LIN_JS}return m * P.x + b;`), trace: [linRead(s)[1], [`표의 x 간격은 ${s.d}, 값의 변화는 ${fmtNum(s.m * s.d)} 이다.`, "Change per row."], [`다음 값 = ${s.ys[s.ys.length - 1]} + ${fmtNum(s.m * s.d)} = ${fmtNum(y)} 이다.`, "Add one more step."]], variant: "next_row_value",
        }, s.fig);
      },
    },
  ],
});
