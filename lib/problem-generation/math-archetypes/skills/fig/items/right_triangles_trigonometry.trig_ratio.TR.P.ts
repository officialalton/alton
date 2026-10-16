// right_triangles_trigonometry.trig_ratio.TR.P — 직각삼각형 그림의 변 라벨에서 사인·코사인·탄젠트 비를 구하고, 빗변 구하기·두 비의 합·두 각 비교·역산으로 확장한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import type { DistractorKind } from "../../../../review";
import { frac } from "../../../text";
import { figJs } from "../../../figure-kit";
import { defineItem, SPR_OK } from "../item-kit";
import { gInst } from "../graph-kit";
import { RT_JS, makeRight, rtIntro, rtRead, type RTri } from "../tri-kit";

const FW = (n: number, d: number, kind: DistractorKind, reason: string) => ({ text: frac(n, d), kind, reason });
type Fn = "sin" | "cos" | "tan";
/** 꼭짓점 k(1: 밑변 오른쪽 끝, 2: 위) 의 각에 대한 비 [분자, 분모]. 밑변 B(v0-v1), 세로변 H(v0-v2), 빗변 C. */
function ratio(t: RTri, k: 1 | 2, fn: Fn): [number, number] {
  const [B, H] = t.legs; const C = t.hyp; const opp = k === 1 ? H : B, adj = k === 1 ? B : H;
  return fn === "sin" ? [opp, C] : fn === "cos" ? [adj, C] : [opp, adj];
}
const FN_JS = "const vk=(k)=>({opp:k===1?H:B, adj:k===1?B:H}); const rt=(k,f)=>{ const o=vk(k); return f==='sin'?o.opp/C:f==='cos'?o.adj/C:o.opp/o.adj; };\n";
const nameOf = (t: RTri, k: 1 | 2) => t.v[k];
const SPR_FRAC = "정답이 분수(또는 소수)로 쓰이는 하나의 수라 선택지 없이 낼 수 있다";
void SPR_OK; void SPR_FRAC;

function ask(rng: Rng, t: RTri, k: 1 | 2, fn: Fn) { return rng.pick([`What is the value of $\\${fn} ${nameOf(t, k)}$?`, `In triangle $${t.v.join("")}$, what is $\\${fn}$ of angle $${nameOf(t, k)}$?`, `What is $\\${fn}\\left(${nameOf(t, k)}\\right)$ for the angle at vertex $${nameOf(t, k)}$?`]); }

export const ITEM = defineItem({
  prefix: "rtt", itemId: "right_triangles_trigonometry.trig_ratio.TR.P",
  hard: [
    {
      op: "chain2", structure: "두 직각변 라벨로 빗변(x)을 구한 뒤 한 예각의 사인을 구함", extra: "빗변을 먼저 구해야 사인(대변 ÷ 빗변)을 계산할 수 있음(두 직각변의 비로 구하는 함정) — medium 은 사인",
      concepts: ["피타고라스 정리", "사인", "삼각비"],
      gen(rng) {
        const t = makeRight(rng, { unknown: "hyp" }); const k = rng.pick([1, 2] as const); const [n, d] = ratio(t, k, "sin");
        return gInst(rng, {
          stimulus: rtIntro(rng, t), question: ask(rng, t, k, "sin"), correctText: frac(n, d), range: [0, 100],
          wrongTexts: [FW(...ratio(t, k, "tan"), "formula_misuse", "탄젠트를 구했다."), FW(...ratio(t, k, "cos"), "opposite", "코사인을 구했다."), FW(...ratio(t, k === 1 ? 2 : 1, "sin"), "axis_misread", "다른 꼭짓점의 사인을 구했다."), FW(d, n, "formula_misuse", "비를 뒤집었다.")],
          verificationJs: figJs({ at: nameOf(t, k) }, t.fig, `${RT_JS}${FN_JS}const kk=FIGURE.vertices.indexOf(P.at); if (kk<1) throw new Error('꼭짓점 오류'); return rt(kk,'sin');`),
          trace: [rtRead(t), [`빗변 x = √(${t.legs[0]}² + ${t.legs[1]}²) = ${t.hyp} 이다.`, "Find the hypotenuse first."], [`${nameOf(t, k)} 에서 대변은 ${k === 1 ? t.legs[1] : t.legs[0]} 이다.`, "The opposite side."], [`sin = 대변 ÷ 빗변 = ${n}/${d} = ${frac(n, d)} 이다.`, "Sine is opposite over hypotenuse."], [`따라서 ${frac(n, d)} 이다.`, "State the value."]], variant: "sine_after_hypotenuse",
        }, t.fig);
      },
    },
    {
      op: "compose_kind", structure: "한 예각의 사인과 코사인을 각각 구해 합을 구함", extra: "두 비를 따로 구해 분수로 더해야 함(분모만 더하는 함정) — medium 은 사인",
      concepts: ["삼각비", "사인과 코사인", "분수의 합"],
      gen(rng) {
        const t = makeRight(rng, { unknown: "none" }); const k = rng.pick([1, 2] as const); const [so, sd] = ratio(t, k, "sin"), [co] = ratio(t, k, "cos"); const sumN = so + co, sumD = sd;
        return gInst(rng, {
          stimulus: rtIntro(rng, t), question: rng.pick([`What is the value of $\\sin ${nameOf(t, k)} + \\cos ${nameOf(t, k)}$?`, `What is $\\sin$ of angle $${nameOf(t, k)}$ plus $\\cos$ of angle $${nameOf(t, k)}$?`]), correctText: frac(sumN, sumD), range: [0, 100],
          wrongTexts: [FW(so, sd, "step_missing", "사인만 답했다."), FW(co, sd, "step_missing", "코사인만 답했다."), FW(so + co, sd + sd, "formula_misuse", "분모도 더했다."), FW(so * co, sd * sd, "formula_misuse", "곱했다."), FW(...ratio(t, k, "tan"), "formula_misuse", "탄젠트를 구했다.")],
          verificationJs: figJs({ at: nameOf(t, k) }, t.fig, `${RT_JS}${FN_JS}const kk=FIGURE.vertices.indexOf(P.at); if (kk<1) throw new Error('꼭짓점 오류'); return rt(kk,'sin')+rt(kk,'cos');`),
          trace: [rtRead(t), [`sin ${nameOf(t, k)} = ${so}/${sd}, cos ${nameOf(t, k)} = ${co}/${sd} 이다.`, "Both ratios share the hypotenuse."], [`합 = (${so} + ${co})/${sd} 이다.`, "Add the numerators."], [`= ${frac(sumN, sumD)} 이다.`, "Simplify."], [`따라서 ${frac(sumN, sumD)} 이다.`, "State the value."]], variant: "sine_plus_cosine",
        }, t.fig);
      },
    },
    {
      op: "compare_scenarios", structure: "두 예각의 사인 중 큰 값에서 작은 값을 뺀 차를 구함", extra: "두 예각의 대변을 각각 읽어 사인을 비교해야 함(같은 각의 사인·코사인과 혼동하는 함정) — medium 은 한 각의 사인",
      concepts: ["삼각비", "사인", "두 각 비교"],
      gen(rng) {
        const t = makeRight(rng, { unknown: "none" }); const [B, H] = t.legs; if (B === H) throw new GenFail("same"); const hi = Math.max(B, H), lo = Math.min(B, H);
        return gInst(rng, {
          stimulus: rtIntro(rng, t), question: rng.pick([`What is the positive difference between $\\sin ${t.v[1]}$ and $\\sin ${t.v[2]}$?`, `By how much does the larger of $\\sin ${t.v[1]}$ and $\\sin ${t.v[2]}$ exceed the smaller?`]), correctText: frac(hi - lo, t.hyp), range: [0, 100],
          wrongTexts: [FW(hi, t.hyp, "step_missing", "큰 사인만 답했다."), FW(lo, t.hyp, "step_missing", "작은 사인만 답했다."), FW(hi + lo, t.hyp, "sign_error", "합을 구했다."), FW(hi - lo, hi + lo, "formula_misuse", "분모를 잘못 잡았다."), FW(hi - lo, lo, "formula_misuse", "작은 변으로 나눴다.")],
          verificationJs: figJs({}, t.fig, `${RT_JS}${FN_JS}return Math.abs(rt(1,'sin')-rt(2,'sin'));`),
          trace: [rtRead(t), [`sin ${t.v[1]} = ${H}/${t.hyp}, sin ${t.v[2]} = ${B}/${t.hyp} 이다.`, "Two sines."], [`차 = |${H} - ${B}|/${t.hyp} 이다.`, "Same denominator."], [`= ${frac(hi - lo, t.hyp)} 이다.`, "Simplify."], [`따라서 ${frac(hi - lo, t.hyp)} 이다.`, "State the difference."]], variant: "sine_gap_two_angles",
        }, t.fig);
      },
    },
    {
      op: "inverse", structure: "한 직각변이 x 이고 빗변이 주어질 때 x 를 구한 뒤 그 변이 밑변인 예각의 코사인을 구함", extra: "모르는 직각변을 먼저 구하고(역방향) 코사인(인접변 ÷ 빗변)에 넣어야 함 — medium 은 코사인",
      concepts: ["피타고라스 정리", "코사인", "역산"],
      gen(rng) {
        const t = makeRight(rng, { unknown: "base" }); const [n, d] = ratio(t, 1, "cos");
        return gInst(rng, {
          stimulus: rtIntro(rng, t), question: rng.pick([`What is the value of $\\cos ${t.v[1]}$?`, `In triangle $${t.v.join("")}$, what is $\\cos$ of angle $${t.v[1]}$?`]), correctText: frac(n, d), range: [0, 100],
          wrongTexts: [FW(...ratio(t, 1, "sin"), "opposite", "사인을 구했다."), FW(...ratio(t, 1, "tan"), "formula_misuse", "탄젠트를 구했다."), FW(...ratio(t, 2, "cos"), "axis_misread", "다른 꼭짓점의 코사인을 구했다."), FW(d, n, "formula_misuse", "비를 뒤집었다.")],
          verificationJs: figJs({}, t.fig, `${RT_JS}${FN_JS}return rt(1,'cos');`),
          trace: [rtRead(t), [`x² = ${t.hyp}² - ${t.legs[1]}² = ${t.legs[0] * t.legs[0]} 이므로 x = ${t.legs[0]} 이다.`, "The unknown leg."], [`${t.v[1]} 에 인접한 변은 ${t.legs[0]} 이다.`, "The adjacent side."], [`cos = 인접변 ÷ 빗변 = ${n}/${d} = ${frac(n, d)} 이다.`, "Cosine is adjacent over hypotenuse."], [`따라서 ${frac(n, d)} 이다.`, "State the value."]], variant: "cosine_after_leg",
        }, t.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "sine", structure: "세 변이 모두 주어진 직각삼각형에서 한 예각의 사인을 구함", extra: "easy: 대변 ÷ 빗변", concepts: ["삼각비", "사인"],
      gen(rng) {
        const t = makeRight(rng, { unknown: "none" }); const k = rng.pick([1, 2] as const); const [n, d] = ratio(t, k, "sin");
        return gInst(rng, { stimulus: rtIntro(rng, t), question: ask(rng, t, k, "sin"), correctText: frac(n, d), range: [0, 100], wrongTexts: [FW(...ratio(t, k, "cos"), "opposite", "코사인을 구했다."), FW(...ratio(t, k, "tan"), "formula_misuse", "탄젠트를 구했다."), FW(d, n, "formula_misuse", "비를 뒤집었다."), FW(...ratio(t, k === 1 ? 2 : 1, "sin"), "axis_misread", "다른 꼭짓점의 사인을 구했다.")], verificationJs: figJs({ at: nameOf(t, k) }, t.fig, `${RT_JS}${FN_JS}const kk=FIGURE.vertices.indexOf(P.at); if (kk<1) throw new Error('꼭짓점 오류'); return rt(kk,'sin');`), trace: [rtRead(t), [`${nameOf(t, k)} 의 대변은 ${k === 1 ? t.legs[1] : t.legs[0]} 이다.`, "Opposite side."], [`sin = ${n}/${d} = ${frac(n, d)} 이다.`, "Opposite over hypotenuse."]], variant: "sine_all_sides",
        }, t.fig);
      },
    },
    {
      lv: "medium", name: "tangent", structure: "한 예각의 탄젠트(대변 ÷ 인접변)를 구함", extra: "medium: 대변 ÷ 인접변", concepts: ["삼각비", "탄젠트"],
      gen(rng) {
        const t = makeRight(rng, { unknown: "hyp" }); const k = rng.pick([1, 2] as const); const [n, d] = ratio(t, k, "tan");
        return gInst(rng, { stimulus: rtIntro(rng, t), question: ask(rng, t, k, "tan"), correctText: frac(n, d), range: [0, 100], wrongTexts: [FW(...ratio(t, k, "sin"), "opposite", "사인을 구했다."), FW(d, n, "formula_misuse", "비를 뒤집었다."), FW(...ratio(t, k, "cos"), "opposite", "코사인을 구했다."), FW(...ratio(t, k === 1 ? 2 : 1, "tan"), "axis_misread", "다른 꼭짓점의 탄젠트를 구했다.")], verificationJs: figJs({ at: nameOf(t, k) }, t.fig, `${RT_JS}${FN_JS}const kk=FIGURE.vertices.indexOf(P.at); if (kk<1) throw new Error('꼭짓점 오류'); return rt(kk,'tan');`), trace: [rtRead(t), [`${nameOf(t, k)} 의 대변 ${k === 1 ? t.legs[1] : t.legs[0]}, 인접변 ${k === 1 ? t.legs[0] : t.legs[1]} 이다.`, "Opposite and adjacent."], [`tan = ${n}/${d} = ${frac(n, d)} 이다.`, "Opposite over adjacent."]], variant: "tangent_legs",
        }, t.fig);
      },
    },
  ],
});
