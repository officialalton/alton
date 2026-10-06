// 변을 연장한 삼각형(바깥각) 장면 키트 — exterior_angle.TR.P·vertical_supplementary_angles.TR.P 가 함께 쓴다.
// 모델: 삼각형 꼭짓점 v[0](위)·v[1](왼쪽 아래)·v[2](오른쪽 아래). 변 from→at 를 at 너머로 연장해 끝점 D 를 둔다. 바깥각 = 연장선과 at 의 다른 변 사이 각 = 180° − (at 의 내각) = 나머지 두 내각의 합.
// 그림: 세 내각의 참값은 angles[].value(비인쇄)로 주어 도형이 참값대로 그려지고, 라벨은 일부 각에만 붙는다. 바깥각 라벨은 extend.label.
// verification_js 는 FIGURE 의 라벨만 읽어 x 를 풀고(여러 식이 있으면 서로 일관되는지 확인) 바깥각·내각·나머지 각을 다시 계산한다.
import { GenFail } from "../../types";
import type { Rng } from "../../rng";
import { ANG_PARSE_JS, exprLabel, pickNames, type Tri3 } from "./tri-kit";

export type ExtScene = {
  v: Tri3; at: number; from: number; /** at 가 아닌 두 꼭짓점의 인덱스(오름차순) */ rem: [number, number]; end: string;
  /** 참값: 나머지 두 내각 r[0], r[1](rem 순서), at 의 내각 inner, 바깥각 outer = r0 + r1 = 180 − inner */
  r: [number, number]; inner: number; outer: number;
};
/** 장면 표집: 연장 위치(오른쪽 아래에서 오른쪽으로 · 왼쪽 아래에서 왼쪽으로 · 위 꼭짓점 너머로) — 나머지 두 내각은 36~80°, 따라서 바깥각 72~160°. */
export function makeExtScene(rng: Rng, o: { rMin?: number; rMax?: number } = {}): ExtScene {
  const names = pickNames(rng); const v: Tri3 = [names[0], names[1], names[2]];
  const pool = "ABCDEFGHJKLMNPQRSTUVWXYZ".split("").filter((n) => !v.includes(n)); const end = rng.pick(pool);
  const at = rng.pick([2, 2, 1, 0]); const from = at === 2 ? 1 : at === 1 ? 2 : rng.pick([1, 2]);
  const rem = ([0, 1, 2].filter((i) => i !== at)) as [number, number];
  for (let tr = 0; tr < 200; tr++) {
    const r0 = rng.int(o.rMin ?? 36, o.rMax ?? 80), r1 = rng.int(o.rMin ?? 36, o.rMax ?? 80); const outer = r0 + r1; const inner = 180 - outer;
    if (r0 === r1 || inner < 20 || inner > 100 || inner === 90) continue;
    return { v, at, from, rem, end, r: [r0, r1], inner, outer };
  }
  throw new GenFail("바깥각 장면 표집 실패");
}
const nameOf = (sc: ExtScene, i: number) => sc.v[i];
/** 그림 spec: labels = { r0, r1, inner, outer } 중 라벨을 줄 각(문자열). 나머지 각은 value 만(비인쇄). */
export function extFig(sc: ExtScene, labels: { r0?: string; r1?: string; inner?: string; outer?: string }, o: { end?: boolean } = {}) {
  const val = (i: number) => (i === sc.at ? sc.inner : sc.r[sc.rem.indexOf(i)]);
  const lab = (i: number) => (i === sc.at ? labels.inner : sc.rem.indexOf(i) === 0 ? labels.r0 : labels.r1);
  return {
    type: "triangle", kind: "scalene", vertices: sc.v,
    angles: [0, 1, 2].map((i) => ({ at: nameOf(sc, i), ...(lab(i) !== undefined ? { label: lab(i) } : {}), value: val(i) })),
    extend: { from: nameOf(sc, sc.from), at: nameOf(sc, sc.at), ...(labels.outer !== undefined ? { label: labels.outer } : {}), ...(o.end === false ? {} : { end: sc.end }) },
  };
}
/** a x + b 가 m 이 되도록 식 라벨 만들기(a 1~4, |b| ≤ 60). */
export function exprFor(rng: Rng, m: number, x: number, aMin = 1, aMax = 4): { a: number; b: number; label: string } {
  for (let tr = 0; tr < 40; tr++) { const a = rng.int(aMin, aMax); const b = m - a * x; if (Math.abs(b) <= 60) return { a, b, label: exprLabel(a, b) }; }
  throw new GenFail("식 라벨 표집 실패");
}
export const numLab = (n: number) => `${n}°`;

/**
 * FIGURE 에서 x·각을 푸는 JS. 변수: x(NaN 이면 식 라벨 없음), R0·R1(나머지 두 내각 — vertices 순서로 at 가 아닌 둘), IN(at 의 내각), OUT(바깥각), ATNAME.
 * 세 관계(바깥각 = R0 + R1 · IN + OUT = 180 · IN + R0 + R1 = 180) 중 모든 항이 라벨된 것으로 x 를 풀고, 라벨된 관계가 둘 이상이면 서로 일관되는지 본다.
 * 라벨이 없는 각은 관계에서 유도한다(바깥각 없음 → R0 + R1, 내각 없음 → 180 − 바깥각).
 */
export const EXT_JS = `${ANG_PARSE_JS}const V=FIGURE.vertices, EX=FIGURE.extend; if (!EX) throw new Error('연장 정보 없음'); const AT=EX.at; if (!V.includes(AT)||!V.includes(EX.from)||AT===EX.from) throw new Error('연장 꼭짓점 오류'); const ot=V.filter(v=>v!==AT); const lab=(v)=>{ const q=(FIGURE.angles||[]).find(g=>g.at===v); return q&&q.label!==undefined?parseAng(q.label):null; };
let L0=lab(ot[0]), L1=lab(ot[1]), LI=lab(AT), LO=EX.label!==undefined?parseAng(EX.label):null;
const sub=(p,q,s)=>({a:p.a+s*q.a,b:p.b+s*q.b}); const eqs=[];
if (LO&&L0&&L1) eqs.push({a:LO.a-L0.a-L1.a,b:LO.b-L0.b-L1.b});
if (LI&&LO) eqs.push({a:LI.a+LO.a,b:LI.b+LO.b-180});
if (LI&&L0&&L1) eqs.push({a:LI.a+L0.a+L1.a,b:LI.b+L0.b+L1.b-180});
let x=NaN; for (const e of eqs){ if (e.a!==0){ x=-e.b/e.a; break; } }
for (const e of eqs){ if (Number.isFinite(x)? Math.abs(e.a*x+e.b)>1e-9 : Math.abs(e.b)>1e-9) throw new Error('각 라벨이 서로 맞지 않음'); }
const ev=(p)=>p===null?null:(p.a===0?p.b:(Number.isFinite(x)?p.a*x+p.b:NaN));
let R0=ev(L0), R1=ev(L1), IN=ev(LI), OUT=ev(LO);
if (OUT===null&&R0!==null&&R1!==null) OUT=R0+R1; if (OUT===null&&IN!==null) OUT=180-IN; if (IN===null&&OUT!==null) IN=180-OUT;
if (OUT===null||IN===null) throw new Error('각 정보 부족');
if (!(OUT>0&&OUT<180&&IN>0&&IN<180)) throw new Error('각 범위');
if (R0!==null&&R1!==null&&Math.abs(R0+R1-OUT)>1e-9) throw new Error('바깥각 정리 위반');
if (R0===null&&R1!==null) R0=OUT-R1; if (R1===null&&R0!==null) R1=OUT-R0; if (R0!==null&&!(R0>0)) throw new Error('나머지 각 오류'); if (R1!==null&&!(R1>0)) throw new Error('나머지 각 오류');
`;

const LEAD = ["", "", "A student draws a triangle for a geometry assignment. ", "A teacher posts the triangle below on the board. ", "A designer sketches a triangular flag. ", "An architect sketches a triangular gable. ", "A surveyor records the corners of a triangular lot. "];
export const extIntro = (rng: Rng, sc: ExtScene, extra = "") => {
  const t = sc.v.join(""), f = nameOf(sc, sc.from), a = nameOf(sc, sc.at);
  return rng.pick(LEAD) + rng.pick([
    `In triangle $${t}$ shown, side $${f}${a}$ is extended past $${a}$ to point $${sc.end}$. Some angle measures are labeled in degrees.${extra}`,
    `The figure shows triangle $${t}$ with side $${f}${a}$ extended beyond $${a}$ to point $${sc.end}$. Angle measures are given in degrees.${extra}`,
    `In the figure, $${f}${a}$ of triangle $${t}$ is extended through $${a}$ to point $${sc.end}$, and some angles are labeled in degrees.${extra}`,
    `Side $${f}${a}$ of triangle $${t}$ is extended to point $${sc.end}$ as shown, and the labeled angle measures are in degrees.${extra}`,
    `Triangle $${t}$ is shown with side $${f}${a}$ extended past vertex $${a}$ to point $${sc.end}$; the angle measures in the figure are in degrees.${extra}`,
  ]);
};
export const vname = nameOf;
/** 렌더 가드(라벨 겹침)로 GenFail 이 나면 같은 난수 흐름에서 장면을 다시 뽑는다(최대 tries 번) — 생성 실패율을 0 으로 만든다. */
export function retry<T>(rng: Rng, fn: () => T, tries = 16): T {
  let last: unknown;
  for (let i = 0; i < tries; i++) { try { return fn(); } catch (e) { if (!(e instanceof GenFail)) throw e; last = e; void rng; } }
  throw last;
}
