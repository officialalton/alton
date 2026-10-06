// one_variable_data.quartile_percentile_from_plot.BX.P — 상자그림의 사분위 위치를 백분율·개수로 해석한다(네 구간에 같은 개수).
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { BX_JS, bxIntro, bxRead, makeBox, gInst } from "../data-kit";

const KEYS = ["min", "q1", "median", "q3", "max"] as const;
const NAME = ["minimum", "first quartile", "median", "third quartile", "maximum"];
const SEC = [
  "The five summary values split the data into four sections, and every one of the four sections contains the same number of values.",
  "The plot is divided into four sections by the minimum, the first quartile (Q1), the median, the third quartile (Q3), and the maximum. Each section contains the same number of values.",
  "Assume that the four sections of the plot, which are separated by the five summary values, each hold the same number of values.",
];
const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v >= 0);
const idxPair = (rng: import("../../../rng").Rng, minGap = 1): [number, number] => { for (;;) { const i = rng.int(0, 3), j = rng.int(i + minGap, 4); if (j <= 4) return [i, j]; } };

export const ITEM = defineItem({
  prefix: "ovd", itemId: "one_variable_data.quartile_percentile_from_plot.BX.P",
  hard: [
    {
      op: "chain2", structure: "상자그림에서 주어진 값이 몇 번째 다섯 수인지 읽고, 그 값보다 큰 값의 백분율을 구간 수로 구함", extra: "값의 위치(Q1·중앙값·Q3)를 찾아 위쪽 구간 수 × 25% 로 연결해야 함 — medium 은 한 구간의 백분율",
      concepts: ["상자그림", "사분위", "백분율"],
      gen(rng) {
        const s = makeBox(rng); const b = s.boxes[0]; const i = rng.int(1, 3); const v = b[KEYS[i]]; const correct = (4 - i) * 25;
        return gInst(rng, {
          stimulus: `${bxIntro(rng, s)} ${rng.pick(SEC)}`,
          question: rng.pick([`What percent of the values are greater than ${v} ${s.t.unit}?`, `About what percent of the data lie above ${v} ${s.t.unit}? (Use the sections of the plot.)`]), correct,
          wrongs: pos([W(i * 25, "opposite", "아래쪽 백분율을 답했다."), W(25, "step_missing", "한 구간의 백분율만 답했다."), W(((4 - i) * 25) + 25, "other", "구간 하나를 더 셌다."), W(100 - (4 - i) * 25 + 25, "other", "구간 수를 잘못 셌다."), W(v, "axis_misread", "값을 그대로 답했다.")]).filter((w) => w.v !== correct && w.v <= 100),
          verificationJs: figJs({ v }, s.fig, `${BX_JS}const b=B[0]; const i=K.findIndex(k=>b[k]===P.v); if (i<1||i>3) throw new Error('Q1·중앙값·Q3 가 아님'); return (4-i)*25;`),
          trace: [bxRead(s), [`${v} 는 ${NAME[i]} 이다.`, "Identify the summary value."], [`${NAME[i]} 보다 위에는 ${4 - i} 개 구간이 있다.`, "Count the sections above."], [`${4 - i} × 25% = ${correct}% 이다.`, "Each section is 25% of the data."], [`따라서 ${correct}% 이다.`, "State the percent."]], variant: "percent_above_summary_value",
        }, s.fig);
      },
    },
    {
      op: "compare_scenarios", structure: "전체 N 개 중 두 요약 값 사이의 개수와, 한 구간의 개수를 비교해 차를 구함", extra: "두 값의 위치를 읽어 구간 수를 세고 한 구간의 개수와 비교해야 함 — medium 은 한 구간의 개수",
      concepts: ["상자그림", "사분위", "개수 비교"],
      gen(rng) {
        const s = makeBox(rng); const b = s.boxes[0]; const N = 4 * rng.int(6, 40); const [i, j] = idxPair(rng, 2); const between = ((j - i) * N) / 4; const correct = between - N / 4;
        return gInst(rng, {
          stimulus: `${bxIntro(rng, s)} ${rng.pick(SEC)} The data set has ${N} values.`,
          question: rng.pick([`How many more values lie between ${b[KEYS[i]]} ${s.t.unit} and ${b[KEYS[j]]} ${s.t.unit} than lie in a single section of the plot?`, `The part of the plot from ${b[KEYS[i]]} ${s.t.unit} to ${b[KEYS[j]]} ${s.t.unit} holds how many more values than one section?`]), correct,
          wrongs: pos([W(between, "step_missing", "구간 수 합만 답했다."), W(N / 4, "step_missing", "한 구간만 답했다."), W(between + N / 4, "sign_error", "차 대신 합을 구했다."), W(((j - i + 1) * N) / 4 - N / 4, "other", "구간 수를 하나 더 셌다."), W(correct + 4, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({ N, v1: b[KEYS[i]], v2: b[KEYS[j]] }, s.fig, `${BX_JS}const b=B[0]; const i=K.findIndex(k=>b[k]===P.v1), j=K.findIndex(k=>b[k]===P.v2); if (i<0||j<0||j-i<2) throw new Error('값이 다섯 수가 아님'); return (j-i)*P.N/4-P.N/4;`),
          trace: [bxRead(s), [`${b[KEYS[i]]} 는 ${NAME[i]}, ${b[KEYS[j]]} 는 ${NAME[j]} 이므로 사이에 ${j - i} 개 구간이 있다.`, "Count the sections between them."], [`그 구간의 값 = ${j - i} × ${N / 4} = ${between} 이다.`, "Values between them."], [`한 구간의 값은 ${N / 4} 이므로 차 = ${between} - ${N / 4} = ${correct} 이다.`, "Subtract one section."], [`따라서 ${correct} 개 더 많다.`, "State the difference."]], variant: "between_values_minus_one_section",
        }, s.fig);
      },
    },
    {
      op: "inverse", structure: "어떤 요약 값보다 위에 K 개의 값이 있다고 주어질 때, 그 값의 위치를 읽어 전체 개수를 역산", extra: "위쪽 구간 수를 읽어 한 구간의 개수 = K ÷ 구간 수, 전체 = 4 × 한 구간 임을 거꾸로 써야 함 — medium 은 한 구간의 개수",
      concepts: ["상자그림", "사분위", "전체 개수 역산"],
      gen(rng) {
        const s = makeBox(rng); const b = s.boxes[0]; const i = rng.int(1, 3); const secs = 4 - i; const q = rng.int(3, 20); const K = secs * q; const correct = 4 * q;
        return gInst(rng, {
          stimulus: `${bxIntro(rng, s)} ${rng.pick(SEC)} There are ${K} values greater than ${b[KEYS[i]]} ${s.t.unit}.`,
          question: rng.pick([`How many values are in the whole data set?`, `What is the total number of values represented by the plot?`]), correct,
          wrongs: pos([W(K, "step_missing", "위쪽 개수를 답했다."), W(K * secs, "formula_misuse", "구간 수를 곱했다."), W(4 * K, "formula_misuse", "구간 수를 무시하고 4 배 했다."), W(K + q, "other", "구간 하나를 더 셌다."), W(correct + 4, "other", "한 구간 어긋났다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({ K, v: b[KEYS[i]] }, s.fig, `${BX_JS}const b=B[0]; const i=K_ARR.findIndex(k=>b[k]===P.v); if (i<1||i>3) throw new Error('Q1·중앙값·Q3 가 아님'); return 4*P.K/(4-i);`.replace("K_ARR", "K")),
          trace: [bxRead(s), [`${b[KEYS[i]]} 는 ${NAME[i]} 이므로 그 위에는 ${secs} 개 구간이 있다.`, "Count the sections above the value."], [`한 구간의 개수 = ${K} ÷ ${secs} = ${q} 이다.`, "Values per section."], [`전체 = 4 × ${q} = ${correct} 이다.`, "Four sections in all."], [`따라서 자료의 개수는 ${correct} 이다.`, "State the total."]], variant: "total_from_values_above",
        }, s.fig);
      },
    },
    {
      op: "compose_kind", structure: "전체 N 개 중 두 요약 값의 바깥(아래쪽 + 위쪽)에 있는 값의 개수를 구함", extra: "한쪽이 아니라 바깥 두 부분의 구간 수를 합쳐 세는 합성 — medium 은 한쪽 개수",
      concepts: ["상자그림", "사분위", "개수 합성"],
      gen(rng) {
        const s = makeBox(rng); const b = s.boxes[0]; const N = 4 * rng.int(6, 40); const [i, j] = idxPair(rng, 1); if (i === 0 && j === 4) throw new GenFail("전체"); const secs = i + (4 - j); const correct = (secs * N) / 4;
        return gInst(rng, {
          stimulus: `${bxIntro(rng, s)} ${rng.pick(SEC)} The data set has ${N} values.`,
          question: rng.pick([`How many of the values are less than ${b[KEYS[i]]} ${s.t.unit} or greater than ${b[KEYS[j]]} ${s.t.unit}?`, `How many values lie outside the part of the plot from ${b[KEYS[i]]} ${s.t.unit} to ${b[KEYS[j]]} ${s.t.unit}?`]), correct,
          wrongs: pos([W(((j - i) * N) / 4, "opposite", "안쪽 개수를 답했다."), W((i * N) / 4, "step_missing", "아래쪽만 셌다."), W(((4 - j) * N) / 4, "step_missing", "위쪽만 셌다."), W(N, "condition_ignored", "전체를 답했다."), W(correct + N / 4, "other", "구간 하나를 더 셌다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({ N, v1: b[KEYS[i]], v2: b[KEYS[j]] }, s.fig, `${BX_JS}const b=B[0]; const i=K.findIndex(k=>b[k]===P.v1), j=K.findIndex(k=>b[k]===P.v2); if (i<0||j<0||j<=i) throw new Error('값이 다섯 수가 아님'); return (i+(4-j))*P.N/4;`),
          trace: [bxRead(s), [`${b[KEYS[i]]} 는 ${NAME[i]}, ${b[KEYS[j]]} 는 ${NAME[j]} 이다.`, "Identify the two summary values."], [`아래쪽 ${i} 개 구간 + 위쪽 ${4 - j} 개 구간 = ${secs} 개 구간이다.`, "Count the outside sections."], [`${secs} × ${N / 4} = ${correct} 이다.`, "Multiply by the section size."], [`따라서 ${correct} 개이다.`, "State the count."]], variant: "values_outside_two_summary_points",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "percent_below_median", structure: "중앙값 아래에 있는 값의 백분율을 구함", extra: "easy: 중앙값 = 50%", concepts: ["상자그림", "중앙값", "백분율"],
      gen(rng) {
        const s = makeBox(rng); const b = s.boxes[0];
        return gInst(rng, { stimulus: `${bxIntro(rng, s)} ${rng.pick(SEC)}`, question: `What percent of the values are less than ${b.median} ${s.t.unit}?`, correct: 50, wrongs: [W(25, "other", "한 구간만 셌다."), W(75, "other", "세 구간을 셌다."), W(b.median, "axis_misread", "값을 그대로 답했다."), W(100, "other", "전체를 답했다.")], verificationJs: figJs({ v: b.median }, s.fig, `${BX_JS}const b=B[0]; if (b.median!==P.v) throw new Error('중앙값이 아님'); return 50;`), trace: [bxRead(s), [`${b.median} 는 중앙값이다.`, "It is the median."], [`중앙값 아래에는 2 개 구간(50%)이 있다.`, "Two of the four sections lie below it."]], variant: "percent_below_median",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "count_in_section", structure: "한 구간(예: Q1 에서 중앙값까지)에 든 값의 개수를 구함", extra: "medium: 전체 ÷ 4", concepts: ["상자그림", "사분위", "개수"],
      gen(rng) {
        const s = makeBox(rng); const b = s.boxes[0]; const N = 4 * rng.int(6, 40); const i = rng.int(0, 3); const correct = N / 4;
        return gInst(rng, { stimulus: `${bxIntro(rng, s)} ${rng.pick(SEC)} The data set has ${N} values.`, question: `How many values lie between ${b[KEYS[i]]} ${s.t.unit} and ${b[KEYS[i + 1]]} ${s.t.unit}?`, correct, wrongs: pos([W(N / 2, "other", "두 구간을 셌다."), W(N, "step_missing", "전체를 답했다."), W(N / 3, "other", "3 등분으로 보았다."), W(correct + 4, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== correct), verificationJs: figJs({ N, v1: b[KEYS[i]], v2: b[KEYS[i + 1]] }, s.fig, `${BX_JS}const b=B[0]; const i=K.findIndex(k=>b[k]===P.v1), j=K.findIndex(k=>b[k]===P.v2); if (i<0||j!==i+1) throw new Error('이웃한 요약 값이 아님'); return P.N/4;`), trace: [bxRead(s), [`${b[KEYS[i]]} 와 ${b[KEYS[i + 1]]} 는 이웃한 요약 값이므로 한 구간이다.`, "Adjacent summary values bound one section."], [`${N} ÷ 4 = ${correct} 이다.`, "Divide by four."]], variant: "count_in_one_section",
        }, s.fig);
      },
    },
  ],
});
