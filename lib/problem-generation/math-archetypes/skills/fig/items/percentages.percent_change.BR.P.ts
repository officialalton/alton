// percentages.percent_change.BR.P — 두 기간 값표(행 이름 × 기간 1·기간 2)에서 퍼센트 변화를 구하고, 최댓값 비교·개수·연쇄 예측·합계 변화로 확장한다.
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figJs, oneDec } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { nameAt, pLow, pos, r1, retry, sum, type TwoScene } from "./_t4-kit";
import { BAR_TWO_JS, twoBar, twoBarIntro, twoSceneBar, gInst } from "../data-kit";

const UPS = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75];
const MIX = [-30, -25, -20, -15, -10, -5, 5, 10, 15, 20, 25, 30, 40, 50, 60, 75];
const read = (s: TwoScene): [string, string] => [`막대그래프에서 읽는다: ${s.names.map((n, i) => `${n} ${s.vals[i]}→${s.v2[i]}`).join(", ")}.`, "Read both periods for each row."];
const pcStep = (s: TwoScene, i: number): [string, string] => [`${s.names[i]}: (${s.v2[i]} - ${s.vals[i]}) ÷ ${s.vals[i]} × 100 = ${s.pct[i]}% 이다.`, `Percent change for ${s.names[i]}.`];
const from = (s: TwoScene) => `from ${pLow(s.p[0])} to ${pLow(s.p[1])}`;

export const ITEM = defineItem({
  prefix: "pct", itemId: "percentages.percent_change.BR.P",
  hard: [
    {
      op: "compare_scenarios", structure: "모든 행의 퍼센트 증가를 구해 가장 큰 퍼센트 증가를 찾음(증가량이 가장 큰 행과 다름)", extra: "증가량(차)과 퍼센트 증가(차 ÷ 처음 값)를 구별해 모든 행을 비교해야 함 — medium 은 한 행의 퍼센트 변화",
      concepts: ["두 기간 막대그래프", "퍼센트 변화", "비교"],
      gen(rng) {
        return retry(80, () => {
          const s = twoSceneBar(rng, rng.int(4, 5), UPS); const mx = Math.max(...s.pct); if (s.pct.filter((p) => p === mx).length !== 1) return null;
          const d = s.v2.map((b, i) => b - s.vals[i]); const iD = d.indexOf(Math.max(...d)); if (s.pct[iD] === mx) return null; const fig = twoBar(s);
          return gInst(rng, {
            stimulus: twoBarIntro(rng, s),
            question: rng.pick([`Each of these ${s.t.many} had an increase ${from(s)}. What is the greatest percent increase among the ${s.t.many}?`, `Of the percent increases ${from(s)} for these ${s.t.many}, which is the greatest? (Give the percent increase.)`]), correct: mx,
            wrongs: pos([W(s.pct[iD], "formula_misuse", "증가량이 가장 큰 행의 퍼센트를 골랐다."), W(Math.max(...d), "step_missing", "가장 큰 증가량(차)을 답했다."), W(Math.min(...s.pct), "opposite", "가장 작은 퍼센트 증가를 골랐다."), W(r1((d[s.pct.indexOf(mx)] / s.v2[s.pct.indexOf(mx)]) * 100), "formula_misuse", "나중 값으로 나누었다."), W(100 + mx, "formula_misuse", "나중 값이 처음 값의 몇 퍼센트인지를 답했다.")], mx),
            verificationJs: figJs({}, fig, `${BAR_TWO_JS}if (a.some((x, i) => b[i] <= x)) throw new Error('증가가 아님'); return Math.max(...a.map((_, i) => pc(i)));`),
            trace: [read(s), ["퍼센트 증가 = (나중 - 처음) ÷ 처음 × 100 이다.", "Percent increase = change ÷ original × 100."], [`행별 퍼센트 증가: ${s.names.map((n, i) => `${n} ${s.pct[i]}%`).join(", ")} 이다.`, "Compute each percent increase."], [`증가량이 가장 큰 ${s.names[iD]} 는 ${s.pct[iD]}% 로 가장 크지 않다.`, "The largest change is not the largest percent change."], [`가장 큰 퍼센트 증가는 ${mx}% 이다.`, "Pick the greatest."]], variant: "greatest_percent_increase",
          }, fig);
        }, "compare");
      },
    },
    {
      op: "constraint_select", structure: "모든 행의 퍼센트 변화를 구해 T% 보다 크게 증가한 행의 개수를 셈", extra: "감소한 행·경계와 같은 행을 가려 가며 퍼센트 기준으로 세야 함 — medium 은 한 행",
      concepts: ["두 기간 막대그래프", "퍼센트 변화", "조건 개수 세기"],
      gen(rng) {
        return retry(80, () => {
          const s = twoSceneBar(rng, 6, MIX); const T = rng.pick([10, 15, 20, 25, 30]); const cnt = s.pct.filter((p) => p > T).length; const ge = s.pct.filter((p) => p >= T).length; if (cnt < 1 || cnt > 5) return null;
          const dCnt = s.v2.filter((b, i) => b - s.vals[i] > T).length; const fig = twoBar(s);
          return gInst(rng, {
            stimulus: twoBarIntro(rng, s),
            question: rng.pick([`For how many of the ${s.t.many} did the number of ${s.t.what} increase by more than ${T}% ${from(s)}?`, `How many of these ${s.t.many} had an increase of more than ${T}% ${from(s)}?`]), correct: cnt,
            wrongs: pos([W(ge === cnt ? cnt + 1 : ge, "condition_ignored", "같은 경우까지 셌다."), W(s.pct.filter((p) => p > 0).length, "condition_ignored", "증가한 행을 모두 셌다."), W(dCnt, "formula_misuse", "증가량(차)과 기준 수를 비교했다."), W(6 - cnt, "opposite", "기준 이하인 행을 셌다."), W(cnt + 1, "other", "하나를 더 셌다."), W(cnt - 1, "other", "하나를 빠뜨렸다.")], cnt).filter((w) => w.v <= 6),
            verificationJs: figJs({ T }, fig, `${BAR_TWO_JS}return a.filter((_, i) => pc(i) > P.T + 1e-9).length;`),
            trace: [read(s), ["퍼센트 변화 = (나중 - 처음) ÷ 처음 × 100 이다.", "Percent change = change ÷ original × 100."], [`행별: ${s.pct.map((p) => `${p}%`).join(", ")} 이다.`, "Compute each percent change."], [`${T}% 보다 큰 증가(같은 것 제외): ${s.pct.filter((p) => p > T).map((p) => `${p}%`).join(", ")} 이다.`, "Select those above the threshold."], [`개수는 ${cnt} 이다.`, "Count them."]], variant: "count_increase_above",
          }, fig);
        }, "select");
      },
    },
    {
      op: "chain2", structure: "한 행의 퍼센트 변화를 구한 뒤 같은 퍼센트로 한 기간 더 변할 때의 값을 구함", extra: "퍼센트 변화 → 그 퍼센트를 새 기준(기간 2 값)에 다시 적용 — 같은 '양'을 더하면 틀림 — medium 은 퍼센트 변화까지",
      concepts: ["두 기간 막대그래프", "퍼센트 변화", "연속 변화"],
      gen(rng) {
        return retry(120, () => {
          const s = twoSceneBar(rng, rng.int(4, 5), MIX); const i = rng.int(0, s.names.length - 1); const v3 = (s.v2[i] * (100 + s.pct[i])) / 100; if (!Number.isInteger(v3) || v3 > 999) return null; const fig = twoBar(s); const d = s.v2[i] - s.vals[i];
          return gInst(rng, {
            stimulus: `${twoBarIntro(rng, s)} Suppose that, in the next period, the number ${nameAt(s.t, s.names[i])} changes by the same percent as it did ${from(s)}.`,
            question: rng.pick([`What would the number of ${s.t.what} be in the next period?`, `Under this assumption, how many ${s.t.unit} would there be in the next period?`]), correct: v3,
            wrongs: pos([W(s.v2[i] + d, "formula_misuse", "같은 퍼센트가 아니라 같은 양만큼 변한다고 보았다."), W(s.v2[i], "step_missing", "변화를 적용하지 않았다."), W((s.vals[i] * (100 + 2 * s.pct[i])) / 100, "formula_misuse", "처음 값에 퍼센트를 두 배로 적용했다."), W((s.v2[i] * (100 - s.pct[i])) / 100, "sign_error", "변화의 방향을 반대로 적용했다."), W((s.vals[i] * (100 + s.pct[i])) / 100 + s.pct[i], "other", "퍼센트 수를 그대로 더했다.")], v3),
            verificationJs: figJs({ nm: s.names[i] }, fig, `${BAR_TWO_JS}const k = idx(P.nm); return b[k] * (1 + pc(k) / 100);`),
            trace: [read(s), [`${s.names[i]} 의 변화량 = ${s.v2[i]} - ${s.vals[i]} = ${d} 이다.`, "Find the change."], pcStep(s, i), [`다음 기간의 기준은 ${s.v2[i]} 이다.`, "The new base is the second-period value."], [`${s.v2[i]} × ${fmtNum((100 + s.pct[i]) / 100)} = ${fmtNum(v3)} 이다.`, "Apply the same percent change."]], variant: "repeat_percent_change",
          }, fig);
        }, "chain2");
      },
    },
    {
      op: "compose_kind", structure: "두 기간의 합계를 각각 구해 합계의 퍼센트 변화를 구함", extra: "행별 퍼센트의 평균이 아니라 합계끼리의 퍼센트 변화를 구해야 함(합계 → 퍼센트 변화의 합성) — medium 은 한 행",
      concepts: ["두 기간 막대그래프", "합계", "퍼센트 변화"],
      gen(rng) {
        return retry(200, () => {
          const s = twoSceneBar(rng, rng.int(3, 4), MIX); const A = sum(s.vals), B = sum(s.v2); if (B <= A) return null; const c = ((B - A) / A) * 100; if (!oneDec(c)) return null; const avg = sum(s.pct) / s.pct.length; if (Math.abs(avg - c) < 1e-9) return null; const fig = twoBar(s);
          return gInst(rng, {
            stimulus: twoBarIntro(rng, s),
            question: rng.pick([`By what percent did the total number of ${s.t.what} for all these ${s.t.many} combined increase ${from(s)}?`, `Consider the combined number of ${s.t.what} for these ${s.t.many}. What was the percent increase in this total ${from(s)}?`]), correct: c,
            wrongs: pos([W(r1(avg), "formula_misuse", "행별 퍼센트 변화의 평균을 냈다."), W(B - A, "step_missing", "합계의 증가량(차)을 답했다."), W(r1(((B - A) / B) * 100), "formula_misuse", "나중 합계로 나누었다."), W(sum(s.pct), "formula_misuse", "행별 퍼센트를 더했다."), W(r1((B / A) * 100), "formula_misuse", "나중 합계가 처음 합계의 몇 퍼센트인지를 답했다.")], c),
            verificationJs: figJs({}, fig, `${BAR_TWO_JS}const A = a.reduce((x, y) => x + y, 0), B = b.reduce((x, y) => x + y, 0); return (B - A) / A * 100;`),
            trace: [read(s), [`${pLow(s.p[0])} 합계 = ${s.vals.join(" + ")} = ${A} 이다.`, "Total for the first period."], [`${pLow(s.p[1])} 합계 = ${s.v2.join(" + ")} = ${B} 이다.`, "Total for the second period."], [`증가량 = ${B} - ${A} = ${B - A} 이다.`, "Find the change in the total."], [`퍼센트 증가 = ${B - A} ÷ ${A} × 100 = ${fmtNum(c)}% 이다.`, "Divide by the original total."]], variant: "percent_change_of_total",
          }, fig);
        }, "compose");
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "change_amount", structure: "한 행의 두 기간 값의 차를 구함", extra: "easy: 표 읽기 + 뺄셈", concepts: ["두 기간 막대그래프", "변화량"],
      gen(rng) {
        const s = twoSceneBar(rng, rng.int(4, 5), MIX); const i = rng.int(0, s.names.length - 1); const c = Math.abs(s.v2[i] - s.vals[i]); const fig = twoBar(s); const o = (i + 1) % s.names.length;
        return gInst(rng, { stimulus: twoBarIntro(rng, s), question: `By how many ${s.t.unit} did the number ${nameAt(s.t, s.names[i])} change ${from(s)}?`, correct: c, wrongs: pos([W(Math.abs(s.pct[i]), "unit_error", "퍼센트 변화를 답했다."), W(Math.abs(s.v2[o] - s.vals[o]) || c + 5, "axis_misread", "다른 행을 읽었다."), W(s.v2[i] + s.vals[i], "sign_error", "두 값을 더했다."), W(s.v2[i], "step_missing", "나중 값을 답했다."), W(c + 10, "other", "계산 중 어긋났다.")], c), verificationJs: figJs({ nm: s.names[i] }, fig, `${BAR_TWO_JS}const k = idx(P.nm); return Math.abs(b[k] - a[k]);`), trace: [[`${s.names[i]}: ${s.vals[i]}, ${s.v2[i]} 을 읽는다.`, "Read the row."], [`차 = |${s.v2[i]} - ${s.vals[i]}| = ${c} 이다.`, "Subtract."]], variant: "change_amount" }, fig);
      },
    },
    {
      lv: "medium", name: "percent_change_row", structure: "한 행의 퍼센트 증가를 구함", extra: "medium: 차 ÷ 처음 값 × 100", concepts: ["두 기간 막대그래프", "퍼센트 변화"],
      gen(rng) {
        const s = twoSceneBar(rng, rng.int(4, 5), UPS); const i = rng.int(0, s.names.length - 1); const c = s.pct[i]; const fig = twoBar(s); const d = s.v2[i] - s.vals[i];
        return gInst(rng, { stimulus: twoBarIntro(rng, s), question: rng.pick([`By what percent did the number of ${s.t.what} ${nameAt(s.t, s.names[i])} increase ${from(s)}?`, `What was the percent increase in the ${s.t.unit} ${nameAt(s.t, s.names[i])} ${from(s)}?`]), correct: c, wrongs: pos([W(d, "step_missing", "증가량을 답했다."), W(r1((d / s.v2[i]) * 100), "formula_misuse", "나중 값으로 나누었다."), W(100 + c, "formula_misuse", "나중 값이 처음 값의 몇 퍼센트인지를 답했다."), W(c / 10, "unit_error", "자리를 잘못 옮겼다."), W(c + 5, "other", "계산 중 어긋났다.")], c), verificationJs: figJs({ nm: s.names[i] }, fig, `${BAR_TWO_JS}return pc(idx(P.nm));`), trace: [[`${s.names[i]}: ${s.vals[i]}, ${s.v2[i]} 을 읽는다.`, "Read the row."], [`증가량 = ${d} 이다.`, "Find the change."], [`${d} ÷ ${s.vals[i]} × 100 = ${c}% 이다.`, "Divide by the original value."]], variant: "percent_change_row" }, fig);
      },
    },
  ],
});
