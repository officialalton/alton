import { un } from "../cg-kit";
// nonlinear_equations_systems.circle_equation_graph.CG.C — 지문의 원의 방정식(표준형·평행이동·말·접선 조건)에 맞는 원 그래프를 4개 중에서 고른다.
// 오답 규칙: sign_h·sign_k·sign_both(중심의 부호 오독)·swap_hk(h 와 k 맞바꿈)·radius(반지름 오독).
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { choiceInst } from "../../tvd-fig-choice";
import { defineItem } from "../item-kit";
import { guard } from "../geo-kit";
import { retry } from "../ext-kit";
import { CC_DIAG_SIGNS, CC_JS, SPR_NO_CG, cgcIntro, circChoices, signCands } from "../cgc-kit";

const Q = (rng: Rng) => rng.pick(["Which graph shows this circle?", "Which of the following graphs matches the equation?", "Which figure is the graph of the circle described?", "Which graph is consistent with this description?"]);
const fx = (v: number) => (v === 0 ? "x" : v > 0 ? `(x - ${v})` : `(x + ${-v})`);
const fy = (v: number) => (v === 0 ? "y" : v > 0 ? `(y - ${v})` : `(y + ${-v})`);
const eqTex = (h: number, k: number, r2: number) => `$${fx(h)}^2 + ${fy(k)}^2 = ${r2}$`;
const scene = (rng: Rng) => { for (let i = 0; i < 40; i++) { const h = rng.int(-4, 4), k = rng.int(-4, 4), r = rng.int(2, 4); if (h === 0 || k === 0 || Math.abs(h) === Math.abs(k)) continue; return { h, k, r }; } throw new GenFail("원 장면"); };
type Sc = ReturnType<typeof scene>;
const F_STD = (e: string) => (rng: Rng) => rng.pick([`The equation of a circle is ${e}.`, `A circle is described by the equation ${e}.`, `Consider the circle whose equation is ${e}.`, `The graph of ${e} is a circle.`, `A circle in the $xy$-plane satisfies ${e}.`, `Let the circle be given by ${e}.`, `The equation ${e} defines a circle.`, `One circle is defined by ${e}.`]);
const SIDE_X = (h: number) => (h > 0 ? `${un(h)} to the right of` : `${un(-h)} to the left of`);
const SIDE_Y = (k: number) => (k > 0 ? `${un(k)} above` : `${un(-k)} below`);

/** P: 지문에 인쇄된 값만(검증 상수 규칙). pred: 정답 원의 조건 JS(P 와 K(c) 사용). */
function build(rng: Rng, s: Sc, P: Record<string, number | string>, pred: string, stim: string, trace: [string, string][], variant: string) {
  const ok = { c: [s.h, s.k] as [number, number], r: s.r };
  const { choices, correctIndex, rules } = circChoices(rng, ok, signCands(s.h, s.k, s.r), P, pred, CC_DIAG_SIGNS);
  return guard(choiceInst(rng, { stimulus: cgcIntro(rng, stim), question: Q(rng), choices, correctIndex, rules, P, predicateJs: `${CC_JS}${pred}`, diagnoseJs: `${CC_JS}${CC_DIAG_SIGNS}`, trace, variant, explainKo: "", explainEn: "" }));
}
const PRED_STD = "const a=K(c); return a.h===P.h&&a.k===P.k&&a.r*a.r===P.r2;";
const PRED_SHIFT = "const a=K(c); return a.h===P.h+P.dx&&a.k===P.k+P.dy&&a.r*a.r===P.r2;";
const PRED_WORDS = "const a=K(c); return a.h===P.h&&a.k===P.k&&a.r===P.r;";
const PRED_TAN = "const a=K(c); return a.h===P.h&&a.k===P.k&&a.r===Math.abs(P.k);";
const one = (f: (rng: Rng) => ReturnType<typeof build>) => (rng: Rng) => retry(rng, () => f(rng), 24);
const TR_STD = (s: Sc): [string, string][] => [[`식의 (x − h)² 과 (y − k)² 에서 h = ${s.h}, k = ${s.k} 이다.`, "Read h and k from the squared terms."], [`중심은 (${s.h}, ${s.k}) 이다.`, "The center."], [`r² = ${s.r * s.r} 이므로 반지름은 ${s.r} 이다.`, "The radius."], [`중심이 이 위치이고 반지름이 ${s.r} 인 원을 고른다.`, "Look for that center and radius."], [`부호를 반대로 읽은 그림, 좌표를 맞바꾼 그림, 반지름이 다른 그림은 오답이다.`, "Sign errors, swapped coordinates, and other radii are wrong."]];

const RAW = defineItem({
  prefix: "av", itemId: "nonlinear_equations_systems.circle_equation_graph.CG.C",
  hard: [
    { op: "compose_kind", sprNo: SPR_NO_CG, structure: "표준형 (x − h)² + (y − k)² = r² 의 부호를 읽어 중심을 정하고 r² 에서 반지름을 구해 그래프를 고름", extra: "식의 부호와 중심 좌표의 부호가 반대임을 알아야 함(부호 오독·h 와 k 맞바꿈이 함정) — medium 은 중심이 원점", concepts: ["원의 방정식", "그래프 읽기", "표준형"],
      gen: one((rng) => { const s = scene(rng); return build(rng, s, { h: s.h, k: s.k, r2: s.r * s.r }, PRED_STD, F_STD(eqTex(s.h, s.k, s.r * s.r))(rng), TR_STD(s), "circle_graph_choice_standard"); }) },
    { op: "chain2", sprNo: SPR_NO_CG, structure: "원 (x − h)² + (y − k)² = r² 을 오른쪽·위로 평행이동한 상의 중심을 구해 그래프를 고름", extra: "중심을 읽은 뒤 이동량을 더해야 함(이동 전 원을 고르거나 이동 방향을 반대로 하면 오답) — medium 은 이동 없음", concepts: ["원의 방정식", "평행이동", "그래프 읽기"],
      gen: one((rng) => { const s = scene(rng); const dx = rng.int(1, 3), dy = rng.int(1, 3); const h2 = s.h + dx, k2 = s.k + dy; if (h2 === 0 || k2 === 0 || Math.abs(h2) === Math.abs(k2) || Math.abs(h2) + s.r > 8 || Math.abs(k2) + s.r > 8) throw new GenFail("범위");
        return build(rng, { h: h2, k: k2, r: s.r }, { h: s.h, k: s.k, r2: s.r * s.r, dx, dy }, PRED_SHIFT, rng.pick([`The graph of ${eqTex(s.h, s.k, s.r * s.r)} is shifted ${un(dx)} to the right and ${un(dy)} up.`, `A circle with equation ${eqTex(s.h, s.k, s.r * s.r)} is moved ${un(dx)} right and ${un(dy)} up.`, `The circle ${eqTex(s.h, s.k, s.r * s.r)} is translated ${un(dx)} to the right and ${un(dy)} up.`, `After shifting the circle ${eqTex(s.h, s.k, s.r * s.r)} right by ${dx} and up by ${dy}, a new circle is formed.`, `Starting from ${eqTex(s.h, s.k, s.r * s.r)}, the circle slides ${un(dx)} to the right and ${un(dy)} up.`]), [[`원래 중심은 (${s.h}, ${s.k}) 이다.`, "Read the original center."], [`오른쪽으로 ${dx}, 위로 ${dy} 이동한다.`, "Apply the shift."], [`상의 중심 = (${h2}, ${k2}) 이다.`, "The image center."], [`반지름은 ${s.r} 로 그대로이다.`, "The radius is unchanged."], [`중심이 이 위치이고 반지름이 ${s.r} 인 원을 고른다.`, "Pick the matching circle."]], "circle_graph_choice_shifted"); }) },
    { op: "repr_shift", sprNo: SPR_NO_CG, structure: "중심의 위치와 반지름을 말로 설명한 원을 좌표로 옮겨 그래프를 고름", extra: "방향 말(왼쪽·아래)을 좌표의 부호로 옮겨야 함(부호를 놓치거나 좌표를 맞바꾸면 오답) — medium 은 방정식이 주어짐", concepts: ["원의 방정식", "표현 바꾸기", "그래프 읽기"],
      gen: one((rng) => { const s = scene(rng); return build(rng, s, { h: s.h, k: s.k, r: s.r }, PRED_WORDS, rng.pick([`A circle has radius ${s.r}. Its center is ${SIDE_X(s.h)} the $y$-axis and ${SIDE_Y(s.k)} the $x$-axis.`, `The center of a circle lies ${SIDE_X(s.h)} the $y$-axis and ${SIDE_Y(s.k)} the $x$-axis, and its radius is ${s.r}.`, `A circle of radius ${s.r} is centered ${SIDE_Y(s.k)} the $x$-axis and ${SIDE_X(s.h)} the $y$-axis.`, `Describe a circle by its radius, ${s.r}, and its center, which is ${SIDE_X(s.h)} the $y$-axis and ${SIDE_Y(s.k)} the $x$-axis.`, `A round fountain has radius ${s.r}; its center sits ${SIDE_Y(s.k)} the $x$-axis and ${SIDE_X(s.h)} the $y$-axis.`]), [[`중심은 y 축에서 ${Math.abs(s.h)} 만큼 ${s.h > 0 ? "오른쪽" : "왼쪽"} 이므로 x 좌표는 ${s.h} 이다.`, "Translate the horizontal words into the x-coordinate."], [`중심은 x 축에서 ${Math.abs(s.k)} 만큼 ${s.k > 0 ? "위" : "아래"} 이므로 y 좌표는 ${s.k} 이다.`, "Translate the vertical words into the y-coordinate."], [`중심 = (${s.h}, ${s.k}) 이다.`, "The center."], [`반지름은 ${s.r} 이다.`, "The radius."], [`중심이 이 위치이고 반지름이 ${s.r} 인 원을 고른다.`, "Pick the matching circle."]], "circle_graph_choice_words"); }) },
    { op: "inverse", sprNo: SPR_NO_CG, structure: "원이 x 축에 접한다는 조건에서 반지름 r = |k| 를 거꾸로 구해 그래프를 고름", extra: "접선 조건에서 반지름을 추론해야 함(r² 을 임의로 두거나 접하지 않는 원을 고르면 오답) — medium 은 r² 이 주어짐", concepts: ["원의 방정식", "접선 조건", "역추론"],
      gen: one((rng) => { const k = rng.pick([-4, -3, 3, 4]); const h = rng.pick([-4, -3, -2, 2, 3, 4]); if (Math.abs(h) === Math.abs(k)) throw new GenFail("같은 절댓값"); const r = Math.abs(k);
        return build(rng, { h, k, r }, { h, k }, PRED_TAN, rng.pick([`A circle with equation $${fx(h)}^2 + ${fy(k)}^2 = r^2$ is tangent to the $x$-axis.`, `The circle $${fx(h)}^2 + ${fy(k)}^2 = r^2$ touches the $x$-axis at exactly one point.`, `For a positive constant $r$, the circle $${fx(h)}^2 + ${fy(k)}^2 = r^2$ is tangent to the $x$-axis.`, `A circle given by $${fx(h)}^2 + ${fy(k)}^2 = r^2$ just touches the $x$-axis without crossing it.`, `The $x$-axis is tangent to the circle $${fx(h)}^2 + ${fy(k)}^2 = r^2$.`]), [[`식에서 중심은 (${h}, ${k}) 이다.`, "Read the center from the equation."], [`원이 x 축에 접하면 중심에서 x 축까지의 거리가 반지름이다.`, "Tangent to the x-axis."], [`거리 = |${k}| = ${r} 이므로 r = ${r} 이다.`, "The radius."], [`중심이 이 위치이고 반지름이 ${r} 인 원을 고른다.`, "Pick the matching circle."], [`x 축에 접하지 않는 그림은 오답이다.`, "A circle that does not touch the x-axis is wrong."]], "circle_graph_choice_tangent"); }) },
  ],
  em: [
    { lv: "easy", name: "standard_form", sprNo: SPR_NO_CG, structure: "표준형의 원 그래프를 고름", extra: "easy: 부호가 양수인 중심", concepts: ["원의 방정식"], gen: one((rng) => { for (let i = 0; i < 30; i++) { const s = scene(rng); if (s.h > 0 && s.k > 0) return build(rng, s, { h: s.h, k: s.k, r2: s.r * s.r }, PRED_STD, F_STD(eqTex(s.h, s.k, s.r * s.r))(rng), TR_STD(s).slice(0, 3), "circle_graph_choice_easy"); } throw new GenFail("양수 중심"); }) },
    { lv: "medium", name: "plus_signs", sprNo: SPR_NO_CG, structure: "(x + a)² + (y + b)² 꼴의 원 그래프를 고름", extra: "medium: 부호가 반대인 중심", concepts: ["원의 방정식", "그래프 읽기"], gen: one((rng) => { for (let i = 0; i < 30; i++) { const s = scene(rng); if (s.h < 0 && s.k < 0) return build(rng, s, { h: s.h, k: s.k, r2: s.r * s.r }, PRED_STD, F_STD(eqTex(s.h, s.k, s.r * s.r))(rng), TR_STD(s).slice(0, 4), "circle_graph_choice_medium"); } throw new GenFail("음수 중심"); }) },
  ],
});
export const ITEM = RAW;
