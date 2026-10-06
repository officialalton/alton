// lines_angles_triangles.similar_triangles.TR.P — 닮은 두 삼각형(ABC ~ DEF) 그림의 변 라벨에서 닮음비로 대응변·둘레·x 를 구한다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { NUM_JS, anglesFromSides, geoInst, lead, pickN, shapeOk } from "../geo-kit";
import type { Rng } from "../../../rng";

const SHAPES: [number, number, number][] = [[4, 5, 6], [3, 4, 6], [5, 6, 8], [4, 6, 7], [5, 7, 9], [6, 7, 8], [3, 5, 7], [5, 5, 8], [5, 6, 7], [4, 5, 7], [7, 8, 9], [5, 8, 9]];
/** 닮음비 k1 : k2 (둘째/첫째 = 0.4~1.6, 서로소). */
const RATIOS: [number, number][] = [[2, 3], [3, 2], [3, 4], [4, 3], [4, 5], [5, 4], [5, 6], [2, 5], [5, 3], [3, 5], [5, 7], [7, 5]];
const PARSE_LIN_JS = "const lin=(l)=>{ const t=String(l).replace(/\\s/g,'').replace(/−/g,'-'); let m=/^(\\d*)x([+-]\\d+)?$/.exec(t); if (m) return {a:m[1]===''?1:Number(m[1]), b:m[2]?Number(m[2]):0}; m=/^(\\d+(?:\\.\\d+)?)$/.exec(t); if (m) return {a:0,b:Number(m[1])}; throw new Error('변 라벨 형식 오류: '+l); };\n";
const SIM_JS = `${NUM_JS}${PARSE_LIN_JS}const T1=FIGURE, T2=FIGURE.second; const V=T1.vertices, U=T2.vertices; const sl=(T,a,b)=>{ const s=T.sides.find(q=>(q.between[0]===a&&q.between[1]===b)||(q.between[0]===b&&q.between[1]===a)); return s?s.label:undefined; }; const pairs=[[0,1],[1,2],[0,2]]; const L1=pairs.map(([i,j])=>sl(T1,V[i],V[j])), L2=pairs.map(([i,j])=>sl(T2,U[i],U[j]));\n`;

type Sim = { n1: string[]; n2: string[]; k1: number; k2: number; s: [number, number, number]; s1: [number, number, number]; s2: [number, number, number]; scale: number };
/** 세 변 s=(AB,BC,AC) 의 비. s1 = k1·s, s2 = k2·s. */
function makeSim(rng: Rng): Sim {
  for (let tr = 0; tr < 200; tr++) {
    const sh = rng.shuffle(SHAPES[rng.int(0, SHAPES.length - 1)]) as [number, number, number]; const [k1, k2] = rng.pick(RATIOS); const m = rng.pick([1, 1, 2]);
    const s1 = sh.map((q) => q * k1 * m) as [number, number, number], s2 = sh.map((q) => q * k2 * m) as [number, number, number];
    if (Math.max(...s1, ...s2) > 60 || !shapeOk(sh[0], sh[1], sh[2])) continue;
    const nm = rng.shuffle(pickN(rng, 6)); return { n1: nm.slice(0, 3).sort(), n2: nm.slice(3).sort(), k1: k1 * m, k2: k2 * m, s: sh, s1, s2, scale: k2 / k1 };
  }
  throw new GenFail("닮은 삼각형 표집 실패");
}
/** 닮은 두 삼각형 그림. 라벨은 변 이름 순서 [v0v1, v1v2, v0v2]; null 이면 라벨 없음. */
function simFig(t: Sim, l1: (string | null)[], l2: (string | null)[]) {
  const ang = anglesFromSides(t.s[0], t.s[1], t.s[2]); const [a, b] = [t.n1, t.n2];
  const sides = (v: string[], l: (string | null)[]) => ([[0, 1], [1, 2], [0, 2]] as [number, number][]).map(([i, j], k) => ({ between: [v[i], v[j]] as [string, string], ...(l[k] !== null ? { label: l[k]! } : {}) })).filter((q) => "label" in q);
  const angs = (v: string[]) => v.map((n, i) => ({ at: n, arc: false, value: ang[i] }));
  return { type: "triangle", vertices: a, kind: "scalene", sides: sides(a, l1), angles: angs(a), second: { vertices: b, kind: "scalene", sides: sides(b, l2), angles: angs(b), scale: Math.round(t.scale * 100) / 100 } };
}
const PAIRS: [number, number][] = [[0, 1], [1, 2], [0, 2]];
const pn = (v: string[], k: number) => `${v[PAIRS[k][0]]}${v[PAIRS[k][1]]}`;
const intro = (rng: Rng, t: Sim) => `${lead(rng)}${rng.pick([`Triangle $${t.n1.join("")}$ is similar to triangle $${t.n2.join("")}$, where $${t.n1[0]}$, $${t.n1[1]}$, and $${t.n1[2]}$ correspond to $${t.n2[0]}$, $${t.n2[1]}$, and $${t.n2[2]}$, respectively. Some side lengths are shown in the figure.`, `The two triangles in the figure are similar, with triangle $${t.n1.join("")}$ corresponding to triangle $${t.n2.join("")}$ in the order of the vertices. Side lengths are marked in the figure shown.`, `In the figure shown, triangle $${t.n1.join("")}$ ~ triangle $${t.n2.join("")}$, with vertices matched in order. Several side lengths are labeled.`, `Triangles $${t.n1.join("")}$ and $${t.n2.join("")}$ in the figure are similar: vertex $${t.n1[0]}$ matches vertex $${t.n2[0]}$, $${t.n1[1]}$ matches $${t.n2[1]}$, and $${t.n1[2]}$ matches $${t.n2[2]}$. The figure shows some of the side lengths.`])}`;
const rd = (t: Sim): [string, string] => [`그림에서 닮음 대응(${t.n1.join("")} ↔ ${t.n2.join("")})과 변 라벨을 읽는다.`, "Read the correspondence and the side labels."];
const ratioStep = (a: number, b: number): [string, string] => [`대응변의 비로 닮음비를 구한다: ${b} : ${a}.`, "Use a pair of corresponding sides for the scale factor."];

export const ITEM = defineItem({
  prefix: "lat", itemId: "lines_angles_triangles.similar_triangles.TR.P",
  hard: [
    {
      op: "unit_ratio", structure: "닮은 두 삼각형에서 한 삼각형의 세 변과 다른 삼각형의 대응변 하나로 닮음비를 구해 둘째 삼각형의 둘레를 구함", extra: "닮음비를 한 쌍의 대응변에서 구해 세 변 모두(둘레)에 적용 — 둘레만 구할 때 닮음비를 한 번에 곱하는 단계를 건너뛰기 쉬움, medium 은 대응변 하나",
      concepts: ["닮은 삼각형", "닮음비", "둘레"],
      gen(rng) {
        const t = makeSim(rng); const i = rng.int(0, 2);
        const fig = simFig(t, t.s1.map(String), t.s2.map((v, k) => (k === i ? String(v) : null)));
        const per1 = t.s1[0] + t.s1[1] + t.s1[2], per2 = t.s2[0] + t.s2[1] + t.s2[2];
        return geoInst(rng, {
          stimulus: intro(rng, t), question: rng.pick([`What is the perimeter of triangle $${t.n2.join("")}$?`, `What is the perimeter, in the same units, of the second triangle, $${t.n2.join("")}$?`, `How long is the boundary of triangle $${t.n2.join("")}$ (its perimeter)?`]), correct: per2,
          wrongs: [W(per1, "step_missing", "닮음비를 곱하지 않고 첫 삼각형의 둘레를 답했다."), W(per2 - t.s2[i], "other", "라벨이 있는 변을 빼고 더했다."), W(Math.round(t.s2[i] * 3), "formula_misuse", "라벨된 변의 3배를 답했다."), W(per2 + t.k2, "other", "계산 중 어긋났다."), W(per1 + (t.s2[i] - t.s1[i]), "formula_misuse", "닮음비 대신 차를 더했다.")],
          verificationJs: figJs({}, fig, `${SIM_JS}const i=L2.findIndex(l=>l!==undefined); if (i<0) throw new Error('대응변 필요'); const r=num(L2[i])/num(L1[i]); if (!Number.isFinite(r)) throw new Error('대응변 필요'); return Math.round(r*(num(L1[0])+num(L1[1])+num(L1[2]))*1e6)/1e6;`),
          trace: [rd(t), ratioStep(t.s1[i], t.s2[i]), [`첫 삼각형의 둘레는 ${t.s1[0]} + ${t.s1[1]} + ${t.s1[2]} = ${per1} 이다.`, "Add the three sides of the first triangle."], [`둘레도 같은 비로 커지므로 ${per1} × ${t.s2[i]}/${t.s1[i]} = ${per2} 이다.`, "Perimeters scale by the same factor."], [`따라서 ${per2} 이다.`, "State the perimeter."]], variant: "perimeter_of_similar",
        }, fig);
      },
    },
    {
      op: "inverse", structure: "닮은 두 삼각형에서 한 쌍의 대응변은 숫자, 다른 쌍은 x 의 일차식 라벨일 때 비례식(교차곱)을 세워 x 를 구함", extra: "대응변 짝을 맞춰 비례식을 세우고 일차식 교차곱 방정식을 풀어야 함(대응을 틀리면 다른 x) — medium 은 숫자 대응변으로 한 변 계산",
      concepts: ["닮은 삼각형", "비례식", "일차방정식"],
      gen(rng) {
        const t = makeSim(rng); const [p, q] = rng.shuffle([0, 1, 2]).slice(0, 2); // p: 숫자 쌍, q: 식 쌍
        const a1 = rng.int(1, 2), a2 = rng.int(1, 2), x = rng.int(2, 9); const b1 = t.s1[q] - a1 * x, b2 = t.s2[q] - a2 * x;
        if (Math.abs(b1) > 14 || Math.abs(b2) > 14 || t.s1[p] * a2 === t.s2[p] * a1) throw new GenFail("식 라벨 범위");
        const lin = (a: number, b: number) => `${a === 1 ? "" : a}x${b === 0 ? "" : b > 0 ? ` + ${b}` : ` - ${-b}`}`;
        const l1: (string | null)[] = [null, null, null], l2: (string | null)[] = [null, null, null]; l1[p] = String(t.s1[p]); l2[p] = String(t.s2[p]); l1[q] = lin(a1, b1); l2[q] = lin(a2, b2); l1[3 - p - q] = String(t.s1[3 - p - q]); l2[3 - p - q] = null;
        const fig = simFig(t, l1, l2);
        return geoInst(rng, {
          stimulus: intro(rng, t), question: rng.pick([`What is the value of $x$?`, `In the figure shown, what is the value of $x$?`, `What value of $x$ makes the two triangles similar as described?`]), correct: x,
          wrongs: [W(t.s1[q], "step_missing", "x 가 아니라 변의 길이를 답했다."), W(t.s2[q], "step_missing", "x 가 아니라 둘째 삼각형의 변을 답했다."), W(x + 1, "other", "계산 중 어긋났다."), W(Math.abs(x - 2), "other", "계산 중 어긋났다."), W(Math.round(t.s2[p] / a2), "formula_misuse", "식에 숫자 변을 그대로 대입했다.")],
          verificationJs: figJs({}, fig, `${SIM_JS}const p=[0,1,2].find(k=>L1[k]!==undefined&&L2[k]!==undefined&&!/x/.test(String(L1[k]))), q=[0,1,2].find(k=>/x/.test(String(L1[k]))); if (p===undefined||q===undefined) throw new Error('대응 쌍 필요'); const A=num(L1[p]), B=num(L2[p]); const e1=lin(L1[q]), e2=lin(L2[q]); const den=B*e1.a-A*e2.a; if (den===0) throw new Error('해 없음'); const x=(A*e2.b-B*e1.b)/den; if (!Number.isFinite(x)) throw new Error('x 오류'); return x;`),
          trace: [rd(t), [`대응변의 비가 같다: ${pn(t.n1, p)}:${pn(t.n2, p)} = ${t.s1[p]}:${t.s2[p]} 이고 다른 대응 쌍은 ${lin(a1, b1)} : ${lin(a2, b2)} 이다.`, "Corresponding sides are in the same ratio."], [`교차곱: ${t.s2[p]}(${lin(a1, b1)}) = ${t.s1[p]}(${lin(a2, b2)}).`, "Cross-multiply."], [`x = ${x} 이다.`, "Solve the linear equation."], [`따라서 ${x} 이다.`, "State x."]], variant: "x_from_proportion",
        }, fig);
      },
    },
    {
      op: "chain2", structure: "닮은 두 삼각형에서 둘째 삼각형의 둘레가 지문에 주어지고 첫 삼각형의 세 변이 라벨일 때, 둘레비로 닮음비를 구한 뒤 둘째 삼각형의 지정한 변을 구함", extra: "둘레의 비 = 닮음비라는 사실로 닮음비를 먼저 구하고 대응변에 적용하는 2단계 연쇄 — medium 은 대응변 하나로 비례",
      concepts: ["닮은 삼각형", "둘레비", "닮음비"],
      gen(rng) {
        const t = makeSim(rng); const i = rng.int(0, 2); const per1 = t.s1[0] + t.s1[1] + t.s1[2], per2 = t.s2[0] + t.s2[1] + t.s2[2];
        const fig = simFig(t, t.s1.map(String), [null, null, null]);
        const ask = pn(t.n2, i);
        return geoInst(rng, {
          stimulus: `${intro(rng, t)} The perimeter of triangle $${t.n2.join("")}$ is ${per2}.`, question: `What is the length of side $${ask}$?`, correct: t.s2[i],
          wrongs: [W(t.s1[i], "step_missing", "닮음비를 곱하지 않았다."), W(per2 - per1 + t.s1[i], "formula_misuse", "둘레의 차를 더했다."), W(Math.round(per2 / 3), "formula_misuse", "둘레를 3등분했다."), W(t.s2[i] + t.k2, "other", "계산 중 어긋났다."), W(t.s2[(i + 1) % 3], "other", "다른 변을 답했다.")],
          verificationJs: figJs({ per2, ask }, fig, `${SIM_JS}const per1=num(L1[0])+num(L1[1])+num(L1[2]); const r=P.per2/per1; const k=pairs.findIndex(([i,j])=>[U[i],U[j]].sort().join('')===[...P.ask].sort().join('')); if (k<0) throw new Error('묻는 변 오류'); return Math.round(r*num(L1[k])*1e6)/1e6;`),
          trace: [rd(t), [`첫 삼각형의 둘레는 ${t.s1[0]} + ${t.s1[1]} + ${t.s1[2]} = ${per1} 이다.`, "Add the sides of the first triangle."], [`닮음비 = 둘레의 비 = ${per2}/${per1} 이다.`, "Perimeters are in the scale ratio."], [`${ask} 에 대응하는 변은 ${t.s1[i]} 이므로 ${t.s1[i]} × ${per2}/${per1} = ${t.s2[i]} 이다.`, "Apply the ratio to the corresponding side."], [`따라서 ${t.s2[i]} 이다.`, "State the length."]], variant: "side_from_perimeters",
        }, fig);
      },
    },
    {
      op: "compare_scenarios", structure: "닮은 두 삼각형에서 첫 삼각형의 세 변과 둘째 삼각형의 대응변 하나가 라벨일 때 두 삼각형의 가장 긴 변의 길이 차를 구함", extra: "가장 긴 변이 어느 쪽인지 대응으로 찾고 닮음비로 둘째 삼각형의 가장 긴 변을 구해 차를 계산 — medium 은 한 변의 길이",
      concepts: ["닮은 삼각형", "닮음비", "대응변"],
      gen(rng) {
        const t = makeSim(rng); const i = rng.int(0, 2); const L = t.s1.indexOf(Math.max(...t.s1)); if (t.s1.filter((v) => v === t.s1[L]).length > 1) throw new GenFail("최장변 모호");
        const fig = simFig(t, t.s1.map(String), t.s2.map((v, k) => (k === i ? String(v) : null))); const d = Math.abs(t.s2[L] - t.s1[L]); if (d === 0) throw new GenFail("차 0");
        return geoInst(rng, {
          stimulus: intro(rng, t), question: rng.pick([`By how much, in length units, do the longest sides of the two triangles differ?`, `What is the positive difference between the length of the longest side of triangle $${t.n2.join("")}$ and the length of the longest side of triangle $${t.n1.join("")}$?`, `How much longer (or shorter) is the longest side of one triangle than the longest side of the other? Give the positive difference.`]), correct: d,
          wrongs: [W(Math.abs(t.s2[i] - t.s1[i]), "step_missing", "라벨된 대응변의 차를 답했다."), W(t.s2[L], "partial", "둘째 삼각형의 가장 긴 변만 답했다."), W(t.s1[L], "partial", "첫 삼각형의 가장 긴 변만 답했다."), W(d + t.k2, "other", "계산 중 어긋났다."), W(Math.abs(t.s2[(L + 1) % 3] - t.s1[(L + 1) % 3]), "other", "다른 대응변의 차를 답했다.")],
          verificationJs: figJs({}, fig, `${SIM_JS}const A=L1.map(num); const i=L2.findIndex(l=>l!==undefined); const r=num(L2[i])/A[i]; const mx=Math.max(...A); if (A.filter(v=>v===mx).length>1) throw new Error('최장변 모호'); return Math.round(Math.abs(r*mx-mx)*1e6)/1e6;`),
          trace: [rd(t), [`첫 삼각형의 가장 긴 변은 ${t.s1[L]} 이다.`, "Find the longest side of the first triangle."], ratioStep(t.s1[i], t.s2[i]), [`둘째 삼각형의 대응변은 ${t.s1[L]} × ${t.s2[i]}/${t.s1[i]} = ${t.s2[L]} 이고 차는 |${t.s2[L]} - ${t.s1[L]}| = ${d} 이다.`, "Scale it and subtract."], [`따라서 ${d} 이다.`, "State the difference."]], variant: "longest_side_difference",
        }, fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "scale_side", structure: "닮은 두 삼각형에서 대응변 한 쌍과 첫 삼각형의 다른 변으로 둘째 삼각형의 대응변을 구함", extra: "easy: 대응변 비 한 번 적용", concepts: ["닮은 삼각형", "비례식"],
      gen(rng) {
        const t = makeSim(rng); const [p, q] = rng.shuffle([0, 1, 2]).slice(0, 2); const l1: (string | null)[] = [null, null, null], l2: (string | null)[] = [null, null, null]; l1[p] = String(t.s1[p]); l2[p] = String(t.s2[p]); l1[q] = String(t.s1[q]); l2[q] = "x";
        const fig = simFig(t, l1, l2);
        return geoInst(rng, { stimulus: intro(rng, t), question: rng.pick([`What is the value of $x$?`, `In the figure shown, what is the value of $x$?`]), correct: t.s2[q], wrongs: [W(t.s1[q], "step_missing", "닮음비를 곱하지 않았다."), W(t.s2[q] + t.k2, "other", "계산 중 어긋났다."), W(t.s2[p], "other", "다른 변의 길이를 답했다."), W(t.s1[q] + (t.s2[p] - t.s1[p]), "formula_misuse", "비 대신 차를 더했다.")], verificationJs: figJs({}, fig, `${SIM_JS}const p=[0,1,2].find(k=>L1[k]!==undefined&&L2[k]!==undefined&&L2[k]!=='x'), q=[0,1,2].find(k=>L2[k]==='x'); if (p===undefined||q===undefined) throw new Error('라벨 오류'); const r=num(L2[p])/num(L1[p]); return Math.round(r*num(L1[q])*1e6)/1e6;`), trace: [rd(t), ratioStep(t.s1[p], t.s2[p]), [`x = ${t.s1[q]} × ${t.s2[p]}/${t.s1[p]} = ${t.s2[q]} 이다.`, "Scale the corresponding side."]], variant: "scale_one_side",
        }, fig);
      },
    },
    {
      lv: "medium", name: "perimeter_ratio", structure: "닮은 두 삼각형에서 첫 삼각형의 세 변과 둘째 삼각형의 대응변 하나로 닮음비의 값을 구함", extra: "medium: 대응변을 짝지어 닮음비(둘째/첫째)를 구함", concepts: ["닮은 삼각형", "닮음비"],
      gen(rng) {
        const t = makeSim(rng); const i = rng.int(0, 2); const fig = simFig(t, t.s1.map(String), t.s2.map((v, k) => (k === i ? String(v) : null))); const r = t.s2[i] / t.s1[i]; const g = Math.round(r * 1000) / 1000;
        if (Math.abs(g - r) > 1e-9) throw new GenFail("비 소수 길이");
        return geoInst(rng, { stimulus: intro(rng, t), question: rng.pick([`What is the ratio of the perimeter of triangle $${t.n2.join("")}$ to the perimeter of triangle $${t.n1.join("")}$? Give the answer as a decimal.`, `The perimeter of triangle $${t.n2.join("")}$ is how many times the perimeter of triangle $${t.n1.join("")}$? Give the answer as a decimal.`]), correct: g, fmt: (v) => String(v), wrongs: [W(Math.round((1 / r) * 1000) / 1000, "opposite", "비를 거꾸로 답했다."), W(Math.round(r * r * 1000) / 1000, "formula_misuse", "넓이비를 답했다."), W(t.s2[i] - t.s1[i], "formula_misuse", "비 대신 차를 답했다."), W(Math.round((r + 0.1) * 1000) / 1000, "other", "계산 중 어긋났다.")], verificationJs: figJs({}, fig, `${SIM_JS}const i=L2.findIndex(l=>l!==undefined); return Math.round(num(L2[i])/num(L1[i])*1000)/1000;`), trace: [rd(t), ratioStep(t.s1[i], t.s2[i]), [`둘레의 비는 닮음비와 같다: ${t.s2[i]}/${t.s1[i]} = ${g}.`, "The perimeter ratio equals the scale factor."]], variant: "perimeter_ratio_from_pair",
        }, fig);
      },
    },
  ],
});
