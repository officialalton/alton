// percentages.percent_of.TB.P — 행 이름 × 개수 표에서 어떤 값의 p% 를 구하고, 합계·두 행 비교·역산·개수 세기로 확장한다.
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs, oneDec } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { countFig, countIntro, countScene, nameAt, pos, retry, ROW_JS, sum } from "./_t4-kit";

const read = (names: string[], vals: number[]): [string, string] => [`표에서 값을 읽는다: ${names.map((n, i) => `${n} ${vals[i]}`).join(", ")}.`, "Read the values from the table."];

export const ITEM = defineItem({
  prefix: "pct", itemId: "percentages.percent_of.TB.P",
  hard: [
    {
      op: "chain2", structure: "표의 모든 값을 더해 합계를 구한 뒤 합계의 p% 를 구함", extra: "합계 → 퍼센트의 연쇄(퍼센트의 기준이 표에서 계산한 합계) — medium 은 한 행의 p%",
      concepts: ["값 목록 표", "합계", "퍼센트"],
      gen(rng) {
        return retry(60, () => {
          const s = countScene(rng, rng.int(4, 5), 20, 200, 5); const S = sum(s.vals); const p = rng.pick([10, 15, 20, 30, 35, 40, 45, 60, 70, 80]); const c = (S * p) / 100; if (!oneDec(c)) return null;
          const fig = countFig(s);
          return figInst(rng, {
            stimulus: countIntro(rng, s),
            question: rng.pick([`What is ${p}% of the total number of ${s.t.what} for all the ${s.t.many} in the table?`, `Based on the table, what number is ${p}% of the combined number of ${s.t.what} for these ${s.t.many}?`]), correct: c,
            wrongs: pos([W(S, "step_missing", "합계에 퍼센트를 적용하지 않았다."), W(S - c, "opposite", "남는 비율(100 - p)% 로 계산했다."), W((s.vals[0] * p) / 100, "step_missing", "첫 행의 값에만 퍼센트를 적용했다."), W((S * p) / 10, "unit_error", "퍼센트를 소수로 바꿀 때 자리를 잘못 옮겼다."), W(S + c, "formula_misuse", "p% 를 더한 값을 구했다."), W(((S - s.vals[s.vals.length - 1]) * p) / 100, "step_missing", "마지막 행을 합계에서 빠뜨렸다.")], c),
            verificationJs: figJs({ p }, fig, `${ROW_JS}return S * P.p / 100;`),
            trace: [read(s.names, s.vals), [`합계 = ${s.vals.join(" + ")} = ${S} 이다.`, "Add all the values."], [`${p}% = ${p / 100} 이다.`, "Write the percent as a decimal."], [`${S} × ${p / 100} = ${fmtNum(c)} 이다.`, "Multiply the total by the decimal."], [`따라서 답은 ${fmtNum(c)} 이다.`, "That is the requested amount."]], variant: "percent_of_total",
          }, fig);
        }, "chain2");
      },
    },
    {
      op: "compare_scenarios", structure: "두 행에 서로 다른 퍼센트를 적용해 두 결과의 차를 구함", extra: "두 행을 각각 다른 퍼센트로 계산해 비교해야 함(퍼센트가 큰 쪽이 결과도 크다는 보장이 없음) — medium 은 한 행의 p%",
      concepts: ["값 목록 표", "퍼센트", "두 경우 비교"],
      gen(rng) {
        return retry(80, () => {
          const s = countScene(rng, rng.int(4, 6), 40, 400, 20); const [i, j] = rng.shuffle([...s.names.keys()]).slice(0, 2); const p = rng.pick([10, 15, 20, 25, 30, 40, 45]), q = rng.pick([50, 55, 60, 65, 70, 75, 80, 90]);
          const A = (s.vals[i] * p) / 100, B = (s.vals[j] * q) / 100; if (!Number.isInteger(A) || !Number.isInteger(B) || A === B) return null; const c = Math.abs(A - B);
          const fig = countFig(s);
          return figInst(rng, {
            stimulus: `${countIntro(rng, s)} A planner estimates that ${p}% of the ${s.t.unit} ${nameAt(s.t, s.names[i])} and ${q}% of the ${s.t.unit} ${nameAt(s.t, s.names[j])} came from repeat customers.`,
            question: rng.pick([`According to these estimates, what is the positive difference between the two numbers of ${s.t.unit} from repeat customers?`, `Based on the table and the estimates, by how many ${s.t.unit} do the two repeat-customer numbers differ?`]), correct: c,
            wrongs: pos([W(Math.abs((s.vals[i] * q) / 100 - (s.vals[j] * p) / 100), "axis_misread", "두 퍼센트를 서로 바꿔 적용했다."), W(A + B, "sign_error", "차 대신 합을 구했다."), W(Math.abs(s.vals[i] - s.vals[j]), "step_missing", "퍼센트를 적용하지 않고 값의 차를 구했다."), W((Math.abs(s.vals[i] - s.vals[j]) * Math.abs(q - p)) / 100, "formula_misuse", "값의 차에 퍼센트의 차를 곱했다."), W(Math.max(A, B), "step_missing", "한쪽 결과만 답했다.")], c),
            verificationJs: figJs({ ni: s.names[i], nj: s.names[j], p, q }, fig, `${ROW_JS}return Math.abs(at(P.ni) * P.p / 100 - at(P.nj) * P.q / 100);`),
            trace: [read(s.names, s.vals), [`${s.names[i]} 의 값 ${s.vals[i]}, ${s.names[j]} 의 값 ${s.vals[j]} 를 고른다.`, "Pick the two rows."], [`${s.vals[i]} × ${p / 100} = ${A} 이다.`, "Apply the first percent."], [`${s.vals[j]} × ${q / 100} = ${B} 이다.`, "Apply the second percent."], [`차 = |${A} - ${B}| = ${c} 이다.`, "Take the positive difference."]], variant: "two_rows_two_percents",
          }, fig);
        }, "compare");
      },
    },
    {
      op: "inverse", structure: "한 행의 p% 가 미지수 x 의 q% 와 같을 때 x 를 역산", extra: "표에서 p% 를 계산한 뒤, 그것을 q% 로 갖는 원래 수를 거꾸로 구해야 함 — medium 은 p% 계산만",
      concepts: ["값 목록 표", "퍼센트", "퍼센트 역산(전체 구하기)"],
      gen(rng) {
        return retry(80, () => {
          const s = countScene(rng, rng.int(4, 6), 40, 400, 20); const i = rng.int(0, s.names.length - 1); const p = rng.pick([20, 30, 40, 45, 60, 75]), q = rng.pick([10, 15, 25, 50, 80]); if (p === q) return null;
          const A = (s.vals[i] * p) / 100; const x = (A * 100) / q; if (!Number.isInteger(A) || !Number.isInteger(x) || x > 999) return null;
          const fig = countFig(s);
          return figInst(rng, {
            stimulus: `${countIntro(rng, s)} Let $A$ be ${p}% of the number of ${s.t.what} ${nameAt(s.t, s.names[i])}.`,
            question: rng.pick([`If $A$ is ${q}% of a number $x$, what is the value of $x$?`, `The value of $A$ is equal to ${q}% of a positive number $x$. What is $x$?`]), correct: x,
            wrongs: pos([W(A, "step_missing", "A 를 그대로 답했다."), W((A * q) / 100, "opposite", "x 를 구하지 않고 A 의 q% 를 구했다."), W((s.vals[i] * q) / 100, "formula_misuse", "표의 값에 q% 를 적용했다."), W((s.vals[i] * 100) / q, "step_missing", "p% 를 적용하지 않고 표의 값에서 바로 역산했다."), W(s.vals[i], "other", "표의 값을 그대로 답했다.")], x),
            verificationJs: figJs({ nm: s.names[i], p, q }, fig, `${ROW_JS}return at(P.nm) * P.p / 100 * 100 / P.q;`),
            trace: [read(s.names, s.vals), [`${s.names[i]} 의 값은 ${s.vals[i]} 이다.`, "Find the row."], [`A = ${s.vals[i]} × ${p / 100} = ${A} 이다.`, "Compute A."], [`${q / 100}x = ${A} 이다.`, "Write the equation for x."], [`x = ${A} ÷ ${q / 100} = ${x} 이다.`, "Divide to find x."]], variant: "percent_equals_percent",
          }, fig);
        }, "inverse");
      },
    },
    {
      op: "constraint_select", structure: "모든 행에 p% 를 적용해 기준 T 보다 큰 결과가 나오는 행의 개수를 셈", extra: "행마다 퍼센트를 적용하고(또는 기준을 T ÷ p% 로 바꿔) 경계(같은 경우 제외)를 따져 개수를 세야 함 — medium 은 한 행의 p%",
      concepts: ["값 목록 표", "퍼센트", "조건 개수 세기"],
      gen(rng) {
        return retry(80, () => {
          const s = countScene(rng, 6, 40, 400, 20); const p = rng.pick([15, 20, 25, 30, 35, 40, 45, 60]); const res = s.vals.map((v) => (v * p) / 100);
          const T = rng.pick(res) + rng.pick([0, 0, 1, 2]); if (!Number.isInteger(T) || T < 2) return null; const cnt = res.filter((r) => r > T).length; const ge = res.filter((r) => r >= T).length; if (cnt < 1 || cnt > 5) return null;
          const fig = countFig(s);
          return figInst(rng, {
            stimulus: `${countIntro(rng, s)} Next month, each of these ${s.t.many} expects its number of ${s.t.what} to be ${p}% of the number shown in the table.`,
            question: rng.pick([`For how many of the ${s.t.many} is the expected number for next month greater than ${T}?`, `How many of the ${s.t.many} are expected to have more than ${T} ${s.t.unit} next month?`]), correct: cnt,
            wrongs: pos([W(ge === cnt ? cnt + 1 : ge, "condition_ignored", "같은 경우까지 셌다."), W(6 - cnt, "opposite", "기준 이하인 개수를 셌다."), W(s.vals.filter((v) => v > T).length, "step_missing", "퍼센트를 적용하지 않고 표의 값과 기준을 비교했다."), W(cnt - 1, "other", "하나를 빠뜨렸다."), W(cnt + 2, "other", "경계를 잘못 잡았다.")], cnt).filter((w) => w.v <= 6),
            verificationJs: figJs({ p, T }, fig, `${ROW_JS}return v.filter(x => x * P.p / 100 > P.T).length;`),
            trace: [read(s.names, s.vals), [`각 값의 ${p}%: ${res.join(", ")} 이다.`, "Apply the percent to each row."], [`기준은 ${T} 보다 큰 것(같은 것은 제외)이다.`, "The condition is strictly greater."], [`${T} 보다 큰 결과: ${res.filter((r) => r > T).join(", ")} 이다.`, "Select the results above the threshold."], [`개수는 ${cnt} 이다.`, "Count them."]], variant: "count_rows_percent_above",
          }, fig);
        }, "select");
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "simple_percent_of_row", structure: "표의 한 행 값의 10%·25%·50% 를 구함", extra: "easy: 표 읽기 + 쉬운 퍼센트", concepts: ["값 목록 표", "퍼센트"],
      gen(rng) {
        return retry(40, () => {
          const s = countScene(rng, rng.int(4, 6), 40, 400, 20); const i = rng.int(0, s.names.length - 1); const p = rng.pick([10, 25, 50]); const c = (s.vals[i] * p) / 100; if (!Number.isInteger(c)) return null;
          const fig = countFig(s); const o = s.vals[(i + 1) % s.vals.length];
          return figInst(rng, { stimulus: countIntro(rng, s), question: `What is ${p}% of the number of ${s.t.what} ${nameAt(s.t, s.names[i])}?`, correct: c, wrongs: pos([W(s.vals[i], "step_missing", "퍼센트를 적용하지 않았다."), W((o * p) / 100, "axis_misread", "다른 행의 값을 읽었다."), W(s.vals[i] - c, "opposite", "남는 비율로 계산했다."), W((s.vals[i] * p) / 10, "unit_error", "자리를 잘못 옮겼다.")], c), verificationJs: figJs({ nm: s.names[i], p }, fig, `${ROW_JS}return at(P.nm) * P.p / 100;`), trace: [[`표에서 ${s.names[i]} 의 값 ${s.vals[i]} 를 읽는다.`, "Read the row."], [`${s.vals[i]} × ${p / 100} = ${c} 이다.`, "Multiply by the percent."]], variant: "easy_percent_of_row" }, fig);
        }, "easy");
      },
    },
    {
      lv: "medium", name: "percent_of_row", structure: "표의 한 행 값의 p% 를 소수로 바꿔 계산", extra: "medium: 퍼센트를 소수로 바꿔 곱하기", concepts: ["값 목록 표", "퍼센트"],
      gen(rng) {
        return retry(40, () => {
          const s = countScene(rng, rng.int(4, 6), 40, 400, 20); const i = rng.int(0, s.names.length - 1); const p = rng.pick([15, 30, 35, 40, 45, 60, 65, 70, 85, 90]); const c = (s.vals[i] * p) / 100; if (!Number.isInteger(c)) return null;
          const fig = countFig(s); const o = s.vals[(i + 1) % s.vals.length];
          return figInst(rng, { stimulus: countIntro(rng, s), question: rng.pick([`What is ${p}% of the number of ${s.t.what} ${nameAt(s.t, s.names[i])}?`, `Based on the table, what number is ${p}% of the ${s.t.unit} counted ${nameAt(s.t, s.names[i])}?`]), correct: c, wrongs: pos([W(s.vals[i] - c, "opposite", "남는 비율로 계산했다."), W((o * p) / 100, "axis_misread", "다른 행을 읽었다."), W(s.vals[i] + c, "formula_misuse", "p% 를 더했다."), W(s.vals[i] / p, "formula_misuse", "퍼센트로 나누었다."), W(c + 10, "other", "계산 중 어긋났다.")], c), verificationJs: figJs({ nm: s.names[i], p }, fig, `${ROW_JS}return at(P.nm) * P.p / 100;`), trace: [[`표에서 ${s.names[i]} 의 값 ${s.vals[i]} 를 읽는다.`, "Read the row."], [`${p}% = ${p / 100} 이다.`, "Write the percent as a decimal."], [`${s.vals[i]} × ${p / 100} = ${c} 이다.`, "Multiply."]], variant: "percent_of_row" }, fig);
        }, "medium");
      },
    },
  ],
});
