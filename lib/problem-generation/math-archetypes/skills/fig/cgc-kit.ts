// 좌표기하(CG) 선택지형(C) 키트 — 선택지 4개가 같은 축의 좌표평면 그림(원 하나 또는 삼각형 + 상)이고 지문의 조건을 만족하는 그림을 고른다.
// 선택지 그림에는 점·라벨을 두지 않는다(정답 암시 방지). 정답 판정은 CHOICES 의 원(center·radius)·다각형 꼭짓점만 읽는다.
import { GenFail } from "../../types";
import type { Rng } from "../../rng";
import { axesFor, circO, polyO, type CgFig, type CgObj, type P2 } from "./cg-kit";
import { pickChoices } from "./pg-kit";

export const SPR_NO_CG = "정답이 좌표평면 그림 4개 중 조건을 만족하는 그림을 고르는 것이 문제의 핵심이라 선택지 없이는 성립하지 않는다";
export type CircSpec = { c: P2; r: number };
const circBounds = (s: CircSpec): P2[] => [[s.c[0] - s.r, s.c[1] - s.r], [s.c[0] + s.r, s.c[1] + s.r]];
/** 모든 후보 원을 담는 공통 축. */
export const circAxes = (all: CircSpec[]) => axesFor(all.flatMap(circBounds), { quad: "any", margin: 1 });
export const circChoiceFig = (s: CircSpec, axes: CgFig["axes"]): CgFig => ({ type: "plane", axes, objects: [circO("K", s.c, s.r)] });
/** 원 선택지: 후보 중 조건을 만족하지 않고 진단 규칙이 서로 다른 3개를 골라 정답과 함께 섞는다. */
export function circChoices(rng: Rng, ok: CircSpec, cands: CircSpec[], P: Record<string, number | string>, predBody: string, diagBody: string) {
  const uniq = cands.filter((c, i) => cands.findIndex((d) => d.c[0] === c.c[0] && d.c[1] === c.c[1] && d.r === c.r) === i && !(c.c[0] === ok.c[0] && c.c[1] === ok.c[1] && c.r === ok.r));
  const axes = circAxes([ok, ...uniq]);
  const figs = uniq.map((s) => circChoiceFig(s, axes));
  return pickChoices(rng, circChoiceFig(ok, axes), figs, P, `${CC_JS}${predBody}`, `${CC_JS}${diagBody}`);
}
/** 원 선택지 읽기(JS): K(c) = {h,k,r}. */
export const CC_JS = "const K=(c)=>{ const o=c.objects.find((q)=>q.kind==='circle'); if(!o) throw new Error('원 없음'); return {h:o.center[0],k:o.center[1],r:o.radius}; };\n";
/** 중심·반지름이 정답과 같은지 + 흔한 오독 진단(부호·맞바꿈·반지름). 기준 원은 ok. */
export const CC_DIAG_SIGNS = "const a=K(c), b=K(ok); if (a.r===b.r) { if (a.h===-b.h&&a.k===b.k) return 'sign_h'; if (a.h===b.h&&a.k===-b.k) return 'sign_k'; if (a.h===-b.h&&a.k===-b.k) return 'sign_both'; if (a.h===b.k&&a.k===b.h) return 'swap_hk'; return null; } if (a.h===b.h&&a.k===b.k) return 'radius'; return null;";
export const CC_PRED_EQ = "const a=K(c); return a.h===P.h&&a.k===P.k&&Math.abs(a.r-P.r)<1e-9;";
/** 정답 (h,k,r) 에서 흔한 오독 후보들. */
export function signCands(h: number, k: number, r: number): CircSpec[] {
  const out: CircSpec[] = [{ c: [-h, k], r }, { c: [h, -k], r }, { c: [-h, -k], r }, { c: [k, h], r }];
  if (r > 2) out.push({ c: [h, k], r: r - 1 }); out.push({ c: [h, k], r: r + 1 });
  return out;
}

// ── 삼각형 + 상 선택지 ─────────────────────────────────────
export type Tri = P2[];
export const triChoiceFig = (t: Tri, img: Tri, axes: CgFig["axes"]): CgFig => ({ type: "plane", axes, objects: [polyO("T", t), { ...polyO("I", img), style: "dashed" } as CgObj] });
export const TR_JS = "const V=(c,id)=>{ const o=c.objects.find((q)=>q.id===id); if(!o) throw new Error('다각형 없음'); return o.vertices; }; const same=(p,q)=>p.length===q.length&&[...p].map((v)=>v.join()).sort().join('|')===[...q].map((v)=>v.join()).sort().join('|'); const OPS={ rx:(v)=>[v[0],-v[1]], ry:(v)=>[-v[0],v[1]], ccw:(v)=>[-v[1],v[0]], cw:(v)=>[v[1],-v[0]], half:(v)=>[-v[0],-v[1]], swap:(v)=>[v[1],v[0]], anti:(v)=>[-v[1],-v[0]], id:(v)=>v }; const mv=(f,P2)=>P2.map((v)=>f(v)); const shift=(P2,dx,dy)=>P2.map((v)=>[v[0]+dx,v[1]+dy]);\n";
export const OPS_JS: Record<string, (v: P2) => P2> = { rx: (v) => [v[0], -v[1]], ry: (v) => [-v[0], v[1]], ccw: (v) => [-v[1], v[0]], cw: (v) => [v[1], -v[0]], half: (v) => [-v[0], -v[1]], swap: (v) => [v[1], v[0]], anti: (v) => [-v[1], -v[0]], id: (v) => v };
/** 삼각형 선택지: 정답 상 ok, 후보 cands(각각 [상 꼭짓점들, 규칙 이름]). 모든 그림은 같은 축·같은 원본. */
export function triChoices(rng: Rng, t: Tri, okImg: Tri, cands: Tri[], P: Record<string, number | string>, predBody: string, diagBody: string) {
  const key = (x: Tri) => [...x].map((v) => v.join()).sort().join("|");
  const seen = new Set<string>([key(okImg)]); const uniq: Tri[] = []; for (const c of cands) { if (!seen.has(key(c))) { seen.add(key(c)); uniq.push(c); } }
  if (uniq.length < 3) throw new GenFail("삼각형 후보 부족");
  const axes = axesFor([...t, ...okImg, ...uniq.flat()], { quad: "any", margin: 1 });
  return pickChoices(rng, triChoiceFig(t, okImg, axes), uniq.map((c) => triChoiceFig(t, c, axes)), P, `${TR_JS}${predBody}`, `${TR_JS}${diagBody}`);
}

export const CGC_LEAD = ["", "", "A student is comparing graphs of circles in the coordinate plane. ", "A teacher draws four graphs on the same grid. ", "A textbook shows four graphs of circles. ", "An engineer is checking four plots of a circular path. ", "A designer sketches four possible circular badges on a grid. ", "A surveyor plots four candidate circular boundaries. ", "A game developer tests four circular zones on a map grid. ", "A club is choosing among four graphs of a circular track. ", "A science class graphs four circular orbits on the same grid. ", "A coach reviews four diagrams of a circular warm-up area. "];
export const CGC_CTX = ["", "", "All four graphs use the same axes and scale. ", "Each graph is drawn on the same coordinate grid. ", "Only one of the graphs matches. ", "Check the center and the radius of each circle. ", "Read each graph carefully before choosing. ", "The graphs are drawn to the same scale. ", "Compare the position and size of each circle. ", "Each grid line is one unit apart. "];
export const cgcIntro = (rng: Rng, body: string) => `${rng.pick(CGC_LEAD)}${rng.pick(CGC_CTX)}${body}`.replace(/ {2,}/g, " ").trim();

/** 오답 규칙 정의: 같은 반지름의 원이 center = js(P) 에 있으면 name 으로 진단한다(ts 는 같은 식의 TS 계산). */
export type CenterRule = { name: string; ts: (p: Record<string, number>) => P2; js: string };
export function centerRulesDiag(rules: CenterRule[]): string {
  const L = rules.map((r) => `['${r.name}', ${r.js}]`).join(", ");
  return `const a=K(c), b=K(ok); if (a.h===b.h&&a.k===b.k) return a.r===b.r?null:'radius'; if (a.r!==b.r) return null; const L=[${L}]; for (const [n,p] of L) { if (a.h===p[0]&&a.k===p[1]) return n; } return null;`;
}

export const CGC_TRI_LEAD = ["", "", "A student is checking four diagrams of a triangle and its image. ", "A teacher draws four diagrams on the same coordinate grid. ", "A textbook shows four coordinate diagrams of a transformation. ", "A designer compares four placements of a shape and its image. ", "A game developer tests four possible images of a sprite on a grid. ", "A class sketches four candidate images of a triangle. ", "An architect reviews four drafts of a shape and its reflection or turn. "];
export const CGC_TRI_CTX = ["", "", "All four figures use the same axes and scale. ", "Each figure is drawn on the same coordinate grid. ", "Only one of the figures matches. ", "Check the position of the dashed triangle in each figure. ", "Read each figure carefully before choosing. ", "The solid triangle is the same in every figure. ", "Compare the vertices of the dashed triangle in each figure. "];
export const cgcTriIntro = (rng: Rng, body: string) => `${rng.pick(CGC_TRI_LEAD)}${rng.pick(CGC_TRI_CTX)}${body}`.replace(/ {2,}/g, " ").trim();
