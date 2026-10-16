// 표준 렌더링 엔진 — 템플릿: L자형 합성 다각형(직각 여섯 꼭짓점)
//
// 꼭짓점: (0,0)→(W,0)→(W,h1)→(w1,h1)→(w1,H)→(0,H). 모든 각이 직각이고 변은 e0(아래 W)·e1(오른쪽 h1)·e2(안쪽 가로 W−w1)·e3(안쪽 세로 H−h1)·e4(위 w1)·e5(왼쪽 H).
// shape(W,H,w1,h1 — 비인쇄 참값)대로 그리고, 변 길이 라벨은 sides[].label(숫자·문자 x·식)로 받는다. 숫자 라벨은 그려진 길이와 비례해야 한다(G8).

import { dedupe, halfDiag, Sheet, type FigureIssue, type Pt } from "./_layout";

export type LShapeSpec = {
  type: "l_shape";
  shape: { W: number; H: number; w1: number; h1: number };
  sides?: { edge: 0 | 1 | 2 | 3 | 4 | 5; label: string }[];
  /** 안쪽 오목 모서리에 직각 표시. */
  notToScale?: boolean;
};

export function validateLShape(input: unknown): { ok: true; spec: LShapeSpec } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "그림 데이터가 객체가 아닙니다." };
  const s = input as Record<string, unknown>;
  if (s.type !== "l_shape") return { ok: false, error: "type 이 l_shape 가 아닙니다." };
  const sh = s.shape as Record<string, unknown> | undefined;
  if (!sh || !["W", "H", "w1", "h1"].every((k) => typeof sh[k] === "number" && (sh[k] as number) > 0)) return { ok: false, error: "shape 는 양수 W, H, w1, h1 입니다." };
  const { W, H, w1, h1 } = sh as { W: number; H: number; w1: number; h1: number };
  if (!(w1 < W && h1 < H)) return { ok: false, error: "w1 < W, h1 < H 여야 L 자가 됩니다." };
  if (s.sides !== undefined) {
    if (!Array.isArray(s.sides)) return { ok: false, error: "sides 는 배열입니다." };
    const seen = new Set<number>();
    for (const q of s.sides as Record<string, unknown>[]) { if (!q || !Number.isInteger(q.edge) || (q.edge as number) < 0 || (q.edge as number) > 5 || typeof q.label !== "string" || !q.label.trim() || q.label.length > 10) return { ok: false, error: "sides[] 는 {edge 0~5, label(10자 이내)} 입니다." }; if (seen.has(q.edge as number)) return { ok: false, error: "같은 변에 라벨이 둘입니다." }; seen.add(q.edge as number); }
  }
  return { ok: true, spec: s as unknown as LShapeSpec };
}

export const LS_GEOM = { W: 400, H: 290, X: 60, Y: 34, FW: 270, FH: 190 } as const;
export function lShapePoints(spec: LShapeSpec): Pt[] {
  const { X, Y, FW, FH } = LS_GEOM; const { W, H, w1, h1 } = spec.shape; const k = Math.min(FW / W, FH / H);
  const ox = X + (FW - W * k) / 2, base = Y + FH - (FH - H * k) / 2;
  const m = (x: number, y: number): Pt => [ox + x * k, base - y * k];
  return [m(0, 0), m(W, 0), m(W, h1), m(w1, h1), m(w1, H), m(0, H)];
}
export function renderLShape(spec: LShapeSpec): { svg: string; alt: string; issues: FigureIssue[] } {
  const { W, H } = LS_GEOM; const sheet = new Sheet(W, H); const P = lShapePoints(spec);
  for (let i = 0; i < 6; i++) sheet.line(P[i], P[(i + 1) % 6]);
  // 볼록한 다섯 꼭짓점에 직각 표시(오목한 P3 는 270° 라 표시하지 않는다)
  for (const i of [0, 1, 2, 4, 5]) {
    const a = P[i], p = P[(i + 5) % 6], n = P[(i + 1) % 6]; const ang = (q: Pt) => { let t = Math.atan2(-(q[1] - a[1]), q[0] - a[0]); if (t < 0) t += 2 * Math.PI; return t; };
    let [a1, a2] = [ang(p), ang(n)].sort((x, y) => x - y); if (a2 - a1 > Math.PI) [a1, a2] = [a2, a1 + 2 * Math.PI]; sheet.rightAngle(a, a1, a2, 9);
  }
  const out: Record<number, [number, number]> = { 0: [0, 1], 1: [1, 0], 2: [0, -1], 3: [1, 0], 4: [0, -1], 5: [-1, 0] };
  for (const s of spec.sides ?? []) {
    const a = P[s.edge], b = P[(s.edge + 1) % 6]; const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2; const [nx, ny] = out[s.edge];
    const horiz = s.edge % 2 === 0; const d = horiz ? 15 : halfDiag(s.label) + 7;
    const cands: Pt[] = [d, d + 9, d + 20].map((k): Pt => [mx + nx * k, my + ny * k]); cands.push([mx - nx * d, my - ny * d], [mx - nx * (d + 9), my - ny * (d + 9)]);
    for (const r of [d, d + 10, d + 22]) for (let q = 0; q < 360; q += 30) cands.push([mx + r * Math.cos((q * Math.PI) / 180), my - r * Math.sin((q * Math.PI) / 180)]);
    const spot = sheet.firstFree(cands, s.label) ?? cands[0]; sheet.label(spot[0], spot[1], s.label, `변 라벨(e${s.edge})`);
  }
  if (spec.notToScale) sheet.note("Note: Figure not drawn to scale.");
  const alt = `L자형 도형(모든 각이 직각)${(spec.sides ?? []).length ? `. 변: ${(spec.sides ?? []).map((q) => `${["아래", "오른쪽", "안쪽 가로", "안쪽 세로", "위", "왼쪽"][q.edge]} ${q.label}`).join(", ")}` : ""}.`;
  return { svg: sheet.svg(alt), alt, issues: sheet.uniqueIssues() };
}
export function lintLShapeAgainstText(_spec: LShapeSpec, _passage: string): FigureIssue[] { return dedupe([]); }
