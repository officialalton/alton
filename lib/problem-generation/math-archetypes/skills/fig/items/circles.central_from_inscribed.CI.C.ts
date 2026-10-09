// circles.central_from_inscribed.CI.C — 지문의 관계(x = 2y 또는 x + 2y = 360)를 만족하도록 중심각 x° 와 원주각 y° 를 표시한 원 그림을 4개 중에서 고른다.
// 오답 규칙: minor_vertex(원주각의 꼭짓점이 작은 호 위 → x + 2y = 360)·major_vertex(큰 호 위 → x = 2y)·one_end_A·one_end_B(원주각이 향한 호의 끝점이 중심각의 끝점과 하나만 같음).
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { choiceInst } from "../../tvd-fig-choice";
import { defineItem } from "../item-kit";
import { guard } from "../geo-kit";
import { CIRC_CTX, CIRC_LEAD, circNames, type CircFig } from "../ci-kit";
import { pickChoices } from "../pg-kit";
import { retry } from "../ext-kit";

const SPR_NO_CI = "정답이 원 그림 4개 중 조건을 만족하는 그림을 고르는 것이 문제의 핵심이라 선택지 없이는 성립하지 않는다";
type Pts = { A: string; B: string; C: string; D: string; a0: number; th: number };
/** 점: A=a0, B=a0+θ(작은 호 AB, θ<180), C=큰 호 한가운데, D=작은 호 한가운데. */
const pts = (p: Pts) => [{ id: p.A, angle: p.a0 }, { id: p.B, angle: p.a0 + p.th }, { id: p.C, angle: p.a0 + p.th / 2 + 180 }, { id: p.D, angle: p.a0 + p.th / 2 }];
const mk = (p: Pts, vertex: string, e1: string, e2: string): CircFig => ({ type: "circle", points: pts(p), centralAngles: [{ between: [p.A, p.B], label: "x°" }], inscribedAngles: [{ at: vertex, between: [e1, e2], label: "y°" }] });
const MOD = "const mod=(x)=>((x%360)+360)%360; const PT=FIGURE_POINTS(c); ";
const REL = "const rel=(c)=>{ const pt=(id)=>{ const q=c.points.find(p=>p.id===id); if(!q) throw new Error('점 없음'); return q.angle; }; const ce=c.centralAngles[0].between, ins=c.inscribedAngles[0]; const A=ce[0], B=ce[1]; const same=(ins.between.includes(A)&&ins.between.includes(B)); if (!same){ return ins.between.includes(A)?'one_end_A':ins.between.includes(B)?'one_end_B':'other_ends'; } const mod=(x)=>((x%360)+360)%360; const minor=mod(pt(ins.at)-pt(A))<mod(pt(B)-pt(A)); return minor?'minor_vertex':'major_vertex'; };";
const PRED = `${REL} return rel(c)===P.want;`;
const DIAG = `${REL} const r=rel(c); return r==='other_ends'?null:r;`;
const LEAD = ["", "", "A student is comparing diagrams of angles in a circle. ", "A teacher draws four diagrams of a circle with center $O$. ", "A textbook shows four diagrams of angles in a circle. "];
const Q = (rng: Rng) => rng.pick([`Which figure shows angles $x°$ and $y°$ that satisfy this relationship?`, `Which of the following figures matches the relationship?`, `In which figure do the marked angles satisfy this relationship?`, `Which figure is consistent with this relationship between $x°$ and $y°$?`]);
const REL_TEXT: Record<string, string[]> = {
  twice: ["In each figure, central angle $x°$ and inscribed angle $y°$ are marked, and the relationship $x = 2y$ holds in exactly one of them.", "The angles marked $x°$ (central) and $y°$ (inscribed) satisfy $x = 2y$ in only one figure.", "Exactly one figure has a central angle $x°$ equal to twice the inscribed angle $y°$."],
  half: ["In each figure, the inscribed angle $y°$ is compared with the central angle $x°$; in exactly one figure, $y$ is half of $x$.", "Only one figure shows an inscribed angle $y°$ that is half the central angle $x°$.", "The relationship $y = \\frac{x}{2}$ holds in exactly one of the figures."],
  supp: ["In each figure, central angle $x°$ and inscribed angle $y°$ are marked, and $x + 2y = 360$ holds in exactly one of them.", "Only one figure has marked angles $x°$ and $y°$ with $x + 2y = 360$.", "The relationship $x + 2y = 360$ is true for the angles in exactly one figure."],
  obtuse: ["In exactly one figure, the inscribed angle $y°$ equals $180 - \\frac{x}{2}$, where $x°$ is the central angle.", "Only one figure shows an inscribed angle $y°$ with $y = 180 - \\frac{x}{2}$.", "The relationship $y = 180 - \\frac{x}{2}$ holds in exactly one figure."],
};
function build(rng: Rng, want: "major_vertex" | "minor_vertex", relKey: string, wrongs: ("major_vertex" | "minor_vertex" | "one_end_A" | "one_end_B")[], variant: string, expl: [string, string][]) {
  const [A, B, C, D] = circNames(rng, 4); const p: Pts = { A, B, C, D, a0: rng.pick([10, 40, 70, 110, 150, 200, 250]), th: rng.pick([80, 90, 100, 110, 120]) };
  const make = (r: string): CircFig => r === "major_vertex" ? mk(p, C, A, B) : r === "minor_vertex" ? mk(p, D, A, B) : r === "one_end_A" ? mk(p, C, A, D) : mk(p, C, D, B);
  const ok = make(want); const cands = wrongs.map(make); const P = { want };
  const { choices, correctIndex, rules } = pickChoices(rng, ok, cands, P, PRED, DIAG);
  return guard(choiceInst(rng, { stimulus: `${rng.pick(LEAD)}${rng.pick(CIRC_CTX)}${rng.pick(REL_TEXT[relKey])}`.replace(/ {2,}/g, " ").trim(), question: Q(rng), choices, correctIndex, rules, P, predicateJs: PRED, diagnoseJs: DIAG, trace: expl, variant, explainKo: "", explainEn: "" }));
}
const ALL: ("major_vertex" | "minor_vertex" | "one_end_A" | "one_end_B")[] = ["major_vertex", "minor_vertex", "one_end_A", "one_end_B"];
const one = (f: (rng: Rng) => ReturnType<typeof build>) => (rng: Rng) => retry(rng, () => f(rng), 24);
const EX_MAJOR: [string, string][] = [["원주각의 꼭짓점이 중심각의 호(작은 호) 반대쪽(큰 호) 위에 있어야 한다.", "The inscribed angle's vertex must be on the opposite (major) arc."], ["원주각이 향하는 호가 중심각이 향하는 호와 같아야 한다(끝점이 같다).", "Both angles must intercept the same arc (same endpoints)."], ["이때 원주각은 중심각의 절반: x = 2y 이다.", "Then the inscribed angle is half the central angle."], ["꼭짓점이 작은 호 위이면 x + 2y = 360 이 되어 x = 2y 가 아니다.", "A vertex on the minor arc gives x + 2y = 360 instead."], ["끝점이 다른 그림은 다른 호를 향하므로 제외한다.", "Rule out figures whose angles intercept different arcs."]];
const EX_MINOR: [string, string][] = [["원주각의 꼭짓점이 작은 호 위에 있으면 큰 호를 향한다.", "A vertex on the minor arc intercepts the major arc."], ["큰 호 = 360° − x 이므로 y = (360 − x) ÷ 2 이다.", "The major arc is 360° − x, and y is half of it."], ["즉 x + 2y = 360 이다.", "So x + 2y = 360."], ["꼭짓점이 큰 호 위이면 x = 2y 이다.", "A vertex on the major arc gives x = 2y."], ["끝점이 다른 그림은 제외하고 꼭짓점이 작은 호 위인 그림을 고른다.", "Pick the figure whose vertex is on the minor arc."]];

const RAW = defineItem({
  prefix: "ci", itemId: "circles.central_from_inscribed.CI.C",
  hard: [
    { op: "compose_kind", sprNo: SPR_NO_CI, structure: "'x = 2y' 를 만족하는(같은 호의 큰 호 위 원주각) 원 그림을 4개 중에서 고름", extra: "원주각의 꼭짓점 위치(큰 호·작은 호)와 같은 호를 향하는지를 함께 판단해야 함(작은 호 위 꼭짓점은 x + 2y = 360) — medium 은 관계가 직접 주어짐", concepts: ["원주각", "중심각", "그림 비교"], gen: one((rng) => build(rng, "major_vertex", "twice", ["minor_vertex", "one_end_A", "one_end_B"], "figure_x_twice_y", EX_MAJOR)) },
    { op: "chain2", sprNo: SPR_NO_CI, structure: "'x + 2y = 360' 을 만족하는(같은 호의 작은 호 위 원주각) 원 그림을 4개 중에서 고름", extra: "작은 호 위의 원주각이 큰 호를 향해 y = (360 − x)/2 임을 알아야 함(큰 호 위 꼭짓점은 x = 2y) — medium 은 관계가 직접 주어짐", concepts: ["원주각", "큰 호와 작은 호", "그림 비교"], gen: one((rng) => build(rng, "minor_vertex", "supp", ["major_vertex", "one_end_A", "one_end_B"], "figure_x_plus_2y_360", EX_MINOR)) },
    { op: "repr_shift", sprNo: SPR_NO_CI, structure: "'원주각은 중심각의 절반' 을 말로 주고 같은 호의 큰 호 위 원주각을 그린 그림을 4개 중에서 고름", extra: "말로 된 관계를 y = x/2 로 옮겨 그림의 위치 관계로 확인해야 함 — medium 은 관계가 직접 주어짐", concepts: ["원주각", "중심각", "표현 바꾸기"], gen: one((rng) => build(rng, "major_vertex", "half", ["minor_vertex", "one_end_A", "one_end_B"], "figure_y_half_x", EX_MAJOR)) },
    { op: "inverse", sprNo: SPR_NO_CI, structure: "'y = 180° − x/2' 를 만족하는(작은 호 위 원주각) 원 그림을 4개 중에서 거꾸로 고름", extra: "식에서 거꾸로 꼭짓점이 작은 호 위여야 함을 추론해야 함 — medium 은 관계가 직접 주어짐", concepts: ["원주각", "큰 호와 작은 호", "역추론"], gen: one((rng) => build(rng, "minor_vertex", "obtuse", ["major_vertex", "one_end_A", "one_end_B"], "figure_y_180_minus_half_x", EX_MINOR)) },
  ],
  em: [
    { lv: "easy", name: "x_twice_y", sprNo: SPR_NO_CI, structure: "'x = 2y' 를 만족하는 원 그림을 4개 중에서 고름", extra: "easy: 큰 호 위 원주각", concepts: ["원주각", "중심각"], gen: one((rng) => build(rng, "major_vertex", "twice", ALL.filter((r) => r !== "major_vertex"), "figure_x_twice_y_easy", EX_MAJOR.slice(0, 3))) },
    { lv: "medium", name: "x_plus_2y", sprNo: SPR_NO_CI, structure: "'x + 2y = 360' 을 만족하는 원 그림을 4개 중에서 고름", extra: "medium: 작은 호 위 원주각", concepts: ["원주각", "큰 호와 작은 호"], gen: one((rng) => build(rng, "minor_vertex", "supp", ALL.filter((r) => r !== "minor_vertex"), "figure_x_plus_2y_medium", EX_MINOR.slice(0, 3))) },
  ],
});
export const ITEM = RAW;
void GenFail;
