// linear_inequalities.point_in_solution.LN.C — 어떤 점이 해이고 어떤 점이 해가 아닌지(경계 위의 점 포함)를 서술로 주고, 조건을 만족하는 부등식 그래프를 4개 중에서 고른다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { defineItem } from "../item-kit";
import { C_LEADS, ISTAT, R_SET, SPR_NO_PLANE_CHOICE, cInst, ineqFig, ineqPool, pickLine, poolChoices, twoCond } from "../cplane-kit";

const OPS = ["<", "<=", ">", ">="] as const;
const STEMS = ["Four graphs of linear inequalities are shown in the $xy$-plane, all with the same axes.", "Each of the four graphs shown has a boundary line and a shaded area, drawn on identical axes.", "The four graphs shown are candidate solution sets, each with its own boundary line.", "Four shaded graphs sharing the same $xy$-plane axes are shown as choices.", "Below are four graphs shown, each a shaded half of the $xy$-plane bounded by a line.", "The choices shown are four inequality graphs that share one set of axes."];
const SATJ = (x: string, y: string) => `(s.above ? (s.strict ? ${y} - (s.m * ${x} + s.b) > 1e-9 : ${y} - (s.m * ${x} + s.b) > -1e-9) : (s.strict ? ${y} - (s.m * ${x} + s.b) < -1e-9 : ${y} - (s.m * ${x} + s.b) < 1e-9))`;
type Pt = [number, number];
const sat = (m: number, b: number, op: string, p: Pt) => { const d = p[1] - (m * p[0] + b); return op === ">" ? d > 1e-9 : op === ">=" ? d > -1e-9 : op === "<" ? d < -1e-9 : d < 1e-9; };
const pt = (x: number, y: number) => `the point with $x$-coordinate ${x} and $y$-coordinate ${y}`;
const pk = <T,>(rng: Rng, xs: T[]) => rng.pick(xs);

function build(rng: Rng, kind: number) {
  const R = rng.pick(R_SET); for (let t = 0; t < 400; t++) {
    const { m, b } = pickLine(rng, R, [-3, -2, -1, 1, 2, 3]); const op = rng.pick(OPS); const strict = op === "<" || op === ">";
    const rp = (): Pt => [rng.int(-R + 2, R - 2), rng.int(-R + 2, R - 2)]; const onLine = (): Pt => { const x = rng.int(-R + 2, R - 2); return [x, m * x + b]; };
    let p1: Pt, p2: Pt, want1: boolean, want2: boolean, tag: string; const mkPts = (w1: boolean, w2: boolean) => { for (let k = 0; k < 60; k++) { const a = rp(), c = rp(); if (a[0] === c[0] && a[1] === c[1]) continue; if (sat(m, b, op, a) === w1 && sat(m, b, op, c) === w2 && Math.abs(a[1] - (m * a[0] + b)) > 0 && Math.abs(c[1] - (m * c[0] + b)) > 0) return [a, c] as [Pt, Pt]; } return null; };
    if (kind === 0) { const r = mkPts(true, false); if (!r) continue; [p1, p2] = r; want1 = true; want2 = false; tag = "solution_and_non"; }
    else if (kind === 1) { const r = mkPts(true, true); if (!r) continue; [p1, p2] = r; want1 = true; want2 = true; tag = "both_solutions"; }
    else if (kind === 2) { const a = onLine(); const r = mkPts(false, false); if (!r) continue; p1 = a; p2 = r[0]; want1 = !strict; want2 = false; tag = "boundary_point"; if (!(sat(m, b, op, p1) === want1 && sat(m, b, op, p2) === want2)) continue; }
    else { const r = mkPts(false, false); if (!r) continue; [p1, p2] = r; want1 = false; want2 = false; tag = "neither"; }
    const clause = (() => { const w = (x: boolean) => (x ? "is a solution" : "is not a solution"); const a = `${pt(p1[0], p1[1])} ${w(want1)}`, c = `${pt(p2[0], p2[1])} ${w(want2)}`; return kind === 1 ? pk(rng, [`both ${pt(p1[0], p1[1])} and ${pt(p2[0], p2[1])} are solutions`, `${a} and ${c}`, `each of ${pt(p1[0], p1[1])} and ${pt(p2[0], p2[1])} satisfies the inequality`]) : kind === 3 ? pk(rng, [`neither ${pt(p1[0], p1[1])} nor ${pt(p2[0], p2[1])} is a solution`, `${a} and ${c}`, `no solution is found at ${pt(p1[0], p1[1])} or at ${pt(p2[0], p2[1])}`]) : pk(rng, [`${a}, but ${c}`, `${c}, and ${a}`, `${a} while ${c}`, `for the pair of points, ${a} and ${c}`]); })();
    const P = { x1: p1[0], y1: p1[1], x2: p2[0], y2: p2[1], w1: want1 ? 1 : 0, w2: want2 ? 1 : 0 };
    const c = twoCond(ISTAT, `${SATJ("P.x1", "P.y1")} === (P.w1 === 1)`, `${SATJ("P.x2", "P.y2")} === (P.w2 === 1)`, ["first_point_off", "second_point_off", "both_off"]);
    const ok = ineqFig(R, m, b, op); const ch = poolChoices(rng, { ok, pool: ineqPool(R), P, ...c });
    const trace: [string, string][] = [[`점 (${p1[0]}, ${p1[1]}) 은 ${want1 ? "해" : "해가 아님"}, 점 (${p2[0]}, ${p2[1]}) 은 ${want2 ? "해" : "해가 아님"}.`, "Read which points must and must not be solutions."], ...(kind === 2 ? [["경계선 위의 점이 해이려면 경계가 실선(≤, ≥)이어야 한다.", "A point on the boundary is a solution only if the line is solid."] as [string, string]] : [])];
    return { ch, clause, P, c, tag, trace };
  } throw new GenFail("점 판정 장면 실패");
}
const QS = (c: string) => [`Which of the four graphs shown is the graph of an inequality for which ${c}?`, `Which graph shown represents an inequality such that ${c}?`, `Exactly one of the graphs shown is the solution set of an inequality for which ${c}. Which one is it?`, `Which of the graphs shown could be the graph of an inequality where ${c}?`, `Choose the graph shown of an inequality in which ${c}.`, `For which of the graphs shown is it true that ${c}?`];
const mkGen = (kind: number, med = false) => (rng: Rng) => { const { ch, clause, P, c, tag, trace } = build(rng, kind); return cInst(rng, ch, { stimulus: `${rng.pick(C_LEADS)}${rng.pick(STEMS)}`, question: rng.pick(QS(clause)), P, ...c, variant: `point_${tag}${med ? "_med" : ""}`, trace: [...trace, ["각 그래프에서 각 점이 음영 안에 있는지, 경계선 위인지 확인한다.", "Test each point against the shading and the boundary."], ["조건을 하나라도 어긴 그래프를 지운다.", "Eliminate graphs that fail a condition."], ["남은 그래프가 정답이다.", "The remaining graph is the answer."]] }, ["다른 그래프는 점 판정이 하나 이상 어긋난다.", "Each other graph misclassifies at least one point."]); };
const H = (op: "repr_shift" | "chain2" | "compose_kind" | "inverse", kind: number, structure: string) => ({ op, sprNo: SPR_NO_PLANE_CHOICE, structure, extra: "두 점의 해 여부를 각각 확인해야 함(한 점만 맞는 그래프·경계 위의 점 처리가 함정) — medium 은 직접 대조", concepts: ["부등식의 그래프", "점이 해인지 판정", "경계(점선·실선)"], gen: mkGen(kind) });

export const ITEM = defineItem({
  prefix: "pisc", itemId: "linear_inequalities.point_in_solution.LN.C",
  hard: [H("repr_shift", 0, "한 점은 해이고 다른 점은 해가 아니라는 조건을 만족하는 부등식 그래프를 고름"), H("chain2", 1, "두 점이 모두 해라는 조건을 만족하는 부등식 그래프를 고름"), H("compose_kind", 2, "경계선 위의 점이 해(실선 경계)이고 다른 점은 해가 아니라는 조건을 만족하는 그래프를 고름"), H("inverse", 3, "두 점이 모두 해가 아니라는 조건을 만족하는 부등식 그래프를 고름")],
  em: [
    { lv: "easy", name: "solution_and_non", sprNo: SPR_NO_PLANE_CHOICE, structure: "해인 점과 해가 아닌 점을 서술로 주고 그래프를 고름", extra: "easy: 직접 대조", concepts: ["부등식의 그래프", "점이 해인지 판정"], gen: mkGen(0, true) },
    { lv: "medium", name: "both_solutions", sprNo: SPR_NO_PLANE_CHOICE, structure: "두 점이 모두 해인 그래프를 고름", extra: "medium: 두 점 모두 확인", concepts: ["부등식의 그래프", "점이 해인지 판정"], gen: mkGen(1, true) },
  ],
});
