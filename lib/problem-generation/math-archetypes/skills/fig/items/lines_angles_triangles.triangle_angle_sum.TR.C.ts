// lines_angles_triangles.triangle_angle_sum.TR.C — 지문의 각 조건(각의 크기·차·비·배수)과 내각의 합 180°에서 셋째 각까지 정해지는 삼각형 그림을 4개 중에서 고른다.
// 오답 규칙: swap_AB·swap_AC·swap_BC(두 꼭짓점의 각을 맞바꿈)·rotate(세 각을 한 칸씩 돌림)·shift(두 각 사이로 일부를 옮김)·base_is_a/ratio_inverted(조건을 거꾸로 읽음).
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { choiceInst } from "../../tvd-fig-choice";
import { defineItem } from "../item-kit";
import { guard } from "../geo-kit";
import { pickNames, type Tri3 } from "../tri-kit";
import { M_JS, diagBody, genericTriCands, scaleneFig, triChoices, type TriFig } from "../trc-kit";

const SPR_NO_TRI = "정답이 삼각형 그림 4개 중 조건을 만족하는 그림을 고르는 것이 문제의 핵심이라 선택지 없이는 성립하지 않는다";
const Q = (rng: Rng, n: string) => rng.pick([`Which of the following figures shows triangle $${n}$?`, `Which figure shows triangle $${n}$ with all three angle measures labeled correctly?`, `Which of the figures correctly shows the angle measures of triangle $${n}$?`, `Which of the following figures matches the description of triangle $${n}$?`, `Which figure gives the three angle measures of triangle $${n}$?`]);
const LEAD = ["", "", "A student is drawing a triangle for a geometry assignment. ", "A teacher describes a triangle to the class. ", "A designer is planning a triangular logo. "];
type Scene = { v: Tri3; t: [number, number, number]; P: Record<string, number | string | string[]>; pred: string; text: string; spec?: string; extra?: TriFig[]; explain: [string, string][] };
const name = (v: Tri3) => v.join("");

function iso(rng: Rng): Scene {
  const v = pickNames(rng); const a = rng.pick([30, 36, 40, 44, 48, 52, 56, 64, 70, 76, 84, 90, 100, 110]); const b = (180 - a) / 2; if (!Number.isInteger(b)) throw new GenFail("홀수");
  const t: [number, number, number] = [a, b, b]; const n = name(v);
  return { v, t, P: { v: [...v], a }, pred: "const a=m(c); const N=P.v; return a[N[0]]===P.a && a[N[1]]===a[N[2]] && a[N[0]]+a[N[1]]+a[N[2]]===180;",
    text: rng.pick([`In triangle $${n}$, the measure of angle $${v[0]}$ is ${a}° and angles $${v[1]}$ and $${v[2]}$ have equal measures.`, `Triangle $${n}$ has an angle $${v[0]}$ of ${a}°, and the measures of angles $${v[1]}$ and $${v[2]}$ are equal.`, `In triangle $${n}$, angle $${v[1]}$ and angle $${v[2]}$ are equal in measure, and angle $${v[0]}$ measures ${a}°.`]),
    spec: "if (a[N[1]]===P.a && a[N[2]]===P.a) return 'base_is_a';", extra: a >= 30 && a <= 70 ? [scaleneFig(v, [180 - 2 * a, a, a])] : [],
    explain: [[`각 ${v[1]} 와 ${v[2]} 가 같고 ∠${v[0]} = ${a}° 이다.`, "Read the conditions."], [`두 각의 합 = 180° - ${a}° = ${180 - a}° 이다.`, "The other two angles share the remaining degrees."], [`각각 ${180 - a}° ÷ 2 = ${b}° 이다.`, "Equal angles: halve it."], [`각은 ${a}°, ${b}°, ${b}° 이다.`, "The three angles."], [`이 라벨을 가진 그림을 고른다.`, "Pick the matching figure."]] };
}
function diff(rng: Rng): Scene {
  const v = pickNames(rng); const a = rng.int(30, 100), d = rng.int(8, 30); if ((180 - a + d) % 2) throw new GenFail("홀수"); const B = (180 - a + d) / 2, C = B - d; if (B < 30 || C < 30 || B > 110) throw new GenFail("범위");
  const n = name(v); return { v, t: [a, B, C], P: { v: [...v], a, d }, pred: "const a=m(c); const N=P.v; return a[N[0]]===P.a && a[N[1]]-a[N[2]]===P.d && a[N[0]]+a[N[1]]+a[N[2]]===180;",
    text: rng.pick([`In triangle $${n}$, the measure of angle $${v[0]}$ is ${a}°, and angle $${v[1]}$ is ${d}° larger than angle $${v[2]}$.`, `Triangle $${n}$ has an angle $${v[0]}$ of ${a}°. The measure of angle $${v[1]}$ exceeds the measure of angle $${v[2]}$ by ${d}°.`, `In triangle $${n}$, angle $${v[0]}$ = ${a}° and angle $${v[1]}$ is ${d}° more than angle $${v[2]}$.`]),
    explain: [[`∠${v[0]} = ${a}° 이고 ∠${v[1]} = ∠${v[2]} + ${d}° 이다.`, "Read the conditions."], [`나머지 두 각의 합 = 180° - ${a}° = ${180 - a}° 이다.`, "The other two angles add to the rest."], [`작은 각 = (${180 - a} - ${d}) ÷ 2 = ${C}° 이다.`, "Subtract the difference, then halve."], [`큰 각 = ${C} + ${d} = ${B}° 이다.`, "Add the difference back."], [`각은 ${a}°, ${B}°, ${C}° 이다.`, "The three angles."]] };
}
function ratio(rng: Rng): Scene {
  const v = pickNames(rng); const set = rng.pick([[2, 3, 4], [3, 4, 5], [2, 3, 5], [4, 5, 6], [3, 5, 7], [1, 2, 3], [2, 4, 5], [3, 4, 8]]) as [number, number, number]; const s = set[0] + set[1] + set[2]; if (180 % s) throw new GenFail("비"); const k = 180 / s;
  const p = rng.shuffle([...set]) as [number, number, number]; const t = p.map((q) => q * k) as [number, number, number]; if (t.some((q) => q < 24 || q > 110) || new Set(t).size < 3) throw new GenFail("범위"); const n = name(v);
  return { v, t, P: { v: [...v], p: p[0], q: p[1], r: p[2] }, pred: "const a=m(c); const N=P.v; return a[N[0]]*P.q===a[N[1]]*P.p && a[N[1]]*P.r===a[N[2]]*P.q && a[N[0]]+a[N[1]]+a[N[2]]===180;",
    text: rng.pick([`The measures of the angles of triangle $${n}$ are in the ratio $${p.join(" : ")}$, in the order of angles $${v[0]}$, $${v[1]}$, $${v[2]}$.`, `In triangle $${n}$, the ratio of the measures of angle $${v[0]}$, angle $${v[1]}$, and angle $${v[2]}$ is $${p.join(" : ")}$.`, `The three angles $${v[0]}$, $${v[1]}$, and $${v[2]}$ of triangle $${n}$ have measures in the ratio $${p.join(" : ")}$.`]),
    explain: [[`비 ${p.join(" : ")} 이므로 각을 ${p[0]}k, ${p[1]}k, ${p[2]}k 로 놓는다.`, "Write the angles as multiples of k."], [`합 ${s}k = 180° 에서 k = ${k} 이다.`, "The angles add to 180°."], [`각은 ${t.join("°, ")}° 이다.`, "Multiply."], [`꼭짓점 순서대로 ∠${v[0]} = ${t[0]}°, ∠${v[1]} = ${t[1]}°, ∠${v[2]} = ${t[2]}° 이다.`, "Match to the vertices in order."], [`이 라벨을 가진 그림을 고른다.`, "Pick the matching figure."]] };
}
function cRatio(rng: Rng): Scene {
  const v = pickNames(rng); const k = rng.pick([2, 3, 4]); const c = rng.int(40, 110); if ((180 - c) % (k + 1)) throw new GenFail("정수"); const A = (180 - c) / (k + 1), B = k * A; if (A < 24 || B > 110) throw new GenFail("범위"); const n = name(v);
  const inv = (180 - c) / (k + 1); void inv;
  return { v, t: [A, B, c], P: { v: [...v], c, k }, pred: "const a=m(c); const N=P.v; return a[N[2]]===P.c && a[N[1]]===P.k*a[N[0]] && a[N[0]]+a[N[1]]+a[N[2]]===180;",
    text: rng.pick([`In triangle $${n}$, the measure of angle $${v[2]}$ is ${c}°, and angle $${v[1]}$ is ${k === 2 ? "twice" : k === 3 ? "three times" : "four times"} the measure of angle $${v[0]}$.`, `Triangle $${n}$ has an angle $${v[2]}$ of ${c}°. The measure of angle $${v[1]}$ is ${k} times the measure of angle $${v[0]}$.`, `In triangle $${n}$, angle $${v[2]}$ = ${c}° and angle $${v[1]}$ measures ${k} times angle $${v[0]}$.`]),
    spec: "if (a[N[0]]===P.k*a[N[1]]) return 'ratio_inverted';", extra: [scaleneFig(v, [k * A, A, c])].filter(() => k * A <= 110),
    explain: [[`∠${v[2]} = ${c}° 이고 ∠${v[1]} = ${k}·∠${v[0]} 이다.`, "Read the conditions."], [`∠${v[0]} = x 라 하면 x + ${k}x + ${c} = 180 이다.`, "Let the smaller angle be x."], [`${k + 1}x = ${180 - c} 에서 x = ${A} 이다.`, "Solve for x."], [`∠${v[0]} = ${A}°, ∠${v[1]} = ${B}°, ∠${v[2]} = ${c}° 이다.`, "The three angles."], [`이 라벨을 가진 그림을 고른다.`, "Pick the matching figure."]] };
}
function ab(rng: Rng): Scene {
  const v = pickNames(rng); const a = rng.int(30, 100), b = rng.int(30, 100); const c = 180 - a - b; if (c < 24 || c > 110 || new Set([a, b, c]).size < 3) throw new GenFail("범위"); const n = name(v);
  return { v, t: [a, b, c], P: { v: [...v], a, b }, pred: "const a=m(c); const N=P.v; return a[N[0]]===P.a && a[N[1]]===P.b && a[N[0]]+a[N[1]]+a[N[2]]===180;",
    text: rng.pick([`In triangle $${n}$, the measure of angle $${v[0]}$ is ${a}° and the measure of angle $${v[1]}$ is ${b}°.`, `Triangle $${n}$ has angle $${v[0]}$ = ${a}° and angle $${v[1]}$ = ${b}°.`, `Two angles of triangle $${n}$ are angle $${v[0]}$ = ${a}° and angle $${v[1]}$ = ${b}°.`]),
    explain: [[`∠${v[0]} = ${a}° 이고 ∠${v[1]} = ${b}° 이다.`, "Read the two given angles."], [`∠${v[2]} = 180° - ${a}° - ${b}° = ${c}° 이다.`, "The third angle makes 180°."]] };
}
function chainAB(rng: Rng): Scene {
  const v = pickNames(rng); const a = rng.int(30, 90), d = rng.int(8, 40); const b = a + d; const c = 180 - a - b; if (c < 24 || b > 110 || c > 110 || new Set([a, b, c]).size < 3) throw new GenFail("범위"); const n = name(v);
  return { v, t: [a, b, c], P: { v: [...v], a, d }, pred: "const a=m(c); const N=P.v; return a[N[0]]===P.a && a[N[1]]-a[N[0]]===P.d && a[N[0]]+a[N[1]]+a[N[2]]===180;",
    text: rng.pick([`In triangle $${n}$, the measure of angle $${v[0]}$ is ${a}°, and angle $${v[1]}$ is ${d}° larger than angle $${v[0]}$.`, `Triangle $${n}$ has angle $${v[0]}$ = ${a}°, and angle $${v[1]}$ measures ${d}° more than angle $${v[0]}$.`, `In triangle $${n}$, angle $${v[0]}$ measures ${a}° and the measure of angle $${v[1]}$ is ${d}° greater than that of angle $${v[0]}$.`]),
    explain: [[`∠${v[0]} = ${a}° 이고 ∠${v[1]} = ∠${v[0]} + ${d}° 이다.`, "Read the conditions."], [`∠${v[1]} = ${a}° + ${d}° = ${b}° 이다.`, "Add the difference."], [`∠${v[2]} = 180° - ${a}° - ${b}° = ${c}° 이다.`, "The third angle makes 180°."], [`각은 ${a}°, ${b}°, ${c}° 이다.`, "The three angles."], [`이 라벨을 가진 그림을 고른다.`, "Pick the matching figure."]] };
}
function build(rng: Rng, s: Scene, variant: string) {
  const ok = scaleneFig(s.v, s.t); const cands = [...genericTriCands(s.v, s.t), ...(s.extra ?? [])]; const diag = diagBody(s.spec ?? "");
  const { choices, correctIndex, rules } = triChoices(rng, ok, cands, s.P, s.pred, diag);
  return guard(choiceInst(rng, { stimulus: LEAD[rng.int(0, LEAD.length - 1)] + s.text, question: Q(rng, name(s.v)), choices, correctIndex, rules, P: s.P, predicateJs: `${M_JS}${s.pred}`, diagnoseJs: diag, trace: s.explain, variant, explainKo: "", explainEn: "" }));
}
const one = (f: (rng: Rng) => Scene, variant: string) => (rng: Rng) => { for (let i = 0; i < 40; i++) { try { return build(rng, f(rng), variant); } catch (e) { if (!(e instanceof GenFail)) throw e; } } throw new GenFail("삼각형 선택지 표집 실패"); };

export const ITEM = defineItem({
  prefix: "lat", itemId: "lines_angles_triangles.triangle_angle_sum.TR.C",
  hard: [
    { op: "compose_kind", sprNo: SPR_NO_TRI, structure: "한 각의 크기와 나머지 두 각의 차를 말로 주고 합 180° 와 차로 두 각을 구해 맞는 삼각형 그림을 4개 중에서 고름", extra: "합에서 차를 빼 반으로 나누는 두 단계로 두 각을 구해야 함(두 각을 같다고 놓거나 꼭짓점 자리를 바꾸면 오답) — medium 은 두 각이 같음", concepts: ["삼각형 내각의 합", "연립 조건", "그림 비교"], gen: one(diff, "figure_from_angle_difference") },
    { op: "chain2", sprNo: SPR_NO_TRI, structure: "한 각과 둘째 각이 첫 각보다 몇 도 큰지를 주어 둘째 각을 구한 뒤 합 180° 로 셋째 각을 구해 맞는 삼각형 그림을 고름", extra: "둘째 각 → 셋째 각의 연쇄(꼭짓점 순서를 바꾸면 오답) — medium 은 두 각이 직접 주어짐", concepts: ["삼각형 내각의 합", "각의 비교", "그림 비교"], gen: one(chainAB, "figure_from_chained_angles") },
    { op: "repr_shift", sprNo: SPR_NO_TRI, structure: "세 각의 비 p : q : r 를 주어 각을 pk, qk, rk 로 번역하고 합 180° 로 k 를 구해 꼭짓점 순서에 맞는 그림을 고름", extra: "비를 식으로 옮겨 k 를 구하고 순서대로 대응시켜야 함(순서를 바꾸면 오답) — medium 은 두 각이 직접 주어짐", concepts: ["비", "삼각형 내각의 합", "그림 비교"], gen: one(ratio, "figure_from_angle_ratio") },
    { op: "inverse", sprNo: SPR_NO_TRI, structure: "한 각과 '다른 각이 또 다른 각의 k 배'를 주어 합 180° 에서 작은 각을 역산한 뒤 맞는 삼각형 그림을 고름", extra: "x + kx + c = 180 으로 거꾸로 x 를 구해야 함(배수 방향을 거꾸로 읽으면 오답) — medium 은 두 각이 직접 주어짐", concepts: ["삼각형 내각의 합", "일차방정식", "그림 비교"], gen: one(cRatio, "figure_from_multiple_relation") },
  ],
  em: [
    { lv: "easy", name: "two_angles_given", sprNo: SPR_NO_TRI, structure: "두 각의 크기를 주고 셋째 각을 합 180° 로 구해 맞는 삼각형 그림을 고름", extra: "easy: 합 180° 한 번 적용", concepts: ["삼각형 내각의 합", "그림 비교"], gen: one(ab, "figure_from_two_angles") },
    { lv: "medium", name: "equal_angles", sprNo: SPR_NO_TRI, structure: "한 각과 나머지 두 각이 같다는 조건에서 각을 구해 맞는 삼각형 그림을 고름", extra: "medium: 합 180° 와 같은 각 조건", concepts: ["삼각형 내각의 합", "같은 각", "그림 비교"], gen: one(iso, "figure_from_equal_angles") },
  ],
});
