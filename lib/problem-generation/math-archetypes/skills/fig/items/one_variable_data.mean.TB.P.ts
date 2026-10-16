// one_variable_data.mean.TB.P — 값 목록 표(행 이름 × 값)에서 평균을 구하고, 값 추가·제거·중앙값 비교로 확장한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figInst, figJs, oneDec } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { LIST_JS, listIntro, listRead, makeList, medianOfList, type ListScene } from "../table-kit";

const sumOf = (a: number[]) => a.reduce((x, y) => x + y, 0);
/** 평균이 정수인 값 목록 표. */
function intMeanList(rng: Rng, n?: number): ListScene {
  for (let t = 0; t < 400; t++) { const s = makeList(rng, { n }); if (sumOf(s.vals) % s.vals.length === 0) return s; }
  throw new GenFail("정수 평균 목록 표집 실패");
}
const sumStep = (s: ListScene): [string, string] => [`합 = ${s.vals.join(" + ")} = ${sumOf(s.vals)} 이다.`, "Add the values."];
const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v >= 0);

export const ITEM = defineItem({
  prefix: "ovd", itemId: "one_variable_data.mean.TB.P",
  hard: [
    {
      op: "inverse", structure: "표 값의 합을 구하고, 값 하나가 더 기록된 뒤 평균이 M 이 될 때 그 새 값을 역산", extra: "목표 평균 × 새 개수에서 기존 합을 빼는 역산 — medium 은 평균 계산",
      concepts: ["값 목록 표", "평균의 역산", "합 = 평균 × 개수"],
      gen(rng) {
        for (let t = 0; t < 80; t++) {
          const s = makeList(rng, { n: rng.int(5, 6) }); const n = s.vals.length, S = sumOf(s.vals); const x = rng.int(s.t.lo, s.t.hi);
          if ((S + x) % (n + 1) !== 0) continue; const M = (S + x) / (n + 1); if (M === x) continue;
          return figInst(rng, {
            stimulus: `${listIntro(rng, s)} ${rng.pick(["One more value is then recorded.", "Later, one additional value is added to the data.", "A new entry is then added to the data."])} The mean of all the values, including the new one, is ${M} ${s.t.unit}.`,
            question: rng.pick([`What is the new value, in ${s.t.unit}?`, `What value, in ${s.t.unit}, was added?`]), correct: x,
            wrongs: pos([W(M, "step_missing", "평균을 그대로 답했다."), W(M * n - S, "formula_misuse", "새 개수에 1 을 더하지 않았다."), W(Math.round(S / n), "step_missing", "원래 평균을 답했다."), W(x + M - Math.round(S / n), "other", "평균 차를 더했다."), W(x + 1, "other", "1 어긋났다.")]),
            verificationJs: figJs({ M }, s.fig, `${LIST_JS}return P.M * (n + 1) - S;`),
            trace: [listRead(s), sumStep(s), [`값의 개수는 ${n} 이고, 새 값을 넣으면 ${n + 1} 개이다.`, "Count the values."], [`새 합 = ${M} × ${n + 1} = ${M * (n + 1)} 이다.`, "New sum = mean × count."], [`새 값 = ${M * (n + 1)} - ${S} = ${x} 이다.`, "Subtract the original sum."]], variant: "added_value_from_mean",
          }, s.fig);
        }
        throw new GenFail("inverse");
      },
    },
    {
      op: "chain2", structure: "표의 평균을 구한 뒤, 평균보다 큰 값들만 골라 그 값들의 평균을 다시 구함", extra: "평균 → 기준으로 골라내기 → 부분 평균의 연쇄 — medium 은 전체 평균까지",
      concepts: ["값 목록 표", "평균", "조건에 맞는 부분 자료"],
      gen(rng) {
        const s = makeList(rng); const m = sumOf(s.vals) / s.vals.length; const up = s.vals.filter((v) => v > m); if (up.length < 2) throw new GenFail("up");
        const ans = sumOf(up) / up.length; if (!oneDec(ans)) throw new GenFail("dec"); const ge = s.vals.filter((v) => v >= m);
        return figInst(rng, {
          stimulus: listIntro(rng, s),
          question: rng.pick([`What is the mean of only those values in the table that are greater than the mean of all the values, in ${s.t.unit}?`, `Consider only the values in the table that are above the mean of all the values. What is the mean of these values, in ${s.t.unit}?`]), correct: ans,
          wrongs: pos([W(m, "step_missing", "전체 평균을 답했다."), W(Math.max(...s.vals), "other", "가장 큰 값을 답했다."), W(sumOf(up), "step_missing", "합을 개수로 나누지 않았다."), W(ge.length !== up.length ? sumOf(ge) / ge.length : ans + 1, "condition_ignored", "평균과 같은 값도 넣었다."), W(medianOfList(up), "formula_misuse", "중앙값을 구했다."), W(ans - 1, "other", "1 어긋났다.")]).filter((w) => w.v !== ans && oneDec(w.v)),
          verificationJs: figJs({}, s.fig, `${LIST_JS}const m = S / n; const u = v.filter(x => x > m); if (!u.length) throw new Error('없음'); return u.reduce((a, b) => a + b, 0) / u.length;`),
          trace: [listRead(s), sumStep(s), [`평균 = ${sumOf(s.vals)} ÷ ${s.vals.length} = ${fmtNum(m)} 이다.`, "Compute the mean."], [`평균보다 큰 값: ${up.join(", ")} 이다.`, "Select the values above the mean."], [`그 값들의 평균 = ${sumOf(up)} ÷ ${up.length} = ${fmtNum(ans)} 이다.`, "Average the selected values."]], variant: "mean_of_values_above_mean",
        }, s.fig);
      },
    },
    {
      op: "compose_kind", structure: "표의 평균과 중앙값을 각각 구해 둘의 차를 구함", extra: "평균(합 ÷ 개수)과 중앙값(정렬 후 가운데)을 모두 구해 비교 — medium 은 평균 하나",
      concepts: ["값 목록 표", "평균", "중앙값"],
      gen(rng) {
        const s = intMeanList(rng, rng.pick([5, 7])); const n = s.vals.length; const m = sumOf(s.vals) / n; const md = medianOfList(s.vals); if (m === md) throw new GenFail("eq"); const correct = Math.abs(m - md);
        const sorted = [...s.vals].sort((p, q) => p - q);
        return figInst(rng, {
          stimulus: listIntro(rng, s),
          question: rng.pick([`What is the positive difference between the mean and the median of the values in the table, in ${s.t.unit}?`, `By how many ${s.t.unit} do the mean and the median of these values differ?`]), correct,
          wrongs: pos([W(m, "step_missing", "평균만 답했다."), W(md, "step_missing", "중앙값만 답했다."), W(Math.abs(m - s.vals[(n - 1) / 2]), "formula_misuse", "정렬하지 않고 가운데 행을 중앙값으로 썼다."), W(m + md, "sign_error", "차 대신 합을 구했다."), W(correct + 1, "other", "1 어긋났다.")]),
          verificationJs: figJs({}, s.fig, `${LIST_JS}if (n % 2 === 0) throw new Error('짝수 개'); return Math.abs(S / n - sv[(n - 1) / 2]);`),
          trace: [listRead(s), sumStep(s), [`평균 = ${sumOf(s.vals)} ÷ ${n} = ${m} 이다.`, "Compute the mean."], [`크기순 정렬: ${sorted.join(", ")} 이다.`, "Sort the values."], [`중앙값(가운데 값) = ${md} 이다.`, "Find the middle value."], [`차 = |${m} - ${md}| = ${correct} 이다.`, "Take the positive difference."]], variant: "mean_minus_median",
        }, s.fig);
      },
    },
    {
      op: "constraint_select", structure: "값 하나를 빼면 나머지 평균이 M 이 될 때, 빠진 값을 표에서 골라냄", extra: "제거 후 합을 역산해 표의 어떤 값인지 찾아야 함 — medium 은 평균 계산",
      concepts: ["값 목록 표", "평균", "합의 역산"],
      gen(rng) {
        for (let t = 0; t < 80; t++) {
          const s = makeList(rng, { n: rng.int(5, 7), distinct: true }); const n = s.vals.length, S = sumOf(s.vals); const i = rng.int(0, n - 1); const x = s.vals[i];
          if ((S - x) % (n - 1) !== 0) continue; const M = (S - x) / (n - 1); if (M === x) continue;
          const others = s.vals.filter((v) => v !== x);
          return figInst(rng, {
            stimulus: `${listIntro(rng, s)} ${rng.pick(["One of the values is found to be an error and is removed.", "One entry is later removed from the data.", "An analyst removes one value from the data."])} The mean of the remaining values is ${M} ${s.t.unit}.`,
            question: rng.pick([`Which value, in ${s.t.unit}, was removed?`, `What is the value, in ${s.t.unit}, that was removed?`]), correct: x,
            wrongs: pos([W(M, "step_missing", "남은 평균을 답했다."), W(S - M * n, "formula_misuse", "남은 개수를 n 으로 잡았다."), W(Math.max(...others), "other", "가장 큰 값을 골랐다."), W(Math.min(...others), "other", "가장 작은 값을 골랐다."), W(rng.pick(others), "other", "다른 행의 값을 골랐다.")]),
            verificationJs: figJs({ M }, s.fig, `${LIST_JS}const x = S - P.M * (n - 1); if (!v.includes(x)) throw new Error('표에 없는 값'); return x;`),
            trace: [listRead(s), sumStep(s), [`남은 값은 ${n - 1} 개이다.`, "One value is removed."], [`남은 합 = ${M} × ${n - 1} = ${M * (n - 1)} 이다.`, "Remaining sum = mean × count."], [`빠진 값 = ${S} - ${M * (n - 1)} = ${x} 이고, 표에 있는 값이다.`, "The removed value is the difference."]], variant: "removed_value_from_mean",
          }, s.fig);
        }
        throw new GenFail("select");
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "greatest_value", structure: "표에서 가장 큰 값을 찾음", extra: "easy: 표 읽기·비교", concepts: ["값 목록 표", "최댓값"],
      gen(rng) {
        const s = makeList(rng); const sv = [...new Set(s.vals)].sort((p, q) => p - q); if (sv.length < 4) throw new GenFail("few"); const mx = sv[sv.length - 1];
        return figInst(rng, { stimulus: listIntro(rng, s), question: rng.pick([`What is the greatest value, in ${s.t.unit}, shown in the table?`, `According to the table, what is the largest value, in ${s.t.unit}?`]), correct: mx, wrongs: [W(sv[0], "opposite", "가장 작은 값을 골랐다."), W(sv[sv.length - 2], "axis_misread", "두 번째로 큰 값을 골랐다."), W(s.vals[s.vals.length - 1] === mx ? s.vals[0] : s.vals[s.vals.length - 1], "axis_misread", "마지막 행을 읽었다."), W(mx - sv[0], "axis_misread", "범위를 구했다.")], verificationJs: figJs({}, s.fig, `${LIST_JS}return Math.max(...v);`), trace: [listRead(s), [`가장 큰 값은 ${mx} 이다.`, "Pick the largest value."]], variant: "max_value" }, s.fig);
      },
    },
    {
      lv: "medium", name: "mean", structure: "표의 값을 모두 더해 개수로 나눠 평균을 구함", extra: "medium: 합 ÷ 개수", concepts: ["값 목록 표", "평균"],
      gen(rng) {
        const s = intMeanList(rng); const n = s.vals.length, S = sumOf(s.vals), m = S / n;
        return figInst(rng, { stimulus: listIntro(rng, s), question: rng.pick([`What is the mean of the values in the table, in ${s.t.unit}?`, `What is the mean, in ${s.t.unit}, of the data shown?`]), correct: m, wrongs: pos([W(medianOfList(s.vals), "formula_misuse", "중앙값을 구했다."), W(Math.round(S / (n - 1)), "formula_misuse", "개수를 하나 적게 셌다."), W(Math.round(S / (n + 1)), "formula_misuse", "개수를 하나 많게 셌다."), W(m + 1, "other", "1 어긋났다."), W(m - 1, "other", "1 어긋났다.")]).filter((w) => w.v !== m), verificationJs: figJs({}, s.fig, `${LIST_JS}return S / n;`), trace: [listRead(s), sumStep(s), [`평균 = ${S} ÷ ${n} = ${m} 이다.`, "Divide by the count."]], variant: "list_mean" }, s.fig);
      },
    },
  ],
});
