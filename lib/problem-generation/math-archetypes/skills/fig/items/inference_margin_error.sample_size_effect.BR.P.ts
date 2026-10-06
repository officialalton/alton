// inference_margin_error.sample_size_effect.BR.P — 표본 크기 막대(Survey A·B·C)와 한 설문의 오차범위로 다른 표본의 오차범위·필요한 표본 크기·합친 표본의 오차범위를 구한다(오차범위는 표본 크기의 제곱근에 반비례).
import { GenFail } from "../../../types";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst } from "../graph-kit";
import { SIZE_JS, sizeScene, type SizeScene } from "./_t7bar-kit";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v > 0 && Number.isFinite(w.v));
const rd = (n: number) => Math.round(n * 1e6) / 1e6;
const read = (z: SizeScene): [string, string] => [`막대그래프에서 표본 크기를 읽는다: ${z.names.map((n, i) => `${n} ${z.vals[i]}`).join(", ")}.`, "Read the sample sizes."];
const intro = (rng: Parameters<typeof sizeScene>[0], z: SizeScene) => rng.pick([
  `Three random surveys of ${z.s.ent} were conducted about ${z.s.topic}; the graph shows each sample size. The surveys differ only in sample size.`,
  `The graph shows how many ${z.s.ent} were sampled at random in each of three surveys about ${z.s.topic}.`,
  `Researchers surveyed random samples of ${z.s.ent} on ${z.s.topic}, with sample sizes shown in the graph. Margin of error is inversely proportional to the square root of the sample size.`,
  `Each of three polls asked ${z.s.ent} whether they ${z.s.ev}, using a random sample whose size is shown in the graph.`,
  `Three groups of ${z.s.ent} were polled at random about ${z.s.topic}. All polls used the same procedure, and the graph gives the sample sizes.`,
  `In a study of ${z.s.topic}, a polling group drew three separate random samples of ${z.s.ent}; the graph shows how large each was.`,
  `${z.s.ent[0].toUpperCase()}${z.s.ent.slice(1)} were polled three times about ${z.s.topic}. The graph gives the sample size of each poll, and the polls are otherwise identical.`,
  `The sample sizes of three random surveys about whether ${z.s.ent} ${z.s.ev} are shown in the graph. A larger sample gives a smaller margin of error.`,
]);
const SM = (rng: Parameters<typeof sizeScene>[0], m: number) => rng.pick([
  `The margin of error for the survey with the smallest sample is ${m} percentage points.`, `The poll with the fewest respondents has a margin of error of ${m} percentage points.`, `Among the three, the smallest sample gives a margin of error of ${m} percentage points.`, `The smallest of the three samples has a margin of error of ${m} percentage points.`, `With the fewest ${"people"} sampled, one poll reports a margin of error of ${m} percentage points.`]);
const SETS_SQ = [[1, 4, 9], [1, 4, 4], [1, 9, 4], [1, 4, 9]];
const sq = (n: number) => Math.round(Math.sqrt(n));
const MS = [6, 12, 18, 24, 30];
const smallI = (z: SizeScene) => z.ratios.indexOf(Math.min(...z.ratios));

export const ITEM = defineItem({
  prefix: "ime", itemId: "inference_margin_error.sample_size_effect.BR.P",
  hard: [
    {
      op: "compare_scenarios", structure: "표본이 가장 작은 설문의 오차범위를 주고, 표본이 k² 배인 다른 설문의 오차범위를 제곱근 반비례로 구함", extra: "표본 크기의 비를 막대에서 읽어 그 제곱근으로 오차범위를 나눠야 함(비를 그대로 쓰면 함정) — medium 은 반대 방향",
      concepts: ["표본 크기", "오차범위와 표본 크기", "제곱근"],
      gen(rng) {
        const z = sizeScene(rng, rng.pick(SETS_SQ)); const m = rng.pick(MS); const si = smallI(z); const cand = z.ratios.map((r, i) => i).filter((i) => z.ratios[i] > 1); const x = rng.pick(cand); const c = m / sq(z.ratios[x]);
        return gInst(rng, {
          stimulus: `${intro(rng, z)} ${SM(rng, m)}`,
          question: rng.pick([`What is the margin of error, in percentage points, for Survey ${z.names[x]}?`, `Based on the graph, what margin of error, in percentage points, does Survey ${z.names[x]} have?`]), correct: c,
          wrongs: pos([W(m / z.ratios[x], "formula_misuse", "표본 비로 나눴다(제곱근을 쓰지 않음)."), W(m, "step_missing", "작은 표본의 오차범위를 그대로 답했다."), W(m * sq(z.ratios[x]), "opposite", "곱했다(반비례를 거꾸로 적용)."), W(m * z.ratios[x], "opposite", "표본 비를 곱했다."), W(m - z.ratios[x], "formula_misuse", "뺐다.")].filter((w) => w.v !== c)),
          verificationJs: figJs({ m, nx: z.names[x] }, z.fig, `${SIZE_JS}return Math.round(P.m * Math.sqrt(mn / g(P.nx)) * 1e6) / 1e6;`),
          trace: [read(z), [`가장 작은 표본은 ${z.vals[si]}, ${z.names[x]} 는 ${z.vals[x]} 로 ${z.ratios[x]} 배이다.`, "Compare the sample sizes."], ["오차범위는 표본 크기의 제곱근에 반비례한다.", "Margin ∝ 1/√n."], [`Survey ${z.names[x]} 의 오차범위 = ${m} ÷ √${z.ratios[x]} = ${fmtNum(c)} 이다.`, "Divide by the square root of the ratio."], [`따라서 ${fmtNum(c)} 퍼센트포인트이다.`, "State the margin."]], variant: "margin_of_larger_sample_bar",
        }, z.fig);
      },
    },
    {
      op: "inverse", structure: "표본이 가장 작은 설문의 오차범위 m 과 목표 오차범위 g 로 필요한 새 표본 크기를 역산", extra: "오차범위를 1/k 로 줄이려면 표본 크기는 k² 배여야 함(k 배로 답하면 함정) — medium 은 새 오차범위를 구함",
      concepts: ["표본 크기", "오차범위와 표본 크기", "역산"],
      gen(rng) {
        const z = sizeScene(rng, rng.pick(SETS_SQ)); const si = smallI(z); const k = rng.pick([2, 3, 4]); const g = rng.pick([2, 3, 4, 5, 6]); const m = g * k; const c = z.vals[si] * k * k;
        return gInst(rng, {
          stimulus: `${intro(rng, z)} ${SM(rng, m)} ${rng.pick([`A new survey of the same kind is planned with a target margin of error of ${g} percentage points.`, `Planners want a new survey of the same kind to have a margin of error of only ${g} percentage points.`, `The goal for a follow-up survey is a margin of error of ${g} percentage points.`])}`,
          question: rng.pick([`How many ${z.s.ent} would need to be sampled in the new survey?`, `How large a sample of ${z.s.ent} does the new survey need?`, `What sample size, in number of ${z.s.ent}, is needed for the new survey to reach the target margin?`]), correct: c,
          wrongs: pos([W(z.vals[si] * k, "formula_misuse", "표본 크기를 k 배만 했다(제곱을 쓰지 않음)."), W(z.vals[si], "step_missing", "작은 표본 크기를 그대로 답했다."), W(z.vals[si] * (m - g), "formula_misuse", "오차범위의 차를 곱했다."), W(Math.round(z.vals[si] / (k * k)), "opposite", "나눴다(반대로 적용)."), W(c + z.u, "other", "눈금 한 칸 어긋났다.")].filter((w) => w.v !== c)),
          verificationJs: figJs({ m, g }, z.fig, `${SIZE_JS}return mn * (P.m / P.g) * (P.m / P.g);`),
          trace: [read(z), [`가장 작은 표본은 ${z.vals[si]} 이고 오차범위는 ${m} 이다.`, "Smallest sample and its margin."], [`오차범위를 ${m} 에서 ${g} 로 줄이면 ${k} 배로 작아진다.`, "The margin shrinks by the factor k."], [`오차범위는 √n 에 반비례하므로 표본 크기는 ${k}² = ${k * k} 배가 필요하다.`, "The sample must grow by k²."], [`새 표본 크기 = ${z.vals[si]} × ${k * k} = ${c} 이다.`, "Compute the new sample size."]], variant: "sample_size_for_target_margin_bar",
        }, z.fig);
      },
    },
    {
      op: "chain2", structure: "세 설문의 표본을 모두 합친 표본의 오차범위를 가장 작은 설문의 오차범위로부터 구함", extra: "세 막대를 합해 표본 비를 구하고 제곱근으로 오차범위를 나눠야 함(합이 제곱수가 되도록) — medium 은 한 설문",
      concepts: ["표본 크기", "합계", "오차범위와 표본 크기"],
      gen(rng) {
        const z = sizeScene(rng, rng.pick([[1, 4, 4], [1, 3, 5], [1, 7, 8]])); const tot = z.ratios.reduce((a, b) => a + b, 0); const k = sq(tot); const j = rng.int(2, 8); const m = j * k; const c = j; const si = smallI(z);
        return gInst(rng, {
          stimulus: `${intro(rng, z)} ${SM(rng, m)} ${rng.pick([`The three samples are combined into a single sample.`, `Suppose all three samples are pooled into one.`, `The responses from all three samples are then merged.`])}`,
          question: rng.pick([`What is the margin of error, in percentage points, for the combined sample?`, `Based on the graph, what margin of error, in percentage points, does the combined sample have?`]), correct: c,
          wrongs: pos([W(m / tot, "formula_misuse", "합친 비로 나눴다(제곱근을 쓰지 않음)."), W(m, "step_missing", "작은 표본의 오차범위를 그대로 답했다."), W(m * k, "opposite", "곱했다(반비례를 거꾸로 적용)."), W(m / (tot - z.ratios[si]), "condition_ignored", "가장 작은 표본을 빼고 합쳤다."), W(c + 1, "other", "계산 중 1 어긋났다.")].filter((w) => w.v !== c)),
          verificationJs: figJs({ m }, z.fig, `${SIZE_JS}return Math.round(P.m * Math.sqrt(mn / v.reduce((a, b) => a + b, 0)) * 1e6) / 1e6;`),
          trace: [read(z), [`합친 표본 = ${z.vals.join(" + ")} = ${z.vals.reduce((a, b) => a + b, 0)} 이다.`, "Add the three sample sizes."], [`가장 작은 표본 ${z.vals[si]} 의 ${tot} 배이다.`, "Ratio to the smallest sample."], [`오차범위 = ${m} ÷ √${tot} = ${m} ÷ ${k} = ${c} 이다.`, "Divide by the square root of the ratio."], [`따라서 ${c} 퍼센트포인트이다.`, "State the margin."]], variant: "margin_of_combined_sample_bar",
        }, z.fig);
      },
    },
    {
      op: "constraint_select", structure: "표본이 가장 작은 설문의 오차범위를 주고, 오차범위가 기준 T 보다 작은 설문의 개수를 셈", extra: "세 설문의 오차범위를 제곱근 반비례로 각각 구해 경계(같은 경우 제외)를 따져 세야 함 — medium 은 한 설문",
      concepts: ["표본 크기", "오차범위와 표본 크기", "조건 개수 세기"],
      gen(rng) {
        const z = sizeScene(rng, rng.pick([[1, 4, 9], [1, 4, 4], [1, 9, 4]])); const m = rng.pick([12, 18, 24, 36]); const mar = z.ratios.map((r) => m / sq(r)); const T = rng.pick(mar.filter((x) => x > Math.min(...mar))); const cnt = mar.filter((x) => x < T).length; const ge = mar.filter((x) => x <= T).length; if (cnt < 1 || cnt > 2) throw new GenFail("cnt");
        return gInst(rng, {
          stimulus: `${intro(rng, z)} ${SM(rng, m)}`,
          question: rng.pick([`For how many of the three surveys is the margin of error less than ${T} percentage points?`, `How many of these surveys have a margin of error below ${T} percentage points?`]), correct: cnt,
          wrongs: [W(ge === cnt ? cnt + 1 : ge, "condition_ignored", "같은 경우까지 셌다."), W(3 - cnt, "opposite", "기준 이상인 개수를 셌다."), W(z.ratios.filter((r) => r > 1).length, "formula_misuse", "표본이 더 큰 설문을 셌다."), W(cnt + 1, "other", "하나를 더 셌다."), W(cnt - 1, "other", "하나를 빠뜨렸다."), W(0, "other", "하나도 없다고 답했다."), W(3, "other", "모두라고 답했다.")].filter((w) => w.v !== cnt && w.v >= 0 && w.v <= 3),
          verificationJs: figJs({ m, T }, z.fig, `${SIZE_JS}return v.filter(x => P.m * Math.sqrt(mn / x) < P.T - 1e-9).length;`),
          trace: [read(z), [`표본 비: ${z.ratios.join(", ")} 이다.`, "Sample ratios."], [`오차범위 = ${m} ÷ √(비): ${mar.map((x) => fmtNum(x)).join(", ")} 이다.`, "Compute each margin."], [`${T} 보다 작은 것(같은 것 제외): ${mar.filter((x) => x < T).map((x) => fmtNum(x)).join(", ")} 이다.`, "Select those below the threshold."], [`개수는 ${cnt} 이다.`, "Count them."]], variant: "count_margins_below_bar",
        }, z.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "size_ratio", structure: "두 설문의 표본 크기 비를 구함", extra: "easy: 나눗셈", concepts: ["표본 크기", "비"],
      gen(rng) {
        const z = sizeScene(rng, rng.pick(SETS_SQ)); const big = z.ratios.indexOf(Math.max(...z.ratios)); const si = smallI(z); const c = z.ratios[big] / z.ratios[si];
        return gInst(rng, { stimulus: intro(rng, z), question: rng.pick([`The sample size of Survey ${z.names[big]} is how many times the sample size of Survey ${z.names[si]}?`, `How many times as large as the sample of Survey ${z.names[si]} is the sample of Survey ${z.names[big]}?`]), correct: c, wrongs: pos([W(1 / c, "opposite", "비를 거꾸로 구했다."), W(z.vals[big] - z.vals[si], "formula_misuse", "차를 구했다."), W(sq(c), "formula_misuse", "제곱근을 취했다."), W(c + 1, "other", "계산 중 1 어긋났다.")].filter((w) => w.v !== c)), verificationJs: figJs({ nb: z.names[big], ns: z.names[si] }, z.fig, `${SIZE_JS}return g(P.nb) / g(P.ns);`), trace: [read(z), [`${z.vals[big]} ÷ ${z.vals[si]} = ${c} 이다.`, "Divide the larger sample by the smaller."]], variant: "sample_size_ratio_bar" }, z.fig);
      },
    },
    {
      lv: "medium", name: "margin_of_smallest", structure: "표본이 가장 큰 설문의 오차범위로 표본이 가장 작은 설문의 오차범위를 구함", extra: "medium: 제곱근 비", concepts: ["표본 크기", "오차범위와 표본 크기"],
      gen(rng) {
        const z = sizeScene(rng, rng.pick(SETS_SQ)); const bi = z.ratios.indexOf(Math.max(...z.ratios)); const si = smallI(z); const r = z.ratios[bi]; const g = rng.pick([2, 3, 4, 5]); const c = g * sq(r);
        return gInst(rng, { stimulus: `${intro(rng, z)} The margin of error for the survey with the largest sample is ${g} percentage points.`, question: rng.pick([`What is the margin of error, in percentage points, for the survey with the smallest sample?`, `Based on the graph, what margin of error does the survey with the smallest sample have, in percentage points?`]), correct: c, wrongs: pos([W(g * r, "formula_misuse", "표본 비를 그대로 곱했다(제곱근을 쓰지 않음)."), W(g, "step_missing", "그대로 답했다."), W(g / sq(r), "opposite", "나눴다(반비례를 거꾸로 적용)."), W(c + 1, "other", "계산 중 1 어긋났다.")].filter((w) => w.v !== c)), verificationJs: figJs({ g }, z.fig, `${SIZE_JS}return Math.round(P.g * Math.sqrt(mx / mn) * 1e6) / 1e6;`), trace: [read(z), [`가장 큰 표본 ${z.vals[bi]} 는 가장 작은 표본 ${z.vals[si]} 의 ${r} 배이다.`, "Ratio of the samples."], [`오차범위 = ${g} × √${r} = ${c} 이다.`, "Multiply by the square root of the ratio."]], variant: "margin_of_smallest_bar" }, z.fig);
      },
    },
  ],
});
