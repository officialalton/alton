// one_variable_data.outlier_effect.BX.P — 상자그림에 이상치(극단값)가 더해질 때 범위·사분범위·이상치 기준이 어떻게 달라지는지 다룬다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { BX_JS, bxIntro, bxRead, makeBox, gInst, type BoxScene } from "../data-kit";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v >= 0);
const OUT_V = [
  "A value is called an outlier if it is greater than Q3 plus 1.5 times the interquartile range.",
  "In this course, a value counts as an outlier when it lies more than 1.5 times the interquartile range above Q3.",
  "Analysts treat a value as an outlier if it is above the third quartile by more than 1.5 times the interquartile range.",
  "Use this rule: a value is an outlier if it exceeds Q3 plus 1.5 times the interquartile range.",
];
const LEAD = ["", "A statistics class reviews a data set. ", "An analyst summarizes some measurements. ", "A teacher shows a plot to the class. ", "A report includes the plot below. "];
/** 상한 울타리 Q3 + 1.5 × IQR 가 정수인 장면(사분범위가 짝수). */
function evenIqr(rng: import("../../../rng").Rng): BoxScene { for (let t = 0; t < 200; t++) { const s = makeBox(rng); const b = s.boxes[0]; if ((b.q3 - b.q1) % 2 === 0) return s; } throw new GenFail("짝수 사분범위"); }

export const ITEM = defineItem({
  prefix: "ovd", itemId: "one_variable_data.outlier_effect.BX.P",
  hard: [
    {
      op: "chain2", structure: "상자그림의 최솟값을 읽고, 최댓값보다 훨씬 큰 새 값(이상치)이 더해진 뒤의 범위를 구함", extra: "새 값이 새 최댓값이 되어 범위가 크게 늘어남을 읽어 최솟값과 연결해야 함 — medium 은 원래 범위",
      concepts: ["상자그림", "이상치", "범위"],
      gen(rng) {
        const s = makeBox(rng); const b = s.boxes[0]; const x = b.max + s.s * rng.int(3, 20); const correct = x - b.min;
        return gInst(rng, {
          stimulus: `${rng.pick(LEAD)}${bxIntro(rng, s)} ${rng.pick([`A new value of ${x} ${s.t.unit}, which is much greater than the maximum shown, is added to the data.`, `One more value, ${x} ${s.t.unit}, is recorded and added to the data. It is much greater than the maximum in the plot.`])}`,
          question: rng.pick([`What is the range of the new data set, in ${s.t.unit}?`, `After the new value is added, what is the range, in ${s.t.unit}?`]), correct,
          wrongs: pos([W(b.max - b.min, "condition_ignored", "원래 범위를 답했다."), W(x - b.max, "formula_misuse", "새 값과 원래 최댓값의 차를 구했다."), W(x, "step_missing", "새 값을 답했다."), W(x - b.q1, "formula_misuse", "Q1 을 기준으로 뺐다."), W(correct - s.s, "other", "눈금 한 칸 어긋났다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({ x }, s.fig, `${BX_JS}const b=B[0]; if (P.x<=b.max) throw new Error('새 값이 최댓값 이하'); return P.x-b.min;`),
          trace: [bxRead(s), [`새 값 ${x} 는 원래 최댓값 ${b.max} 보다 크므로 새 최댓값이 된다.`, "The new value is the new maximum."], [`최솟값은 ${b.min} 그대로이다.`, "The minimum is unchanged."], [`새 범위 = ${x} - ${b.min} = ${correct} 이다.`, "Compute the new range."], [`따라서 범위는 ${correct} ${s.t.unit} 이다.`, "State the range."]], variant: "range_after_outlier",
        }, s.fig);
      },
    },
    {
      op: "compare_scenarios", structure: "이상치가 더해진 뒤 새 범위와 (변하지 않는) 사분범위의 차를 구함", extra: "이상치가 범위는 바꾸지만 사분범위에는 영향이 작다(이 문항에서는 변하지 않는다고 주어짐)는 점을 이용해 두 값을 비교해야 함 — medium 은 새 범위",
      concepts: ["상자그림", "이상치", "범위와 사분범위"],
      gen(rng) {
        const s = makeBox(rng); const b = s.boxes[0]; const x = b.max + s.s * rng.int(3, 20); const range = x - b.min, q = b.q3 - b.q1; const correct = range - q;
        return gInst(rng, {
          stimulus: `${rng.pick(LEAD)}${bxIntro(rng, s)} A new value of ${x} ${s.t.unit}, which is much greater than the maximum shown, is added to the data. ${rng.pick(["Assume the first and third quartiles of the data do not change.", "The first and third quartiles stay the same after the new value is added.", "Treat Q1 and Q3 as unchanged by the new value."])}`,
          question: rng.pick([`By how many ${s.t.unit} does the range of the new data set exceed its interquartile range?`, `What is the range of the new data minus its interquartile range, in ${s.t.unit}?`, `The range of the new data is how many ${s.t.unit} greater than its interquartile range?`, `Find the difference, in ${s.t.unit}, between the new range and the interquartile range.`]), correct,
          wrongs: pos([W(range, "step_missing", "범위만 답했다."), W(q, "step_missing", "사분범위만 답했다."), W((b.max - b.min) - q, "condition_ignored", "원래 범위로 계산했다."), W(range + q, "sign_error", "합을 구했다."), W(x - b.q3, "formula_misuse", "Q3 를 기준으로 뺐다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({ x }, s.fig, `${BX_JS}const b=B[0]; if (P.x<=b.max) throw new Error('새 값이 최댓값 이하'); return (P.x-b.min)-(b.q3-b.q1);`),
          trace: [bxRead(s), [`새 범위 = ${x} - ${b.min} = ${range} 이다.`, "The new range."], [`사분범위 = ${b.q3} - ${b.q1} = ${q} 이다. (변하지 않는다.)`, "The IQR is unchanged."], [`차 = ${range} - ${q} = ${correct} 이다.`, "Subtract."], [`따라서 범위가 사분범위보다 ${correct} ${s.t.unit} 더 크다.`, "State the difference."]], variant: "range_minus_iqr_after_outlier",
        }, s.fig);
      },
    },
    {
      op: "inverse", structure: "새 값이 더해져 범위가 d 만큼 늘었을 때, 최댓값을 읽어 새 값을 역산", extra: "범위의 증가량 = 새 값 − 원래 최댓값 임을 거꾸로 써야 함 — medium 은 새 범위",
      concepts: ["상자그림", "이상치", "역산"],
      gen(rng) {
        const s = makeBox(rng); const b = s.boxes[0]; const d = s.s * rng.int(3, 20); const x = b.max + d;
        return gInst(rng, {
          stimulus: `${rng.pick(LEAD)}${bxIntro(rng, s)} A new value that is greater than the maximum shown is added to the data, and the range of the data increases by ${d} ${s.t.unit}.`,
          question: rng.pick([`What is the new value, in ${s.t.unit}?`, `What value was added, in ${s.t.unit}?`]), correct: x,
          wrongs: pos([W(d, "step_missing", "증가량을 그대로 답했다."), W(b.min + d, "formula_misuse", "최솟값에 더했다."), W(b.q3 + d, "formula_misuse", "Q3 에 더했다."), W(x - s.s, "other", "눈금 한 칸 어긋났다."), W(b.max - b.min + d, "formula_misuse", "범위에 더했다.")]).filter((w) => w.v !== x),
          verificationJs: figJs({ d }, s.fig, `${BX_JS}return B[0].max+P.d;`),
          trace: [bxRead(s), [`새 값이 새 최댓값이므로 범위의 증가량 = 새 값 - ${b.max} 이다.`, "The range grows by (new value − old maximum)."], [`새 값 = ${b.max} + ${d} = ${x} 이다.`, "Solve for the new value."], [`확인: 새 범위 = ${x} - ${b.min} = ${x - b.min} 이다.`, "Check with the new range."], [`따라서 더해진 값은 ${x} ${s.t.unit} 이다.`, "State the added value."]], variant: "new_value_from_range_increase",
        }, s.fig);
      },
    },
    {
      op: "constraint_select", structure: "이상치 기준(Q3 + 1.5 × 사분범위)을 계산해, 이상치가 되는 가장 작은 정수 값을 구함", extra: "Q1·Q3 를 읽어 울타리를 세우고 '보다 크다'(초과) 경계에서 정수로 올림해야 함 — medium 은 울타리 값",
      concepts: ["상자그림", "이상치 기준", "정수 조건"],
      gen(rng) {
        const s = evenIqr(rng); const b = s.boxes[0]; const q = b.q3 - b.q1; const fence = b.q3 + (3 * q) / 2; const x = Math.floor(fence) + 1;
        return gInst(rng, {
          stimulus: `${rng.pick(LEAD)}${bxIntro(rng, s)} ${rng.pick(OUT_V)}`,
          question: rng.pick([`What is the least whole-number value, in ${s.t.unit}, that would be an outlier?`, `What is the smallest whole number of ${s.t.unit} that is an outlier for this data?`]), correct: x,
          wrongs: pos([W(fence, "condition_ignored", "'초과' 를 '이상' 으로 보았다."), W(b.q3 + q, "formula_misuse", "1.5 배 대신 1 배로 계산했다."), W(b.max + 1, "step_missing", "최댓값만 보고 답했다."), W(b.q3 + 2 * q, "formula_misuse", "2 배로 계산했다."), W(x + 1, "other", "하나 더 올렸다.")]).filter((w) => w.v !== x),
          verificationJs: figJs({}, s.fig, `${BX_JS}const b=B[0]; const f=b.q3+1.5*(b.q3-b.q1); return Math.floor(f)+1;`),
          trace: [bxRead(s), [`사분범위 = ${b.q3} - ${b.q1} = ${q} 이다.`, "Compute the IQR."], [`울타리 = ${b.q3} + 1.5 × ${q} = ${fence} 이다.`, "Upper fence."], [`울타리보다 큰 가장 작은 정수는 ${x} 이다.`, "Greater than the fence: the next whole number."], [`따라서 ${x} ${s.t.unit} 이다.`, "State the value."]], variant: "least_outlier_value",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "read_q3", structure: "상자그림에서 제3사분위수(Q3, 상자의 오른쪽 끝)를 읽음", extra: "easy: Q3 읽기", concepts: ["상자그림", "사분위수"],
      gen(rng) {
        const s = makeBox(rng); const b = s.boxes[0];
        return gInst(rng, { stimulus: bxIntro(rng, s), question: rng.pick([`What is the third quartile of the data, in ${s.t.unit}?`, `According to the plot, what is Q3, in ${s.t.unit}?`]), correct: b.q3, wrongs: pos([W(b.q1, "axis_misread", "Q1 을 읽었다."), W(b.median, "axis_misread", "중앙값을 읽었다."), W(b.max, "axis_misread", "최댓값을 읽었다."), W(b.q3 - s.s, "axis_misread", "눈금 한 칸 어긋나게 읽었다.")]).filter((w) => w.v !== b.q3), verificationJs: figJs({}, s.fig, `${BX_JS}return B[0].q3;`), trace: [bxRead(s), [`상자의 오른쪽 끝이 Q3 = ${b.q3} 이다.`, "The right edge of the box is Q3."]], variant: "read_q3_edge",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "upper_fence", structure: "이상치 기준(Q3 + 1.5 × 사분범위)의 값을 구함", extra: "medium: Q3 + 1.5×IQR", concepts: ["상자그림", "이상치 기준"],
      gen(rng) {
        const s = evenIqr(rng); const b = s.boxes[0]; const q = b.q3 - b.q1; const fence = b.q3 + (3 * q) / 2;
        return gInst(rng, { stimulus: `${rng.pick(LEAD)}${bxIntro(rng, s)} ${rng.pick(OUT_V)}`, question: rng.pick([`Values greater than what number, in ${s.t.unit}, are outliers?`, `What is the cutoff, in ${s.t.unit}, above which a value is an outlier?`]), correct: fence, wrongs: pos([W(b.q3 + q, "formula_misuse", "1.5 배 대신 1 배로 계산했다."), W(b.q3, "step_missing", "Q3 를 답했다."), W(b.max, "axis_misread", "최댓값을 답했다."), W(fence + s.s, "other", "눈금 한 칸 어긋났다.")]).filter((w) => w.v !== fence), verificationJs: figJs({}, s.fig, `${BX_JS}const b=B[0]; return b.q3+1.5*(b.q3-b.q1);`), trace: [bxRead(s), [`사분범위 = ${b.q3} - ${b.q1} = ${q} 이다.`, "Compute the IQR."], [`기준 = ${b.q3} + 1.5 × ${q} = ${fence} 이다.`, "Compute the cutoff."]], variant: "upper_fence_value",
        }, s.fig);
      },
    },
  ],
});
