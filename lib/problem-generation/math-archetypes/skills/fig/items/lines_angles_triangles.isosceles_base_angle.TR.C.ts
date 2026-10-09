// lines_angles_triangles.isosceles_base_angle.TR.C — 지문의 이등변삼각형 조건(AB = AC 와 한 각·두 각의 관계)에서 꼭지각·밑각을 구해 맞는 이등변삼각형 그림(눈금 두 개·각 라벨)을 4개 중에서 고른다.
// 오답 규칙: apex_moved(같은 변 눈금이 다른 꼭짓점에 붙음)·base_is_given/apex_is_given(주어진 각의 역할을 거꾸로 읽음)·unequal_base(밑각이 같지 않음)·swap_*·rotate·shift(각 자리 오류).
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { choiceInst } from "../../tvd-fig-choice";
import { defineItem } from "../item-kit";
import { guard } from "../geo-kit";
import { pickNames, type Tri3 } from "../tri-kit";
import { M_JS, diagBody, genericTriCands, isoFig, scaleneFig, triChoices, type TriFig } from "../trc-kit";

const SPR_NO_TRI = "정답이 이등변삼각형 그림 4개 중 조건을 만족하는 그림을 고르는 것이 문제의 핵심이라 선택지 없이는 성립하지 않는다";
const Q = (rng: Rng, n: string) => rng.pick([`Which of the following figures shows triangle $${n}$?`, `Which figure shows isosceles triangle $${n}$ with its angle measures labeled correctly?`, `Which of the figures correctly shows triangle $${n}$?`, `Which of the following figures matches the description of triangle $${n}$?`, `Which figure gives the angle measures of triangle $${n}$?`]);
const LEAD = ["", "", "A student is drawing a triangle for a geometry assignment. ", "A teacher describes a triangle to the class. ", "A designer is planning a triangular logo. "];
type Scene = { v: Tri3; apex: number; base: number; P: Record<string, number | string | string[]>; pred: string; text: string; spec: string; extra: TriFig[]; explain: [string, string][] };
const nm = (v: Tri3) => v.join("");
const okFig = (s: { v: Tri3; apex: number; base: number }) => isoFig(s.v[0], [s.v[1], s.v[2]], s.apex, s.base);
const PRED_BASE = "const a=m(c); const N=P.v; return c.kind==='isosceles' && c.vertices[0]===N[0] && a[N[1]]===a[N[2]] && a[N[0]]+a[N[1]]+a[N[2]]===180 && ";
const SPEC_BASE = "if (c.kind==='isosceles' && c.vertices[0]!==N[0]) return 'apex_moved'; if (c.kind!=='isosceles' && a[N[0]]===b[N[0]] && a[N[1]]!==a[N[2]]) return 'unequal_base'; ";
/** 공통 후보: 꼭지점 이동·밑각 불일치·자리 오류. */
function commonCands(v: Tri3, apex: number, base: number): TriFig[] {
  const out: TriFig[] = [isoFig(v[1], [v[0], v[2]], apex, base), isoFig(v[2], [v[0], v[1]], apex, base)];
  for (const d of [6, 10, 14]) out.push(scaleneFig(v, [apex, base + d, base - d]), scaleneFig(v, [apex + 2 * d - 2 * d, base - d, base + d]));
  for (const d of [-16, -10, -6, 6, 10, 16]) { const a2 = apex + d; if (a2 >= 24 && a2 <= 120 && (180 - a2) % 2 === 0) out.push(isoFig(v[0], [v[1], v[2]], a2, (180 - a2) / 2)); }
  out.push(...genericTriCands(v, [apex, base, base]));
  return out;
}
function apexGiven(rng: Rng): Scene {
  const v = pickNames(rng); const a = rng.pick([30, 36, 40, 44, 48, 52, 56, 64, 70, 76, 84, 100, 110]); const b = (180 - a) / 2; const n = nm(v);
  return { v, apex: a, base: b, P: { v: [...v], a }, pred: `${PRED_BASE}a[N[0]]===P.a;`,
    text: rng.pick([`Triangle $${n}$ has $${v[0]}${v[1]} = ${v[0]}${v[2]}$, and the measure of angle $${v[0]}$ is ${a}°.`, `In triangle $${n}$, sides $${v[0]}${v[1]}$ and $${v[0]}${v[2]}$ are equal, and angle $${v[0]}$ measures ${a}°.`, `Isosceles triangle $${n}$ has $${v[0]}${v[1]} = ${v[0]}${v[2]}$ and a ${a}° angle at $${v[0]}$.`]),
    spec: `${SPEC_BASE}if (c.kind==='isosceles' && a[N[1]]===P.a) return 'base_is_given';`, extra: [...commonCands(v, a, b), ...(a >= 30 && a <= 70 ? [isoFig(v[0], [v[1], v[2]], 180 - 2 * a, a)] : [])],
    explain: [[`${v[0]}${v[1]} = ${v[0]}${v[2]} 이므로 ∠${v[0]} 가 꼭지각이고 밑각 ∠${v[1]} = ∠${v[2]} 이다.`, "Equal sides: angle at A is the vertex angle; the base angles are equal."], [`∠${v[0]} = ${a}° 이다.`, "The vertex angle is given."], [`밑각의 합 = 180° - ${a}° = ${180 - a}° 이다.`, "The base angles share the rest."], [`밑각 = ${180 - a}° ÷ 2 = ${b}° 이다.`, "Halve it."], [`꼭지각 ${a}°, 밑각 ${b}°·${b}° 이고 눈금이 ${v[0]}${v[1]}, ${v[0]}${v[2]} 에 붙은 그림을 고른다.`, "Pick the figure with the tick marks on AB and AC."]] };
}
function baseGiven(rng: Rng): Scene {
  const v = pickNames(rng); const b = rng.int(40, 75); const a = 180 - 2 * b; if (a < 30 || a === b) throw new GenFail("범위"); const n = nm(v);
  return { v, apex: a, base: b, P: { v: [...v], b }, pred: `${PRED_BASE}a[N[1]]===P.b;`,
    text: rng.pick([`Triangle $${n}$ has $${v[0]}${v[1]} = ${v[0]}${v[2]}$, and the measure of angle $${v[1]}$ is ${b}°.`, `In triangle $${n}$, sides $${v[0]}${v[1]}$ and $${v[0]}${v[2]}$ are equal, and angle $${v[1]}$ measures ${b}°.`, `Isosceles triangle $${n}$ has $${v[0]}${v[1]} = ${v[0]}${v[2]}$ and a ${b}° angle at $${v[1]}$.`]),
    spec: `${SPEC_BASE}if (c.kind==='isosceles' && a[N[0]]===P.b) return 'apex_is_given';`, extra: [...commonCands(v, a, b), ...(b >= 30 && b <= 70 ? [isoFig(v[0], [v[1], v[2]], b, (180 - b) / 2)].filter((f) => Number.isInteger(f.angles[1].value)) : [])],
    explain: [[`${v[0]}${v[1]} = ${v[0]}${v[2]} 이므로 ∠${v[1]} 는 밑각이고 ∠${v[2]} 도 같다.`, "Equal sides: angle at B is a base angle, and C equals it."], [`밑각이 둘이므로 두 밑각의 합은 2 × ${b}° = ${2 * b}° 이다.`, "There are two equal base angles."], [`꼭지각 ∠${v[0]} = 180° - ${2 * b}° = ${a}° 이다.`, "The vertex angle is the rest."]] };
}
function ratioRel(rng: Rng): Scene {
  const v = pickNames(rng); const [apexF, k, word] = rng.pick([[2, 1, "twice"], [4, 1, "four times"], [1, 2, "half of"]] as [number, number, string][]); void k;
  // apexF:1 = 꼭지각 : 밑각 (예: 2 → 꼭지각이 밑각의 2배), 1:2 와 1:4 는 밑각이 꼭지각의 2배·4배
  const apexMul = word === "twice" ? 2 : word === "four times" ? 4 : word === "half of" ? 0.5 : 0.25; void apexF;
  const base = 180 / (apexMul + 2), apex = apexMul * base; if (!Number.isInteger(base) || !Number.isInteger(apex)) throw new GenFail("정수"); const n = nm(v);
  return { v, apex, base, P: { v: [...v], f: apexMul }, pred: `${PRED_BASE}a[N[0]]===P.f*a[N[1]];`,
    text: rng.pick([`Triangle $${n}$ has $${v[0]}${v[1]} = ${v[0]}${v[2]}$, and the measure of angle $${v[0]}$ is ${word} the measure of angle $${v[1]}$.`, `In triangle $${n}$, sides $${v[0]}${v[1]}$ and $${v[0]}${v[2]}$ are equal, and angle $${v[0]}$ measures ${word} angle $${v[1]}$.`]),
    spec: `${SPEC_BASE}if (c.kind==='isosceles' && a[N[1]]===P.f*a[N[0]]) return 'ratio_inverted';`, extra: [...commonCands(v, apex, base), ...((): TriFig[] => { const iv = 1 / apexMul, b2 = 180 / (iv + 2), a2 = iv * b2; return Number.isInteger(b2) && Number.isInteger(a2) ? [isoFig(v[0], [v[1], v[2]], a2, b2)] : []; })()].filter((f) => f.angles.reduce((s, g) => s + g.value, 0) === 180),
    explain: [[`${v[0]}${v[1]} = ${v[0]}${v[2]} 이므로 ∠${v[1]} = ∠${v[2]} 이다.`, "Equal sides give equal base angles."], [`∠${v[1]} = x 라 하면 ∠${v[0]} = ${apexMul}x 이다.`, "Let the base angle be x."], [`${apexMul}x + x + x = 180 에서 x = ${base} 이다.`, "The angles add to 180°."], [`밑각 ${base}°, 꼭지각 ${apex}° 이다.`, "The angles."], [`꼭지각 ${apex}°, 밑각 ${base}°·${base}° 이고 눈금이 ${v[0]}${v[1]}, ${v[0]}${v[2]} 에 붙은 그림을 고른다.`, "Pick the matching isosceles figure."]] };
}
function diffRel(rng: Rng): Scene {
  const v = pickNames(rng); const d = rng.pick([9, 12, 15, 18, 24, 30]); const apex = (180 - 2 * d) / 3; if (!Number.isInteger(apex) || apex < 24) throw new GenFail("정수"); const base = apex + d; const n = nm(v);
  return { v, apex, base, P: { v: [...v], d }, pred: `${PRED_BASE}a[N[1]]-a[N[0]]===P.d;`,
    text: rng.pick([`Triangle $${n}$ has $${v[0]}${v[1]} = ${v[0]}${v[2]}$, and the measure of angle $${v[1]}$ is ${d}° more than the measure of angle $${v[0]}$.`, `In triangle $${n}$, sides $${v[0]}${v[1]}$ and $${v[0]}${v[2]}$ are equal, and angle $${v[1]}$ is ${d}° larger than angle $${v[0]}$.`]),
    spec: `${SPEC_BASE}if (c.kind==='isosceles' && a[N[0]]-a[N[1]]===P.d) return 'difference_reversed';`, extra: [...commonCands(v, apex, base), ...(base - d >= 24 ? [isoFig(v[0], [v[1], v[2]], base + d, (180 - base - d) / 2)] : [])].filter((f) => f.angles.reduce((s, g) => s + g.value, 0) === 180 && f.angles.every((g) => Number.isInteger(g.value))),
    explain: [[`${v[0]}${v[1]} = ${v[0]}${v[2]} 이므로 ∠${v[1]} = ∠${v[2]} 이다.`, "Equal sides give equal base angles."], [`∠${v[0]} = x 라 하면 ∠${v[1]} = x + ${d} 이다.`, "Let the vertex angle be x."], [`x + 2(x + ${d}) = 180 에서 x = ${apex} 이다.`, "The angles add to 180°."], [`꼭지각 ${apex}°, 밑각 ${base}° 이다.`, "The angles."], [`꼭지각 ${apex}°, 밑각 ${base}°·${base}° 이고 눈금이 ${v[0]}${v[1]}, ${v[0]}${v[2]} 에 붙은 그림을 고른다.`, "Pick the matching isosceles figure."]] };
}
function sumRel(rng: Rng): Scene {
  const v = pickNames(rng); const base = rng.int(40, 75); const apex = 180 - 2 * base; if (apex < 30 || apex === base) throw new GenFail("범위"); const s = apex + base; const n = nm(v);
  return { v, apex, base, P: { v: [...v], s }, pred: `${PRED_BASE}a[N[0]]+a[N[1]]===P.s;`,
    text: rng.pick([`Triangle $${n}$ has $${v[0]}${v[1]} = ${v[0]}${v[2]}$, and the measures of angles $${v[0]}$ and $${v[1]}$ add up to ${s}°.`, `In triangle $${n}$, sides $${v[0]}${v[1]}$ and $${v[0]}${v[2]}$ are equal. The sum of the measures of angles $${v[0]}$ and $${v[1]}$ is ${s}°.`]),
    spec: SPEC_BASE, extra: commonCands(v, apex, base).concat([isoFig(v[0], [v[1], v[2]], s / 2 > 100 ? apex : s / 2, s / 2 > 100 ? base : (180 - s / 2) / 2)]).filter((f) => f.angles.every((g) => Number.isInteger(g.value))),
    explain: [[`${v[0]}${v[1]} = ${v[0]}${v[2]} 이므로 ∠${v[1]} = ∠${v[2]} 이다.`, "Equal sides give equal base angles."], [`세 각의 합 180° 에서 ∠${v[2]} = ∠${v[1]} 를 쓰면 ∠${v[0]} + ∠${v[1]} + ∠${v[1]} = 180° 이다.`, "The three angles add to 180°."], [`∠${v[0]} + ∠${v[1]} = ${s}° 이므로 ∠${v[1]} = 180° - ${s}° = ${base}° 이다.`, "Subtract the given sum."], [`∠${v[0]} = ${s}° - ${base}° = ${apex}° 이다.`, "Then find the vertex angle."], [`꼭지각 ${apex}°, 밑각 ${base}°·${base}° 이고 눈금이 ${v[0]}${v[1]}, ${v[0]}${v[2]} 에 붙은 그림을 고른다.`, "Pick the matching isosceles figure."]] };
}
function build(rng: Rng, s: Scene, variant: string) {
  const ok = okFig(s); const diag = diagBody(`${s.spec}if (c.kind==='isosceles' && c.vertices[0]===N[0]) return 'iso_other'; `);
  let r; try { r = triChoices(rng, ok, s.extra.filter((f) => f.kind === 'isosceles'), s.P, s.pred, diag); } catch (e) { if (!(e instanceof GenFail)) throw e; r = triChoices(rng, ok, s.extra, s.P, s.pred, diag); }
  const { choices, correctIndex, rules } = r;
  return guard(choiceInst(rng, { stimulus: LEAD[rng.int(0, LEAD.length - 1)] + s.text, question: Q(rng, nm(s.v)), choices, correctIndex, rules, P: s.P as Record<string, string | number>, predicateJs: `${M_JS}${s.pred}`, diagnoseJs: diag, trace: s.explain, variant, explainKo: "", explainEn: "" }));
}
const one = (f: (rng: Rng) => Scene, variant: string) => (rng: Rng) => { let last = ""; for (let i = 0; i < 40; i++) { try { return build(rng, f(rng), variant); } catch (e) { if (!(e instanceof GenFail)) throw e; last = (e as Error).message; } } throw new GenFail("이등변삼각형 선택지 표집 실패: " + last); };

export const ITEM = defineItem({
  prefix: "lat", itemId: "lines_angles_triangles.isosceles_base_angle.TR.C",
  hard: [
    { op: "compose_kind", sprNo: SPR_NO_TRI, structure: "AB = AC 와 꼭지각이 주어진 이등변삼각형에서 밑각이 같다는 사실과 합 180° 로 밑각을 구해 눈금·각 라벨이 맞는 그림을 4개 중에서 고름", extra: "같은 변의 눈금 위치(꼭지점)와 밑각 계산을 함께 확인해야 함(눈금이 다른 꼭짓점에 붙거나 꼭지각을 밑각으로 읽으면 오답) — medium 은 밑각이 주어짐", concepts: ["이등변삼각형", "밑각", "그림 비교"], gen: one(apexGiven, "figure_from_vertex_angle") },
    { op: "chain2", sprNo: SPR_NO_TRI, structure: "AB = AC 이고 꼭지각이 밑각의 몇 배(또는 몇 분의 일)인지를 주어 밑각 x 를 구한 뒤 꼭지각을 구해 맞는 그림을 고름", extra: "배수 관계 → x → 꼭지각 의 연쇄(배수 방향을 거꾸로 읽으면 오답) — medium 은 밑각이 주어짐", concepts: ["이등변삼각형", "비", "그림 비교"], gen: one(ratioRel, "figure_from_ratio_of_angles") },
    { op: "repr_shift", sprNo: SPR_NO_TRI, structure: "AB = AC 이고 밑각이 꼭지각보다 d° 크다는 말을 x + 2(x + d) = 180 으로 옮겨 풀어 맞는 그림을 고름", extra: "차이 문장을 식으로 번역해 꼭지각을 구해야 함(차이를 반대로 읽으면 오답) — medium 은 밑각이 주어짐", concepts: ["이등변삼각형", "일차방정식", "그림 비교"], gen: one(diffRel, "figure_from_angle_difference") },
    { op: "inverse", sprNo: SPR_NO_TRI, structure: "AB = AC 이고 꼭지각과 밑각 하나의 합이 s° 로 주어질 때 합 180° 에서 거꾸로 밑각을 구해 맞는 그림을 고름", extra: "합 조건과 180° 를 함께 써서 밑각 = 180° − s 를 거꾸로 얻어야 함 — medium 은 밑각이 주어짐", concepts: ["이등변삼각형", "삼각형 내각의 합", "그림 비교"], gen: one(sumRel, "figure_from_angle_sum") },
  ],
  em: [
    { lv: "easy", name: "vertex_angle_given", sprNo: SPR_NO_TRI, structure: "AB = AC 이고 꼭지각이 주어진 이등변삼각형의 밑각을 구해 맞는 그림을 고름", extra: "easy: 합 180° 와 반으로 나누기", concepts: ["이등변삼각형", "그림 비교"], gen: one(apexGiven, "figure_from_vertex_angle_easy") },
    { lv: "medium", name: "base_angle_given", sprNo: SPR_NO_TRI, structure: "AB = AC 이고 밑각이 주어진 이등변삼각형의 꼭지각을 구해 맞는 그림을 고름", extra: "medium: 밑각이 둘이라는 사실과 합 180°", concepts: ["이등변삼각형", "밑각", "그림 비교"], gen: one(baseGiven, "figure_from_base_angle") },
  ],
});
