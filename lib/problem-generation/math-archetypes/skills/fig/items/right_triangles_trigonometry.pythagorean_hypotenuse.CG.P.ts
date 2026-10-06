// right_triangles_trigonometry.pythagorean_hypotenuse.CG.P — 좌표평면의 직각삼각형에서 빗변의 길이·둘레·축척 환산을 구한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { retry } from "../ext-kit";
import { CG_JS, SMALL_TRIPLES, TRIPLES, cgIntro, names, planeFig, rightTri, triObjs } from "../cg-kit";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isFinite(w.v) && w.v > 0 && Number.isInteger(w.v));
const sc3 = (a: string, b: string, c: string) => [`The figure shows triangle ${a}${b}${c} on a coordinate grid; the right angle is at ${b}.`, `Triangle ${a}${b}${c} is drawn in the coordinate plane shown, with a right angle at vertex ${b}.`, `In the figure shown, points ${a}, ${b}, and ${c} form a right triangle whose right angle is at ${b}.`, `A right triangle ${a}${b}${c}, with its right angle at ${b}, is plotted on the grid shown.`, `The coordinate grid shown contains right triangle ${a}${b}${c}; its sides ${a}${b} and ${b}${c} follow grid lines.`];
const fig = (n: [string, string, string], t: ReturnType<typeof rightTri>) => planeFig(triObjs(n, t), [t.A, t.B, t.C]);
const HJS = `${CG_JS}const A=PA(P.a), B=PA(P.b), C=PA(P.c);`;

export const ITEM = defineItem({
  prefix: "av", itemId: "right_triangles_trigonometry.pythagorean_hypotenuse.CG.P",
  hard: [
    {
      op: "compose_kind", structure: "좌표평면의 직각삼각형에서 두 직각변의 길이를 격자로 읽어 피타고라스 정리로 빗변의 길이를 구함", extra: "두 직각변의 제곱을 더해 제곱근을 취해야 함(직각변의 합이나 제곱의 합 그대로 답하면 오답) — medium 은 두 직각변이 이미 읽힌 경우",
      concepts: ["피타고라스 정리", "좌표 읽기", "직각삼각형"],
      gen(rng) { return retry(rng, () => {
        const n = names(rng, 3) as [string, string, string]; const t = rightTri(rng, TRIPLES); const f = fig(n, t);
        return geoInst(rng, {
          stimulus: cgIntro(rng, sc3(...n)), question: rng.pick([`What is the length of ${n[0]}${n[2]}?`, `Find the length of the hypotenuse of triangle ${n.join("")}.`, `How long is side ${n[0]}${n[2]}?`, `What is the length of the hypotenuse?`]), correct: t.c,
          wrongs: pos([W(t.a + t.b, "formula_misuse", "직각변을 더했다."), W(t.c * t.c, "step_missing", "제곱근을 취하지 않았다."), W(Math.abs(t.a - t.b), "formula_misuse", "직각변의 차를 구했다."), W(t.c + 1, "other", "계산 중 어긋났다."), W(Math.max(t.a, t.b), "step_missing", "긴 직각변을 답했다.")]).filter((x) => x.v !== t.c),
          verificationJs: figJs({ a: n[0], b: n[1], c: n[2] }, f, `${HJS} return ip(dist(A,C));`),
          trace: [[`그림에서 ${n[0]}, ${n[1]}, ${n[2]} 의 좌표를 읽는다.`, "Read the coordinates."], [`직각변 ${n[0]}${n[1]} = ${t.a} 이다.`, "One leg."], [`직각변 ${n[1]}${n[2]} = ${t.b} 이다.`, "The other leg."], [`빗변² = ${t.a}² + ${t.b}² = ${t.c * t.c} 이다.`, "Pythagorean theorem."], [`따라서 ${n[0]}${n[2]} = ${t.c} 이다.`, "Take the square root."]], variant: "hypotenuse_length",
        }, f);
      }); },
    },
    {
      op: "chain2", structure: "직각삼각형의 직각변을 읽어 빗변의 길이를 구한 뒤 세 변의 길이의 합(둘레)을 구함", extra: "빗변을 구한 뒤 세 변을 모두 더해야 함(빗변을 빠뜨리거나 직각변만 더하면 오답) — medium 은 빗변",
      concepts: ["피타고라스 정리", "둘레", "좌표 읽기"],
      gen(rng) { return retry(rng, () => {
        const n = names(rng, 3) as [string, string, string]; const t = rightTri(rng, TRIPLES); const f = fig(n, t); const per = t.a + t.b + t.c;
        return geoInst(rng, {
          stimulus: cgIntro(rng, sc3(...n)), question: rng.pick([`What is the perimeter of triangle ${n.join("")}?`, `Find the total length of the three sides of triangle ${n.join("")}.`, `A fence is built along all three sides of triangle ${n.join("")}. How long is it?`, `What is the sum of the side lengths of the triangle?`]), correct: per,
          wrongs: pos([W(t.a + t.b, "step_missing", "빗변을 빠뜨렸다."), W(t.c, "step_missing", "빗변만 답했다."), W(2 * t.c + t.a, "formula_misuse", "변을 잘못 더했다."), W(per + 2, "other", "계산 중 어긋났다."), W(t.a * t.b / 2, "formula_misuse", "넓이를 답했다.")]).filter((x) => x.v !== per),
          verificationJs: figJs({ a: n[0], b: n[1], c: n[2] }, f, `${HJS} return ip(dist(A,B)+dist(B,C)+dist(A,C));`),
          trace: [[`그림에서 ${n[0]}, ${n[1]}, ${n[2]} 의 좌표를 읽는다.`, "Read the coordinates."], [`직각변은 ${t.a} 와 ${t.b} 이다.`, "The legs."], [`빗변 = √(${t.a}² + ${t.b}²) = ${t.c} 이다.`, "The hypotenuse."], [`둘레 = ${t.a} + ${t.b} + ${t.c} 이다.`, "Add the three sides."], [`따라서 ${per} 이다.`, "State the perimeter."]], variant: "triangle_perimeter",
        }, f);
      }); },
    },
    {
      op: "repr_shift", structure: "격자 한 칸이 k 미터라고 지문이 말할 때 격자 단위의 빗변 길이를 실제 길이(미터)로 환산함", extra: "격자 단위의 빗변을 구한 뒤 칸의 크기를 곱해야 함(칸 수를 그대로 답하거나 제곱을 곱하면 오답) — medium 은 격자 단위 빗변",
      concepts: ["피타고라스 정리", "축척과 단위 환산", "표현 바꾸기"],
      gen(rng) { return retry(rng, () => {
        const n = names(rng, 3) as [string, string, string]; const t = rightTri(rng, SMALL_TRIPLES); const f = fig(n, t); const k = rng.pick([2, 3, 4, 5]); const L = t.c * k;
        return geoInst(rng, {
          stimulus: cgIntro(rng, sc3(...n), ` Each side of a grid square represents ${k} meters.`), question: rng.pick([`How many meters long is ${n[0]}${n[2]}?`, `What is the real length of side ${n[0]}${n[2]}, in meters?`, `Find the length of the hypotenuse in meters.`, `The hypotenuse represents a path of how many meters?`]), correct: L,
          wrongs: pos([W(t.c, "unit_error", "칸 수를 그대로 답했다."), W(t.c * k * k, "unit_error", "칸의 크기를 제곱해 곱했다."), W((t.a + t.b) * k, "formula_misuse", "직각변의 합을 환산했다."), W(L + k, "other", "계산 중 어긋났다."), W(t.c + k, "unit_error", "칸의 크기를 더했다.")]).filter((x) => x.v !== L),
          verificationJs: figJs({ a: n[0], b: n[1], c: n[2], k }, f, `${HJS} return ip(dist(A,C)*P.k);`),
          trace: [[`그림에서 ${n[0]}, ${n[1]}, ${n[2]} 의 좌표를 읽는다.`, "Read the coordinates."], [`직각변은 ${t.a} 칸과 ${t.b} 칸이다.`, "The legs in grid units."], [`빗변 = √(${t.a}² + ${t.b}²) = ${t.c} 칸이다.`, "The hypotenuse in grid units."], [`한 칸은 ${k} m 이다.`, "One square is this many meters."], [`따라서 ${t.c} × ${k} = ${L} m 이다.`, "Convert to meters."]], variant: "hypotenuse_scaled",
        }, f);
      }); },
    },
    {
      op: "inverse", structure: "빗변의 실제 길이가 지문에 주어질 때 격자 단위의 빗변과 비교해 격자 한 칸의 실제 크기 k 를 거꾸로 구함", extra: "실제 길이를 격자 단위 빗변으로 나눠야 함(곱하거나 직각변으로 나누면 오답) — medium 은 칸의 크기가 주어짐",
      concepts: ["피타고라스 정리", "축척", "역산"],
      gen(rng) { return retry(rng, () => {
        const n = names(rng, 3) as [string, string, string]; const t = rightTri(rng, SMALL_TRIPLES); const f = fig(n, t); const k = rng.pick([2, 3, 4, 5, 6]); const L = t.c * k; if (L >= 100) throw new GenFail("큼");
        return geoInst(rng, {
          stimulus: cgIntro(rng, sc3(...n), ` Side ${n[0]}${n[2]} represents a real distance of ${L} meters, and every grid square has the same size.`), question: rng.pick(["How many meters does one side of a grid square represent?", "What real length does one grid unit stand for, in meters?", "Find the length in meters of one grid square's side.", "What is the real length of one unit on the grid, in meters?"]), correct: k,
          wrongs: pos([W(L, "step_missing", "실제 길이를 그대로 답했다."), W(t.c, "step_missing", "격자 단위의 빗변을 답했다."), W(Math.round(L / t.a), "formula_misuse", "한 직각변으로 나누었다."), W(L * t.c, "formula_misuse", "곱했다."), W(k + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== k && Number.isInteger(x.v)),
          verificationJs: figJs({ a: n[0], b: n[1], c: n[2], L }, f, `${HJS} return ip(P.L/dist(A,C));`),
          trace: [[`그림에서 ${n[0]}, ${n[1]}, ${n[2]} 의 좌표를 읽는다.`, "Read the coordinates."], [`직각변은 ${t.a} 칸과 ${t.b} 칸이다.`, "The legs in grid units."], [`빗변 = √(${t.a}² + ${t.b}²) = ${t.c} 칸이다.`, "The hypotenuse in grid units."], [`${t.c} 칸이 ${L} m 이다.`, "The real length of the hypotenuse."], [`따라서 한 칸 = ${L} ÷ ${t.c} = ${k} m 이다.`, "Divide."]], variant: "grid_scale_from_hypotenuse",
        }, f);
      }); },
    },
  ],
  em: [
    {
      lv: "easy", name: "leg_length", structure: "직각삼각형의 한 직각변의 길이를 좌표 차로 읽음", extra: "easy: 같은 높이의 두 점 사이 거리", concepts: ["좌표 읽기", "직각삼각형"],
      gen(rng) { return retry(rng, () => {
        const n = names(rng, 3) as [string, string, string]; const t = rightTri(rng, SMALL_TRIPLES); const f = fig(n, t);
        return geoInst(rng, { stimulus: cgIntro(rng, sc3(...n)), question: rng.pick([`What is the length of ${n[0]}${n[1]}?`, `How long is side ${n[0]}${n[1]}?`, `Find the length of ${n[0]}${n[1]}.`]), correct: t.a, wrongs: pos([W(t.a + 1, "other", "계산 중 어긋났다."), W(t.b, "other", "다른 직각변을 답했다."), W(t.c, "other", "빗변을 답했다."), W(Math.max(1, t.a - 1), "other", "눈금을 잘못 셌다.")]).filter((x) => x.v !== t.a), verificationJs: figJs({ a: n[0], b: n[1] }, f, `${CG_JS}const A=PA(P.a), B=PA(P.b); return ip(dist(A,B));`), trace: [[`그림에서 ${n[0]}, ${n[1]} 의 좌표를 읽는다.`, "Read the coordinates."], [`두 점의 y 좌표가 같다.`, "Same height."], [`길이 = ${t.a} 이다.`, "The difference of the x-coordinates."]], variant: "leg_length_easy" }, f);
      }); },
    },
    {
      lv: "medium", name: "hypotenuse", structure: "좌표평면의 직각삼각형에서 빗변의 길이를 구함", extra: "medium: 피타고라스 정리", concepts: ["피타고라스 정리"],
      gen(rng) { return retry(rng, () => {
        const n = names(rng, 3) as [string, string, string]; const t = rightTri(rng, SMALL_TRIPLES); const f = fig(n, t);
        return geoInst(rng, { stimulus: cgIntro(rng, sc3(...n)), question: rng.pick([`What is the length of ${n[0]}${n[2]}?`, `Find the length of the hypotenuse of triangle ${n.join("")}.`, `How long is side ${n[0]}${n[2]}?`]), correct: t.c, wrongs: pos([W(t.a + t.b, "formula_misuse", "직각변을 더했다."), W(t.c * t.c, "step_missing", "제곱근을 취하지 않았다."), W(Math.abs(t.a - t.b), "formula_misuse", "직각변의 차를 구했다."), W(t.c + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== t.c), verificationJs: figJs({ a: n[0], b: n[1], c: n[2] }, f, `${HJS} return ip(dist(A,C));`), trace: [[`그림에서 직각변 ${t.a} 와 ${t.b} 를 읽는다.`, "Read the legs."], [`빗변² = ${t.a}² + ${t.b}² = ${t.c * t.c} 이다.`, "Pythagorean theorem."], [`따라서 ${t.c} 이다.`, "Take the square root."]], variant: "hypotenuse_length_medium" }, f);
      }); },
    },
  ],
});
void (null as unknown as Rng);
