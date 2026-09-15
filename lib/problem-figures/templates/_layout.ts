// 표준 렌더링 엔진 — 템플릿 공통 조판 도구. 글꼴·선 굵기·라벨 크기·충돌 검사 규칙은 여기서 한 번만 정한다.
// 라벨은 **놓을 자리를 규칙으로 계산**하고, 그 자리가 선·호·다른 라벨과 겹치거나 화면 밖이면 문제(issue)로 기록한다.
// 자동으로 밀어 넣지 않는다 — 그런 그림은 공개되면 안 되고, 사람이 데이터(라벨·구성)를 고쳐야 한다.

export type FigureIssue = { code: string; message: string };
export type Pt = [number, number];

export const FONT = "Georgia, 'Times New Roman', serif";
export const LABEL_SIZE = 15;
export const LINE_W = 2;
export const ARC_R = 15;
export const RIGHT_R = 11;

export const f = (n: number) => (Math.round(n * 100) / 100).toString();
/** 하이픈은 빼기(−)로 조판한다. XML 이스케이프. */
export const esc = (t: string) =>
  t.replace(/ - /g, " − ").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

/** 라벨 폭 추정(세리프 15px 기준). 정확한 글꼴 측정은 브라우저마다 다르므로 넉넉히 잡는다. */
export function labelWidth(text: string, size = LABEL_SIZE): number {
  let w = 0;
  for (const ch of text) w += /[°'"|.,]/.test(ch) ? 0.35 : /[A-Z]/.test(ch) ? 0.68 : /[()]/.test(ch) ? 0.4 : 0.55;
  return w * size + 6;
}
export const halfDiag = (text: string, size = LABEL_SIZE) => Math.hypot(labelWidth(text, size), size + 2) / 2;

type Box = { x1: number; y1: number; x2: number; y2: number };
const box = (x: number, y: number, w: number, h: number): Box => ({ x1: x - w / 2, y1: y - h / 2, x2: x + w / 2, y2: y + h / 2 });
const overlap = (a: Box, b: Box, gap = 2) => a.x1 < b.x2 + gap && b.x1 < a.x2 + gap && a.y1 < b.y2 + gap && b.y1 < a.y2 + gap;
export function segDist(p: Pt, a: Pt, b: Pt): number {
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / (vx * vx + vy * vy || 1)));
  return Math.hypot(p[0] - (a[0] + t * vx), p[1] - (a[1] + t * vy));
}
function boxHitsSegment(b: Box, a: Pt, c: Pt, pad = 3): boolean {
  const cx = (b.x1 + b.x2) / 2, cy = (b.y1 + b.y2) / 2;
  const half = Math.min(b.x2 - b.x1, b.y2 - b.y1) / 2;
  if (segDist([cx, cy], a, c) < half + pad) return true;
  const corners: Pt[] = [[b.x1, b.y1], [b.x2, b.y1], [b.x1, b.y2], [b.x2, b.y2]];
  return corners.some((p) => segDist(p, a, c) < pad);
}
export const norm = (a: number) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

type Placed =
  | { kind: "label"; text: string; x: number; y: number; w: number; h: number }
  | { kind: "arc"; c: Pt; r: number; a1: number; a2: number };

/** 한 그림의 조판 상태 — 선·호·라벨을 쌓고 충돌을 본다. */
export class Sheet {
  readonly out: string[] = [];
  readonly issues: FigureIssue[] = [];
  private readonly placed: Placed[] = [];
  private readonly segments: [Pt, Pt][] = [];
  constructor(public width: number, public height: number) {}

  text(x: number, y: number, t: string, o: { size?: number; italic?: boolean; anchor?: "start" | "middle" | "end"; color?: string } = {}) {
    this.out.push(
      `<text x="${f(x)}" y="${f(y)}" font-family="${FONT}" font-size="${o.size ?? LABEL_SIZE}" font-style="${o.italic ? "italic" : "normal"}" text-anchor="${o.anchor ?? "middle"}" dominant-baseline="middle" fill="${o.color ?? "#111"}" stroke="#fff" stroke-width="4" paint-order="stroke" stroke-linejoin="round">${esc(t)}</text>`
    );
  }
  line(a: Pt, b: Pt, o: { w?: number; dashed?: boolean } = {}) {
    this.segments.push([a, b]);
    this.out.push(
      `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="#111" stroke-width="${o.w ?? LINE_W}" stroke-linecap="round"${o.dashed ? ' stroke-dasharray="5 4"' : ""}/>`
    );
  }
  /** 각 호 — 수학 각(반시계, 라디안) a1→a2. */
  arc(c: Pt, r: number, a1: number, a2: number) {
    const p = (a: number): Pt => [c[0] + r * Math.cos(a), c[1] - r * Math.sin(a)];
    const [x1, y1] = p(a1), [x2, y2] = p(a2);
    const large = Math.abs(a2 - a1) > Math.PI ? 1 : 0;
    this.out.push(`<path d="M ${f(x1)} ${f(y1)} A ${r} ${r} 0 ${large} 0 ${f(x2)} ${f(y2)}" fill="none" stroke="#111" stroke-width="1.6"/>`);
    this.placed.push({ kind: "arc", c, r, a1, a2 });
  }
  /** 직각 표시 — 두 반직선 방향 a1, a2 사이의 작은 정사각형. */
  rightAngle(c: Pt, a1: number, a2: number, r = RIGHT_R) {
    const mid = (a1 + a2) / 2;
    const p1: Pt = [c[0] + r * Math.cos(a1), c[1] - r * Math.sin(a1)];
    const p2: Pt = [c[0] + r * Math.cos(a2), c[1] - r * Math.sin(a2)];
    const pm: Pt = [c[0] + r * Math.SQRT2 * Math.cos(mid), c[1] - r * Math.SQRT2 * Math.sin(mid)];
    this.out.push(`<polyline points="${f(p1[0])},${f(p1[1])} ${f(pm[0])},${f(pm[1])} ${f(p2[0])},${f(p2[1])}" fill="none" stroke="#111" stroke-width="1.6"/>`);
    this.placed.push({ kind: "arc", c, r: r * Math.SQRT2, a1, a2 });
  }
  /** 등변·등각 표시(짧은 눗금) — 선분 중점에 n개, 선분에 수직. */
  ticks(a: Pt, b: Pt, n: number) {
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 5;
      const cx = mx + ux * off, cy = my + uy * off;
      this.out.push(`<line x1="${f(cx - uy * 5)}" y1="${f(cy + ux * 5)}" x2="${f(cx + uy * 5)}" y2="${f(cy - ux * 5)}" stroke="#111" stroke-width="1.6"/>`);
    }
  }
  /** 원시 SVG 조각(격자·축 등 — 충돌 검사 대상이 아닌 배경). */
  raw(svg: string) {
    this.out.push(svg);
  }
  /** 곡선 — 표본점을 잇는다. 각 조각을 선분으로 등록해 라벨 충돌을 본다. */
  polyline(points: Pt[], o: { w?: number; dashed?: boolean; color?: string } = {}) {
    if (points.length < 2) return;
    for (let i = 1; i < points.length; i++) this.segments.push([points[i - 1], points[i]]);
    this.out.push(
      `<polyline points="${points.map((p) => `${f(p[0])},${f(p[1])}`).join(" ")}" fill="none" stroke="${o.color ?? "#111"}" stroke-width="${o.w ?? LINE_W}" stroke-linejoin="round" stroke-linecap="round"${o.dashed ? ' stroke-dasharray="6 4"' : ""}/>`
    );
  }
  /** 선분을 충돌 검사 대상으로만 등록(그리지 않음). */
  registerSegment(a: Pt, b: Pt) {
    this.segments.push([a, b]);
  }
  /** 라벨 후보 자리 중 겹치지 않는 첫 자리를 고른다 — 규칙(후보 순서)은 호출자가 정한다. 없으면 null. */
  firstFree(cands: Pt[], t: string, size = LABEL_SIZE): Pt | null {
    const w = labelWidth(t, size), h = size + 2;
    for (const [x, y] of cands) {
      const b = box(x, y, w, h);
      if (b.x1 < 4 || b.y1 < 4 || b.x2 > this.width - 4 || b.y2 > this.height - 4) continue;
      if (this.placed.some((p) => p.kind === "label" && overlap(b, box(p.x, p.y, p.w, p.h)))) continue;
      if (this.segments.some(([a, c]) => boxHitsSegment(b, a, c))) continue;
      return [x, y];
    }
    return null;
  }
  dot(c: Pt) {
    this.out.push(`<circle cx="${f(c[0])}" cy="${f(c[1])}" r="2.8" fill="#111"/>`);
  }
  /** 라벨을 놓되 충돌·잘림은 문제로 기록한다. */
  label(x: number, y: number, t: string, what: string, o: { italic?: boolean; size?: number; color?: string } = {}) {
    const size = o.size ?? LABEL_SIZE;
    const w = labelWidth(t, size), h = size + 2;
    const b = box(x, y, w, h);
    if (b.x1 < 4 || b.y1 < 4 || b.x2 > this.width - 4 || b.y2 > this.height - 4) this.issues.push({ code: "clipped", message: `${what} '${t}' 가 그림 밖으로 나갑니다.` });
    for (const p of this.placed) {
      if (p.kind === "label" && overlap(b, box(p.x, p.y, p.w, p.h))) this.issues.push({ code: "label_collision", message: `${what} '${t}' 가 '${p.text}' 와 겹칩니다.` });
      if (p.kind === "arc") {
        const ang = norm(Math.atan2(-(y - p.c[1]), x - p.c[0]));
        const inWedge = (ang >= p.a1 && ang <= p.a2) || (ang + 2 * Math.PI >= p.a1 && ang + 2 * Math.PI <= p.a2);
        if (inWedge && Math.hypot(x - p.c[0], y - p.c[1]) < p.r + Math.hypot(w, h) / 2) this.issues.push({ code: "label_collision", message: `${what} '${t}' 가 각 표시와 겹칩니다.` });
      }
    }
    for (const [a, c] of this.segments) if (boxHitsSegment(b, a, c)) this.issues.push({ code: "label_collision", message: `${what} '${t}' 가 선과 겹칩니다.` });
    this.placed.push({ kind: "label", text: t, x, y, w, h });
    this.text(x, y, t, { italic: o.italic, size, color: o.color });
  }
  note(text: string) {
    this.text(24, this.height - 14, text, { size: 12.5, italic: true, anchor: "start" });
  }
  svg(alt: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.width} ${this.height}" width="${this.width}" height="${this.height}" role="img" aria-label="${esc(alt)}" style="max-width:100%;height:auto"><title>${esc(alt)}</title>${this.out.join("")}</svg>`;
  }
  uniqueIssues(): FigureIssue[] {
    const seen = new Set<string>();
    return this.issues.filter((i) => (seen.has(i.message) ? false : (seen.add(i.message), true)));
  }
}

export function dedupe(issues: FigureIssue[]): FigureIssue[] {
  const seen = new Set<string>();
  return issues.filter((i) => (seen.has(i.message) ? false : (seen.add(i.message), true)));
}
