// 삼각형 중첩(TN) 계열 공용 장면 키트 — 닮음(내부 평행선)·중첩 닮음(넓이·둘레·사다리꼴)·직각삼각형 수선 조합이 함께 쓴다.
// 규칙: 길이는 그림의 변 라벨(sides[].label)에만 있고(모르는 변은 x) 지문은 "the figure shown" 으로 가리킨다. 그림은 ratio(AD/AB)·legs 비율대로 그려진다(엔진 규칙, G8 가 비례를 대조).
import { GenFail } from "../../types";
import type { Rng } from "../../rng";

const LET = "ABCDEFGHJKLMNPQRSTUVWXYZ".split("");
export type PScene = { V: [string, string, string]; D: string; E: string; a: number; b: number; u: number; w: number; len: Record<string, number>; r: number };
/** 내부 평행선 DE ∥ BC: AD=a, DB=b, AE=a·u, EC=b·u, DE=a·w, BC=(a+b)·w — 모든 길이가 정수. */
export function makeParallel(rng: Rng, o: { aLtB?: boolean; aGtB?: boolean } = {}): PScene {
  for (let t = 0; t < 100; t++) {
    const a = rng.int(2, 7), b = rng.int(2, 7); if (a === b || (o.aLtB && a >= b) || (o.aGtB && a <= b)) continue; const u = rng.int(1, 3), w = rng.int(1, 3);
    const n = rng.shuffle(LET).slice(0, 5); const V: [string, string, string] = [n[0], n[1], n[2]];
    const len: Record<string, number> = { AD: a, DB: b, AB: a + b, AE: a * u, EC: b * u, AC: (a + b) * u, DE: a * w, BC: (a + b) * w };
    return { V, D: n[3], E: n[4], a, b, u, w, len, r: a / (a + b) };
  }
  throw new GenFail("평행선 장면 표집 실패");
}
/** 'AD' 같은 키 → 실제 점 이름 쌍. */
export const pairOf = (s: PScene, k: string): [string, string] => { const m: Record<string, string> = { A: s.V[0], B: s.V[1], C: s.V[2], D: s.D, E: s.E }; return [m[k[0]], m[k[1]]]; };
export const nm = (s: PScene, k: string) => `${pairOf(s, k)[0]}${pairOf(s, k)[1]}`;
export const ovl = (s: PScene, k: string) => `$\\overline{${nm(s, k)}}$`;
export function parallelFig(s: PScene, labels: Record<string, string>) {
  return { type: "triangle_nested" as const, kind: "parallel" as const, vertices: s.V, points: [s.D, s.E], ratio: Math.round(s.r * 1000) / 1000, parallelMarks: true, notToScale: true, sides: Object.entries(labels).map(([k, v]) => ({ between: pairOf(s, k), label: v })) };
}
export const PAR_JS = `if (!FIGURE||FIGURE.type!=='triangle_nested'||FIGURE.kind!=='parallel') throw new Error('내부 평행선 자료 필요');
const SDV=(a,b)=>{ const q=(FIGURE.sides||[]).find(s=>s.between.join('')===a+b||s.between.join('')===b+a); if(!q) return NaN; return /^\\d+(?:\\.\\d+)?$/.test(String(q.label))?Number(q.label):NaN; };
const [A,B,C]=FIGURE.vertices, [D,E]=FIGURE.points; const L=(k)=>SDV({A,B,C,D,E}[k[0]],{A,B,C,D,E}[k[1]]);
`;

export type AScene = { V: [string, string, string]; D: string; m: number; swap: boolean; AD: number; DB: number; CD: number; AC: number; BC: number; AB: number };
/** 3-4-5 모양의 직각삼각형(C 직각) 수선: m 배, swap 이면 AD 가 짧은 쪽. 모든 길이가 정수. */
export function makeAltitude(rng: Rng): AScene {
  const m = rng.int(1, 4), swap = rng.chance(0.5); const n = rng.shuffle(LET).slice(0, 4); const V: [string, string, string] = [n[0], n[1], n[2]];
  const AD = (swap ? 9 : 16) * m, DB = (swap ? 16 : 9) * m; const AC = (swap ? 15 : 20) * m, BC = (swap ? 20 : 15) * m;
  return { V, D: n[3], m, swap, AD, DB, CD: 12 * m, AC, BC, AB: 25 * m };
}
export function altFig(s: AScene, labels: Record<string, string>) {
  const nameOf: Record<string, string> = { A: s.V[0], B: s.V[1], C: s.V[2], D: s.D };
  return { type: "triangle_nested" as const, kind: "altitude" as const, vertices: s.V, points: [s.D], legs: [s.AC, s.BC] as [number, number], sides: Object.entries(labels).map(([k, v]) => ({ between: [nameOf[k[0]], nameOf[k[1]]] as [string, string], label: v })) };
}
export const aName = (s: AScene, k: string) => { const m: Record<string, string> = { A: s.V[0], B: s.V[1], C: s.V[2], D: s.D }; return `${m[k[0]]}${m[k[1]]}`; };
export const aOvl = (s: AScene, k: string) => `$\\overline{${aName(s, k)}}$`;
export const ALT_JS = `if (!FIGURE||FIGURE.type!=='triangle_nested'||FIGURE.kind!=='altitude') throw new Error('수선 자료 필요');
const SDV=(a,b)=>{ const q=(FIGURE.sides||[]).find(s=>s.between.join('')===a+b||s.between.join('')===b+a); if(!q) return NaN; return /^\\d+(?:\\.\\d+)?$/.test(String(q.label))?Number(q.label):NaN; };
const [A,B,C]=FIGURE.vertices, [D]=FIGURE.points; const L=(k)=>SDV({A,B,C,D}[k[0]],{A,B,C,D}[k[1]]);
`;
const LEADS = ["", "", "A student draws a figure for a geometry assignment. ", "An architect sketches a triangular frame. ", "A surveyor marks lines on a triangular lot. ", "A designer plans a triangular sign. ", "A teacher posts the figure below on the board. ", "A carpenter cuts a brace for a triangular roof. ", "A map maker marks a triangular park. "];
export const lead = (rng: Rng) => rng.pick(LEADS);
