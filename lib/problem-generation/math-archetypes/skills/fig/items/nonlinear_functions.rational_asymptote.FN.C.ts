// nonlinear_functions.rational_asymptote.FN.C — 점선 점근선이 있는 유리함수 그래프 4개를 선택지로 주고, 점근선 위치·지나는 점·곡선 위치 조건 두 개를 모두 만족하는 그래프를 고른다.
import { GenFail, type OperatorId } from "../../../types";
import type { Rng } from "../../../rng";
import { defineItem } from "../item-kit";
import { pureAxes } from "../pure-kit";
import { C_LEADS, SPR_NO_PLANE_CHOICE, cInst, oneCond, poolChoices, twoCond } from "../cplane-kit";

const R = 8;
const HS = [-5, -4, -2, 2, 4, 5], KS = [-5, -4, -2, 2, 4, 5], MS = [-4, -2, 2, 4]; // R=8 의 눈금 숫자(±3, ±6)와 점근선이 겹치지 않는 값
type S = { h: number; k: number; m: number };
const fig = (s: S) => ({ type: "plane" as const, axes: pureAxes(R), objects: [{ id: "F1", kind: "function" as const, fn: "rational" as const, params: [s.k, s.m - s.k * s.h, 1, -s.h] }] });
const POOL: S[] = HS.flatMap((h) => KS.flatMap((k) => MS.map((m) => ({ h, k, m }))));
const pool = POOL.map(fig);
const RSTAT = "const o=c.objects.find(q=>q.kind==='function'&&q.fn==='rational'); if(!o) throw new Error('유리함수 필요'); const [a,b,cc,d]=o.params; const h=-d/cc, k=a/cc, m=(b-a*d/cc)/cc; return {h,k,m};";
const f = (s: S, x: number) => s.k + s.m / (x - s.h);
const ptsOf = (s: S) => { const o: [number, number][] = []; for (let x = -(R - 1); x <= R - 1; x++) { if (x === s.h) continue; const y = f(s, x); if (Number.isInteger(y) && Math.abs(y) <= R - 1 && Math.abs(x) >= 1) o.push([x, y]); } return o; };
const STEMS = ["Four graphs of rational functions are shown in the $xy$-plane, all with the same axes. The dashed lines are the asymptotes.", "The four graphs shown are drawn on identical $xy$-plane axes, and each has two dashed asymptotes.", "Each of the four graphs shown is a curve with dashed asymptotes in the same $xy$-plane.", "Four candidate curves with dashed asymptotes are shown, graphed on one set of axes.", "The choices shown are four graphs of rational functions that share the same axes."];
const QS = (c: string) => [`Which of the four graphs shown is a function whose graph ${c}?`, `Which graph shown is the graph of a rational function that ${c}?`, `Exactly one of the four graphs shown ${c}. Which one is it?`, `Of the graphs shown, which one ${c}?`];
type B = { clause: string; P: Record<string, number>; A: string; Bj: string; rules: [string, string, string]; ok: S; trace: [string, string][]; tag: string };
const PT = "Math.abs(s.k + s.m / (P.x1 - s.h) - P.y1) < 1e-9";
const pick = (rng: Rng, needPt = false) => { for (let t = 0; t < 200; t++) { const s = rng.pick(POOL); const ps = ptsOf(s); if (needPt && !ps.length) continue; return { s, pt: needPt ? rng.pick(ps) : ([0, 0] as [number, number]) }; } throw new GenFail("rational"); };
const BUILD: Record<string, (rng: Rng) => B> = {
  hk(rng) { const { s } = pick(rng); return { tag: "both_asymptotes", clause: rng.pick([`has a vertical asymptote at $x = ${s.h}$ and a horizontal asymptote at $y = ${s.k}$`, `approaches the vertical line $x = ${s.h}$ and the horizontal line $y = ${s.k}$`]), P: { h: s.h, k: s.k }, A: "s.h === P.h", Bj: "s.k === P.k", rules: ["vertical_off", "horizontal_off", "both_off"], ok: s, trace: [[`수직 점근선 x = ${s.h}, 수평 점근선 y = ${s.k}.`, "Both asymptotes."]] }; },
  hPt(rng) { const { s, pt } = pick(rng, true); return { tag: "vertical_and_point", clause: rng.pick([`has a vertical asymptote at $x = ${s.h}$ and passes through the point with $x$-coordinate ${pt[0]} and $y$-coordinate ${pt[1]}`, `passes through the point where $x = ${pt[0]}$ and $y = ${pt[1]}$ and has the vertical asymptote $x = ${s.h}$`]), P: { h: s.h, x1: pt[0], y1: pt[1] }, A: "s.h === P.h", Bj: PT, rules: ["vertical_off", "point_off", "both_off"], ok: s, trace: [[`수직 점근선 x = ${s.h} 이고 점 (${pt[0]}, ${pt[1]}) 을 지난다.`, "Vertical asymptote and a point."]] }; },
  kPt(rng) { const { s, pt } = pick(rng, true); return { tag: "horizontal_and_point", clause: rng.pick([`has a horizontal asymptote at $y = ${s.k}$ and passes through the point with $x$-coordinate ${pt[0]} and $y$-coordinate ${pt[1]}`, `passes through the point where $x = ${pt[0]}$ and $y = ${pt[1]}$ and has the horizontal asymptote $y = ${s.k}$`]), P: { k: s.k, x1: pt[0], y1: pt[1] }, A: "s.k === P.k", Bj: PT, rules: ["horizontal_off", "point_off", "both_off"], ok: s, trace: [[`수평 점근선 y = ${s.k} 이고 점 (${pt[0]}, ${pt[1]}) 을 지난다.`, "Horizontal asymptote and a point."]] }; },
  hSide(rng) { const { s } = pick(rng); const above = s.m > 0; return { tag: "vertical_and_side", clause: rng.pick([`has a vertical asymptote at $x = ${s.h}$ and, for $x$ greater than ${s.h}, lies ${above ? "above" : "below"} its horizontal asymptote`, `lies ${above ? "above" : "below"} its horizontal asymptote to the right of the vertical asymptote $x = ${s.h}$`]), P: { h: s.h, above: above ? 1 : 0 }, A: "s.h === P.h", Bj: "(s.m > 0 ? 1 : 0) === P.above", rules: ["vertical_off", "side_off", "both_off"], ok: s, trace: [[`수직 점근선 x = ${s.h}, 오른쪽 가지가 수평 점근선 ${above ? "위" : "아래"}에 있다.`, "Vertical asymptote and the branch position."]] }; },
};
const OPS: OperatorId[] = ["repr_shift", "chain2", "compose_kind", "inverse"];
const MENU = ["hk", "hPt", "kPt", "hSide"];
const make = (rng: Rng, key: string) => { const bd = BUILD[key](rng); const c = twoCond(RSTAT, bd.A, bd.Bj, bd.rules); const ch = poolChoices(rng, { ok: fig(bd.ok), pool, P: bd.P, ...c }); return { ch, bd, c }; };

export const ITEM = defineItem({
  prefix: "racc", itemId: "nonlinear_functions.rational_asymptote.FN.C",
  hard: MENU.map((key, i) => ({ op: OPS[i], sprNo: SPR_NO_PLANE_CHOICE, structure: `유리함수 조건(${key}) 두 개를 서술로 주고 두 조건을 모두 만족하는 그래프를 4개 중에서 고름`, extra: "두 조건을 각각 따져 네 그래프를 대조해야 함(조건 하나만 맞는 그래프가 함정)", concepts: ["유리함수 그래프", "점근선"],
    gen(rng: Rng) { const { ch, bd, c } = make(rng, key); return cInst(rng, ch, { stimulus: `${rng.pick(C_LEADS)}${rng.pick(STEMS)}`, question: rng.pick(QS(bd.clause)), P: bd.P, ...c, variant: `rat_${bd.tag}`, trace: [...bd.trace, ["각 그래프의 점선 점근선과 곡선의 가지를 읽는다.", "Read the dashed asymptotes and the branches of each graph."], ["첫째 조건을 어긴 그래프를 지운다.", "Eliminate the graphs that fail the first condition."], ["둘째 조건을 어긴 그래프를 지운다.", "Eliminate the graphs that fail the second condition."], ["남은 그래프가 정답이다.", "The remaining graph is the answer."]] }, ["다른 그래프는 조건 하나 이상이 어긋난다.", "Each other graph violates at least one condition."]); } })),
  em: [
    { lv: "easy" as const, name: "vertical_only", sprNo: SPR_NO_PLANE_CHOICE, structure: "수직 점근선 하나로 그래프 4개 중 고름", extra: "easy: 한 조건", concepts: ["유리함수 그래프", "점근선"],
      gen(rng: Rng) { const { s } = pick(rng); const P = { h: s.h }; const c = oneCond(RSTAT, "s.h", "P.h", "2"); const ch = poolChoices(rng, { ok: fig(s), pool, P, ...c }); return cInst(rng, ch, { stimulus: `${rng.pick(C_LEADS)}${rng.pick(STEMS)}`, question: rng.pick([`Which of the four graphs shown has a vertical asymptote at $x = ${s.h}$?`, `Which graph shown has the dashed vertical line $x = ${s.h}$ as an asymptote?`]), P, ...c, variant: "rat_vertical_only", trace: [[`수직 점근선이 x = ${s.h} 인 그래프를 찾는다.`, "Find the graph with the given vertical asymptote."], ["나머지 그래프는 수직 점근선이 달라 지운다.", "Eliminate the other asymptotes."]] }, ["수직 점근선이 다른 그래프는 정답이 아니다.", "Other asymptotes are wrong."]); } },
    { lv: "medium" as const, name: "medium_both", sprNo: SPR_NO_PLANE_CHOICE, structure: "두 점근선 조건으로 그래프 4개 중 고름", extra: "medium: 두 조건", concepts: ["유리함수 그래프", "점근선"],
      gen(rng: Rng) { const { ch, bd, c } = make(rng, "hk"); return cInst(rng, ch, { stimulus: `${rng.pick(C_LEADS)}${rng.pick(STEMS)}`, question: rng.pick(QS(bd.clause)), P: bd.P, ...c, variant: "rat_both_asymptotes_med", trace: [...bd.trace, ["조건을 어긴 그래프를 지운다.", "Eliminate the graphs that fail a condition."], ["남은 그래프가 정답이다.", "The remaining graph is the answer."]] }, ["다른 그래프는 조건 하나 이상이 어긋난다.", "Each other graph violates at least one condition."]); } },
  ],
});
