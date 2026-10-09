// 직선 그래프 선택지형(LN.C) 원형 팩토리(math-A 소유) — 조건 빌더(기울기·점·절편·표준형·평행·수직) 두 개를 서술로 주고 직선 그래프 4개 중 하나를 고른다.
import { GenFail, type OperatorId } from "../../types";
import type { Rng } from "../../rng";
import { defineItem } from "./item-kit";
import { C_LEADS, LSTAT, SPR_NO_PLANE_CHOICE, cInst, lineOk, linePool, oneCond, pickLine, pointOn, poolChoices, twoCond, R_SET } from "./cplane-kit";
import { lineChoice } from "./ln-b-kit";

type B = { clause: string; P: Record<string, number>; A: string; Bj: string; rules: [string, string, string]; ok: { m: number; b: number }; trace: [string, string][]; tag: string };
type Builder = (rng: Rng, R: number) => B;
const sg = (n: number) => (n < 0 ? `-${-n}` : `${n}`);
const RULES = (a: string, b: string): [string, string, string] => [`${a}_off`, `${b}_off`, "both_off"];

export const BUILDERS: Record<string, Builder> = {
  slopePoint(rng, R) { const { m, b } = pickLine(rng, R); const [p, q] = pointOn(rng, R, m, b);
    return { tag: "slope_point", clause: rng.pick([`has a slope of ${sg(m)} and passes through the point with $x$-coordinate ${p} and $y$-coordinate ${q}`, `has slope ${sg(m)}, and when $x = ${p}$ the $y$-value on the line is ${q}`, `passes through the point where $x = ${p}$ and $y = ${q}$, with a slope of ${sg(m)}`]), P: { m, p, q }, A: "s.m === P.m", Bj: "Math.abs(s.m * P.p + s.b - P.q) < 1e-9", rules: RULES("slope", "point"), ok: { m, b }, trace: [[`기울기는 ${m}, 점 (${p}, ${q}) 을 지난다.`, "Read the slope and the point from the text."], [`y = ${sg(m)}x + b 에 점을 넣으면 b = ${b} 이다.`, "Fit the intercept to the point."]] }; },
  slopeYint(rng, R) { const { m, b } = pickLine(rng, R); return { tag: "slope_yint", clause: rng.pick([`has a slope of ${sg(m)} and a $y$-intercept of ${sg(b)}`, `crosses the $y$-axis at $y = ${sg(b)}$ and has slope ${sg(m)}`, `has $y$-intercept ${sg(b)} and a slope of ${sg(m)}`]), P: { m, b }, A: "s.m === P.m", Bj: "s.b === P.b", rules: RULES("slope", "intercept"), ok: { m, b }, trace: [[`기울기 ${m}, y 절편 ${b} 이므로 y = ${sg(m)}x + ${sg(b)} 이다.`, "The equation is determined by the slope and intercept."]] }; },
  xintSlope(rng, R) { for (let t = 0; t < 200; t++) { const m = rng.pick([-4, -3, -2, -1, 1, 2, 3, 4]); const u = rng.nz(-(R - 2), R - 2); const b = -m * u; if (b === 0 || Math.abs(b) > R - 2) continue; try { lineChoice(R, m, b); } catch { continue; }
      return { tag: "xint_slope", clause: rng.pick([`crosses the $x$-axis at $x = ${sg(u)}$ and has a slope of ${sg(m)}`, `has $x$-intercept ${sg(u)} and slope ${sg(m)}`, `has a slope of ${sg(m)} and its $x$-intercept is ${sg(u)}`]), P: { m, u }, A: "Math.abs(s.m * P.u + s.b) < 1e-9", Bj: "s.m === P.m", rules: RULES("xint", "slope"), ok: { m, b }, trace: [[`x 절편 ${u} 이므로 점 (${u}, 0) 을 지나고 기울기는 ${m} 이다.`, "The x-intercept gives the point (u, 0)."], [`b = -m·u = ${b} 이다.`, "Solve for the y-intercept."]] }; } throw new GenFail("x 절편"); },
  twoPoints(rng, R) { const { m, b } = pickLine(rng, R); const p1 = pointOn(rng, R, m, b); const p2 = pointOn(rng, R, m, b, [p1[0]]); if (Math.abs(p1[0] - p2[0]) < 2) throw new GenFail("가까움");
    return { tag: "two_points", clause: rng.pick([`passes through the point with $x$-coordinate ${p1[0]} and $y$-coordinate ${p1[1]}, and also through the point with $x$-coordinate ${p2[0]} and $y$-coordinate ${p2[1]}`, `contains both the point where $x = ${p1[0]}$ and $y = ${p1[1]}$ and the point where $x = ${p2[0]}$ and $y = ${p2[1]}$`]), P: { p1x: p1[0], p1y: p1[1], p2x: p2[0], p2y: p2[1] }, A: "Math.abs(s.m * P.p1x + s.b - P.p1y) < 1e-9", Bj: "Math.abs(s.m * P.p2x + s.b - P.p2y) < 1e-9", rules: RULES("first_point", "second_point"), ok: { m, b }, trace: [[`두 점 (${p1[0]}, ${p1[1]}), (${p2[0]}, ${p2[1]}) 을 모두 지나야 한다.`, "The line must contain both points."], [`기울기 = (${p2[1]} - ${p1[1]}) ÷ (${p2[0]} - ${p1[0]}) = ${m} 이다.`, "Compute the slope."]] }; },
  standard(rng, R) { const { m, b } = pickLine(rng, R, [-4, -3, -2, -1, 1, 2, 3, 4]); const a = -2 * m, c = 2 * b; const eq = `${sg(a)}x + 2y = ${sg(c)}`;
    return { tag: "standard_form", clause: rng.pick([`is the graph of the equation $${eq}$`, `represents the equation $${eq}$`, `has the equation $${eq}$`]), P: { a, c }, A: "Math.abs(s.m * 2 + P.a) < 1e-9", Bj: "Math.abs(s.b * 2 - P.c) < 1e-9", rules: RULES("slope", "intercept"), ok: { m, b }, trace: [[`${eq} 를 y 에 대해 풀면 y = ${sg(m)}x + ${sg(b)} 이다.`, "Solve the standard form for y."], [`기울기 ${m}, y 절편 ${b} 인 직선을 고른다.`, "Match the slope and intercept."]] }; },
  perpendicular(rng, R) { for (let t = 0; t < 200; t++) { const m1 = rng.pick([2, -2, 1, -1, 0.5, -0.5]); const m = -1 / m1; const { b } = pickLine(rng, R, [m]); let pt: [number, number]; try { pt = pointOn(rng, R, m, b); } catch { continue; }
      return { tag: "perpendicular", clause: rng.pick([`is perpendicular to a line with slope ${sg(m1)} and passes through the point with $x$-coordinate ${pt[0]} and $y$-coordinate ${pt[1]}`, `passes through the point where $x = ${pt[0]}$ and $y = ${pt[1]}$ and is perpendicular to a line whose slope is ${sg(m1)}`]), P: { m1, p: pt[0], q: pt[1] }, A: "Math.abs(s.m * P.m1 + 1) < 1e-9", Bj: "Math.abs(s.m * P.p + s.b - P.q) < 1e-9", rules: RULES("perpendicular", "point"), ok: { m, b }, trace: [[`수직이므로 기울기의 곱이 -1: m = -1 ÷ ${m1} = ${m} 이다.`, "Perpendicular slopes multiply to -1."], [`점 (${pt[0]}, ${pt[1]}) 을 지나므로 b = ${b} 이다.`, "Fit the intercept to the point."]] }; } throw new GenFail("수직"); },
  parallel(rng, R) { const { m, b } = pickLine(rng, R); return { tag: "parallel", clause: rng.pick([`is parallel to a line with slope ${sg(m)} and has a $y$-intercept of ${sg(b)}`, `has a $y$-intercept of ${sg(b)} and is parallel to a line whose slope is ${sg(m)}`]), P: { m, b }, A: "s.m === P.m", Bj: "s.b === P.b", rules: RULES("parallel", "intercept"), ok: { m, b }, trace: [[`평행하므로 기울기 ${m} 는 같고 y 절편은 ${b} 이다.`, "Parallel lines share the slope."]] }; },
  noSolution(rng, R) { const { m, b } = pickLine(rng, R); return { tag: "no_solution", clause: rng.pick([`has no point in common with a line whose slope is ${sg(m)} and whose $y$-intercept is ${sg(b)}`, `forms a system with no solution together with a line that has slope ${sg(m)} and $y$-intercept ${sg(b)}`]), P: { m, b }, A: "s.m === P.m", Bj: "s.b !== P.b", rules: ["not_parallel", "same_line", "not_parallel_same_intercept"], ok: { m, b }, trace: [[`해가 없으려면 평행하고(기울기 ${m}) 서로 다른 직선이어야 한다.`, "No solution means parallel but distinct lines."], [`y 절편은 ${b} 가 아니어야 한다.`, "The intercepts must differ."]] }; },
};
void BUILDERS;

type Spec = { itemId: string; prefix: string; menu: [string, string, string, string]; easy: string; med: string; what: string; concepts: string[] };
const OPS: OperatorId[] = ["repr_shift", "chain2", "compose_kind", "inverse"];

function make(rng: Rng, key: string, spec: Spec) {
  const R = rng.pick(R_SET); const b = BUILDERS[key](rng, R); const ok = lineOk(R, b.ok.m, b.ok.b); const pool = linePool(R);
  // noSolution 은 정답이 (m, b') 형태가 아니라 평행한 다른 절편 직선 — 정답 선택을 따로 고른다.
  let okFig = ok as unknown; if (key === "noSolution") { for (let t = 0; t < 40; t++) { const b2 = b.ok.b + rng.nz(-4, 4); if (b2 === b.ok.b || Math.abs(b2) > R - 2) continue; try { okFig = lineChoice(R, b.ok.m, b2); break; } catch { /* retry */ } } }
  const c = twoCond(LSTAT, b.A, b.Bj, b.rules);
  const ch = poolChoices(rng, { ok: okFig, pool, P: b.P, ...c });
  return { ch, b, R };
}
const STEMS = ["Four graphs of lines are shown in the $xy$-plane, all with the same axes.", "The four graphs shown are lines drawn on the same $xy$-plane axes.", "Four candidate lines are shown, graphed with identical axes.", "Each of the four graphs shown is a line in the same $xy$-plane.", "Four lines, each drawn on the same grid, are shown as choices.", "The choices shown are four line graphs that share one set of axes."];
const QS = (clause: string) => [`Which of the four graphs shown is a line that ${clause}?`, `Which graph shown is the graph of a line that ${clause}?`, `Which of the following lines shown ${clause}?`, `Exactly one of the four lines shown ${clause}. Which one is it?`, `Of the graphs shown, which line ${clause}?`, `Which line among the choices shown ${clause}?`];

export function lineCItem(spec: Spec) {
  const hard = spec.menu.map((key, i) => ({
    op: OPS[i], sprNo: SPR_NO_PLANE_CHOICE, structure: `직선 조건(${key}) 두 개를 서술로 주고 두 조건을 모두 만족하는 직선 그래프를 4개 중에서 고름`, extra: "두 조건을 각각 따져 네 그래프를 대조해야 함(조건 하나만 맞는 그래프가 함정) — medium 은 기울기·절편 직접 대조", concepts: spec.concepts,
    gen(rng: Rng) { const { ch, b } = make(rng, key, spec); const lead = rng.pick(C_LEADS);
      return cInst(rng, ch, { stimulus: `${lead}${rng.pick(STEMS)}`, question: rng.pick(QS(b.clause)), P: b.P, ...twoCond(LSTAT, b.A, b.Bj, b.rules), variant: `${spec.what}_${b.tag}`, trace: [...b.trace, ["각 선택지 그래프에서 기울기와 y 절편(또는 지나는 점)을 읽는다.", "Read the slope and intercept of each graph."], ["첫째 조건을 만족하지 못하는 그래프를 지운다.", "Eliminate the graphs that fail the first condition."], ["둘째 조건을 만족하지 못하는 그래프를 지운다.", "Eliminate the graphs that fail the second condition."], ["남은 그래프가 정답이다.", "The remaining graph is the answer."]] }, ["다른 그래프는 조건 하나 이상이 어긋난다.", "Each other graph violates at least one condition."]); },
  }));
  const em = [{ lv: "easy" as const, key: spec.easy }, { lv: "medium" as const, key: spec.med }].map(({ lv, key }) => ({
    lv, name: `${lv}_${key}`, sprNo: SPR_NO_PLANE_CHOICE, structure: `직선 조건(${key})으로 직선 그래프 4개 중 고름`, extra: lv === "easy" ? "easy: 한 조건" : "medium: 두 조건", concepts: spec.concepts,
    gen(rng: Rng) { if (lv === "easy") { const R = rng.pick(R_SET); const { m, b } = pickLine(rng, R); const ch = poolChoices(rng, { ok: lineOk(R, m, b), pool: linePool(R), P: { m }, ...oneCond(LSTAT, "s.m", "P.m", "1.5") });
        return cInst(rng, ch, { stimulus: `${rng.pick(C_LEADS)}${rng.pick(STEMS)}`, question: rng.pick([`Which of the four graphs shown is a line with a slope of ${sg(m)}?`, `Which graph shown is a line whose slope is ${sg(m)}?`, `Of the graphs shown, which line has a slope of ${sg(m)}?`, `Exactly one of the four lines shown has slope ${sg(m)}. Which one is it?`, `Which line among the choices shown rises or falls with a slope of ${sg(m)}?`, `The slope of one of the four lines shown is ${sg(m)}. Which graph is it?`, `Which of the following lines shown has a slope equal to ${sg(m)}?`, `Which choice shown is a line whose slope is ${sg(m)}?`]), P: { m }, ...oneCond(LSTAT, "s.m", "P.m", "1.5"), variant: `${spec.what}_slope_only`, trace: [[`기울기가 ${m} 인 직선을 찾는다.`, "Find the line with the given slope."], ["나머지 그래프는 기울기가 달라 지운다.", "Eliminate the other slopes."]] }, ["기울기가 다른 그래프는 정답이 아니다.", "Other slopes are wrong."]); }
      const { ch, b } = make(rng, key, spec); return cInst(rng, ch, { stimulus: `${rng.pick(C_LEADS)}${rng.pick(STEMS)}`, question: rng.pick(QS(b.clause)), P: b.P, ...twoCond(LSTAT, b.A, b.Bj, b.rules), variant: `${spec.what}_${b.tag}_med`, trace: [...b.trace, ["조건을 만족하지 못하는 그래프를 지운다.", "Eliminate the graphs that fail a condition."], ["남은 그래프가 정답이다.", "The remaining graph is the answer."]] }, ["다른 그래프는 조건 하나 이상이 어긋난다.", "Each other graph violates at least one condition."]); },
  }));
  return defineItem({ prefix: spec.prefix, itemId: spec.itemId, hard, em });
}
