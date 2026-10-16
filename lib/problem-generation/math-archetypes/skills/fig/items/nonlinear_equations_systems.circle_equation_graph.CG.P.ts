// nonlinear_equations_systems.circle_equation_graph.CG.P — 좌표평면에 그려진 원의 중심·반지름을 읽어 표준형 (x − h)² + (y − k)² = r² 의 값을 구한다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { geoInst } from "../geo-kit";
import { retry } from "../ext-kit";
import { CG_JS, CIRC_JS, circFig, cgIntro, names, ptO, segO, type P2 } from "../cg-kit";

const pos = (ws: ReturnType<typeof W>[]) => ws.filter((w) => Number.isFinite(w.v) && w.v > 0 && Number.isInteger(w.v));
const CJ = `${CG_JS}${CIRC_JS}`;
const EQ = "$(x - h)^2 + (y - k)^2 = r^2$";
const sc = (c: string, p: string) => [`The figure shows a circle with center ${c} on a coordinate grid; point ${p} lies on the circle.`, `A circle is graphed in the coordinate plane shown. Its center is ${c}, and ${p} is a point on the circle.`, `In the figure shown, ${c} is the center of a circle and ${p} is a point on that circle.`, `The coordinate grid shown contains a circle with center ${c} that passes through ${p}.`];
const TRI: [number, number, number][] = [[3, 4, 5], [6, 8, 10]];
function circ(rng: Rng, tri = TRI) {
  const [a, b, r] = rng.pick(tri); const sw = rng.pick([true, false]); const dx = (sw ? a : b) * rng.pick([1, -1]), dy = (sw ? b : a) * rng.pick([1, -1]);
  const h = rng.int(-5, 5), k = rng.int(-5, 5); if (h === 0 && k === 0) throw new GenFail("원점"); if (h + dx === 0 && k + dy === 0) throw new GenFail("P 가 원점"); const C: P2 = [h, k], Pp: P2 = [h + dx, k + dy];
  return { C, P: Pp, h, k, r, dx: Math.abs(dx), dy: Math.abs(dy) };
}

export const ITEM = defineItem({
  prefix: "av", itemId: "nonlinear_equations_systems.circle_equation_graph.CG.P",
  hard: [
    {
      op: "compose_kind", structure: "원의 중심 C 와 원 위의 점 P 의 좌표를 읽어 반지름을 구한 뒤 표준형의 r² 을 구함", extra: "중심에서 P 까지의 거리를 구해 제곱해야 함(거리를 그대로 답하거나 좌표를 더하면 오답) — medium 은 반지름이 격자로 읽힘",
      concepts: ["원의 방정식", "두 점 사이의 거리", "좌표 읽기"],
      gen(rng) { return retry(rng, () => {
        const [c, p] = names(rng, 2); const s = circ(rng); const f = circFig(s.C, s.r, { cLabel: c, p: s.P, pLabel: p }); const c2 = s.r * s.r;
        return geoInst(rng, {
          stimulus: cgIntro(rng, sc(c, p), ` The equation of the circle is written as ${EQ}.`), question: rng.pick(["What is the value of $r^2$?", "In the equation of the circle, what is $r^2$?", "Find the value of $r^2$ in the equation."]), correct: c2,
          wrongs: pos([W(s.r, "step_missing", "반지름을 제곱하지 않았다."), W(s.dx + s.dy, "formula_misuse", "가로·세로 차를 더했다."), W(s.dx * s.dx + s.dy, "formula_misuse", "한 쪽만 제곱했다."), W(c2 + 2 * s.r, "other", "계산 중 어긋났다."), W(2 * s.r, "formula_misuse", "지름을 답했다.")]).filter((x) => x.v !== c2),
          verificationJs: figJs({ c, p }, f, `${CJ}const C=PA(P.c), Q=PA(P.p); const r=dist(C,Q); if (Math.abs(r-CI.radius)>1e-9) throw new Error('원 위의 점 아님'); return ip(r*r);`),
          trace: [[`그림에서 ${c} = (${s.h}, ${s.k}), ${p} = (${s.P[0]}, ${s.P[1]}) 를 읽는다.`, "Read the center and the point."], [`가로 차 = ${s.dx}, 세로 차 = ${s.dy} 이다.`, "The differences."], [`반지름 r = √(${s.dx}² + ${s.dy}²) = ${s.r} 이다.`, "The radius."], [`r² = ${s.r}² 이다.`, "Square the radius."], [`따라서 ${c2} 이다.`, "State r squared."]], variant: "circle_graph_r_squared",
        }, f);
      }); },
    },
    {
      op: "chain2", structure: "원의 중심 (h, k) 와 반지름을 읽어 표준형의 h + k + r² 의 값을 구함", extra: "중심 좌표와 r² 을 모두 구해 더해야 함(r 을 그대로 쓰거나 부호를 바꾸면 오답) — medium 은 h + k",
      concepts: ["원의 방정식", "좌표 읽기", "표준형의 계수"],
      gen(rng) { return retry(rng, () => {
        const [c, p] = names(rng, 2); const s = circ(rng); const f = circFig(s.C, s.r, { cLabel: c, p: s.P, pLabel: p }); const val = s.h + s.k + s.r * s.r; if (val <= 0) throw new GenFail("음수");
        return geoInst(rng, {
          stimulus: cgIntro(rng, sc(c, p), ` The equation of the circle is written as ${EQ}.`), question: rng.pick(["What is the value of $h + k + r^2$?", "Find the value of $h + k + r^2$.", "In the equation, what is the sum $h + k + r^2$?"]), correct: val,
          wrongs: pos([W(s.r * s.r, "step_missing", "r² 만 답했다."), W(s.h + s.k + s.r, "step_missing", "r 을 제곱하지 않았다."), W(-s.h - s.k + s.r * s.r, "formula_misuse", "중심의 부호를 반대로 썼다."), W(s.h + s.k, "step_missing", "중심의 합만 답했다."), W(val + 1, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== val),
          verificationJs: figJs({ c, p }, f, `${CJ}const C=PA(P.c), Q=PA(P.p); const r=dist(C,Q); if (Math.abs(r-CI.radius)>1e-9) throw new Error('원 위의 점 아님'); return ip(C[0]+C[1]+r*r);`),
          trace: [[`그림에서 ${c} = (${s.h}, ${s.k}), ${p} = (${s.P[0]}, ${s.P[1]}) 를 읽는다.`, "Read the center and the point."], [`h = ${s.h}, k = ${s.k} 이다.`, "The center gives h and k."], [`r = ${s.r} 이므로 r² = ${s.r * s.r} 이다.`, "The radius squared."], [`h + k + r² = ${s.h} + ${s.k} + ${s.r * s.r} 이다.`, "Add."], [`따라서 ${val} 이다.`, "State the value."]], variant: "circle_graph_sum_constants",
        }, f);
      }); },
    },
    {
      op: "repr_shift", structure: "원의 지름의 양 끝점 A, B 가 그림에 있을 때 거리를 지름으로 옮겨 반지름을 구한 뒤 r² 을 구함", extra: "지름의 절반을 제곱해야 함(지름을 제곱하거나 반지름을 그대로 답하면 오답) — medium 은 반지름이 격자로 읽힘",
      concepts: ["원의 방정식", "지름과 반지름", "표현 바꾸기"],
      gen(rng) { return retry(rng, () => {
        const [a, b] = names(rng, 2); const r = rng.pick([3, 4, 5, 6]); const h = rng.int(-4, 4), k = rng.int(-4, 4); if (h === 0 && k === 0) throw new GenFail("원점"); const f = circFig([h, k], r, { extra: [ptO(a, [h - r, k]), ptO(b, [h + r, k]), segO("d", a, b)], extraPts: [] }); const c2 = r * r;
        return geoInst(rng, {
          stimulus: cgIntro(rng, [`The figure shows a circle on a coordinate grid; segment ${a}${b} is a diameter of the circle.`, `A circle is graphed in the coordinate plane shown, with diameter ${a}${b} drawn.`, `In the figure shown, ${a} and ${b} are the endpoints of a diameter of the circle.`, `The coordinate grid shown contains a circle whose diameter is ${a}${b}.`], ` The equation of the circle is written as ${EQ}.`), question: rng.pick(["What is the value of $r^2$?", "In the equation of the circle, what is $r^2$?", "Find the value of $r^2$ in the equation."]), correct: c2,
          wrongs: pos([W(r, "step_missing", "반지름을 제곱하지 않았다."), W(4 * r * r, "formula_misuse", "지름을 제곱했다."), W(2 * r, "formula_misuse", "지름을 답했다."), W(2 * r * r, "formula_misuse", "지름의 제곱을 반으로 나누지 않았다."), W(c2 + r, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== c2),
          verificationJs: figJs({ a, b }, f, `${CJ}const A=PA(P.a), B=PA(P.b); const r=dist(A,B)/2; if (Math.abs(r-CI.radius)>1e-9) throw new Error('지름이 원과 다름'); return ip(r*r);`),
          trace: [[`그림에서 ${a} = (${h - r}, ${k}), ${b} = (${h + r}, ${k}) 를 읽는다.`, "Read the diameter's endpoints."], [`지름 ${a}${b} = ${2 * r} 이다.`, "The diameter."], [`반지름 = ${2 * r} ÷ 2 = ${r} 이다.`, "Half the diameter."], [`r² = ${r}² 이다.`, "Square the radius."], [`따라서 ${c2} 이다.`, "State r squared."]], variant: "circle_graph_from_diameter",
        }, f);
      }); },
    },
    {
      op: "inverse", structure: "원의 중심 C 만 그림에 있고 지문에서 원이 y 축에 접한다고 할 때 접하는 조건으로 r = |h| 를 거꾸로 구해 r² 을 구함", extra: "접하는 조건에서 반지름이 중심의 x 좌표의 절댓값임을 추론해야 함(y 좌표를 쓰거나 제곱하지 않으면 오답) — medium 은 반지름이 격자로 읽힘",
      concepts: ["원의 방정식", "접선 조건", "역추론"],
      gen(rng) { return retry(rng, () => {
        const [c] = names(rng, 1); const h = rng.int(3, 9), k = rng.int(-6, 6); const C: P2 = [h, k]; const f = { type: "plane" as const, axes: { x: { min: 0, max: 12, step: 1, title: "x" }, y: { min: -8, max: 8, step: 1, title: "y" } }, objects: [ptO(c, C)] }; const c2 = h * h;
        return geoInst(rng, {
          stimulus: cgIntro(rng, [`The figure shows the center ${c} of a circle on a coordinate grid. The circle is tangent to the $y$-axis.`, `A circle with center ${c}, plotted in the figure shown, touches the $y$-axis at exactly one point.`, `In the figure shown, point ${c} is the center of a circle that is tangent to the $y$-axis.`], ` The equation of the circle is written as ${EQ}.`), question: rng.pick(["What is the value of $r^2$?", "In the equation of the circle, what is $r^2$?", "Find the value of $r^2$ in the equation."]), correct: c2,
          wrongs: pos([W(h, "step_missing", "반지름을 제곱하지 않았다."), W(k * k || h + 1, "formula_misuse", "y 좌표를 제곱했다."), W(h + Math.abs(k), "formula_misuse", "좌표의 절댓값을 더했다."), W(h * h + k * k, "formula_misuse", "원점까지의 거리를 제곱했다."), W(c2 + h, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== c2),
          verificationJs: figJs({ c }, f, `${CG_JS}const C=PA(P.c); if (!(C[0]>0)) throw new Error('y축 오른쪽 아님'); return ip(C[0]*C[0]);`),
          trace: [[`그림에서 ${c} = (${h}, ${k}) 를 읽는다.`, "Read the center."], [`원이 y 축에 접하면 중심에서 y 축까지의 거리가 반지름이다.`, "Tangent to the y-axis."], [`중심에서 y 축까지의 거리 = |${h}| = ${h} 이다.`, "Distance to the y-axis."], [`r = ${h} 이므로 r² = ${h}² 이다.`, "Square the radius."], [`따라서 ${c2} 이다.`, "State r squared."]], variant: "circle_graph_tangent_y_axis",
        }, f);
      }); },
    },
  ],
  em: [
    {
      lv: "easy", name: "center_h", structure: "원의 중심의 x 좌표를 표준형의 h 로 읽음", extra: "easy: 중심 읽기", concepts: ["원의 방정식", "좌표 읽기"],
      gen(rng) { return retry(rng, () => {
        const [c, p] = names(rng, 2); const s = circ(rng); const f = circFig(s.C, s.r, { cLabel: c, p: s.P, pLabel: p }); const askH = rng.pick([true, false]); const v = askH ? s.h : s.k; if (v <= 0) throw new GenFail("양수만");
        return geoInst(rng, { stimulus: cgIntro(rng, sc(c, p), ` The equation of the circle is written as ${EQ}.`), question: askH ? "What is the value of $h$?" : "What is the value of $k$?", correct: v, wrongs: pos([W(askH ? s.k : s.h, "step_missing", "다른 좌표를 답했다."), W(v + 1, "other", "계산 중 어긋났다."), W(s.r, "step_missing", "반지름을 답했다.")]).filter((x) => x.v !== v), verificationJs: figJs({ c, ax: askH ? 0 : 1 }, f, `${CJ}const C=PA(P.c); return ip(C[P.ax]);`), trace: [[`그림에서 ${c} = (${s.h}, ${s.k}) 를 읽는다.`, "Read the center."], [`표준형의 h, k 는 중심의 좌표이다.`, "h and k are the center."], [`따라서 ${v} 이다.`, "State the value."]], variant: "circle_graph_center_easy" }, f);
      }); },
    },
    {
      lv: "medium", name: "r_squared", structure: "원의 중심과 원 위의 점으로 r² 을 구함", extra: "medium: 거리 공식", concepts: ["원의 방정식", "두 점 사이의 거리"],
      gen(rng) { return retry(rng, () => {
        const [c, p] = names(rng, 2); const s = circ(rng); const f = circFig(s.C, s.r, { cLabel: c, p: s.P, pLabel: p }); const c2 = s.r * s.r;
        return geoInst(rng, { stimulus: cgIntro(rng, sc(c, p), ` The equation of the circle is written as ${EQ}.`), question: rng.pick(["What is the value of $r^2$?", "Find the value of $r^2$ in the equation."]), correct: c2, wrongs: pos([W(s.r, "step_missing", "반지름을 제곱하지 않았다."), W(s.dx + s.dy, "formula_misuse", "가로·세로 차를 더했다."), W(c2 + s.r, "other", "계산 중 어긋났다.")]).filter((x) => x.v !== c2), verificationJs: figJs({ c, p }, f, `${CJ}const C=PA(P.c), Q=PA(P.p); const r=dist(C,Q); if (Math.abs(r-CI.radius)>1e-9) throw new Error('원 위의 점 아님'); return ip(r*r);`), trace: [[`그림에서 ${c}, ${p} 의 좌표를 읽는다.`, "Read the coordinates."], [`r = √(${s.dx}² + ${s.dy}²) = ${s.r} 이다.`, "The radius."], [`따라서 r² = ${c2} 이다.`, "State r squared."]], variant: "circle_graph_r_squared_medium" }, f);
      }); },
    },
  ],
});
