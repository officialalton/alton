// 평행선·횡단선(PT) 계열 자료 원형 공용 장면 키트 — geo-kit 위에 쌓는다. 조합 파일들이 함께 쓴다.
// 모델: 횡단선이 평행선과 이루는 예각 θ. 횡단선이 오른쪽으로 기울면(right) 교점의 NW·SE 쐐기가 θ, NE·SW 쐐기가 180° − θ (왼쪽 기울기는 반대).
// 각 라벨은 숫자("118°")·x 의 식("(2x + 10)°")·미지수("y°") 중 하나이고, 그림은 angles[].value(비인쇄 참값)대로 기울어 그려진다.
// verification_js 는 FIGURE 의 영역(region)·기울기·라벨만 읽어 θ·x·y 를 연립해 다시 푼다(모든 식이 서로 일관되지 않으면 던진다 — 변조 검출).
import { GenFail } from "../../types";
import type { Rng } from "../../rng";
import { exprLabel } from "./tri-kit";

export type Region = "NE" | "NW" | "SE" | "SW";
export const REGIONS: Region[] = ["NE", "NW", "SE", "SW"];
export type PtScene = { par: [string, string]; tr: string[]; slant: ("right" | "left")[]; theta: number };
const PAR_SETS: [string, string][] = [["m", "n"], ["j", "k"], ["p", "q"], ["a", "b"], ["u", "v"], ["c", "d"]];
const TR_IDS = ["t", "s", "r", "w", "z", "e"];

/** 장면: 평행선 이름 2·횡단선 nTrans 개(서로 나란함). θ 는 64~80 정수(좁은 쐐기일수록 렌더러가 라벨을 호에서 멀리 놓아 어느 각의 라벨인지 모호해진다). */
export function ptScene(rng: Rng, nTrans: 1 | 2, o: { theta?: number; slant?: "right" | "left" } = {}): PtScene {
  const par = rng.pick(PAR_SETS); const tr = rng.shuffle(TR_IDS.filter((t) => !par.includes(t))).slice(0, nTrans); const sl = o.slant ?? rng.pick(["right", "right", "left"] as const);
  return { par, tr, slant: tr.map(() => sl), theta: o.theta ?? rng.int(64, 80) };
}
const isAcute = (region: string, slant: "right" | "left") => (region === "NW" || region === "SE") === (slant === "right");
/** 교점 (평행선 line, 횡단선 ti)의 region 쐐기 각의 크기. */
export const measure = (sc: PtScene, ti: number, region: Region) => (isAcute(region, sc.slant[ti]) ? sc.theta : 180 - sc.theta);
export type AngDef = { line: 0 | 1; ti: number; region: Region; label: string };
/** 그림의 angles 항목: value 는 참값(비인쇄). */
export const angOf = (sc: PtScene, a: AngDef) => ({ at: [sc.par[a.line], sc.tr[a.ti]] as [string, string], region: a.region, label: a.label, value: measure(sc, a.ti, a.region) });
export function ptFig(sc: PtScene, angs: AngDef[], o: { points?: { id: string; line: 0 | 1; ti: number }[] } = {}) {
  return {
    type: "parallel_transversal", parallel: sc.par, transversals: sc.tr.map((id, i) => ({ id, slant: sc.slant[i] })),
    ...(o.points ? { points: o.points.map((p) => ({ id: p.id, on: [sc.par[p.line], sc.tr[p.ti]] as [string, string] })) } : {}),
    angles: angs.map((a) => angOf(sc, a)),
  };
}
/** a x + b = m 이 되는 식 라벨(계수 a 1~4, 상수 b |b| ≤ 60). 못 만들면 GenFail. */
export function exprFor(rng: Rng, m: number, x: number, aMin = 1, aMax = 4): { a: number; b: number; label: string } {
  for (let tr = 0; tr < 40; tr++) { const a = rng.int(aMin, aMax); const b = m - a * x; if (Math.abs(b) <= 60) return { a, b, label: exprLabel(a, b) }; }
  throw new GenFail("식 라벨 표집 실패");
}
export const numLabel = (n: number) => `${n}°`;
/** 두 식(또는 숫자) 라벨 연립이 유일한 해를 갖는가: 각 계수 a 와 (s: 예각 +1 / 둔각 −1) 로 det ≠ 0. */
export const sOf = (sc: PtScene, ti: number, region: Region) => (isAcute(region, sc.slant[ti]) ? 1 : -1);

/**
 * FIGURE 에서 θ·x 를 푸는 JS(변수: theta, x, rows[i] = {a, b, s, c, kind, label, region, at}).
 * 각 i: (a x + b) = c + s·θ (예각 s=+1,c=0 / 둔각 s=−1,c=180). 숫자 라벨은 a=0, 'y°'·'x°' 형 미지수는 풀이에 쓰지 않는다(kind 'y').
 */
export const PT_JS = `const TR=FIGURE.transversals; const slantOf=(i)=>((TR[i].slant!==undefined?TR[i].slant:(i===0?'right':(TR[0].slant||'right')))==='right'); const parseL=(l)=>{ const t=String(l).replace(/[°\\s()]/g,'').replace(/−/g,'-'); let m=/^(\\d*)x([+-]\\d+)?$/.exec(t); if (m) return {a:m[1]===''?1:Number(m[1]), b:m[2]?Number(m[2]):0, kind:'expr'}; m=/^(\\d+(?:\\.\\d+)?)$/.exec(t); if (m) return {a:0,b:Number(m[1]),kind:'num'}; if (/^[a-z]$/i.test(t)) return {a:0,b:0,kind:'y'}; throw new Error('각 라벨 형식 오류: '+l); };
const rows=FIGURE.angles.filter(g=>g.label).map(g=>{ const ti=TR.findIndex(t=>g.at.includes(t.id)); if (ti<0) throw new Error('횡단선 없음'); const ac=((g.region==='NW'||g.region==='SE')===slantOf(ti)); return Object.assign({region:g.region,ti:ti,label:g.label,s:ac?1:-1,c:ac?0:180}, parseL(g.label)); });
const eq=rows.filter(r=>r.kind!=='y'); let theta=NaN, x=NaN;
const nums=eq.filter(r=>r.kind==='num'), exps=eq.filter(r=>r.kind==='expr');
if (nums.length){ theta=(nums[0].b-nums[0].c)/nums[0].s; }
if (exps.length){ if (!Number.isFinite(theta)){ const e1=exps[0]; const e2=exps.find(e=>e.a*(-e1.s)-e1.a*(-e.s)!==0); if(!e2) throw new Error('연립 불가'); const det=e1.a*(-e2.s)-e2.a*(-e1.s); x=((e1.c-e1.b)*(-e2.s)-(e2.c-e2.b)*(-e1.s))/det; theta=(e1.a*(e2.c-e2.b)-e2.a*(e1.c-e1.b))/det; } else { const e1=exps.find(e=>e.a!==0); if(!e1) throw new Error('x 없음'); x=(e1.c+e1.s*theta-e1.b)/e1.a; } }
if (!Number.isFinite(theta)) throw new Error('각 정보 부족');
for (const r of eq){ const lhs=r.kind==='num'?r.b:r.a*x+r.b; if (Math.abs(lhs-(r.c+r.s*theta))>1e-9) throw new Error('각 라벨이 서로 맞지 않음'); }
if (!(theta>0&&theta<180)) throw new Error('θ 범위');
const angleOf=(label)=>{ const r=rows.find(q=>q.label===label); if(!r) throw new Error('라벨 없음: '+label); return r.c+r.s*theta; };
`;
/** 평행선 두 개·횡단선들을 설명하는 도입 문장 조각. */
export const parText = (sc: PtScene) => `lines $${sc.par[0]}$ and $${sc.par[1]}$ are parallel`;
export const trText = (sc: PtScene) => (sc.tr.length === 1 ? `transversal $${sc.tr[0]}$` : `transversals $${sc.tr[0]}$ and $${sc.tr[1]}$, which are also parallel to each other`);
import { lead } from "./geo-kit";
const PS1 = (sc: PtScene) => [`In the figure shown, ${parText(sc)} and are cut by ${trText(sc)}.`, `The figure shows ${parText(sc)}, with ${trText(sc)} crossing them.`, `Lines $${sc.par[0]}$ and $${sc.par[1]}$ in the figure shown are parallel, and ${trText(sc)} intersects both.`, `In the diagram shown, ${trText(sc)} crosses the two parallel lines $${sc.par[0]}$ and $${sc.par[1]}$.`, `Consider the figure shown, where ${parText(sc)} and ${trText(sc)} cuts across them.`, `A figure is shown in which ${parText(sc)}; ${trText(sc)} is drawn across both lines.`];
const PS2 = ["Some angle measures are marked in degrees.", "The marked angles are measured in degrees.", "Several angles are labeled with their measures, in degrees.", "Angle measures, in degrees, are marked in the figure.", "The angles marked in the figure are measured in degrees."];
export const ptIntro = (rng: Rng, sc: PtScene, extra = "") => `${lead(rng)}${rng.pick(PS1(sc))} ${rng.pick(PS2)}${extra}`.replace(/ {2,}/g, " ");
/** 두 쐐기 사이의 관계: 같은 종류(둘 다 예각 또는 둘 다 둔각)면 같다, 다르면 합 180°. */
export const relText = (sc: PtScene, r1: { ti: number; region: Region }, r2: { ti: number; region: Region }): [string, string] =>
  sOf(sc, r1.ti, r1.region) === sOf(sc, r2.ti, r2.region) ? ["두 각은 크기가 같다(동위각·엇각·맞꼭지각 관계).", "These two angles are equal."] : ["두 각은 합이 180° 이다(보각·동측내각 관계).", "These two angles add to 180°."];
