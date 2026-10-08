// AP 전용 그림 템플릿 2종 — 후보의 stimulus.data(자유 형식)를 정규화한 **엄격한 스펙**을 우리가 직접 그린다.
//   ap_graph : 함수 그래프(f, f', f''), 미적분 구간선형·불연속(열린/닫힌 점), 영역 음영, 미시경제 수요·공급·비용 곡선·균형점,
//              생물 선 그래프(오차 막대). 점 목록으로 받으며(식은 정규화 단계에서 표본점으로 바꾼다) 축·눈금·격자는 여기서 그린다.
//   ap_table : 자료 표(열 머리글·단위·주석). HTML 표 마크업.
// AI 는 점·라벨·식만 낸다 — 좌표 변환·눈금·라벨 충돌 검사는 렌더러 몫(그림 라벨이 겹치면 issue → 공개 게이트 실패).

import { esc, f, FONT, labelWidth, type FigureIssue, type Pt } from "./_layout";
import { renderApDiagram, validateApDiagram, type ApDiagramSpec } from "./ap-diagrams";

export type ApAxis = { label: string; min: number; max: number; step?: number };
export type ApSeries = {
  label: string;
  /** 표본점(식에서 만든 경우 촘촘한 표본). 불연속은 gaps 로 끊는다. */
  points: Pt[];
  style?: "solid" | "dashed";
  /** 점마다 점 표시(선 그래프 데이터점). */
  dots?: boolean;
  /** 점마다 ± 오차(오차 막대). points 와 같은 길이. */
  errors?: number[];
  /** 선을 끊을 points 인덱스(그 점 뒤에서 끊음) — 점프·구멍 불연속. */
  gaps?: number[];
  /** 라벨 자리 선호(기본 오른쪽 끝). */
  labelAt?: "start" | "end" | "mid";
  /** 출처 식(문서·점검용). */
  source?: string;
};
export type ApMarker = { x: number; y: number; style: "filled" | "open"; label?: string; /** 곡선 위가 아닌 독립 점(불연속 문항의 f(a) 값 등) */ standalone?: boolean };
export type ApShade = { upper: number | "axis"; lower: number | "axis"; xMin: number; xMax: number; label?: string; /** 기본 x 기준(곡선 위·아래). y 이면 xMin/xMax 는 y 구간이고 두 곡선의 x 값 사이를 칠한다. */ over?: "x" | "y" };
export type ApGuide = { axis: "x" | "y"; at: number; label?: string; to?: number };

export type ApGraphSpec = {
  type: "ap_graph";
  title?: string;
  x: ApAxis;
  y: ApAxis;
  series: ApSeries[];
  markers?: ApMarker[];
  shades?: ApShade[];
  guides?: ApGuide[];
};
export type ApTableSpec = {
  type: "ap_table";
  title?: string;
  columns: string[];
  rows: (string | number)[][];
  notes?: string[];
  /** 표 전체 단위(열 머리글에 없을 때 캡션으로). */
  units?: string;
};
/** 같은 문항의 표가 둘 이상(Bio 유전 자료 등) — 위에서 아래로 쌓는다. facts=true 이면 "Given information" 값 목록(표가 아닌 조건·식). */
export type ApTableSetSpec = { type: "ap_table_set"; title?: string; tables: ApTableSpec[]; notes?: string[] };
export type ApSpec = ApGraphSpec | ApTableSpec | ApDiagramSpec | ApTableSetSpec;
export const AP_FIGURE_TYPES: readonly string[] = ["ap_graph", "ap_table", "ap_diagram", "ap_table_set"];
export const isApSpec = (s: { type: string }): s is ApSpec => AP_FIGURE_TYPES.includes(s.type);

const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const isPt = (p: unknown): p is Pt => Array.isArray(p) && p.length === 2 && isNum(p[0]) && isNum(p[1]);

export function validateAp(s: Record<string, unknown>): { ok: true; spec: ApSpec } | { ok: false; error: string } {
  if (s.type === "ap_diagram") return validateApDiagram(s);
  if (s.type === "ap_table_set") {
    if (!Array.isArray(s.tables) || s.tables.length < 2 || s.tables.length > 6) return { ok: false, error: "ap_table_set 은 tables 2~6개가 필요합니다." };
    for (const t of s.tables as Record<string, unknown>[]) { const v = validateAp({ ...t, type: "ap_table" }); if (!v.ok) return v; }
    return { ok: true, spec: s as unknown as ApTableSetSpec };
  }
  if (s.type === "ap_table") {
    if (!Array.isArray(s.columns) || s.columns.length < 1 || s.columns.length > 14 || !s.columns.every((c) => typeof c === "string" && c.trim())) return { ok: false, error: "ap_table 은 columns(문자열 1~14개)가 필요합니다." };
    if (!Array.isArray(s.rows) || s.rows.length < 1 || s.rows.length > 40) return { ok: false, error: "ap_table 은 rows 1~40행이 필요합니다." };
    for (const r of s.rows) {
      if (!Array.isArray(r) || r.length !== s.columns.length) return { ok: false, error: "ap_table 의 모든 행은 열 개수와 같은 칸 수여야 합니다." };
      if (!r.every((c) => typeof c === "string" || isNum(c))) return { ok: false, error: "ap_table 칸은 문자열 또는 숫자입니다." };
    }
    if (s.notes !== undefined && (!Array.isArray(s.notes) || !s.notes.every((n) => typeof n === "string"))) return { ok: false, error: "notes 는 문자열 배열입니다." };
    return { ok: true, spec: s as unknown as ApTableSpec };
  }
  if (s.type !== "ap_graph") return { ok: false, error: "type 이 ap_graph/ap_table 이 아닙니다." };
  for (const k of ["x", "y"] as const) {
    const a = s[k] as Record<string, unknown> | undefined;
    if (!a || typeof a.label !== "string" || !a.label.trim() || !isNum(a.min) || !isNum(a.max) || a.min >= a.max) return { ok: false, error: `ap_graph.${k} 는 label 과 min<max 숫자가 필요합니다.` };
    if (a.step !== undefined && (!isNum(a.step) || a.step <= 0)) return { ok: false, error: `ap_graph.${k}.step 은 0 보다 큰 숫자입니다.` };
  }
  if (!Array.isArray(s.series) || s.series.length < 1 || s.series.length > 6) return { ok: false, error: "ap_graph 는 series 1~6개가 필요합니다." };
  for (const se of s.series as Record<string, unknown>[]) {
    if (typeof se.label !== "string") return { ok: false, error: "series.label 이 필요합니다." };
    if (!Array.isArray(se.points) || se.points.length < 2 || !se.points.every(isPt)) return { ok: false, error: "series.points 는 [x,y] 2개 이상이어야 합니다." };
    if (se.errors !== undefined && (!Array.isArray(se.errors) || se.errors.length !== (se.points as unknown[]).length || !se.errors.every(isNum))) return { ok: false, error: "series.errors 는 points 와 같은 길이의 숫자 배열입니다." };
  }
  if (s.markers !== undefined && (!Array.isArray(s.markers) || !(s.markers as Record<string, unknown>[]).every((m) => isNum(m.x) && isNum(m.y) && (m.style === "filled" || m.style === "open")))) return { ok: false, error: "markers 는 {x,y,style:'filled'|'open'} 목록입니다." };
  if (s.shades !== undefined && (!Array.isArray(s.shades) || !(s.shades as Record<string, unknown>[]).every((m) => isNum(m.xMin) && isNum(m.xMax) && m.xMin < m.xMax))) return { ok: false, error: "shades 는 xMin<xMax 인 구간 목록입니다." };
  return { ok: true, spec: s as unknown as ApGraphSpec };
}

// ── 공통 ────────────────────────────────────────────────────────────────
const W = 580, H = 340, PL = 64, PR = 100, PT0 = 30, PB = 52;
const COLORS = ["#111111", "#C8102E", "#1B6FB0", "#0f7b4a", "#d99a00", "#6a4c93"];
export const AP_COLORS = COLORS;

export function niceTicks(min: number, max: number, step?: number): number[] {
  let st = step;
  if (!st) {
    const raw = (max - min) / 8;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    st = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((c) => c >= raw) ?? raw;
  }
  const out: number[] = [];
  for (let v = Math.ceil(min / st - 1e-9) * st; v <= max + 1e-9; v += st) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}
const fnum = (n: number) => (Math.abs(n) >= 1000 ? new Intl.NumberFormat("en-US").format(n) : (Math.round(n * 100) / 100).toString());
function hash(s: string): string { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }

export function interpAt(points: Pt[], x: number): number | null {
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i], [x1, y1] = points[i + 1];
    if ((x >= x0 && x <= x1) || (x >= x1 && x <= x0)) {
      if (x1 === x0) return y0;
      return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return null;
}

type Box = { x1: number; y1: number; x2: number; y2: number };
const ov = (a: Box, b: Box) => a.x1 < b.x2 + 2 && b.x1 < a.x2 + 2 && a.y1 < b.y2 + 2 && b.y1 < a.y2 + 2;

export function renderApGraph(spec: ApGraphSpec): { svg: string; alt: string; issues: FigureIssue[] } {
  const issues: FigureIssue[] = [];
  const { x: ax, y: ay } = spec;
  // 긴 라벨은 곡선 옆에 두지 않고 그림 위 범례로 뺀다(라벨이 곡선·점과 겹치는 것을 구조적으로 막는다).
  const LEG_W = 92;
  const legendIdx = spec.series.map((s, i) => ({ s, i })).filter(({ s }) => s.label && labelWidth(s.label, 12) > LEG_W).map(({ i }) => i);
  const legendRows: number[][] = []; { let cur: number[] = [], w = 0; for (const i of legendIdx) { const iw = 34 + labelWidth(spec.series[i].label, 12); if (cur.length && w + iw > W - 24) { legendRows.push(cur); cur = []; w = 0; } cur.push(i); w += iw + 10; } if (cur.length) legendRows.push(cur); }
  const PT = PT0 + legendRows.length * 17;
  const sx = (x: number) => PL + ((x - ax.min) / (ax.max - ax.min)) * (W - PL - PR);
  const sy = (y: number) => H - PB - ((y - ay.min) / (ay.max - ay.min)) * (H - PB - PT);
  const id = "apc" + hash(JSON.stringify(spec));
  const xt = niceTicks(ax.min, ax.max, ax.step), yt = niceTicks(ay.min, ay.max, ay.step);
  const o: string[] = [];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="max-width:100%;height:auto" role="img" font-family="${FONT}" font-size="12">`);
  o.push(`<defs><clipPath id="${id}"><rect x="${PL}" y="${PT}" width="${W - PL - PR}" height="${H - PB - PT}"/></clipPath></defs>`);
  if (spec.title) o.push(`<text x="${W / 2}" y="16" text-anchor="middle" font-size="13" font-weight="bold" fill="#111">${esc(spec.title)}</text>`);
  for (const t of xt) o.push(`<line x1="${f(sx(t))}" y1="${PT}" x2="${f(sx(t))}" y2="${H - PB}" stroke="#d1d5db" stroke-width="0.8"/>`);
  for (const t of yt) o.push(`<line x1="${PL}" y1="${f(sy(t))}" x2="${W - PR}" y2="${f(sy(t))}" stroke="#d1d5db" stroke-width="0.8"/>`);
  // 축은 0 을 지나면 0, 아니면 최솟값에 둔다.
  const axX = ax.min <= 0 && ax.max >= 0 ? 0 : ax.min, axY = ay.min <= 0 && ay.max >= 0 ? 0 : ay.min;
  o.push(`<rect x="${PL}" y="${PT}" width="${W - PL - PR}" height="${H - PB - PT}" fill="none" stroke="#9ca3af" stroke-width="1"/>`);
  o.push(`<line x1="${PL}" y1="${f(sy(axY))}" x2="${W - PR}" y2="${f(sy(axY))}" stroke="#111" stroke-width="1.6"/>`);
  o.push(`<line x1="${f(sx(axX))}" y1="${PT}" x2="${f(sx(axX))}" y2="${H - PB}" stroke="#111" stroke-width="1.6"/>`);
  // 눈금 숫자는 플롯 가장자리(아래·왼쪽)에 둔다 — 축 위에 겹치지 않게.
  const everyX = xt.length > 12 ? 2 : 1, everyY = yt.length > 12 ? 2 : 1;
  xt.forEach((t, i) => { if (i % everyX === 0) o.push(`<line x1="${f(sx(t))}" y1="${H - PB}" x2="${f(sx(t))}" y2="${H - PB + 4}" stroke="#111"/><text x="${f(sx(t))}" y="${H - PB + 17}" text-anchor="middle" fill="#111">${esc(fnum(t))}</text>`); });
  yt.forEach((t, i) => { if (i % everyY === 0) o.push(`<line x1="${PL - 4}" y1="${f(sy(t))}" x2="${PL}" y2="${f(sy(t))}" stroke="#111"/><text x="${PL - 8}" y="${f(sy(t) + 4)}" text-anchor="end" fill="#111">${esc(fnum(t))}</text>`); });
  o.push(`<text x="${f((PL + W - PR) / 2)}" y="${H - 10}" text-anchor="middle" fill="#111" font-size="13">${esc(ax.label)}</text>`);
  o.push(`<text transform="translate(16 ${f((PT + H - PB) / 2)}) rotate(-90)" text-anchor="middle" fill="#111" font-size="13">${esc(ay.label)}</text>`);
  legendRows.forEach((row, r) => { let x = PL; row.forEach((i) => { const y = 30 + r * 17; const iw = 34 + labelWidth(spec.series[i].label, 12); o.push(`<line x1="${x}" y1="${y - 4}" x2="${x + 22}" y2="${y - 4}" stroke="${COLORS[i % COLORS.length]}" stroke-width="2.6"${spec.series[i].style === "dashed" ? ' stroke-dasharray="6 4"' : ""}/><text x="${x + 28}" y="${y}" font-size="12" fill="#111">${esc(spec.series[i].label)}</text>`); x += iw + 10; }); });
  const boxes: Box[] = [];
  const hitsCurve = (b: Box): boolean => spec.series.some((s) => s.points.some(([x, y]) => { const px = sx(x), py = sy(y); return px >= b.x1 - 1 && px <= b.x2 + 1 && py >= b.y1 - 1 && py <= b.y2 + 1; }));
  // 음영(곡선 아래에 먼저)
  (spec.shades ?? []).forEach((sh, i) => {
    const N = 80, up: Pt[] = [], lo: Pt[] = [];
    const swap = (ps: Pt[]): Pt[] => ps.map(([a, b]) => [b, a]);
    for (let k = 0; k <= N; k++) {
      const x = sh.xMin + ((sh.xMax - sh.xMin) * k) / N;
      const pu = sh.upper === "axis" ? null : sh.over === "y" ? swap(spec.series[sh.upper]?.points ?? []) : (spec.series[sh.upper]?.points ?? []);
      const pl = sh.lower === "axis" ? null : sh.over === "y" ? swap(spec.series[sh.lower]?.points ?? []) : (spec.series[sh.lower]?.points ?? []);
      const yu = pu === null ? 0 : interpAt(pu, x);
      const yl = pl === null ? 0 : interpAt(pl, x);
      if (yu === null || yl === null) continue;
      if (sh.over === "y") { up.push([yu, x]); lo.push([yl, x]); } else { up.push([x, yu]); lo.push([x, yl]); }
    }
    if (up.length < 2) { issues.push({ code: "shade_empty", message: `음영 영역 ${i + 1}이 곡선 구간 밖입니다.` }); return; }
    const poly = [...up, ...lo.reverse()].map(([x, y]) => `${f(sx(x))},${f(sy(y))}`).join(" ");
    o.push(`<polygon points="${poly}" fill="#1B6FB0" fill-opacity="0.18" stroke="none" clip-path="url(#${id})"/>`);
  });
  (spec.guides ?? []).forEach((g) => {
    if (g.axis === "y") o.push(`<line x1="${PL}" y1="${f(sy(g.at))}" x2="${W - PR}" y2="${f(sy(g.at))}" stroke="#6b7280" stroke-width="1.2" stroke-dasharray="5 4" clip-path="url(#${id})"/>`);
    else o.push(`<line x1="${f(sx(g.at))}" y1="${f(sy(g.to === undefined ? ay.min : Math.min(g.to, ay.min)))}" x2="${f(sx(g.at))}" y2="${f(sy(g.to ?? ay.max))}" stroke="#6b7280" stroke-width="1.2" stroke-dasharray="5 4" clip-path="url(#${id})"/>`);
  });
  spec.series.forEach((s, si) => {
    const col = COLORS[si % COLORS.length];
    const gaps = new Set(s.gaps ?? []);
    let d = "", pen = false;
    s.points.forEach(([x, y], i) => {
      d += `${pen ? "L" : "M"}${f(sx(x))},${f(sy(y))} `; pen = true;
      if (gaps.has(i)) pen = false;
    });
    o.push(`<path d="${d.trim()}" fill="none" stroke="${col}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"${s.style === "dashed" ? ' stroke-dasharray="7 5"' : ""} clip-path="url(#${id})"/>`);
    if (s.dots) s.points.forEach(([x, y], i) => {
      o.push(`<circle cx="${f(sx(x))}" cy="${f(sy(y))}" r="3.6" fill="${col}"/>`);
      const e = s.errors?.[i];
      if (e) o.push(`<line x1="${f(sx(x))}" y1="${f(sy(y + e))}" x2="${f(sx(x))}" y2="${f(sy(y - e))}" stroke="${col}" stroke-width="1.4"/><line x1="${f(sx(x) - 4)}" y1="${f(sy(y + e))}" x2="${f(sx(x) + 4)}" y2="${f(sy(y + e))}" stroke="${col}" stroke-width="1.4"/><line x1="${f(sx(x) - 4)}" y1="${f(sy(y - e))}" x2="${f(sx(x) + 4)}" y2="${f(sy(y - e))}" stroke="${col}" stroke-width="1.4"/>`);
    });
  });
  (spec.markers ?? []).forEach((m) => {
    if (m.x < ax.min - 1e-9 || m.x > ax.max + 1e-9 || m.y < ay.min - 1e-9 || m.y > ay.max + 1e-9) { issues.push({ code: "marker_off_axes", message: `점 (${fnum(m.x)}, ${fnum(m.y)})가 축 범위 밖입니다.` }); return; }
    o.push(`<circle cx="${f(sx(m.x))}" cy="${f(sy(m.y))}" r="4.6" fill="${m.style === "filled" ? "#111" : "#fff"}" stroke="#111" stroke-width="1.8"/>`);
    boxes.push({ x1: sx(m.x) - 6, y1: sy(m.y) - 6, x2: sx(m.x) + 6, y2: sy(m.y) + 6 });
  });
  // 라벨 배치: 후보 자리 8곳 중 곡선·점·다른 라벨·축 라벨과 겹치지 않는 첫 자리. 없으면 issue(자동으로 밀지 않는다).
  const placeLabel = (text: string, ax0: number, ay0: number, color: string, pref: ("e" | "w" | "n" | "s" | "ne" | "nw" | "se" | "sw")[], what: string) => {
    const w = labelWidth(text, 12), h = 15;
    const cands: Record<string, [number, number, "start" | "end" | "middle"]> = {
      e: [ax0 + 11, ay0 + 4, "start"], w: [ax0 - 11, ay0 + 4, "end"], n: [ax0, ay0 - 12, "middle"], s: [ax0, ay0 + 22, "middle"],
      ne: [ax0 + 9, ay0 - 9, "start"], nw: [ax0 - 9, ay0 - 9, "end"], se: [ax0 + 9, ay0 + 20, "start"], sw: [ax0 - 9, ay0 + 20, "end"],
    };
    for (const k of pref) {
      const [tx, ty, anchor] = cands[k];
      const b: Box = { x1: anchor === "start" ? tx : anchor === "end" ? tx - w : tx - w / 2, y1: ty - 12, x2: anchor === "start" ? tx + w : anchor === "end" ? tx : tx + w / 2, y2: ty + 3 };
      if (b.x1 < PL + 2 || b.x2 > W - 4 || b.y1 < PT - 2 || b.y2 > H - PB) continue;
      if (boxes.some((q) => ov(b, q)) || hitsCurve(b)) continue;
      boxes.push(b);
      o.push(`<text x="${f(tx)}" y="${f(ty)}" text-anchor="${anchor}" fill="${color}" font-size="12" font-weight="bold">${esc(text)}</text>`);
      return;
    }
    issues.push({ code: "label_overlap", message: `라벨 "${text}"(${what})를 곡선·점·다른 라벨과 겹치지 않게 둘 자리가 없습니다 — 라벨을 줄이거나 곡선 구성을 바꾸세요.` });
  };
  spec.series.forEach((s, si) => {
    if (!s.label.trim() || legendIdx.includes(si)) return;
    const pts = s.points.filter(([x, y]) => x >= ax.min && x <= ax.max && y >= ay.min && y <= ay.max);
    if (!pts.length) { issues.push({ code: "series_off_axes", message: `"${s.label}" 곡선이 축 범위 안에 없습니다.` }); return; }
    const at = s.labelAt ?? "end";
    const p = at === "start" ? pts[0] : at === "mid" ? pts[Math.floor(pts.length / 2)] : pts[pts.length - 1];
    placeLabel(s.label, sx(p[0]), sy(p[1]), COLORS[si % COLORS.length], at === "start" ? ["ne", "e", "se", "n", "s", "nw", "w", "sw"] : ["e", "ne", "se", "n", "s", "nw", "w", "sw"], "series");
  });
  (spec.markers ?? []).forEach((m) => { if (m.label) placeLabel(m.label, sx(m.x), sy(m.y), "#111", ["ne", "nw", "se", "sw", "n", "s", "e", "w"], "marker"); });
  (spec.shades ?? []).forEach((sh) => { if (sh.label) { const xm = (sh.xMin + sh.xMax) / 2; const yu = sh.upper === "axis" ? 0 : interpAt(spec.series[sh.upper]?.points ?? [], xm); const yl = sh.lower === "axis" ? 0 : interpAt(spec.series[sh.lower]?.points ?? [], xm); if (yu !== null && yl !== null) placeLabel(sh.label, sx(xm), sy((yu + yl) / 2), "#1B6FB0", ["e", "w", "n", "s"], "region"); } });
  o.push("</svg>");
  // 곡선이 같은 위치에 완전히 겹치는 경우(두 시리즈가 같은 점 목록)
  for (let i = 0; i < spec.series.length; i++) for (let j = i + 1; j < spec.series.length; j++) {
    if (JSON.stringify(spec.series[i].points) === JSON.stringify(spec.series[j].points)) issues.push({ code: "series_identical", message: `"${spec.series[i].label}" 와 "${spec.series[j].label}" 곡선이 완전히 같아 하나만 보입니다.` });
  }
  const alt = `${spec.title ? spec.title + ". " : ""}Graph of ${spec.series.map((s) => s.label || "curve").join(", ")}. Horizontal axis: ${ax.label}, ${fnum(ax.min)} to ${fnum(ax.max)}. Vertical axis: ${ay.label}, ${fnum(ay.min)} to ${fnum(ay.max)}.`;
  return { svg: o.join(""), alt, issues };
}

export function renderApTable(spec: ApTableSpec): { markup: string; alt: string; issues: FigureIssue[] } {
  const issues: FigureIssue[] = [];
  const cell = (c: string | number) => esc(typeof c === "number" ? fnum(c) : c);
  const num = (c: string | number) => typeof c === "number" || /^-?[\d,.]+%?$/.test(String(c).trim());
  const head = spec.columns.map((c) => `<th scope="col" style="border:1px solid #6b7280;padding:6px 10px;background:#f3f4f6;text-align:left;font-weight:600">${esc(c)}</th>`).join("");
  const body = spec.rows.map((r) => `<tr>${r.map((c, i) => `<td style="border:1px solid #9ca3af;padding:6px 10px;${num(c) && i > 0 ? "text-align:right;font-variant-numeric:tabular-nums" : ""}">${cell(c)}</td>`).join("")}</tr>`).join("");
  const cap = spec.title ? `<caption style="caption-side:top;text-align:left;font-weight:600;padding-bottom:6px">${esc(spec.title)}</caption>` : "";
  const notes = (spec.notes ?? []).length ? `<ul style="margin:6px 0 0;padding-left:18px;font-size:12px;color:#374151">${(spec.notes ?? []).map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : "";
  const unit = spec.units ? `<div style="font-size:12px;color:#374151;margin-top:4px">Units: ${esc(spec.units)}</div>` : "";
  const markup = `<figure style="margin:0"><table style="border-collapse:collapse;font-size:14px;max-width:100%">${cap}<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>${unit}${notes}</figure>`;
  const alt = `${spec.title ? spec.title + ". " : ""}Table with columns ${spec.columns.join(", ")} and ${spec.rows.length} rows.`;
  return { markup, alt, issues };
}

export function renderApTableSet(spec: ApTableSetSpec): { markup: string; alt: string; issues: FigureIssue[] } {
  const parts = spec.tables.map((t) => renderApTable(t));
  const notes = (spec.notes ?? []).length ? `<ul style="margin:8px 0 0;padding-left:18px;font-size:12px;color:#374151">${(spec.notes ?? []).map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : "";
  const markup = `<div class="ap-table-set" style="display:flex;flex-direction:column;gap:14px;max-width:100%">${spec.title ? `<div style="font-weight:700">${esc(spec.title)}</div>` : ""}${parts.map((p) => p.markup).join("")}${notes}</div>`;
  return { markup, alt: `${spec.title ? spec.title + ". " : ""}${parts.map((p) => p.alt).join(" ")}`, issues: parts.flatMap((p) => p.issues) };
}

export function renderAp(spec: ApSpec): { svg: string; alt: string; issues: FigureIssue[] } {
  if (spec.type === "ap_table_set") { const r = renderApTableSet(spec); return { svg: r.markup, alt: r.alt, issues: r.issues }; }
  if (spec.type === "ap_diagram") return renderApDiagram(spec);
  if (spec.type === "ap_table") { const r = renderApTable(spec); return { svg: r.markup, alt: r.alt, issues: r.issues }; }
  return renderApGraph(spec);
}

/** 지문 대조(공개 게이트가 부름): 라벨·단위 존재. 값 대조는 lib/ap-figures/gate.ts(후보 단위)에서 한다. */
export function lintAp(spec: ApSpec, _passage: string): FigureIssue[] {
  void _passage;
  const out: FigureIssue[] = [];
  if (spec.type === "ap_diagram") return out;
  if (spec.type === "ap_table_set") return spec.tables.flatMap((t) => lintAp(t, _passage));
  if (spec.type === "ap_graph") {
    if (spec.series.length > 1) {
      const labels = spec.series.map((s) => s.label.trim().toLowerCase());
      if (labels.some((l) => !l)) out.push({ code: "series_unlabeled", message: "곡선이 둘 이상이면 모두 이름(라벨)이 있어야 합니다." });
      if (new Set(labels).size !== labels.length) out.push({ code: "series_label_dup", message: "곡선 라벨이 중복됩니다." });
    }
  } else {
    if (spec.columns.some((c) => !c.trim())) out.push({ code: "table_header_empty", message: "표 머리글이 비어 있습니다." });
    if (spec.rows.some((r) => r.some((c) => String(c).trim() === ""))) out.push({ code: "table_empty_cell", message: "표에 빈 칸이 있습니다." });
  }
  return out;
}
