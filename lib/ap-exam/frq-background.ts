// FRQ 손글씨 패드의 배경 프리셋(2026-10-14). 저장값은 프리셋 id 하나뿐이고 픽셀은 저장하지 않는다.
// 같은 기하(선분 목록)를 캔버스(패드)와 SVG(결과 화면)가 공유해 학생이 쓴 풀이가 결과 화면에서도 같은 축 위에 보인다. 지우개는 획만 지우므로 배경은 지워지지 않는다.
import { INK_W } from "./frq-ink";

export const INK_BACKGROUNDS = [
  { id: "blank", label: "Blank" },
  { id: "grid", label: "Grid" },
  { id: "axes", label: "Axes" },
  { id: "axes_grid", label: "Axes + grid" },
  { id: "axes_two", label: "Two-panel axes" },
  { id: "number_line", label: "Number line" },
] as const;
export type InkBackground = (typeof INK_BACKGROUNDS)[number]["id"];
export const INK_BACKGROUND_IDS: readonly string[] = INK_BACKGROUNDS.map((b) => b.id);
export function normalizeBackground(v: unknown): InkBackground {
  return typeof v === "string" && INK_BACKGROUND_IDS.includes(v) ? (v as InkBackground) : "blank";
}

type Seg = { x1: number; y1: number; x2: number; y2: number; w: number; color: string };
const GRID = "#e5e7eb", AXIS = "#6b7280";
const STEP = 40;

function gridSegs(h: number): Seg[] {
  const s: Seg[] = [];
  for (let x = STEP; x < INK_W; x += STEP) s.push({ x1: x, y1: 0, x2: x, y2: h, w: 1, color: GRID });
  for (let y = STEP; y < h; y += STEP) s.push({ x1: 0, y1: y, x2: INK_W, y2: y, w: 1, color: GRID });
  return s;
}
function arrow(x: number, y: number, dx: number, dy: number): Seg[] { // (x,y) 끝점에서 (dx,dy) 방향 화살촉
  const a = 7;
  return dx !== 0
    ? [{ x1: x, y1: y, x2: x - dx * a, y2: y - a / 1.5, w: 1.5, color: AXIS }, { x1: x, y1: y, x2: x - dx * a, y2: y + a / 1.5, w: 1.5, color: AXIS }]
    : [{ x1: x, y1: y, x2: x - a / 1.5, y2: y - dy * a, w: 1.5, color: AXIS }, { x1: x, y1: y, x2: x + a / 1.5, y2: y - dy * a, w: 1.5, color: AXIS }];
}
/** 원점 (ox,oy), 위쪽 끝 top 인 x–y 축 + 눈금. */
function axesSegs(ox: number, oy: number, top: number): Seg[] {
  const s: Seg[] = [
    { x1: ox, y1: oy, x2: INK_W - 20, y2: oy, w: 1.5, color: AXIS },
    { x1: ox, y1: oy, x2: ox, y2: top, w: 1.5, color: AXIS },
    ...arrow(INK_W - 20, oy, 1, 0), ...arrow(ox, top, 0, 1),
  ];
  for (let x = ox + STEP; x < INK_W - 30; x += STEP) s.push({ x1: x, y1: oy - 4, x2: x, y2: oy + 4, w: 1.5, color: AXIS });
  for (let y = oy - STEP; y > top + 10; y -= STEP) s.push({ x1: ox - 4, y1: y, x2: ox + 4, y2: y, w: 1.5, color: AXIS });
  return s;
}
function numberLineSegs(h: number): Seg[] {
  const y = Math.round(h / 2), s: Seg[] = [{ x1: 30, y1: y, x2: INK_W - 30, y2: y, w: 1.5, color: AXIS }, ...arrow(INK_W - 30, y, 1, 0), ...arrow(30, y, -1, 0)];
  for (let x = 40; x < INK_W - 30; x += STEP) s.push({ x1: x, y1: y - (x === 400 ? 10 : 5), x2: x, y2: y + (x === 400 ? 10 : 5), w: 1.5, color: AXIS });
  return s;
}

/** 논리 좌표(800 × height)의 배경 선분. blank 는 빈 배열. */
export function backgroundSegments(bg: InkBackground, height: number): Seg[] {
  switch (bg) {
    case "grid": return gridSegs(height);
    case "axes": return axesSegs(80, height - 50, 24);
    case "axes_grid": return [...gridSegs(height), ...axesSegs(80, height - 50, 24)];
    case "axes_two": { const half = Math.round(height / 2); return [...axesSegs(80, half - 30, 16), ...axesSegs(80, height - 30, half + 16)]; }
    case "number_line": return numberLineSegs(height);
    default: return [];
  }
}

export function drawBackground(ctx: CanvasRenderingContext2D, bg: InkBackground, height: number) {
  for (const s of backgroundSegments(bg, height)) {
    ctx.strokeStyle = s.color; ctx.lineWidth = s.w; ctx.lineCap = "butt";
    ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
  }
}

/** 저장된 미리보기 SVG(획만 들어 있음) 아래에 배경을 깔아 결과 화면용 SVG 를 만든다. 저장 형식·DB 검증은 그대로다. */
export function withBackground(previewSvg: string, bg: InkBackground | string | undefined | null, height?: number): string {
  const id = normalizeBackground(bg);
  if (id === "blank") return previewSvg;
  const m = /^(<svg [^>]*viewBox="0 0 800 (\d+)"[^>]*>)/.exec(previewSvg);
  if (!m) return previewSvg;
  const lines = backgroundSegments(id, height ?? Number(m[2])).map((s) => `<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" stroke="${s.color}" stroke-width="${s.w}"/>`).join("");
  return `${m[1]}${lines}${previewSvg.slice(m[1].length)}`;
}

/** 파트 지문이 축·그래프 스케치를 요구하면 Axes 를 기본으로, 아니면 Blank. */
export function defaultBackgroundForPrompt(prompt: string | null | undefined): InkBackground {
  const t = prompt ?? "";
  return /\baxes\b/i.test(t) || (/\bsketch/i.test(t) && /\bgraphs?\b/i.test(t)) ? "axes" : "blank";
}
