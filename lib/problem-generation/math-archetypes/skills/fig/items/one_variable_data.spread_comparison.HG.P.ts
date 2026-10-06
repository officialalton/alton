// one_variable_data.spread_comparison.HG.P — 두 히스토그램(같은 가로 눈금)에서 두 집단의 퍼짐(범위)을 비교한다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst } from "../graph-kit";
import { HIST2_JS, hist2Intro, hist2Read, makeHist2, type Hist2 } from "../hist2-kit";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v >= 0);
const lo = (s: Hist2, i: number) => Math.min(...s.los.filter((_, j) => s.freqs[i][j] > 0)), hi = (s: Hist2, i: number) => Math.max(...s.los.filter((_, j) => s.freqs[i][j] > 0)) + s.t.w;
const gp = (s: Hist2, i: number) => hi(s, i) - lo(s, i);

export const ITEM = defineItem({
  prefix: "ovd", itemId: "one_variable_data.spread_comparison.HG.P",
  hard: [
    {
      op: "compare_scenarios", structure: "두 히스토그램에서 첫·마지막 막대의 경계를 읽어 가능한 가장 큰 범위를 각각 구하고 차를 구함", extra: "두 그림의 양 끝 점(최솟값·최댓값)을 같은 눈금에서 읽어 비교해야 함(점이 가장 높이 쌓인 값과 혼동하는 함정) — medium 은 한 집단의 범위",
      concepts: ["히스토그램", "범위", "두 집단 비교"],
      gen(rng) {
        const s = makeHist2(rng, { differ: true }); const correct = Math.abs(gp(s, 0) - gp(s, 1));
        return gInst(rng, {
          stimulus: hist2Intro(rng, s),
          question: rng.pick([`What is the positive difference between the greatest possible range of the ${s.names[0]} data and the greatest possible range of the ${s.names[1]} data, in ${s.t.unit}?`, `By how many ${s.t.unit} do the greatest possible ranges of the two samples differ?`]), correct,
          wrongs: pos([W(gp(s, 0) + gp(s, 1), "sign_error", "범위의 합을 구했다."), W(Math.abs(hi(s, 0) - hi(s, 1)), "formula_misuse", "최댓값의 차를 구했다."), W(Math.abs(lo(s, 0) - lo(s, 1)), "formula_misuse", "최솟값의 차를 구했다."), W(gp(s, 0), "step_missing", "한 집단의 범위만 답했다."), W(correct + s.t.w, "other", "눈금 한 칸 어긋났다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({}, s.fig, `${HIST2_JS}return Math.abs(gp(0)-gp(1));`),
          trace: [hist2Read(s), [`범위: ${s.names[0]} ${hi(s, 0)} - ${lo(s, 0)} = ${gp(s, 0)}, ${s.names[1]} ${hi(s, 1)} - ${lo(s, 1)} = ${gp(s, 1)} 이다.`, "Compute each range."], [`차 = |${gp(s, 0)} - ${gp(s, 1)}| = ${correct} 이다.`, "Take the positive difference."], [`높이가 0 인 구간은 범위에 들어가지 않는다.`, "Intervals with height 0 do not count."], [`따라서 ${correct} ${s.t.unit} 만큼 다르다.`, "State the difference."]], variant: "range_gap_between_dot_plots",
        }, s.fig);
      },
    },
    {
      op: "chain2", structure: "두 집단을 합친 전체 값의 범위를 구한 뒤, 첫 집단의 범위와의 차를 구함", extra: "합친 최솟값·최댓값(두 그림에서 가장 바깥 점)을 찾아 연결해야 함 — medium 은 한 집단의 범위",
      concepts: ["히스토그램", "범위", "합친 자료"],
      gen(rng) {
        const s = makeHist2(rng); const all = Math.max(hi(s, 0), hi(s, 1)) - Math.min(lo(s, 0), lo(s, 1)); const correct = all - gp(s, 0); if (correct <= 0) throw new GenFail("same");
        return gInst(rng, {
          stimulus: hist2Intro(rng, s),
          question: rng.pick([`How many ${s.t.unit} greater is the range of all the values in both plots combined than the greatest possible range of the ${s.names[0]} data?`, `If the two samples are combined, by how many ${s.t.unit} does the greatest possible range of the combined data exceed the greatest possible range of the ${s.names[0]} data?`]), correct,
          wrongs: pos([W(all, "step_missing", "합친 범위만 답했다."), W(gp(s, 0), "step_missing", "첫 집단의 범위만 답했다."), W(gp(s, 1), "step_missing", "둘째 집단의 범위만 답했다."), W(all - gp(s, 1), "formula_misuse", "둘째 집단과 비교했다."), W(correct + s.t.w, "other", "눈금 한 칸 어긋났다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({ n0: s.names[0] }, s.fig, `${HIST2_JS}const i=nm.indexOf(P.n0); if (i<0) throw new Error('이름 없음'); return (Math.max(hi(0),hi(1))-Math.min(lo(0),lo(1)))-gp(i);`),
          trace: [hist2Read(s), [`합친 최솟값 ${Math.min(lo(s, 0), lo(s, 1))}, 합친 최댓값 ${Math.max(hi(s, 0), hi(s, 1))} 이다.`, "Combined extremes."], [`합친 범위 = ${all} 이고 ${s.names[0]} 범위 = ${gp(s, 0)} 이다.`, "Combined range and the first range."], [`차 = ${all} - ${gp(s, 0)} = ${correct} 이다.`, "Subtract."], [`따라서 ${correct} ${s.t.unit} 더 크다.`, "State the difference."]], variant: "combined_range_minus_first",
        }, s.fig);
      },
    },
    {
      op: "inverse", structure: "범위가 더 작은 집단의 최댓값이 k 만큼 늘어 두 범위가 같아질 때 k 를 역산", extra: "두 범위를 읽고 부족한 만큼을 거꾸로 구해야 함 — medium 은 한 집단의 범위",
      concepts: ["히스토그램", "범위", "역산"],
      gen(rng) {
        const s = makeHist2(rng, { differ: true }); const small = gp(s, 0) < gp(s, 1) ? 0 : 1; const big = 1 - small; const correct = gp(s, big) - gp(s, small);
        return gInst(rng, {
          stimulus: `${hist2Intro(rng, s)} ${rng.pick([`Suppose the greatest value in the ${s.names[small]} data increases by $k$ ${s.t.unit}, where $k$ is a constant, and the rest of that data stays the same.`, `Imagine that only the maximum of the ${s.names[small]} data increases by $k$ ${s.t.unit}.`])}`,
          question: rng.pick([`For what value of $k$ does the greatest possible range of the ${s.names[small]} data become equal to the greatest possible range of the ${s.names[big]} data?`, `What is $k$ if the two samples then have equal greatest possible ranges?`]), correct,
          wrongs: pos([W(gp(s, big), "step_missing", "범위가 큰 집단의 범위를 답했다."), W(gp(s, small), "step_missing", "범위가 작은 집단의 범위를 답했다."), W(gp(s, 0) + gp(s, 1), "sign_error", "범위의 합을 답했다."), W(Math.abs(hi(s, 0) - hi(s, 1)), "formula_misuse", "최댓값의 차를 구했다."), W(correct + s.t.w, "other", "눈금 한 칸 어긋났다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({ ns: s.names[small], nb: s.names[big] }, s.fig, `${HIST2_JS}const a=nm.indexOf(P.ns), b=nm.indexOf(P.nb); if (a<0||b<0) throw new Error('이름 없음'); const k=gp(b)-gp(a); if (k<=0) throw new Error('늘릴 필요 없음'); return k;`),
          trace: [hist2Read(s), [`범위: ${s.names[small]} ${gp(s, small)}, ${s.names[big]} ${gp(s, big)} 이다.`, "Compute the ranges."], [`${s.names[small]} 의 최댓값이 k 늘면 범위는 ${gp(s, small)} + k 이다.`, "The smaller range after the increase."], [`${gp(s, small)} + k = ${gp(s, big)} 에서 k = ${correct} 이다.`, "Solve for k."], [`따라서 k = ${correct} 이다.`, "State k."]], variant: "increase_to_match_range",
        }, s.fig);
      },
    },
    {
      op: "param_condition", structure: "범위가 더 작은 집단의 모든 값에 m 배를 하면 두 범위가 같아지는 양의 정수 m 을 구함", extra: "곱셈이 범위를 m 배 하고 덧셈은 영향이 없음을 이용해 두 범위의 비를 구해야 함 — medium 은 한 집단의 범위",
      concepts: ["히스토그램", "범위", "자료 변환"],
      gen(rng) {
        let s = makeHist2(rng, { differ: true }); let small = 0, m = 0, found = false;
        for (let t = 0; t < 300 && !found; t++) { s = makeHist2(rng, { differ: true }); const r = [gp(s, 0), gp(s, 1)]; const l = r[0] < r[1] ? 0 : 1; if (r[1 - l] % r[l] === 0 && r[1 - l] / r[l] >= 2) { small = l; m = r[1 - l] / r[l]; found = true; } }
        if (!found) throw new GenFail("ratio"); const big = 1 - small;
        return gInst(rng, {
          stimulus: `${hist2Intro(rng, s)} Every value in the ${s.names[small]} data is multiplied by a positive whole number $m$.`,
          question: rng.pick([`For what value of $m$ will the greatest possible range of the ${s.names[small]} data equal the greatest possible range of the ${s.names[big]} data?`, `What value of $m$ makes the two greatest possible ranges equal?`]), correct: m,
          wrongs: pos([W(gp(s, big) - gp(s, small), "formula_misuse", "범위의 차를 답했다."), W(gp(s, small), "step_missing", "작은 범위를 답했다."), W(gp(s, big), "step_missing", "큰 범위를 답했다."), W(m + 1, "other", "하나 더 올렸다."), W(m - 1, "other", "하나 덜 갔다.")]).filter((w) => w.v !== m && w.v > 0),
          verificationJs: figJs({ ns: s.names[small], nb: s.names[big] }, s.fig, `${HIST2_JS}const a=nm.indexOf(P.ns), b=nm.indexOf(P.nb); if (a<0||b<0) throw new Error('이름 없음'); if (gp(b)%gp(a)!==0) throw new Error('정수배 아님'); return gp(b)/gp(a);`),
          trace: [hist2Read(s), [`범위: ${s.names[small]} ${gp(s, small)}, ${s.names[big]} ${gp(s, big)} 이다.`, "Compute the ranges."], [`곱하면 범위가 m 배가 되므로 ${gp(s, small)} × m = ${gp(s, big)} 이다.`, "Multiplying scales the range."], [`m = ${gp(s, big)} ÷ ${gp(s, small)} = ${m} 이다.`, "Solve for m."], [`따라서 m = ${m} 이다.`, "State m."]], variant: "scale_to_match_range",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "read_top_edge", structure: "한 집단의 히스토그램에서 높이가 있는 가장 오른쪽 구간의 오른쪽 끝을 읽음", extra: "easy: 마지막 경계 읽기", concepts: ["히스토그램", "구간 경계"],
      gen(rng) {
        const s = makeHist2(rng); const i = rng.int(0, 1);
        return gInst(rng, { stimulus: hist2Intro(rng, s), question: `What is the right endpoint of the last interval that has any values in the ${s.names[i]} data, in ${s.t.unit}?`, correct: hi(s, i), wrongs: pos([W(lo(s, i), "axis_misread", "첫 경계를 읽었다."), W(hi(s, 1 - i), "axis_misread", "다른 집단의 경계를 읽었다."), W(hi(s, i) - s.t.w, "axis_misread", "한 칸 어긋나게 읽었다."), W(hi(s, i) + s.t.w, "axis_misread", "한 칸 어긋나게 읽었다.")]).filter((w) => w.v !== hi(s, i)), verificationJs: figJs({ n: s.names[i] }, s.fig, `${HIST2_JS}const i=nm.indexOf(P.n); if (i<0) throw new Error('이름 없음'); return hi(i);`), trace: [hist2Read(s), [`${s.names[i]} 에서 높이가 있는 가장 오른쪽 구간의 오른쪽 끝은 ${hi(s, i)} 이다.`, "Right edge of the last occupied interval."]], variant: "read_top_edge_hist",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "greatest_range", structure: "한 집단의 히스토그램에서 가능한 가장 큰 범위를 구함", extra: "medium: 마지막 경계 - 첫 경계", concepts: ["히스토그램", "범위"],
      gen(rng) {
        const s = makeHist2(rng); const i = rng.int(0, 1);
        return gInst(rng, { stimulus: hist2Intro(rng, s), question: `What is the greatest possible range of the ${s.names[i]} data, in ${s.t.unit}?`, correct: gp(s, i), wrongs: pos([W(gp(s, 1 - i), "axis_misread", "다른 집단의 범위를 답했다."), W(gp(s, i) - s.t.w, "formula_misuse", "왼쪽 끝끼리 뺐다."), W(gp(s, i) + s.t.w, "other", "구간 하나를 더 셌다."), W(hi(s, i), "step_missing", "마지막 경계만 답했다.")]).filter((w) => w.v !== gp(s, i)), verificationJs: figJs({ n: s.names[i] }, s.fig, `${HIST2_JS}const i=nm.indexOf(P.n); if (i<0) throw new Error('이름 없음'); return gp(i);`), trace: [hist2Read(s), [`가능한 가장 큰 범위 = ${hi(s, i)} - ${lo(s, i)} = ${gp(s, i)} 이다.`, "Greatest possible range."], [`높이가 0 인 구간은 포함하지 않는다.`, "Skip empty intervals."]], variant: "greatest_range_from_edges",
        }, s.fig);
      },
    },
  ],
});
