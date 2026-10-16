// linear_inequalities.inequality_from_graph.LN.C — 경계선과 음영 방향·점선/실선 조건을 서술로 주고, 맞는 부등식 그래프를 4개 중에서 고른다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { defineItem } from "../item-kit";
import { C_LEADS, ISTAT, R_SET, SPR_NO_PLANE_CHOICE, cInst, ineqFig, ineqPool, pickLine, pointOn, poolChoices, twoCond } from "../cplane-kit";

const sg = (n: number) => (n < 0 ? `-${-n}` : `${n}`);
const OPS = ["<", "<=", ">", ">="] as const;
const STEMS = ["Four graphs of linear inequalities are shown in the $xy$-plane, all with the same axes.", "Each of the four graphs shown has a boundary line and a shaded area, drawn on identical axes.", "The four graphs shown are candidate solution sets of a linear inequality.", "Four shaded graphs sharing the same $xy$-plane axes are shown as choices."];
const QS = (c: string) => [`Which of the four graphs shown is the graph of an inequality whose ${c}?`, `Which graph shown represents an inequality whose ${c}?`, `Exactly one of the graphs shown has ${c}. Which one is it?`.replace("has ", "a solution set whose "), `Which of the following graphs shown could be the solution set of an inequality whose ${c}?`];
const SAT = (xs: string, ys: string) => `(s.above ? (s.strict ? ${ys} - (s.m * ${xs} + s.b) > 1e-9 : ${ys} - (s.m * ${xs} + s.b) > -1e-9) : (s.strict ? ${ys} - (s.m * ${xs} + s.b) < -1e-9 : ${ys} - (s.m * ${xs} + s.b) < 1e-9))`;
let RNG: Rng | null = null;
const pk = <T,>(xs: T[]) => (RNG ? RNG.pick(xs) : xs[0]);
const BL = () => pk(["boundary line", "line bounding the shaded area", "dividing line"]);
const side = (above: boolean, strict: boolean) => pk([`${above ? "above" : "below"} the boundary line, and the boundary line is ${strict ? "dashed" : "solid"}`, `on the ${above ? "upper" : "lower"} side of the line, which is drawn ${strict ? "dashed" : "solid"}`, `${above ? "over" : "under"} the line, with the line itself ${strict ? "dashed" : "solid"}`]);

function build(rng: Rng, kind: number) {
  RNG = rng;
  const R = rng.pick(R_SET); const { m, b } = pickLine(rng, R, [-4, -3, -2, -1, 1, 2, 3, 4]); const op = rng.pick(OPS); const above = op === ">" || op === ">=", strict = op === "<" || op === ">";
  let clause: string, P: Record<string, number>, A: string, B: string, tag: string; const rules: [string, string, string] = ["line_off", "shading_off", "both_off"]; let trace: [string, string][];
  if (kind === 0) { clause = `${BL()} has slope ${sg(m)} and $y$-intercept ${sg(b)}, and the shaded area is ${side(above, strict)}`; P = { m, b, above: above ? 1 : 0, strict: strict ? 1 : 0 }; A = "s.m === P.m && s.b === P.b"; B = "(s.above ? 1 : 0) === P.above && (s.strict ? 1 : 0) === P.strict"; tag = "line_and_shading"; trace = [[`경계선 y = ${sg(m)}x + ${sg(b)}, 음영은 ${above ? "위" : "아래"}, 경계는 ${strict ? "점선" : "실선"}.`, "Read the boundary and the shading from the text."]]; }
  else if (kind === 1) { const [p, q] = pointOn(rng, R, m, b); clause = `${BL()} has slope ${sg(m)} and passes through the point with $x$-coordinate ${p} and $y$-coordinate ${q}, and the shaded area is ${side(above, strict)}`; P = { m, p, q, above: above ? 1 : 0, strict: strict ? 1 : 0 }; A = "s.m === P.m && Math.abs(s.m * P.p + s.b - P.q) < 1e-9"; B = "(s.above ? 1 : 0) === P.above && (s.strict ? 1 : 0) === P.strict"; tag = "line_by_point"; trace = [[`기울기 ${m}, 점 (${p}, ${q}) 로 경계선 y = ${sg(m)}x + ${sg(b)} 를 얻는다.`, "Fit the boundary line."], [`음영은 ${above ? "위" : "아래"}, 경계는 ${strict ? "점선" : "실선"}.`, "Read the shading."]]; }
  else if (kind === 2) { const ox = SAT("0", "0"); const inc = (above ? (strict ? 0 > b : 0 >= b) : (strict ? 0 < b : 0 <= b)); void ox; clause = `${BL()} has slope ${sg(m)} and $y$-intercept ${sg(b)}, the origin ${inc ? "is" : "is not"} a solution, and the boundary line is ${strict ? "dashed" : "solid"}`; P = { m, b, inc: inc ? 1 : 0, strict: strict ? 1 : 0 }; A = "s.m === P.m && s.b === P.b"; B = `((${SAT("0", "0")}) ? 1 : 0) === P.inc && (s.strict ? 1 : 0) === P.strict`; tag = "origin_and_type"; trace = [[`경계선 y = ${sg(m)}x + ${sg(b)}.`, "Boundary line."], [`원점 (0, 0) 이 해이면 음영 쪽에 있다: ${0} ${above ? ">" : "<"} ${b} 인지 확인한다.`, "Test the origin."]]; }
  else { const [p, q] = pointOn(rng, R, m, b); const dx = rng.pick([-1, 1]) * rng.int(1, 3); const tx = p + dx, ty = q + (above ? 1 : -1) * rng.int(1, 3) * 1; const insideT = true; void insideT; clause = pk([`${BL()} has slope ${sg(m)} and passes through the point with $x$-coordinate ${p} and $y$-coordinate ${q}, and the point with $x$-coordinate ${tx} and $y$-coordinate ${ty} is a solution`, `${BL()} passes through the point where $x = ${p}$ and $y = ${q}$ with a slope of ${sg(m)}, and the point where $x = ${tx}$ and $y = ${ty}$ lies in the solution set`, `the point with $x$-coordinate ${tx} and $y$-coordinate ${ty} satisfies the inequality, and the ${BL()} has slope ${sg(m)} through the point with $x$-coordinate ${p} and $y$-coordinate ${q}`]); P = { m, p, q, tx, ty }; A = "s.m === P.m && Math.abs(s.m * P.p + s.b - P.q) < 1e-9"; B = SAT("P.tx", "P.ty"); tag = "line_and_solution_point"; trace = [[`경계선은 기울기 ${m} 이고 점 (${p}, ${q}) 를 지난다.`, "Fit the boundary line."], [`점 (${tx}, ${ty}) 가 해이려면 음영이 ${ty - (m * tx + b) > 0 ? "위쪽" : "아래쪽"}이어야 한다.`, "The given solution point fixes the shaded side."]]; }
  const c = twoCond(ISTAT, A, B, rules); const ok = ineqFig(R, m, b, op); const ch = poolChoices(rng, { ok, pool: ineqPool(R), P, ...c });
  return { ch, clause, P, c, tag, trace };
}
const mkGen = (kind: number, med = false) => (rng: Rng) => { let r; for (let t = 0; t < 12; t++) { try { r = build(rng, kind); break; } catch (e) { if (t === 11) throw e; } } if (!r) throw new GenFail("ineq"); const { ch, clause, P, c, tag, trace } = r; return cInst(rng, ch, { stimulus: `${rng.pick(C_LEADS)}${rng.pick(STEMS)}`, question: rng.pick(QS(clause)), P, ...c, variant: `ineq_${tag}${med ? "_med" : ""}`, trace: [...trace, ["각 그래프의 경계선·음영 방향·점선/실선을 읽는다.", "Read the boundary, the shading, and the line style of each graph."], ["조건을 하나라도 어긴 그래프를 지운다.", "Eliminate graphs that fail a condition."], ["남은 그래프가 정답이다.", "The remaining graph is the answer."]] }, ["다른 그래프는 경계선이나 음영·점선 조건이 어긋난다.", "Each other graph violates the boundary or shading condition."]); };
const H = (op: "repr_shift" | "chain2" | "compose_kind" | "inverse", kind: number, structure: string) => ({ op, sprNo: SPR_NO_PLANE_CHOICE, structure, extra: "경계선과 음영(방향·점선/실선)을 각각 따져 네 그래프를 대조해야 함(경계선만 맞는 그래프가 함정) — medium 은 직접 대조", concepts: ["부등식의 그래프", "경계선", "음영과 점선·실선"], gen: mkGen(kind) });

export const ITEM = defineItem({
  prefix: "ifcg", itemId: "linear_inequalities.inequality_from_graph.LN.C",
  hard: [H("repr_shift", 0, "경계선(기울기·절편)과 음영 방향·점선 여부를 서술로 주고 그래프를 고름"), H("chain2", 1, "경계선을 기울기와 지나는 점으로 주고 음영 방향·점선 여부와 함께 그래프를 고름"), H("compose_kind", 2, "원점이 해인지와 점선 여부로 음영 방향을 추론해 그래프를 고름"), H("inverse", 3, "경계선과 해인 점으로부터 음영 방향을 거꾸로 정해 그래프를 고름")],
  em: [
    { lv: "easy", name: "line_and_shading", sprNo: SPR_NO_PLANE_CHOICE, structure: "경계선과 음영 방향·점선 여부를 서술로 주고 그래프를 고름", extra: "easy: 직접 대조", concepts: ["부등식의 그래프", "그래프 읽기"], gen: mkGen(0, true) },
    { lv: "medium", name: "line_by_point", sprNo: SPR_NO_PLANE_CHOICE, structure: "경계선을 지나는 점으로 주고 그래프를 고름", extra: "medium: 점으로 절편 구하기", concepts: ["부등식의 그래프", "직선의 식"], gen: mkGen(1, true) },
  ],
});
