// right_triangles_trigonometry.sin_cos_complementary.TR.P — 직각삼각형 그림에서 한 예각의 사인이 다른 예각의 코사인과 같다는(여각) 성질로 삼각비를 구한다.
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
  prefix: "rtt", itemId: "right_triangles_trigonometry.sin_cos_complementary.TR.P",
  hard: [
    {
      op: "chain2", structure: "빗변(x)을 구한 뒤 한 예각의 사인을 구해, 여각(다른 예각)의 코사인과 같음을 이용해 코사인을 답함", extra: "사인(k)과 여각의 코사인이 같다는 성질로 두 꼭짓점을 연결해야 함(같은 꼭짓점의 코사인과 혼동하는 함정) — medium 은 사인",
      concepts: ["여각 관계", "사인과 코사인", "피타고라스 정리"],
      gen(rng) {
        const t = makeRight(rng, { unknown: "hyp" }); const k = rng.pick([1, 2] as const); const o = (k === 1 ? 2 : 1) as 1 | 2; const [n, d] = ratio(t, k, "sin");
        return gInst(rng, {
          stimulus: rtIntro(rng, t), question: rng.pick([`What is the value of $\\cos ${nameOf(t, o)}$ if it equals $\\sin ${nameOf(t, k)}$?`, `In triangle $${t.v.join("")}$, $\\cos ${nameOf(t, o)} = \\sin ${nameOf(t, k)}$. What is this common value?`]), correctText: frac(n, d), range: [0, 100],
          wrongTexts: [FW(...ratio(t, k, "cos"), "opposite", "같은 꼭짓점의 코사인을 구했다."), FW(...ratio(t, k, "tan"), "formula_misuse", "탄젠트를 구했다."), FW(d, n, "formula_misuse", "비를 뒤집었다."), FW(...ratio(t, o, "sin"), "axis_misread", "다른 꼭짓점의 사인을 구했다.")],
          verificationJs: figJs({ at: nameOf(t, k) }, t.fig, `${RT_JS}${FN_JS}const kk=FIGURE.vertices.indexOf(P.at); if (kk<1) throw new Error('꼭짓점 오류'); const oo=kk===1?2:1; const s=rt(kk,'sin'), c=rt(oo,'cos'); if (Math.abs(s-c)>1e-9) throw new Error('여각 관계 위반'); return c;`),
          trace: [rtRead(t), [`빗변 x = √(${t.legs[0]}² + ${t.legs[1]}²) = ${t.hyp} 이다.`, "Find the hypotenuse."], [`sin ${nameOf(t, k)} = ${n}/${d} 이다.`, "Sine of the first angle."], [`${nameOf(t, o)} 의 인접변이 ${nameOf(t, k)} 의 대변이므로 cos ${nameOf(t, o)} = ${frac(n, d)} 이다.`, "Complementary angles: sine of one equals cosine of the other."], [`따라서 ${frac(n, d)} 이다.`, "State the value."]], variant: "common_value_of_sin_and_cos",
        }, t.fig);
      },
    },
    {
      op: "compose_kind", structure: "한 예각의 사인과 다른 예각의 코사인의 곱을 구함(둘은 같은 값)", extra: "여각 관계로 두 값이 같음을 알아 제곱을 계산해야 함 — medium 은 사인",
      concepts: ["여각 관계", "사인과 코사인", "분수의 곱"],
      gen(rng) {
        const t = makeRight(rng, { unknown: "none" }); const k = rng.pick([1, 2] as const); const o = (k === 1 ? 2 : 1) as 1 | 2; const [n, d] = ratio(t, k, "sin");
        return gInst(rng, {
          stimulus: rtIntro(rng, t), question: rng.pick([`What is the value of $\\sin ${nameOf(t, k)} \\cdot \\cos ${nameOf(t, o)}$?`, `What is $\\sin ${nameOf(t, k)}$ times $\\cos ${nameOf(t, o)}$?`]), correctText: frac(n * n, d * d), range: [0, 100],
          wrongTexts: [FW(n, d, "step_missing", "한 비만 답했다."), FW(n * 2, d * 2, "formula_misuse", "곱하지 않고 합쳤다."), FW(n * ratio(t, k, "cos")[0], d * d, "formula_misuse", "같은 꼭짓점의 사인·코사인을 곱했다."), FW(n * n, d, "formula_misuse", "분모를 제곱하지 않았다.")],
          verificationJs: figJs({ at: nameOf(t, k) }, t.fig, `${RT_JS}${FN_JS}const kk=FIGURE.vertices.indexOf(P.at); if (kk<1) throw new Error('꼭짓점 오류'); const oo=kk===1?2:1; return rt(kk,'sin')*rt(oo,'cos');`),
          trace: [rtRead(t), [`sin ${nameOf(t, k)} = ${n}/${d} 이고 cos ${nameOf(t, o)} = ${n}/${d} 이다.`, "Complementary angles share the value."], [`곱 = (${n}/${d})² 이다.`, "Square it."], [`= ${frac(n * n, d * d)} 이다.`, "Simplify."], [`따라서 ${frac(n * n, d * d)} 이다.`, "State the product."]], variant: "sine_times_complement_cosine",
        }, t.fig);
      },
    },
    {
      op: "compare_scenarios", structure: "한 예각의 사인과 같은 각의 코사인의 차(큰 값 − 작은 값)를 구함", extra: "같은 각의 사인·코사인(대변·인접변)을 구별해 비교해야 함(여각 관계와 혼동하는 함정) — medium 은 사인",
      concepts: ["삼각비", "사인과 코사인", "비교"],
      gen(rng) {
        const t = makeRight(rng, { unknown: "none" }); const [B, H] = t.legs; if (B === H) throw new GenFail("same"); const hi = Math.max(B, H), lo = Math.min(B, H);
        return gInst(rng, {
          stimulus: rtIntro(rng, t), question: rng.pick([`What is the positive difference between $\\sin ${t.v[1]}$ and $\\cos ${t.v[1]}$?`, `By how much do $\\sin ${t.v[1]}$ and $\\cos ${t.v[1]}$ differ?`]), correctText: frac(hi - lo, t.hyp), range: [0, 100],
          wrongTexts: [FW(hi, t.hyp, "step_missing", "큰 비만 답했다."), FW(lo, t.hyp, "step_missing", "작은 비만 답했다."), FW(hi + lo, t.hyp, "formula_misuse", "합을 구했다."), FW(hi - lo, lo, "formula_misuse", "작은 변으로 나눴다."), FW(hi - lo, hi, "formula_misuse", "큰 변으로 나눴다.")],
          verificationJs: figJs({}, t.fig, `${RT_JS}${FN_JS}return Math.abs(rt(1,'sin')-rt(1,'cos'));`),
          trace: [rtRead(t), [`sin ${t.v[1]} = ${H}/${t.hyp}, cos ${t.v[1]} = ${B}/${t.hyp} 이다.`, "Sine and cosine of the same angle."], [`차 = |${H} - ${B}|/${t.hyp} 이다.`, "Same denominator."], [`= ${frac(hi - lo, t.hyp)} 이다.`, "Simplify."], [`따라서 ${frac(hi - lo, t.hyp)} 이다.`, "State the difference."]], variant: "sine_cosine_gap_same_angle",
        }, t.fig);
      },
    },
    {
      op: "unit_ratio", structure: "두 예각의 탄젠트의 비(tan ÷ tan)를 구함(서로 역수 관계의 제곱)", extra: "여각의 탄젠트가 서로 역수임을 알아 비를 제곱 꼴로 구해야 함 — medium 은 탄젠트",
      concepts: ["삼각비", "탄젠트", "역수 관계"],
      gen(rng) {
        const t = makeRight(rng, { unknown: "none" }); const [B, H] = t.legs; if (B === H) throw new GenFail("same");
        return gInst(rng, {
          stimulus: rtIntro(rng, t), question: rng.pick([`What is the value of $\\tan ${t.v[1]} \\div \\tan ${t.v[2]}$?`, `What is $\\tan ${t.v[1]}$ divided by $\\tan ${t.v[2]}$?`]), correctText: frac(H * H, B * B), range: [0, 1000],
          wrongTexts: [FW(H, B, "step_missing", "한 탄젠트만 답했다."), FW(1, 1, "formula_misuse", "비를 1 로 보았다."), FW(B * B, H * H, "formula_misuse", "비를 뒤집었다."), FW(H * H, B, "formula_misuse", "분모를 제곱하지 않았다.")],
          verificationJs: figJs({}, t.fig, `${RT_JS}${FN_JS}return rt(1,'tan')/rt(2,'tan');`),
          trace: [rtRead(t), [`tan ${t.v[1]} = ${H}/${B}, tan ${t.v[2]} = ${B}/${H} 이다.`, "The two tangents are reciprocals."], [`비 = (${H}/${B}) ÷ (${B}/${H}) = ${H}²/${B}² 이다.`, "Divide."], [`= ${frac(H * H, B * B)} 이다.`, "Simplify."], [`따라서 ${frac(H * H, B * B)} 이다.`, "State the ratio."]], variant: "tangent_ratio_of_complements",
        }, t.fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "cos_of_other", structure: "한 예각의 사인이 주어진 직각삼각형에서 여각의 코사인을 같은 값으로 읽음", extra: "easy: 사인 = 여각의 코사인", concepts: ["여각 관계", "코사인"],
      gen(rng) {
        const t = makeRight(rng, { unknown: "none" }); const k = rng.pick([1, 2] as const); const o = (k === 1 ? 2 : 1) as 1 | 2; const [n, d] = ratio(t, o, "cos");
        return gInst(rng, { stimulus: rtIntro(rng, t), question: ask(rng, t, o, "cos"), correctText: frac(n, d), range: [0, 100], wrongTexts: [FW(...ratio(t, o, "sin"), "opposite", "사인을 구했다."), FW(...ratio(t, o, "tan"), "formula_misuse", "탄젠트를 구했다."), FW(d, n, "formula_misuse", "비를 뒤집었다."), FW(...ratio(t, k, "cos"), "axis_misread", "다른 꼭짓점의 코사인을 구했다.")], verificationJs: figJs({ at: nameOf(t, o) }, t.fig, `${RT_JS}${FN_JS}const kk=FIGURE.vertices.indexOf(P.at); if (kk<1) throw new Error('꼭짓점 오류'); return rt(kk,'cos');`), trace: [rtRead(t), [`${nameOf(t, o)} 에 인접한 변은 ${o === 1 ? t.legs[0] : t.legs[1]} 이다.`, "The adjacent side."], [`cos = ${n}/${d} = ${frac(n, d)} 이다.`, "Adjacent over hypotenuse."]], variant: "cosine_of_acute_angle",
        }, t.fig);
      },
    },
    {
      lv: "medium", name: "tan_other", structure: "한 예각의 탄젠트에서 여각의 탄젠트(역수)를 구함", extra: "medium: 탄젠트의 역수", concepts: ["여각 관계", "탄젠트"],
      gen(rng) {
        const t = makeRight(rng, { unknown: "hyp" }); const o = rng.pick([1, 2] as const); const [n, d] = ratio(t, o, "tan");
        return gInst(rng, { stimulus: rtIntro(rng, t), question: ask(rng, t, o, "tan"), correctText: frac(n, d), range: [0, 100], wrongTexts: [FW(d, n, "formula_misuse", "비를 뒤집었다."), FW(...ratio(t, o, "sin"), "opposite", "사인을 구했다."), FW(...ratio(t, o, "cos"), "opposite", "코사인을 구했다."), FW(n, t.hyp, "formula_misuse", "빗변으로 나눴다.")], verificationJs: figJs({ at: nameOf(t, o) }, t.fig, `${RT_JS}${FN_JS}const kk=FIGURE.vertices.indexOf(P.at); if (kk<1) throw new Error('꼭짓점 오류'); return rt(kk,'tan');`), trace: [rtRead(t), [`${nameOf(t, o)} 의 대변 ${o === 1 ? t.legs[1] : t.legs[0]}, 인접변 ${o === 1 ? t.legs[0] : t.legs[1]} 이다.`, "Opposite and adjacent."], [`tan = ${n}/${d} = ${frac(n, d)} 이다.`, "Opposite over adjacent."]], variant: "tangent_of_acute_angle",
        }, t.fig);
      },
    },
  ],
});
