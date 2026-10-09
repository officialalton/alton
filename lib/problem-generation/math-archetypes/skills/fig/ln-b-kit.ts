// 좌표평면 직선·포물선·원·다각형 B형 키트 — 기준 그림(STEM)은 일반 plane 그림, 선택지는 같은 축의 plane 그림 4개(라벨·점 없음).
import { GenFail } from "../../types";
import type { Rng } from "../../rng";
import { pureAxes, clearOfLabels } from "./pure-kit";

export const LEADS_G = ["", "", "A student studies graphs in an algebra class. ", "A teacher draws a graph on the board. ", "A graphing program plots a figure. ", "In a practice set, a graph is shown in the $xy$-plane. ", "A designer sketches a figure on a coordinate grid. ", "An engineer plots a graph on a grid. "];
/** 좌표평면·그래프 B형 지문의 꼬리 문장(길이·모서리 표기를 말하는 sx-kit TAILS 는 여기에 맞지 않는다). */
export const COORD_TAILS = [
  "Compare each choice with the given graph, paying attention to where the graph sits on the grid.",
  "Read the positions of the key points on the given graph before you look at the choices.",
  "Every graph is drawn on the same grid, so positions on one graph can be compared directly with positions on another.",
  "Only one of the four choices matches the relationship described below.",
  "Decide what changes between the given graph and the correct choice, and then check each option.",
  "The scale on the axes is the same in all five graphs.",
  "Use the grid lines to read coordinates accurately from each graph.",
  "Think about how the given graph would have to change to produce each of the choices.",
];
export const INTRO_TAILS = [
  "The first graph is the given figure, and four graphs with the same axes are shown as choices.",
  "Use the given graph to answer the question, and compare the four choices, which all use the same axes.",
  "The given figure is drawn first. Each of the four choices is a graph in the same $xy$-plane.",
  "Four possible graphs are shown below the given figure; all five graphs use the same scale.",
];
// ───────── 직선 ─────────
export const lineChoice = (R: number, m: number, b: number) => {
  const xs: number[] = []; for (let x = -R; x <= R; x++) if (Number.isInteger(m * x + b) && Math.abs(m * x + b) <= R && clearOfLabels(x, m * x + b, R)) xs.push(x);
  if (xs.length < 2) throw new GenFail("직선이 눈금 위 점 둘을 갖지 않음");
  const a = xs[0], z = xs[xs.length - 1]; if (z - a < 2) throw new GenFail("점이 가까움");
  return { type: "plane" as const, axes: pureAxes(R), objects: [{ id: "L1", kind: "line" as const, through: [[a, m * a + b], [z, m * z + b]] }] };
};
export const lineKey = (m: number, b: number) => `${m}|${b}`;
export const LINE_KEY_JS = `const KEY=(c)=>{ const o=c.objects.find(q=>q.kind==='line'); if(!o||!o.through) throw new Error('직선 필요'); const [p,q]=o.through; if(p[0]===q[0]) throw new Error('수직선'); const mm=(q[1]-p[1])/(q[0]-p[0]); const b=p[1]-mm*p[0]; return Math.round(mm*1e6)/1e6+'|'+Math.round(b*1e6)/1e6; };
const STEMLINE=()=>{ const s=STEM.objects.find(o=>o.kind==='scatter'); if(!s||!s.fitLine) throw new Error('기준 직선 필요'); for (const [x,y] of s.points) if (Math.abs(s.fitLine.slope*x+s.fitLine.intercept-y)>1e-9) throw new Error('점이 직선 위에 없음'); return [s.fitLine.slope, s.fitLine.intercept]; };
`;
// ───────── 포물선 ─────────
export const parabola = (R: number, A: number, H: number, K: number) => {
  const B = -2 * A * H, C = A * H * H + K; if (Math.abs(H) > R - 2 || Math.abs(K) > R - 2) throw new GenFail("꼭짓점이 범위 밖");
  return { fig: { type: "plane" as const, axes: pureAxes(R), objects: [{ id: "F1", kind: "function" as const, fn: "quadratic" as const, params: [A, B, C] }] }, key: `${A}|${B}|${C}` };
};
export const QUAD_KEY_JS = `const KEY=(c)=>{ const o=c.objects.find(q=>q.kind==='function'&&q.fn==='quadratic'); if(!o) throw new Error('이차함수 필요'); return o.params.map(v=>Math.round(v*1e6)/1e6).join('|'); };
const STEMQ=()=>{ const o=STEM.objects.find(q=>q.kind==='function'&&q.fn==='quadratic'); const s=STEM.objects.find(q=>q.kind==='scatter'); if(!o||!s) throw new Error('기준 포물선 필요'); const [A,B,C]=o.params; for (const [x,y] of s.points) if (Math.abs(A*x*x+B*x+C-y)>1e-9) throw new Error('점이 곡선 위에 없음'); return {A,B,C,H:-B/(2*A),K:C-B*B/(4*A)}; };
`;
// ───────── 원·다각형 ─────────
export const circleFig = (R: number, cx: number, cy: number, r: number) => {
  if (Math.abs(cx) + r > R - 0 || Math.abs(cy) + r > R - 0 || r < 1) throw new GenFail("원이 범위 밖");
  return { fig: { type: "plane" as const, axes: pureAxes(R), objects: [{ id: "C1", kind: "circle" as const, center: [cx, cy] as [number, number], radius: r }] }, key: `${cx}|${cy}|${r}` };
};
export const CIRCLE_KEY_JS = `const KEY=(c)=>{ const o=c.objects.find(q=>q.kind==='circle'); if(!o) throw new Error('원 필요'); return o.center[0]+'|'+o.center[1]+'|'+o.radius; };
const STEMC=()=>{ const o=STEM.objects.find(q=>q.kind==='circle'); if(!o||!Array.isArray(o.center)) throw new Error('기준 원 필요'); return {cx:o.center[0],cy:o.center[1],r:o.radius}; };
`;
export const polyFig = (R: number, v: [number, number][]) => {
  if (v.some(([x, y]) => Math.abs(x) > R - 1 || Math.abs(y) > R - 1)) throw new GenFail("다각형이 범위 밖");
  return { fig: { type: "plane" as const, axes: pureAxes(R), objects: [{ id: "P1", kind: "polygon" as const, vertices: v }] }, key: [...v].map(([x, y]) => `${x},${y}`).sort().join(";") };
};
export const POLY_KEY_JS = `const KEY=(c)=>{ const o=c.objects.find(q=>q.kind==='polygon'); if(!o) throw new Error('다각형 필요'); return o.vertices.map(p=>p[0]+','+p[1]).sort().join(';'); };
const STEMP=()=>{ const o=STEM.objects.find(q=>q.kind==='polygon'); if(!o) throw new Error('기준 다각형 필요'); return o.vertices; };
const fmtKey=(vs)=>vs.map(p=>p[0]+','+p[1]).sort().join(';');
`;
export const rngPoly = (rng: Rng): [number, number][] => {
  for (let t = 0; t < 200; t++) {
    const pts: [number, number][] = [[rng.int(1, 5), rng.int(1, 4)], [rng.int(1, 5), rng.int(-4, -1)], [rng.int(-5, -1), rng.int(-4, 4)]].map((p) => p as [number, number]);
    const [a, b, c] = pts; const area = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])); if (area < 6) continue; if (new Set(pts.map((p) => p.join(","))).size < 3) continue;
    if (pts.some((p) => p[0] === p[1] || p[0] === -p[1])) continue; return pts;
  }
  throw new GenFail("다각형 표집 실패");
};

/** 꼭짓점이 원점 근처인(|H| ≤ 3, |K| ≤ 4) 포물선 기준 그림 — 변환(최대 ±3)한 그래프도 [-10, 10] 안에 들어온다. 곡선이 먼저, 표시점 세 개가 나중. */
export function quadSmall(rng: Rng) {
  for (let t = 0; t < 400; t++) {
    const R = 10, A = rng.pick([-2, -1, 1, 2]), H = rng.int(-3, 3), K = rng.int(-4, 4); const B = -2 * A * H, C = A * H * H + K; const y = (x: number) => A * x * x + B * x + C;
    // 곡선 라벨은 오른쪽 끝 근처에 놓인다 — y 축 이름과 겹치지 않게 오른쪽 끝의 x 가 y 축에서 충분히 떨어져야 한다(변환한 그래프도 같은 이유로 ±3 이동 뒤를 본다).
    const endX = (h: number, k: number) => h + Math.sqrt(A > 0 ? Math.max(0, (R - k) / A) : Math.max(0, (R + k) / -A)); if (Math.abs(endX(H, K)) < 2.5) continue;
    const cand: number[] = []; for (let x = -R; x <= R; x++) if (x !== H && Math.abs(y(x)) <= R && clearOfLabels(x, y(x), R)) cand.push(x);
    if (cand.length < 3) continue; const xs = rng.shuffle(cand).slice(0, 3);
    xs.sort((p, q) => p - q); const ys = xs.map(y);
    return { fn: "f", A, B, C, H, K, xs, ys, R, fig: { type: "plane" as const, axes: pureAxes(R), objects: [{ id: "F1", kind: "function" as const, fn: "quadratic" as const, params: [A, B, C], label: "f" }, { id: "S1", kind: "scatter" as const, points: xs.map((x, i) => [x, ys[i]] as [number, number]) }] } };
  }
  throw new GenFail("작은 포물선 표집 실패");
}

// ───────── 입체(닮은 입체) ─────────
export type SolidKind = "cylinder" | "cone" | "rectangular_prism";
export const SOLID_DIMS: Record<SolidKind, string[]> = { cylinder: ["radius", "height"], cone: ["radius", "height"], rectangular_prism: ["length", "width", "height"] };
export const solidFig = (kind: SolidKind, dims: number[]) => {
  const names = SOLID_DIMS[kind]; if (dims.length !== names.length) throw new GenFail("치수 수");
  if (dims.some((d) => !Number.isInteger(d) || d <= 0 || d > 99)) throw new GenFail("치수 범위");
  return { fig: { type: "solid" as const, kind, dims: Object.fromEntries(names.map((n, i) => [n, String(dims[i])])) }, key: `${kind}|${dims.join("|")}` };
};
export const SOLID_KEY_JS = `const NAMES={cylinder:['radius','height'],cone:['radius','height'],rectangular_prism:['length','width','height']};
const DIMS=(c)=>{ const n=NAMES[c.kind]; if(!n) throw new Error('지원하지 않는 입체'); return n.map(k=>{ const v=Number(c.dims[k]); if(!Number.isFinite(v)) throw new Error('치수 해석 불가'); return v; }); };
const KEY=(c)=>c.kind+'|'+DIMS(c).join('|');
const STEMS=()=>{ if(!STEM||STEM.type!=='solid') throw new Error('기준 입체 필요'); return {kind:STEM.kind, d:DIMS(STEM)}; };
const fmtS=(kind,d)=>kind+'|'+d.map(v=>Math.round(v*1e6)/1e6).join('|');
`;
export const rngSolid = (rng: Rng, kind: SolidKind): number[] => (kind === "rectangular_prism" ? [rng.int(2, 5), rng.int(2, 6), rng.int(2, 6)] : [rng.int(2, 5), rng.int(3, 8)]);
