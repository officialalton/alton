// right_triangles_trigonometry.pythagorean_hypotenuse.TR.P — 직각삼각형 그림의 두 직각변 라벨로 피타고라스 정리를 써서 빗변(x)과 그 확장을 구한다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst } from "../graph-kit";
import { RT_JS, makeRight, rtIntro, rtRead, TRIPLES } from "../tri-kit";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v > 0 && Number.isFinite(w.v));

export const ITEM = defineItem({
  prefix: "rtt", itemId: "right_triangles_trigonometry.pythagorean_hypotenuse.TR.P",
  hard: [
    {
      op: "chain2", structure: "두 직각변 라벨로 빗변(x)을 구한 뒤 삼각형의 둘레를 구함", extra: "빗변을 먼저 구해 세 변을 더하는 연쇄(두 직각변만 더하는 함정) — medium 은 빗변",
      concepts: ["피타고라스 정리", "빗변", "둘레"],
      gen(rng) {
        const t = makeRight(rng, { unknown: "hyp" }); const [b, h] = t.legs; const correct = b + h + t.hyp;
        return gInst(rng, {
          stimulus: rtIntro(rng, t),
          question: rng.pick([`What is the perimeter of triangle $${t.v.join("")}$?`, `What is the sum of the lengths of the three sides of the triangle?`, `The perimeter of the triangle is how long?`]), correct,
          wrongs: pos([W(b + h, "step_missing", "두 직각변만 더했다."), W(t.hyp, "step_missing", "빗변만 답했다."), W(b + h + (b + h), "formula_misuse", "빗변을 두 직각변의 합으로 보았다."), W(correct + 2, "other", "계산 중 어긋났다."), W(b * h, "formula_misuse", "직각변을 곱했다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({}, t.fig, `${RT_JS}return B+H+C;`),
          trace: [rtRead(t), [`피타고라스 정리: x² = ${b}² + ${h}² = ${b * b + h * h} 이므로 x = ${t.hyp} 이다.`, "Pythagorean theorem for the hypotenuse."], [`둘레 = ${b} + ${h} + ${t.hyp} 이다.`, "Add the three sides."], [`= ${correct} 이다.`, "Compute."], [`따라서 ${correct} 이다.`, "State the perimeter."]], variant: "perimeter_after_hypotenuse",
        }, t.fig);
      },
    },
    {
      op: "compose_kind", structure: "빗변을 구한 뒤 두 직각변의 합이 빗변보다 얼마나 긴지 구함", extra: "빗변과 직각변의 합을 비교하는 합성(삼각형의 변 관계) — medium 은 빗변",
      concepts: ["피타고라스 정리", "빗변", "변의 합 비교"],
      gen(rng) {
        const t = makeRight(rng, { unknown: "hyp" }); const [b, h] = t.legs; const correct = b + h - t.hyp;
        return gInst(rng, {
          stimulus: rtIntro(rng, t),
          question: rng.pick([`By how much is the sum of the lengths of the two legs greater than the length of the hypotenuse?`, `The two legs together are how much longer than the hypotenuse?`]), correct,
          wrongs: pos([W(b + h, "step_missing", "직각변의 합만 답했다."), W(t.hyp, "step_missing", "빗변만 답했다."), W(Math.abs(b - h), "formula_misuse", "직각변의 차를 구했다."), W(b + h + t.hyp, "sign_error", "세 변의 합을 구했다."), W(correct + 1, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({}, t.fig, `${RT_JS}return B+H-C;`),
          trace: [rtRead(t), [`빗변 x = √(${b}² + ${h}²) = ${t.hyp} 이다.`, "Find the hypotenuse."], [`두 직각변의 합 = ${b} + ${h} = ${b + h} 이다.`, "Sum of the legs."], [`차 = ${b + h} - ${t.hyp} = ${correct} 이다.`, "Subtract."], [`따라서 ${correct} 이다.`, "State the difference."]], variant: "legs_sum_minus_hypotenuse",
        }, t.fig);
      },
    },
    {
      op: "unit_ratio", structure: "그림의 변 길이는 feet 이고 빗변을 inches 로 구함(1 foot = 12 inches)", extra: "빗변(feet)을 구한 뒤 단위를 환산해야 함(환산 먼저·후 혼동) — medium 은 빗변",
      concepts: ["피타고라스 정리", "빗변", "단위 환산"],
      gen(rng) {
        const t = makeRight(rng, { unknown: "hyp", maxSide: 40 }); const correct = t.hyp * 12; const [b, h] = t.legs;
        return gInst(rng, {
          stimulus: rtIntro(rng, t, " The side lengths in the figure are in feet."),
          question: rng.pick([`What is the length of the hypotenuse, in inches? (1 foot = 12 inches)`, `How many inches long is the hypotenuse? (1 foot = 12 inches)`]), correct,
          wrongs: pos([W(t.hyp, "unit_error", "feet 로 답했다."), W((b + h) * 12, "formula_misuse", "직각변의 합을 환산했다."), W(Math.round(t.hyp / 12 * 100) / 100, "unit_error", "나누어 환산했다."), W(correct + 12, "other", "한 feet 어긋났다."), W(t.hyp * 10, "unit_error", "1 foot 를 10 inches 로 보았다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({}, t.fig, `${RT_JS}return C*12;`),
          trace: [rtRead(t), [`빗변 x = √(${b}² + ${h}²) = ${t.hyp} feet 이다.`, "Hypotenuse in feet."], [`1 foot = 12 inches 이므로 ${t.hyp} × 12 이다.`, "Convert to inches."], [`= ${correct} inches 이다.`, "Compute."], [`따라서 ${correct} 이다.`, "State the length."]], variant: "hypotenuse_in_inches",
        }, t.fig);
      },
    },
    {
      op: "compare_scenarios", structure: "두 직각삼각형(그림에 나란히)의 빗변을 각각 구해 길이 차를 구함", extra: "두 삼각형의 빗변을 따로 구해 비교해야 함(직각변 차를 답하는 함정) — medium 은 한 삼각형의 빗변",
      concepts: ["피타고라스 정리", "빗변", "두 도형 비교"],
      gen(rng) {
        const t = makeRight(rng, { unknown: "hyp", maxSide: 30 }); const [a2, b2, c2] = rng.pick(TRIPLES.filter((q) => q[2] <= 30 && q[2] !== t.hyp)); const legs2: [number, number] = rng.chance(0.5) ? [a2, b2] : [b2, a2]; if (c2 === t.hyp) throw new GenFail("same");
        const nm = rng.shuffle("ABCDEFGHJKLMNPQRSTUVWXYZ".split("").filter((q) => !t.v.includes(q))).slice(0, 3).sort(); const v2: [string, string, string] = [nm[0], nm[1], nm[2]];
        const sc = c2 / t.hyp; if (sc < 0.45 || sc > 1.55) throw new GenFail("scale"); // 두 삼각형의 크기 비율을 그림에도 반영한다(엔진 second.scale 0.4~1.6)
        const fig = { ...t.fig, second: { scale: Math.round(sc * 100) / 100, vertices: v2, kind: "right" as const, rightAngleAt: v2[0], horizontal: [v2[0], v2[1]] as [string, string], sides: [{ between: [v2[0], v2[1]] as [string, string], label: String(legs2[0]) }, { between: [v2[0], v2[2]] as [string, string], label: String(legs2[1]) }, { between: [v2[1], v2[2]] as [string, string], label: "x" }] } };
        const correct = Math.abs(c2 - t.hyp); const [b, h] = t.legs;
        return gInst(rng, {
          stimulus: `${rtIntro(rng, t)} A second right triangle $${v2.join("")}$ is shown next to it, with the right angle at $${v2[0]}$.`,
          question: rng.pick([`What is the positive difference between the hypotenuse of triangle $${t.v.join("")}$ and the hypotenuse of triangle $${v2.join("")}$?`, `By how much do the two hypotenuses differ?`]), correct,
          wrongs: pos([W(Math.abs(legs2[0] + legs2[1] - b - h), "formula_misuse", "직각변 합의 차를 구했다."), W(t.hyp + c2, "sign_error", "빗변의 합을 구했다."), W(Math.abs(legs2[0] - b), "step_missing", "밑변끼리 비교했다."), W(c2, "step_missing", "한 빗변만 답했다."), W(correct + 1, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({}, fig, `${RT_JS}const s=FIGURE.second.sides; const n2=(q)=>/^\\d+(?:\\.\\d+)?$/.test(String(q))?Number(q):NaN; const b2=n2(s[0].label), h2=n2(s[1].label); if (!(b2>0&&h2>0)) throw new Error('둘째 삼각형 직각변 필요'); return Math.abs(Math.sqrt(b2*b2+h2*h2)-C);`),
          trace: [rtRead(t), [`첫째: x₁ = √(${b}² + ${h}²) = ${t.hyp} 이다.`, "First hypotenuse."], [`둘째: x₂ = √(${legs2[0]}² + ${legs2[1]}²) = ${c2} 이다.`, "Second hypotenuse."], [`차 = |${c2} - ${t.hyp}| = ${correct} 이다.`, "Positive difference."], [`따라서 ${correct} 이다.`, "State the difference."]], variant: "hypotenuse_gap_two_triangles",
        }, fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "hypotenuse", structure: "직각삼각형의 두 직각변으로 빗변(피타고라스 수)을 구함", extra: "easy: 피타고라스 정리 한 번", concepts: ["피타고라스 정리", "빗변"],
      gen(rng) {
        const t = makeRight(rng, { unknown: "hyp" });
        return gInst(rng, { stimulus: rtIntro(rng, t), question: rng.pick([`What is the value of $x$?`, `What is the length of the hypotenuse?`]), correct: t.hyp, wrongs: pos([W(t.legs[0] + t.legs[1], "formula_misuse", "직각변의 합을 답했다."), W(Math.round(Math.sqrt(Math.abs(t.legs[0] * t.legs[0] - t.legs[1] * t.legs[1]))), "formula_misuse", "제곱의 차로 구했다."), W(t.legs[0] * t.legs[0] + t.legs[1] * t.legs[1], "step_missing", "제곱근을 취하지 않았다."), W(t.hyp + 1, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== t.hyp), verificationJs: figJs({}, t.fig, `${RT_JS}return C;`), trace: [rtRead(t), [`x² = ${t.legs[0]}² + ${t.legs[1]}² = ${t.hyp * t.hyp} 이다.`, "Pythagorean theorem."], [`x = ${t.hyp} 이다.`, "Take the square root."]], variant: "hypotenuse_triple",
        }, t.fig);
      },
    },
    {
      lv: "medium", name: "larger_leg_plus_hyp", structure: "빗변을 구한 뒤 빗변에서 짧은 직각변을 뺌", extra: "medium: 빗변 계산 + 뺄셈", concepts: ["피타고라스 정리", "빗변"],
      gen(rng) {
        const t = makeRight(rng, { unknown: "hyp" }); const sh = Math.min(...t.legs); const correct = t.hyp - sh;
        return gInst(rng, { stimulus: rtIntro(rng, t), question: `How much longer is the hypotenuse than the shorter leg?`, correct, wrongs: pos([W(t.hyp, "step_missing", "빗변만 답했다."), W(Math.max(...t.legs) - sh, "formula_misuse", "직각변의 차를 구했다."), W(t.hyp - Math.max(...t.legs), "opposite", "긴 직각변과 비교했다."), W(correct + 1, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== correct), verificationJs: figJs({}, t.fig, `${RT_JS}return C-Math.min(B,H);`), trace: [rtRead(t), [`빗변 = ${t.hyp} 이고 짧은 직각변 = ${sh} 이다.`, "Hypotenuse and shorter leg."], [`차 = ${t.hyp} - ${sh} = ${correct} 이다.`, "Subtract."]], variant: "hypotenuse_minus_shorter_leg",
        }, t.fig);
      },
    },
  ],
});
