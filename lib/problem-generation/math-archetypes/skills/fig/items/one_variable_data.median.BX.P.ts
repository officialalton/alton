// one_variable_data.median.BX.P — 상자그림의 다섯 수 요약에서 중앙값·사분위 위치를 읽고, 구간별 개수(네 구간에 같은 개수)·두 집단 비교·자료 변환으로 확장한다.
import { GenFail } from "../../../types";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { BX_JS, bxIntro, bxIntro2, bxRead, makeBox, gInst, type BoxScene } from "../data-kit";

const KEYS = ["min", "q1", "median", "q3", "max"] as const;
const NAME = ["minimum", "first quartile", "median", "third quartile", "maximum"];
const val = (b: BoxScene["boxes"][number], k: number) => b[KEYS[k]];
const SEC = [
  "The plot is divided into four sections by the minimum, the first quartile (Q1), the median, the third quartile (Q3), and the maximum. Each section contains the same number of values.",
  "Assume that the four sections of the plot, which are separated by the minimum, Q1, the median, Q3, and the maximum, each hold the same number of values.",
  "The five summary values split the data into four sections, and every one of the four sections contains the same number of values.",
  "Each of the four parts of the plot that lie between consecutive summary values (the minimum, Q1, the median, Q3, the maximum) contains an equal number of values.",
];
const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v >= 0);
/** 두 다섯 수 위치(i<j, j-i ≥ 2)를 고른다. */
const pairIJ = (rng: import("../../../rng").Rng, minGap = 2): [number, number] => { for (;;) { const i = rng.int(0, 3), j = rng.int(i + minGap, 4); if (j <= 4) return [i, j]; } };

export const ITEM = defineItem({
  prefix: "ovd", itemId: "one_variable_data.median.BX.P",
  hard: [
    {
      op: "chain2", structure: "상자그림에서 두 수(다섯 수 중 둘)의 위치를 읽고, 그 사이 구간들에 든 값의 개수를 구간 수 × (전체 ÷ 4) 로 구함", extra: "다섯 수의 이름(Q1·중앙값·Q3)과 위치를 읽고 구간 수를 세어 전체의 몇 분의 몇인지 연쇄로 계산 — medium 은 한 구간의 개수",
      concepts: ["상자그림", "사분위", "구간별 개수"],
      gen(rng) {
        const s = makeBox(rng); const b = s.boxes[0]; const N = 4 * rng.int(6, 40); const [i, j] = pairIJ(rng); const secs = j - i; const correct = (secs * N) / 4;
        return gInst(rng, {
          stimulus: `${bxIntro(rng, s)} ${rng.pick(SEC)} The data set has ${N} values.`,
          question: rng.pick([`How many of the values lie in the part of the plot from ${val(b, i)} to ${val(b, j)} ${s.t.unit}?`, `How many values are in the sections of the plot between ${val(b, i)} ${s.t.unit} and ${val(b, j)} ${s.t.unit}?`, `Between ${val(b, i)} ${s.t.unit} and ${val(b, j)} ${s.t.unit} on the plot, how many of the values are there?`, `The values from ${val(b, i)} ${s.t.unit} up to ${val(b, j)} ${s.t.unit} make up how many of the ${N} values?`]), correct,
          wrongs: pos([W(N / 4, "step_missing", "한 구간의 개수만 답했다."), W(N / 2 === correct ? (3 * N) / 4 : N / 2, "formula_misuse", "구간 수를 잘못 셌다."), W(N, "condition_ignored", "전체 개수를 답했다."), W(((secs + 1) * N) / 4, "other", "구간 수를 하나 더 셌다."), W(((secs - 1) * N) / 4, "other", "구간 수를 하나 덜 셌다."), W(val(b, j) - val(b, i), "axis_misread", "두 값의 차를 답했다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({ N, v1: val(b, i), v2: val(b, j) }, s.fig, `${BX_JS}const b=B[0]; const i=K.findIndex(k=>b[k]===P.v1), j=K.findIndex(k=>b[k]===P.v2); if (i<0||j<0||j<=i) throw new Error('값이 다섯 수가 아님'); return (j-i)*P.N/4;`),
          trace: [bxRead(s), [`${val(b, i)} 는 ${NAME[i]}, ${val(b, j)} 는 ${NAME[j]} 이다.`, "Identify the two summary values."], [`두 값 사이에는 ${secs} 개 구간이 있고, 한 구간에는 ${N} ÷ 4 = ${N / 4} 개가 있다.`, "Count the sections between them."], [`${secs} × ${N / 4} = ${correct} 이다.`, "Multiply."], [`따라서 그 구간에는 ${correct} 개의 값이 있다.`, "State the count."]], variant: "values_between_two_summary_points",
        }, s.fig);
      },
    },
    {
      op: "compare_scenarios", structure: "두 집단의 상자그림에서 각 중앙값을 읽어 차를 구함", extra: "두 상자의 중앙값 선(상자 안의 굵은 선)을 같은 눈금에서 읽어 비교해야 함(상자의 폭·꼬리와 혼동하는 함정) — medium 은 한 집단의 중앙값",
      concepts: ["상자그림", "중앙값", "두 집단 비교"],
      gen(rng) {
        const s = makeBox(rng, { groups: 2 }); const [a, b] = s.boxes; if (a.median === b.median) throw new GenFail("same"); const correct = Math.abs(a.median - b.median); const hi = a.median > b.median ? 0 : 1;
        return gInst(rng, {
          stimulus: bxIntro2(rng, s),
          question: rng.pick([`What is the positive difference between the median of the ${s.names[0]} data and the median of the ${s.names[1]} data, in ${s.t.unit}?`, `By how many ${s.t.unit} do the medians of the two groups differ?`]), correct,
          wrongs: pos([W(Math.abs(a.q3 - b.q3), "formula_misuse", "Q3 의 차를 구했다."), W(Math.abs(a.max - b.max), "formula_misuse", "최댓값의 차를 구했다."), W(Math.abs((a.q3 - a.q1) - (b.q3 - b.q1)), "formula_misuse", "사분범위의 차를 구했다."), W(Math.abs(a.q1 - b.q1), "formula_misuse", "Q1 의 차를 구했다."), W(a.median + b.median, "sign_error", "합을 구했다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({}, s.fig, `${BX_JS}if (B.length!==2) throw new Error('상자 둘 아님'); return Math.abs(B[0].median-B[1].median);`),
          trace: [bxRead(s, 0), bxRead(s, 1), [`중앙값: ${s.names[0]} ${a.median}, ${s.names[1]} ${b.median} 이다.`, "Read the two medians."], [`차 = |${a.median} - ${b.median}| = ${correct} 이다. (${s.names[hi]} 가 더 크다.)`, "Take the positive difference."], [`따라서 두 중앙값은 ${correct} ${s.t.unit} 만큼 다르다.`, "State the difference."]], variant: "median_gap_between_groups",
        }, s.fig);
      },
    },
    {
      op: "inverse", structure: "상자그림의 두 수 사이 구간에 K 개가 있다고 주어질 때, 위치를 읽어 구간 수를 세고 전체 개수를 역산", extra: "구간 수(j − i)를 읽어 한 구간의 개수 = K ÷ 구간 수, 전체 = 4 × 한 구간을 거꾸로 구함 — medium 은 한 구간의 개수",
      concepts: ["상자그림", "사분위", "전체 개수 역산"],
      gen(rng) {
        const s = makeBox(rng); const b = s.boxes[0]; const [i, j] = pairIJ(rng, 1); const secs = j - i; const q = rng.int(3, 20); const K = secs * q; const correct = 4 * q; if (secs === 4 && correct === K) throw new GenFail("trivial");
        return gInst(rng, {
          stimulus: `${bxIntro(rng, s)} ${rng.pick(SEC)} The part of the plot from ${val(b, i)} ${s.t.unit} to ${val(b, j)} ${s.t.unit} contains ${K} values.`,
          question: rng.pick([`How many values are in the whole data set?`, `What is the total number of values represented by the plot?`, `In all, how many values does the plot summarize?`, `How many values make up the entire data set?`]), correct,
          wrongs: pos([W(K, "step_missing", "그 구간의 개수를 답했다."), W(K * secs, "formula_misuse", "구간 수를 곱했다."), W(4 * K, "formula_misuse", "구간 수를 무시하고 4 배 했다."), W((4 * K) / (secs + 1), "other", "구간 수를 하나 더 셌다."), W(correct + 4, "other", "한 구간 어긋났다."), W(K / secs, "step_missing", "한 구간의 개수만 답했다.")]).filter((w) => w.v !== correct && Number.isFinite(w.v)),
          verificationJs: figJs({ K, v1: val(b, i), v2: val(b, j) }, s.fig, `${BX_JS}const b=B[0]; const i=K_.findIndex?0:0; const ii=K.findIndex(k=>b[k]===P.v1), jj=K.findIndex(k=>b[k]===P.v2); if (ii<0||jj<0||jj<=ii) throw new Error('값이 다섯 수가 아님'); return 4*P.K/(jj-ii);`.replace("const i=K_.findIndex?0:0; ", "")),
          trace: [bxRead(s), [`${val(b, i)} 는 ${NAME[i]}, ${val(b, j)} 는 ${NAME[j]} 이므로 두 값 사이에는 ${secs} 개 구간이 있다.`, "Count the sections."], [`한 구간의 개수 = ${K} ÷ ${secs} = ${q} 이다.`, "Values per section."], [`전체 = 4 × ${q} = ${correct} 이다.`, "Four sections in all."], [`따라서 자료의 개수는 ${correct} 이다.`, "State the total."]], variant: "total_from_section_count",
        }, s.fig);
      },
    },
    {
      op: "compose_kind", structure: "상자그림에서 Q1·Q3 를 읽어 사분범위를 구한 뒤, 모든 값을 b 배 하고 c 를 더한 새 자료의 사분범위를 구함", extra: "사분범위(Q3 − Q1)가 곱셈에는 b 배, 덧셈에는 변하지 않음을 적용해야 함 — medium 은 사분범위",
      concepts: ["상자그림", "사분범위", "자료 변환"],
      gen(rng) {
        const s = makeBox(rng); const b = s.boxes[0]; const iqr = b.q3 - b.q1; const m = rng.int(2, 4), c = rng.int(2, 30); const correct = m * iqr;
        return gInst(rng, {
          stimulus: `${bxIntro(rng, s)} ${rng.pick(["To create a new data set, every value is", "A researcher forms new data: each value is", "For a report, each value is"])} multiplied by ${m}, and then ${c} is added to the result.`,
          question: rng.pick([`What is the interquartile range (Q3 minus Q1) of the new data set?`, `What is the interquartile range of the transformed values?`]), correct,
          wrongs: pos([W(iqr, "step_missing", "곱셈 효과를 무시했다."), W(correct + c, "formula_misuse", "덧셈도 사분범위를 바꾼다고 보았다."), W(m * (b.max - b.min), "formula_misuse", "범위로 계산했다."), W(m * b.q3 + c, "axis_misread", "새 Q3 를 답했다."), W(iqr + c, "formula_misuse", "곱셈을 빼고 덧셈만 반영했다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({ m, c }, s.fig, `${BX_JS}const b=B[0]; const q1=b.q1*P.m+P.c, q3=b.q3*P.m+P.c; return q3-q1;`),
          trace: [bxRead(s), [`사분범위 = ${b.q3} - ${b.q1} = ${iqr} 이다.`, "Compute the IQR."], [`${m} 배 하면 사분범위도 ${m} 배: ${m} × ${iqr} = ${correct} 이다.`, "Multiplying scales the IQR."], [`${c} 를 더해도 Q1·Q3 가 같이 움직여 사분범위는 ${correct} 그대로이다.`, "Adding a constant does not change the IQR."], [`따라서 새 사분범위는 ${correct} 이다.`, "State the new IQR."]], variant: "iqr_after_linear_transform",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "read_median", structure: "상자그림에서 중앙값(상자 안의 선)의 값을 읽음", extra: "easy: 중앙값 읽기", concepts: ["상자그림", "중앙값"],
      gen(rng) {
        const s = makeBox(rng); const b = s.boxes[0];
        return gInst(rng, { stimulus: bxIntro(rng, s), question: rng.pick([`What is the median of the data, in ${s.t.unit}?`, `According to the plot, what is the median ${s.t.col.toLowerCase()}, in ${s.t.unit}?`]), correct: b.median, wrongs: pos([W(b.q1, "axis_misread", "Q1 을 읽었다."), W(b.q3, "axis_misread", "Q3 를 읽었다."), W(Math.round((b.min + b.max) / 2), "formula_misuse", "범위의 가운데를 답했다."), W(b.max, "axis_misread", "최댓값을 읽었다.")]).filter((w) => w.v !== b.median), verificationJs: figJs({}, s.fig, `${BX_JS}return B[0].median;`), trace: [bxRead(s), [`상자 안의 굵은 선이 중앙값 ${b.median} 이다.`, "The line inside the box is the median."]], variant: "read_median_line",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "iqr", structure: "상자그림에서 Q1·Q3 를 읽어 사분범위를 구함", extra: "medium: Q3 - Q1", concepts: ["상자그림", "사분범위"],
      gen(rng) {
        const s = makeBox(rng); const b = s.boxes[0]; const iqr = b.q3 - b.q1;
        return gInst(rng, { stimulus: bxIntro(rng, s), question: rng.pick([`What is the interquartile range of the data, in ${s.t.unit}?`, `What is the difference between the third quartile and the first quartile, in ${s.t.unit}?`]), correct: iqr, wrongs: pos([W(b.max - b.min, "formula_misuse", "범위를 구했다."), W(b.median - b.q1, "formula_misuse", "상자의 왼쪽 절반만 구했다."), W(b.q3, "step_missing", "Q3 만 답했다."), W(iqr + s.s, "other", "눈금 한 칸 어긋났다.")]).filter((w) => w.v !== iqr), verificationJs: figJs({}, s.fig, `${BX_JS}return B[0].q3 - B[0].q1;`), trace: [bxRead(s), [`사분범위 = ${b.q3} - ${b.q1} = ${iqr} 이다.`, "IQR = Q3 - Q1."], [`상자의 폭이 사분범위이다.`, "The box width is the IQR."]], variant: "iqr_from_box",
        }, s.fig);
      },
    },
  ],
});
