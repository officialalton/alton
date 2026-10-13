// FRQ 손글씨 압축 표현: 획 = {c: 색 인덱스(0..2), p: [x0,y0,x1,y1,...]} (정수 좌표, 캔버스 INK_W×INK_H 기준).
// 저장 시 점을 솎아내고(Ramer–Douglas–Peucker) 정수로 반올림한다. 결과 화면용 미리보기는 SVG 문자열(<img> 로만 표시)로 같이 저장한다.
export const INK_W = 800;
export const INK_H = 500; // 기본(Medium) 높이
// 보드 높이(논리 좌표): 키우면 그리는 영역만 늘고 기존 획은 그대로다(좌표계 고정). 상한 1600 은 획 크기 상한(256KB) 안에서 충분하다.
export const INK_MIN_H = 300;
export const INK_MAX_H = 1600;
export const INK_H_PRESETS = [{ label: "Small", h: 350 }, { label: "Medium", h: 500 }, { label: "Large", h: 800 }, { label: "Extra large", h: 1200 }] as const;
export function clampBoardHeight(h: number, strokes: { p: number[] }[] = []): number {
  let maxY = 0;
  for (const s of strokes) for (let i = 1; i < s.p.length; i += 2) maxY = Math.max(maxY, s.p[i]);
  const min = Math.min(INK_MAX_H, Math.max(INK_MIN_H, Math.ceil(maxY) + 10)); // 획이 잘리지 않게 그린 곳 아래로는 줄이지 않는다
  return Math.max(min, Math.min(INK_MAX_H, Math.round(Number.isFinite(h) ? h : INK_H)));
}
export const INK_COLORS = [
  { name: "Black", value: "#111111" },
  { name: "Red", value: "#e11d48" },
  { name: "Blue", value: "#2563eb" },
] as const;
export type InkStroke = { c: number; p: number[] };
// 크기 상한(DB 마이그레이션 570 과 같은 값 — 바꾸면 둘 다).
export const INK_MAX_STROKES = 300;
export const INK_MAX_POINTS_PER_STROKE = 1000;
export const INK_MAX_POINTS_TOTAL = 20000;
export const INK_MAX_STROKES_BYTES = 262144; // strokes JSON 256KB
export const INK_MAX_SVG_BYTES = 200000; // 미리보기 SVG 200KB

export function pointCount(strokes: InkStroke[]): number {
  return strokes.reduce((a, s) => a + s.p.length / 2, 0);
}

function perp(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
/** 점 목록 [x,y,...] 을 tolerance 안에서 단순화(RDP)하고 정수로 반올림한다. 점 하나(탭)는 같은 점 두 번으로 늘려 점으로 그린다. */
export function simplifyPoints(p: number[], tolerance = 0.8): number[] {
  const n = p.length / 2;
  if (n === 0) return [];
  if (n === 1) return [Math.round(p[0]), Math.round(p[1]), Math.round(p[0]), Math.round(p[1])];
  const keep = new Array<boolean>(n).fill(false);
  keep[0] = keep[n - 1] = true;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop() as [number, number];
    let max = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = perp(p[2 * i], p[2 * i + 1], p[2 * a], p[2 * a + 1], p[2 * b], p[2 * b + 1]);
      if (d > max) { max = d; idx = i; }
    }
    if (idx >= 0 && max > tolerance) { keep[idx] = true; stack.push([a, idx], [idx, b]); }
  }
  const out: number[] = [];
  let lx = NaN, ly = NaN;
  for (let i = 0; i < n; i++) {
    if (!keep[i]) continue;
    const x = Math.max(0, Math.min(INK_W, Math.round(p[2 * i]))), y = Math.max(0, Math.min(INK_H, Math.round(p[2 * i + 1])));
    if (x === lx && y === ly) continue;
    out.push(x, y); lx = x; ly = y;
  }
  if (out.length === 2) out.push(out[0], out[1]);
  return out.slice(0, INK_MAX_POINTS_PER_STROKE * 2);
}

/** 미리보기 SVG(허용 목록 형식만: path 의 d 는 M/L/숫자, stroke 는 팔레트 색). DB 가 같은 정규식으로 검증한다. */
export function strokesToSvg(strokes: InkStroke[], height: number = INK_H): string {
  const paths = strokes.map((s) => {
    let d = `M${s.p[0]} ${s.p[1]}`;
    for (let i = 2; i < s.p.length; i += 2) d += `L${s.p[i]} ${s.p[i + 1]}`;
    const color = (INK_COLORS[s.c] ?? INK_COLORS[0]).value;
    return `<path d="${d}" stroke="${color}" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${INK_W} ${height}">${paths}</svg>`;
}
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** 저장 전 클라이언트 검사. 문제 있으면 학생에게 보여줄 영어 문구, 없으면 null. */
export function inkSizeProblem(strokes: InkStroke[], height: number = INK_H): string | null {
  const big = "This drawing is too large to save. Erase or clear some strokes.";
  if (strokes.length > INK_MAX_STROKES || pointCount(strokes) > INK_MAX_POINTS_TOTAL) return big;
  if (JSON.stringify(strokes).length > INK_MAX_STROKES_BYTES || strokesToSvg(strokes, height).length > INK_MAX_SVG_BYTES) return big;
  return null;
}

export function eraseStrokesNear(strokes: InkStroke[], x: number, y: number, radius = 12): InkStroke[] {
  return strokes.filter((s) => {
    for (let i = 0; i + 3 < s.p.length; i += 2) {
      if (perp(x, y, s.p[i], s.p[i + 1], s.p[i + 2], s.p[i + 3]) <= radius) return false;
    }
    return true;
  });
}

export type FrqInkRow = { setItemId: string; partLabel: string; strokeCount: number; previewSvg: string; boardHeight?: number; strokes?: InkStroke[] };
export const inkKey = (setItemId: string, label: string) => `${setItemId}:${label}`;
