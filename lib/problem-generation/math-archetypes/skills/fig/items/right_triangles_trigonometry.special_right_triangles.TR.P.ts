// right_triangles_trigonometry.special_right_triangles.TR.P — 30°-60°-90° 직각삼각형 그림에서 짧은 변이 빗변의 절반임을 이용해 변의 길이를 구한다(정수 결과만).
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst } from "../graph-kit";
import { SP_JS, makeSpecial, rtIntro, spRead } from "../tri-kit";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v > 0 && Number.isFinite(w.v));
const intro = (rng: import("../../../rng").Rng, t: { v: [string, string, string] }, extra = "") => rtIntro(rng, t, ` The angle measures shown are in degrees.${extra}`);

export const ITEM = defineItem({
  prefix: "rtt", itemId: "right_triangles_trigonometry.special_right_triangles.TR.P",
  hard: [
    {
      op: "chain2", structure: "30°-60°-90° 삼각형의 빗변 라벨에서 짧은 변(= 빗변의 절반)을 구한 뒤 빗변과 짧은 변의 합을 구함", extra: "짧은 변을 먼저 구해 빗변과 더하는 연쇄(빗변의 절반만 답하는 함정) — medium 은 짧은 변",
      concepts: ["특수각 직각삼각형", "30-60-90", "변의 합"],
      gen(rng) {
        const t = makeSpecial(rng, { show: "hyp", ask: "short" }); const correct = t.a + 2 * t.a;
        return gInst(rng, {
          stimulus: intro(rng, t),
          question: rng.pick([`What is the sum of the lengths of the shortest side and the hypotenuse?`, `The shortest side and the hypotenuse have a combined length of how many units?`]), correct,
          wrongs: pos([W(t.a, "step_missing", "짧은 변만 답했다."), W(2 * t.a, "step_missing", "빗변만 답했다."), W(4 * t.a, "formula_misuse", "빗변을 두 번 더했다."), W(t.a * 2 + t.a * 2, "formula_misuse", "짧은 변을 빗변으로 보았다."), W(correct + 1, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({}, t.fig, `${SP_JS}return SHORT+HYP;`),
          trace: [spRead(t, `빗변 = ${2 * t.a}`), [`짧은 변 = ${2 * t.a} ÷ 2 = ${t.a} 이다.`, "Half the hypotenuse."], [`합 = ${t.a} + ${2 * t.a} = ${correct} 이다.`, "Add."], [`30° 의 대변이 짧은 변이다.`, "The side opposite 30° is the shortest."], [`따라서 ${correct} 이다.`, "State the sum."]], variant: "short_plus_hypotenuse",
        }, t.fig);
      },
    },
    {
      op: "inverse", structure: "짧은 변의 길이가 주어질 때 빗변(= 짧은 변의 2 배)을 구하고 그 둘의 차를 구함", extra: "짧은 변에서 빗변을 거꾸로 구해 차를 계산해야 함 — medium 은 빗변",
      concepts: ["특수각 직각삼각형", "30-60-90", "역산"],
      gen(rng) {
        const t = makeSpecial(rng, { show: "short", ask: "hyp" }); const correct = 2 * t.a - t.a;
        return gInst(rng, {
          stimulus: intro(rng, t),
          question: rng.pick([`By how much is the hypotenuse longer than the shortest side?`, `How many units longer than the shortest side is the hypotenuse?`]), correct,
          wrongs: pos([W(2 * t.a, "step_missing", "빗변만 답했다."), W(t.a / 2, "formula_misuse", "빗변을 절반으로 보았다."), W(3 * t.a, "sign_error", "합을 구했다."), W(correct + 1, "other", "계산 중 어긋났다."), W(2 * t.a - t.a * 2 + 2, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({}, t.fig, `${SP_JS}return HYP-SHORT;`),
          trace: [spRead(t, `짧은 변 = ${t.a}`), [`빗변 = 2 × ${t.a} = ${2 * t.a} 이다.`, "Twice the shortest side."], [`차 = ${2 * t.a} - ${t.a} = ${correct} 이다.`, "Subtract."], [`차는 짧은 변과 같다.`, "The difference equals the shortest side."], [`따라서 ${correct} 이다.`, "State the difference."]], variant: "hypotenuse_minus_short",
        }, t.fig);
      },
    },
    {
      op: "unit_ratio", structure: "빗변이 feet 로 라벨된 30°-60°-90° 삼각형에서 짧은 변을 inches 로 구함(1 foot = 12 inches)", extra: "짧은 변(feet)을 구한 뒤 단위를 환산해야 함 — medium 은 짧은 변",
      concepts: ["특수각 직각삼각형", "30-60-90", "단위 환산"],
      gen(rng) {
        const t = makeSpecial(rng, { show: "hyp", ask: "short", max: 15 }); const correct = t.a * 12;
        return gInst(rng, {
          stimulus: intro(rng, t, " The side lengths in the figure are in feet."),
          question: rng.pick([`What is the length of the shortest side, in inches? (1 foot = 12 inches)`, `How many inches long is the shortest side? (1 foot = 12 inches)`, `Convert the length of the shortest side to inches. (1 foot = 12 inches)`, `The shortest side measures how many inches? (1 foot = 12 inches)`, `Express the shortest side in inches, given that 1 foot = 12 inches.`]), correct,
          wrongs: pos([W(t.a, "unit_error", "feet 로 답했다."), W(2 * t.a * 12, "formula_misuse", "빗변을 환산했다."), W(Math.round((t.a / 12) * 100) / 100, "unit_error", "나누어 환산했다."), W(correct + 12, "other", "한 feet 어긋났다."), W(t.a * 10, "unit_error", "1 foot 를 10 inches 로 보았다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({}, t.fig, `${SP_JS}return SHORT*12;`),
          trace: [spRead(t, `빗변 = ${2 * t.a} feet`), [`짧은 변 = ${2 * t.a} ÷ 2 = ${t.a} feet 이다.`, "Half the hypotenuse."], [`${t.a} × 12 = ${correct} inches 이다.`, "Convert to inches."], [`1 foot = 12 inches 이다.`, "The conversion factor."], [`따라서 ${correct} 이다.`, "State the length."]], variant: "short_side_in_inches",
        }, t.fig);
      },
    },
    {
      op: "compare_scenarios", structure: "두 30°-60°-90° 삼각형(그림에 나란히)의 짧은 변을 각각 구해 차를 구함", extra: "한 삼각형은 빗변, 다른 삼각형은 짧은 변이 주어져 두 짧은 변을 같은 기준으로 맞춰 비교해야 함 — medium 은 한 삼각형의 짧은 변",
      concepts: ["특수각 직각삼각형", "30-60-90", "두 도형 비교"],
      gen(rng) {
        const t = makeSpecial(rng, { show: "hyp", ask: "short", max: 20 }); const a2 = rng.int(2, 20); if (a2 === t.a) throw new GenFail("same"); const sc = (2 * a2) / (2 * t.a); if (sc < 0.45 || sc > 1.55) throw new GenFail("scale");
        const nm = rng.shuffle("ABCDEFGHJKLMNPQRSTUVWXYZ".split("").filter((q) => !t.v.includes(q))).slice(0, 3).sort(); const v2: [string, string, string] = [nm[0], nm[1], nm[2]];
        const fig = { ...t.fig, second: { scale: Math.round(sc * 100) / 100, vertices: v2, kind: "right" as const, rightAngleAt: v2[0], horizontal: [v2[0], v2[1]] as [string, string], sides: [{ between: [v2[0], v2[2]] as [string, string], label: String(a2) }], angles: [{ at: v2[1], arc: false, value: 30 }, { at: v2[2], arc: false, value: 60 }] } };
        const correct = Math.abs(t.a - a2);
        return gInst(rng, {
          stimulus: `${intro(rng, t)} A second right triangle $${v2.join("")}$ with the same angle measures is shown next to it; its shortest side is labeled.`,
          question: rng.pick([`What is the positive difference between the shortest side of triangle $${t.v.join("")}$ and the shortest side of triangle $${v2.join("")}$?`, `By how much do the two shortest sides differ?`]), correct,
          wrongs: pos([W(Math.abs(2 * t.a - a2), "formula_misuse", "빗변과 짧은 변을 비교했다."), W(t.a + a2, "sign_error", "합을 구했다."), W(Math.abs(2 * t.a - 2 * a2), "formula_misuse", "빗변끼리 비교했다."), W(a2, "step_missing", "한 삼각형만 답했다."), W(correct + 1, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({}, fig, `${SP_JS}const s2=FIGURE.second.sides[0]; const a2=Number(s2.label); if (!(a2>0)) throw new Error('둘째 짧은 변 필요'); return Math.abs(SHORT-a2);`),
          trace: [spRead(t, `첫째 빗변 = ${2 * t.a}`), [`첫째 짧은 변 = ${t.a}, 둘째 짧은 변 = ${a2} 이다.`, "Both shortest sides."], [`차 = |${t.a} - ${a2}| = ${correct} 이다.`, "Positive difference."], [`둘째는 짧은 변이 바로 주어져 있다.`, "The second triangle gives the short side directly."], [`따라서 ${correct} 이다.`, "State the difference."]], variant: "short_side_gap_two_triangles",
        }, fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "short_from_hyp", structure: "빗변이 주어진 30°-60°-90° 삼각형에서 짧은 변(빗변의 절반)을 구함", extra: "easy: 빗변 ÷ 2", concepts: ["특수각 직각삼각형", "30-60-90"],
      gen(rng) {
        const t = makeSpecial(rng, { show: "hyp", ask: "short" });
        return gInst(rng, { stimulus: intro(rng, t), question: rng.pick([`What is the length of the side labeled $x$?`, `What is the value of $x$?`]), correct: t.a, wrongs: pos([W(2 * t.a, "step_missing", "빗변을 답했다."), W(4 * t.a, "formula_misuse", "빗변의 2 배를 답했다."), W(t.a + 1, "other", "계산 중 어긋났다."), W(Math.round(t.a * 1.5), "formula_misuse", "계산 중 어긋났다.")]).filter((w) => w.v !== t.a), verificationJs: figJs({}, t.fig, `${SP_JS}return SHORT;`), trace: [spRead(t, `빗변 = ${2 * t.a}`), [`짧은 변 x = ${2 * t.a} ÷ 2 = ${t.a} 이다.`, "Half the hypotenuse."]], variant: "short_side_from_hypotenuse",
        }, t.fig);
      },
    },
    {
      lv: "medium", name: "hyp_from_short", structure: "짧은 변이 주어진 30°-60°-90° 삼각형에서 빗변(짧은 변의 2 배)을 구함", extra: "medium: 짧은 변 × 2", concepts: ["특수각 직각삼각형", "30-60-90"],
      gen(rng) {
        const t = makeSpecial(rng, { show: "short", ask: "hyp" });
        return gInst(rng, { stimulus: intro(rng, t), question: rng.pick([`What is the length of the side labeled $x$?`, `What is the value of $x$?`]), correct: 2 * t.a, wrongs: pos([W(t.a, "step_missing", "짧은 변을 답했다."), W(t.a / 2, "formula_misuse", "절반으로 보았다."), W(3 * t.a, "formula_misuse", "3 배로 보았다."), W(2 * t.a + 1, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== 2 * t.a), verificationJs: figJs({}, t.fig, `${SP_JS}return HYP;`), trace: [spRead(t, `짧은 변 = ${t.a}`), [`빗변 x = 2 × ${t.a} = ${2 * t.a} 이다.`, "Twice the shortest side."], [`30° 의 대변이 짧은 변이다.`, "The side opposite 30°."]], variant: "hypotenuse_from_short_side",
        }, t.fig);
      },
    },
  ],
});
