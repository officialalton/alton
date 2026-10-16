// linear_functions.slope_from_two_points.TB.P — 값표의 두 행에서 변화율(기울기)을 구해 쓰는 문항.
import { GenFail } from "../../../types";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { CONV_JS, convFig, LIN_JS, linIntro, linRead, makeLinTab, sing, type LinTab } from "../table-kit";

const oneDec = (n: number) => Math.abs(n * 10 - Math.round(n * 10)) < 1e-9;
const rate = (s: LinTab) => `${s.t.yu} per ${sing(s.t.xu)}`;

export const ITEM = defineItem({
  prefix: "lf", itemId: "linear_functions.slope_from_two_points.TB.P",
  hard: [
    {
      op: "unit_ratio", structure: "표의 두 행에서 기울기(표 단위당 변화)를 구한 뒤, 작은 단위 1 당 변화로 환산", extra: "두 행의 차로 기울기를 구하고 표 제목의 환산 비율로 나눠야 함(소수 답) — medium 은 표 단위의 기울기",
      concepts: ["값표의 두 점", "기울기", "단위 환산"],
      gen(rng) {
        let s = makeLinTab(rng, { conv: true }); for (let t = 0; t < 200 && (!oneDec(s.m / s.t.conv!.per) || s.m === 0); t++) s = makeLinTab(rng, { conv: true }); const c = s.t.conv!; const v = s.m / c.per; if (!oneDec(v) || v === 0) throw new GenFail("dec");
        const fig = convFig(s); const dir = s.m > 0 ? "increase" : "decrease";
        return figInst(rng, {
          stimulus: `${linIntro(rng, s)} The conversion between units is given above the table.`,
          question: `By how many ${s.t.yu} does ${s.yq} ${dir} for each increase of 1 ${sing(c.small)} in ${s.xq}, when ${s.xq} is measured in ${c.small}?`, correct: Math.abs(v), fmt: fmtNum,
          wrongs: [W(Math.abs(s.m), "unit_error", "표 단위당 변화를 답했다."), W(Math.abs(s.m * c.per), "formula_misuse", "환산 비율을 곱했다."), W(Math.abs(v) * 2, "other", "두 행의 간격을 잘못 잡았다."), W(Math.abs((s.m * s.d) / c.per), "step_missing", "x 간격으로 나누지 않았다."), W(Math.abs(v) + 0.5, "other", "계산 중 어긋났다.")],
          verificationJs: figJs({}, fig, `${LIN_JS}${CONV_JS}return Math.abs(m / per);`),
          trace: [...linRead(s), [`1 ${sing(s.t.xu)} = ${c.per} ${c.small} 이다.`, "Read the conversion."], [`작은 단위 1 당 변화 = ${fmtNum(Math.abs(s.m))} ÷ ${c.per} = ${fmtNum(Math.abs(v))} 이다.`, "Divide by the conversion factor."], [`따라서 ${fmtNum(Math.abs(v))} ${s.t.yu} 씩 ${s.m > 0 ? "증가" : "감소"}한다.`, "State the rate."]], variant: "rate_per_small_unit",
        }, fig);
      },
    },
    {
      op: "compare_scenarios", structure: "표의 기울기와 지문에 주어진 두 번째 관계의 변화율을 비교해, 같은 x 구간에서 변화량의 차를 구함", extra: "표에서 기울기를 구하고 두 변화율의 차에 구간 길이를 곱해야 함 — medium 은 표의 기울기",
      concepts: ["값표의 두 점", "기울기 비교", "변화량"],
      gen(rng) {
        const s = makeLinTab(rng, { mSign: 1 }); const r2 = rng.int(1, 14); if (r2 === s.m) throw new GenFail("same"); const L = rng.int(3, 12); const correct = Math.abs(s.m - r2) * L;
        return figInst(rng, {
          stimulus: `${linIntro(rng, s)} For a second linear relationship, ${s.yq} increases by ${r2} ${s.t.yu} for each 1 ${sing(s.t.xu)} increase in ${s.xq}.`,
          question: `Over an increase of ${L} ${s.t.xu} in ${s.xq}, what is the positive difference between the increase in ${s.yq} for the relationship in the table and for the second relationship?`, correct,
          wrongs: [W(Math.abs(s.m - r2), "step_missing", "구간 길이를 곱하지 않았다."), W(s.m * L, "step_missing", "표의 변화량만 답했다."), W((s.m + r2) * L, "sign_error", "차가 아니라 합을 구했다."), W(Math.abs(s.m * s.d - r2) * L, "unit_error", "표의 한 행 간격 변화를 1 단위 변화로 보았다."), W(correct + L, "other", "계산 중 어긋났다.")],
          verificationJs: figJs({ r2, L }, s.fig, `${LIN_JS}return Math.abs(m - P.r2) * P.L;`),
          trace: [...linRead(s), [`두 번째 관계의 변화율은 ${r2} 이다.`, "Second rate."], [`변화율의 차 = |${fmtNum(s.m)} - ${r2}| = ${fmtNum(Math.abs(s.m - r2))} 이다.`, "Difference of rates."], [`${L} 단위 동안의 차 = ${fmtNum(Math.abs(s.m - r2))} × ${L} = ${correct} 이다.`, "Multiply by the interval length."]], variant: "rate_gap_over_interval",
        }, s.fig);
      },
    },
    {
      op: "inverse", structure: "표에서 기울기를 구하고, 값이 D 만큼 변하려면 x 가 얼마나 변해야 하는지 역산", extra: "기울기로 나누는 역방향 사고(값의 변화 → 입력의 변화) — medium 은 기울기 자체",
      concepts: ["값표의 두 점", "기울기", "변화량 역산"],
      gen(rng) {
        const s = makeLinTab(rng); const k = rng.int(3, 15); const D = Math.abs(s.m) * k; if (D > 900) throw new GenFail("big");
        const dir = s.m > 0 ? "increase" : "decrease";
        return figInst(rng, {
          stimulus: `${linIntro(rng, s)}`,
          question: `Based on the table, by how many ${s.t.xu} must ${s.xq} increase for ${s.yq} to ${dir} by ${D} ${s.t.yu}?`, correct: k,
          wrongs: [W(D * Math.abs(s.m), "formula_misuse", "기울기를 곱했다."), W(Math.round(D / (Math.abs(s.m) * s.d)), "unit_error", "표 한 행의 변화를 1 단위 변화로 보았다."), W(k + 1, "other", "한 단위 어긋났다."), W(Math.round(D / Math.abs(s.ys[1])), "formula_misuse", "값으로 나눴다."), W(Math.max(1, k - 2), "other", "계산 중 어긋났다.")],
          verificationJs: figJs({ D }, s.fig, `${LIN_JS}return P.D / Math.abs(m);`),
          trace: [...linRead(s), [`1 ${sing(s.t.xu)} 당 변화는 ${fmtNum(Math.abs(s.m))} 이다.`, "Rate per unit."], [`필요한 변화량은 ${D} 이다.`, "Required change."], [`x 의 변화 = ${D} ÷ ${fmtNum(Math.abs(s.m))} 이다.`, "Divide by the rate."], [`= ${k} ${s.t.xu} 이다.`, "Compute."]], variant: "input_change_for_output_change",
        }, s.fig);
      },
    },
    {
      op: "chain2", structure: "표에서 기울기를 구하고 표 밖의 두 x 사이에서 값의 변화량을 구한 뒤 평균 변화(구간당)를 다른 구간 길이로 확장", extra: "두 행 → 기울기 → 표 밖 두 입력 사이의 변화량(절편 불필요함을 알아야 함) — medium 은 기울기",
      concepts: ["값표의 두 점", "기울기", "구간 변화량"],
      gen(rng) {
        const s = makeLinTab(rng); const a = s.xs[s.xs.length - 1] + rng.int(1, 6); const c2 = a + rng.int(3, 12); const correct = Math.abs(s.m * (c2 - a)); if (correct > 900) throw new GenFail("big");
        return figInst(rng, {
          stimulus: `${linIntro(rng, s)} Assume the relationship continues beyond the values in the table.`,
          question: `By how many ${s.t.yu} does ${s.yq} change as ${s.xq} goes from ${a} ${s.t.xu} to ${c2} ${s.t.xu}?`, correct,
          wrongs: [W(Math.abs(s.m * c2), "step_missing", "끝 입력만 곱했다."), W(Math.abs(s.m * c2 + s.b), "step_missing", "끝 값을 답했다."), W(Math.abs(s.m * s.d * (c2 - a)), "unit_error", "표 한 행의 변화를 1 단위 변화로 보았다."), W(c2 - a, "step_missing", "입력의 변화만 답했다."), W(correct + Math.abs(s.m), "other", "구간 길이를 하나 더 셌다.")],
          verificationJs: figJs({ a, c2 }, s.fig, `${LIN_JS}return Math.abs((m * P.c2 + b) - (m * P.a + b));`),
          trace: [...linRead(s), [`입력의 변화 = ${c2} - ${a} = ${c2 - a} 이다.`, "Change in input."], [`값의 변화 = 기울기 × 입력 변화 = ${fmtNum(s.m)} × ${c2 - a} 이다.`, "Multiply by the slope."], [`절편은 두 값에서 상쇄되므로 필요 없다.`, "The intercept cancels."], [`변화량 = ${correct} 이다.`, "Magnitude of the change."]], variant: "change_between_off_table_inputs",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "row_change", structure: "값표에서 이웃한 두 행의 값의 차를 구함", extra: "easy: 두 행의 차", concepts: ["값표", "차"],
      gen(rng) {
        const s = makeLinTab(rng); const D = Math.abs(s.m * s.d);
        return figInst(rng, { stimulus: linIntro(rng, s), question: `According to the table, by how many ${s.t.yu} does ${s.yq} change from one row of the table to the next?`, correct: D, wrongs: [W(s.d, "axis_misread", "x 의 간격을 답했다."), W(Math.abs(s.ys[0]), "axis_misread", "첫 값을 답했다."), W(D * 2, "other", "두 행을 건넜다."), W(Math.abs(s.m * s.d) + s.d, "other", "계산 중 어긋났다.")].filter((w) => w.v !== D), verificationJs: figJs({}, s.fig, `${LIN_JS}return Math.abs(ys[1] - ys[0]);`), trace: [[`첫 두 행의 값은 ${s.ys[0]}, ${s.ys[1]} 이다.`, "Read two adjacent rows."], [`차 = ${D} 이다.`, "Difference."]], variant: "adjacent_difference",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "slope", structure: "값표의 두 행에서 기울기(1 단위당 변화)를 구함", extra: "medium: 차의 비", concepts: ["값표", "기울기"],
      gen(rng) {
        const s = makeLinTab(rng, { mSign: 1 }); const correct = s.m;
        return figInst(rng, { stimulus: linIntro(rng, s), question: `What is the rate of change of ${s.yq} with respect to ${s.xq}, in ${rate(s)}?`, correct, fmt: fmtNum, wrongs: [W(s.m * s.d, "unit_error", "한 행의 변화를 답했다."), W(s.d / s.m, "formula_misuse", "기울기를 뒤집었다."), W(s.ys[1] / s.xs[1] || s.m + 1, "formula_misuse", "값을 입력으로 나눴다."), W(s.m + 1, "other", "계산 중 어긋났다."), W(s.m - 1, "other", "계산 중 어긋났다.")].filter((w) => w.v > 0 && Math.abs(w.v - correct) > 1e-9 && oneDec(w.v)), verificationJs: figJs({}, s.fig, `${LIN_JS}return m;`), trace: [...linRead(s), [`따라서 변화율은 ${fmtNum(s.m)} 이다.`, "State the rate."]], variant: "slope_from_rows",
        }, s.fig);
      },
    },
  ],
});
