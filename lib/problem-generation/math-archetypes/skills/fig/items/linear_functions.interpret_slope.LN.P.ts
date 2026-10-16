// linear_functions.interpret_slope.LN.P — 그래프로 주어진 일차 관계의 변화율(기울기)이 문맥에서 무엇을 뜻하는지 해석해 쓰는 문항.
import { GenFail } from "../../../types";
import { fmtNum } from "../../../text";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem, MC_ONLY_STATEMENT, statementInst } from "../item-kit";
import { gInst, capFirst, sing, GL_JS, glIntro, glRead, makeLinGraph, type LinGraph } from "../graph-kit";

const oneDec = (n: number) => Math.abs(n * 10 - Math.round(n * 10)) < 1e-9;
const up = (s: LinGraph) => (s.m > 0 ? "increases" : "decreases");
const sentence = (s: LinGraph, by: string, per: string) => `${capFirst(s.yq)} ${up(s)} by ${by} ${s.t.yu} for each increase of ${per} in ${s.xq}.`;

export const ITEM = defineItem({
  prefix: "lf", itemId: "linear_functions.interpret_slope.LN.P",
  hard: [
    {
      op: "repr_shift", structure: "그래프의 두 점에서 변화율을 구하고 그 수가 문맥에서 뜻하는 바를 서술 네 개 중에서 고름", extra: "기울기를 계산한 뒤 '1 단위당 변화' 라는 해석을 선지 문장과 대조해야 함(두 점 사이의 변화·역수·처음 값과 혼동하는 서술이 함정) — medium 은 기울기 값",
      concepts: ["그래프의 두 점", "기울기", "기울기의 문맥 해석"], sprNo: MC_ONLY_STATEMENT,
      gen(rng) {
        const s = makeLinGraph(rng, { noZeroX: true }); if (s.d === 1) throw new GenFail("d=1 이면 두 점 사이 한 구간 함정이 없음");
        const am = Math.abs(s.m); const one = `1 ${sing(s.t.xu)}`; const tpl = sentence(s, "#", one);
        const correct = tpl.replace("#", fmtNum(am));
        const wrongs = [
          { text: tpl.replace("#", fmtNum(am * s.d)), reason: "두 점 사이의 변화를 1 단위당 변화로 보았다." },
          { text: `${capFirst(s.xq)} increases by ${fmtNum(am)} ${s.t.xu} for each change of 1 ${sing(s.t.yu)} in ${s.yq}.`, reason: "두 양의 역할을 바꿨다." },
          { text: `When ${s.xq} is 0 ${s.t.xu}, ${s.yq} is ${fmtNum(am)} ${s.t.yu}.`, reason: "기울기를 처음 값(절편)으로 해석했다." },
        ];
        return statementInst(rng, {
          stimulus: glIntro(rng, s), question: `Which statement best describes the rate of change of the relationship shown in the graph?`, correct, wrongs, figure: s.fig, P: { tpl },
          body: `${GL_JS}const want = P.tpl.replace('#', String(Math.round(Math.abs(m) * 100) / 100)); const i = P.options.indexOf(want); if (i < 0) throw new Error('맞는 서술 없음'); return i;`,
          trace: [...glRead(s), [`기울기의 크기는 ${fmtNum(am)}, ${s.m > 0 ? "양수(증가)" : "음수(감소)"} 이다.`, "Sign and size of the slope."], [`두 점의 x 간격은 ${s.d} 이므로 그 사이의 변화(${fmtNum(am * s.d)})는 1 단위당 변화가 아니다.`, "One row is not one unit."], [`기울기는 x 가 1 늘 때 y 의 변화량을 뜻한다.`, "Slope means change per one unit."], [`따라서 '${fmtNum(am)} ${s.t.yu} 씩 ${s.m > 0 ? "증가" : "감소"}' 서술이 맞다.`, "Choose the matching statement."]], variant: "meaning_of_slope",
        });
      },
    },
    {
      op: "unit_ratio", structure: "그래프에서 1 단위당 변화를 구하고, 지문이 묻는 K 단위 묶음당 변화로 바꿈", extra: "기울기의 뜻(1 단위당)을 K 단위로 확장해야 함(두 점 사이 한 구간과 K 가 다름) — medium 은 1 단위당 변화",
      concepts: ["그래프의 두 점", "기울기의 뜻", "비례 확장"],
      gen(rng) {
        const s = makeLinGraph(rng); const K = rng.pick([4, 6, 8, 10, 12, 15, 20]); if (K === s.d) throw new GenFail("same"); const correct = Math.abs(s.m) * K; if (correct > 900) throw new GenFail("big");
        return gInst(rng, {
          stimulus: `${glIntro(rng, s)}`,
          question: `Based on the rate of change, by how many ${s.t.yu} does ${s.yq} ${s.m > 0 ? "increase" : "decrease"} for every increase of ${K} ${s.t.xu} in ${s.xq}?`, correct,
          wrongs: [W(Math.abs(s.m), "step_missing", "1 단위당 변화만 답했다."), W(Math.abs(s.m) * s.d * K, "unit_error", "두 점 사이의 변화를 1 단위당 변화로 보았다."), W(Math.abs(s.m * K + s.b), "formula_misuse", "처음 값을 더했다."), W(Math.round(K / Math.abs(s.m)) || 1, "formula_misuse", "K 를 기울기로 나눴다."), W(correct + Math.abs(s.m), "other", "한 단위 더 셌다.")],
          verificationJs: figJs({ K }, s.fig, `${GL_JS}return Math.abs(m) * P.K;`),
          trace: [...glRead(s), [`기울기는 x 가 1 늘 때의 변화(${fmtNum(Math.abs(s.m))})를 뜻한다.`, "Interpret the slope."], [`x 가 ${K} 늘면 변화는 ${K} 배이다.`, "Scale to K units."], [`${fmtNum(Math.abs(s.m))} × ${K} = ${correct} 이다.`, "Compute."]], variant: "change_per_K_units",
        }, s.fig);
      },
    },
    {
      op: "compare_scenarios", structure: "그래프의 1 단위당 변화와, 'q 단위마다 r 씩' 으로 주어진 두 번째 관계의 1 단위당 변화를 비교해 차를 구함", extra: "두 번째 관계의 변화율을 1 단위당으로 환산해야 비교가 됨(r 을 그대로 비교하면 오답) — medium 은 그래프의 기울기",
      concepts: ["그래프의 두 점", "단위당 변화율 비교", "비율 환산"],
      gen(rng) {
        const s = makeLinGraph(rng, { mSign: 1 }); const q = rng.pick([2, 4, 5, 10]); const r = q * rng.int(1, 14) + rng.pick([0, q / 2]); const r1 = r / q; if (r1 === s.m || !oneDec(r1)) throw new GenFail("same"); const correct = Math.abs(s.m - r1);
        return gInst(rng, {
          stimulus: `${glIntro(rng, s)} For a second linear relationship, ${s.yq} increases by ${fmtNum(r)} ${s.t.yu} every ${q} ${s.t.xu}.`,
          question: `What is the positive difference between the two rates of change, in ${s.t.yu} per ${sing(s.t.xu)}?`, correct, fmt: fmtNum,
          wrongs: [W(Math.abs(s.m - r), "unit_error", "두 번째 관계의 변화를 1 단위당으로 바꾸지 않았다."), W(Math.abs(s.m * s.d - r1), "unit_error", "두 점 사이의 변화를 1 단위당 변화로 보았다."), W(s.m + r1, "sign_error", "차가 아니라 합을 구했다."), W(Math.abs(s.m * q - r), "step_missing", "q 단위당 변화의 차를 답했다."), W(correct + 1, "other", "계산 중 어긋났다.")].filter((w) => oneDec(w.v) && w.v > 0),
          verificationJs: figJs({ r, q }, s.fig, `${GL_JS}return Math.abs(m - P.r / P.q);`),
          trace: [...glRead(s), [`두 번째 관계: ${fmtNum(r)} ÷ ${q} = ${fmtNum(r1)} (1 단위당) 이다.`, "Second rate per unit."], [`두 변화율을 같은 단위(1 ${sing(s.t.xu)}당)로 맞췄다.`, "Same units."], [`차 = |${fmtNum(s.m)} - ${fmtNum(r1)}| = ${fmtNum(correct)} 이다.`, "Difference of rates."]], variant: "compare_unit_rates",
        }, s.fig);
      },
    },
    {
      op: "constraint_select", structure: "그래프의 가장 오른쪽 점에서 출발해 1 단위당 변화로 값이 처음 T 를 넘는 데 필요한 최소 정수 단위 수를 구함", extra: "기울기의 뜻(단위당 증가)으로 필요한 증가량을 나누고 정수 조건(올림, 초과)을 적용해야 함 — medium 은 1 단위당 변화",
      concepts: ["그래프의 두 점", "기울기의 뜻", "정수 조건(올림)"],
      gen(rng) {
        const s = makeLinGraph(rng, { mSign: 1 }); const last = s.ys[s.ys.length - 1]; const T = last + rng.int(2, 12) * s.m + rng.int(0, s.m - 1); const need = T - last; const correct = Math.floor(need / s.m) + 1; if (T > 950) throw new GenFail("big");
        return gInst(rng, {
          stimulus: `${glIntro(rng, s)} Suppose the relationship continues to the right of the rightmost marked point.`,
          question: `Starting from the rightmost marked point on the graph, what is the least whole number of additional ${s.t.xu} after which ${s.yq} is greater than ${T} ${s.t.yu}?`, correct,
          wrongs: [W(Math.ceil(need / s.m) === correct ? correct - 1 : Math.ceil(need / s.m), "condition_ignored", "'초과' 를 '이상' 으로 보았다."), W(Math.floor(need / s.m), "condition_ignored", "내림만 했다."), W(Math.ceil(need / (s.m * s.d)), "unit_error", "두 점 사이의 변화를 1 단위당 변화로 보았다."), W(Math.ceil((T - s.b) / s.m), "step_missing", "그래프의 처음부터 셌다."), W(correct + 2, "other", "계산 중 어긋났다.")],
          verificationJs: figJs({ T }, s.fig, `${GL_JS}const x0 = xs[xs.length - 1]; for (let k = 0; k <= 5000; k++) if (m * (x0 + k) + b > P.T) return k; throw new Error('해 없음');`),
          trace: [...glRead(s), [`가장 오른쪽 점의 값은 ${last} 이다.`, "Last value in the graph."], [`${T} 를 넘으려면 ${need} 보다 많이 늘어야 한다.`, "Required increase."], [`${need} ÷ ${fmtNum(s.m)} = ${fmtNum(need / s.m)} 이고, 초과이므로 그보다 큰 가장 작은 정수를 잡는다.`, "Divide and apply the strict inequality."], [`답은 ${correct} 이다.`, "Least whole number."]], variant: "units_to_exceed_from_last_row",
        }, s.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "direction", structure: "그래프에서 값이 증가하는지 감소하는지와 두 점 사이의 변화를 읽어 두 점 사이의 변화를 고름", extra: "easy: 이웃한 두 점의 차", concepts: ["그래프", "변화"],
      gen(rng) {
        const s = makeLinGraph(rng); const D = s.m * s.d;
        return gInst(rng, { stimulus: glIntro(rng, s), question: `According to the graph, what is the change in ${s.yq}, in ${s.t.yu}, from the leftmost marked point to the next marked point to its right? (A decrease is negative.)`, correct: D, wrongs: [W(-D, "sign_error", "부호를 반대로 했다."), W(s.d, "axis_misread", "x 의 간격을 답했다."), W(s.ys[1], "axis_misread", "둘째 값을 답했다."), W(2 * D, "other", "두 점을 건넜다.")].filter((w) => w.v !== D), verificationJs: figJs({}, s.fig, `${GL_JS}return ys[1] - ys[0];`), trace: [[`첫 두 점: ${s.ys[0]}, ${s.ys[1]}.`, "Two adjacent rows."], [`변화 = ${s.ys[1]} - ${s.ys[0]} = ${D} 이다.`, "Signed difference."]], variant: "signed_row_change",
        }, s.fig);
      },
    },
    {
      lv: "medium", name: "per_unit", structure: "그래프에서 1 단위당 변화를 구함(점 간격이 1 이 아님)", extra: "medium: 두 점 사이 변화 ÷ 간격", concepts: ["그래프", "기울기의 뜻"],
      gen(rng) {
        const s = makeLinGraph(rng); if (s.d === 1) throw new GenFail("d"); const c = Math.abs(s.m);
        return gInst(rng, { stimulus: glIntro(rng, s), question: `By how many ${s.t.yu} does ${s.yq} change for each increase of 1 ${sing(s.t.xu)} in ${s.xq}?`, correct: c, wrongs: [W(c * s.d, "unit_error", "두 점 사이의 변화를 답했다."), W(c + s.d, "other", "간격을 더했다."), W(s.d, "axis_misread", "x 의 간격을 답했다."), W(c * 2, "other", "계산 중 어긋났다.")].filter((w) => w.v !== c), verificationJs: figJs({}, s.fig, `${GL_JS}return Math.abs(m);`), trace: [glRead(s)[0], [`점 간격 ${s.d} 동안 ${Math.abs(s.m * s.d)} 변한다.`, "Change over one row."], [`1 단위당 ${Math.abs(s.m * s.d)} ÷ ${s.d} = ${fmtNum(c)} 이다.`, "Divide by the gap."]], variant: "change_per_unit",
        }, s.fig);
      },
    },
  ],
});
