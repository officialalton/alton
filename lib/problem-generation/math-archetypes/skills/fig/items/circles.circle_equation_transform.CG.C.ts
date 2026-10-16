import { un } from "../cg-kit";
// circles.circle_equation_transform.CG.C — 지문의 원의 방정식과 변환(평행이동·이동 후 대칭·규칙·상에서 원래 원)에 맞는 원 그래프를 4개 중에서 고른다.
// 오답 규칙: dx_reversed·dy_reversed·both_reversed(이동 방향 오독)·not_moved(이동 전 원)·swapped(dx 와 dy 맞바꿈)·order_swapped·radius(반지름 오독) 등.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { choiceInst } from "../../tvd-fig-choice";
import { defineItem } from "../item-kit";
import { guard } from "../geo-kit";
import { retry } from "../ext-kit";
import { CC_JS, SPR_NO_CG, cgcIntro, centerRulesDiag, circChoices, type CenterRule } from "../cgc-kit";

const Q = (rng: Rng) => rng.pick(["Which graph shows the image of the circle?", "Which of the following graphs shows the circle after the transformation?", "Which figure is the graph of the resulting circle?", "Which graph matches the transformed circle?"]);
const fx = (v: number) => (v === 0 ? "x" : v > 0 ? `(x - ${v})` : `(x + ${-v})`);
const fy = (v: number) => (v === 0 ? "y" : v > 0 ? `(y - ${v})` : `(y + ${-v})`);
const eqTex = (h: number, k: number, r2: number) => `$${fx(h)}^2 + ${fy(k)}^2 = ${r2}$`;
const F_EQ = (rng: Rng, e: string) => rng.pick([`The circle ${e} is`, `A circle has the equation ${e}; it is`, `The graph of ${e} is`, `Consider the circle ${e}. It is`, `A circle with equation ${e} is`, `The circle given by ${e} is`]);
const sg = (v: number) => (v >= 0 ? v : -v);
type Sc = { x0: number; y0: number; dx: number; dy: number; r: number };
const scene = (rng: Rng): Sc => { for (let i = 0; i < 60; i++) { const x0 = rng.int(-3, 3), y0 = rng.int(-3, 3), dx = rng.int(1, 4), dy = rng.int(1, 4), r = rng.int(2, 3); if (x0 === 0 || y0 === 0 || dx === dy) continue; const hx = x0 + dx, ky = y0 + dy; if (hx === 0 || ky === 0 || Math.abs(hx) === Math.abs(ky) || Math.abs(hx) + r > 8 || Math.abs(ky) + r > 8) continue; return { x0, y0, dx, dy, r }; } throw new GenFail("원 장면"); };
const TRANS: CenterRule[] = [
  { name: "dx_reversed", ts: (p) => [p.x0 - p.dx, p.y0 + p.dy], js: "[P.x0-P.dx, P.y0+P.dy]" }, { name: "dy_reversed", ts: (p) => [p.x0 + p.dx, p.y0 - p.dy], js: "[P.x0+P.dx, P.y0-P.dy]" },
  { name: "both_reversed", ts: (p) => [p.x0 - p.dx, p.y0 - p.dy], js: "[P.x0-P.dx, P.y0-P.dy]" }, { name: "not_moved", ts: (p) => [p.x0, p.y0], js: "[P.x0, P.y0]" }, { name: "swapped", ts: (p) => [p.x0 + p.dy, p.y0 + p.dx], js: "[P.x0+P.dy, P.y0+P.dx]" },
];
const REFL: CenterRule[] = [
  { name: "no_reflect", ts: (p) => [p.x0 + p.dx, p.y0 + p.dy], js: "[P.x0+P.dx, P.y0+P.dy]" }, { name: "order_swapped", ts: (p) => [-p.x0 + p.dx, p.y0 + p.dy], js: "[-P.x0+P.dx, P.y0+P.dy]" },
  { name: "wrong_axis", ts: (p) => [p.x0 + p.dx, -(p.y0 + p.dy)], js: "[P.x0+P.dx, -(P.y0+P.dy)]" }, { name: "both_axes", ts: (p) => [-(p.x0 + p.dx), -(p.y0 + p.dy)], js: "[-(P.x0+P.dx), -(P.y0+P.dy)]" },
];
const INV: CenterRule[] = [
  { name: "added_instead", ts: (p) => [p.x0 + p.dx, p.y0 + p.dy], js: "[P.x0+P.dx, P.y0+P.dy]" }, { name: "dx_only", ts: (p) => [p.x0 - p.dx, p.y0], js: "[P.x0-P.dx, P.y0]" },
  { name: "dy_only", ts: (p) => [p.x0, p.y0 - p.dy], js: "[P.x0, P.y0-P.dy]" }, { name: "not_moved", ts: (p) => [p.x0, p.y0], js: "[P.x0, P.y0]" }, { name: "swapped", ts: (p) => [p.x0 - p.dy, p.y0 - p.dx], js: "[P.x0-P.dy, P.y0-P.dx]" },
];
function build(rng: Rng, s: Sc, ok: [number, number], rules: CenterRule[], pred: string, stim: string, trace: [string, string][], variant: string) {
  const P: Record<string, number> = { x0: s.x0, y0: s.y0, dx: s.dx, dy: s.dy, r2: s.r * s.r };
  const cands = [...rules.map((q) => ({ c: q.ts(P), r: s.r })), { c: ok, r: s.r + 1 }, { c: ok, r: s.r - 1 }];
  const diag = centerRulesDiag(rules);
  const { choices, correctIndex, rules: rr } = circChoices(rng, { c: ok, r: s.r }, cands, P, pred, diag);
  return guard(choiceInst(rng, { stimulus: cgcIntro(rng, stim), question: Q(rng), choices, correctIndex, rules: rr, P, predicateJs: `${CC_JS}${pred}`, diagnoseJs: `${CC_JS}${diag}`, trace, variant, explainKo: "", explainEn: "" }));
}
const one = (f: (rng: Rng) => ReturnType<typeof build>) => (rng: Rng) => retry(rng, () => f(rng), 24);
const P_T = "const a=K(c); return a.h===P.x0+P.dx&&a.k===P.y0+P.dy&&a.r*a.r===P.r2;";

const RAW = defineItem({
  prefix: "av", itemId: "circles.circle_equation_transform.CG.C",
  hard: [
    { op: "compose_kind", sprNo: SPR_NO_CG, structure: "원의 방정식의 중심을 읽고 오른쪽·위로 평행이동한 상의 중심을 구해 그래프를 고름", extra: "중심에 이동량을 더하고 반지름은 그대로임을 알아야 함(이동 방향을 반대로 읽거나 이동 전 원을 고르면 오답) — medium 은 한 방향 이동", concepts: ["원의 방정식", "평행이동", "그래프 읽기"],
      gen: one((rng) => { const s = scene(rng); return build(rng, s, [s.x0 + s.dx, s.y0 + s.dy], TRANS, P_T, `${F_EQ(rng, eqTex(s.x0, s.y0, s.r * s.r))} translated ${un(s.dx)} to the right and ${un(s.dy)} up.`, [[`원래 중심은 (${s.x0}, ${s.y0}), 반지름은 ${s.r} 이다.`, "Read the center and the radius."], [`오른쪽으로 ${s.dx}, 위로 ${s.dy} 이동한다.`, "Apply the shift."], [`상의 중심 = (${s.x0 + s.dx}, ${s.y0 + s.dy}) 이다.`, "The image center."], [`평행이동은 반지름을 바꾸지 않는다.`, "The radius is unchanged."], [`이 중심과 반지름 ${s.r} 을 가진 원을 고른다.`, "Pick the matching circle."]], "circle_transform_choice_translate"); }) },
    { op: "chain2", sprNo: SPR_NO_CG, structure: "원을 평행이동한 뒤 y 축에 대해 대칭이동한 상의 중심을 구해 그래프를 고름", extra: "이동한 뒤 x 좌표의 부호를 바꿔야 함(순서를 바꾸거나 대칭을 빠뜨리면 오답) — medium 은 평행이동만", concepts: ["원의 방정식", "평행이동", "대칭이동"],
      gen: one((rng) => { const s = scene(rng); const ok: [number, number] = [-(s.x0 + s.dx), s.y0 + s.dy]; if (ok[0] === ok[1] || Math.abs(ok[0]) === Math.abs(ok[1]) || [-(s.x0 - s.dx)].some((v) => v === 0)) throw new GenFail("겹침");
        return build(rng, s, ok, REFL, "const a=K(c); return a.h===-(P.x0+P.dx)&&a.k===P.y0+P.dy&&a.r*a.r===P.r2;", `${F_EQ(rng, eqTex(s.x0, s.y0, s.r * s.r))} translated ${un(s.dx)} to the right and ${un(s.dy)} up, and then reflected across the $y$-axis.`, [[`원래 중심은 (${s.x0}, ${s.y0}) 이다.`, "Read the center."], [`먼저 이동하면 (${s.x0 + s.dx}, ${s.y0 + s.dy}) 이다.`, "Translate first."], [`y 축 대칭은 x 좌표의 부호를 바꾼다.`, "A reflection across the y-axis flips the sign of x."], [`상의 중심 = (${ok[0]}, ${ok[1]}) 이다.`, "The final center."], [`반지름 ${s.r} 인 원을 고른다.`, "The radius is unchanged."]], "circle_transform_choice_translate_reflect"); }) },
    { op: "repr_shift", sprNo: SPR_NO_CG, structure: "점 (x, y) 가 (x + a, y + b) 로 옮겨진다는 규칙을 평행이동으로 옮겨 상의 원 그래프를 고름", extra: "좌표 규칙을 이동 방향으로 바꿔야 함(부호나 순서를 바꿔 읽으면 오답) — medium 은 말로 주어진 이동", concepts: ["원의 방정식", "평행이동", "표현 바꾸기"],
      gen: one((rng) => { const s = scene(rng); const sy = s.dy; return build(rng, s, [s.x0 + s.dx, s.y0 + s.dy], TRANS, P_T, `${F_EQ(rng, eqTex(s.x0, s.y0, s.r * s.r))} transformed by the rule $(x, y) \\to (x + ${s.dx}, y + ${sy})$.`, [[`규칙 (x, y) → (x + ${s.dx}, y + ${sy}) 는 오른쪽으로 ${s.dx}, 위로 ${sy} 이동하는 것이다.`, "Read the rule as a translation."], [`원래 중심은 (${s.x0}, ${s.y0}) 이다.`, "The original center."], [`상의 중심 = (${s.x0 + s.dx}, ${s.y0 + s.dy}) 이다.`, "The image center."], [`반지름은 ${s.r} 로 그대로이다.`, "The radius is unchanged."], [`이 중심과 반지름을 가진 원을 고른다.`, "Pick the matching circle."]], "circle_transform_choice_rule"); }) },
    { op: "inverse", sprNo: SPR_NO_CG, structure: "평행이동한 상의 원의 방정식과 이동량이 주어질 때 이동하기 전의 원 그래프를 거꾸로 고름", extra: "상의 중심에서 이동량을 빼야 함(더하거나 한 방향만 빼면 오답) — medium 은 이동량이 한 방향", concepts: ["원의 방정식", "평행이동", "역산"],
      gen: one((rng) => { const s = scene(rng); const bx = s.x0 + s.dx, by = s.y0 + s.dy; const sc = { ...s, x0: bx, y0: by }; return build(rng, sc, [s.x0, s.y0], INV, "const a=K(c); return a.h===P.x0-P.dx&&a.k===P.y0-P.dy&&a.r*a.r===P.r2;", rng.pick([`The image of a circle after a translation of ${un(s.dx)} to the right and ${un(s.dy)} up has the equation ${eqTex(bx, by, s.r * s.r)}. Which graph shows the original circle?`, `A circle was moved ${un(s.dx)} right and ${un(s.dy)} up, and the moved circle satisfies ${eqTex(bx, by, s.r * s.r)}. Which graph shows the circle before it was moved?`, `After sliding ${un(s.dx)} to the right and ${un(s.dy)} up, a circle has the equation ${eqTex(bx, by, s.r * s.r)}. Which of the graphs is the starting circle?`, `Moving a circle ${un(s.dx)} to the right and ${un(s.dy)} up produces the circle ${eqTex(bx, by, s.r * s.r)}. Find the graph of the circle that was moved.`, `The translated circle ${eqTex(bx, by, s.r * s.r)} is the result of shifting a circle right by ${s.dx} and up by ${s.dy}. Which graph is the original?`, `Shifting an unknown circle ${un(s.dx)} to the right and ${un(s.dy)} up gives ${eqTex(bx, by, s.r * s.r)}. Which graph shows the unknown circle?`]), [[`상의 중심은 (${bx}, ${by}) 이다.`, "The image center."], [`원래 중심은 이동하기 전이므로 왼쪽으로 ${s.dx}, 아래로 ${s.dy} 되돌린다.`, "Undo the shift."], [`원래 중심 = (${s.x0}, ${s.y0}) 이다.`, "The original center."], [`반지름은 ${s.r} 이다.`, "The radius."], [`이 원을 고른다.`, "Pick the matching circle."]], "circle_transform_choice_original"); }) },
  ],
  em: [
    { lv: "easy", name: "horizontal_shift", sprNo: SPR_NO_CG, structure: "원을 오른쪽으로만 평행이동한 상의 그래프를 고름", extra: "easy: x 좌표만 이동", concepts: ["원의 방정식", "평행이동"],
      gen: one((rng) => { const s = scene(rng); const s2 = { ...s, dy: 0 }; const ok: [number, number] = [s.x0 + s.dx, s.y0]; if (ok[0] === 0 || Math.abs(ok[0]) === Math.abs(ok[1])) throw new GenFail("겹침");
        return build(rng, s2, ok, [{ name: "dx_reversed", ts: (p) => [p.x0 - p.dx, p.y0], js: "[P.x0-P.dx, P.y0]" }, { name: "not_moved", ts: (p) => [p.x0, p.y0], js: "[P.x0, P.y0]" }, { name: "moved_vertically", ts: (p) => [p.x0, p.y0 + p.dx], js: "[P.x0, P.y0+P.dx]" }, { name: "both_reversed", ts: (p) => [p.x0 - p.dx, p.y0 - p.dx], js: "[P.x0-P.dx, P.y0-P.dx]" }], "const a=K(c); return a.h===P.x0+P.dx&&a.k===P.y0&&a.r*a.r===P.r2;", `${F_EQ(rng, eqTex(s.x0, s.y0, s.r * s.r))} translated ${un(s.dx)} to the right.`, [[`원래 중심은 (${s.x0}, ${s.y0}) 이다.`, "The original center."], [`오른쪽으로 ${s.dx} 이동하면 x 좌표만 바뀐다.`, "Only x changes."], [`상의 중심 = (${ok[0]}, ${ok[1]}) 이다.`, "The image center."]], "circle_transform_choice_easy"); }) },
    { lv: "medium", name: "translate_both", sprNo: SPR_NO_CG, structure: "원을 평행이동한 상의 그래프를 고름", extra: "medium: 두 방향 이동", concepts: ["원의 방정식", "평행이동"],
      gen: one((rng) => { const s = scene(rng); return build(rng, s, [s.x0 + s.dx, s.y0 + s.dy], TRANS, P_T, `${F_EQ(rng, eqTex(s.x0, s.y0, s.r * s.r))} translated ${un(s.dx)} to the right and ${un(s.dy)} up.`, [[`원래 중심은 (${s.x0}, ${s.y0}) 이다.`, "The original center."], [`오른쪽으로 ${s.dx}, 위로 ${s.dy} 이동한다.`, "Apply the shift."], [`상의 중심 = (${s.x0 + s.dx}, ${s.y0 + s.dy}) 이다.`, "The image center."], [`반지름 ${s.r} 은 그대로이다.`, "The radius is unchanged."]], "circle_transform_choice_medium"); }) },
  ],
});
export const ITEM = RAW;
void sg;
