// one_variable_data.range.HG.P — 히스토그램에서 가능한 범위(구간 경계로 한정)를 구한다: 가장 큰 가능한 범위 = 마지막 막대 오른쪽 끝 − 첫 막대 왼쪽 끝.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst } from "../graph-kit";
import { G_JS, makeG, readStep, intro, label } from "../hist-kit";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v >= 0);

export const ITEM = defineItem({
  prefix: "ovd", itemId: "one_variable_data.range.HG.P",
  hard: [
    {
      op: "chain2", structure: "히스토그램에서 첫 막대의 왼쪽 끝과 마지막 막대의 오른쪽 끝을 읽어 가능한 가장 큰 범위를 구함", extra: "막대 안의 값이 정확히 얼마인지 모르므로 양 끝 경계에서 가장 큰 범위가 나옴을 알아야 함(막대 중점·왼쪽 끝끼리 빼는 함정) — medium 은 막대 너비",
      concepts: ["히스토그램", "범위", "구간 경계"],
      gen(rng) {
        const s = makeG(rng); const first = s.los[0], last = s.los[s.los.length - 1] + s.t.w; const correct = last - first;
        return gInst(rng, {
          stimulus: intro(rng, s),
          question: rng.pick([`What is the greatest possible value of the range of the data, in ${s.t.unit}?`, `Based on the histogram, what is the largest the range of the data could be, in ${s.t.unit}?`]), correct,
          wrongs: pos([W(correct - s.t.w, "formula_misuse", "첫·마지막 막대의 왼쪽 끝끼리 뺐다."), W(correct - 2 * s.t.w, "formula_misuse", "가능한 가장 작은 범위를 구했다."), W(correct + s.t.w, "other", "막대 하나를 더 셌다."), W(last, "step_missing", "마지막 경계만 답했다."), W(s.los.length * s.t.w + s.t.w, "axis_misread", "막대 수로 계산했다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({}, s.fig, `${G_JS}return bins[bins.length-1].to-bins[0].from;`),
          trace: [readStep(s), [`첫 막대는 ${label(s.t, s.los[0])} 이므로 가장 작은 값은 ${first} 이상이다.`, "The smallest value could be as low as the first left edge."], [`마지막 막대는 ${label(s.t, s.los[s.los.length - 1])} 이므로 가장 큰 값은 ${last} 미만이다.`, "The largest value could be just below the last right edge."], [`가능한 가장 큰 범위 = ${last} - ${first} = ${correct} 이다.`, "Greatest possible range."], [`따라서 ${correct} ${s.t.unit} 이다.`, "State the range."]], variant: "greatest_possible_range",
        }, s.fig);
      },
    },
    {
      op: "compare_scenarios", structure: "가능한 가장 큰 범위와 가장 작은 범위(마지막 막대 왼쪽 끝 − 첫 막대 오른쪽 끝)의 차를 구함", extra: "두 극단 경우를 각각 경계에서 읽어 비교해야 함 — medium 은 막대 너비",
      concepts: ["히스토그램", "범위", "두 경우 비교"],
      gen(rng) {
        const s = makeG(rng); const first = s.los[0], lastL = s.los[s.los.length - 1]; const gp = lastL + s.t.w - first, lp = lastL - (first + s.t.w); const correct = gp - lp;
        return gInst(rng, {
          stimulus: intro(rng, s),
          question: rng.pick([`What is the difference, in ${s.t.unit}, between the greatest possible range and the least possible range of the data?`, `By how many ${s.t.unit} do the greatest and least possible ranges of the data differ?`]), correct,
          wrongs: pos([W(gp, "step_missing", "가장 큰 범위만 답했다."), W(lp, "step_missing", "가장 작은 범위만 답했다."), W(s.t.w, "formula_misuse", "막대 너비를 한 번만 셌다."), W(3 * s.t.w, "other", "막대 너비를 세 번 셌다."), W(gp + lp, "sign_error", "합을 구했다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({}, s.fig, `${G_JS}const gp=bins[bins.length-1].to-bins[0].from, lp=bins[bins.length-1].from-bins[0].to; return gp-lp;`),
          trace: [readStep(s), [`가장 큰 범위 = ${lastL + s.t.w} - ${first} = ${gp} 이다.`, "Greatest possible range."], [`가장 작은 범위 = ${lastL} - ${first + s.t.w} = ${lp} 이다.`, "Least possible range."], [`차 = ${gp} - ${lp} = ${correct} 이다.`, "Subtract."], [`두 경우의 차는 막대 너비의 두 배이다.`, "The gap is twice the bar width."]], variant: "greatest_minus_least_range",
        }, s.fig);
      },
    },
    {
      op: "inverse", structure: "같은 너비의 막대가 오른쪽에 k 개 더해져 가능한 가장 큰 범위가 R 이 될 때 k 를 역산", extra: "현재의 가장 큰 범위와 막대 너비를 읽어 늘어난 만큼을 너비로 나눠야 함 — medium 은 막대 너비",
      concepts: ["히스토그램", "범위", "역산"],
      gen(rng) {
        const s = makeG(rng); const first = s.los[0], last = s.los[s.los.length - 1] + s.t.w; const k = rng.int(2, 5); const R = last + k * s.t.w - first;
        return gInst(rng, {
          stimulus: `${intro(rng, s)} Suppose $k$ more intervals of the same width are added after the last interval, so that the greatest possible range of the data becomes ${R} ${s.t.unit}.`,
          question: rng.pick([`What is the value of $k$?`, `How many intervals were added?`]), correct: k,
          wrongs: pos([W(R - (last - first), "step_missing", "범위의 증가량만 답했다."), W(k + 1, "other", "하나 더 셌다."), W(k - 1, "other", "하나 덜 셌다."), W(Math.round(R / s.t.w), "formula_misuse", "범위를 막대 너비로만 나눴다."), W(Math.round((R - (last - first)) / s.t.w) + s.los.length, "other", "기존 막대 수를 더했다.")]).filter((w) => w.v !== k),
          verificationJs: figJs({ R }, s.fig, `${G_JS}const w=bins[0].to-bins[0].from; const cur=bins[bins.length-1].to-bins[0].from; const d=P.R-cur; if (d<=0||d%w!==0) throw new Error('k 가 정수 아님'); return d/w;`),
          trace: [readStep(s), [`현재 가장 큰 범위 = ${last} - ${first} = ${last - first} 이고 막대 너비는 ${s.t.w} 이다.`, "Current greatest possible range and bar width."], [`늘어난 범위 = ${R} - ${last - first} = ${k * s.t.w} 이다.`, "Increase in the range."], [`k = ${k * s.t.w} ÷ ${s.t.w} = ${k} 이다.`, "Divide by the bar width."], [`따라서 ${k} 개의 막대가 더해졌다.`, "State k."]], variant: "bars_added_for_range",
        }, s.fig);
      },
    },
    {
      op: "param_condition", structure: "가장 낮은 j 개 막대의 값이 모두 제거될 때, 남은 자료의 가능한 가장 큰 범위를 구함", extra: "제거된 막대만큼 새 왼쪽 끝이 오른쪽으로 옮겨짐을 반영해야 함 — medium 은 막대 너비",
      concepts: ["히스토그램", "범위", "자료 제거"],
      gen(rng) {
        const s = makeG(rng); const j = rng.int(1, s.los.length - 2); const first = s.los[j], last = s.los[s.los.length - 1] + s.t.w; const correct = last - first;
        return gInst(rng, {
          stimulus: `${intro(rng, s)} All the values in the lowest ${j === 1 ? "interval" : `${j} intervals`} are removed from the data.`,
          question: rng.pick([`What is the greatest possible value of the range of the remaining data, in ${s.t.unit}?`, `For the remaining data, what is the largest the range could be, in ${s.t.unit}?`]), correct,
          wrongs: pos([W(last - s.los[0], "condition_ignored", "제거 전 범위를 답했다."), W(correct - s.t.w, "formula_misuse", "왼쪽 끝 대신 다음 경계를 썼다."), W(correct + s.t.w, "other", "막대 하나를 더 셌다."), W(last - s.los[j - 1], "other", "막대 하나를 덜 제거했다."), W(correct - j * s.t.w, "other", "제거를 두 번 반영했다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({ j }, s.fig, `${G_JS}if (P.j>=bins.length-1) throw new Error('제거가 너무 많음'); return bins[bins.length-1].to-bins[P.j].from;`),
          trace: [readStep(s), [`가장 낮은 ${j} 개 막대를 빼면 남은 첫 막대는 ${label(s.t, first)} 이다.`, "The first remaining bar."], [`가장 큰 값은 마지막 막대의 오른쪽 끝 ${last} 미만이다.`, "Right edge of the last bar."], [`가능한 가장 큰 범위 = ${last} - ${first} = ${correct} 이다.`, "Greatest possible range."], [`따라서 ${correct} ${s.t.unit} 이다.`, "State the range."]], variant: "greatest_range_after_removal",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "first_left_edge", structure: "히스토그램에서 첫 막대의 왼쪽 끝 값을 읽음", extra: "easy: 첫 경계 읽기", concepts: ["히스토그램", "구간 경계"],
      gen(rng) {
        const s = makeG(rng); const a = s.los[0];
        return gInst(rng, { stimulus: intro(rng, s), question: rng.pick([`What is the left endpoint of the first interval, in ${s.t.unit}?`, `At what value, in ${s.t.unit}, does the first interval begin?`]), correct: a, wrongs: pos([W(a + s.t.w, "axis_misread", "첫 막대의 오른쪽 끝을 읽었다."), W(s.los[s.los.length - 1], "axis_misread", "마지막 막대의 왼쪽 끝을 읽었다."), W(s.t.w, "axis_misread", "막대 너비를 답했다."), W(a - s.t.w, "axis_misread", "눈금 한 칸 어긋나게 읽었다.")]).filter((w) => w.v !== a), verificationJs: figJs({}, s.fig, `${G_JS}return bins[0].from;`), trace: [readStep(s), [`첫 막대는 ${label(s.t, a)} 이므로 왼쪽 끝은 ${a} 이다.`, "The first bar starts at its left edge."]], variant: "read_first_edge",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "bar_width", structure: "히스토그램에서 막대 하나의 너비(구간 길이)를 구함", extra: "medium: 오른쪽 끝 - 왼쪽 끝", concepts: ["히스토그램", "구간 길이"],
      gen(rng) {
        const s = makeG(rng);
        return gInst(rng, { stimulus: intro(rng, s), question: rng.pick([`What is the width of each interval, in ${s.t.unit}?`, `Each interval covers how many ${s.t.unit}?`]), correct: s.t.w, wrongs: pos([W(s.t.w * s.los.length, "formula_misuse", "전체 길이를 답했다."), W(s.los[0], "axis_misread", "첫 경계를 답했다."), W(s.t.w + 5, "other", "계산 중 어긋났다."), W(Math.max(1, s.t.w - 1), "other", "계산 중 어긋났다.")]).filter((w) => w.v !== s.t.w), verificationJs: figJs({}, s.fig, `${G_JS}return bins[0].to-bins[0].from;`), trace: [readStep(s), [`한 막대는 ${label(s.t, s.los[0])} 이므로 너비는 ${s.t.w} 이다.`, "Right edge minus left edge."], [`모든 막대의 너비가 같다.`, "All bars have the same width."]], variant: "read_bar_width",
        }, s.fig);
      },
    },
  ],
});
