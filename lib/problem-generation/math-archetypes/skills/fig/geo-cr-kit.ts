// 평행선 두 개 + 서로 아래에서 만나는 횡단선 두 개(삼각형 XPQ) 장면 키트 — exterior_angle.PT.P·triangle_angle_sum.PT.P 가 함께 쓴다.
// 모델: 횡단선 p(오른쪽 아래로 기울어짐)·q(왼쪽 아래로)가 아래 평행선 n 과 P·Q 에서 만나고 n 아래 X 에서 서로 만난다. 평행선과 이루는 예각이 p 는 al, q 는 be, 꼭대기 각 ga = 180° − al − be.
// 그림은 crossing.slants = [al, be] 로 이 각대로 그려지고, 모든 라벨의 value(비인쇄)는 참값이다. 쐐기: (평행선, p) 에서 NW·SE = al, NE·SW = 180° − al / (평행선, q) 에서 NE·SW = be, NW·SE = 180° − be / (p, q) 에서 N·S = ga, E·W = 180° − ga.
import { GenFail } from "../../types";
import type { Rng } from "../../rng";
import { exprLabel } from "./tri-kit";
import { lead } from "./geo-kit";

export type CrScene = { par: [string, string]; tr: [string, string]; P: string; Q: string; X: string; al: number; be: number; ga: number };
/** 장면: 평행선 이름은 m·n 이 아닌 쌍도 쓴다. 예각 al·be 는 46~74 의 서로 다른 정수(꼭대기 각 60° 이상 — 좁으면 그 라벨이 꼭짓점에서 멀리 놓여 밑각 라벨과 뒤섞인다). */
export function crScene(rng: Rng, o: { alMin?: number; alMax?: number } = {}): CrScene {
  const par: [string, string] = rng.pick([["m", "n"], ["j", "k"], ["a", "b"], ["u", "v"]] as [string, string][]);
  const tr: [string, string] = rng.pick(([["p", "q"], ["s", "t"], ["r", "w"], ["c", "d"]] as [string, string][]).filter((t) => !t.some((n) => par.includes(n))));
  const pts = rng.shuffle(["P", "Q", "X", "R", "S", "T", "U", "V", "W", "Y", "Z", "A", "B", "C", "D", "E", "F", "G", "H"].filter((n) => !par.includes(n.toLowerCase()) && !tr.includes(n.toLowerCase()))).slice(0, 3);
  for (let t = 0; t < 100; t++) {
    const al = rng.int(o.alMin ?? 46, o.alMax ?? 74), be = rng.int(o.alMin ?? 46, o.alMax ?? 74); const ga = 180 - al - be; if (al === be || ga < 60 || ga === al || ga === be) continue; // 꼭대기 각이 좁으면 그 라벨이 꼭짓점에서 멀리 놓여 밑각 라벨과 뒤섞인다 → 60° 이상
    return { par, tr, P: pts[0], Q: pts[1], X: pts[2], al, be, ga };
  }
  throw new GenFail("교차 장면 표집 실패");
}
export type CrAt = "mp" | "np" | "mq" | "nq" | "X";
export type CrAng = { at: CrAt; region: "NE" | "NW" | "SE" | "SW" | "N" | "S" | "E" | "W"; label: string };
/** 쐐기의 참값. */
export function crMeasure(sc: CrScene, at: CrAt, region: string): number {
  if (at === "X") return region === "N" || region === "S" ? sc.ga : 180 - sc.ga;
  if (at === "mp" || at === "np") return region === "NW" || region === "SE" ? sc.al : 180 - sc.al;
  return region === "NE" || region === "SW" ? sc.be : 180 - sc.be;
}
const pairOf = (sc: CrScene, at: CrAt): [string, string] => (at === "X" ? [sc.tr[0], sc.tr[1]] : at === "mp" ? [sc.par[0], sc.tr[0]] : at === "np" ? [sc.par[1], sc.tr[0]] : at === "mq" ? [sc.par[0], sc.tr[1]] : [sc.par[1], sc.tr[1]]);
export function crFig(sc: CrScene, angs: CrAng[]) {
  return {
    type: "parallel_transversal", parallel: sc.par, transversals: [{ id: sc.tr[0] }, { id: sc.tr[1] }], crossing: { side: "below", slants: [sc.al, sc.be] },
    points: [{ id: sc.P, on: [sc.par[1], sc.tr[0]] }, { id: sc.Q, on: [sc.par[1], sc.tr[1]] }, { id: sc.X, on: [sc.tr[0], sc.tr[1]] }],
    angles: angs.map((a) => ({ at: pairOf(sc, a.at), region: a.region, label: a.label, value: crMeasure(sc, a.at, a.region) })),
  };
}
/** 식 라벨: a x + b = m (a 1~4, |b| ≤ 60). */
export function crExpr(rng: Rng, m: number, x: number, aMin = 1, aMax = 4): { a: number; b: number; label: string } {
  for (let tr = 0; tr < 40; tr++) { const a = rng.int(aMin, aMax); const b = m - a * x; if (Math.abs(b) <= 60) return { a, b, label: exprLabel(a, b) }; }
  throw new GenFail("식 라벨 표집 실패");
}
export const crNum = (n: number) => `${n}°`;

/**
 * FIGURE 에서 al·be·x 를 푸는 JS. 각 라벨(숫자·a x + b)이 하나의 식 `a·x + b = c + ca·al + cb·be` 가 된다(위치가 c·ca·cb 를 정한다). 식들을 가우스 소거로 풀고,
 * 미지수(al·be, x 는 식 라벨이 있을 때만)가 모두 정해지지 않거나 식이 서로 어긋나면 던진다. 변수: AL, BE, GA, X(NaN 이면 x 없음), meas(at, region) — at 은 [선, 선].
 */
export const CR_JS = `const TR=FIGURE.transversals.map(t=>t.id), PAR=FIGURE.parallel; const parseL=(l)=>{ const t=String(l).replace(/[°\\s()]/g,'').replace(/−/g,'-'); let m=/^(\\d*)x([+-]\\d+)?$/.exec(t); if (m) return {a:m[1]===''?1:Number(m[1]), b:m[2]?Number(m[2]):0}; m=/^(\\d+(?:\\.\\d+)?)$/.exec(t); if (m) return {a:0, b:Number(m[1])}; throw new Error('각 라벨 형식 오류: '+l); };
const lin=(at,region)=>{ const ia=TR.indexOf(at[0]), ib=TR.indexOf(at[1]); if (ia>=0&&ib>=0) return (region==='N'||region==='S')?{c:180,ca:-1,cb:-1}:{c:0,ca:1,cb:1}; const ti=ia>=0?ia:ib; if (ti<0) throw new Error('횡단선 없음'); const acute=ti===0?(region==='NW'||region==='SE'):(region==='NE'||region==='SW'); return ti===0?(acute?{c:0,ca:1,cb:0}:{c:180,ca:-1,cb:0}):(acute?{c:0,ca:0,cb:1}:{c:180,ca:0,cb:-1}); };
const rows=FIGURE.angles.filter(g=>g.label).map(g=>{ const L=parseL(g.label), q=lin(g.at,g.region); return [L.a,-q.ca,-q.cb,q.c-L.b]; });
const hasX=rows.some(r=>r[0]!==0); const cols=hasX?[1,2,0]:[1,2]; const n=cols.length; const M=rows.map(r=>[...cols.map(c=>r[c]),r[3]]);
let rank=0; for (let c=0;c<n;c++){ let p=-1; for (let r=rank;r<M.length;r++) if (Math.abs(M[r][c])>1e-9){p=r;break;} if (p<0) continue; [M[rank],M[p]]=[M[p],M[rank]]; const pv=M[rank][c]; M[rank]=M[rank].map(v=>v/pv); for (let r=0;r<M.length;r++) if (r!==rank){ const f=M[r][c]; if (f!==0) M[r]=M[r].map((v,k)=>v-f*M[rank][k]); } rank++; }
if (rank<n) throw new Error('각 정보 부족'); for (let r=rank;r<M.length;r++) if (Math.abs(M[r][n])>1e-9) throw new Error('각 라벨이 서로 맞지 않음');
const AL=M[0][n], BE=M[1][n], X=hasX?M[2][n]:NaN, GA=180-AL-BE; if (!(AL>0&&AL<180&&BE>0&&BE<180&&GA>0)) throw new Error('각 범위');
const meas=(at,region)=>{ const q=lin(at,region); return q.c+q.ca*AL+q.cb*BE; };
`;

const SCENE_OPEN = (sc: CrScene) => [
  `In the figure shown, lines $${sc.par[0]}$ and $${sc.par[1]}$ are parallel. Transversals $${sc.tr[0]}$ and $${sc.tr[1]}$ meet at point $${sc.X}$ and cross line $${sc.par[1]}$ at points $${sc.P}$ and $${sc.Q}$, forming triangle $${sc.X}${sc.P}${sc.Q}$.`,
  `The figure shows parallel lines $${sc.par[0]}$ and $${sc.par[1]}$ cut by transversals $${sc.tr[0]}$ and $${sc.tr[1]}$. The transversals intersect at point $${sc.X}$ and meet line $${sc.par[1]}$ at points $${sc.P}$ and $${sc.Q}$, so triangle $${sc.X}${sc.P}${sc.Q}$ is formed.`,
  `Lines $${sc.par[0]}$ and $${sc.par[1]}$ in the figure are parallel. Transversals $${sc.tr[0]}$ and $${sc.tr[1]}$ meet at point $${sc.X}$, crossing line $${sc.par[1]}$ at $${sc.P}$ and $${sc.Q}$ to form triangle $${sc.X}${sc.P}${sc.Q}$.`,
];
export const crIntro = (rng: Rng, sc: CrScene, extra = "") => `${lead(rng)}${rng.pick(SCENE_OPEN(sc))} Some angle measures are marked in degrees.${extra}`.replace(/ {2,}/g, " ");
