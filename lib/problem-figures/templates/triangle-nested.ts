// 표준 렌더링 엔진 — 템플릿: 삼각형 중첩(내부 평행선) · 직각삼각형의 빗변 수선
//
// kind "parallel": 삼각형 ABC(A 위, B 왼쪽 아래, C 오른쪽 아래)와 AB 위의 D, AC 위의 E — DE ∥ BC. ratio(= AD/AB, 비인쇄)대로 그린다.
// kind "altitude": 직각삼각형(A 왼쪽, B 오른쪽, C 위에서 직각)과 C 에서 빗변 AB 에 내린 수선의 발 D. legs([AC, BC], 비인쇄)의 비율대로 그린다.
// 길이 라벨은 sides[].label — 숫자·문자(x)·식. 변 이름은 두 점 이름을 이은 것(AD, DB, DE …).

import { dedupe, halfDiag, norm, Sheet, type FigureIssue, type Pt } from "./_layout";

export type TriNestedSpec = {
  type: "triangle_nested";
  kind: "parallel" | "altitude";
  vertices: [string, string, string];
  points: string[];
  ratio?: number;
  legs?: [number, number];
  sides?: { between: [string, string]; label?: string }[];
  /** 평행 표시(>) 를 DE 와 BC 에 그린다. */
  parallelMarks?: boolean;
  notToScale?: boolean;
};
const isName = (v: unknown): v is string => typeof v === "string" && /^[A-Z]{1,2}$/.test(v);

export function validateTriNested(input: unknown): { ok: true; spec: TriNestedSpec } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "그림 데이터가 객체가 아닙니다." };
  const s = input as Record<string, unknown>;
  if (s.type !== "triangle_nested") return { ok: false, error: "type 이 triangle_nested 가 아닙니다." };
  if (s.kind !== "parallel" && s.kind !== "altitude") return { ok: false, error: "kind 는 parallel|altitude 입니다." };
  if (!Array.isArray(s.vertices) || s.vertices.length !== 3 || !s.vertices.every(isName)) return { ok: false, error: "vertices 는 대문자 이름 3개입니다." };
  const need = s.kind === "parallel" ? 2 : 1;
  if (!Array.isArray(s.points) || s.points.length !== need || !s.points.every(isName)) return { ok: false, error: `points 는 이름 ${need}개입니다.` };
  const all = [...(s.vertices as string[]), ...(s.points as string[])]; if (new Set(all).size !== all.length) return { ok: false, error: "점 이름이 중복됩니다." };
  if (s.kind === "parallel" && !(typeof s.ratio === "number" && s.ratio >= 0.2 && s.ratio <= 0.8)) return { ok: false, error: "parallel 은 ratio(0.2~0.8)가 필요합니다." };
  if (s.kind === "altitude" && !(Array.isArray(s.legs) && s.legs.length === 2 && s.legs.every((n) => typeof n === "number" && n > 0))) return { ok: false, error: "altitude 는 legs 두 양수가 필요합니다." };
  if (s.sides !== undefined) {
    if (!Array.isArray(s.sides)) return { ok: false, error: "sides 는 배열입니다." };
    for (const q of s.sides as Record<string, unknown>[]) if (!q || !Array.isArray(q.between) || q.between.length !== 2 || !q.between.every((v) => all.includes(String(v))) || (q.label !== undefined && (typeof q.label !== "string" || q.label.length > 10))) return { ok: false, error: "sides[] 는 {between: 점 둘, label(10자 이내)} 입니다." };
  }
  return { ok: true, spec: s as unknown as TriNestedSpec };
}

export const TN_GEOM = { W: 400, H: 280, X: 56, Y: 40, FW: 288, FH: 190 } as const;
/** 모든 점의 화면 좌표(그림과 G8 이 같은 계산을 쓴다). */
export function nestedPoints(spec: TriNestedSpec): Record<string, Pt> {
  const { X, Y, FW, FH } = TN_GEOM; const P: Record<string, Pt> = {};
  const [v0, v1, v2] = spec.vertices;
  if (spec.kind === "parallel") {
    const ax = 0.42, ay = 0.82; const sc = Math.min(FW, FH / ay); const ox = X + (FW - sc) / 2, oy = Y + FH;
    const m = (x: number, y: number): Pt => [ox + x * sc, oy - y * sc];
    P[v0] = m(ax, ay); P[v1] = m(0, 0); P[v2] = m(1, 0); const r = spec.ratio!;
    P[spec.points[0]] = [P[v0][0] + r * (P[v1][0] - P[v0][0]), P[v0][1] + r * (P[v1][1] - P[v0][1])];
    P[spec.points[1]] = [P[v0][0] + r * (P[v2][0] - P[v0][0]), P[v0][1] + r * (P[v2][1] - P[v0][1])];
  } else {
    const [lb, la] = spec.legs!; // AC = lb, BC = la — C 직각
    const c = Math.hypot(la, lb); const ad = (lb * lb) / c; const h = (la * lb) / c;
    const mx = Math.max(c, h / 0.82 * 1); const sc = Math.min(FW / c, FH / h); void mx;
    const ox = X + (FW - c * sc) / 2, oy = Y + FH;
    P[v0] = [ox, oy]; P[v1] = [ox + c * sc, oy]; P[v2] = [ox + ad * sc, oy - h * sc]; P[spec.points[0]] = [ox + ad * sc, oy];
  }
  return P;
}
export function renderTriNested(spec: TriNestedSpec): { svg: string; alt: string; issues: FigureIssue[] } {
  const { W, H } = TN_GEOM; const sheet = new Sheet(W, H); const P = nestedPoints(spec); const [v0, v1, v2] = spec.vertices; const pts = spec.points;
  const cx = (P[v0][0] + P[v1][0] + P[v2][0]) / 3, cy = (P[v0][1] + P[v1][1] + P[v2][1]) / 3;
  const L = (a: string, b: string, o: { dashed?: boolean; w?: number } = {}) => sheet.line(P[a], P[b], o);
  L(v0, v1); L(v1, v2); L(v2, v0);
  if (spec.kind === "parallel") L(pts[0], pts[1]);
  else {
    L(v2, pts[0], { dashed: true, w: 1.6 });
    const D = P[pts[0]], C = P[v2];
    const ang = (o: Pt) => norm(Math.atan2(-(o[1] - C[1]), o[0] - C[0]));
    let [a1, a2] = [ang(P[v0]), ang(P[v1])].sort((x, y) => x - y); if (a2 - a1 > Math.PI) [a1, a2] = [a2, a1 + 2 * Math.PI];
    sheet.rightAngle(C, a1, a2);
    sheet.rightAngle(D, 0, 0.5 * Math.PI, 9);
  }
  if (spec.kind === "parallel" && spec.parallelMarks) for (const [a, b] of [[pts[0], pts[1]], [v1, v2]] as [string, string][]) {
    const m: Pt = [(P[a][0] + P[b][0]) / 2, (P[a][1] + P[b][1]) / 2]; sheet.raw(`<path d="M ${m[0] - 4} ${m[1] - 5} L ${m[0] + 3} ${m[1]} L ${m[0] - 4} ${m[1] + 5}" fill="none" stroke="#111" stroke-width="1.6"/>`);
  }
  for (const n of [...spec.vertices, ...pts]) sheet.dot(P[n]);
  for (const n of [...spec.vertices, ...pts]) {
    const c = P[n]; const dx = c[0] - cx, dy = c[1] - cy; const l = Math.hypot(dx, dy) || 1; const base = halfDiag(n) + 7;
    const cands: Pt[] = [0, 9, 18, 30].map((e): Pt => [c[0] + (dx / l) * (base + e), c[1] + (dy / l) * (base + e)]);
    for (const r of [base, base + 12, base + 24]) for (let a = 0; a < 360; a += 30) cands.push([c[0] + r * Math.cos((a * Math.PI) / 180), c[1] - r * Math.sin((a * Math.PI) / 180)]);
    const spot = sheet.firstFree(cands, n) ?? cands[0]; sheet.label(spot[0], spot[1], n, `점 이름(${n})`, { italic: true });
  }
  // 변 라벨 — 두 점 이름이 이은 선분의 중점에서 바깥쪽(무게중심 반대) 또는 안쪽 후보 중 첫 빈자리
  for (const s of spec.sides ?? []) {
    if (!s.label) continue; const a = P[s.between[0]], b = P[s.between[1]]; const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const ex = b[0] - a[0], ey = b[1] - a[1], len = Math.hypot(ex, ey) || 1; let nx = -ey / len, ny = ex / len; const out = nx * (mx - cx) + ny * (my - cy) >= 0; if (!out) { nx = -nx; ny = -ny; }
    const d = halfDiag(s.label) + 6; const cands: Pt[] = [d, d + 8, d + 18, -d, -(d + 8)].map((k): Pt => [mx + nx * k, my + ny * k]);
    for (const t of [0.35, 0.65]) for (const k of [d, -d, d + 12, -(d + 12)]) cands.push([a[0] + ex * t + nx * k, a[1] + ey * t + ny * k]);
    for (const r of [d, d + 10, d + 22]) for (let q = 0; q < 360; q += 30) cands.push([mx + r * Math.cos((q * Math.PI) / 180), my - r * Math.sin((q * Math.PI) / 180)]);
    const spot = sheet.firstFree(cands, s.label) ?? cands[0]; sheet.label(spot[0], spot[1], s.label, `변 라벨(${s.between.join("")})`);
  }
  if (spec.notToScale) sheet.note("Note: Figure not drawn to scale.");
  const alt = spec.kind === "parallel" ? `삼각형 ${v0}${v1}${v2} 안에 ${pts[0]}${pts[1]} ∥ ${v1}${v2}(${pts[0]} 는 ${v0}${v1} 위, ${pts[1]} 는 ${v0}${v2} 위)` : `${v2} 에서 직각인 직각삼각형 ${v0}${v1}${v2} 와 ${v2} 에서 빗변 ${v0}${v1} 에 내린 수선의 발 ${pts[0]}`;
  const text = alt + ((spec.sides ?? []).filter((s) => s.label).length ? `. 변: ${(spec.sides ?? []).filter((s) => s.label).map((s) => `${s.between.join("")} = ${s.label}`).join(", ")}` : "") + ".";
  return { svg: sheet.svg(text), alt: text, issues: sheet.uniqueIssues() };
}
export function lintTriNestedAgainstText(spec: TriNestedSpec, passage: string): FigureIssue[] {
  const issues: FigureIssue[] = []; const text = passage.replace(/\$/g, "").replace(/\\overline\{([A-Z]{2})\}/g, "$1");
  const all = new Set([...spec.vertices, ...spec.points]);
  for (const m of text.matchAll(/(?:triangles?|△|segment|side)\s+([A-Z]{2,3})\b/g)) for (const ch of m[1]) if (!all.has(ch)) issues.push({ code: "ref_missing", message: `지문의 ${m[1]} 의 점 '${ch}' 가 그림에 없습니다.` });
  return dedupe(issues);
}
