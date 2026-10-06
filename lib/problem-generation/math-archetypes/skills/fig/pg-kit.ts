// 사각형·다각형(PG) 계열 자료 원형 공용 장면 키트 — 조합 파일(items/<조합ID>.ts)이 함께 쓴다.
// 규칙: 수치(변·높이·대각선·각)는 그림의 라벨에만 있고 지문은 "the figure shown" 으로 가리킨다(지문에만 쓰는 값은 그림에 없는 조건뿐). verification_js 는 FIGURE 의 라벨만 읽어 다시 계산한다.
// 직사각형은 숫자 변 라벨 비율대로 그려지고, 평행사변형·사다리꼴·마름모·정다각형은 고정 모양이라 숫자 라벨이 있으면 notToScale 로 둔다(그림 아래 'Note' 문구).
import type { Rng } from "../../rng";
import { NUM_JS, pickN } from "./geo-kit";

export type PolyFig = { type: "polygon"; kind: string; vertices: string[]; sides?: number; sideLabels?: { between: [string, string]; label?: string; tick?: 1 | 2 | 3 }[]; angles?: { at: string; label?: string; arc?: boolean; right?: boolean }[]; diagonals?: { between: [string, string]; label?: string }[]; height?: { from: string; label?: string; foot?: string }; notToScale?: boolean };
/** 사각형 꼭짓점 이름 4개(왼쪽 아래에서 반시계 — 알파벳 순). */
export const quadNames = (rng: Rng): [string, string, string, string] => { const n = pickN(rng, 4); return [n[0], n[1], n[2], n[3]]; };
/** 직사각형: AB(가로)·BC(세로) 라벨(숫자 또는 식), 선택으로 대각선 라벨. 두 변이 모두 숫자가 아니면 가로·세로 비율을 그림이 알 수 없어 notToScale. */
export function rectFig(v: string[], ab?: string, bc?: string, diag?: { between: [string, string]; label?: string }): PolyFig {
  return { type: "polygon", kind: "rectangle", vertices: v, sideLabels: [...(ab ? [{ between: [v[0], v[1]] as [string, string], label: ab }] : []), ...(bc ? [{ between: [v[1], v[2]] as [string, string], label: bc }] : [])], ...(diag ? { diagonals: [diag] } : {}), ...(/^\d+(?:\.\d+)?$/.test(ab ?? "") && /^\d+(?:\.\d+)?$/.test(bc ?? "") ? {} : { notToScale: true }) };
}
/** 평행사변형: AB(밑변)·AD(비스듬한 변) 라벨, 높이는 D 에서 밑변으로. 고정 모양 → notToScale. */
export function parFig(v: string[], o: { ab?: string; ad?: string; h?: string; diag?: { between: [string, string]; label?: string }; foot?: string; angles?: PolyFig["angles"] }): PolyFig {
  return { type: "polygon", kind: "parallelogram", vertices: v, sideLabels: [...(o.ab ? [{ between: [v[0], v[1]] as [string, string], label: o.ab }] : []), ...(o.ad ? [{ between: [v[3], v[0]] as [string, string], label: o.ad }] : [])], ...(o.h ? { height: { from: v[3], label: o.h, ...(o.foot ? { foot: o.foot } : {}) } } : {}), ...(o.diag ? { diagonals: [o.diag] } : {}), ...(o.angles ? { angles: o.angles } : {}), notToScale: true };
}
/** 사다리꼴: AB(긴 밑변, 아래)·DC(짧은 밑변, 위)·다리 BC·DA 라벨, 높이는 D 에서 아래 밑변으로. 고정 모양 → notToScale. */
export function trapFig(v: string[], o: { ab?: string; dc?: string; leg?: string; h?: string; foot?: string }): PolyFig {
  return { type: "polygon", kind: "trapezoid", vertices: v, sideLabels: [...(o.ab ? [{ between: [v[0], v[1]] as [string, string], label: o.ab }] : []), ...(o.dc ? [{ between: [v[3], v[2]] as [string, string], label: o.dc }] : []), ...(o.leg ? [{ between: [v[1], v[2]] as [string, string], label: o.leg, tick: 1 as const }, { between: [v[3], v[0]] as [string, string], tick: 1 as const }] : [])], ...(o.h ? { height: { from: v[3], label: o.h, ...(o.foot ? { foot: o.foot } : {}) } } : {}), notToScale: true };
}
/** FIGURE(사각형) 읽기: side(a,b)·dg(a,b)·HT 는 숫자 또는 NaN. */
export const PG_JS = `${NUM_JS}const SLB=FIGURE.sideLabels||[]; const V=FIGURE.vertices; const side=(a,b)=>{ const q=SLB.find(s=>s.label!==undefined&&((s.between[0]===a&&s.between[1]===b)||(s.between[0]===b&&s.between[1]===a))); return q?num(q.label):NaN; }; const dg=(a,b)=>{ const q=(FIGURE.diagonals||[]).find(d=>d.label!==undefined&&((d.between[0]===a&&d.between[1]===b)||(d.between[0]===b&&d.between[1]===a))); return q?num(q.label):NaN; }; const HT=FIGURE.height&&FIGURE.height.label!==undefined?num(FIGURE.height.label):NaN;
`;
export const PG_LEAD = ["", "", "A student is working on a geometry problem. ", "An architect sketches the plan shown. ", "A designer drafts the shape shown. ", "A teacher draws the figure shown on the board. ", "A landscaper plans the plot shown. "];
export const UNITS = ["", "All lengths are in centimeters. ", "All lengths are in meters. ", "All lengths shown are in feet. ", "Lengths are in inches. ", "Lengths are given in the same unit. "];
export const unitName = (u: string) => (/centimeters/.test(u) ? "square centimeters" : /meters/.test(u) ? "square meters" : /feet/.test(u) ? "square feet" : /inches/.test(u) ? "square inches" : "square units");
