// one_variable_data.spread_comparison.BX.P — 두 집단의 상자그림에서 퍼짐(범위·사분범위)을 비교한다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { BX_JS, bxIntro2, bxRead, makeBox, gInst } from "../data-kit";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v >= 0);
const iqr = (b: { q1: number; q3: number }) => b.q3 - b.q1;

export const ITEM = defineItem({
  prefix: "ovd", itemId: "one_variable_data.spread_comparison.BX.P",
  hard: [
    {
      op: "compare_scenarios", structure: "두 집단의 상자그림에서 사분범위를 각각 읽어 차를 구함", extra: "각 상자의 폭(Q3 − Q1)을 같은 눈금에서 읽어 비교해야 함(꼬리 길이=범위와 혼동하는 함정) — medium 은 한 집단의 사분범위",
      concepts: ["상자그림", "사분범위", "퍼짐 비교"],
      gen(rng) {
        const s = makeBox(rng, { groups: 2 }); const [a, b] = s.boxes; if (iqr(a) === iqr(b)) throw new GenFail("same"); const correct = Math.abs(iqr(a) - iqr(b));
        return gInst(rng, {
          stimulus: bxIntro2(rng, s),
          question: rng.pick([`What is the positive difference between the interquartile ranges of the two groups, in ${s.t.unit}?`, `By how many ${s.t.unit} do the interquartile ranges of the two data sets differ?`]), correct,
          wrongs: pos([W(Math.abs((a.max - a.min) - (b.max - b.min)), "formula_misuse", "범위의 차를 구했다."), W(Math.abs(a.median - b.median), "formula_misuse", "중앙값의 차를 구했다."), W(iqr(a) + iqr(b), "sign_error", "사분범위의 합을 구했다."), W(Math.abs(a.q3 - b.q3), "formula_misuse", "Q3 의 차를 구했다."), W(correct + s.s, "other", "눈금 한 칸 어긋났다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({}, s.fig, `${BX_JS}if (B.length!==2) throw new Error('상자 둘 아님'); return Math.abs((B[0].q3-B[0].q1)-(B[1].q3-B[1].q1));`),
          trace: [bxRead(s, 0), bxRead(s, 1), [`사분범위: ${s.names[0]} ${a.q3} - ${a.q1} = ${iqr(a)}, ${s.names[1]} ${b.q3} - ${b.q1} = ${iqr(b)} 이다.`, "Compute each IQR."], [`차 = |${iqr(a)} - ${iqr(b)}| = ${correct} 이다.`, "Take the positive difference."], [`따라서 두 사분범위는 ${correct} ${s.t.unit} 만큼 다르다.`, "State the difference."]], variant: "iqr_gap_between_groups",
        }, s.fig);
      },
    },
    {
      op: "chain2", structure: "두 집단의 사분범위를 구한 뒤 합을 구함", extra: "두 상자 폭을 각각 읽어 더하는 연쇄(차와 혼동하는 함정) — medium 은 한 집단의 사분범위",
      concepts: ["상자그림", "사분범위", "합"],
      gen(rng) {
        const s = makeBox(rng, { groups: 2 }); const [a, b] = s.boxes; const correct = iqr(a) + iqr(b);
        return gInst(rng, {
          stimulus: bxIntro2(rng, s),
          question: rng.pick([`What is the sum of the interquartile ranges of the two groups, in ${s.t.unit}?`, `If the interquartile ranges of the two groups are added, what is the total, in ${s.t.unit}?`]), correct,
          wrongs: pos([W(Math.abs(iqr(a) - iqr(b)), "sign_error", "차를 구했다."), W((a.max - a.min) + (b.max - b.min), "formula_misuse", "범위의 합을 구했다."), W(iqr(a), "step_missing", "한 집단만 답했다."), W(iqr(b), "step_missing", "한 집단만 답했다."), W(correct + s.s, "other", "눈금 한 칸 어긋났다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({}, s.fig, `${BX_JS}if (B.length!==2) throw new Error('상자 둘 아님'); return (B[0].q3-B[0].q1)+(B[1].q3-B[1].q1);`),
          trace: [bxRead(s, 0), bxRead(s, 1), [`${s.names[0]} 사분범위 = ${a.q3} - ${a.q1} = ${iqr(a)} 이다.`, "First IQR."], [`${s.names[1]} 사분범위 = ${b.q3} - ${b.q1} = ${iqr(b)} 이다.`, "Second IQR."], [`합 = ${iqr(a)} + ${iqr(b)} = ${correct} 이다.`, "Add."]], variant: "sum_of_iqrs",
        }, s.fig);
      },
    },
    {
      op: "inverse", structure: "첫 집단의 최댓값이 k 만큼 늘어 범위가 둘째 집단의 범위와 같아질 때 k 를 역산", extra: "두 범위를 읽고 부족한 만큼을 거꾸로 구해야 함 — medium 은 한 집단의 범위",
      concepts: ["상자그림", "범위", "역산"],
      gen(rng) {
        const s = makeBox(rng, { groups: 2 }); const r = s.boxes.map((x) => x.max - x.min); if (r[0] === r[1]) throw new GenFail("same"); const lo = r[0] < r[1] ? 0 : 1, hi = 1 - lo; const ra = r[lo], rb = r[hi]; const correct = rb - ra; const nl = s.names[lo], nh = s.names[hi]; const a = s.boxes[lo], b = s.boxes[hi];
        return gInst(rng, {
          stimulus: `${bxIntro2(rng, s)} ${rng.pick([`Suppose the greatest value of the ${nl} data increases by $k$ ${s.t.unit}, where $k$ is a constant, and the rest of that data set stays the same.`, `Imagine that only the maximum of the ${nl} data increases by $k$ ${s.t.unit}.`])}`,
          question: rng.pick([`For what value of $k$ does the range of the ${nl} data become equal to the range of the ${nh} data?`, `What is $k$ if the two groups then have equal ranges?`]), correct,
          wrongs: pos([W(rb, "step_missing", "범위가 큰 집단의 범위를 답했다."), W(ra, "step_missing", "범위가 작은 집단의 범위를 답했다."), W(ra + rb, "sign_error", "범위의 합을 답했다."), W(Math.abs(iqr(a) - iqr(b)), "formula_misuse", "사분범위의 차를 구했다."), W(correct + s.s, "other", "눈금 한 칸 어긋났다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({ nl, nh }, s.fig, `${BX_JS}const x=B.find(q=>q.name===P.nl), y=B.find(q=>q.name===P.nh); if (!x||!y) throw new Error('이름 없음'); const k=(y.max-y.min)-(x.max-x.min); if (k<=0) throw new Error('늘릴 필요 없음'); return k;`),
          trace: [bxRead(s, 0), bxRead(s, 1), [`범위: ${nl} ${ra}, ${nh} ${rb} 이다.`, "Compute the ranges."], [`${nl} 의 최댓값이 k 늘면 범위는 ${ra} + k 이다.`, "The new range of the smaller-range group."], [`${ra} + k = ${rb} 에서 k = ${correct} 이다.`, "Solve for k."]], variant: "increase_to_match_range",
        }, s.fig);
      },
    },
    {
      op: "param_condition", structure: "첫 집단의 모든 값에 m 배를 하면 사분범위가 둘째 집단의 사분범위와 같아지는 양의 정수 m 을 구함", extra: "곱셈이 사분범위를 m 배 하고 덧셈은 영향이 없음을 이용해 두 사분범위의 비를 구해야 함 — medium 은 한 집단의 사분범위",
      concepts: ["상자그림", "사분범위", "자료 변환"],
      gen(rng) {
        let s = makeBox(rng, { groups: 2 }); let lo = 0, m = 0; let found = false;
        for (let t = 0; t < 300 && !found; t++) { s = makeBox(rng, { groups: 2 }); const q = s.boxes.map(iqr); if (q[0] === q[1]) continue; const l = q[0] < q[1] ? 0 : 1; if (q[1 - l] % q[l] === 0 && q[1 - l] / q[l] >= 2) { lo = l; m = q[1 - l] / q[l]; found = true; } }
        if (!found) throw new GenFail("ratio"); const a = s.boxes[lo], b = s.boxes[1 - lo]; const ia = iqr(a), ib = iqr(b); const nl = s.names[lo], nh = s.names[1 - lo];
        return gInst(rng, {
          stimulus: `${bxIntro2(rng, s)} Every value in the ${nl} data is multiplied by a positive whole number $m$.`,
          question: rng.pick([`For what value of $m$ will the interquartile range of the ${nl} data equal the interquartile range of the ${nh} data?`, `What value of $m$ makes the two interquartile ranges equal?`]), correct: m,
          wrongs: pos([W(ib - ia, "formula_misuse", "사분범위의 차를 답했다."), W(ia, "step_missing", "첫 집단의 사분범위를 답했다."), W(ib, "step_missing", "둘째 집단의 사분범위를 답했다."), W(m + 1, "other", "하나 더 올렸다."), W(m - 1, "other", "하나 덜 갔다.")]).filter((w) => w.v !== m && w.v > 0),
          verificationJs: figJs({ nl, nh }, s.fig, `${BX_JS}const x=B.find(q=>q.name===P.nl), y=B.find(q=>q.name===P.nh); if (!x||!y) throw new Error('이름 없음'); const ia=x.q3-x.q1, ib=y.q3-y.q1; if (ib%ia!==0) throw new Error('정수배 아님'); return ib/ia;`),
          trace: [bxRead(s, 0), bxRead(s, 1), [`사분범위: ${nl} ${ia}, ${nh} ${ib} 이다.`, "Compute the IQRs."], [`곱하면 사분범위가 m 배가 되므로 ${ia} × m = ${ib} 이다.`, "Multiplying scales the IQR."], [`m = ${ib} ÷ ${ia} = ${m} 이다.`, "Solve for m."]], variant: "scale_to_match_iqr",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "read_iqr", structure: "한 집단의 상자 양끝(Q1·Q3)을 읽어 사분범위를 구함", extra: "easy: Q3 - Q1", concepts: ["상자그림", "사분범위"],
      gen(rng) {
        const s = makeBox(rng, { groups: 2 }); const [a] = s.boxes;
        return gInst(rng, { stimulus: bxIntro2(rng, s), question: `What is the interquartile range of the ${s.names[0]} data, in ${s.t.unit}?`, correct: iqr(a), wrongs: pos([W(a.max - a.min, "formula_misuse", "범위를 구했다."), W(a.median - a.q1, "formula_misuse", "상자의 왼쪽 절반만 구했다."), W(a.q3, "step_missing", "Q3 만 답했다."), W(iqr(a) + s.s, "other", "눈금 한 칸 어긋났다.")]).filter((w) => w.v !== iqr(a)), verificationJs: figJs({ nm: s.names[0] }, s.fig, `${BX_JS}const b=B.find(x=>x.name===P.nm); if (!b) throw new Error('이름 없음'); return b.q3-b.q1;`), trace: [bxRead(s, 0), [`사분범위 = ${a.q3} - ${a.q1} = ${iqr(a)} 이다.`, "IQR = Q3 - Q1."]], variant: "read_group_iqr",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "wider_group_range", structure: "두 집단 중 범위가 더 큰 집단의 범위를 구함", extra: "medium: 두 범위 비교", concepts: ["상자그림", "범위", "비교"],
      gen(rng) {
        const s = makeBox(rng, { groups: 2 }); const [a, b] = s.boxes; const ra = a.max - a.min, rb = b.max - b.min; if (ra === rb) throw new GenFail("same"); const m = Math.max(ra, rb);
        return gInst(rng, { stimulus: bxIntro2(rng, s), question: `What is the greater of the two ranges, in ${s.t.unit}?`, correct: m, wrongs: pos([W(Math.min(ra, rb), "opposite", "더 작은 범위를 답했다."), W(ra + rb, "sign_error", "합을 구했다."), W(Math.max(iqr(a), iqr(b)), "formula_misuse", "사분범위 중 큰 값을 답했다."), W(m + s.s, "other", "눈금 한 칸 어긋났다.")]).filter((w) => w.v !== m), verificationJs: figJs({}, s.fig, `${BX_JS}if (B.length!==2) throw new Error('상자 둘 아님'); return Math.max(B[0].max-B[0].min, B[1].max-B[1].min);`), trace: [bxRead(s, 0), bxRead(s, 1), [`범위: ${ra}, ${rb} 이다. 더 큰 것은 ${m} 이다.`, "Compare the two ranges."]], variant: "greater_range",
        }, s.fig);
      },
    },
  ],
});
