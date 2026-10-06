// systems_linear.word_system.LN.C — 두 요금제(처음 요금 + 단위당 요금)를 서술로 주고, 두 직선이 모두 맞는 연립 그래프를 4개 중에서 고른다.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { defineItem } from "../item-kit";
import { C_LEADS, R_SET, SPR_NO_PLANE_CHOICE, cInst, pickLine, pointOn, poolChoices, twoCond, twoLineFig, twoLinePool } from "../cplane-kit";

type Topic = { things: string; unit: string; units: string; total: string; fee: string; A: string; B: string };
const TOPICS: Topic[] = [
  { things: "two gym memberships", unit: "month", units: "months", total: "total cost in dollars", fee: "a joining fee", A: "Gym A", B: "Gym B" },
  { things: "two taxi companies", unit: "mile", units: "miles", total: "fare in dollars", fee: "a base fare", A: "Company A", B: "Company B" },
  { things: "two phone plans", unit: "gigabyte", units: "gigabytes", total: "monthly bill in dollars", fee: "a monthly fee", A: "Plan A", B: "Plan B" },
  { things: "two bike rental shops", unit: "hour", units: "hours", total: "total cost in dollars", fee: "a deposit", A: "Shop A", B: "Shop B" },
  { things: "two printing services", unit: "hundred pages", units: "hundreds of pages", total: "cost in dollars", fee: "a setup fee", A: "Service A", B: "Service B" },
  { things: "two tutoring centers", unit: "session", units: "sessions", total: "total cost in dollars", fee: "a registration fee", A: "Center A", B: "Center B" },
];
const STEMS = ["Four graphs of two lines each are shown in the $xy$-plane, all with the same axes.", "The four graphs shown each draw both lines on the same axes.", "Each of the four graphs shown is a pair of lines in one $xy$-plane.", "Four possible graphs of the two relationships are shown with identical axes.", "Choices A through D, shown below, are graphs of two lines in the same $xy$-plane."];
const QS = (c: string) => [`Which of the four graphs shown models the situation in which ${c}?`, `Which graph shown could represent two lines in which ${c}?`, `Exactly one of the graphs shown matches the situation in which ${c}. Which one is it?`, `Of the four graphs shown, which one models the case where ${c}?`];
const has = (m: string, b: string) => `s.L.some(l => l[0] === ${m} && l[1] === ${b})`;
const STATS = "const L=c.objects.filter(q=>q.kind==='line'); if(L.length!==2) throw new Error('직선 2개 필요'); const k=(o)=>{const [p,q]=o.through; const m=(q[1]-p[1])/(q[0]-p[0]); return [m,p[1]-m*p[0]];}; const LL=L.map(k); const [a,b0]=LL[0],[c0,d0]=LL[1]; const xs=a===c0?NaN:(d0-b0)/(a-c0); const ys=a*xs+b0; return {L:LL,xs,ys};";
type Scene = { R: number; l1: [number, number]; l2: [number, number]; t: Topic };
const POS = [1, 2, 3, 4];
function scene(rng: Rng): Scene { for (let t = 0; t < 400; t++) { const R = rng.pick(R_SET); const l1 = pickLine(rng, R, POS), l2 = pickLine(rng, R, POS); if (l1.b <= 0 || l2.b <= 0 || l1.m === l2.m || l1.b === l2.b) continue; const xi = (l2.b - l1.b) / (l1.m - l2.m); if (!Number.isInteger(xi) || xi < 1 || xi > R - 1) continue; const yi = l1.m * xi + l1.b; if (yi > R - 1) continue; try { twoLineFig(R, [l1.m, l1.b], [l2.m, l2.b]); } catch { continue; } return { R, l1: [l1.m, l1.b], l2: [l2.m, l2.b], t: rng.pick(TOPICS) }; } throw new GenFail("요금제 장면"); }
const xy = (s: Scene) => { const x = (s.l2[1] - s.l1[1]) / (s.l1[0] - s.l2[0]); return [x, s.l1[0] * x + s.l1[1]] as [number, number]; };
const dol = (n: number) => `${n} ${n === 1 ? "dollar" : "dollars"}`;
const one = (u: string, n: number) => (n === 1 ? u : u + "s");

function build(rng: Rng, kind: number) {
  const s = scene(rng); const [m1, b1] = s.l1, [m2, b2] = s.l2; const [x0, y0] = xy(s); const t = s.t; let clause: string, P: Record<string, number>, A: string, B: string, rules: [string, string, string], tag: string, trace: [string, string][];
  const plan = (n: string, m: number, b: number) => `${n} has ${t.fee} of ${dol(b)} and charges ${dol(m)} per ${t.unit}`;
  if (kind === 0) { clause = rng.pick([`${plan(t.A, m1, b1)}, and ${plan(t.B, m2, b2)}`, `${plan(t.B, m2, b2)}, while ${plan(t.A, m1, b1)}`]); P = { m1, b1, m2, b2 }; A = has("P.m1", "P.b1"); B = has("P.m2", "P.b2"); rules = ["first_plan_off", "second_plan_off", "both_off"]; tag = "both_plans"; trace = [[`${t.A}: y = ${m1}x + ${b1}, ${t.B}: y = ${m2}x + ${b2}.`, "Write both plans as lines."]]; }
  else if (kind === 1) { clause = rng.pick([`${plan(t.A, m1, b1)}, and the two cost the same, ${dol(y0)}, after ${x0} ${one(t.unit, x0)}`, `the two cost the same amount, ${dol(y0)}, after ${x0} ${one(t.unit, x0)}, and ${plan(t.A, m1, b1)}`]); P = { x0, y0, m1, b1 }; A = "Math.abs(s.xs - P.x0) < 1e-9 && Math.abs(s.ys - P.y0) < 1e-9"; B = has("P.m1", "P.b1"); rules = ["solution_off", "plan_off", "both_off"]; tag = "equal_cost_and_plan"; trace = [[`${t.A}: y = ${m1}x + ${b1}, 그리고 ${x0} 일 때 둘 다 ${y0} 이다.`, "One plan and the common cost."], [`${t.B} 는 (${x0}, ${y0}) 를 지나야 한다.`, "The other plan passes through the same point."]]; }
  else if (kind === 2) { const [p, q] = pointOn(rng, s.R, m1, b1); if (p < 1) throw new GenFail("p"); clause = rng.pick([`${t.A} charges ${dol(m1)} per ${t.unit} and costs ${dol(q)} after ${p} ${one(t.unit, p)}, and ${plan(t.B, m2, b2)}`, `${plan(t.B, m2, b2)}, and ${t.A} charges ${dol(m1)} per ${t.unit} and costs ${dol(q)} after ${p} ${one(t.unit, p)}`]); P = { m1, p, q, m2, b2 }; A = "s.L.some(l => l[0] === P.m1 && Math.abs(l[0] * P.p + l[1] - P.q) < 1e-9)"; B = has("P.m2", "P.b2"); rules = ["first_plan_off", "second_plan_off", "both_off"]; tag = "rate_cost_and_plan"; trace = [[`${t.A}: 기울기 ${m1}, 점 (${p}, ${q}) → 처음 요금 ${b1}.`, "Find the first plan's fee."], [`${t.B}: y = ${m2}x + ${b2}.`, "Write the second plan."]]; }
  else { clause = rng.pick([`the two cost the same after ${x0} ${one(t.unit, x0)}, and ${plan(t.B, m2, b2)}`, `${plan(t.B, m2, b2)}, and the two cost the same after ${x0} ${one(t.unit, x0)}`]); P = { x0, m2, b2 }; A = "Math.abs(s.xs - P.x0) < 1e-9"; B = has("P.m2", "P.b2"); rules = ["crossing_off", "plan_off", "both_off"]; tag = "crossing_and_plan"; trace = [[`${t.B}: y = ${m2}x + ${b2}, 두 요금은 ${x0} 에서 같다.`, "One plan and the crossing."], [`그 값은 ${y0} 이므로 ${t.A} 도 (${x0}, ${y0}) 를 지난다.`, "The other plan passes through the same point."]]; }
  const c = twoCond(STATS, A, B, rules); const ok = twoLineFig(s.R, s.l1, s.l2); const pool = twoLinePool(rng, s.R, [s.l1, s.l2]);
  const ch = poolChoices(rng, { ok, pool, P, ...c });
  return { ch, clause, P, c, tag, trace, t };
}
const mkGen = (kind: number, med = false) => (rng: Rng) => { const { ch, clause, P, c, tag, trace, t } = build(rng, kind); return cInst(rng, ch, { stimulus: `${rng.pick(C_LEADS)}Two lines model ${t.things}, where $x$ is the number of ${t.units} and $y$ is the ${t.total}. ${rng.pick(STEMS)}`, question: rng.pick(QS(clause)), P, ...c, variant: `word_system_${tag}${med ? "_med" : ""}`, trace: [...trace, ["각 그래프의 두 직선의 기울기와 y 절편을 읽는다.", "Read the slope and intercept of both lines in each graph."], ["조건 하나라도 어긋난 그래프를 지운다.", "Eliminate graphs that fail a condition."], ["남은 그래프가 정답이다.", "The remaining graph is the answer."]] }, ["다른 그래프는 조건 하나 이상이 어긋난다.", "Each other graph violates at least one condition."]); };
const H = (op: "repr_shift" | "chain2" | "compose_kind" | "inverse", kind: number, structure: string) => ({ op, sprNo: SPR_NO_PLANE_CHOICE, structure, extra: "두 요금제 각각의 조건을 따져 네 그래프를 대조해야 함(한 요금제만 맞는 그래프가 함정) — medium 은 직접 대조", concepts: ["연립방정식의 그래프", "상황의 식 세우기", "교점"], gen: mkGen(kind) });

export const ITEM = defineItem({
  prefix: "wscg", itemId: "systems_linear.word_system.LN.C",
  hard: [H("repr_shift", 0, "두 요금제의 처음 요금·단위당 요금을 서술로 주고 그 연립의 그래프를 고름"), H("chain2", 1, "한 요금제와 두 요금이 같아지는 값을 서술로 주고 그 연립의 그래프를 고름"), H("compose_kind", 2, "한 요금제는 단위당 요금과 한 시점의 요금으로, 다른 요금제는 처음·단위당 요금으로 주고 그래프를 고름"), H("inverse", 3, "두 요금이 같아지는 x 와 한 요금제를 주고 그 연립의 그래프를 고름")],
  em: [
    { lv: "easy", name: "both_plans", sprNo: SPR_NO_PLANE_CHOICE, structure: "두 요금제를 서술로 주고 그래프를 고름", extra: "easy: 두 직선 대조", concepts: ["연립방정식의 그래프"], gen: mkGen(0, true) },
    { lv: "medium", name: "rate_point_plan", sprNo: SPR_NO_PLANE_CHOICE, structure: "한 요금제는 한 시점의 요금으로, 다른 요금제는 처음 요금으로 주고 그래프를 고름", extra: "medium: 점으로 처음 요금 구하기", concepts: ["연립방정식의 그래프", "상황의 식 세우기"], gen: mkGen(2, true) },
  ],
});
