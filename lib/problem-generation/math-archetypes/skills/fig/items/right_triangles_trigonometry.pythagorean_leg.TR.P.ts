// right_triangles_trigonometry.pythagorean_leg.TR.P — 직각삼각형 그림에서 빗변과 한 직각변 라벨로 모르는 직각변(x)을 구하고 그 확장을 구한다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { gInst } from "../graph-kit";
import { RT_JS, makeRight, rtIntro, rtRead, TRIPLES } from "../tri-kit";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => w.v > 0 && Number.isFinite(w.v));
/** 모르는 직각변(x)·아는 직각변. */
const sides = (t: ReturnType<typeof makeRight>, u: "base" | "height") => (u === "base" ? { x: t.legs[0], known: t.legs[1] } : { x: t.legs[1], known: t.legs[0] });

export const ITEM = defineItem({
  prefix: "rtt", itemId: "right_triangles_trigonometry.pythagorean_leg.TR.P",
  hard: [
    {
      op: "chain2", structure: "빗변과 한 직각변 라벨로 모르는 직각변(x)을 구한 뒤 삼각형의 넓이를 구함", extra: "직각변을 먼저 구해 두 직각변으로 넓이를 계산하는 연쇄(빗변을 밑변으로 쓰는 함정) — medium 은 모르는 직각변",
      concepts: ["피타고라스 정리", "직각변", "삼각형의 넓이"],
      gen(rng) {
        const u = rng.pick(["base", "height"] as const); const t = makeRight(rng, { unknown: u }); const { x, known } = sides(t, u); const correct = (x * known) / 2;
        return gInst(rng, {
          stimulus: rtIntro(rng, t),
          question: rng.pick([`What is the area of triangle $${t.v.join("")}$?`, `What is the area of the triangle shown?`, `The triangle has an area of how many square units?`]), correct,
          wrongs: pos([W((t.hyp * known) / 2, "formula_misuse", "빗변을 밑변으로 썼다."), W(x * known, "step_missing", "2 로 나누지 않았다."), W(x, "step_missing", "x 만 답했다."), W((x + known + t.hyp), "formula_misuse", "둘레를 구했다."), W(correct + 1, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({}, t.fig, `${RT_JS}return B*H/2;`),
          trace: [rtRead(t), [`x² + ${known}² = ${t.hyp}² 이므로 x² = ${t.hyp * t.hyp} - ${known * known} = ${x * x} 이고 x = ${x} 이다.`, "Pythagorean theorem for the unknown leg."], [`넓이 = ½ × ${x} × ${known} 이다.`, "Area of a right triangle uses the two legs."], [`= ${correct} 이다.`, "Compute."], [`따라서 ${correct} 이다.`, "State the area."]], variant: "area_after_leg",
        }, t.fig);
      },
    },
    {
      op: "compose_kind", structure: "모르는 직각변(x)을 구한 뒤 삼각형의 둘레를 구함", extra: "직각변을 구해 세 변을 더하는 합성 — medium 은 모르는 직각변",
      concepts: ["피타고라스 정리", "직각변", "둘레"],
      gen(rng) {
        const u = rng.pick(["base", "height"] as const); const t = makeRight(rng, { unknown: u }); const { x, known } = sides(t, u); const correct = x + known + t.hyp;
        return gInst(rng, {
          stimulus: rtIntro(rng, t),
          question: rng.pick([`What is the perimeter of triangle $${t.v.join("")}$?`, `What is the sum of the three side lengths?`]), correct,
          wrongs: pos([W(known + t.hyp, "step_missing", "아는 두 변만 더했다."), W(x, "step_missing", "x 만 답했다."), W(known + t.hyp + (t.hyp - known), "formula_misuse", "빗변에서 뺀 값을 x 로 보았다."), W(correct + 2, "other", "계산 중 어긋났다."), W((x * known) / 2, "formula_misuse", "넓이를 구했다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({}, t.fig, `${RT_JS}return B+H+C;`),
          trace: [rtRead(t), [`x = √(${t.hyp}² - ${known}²) = ${x} 이다.`, "The unknown leg."], [`둘레 = ${x} + ${known} + ${t.hyp} 이다.`, "Add the three sides."], [`= ${correct} 이다.`, "Compute."], [`따라서 ${correct} 이다.`, "State the perimeter."]], variant: "perimeter_after_leg",
        }, t.fig);
      },
    },
    {
      op: "unit_ratio", structure: "그림의 변 길이는 centimeters 이고 모르는 직각변을 millimeters 로 구함(1 cm = 10 mm)", extra: "직각변(cm)을 구한 뒤 단위를 환산해야 함 — medium 은 모르는 직각변",
      concepts: ["피타고라스 정리", "직각변", "단위 환산"],
      gen(rng) {
        const u = rng.pick(["base", "height"] as const); const t = makeRight(rng, { unknown: u }); const { x } = sides(t, u); const correct = x * 10;
        return gInst(rng, {
          stimulus: rtIntro(rng, t, " The side lengths in the figure are in centimeters."),
          question: rng.pick([`What is the length of the leg labeled $x$, in millimeters? (1 centimeter = 10 millimeters)`, `The leg labeled $x$ is how many millimeters long? (1 centimeter = 10 millimeters)`]), correct,
          wrongs: pos([W(x, "unit_error", "cm 로 답했다."), W(Math.round(x / 10 * 100) / 100, "unit_error", "나누어 환산했다."), W(t.hyp * 10, "formula_misuse", "빗변을 환산했다."), W(correct + 10, "other", "한 cm 어긋났다."), W(x * 100, "unit_error", "1 cm 를 100 mm 로 보았다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({}, t.fig, `const idx=FIGURE.sides.findIndex(q=>String(q.label)==='x'); if (idx<0||idx===2) throw new Error('모르는 직각변 필요'); ${RT_JS}return (idx===0?B:H)*10;`),
          trace: [rtRead(t), [`x = √(${t.hyp}² - ${sides(t, u).known}²) = ${x} cm 이다.`, "The unknown leg in centimeters."], [`1 cm = 10 mm 이므로 ${x} × 10 이다.`, "Convert to millimeters."], [`= ${correct} 이다.`, "Compute."], [`따라서 ${correct} 이다.`, "State the length."]], variant: "leg_in_millimeters",
        }, t.fig);
      },
    },
    {
      op: "compare_scenarios", structure: "두 직각삼각형(그림에 나란히)의 모르는 직각변을 각각 구해 길이 차를 구함", extra: "두 삼각형의 직각변을 따로 구해 비교해야 함 — medium 은 한 삼각형의 직각변",
      concepts: ["피타고라스 정리", "직각변", "두 도형 비교"],
      gen(rng) {
        const t = makeRight(rng, { unknown: "height", maxSide: 30 }); const [a2, b2, c2] = rng.pick(TRIPLES.filter((q) => q[2] <= 30)); const legs2: [number, number] = rng.chance(0.5) ? [a2, b2] : [b2, a2]; const x2 = legs2[1], known2 = legs2[0];
        if (x2 === t.legs[1]) throw new GenFail("same");
        const nm = rng.shuffle("ABCDEFGHJKLMNPQRSTUVWXYZ".split("").filter((q) => !t.v.includes(q))).slice(0, 3).sort(); const v2: [string, string, string] = [nm[0], nm[1], nm[2]];
        const sc = c2 / t.hyp; if (sc < 0.45 || sc > 1.55) throw new GenFail("scale"); // 두 삼각형의 크기 비율을 그림에도 반영한다(엔진 second.scale 0.4~1.6)
        const fig = { ...t.fig, second: { scale: Math.round(sc * 100) / 100, vertices: v2, kind: "right" as const, rightAngleAt: v2[0], horizontal: [v2[0], v2[1]] as [string, string], sides: [{ between: [v2[0], v2[1]] as [string, string], label: String(known2) }, { between: [v2[0], v2[2]] as [string, string], label: "x" }, { between: [v2[1], v2[2]] as [string, string], label: String(c2) }] } };
        const correct = Math.abs(x2 - t.legs[1]);
        return gInst(rng, {
          stimulus: `${rtIntro(rng, t)} A second right triangle $${v2.join("")}$ is shown next to it, with the right angle at $${v2[0]}$.`,
          question: rng.pick([`What is the positive difference between the vertical leg of triangle $${t.v.join("")}$ and the vertical leg of triangle $${v2.join("")}$?`, `By how much do the two vertical legs differ?`]), correct,
          wrongs: pos([W(Math.abs(c2 - t.hyp), "formula_misuse", "빗변의 차를 구했다."), W(Math.abs(known2 - t.legs[0]), "step_missing", "아는 직각변끼리 비교했다."), W(x2 + t.legs[1], "sign_error", "합을 구했다."), W(x2, "step_missing", "한 직각변만 답했다."), W(correct + 1, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== correct),
          verificationJs: figJs({}, fig, `${RT_JS}const s=FIGURE.second.sides; const n2=(q)=>/^\\d+(?:\\.\\d+)?$/.test(String(q))?Number(q):NaN; const b2=n2(s[0].label), c2=n2(s[2].label); if (!(b2>0&&c2>b2)) throw new Error('둘째 삼각형 변 필요'); return Math.abs(Math.sqrt(c2*c2-b2*b2)-H);`),
          trace: [rtRead(t), [`첫째: x₁ = ${t.legs[1]} 이다.`, "First vertical leg."], [`둘째: x₂ = √(${c2}² - ${known2}²) = ${x2} 이다.`, "Second vertical leg."], [`차 = |${x2} - ${t.legs[1]}| = ${correct} 이다.`, "Positive difference."], [`따라서 ${correct} 이다.`, "State the difference."]], variant: "leg_gap_two_triangles",
        }, fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "leg", structure: "빗변과 한 직각변으로 모르는 직각변(피타고라스 수)을 구함", extra: "easy: 피타고라스 정리 한 번", concepts: ["피타고라스 정리", "직각변"],
      gen(rng) {
        const u = rng.pick(["base", "height"] as const); const t = makeRight(rng, { unknown: u }); const { x, known } = sides(t, u);
        return gInst(rng, { stimulus: rtIntro(rng, t), question: rng.pick([`What is the value of $x$?`, `What is the length of the side labeled $x$?`]), correct: x, wrongs: pos([W(t.hyp - known, "formula_misuse", "빗변에서 직각변을 뺐다."), W(t.hyp + known, "sign_error", "합을 구했다."), W(t.hyp * t.hyp - known * known, "step_missing", "제곱근을 취하지 않았다."), W(x + 1, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== x), verificationJs: figJs({}, t.fig, `const idx=FIGURE.sides.findIndex(q=>String(q.label)==='x'); if (idx<0||idx===2) throw new Error('모르는 직각변 필요'); ${RT_JS}return idx===0?B:H;`), trace: [rtRead(t), [`x² = ${t.hyp}² - ${known}² = ${x * x} 이다.`, "Pythagorean theorem."], [`x = ${x} 이다.`, "Take the square root."]], variant: "leg_triple",
        }, t.fig);
      },
    },
    {
      lv: "medium", name: "legs_sum", structure: "모르는 직각변을 구한 뒤 두 직각변의 합을 구함", extra: "medium: 직각변 계산 + 덧셈", concepts: ["피타고라스 정리", "직각변"],
      gen(rng) {
        const u = rng.pick(["base", "height"] as const); const t = makeRight(rng, { unknown: u }); const { x, known } = sides(t, u); const correct = x + known;
        return gInst(rng, { stimulus: rtIntro(rng, t), question: `What is the sum of the lengths of the two legs?`, correct, wrongs: pos([W(t.hyp + known, "formula_misuse", "빗변을 더했다."), W(x, "step_missing", "x 만 답했다."), W(known, "step_missing", "아는 직각변만 답했다."), W(correct + 1, "other", "계산 중 어긋났다.")]).filter((w) => w.v !== correct), verificationJs: figJs({}, t.fig, `${RT_JS}return B+H;`), trace: [rtRead(t), [`x = √(${t.hyp}² - ${known}²) = ${x} 이다.`, "The unknown leg."], [`합 = ${x} + ${known} = ${correct} 이다.`, "Add the legs."]], variant: "legs_sum_after_leg",
        }, t.fig);
      },
    },
  ],
});
