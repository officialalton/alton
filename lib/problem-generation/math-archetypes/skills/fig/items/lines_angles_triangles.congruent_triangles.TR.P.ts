// lines_angles_triangles.congruent_triangles.TR.P — 합동인 두 삼각형(ABC ≅ DEF) 그림의 변·각 라벨에서 대응 관계로 변·각·둘레·넓이를 구한다.
import { GenFail } from "../../../types";
import { W } from "../../d-kit";
import { figJs } from "../../../figure-kit";
import { defineItem } from "../item-kit";
import { NUM_JS, anglesFromSides, congScale, geoInst, lead, pickN, shapeOk } from "../geo-kit";
import { TRIPLES, type Tri3 } from "../tri-kit";
import type { Rng } from "../../../rng";

type Cg = { n1: string[]; n2: string[]; pos: number[]; s: [number, number, number]; ang: [number, number, number] };
const PAIRS: [number, number][] = [[0, 1], [1, 2], [0, 2]];
const pk = (v: string[], k: number) => `${v[PAIRS[k][0]]}${v[PAIRS[k][1]]}`;
/** 합동 두 삼각형(서로 다른 세 변). pos: 둘째 삼각형의 [위, 왼쪽 아래, 오른쪽 아래] 자리에 오는 대응 번호. */
function makeCg(rng: Rng, o: { permute?: boolean } = {}): Cg {
  for (let tr = 0; tr < 300; tr++) {
    const s: [number, number, number] = [rng.int(7, 24), rng.int(7, 24), rng.int(7, 24)];
    if (new Set(s).size < 3 || !shapeOk(s[0], s[1], s[2], 30, 105)) continue;
    const nm = rng.shuffle(pickN(rng, 6)); const pos = o.permute ? rng.shuffle([0, 1, 2]) : [0, 1, 2];
    if (o.permute && pos.every((p, i) => p === i)) continue;
    return { n1: nm.slice(0, 3).sort(), n2: nm.slice(3).sort(), pos, s, ang: anglesFromSides(s[0], s[1], s[2]) };
  }
  throw new GenFail("합동 삼각형 표집 실패");
}
/** 그림: l1·l2 는 변 라벨(대응 번호 [01,12,02] 순, null=없음), a1·a2 는 각 라벨(대응 꼭짓점 번호 순, null=없음). */
function cgFig(t: Cg, l1: (string | null)[], l2: (string | null)[], a1: (string | null)[], a2: (string | null)[]) {
  const body = (v: string[], pos: number[], lab: (string | null)[], al: (string | null)[]) => ({
    vertices: pos.map((c) => v[c]), kind: "scalene",
    sides: PAIRS.map(([i, j], k) => ({ between: [v[i], v[j]] as [string, string], ...(lab[k] !== null ? { label: lab[k]! } : {}) })).filter((q) => "label" in q),
    angles: pos.map((c) => ({ at: v[c], value: t.ang[c], ...(al[c] !== null ? { label: al[c]! } : { arc: false }) })),
  });
  const first = body(t.n1, [0, 1, 2], l1, a1), second = body(t.n2, t.pos, l2, a2);
  return { type: "triangle", ...first, second: { ...second, scale: congScale(t.s, t.ang, t.pos) } };
}
const PARSE_LIN_JS = "const lin=(l)=>{ const t=String(l).replace(/\\s/g,'').replace(/−/g,'-'); let m=/^(\\d*)x([+-]\\d+)?$/.exec(t); if (m) return {a:m[1]===''?1:Number(m[1]), b:m[2]?Number(m[2]):0}; m=/^(\\d+(?:\\.\\d+)?)$/.exec(t); if (m) return {a:0,b:Number(m[1])}; throw new Error('라벨 형식 오류: '+l); };\n";
/** FIGURE 의 두 삼각형에서 대응 순서(vertices 의 이름 정렬이 아니라 첫째의 v[i] ↔ 둘째 n2[i])로 변·각 라벨을 읽는다. n2 는 지문에 인쇄된 대응(P.c2). */
const CG_JS = `${NUM_JS}${PARSE_LIN_JS}const T1=FIGURE, T2=FIGURE.second; const V=T1.vertices; const U=P.c2.split(''); const sl=(T,a,b)=>{ const s=(T.sides||[]).find(q=>(q.between[0]===a&&q.between[1]===b)||(q.between[0]===b&&q.between[1]===a)); return s?s.label:undefined; }; const al=(T,a)=>{ const s=(T.angles||[]).find(q=>q.at===a); return s?s.label:undefined; }; const pairs=[[0,1],[1,2],[0,2]]; const L1=pairs.map(([i,j])=>sl(T1,V[i],V[j])), L2=pairs.map(([i,j])=>sl(T2,U[i],U[j])); const A1=V.map(v=>al(T1,v)), A2=U.map(v=>al(T2,v));\n`;

const intro = (rng: Rng, t: Cg, extra = "") => `${lead(rng)}${rng.pick([`Triangle $${t.n1.join("")}$ is congruent to triangle $${t.n2.join("")}$, with $${t.n1[0]}$, $${t.n1[1]}$, and $${t.n1[2]}$ corresponding to $${t.n2[0]}$, $${t.n2[1]}$, and $${t.n2[2]}$, respectively. Some side lengths and angle measures are shown in the figure.`, `In the figure shown, triangle $${t.n1.join("")}$ is congruent to triangle $${t.n2.join("")}$ (vertices correspond in the order written). The figure gives some side lengths and angle measures.`, `The two triangles in the figure shown are congruent: triangle $${t.n1.join("")}$ matches triangle $${t.n2.join("")}$ vertex by vertex in the order given. Some measures are labeled.`, `Triangles $${t.n1.join("")}$ and $${t.n2.join("")}$ in the figure are congruent, and the vertices correspond in the order written. Labeled measures are shown in the figure.`])}${extra}`;
const rd = (t: Cg): [string, string] => [`합동이므로 꼭짓점이 순서대로 대응한다: ${t.n1.join("")} ↔ ${t.n2.join("")}. 그림의 라벨을 읽는다.`, "Congruent triangles: corresponding vertices in order; read the labels."];
const lin = (a: number, b: number) => `${a === 1 ? "" : a}x${b === 0 ? "" : b > 0 ? ` + ${b}` : ` - ${-b}`}`;

export const ITEM = defineItem({
  prefix: "lat", itemId: "lines_angles_triangles.congruent_triangles.TR.P",
  hard: [
    {
      op: "inverse", structure: "합동인 두 삼각형에서 한 각은 첫 삼각형에, 다른 각은 둘째 삼각형에 라벨되어 있을 때 대응 관계와 내각의 합 180° 로 지정한 꼭짓점의 각을 구함", extra: "각이 서로 다른 삼각형에 흩어져 있어 대응 꼭짓점으로 옮긴 뒤 180° 에서 빼야 함(라벨된 두 각의 합만 답하는 함정) — medium 은 한 삼각형 안의 두 각",
      concepts: ["합동", "대응각", "삼각형 내각의 합"],
      gen(rng) {
        const t = makeCg(rng, { permute: true }); const [i, j] = rng.shuffle([0, 1, 2]).slice(0, 2); const k = 3 - i - j;
        const a1: (string | null)[] = [null, null, null], a2: (string | null)[] = [null, null, null]; a1[i] = `${Math.round(t.ang[i])}°`; a2[j] = `${Math.round(t.ang[j])}°`;
        const ai = Math.round(t.ang[i]), aj = Math.round(t.ang[j]); const correct = 180 - ai - aj; if (correct < 20 || Math.abs(t.ang[k] - correct) > 2.5) throw new GenFail("반올림 각 불일치");
        const fig = cgFig(t, [null, null, null], [null, null, null], a1, a2);
        return geoInst(rng, {
          stimulus: intro(rng, t), question: rng.pick([`What is the measure, in degrees, of angle $${t.n2[k]}$?`, `What is the degree measure of the angle at vertex $${t.n2[k]}$?`, `How many degrees is the angle at vertex $${t.n2[k]}$?`]), correct,
          wrongs: [W(ai + aj, "formula_misuse", "라벨된 두 각의 합을 답했다."), W(180 - ai, "step_missing", "한 각만 빼서 구했다."), W(180 - aj, "step_missing", "한 각만 빼서 구했다."), W(Math.abs(ai - aj), "formula_misuse", "두 각의 차를 답했다."), W(correct + 10, "other", "계산 중 어긋났다.")],
          verificationJs: figJs({ c2: t.n2.join(""), ask: t.n2[k] }, fig, `${CG_JS}const ang=[]; U.forEach((u,m)=>{ const q=al(T2,u); if (q!==undefined) ang[m]=num(q); }); V.forEach((v,m)=>{ const q=al(T1,v); if (q!==undefined) ang[m]=num(q); }); const known=[0,1,2].filter(m=>Number.isFinite(ang[m])); if (known.length!==2) throw new Error('두 각 필요'); const m=U.indexOf(P.ask); if (m<0) throw new Error('꼭짓점 오류'); if (known.includes(m)) throw new Error('이미 주어진 각'); return 180-ang[known[0]]-ang[known[1]];`),
          trace: [rd(t), [`첫 삼각형에서 ∠${t.n1[i]} = ${ai}° 이고 둘째 삼각형에서 ∠${t.n2[j]} = ${aj}° 이다.`, "Read the two labeled angles."], [`대응각은 같으므로 ∠${t.n1[j]} = ∠${t.n2[j]} = ${aj}° 이다.`, "Corresponding angles are equal."], [`삼각형 ${t.n1.join("")} 에서 나머지 각 ∠${t.n1[k]} = 180° - ${ai}° - ${aj}° = ${correct}° 이다.`, "Use the angle sum of 180°."], [`∠${t.n2[k]} 는 ∠${t.n1[k]} 와 대응하므로 ${correct}° 이다.`, "Transfer to the asked vertex."]], variant: "angle_by_correspondence",
        }, fig);
      },
    },
    {
      op: "repr_shift", structure: "합동인 두 삼각형에서 대응변 하나는 x 의 일차식 두 개로 라벨되고 나머지 두 변은 숫자일 때 대응변이 같다는 사실을 방정식으로 옮겨 x 를 구한 뒤 둘레를 구함", extra: "대응변의 같음을 방정식으로 번역해 x 를 풀고 변의 길이를 구한 뒤 둘레(세 변의 합)까지 이어야 함(x 를 답하는 함정) — medium 은 x 의 값",
      concepts: ["합동", "대응변", "일차방정식", "둘레"],
      gen(rng) {
        const t = makeCg(rng, { permute: true }); const k = rng.int(0, 2); const x = rng.int(2, 9); const a1 = rng.int(1, 3); let a2 = rng.int(1, 3); if (a2 === a1) a2 = a1 === 3 ? 2 : a1 + 1;
        const L = t.s[k]; const b1 = L - a1 * x, b2 = L - a2 * x; if (Math.abs(b1) > 15 || Math.abs(b2) > 15) throw new GenFail("식 범위");
        const l1: (string | null)[] = [null, null, null], l2: (string | null)[] = [null, null, null]; for (let m = 0; m < 3; m++) l1[m] = m === k ? lin(a1, b1) : String(t.s[m]); l2[k] = lin(a2, b2);
        const fig = cgFig(t, l1, l2, [null, null, null], [null, null, null]); const per = t.s[0] + t.s[1] + t.s[2];
        return geoInst(rng, {
          stimulus: intro(rng, t), question: rng.pick([`What is the perimeter of triangle $${t.n2.join("")}$?`, `What is the perimeter, in the same units, of triangle $${t.n1.join("")}$?`, `What is the total length of the three sides of triangle $${t.n2.join("")}$?`]), correct: per,
          wrongs: [W(per - L + x, "step_missing", "x 를 변의 길이로 대신 넣었다."), W(x, "step_missing", "x 를 답했다."), W(per - L, "partial", "미지 변을 빼고 더했다."), W(per + a1 * x, "other", "계산 중 어긋났다."), W(L, "partial", "미지 변의 길이만 답했다.")],
          verificationJs: figJs({ c2: t.n2.join("") }, fig, `${CG_JS}const k=[0,1,2].find(m=>L2[m]!==undefined); if (k===undefined) throw new Error('식 라벨 필요'); const e1=lin(L1[k]), e2=lin(L2[k]); const d=e1.a-e2.a; if (d===0) throw new Error('해 없음'); const x=(e2.b-e1.b)/d; const len=e1.a*x+e1.b; let s=0; for (let m=0;m<3;m++) s+= m===k? len : num(L1[m]); return s;`),
          trace: [rd(t), [`대응변은 길이가 같다: ${pk(t.n1, k)} = ${pk(t.n2, k)}, 즉 ${lin(a1, b1)} = ${lin(a2, b2)}.`, "Corresponding sides are equal; set up the equation."], [`x = ${x} 이다.`, "Solve for x."], [`${pk(t.n1, k)} = ${L} 이다.`, "Substitute to get the side length."], [`둘레 = ${t.s.join(" + ")} = ${per} 이다.`, "Add the three sides."]], variant: "perimeter_from_equal_sides",
        }, fig);
      },
    },
    {
      op: "chain2", structure: "합동인 두 삼각형에서 한 삼각형의 둘레가 지문에 주어지고 다른 삼각형의 두 변이 라벨일 때, 둘레가 같다는 사실로 셋째 변의 길이를 구함", extra: "합동 ⇒ 둘레 동일 ⇒ 라벨된 두 변을 빼 셋째 변 — 대응변 짝짓기 없이 둘레만 쓰는 2단계 추론, medium 은 대응변 하나",
      concepts: ["합동", "둘레", "대응변"],
      gen(rng) {
        const t = makeCg(rng, { permute: true }); const k = rng.int(0, 2); const per = t.s[0] + t.s[1] + t.s[2];
        const l2: (string | null)[] = t.s.map((v, m) => (m === k ? null : String(v)));
        const fig = cgFig(t, [null, null, null], l2, [null, null, null], [null, null, null]);
        return geoInst(rng, {
          stimulus: `${intro(rng, t)} The perimeter of triangle $${t.n1.join("")}$ is ${per}.`, question: `What is the length of side $${pk(t.n2, k)}$?`, correct: t.s[k],
          wrongs: [W(per - t.s[(k + 1) % 3], "partial", "한 변만 빼서 구했다."), W(per, "partial", "둘레를 답했다."), W(t.s[(k + 1) % 3] + t.s[(k + 2) % 3], "formula_misuse", "라벨된 두 변의 합을 답했다."), W(t.s[k] + 2, "other", "계산 중 어긋났다."), W(Math.round(per / 3), "formula_misuse", "둘레를 3등분했다.")],
          verificationJs: figJs({ per, c2: t.n2.join(""), ask: pk(t.n2, k) }, fig, `${CG_JS}const ks=[0,1,2].filter(m=>L2[m]!==undefined); if (ks.length!==2) throw new Error('두 변 라벨 필요'); const asked=pairs.findIndex(([i,j])=>[U[i],U[j]].sort().join('')===[...P.ask].sort().join('')); if (asked<0||ks.includes(asked)) throw new Error('묻는 변 오류'); return P.per-ks.reduce((s,m)=>s+num(L2[m]),0);`),
          trace: [rd(t), [`합동인 삼각형은 둘레가 같으므로 삼각형 ${t.n2.join("")} 의 둘레도 ${per} 이다.`, "Congruent triangles have equal perimeters."], [`라벨된 두 변의 합은 ${t.s[(k + 1) % 3]} + ${t.s[(k + 2) % 3]} = ${t.s[(k + 1) % 3] + t.s[(k + 2) % 3]} 이다.`, "Add the two labeled sides."], [`${pk(t.n2, k)} = ${per} - ${t.s[(k + 1) % 3] + t.s[(k + 2) % 3]} = ${t.s[k]} 이다.`, "Subtract from the perimeter."], [`따라서 ${t.s[k]} 이다.`, "State the length."]], variant: "side_from_equal_perimeter",
        }, fig);
      },
    },
    {
      op: "compose_kind", structure: "합동인 두 직각삼각형에서 첫 삼각형은 두 직각변, 둘째 삼각형은 빗변과 한 직각변이 라벨일 때 대응 관계와 피타고라스 정리로 둘째 삼각형의 넓이를 구함", extra: "합동의 대응(직각변·빗변 매칭)과 피타고라스로 빠진 직각변을 구한 뒤 넓이 공식 적용 — 빗변을 직각변으로 오인하면 틀림, medium 은 두 직각변으로 넓이",
      concepts: ["합동", "피타고라스 정리", "직각삼각형 넓이"],
      gen(rng) {
        const [a0, b0, c0] = rng.pick(TRIPLES.filter((q) => q[2] <= 30)); const [p, q] = rng.chance(0.5) ? [a0, b0] : [b0, a0];
        const nm = rng.shuffle(pickN(rng, 6)); const n1 = nm.slice(0, 3).sort(), n2 = nm.slice(3).sort();
        // 첫: n1[0] 직각(왼쪽 아래), n1[1] 밑변 끝, n1[2] 위. 밑변 n1[0]n1[1] = p, 높이 n1[0]n1[2] = q. 둘째: n2[1] 직각, n2[0] 위(?), 지면 n2[1]n2[2].
        const r1 = { type: "triangle", vertices: n1 as Tri3, kind: "right", rightAngleAt: n1[0], horizontal: [n1[0], n1[1]] as [string, string], sides: [{ between: [n1[0], n1[1]], label: String(p) }, { between: [n1[0], n1[2]], label: String(q) }], angles: [] };
        const known = rng.chance(0.5) ? "p" : "q"; const legShown = known === "p" ? p : q; const legAsk = known === "p" ? q : p; const baseIsShown = known === "p";
        const beta = Math.round(Math.atan2(q, p) * 1800 / Math.PI) / 10; // 둘째 삼각형 밑변 오른쪽 끝(n2[0])의 각
        const r2 = { vertices: n2 as Tri3, kind: "right", rightAngleAt: n2[1], horizontal: [n2[1], n2[0]] as [string, string], sides: [{ between: baseIsShown ? [n2[1], n2[0]] : [n2[1], n2[2]], label: String(legShown) }, { between: [n2[0], n2[2]], label: String(c0) }], angles: [{ at: n2[0], arc: false, value: beta }], scale: 1 };
        const fig = { ...r1, second: r2 }; const area = (p * q) / 2;
        return geoInst(rng, {
          stimulus: `${lead(rng)}Right triangle $${n1.join("")}$ is congruent to right triangle $${n2.join("")}$, with $${n1[0]}$, $${n1[1]}$, $${n1[2]}$ corresponding to $${n2[1]}$, $${n2[0]}$, $${n2[2]}$, respectively. Some side lengths are shown in the figure.`, question: rng.pick([`What is the area of triangle $${n2.join("")}$?`, `What is the area, in square units, of triangle $${n2.join("")}$?`]), correct: area,
          wrongs: [W(legShown * c0 / 2, "formula_misuse", "빗변을 직각변으로 보고 넓이를 구했다."), W(p * q, "formula_misuse", "1/2 를 곱하지 않았다."), W((p + q) / 2, "formula_misuse", "직각변의 합을 반으로 했다."), W(area + 6, "other", "계산 중 어긋났다.")],
          verificationJs: figJs({}, fig, `${NUM_JS}const T1=FIGURE, T2=FIGURE.second; const lens=(T)=>(T.sides||[]).map(s=>num(s.label)); const L1=lens(T1), L2=lens(T2); if (L1.length!==2||L2.length!==2) throw new Error('라벨 필요'); const hyp=Math.max(...L2); const leg=Math.min(...L2); if (!(hyp>leg)) throw new Error('빗변 오류'); const other=Math.sqrt(hyp*hyp-leg*leg); if (Math.abs(L1[0]*L1[0]+L1[1]*L1[1]-hyp*hyp)>1e-9) throw new Error('합동 아님'); return Math.round(leg*other/2*1e6)/1e6;`),
          trace: [[`합동인 직각삼각형이므로 대응변이 같다. 그림에서 ${n1[0]}${n1[1]} = ${p}, ${n1[0]}${n1[2]} = ${q} 이고 ${n2.join("")} 에는 직각변 ${legShown} 과 빗변 ${c0} 이 있다.`, "Read the labels; corresponding sides are equal."], [`${c0} 이 빗변이므로 ${n2.join("")} 의 다른 직각변은 √(${c0}² - ${legShown}²) = ${legAsk} 이다.`, "Use the Pythagorean theorem for the missing leg."], [`두 직각변은 ${p}, ${q} 이다.`, "The legs are the same as in the first triangle."], [`넓이 = ½ × ${p} × ${q} = ${area} 이다.`, "Area of a right triangle."], [`따라서 ${area} 이다.`, "State the area."]], variant: "area_by_congruence_pythagoras",
        }, fig);
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "corresponding_side", structure: "합동인 두 삼각형에서 대응변 하나의 길이가 라벨일 때 다른 삼각형의 대응변 x 를 구함", extra: "easy: 합동이면 대응변이 같다", concepts: ["합동", "대응변"],
      gen(rng) {
        const t = makeCg(rng, { permute: true }); const k = rng.int(0, 2); const l1: (string | null)[] = [null, null, null], l2: (string | null)[] = [null, null, null]; l1[k] = String(t.s[k]); l2[k] = "x";
        const fig = cgFig(t, l1, l2, [null, null, null], [null, null, null]);
        return geoInst(rng, { stimulus: intro(rng, t), question: rng.pick([`What is the value of $x$?`, `In the figure shown, what is the value of $x$?`]), correct: t.s[k], wrongs: [W(t.s[(k + 1) % 3], "other", "다른 변의 길이를 답했다."), W(2 * t.s[k], "formula_misuse", "두 배를 답했다."), W(t.s[k] + 2, "other", "계산 중 어긋났다."), W(t.s[k] - 2, "other", "계산 중 어긋났다.")], verificationJs: figJs({ c2: t.n2.join("") }, fig, `${CG_JS}const k=[0,1,2].find(m=>L2[m]==='x'); if (k===undefined) throw new Error('x 라벨 필요'); return num(L1[k]);`), trace: [rd(t), [`${pk(t.n2, k)} 에 대응하는 변은 ${pk(t.n1, k)} = ${t.s[k]} 이다.`, "Find the corresponding side."], [`합동이므로 x = ${t.s[k]} 이다.`, "Corresponding sides are equal."]], variant: "corresponding_side_value",
        }, fig);
      },
    },
    {
      lv: "medium", name: "solve_x", structure: "합동인 두 삼각형에서 대응변이 x 의 일차식과 숫자로 라벨일 때 같다는 식으로 x 를 구함", extra: "medium: 대응변이 같다는 식을 세워 일차방정식 풀이", concepts: ["합동", "일차방정식"],
      gen(rng) {
        const t = makeCg(rng, { permute: true }); const k = rng.int(0, 2); const x = rng.int(2, 12); const a = rng.int(2, 4); const b = t.s[k] - a * x; if (Math.abs(b) > 15) throw new GenFail("식 범위");
        const l1: (string | null)[] = [null, null, null], l2: (string | null)[] = [null, null, null]; l1[k] = lin(a, b); l2[k] = String(t.s[k]);
        const fig = cgFig(t, l1, l2, [null, null, null], [null, null, null]);
        return geoInst(rng, { stimulus: intro(rng, t), question: rng.pick([`What is the value of $x$?`, `In the figure shown, what is the value of $x$?`]), correct: x, wrongs: [W(t.s[k], "step_missing", "변의 길이를 답했다."), W(x + 1, "other", "계산 중 어긋났다."), W(Math.abs(x - 2), "other", "계산 중 어긋났다."), W(Math.round((t.s[k] + b) / a), "sign_error", "상수항의 부호를 잘못 처리했다.")], verificationJs: figJs({ c2: t.n2.join("") }, fig, `${CG_JS}const k=[0,1,2].find(m=>L1[m]!==undefined&&/x/.test(String(L1[m]))); if (k===undefined) throw new Error('식 라벨 필요'); const e=lin(L1[k]); if (e.a===0) throw new Error('x 없음'); return (num(L2[k])-e.b)/e.a;`), trace: [rd(t), [`${pk(t.n1, k)} 와 ${pk(t.n2, k)} 는 대응변이므로 ${lin(a, b)} = ${t.s[k]} 이다.`, "Set the corresponding sides equal."], [`x = ${x} 이다.`, "Solve the equation."]], variant: "x_from_equal_sides",
        }, fig);
      },
    },
  ],
});
