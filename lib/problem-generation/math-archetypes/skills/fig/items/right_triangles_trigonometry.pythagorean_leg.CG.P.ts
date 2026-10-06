// right_triangles_trigonometry.pythagorean_leg.CG.P — 좌표평면에 한 직각변이 그려지고 빗변·넓이·둘레가 지문에 주어질 때 다른 직각변을 구한다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { retry } from "../ext-kit";
import { CG_JS, TRIPLES, cgIntro, names, planeFig, ptO, segO, type P2 } from "../cg-kit";
import type { Rng } from "../../../rng";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isFinite(w.v) && w.v > 0 && Number.isInteger(w.v));
const sc = (a: string, b: string) => [`The figure shows segment ${a}${b} on a coordinate grid; it is one leg of a right triangle, with the right angle at ${b}.`, `Points ${a} and ${b} are plotted in the figure shown, and ${a}${b} is a leg of a right triangle whose right angle is at ${b}.`, `In the figure shown, ${a}${b} is a horizontal leg of a right triangle, and the right angle is at ${b}.`, `A right triangle has leg ${a}${b} drawn on the coordinate grid shown; the other leg runs straight up or down from ${b}.`, `The coordinate grid shown has segment ${a}${b} as a leg of a right triangle, with a right angle at ${b}.`];
const QB = (rng: Rng) => rng.pick(["What is the length of the other leg?", "Find the length of the other leg of the triangle.", "How long is the other leg?", "The other leg has what length?"]);
function mk(rng: Rng) {
  const [p, q, c] = rng.pick(TRIPLES.filter((t) => t[2] <= 17)); const sw = rng.pick([true, false]); const a = sw ? p : q, b = sw ? q : p; const sa = rng.pick([1, -1]);
  for (let i = 0; i < 60; i++) { const x = rng.int(1, 14), y = rng.int(1, 14); const ax = x + sa * a; if (ax >= 1 && ax <= 16) { const A: P2 = [ax, y], B: P2 = [x, y]; return { A, B, a, b, c }; } }
  throw new GenFail("배치");
}
const FJ = `${CG_JS}const A=PA(P.a), B=PA(P.b); const L=dist(A,B); if (A[1]!==B[1]) throw new Error('가로 변 아님');`;

export const ITEM = defineItem({
  prefix: "av", itemId: "right_triangles_trigonometry.pythagorean_leg.CG.P",
  hard: [
    {
      op: "compose_kind", structure: "그림에서 한 직각변의 길이를 읽고 지문의 빗변 길이로 다른 직각변을 피타고라스 정리로 구함", extra: "빗변의 제곱에서 읽은 직각변의 제곱을 빼고 제곱근을 취해야 함(합이나 차로 계산하면 오답) — medium 은 빗변이 제곱 수로 주어짐",
      concepts: ["피타고라스 정리", "좌표 읽기", "직각삼각형"],
      gen(rng) { return retry(rng, () => {
        const [a, b] = names(rng, 2); const t = mk(rng); const f = planeFig([ptO(a, t.A), ptO(b, t.B), segO("s", a, b)], [t.A, t.B, [t.B[0], t.B[1] + t.b]]);
        return geoInst(rng, {
          stimulus: cgIntro(rng, sc(a, b), ` The hypotenuse of the triangle is ${t.c} units long.`), question: QB(rng), correct: t.b,
          wrongs: pos([W(t.c - t.a, "formula_misuse", "빗변에서 직각변을 뺐다."), W(t.c + t.a, "formula_misuse", "빗변에 직각변을 더했다."), W(t.c * t.c - t.a * t.a, "step_missing", "제곱근을 취하지 않았다."), W(t.b + 1, "other", "계산 중 어긋났다."), W(t.c, "step_missing", "빗변을 답했다.")]).filter((x) => x.v !== t.b),
          verificationJs: figJs({ a, b, c: t.c }, f, `${FJ} return ip(Math.sqrt(P.c*P.c-L*L));`),
          trace: [[`그림에서 ${a}, ${b} 의 좌표를 읽는다.`, "Read the coordinates."], [`읽은 직각변 ${a}${b} = ${t.a} 이다.`, "The leg shown."], [`빗변² = ${t.c}² = ${t.c * t.c} 이다.`, "Square the hypotenuse."], [`다른 직각변² = ${t.c * t.c} − ${t.a}² = ${t.b * t.b} 이다.`, "Pythagorean theorem."], [`따라서 ${t.b} 이다.`, "Take the square root."]], variant: "other_leg",
        }, f);
      }); },
    },
    {
      op: "chain2", structure: "빗변이 지문에 주어지고 한 직각변이 그림에 있을 때 다른 직각변을 구한 뒤 삼각형의 넓이를 구함", extra: "다른 직각변을 구한 뒤 두 직각변의 곱의 절반을 취해야 함(직각변의 곱을 그대로 답하거나 빗변을 쓰면 오답) — medium 은 다른 직각변",
      concepts: ["피타고라스 정리", "삼각형의 넓이", "좌표 읽기"],
      gen(rng) { return retry(rng, () => {
        const [a, b] = names(rng, 2); const t = mk(rng); const f = planeFig([ptO(a, t.A), ptO(b, t.B), segO("s", a, b)], [t.A, t.B, [t.B[0], t.B[1] + t.b]]); const ar = (t.a * t.b) / 2;
        return geoInst(rng, {
          stimulus: cgIntro(rng, sc(a, b), ` The hypotenuse of the triangle is ${t.c} units long.`), question: rng.pick(["What is the area of the triangle?", "Find the area of the right triangle.", "How many square units does the triangle cover?", "What is the area of the triangle, in square units?"]), correct: ar,
          wrongs: pos([W(t.a * t.b, "formula_misuse", "2 로 나누지 않았다."), W((t.a * t.c) / 2, "formula_misuse", "빗변을 밑변으로 썼다."), W(t.b, "step_missing", "다른 직각변만 답했다."), W(ar + 3, "other", "계산 중 어긋났다."), W(t.a + t.b, "formula_misuse", "직각변을 더했다.")]).filter((x) => x.v !== ar),
          verificationJs: figJs({ a, b, c: t.c }, f, `${FJ} const o=Math.sqrt(P.c*P.c-L*L); return ip(L*o/2);`),
          trace: [[`그림에서 ${a}, ${b} 의 좌표를 읽는다.`, "Read the coordinates."], [`읽은 직각변 ${a}${b} = ${t.a} 이다.`, "The leg shown."], [`다른 직각변² = ${t.c}² − ${t.a}² = ${t.b * t.b} 이므로 ${t.b} 이다.`, "The other leg."], [`넓이 = ${t.a} × ${t.b} ÷ 2 이다.`, "Area formula."], [`따라서 ${ar} 이다.`, "State the area."]], variant: "leg_to_area",
        }, f);
      }); },
    },
    {
      op: "repr_shift", structure: "빗변의 제곱이 지문에 주어지고 한 직각변이 그림에 있을 때 제곱 관계로 다른 직각변을 구함", extra: "제곱 값에서 직각변의 제곱을 빼고 제곱근을 취해야 함(제곱근을 빠뜨리거나 제곱 값을 직각변과 비교하면 오답) — medium 은 빗변",
      concepts: ["피타고라스 정리", "제곱의 해석", "표현 바꾸기"],
      gen(rng) { return retry(rng, () => {
        const [a, b] = names(rng, 2); const t = mk(rng); const f = planeFig([ptO(a, t.A), ptO(b, t.B), segO("s", a, b)], [t.A, t.B, [t.B[0], t.B[1] + t.b]]);
        return geoInst(rng, {
          stimulus: cgIntro(rng, sc(a, b), ` The square of the length of the hypotenuse is ${t.c * t.c}.`), question: QB(rng), correct: t.b,
          wrongs: pos([W(t.c * t.c - t.a * t.a, "step_missing", "제곱근을 취하지 않았다."), W(t.c * t.c - t.a, "formula_misuse", "직각변을 제곱하지 않고 뺐다."), W(t.c - t.a, "formula_misuse", "빗변에서 직각변을 뺐다."), W(t.b + 1, "other", "계산 중 어긋났다."), W(t.c, "step_missing", "빗변을 답했다.")]).filter((x) => x.v !== t.b),
          verificationJs: figJs({ a, b, c2: t.c * t.c }, f, `${FJ} return ip(Math.sqrt(P.c2-L*L));`),
          trace: [[`그림에서 ${a}, ${b} 의 좌표를 읽는다.`, "Read the coordinates."], [`읽은 직각변 ${a}${b} = ${t.a} 이다.`, "The leg shown."], [`빗변² = ${t.c * t.c} 이다.`, "The squared hypotenuse."], [`다른 직각변² = ${t.c * t.c} − ${t.a * t.a} = ${t.b * t.b} 이다.`, "Subtract the squared leg."], [`따라서 ${t.b} 이다.`, "Take the square root."]], variant: "leg_from_squared_hypotenuse",
        }, f);
      }); },
    },
    {
      op: "inverse", structure: "삼각형의 둘레가 지문에 주어지고 한 직각변이 그림에 있을 때 다른 직각변을 거꾸로 구함", extra: "둘레와 직각변으로 빗변을 소거해 다른 직각변을 구해야 함(둘레에서 직각변만 빼면 오답) — medium 은 빗변이 주어짐",
      concepts: ["피타고라스 정리", "둘레", "역산"],
      gen(rng) { return retry(rng, () => {
        const [a, b] = names(rng, 2); const t = mk(rng); const per = t.a + t.b + t.c; const f = planeFig([ptO(a, t.A), ptO(b, t.B), segO("s", a, b)], [t.A, t.B, [t.B[0], t.B[1] + t.b]]);
        return geoInst(rng, {
          stimulus: cgIntro(rng, sc(a, b), ` The perimeter of the triangle is ${per} units.`), question: QB(rng), correct: t.b,
          wrongs: pos([W(per - t.a, "step_missing", "둘레에서 직각변만 뺐다."), W(per - 2 * t.a, "formula_misuse", "직각변을 두 번 뺐다."), W(t.c, "other", "빗변을 답했다."), W(Math.round((per - t.a) / 2), "formula_misuse", "남은 둘레를 반으로 나누었다."), W(t.b + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== t.b),
          verificationJs: figJs({ a, b, per }, f, `${FJ} const x=(P.per*P.per-2*P.per*L)/(2*(P.per-L)); return ip(x);`),
          trace: [[`그림에서 ${a}, ${b} 의 좌표를 읽는다.`, "Read the coordinates."], [`읽은 직각변 ${a}${b} = ${t.a} 이고 둘레는 ${per} 이다.`, "The leg and the perimeter."], [`다른 직각변을 x, 빗변을 ${per - t.a} − x 라 둔다.`, "Let the other leg be x."], [`${t.a}² + x² = (${per - t.a} − x)² 이다.`, "Pythagorean theorem."], [`전개해 풀면 x = ${t.b} 이다.`, "Solve for x."]], variant: "leg_from_perimeter",
        }, f);
      }); },
    },
  ],
  em: [
    {
      lv: "easy", name: "hypotenuse_from_legs", structure: "한 직각변이 그림에 있고 다른 직각변이 지문에 있을 때 빗변을 구함", extra: "easy: 두 직각변의 제곱의 합의 제곱근", concepts: ["피타고라스 정리", "문제 조건 해석"],
      gen(rng) { return retry(rng, () => {
        const [a, b] = names(rng, 2); const t = mk(rng); const f = planeFig([ptO(a, t.A), ptO(b, t.B), segO("s", a, b)], [t.A, t.B, [t.B[0], t.B[1] + t.b]]);
        return geoInst(rng, { stimulus: cgIntro(rng, sc(a, b), ` The other leg is ${t.b} units long.`), question: rng.pick(["What is the length of the hypotenuse?", "Find the hypotenuse of the triangle.", "How long is the hypotenuse?"]), correct: t.c, wrongs: pos([W(t.a + t.b, "formula_misuse", "직각변을 더했다."), W(t.c * t.c, "step_missing", "제곱근을 취하지 않았다."), W(t.c + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== t.c), verificationJs: figJs({ a, b, o: t.b }, f, `${FJ} return ip(Math.sqrt(L*L+P.o*P.o));`), trace: [[`그림에서 ${a}${b} = ${t.a} 를 읽는다.`, "Read the leg."], [`빗변² = ${t.a}² + ${t.b}² = ${t.c * t.c} 이다.`, "Pythagorean theorem."], [`따라서 ${t.c} 이다.`, "Take the square root."]], variant: "hypotenuse_from_legs_easy" }, f);
      }); },
    },
    {
      lv: "medium", name: "other_leg", structure: "한 직각변이 그림에 있고 빗변이 지문에 있을 때 다른 직각변을 구함", extra: "medium: 빗변² − 직각변²", concepts: ["피타고라스 정리", "문제 조건 해석"],
      gen(rng) { return retry(rng, () => {
        const [a, b] = names(rng, 2); const t = mk(rng); const f = planeFig([ptO(a, t.A), ptO(b, t.B), segO("s", a, b)], [t.A, t.B, [t.B[0], t.B[1] + t.b]]);
        return geoInst(rng, { stimulus: cgIntro(rng, sc(a, b), ` The hypotenuse is ${t.c} units long.`), question: QB(rng), correct: t.b, wrongs: pos([W(t.c - t.a, "formula_misuse", "빗변에서 직각변을 뺐다."), W(t.c * t.c - t.a * t.a, "step_missing", "제곱근을 취하지 않았다."), W(t.b + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== t.b), verificationJs: figJs({ a, b, c: t.c }, f, `${FJ} return ip(Math.sqrt(P.c*P.c-L*L));`), trace: [[`그림에서 ${a}${b} = ${t.a} 를 읽는다.`, "Read the leg."], [`다른 직각변² = ${t.c}² − ${t.a}² = ${t.b * t.b} 이다.`, "Pythagorean theorem."], [`따라서 ${t.b} 이다.`, "Take the square root."]], variant: "other_leg_medium" }, f);
      }); },
    },
  ],
});
