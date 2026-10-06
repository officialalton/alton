// area_volume.rectangle_area.PG.C — 지문의 조건(넓이·둘레·비·한 변)을 만족하는 직사각형 그림(변 라벨 숫자)을 4개 중에서 고른다.
// 오답 규칙: perimeter_for_area·sum_for_area(넓이 자리에 둘레·합을 씀)·ratio_swapped·side_swapped(두 변을 맞바꿈)·fails_area·fails_perimeter·fails_ratio·fails_side(조건 하나만 어김).
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { choiceInst } from "../../tvd-fig-choice";
import { defineItem } from "../item-kit";
import { guard } from "../geo-kit";
import { retry } from "../ext-kit";
import { PG_LEAD, UNITS, pickChoices, quadNames, rectFig, type PolyFig } from "../pg-kit";

const SPR_NO_PG = "정답이 직사각형 그림 4개 중 조건을 만족하는 그림을 고르는 것이 문제의 핵심이라 선택지 없이는 성립하지 않는다";
const LAB = "const lbl=(c,i)=>{ const q=c.sideLabels.find(s=>s.between[0]===c.vertices[i]&&s.between[1]===c.vertices[i+1]); if(!q) throw new Error('변 라벨 없음'); const n=Number(q.label); if(!(n>0)) throw new Error('변 라벨 오류'); return n; };";
const COND = "const L=lbl(c,0), Wd=lbl(c,1); const ar=L*Wd; const areaOk=P.A===undefined||ar===P.A; const perOk=P.Pm===undefined||2*(L+Wd)===P.Pm; const kOk=P.k===undefined||L===P.k*Wd; const aOk=P.a===undefined||L===P.a;";
const PRED = `${LAB}${COND} return areaOk&&perOk&&kOk&&aOk;`;
const DIAG = `${LAB}${COND} if (P.k!==undefined&&!kOk&&Wd===P.k*L) return 'ratio_swapped'; if (P.a!==undefined&&!aOk&&Wd===P.a&&areaOk) return 'side_swapped'; if (P.A!==undefined&&!areaOk&&P.k===undefined&&P.Pm===undefined&&P.a===undefined){ if (2*(L+Wd)===P.A) return 'perimeter_for_area'; if (L+Wd===P.A) return 'sum_for_area'; } if (P.Pm!==undefined&&P.A===undefined&&!perOk){ if (ar===P.Pm) return 'area_for_perimeter'; if (L+Wd===P.Pm) return 'sum_for_perimeter'; } const f=[!areaOk&&'area',!perOk&&'perimeter',!kOk&&'ratio',!aOk&&'side'].filter(Boolean); return f.length?'fails_'+f.join('_'):null;`;
const R = (v: string[], L: number, Wd: number): PolyFig => rectFig(v, String(L), String(Wd));
const okDim = (L: number, Wd: number) => L >= 3 && Wd >= 3 && L <= 32 && Wd <= 32 && L !== Wd && Math.max(L, Wd) / Math.min(L, Wd) <= 4;
function factorPairs(A: number): [number, number][] { const out: [number, number][] = []; for (let a = 3; a <= 32; a++) if (A % a === 0) { const b = A / a; if (okDim(a, b)) out.push([a, b]); } return out; }
const Q = (rng: Rng, n: string) => rng.pick([`Which of the following figures shows rectangle $${n}$?`, `Which figure shows the rectangle described?`, `Which of the figures matches the description of rectangle $${n}$?`, `Which figure shows rectangle $${n}$ with its side lengths labeled?`, `Which figure gives the side lengths of rectangle $${n}$?`]);
type Scene = { v: string[]; L: number; Wd: number; P: Record<string, number | string | string[]>; text: string; cands: [number, number][]; explain: [string, string][] };
const around = (L: number, Wd: number): [number, number][] => { const o: [number, number][] = []; for (const d of [1, 2, 3, 4, 6]) { o.push([L + d, Wd], [L, Wd + d], [L - d, Wd], [L, Wd - d], [L + d, Wd - d], [L - d, Wd + d]); } return o; };

function areaScene(rng: Rng): Scene {
  const v = quadNames(rng); const L = rng.int(5, 18), Wd = rng.int(4, 14); if (!okDim(L, Wd)) throw new GenFail("범위"); const A = L * Wd; const n = v.join("");
  const cands: [number, number][] = [...around(L, Wd)]; if (A % 2 === 0) for (let a = 3; a < A / 2 - 2; a++) cands.push([Math.max(a, A / 2 - a), Math.min(a, A / 2 - a)]); for (let a = 3; a < A - 2 && a <= 32; a++) { const b = A - a; if (b >= 3 && b <= 32) cands.push([Math.max(a, b), Math.min(a, b)]); }
  return { v, L, Wd, P: { A }, cands, text: rng.pick([`Rectangle $${n}$ has an area of ${A}.`, `The area of rectangle $${n}$ is ${A}.`, `A rectangle $${n}$ has area ${A}.`]),
    explain: [[`넓이 ${A} 인 그림을 찾는다. 각 그림의 두 변을 곱한다.`, "Multiply the two labeled sides of each figure."], [`곱이 ${A} 인 것은 ${L} × ${Wd} 이다.`, "Only one product equals the area."], [`${L}+${Wd}, ${2 * (L + Wd)} 처럼 합이나 둘레는 넓이가 아니다.`, "A sum or a perimeter is not the area."], [`변이 ${L}, ${Wd} 인 그림이 맞다.`, "Identify the figure."], [`그 그림을 고른다.`, "Pick it."]] };
}
function perAreaScene(rng: Rng): Scene {
  const v = quadNames(rng); const L = rng.int(6, 20), Wd = rng.int(4, 14); if (!okDim(L, Wd)) throw new GenFail("범위"); const A = L * Wd, Pm = 2 * (L + Wd); const n = v.join("");
  const cands: [number, number][] = [...around(L, Wd), ...factorPairs(A)]; for (let a = 3; a < Pm / 2 - 2; a++) cands.push([Math.max(a, Pm / 2 - a), Math.min(a, Pm / 2 - a)]);
  return { v, L, Wd, P: { A, Pm }, cands, text: rng.pick([`Rectangle $${n}$ has a perimeter of ${Pm} and an area of ${A}.`, `The perimeter of rectangle $${n}$ is ${Pm}, and its area is ${A}.`]),
    explain: [[`둘레 ${Pm} 와 넓이 ${A} 를 모두 만족해야 한다.`, "Both conditions must hold."], [`반둘레 = ${Pm / 2} 이므로 두 변의 합이 ${Pm / 2} 이다.`, "The two sides add to half the perimeter."], [`합이 ${Pm / 2}, 곱이 ${A} 인 두 수는 ${L} 과 ${Wd} 이다.`, "Find the pair with the given sum and product."], [`한 조건만 만족하는 그림(같은 둘레 또는 같은 넓이)은 제외한다.`, "Rule out figures that satisfy only one condition."], [`변이 ${L}, ${Wd} 인 그림을 고른다.`, "Pick that figure."]] };
}
function ratioScene(rng: Rng): Scene {
  const v = quadNames(rng); const k = rng.pick([2, 3]); const Wd = rng.int(3, 9), L = k * Wd; if (!okDim(L, Wd)) throw new GenFail("범위"); const A = L * Wd; const n = v.join("");
  const cands: [number, number][] = [[Wd, L], ...around(L, Wd), ...factorPairs(A)]; for (const kk of [2, 3, 4]) for (let w = 3; w <= 12; w++) cands.push([kk * w, w]);
  return { v, L, Wd, P: { A, k }, cands, text: rng.pick([`In rectangle $${n}$, side $${v[0]}${v[1]}$ is ${k === 2 ? "twice" : "three times"} as long as side $${v[1]}${v[2]}$, and the area is ${A}.`, `Rectangle $${n}$ has area ${A}, and $${v[0]}${v[1]}$ is ${k} times $${v[1]}${v[2]}$.`]),
    explain: [[`${v[0]}${v[1]} = ${k} × ${v[1]}${v[2]} 이고 넓이가 ${A} 이다.`, "Read the two conditions."], [`${v[1]}${v[2]} = x 라 하면 ${k}x · x = ${A} 이다.`, "Let the short side be x."], [`x² = ${A / k} 이므로 x = ${Wd} 이다.`, "Solve for x."], [`${v[0]}${v[1]} = ${L}, ${v[1]}${v[2]} = ${Wd} 이다.`, "The sides."], [`두 변을 맞바꾼 그림이나 넓이가 다른 그림은 제외하고 고른다.`, "Reject the swapped and wrong-area figures."]] };
}
function sideScene(rng: Rng): Scene {
  const v = quadNames(rng); const L = rng.int(5, 20), Wd = rng.int(3, 14); if (!okDim(L, Wd)) throw new GenFail("범위"); const A = L * Wd; const n = v.join("");
  const cands: [number, number][] = [[Wd, L], ...around(L, Wd), ...factorPairs(A)];
  return { v, L, Wd, P: { A, a: L }, cands, text: rng.pick([`Rectangle $${n}$ has area ${A}, and $${v[0]}${v[1]} = ${L}$.`, `In rectangle $${n}$, $${v[0]}${v[1]}$ is ${L} and the area is ${A}.`]),
    explain: [[`${v[0]}${v[1]} = ${L} 이고 넓이가 ${A} 이다.`, "Read the two conditions."], [`${v[1]}${v[2]} = ${A} ÷ ${L} = ${Wd} 이다.`, "Divide the area by the known side."], [`그림에서 ${v[0]}${v[1]} 는 가로(아래) 변이다.`, "AB is the bottom side of the figure."], [`${v[0]}${v[1]} = ${L}, ${v[1]}${v[2]} = ${Wd} 인 그림을 찾는다.`, "Match both labels."], [`변을 맞바꾼 그림은 제외한다.`, "Reject the swapped figure."]] };
}
function medScene(rng: Rng): Scene {
  const v = quadNames(rng); const L = rng.int(6, 18), Wd = rng.int(5, 14); if (!okDim(L, Wd)) throw new GenFail("범위"); const n = v.join(""); const Pm = 2 * (L + Wd);
  const cands: [number, number][] = [...around(L, Wd), ...factorPairs(Pm)]; for (let a = 3; a < Pm - 2 && a <= 32; a++) { const b = Pm - a; if (b >= 3 && b <= 32) cands.push([Math.max(a, b), Math.min(a, b)]); }
  return { v, L, Wd, P: { Pm }, cands, text: `Rectangle $${n}$ has a perimeter of ${Pm}${""}.`, explain: [[`둘레 ${Pm} 이므로 두 변의 합은 ${Pm / 2} 이다.`, "Half the perimeter is the sum of two sides."], [`합이 ${Pm / 2} 인 그림은 변이 ${L}, ${Wd} 인 것이다.`, "Find the labeled pair with that sum."], [`그 그림을 고른다.`, "Pick it."]] };
}
function build(rng: Rng, s: Scene, variant: string) {
  const ok = R(s.v, s.L, s.Wd); const cands = s.cands.filter(([a, b]) => okDim(a, b) && Number.isInteger(a) && Number.isInteger(b)).map(([a, b]) => R(s.v, a, b));
  const pc = pickChoices(rng, ok, cands, s.P, PRED, DIAG); const { correctIndex, rules } = pc;
  // 네 그림을 같은 축척(가장 큰 변이 틀에 들어가는 단위당 길이)으로 그려 변의 길이를 눈으로 비교할 수 있게 한다.
  const all = pc.choices as PolyFig[]; const maxA = Math.max(...all.map((f) => Number(f.sideLabels![0].label))), maxB = Math.max(...all.map((f) => Number(f.sideLabels![1].label))); const px = Math.round(Math.min(220 / maxA, 170 / maxB) * 100) / 100;
  const minPx = Math.min(...all.flatMap((f) => [Number(f.sideLabels![0].label), Number(f.sideLabels![1].label)])) * px; if (minPx < 40) throw new GenFail("가장 작은 변이 너무 짧게 그려짐");
  const choices = all.map((f) => ({ ...f, pxPerUnit: px }));
  return guard(choiceInst(rng, { stimulus: `${rng.pick(PG_LEAD)}${s.text} ${rng.pick(UNITS)}`.trim().replace(/ {2,}/g, " "), question: Q(rng, s.v.join("")), choices, correctIndex, rules, P: s.P, predicateJs: PRED, diagnoseJs: DIAG, trace: s.explain, variant, explainKo: "", explainEn: "" }));
}
const one = (f: (rng: Rng) => Scene, variant: string) => (rng: Rng) => retry(rng, () => build(rng, f(rng), variant), 40);

export const ITEM = defineItem({
  prefix: "av", itemId: "area_volume.rectangle_area.PG.C",
  hard: [
    { op: "compose_kind", sprNo: SPR_NO_PG, structure: "넓이가 주어진 직사각형을 4개 그림 중에서 고름(오답은 둘레·합을 넓이로 착각한 그림 등)", extra: "각 그림의 두 변을 곱해 넓이와 비교해야 함(합이나 둘레가 넓이와 같은 그림이 함정) — medium 은 둘레", concepts: ["직사각형의 넓이", "둘레와 넓이 구분", "그림 비교"], gen: one(areaScene, "figure_from_area") },
    { op: "chain2", sprNo: SPR_NO_PG, structure: "둘레와 넓이가 모두 주어진 직사각형을 고름(두 변의 합과 곱을 함께 만족하는 쌍)", extra: "반둘레 = 두 변의 합 과 넓이 = 곱 을 함께 확인해야 함(한 조건만 만족하는 그림이 함정) — medium 은 둘레", concepts: ["직사각형의 넓이", "둘레", "연립 조건"], gen: one(perAreaScene, "figure_from_perimeter_and_area") },
    { op: "repr_shift", sprNo: SPR_NO_PG, structure: "'AB 가 BC 의 k 배'와 넓이가 주어진 직사각형을 고름(비를 식으로 옮겨 변을 구함)", extra: "k 배 관계를 방향까지 맞게 식으로 옮겨 변을 구해야 함(두 변을 맞바꾸면 오답) — medium 은 둘레", concepts: ["직사각형의 넓이", "비", "그림 비교"], gen: one(ratioScene, "figure_from_ratio_and_area") },
    { op: "inverse", sprNo: SPR_NO_PG, structure: "한 변과 넓이가 주어진 직사각형을 고름(다른 변을 거꾸로 구해 AB·BC 에 맞게 대응)", extra: "넓이 ÷ 한 변 으로 다른 변을 구하고 AB 가 어느 쪽인지 맞춰야 함(맞바꾼 그림이 함정) — medium 은 둘레", concepts: ["직사각형의 넓이", "역산", "그림 비교"], gen: one(sideScene, "figure_from_side_and_area") },
  ],
  em: [
    { lv: "easy", name: "area_given", sprNo: SPR_NO_PG, structure: "넓이가 주어진 직사각형을 4개 그림 중에서 고름", extra: "easy: 두 변의 곱", concepts: ["직사각형의 넓이", "그림 비교"], gen: one(areaScene, "figure_from_area_easy") },
    { lv: "medium", name: "perimeter_given", sprNo: SPR_NO_PG, structure: "둘레가 주어진 직사각형을 4개 그림 중에서 고름", extra: "medium: 반둘레와 두 변의 합 비교", concepts: ["둘레", "그림 비교"], gen: one(medScene, "figure_from_perimeter") },
  ],
});
