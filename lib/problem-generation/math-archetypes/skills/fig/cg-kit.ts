// 좌표기하(CG) 계열 공용 키트 — 조합 파일(items/<조합ID>.ts)이 함께 쓴다.
// 규칙: 점 좌표·원의 중심/반지름은 그림(plane 객체)에만 있고 지문은 "the figure shown" 으로 가리킨다. 점은 id = 라벨(영문 대문자)로 둔다.
// verification_js 는 FIGURE.objects 의 점·다각형·원·변환만 읽어 다시 계산한다(점이 바뀌면 답이 바뀐다).
import { GenFail } from "../../types";
import type { Rng } from "../../rng";

export type P2 = [number, number];
export type Tr = [string, string][];
export type CgObj = Record<string, unknown>;
export type CgFig = { type: "plane"; axes: { x: { min: number; max: number; step: number; title: string }; y: { min: number; max: number; step: number; title: string } }; objects: CgObj[] };

/** (3,4,5) 꼴 피타고라스 세 수(작은 것부터). */
export const TRIPLES: [number, number, number][] = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [9, 12, 15], [8, 15, 17], [12, 16, 20]];
export const SMALL_TRIPLES: [number, number, number][] = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [9, 12, 15]];

/** 점 객체(id = 라벨). label:false 면 라벨 없음. */
export const ptO = (id: string, at: P2, o: { label?: string | false; open?: boolean } = {}): CgObj => ({ id, kind: "point", at, ...(o.label === false ? {} : { label: o.label ?? id }), ...(o.open ? { open: true } : {}) });
export const segO = (id: string, from: string | P2, to: string | P2, o: { dashed?: boolean } = {}): CgObj => ({ id, kind: "segment", from, to, ...(o.dashed ? { style: "dashed" } : {}) });
export const polyO = (id: string, vertices: (string | P2)[], o: { fill?: boolean } = {}): CgObj => ({ id, kind: "polygon", vertices, ...(o.fill ? { fill: true } : {}) });
export const circO = (id: string, center: string | P2, radius: number): CgObj => ({ id, kind: "circle", center, radius });

const stepFor = (lo: number, hi: number) => { const r = hi - lo; return r <= 14 ? 1 : r <= 28 ? 2 : 5; };
/** 모든 좌표를 담는 축 범위(여백 1~2). 0 을 포함하지 않으면 0 까지 확장해 원점을 둔다. */
export function axesFor(pts: P2[], o: { quad?: "I" | "any"; margin?: number } = {}): CgFig["axes"] {
  const m = o.margin ?? 1;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  let x0 = Math.floor(Math.min(...xs) - m), x1 = Math.ceil(Math.max(...xs) + m), y0 = Math.floor(Math.min(...ys) - m), y1 = Math.ceil(Math.max(...ys) + m);
  if (o.quad !== "any") { x0 = Math.min(0, x0); y0 = Math.min(0, y0); }
  const sx = stepFor(x0, x1), sy = stepFor(y0, y1);
  const rnd = (hi: number, st: number) => Math.ceil(hi / st) * st;
  const fl = (lo: number, st: number) => Math.floor(lo / st) * st;
  return { x: { min: fl(x0, sx), max: rnd(x1, sx), step: sx, title: "x" }, y: { min: fl(y0, sy), max: rnd(y1, sy), step: sy, title: "y" } };
}
export const planeFig = (objects: CgObj[], pts: P2[], o: { quad?: "I" | "any"; margin?: number } = {}): CgFig => ({ type: "plane", axes: axesFor(pts, o), objects });

/** FIGURE 읽기(JS): PT[id] = [x,y], rf(ref)·dist(a,b)·OB(kind)·ip(수) — ip 는 정수가 아니면 던진다. */
export const CG_JS = `const O=FIGURE.objects; const PT={}; O.forEach(o=>{ if(o.kind==='point') PT[o.id]=o.at; }); const rf=(r)=>typeof r==='string'?PT[r]:r; const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]); const OB=(k)=>O.filter(o=>o.kind===k); const ip=(v)=>{ if (!Number.isFinite(v)||Math.abs(v-Math.round(v))>1e-9) throw new Error('정수 아님'); return Math.round(v); }; const PA=(id)=>{ const p=PT[id]; if(!p) throw new Error('점 없음 '+id); return p; };\n`;
/** 다각형 꼭짓점 좌표 목록(JS 식): vs(polyId). */
export const POLY_JS = `const vs=(pid)=>{ const g=O.find(o=>o.id===pid); if(!g) throw new Error('다각형 없음'); return g.vertices.map(rf); }; const shoe=(v)=>{ let s=0; for(let i=0;i<v.length;i++){ const a=v[i], b=v[(i+1)%v.length]; s+=a[0]*b[1]-b[0]*a[1]; } return Math.abs(s)/2; };\n`;

export const CG_LEAD = ["", "", "A student plots the points shown on a coordinate grid. ", "A teacher draws the diagram below on a coordinate plane. ", "A surveyor marks the figure shown on a grid map. ", "A designer places the shape shown on a grid. ", "An engineer sketches the plan shown on a coordinate grid. ", "A game developer positions the objects shown on a grid. ", "A student graphs the figure shown in the $xy$-plane. "];
export const CG_CTX = ["", "", "Each grid line is one unit apart. ", "Read the coordinates from the grid. ", "Use the labeled points in the figure. ", "The figure is drawn on a coordinate plane. ", "A calculator is not necessary. ", "Pay attention to the coordinates of each point. ", "All coordinates in the figure are integers. ", "The grid in the figure is drawn to scale. "];
export const cgIntro = (rng: Rng, scenes: string[], extra = "") => `${rng.pick(CG_LEAD)}${rng.pick(CG_CTX)}${rng.pick(scenes)}${extra}`.replace(/ {2,}/g, " ").trim();
export function names(rng: Rng, n: number): string[] { const pool = "ABCDEFGHJKLMNPQRSTUVWXYZ".split(""); return rng.shuffle([...pool]).slice(0, n).sort(); }
export { GenFail };

/** 직각이 B 인 직각삼각형(가로 변 BA, 세로 변 BC): 좌표가 1~16 안. a=|BA|, b=|BC|, c=빗변. */
export type RTri = { A: P2; B: P2; C: P2; a: number; b: number; c: number };
export function rightTri(rng: Rng, tri: [number, number, number][] = SMALL_TRIPLES, o: { lim?: number } = {}): RTri {
  const lim = o.lim ?? 16;
  const [p, q, c] = rng.pick(tri); const sw = rng.pick([true, false]); const a = sw ? p : q, b = sw ? q : p; const sa = rng.pick([1, -1]), sc = rng.pick([1, -1]);
  for (let i = 0; i < 60; i++) { const x = rng.int(1, lim), y = rng.int(1, lim); const ax = x + sa * a, cy = y + sc * b; if (ax >= 1 && ax <= lim && cy >= 1 && cy <= lim) return { A: [ax, y], B: [x, y], C: [x, cy], a, b, c }; }
  throw new GenFail("직각삼각형 배치");
}
export const triObjs = (n: [string, string, string], t: RTri): CgObj[] => [ptO(n[0], t.A), ptO(n[1], t.B), ptO(n[2], t.C), polyO("T", n)];

/** 원 그림: 중심 c, 반지름 r. cLabel 이 있으면 중심에 라벨 점, p·pLabel 이 있으면 원 위의 점(라벨)을 더한다. 축 범위는 원 전체를 담는다. */
export function circFig(c: P2, r: number, o: { cLabel?: string; p?: P2; pLabel?: string; extra?: CgObj[]; extraPts?: P2[]; dashed?: boolean } = {}): CgFig {
  const objs: CgObj[] = [];
  if (o.cLabel) objs.push(ptO(o.cLabel, c));
  if (o.p && o.pLabel) objs.push(ptO(o.pLabel, o.p));
  objs.push(circO("K", o.cLabel ?? c, r));
  if (o.extra) objs.push(...o.extra);
  const bounds: P2[] = [[c[0] - r, c[1] - r], [c[0] + r, c[1] + r], ...(o.extraPts ?? [])];
  return planeFig(objs, bounds, { quad: "any", margin: 1 });
}
export const CIRC_JS = `const CI=OB('circle')[0]; if(!CI) throw new Error('원 필요'); const cen=()=>rf(CI.center); const rad=()=>CI.radius;\n`;
export const CIRC_TRI: [number, number, number][] = [[3, 4, 5], [6, 8, 10]];
/** 중심 (h,k) 와 원 위의 점 P(삼조 오프셋) — 반지름 r. */
export function circScene(rng: Rng, o: { hLo?: number; hHi?: number; kLo?: number; kHi?: number } = {}) {
  const [a, b, r] = rng.pick(CIRC_TRI); const sw = rng.pick([true, false]); const dx = (sw ? a : b) * rng.pick([1, -1]), dy = (sw ? b : a) * rng.pick([1, -1]);
  const h = rng.int(o.hLo ?? -5, o.hHi ?? 5), k = rng.int(o.kLo ?? -5, o.kHi ?? 5); if (h === 0 && k === 0) throw new GenFail("원점"); if (h + dx === 0 && k + dy === 0) throw new GenFail("P 가 원점");
  return { C: [h, k] as P2, P: [h + dx, k + dy] as P2, h, k, r, dx: Math.abs(dx), dy: Math.abs(dy) };
}
/** "1 unit" / "n units". */
export const un = (n: number) => `${n} ${n === 1 ? "unit" : "units"}`;
