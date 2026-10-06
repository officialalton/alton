// lines_angles_triangles.similar_triangles.TR.B — B형: 기준 삼각형(지문의 그림)과 선택지 삼각형 4개. 기준 삼각형과 닮은 삼각형을 고른다(SSS 비례·AA 각·닮음비 주어짐·둘레 주어짐).
// 오답 규칙은 조합 안의 원형마다 다르다 — 변이 일정한 수만큼 더해진 것(ADD)·한 변만 어긋난 것·각이 하나만 같은 것 등. 도식은 not drawn to scale.
import { GenFail } from "../../../types";
import type { Rng } from "../../../rng";
import { defineItem } from "../item-kit";
import { bundle, SPR_NO_B } from "../b-kit";
import { TAILS } from "../sx-kit";
import { BASE3, TRI_JS, TRI_LEADS, baseTri, triB, triNames, validTri } from "../trb-kit";

const intro = (rng: Rng, n: string[], extra = "") => `${rng.pick(TRI_LEADS)}${rng.pick([
  `Triangle $${n.join("")}$ is shown in the first figure, and four triangles are shown as choices.`,
  `The given figure shows triangle $${n.join("")}$. Four other triangles, each with labeled measures, are shown as the answer choices.`,
  `In the figure, triangle $${n.join("")}$ is drawn first, followed by four lettered triangles. Measures are labeled, and the figures are not drawn to scale.`,
  `Triangle $${n.join("")}$ appears at the top of the figure, with four triangles below it as possible answers. All measures are labeled.`,
])} ${rng.pick(TAILS)}${extra}`;
const Q = (n: string[]) => [`Which of the triangles shown is similar to triangle $${n.join("")}$?`, `Which one of the four triangles is similar to triangle $${n.join("")}$?`, `Which triangle below must be similar to triangle $${n.join("")}$?`];
const SIDES_PRED = `${TRI_JS}const a=srt(TRI(STEM).S), b=srt(TRI(c).S); const r=b.map((x,i)=>x/a[i]); return r.every(x=>Math.abs(x-r[0])<1e-9);`;
const SIDES_DIAG = `${TRI_JS}const a=srt(TRI(STEM).S), b=srt(TRI(c).S); const d=b.map((x,i)=>x-a[i]); if (d.every(x=>Math.abs(x-d[0])<1e-9)) return "SIM_ADD"; const r=b.map((x,i)=>x/a[i]); const eq=(i,j)=>Math.abs(r[i]-r[j])<1e-9; if (eq(0,1)||eq(0,2)||eq(1,2)) return "SIM_ONE_OFF"; return "SIM_DIFF_FACTORS";`;
const AA_PRED = `${TRI_JS}return sameArr(srt(TRI(STEM).A), srt(TRI(c).A));`;
const AA_DIAG = `${TRI_JS}const a=srt(TRI(STEM).A); const ch=TRI(c).A; const b=srt(ch); let m=0; const used=[]; for (const x of b) { const j=a.findIndex((y,k)=>Math.abs(y-x)<1e-9&&!used.includes(k)); if (j>=0) { used.push(j); m++; } } if (m===3) return null; if (m===1) return "AA_ONE_SHARED"; const lab=(c.angles||[]).map(q=>Number(String(q.label).replace('°',''))); if (lab.some(u=>a.some(y=>Math.abs(u-(180-y))<1e-9))) return "AA_SUPPLEMENT"; return "AA_UNRELATED";`;
const okT = (x: number[]) => { const t = 180 - x[0] - x[1]; return [...x, t].every((v) => v >= 30 && v <= 118); };
/** AA 장면: 기준 (a, b, g) 와 정답 쌍·오답 세 쌍(모든 삼각형의 세 각이 30°~118° 안). */
function aaScene(rng: Rng) {
  for (let t = 0; t < 400; t++) {
    const a = rng.int(34, 80), b = rng.int(34, 80); const g = 180 - a - b; if (a === b || g === a || g === b || g < 34 || g > 100) continue;
    const st = [a, b, g]; const out = (x: number) => !st.includes(x);
    const d1 = rng.int(34, 100); if (!out(d1) || !out(180 - a - d1) || !okT([a, d1])) continue;
    const e = rng.int(30, 60); if (!out(e) || !out(a - e) || !okT([180 - a, e]) || 180 - a < 100 + 0 && false) continue;
    const u1 = rng.int(34, 100), u2 = rng.int(34, 100); const u3 = 180 - u1 - u2; if (![u1, u2, u3].every((x) => out(x) && out(180 - x)) || !okT([u1, u2])) continue;
    if (!okT([180 - a, e])) continue;
    return { a, b, g, d1, e, u1, u2 };
  }
  throw new GenFail("AA 장면");
}
const sides = (s: number[], rng: Rng) => rng.shuffle([...s]);
const rd = (what: string): [string, string] => [`그림에서 ${what} 라벨을 읽는다.`, "Read the labels in the figures."];

function sssScene(rng: Rng, k: number) {
  const s = baseTri(rng); const n = triNames(rng), m = triNames(rng); const stem = triB(n, { sides: s });
  const ok = sides(s.map((x) => x * k), rng); if (!validTri(ok[0], ok[1], ok[2])) throw new GenFail("삼각형");
  const d = rng.int(2, 5); const add = sides(s.map((x) => x + d), rng);
  const j = rng.int(0, 2); const off = s.map((x, i) => (i === j ? x * k + rng.pick([-2, -1, 1, 2]) : x * k)); if (!validTri(off[0], off[1], off[2])) throw new GenFail("삼각형");
  const mult = rng.pick([[2, 3, 4], [3, 2, 2], [2, 2, 3], [3, 4, 2], [4, 3, 2]]); const diff = s.map((x, i) => x * mult[i]); if (!validTri(diff[0], diff[1], diff[2])) throw new GenFail("삼각형");
  const T = (a: number[]) => triB(m, { sides: a });
  return { s, n, k, stem, correct: T(ok), wrong: [{ fig: T(add), rule: "SIM_ADD" }, { fig: T(sides(off, rng)), rule: "SIM_ONE_OFF" }, { fig: T(sides(diff, rng)), rule: "SIM_DIFF_FACTORS" }], d, ok, off, diff };
}

export const ITEM = defineItem({
  prefix: "lat", itemId: "lines_angles_triangles.similar_triangles.TR.B",
  hard: [
    {
      op: "repr_shift", structure: "기준 삼각형의 세 변 라벨과 선택지 삼각형의 세 변 라벨을 변끼리 비교해 닮은 삼각형(SSS 비례)을 고름", extra: "가장 긴·짧은 변끼리 짝지어 세 쌍이 모두 같은 비인지 확인해야 함(일정한 수를 더한 삼각형이나 한 변만 어긋난 삼각형을 고르는 함정) — medium 은 각으로 닮음", sprNo: SPR_NO_B,
      concepts: ["닮은 삼각형", "닮음비", "변의 비례"],
      gen(rng) {
        const sc = sssScene(rng, rng.pick([2, 3]));
        return bundle(rng, { stimulus: intro(rng, sc.n), question: rng.pick(Q(sc.n)), stem: sc.stem, correct: sc.correct, wrong: sc.wrong, P: {}, predicateJs: SIDES_PRED, diagnoseJs: SIDES_DIAG,
          trace: [rd("기준 삼각형의 세 변"), [`변을 작은 것부터 정렬하면 ${[...sc.s].sort((a, b) => a - b).join(", ")} 이다.`, "Order the sides."], [`닮으려면 선택지의 정렬된 변과 비가 모두 같아야 한다(이 문항의 정답은 ${sc.k} 배).`, "All three ratios must be equal."], [`다른 선택지는 일정한 수를 더했거나(비가 다름) 한 변만 어긋나거나 변마다 다른 비를 쓴다.`, "The other choices break proportionality."], [`따라서 ${sc.k} 배 한 삼각형이 정답이다.`, "Pick the scaled triangle."]], variant: "sss_proportional" });
      },
    },
    {
      op: "chain2", structure: "기준 삼각형의 두 각에서 나머지 각을 구한 뒤 선택지의 두 각(다른 쌍)에서 세 각을 모두 구해 닮은 삼각형(AA)을 고름", extra: "세 번째 각을 각각 구해 각의 집합을 비교해야 함(한 각만 같은 삼각형을 고르는 함정) — medium 은 같은 두 각이 라벨된 경우", sprNo: SPR_NO_B,
      concepts: ["닮은 삼각형", "삼각형의 내각의 합", "AA 닮음"],
      gen(rng) {
        const { a, b, g, d1, e, u1, u2 } = aaScene(rng); const n = triNames(rng), m = triNames(rng); const stem = triB(n, { angles: [a, b] });
        const pair = rng.pick([[b, g], [a, g]]); const okA = rng.shuffle(pair);
        const T = (x: number[]) => triB(m, { angles: x });
        return bundle(rng, { stimulus: intro(rng, n), question: rng.pick(Q(n)), stem, correct: T(okA), wrong: [{ fig: T([a, d1]), rule: "AA_ONE_SHARED" }, { fig: T([180 - a, e]), rule: "AA_SUPPLEMENT" }, { fig: T([u1, u2]), rule: "AA_UNRELATED" }], P: {}, predicateJs: AA_PRED, diagnoseJs: AA_DIAG,
          trace: [rd("기준 삼각형의 두 각"), [`나머지 각 = 180° - ${a}° - ${b}° = ${g}° 이므로 세 각은 ${[a, b, g].sort((x, y) => x - y).join("°, ")}° 이다.`, "Find the third angle."], [`각 선택지도 두 각에서 세 번째 각을 구한다.`, "Complete each choice."], [`세 각이 모두 같은 삼각형만 닮음(AA)이다.`, "Equal angles give similarity."], [`다른 선택지는 한 각만 같거나 보각이거나 관계가 없다.`, "Others share at most one angle."]], variant: "aa_third_angle" });
      },
    },
    {
      op: "inverse", structure: "닮음비(확대 또는 축소)가 지문에 주어질 때 기준 삼각형의 각 변에 닮음비를 곱한 삼각형을 고름", extra: "닮음비를 변마다 곱해야 함(역수를 곱하거나 다른 비·더하기를 쓰는 함정) — medium 은 닮음비가 2 인 경우", sprNo: SPR_NO_B,
      concepts: ["닮은 삼각형", "닮음비", "역산"],
      gen(rng) {
        const base = rng.pick([[6, 8, 10], [6, 9, 12], [8, 10, 12], [6, 10, 14], [10, 12, 14], [8, 12, 14], [6, 8, 12], [10, 14, 16]]); const s = rng.shuffle([...base]); const [kn, kd] = rng.pick([[2, 1], [3, 1], [1, 2], [3, 2]]); if (kd === 2 && s.some((x) => x % 2)) throw new GenFail("정수"); const kv = kn / kd;
        const n = triNames(rng), m = triNames(rng); const T = (a: number[]) => triB(m, { sides: rng.shuffle([...a]) });
        const ok = s.map((x) => x * kv); const inv = s.map((x) => (x * kd) / kn); if (inv.some((x) => !Number.isInteger(x) || x <= 0)) throw new GenFail("역수 정수");
        const other = s.map((x) => x * (kv === 2 ? 3 : 2)); const add = s.map((x) => x + Math.round(Math.abs(kv - 1) * 4) + 2);
        if (!validTri(ok[0], ok[1], ok[2]) || !validTri(inv[0], inv[1], inv[2]) || !validTri(other[0], other[1], other[2]) || !validTri(add[0], add[1], add[2])) throw new GenFail("삼각형");
        const kTex = kd === 1 ? `${kn}` : `\\frac{${kn}}{${kd}}`;
        return bundle(rng, { stimulus: intro(rng, n, ` Triangle $${m.join("")}$ is a dilation of triangle $${n.join("")}$ with scale factor $${kTex}$, and its side lengths are among the labeled choices.`), question: `Which triangle is the image of triangle $${n.join("")}$ under this dilation?`, stem: triB(n, { sides: s }), correct: T(ok), wrong: [{ fig: T(inv), rule: "DIL_INVERSE" }, { fig: T(other), rule: "DIL_OTHER_FACTOR" }, { fig: T(add), rule: "DIL_ADD" }], P: { kn, kd }, predicateJs: `${TRI_JS}const a=srt(TRI(STEM).S), b=srt(TRI(c).S); return b.every((x,i)=>Math.abs(x-a[i]*P.kn/P.kd)<1e-9);`, diagnoseJs: `${TRI_JS}const a=srt(TRI(STEM).S), b=srt(TRI(c).S); const r=b.map((x,i)=>x/a[i]); if (r.every(x=>Math.abs(x-r[0])<1e-9)) return Math.abs(r[0]-P.kd/P.kn)<1e-9?"DIL_INVERSE":"DIL_OTHER_FACTOR"; return "DIL_ADD";`,
          trace: [rd("기준 삼각형의 세 변"), [`닮음비 ${kn}${kd === 1 ? "" : `/${kd}`} 이므로 각 변에 ${kn}${kd === 1 ? "" : `/${kd}`} 를 곱한다.`, "Multiply every side by the scale factor."], [`변 ${[...s].sort((a, b) => a - b).join(", ")} 은 ${[...ok].sort((a, b) => a - b).join(", ")} 이 된다.`, "Compute the image sides."], [`역수를 곱하면 ${[...inv].sort((a, b) => a - b).join(", ")} 이 된다.`, "The reciprocal factor gives a different triangle."], [`따라서 ${[...ok].sort((a, b) => a - b).join(", ")} 인 삼각형이 정답이다.`, "Pick the scaled triangle."]], variant: `dilation_${kn}_${kd}` });
      },
    },
    {
      op: "compose_kind", structure: "닮은 삼각형의 둘레가 주어질 때 닮음비를 구해 변이 닮음비만큼 곱해진 삼각형을 고름", extra: "둘레의 비로 닮음비를 구하고 각 변에 곱해야 함(둘레만 맞는 닮지 않은 삼각형을 고르는 함정) — medium 은 닮음비가 주어진 경우", sprNo: SPR_NO_B,
      concepts: ["닮은 삼각형", "둘레의 비", "닮음비"],
      gen(rng) {
        const s = baseTri(rng); const per = s[0] + s[1] + s[2]; const k = rng.pick([2, 3, 4]); const P = per * k; const n = triNames(rng), m = triNames(rng); const T = (a: number[]) => triB(m, { sides: rng.shuffle([...a]) });
        const ok = s.map((x) => x * k); const k2 = k === 2 ? 3 : 2; const wrongSim = s.map((x) => x * k2);
        const dd = (P - per) / 3; if (!Number.isInteger(dd) || dd <= 0) throw new GenFail("합동 증가"); const add = s.map((x) => x + dd);
        // 둘레만 맞는 닮지 않은 삼각형: 변 두 개를 ±t
        const t = rng.int(1, 3); const only = [ok[0] + t, ok[1] - t, ok[2]]; if (!validTri(only[0], only[1], only[2]) || only.some((x) => x <= 0)) throw new GenFail("삼각형");
        if (![ok, wrongSim, add, only].every((a) => validTri(a[0], a[1], a[2]))) throw new GenFail("삼각형");
        return bundle(rng, { stimulus: intro(rng, n, ` A triangle similar to triangle $${n.join("")}$ has a perimeter of ${P}.`), question: `Which of the triangles shown could be that triangle?`, stem: triB(n, { sides: s }), correct: T(ok), wrong: [{ fig: T(only), rule: "PERIM_ONLY" }, { fig: T(wrongSim), rule: "SIM_WRONG_PERIM" }, { fig: T(add), rule: "PERIM_ADD" }], P: { per: P },
          predicateJs: `${TRI_JS}const a=srt(TRI(STEM).S), b=srt(TRI(c).S); const r=b.map((x,i)=>x/a[i]); return r.every(x=>Math.abs(x-r[0])<1e-9)&&Math.abs(b[0]+b[1]+b[2]-P.per)<1e-9;`,
          diagnoseJs: `${TRI_JS}const a=srt(TRI(STEM).S), b=srt(TRI(c).S); const sum=b[0]+b[1]+b[2]; const d=b.map((x,i)=>x-a[i]); const prop=(()=>{ const r=b.map((x,i)=>x/a[i]); return r.every(x=>Math.abs(x-r[0])<1e-9); })(); if (prop) return "SIM_WRONG_PERIM"; if (d.every(x=>Math.abs(x-d[0])<1e-9)) return "PERIM_ADD"; return Math.abs(sum-P.per)<1e-9?"PERIM_ONLY":null;`,
          trace: [rd("기준 삼각형의 세 변"), [`기준 삼각형의 둘레 = ${s.join(" + ")} = ${per} 이다.`, "Perimeter of the given triangle."], [`닮음비 = ${P} ÷ ${per} = ${k} 이다.`, "Ratio of perimeters."], [`변 ${[...s].sort((x, y) => x - y).join(", ")} 에 ${k} 를 곱하면 ${[...ok].sort((x, y) => x - y).join(", ")} 이다.`, "Scale every side."], [`둘레만 ${P} 이고 닮지 않은 삼각형은 오답이다.`, "Perimeter alone is not enough."]], variant: `similar_with_perimeter_${k}` });
      },
    },
  ],
  em: [
    {
      lv: "easy", name: "sss_double", structure: "기준 삼각형의 변을 2 배 한 삼각형(SSS 비례)을 고름", extra: "easy: 닮음비 2", sprNo: SPR_NO_B, concepts: ["닮은 삼각형", "닮음비"],
      gen(rng) {
        const sc = sssScene(rng, 2);
        return bundle(rng, { stimulus: intro(rng, sc.n), question: rng.pick(Q(sc.n)), stem: sc.stem, correct: sc.correct, wrong: sc.wrong, P: {}, predicateJs: SIDES_PRED, diagnoseJs: SIDES_DIAG, trace: [rd("기준 삼각형의 세 변"), [`변이 모두 2 배인 삼각형이 닮음이다.`, "Every side doubled."]], variant: "easy_sss_double" });
      },
    },
    {
      lv: "medium", name: "aa_same_pair", structure: "기준 삼각형과 같은 두 각이 라벨된 삼각형(AA)을 고름", extra: "medium: 두 각이 같으면 닮음", sprNo: SPR_NO_B, concepts: ["닮은 삼각형", "AA 닮음"],
      gen(rng) {
        const { a, b, d1, e, u1, u2 } = aaScene(rng); const n = triNames(rng), m = triNames(rng); const stem = triB(n, { angles: [a, b] }); const T = (x: number[]) => triB(m, { angles: x });
        return bundle(rng, { stimulus: intro(rng, n), question: rng.pick(Q(n)), stem, correct: T([b, a]), wrong: [{ fig: T([a, d1]), rule: "AA_ONE_SHARED" }, { fig: T([180 - a, e]), rule: "AA_SUPPLEMENT" }, { fig: T([u1, u2]), rule: "AA_UNRELATED" }], P: {}, predicateJs: AA_PRED, diagnoseJs: AA_DIAG, trace: [rd("두 각"), [`같은 두 각 ${a}°, ${b}° 를 가진 삼각형이 닮음(AA)이다.`, "Two equal angles give similarity."], [`다른 선택지는 한 각만 같다.`, "Others share only one angle."]], variant: "medium_aa_same_pair" });
      },
    },
  ],
});
void BASE3;
