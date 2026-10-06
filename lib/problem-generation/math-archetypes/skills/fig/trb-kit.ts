// 삼각형 B형(TR.B) 공용 키트 — 기준 삼각형(stem)과 선택지 삼각형 4개. 변·각 라벨은 숫자이고 도식은 not drawn to scale(라벨 길이와 그려진 길이가 다를 수 있음).
import { GenFail } from "../../types";
import type { Rng } from "../../rng";

const LET = "ABCDEFGHJKLMNPQRSTUVWXYZ".split("");
export const triNames = (rng: Rng): [string, string, string] => { const s = rng.shuffle(LET).slice(0, 3).sort(); return [s[0], s[1], s[2]]; };
/** 변 순서 AB·BC·CA, 각 순서 A·B·C. 값이 undefined 이면 라벨 없음. */
export function triB(v: [string, string, string], o: { sides?: (number | undefined)[]; angles?: (number | undefined)[]; right?: number }) {
  const sides = (o.sides ?? []).map((n, i) => (n === undefined ? null : { between: [v[i], v[(i + 1) % 3]] as [string, string], label: String(n) })).filter(Boolean);
  const angles = (o.angles ?? []).map((a, i) => (a === undefined ? null : { at: v[i], label: `${a}°` })).filter(Boolean);
  return { type: "triangle" as const, vertices: v, ...(o.right !== undefined ? { kind: "right" as const, rightAngleAt: v[o.right] } : {}), ...(sides.length ? { sides } : {}), ...(angles.length ? { angles } : {}), notToScale: true };
}
/** FIGURE(triangle)에서 변 S=[AB,BC,CA] (숫자, 없으면 NaN) 과 각 A=[A,B,C] (숫자, 하나만 비면 180 에서 구함) 를 읽는 JS 함수 TRI(f). */
export const TRI_JS = `const TRI=(f)=>{ if(!f||f.type!=='triangle') throw new Error('삼각형 자료 필요'); const V=f.vertices; const S=[NaN,NaN,NaN]; (f.sides||[]).forEach(s=>{ const i=V.indexOf(s.between[0]), j=V.indexOf(s.between[1]); const k=(i===0&&j===1)||(i===1&&j===0)?0:(i===1&&j===2)||(i===2&&j===1)?1:2; S[k]=/^\\d+(?:\\.\\d+)?$/.test(String(s.label))?Number(s.label):NaN; }); const A=V.map(n=>{ const a=(f.angles||[]).find(q=>q.at===n); if(!a) return NaN; const m=/^(\\d+(?:\\.\\d+)?)°?$/.exec(String(a.label).replace(/\\s/g,'')); return m?Number(m[1]):NaN; }); const known=A.filter(x=>!Number.isNaN(x)); if (known.length===2) { const t=180-known[0]-known[1]; if (!(t>0)) throw new Error('각의 합 오류'); A[A.findIndex(x=>Number.isNaN(x))]=t; } return {S,A,V,right:f.rightAngleAt||null}; };
const srt=(a)=>[...a].sort((x,y)=>x-y); const sameArr=(a,b)=>a.length===b.length&&a.every((x,i)=>Math.abs(x-b[i])<1e-9);
`;
export const validTri = (a: number, b: number, c: number) => a + b > c && a + c > b && b + c > a && a > 0 && b > 0 && c > 0;
/** 비정삼각형·비이등변·비직각의 정수 삼각형(변이 서로 다름, 합동·닮음 문항의 기준). */
export const BASE3: [number, number, number][] = [[3, 4, 6], [4, 5, 7], [4, 6, 7], [5, 6, 8], [5, 7, 9], [6, 7, 9], [4, 7, 9], [5, 8, 10], [6, 8, 11], [7, 8, 10], [6, 9, 11], [5, 9, 12], [7, 9, 12], [8, 9, 11], [6, 10, 13]];
export function baseTri(rng: Rng): [number, number, number] { const t = rng.pick(BASE3); return rng.shuffle([...t]) as [number, number, number]; }
export { GenFail };
export const TRI_LEADS = ["", "", "A student draws two triangles for a geometry assignment. ", "A teacher posts a triangle on the board. ", "An architect sketches triangular braces for a frame. ", "A designer plans triangular tiles for a floor. ", "A surveyor measures a triangular lot. ", "A craftsperson cuts triangular pieces of wood. "];
