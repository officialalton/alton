// 표준 렌더링 엔진 — 템플릿: 평행선 3개와 횡단선 하나(각도)
//
// 평행선 이름 3개(위→아래), 횡단선 이름, 횡단선의 실제 기울기 angle(도, 위쪽 반직선이 동쪽에서 반시계로 잰 각 — 비인쇄), 평행선 간격 비 gaps(비인쇄).
// labels[] 는 어느 평행선과의 교점(line 0~2), 어느 사분면(NE·NW·SE·SW)의 각인지와 라벨(숫자·식·문자). 호·라벨 자리는 여기서 정한다.
// 사분면의 참 각: NE = SW = angle, NW = SE = 180 − angle. 숫자 라벨은 그려진 각과 같아야 한다(G8).

import { ARC_R, dedupe, halfDiag, Sheet, type FigureIssue, type Pt } from "./_layout";

export type P3Region = "NE" | "NW" | "SE" | "SW";
export type ParallelThreeSpec = {
  type: "parallel_three";
  lines: [string, string, string];
  transversal: string;
  angle: number;
  gaps?: [number, number];
  labels: { line: 0 | 1 | 2; region: P3Region; label: string }[];
  notToScale?: boolean;
};
const isName = (v: unknown): v is string => typeof v === "string" && /^[A-Za-zℓ]{1,2}$/.test(v);

export function validateParallelThree(input: unknown): { ok: true; spec: ParallelThreeSpec } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "그림 데이터가 객체가 아닙니다." };
  const s = input as Record<string, unknown>;
  if (s.type !== "parallel_three") return { ok: false, error: "type 이 parallel_three 가 아닙니다." };
  if (!Array.isArray(s.lines) || s.lines.length !== 3 || !s.lines.every(isName) || !isName(s.transversal)) return { ok: false, error: "lines 는 이름 3개, transversal 은 이름 하나입니다." };
  if (new Set([...(s.lines as string[]), s.transversal as string]).size !== 4) return { ok: false, error: "선 이름이 중복됩니다." };
  if (!(typeof s.angle === "number" && s.angle > 20 && s.angle < 160 && Math.abs(s.angle - 90) > 5)) return { ok: false, error: "angle 은 20~160 사이(90 근처 제외)의 수(도)입니다." };
  if (s.gaps !== undefined && !(Array.isArray(s.gaps) && s.gaps.length === 2 && s.gaps.every((g) => typeof g === "number" && g > 0.4 && g < 2.5))) return { ok: false, error: "gaps 는 0.4~2.5 의 수 둘입니다." };
  if (!Array.isArray(s.labels) || s.labels.length < 1 || s.labels.length > 4) return { ok: false, error: "labels 는 1~4개입니다." };
  const seen = new Set<string>();
  for (const q of s.labels as Record<string, unknown>[]) {
    if (!q || ![0, 1, 2].includes(Number(q.line)) || !["NE", "NW", "SE", "SW"].includes(String(q.region)) || typeof q.label !== "string" || !q.label.trim() || q.label.length > 12) return { ok: false, error: "labels[] 는 {line 0~2, region NE|NW|SE|SW, label(12자 이내)} 입니다." };
    const k = `${q.line}${q.region}`; if (seen.has(k)) return { ok: false, error: "같은 자리에 라벨이 둘입니다." }; seen.add(k);
  }
  return { ok: true, spec: s as unknown as ParallelThreeSpec };
}

export const P3_GEOM = { W: 420, H: 300, X0: 36, X1: 380, TOP: 66, SPAN: 168 } as const;
const rad = (d: number) => (d * Math.PI) / 180;
export const regionTrue = (r: P3Region, a: number) => (r === "NE" || r === "SW" ? a : 180 - a);
export function p3Lines(spec: ParallelThreeSpec): { ys: [number, number, number]; cx: number; dir: Pt } {
  const { TOP, SPAN, W } = P3_GEOM; const g = spec.gaps ?? [1, 1]; const tot = g[0] + g[1];
  const ys: [number, number, number] = [TOP, TOP + (SPAN * g[0]) / tot, TOP + SPAN]; return { ys, cx: W / 2 - 10, dir: [Math.cos(rad(spec.angle)), -Math.sin(rad(spec.angle))] };
}
export function renderParallelThree(spec: ParallelThreeSpec): { svg: string; alt: string; issues: FigureIssue[] } {
  const { W, H, X0, X1 } = P3_GEOM; const sheet = new Sheet(W, H); const { ys, cx, dir } = p3Lines(spec);
  const at = (i: number): Pt => { const t = (ys[i] - ys[1]) / dir[1]; return [cx + dir[0] * t, ys[i]]; };
  for (let i = 0; i < 3; i++) sheet.line([X0, ys[i]], [X1, ys[i]]);
  // 횡단선: 맨 아래 평행선 아래 36px 부터 맨 위 평행선 위 36px 까지
  const tA = (ys[0] - 36 - ys[1]) / dir[1], tB = (ys[2] + 36 - ys[1]) / dir[1]; const topP: Pt = [cx + dir[0] * tA, ys[0] - 36], botP: Pt = [cx + dir[0] * tB, ys[2] + 36];
  sheet.line(botP, topP);
  for (let i = 0; i < 3; i++) sheet.text(X1 + 14, ys[i] + 1, spec.lines[i], { italic: true });
  sheet.label(topP[0] + (dir[0] >= 0 ? 14 : -14), topP[1] - 10, spec.transversal, "횡단선 이름", { italic: true });
  const base: Record<P3Region, [number, number]> = { NE: [0, spec.angle], NW: [spec.angle, 180], SW: [180, 180 + spec.angle], SE: [180 + spec.angle, 360] };
  for (const q of spec.labels) {
    const c = at(q.line); const [d1, d2] = base[q.region]; const a1 = rad(d1), a2 = rad(d2);
    sheet.arc(c, ARC_R, a1, a2);
    const mid = (a1 + a2) / 2, half = (a2 - a1) / 2, hd = halfDiag(q.label); const r0 = Math.max((hd + 4) / Math.max(Math.sin(half), 0.2), ARC_R + hd + 3);
    const cands: Pt[] = []; for (const f of [1, 1.25, 1.5, 1.8]) for (const off of [0, 8, -8, 16, -16]) cands.push([c[0] + r0 * f * Math.cos(mid + rad(off)), c[1] - r0 * f * Math.sin(mid + rad(off))]);
    for (const r of [r0, r0 + 14, r0 + 28, r0 + 44]) for (let a = 0; a < 360; a += 30) cands.push([c[0] + r * Math.cos(rad(a)), c[1] - r * Math.sin(rad(a))]);
    const spot = sheet.firstFree(cands, q.label) ?? cands[0]; sheet.label(spot[0], spot[1], q.label, `각 라벨(${q.line}${q.region})`);
  }
  if (spec.notToScale) sheet.note("Note: Figure not drawn to scale.");
  const alt = `평행선 ${spec.lines.join(", ")} 세 개와 이를 지나는 직선 ${spec.transversal}. 각: ${spec.labels.map((q) => `${spec.lines[q.line]} 의 ${q.region} ${q.label}`).join(", ")}.`;
  return { svg: sheet.svg(alt), alt, issues: sheet.uniqueIssues() };
}
export function lintParallelThreeAgainstText(spec: ParallelThreeSpec, passage: string): FigureIssue[] {
  const issues: FigureIssue[] = []; const text = passage.replace(/\$/g, "");
  for (const m of text.matchAll(/\b[Ll]ines?\s+([a-zℓ])\b/g)) if (![...spec.lines, spec.transversal].includes(m[1])) issues.push({ code: "ref_missing", message: `지문의 선 ${m[1]} 가 그림에 없습니다.` });
  return dedupe(issues);
}
