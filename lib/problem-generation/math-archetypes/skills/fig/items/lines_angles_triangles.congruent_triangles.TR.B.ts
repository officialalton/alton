// lines_angles_triangles.congruent_triangles.TR.B — B형: 기준 삼각형과 합동인 삼각형을 선택지 삼각형 4개 중에서 고른다(SSS·SAS·ASA·직각삼각형 빗변-다리 HL).
// 오답: 닮음(크기만 다름)·한 변만 다름·둘레만 같음·끼인각이 아닌 각(SSA)·각이나 변이 어긋남·직각이 아닌 삼각형 등. 도식은 not drawn to scale.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { defineItem } from "../item-kit";
import { bundle, SPR_NO_B } from "../b-kit";
import { TAILS } from "../sx-kit";
import { TRI_JS, TRI_LEADS, baseTri, triB, triNames, validTri } from "../trb-kit";

const intro = (rng: Rng, n: string[], extra = "") => `${rng.pick(TRI_LEADS)}${rng.pick([
  `Triangle $${n.join("")}$ is shown in the first figure, and four triangles are shown as choices.`,
  `The given figure shows triangle $${n.join("")}$. Four other triangles, each with labeled measures, are shown as the answer choices.`,
  `In the figure, triangle $${n.join("")}$ is drawn first, followed by four lettered triangles. Measures are labeled, and the figures are not drawn to scale.`,
  `Triangle $${n.join("")}$ appears at the top of the figure, with four triangles below it as possible answers. All measures are labeled.`,
])} ${rng.pick(TAILS)}${extra}`;
const Q = (n: string[]) => [`Which of the triangles shown must be congruent to triangle $${n.join("")}$?`, `Which one of the four triangles is congruent to triangle $${n.join("")}$?`, `Which triangle below can be shown to be congruent to triangle $${n.join("")}$?`];
const rd = (what: string): [string, string] => [`그림에서 ${what} 라벨을 읽는다.`, "Read the labels in the figures."];
const INC = `const INC=[[0,2],[0,1],[1,2]]; const lbA=(f)=>{ const t=TRI(f); const idx=t.A.map((x,i)=>Number.isNaN(x)?-1:i).filter(i=>i>=0); return {t,idx}; };
const SAS=(f)=>{ const t=TRI(f); const sd=t.S.map((x,i)=>Number.isNaN(x)?-1:i).filter(i=>i>=0); const an=(f.angles||[]).map(q=>f.vertices.indexOf(q.at)); if (sd.length!==2||an.length!==1) return {ok:false}; const v=an[0]; const inc=INC[v].every(i=>sd.includes(i)); return {ok:true, inc, sides:srt(sd.map(i=>t.S[i])), ang:t.A[v]}; };`;
const ang = (a: number) => a;
void ang;

const SSS_PRED = `${TRI_JS}return sameArr(srt(TRI(STEM).S), srt(TRI(c).S));`;
const SSS_DIAG = `${TRI_JS}const a=srt(TRI(STEM).S), b=srt(TRI(c).S); const r=b.map((x,i)=>x/a[i]); if (r.every(x=>Math.abs(x-r[0])<1e-9)) return "CONG_SIMILAR"; const eqc=b.filter((x,i)=>Math.abs(x-a[i])<1e-9).length; if (eqc===2) return "CONG_TWO_SIDES"; return Math.abs(b[0]+b[1]+b[2]-a[0]-a[1]-a[2])<1e-9?"CONG_SAME_PERIMETER":null;`;
function sssScene(rng: Rng) {
  const s = baseTri(rng); const n = triNames(rng), m = triNames(rng); const perm = rng.shuffle([...s]);
  const T = (a: number[]) => triB(m, { sides: a });
  const j = rng.int(0, 2); const two = s.map((x, i) => (i === j ? x + rng.pick([-2, -1, 1, 2]) : x)); if (!validTri(two[0], two[1], two[2]) || two.some((x) => x <= 0)) throw new GenFail("삼각형");
  const sim = s.map((x) => x * 2); const sp = (() => { const t = [...s]; t[0] += 2; t[1] -= 1; t[2] -= 1; return t; })(); if (!validTri(sp[0], sp[1], sp[2]) || sp.some((x) => x <= 0)) throw new GenFail("삼각형");
  return { s, n, stem: triB(n, { sides: s }), correct: T(perm), wrong: [{ fig: T(sim), rule: "CONG_SIMILAR" }, { fig: T(rng.shuffle(two)), rule: "CONG_TWO_SIDES" }, { fig: T(rng.shuffle(sp)), rule: "CONG_SAME_PERIMETER" }] };
}
function sasScene(rng: Rng) {
  const [x, y] = rng.shuffle([4, 5, 6, 7, 8, 9, 10, 11, 12]).slice(0, 2); const g = rng.pick([40, 50, 55, 60, 65, 70, 75, 80, 110, 115]); const n = triNames(rng), m = triNames(rng);
  const stem = triB(n, { sides: [x, y, undefined], angles: [undefined, g, undefined] }); const T = (sd: [number, number], an: number, inc: boolean) => (inc ? triB(m, { sides: [sd[0], sd[1], undefined], angles: [undefined, an, undefined] }) : triB(m, { sides: [sd[0], sd[1], undefined], angles: [an, undefined, undefined] }));
  const g2 = g + rng.pick([-15, -10, 10, 15]); const x2 = x + rng.pick([-2, -1, 1, 2]); if (g2 < 25 || g2 > 130 || x2 <= 0 || x2 === y) throw new GenFail("값");
  return { x, y, g, n, stem, correct: T([x, y], g, true), wrong: [{ fig: T([x, y], g, false), rule: "CONG_SSA" }, { fig: T([x, y], g2, true), rule: "CONG_ANGLE_OFF" }, { fig: T([x2, y], g, true), rule: "CONG_SIDE_OFF" }] };
}
const SAS_PRED = `${TRI_JS}${INC}const a=SAS(STEM), b=SAS(c); return a.ok&&b.ok&&b.inc&&sameArr(a.sides,b.sides)&&Math.abs(a.ang-b.ang)<1e-9;`;
const SAS_DIAG = `${TRI_JS}${INC}const a=SAS(STEM), b=SAS(c); if (!b.inc) return "CONG_SSA"; if (!sameArr(a.sides,b.sides)) return "CONG_SIDE_OFF"; return "CONG_ANGLE_OFF";`;
const ASA_PRED = `${TRI_JS}const a=TRI(STEM), b=TRI(c); const lab=(f)=>f.angles.map(q=>f.vertices.indexOf(q.at)).sort().join(''); if (lab(STEM)!=='01'||lab(c)!=='01') return false; return sameArr(srt(a.A.slice(0,2)),srt(b.A.slice(0,2)))&&Math.abs(a.S[0]-b.S[0])<1e-9;`;
const ASA_DIAG = `${TRI_JS}const a=TRI(STEM), b=TRI(c); if (!sameArr(srt(a.A.slice(0,2)),srt(b.A.slice(0,2)))) return "CONG_ANGLE_OFF"; return b.S[0]>a.S[0]?"CONG_SIDE_LARGER":"CONG_SIDE_SMALLER";`;
const HL_PRED = `${TRI_JS}const a=TRI(STEM), b=TRI(c); if (!b.right||!a.right) return false; const hyp=(t)=>{ const r=t.V.indexOf(t.right); const legs=[[0,2],[0,1],[1,2]][r]; const h=[0,1,2].find(i=>!legs.includes(i)); return {h:t.S[h], l:srt(legs.map(i=>t.S[i]).filter(x=>!Number.isNaN(x)))}; }; const x=hyp(a), y=hyp(b); return Math.abs(x.h-y.h)<1e-9&&x.l.length===1&&y.l.length===1&&Math.abs(x.l[0]-y.l[0])<1e-9;`;
const HL_DIAG = `${TRI_JS}const a=TRI(STEM), b=TRI(c); if (!b.right) return "CONG_NOT_RIGHT"; const hyp=(t)=>{ const r=t.V.indexOf(t.right); const legs=[[0,2],[0,1],[1,2]][r]; const h=[0,1,2].find(i=>!legs.includes(i)); return {h:t.S[h], l:legs.map(i=>t.S[i]).filter(x=>!Number.isNaN(x))[0]}; }; const x=hyp(a), y=hyp(b); if (Math.abs(x.h-y.h)>1e-9) return "CONG_HYP_OFF"; return "CONG_LEG_OFF";`;

export const ITEM = defineItem({
  prefix: "lat", itemId: "lines_angles_triangles.congruent_triangles.TR.B",
  hard: [
    {
      op: "repr_shift", structure: "기준 삼각형의 세 변과 같은 세 변(순서만 다름)을 가진 삼각형(SSS 합동)을 고름", extra: "세 변의 길이가 모두 같은지(크기만 다른 닮음·둘레만 같은 삼각형이 아닌지) 확인해야 함 — medium 은 ASA", sprNo: SPR_NO_B,
      concepts: ["합동인 삼각형", "SSS 합동"],
      gen(rng) {
        const sc = sssScene(rng);
        return bundle(rng, { stimulus: intro(rng, sc.n), question: rng.pick(Q(sc.n)), stem: sc.stem, correct: sc.correct, wrong: sc.wrong, P: {}, predicateJs: SSS_PRED, diagnoseJs: SSS_DIAG,
          trace: [rd("기준 삼각형의 세 변"), [`세 변이 ${[...sc.s].sort((a, b) => a - b).join(", ")} 이다.`, "The three sides."], [`변의 순서가 달라도 세 길이가 모두 같으면 SSS 합동이다.`, "SSS congruence ignores the order."], [`2 배로 커진 삼각형은 닮음이지 합동이 아니다.`, "A scaled copy is similar, not congruent."], [`한 변만 다르거나 둘레만 같은 삼각형도 합동이 아니다.`, "One different side or equal perimeter is not enough."]], variant: "sss_same_sides" });
      },
    },
    {
      op: "chain2", structure: "기준 삼각형의 두 변과 그 끼인각이 라벨될 때 선택지에서 두 변과 끼인각이 모두 같은 삼각형(SAS 합동)을 고름", extra: "각이 두 변의 끼인각인지 먼저 확인해야 함(끼인각이 아닌 SSA 를 고르는 함정) — medium 은 ASA", sprNo: SPR_NO_B,
      concepts: ["합동인 삼각형", "SAS 합동", "끼인각"],
      gen(rng) {
        const sc = sasScene(rng);
        return bundle(rng, { stimulus: intro(rng, sc.n), question: rng.pick(Q(sc.n)), stem: sc.stem, correct: sc.correct, wrong: sc.wrong, P: {}, predicateJs: SAS_PRED, diagnoseJs: SAS_DIAG,
          trace: [rd("기준 삼각형의 두 변과 각"), [`${sc.g}° 는 길이 ${sc.x}, ${sc.y} 인 두 변이 이루는 끼인각이다.`, "The angle is included between the two sides."], [`선택지에서 두 변이 ${sc.x}, ${sc.y} 인지 확인한다.`, "Compare the sides."], [`각이 두 변 사이에 있는지(끼인각), 크기가 ${sc.g}° 인지 확인한다.`, "The angle must be the included one."], [`끼인각이 아니면 SSA 라 합동이 보장되지 않는다.`, "SSA does not guarantee congruence."]], variant: "sas_included_angle" });
      },
    },
    {
      op: "compose_kind", structure: "두 각과 그 사이의 변(ASA)이 라벨된 기준 삼각형과 합동인 삼각형을 고름", extra: "두 각이 같은지와 사이의 변 길이가 같은지를 모두 확인해야 함(각만 같은 닮은 삼각형을 고르는 함정) — medium 은 SSS", sprNo: SPR_NO_B,
      concepts: ["합동인 삼각형", "ASA 합동", "닮음과 합동의 구별"],
      gen(rng) {
        const a = rng.int(40, 80), b = rng.int(40, 80); const g = 180 - a - b; if (a === b || g < 30 || g === a || g === b) throw new GenFail("각"); const side = rng.int(5, 12); const n = triNames(rng), m = triNames(rng);
        const T = (x: number[], sd: number) => triB(m, { sides: [sd, undefined, undefined], angles: x }); const a2 = a + rng.pick([-10, 10]); if (a2 < 30 || 180 - a2 - b < 30) throw new GenFail("각2");
        return bundle(rng, { stimulus: intro(rng, n), question: rng.pick(Q(n)), stem: triB(n, { sides: [side, undefined, undefined], angles: [a, b] }), correct: T(rng.shuffle([a, b]).length ? [a, b] : [a, b], side), wrong: [{ fig: T([a, b], side + rng.pick([2, 3])), rule: "CONG_SIDE_LARGER" }, { fig: T([a, b], Math.max(2, side - rng.pick([2, 3]))), rule: "CONG_SIDE_SMALLER" }, { fig: T([a2, b], side), rule: "CONG_ANGLE_OFF" }], P: {}, predicateJs: ASA_PRED, diagnoseJs: ASA_DIAG,
          trace: [rd("기준 삼각형의 두 각과 사이의 변"), [`두 각은 ${a}°, ${b}° 이고 그 사이의 변은 ${side} 이다.`, "Two angles and the included side."], [`ASA: 두 각과 그 사이의 변이 모두 같아야 합동이다.`, "All three must match."], [`각만 같고 변이 길거나 짧으면 닮음일 뿐 합동이 아니다.`, "A different side length gives a similar, not congruent, triangle."], [`각이 하나 다르면 합동이 아니다.`, "A different angle breaks the match."]], variant: "asa_between_side" });
      },
    },
    {
      op: "inverse", structure: "직각삼각형의 빗변과 한 다리가 라벨될 때 빗변과 다리가 같은 직각삼각형(HL 합동)을 고름", extra: "직각이라는 조건(직각 표시)과 빗변·다리의 길이를 모두 확인해야 함(직각이 아닌데 길이만 같은 삼각형을 고르는 함정) — medium 은 SAS", sprNo: SPR_NO_B,
      concepts: ["합동인 삼각형", "HL 합동", "직각삼각형"],
      gen(rng) {
        const [l, h] = rng.pick([[3, 5], [4, 5], [5, 13], [6, 10], [8, 10], [5, 7], [6, 9], [7, 11], [8, 12], [9, 12], [12, 13]] as [number, number][]); if (!(h > l)) throw new GenFail("빗변"); const n = triNames(rng), m = triNames(rng); const r0 = rng.int(0, 2); const r1 = rng.int(0, 2);
        const inc = [[0, 2], [0, 1], [1, 2]]; const legOf = (r: number) => inc[r][0]; const hypOf = (r: number) => [0, 1, 2].find((i) => !inc[r].includes(i)) as number;
        const T = (r: number, leg: number, hyp: number, right: boolean) => { const sd: (number | undefined)[] = [undefined, undefined, undefined]; sd[legOf(r)] = leg; sd[hypOf(r)] = hyp; return triB(m, { sides: sd, ...(right ? { right: r } : {}) }); };
        const sd0: (number | undefined)[] = [undefined, undefined, undefined]; sd0[legOf(r0)] = l; sd0[hypOf(r0)] = h; const stem = triB(n, { sides: sd0, right: r0 });
        const l2 = l + rng.pick([-1, 1, 2]), h2 = h + rng.pick([1, 2, 3]); if (l2 <= 0 || l2 >= h) throw new GenFail("값");
        return bundle(rng, { stimulus: intro(rng, n), question: rng.pick(Q(n)), stem, correct: T(r1, l, h, true), wrong: [{ fig: T(r1, l2, h, true), rule: "CONG_LEG_OFF" }, { fig: T(r1, l, h2, true), rule: "CONG_HYP_OFF" }, { fig: T(r1, l, h, false), rule: "CONG_NOT_RIGHT" }], P: {}, predicateJs: HL_PRED, diagnoseJs: HL_DIAG,
          trace: [rd("기준 삼각형의 빗변과 한 다리"), [`직각삼각형이고 빗변 ${h}, 한 다리 ${l} 이다.`, "A right triangle with a hypotenuse and a leg."], [`HL 합동: 두 직각삼각형의 빗변과 다른 한 변(다리)이 같다.`, "Hypotenuse-leg congruence."], [`직각 표시가 없는 삼각형은 같은 길이여도 HL 을 쓸 수 없다.`, "The triangle must be right."], [`빗변이나 다리가 다르면 합동이 아니다.`, "Any different length breaks the match."]], variant: "hl_right_triangle" });
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "sss", structure: "세 변이 같은 삼각형(SSS)을 고름", extra: "easy: 변 세 쌍이 같음", sprNo: SPR_NO_B, concepts: ["합동인 삼각형", "SSS 합동"],
      gen(rng) {
        const sc = sssScene(rng);
        return bundle(rng, { stimulus: intro(rng, sc.n), question: rng.pick(Q(sc.n)), stem: sc.stem, correct: sc.correct, wrong: sc.wrong, P: {}, predicateJs: SSS_PRED, diagnoseJs: SSS_DIAG, trace: [rd("세 변"), [`세 변이 모두 같은 삼각형이 합동이다.`, "SSS."]], variant: "easy_sss" });
      },
    },
    {
      lv: "medium", name: "sas", structure: "두 변과 끼인각이 같은 삼각형(SAS)을 고름", extra: "medium: 끼인각 확인", sprNo: SPR_NO_B, concepts: ["합동인 삼각형", "SAS 합동"],
      gen(rng) {
        const sc = sasScene(rng);
        return bundle(rng, { stimulus: intro(rng, sc.n), question: rng.pick(Q(sc.n)), stem: sc.stem, correct: sc.correct, wrong: sc.wrong, P: {}, predicateJs: SAS_PRED, diagnoseJs: SAS_DIAG, trace: [rd("두 변과 각"), [`끼인각이 같은 삼각형이 합동이다.`, "SAS."], [`끼인각이 아니면 합동이 보장되지 않는다.`, "SSA fails."]], variant: "medium_sas" });
      },
    },
  ],
});
