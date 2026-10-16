// one_variable_data.outlier_effect.DP.P — 점도표에 훨씬 큰 값(이상치)이 더해질 때 범위·중앙값·평균이 어떻게 달라지는지 다룬다.
import { GenFail } from "../../../types";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { DP_JS, dpIntro, dpRead, makeDot, medianOfList, expand, gInst } from "../data-kit";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v >= 0);
const LEAD = ["", "A statistics class reviews a data set. ", "An analyst summarizes some measurements. ", "A teacher shows a plot to the class. "];

export const ITEM = defineItem({
  prefix: "ovd", itemId: "one_variable_data.outlier_effect.DP.P",
  hard: [
    {
      op: "chain2", structure: "점도표의 최솟값을 읽고, 최댓값보다 훨씬 큰 새 값(이상치)이 더해진 뒤의 범위를 구함", extra: "새 값이 새 최댓값이 되어 범위가 크게 늘어남을 읽어 최솟값과 연결해야 함 — medium 은 원래 범위",
      concepts: ["점도표", "이상치", "범위"],
      gen(rng) {
        const s = makeDot(rng); const mn = s.vals[0], mx = s.vals[s.vals.length - 1]; const x = mx + s.t.step * rng.int(3, 14); const correct = x - mn;
        return gInst(rng, {
          stimulus: `${rng.pick(LEAD)}${dpIntro(rng, s)} ${rng.pick([`A new value of ${x} ${s.t.unit}, much greater than every dot in the plot, is added to the data.`, `One more value, ${x} ${s.t.unit}, is recorded. It is much greater than the rightmost dot.`])}`,
          question: rng.pick([`What is the range of the new data set, in ${s.t.unit}?`, `After the new value is added, what is the range, in ${s.t.unit}?`]), correct,
          wrongs: pos([W(mx - mn, "condition_ignored", "원래 범위를 답했다."), W(x - mx, "formula_misuse", "새 값과 원래 최댓값의 차를 구했다."), W(x, "step_missing", "새 값을 답했다."), W(x - s.vals[1], "formula_misuse", "둘째 값을 기준으로 뺐다."), W(correct - s.t.step, "other", "눈금 한 칸 어긋났다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({ x }, s.fig, `${DP_JS}const mn=Math.min(...vals), mx=Math.max(...vals); if (P.x<=mx) throw new Error('새 값이 최댓값 이하'); return P.x-mn;`),
          trace: [dpRead(s), [`최솟값 ${mn}, 최댓값 ${mx} 이다.`, "Read the extremes."], [`새 값 ${x} 가 새 최댓값이 된다.`, "The new value is the new maximum."], [`새 범위 = ${x} - ${mn} = ${correct} 이다.`, "Compute the new range."], [`따라서 범위는 ${correct} ${s.t.unit} 이다.`, "State the range."]], variant: "range_after_outlier_dot",
        }, s.fig);
      },
    },
    {
      op: "compare_scenarios", structure: "이상치가 더해지기 전후의 중앙값 변화(새 중앙값 − 원래 중앙값)를 구함", extra: "점 하나가 더해지면 중앙값 위치가 한 칸 옮겨지므로 정렬된 목록에서 두 중앙값을 각각 구해 비교해야 함(평균처럼 크게 움직이지 않음) — medium 은 원래 중앙값",
      concepts: ["점도표", "이상치", "중앙값"],
      gen(rng) {
        const s = makeDot(rng); const list = expand(s); const mx = s.vals[s.vals.length - 1]; const x = mx + s.t.step * rng.int(3, 14); const m0 = medianOfList(list), m1 = medianOfList([...list, x]); const correct = m1 - m0;
        return gInst(rng, {
          stimulus: `${rng.pick(LEAD)}${dpIntro(rng, s)} A new value of ${x} ${s.t.unit}, much greater than every dot in the plot, is added to the data.`,
          question: rng.pick([`By how many ${s.t.unit} does the median of the data increase after the new value is added?`, `What is the new median minus the original median, in ${s.t.unit}?`]), correct, fmt: fmtNum,
          wrongs: pos([W(Math.round(((s.sum + x) / (list.length + 1) - s.sum / list.length) * 100) / 100, "formula_misuse", "평균의 증가량을 구했다."), W(m1, "step_missing", "새 중앙값만 답했다."), W(m0, "step_missing", "원래 중앙값만 답했다."), W(x - mx, "formula_misuse", "새 값과 최댓값의 차를 구했다."), W(correct + s.t.step, "other", "눈금 한 칸 어긋났다.")]).filter((w) => Math.abs(w.v - correct) > 1e-9),
          verificationJs: figJs({ x }, s.fig, `${DP_JS}const md=(l)=>{const q=[...l].sort((a,b)=>a-b); const n=q.length; return n%2?q[(n-1)/2]:(q[n/2-1]+q[n/2])/2;}; if (P.x<=Math.max(...vals)) throw new Error('새 값이 최댓값 이하'); return md([...list,P.x])-md(list);`),
          trace: [dpRead(s), [`원래 자료 ${list.length} 개의 중앙값 = ${fmtNum(m0)} 이다.`, "Original median."], [`새 값을 더하면 ${list.length + 1} 개이고 중앙값 = ${fmtNum(m1)} 이다.`, "New median."], [`변화 = ${fmtNum(m1)} - ${fmtNum(m0)} = ${fmtNum(correct)} 이다.`, "Subtract."], [`이상치가 평균은 크게 움직여도 중앙값은 조금만 움직인다.`, "The median is resistant to outliers."]], variant: "median_shift_after_outlier",
        }, s.fig);
      },
    },
    {
      op: "inverse", structure: "새 값이 더해진 뒤의 평균이 M 으로 주어질 때, 합과 개수를 구해 새 값을 역산", extra: "새 합 = M × (개수 + 1) 에서 원래 합을 빼 새 값을 거꾸로 구해야 함 — medium 은 평균",
      concepts: ["점도표", "평균", "역산"],
      gen(rng) {
        for (let t = 0; t < 120; t++) {
          const s = makeDot(rng); const mx = s.vals[s.vals.length - 1]; const x = mx + s.t.step * rng.int(3, 14); if ((s.sum + x) % (s.N + 1) !== 0) continue; const M = (s.sum + x) / (s.N + 1);
          return gInst(rng, {
            stimulus: `${rng.pick(LEAD)}${dpIntro(rng, s)} One new value, much greater than every dot in the plot, is added to the data, and the mean of the new data is ${M} ${s.t.unit}.`,
            question: rng.pick([`What is the new value, in ${s.t.unit}?`, `What value was added, in ${s.t.unit}?`]), correct: x,
            wrongs: pos([W(M, "step_missing", "새 평균을 그대로 답했다."), W(M * (s.N + 1) - s.sum + s.t.step, "other", "눈금 한 칸 어긋났다."), W(M * s.N - s.sum, "formula_misuse", "새 개수에 1 을 더하지 않았다."), W(Math.round(s.sum / s.N), "step_missing", "원래 평균을 답했다."), W(x - s.t.step, "other", "눈금 한 칸 어긋났다.")]).filter((w) => w.v !== x),
            verificationJs: figJs({ M }, s.fig, `${DP_JS}const x=P.M*(N+1)-S; if (x<=Math.max(...vals)) throw new Error('새 값이 최댓값 이하'); return x;`),
            trace: [dpRead(s), [`원래 개수 ${s.N}, 합 ${s.sum} 이다.`, "Original count and sum."], [`새 개수 = ${s.N + 1}, 새 합 = ${M} × ${s.N + 1} = ${M * (s.N + 1)} 이다.`, "New count and sum."], [`새 값 = ${M * (s.N + 1)} - ${s.sum} = ${x} 이다.`, "Subtract the original sum."], [`따라서 더해진 값은 ${x} ${s.t.unit} 이다.`, "State the new value."]], variant: "new_value_from_new_mean",
          }, s.fig);
        }
        throw new GenFail("inverse");
      },
    },
    {
      op: "constraint_select", structure: "새 값(정수)이 더해진 뒤 평균이 T 이상이 되는 가장 작은 새 값을 구함", extra: "새 합 ≥ T × (개수 + 1) 를 세워 부등식을 풀고 정수로 올림해야 함 — medium 은 평균",
      concepts: ["점도표", "평균", "부등식과 정수 조건"],
      gen(rng) {
        for (let t = 0; t < 120; t++) {
          const s = makeDot(rng); const mx = s.vals[s.vals.length - 1]; const base = Math.ceil(s.sum / s.N); const T = base + rng.int(1, 6); const need = T * (s.N + 1) - s.sum; if (need <= mx || need > 999) continue; const exact = need; // 정수 T 이면 필요한 합이 정수
          return gInst(rng, {
            stimulus: `${rng.pick(LEAD)}${dpIntro(rng, s)} One new whole-number value, greater than every dot in the plot, is added to the data.`,
            question: rng.pick([`What is the least whole-number value, in ${s.t.unit}, that could be added so that the mean of the new data is at least ${T} ${s.t.unit}?`, `For the mean of the new data to be at least ${T} ${s.t.unit}, what is the smallest possible whole-number value of the added value, in ${s.t.unit}?`]), correct: exact,
            wrongs: pos([W(exact - 1, "condition_ignored", "경계를 놓쳤다."), W(T, "step_missing", "목표 평균을 답했다."), W(T * s.N - s.sum, "formula_misuse", "새 개수에 1 을 더하지 않았다."), W(exact + 1, "other", "하나 더 올렸다."), W(Math.ceil((T * (s.N + 1) - s.sum) / 2), "formula_misuse", "2 로 나눴다.")]).filter((w) => w.v !== exact),
            verificationJs: figJs({ T }, s.fig, `${DP_JS}const need=P.T*(N+1)-S; const x=Math.ceil(need); if (x<=Math.max(...vals)) throw new Error('새 값이 최댓값 이하'); return x;`),
            trace: [dpRead(s), [`원래 개수 ${s.N}, 합 ${s.sum} 이다.`, "Original count and sum."], [`(${s.sum} + x) ÷ ${s.N + 1} ≥ ${T} 이므로 x ≥ ${T} × ${s.N + 1} - ${s.sum} = ${need} 이다.`, "Set up the inequality for the mean."], [`${need} 는 원래 최댓값 ${mx} 보다 크므로 조건에 맞는다.`, "It exceeds the old maximum."], [`따라서 가장 작은 정수는 ${exact} 이다.`, "Least whole number."]], variant: "least_value_for_target_mean",
          }, s.fig);
        }
        throw new GenFail("constraint");
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "total_count", structure: "점도표의 점을 모두 세어 전체 개수를 구함", extra: "easy: 점 개수 합", concepts: ["점도표", "개수"],
      gen(rng) {
        const s = makeDot(rng);
        return gInst(rng, { stimulus: dpIntro(rng, s), question: rng.pick([`How many ${s.t.ent} are represented in the dot plot?`, `What is the total number of dots in the plot?`]), correct: s.N, wrongs: pos([W(s.vals.length, "axis_misread", "점이 있는 값의 종류 수를 셌다."), W(Math.max(...s.freqs), "step_missing", "가장 높은 쌓임만 답했다."), W(s.N - s.freqs[0], "step_missing", "첫 열을 빠뜨렸다."), W(s.N + 1, "other", "하나 더 셌다.")]).filter((w) => w.v !== s.N), verificationJs: figJs({}, s.fig, `${DP_JS}return N;`), trace: [dpRead(s), [`점의 수를 모두 더하면 ${s.freqs.join(" + ")} = ${s.N} 이다.`, "Add the dots."]], variant: "count_dots",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "mean", structure: "점도표의 값을 모두 더해 개수로 나눠 평균을 구함", extra: "medium: 합 ÷ 개수", concepts: ["점도표", "평균"],
      gen(rng) {
        for (let t = 0; t < 120; t++) { const s = makeDot(rng); if (s.sum % s.N !== 0) continue; const m = s.sum / s.N;
          return gInst(rng, { stimulus: dpIntro(rng, s), question: rng.pick([`What is the mean of the data, in ${s.t.unit}?`, `What is the mean value, in ${s.t.unit}, for these ${s.t.ent}?`]), correct: m, wrongs: pos([W(Math.round(s.vals.reduce((a, b) => a + b, 0) / s.vals.length), "formula_misuse", "점 개수를 무시하고 값만 평균 냈다."), W(s.sum, "step_missing", "합을 개수로 나누지 않았다."), W(s.vals[Math.floor((s.vals.length - 1) / 2)], "formula_misuse", "가운데 열의 값을 답했다."), W(m + s.t.step, "other", "눈금 한 칸 어긋났다.")]).filter((w) => w.v !== m), verificationJs: figJs({}, s.fig, `${DP_JS}return S/N;`), trace: [dpRead(s), [`합 = ${s.vals.map((v, i) => `${v}×${s.freqs[i]}`).join(" + ")} = ${s.sum} 이다.`, "Weighted sum."], [`평균 = ${s.sum} ÷ ${s.N} = ${m} 이다.`, "Divide by the count."]], variant: "mean_from_dots",
          }, s.fig); }
        throw new GenFail("mean");
      },
    },
  ],
});
