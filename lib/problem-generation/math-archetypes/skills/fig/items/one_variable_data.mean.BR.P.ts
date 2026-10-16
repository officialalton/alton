// one_variable_data.mean.BR.P — 도수 막대그래프에서 평균을 구하고(합 = Σ값×도수), 추가·목표 평균·두 상황 비교로 확장한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { BF_JS, bfIntro, bfRead, makeBarFq, type BarFqScene, gInst } from "../data-kit";

/** 평균이 정수인 도수 막대그래프(평균 계산이 정수로 떨어지는 장면). */
function intMeanFq(rng: Rng): BarFqScene {
  for (let t = 0; t < 400; t++) { const s = makeBarFq(rng); if (s.sum % s.N === 0) return s; }
  throw new GenFail("정수 평균 도수 막대그래프 표집 실패");
}
const sumStep = (s: BarFqScene): [string, string] => [`합 = ${s.vals.map((v, i) => `${v}×${s.freqs[i]}`).join(" + ")} = ${s.sum} 이다.`, "Multiply each value by its frequency and add."];
const nStep = (s: BarFqScene): [string, string] => [`전체 개수 = ${s.freqs.join(" + ")} = ${s.N} 이다.`, "Add the frequencies."];
const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v >= 0);

export const ITEM = defineItem({
  prefix: "ovd", itemId: "one_variable_data.mean.BR.P",
  hard: [
    {
      op: "inverse", structure: "도수 막대그래프의 합·개수를 구한 뒤, 같은 값을 가진 k 명이 더해져 평균이 M 이 될 때 그 값을 역으로 구함", extra: "도수 막대그래프에서 합과 개수를 계산하고 목표 평균에서 새 합을 세워 역산해야 함 — medium 은 평균 계산까지",
      concepts: ["도수 막대그래프", "평균의 역산", "합 = 평균 × 개수"],
      gen(rng) {
        for (let t = 0; t < 60; t++) {
          const s = makeBarFq(rng); const k = rng.int(2, 5); const x = s.t.lo + s.t.step * rng.int(0, Math.floor((s.t.hi - s.t.lo) / s.t.step) + 2);
          if ((s.sum + k * x) % (s.N + k) !== 0) continue; const M = (s.sum + k * x) / (s.N + k); if (M === x || M < 2) continue;
          return gInst(rng, {
            stimulus: `${bfIntro(rng, s)} Later, ${k} more ${s.t.ent} join the group, and each of them has the same value. ${rng.pick(["After they join, the", "Then the", "With them included, the"])} mean of all the values is ${M} ${s.t.unit}.`,
            question: rng.pick([`What value, in ${s.t.unit}, does each of the new ${s.t.ent} have?`, `What is the value, in ${s.t.unit}, for each of the ${k} new ${s.t.ent}?`]), correct: x,
            wrongs: pos([W(M, "step_missing", "목표 평균을 그대로 답했다."), W(M * (s.N + k) - s.sum, "step_missing", "새 합의 차를 k 로 나누지 않았다."), W(Math.round((M * s.N - s.sum) / k), "formula_misuse", "새 개수에 k 를 더하지 않았다."), W(x + 1, "other", "계산 중 1 어긋났다."), W(Math.round(s.sum / s.N), "step_missing", "원래 평균을 답했다."), W(x - 1, "other", "계산 중 1 어긋났다.")]),
            verificationJs: figJs({ k, M }, s.fig, `${BF_JS}return (P.M * (N + P.k) - S) / P.k;`),
            trace: [bfRead(s), nStep(s), sumStep(s), [`새 전체 개수 = ${s.N} + ${k} = ${s.N + k}, 새 합 = ${M} × ${s.N + k} = ${M * (s.N + k)} 이다.`, "New total = target mean × new count."], [`더해진 합 = ${M * (s.N + k)} - ${s.sum} = ${k * x} 이다.`, "Subtract the original sum."], [`한 명의 값 = ${k * x} ÷ ${k} = ${x} 이다.`, "Divide by the number of new members."]], variant: "value_of_added_members",
          }, s.fig);
        }
        throw new GenFail("inverse");
      },
    },
    {
      op: "chain2", structure: "도수 막대그래프의 평균을 구한 뒤, 평균보다 큰 값을 가진 개체 수를 셈", extra: "평균(가중 평균) → 그 평균을 기준으로 도수 다시 합산의 연쇄 — medium 은 평균까지",
      concepts: ["도수 막대그래프", "평균", "조건에 맞는 도수 합"],
      gen(rng) {
        const s = makeBarFq(rng); const m = s.sum / s.N; const above = s.vals.reduce((a, v, i) => a + (v > m ? s.freqs[i] : 0), 0); const ge = s.vals.reduce((a, v, i) => a + (v >= m ? s.freqs[i] : 0), 0);
        if (above === 0 || above === s.N) throw new GenFail("above");
        return gInst(rng, {
          stimulus: bfIntro(rng, s),
          question: rng.pick([`How many of the ${s.t.ent} have a value greater than the mean of the data?`, `For how many ${s.t.ent} is the value greater than the mean of all the values in the graph?`]), correct: above,
          wrongs: [W(s.N - above, "opposite", "평균 이하인 개수를 셌다."), W(ge === above ? above + 1 : ge, "condition_ignored", "평균과 같은 값까지 셌다."), W(s.vals.filter((v) => v > m).length, "axis_misread", "도수가 아니라 값의 종류 수를 셌다."), W(s.N, "condition_ignored", "전체 개수를 답했다."), W(above - 1, "other", "한 행을 빠뜨렸다.")],
          verificationJs: figJs({}, s.fig, `${BF_JS}const m = S / N; return vals.reduce((a, v, i) => a + (v > m ? fr[i] : 0), 0);`),
          trace: [bfRead(s), nStep(s), sumStep(s), [`평균 = ${s.sum} ÷ ${s.N} ≈ ${fmtNum(m)} 이다.`, "Compute the mean."], [`평균보다 큰 값의 도수를 더하면 ${above} 이다.`, "Add the frequencies of values above the mean."]], variant: "count_above_mean",
        }, s.fig);
      },
    },
    {
      op: "compare_scenarios", structure: "도수 막대그래프의 평균을 구하고, 모든 값에 a 를 더하는 상황과 b 배 하는 상황의 새 평균 차를 구함", extra: "평균이 덧셈·곱셈 변환에 어떻게 반응하는지 두 상황을 비교해야 함 — medium 은 평균 하나",
      concepts: ["도수 막대그래프", "평균", "자료 변환과 평균"],
      gen(rng) {
        const s = intMeanFq(rng); const m = s.sum / s.N; const a = rng.int(2, 12); const b = rng.int(2, 4); const p1 = m + a, p2 = m * b; if (p1 === p2) throw new GenFail("same"); const correct = Math.abs(p2 - p1);
        return gInst(rng, {
          stimulus: `${bfIntro(rng, s)} ${rng.pick(["Consider two ways to change the data.", "Two adjustments to the data are proposed.", "An analyst compares two changes to the data."])} In plan 1, ${a} is added to every value. In plan 2, every value is multiplied by ${b}.`,
          question: rng.pick(["What is the positive difference between the mean under plan 1 and the mean under plan 2?", "By how much do the means of the adjusted data under the two plans differ?"]), correct,
          wrongs: pos([W(Math.abs(b - a), "step_missing", "평균을 구하지 않고 a, b 만 비교했다."), W(p2, "step_missing", "plan 2 의 평균만 답했다."), W(p1, "step_missing", "plan 1 의 평균만 답했다."), W(Math.abs(p2 - m - a * s.N), "formula_misuse", "덧셈을 개수만큼 누적했다."), W(correct + a, "other", "덧셈을 두 번 반영했다."), W(Math.abs(m * b - m), "step_missing", "plan 1 에서 a 를 더하지 않았다.")]),
          verificationJs: figJs({ a, b }, s.fig, `${BF_JS}const m = S / N; return Math.abs((m + P.a) - m * P.b);`),
          trace: [bfRead(s), nStep(s), sumStep(s), [`평균 = ${s.sum} ÷ ${s.N} = ${m} 이다.`, "Compute the mean."], [`plan 1 평균 = ${m} + ${a} = ${p1}, plan 2 평균 = ${m} × ${b} = ${p2} 이다.`, "Adding shifts the mean; multiplying scales it."], [`차 = |${p1} - ${p2}| = ${correct} 이다.`, "Take the positive difference."]], variant: "shift_vs_scale_mean",
        }, s.fig);
      },
    },
    {
      op: "param_condition", structure: "도수 막대그래프의 합·개수를 구하고, k 명이 같은 값 x 로 더해질 때 평균이 M 이상이 되는 최소 정수 x 를 구함", extra: "목표 평균 조건을 부등식으로 세우고 정수 최소값(올림)을 골라야 함 — medium 은 평균 계산까지",
      concepts: ["도수 막대그래프", "평균", "부등식과 정수 조건"],
      gen(rng) {
        for (let t = 0; t < 60; t++) {
          const s = makeBarFq(rng); const k = rng.int(2, 6); const m0 = Math.ceil(s.sum / s.N); const M = m0 + rng.int(1, 4);
          const need = M * (s.N + k) - s.sum; if (need % k === 0) continue; const x = Math.ceil(need / k); if (x > 999) continue;
          return gInst(rng, {
            stimulus: `${bfIntro(rng, s)} ${rng.pick(["Suppose", "Assume that", "Imagine that"])} ${k} more ${s.t.ent} join the group, each with the same whole-number value.`,
            question: rng.pick([`What is the least possible value, in ${s.t.unit}, for each new member so that the mean of all the values is at least ${M} ${s.t.unit}?`, `What is the smallest whole-number value, in ${s.t.unit}, that each new member could have so that the mean of the combined data is at least ${M} ${s.t.unit}?`]), correct: x,
            wrongs: pos([W(x - 1, "condition_ignored", "올림 대신 내림했다."), W(M, "step_missing", "목표 평균을 답했다."), W(need, "step_missing", "필요한 합을 k 로 나누지 않았다."), W(Math.ceil((M * s.N - s.sum) / k), "formula_misuse", "새 개수에 k 를 더하지 않았다."), W(x + 1, "other", "하나 더 올렸다.")]),
            verificationJs: figJs({ k, M }, s.fig, `${BF_JS}return Math.ceil((P.M * (N + P.k) - S) / P.k);`),
            trace: [bfRead(s), nStep(s), sumStep(s), [`조건: (${s.sum} + ${k}x) ÷ ${s.N + k} ≥ ${M} 이므로 ${k}x ≥ ${M * (s.N + k)} - ${s.sum} = ${need} 이다.`, "Set up the inequality for the mean."], [`x ≥ ${need} ÷ ${k} = ${fmtNum(need / k)} 이다.`, "Divide by the number of new members."], [`이를 만족하는 가장 작은 정수는 ${x} 이다.`, "Round up to a whole number."]], variant: "least_value_for_target_mean",
          }, s.fig);
        }
        throw new GenFail("param");
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "total_count", structure: "도수 막대그래프의 도수를 모두 더해 전체 개수를 구함", extra: "easy: 도수 합", concepts: ["도수 막대그래프", "전체 개수"],
      gen(rng) {
        const s = makeBarFq(rng);
        return gInst(rng, { stimulus: bfIntro(rng, s), question: rng.pick([`How many ${s.t.ent} are represented in the graph?`, `What is the total number of ${s.t.ent} in the group?`]), correct: s.N, wrongs: [W(s.vals.length, "axis_misread", "행의 개수를 셌다."), W(Math.max(...s.freqs), "step_missing", "가장 큰 도수만 읽었다."), W(s.N - s.freqs[0], "step_missing", "첫 행을 빠뜨렸다."), W(s.vals.reduce((a, b) => a + b, 0), "axis_misread", "값을 더했다."), W(s.N + 1, "other", "1 어긋났다.")], verificationJs: figJs({}, s.fig, `${BF_JS}return N;`), trace: [bfRead(s), nStep(s)], variant: "sum_frequencies" }, s.fig);
      },
    },
    {
      lv: "medium", name: "mean", structure: "도수 막대그래프에서 가중 합을 구해 개수로 나눠 평균을 구함", extra: "medium: 값×도수 합 ÷ 전체 개수", concepts: ["도수 막대그래프", "평균"],
      gen(rng) {
        const s = intMeanFq(rng); const m = s.sum / s.N; const plain = s.vals.reduce((a, b) => a + b, 0) / s.vals.length;
        return gInst(rng, { stimulus: bfIntro(rng, s), question: rng.pick([`What is the mean of the data, in ${s.t.unit}?`, `What is the mean value, in ${s.t.unit}, for these ${s.t.ent}?`]), correct: m, wrongs: [W(plain, "formula_misuse", "도수를 무시하고 값만 평균 냈다."), W(s.sum, "step_missing", "합을 개수로 나누지 않았다."), W(Math.round(s.sum / s.vals.length), "formula_misuse", "행 수로 나눴다."), W(m + 1, "other", "1 어긋났다."), W(m - 1, "other", "1 어긋났다.")], verificationJs: figJs({}, s.fig, `${BF_JS}return S / N;`), trace: [bfRead(s), nStep(s), sumStep(s), [`평균 = ${s.sum} ÷ ${s.N} = ${m} 이다.`, "Divide the sum by the count."]], variant: "weighted_mean" }, s.fig);
      },
    },
  ],
});
