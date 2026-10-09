// right_triangles_trigonometry.unit_circle_radian.UC.P — 단위원에 표시된 라디안 각(호 라벨)의 사인·코사인·탄젠트를 반사각·사분면 부호로 구하고, 곱·두 각 비교·역산(값과 그림의 사분면으로 각을 찾음)으로 확장한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import type { DistractorKind } from "../../../../review";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst } from "../graph-kit";
import { SPECIAL_ANGLES, TRIG_JS, UC_JS, UC_LEADS, exAbs, exMul, exNeg, exOf, exTxt, exVal, exAdd, familyOf, quadOfAngle, radLabel, radOpt, radTex, refOf, ucCtx, type Ex, type Fn, type UcCtx } from "../uc-kit";

const FW = (e: Ex, kind: DistractorKind, reason: string) => ({ text: exTxt(e), kind, reason });
const FNAME: Record<Fn, string> = { sin: "사인", cos: "코사인", tan: "탄젠트" };
const QN = ["", "I", "II", "III", "IV"];
const other = (f: Fn): Fn => (f === "sin" ? "cos" : "sin");
const figR = (cx: UcCtx, d: number, arc: "rad" | "sym") => ({ type: "unit_circle" as const, points: [{ name: cx.p, angle: d }], arcs: [{ to: 0, label: arc === "rad" ? radLabel(d) : cx.a.ch }] });
const figR2 = (cx: UcCtx, d1: number, d2: number) => ({ type: "unit_circle" as const, points: [{ name: cx.p, angle: d1 }, { name: cx.q, angle: d2 }], arcs: [{ to: 0, label: radLabel(d1) }, { to: 1, label: radLabel(d2) }] });
const ang = (d: number) => radLabel(d).replace("π", "π");

const intro = (rng: Rng, cx: UcCtx, extra = "") => rng.pick(UC_LEADS) + rng.pick([
  `The unit circle is shown in the $xy$-plane. Point $${cx.p}$ is on the circle, and angle $${cx.a.tex}$ is drawn in standard position with its terminal side through $${cx.p}$. The measure of $${cx.a.tex}$ is marked in radians.${extra}`,
  `In the figure, the terminal side of angle $${cx.a.tex}$ in standard position passes through point $${cx.p}$ on the unit circle. The angle measure, in radians, is labeled on the arc.${extra}`,
  `The figure shows an angle in standard position on the unit circle, with its radian measure marked on the arc. The terminal side meets the circle at point $${cx.p}$.${extra}`,
  `Point $${cx.p}$ lies on the unit circle shown, and the arc marks the angle, in radians, from the positive $x$-axis to the ray through $${cx.p}$. Call this angle $${cx.a.tex}$.${extra}`,
  `A ray from the origin through point $${cx.p}$ on the unit circle makes angle $${cx.a.tex}$ with the positive $x$-axis, as shown. The radian measure of $${cx.a.tex}$ is written on the arc.${extra}`,
  `The diagram shows a unit circle centered at the origin. Angle $${cx.a.tex}$, whose radian measure is labeled on the arc, is in standard position with terminal side through $${cx.p}$.${extra}`,
]);
const introSym = (rng: Rng, cx: UcCtx) => rng.pick(UC_LEADS) + rng.pick([
  `The unit circle is shown in the $xy$-plane. Point $${cx.p}$ is on the circle, and angle $${cx.a.tex}$ is drawn in standard position with its terminal side through $${cx.p}$.`,
  `In the figure, the terminal side of angle $${cx.a.tex}$ in standard position passes through point $${cx.p}$ on the unit circle.`,
  `Point $${cx.p}$ lies on the unit circle shown. Angle $${cx.a.tex}$ is measured counterclockwise from the positive $x$-axis to the ray from the origin through $${cx.p}$.`,
  `The diagram shows a unit circle centered at the origin and an angle $${cx.a.tex}$ in standard position whose terminal side meets the circle at $${cx.p}$.`,
  `On the unit circle in the figure, $${cx.a.tex}$ is the angle in standard position with terminal side through point $${cx.p}$.`,
]);
const intro2 = (rng: Rng, cx: UcCtx) => rng.pick(UC_LEADS) + rng.pick([
  `The unit circle shown has points $${cx.p}$ and $${cx.q}$ on it. Angle $${cx.a.tex}$ and angle $${cx.b.tex}$ are in standard position, with terminal sides through $${cx.p}$ and $${cx.q}$, respectively. Both measures are marked in radians.`,
  `In the figure, $${cx.p}$ and $${cx.q}$ are points on the unit circle. The terminal side of $${cx.a.tex}$ passes through $${cx.p}$ and that of $${cx.b.tex}$ passes through $${cx.q}$; the radian measures are labeled on the arcs.`,
  `Two angles in standard position are shown on the unit circle, $${cx.a.tex}$ through $${cx.p}$ and $${cx.b.tex}$ through $${cx.q}$. The arcs show their measures in radians.`,
  `The unit circle in the figure has two marked points, $${cx.p}$ and $${cx.q}$. The ray through $${cx.p}$ forms angle $${cx.a.tex}$ with the positive $x$-axis, and the ray through $${cx.q}$ forms angle $${cx.b.tex}$. Radian measures are marked.`,
]);
const askFn = (rng: Rng, cx: UcCtx, f: Fn) => rng.pick([`What is the value of $\\${f}${cx.a.tex}$?`, `What is $\\${f}${cx.a.tex}$?`, `Find the exact value of $\\${f}${cx.a.tex}$.`]);
const tr1 = (cx: UcCtx, d: number): [string, string] => [`그림에서 호 라벨로 각 ${cx.a.ch} = ${radLabel(d)} 라디안을 읽는다.`, "Read the radian measure from the arc."];
const refStep = (d: number): [string, string] => [`${radLabel(d)} = ${d}° 이고 반사각은 ${refOf(d)}° 이다.`, "Convert to degrees and find the reference angle."];
const signStep = (d: number, f: Fn): [string, string] => [`${QN[quadOfAngle(d)]}사분면에서 ${FNAME[f]}의 부호는 ${exOf(d, f).s > 0 ? "양" : "음"}이다.`, "Apply the sign of the quadrant."];
/** 유리수가 되는 (각, 함수) 조합: 30° 계열 sin, 60° 계열 cos, 45° 계열 tan. */
function rationalPair(rng: Rng): { d: number; f: Fn } {
  const d = rng.pick(SPECIAL_ANGLES); const r = refOf(d); return { d, f: r === 30 ? "sin" : r === 60 ? "cos" : "tan" };
}

export const ITEM = defineItem({
  prefix: "rtt", itemId: "right_triangles_trigonometry.unit_circle_radian.UC.P",
  hard: [
    {
      op: "chain2", structure: "호 라벨의 라디안 각을 도로 바꿔 반사각과 사분면 부호로 삼각비(유리수 값)를 구함", extra: "라디안 → 반사각 → 사분면 부호의 연쇄(부호를 놓치거나 반사각 값을 그대로 답하는 함정) — medium 은 탄젠트",
      concepts: ["라디안", "단위원", "반사각", "사분면 부호"],
      gen(rng) {
        const cx = ucCtx(rng); const { d, f } = rationalPair(rng); const v = exOf(d, f);
        return gInst(rng, {
          stimulus: intro(rng, cx), question: askFn(rng, cx, f), correctText: exTxt(v), range: [-1000, 1000],
          wrongTexts: [FW(exAbs(v), "sign_error", "사분면의 부호를 적용하지 않았다."), FW(exOf(d, other(f === "tan" ? "sin" : f)), "formula_misuse", "다른 삼각비의 값을 답했다."), FW(exNeg(v), "sign_error", "부호를 반대로 정했다."), FW(exOf(refOf(d) === 45 ? 30 : 45, "sin"), "formula_misuse", "다른 기준각의 값을 답했다.")],
          verificationJs: figJs({ f }, figR(cx, d, "rad"), `${UC_JS}${TRIG_JS}const d=pa(FIGURE.arcs[0].label); return T(d,P.f);`),
          trace: [tr1(cx, d), refStep(d), [`${f} ${refOf(d)}° = ${exTxt(exAbs(v))} 이다.`, "The reference-angle value."], signStep(d, f), [`따라서 ${exTxt(v)} 이다.`, "State the value."]], variant: `${f}_reference_angle_${QN[quadOfAngle(d)]}`,
        }, figR(cx, d, "rad"));
      },
    },
    {
      op: "compose_kind", structure: "라디안 각의 사인과 코사인을 각각 구해 곱을 구함", extra: "두 값의 부호를 모두 따져 곱해야 함(한 값만 답하거나 부호를 놓치는 함정) — medium 은 탄젠트",
      sprNo: "정답에 제곱근이 들어가는 경우가 있어 단답으로 낼 수 없다",
      concepts: ["라디안", "단위원", "사인과 코사인", "곱"],
      gen(rng) {
        const cx = ucCtx(rng); const d = rng.pick(SPECIAL_ANGLES); const sn = exOf(d, "sin"), cs = exOf(d, "cos"); const pr = exMul(sn, cs);
        return gInst(rng, {
          stimulus: intro(rng, cx), question: rng.pick([`What is the value of $\\sin${cx.a.tex}\\cos${cx.a.tex}$?`, `What is the exact value of $(\\sin${cx.a.tex})(\\cos${cx.a.tex})$?`]), correctText: exTxt(pr), range: [-1000, 1000],
          wrongTexts: [FW(exNeg(pr), "sign_error", "부호를 반대로 정했다."), FW(sn, "step_missing", "사인만 답했다."), FW(cs, "step_missing", "코사인만 답했다."), FW(exAbs(pr), "sign_error", "사분면의 부호를 적용하지 않았다."), FW(exMul(sn, sn), "formula_misuse", "사인을 제곱했다.")],
          verificationJs: figJs({}, figR(cx, d, "rad"), `${UC_JS}${TRIG_JS}const d=pa(FIGURE.arcs[0].label); return T(d,'sin')*T(d,'cos');`),
          trace: [tr1(cx, d), refStep(d), [`sin ${radLabel(d)} = ${exTxt(sn)}, cos ${radLabel(d)} = ${exTxt(cs)} 이다.`, "Both ratios with signs."], [`곱 = ${exTxt(sn)} × (${exTxt(cs)}) = ${exTxt(pr)} 이다.`, "Multiply."], [`따라서 ${exTxt(pr)} 이다.`, "State the value."]], variant: "sine_times_cosine_radian",
        }, figR(cx, d, "rad"));
      },
    },
    {
      op: "compare_scenarios", structure: "같은 반사각 계열의 두 라디안 각 α·β 에서 같은 삼각비의 차를 구함", extra: "두 사분면의 부호를 따로 정해 빼야 함(합을 구하거나 순서를 바꾸는 함정) — medium 은 한 각의 탄젠트",
      sprNo: "정답에 제곱근이 들어가는 경우가 있어 단답으로 낼 수 없다",
      concepts: ["라디안", "단위원", "두 각 비교", "사분면 부호"],
      gen(rng) {
        const cx = ucCtx(rng); const f = rng.pick(["sin", "cos"] as const); const base = rng.pick(SPECIAL_ANGLES); const fam = familyOf(base).filter((x) => x !== base); const d2 = rng.pick(fam);
        const a = exOf(base, f), b = exOf(d2, f); const diff = exAdd(a, exNeg(b));
        if (diff.c === 0) throw new GenFail("차가 0");
        return gInst(rng, {
          stimulus: intro2(rng, cx), question: rng.pick([`What is the value of $\\${f}${cx.a.tex} - \\${f}${cx.b.tex}$?`, `What is $\\${f}${cx.a.tex}$ minus $\\${f}${cx.b.tex}$?`]), correctText: exTxt(diff), range: [-1000, 1000],
          wrongTexts: [FW(exNeg(diff), "sign_error", "빼는 순서를 바꿨다."), FW(a, "step_missing", "첫 값만 답했다."), FW(b, "step_missing", "둘째 값만 답했다."), FW(exAdd(a, b), "sign_error", "합을 구했다."), FW(exAbs(a), "sign_error", "크기만 답했다.")],
          verificationJs: figJs({ f }, figR2(cx, base, d2), `${UC_JS}${TRIG_JS}const A=pa(FIGURE.arcs[0].label), B=pa(FIGURE.arcs[1].label); return T(A,P.f)-T(B,P.f);`),
          trace: [[`그림에서 두 호 라벨 ${cx.a.ch} = ${radLabel(base)}, ${cx.b.ch} = ${radLabel(d2)} 라디안을 읽는다.`, "Read both radian measures."], [`두 각의 반사각은 모두 ${refOf(base)}° 이다.`, "Both angles share a reference angle."], [`사분면 부호를 적용하면 ${f} ${cx.a.ch} = ${exTxt(a)}, ${f} ${cx.b.ch} = ${exTxt(b)} 이다.`, "Apply the quadrant signs."], [`차 = ${exTxt(a)} - (${exTxt(b)}) = ${exTxt(diff)} 이다.`, "Subtract."], [`따라서 ${exTxt(diff)} 이다.`, "State the difference."]], variant: `${f}_difference_two_radians`,
        }, figR2(cx, base, d2));
      },
    },
    {
      op: "inverse", structure: "사인(또는 코사인) 값이 주어지고 그림의 사분면으로 해를 하나로 정해 각의 라디안 값을 구함", extra: "같은 값을 갖는 두 각 중 그림의 사분면에 맞는 것을 골라야 함(반사각이나 다른 사분면의 각을 답하는 함정) — medium 은 라디안 각의 탄젠트",
      sprNo: "정답이 π 가 든 각의 크기라 단답(수)으로 낼 수 없다",
      concepts: ["라디안", "단위원", "역삼각", "사분면"],
      gen(rng) {
        const cx = ucCtx(rng); const f = rng.pick(["sin", "cos"] as const); const cand = SPECIAL_ANGLES.filter((x) => refOf(x) !== 45); const d = rng.pick(cand);
        const e = exOf(d, f); const fam = familyOf(d); if (fam.length !== 4) throw new GenFail("계열");
        const valTex = `${e.s < 0 ? "-" : ""}\\frac{${e.k > 1 ? `\\sqrt{${e.k}}` : e.c}}{${e.d}}`;
        const fix = (x: number) => radOpt(x);
        const rule = fam.filter((x) => x !== d);
        return gInst(rng, {
          stimulus: `${introSym(rng, cx)} For this angle, $\\${f}${cx.a.tex} = ${valTex}$.`,
          question: rng.pick([`What is the radian measure of $${cx.a.tex}$, where $0 \\le ${cx.a.tex} < 2\\pi$?`, `If $0 \\le ${cx.a.tex} < 2\\pi$, what is the measure of $${cx.a.tex}$, in radians?`]), correctText: fix(d), range: [-1000, 1000],
          wrongTexts: [{ text: fix(rule[0]), kind: "sign_error", reason: "같은 값을 갖는 다른 사분면의 각을 답했다." }, { text: fix(rule[1]), kind: "sign_error", reason: "같은 값을 갖는 다른 사분면의 각을 답했다." }, { text: fix(rule[2]), kind: "axis_misread", reason: "그림의 사분면과 다른 각을 답했다." }, { text: fix(refOf(d)), kind: "formula_misuse", reason: "반사각만 답했다." }],
          verificationJs: figJs({ f, sg: e.s, v: `${e.c === 1 && e.k > 1 ? "" : e.c}${e.k > 1 ? `√${e.k}` : ""}/${e.d}` }, figR(cx, d, "sym"), `${UC_JS}${TRIG_JS}const q=FIGURE.points[0].angle; if (!(q>0&&q<360)) throw new Error('각 범위'); const quad=Math.floor(q/90); const target=P.sg*pn(P.v); let hit=null; for (const dd of [30,45,60,120,135,150,210,225,240,300,315,330]) { if (Math.floor(dd/90)===quad&&Math.abs(T(dd,P.f)-target)<1e-9) hit=dd; } if (hit===null) throw new Error('조건을 만족하는 각 없음'); return hit/180;`),
          trace: [[`그림에서 각 ${cx.a.ch} 는 표준위치이고 ${f} ${cx.a.ch} = ${exTxt(e)} 이다.`, "The value of the ratio is given."], [`크기가 ${exTxt(exAbs(e))} 이므로 반사각은 ${refOf(d)}° 이다.`, "The magnitude gives the reference angle."], [`이 값을 갖는 각은 네 사분면 중 두 곳에 있고, 그림에서 점 ${cx.p} 는 ${QN[quadOfAngle(d)]}사분면에 있다.`, "Two quadrants give this value; the figure picks one."], [`${QN[quadOfAngle(d)]}사분면의 각은 ${d}° = ${radLabel(d)} 라디안이다.`, "Convert to radians."], [`따라서 ${radLabel(d)} 이다.`, "State the measure."]], variant: `${f}_angle_from_value_${QN[quadOfAngle(d)]}`,
        }, figR(cx, d, "sym"));
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "special_value", structure: "호 라벨의 라디안 각에서 사인 또는 코사인(특수각)을 구함", extra: "easy: 특수각의 한 삼각비", concepts: ["라디안", "단위원", "특수각"],
      gen(rng) {
        const cx = ucCtx(rng); const d = rng.pick(SPECIAL_ANGLES); const f = rng.pick(["sin", "cos"] as const); const v = exOf(d, f);
        return gInst(rng, {
          stimulus: intro(rng, cx), question: askFn(rng, cx, f), correctText: exTxt(v), range: [-1000, 1000],
          wrongTexts: [FW(exAbs(v), "sign_error", "부호를 놓쳤다."), FW(exOf(d, other(f)), "formula_misuse", f === "sin" ? "코사인 값을 답했다." : "사인 값을 답했다."), FW(exNeg(v), "sign_error", "부호를 반대로 정했다."), FW(exOf(d, "tan"), "formula_misuse", "탄젠트를 구했다.")],
          verificationJs: figJs({ f }, figR(cx, d, "rad"), `${UC_JS}${TRIG_JS}const d=pa(FIGURE.arcs[0].label); return T(d,P.f);`),
          trace: [tr1(cx, d), refStep(d), signStep(d, f), [`따라서 ${exTxt(v)} 이다.`, "State the value."]], variant: `${f}_special_value`,
        }, figR(cx, d, "rad"));
      },
    },
    {
      lv: "medium", name: "tangent", structure: "호 라벨의 라디안 각의 탄젠트(특수각)를 구함", extra: "medium: 탄젠트 = 사인 ÷ 코사인의 부호와 크기", concepts: ["라디안", "단위원", "탄젠트"],
      gen(rng) {
        const cx = ucCtx(rng); const d = rng.pick(SPECIAL_ANGLES); const v = exOf(d, "tan");
        return gInst(rng, {
          stimulus: intro(rng, cx), question: askFn(rng, cx, "tan"), correctText: exTxt(v), range: [-1000, 1000],
          wrongTexts: [FW(exAbs(v), "sign_error", "부호를 놓쳤다."), FW(exNeg(v), "sign_error", "부호를 반대로 정했다."), FW(exOf(d, "sin"), "formula_misuse", "사인 값을 답했다."), FW(exOf(d, "cos"), "formula_misuse", "코사인 값을 답했다."), FW(exMul(exOf(d, "sin"), exOf(d, "cos")), "formula_misuse", "곱을 구했다.")],
          verificationJs: figJs({}, figR(cx, d, "rad"), `${UC_JS}${TRIG_JS}const d=pa(FIGURE.arcs[0].label); return T(d,'tan');`),
          trace: [tr1(cx, d), refStep(d), [`tan = sin ÷ cos = ${exTxt(exOf(d, "sin"))} ÷ (${exTxt(exOf(d, "cos"))}) = ${exTxt(v)} 이다.`, "Tangent is sine over cosine."], [`따라서 ${exTxt(v)} 이다.`, "State the value."]], variant: "tangent_special_value",
        }, figR(cx, d, "rad"));
      },
    },
  ],
});
void ang; void exVal;
