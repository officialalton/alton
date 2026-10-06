// nonlinear_equations_systems.linear_quadratic_intersection.FN.C — 포물선과 직선이 함께 그려진 그래프 4개를 선택지로 주고, 교점의 개수·직선의 기울기·포물선의 열린 방향 조건 두 개를 모두 만족하는 그래프를 고른다.
import { GenFail, type OperatorId } from "../../../types";
import type { Rng } from "../../../rng";
import { defineItem } from "../item-kit";
import { C_LEADS, R_SET, SPR_NO_PLANE_CHOICE, cInst, parabolaOk, poolChoices, twoCond } from "../cplane-kit";

type S = { R: number; A: number; H: number; K: number; m: number; b: number };
type Fig = { type: "plane"; axes: unknown; objects: Record<string, unknown>[] };
const figOf = (s: S): Fig => { const f = parabolaOk(s.R, s.A, s.H, s.K) as unknown as Fig; return { ...f, objects: [...f.objects, { id: "L1", kind: "line", slope: s.m, intercept: s.b }] }; };
/** 포물선 A(x-H)²+K 와 직선 y = m x + b 의 교점 개수. */
const cnt = (s: S) => { const B = -2 * s.A * s.H, C = s.A * s.H * s.H + s.K; const d = (B - s.m) ** 2 - 4 * s.A * (C - s.b); return d > 1e-9 ? 2 : Math.abs(d) <= 1e-9 ? 1 : 0; };
const STAT = "const o=c.objects.find(q=>q.kind==='function'&&q.fn==='quadratic'); const L=c.objects.find(q=>q.kind==='line'); if(!o||!L) throw new Error('포물선·직선 필요'); const [A,B,C]=o.params; const m=L.slope, b=L.intercept; const d=(B-m)*(B-m)-4*A*(C-b); return {A, m, b, cnt: d>1e-9?2:(Math.abs(d)<=1e-9?1:0)};";
const randS = (rng: Rng, R: number): S => ({ R, A: rng.pick([-2, -1, 1, 2]), H: rng.int(-3, 3), K: rng.int(-(R - 3), R - 3), m: rng.pick([-2, -1, 1, 2, 3, -3]), b: rng.int(-(R - 2), R - 2) });
/** 교점이 모두 그림 안에 보여야 개수를 눈으로 셀 수 있다. */
const visible = (s: S) => { const B = -2 * s.A * s.H, C = s.A * s.H * s.H + s.K; const d = (B - s.m) ** 2 - 4 * s.A * (C - s.b); if (d < -1e-9) return true; const xs = d <= 1e-9 ? [-(B - s.m) / (2 * s.A)] : [(-(B - s.m) + Math.sqrt(d)) / (2 * s.A), (-(B - s.m) - Math.sqrt(d)) / (2 * s.A)]; return xs.every((x) => Math.abs(x) <= s.R - 1 && Math.abs(s.m * x + s.b) <= s.R - 1 && Math.abs(x) >= 0.6); };
const valid = (s: S) => { try { figOf(s); return visible(s); } catch { return false; } };
const poolFor = (rng: Rng, R: number) => { const out: Fig[] = []; for (let i = 0; i < 2500; i++) { const s = randS(rng, R); if (valid(s)) out.push(figOf(s)); } return out; };
/** 조건에 맞는 정답 장면. */
function okScene(rng: Rng, want: (s: S) => boolean): S { for (let t = 0; t < 3000; t++) { const s = randS(rng, rng.pick(R_SET)); if (!valid(s) || !want(s)) continue; return s; } throw new GenFail("교점 장면"); }
const up = (s: S) => (s.A > 0 ? "upward" : "downward");
const sg = (n: number) => (n < 0 ? `-${-n}` : `${n}`);
const CT = (c: number) => (c === 2 ? "exactly two points" : c === 1 ? "exactly one point" : "no points");
type B = { clause: string; P: Record<string, number>; A: string; Bj: string; rules: [string, string, string]; ok: S; tag: string; trace: [string, string][] };
const BUILD: Record<string, (rng: Rng) => B> = {
  twoUp(rng) { const s = okScene(rng, (x) => cnt(x) === 2 && x.A > 0); return { tag: "two_points_up", clause: rng.pick([`the line and the parabola meet at exactly two points, and the parabola opens upward`, `the parabola opens upward and the line crosses it at exactly two points`]), P: { c: 2, up: 1 }, A: "s.cnt === P.c", Bj: "(s.A > 0 ? 1 : 0) === P.up", rules: ["count_off", "opening_off", "both_off"], ok: s, trace: [["교점이 두 개이고 포물선은 위로 열린다.", "Two intersections and an upward parabola."]] }; },
  noneDown(rng) { const s = okScene(rng, (x) => cnt(x) === 0 && x.A < 0); return { tag: "no_points_down", clause: rng.pick([`the line and the parabola have no point in common, and the parabola opens downward`, `the parabola opens downward and the line never meets it`]), P: { c: 0, up: 0 }, A: "s.cnt === P.c", Bj: "(s.A > 0 ? 1 : 0) === P.up", rules: ["count_off", "opening_off", "both_off"], ok: s, trace: [["교점이 없고 포물선은 아래로 열린다.", "No intersections and a downward parabola."]] }; },
  oneSlope(rng) { const s = okScene(rng, (x) => cnt(x) === 1); return { tag: "tangent_slope", clause: rng.pick([`the line has slope ${sg(s0(rng, s))} and touches the parabola at exactly one point`, `the line touches the parabola at exactly one point and has a slope of ${sg(s.m)}`]), P: { c: 1, m: s.m }, A: "s.cnt === P.c", Bj: "s.m === P.m", rules: ["count_off", "slope_off", "both_off"], ok: s, trace: [[`직선의 기울기는 ${s.m} 이고 포물선과 한 점에서 만난다(접한다).`, "A tangent line has one intersection."]] }; },
  twoSlope(rng) { const s = okScene(rng, (x) => cnt(x) === 2); return { tag: "two_points_slope", clause: rng.pick([`the line has slope ${sg(s.m)} and meets the parabola at exactly two points`, `the line meets the parabola at exactly two points and has a slope of ${sg(s.m)}`]), P: { c: 2, m: s.m }, A: "s.cnt === P.c", Bj: "s.m === P.m", rules: ["count_off", "slope_off", "both_off"], ok: s, trace: [[`직선의 기울기는 ${s.m} 이고 포물선과 두 점에서 만난다.`, "Two intersections and the given slope."]] }; },
};
function s0(_r: Rng, s: S) { return s.m; }
const OPS: OperatorId[] = ["repr_shift", "chain2", "compose_kind", "inverse"];
const MENU = ["twoUp", "noneDown", "oneSlope", "twoSlope"];
const STEMS = ["Four graphs, each showing a parabola and a line, are shown in the $xy$-plane with the same axes.", "Each of the four graphs shown has a parabola and a line drawn on identical axes.", "The choices shown are four graphs of a parabola and a line in the same $xy$-plane.", "Four candidate graphs are shown, each with one parabola and one line on the same grid.", "Each of the four graphs shown pairs a parabola with a line in one $xy$-plane."];
const QS = (c: string) => [`Which of the four graphs shown is one in which ${c}?`, `Which graph shown has a parabola and a line such that ${c}?`, `Exactly one of the four graphs shown has ${c.startsWith("the line") ? "a line and parabola where " : "this property: "}${c}. Which one is it?`, `Of the graphs shown, which one is such that ${c}?`];
const make = (rng: Rng, key: string) => { const bd = BUILD[key](rng); const c = twoCond(STAT, bd.A, bd.Bj, bd.rules); const ch = poolChoices(rng, { ok: figOf(bd.ok), pool: poolFor(rng, bd.ok.R), P: bd.P, ...c }); return { ch, bd, c }; };
const trail: [string, string][] = [["각 그래프에서 직선과 포물선이 만나는 점의 개수를 센다.", "Count the intersection points in each graph."], ["첫째 조건을 어긴 그래프를 지운다.", "Eliminate the graphs that fail the first condition."], ["둘째 조건을 어긴 그래프를 지운다.", "Eliminate the graphs that fail the second condition."], ["남은 그래프가 정답이다.", "The remaining graph is the answer."]];

export const ITEM = defineItem({
  prefix: "lqcc", itemId: "nonlinear_equations_systems.linear_quadratic_intersection.FN.C",
  hard: MENU.map((key, i) => ({ op: OPS[i], sprNo: SPR_NO_PLANE_CHOICE, structure: `교점 개수와 ${i < 2 ? "포물선의 열린 방향" : "직선의 기울기"} 조건(${key})을 서술로 주고 두 조건을 모두 만족하는 그래프를 4개 중에서 고름`, extra: "교점 개수와 다른 조건을 각각 따져 네 그래프를 대조해야 함(한 조건만 맞는 그래프가 함정)", concepts: ["직선과 포물선의 교점", "교점의 개수", "그래프 읽기"],
    gen(rng: Rng) { const { ch, bd, c } = make(rng, key); return cInst(rng, ch, { stimulus: `${rng.pick(C_LEADS)}${rng.pick(STEMS)}`, question: rng.pick(QS(bd.clause)), P: bd.P, ...c, variant: `lq_${bd.tag}`, trace: [...bd.trace, ...trail] }, ["다른 그래프는 조건 하나 이상이 어긋난다.", "Each other graph violates at least one condition."]); } })),
  em: [
    { lv: "easy" as const, name: "count_only", sprNo: SPR_NO_PLANE_CHOICE, structure: "교점의 개수 하나로 그래프 4개 중 고름", extra: "easy: 한 조건", concepts: ["직선과 포물선의 교점", "교점의 개수"],
      gen(rng: Rng) { const c0 = rng.pick([0, 1, 2]); const s = okScene(rng, (x) => cnt(x) === c0); const P = { c: c0 }; const pre = `const s = ((c) => { ${STAT} })(c);`; const c = { predicateJs: `${pre} return s.cnt === P.c;`, diagnoseJs: `${pre} if (s.cnt === P.c) return null; return "count_" + s.cnt + (s.A > 0 ? "_up" : "_down");` }; const ch = poolChoices(rng, { ok: figOf(s), pool: poolFor(rng, s.R), P, ...c }); return cInst(rng, ch, { stimulus: `${rng.pick(C_LEADS)}${rng.pick(STEMS)}`, question: rng.pick([`In which of the four graphs shown do the line and the parabola meet at ${CT(c0)}?`, `Which graph shown has a line that meets its parabola at ${CT(c0)}?`, `Of the graphs shown, which one has ${CT(c0)} in common between the line and the parabola?`, `Exactly one of the four graphs shown has a line and parabola with ${CT(c0)} in common. Which one is it?`, `Which choice shown pairs a parabola with a line that share ${CT(c0)}?`, `The line and the parabola share ${CT(c0)} in one of the four graphs shown. Which graph is it?`]), P, ...c, variant: "lq_count_only", trace: [[`교점이 ${c0} 개인 그래프를 찾는다.`, "Find the graph with the given number of intersections."], ["나머지 그래프는 교점 개수가 달라 지운다.", "Eliminate the other counts."]] }, ["교점 개수가 다른 그래프는 정답이 아니다.", "Other counts are wrong."]); } },
    { lv: "medium" as const, name: "medium_two_up", sprNo: SPR_NO_PLANE_CHOICE, structure: "교점 개수와 열린 방향 두 조건으로 그래프 4개 중 고름", extra: "medium: 두 조건", concepts: ["직선과 포물선의 교점", "포물선의 열린 방향"],
      gen(rng: Rng) { const { ch, bd, c } = make(rng, "twoUp"); return cInst(rng, ch, { stimulus: `${rng.pick(C_LEADS)}${rng.pick(STEMS)}`, question: rng.pick([...QS(bd.clause), `Select the graph shown in which ${bd.clause}.`, `One graph shown is such that ${bd.clause}. Which one is it?`]), P: bd.P, ...c, variant: "lq_two_points_up_med", trace: [...bd.trace, ["조건을 어긴 그래프를 지운다.", "Eliminate the graphs that fail a condition."], ["남은 그래프가 정답이다.", "The remaining graph is the answer."]] }, ["다른 그래프는 조건 하나 이상이 어긋난다.", "Each other graph violates at least one condition."]); } },
  ],
});
