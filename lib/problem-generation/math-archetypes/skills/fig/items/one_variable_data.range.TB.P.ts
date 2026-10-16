// one_variable_data.range.TB.P — 값 목록 표에서 범위(최댓값 - 최솟값)를 구하고, 값 추가·제거·변환·중앙값 비교로 확장한다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figInst, figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { LIST_JS, listIntro, listRead, makeList, medianOfList, type ListScene } from "../table-kit";

const RG_JS = "const mx = sv[n - 1], mn = sv[0];\n";
const ext = (s: ListScene) => { const sv = [...s.vals].sort((p, q) => p - q); return { sv, mn: sv[0], mx: sv[sv.length - 1], R: sv[sv.length - 1] - sv[0] }; };
const extStep = (s: ListScene): [string, string] => { const e = ext(s); return [`최댓값 ${e.mx}, 최솟값 ${e.mn} 이다.`, "Find the greatest and least values."]; };
const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v >= 0);

export const ITEM = defineItem({
  prefix: "ovd", itemId: "one_variable_data.range.TB.P",
  hard: [
    {
      op: "inverse", structure: "표의 최솟값을 읽고, 모든 값보다 큰 새 값이 더해진 뒤 범위가 R 이 될 때 그 새 값을 역산", extra: "새 범위의 정의(새 최댓값 - 최솟값)를 거꾸로 써야 함 — medium 은 범위 계산",
      concepts: ["값 목록 표", "범위", "역산"],
      gen(rng) {
        const s = makeList(rng); const e = ext(s); const x = e.mx + rng.int(2, 20); const R = x - e.mn; if (R > 999) throw new GenFail("big");
        return figInst(rng, {
          stimulus: `${listIntro(rng, s)} ${rng.pick(["One more value is then recorded, and it is greater than every value in the table.", "A new value, larger than all the values in the table, is added to the data.", "Later, one additional value that exceeds every value in the table is recorded."])} The range of the new data is ${R} ${s.t.unit}.`,
          question: rng.pick([`What is the new value, in ${s.t.unit}?`, `What value, in ${s.t.unit}, was added?`]), correct: x,
          wrongs: pos([W(e.mx + R, "formula_misuse", "최댓값에 범위를 더했다."), W(R, "step_missing", "범위를 그대로 답했다."), W(R - e.R, "step_missing", "범위의 증가량만 답했다."), W(e.mx + (R - e.R) + 1, "other", "1 어긋났다."), W(x - 1, "other", "1 어긋났다.")]).filter((w) => w.v !== x),
          verificationJs: figJs({ R }, s.fig, `${LIST_JS}${RG_JS}const x = mn + P.R; if (x <= mx) throw new Error('새 값이 최댓값 이하'); return x;`),
          trace: [listRead(s), extStep(s), [`원래 범위 = ${e.mx} - ${e.mn} = ${e.R} 이다.`, "Original range."], [`새 값이 가장 크므로 새 범위 = 새 값 - ${e.mn} 이다.`, "The new value becomes the maximum."], [`새 값 = ${e.mn} + ${R} = ${x} 이다.`, "Solve for the new value."]], variant: "new_max_from_range",
        }, s.fig);
      },
    },
    {
      op: "compare_scenarios", structure: "최댓값 하나를 뺀 경우와 최솟값 하나를 뺀 경우의 범위를 각각 구해 차를 구함", extra: "두 번째로 큰·작은 값까지 찾아 두 상황의 범위를 비교해야 함 — medium 은 한 상황",
      concepts: ["값 목록 표", "범위", "두 상황 비교"],
      gen(rng) {
        const s = makeList(rng, { distinct: true }); const { sv, mn, mx, R } = ext(s); const n = sv.length;
        const r1 = sv[n - 2] - mn, r2 = mx - sv[1]; if (r1 === r2) throw new GenFail("eq"); const correct = Math.abs(r1 - r2);
        return figInst(rng, {
          stimulus: `${listIntro(rng, s)} ${rng.pick(["An analyst considers two options.", "Two ways of trimming the data are compared.", "Consider two changes to the data."])} In option 1, only the greatest value is removed. In option 2, only the least value is removed.`,
          question: rng.pick([`What is the positive difference, in ${s.t.unit}, between the range of the data under option 1 and the range under option 2?`, `By how many ${s.t.unit} do the ranges of the data under the two options differ?`]), correct,
          wrongs: pos([W(r1, "step_missing", "option 1 의 범위만 답했다."), W(r2, "step_missing", "option 2 의 범위만 답했다."), W(R, "step_missing", "원래 범위를 답했다."), W(r1 + r2 - R, "formula_misuse", "두 번 뺀 범위를 구했다."), W(correct + 1, "other", "1 어긋났다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({}, s.fig, `${LIST_JS}if (new Set(v).size !== n) throw new Error('같은 값'); return Math.abs((sv[n - 2] - sv[0]) - (sv[n - 1] - sv[1]));`),
          trace: [listRead(s), [`크기순: ${sv.join(", ")} 이다.`, "Sort the values."], [`option 1: 최댓값 ${mx} 를 빼면 범위 = ${sv[n - 2]} - ${mn} = ${r1} 이다.`, "Range without the maximum."], [`option 2: 최솟값 ${mn} 을 빼면 범위 = ${mx} - ${sv[1]} = ${r2} 이다.`, "Range without the minimum."], [`차 = |${r1} - ${r2}| = ${correct} 이다.`, "Take the positive difference."]], variant: "trim_max_vs_min",
        }, s.fig);
      },
    },
    {
      op: "chain2", structure: "모든 값을 b 배 한 뒤 c 를 더한 새 자료의 범위를 구함", extra: "범위가 곱셈에는 b 배, 덧셈에는 변하지 않음을 연쇄로 적용 — medium 은 원래 범위",
      concepts: ["값 목록 표", "범위", "자료 변환"],
      gen(rng) {
        const s = makeList(rng); const { mn, mx, R } = ext(s); const b = rng.int(2, 4), c = rng.int(2, 30); const correct = b * R; if (correct > 999 || b * mx + c > 999) throw new GenFail("big");
        return figInst(rng, {
          stimulus: `${listIntro(rng, s)} ${rng.pick(["To create a new data set, each value is", "A researcher forms new data: every value is", "For a report, each value in the table is"])} multiplied by ${b}, and then ${c} is added to the result.`,
          question: rng.pick([`What is the range of the new data?`, `What is the range of the transformed values?`]), correct,
          wrongs: pos([W(R, "step_missing", "곱셈 효과를 무시했다."), W(correct + c, "formula_misuse", "덧셈도 범위를 바꾼다고 보았다."), W(R + c, "formula_misuse", "곱셈을 빼고 덧셈만 반영했다."), W(b * (R + c), "formula_misuse", "더한 뒤 곱했다."), W(b * mx + c, "axis_misread", "새 최댓값을 답했다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({ b, c }, s.fig, `${LIST_JS}const w = v.map(x => x * P.b + P.c); return Math.max(...w) - Math.min(...w);`),
          trace: [listRead(s), extStep(s), [`원래 범위 = ${mx} - ${mn} = ${R} 이다.`, "Original range."], [`${b} 배 하면 범위도 ${b} 배: ${b} × ${R} = ${correct} 이다.`, "Multiplying scales the range."], [`${c} 를 더해도 최댓값·최솟값이 같이 움직여 범위는 ${correct} 그대로이다.`, "Adding a constant does not change the range."]], variant: "range_after_linear_transform",
        }, s.fig);
      },
    },
    {
      op: "compose_kind", structure: "표의 범위와 중앙값을 각각 구해 차를 구함", extra: "산포(범위)와 중심(중앙값)을 모두 계산해 비교 — medium 은 범위 하나",
      concepts: ["값 목록 표", "범위", "중앙값"],
      gen(rng) {
        const s = makeList(rng, { n: rng.pick([5, 7]) }); const { sv, R } = ext(s); const md = medianOfList(s.vals); if (md === R) throw new GenFail("eq"); const correct = Math.abs(R - md);
        return figInst(rng, {
          stimulus: listIntro(rng, s),
          question: rng.pick([`What is the positive difference between the range and the median of the values in the table?`, `How much does the range of the values differ from their median?`]), correct,
          wrongs: pos([W(R, "step_missing", "범위만 답했다."), W(md, "step_missing", "중앙값만 답했다."), W(Math.abs(R - s.vals[(s.vals.length - 1) / 2]), "formula_misuse", "정렬하지 않고 가운데 행을 중앙값으로 썼다."), W(R + md, "sign_error", "합을 구했다."), W(correct + 1, "other", "1 어긋났다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({}, s.fig, `${LIST_JS}${RG_JS}if (n % 2 === 0) throw new Error('짝수 개'); return Math.abs((mx - mn) - sv[(n - 1) / 2]);`),
          trace: [listRead(s), [`크기순: ${sv.join(", ")} 이다.`, "Sort the values."], [`범위 = ${sv[sv.length - 1]} - ${sv[0]} = ${R} 이다.`, "Compute the range."], [`중앙값(가운데 값) = ${md} 이다.`, "Find the median."], [`차 = |${R} - ${md}| = ${correct} 이다.`, "Take the positive difference."]], variant: "range_vs_median",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "range", structure: "표에서 최댓값과 최솟값을 찾아 범위를 구함", extra: "easy: 최댓값 - 최솟값", concepts: ["값 목록 표", "범위"],
      gen(rng) {
        const s = makeList(rng); const { mn, mx, R } = ext(s); if (R === 0) throw new GenFail("zero");
        return figInst(rng, { stimulus: listIntro(rng, s), question: rng.pick([`What is the range of the values in the table?`, `What is the range of the data shown?`]), correct: R, wrongs: pos([W(mx, "step_missing", "최댓값을 답했다."), W(mn, "step_missing", "최솟값을 답했다."), W(Math.abs(s.vals[s.vals.length - 1] - s.vals[0]), "axis_misread", "첫 행과 마지막 행의 차를 구했다."), W(mx + mn, "sign_error", "합을 구했다."), W(R + 1, "other", "1 어긋났다.")]).filter((w) => w.v !== R), verificationJs: figJs({}, s.fig, `${LIST_JS}${RG_JS}return mx - mn;`), trace: [listRead(s), extStep(s), [`범위 = ${mx} - ${mn} = ${R} 이다.`, "Subtract."]], variant: "list_range" }, s.fig);
      },
    },
    {
      lv: "medium", name: "range_without_max", structure: "가장 큰 값을 뺀 나머지의 범위를 구함", extra: "medium: 두 번째로 큰 값 찾기 + 범위", concepts: ["값 목록 표", "범위"],
      gen(rng) {
        const s = makeList(rng, { distinct: true }); const { sv, mn, mx, R } = ext(s); const n = sv.length; const r = sv[n - 2] - mn;
        return figInst(rng, { stimulus: `${listIntro(rng, s)} ${rng.pick(["The greatest value is then removed from the data.", "Later, the largest value is dropped from the data."])}`, question: rng.pick([`What is the range of the remaining values?`, `What is the range of the data after the removal?`]), correct: r, wrongs: pos([W(R, "step_missing", "제거 전 범위를 답했다."), W(mx - sv[1], "opposite", "가장 작은 값을 뺐다."), W(sv[n - 2], "step_missing", "새 최댓값을 답했다."), W(sv[n - 2] - sv[1], "formula_misuse", "양쪽을 모두 뺐다."), W(r + 1, "other", "1 어긋났다.")]).filter((w) => w.v !== r), verificationJs: figJs({}, s.fig, `${LIST_JS}if (new Set(v).size !== n) throw new Error('같은 값'); return sv[n - 2] - sv[0];`), trace: [listRead(s), [`크기순: ${sv.join(", ")} 이다.`, "Sort the values."], [`최댓값 ${mx} 를 빼면 새 최댓값은 ${sv[n - 2]}, 최솟값은 ${mn} 이다.`, "New extremes."], [`범위 = ${sv[n - 2]} - ${mn} = ${r} 이다.`, "Subtract."]], variant: "range_without_max" }, s.fig);
      },
    },
  ],
});
