// right_triangles_trigonometry.unit_circle_radian.UC.C — 지문의 각(도·라디안·동일 끝변·π±α·삼각비 조건)에 해당하는 표준위치 각을 단위원 그림 4개 중에서 고른다.
// 오답 규칙(정답 각 d 기준): UCR1_mirror_x_axis(x축 대칭 360−d)·UCR2_mirror_y_axis(y축 대칭 180−d)·UCR3_opposite_point(원점 대칭 180+d). 네 그림은 같은 반사각 계열이라 반사각만 보면 구별되지 않는다.
import { GenFail, type Instance } from "../../../types";
import type { Rng } from "../../../rng";
import { placeChoices } from "../../../figure-kit";
import { choiceInst } from "../../tvd-fig-choice";
import { defineItem } from "../item-kit";
import { NORM_JS, PN_JS, TRIG_JS, UC_LEADS, familyOf, quadOfAngle, radLabel, refOf, SPECIAL_ANGLES, exOf, exTxt, ucCtx, type UcCtx } from "../uc-kit";

const SPR_NO = "정답이 선택지(그림 4개 중 하나)를 고르는 것이 문제의 핵심이라 선택지 없이는 성립하지 않는다";
const n360 = (x: number) => ((x % 360) + 360) % 360;
const QN = ["", "I", "II", "III", "IV"];
const chFig = (cx: UcCtx, angle: number) => ({ type: "unit_circle" as const, points: [{ name: cx.p, angle }], arcs: [{ to: 0, label: cx.a.ch }] });
const DIAG = `${NORM_JS}const a = n360(c.points[0].angle), o = n360(ok.points[0].angle); const eq = (x, y) => Math.abs(x - y) < 1e-6;
if (eq(a, n360(-o))) return "UCR1_mirror_x_axis"; if (eq(a, n360(180 - o))) return "UCR2_mirror_y_axis"; if (eq(a, n360(180 + o))) return "UCR3_opposite_point"; return null;`;
/** 정답 각 d(도)와 같은 반사각 계열의 오답 3개로 선택지를 만든다. */
function choices(rng: Rng, cx: UcCtx, d: number) {
  const mx = n360(360 - d), my = n360(180 - d), op = n360(180 + d);
  if (new Set([d, mx, my, op].map((x) => Math.round(x * 100))).size !== 4) throw new GenFail("계열 중복");
  return placeChoices(rng, chFig(cx, d), [{ fig: chFig(cx, mx), rule: "UCR1_mirror_x_axis" }, { fig: chFig(cx, my), rule: "UCR2_mirror_y_axis" }, { fig: chFig(cx, op), rule: "UCR3_opposite_point" }]);
}
const intro = (rng: Rng, cx: UcCtx) => rng.pick(UC_LEADS) + rng.pick([
  `Each figure shows a unit circle with point $${cx.p}$ on it and angle $${cx.a.tex}$ drawn in standard position.`,
  `The four figures show angles in standard position on the unit circle; in each, the terminal side of $${cx.a.tex}$ passes through the marked point $${cx.p}$.`,
  `In each of the figures, angle $${cx.a.tex}$ is measured counterclockwise from the positive $x$-axis to the ray through point $${cx.p}$ on the unit circle.`,
  `The choices show the unit circle with an angle $${cx.a.tex}$ in standard position and its terminal side through $${cx.p}$.`,
  `Four unit circles are shown. Each has a ray from the origin through point $${cx.p}$ that forms angle $${cx.a.tex}$ with the positive $x$-axis.`,
]);
const q1 = (rng: Rng) => rng.pick(["Which figure shows the angle described above?", "Which of the figures shows the angle described above in standard position?", "Which figure is consistent with the description above?"]);
const pick = (rng: Rng, f: (d: number) => boolean) => { const l = SPECIAL_ANGLES.filter(f); return rng.pick(l); };
const mathDeg = (d: number) => `${d}^\\circ`;
const piTex = (num: number, den: number) => (den === 1 ? `${num === 1 ? "" : num}\\pi` : `\\frac{${num === 1 ? "" : num}\\pi}{${den}}`);
const reduceDeg = (d: number): [number, number] => { let g = d, h = 180; while (h) [g, h] = [h, g % h]; return [d / g, 180 / g]; };
function build(rng: Rng, cx: UcCtx, o: { stim: string; question: string; d: number; P: Record<string, number | string>; predicateJs: string; trace: [string, string][]; variant: string; ko: string; en: string }): Instance {
  const { choices: ch, correctIndex, rules } = choices(rng, cx, o.d);
  return choiceInst(rng, { stimulus: o.stim, question: o.question, choices: ch, correctIndex, rules, P: o.P, predicateJs: o.predicateJs, diagnoseJs: DIAG, trace: o.trace, variant: o.variant, explainKo: o.ko, explainEn: o.en });
}
const PRED_A = `${NORM_JS}return Math.abs(n360(c.points[0].angle) - n360(P.t)) < 1e-6;`;
const PRED_R = `${NORM_JS}return Math.abs(n360(c.points[0].angle) - n360(P.n * 180 / P.den)) < 1e-6;`;

export const ITEM = defineItem({
  prefix: "rtt", itemId: "right_triangles_trigonometry.unit_circle_radian.UC.C",
  hard: [
    {
      op: "repr_shift", structure: "도(°)로 주어진 각이 표준위치에서 놓이는 곳을 단위원 그림 4개 중에서 고름", extra: "도의 크기로 사분면과 반사각을 따져야 함(반사 위치를 헷갈리는 함정) — medium 은 라디안으로 주어진 각", sprNo: SPR_NO,
      concepts: ["표준위치 각", "단위원", "반사각"],
      gen(rng) {
        const cx = ucCtx(rng, { choiceLetters: true }); const d = pick(rng, () => true);
        return build(rng, cx, {
          stim: `${intro(rng, cx)} The measure of angle $${cx.a.tex}$ is $${mathDeg(d)}$.`, question: q1(rng), d, P: { t: d }, predicateJs: PRED_A,
          trace: [[`각 ${cx.a.ch} = ${d}° 이므로 ${QN[quadOfAngle(d)]}사분면이고 반사각은 ${refOf(d)}° 이다.`, "Find the quadrant and reference angle."], [`양의 x축에서 반시계 방향으로 ${d}° 만큼 회전한 끝변을 찾는다.`, "Rotate counterclockwise from the positive x-axis."], [`정답 그림은 점이 ${QN[quadOfAngle(d)]}사분면에 있고 x축과 ${refOf(d)}° 를 이룬다.`, "The correct figure matches both."], [`다른 그림은 x축 대칭·y축 대칭·원점 대칭 위치의 각이다.`, "The others are reflections."], ["네 그림은 같은 반사각을 공유하므로 사분면까지 확인해야 한다.", "All four figures share the reference angle, so check the quadrant."]], variant: `degrees_${QN[quadOfAngle(d)]}`, ko: `${d}° 의 끝변이 놓인 그림을 고른다.`, en: "Choose the figure whose terminal side is at the given angle.",
        });
      },
    },
    {
      op: "chain2", structure: "2π 이상이거나 음수인 라디안 각을 0 이상 2π 미만으로 바꿔(동일 끝변) 단위원 그림을 고름", extra: "2π 의 배수를 더하거나 빼 끝변을 같게 만든 뒤 위치를 정해야 함(음수 각의 회전 방향을 헷갈리는 함정) — medium 은 0 이상 2π 미만의 라디안",
      sprNo: SPR_NO, concepts: ["라디안", "동일 끝변", "표준위치 각"],
      gen(rng) {
        const cx = ucCtx(rng, { choiceLetters: true }); const d = pick(rng, () => true); const neg = rng.chance(0.5);
        // 양의 큰 각: d + 360, 음수: d − 360
        const raw = neg ? d - 360 : d + 360; const [n, den] = reduceDeg(Math.abs(raw)); const sgn = raw < 0 ? "-" : "";
        return build(rng, cx, {
          stim: `${intro(rng, cx)} The measure of angle $${cx.a.tex}$ is $${sgn}${piTex(n, den)}$ radians.`, question: q1(rng), d, P: { n, den, sg: raw < 0 ? -1 : 1 },
          predicateJs: `${NORM_JS}return Math.abs(n360(c.points[0].angle) - n360(P.sg * P.n * 180 / P.den)) < 1e-6;`,
          trace: [[`각 ${cx.a.ch} = ${sgn}${radLabel(Math.abs(raw))} 라디안 = ${raw}° 이다.`, "Convert the radian measure to degrees."], [`${raw < 0 ? "360° 를 더해" : "360° 를 빼"} 0° 이상 360° 미만의 같은 끝변을 구하면 ${d}° 이다.`, "Add or subtract a full turn."], [`${d}° 는 ${QN[quadOfAngle(d)]}사분면이고 반사각은 ${refOf(d)}° 이다.`, "Quadrant and reference angle."], [`정답 그림은 점이 ${QN[quadOfAngle(d)]}사분면에서 반사각 ${refOf(d)}° 를 이룬다.`, "The correct figure matches."], ["네 그림은 같은 반사각을 공유하므로 사분면까지 확인해야 한다.", "All four figures share the reference angle, so check the quadrant."]], variant: `coterminal_${neg ? "negative" : "positive"}_${QN[quadOfAngle(d)]}`, ko: `${raw}° 와 같은 끝변의 그림을 고른다.`, en: "Choose the figure with the same terminal side.",
        });
      },
    },
    {
      op: "inverse", structure: "한 삼각비의 값과 다른 삼각비의 부호가 주어질 때 조건을 만족하는 각을 단위원 그림 4개 중에서 고름", extra: "값이 같은 두 각 중 부호 조건에 맞는 사분면을 골라야 함(반사각 위치를 헷갈리는 함정) — medium 은 라디안으로 주어진 각",
      sprNo: SPR_NO, concepts: ["단위원", "삼각비의 부호", "사분면", "역삼각"],
      gen(rng) {
        const cx = ucCtx(rng, { choiceLetters: true }); const d = pick(rng, (x) => refOf(x) !== 45); const f = rng.pick(["sin", "cos"] as const); const e = exOf(d, f); const o: "sin" | "cos" = f === "sin" ? "cos" : "sin"; const os = exOf(d, o).s;
        const valTex = `${e.s < 0 ? "-" : ""}\\frac{${e.k > 1 ? `\\sqrt{${e.k}}` : e.c}}{${e.d}}`;
        return build(rng, cx, {
          stim: `${intro(rng, cx)} For angle $${cx.a.tex}$ with $0 \\le ${cx.a.tex} < 2\\pi$, $\\${f}${cx.a.tex} = ${valTex}$ and $\\${o}${cx.a.tex} ${os > 0 ? ">" : "<"} 0$.`, question: q1(rng), d,
          P: { f, sg: e.s, v: `${e.c === 1 && e.k > 1 ? "" : e.c}${e.k > 1 ? `√${e.k}` : ""}/${e.d}`, o: os },
          predicateJs: `${PN_JS}${TRIG_JS}const a = c.points[0].angle; const t = P.sg * pn(P.v); const other = P.f === 'sin' ? 'cos' : 'sin'; return Math.abs(T(a, P.f) - t) < 1e-9 && Math.sign(T(a, other)) === P.o;`,
          trace: [[`${f} ${cx.a.ch} = ${exTxt(e)} 이므로 반사각은 ${refOf(d)}° 이다.`, "The value gives the reference angle."], [`${f} 값이 같은 각은 두 사분면에 있다.`, "Two quadrants share this value."], [`${o} ${cx.a.ch} 가 ${os > 0 ? "양수" : "음수"}이므로 ${QN[quadOfAngle(d)]}사분면이다.`, "The other sign picks the quadrant."], [`정답 그림은 점이 ${QN[quadOfAngle(d)]}사분면에서 반사각 ${refOf(d)}° 를 이룬다.`, "The correct figure matches."], ["네 그림은 같은 반사각을 공유하므로 사분면까지 확인해야 한다.", "All four figures share the reference angle, so check the quadrant."]], variant: `${f}_value_${o}_sign_${QN[quadOfAngle(d)]}`, ko: "값과 부호 조건에 맞는 사분면의 각을 고른다.", en: "Choose the angle that matches the value and the sign condition.",
        });
      },
    },
    {
      op: "compare_scenarios", structure: "첫 사분면의 각 α 가 주어지고 π − α·π + α·2π − α 로 정의된 각이 놓이는 곳을 단위원 그림 4개 중에서 고름", extra: "α 를 기준으로 π±α, 2π−α 의 위치를 구분해야 함(α 자신이나 다른 반사 위치를 고르는 함정) — medium 은 라디안으로 주어진 각",
      sprNo: SPR_NO, concepts: ["라디안", "각의 연산", "반사각", "표준위치 각"],
      gen(rng) {
        const cx = ucCtx(rng, { choiceLetters: true }); const a = rng.pick([30, 45, 60]); const op = rng.pick(["pi_minus", "pi_plus", "two_pi_minus"] as const); const d = op === "pi_minus" ? 180 - a : op === "pi_plus" ? 180 + a : 360 - a; const [n, den] = reduceDeg(a);
        const expr = op === "pi_minus" ? "\\pi - \\alpha" : op === "pi_plus" ? "\\pi + \\alpha" : "2\\pi - \\alpha";
        return build(rng, cx, {
          stim: `${intro(rng, cx)} Let $\\alpha = ${piTex(n, den)}$ radians, and let the measure of angle $${cx.a.tex}$ be $${expr}$.`, question: q1(rng), d, P: { op, n, den },
          predicateJs: `${NORM_JS}const al = P.n * 180 / P.den; const t = P.op === 'pi_minus' ? 180 - al : P.op === 'pi_plus' ? 180 + al : 360 - al; return Math.abs(n360(c.points[0].angle) - n360(t)) < 1e-6;`,
          trace: [[`α = ${radLabel(a)} = ${a}° 이다.`, "Convert alpha to degrees."], [`${cx.a.ch} = ${op === "pi_minus" ? "180° − α" : op === "pi_plus" ? "180° + α" : "360° − α"} = ${d}° 이다.`, "Evaluate the expression."], [`${d}° 는 ${QN[quadOfAngle(d)]}사분면이고 반사각은 ${refOf(d)}° 이다.`, "Quadrant and reference angle."], [`정답 그림은 점이 ${QN[quadOfAngle(d)]}사분면에서 반사각 ${refOf(d)}° 를 이룬다.`, "The correct figure matches."], ["네 그림은 같은 반사각을 공유하므로 사분면까지 확인해야 한다.", "All four figures share the reference angle, so check the quadrant."]], variant: `${op}_${a}`, ko: `${d}° 의 끝변이 놓인 그림을 고른다.`, en: "Choose the figure at the computed angle.",
        });
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "first_quadrant_radian", structure: "제1사분면의 특수각이 라디안으로 주어질 때 단위원 그림을 고름", extra: "easy: 제1사분면의 라디안 각", sprNo: SPR_NO, concepts: ["라디안", "단위원"],
      gen(rng) {
        const cx = ucCtx(rng, { choiceLetters: true }); const d = rng.pick([30, 45, 60, 30, 45, 60]); const [n, den] = reduceDeg(d);
        return build(rng, cx, { stim: `${intro(rng, cx)} The measure of angle $${cx.a.tex}$ is $${piTex(n, den)}$ radians.`, question: q1(rng), d, P: { n, den }, predicateJs: PRED_R, trace: [[`각 ${cx.a.ch} = ${radLabel(d)} 라디안 = ${d}° 이다.`, "Convert to degrees."], [`${d}° 는 제1사분면이다.`, "First quadrant."]], variant: "radian_first_quadrant", ko: `${d}° 의 그림을 고른다.`, en: "Choose the figure." });
      },
    },
    {
      lv: "medium", name: "radian", structure: "제2~4사분면의 특수각이 라디안으로 주어질 때 단위원 그림을 고름", extra: "medium: 라디안 → 사분면·반사각", sprNo: SPR_NO, concepts: ["라디안", "단위원", "반사각"],
      gen(rng) {
        const cx = ucCtx(rng, { choiceLetters: true }); const d = pick(rng, () => true); const [n, den] = reduceDeg(d);
        return build(rng, cx, { stim: `${intro(rng, cx)} The measure of angle $${cx.a.tex}$ is $${piTex(n, den)}$ radians.`, question: q1(rng), d, P: { n, den }, predicateJs: PRED_R, trace: [[`각 ${cx.a.ch} = ${radLabel(d)} 라디안 = ${d}° 이다.`, "Convert to degrees."], [`${d}° 는 ${QN[quadOfAngle(d)]}사분면이고 반사각은 ${refOf(d)}° 이다.`, "Quadrant and reference angle."], [`정답 그림이 이 위치이다.`, "Choose that figure."]], variant: `radian_${QN[quadOfAngle(d)]}`, ko: `${d}° 의 그림을 고른다.`, en: "Choose the figure." });
      },
    },
  ],
});
void familyOf;
