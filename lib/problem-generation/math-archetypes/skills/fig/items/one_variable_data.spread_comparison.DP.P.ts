// one_variable_data.spread_comparison.DP.P — 두 점도표(같은 가로 눈금)에서 두 집단의 퍼짐(범위)을 비교한다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst } from "../graph-kit";
import { DOT2_JS, dot2Intro, dot2Read, makeDot2, type Dot2 } from "../dot2-kit";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v >= 0);
const lo = (s: Dot2, i: number) => Math.min(...s.vals.filter((_, j) => s.freqs[i][j] > 0)), hi = (s: Dot2, i: number) => Math.max(...s.vals.filter((_, j) => s.freqs[i][j] > 0));
const rg = (s: Dot2, i: number) => hi(s, i) - lo(s, i);

export const ITEM = defineItem({
  prefix: "ovd", itemId: "one_variable_data.spread_comparison.DP.P",
  hard: [
    {
      op: "compare_scenarios", structure: "두 점도표에서 가장 왼쪽·오른쪽 점을 읽어 각 범위를 구하고 차를 구함", extra: "두 그림의 양 끝 점(최솟값·최댓값)을 같은 눈금에서 읽어 비교해야 함(점이 가장 높이 쌓인 값과 혼동하는 함정) — medium 은 한 집단의 범위",
      concepts: ["점도표", "범위", "두 집단 비교"],
      gen(rng) {
        const s = makeDot2(rng, { differ: true }); const correct = Math.abs(rg(s, 0) - rg(s, 1));
        return gInst(rng, {
          stimulus: dot2Intro(rng, s),
          question: rng.pick([`What is the positive difference between the range of the ${s.names[0]} data and the range of the ${s.names[1]} data, in ${s.t.unit}?`, `By how many ${s.t.unit} do the ranges of the two samples differ?`]), correct,
          wrongs: pos([W(rg(s, 0) + rg(s, 1), "sign_error", "범위의 합을 구했다."), W(Math.abs(hi(s, 0) - hi(s, 1)), "formula_misuse", "최댓값의 차를 구했다."), W(Math.abs(lo(s, 0) - lo(s, 1)), "formula_misuse", "최솟값의 차를 구했다."), W(rg(s, 0), "step_missing", "한 집단의 범위만 답했다."), W(correct + s.t.step, "other", "눈금 한 칸 어긋났다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({}, s.fig, `${DOT2_JS}return Math.abs(rg(0)-rg(1));`),
          trace: [dot2Read(s), [`범위: ${s.names[0]} ${hi(s, 0)} - ${lo(s, 0)} = ${rg(s, 0)}, ${s.names[1]} ${hi(s, 1)} - ${lo(s, 1)} = ${rg(s, 1)} 이다.`, "Compute each range."], [`차 = |${rg(s, 0)} - ${rg(s, 1)}| = ${correct} 이다.`, "Take the positive difference."], [`점이 하나도 없는 값은 범위에 들어가지 않는다.`, "Values with no dots do not count."], [`따라서 ${correct} ${s.t.unit} 만큼 다르다.`, "State the difference."]], variant: "range_gap_between_dot_plots",
        }, s.fig);
      },
    },
    {
      op: "chain2", structure: "두 집단을 합친 전체 값의 범위를 구한 뒤, 첫 집단의 범위와의 차를 구함", extra: "합친 최솟값·최댓값(두 그림에서 가장 바깥 점)을 찾아 연결해야 함 — medium 은 한 집단의 범위",
      concepts: ["점도표", "범위", "합친 자료"],
      gen(rng) {
        const s = makeDot2(rng); const all = Math.max(hi(s, 0), hi(s, 1)) - Math.min(lo(s, 0), lo(s, 1)); const correct = all - rg(s, 0); if (correct <= 0) throw new GenFail("same");
        return gInst(rng, {
          stimulus: dot2Intro(rng, s),
          question: rng.pick([`How many ${s.t.unit} greater is the range of all the values in both plots combined than the range of the ${s.names[0]} data?`, `If the two samples are combined, by how many ${s.t.unit} does the range of the combined data exceed the range of the ${s.names[0]} data?`]), correct,
          wrongs: pos([W(all, "step_missing", "합친 범위만 답했다."), W(rg(s, 0), "step_missing", "첫 집단의 범위만 답했다."), W(rg(s, 1), "step_missing", "둘째 집단의 범위만 답했다."), W(all - rg(s, 1), "formula_misuse", "둘째 집단과 비교했다."), W(correct + s.t.step, "other", "눈금 한 칸 어긋났다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({ n0: s.names[0] }, s.fig, `${DOT2_JS}const i=nm.indexOf(P.n0); if (i<0) throw new Error('이름 없음'); return (Math.max(mx(0),mx(1))-Math.min(mn(0),mn(1)))-rg(i);`),
          trace: [dot2Read(s), [`합친 최솟값 ${Math.min(lo(s, 0), lo(s, 1))}, 합친 최댓값 ${Math.max(hi(s, 0), hi(s, 1))} 이다.`, "Combined extremes."], [`합친 범위 = ${all} 이고 ${s.names[0]} 범위 = ${rg(s, 0)} 이다.`, "Combined range and the first range."], [`차 = ${all} - ${rg(s, 0)} = ${correct} 이다.`, "Subtract."], [`따라서 ${correct} ${s.t.unit} 더 크다.`, "State the difference."]], variant: "combined_range_minus_first",
        }, s.fig);
      },
    },
    {
      op: "inverse", structure: "범위가 더 작은 집단의 최댓값이 k 만큼 늘어 두 범위가 같아질 때 k 를 역산", extra: "두 범위를 읽고 부족한 만큼을 거꾸로 구해야 함 — medium 은 한 집단의 범위",
      concepts: ["점도표", "범위", "역산"],
      gen(rng) {
        const s = makeDot2(rng, { differ: true }); const small = rg(s, 0) < rg(s, 1) ? 0 : 1; const big = 1 - small; const correct = rg(s, big) - rg(s, small);
        return gInst(rng, {
          stimulus: `${dot2Intro(rng, s)} ${rng.pick([`Suppose the greatest value in the ${s.names[small]} data increases by $k$ ${s.t.unit}, where $k$ is a constant, and the rest of that data stays the same.`, `Imagine that only the maximum of the ${s.names[small]} data increases by $k$ ${s.t.unit}.`])}`,
          question: rng.pick([`For what value of $k$ does the range of the ${s.names[small]} data become equal to the range of the ${s.names[big]} data?`, `What is $k$ if the two samples then have equal ranges?`]), correct,
          wrongs: pos([W(rg(s, big), "step_missing", "범위가 큰 집단의 범위를 답했다."), W(rg(s, small), "step_missing", "범위가 작은 집단의 범위를 답했다."), W(rg(s, 0) + rg(s, 1), "sign_error", "범위의 합을 답했다."), W(Math.abs(hi(s, 0) - hi(s, 1)), "formula_misuse", "최댓값의 차를 구했다."), W(correct + s.t.step, "other", "눈금 한 칸 어긋났다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({ ns: s.names[small], nb: s.names[big] }, s.fig, `${DOT2_JS}const a=nm.indexOf(P.ns), b=nm.indexOf(P.nb); if (a<0||b<0) throw new Error('이름 없음'); const k=rg(b)-rg(a); if (k<=0) throw new Error('늘릴 필요 없음'); return k;`),
          trace: [dot2Read(s), [`범위: ${s.names[small]} ${rg(s, small)}, ${s.names[big]} ${rg(s, big)} 이다.`, "Compute the ranges."], [`${s.names[small]} 의 최댓값이 k 늘면 범위는 ${rg(s, small)} + k 이다.`, "The smaller range after the increase."], [`${rg(s, small)} + k = ${rg(s, big)} 에서 k = ${correct} 이다.`, "Solve for k."], [`따라서 k = ${correct} 이다.`, "State k."]], variant: "increase_to_match_range",
        }, s.fig);
      },
    },
    {
      op: "param_condition", structure: "범위가 더 작은 집단의 모든 값에 m 배를 하면 두 범위가 같아지는 양의 정수 m 을 구함", extra: "곱셈이 범위를 m 배 하고 덧셈은 영향이 없음을 이용해 두 범위의 비를 구해야 함 — medium 은 한 집단의 범위",
      concepts: ["점도표", "범위", "자료 변환"],
      gen(rng) {
        let s = makeDot2(rng, { differ: true }); let small = 0, m = 0, found = false;
        for (let t = 0; t < 300 && !found; t++) { s = makeDot2(rng, { differ: true }); const r = [rg(s, 0), rg(s, 1)]; const l = r[0] < r[1] ? 0 : 1; if (r[1 - l] % r[l] === 0 && r[1 - l] / r[l] >= 2) { small = l; m = r[1 - l] / r[l]; found = true; } }
        if (!found) throw new GenFail("ratio"); const big = 1 - small;
        return gInst(rng, {
          stimulus: `${dot2Intro(rng, s)} Every value in the ${s.names[small]} data is multiplied by a positive whole number $m$.`,
          question: rng.pick([`For what value of $m$ will the range of the ${s.names[small]} data equal the range of the ${s.names[big]} data?`, `What value of $m$ makes the two ranges equal?`]), correct: m,
          wrongs: pos([W(rg(s, big) - rg(s, small), "formula_misuse", "범위의 차를 답했다."), W(rg(s, small), "step_missing", "작은 범위를 답했다."), W(rg(s, big), "step_missing", "큰 범위를 답했다."), W(m + 1, "other", "하나 더 올렸다."), W(m - 1, "other", "하나 덜 갔다.")]).filter((w) => w.v !== m && w.v > 0),
          verificationJs: figJs({ ns: s.names[small], nb: s.names[big] }, s.fig, `${DOT2_JS}const a=nm.indexOf(P.ns), b=nm.indexOf(P.nb); if (a<0||b<0) throw new Error('이름 없음'); if (rg(b)%rg(a)!==0) throw new Error('정수배 아님'); return rg(b)/rg(a);`),
          trace: [dot2Read(s), [`범위: ${s.names[small]} ${rg(s, small)}, ${s.names[big]} ${rg(s, big)} 이다.`, "Compute the ranges."], [`곱하면 범위가 m 배가 되므로 ${rg(s, small)} × m = ${rg(s, big)} 이다.`, "Multiplying scales the range."], [`m = ${rg(s, big)} ÷ ${rg(s, small)} = ${m} 이다.`, "Solve for m."], [`따라서 m = ${m} 이다.`, "State m."]], variant: "scale_to_match_range",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "read_max", structure: "한 집단의 점도표에서 가장 오른쪽 점의 값(최댓값)을 읽음", extra: "easy: 최댓값 읽기", concepts: ["점도표", "최댓값"],
      gen(rng) {
        const s = makeDot2(rng); const i = rng.int(0, 1);
        return gInst(rng, { stimulus: dot2Intro(rng, s), question: `What is the greatest value in the ${s.names[i]} data, in ${s.t.unit}?`, correct: hi(s, i), wrongs: pos([W(lo(s, i), "axis_misread", "최솟값을 읽었다."), W(hi(s, 1 - i), "axis_misread", "다른 집단의 최댓값을 읽었다."), W(hi(s, i) - s.t.step, "axis_misread", "눈금 한 칸 어긋나게 읽었다."), W(s.vals[s.freqs[i].indexOf(Math.max(...s.freqs[i]))], "axis_misread", "가장 높게 쌓인 값을 답했다.")]).filter((w) => w.v !== hi(s, i)), verificationJs: figJs({ n: s.names[i] }, s.fig, `${DOT2_JS}const i=nm.indexOf(P.n); if (i<0) throw new Error('이름 없음'); return mx(i);`), trace: [dot2Read(s), [`${s.names[i]} 의 가장 오른쪽 점은 ${hi(s, i)} 이다.`, "The rightmost dot."]], variant: "read_max_dot",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "range", structure: "한 집단의 점도표에서 최댓값과 최솟값을 읽어 범위를 구함", extra: "medium: 최댓값 - 최솟값", concepts: ["점도표", "범위"],
      gen(rng) {
        const s = makeDot2(rng); const i = rng.int(0, 1);
        return gInst(rng, { stimulus: dot2Intro(rng, s), question: `What is the range of the ${s.names[i]} data, in ${s.t.unit}?`, correct: rg(s, i), wrongs: pos([W(hi(s, i), "step_missing", "최댓값을 답했다."), W(rg(s, 1 - i), "axis_misread", "다른 집단의 범위를 답했다."), W(rg(s, i) + s.t.step, "other", "눈금 한 칸 어긋났다."), W(s.vals[s.vals.length - 1] - s.vals[0], "axis_misread", "축 전체 길이를 답했다.")]).filter((w) => w.v !== rg(s, i)), verificationJs: figJs({ n: s.names[i] }, s.fig, `${DOT2_JS}const i=nm.indexOf(P.n); if (i<0) throw new Error('이름 없음'); return rg(i);`), trace: [dot2Read(s), [`범위 = ${hi(s, i)} - ${lo(s, i)} = ${rg(s, i)} 이다.`, "Range = max − min."], [`점이 없는 값은 포함하지 않는다.`, "Skip values with no dots."]], variant: "range_from_dots",
        }, s.fig);
      },
    },
  ],
});
