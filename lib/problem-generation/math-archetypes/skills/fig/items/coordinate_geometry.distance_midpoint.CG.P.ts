// coordinate_geometry.distance_midpoint.CG.P — 좌표평면에 찍힌 두 점으로 거리·중점·반지름·끝점을 구한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { retry } from "../ext-kit";
import { CG_JS, SMALL_TRIPLES, TRIPLES, cgIntro, names, planeFig, ptO, segO, type P2 } from "../cg-kit";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isFinite(w.v) && w.v > 0 && Number.isInteger(w.v));
const scenes2 = (a: string, b: string) => [`The figure shows points ${a} and ${b} plotted on a coordinate grid, with segment ${a}${b} drawn.`, `Points ${a} and ${b} are plotted in the figure, and the segment between them is shown.`, `In the figure shown, ${a} and ${b} are the endpoints of a drawn segment on the grid.`, `A segment with endpoints ${a} and ${b} is graphed in the coordinate plane shown.`, `The coordinate grid shown contains points ${a} and ${b} joined by a segment.`];
const Q_DIST = (rng: Rng, a: string, b: string) => rng.pick([`What is the distance between points ${a} and ${b}?`, `Find the length of segment ${a}${b}.`, `How long is segment ${a}${b}?`, `What is the length of ${a}${b}?`, `Determine the distance from ${a} to ${b}.`]);
/** 삼조(dx,dy 순서·부호 무작위)로 A, B 를 1~16 안에 놓는다. */
function legPair(rng: Rng, tri: [number, number, number][]): { A: P2; B: P2; dx: number; dy: number; h: number } {
  const [p, q, h] = rng.pick(tri); const sw = rng.pick([true, false]); const dx = sw ? p : q, dy = sw ? q : p; const sx = rng.pick([1, -1]), sy = rng.pick([1, -1]);
  for (let i = 0; i < 40; i++) { const x = rng.int(1, 16), y = rng.int(1, 16); const x2 = x + sx * dx, y2 = y + sy * dy; if (x2 >= 1 && x2 <= 16 && y2 >= 1 && y2 <= 16) return { A: [x, y], B: [x2, y2], dx, dy, h }; }
  throw new GenFail("점 배치");
}
const figAB = (a: string, b: string, A: P2, B: P2) => planeFig([ptO(a, A), ptO(b, B), segO("s", a, b)], [A, B]);

export const ITEM = defineItem({
  prefix: "av", itemId: "coordinate_geometry.distance_midpoint.CG.P",
  hard: [
    {
      op: "compose_kind", structure: "좌표평면의 두 점 A, B 를 읽어 가로·세로 차를 구하고 거리 공식으로 선분의 길이를 구함", extra: "두 좌표의 차를 각각 제곱해 더한 뒤 제곱근을 취해야 함(차를 더하거나 제곱근을 빠뜨리면 오답) — medium 은 거리 공식 적용",
      concepts: ["두 점 사이의 거리", "피타고라스 정리", "좌표 읽기"],
      gen(rng) { return retry(rng, () => {
        const [a, b] = names(rng, 2); const { A, B, dx, dy, h } = legPair(rng, TRIPLES); const f = figAB(a, b, A, B);
        return geoInst(rng, {
          stimulus: cgIntro(rng, scenes2(a, b)), question: Q_DIST(rng, a, b), correct: h,
          wrongs: pos([W(dx + dy, "formula_misuse", "가로·세로 차를 더했다."), W(h * h, "step_missing", "제곱근을 취하지 않았다."), W(Math.abs(dx - dy), "formula_misuse", "차의 차를 구했다."), W(h + 1, "other", "계산 중 어긋났다."), W(Math.max(dx, dy), "step_missing", "한 방향의 차만 답했다.")]).filter((x) => x.v !== h),
          verificationJs: figJs({ a, b }, f, `${CG_JS}const A=PA(P.a), B=PA(P.b); return ip(dist(A,B));`),
          trace: [[`그림에서 ${a}, ${b} 의 좌표를 읽는다: (${A[0]}, ${A[1]}), (${B[0]}, ${B[1]}).`, "Read the coordinates."], [`가로 차 = |${B[0]} − ${A[0]}| = ${dx} 이다.`, "Horizontal difference."], [`세로 차 = |${B[1]} − ${A[1]}| = ${dy} 이다.`, "Vertical difference."], [`거리² = ${dx}² + ${dy}² = ${h * h} 이다.`, "Distance formula."], [`따라서 거리 = ${h} 이다.`, "Take the square root."]], variant: "segment_length",
        }, f);
      }); },
    },
    {
      op: "chain2", structure: "두 점 A, B 의 중점의 좌표를 구한 뒤 그 x 좌표와 y 좌표의 합을 구함", extra: "각 좌표의 평균을 구한 뒤 더해야 함(네 좌표를 모두 더하고 2 로 나누지 않거나 한 점의 좌표만 쓰면 오답) — medium 은 중점의 한 좌표",
      concepts: ["중점", "좌표 읽기"],
      gen(rng) { return retry(rng, () => {
        const [a, b] = names(rng, 2); const x1 = rng.int(1, 8), y1 = rng.int(1, 8); const x2 = x1 + 2 * rng.int(1, 4) * rng.pick([1, 1, -1]), y2 = y1 + 2 * rng.int(1, 4) * rng.pick([1, -1]); if (x2 < 1 || y2 < 1 || x2 > 16 || y2 > 16 || (x2 === x1 && y2 === y1)) throw new GenFail("범위");
        const A: P2 = [x1, y1], B: P2 = [x2, y2]; const mx = (x1 + x2) / 2, my = (y1 + y2) / 2; const c = mx + my; const f = figAB(a, b, A, B);
        return geoInst(rng, {
          stimulus: cgIntro(rng, scenes2(a, b)), question: rng.pick([`What is the sum of the $x$- and $y$-coordinates of the midpoint of segment ${a}${b}?`, `The midpoint of ${a}${b} has coordinates that add up to what value?`, `Find the sum of the coordinates of the midpoint of segment ${a}${b}.`, `If $M$ is the midpoint of ${a}${b}, what is the sum of the coordinates of $M$?`]), correct: c,
          wrongs: pos([W(x1 + x2 + y1 + y2, "step_missing", "중점이 아니라 네 좌표의 합을 답했다."), W(mx * my, "formula_misuse", "좌표를 곱했다."), W(Math.abs(mx - my) + 1, "other", "계산 중 어긋났다."), W(x1 + y1, "step_missing", "한 점의 좌표를 썼다."), W(c + 1, "other", "계산 중 어긋났다."), W((x2 - x1) / 2 + (y2 - y1) / 2, "formula_misuse", "차의 절반을 더했다.")]).filter((x) => x.v !== c),
          verificationJs: figJs({ a, b }, f, `${CG_JS}const A=PA(P.a), B=PA(P.b); return ip((A[0]+B[0])/2+(A[1]+B[1])/2);`),
          trace: [[`그림에서 ${a}, ${b} 의 좌표를 읽는다: (${x1}, ${y1}), (${x2}, ${y2}).`, "Read the coordinates."], [`중점의 x 좌표 = (${x1} + ${x2}) ÷ 2 = ${mx} 이다.`, "Average the x-coordinates."], [`중점의 y 좌표 = (${y1} + ${y2}) ÷ 2 = ${my} 이다.`, "Average the y-coordinates."], [`중점은 (${mx}, ${my}) 이다.`, "The midpoint."], [`따라서 ${mx} + ${my} = ${c} 이다.`, "Add the coordinates."]], variant: "midpoint_coordinate_sum",
        }, f);
      }); },
    },
    {
      op: "repr_shift", structure: "선분 AB 가 원의 지름이라고 지문이 말할 때 두 점 사이의 거리를 지름으로 옮겨 반지름을 구함", extra: "거리를 구한 뒤 지름의 절반을 취해야 함(거리를 그대로 반지름으로 답하거나 두 배 하면 오답) — medium 은 거리",
      concepts: ["두 점 사이의 거리", "원의 지름과 반지름", "표현 바꾸기"],
      gen(rng) { return retry(rng, () => {
        const [a, b] = names(rng, 2); const { A, B, dx, dy, h } = legPair(rng, [[6, 8, 10], [8, 6, 10], [12, 16, 20], [10, 24, 26]].filter((t) => t[2] % 2 === 0 && t[1] <= 16) as [number, number, number][]); const r = h / 2; const f = figAB(a, b, A, B);
        return geoInst(rng, {
          stimulus: cgIntro(rng, scenes2(a, b), ` Segment ${a}${b} is a diameter of a circle.`), question: rng.pick(["What is the radius of the circle?", "Find the radius of the circle.", "How long is a radius of the circle?", "The circle has what radius?"]), correct: r,
          wrongs: pos([W(h, "formula_misuse", "지름을 반지름으로 답했다."), W(2 * h, "formula_misuse", "지름의 두 배를 답했다."), W((dx + dy) / 2, "formula_misuse", "가로·세로 차의 합의 절반을 답했다."), W(h * h / 2, "step_missing", "제곱근을 취하지 않았다."), W(r + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== r),
          verificationJs: figJs({ a, b }, f, `${CG_JS}const A=PA(P.a), B=PA(P.b); return ip(dist(A,B)/2);`),
          trace: [[`그림에서 ${a}, ${b} 의 좌표를 읽는다: (${A[0]}, ${A[1]}), (${B[0]}, ${B[1]}).`, "Read the coordinates."], [`가로 차 = ${dx}, 세로 차 = ${dy} 이다.`, "Differences."], [`지름 ${a}${b} = √(${dx}² + ${dy}²) = ${h} 이다.`, "The diameter by the distance formula."], [`반지름은 지름의 절반이다.`, "Radius is half the diameter."], [`따라서 ${h} ÷ 2 = ${r} 이다.`, "State the radius."]], variant: "diameter_to_radius",
        }, f);
      }); },
    },
    {
      op: "inverse", structure: "한 끝점 A 와 선분 AB 의 중점 M 이 그림에 있을 때 다른 끝점 B 의 x 좌표 2·x_M − x_A 를 거꾸로 구함", extra: "중점 좌표에서 거꾸로 끝점을 구해야 함(중점의 좌표를 그대로 쓰거나 평균 공식을 거꾸로 쓰지 않으면 오답) — medium 은 중점",
      concepts: ["중점", "역산", "좌표 읽기"],
      gen(rng) { return retry(rng, () => {
        const [a, m, b] = names(rng, 3); const xa = rng.int(1, 12), ya = rng.int(1, 12); const bx = rng.int(1, 16), by = rng.int(1, 16); if ((xa + bx) % 2 || (ya + by) % 2 || (bx === xa && by === ya)) throw new GenFail("정수 중점"); const M: P2 = [(xa + bx) / 2, (ya + by) / 2]; const A: P2 = [xa, ya];
        const f = planeFig([ptO(a, A), ptO(m, M)], [A, M, [bx, by]]); const askX = rng.pick([true, false]); const c = askX ? bx : by;
        return geoInst(rng, {
          stimulus: cgIntro(rng, [`In the figure shown, point ${m} is the midpoint of segment ${a}${b}, and point ${a} is plotted on the grid.`, `The figure shows endpoint ${a} and the midpoint ${m} of segment ${a}${b}; endpoint ${b} is not drawn.`, `Segment ${a}${b} has midpoint ${m}. Points ${a} and ${m} are plotted in the figure shown.`, `A segment ${a}${b} is described by its endpoint ${a} and its midpoint ${m}, both plotted in the figure.`]), question: askX ? rng.pick([`What is the $x$-coordinate of endpoint ${b}?`, `Find the $x$-coordinate of ${b}.`, `What is the value of the $x$-coordinate of the other endpoint, ${b}?`]) : rng.pick([`What is the $y$-coordinate of endpoint ${b}?`, `Find the $y$-coordinate of ${b}.`, `What is the value of the $y$-coordinate of the other endpoint, ${b}?`]), correct: c,
          wrongs: pos(askX ? [W(M[0], "formula_misuse", "중점의 좌표를 답했다."), W(xa, "step_missing", "주어진 끝점의 좌표를 답했다."), W(M[0] + xa, "formula_misuse", "좌표를 더했다."), W(M[0] - xa, "formula_misuse", "차를 한 번만 더했다."), W(c + 1, "other", "계산 중 어긋났다.")] : [W(M[1], "formula_misuse", "중점의 좌표를 답했다."), W(ya, "step_missing", "주어진 끝점의 좌표를 답했다."), W(M[1] + ya, "formula_misuse", "좌표를 더했다."), W(M[1] - ya, "formula_misuse", "차를 한 번만 더했다."), W(c + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== c),
          verificationJs: figJs({ a, m, axis: askX ? 0 : 1 }, f, `${CG_JS}const A=PA(P.a), M=PA(P.m); return ip(2*M[P.axis]-A[P.axis]);`),
          trace: [[`그림에서 ${a} = (${xa}, ${ya}), ${m} = (${M[0]}, ${M[1]}) 를 읽는다.`, "Read the coordinates."], [`중점 = 두 끝점의 평균이다.`, "The midpoint is the average of the endpoints."], [`${askX ? "x" : "y"} 좌표: (${askX ? xa : ya} + ${b}의 좌표) ÷ 2 = ${askX ? M[0] : M[1]} 이다.`, "Set up the average."], [`${b}의 좌표 = 2 × ${askX ? M[0] : M[1]} − ${askX ? xa : ya} 이다.`, "Solve for the missing coordinate."], [`따라서 ${c} 이다.`, "State the coordinate."]], variant: "endpoint_from_midpoint",
        }, f);
      }); },
    },
  ],
  em: [
    {
      lv: "easy", name: "horizontal_distance", structure: "같은 높이의 두 점 사이의 거리를 좌표 차로 구함", extra: "easy: |x 좌표의 차|", concepts: ["두 점 사이의 거리", "문제 조건 해석"],
      gen(rng) { return retry(rng, () => {
        const [a, b] = names(rng, 2); const y = rng.int(1, 12), x1 = rng.int(1, 8), d = rng.int(2, 8); const A: P2 = [x1, y], B: P2 = [x1 + d, y]; const f = figAB(a, b, A, B);
        return geoInst(rng, { stimulus: cgIntro(rng, scenes2(a, b)), question: Q_DIST(rng, a, b), correct: d, wrongs: pos([W(d + 1, "other", "계산 중 어긋났다."), W(x1 + d, "step_missing", "끝점의 좌표를 답했다."), W(d * 2, "formula_misuse", "두 배로 계산했다."), W(Math.max(1, d - 1), "other", "눈금을 잘못 셌다.")]).filter((x) => x.v !== d), verificationJs: figJs({ a, b }, f, `${CG_JS}const A=PA(P.a), B=PA(P.b); if (A[1]!==B[1]) throw new Error('같은 높이 아님'); return ip(Math.abs(B[0]-A[0]));`), trace: [[`그림에서 ${a}, ${b} 의 좌표를 읽는다.`, "Read the coordinates."], [`두 점의 y 좌표가 같다.`, "Same height."], [`거리 = |${x1 + d} − ${x1}| = ${d} 이다.`, "Difference of the x-coordinates."]], variant: "horizontal_distance_easy" }, f);
      }); },
    },
    {
      lv: "medium", name: "distance", structure: "좌표평면의 두 점 A, B 사이의 거리를 구함", extra: "medium: 거리 공식", concepts: ["두 점 사이의 거리", "문제 조건 해석"],
      gen(rng) { return retry(rng, () => {
        const [a, b] = names(rng, 2); const { A, B, dx, dy, h } = legPair(rng, SMALL_TRIPLES); const f = figAB(a, b, A, B);
        return geoInst(rng, { stimulus: cgIntro(rng, scenes2(a, b)), question: Q_DIST(rng, a, b), correct: h, wrongs: pos([W(dx + dy, "formula_misuse", "가로·세로 차를 더했다."), W(h * h, "step_missing", "제곱근을 취하지 않았다."), W(Math.abs(dx - dy), "formula_misuse", "차의 차를 구했다."), W(h + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== h), verificationJs: figJs({ a, b }, f, `${CG_JS}const A=PA(P.a), B=PA(P.b); return ip(dist(A,B));`), trace: [[`그림에서 ${a}, ${b} 의 좌표를 읽는다: (${A[0]}, ${A[1]}), (${B[0]}, ${B[1]}).`, "Read the coordinates."], [`거리² = ${dx}² + ${dy}² = ${h * h} 이다.`, "Distance formula."], [`따라서 ${h} 이다.`, "Take the square root."]], variant: "segment_length_medium" }, f);
      }); },
    },
  ],
});
