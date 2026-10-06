// 자료 원형 시각 검수(QA)의 '코드로 잡을 수 있는 구조 검사'. 렌더된 마크업(SVG·HTML 표)을 직접 읽어 그림이 데이터와 맞게 그려졌는지 확인한다.
//
// 오너 경험: 자료가 붙는 문제는 유형별로 같은 결함이 결정론적으로 모든 문항에 반복된다 —
//   (a) 길이·값 대비 그림 비율 불일치, (b) 길이·값 표시 숫자의 위치 불일치, (c) 복수 자료에서 두 그림 간 숫자·축척 불일치, (d) 자료가 아예 없음.
// 이 네 가지는 각각 돌연변이 테스트(figure-qa.test.ts)로 고정한다(일부러 망가뜨려서 검사가 잡는지).
// 사람이 눈으로 보는 부분(SAT 시각 스타일 일치 등)은 PNG 스냅샷 + 검수 판정 파일(docs/qa/2026-10-01-math-figure-visual-qa.md)로 한다.
import { renderFigureSvg } from "@/lib/problem-figures/render";
import { problemText } from "@/lib/problem-figures/label-rule";
import type { FigureSpec } from "@/lib/problem-figures/spec";
import type { Instance } from "./types";
import { mentionsFigure } from "./figure-verify";

export type QaIssue = { code: string; message: string };
type Spec = Record<string, unknown> & { type: string; kind?: string };

const NUM = /^-?\d[\d,]*(\.\d+)?$/;
const toNum = (s: string) => Number(s.replace(/,/g, "").replace(/−/g, "-"));
const attr = (a: string, n: string) => a.match(new RegExp(`(?:^|\\s)${n}="([^"]*)"`))?.[1];
type T = { x: number; y: number; size: number; anchor: string; text: string; rotated: boolean };
const texts = (svg: string): T[] => [...svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)].map((m) => ({ x: Number(attr(m[1], "x") ?? NaN), y: Number(attr(m[1], "y") ?? NaN), size: Number(attr(m[1], "font-size") ?? 12), anchor: attr(m[1], "text-anchor") ?? "start", text: m[2].replace(/&amp;/g, "&").trim(), rotated: /transform=/.test(m[1]) }));
const circles = (svg: string) => [...svg.matchAll(/<circle\b([^>]*)\/?>/g)].map((m) => ({ cx: Number(attr(m[1], "cx")), cy: Number(attr(m[1], "cy")), r: Number(attr(m[1], "r")), fill: attr(m[1], "fill") ?? "" })).filter((c) => Math.abs(c.r - 3.5) < 1e-9);
const polylines = (svg: string) => [...svg.matchAll(/<polyline\b([^>]*)\/?>/g)].map((m) => ({ stroke: attr(m[1], "stroke") ?? "", pts: (attr(m[1], "points") ?? "").trim().split(/\s+/).map((p) => p.split(",").map(Number) as [number, number]) }));
const lines = (svg: string) => [...svg.matchAll(/<line\b([^>]*)\/?>/g)].map((m) => ({ x1: Number(attr(m[1], "x1")), y1: Number(attr(m[1], "y1")), x2: Number(attr(m[1], "x2")), y2: Number(attr(m[1], "y2")), stroke: attr(m[1], "stroke") ?? "" }));
const viewBox = (svg: string) => svg.match(/viewBox="([^"]+)"/)?.[1] ?? "";

/** 값 = a·위치 + b 의 최소제곱 선형 대응. */
function fit(ticks: { v: number; pos: number }[]): { a: number; b: number; maxRes: number } | null {
  if (ticks.length < 2) return null;
  const n = ticks.length, mp = ticks.reduce((s, t) => s + t.pos, 0) / n, mv = ticks.reduce((s, t) => s + t.v, 0) / n;
  let spv = 0, spp = 0; for (const t of ticks) { spv += (t.pos - mp) * (t.v - mv); spp += (t.pos - mp) ** 2; }
  if (spp === 0) return null; const a = spv / spp, b = mv - a * mp;
  const maxRes = Math.max(...ticks.map((t) => Math.abs((t.v - b) / a - t.pos))); // 픽셀 단위 잔차
  return { a, b, maxRes };
}
export type AxisScale = { x: ReturnType<typeof fit>; y: ReturnType<typeof fit>; xTicks: number[]; yTicks: number[] };
/** SVG 에서 눈금 숫자(좌표 축)를 읽어 축척을 만든다. y 눈금: text-anchor=end 숫자(글자 y−4 가 격자선 y), x 눈금: 같은 y 에 놓인 text-anchor=middle 숫자. */
export function readScale(svg: string): AxisScale {
  const ts = texts(svg).filter((t) => NUM.test(t.text) && !t.rotated);
  const yT = ts.filter((t) => t.anchor === "end").map((t) => ({ v: toNum(t.text), pos: t.y - 4 }));
  const mids = ts.filter((t) => t.anchor === "middle"); const byY = new Map<number, typeof mids>(); for (const t of mids) byY.set(t.y, [...(byY.get(t.y) ?? []), t]);
  const row = [...byY.entries()].sort((p, q) => q[1].length - p[1].length || q[0] - p[0])[0]?.[1] ?? [];
  const xT = row.map((t) => ({ v: toNum(t.text), pos: t.x }));
  return { y: fit(yT), x: fit(xT), yTicks: yT.map((t) => t.v), xTicks: xT.map((t) => t.v) };
}

/** 표(HTML) 칸 값 읽기: 행마다 <td> 숫자(합계 열 포함). */
function tableRows(html: string): number[][] {
  return [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => [...m[1].matchAll(/<(?:td|th)\b[^>]*>([^<]*)<\/(?:td|th)>/g)].map((c) => c[1].trim()).filter((t) => NUM.test(t)).map(toNum)).filter((r) => r.length);
}

function checkTwoWay(spec: Spec, html: string, issues: QaIssue[]) {
  const cells = spec.cells as number[][]; const rows = tableRows(html); const want = cells.map((r) => [...r, r.reduce((a, b) => a + b, 0)]); const colSum = cells[0].map((_, j) => cells.reduce((a, r) => a + r[j], 0)); want.push([...colSum, colSum.reduce((a, b) => a + b, 0)]);
  if (JSON.stringify(rows) !== JSON.stringify(want)) issues.push({ code: "table_value_mismatch", message: `표에 그려진 칸 값 ${JSON.stringify(rows)} 이 데이터(합계 포함) ${JSON.stringify(want)} 와 다릅니다.` });
}

/** 일반 표(table): 머리글(열 이름)이 모두 그려지고, 행마다 그려진 칸 글자가 데이터(숫자는 천 단위 쉼표 무시)와 같아야 한다. 빈 표·열 이름 없음·값 불일치를 잡는다. */
const cellText = (c: unknown) => (typeof c === "number" ? String(c) : String(c).trim());
const unesc = (t: string) => t.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
function checkTable(spec: Spec, html: string, issues: QaIssue[]) {
  const cols = (spec.columns ?? []) as string[]; const rows = (spec.rows ?? []) as unknown[][];
  const head = [...html.matchAll(/<th\b[^>]*>([^<]*)<\/th>/g)].map((m) => unesc(m[1]));
  if (!rows.length) { issues.push({ code: "render_empty", message: "표에 행이 없습니다." }); return; }
  for (const c of cols) if (c && !head.includes(c.trim())) issues.push({ code: "table_header_missing", message: `표 머리글 '${c}' 가 그려지지 않았습니다.` });
  const drawn = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => [...m[1].matchAll(/<td\b[^>]*>([^<]*)<\/td>/g)].map((c) => unesc(c[1]))).filter((r) => r.length);
  const norm = (t: string) => (NUM.test(t.replace(/,/g, "")) ? String(toNum(t)) : t);
  const want = rows.map((r) => r.map((c) => norm(cellText(c)))); const got = drawn.map((r) => r.map(norm));
  if (JSON.stringify(got) !== JSON.stringify(want)) issues.push({ code: "table_value_mismatch", message: `표에 그려진 칸 ${JSON.stringify(got).slice(0, 160)} 이 데이터 ${JSON.stringify(want).slice(0, 160)} 와 다릅니다.` });
}
/** 문장형 자료(statement): 항목마다 라벨과 값이 그려져야 한다. */
function checkStatement(spec: Spec, html: string, issues: QaIssue[]) {
  const facts = (spec.facts ?? []) as { label: string; value: string | number }[]; const text = unesc(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");
  if (!facts.length) { issues.push({ code: "render_empty", message: "문장형 자료에 항목이 없습니다." }); return; }
  for (const f of facts) { if (!text.includes(f.label.trim())) issues.push({ code: "table_header_missing", message: `자료 항목 '${f.label}' 이 그려지지 않았습니다.` }); const v = typeof f.value === "number" ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(f.value) : String(f.value); if (!text.includes(v) && !text.includes(String(f.value))) issues.push({ code: "table_value_mismatch", message: `자료 항목 '${f.label}' 의 값 ${String(f.value)} 이 그려지지 않았습니다.` }); }
}

const px = (mapping: NonNullable<ReturnType<typeof fit>>, v: number) => (v - mapping.b) / mapping.a;
function checkAxes(spec: Spec, svg: string, issues: QaIssue[], isPlane: boolean) {
  const sc = readScale(svg);
  if (!sc.y || sc.yTicks.length < 3) issues.push({ code: "axis_ticks_missing", message: `세로축 눈금 숫자가 ${sc.yTicks.length}개뿐입니다(3개 이상 필요).` });
  if (!sc.x || sc.xTicks.length < 3) issues.push({ code: "axis_ticks_missing", message: `가로축 눈금 숫자가 ${sc.xTicks.length}개뿐입니다(3개 이상 필요).` });
  if (sc.y && sc.y.maxRes > 1.5) issues.push({ code: "render_scale_nonlinear", message: `세로축 눈금 숫자의 위치가 일정한 간격이 아닙니다(잔차 ${sc.y.maxRes.toFixed(1)}px).` });
  if (sc.x && sc.x.maxRes > 1.5) issues.push({ code: "render_scale_nonlinear", message: `가로축 눈금 숫자의 위치가 일정한 간격이 아닙니다(잔차 ${sc.x.maxRes.toFixed(1)}px).` });
  // 눈금 숫자 ↔ 격자선 위치(길이 표시 숫자가 제 자리에 있는가) — 축(검정 선)도 눈금 숫자가 맞출 선이다
  const grid = lines(svg).filter((l) => l.stroke === "#d1d5db" || l.stroke === "#9ca3af" || l.stroke === "#111"); const hy = grid.filter((l) => Math.abs(l.y1 - l.y2) < 1e-6).map((l) => l.y1), vx = grid.filter((l) => Math.abs(l.x1 - l.x2) < 1e-6).map((l) => l.x1);
  for (const t of texts(svg).filter((q) => NUM.test(q.text) && !q.rotated)) {
    if (t.anchor === "end" && hy.length && Math.min(...hy.map((y) => Math.abs(y - (t.y - 4)))) > 1.5) issues.push({ code: "label_misaligned", message: `세로축 눈금 숫자 '${t.text}' 가 어느 격자선과도 맞지 않습니다.` });
    if (t.anchor === "middle" && vx.length >= 3 && Math.min(...vx.map((x) => Math.abs(x - t.x))) > 1.5 && sc.x && sc.xTicks.includes(toNum(t.text))) issues.push({ code: "label_misaligned", message: `가로축 눈금 숫자 '${t.text}' 가 어느 격자선과도 맞지 않습니다.` });
  }
  // 축 제목·단위
  const xt = (spec.xTitle ?? (spec.axes as { x?: { title?: string } } | undefined)?.x?.title) as string | undefined, yt = (spec.yTitle ?? (spec.axes as { y?: { title?: string } } | undefined)?.y?.title) as string | undefined;
  for (const [n, t] of [["가로", xt], ["세로", yt]] as const) { if (!t) issues.push({ code: "axis_title_missing", message: `${n}축 제목이 없습니다.` }); else if (!/\([^)]+\)/.test(t) && !(isPlane && t.trim() === (n === "가로" ? "x" : "y"))) issues.push({ code: "unit_missing_in_title", message: `${n}축 제목 '${t}' 에 단위(괄호)가 없습니다.` }); else if (!texts(svg).some((q) => q.text.replace(/\s+/g, " ") === t.replace(/\s+/g, " "))) issues.push({ code: "axis_title_missing", message: `${n}축 제목 '${t}' 가 그림에 그려지지 않았습니다.` }); }
  // 순수 함수 그래프(실생활 맥락 없음)는 축 제목 'x'/'y' 를 허용한다(오너 승인 2026-10-05) — 제목 자체는 여전히 필수이고 그려져야 한다.
}

function checkOverlapAndClip(svg: string, issues: QaIssue[]) {
  const vb = viewBox(svg).split(/\s+/).map(Number); const W = vb[2], H = vb[3];
  const bs = texts(svg).filter((t) => !t.rotated && t.text && Number.isFinite(t.x)).map((t) => { const w = t.text.length * t.size * 0.52, h = t.size; const x1 = t.anchor === "middle" ? t.x - w / 2 : t.anchor === "end" ? t.x - w : t.x; return { t: t.text, x1, x2: x1 + w, y1: t.y - h * 0.8, y2: t.y + h * 0.2 }; });
  for (const b of bs) if (b.x1 < -2 || b.y1 < -2 || (W && b.x2 > W + 2) || (H && b.y2 > H + 2)) issues.push({ code: "label_clipped", message: `글자 '${b.t}' 가 그림 밖으로 잘립니다.` });
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const p = bs[i], q = bs[j]; if (p.x1 < q.x2 - 1 && q.x1 < p.x2 - 1 && p.y1 < q.y2 - 1 && q.y1 < p.y2 - 1) issues.push({ code: "label_overlap", message: `글자 '${p.t}' 와 '${q.t}' 가 겹칩니다.` }); }
}

function checkScatterFidelity(spec: Spec, svg: string, issues: QaIssue[]) {
  const sc = readScale(svg); const pts = spec.points as [number, number][]; const cs = circles(svg);
  if (cs.length !== pts.length) { issues.push({ code: cs.length === 0 ? "render_empty" : "render_value_mismatch", message: `그려진 점 ${cs.length}개 ≠ 데이터 점 ${pts.length}개.` }); return; }
  if (!sc.x || !sc.y) return;
  const used = new Set<number>();
  for (const [x, y] of pts) {
    const ex = px(sc.x, x), ey = px(sc.y, y); let best = -1, bd = Infinity;
    cs.forEach((c, i) => { if (used.has(i)) return; const d = Math.hypot(c.cx - ex, c.cy - ey); if (d < bd) { bd = d; best = i; } });
    if (best >= 0) used.add(best);
    if (bd > 1.5) { issues.push({ code: "render_value_mismatch", message: `점 (${x}, ${y}) 이 눈금 기준 자리에서 ${bd.toFixed(1)}px 벗어나 그려졌습니다(길이·값 비율 불일치).` }); break; }
  }
  const fl = spec.fitLine as { slope: number; intercept: number } | undefined;
  if (fl) {
    const p = polylines(svg).find((q) => q.stroke === "#C8102E" || (q.pts.length === 2 && q.stroke === "#111"));
    if (!p) issues.push({ code: "fitline_mismatch", message: "추세선이 그려지지 않았습니다." });
    else { const [a, b] = [p.pts[0], p.pts[p.pts.length - 1]]; const x1 = sc.x.a * a[0] + sc.x.b, y1 = sc.y.a * a[1] + sc.y.b, x2 = sc.x.a * b[0] + sc.x.b, y2 = sc.y.a * b[1] + sc.y.b; const m = (y2 - y1) / (x2 - x1), c = y1 - m * x1; const yr = Math.abs(sc.y.a) * 260; if (Math.abs(m - fl.slope) > 0.03 * Math.max(1, Math.abs(fl.slope)) || Math.abs(c - fl.intercept) > 0.02 * yr) issues.push({ code: "fitline_mismatch", message: `그려진 추세선(기울기 ${m.toFixed(2)}, 절편 ${c.toFixed(1)})이 데이터(${fl.slope}, ${fl.intercept})와 다릅니다.` }); }
  }
}
function checkLineChartFidelity(spec: Spec, svg: string, issues: QaIssue[]) {
  const sc = readScale(svg); const series = spec.series as { name?: string; values: number[] }[]; const cs = circles(svg);
  if (cs.length !== series.reduce((n, s) => n + s.values.length, 0)) { issues.push({ code: cs.length === 0 ? "render_empty" : "render_value_mismatch", message: `그려진 점 ${cs.length}개 ≠ 데이터 값 ${series.reduce((n, s) => n + s.values.length, 0)}개.` }); return; }
  if (!sc.y) return; const vals = series[0].values; const first = cs.slice(0, vals.length);
  first.forEach((c, i) => { const got = sc.y!.a * c.cy + sc.y!.b; if (Math.abs(got - vals[i]) > Math.abs(sc.y!.a) * 1.5) issues.push({ code: "render_value_mismatch", message: `선그래프 ${i + 1}번째 점의 높이가 ${got.toFixed(1)} 로 그려졌지만 데이터는 ${vals[i]} 입니다(길이·값 비율 불일치).` }); });
  if (series.length > 1) for (const s of series) if (s.name && !texts(svg).some((t) => t.text === s.name)) issues.push({ code: "legend_missing", message: `범례에 계열 이름 '${s.name}' 이 없습니다.` });
}
function checkPlaneScatter(spec: Spec, svg: string, issues: QaIssue[]) {
  const obj = (spec.objects as { kind: string; points?: [number, number][]; fitLine?: { slope: number; intercept: number } }[]).find((o) => o.kind === "scatter"); if (!obj) return;
  checkScatterFidelity({ type: "data", kind: "scatter", points: obj.points, fitLine: obj.fitLine } as unknown as Spec, svg, issues);
}


// ───────── 자료 그래프(data.bar·histogram·dot_plot·boxplot) 충실도 ─────────
const rects = (svg: string) => [...svg.matchAll(/<rect\b([^>]*)\/?>/g)].map((m) => ({ x: Number(attr(m[1], "x")), y: Number(attr(m[1], "y")), w: Number(attr(m[1], "width")), h: Number(attr(m[1], "height")), fill: attr(m[1], "fill") ?? "" }));
const DATA_COLORS = ["#111", "#C8102E", "#1B6FB0", "#0f7b4a"];
/** 눈금 숫자(수치 축)·축 제목·단위 검사 — xNum/yNum 은 그 축이 수치 눈금을 가지는가(막대의 가로축은 범주라 제외). */
function checkChartAxes(spec: Spec, svg: string, issues: QaIssue[], o: { xNum: boolean; yNum: boolean; xTitle: boolean; yTitle: boolean; /** 가로축 제목에 단위(괄호)를 요구하는가 — 범주 축은 단위가 없다. */ xUnit?: boolean }) {
  const sc = readScale(svg);
  if (o.yNum) { if (!sc.y || sc.yTicks.length < 3) issues.push({ code: "axis_ticks_missing", message: `세로축 눈금 숫자가 ${sc.yTicks.length}개뿐입니다(3개 이상 필요).` }); else if (sc.y.maxRes > 1.5) issues.push({ code: "render_scale_nonlinear", message: `세로축 눈금 숫자의 위치가 일정한 간격이 아닙니다(잔차 ${sc.y.maxRes.toFixed(1)}px).` }); }
  if (o.xNum) { if (!sc.x || sc.xTicks.length < 3) issues.push({ code: "axis_ticks_missing", message: `가로축 눈금 숫자가 ${sc.xTicks.length}개뿐입니다(3개 이상 필요).` }); else if (sc.x.maxRes > 1.5) issues.push({ code: "render_scale_nonlinear", message: `가로축 눈금 숫자의 위치가 일정한 간격이 아닙니다(잔차 ${sc.x.maxRes.toFixed(1)}px).` }); }
  const want: [string, string | undefined, boolean][] = [["가로", spec.xTitle as string | undefined, o.xTitle], ["세로", spec.yTitle as string | undefined, o.yTitle]];
  for (const [n, t, need] of want) { if (!need) continue; if (!t) issues.push({ code: "axis_title_missing", message: `${n}축 제목이 없습니다.` }); else if (!/\([^)]+\)/.test(t) && !(n === "가로" && o.xUnit === false)) issues.push({ code: "unit_missing_in_title", message: `${n}축 제목 '${t}' 에 단위(괄호)가 없습니다.` }); else if (!texts(svg).some((q) => q.text.replace(/\s+/g, " ") === t.replace(/\s+/g, " "))) issues.push({ code: "axis_title_missing", message: `${n}축 제목 '${t}' 가 그림에 그려지지 않았습니다.` }); }
}
const tolY = (sc: NonNullable<ReturnType<typeof fit>>) => Math.abs(sc.a) * 1.5;

function checkBarFidelity(spec: Spec, svg: string, issues: QaIssue[]) {
  const cats = spec.categories as string[]; const series = spec.series as { values: number[] }[]; const sc = readScale(svg); const rs = rects(svg);
  for (const c of cats) if (!texts(svg).some((t) => t.text.trim() === c.trim())) issues.push({ code: "category_label_missing", message: `범주 이름 '${c}' 가 그려지지 않았습니다.` });
  if (!sc.y) return;
  const axisLn = lines(svg).filter((l) => l.stroke === "#111" && Math.abs(l.y1 - l.y2) < 1e-6).sort((a, b) => Math.abs(b.x2 - b.x1) - Math.abs(a.x2 - a.x1))[0]; const base = axisLn?.y1;
  series.forEach((se, si) => {
    const bars = rs.filter((r) => r.fill === DATA_COLORS[si % 4] && r.w > 4 && r.h >= 0 && (base === undefined || Math.abs(r.y + r.h - base) < 1.5)).sort((a, b) => a.x - b.x); // 범례 견본은 밑변이 축 위에 있지 않다
    if (bars.length !== se.values.length) { issues.push({ code: bars.length === 0 ? "render_empty" : "render_value_mismatch", message: `계열 ${si + 1} 의 막대 ${bars.length}개 ≠ 데이터 ${se.values.length}개.` }); return; }
    bars.forEach((b, i) => { const got = sc.y!.a * b.y + sc.y!.b; if (Math.abs(got - se.values[i]) > tolY(sc.y!)) issues.push({ code: "render_value_mismatch", message: `'${cats[i]}' 막대의 높이가 눈금 기준 ${got.toFixed(1)} 로 그려졌지만 데이터는 ${se.values[i]} 입니다(길이·값 비율 불일치).` }); });
  });
}
function checkHistogramFidelity(spec: Spec, svg: string, issues: QaIssue[]) {
  const bins = spec.bins as { from: number; to: number; count: number }[]; const sc = readScale(svg); const bars = rects(svg).filter((r) => r.fill === "#1B6FB0").sort((a, b) => a.x - b.x);
  if (bars.length !== bins.length) { issues.push({ code: bars.length === 0 ? "render_empty" : "render_value_mismatch", message: `막대 ${bars.length}개 ≠ 구간 ${bins.length}개.` }); return; }
  bars.forEach((b, i) => {
    if (sc.y) { const got = sc.y.a * b.y + sc.y.b; if (Math.abs(got - bins[i].count) > tolY(sc.y)) issues.push({ code: "render_value_mismatch", message: `구간 ${bins[i].from}~${bins[i].to} 의 막대 높이가 눈금 기준 ${got.toFixed(1)} 이지만 도수는 ${bins[i].count} 입니다.` }); }
    if (sc.x) { const l = sc.x.a * b.x + sc.x.b, r = sc.x.a * (b.x + b.w) + sc.x.b, tol = Math.abs(sc.x.a) * 1.5; if (Math.abs(l - bins[i].from) > tol || Math.abs(r - bins[i].to) > tol) issues.push({ code: "render_value_mismatch", message: `구간 ${bins[i].from}~${bins[i].to} 의 막대가 눈금 기준 ${l.toFixed(1)}~${r.toFixed(1)} 에 그려졌습니다(너비·위치 불일치).` }); }
  });
}
function checkDotPlotFidelity(spec: Spec, svg: string, issues: QaIssue[]) {
  const dots = spec.dots as { value: number; count: number }[]; const sc = readScale(svg); const cs = [...svg.matchAll(/<circle\b([^>]*)\/?>/g)].map((m) => ({ cx: Number(attr(m[1], "cx")), r: Number(attr(m[1], "r")) })).filter((c) => c.r === 6);
  const total = dots.reduce((a, d) => a + d.count, 0); if (cs.length !== total) { issues.push({ code: cs.length === 0 ? "render_empty" : "render_value_mismatch", message: `그려진 점 ${cs.length}개 ≠ 데이터 점 ${total}개.` }); return; }
  if (!sc.x) return; const got = new Map<number, number>(); for (const c of cs) { const v = Math.round((sc.x.a * c.cx + sc.x.b) * 1000) / 1000; got.set(v, (got.get(v) ?? 0) + 1); }
  for (const d of dots.filter((q) => q.count > 0)) { const hit = [...got.entries()].find(([v]) => Math.abs(v - d.value) <= Math.abs(sc.x!.a) * 1.5); if (!hit || hit[1] !== d.count) issues.push({ code: "render_value_mismatch", message: `값 ${d.value} 에 그려진 점 ${hit ? hit[1] : 0}개 ≠ 데이터 ${d.count}개.` }); }
}
function checkBoxplotFidelity(spec: Spec, svg: string, issues: QaIssue[]) {
  const boxes = spec.boxes as { name: string; min: number; q1: number; median: number; q3: number; max: number }[]; const sc = readScale(svg); if (!sc.x) return;
  const rs = rects(svg).filter((r) => r.fill === "#fff" && r.h > 4).sort((a, b) => a.y - b.y); const ls = lines(svg).filter((l) => l.stroke === "#111" && Math.abs(l.y1 - l.y2) < 1e-6);
  if (rs.length !== boxes.length) { issues.push({ code: rs.length === 0 ? "render_empty" : "render_value_mismatch", message: `상자 ${rs.length}개 ≠ 데이터 ${boxes.length}개.` }); return; }
  const val = (px: number) => sc.x!.a * px + sc.x!.b; const tol = Math.abs(sc.x.a) * 1.5;
  boxes.forEach((b, i) => {
    const r = rs[i]; const cy = r.y + r.h / 2; const bad: string[] = [];
    if (Math.abs(val(r.x) - b.q1) > tol) bad.push(`Q1 ${val(r.x).toFixed(1)}≠${b.q1}`); if (Math.abs(val(r.x + r.w) - b.q3) > tol) bad.push(`Q3 ${val(r.x + r.w).toFixed(1)}≠${b.q3}`);
    const med = lines(svg).find((l) => Math.abs(l.x1 - l.x2) < 1e-6 && l.stroke === "#111" && Math.abs(l.y1 - r.y) < 0.6 && Math.abs(l.y2 - (r.y + r.h)) < 0.6); if (!med) bad.push("중앙값 선 없음"); else if (Math.abs(val(med.x1) - b.median) > tol) bad.push(`중앙값 ${val(med.x1).toFixed(1)}≠${b.median}`);
    const wl = ls.filter((l) => Math.abs(l.y1 - cy) < 0.6); const lo = Math.min(...wl.map((l) => Math.min(l.x1, l.x2))), hi = Math.max(...wl.map((l) => Math.max(l.x1, l.x2)));
    if (!wl.length) bad.push("수염 없음"); else { if (Math.abs(val(lo) - b.min) > tol) bad.push(`최솟값 ${val(lo).toFixed(1)}≠${b.min}`); if (Math.abs(val(hi) - b.max) > tol) bad.push(`최댓값 ${val(hi).toFixed(1)}≠${b.max}`); }
    if (bad.length) issues.push({ code: "render_value_mismatch", message: `상자 '${b.name}': ${bad.join(", ")} (그려진 값 ≠ 데이터).` });
  });
}

/** 좌표평면의 직선 객체(line): 그려진 선분의 두 끝이 눈금 기준으로 데이터의 직선 y = mx + b 위에 있는가. 색은 객체 순서(엔진의 COLORS)를 따른다. */
const PLANE_COLORS = ["#111", "#C8102E", "#1B6FB0", "#0f7b4a"];
function checkPlaneLines(spec: Spec, svg: string, issues: QaIssue[]) {
  const objs = spec.objects as { kind: string; through?: unknown[]; slope?: number; intercept?: number }[]; const lns = objs.map((o, i) => ({ o, i })).filter(({ o }) => o.kind === "line");
  if (!lns.length) return; const sc = readScale(svg); if (!sc.x || !sc.y) return; const pls = polylines(svg);
  for (const { o, i } of lns) {
    let m: number, b: number;
    if (Array.isArray(o.through) && o.through.length === 2 && o.through.every((p) => Array.isArray(p) && p.length === 2)) { const [p, q] = o.through as [number, number][]; if (p[0] === q[0]) continue; m = (q[1] - p[1]) / (q[0] - p[0]); b = p[1] - m * p[0]; }
    else if (typeof o.slope === "number" && typeof o.intercept === "number") { m = o.slope; b = o.intercept; } else continue;
    const pl = pls.find((q) => q.stroke === PLANE_COLORS[i % 4] && q.pts.length === 2);
    if (!pl) { issues.push({ code: "render_empty", message: `직선 ${i + 1}번이 그려지지 않았습니다.` }); continue; }
    for (const [pxx, pyy] of pl.pts) { const x = sc.x.a * pxx + sc.x.b, y = sc.y.a * pyy + sc.y.b; if (Math.abs(y - (m * x + b)) > Math.abs(sc.y.a) * 1.5) { issues.push({ code: "line_mismatch", message: `직선 ${i + 1}번의 끝점 (${x.toFixed(1)}, ${y.toFixed(1)}) 이 데이터의 직선 y = ${m}x + ${b} 위에 있지 않습니다(기울기·절편 불일치).` }); break; } }
  }
}

// ───────── 삼각형(triangle) 충실도 ─────────
const parseAng = (t?: string): number | null => { if (!t) return null; const m = t.trim().match(/^(\d+(?:\.\d+)?)\s*(?:°|degrees?)?$/i); return m ? Number(m[1]) : null; };
const parseSideNum = (t?: string): number | null => { if (!t) return null; const m = t.trim().match(/^(\d+(?:\.\d+)?)$/); return m ? Number(m[1]) : null; };
/** 그려진 삼각형(굵기 2 의 검은 선 3 개)의 꼭짓점을 이름(이탤릭 글자)과 짝지어 각·변 길이를 읽고, 데이터의 각(value·숫자 라벨)·직각·숫자 변 라벨과 맞는지 본다. 두 번째 삼각형은 보지 않는다. */
function checkTriangleFidelity(spec: Spec, svg: string, issues: QaIssue[]) {
  const segs = [...svg.matchAll(/<line\b([^>]*)\/?>/g)].map((m) => ({ x1: Number(attr(m[1], "x1")), y1: Number(attr(m[1], "y1")), x2: Number(attr(m[1], "x2")), y2: Number(attr(m[1], "y2")), w: attr(m[1], "stroke-width"), stroke: attr(m[1], "stroke") })).filter((l) => l.stroke === "#111" && l.w === "2");
  if (segs.length < 3) { issues.push({ code: "render_empty", message: "삼각형의 변이 3 개 그려지지 않았습니다." }); return; }
  const pts: [number, number][] = []; const add = (x: number, y: number) => { if (!pts.some((p) => Math.hypot(p[0] - x, p[1] - y) < 0.6)) pts.push([x, y]); };
  for (const l of segs.slice(0, 3)) { add(l.x1, l.y1); add(l.x2, l.y2); }
  if (pts.length !== 3) { issues.push({ code: "render_value_mismatch", message: `삼각형의 꼭짓점이 ${pts.length} 개로 읽힙니다.` }); return; }
  const names = (spec.vertices as string[]) ?? []; const it = texts(svg).filter((t) => names.includes(t.text) && t.size >= 14);
  const at = new Map<string, [number, number]>(); for (const n of names) { const tx = it.find((t) => t.text === n); if (!tx) continue; let best = pts[0], bd = Infinity; for (const p of pts) { const d = Math.hypot(p[0] - tx.x, p[1] - tx.y); if (d < bd) { bd = d; best = p; } } at.set(n, best); }
  if (at.size !== 3 || new Set([...at.values()].map((p) => p.join(","))).size !== 3) return; // 꼭짓점 이름 위치가 모호하면(이름 글자 없음) 건너뜀
  const ang = (v: string) => { const [o, ...rest] = [at.get(v)!, ...[...at.entries()].filter(([k]) => k !== v).map(([, p]) => p)]; const a = Math.atan2(rest[0][1] - o[1], rest[0][0] - o[0]), b = Math.atan2(rest[1][1] - o[1], rest[1][0] - o[0]); let d = Math.abs(a - b) * 180 / Math.PI; if (d > 180) d = 360 - d; return d; };
  const len = (u: string, v: string) => Math.hypot(at.get(u)![0] - at.get(v)![0], at.get(u)![1] - at.get(v)![1]);
  for (const a of ((spec.angles as { at: string; label?: string; value?: number }[]) ?? [])) { const want = typeof a.value === "number" ? a.value : parseAng(a.label); if (want === null || !at.has(a.at)) continue; const got = ang(a.at); if (Math.abs(got - want) > 2.5) issues.push({ code: "render_value_mismatch", message: `꼭짓점 ${a.at} 의 각이 ${got.toFixed(1)}° 로 그려졌지만 데이터는 ${want}° 입니다(그림이 참값과 다름).` }); }
  const ra = spec.rightAngleAt as string | undefined; if (ra && at.has(ra)) { const got = ang(ra); if (Math.abs(got - 90) > 2.5) issues.push({ code: "render_value_mismatch", message: `직각 꼭짓점 ${ra} 의 각이 ${got.toFixed(1)}° 로 그려졌습니다.` }); }
  if (!spec.notToScale) {
    const sides = ((spec.sides as { between: [string, string]; label?: string }[]) ?? []).map((q) => ({ v: parseSideNum(q.label), a: q.between[0], b: q.between[1] })).filter((q) => q.v !== null && at.has(q.a) && at.has(q.b)) as { v: number; a: string; b: string }[];
    for (let i = 1; i < sides.length; i++) { const r0 = len(sides[0].a, sides[0].b) / sides[0].v, ri = len(sides[i].a, sides[i].b) / sides[i].v; if (Math.abs(ri / r0 - 1) > 0.06) { issues.push({ code: "render_value_mismatch", message: `변 ${sides[i].a}${sides[i].b} 의 길이 비율이 변 ${sides[0].a}${sides[0].b} 와 라벨 ${sides[i].v}:${sides[0].v} 에 맞지 않게 그려졌습니다(${(ri / r0).toFixed(2)} 배).` }); break; } }
  }
}


// ───────────────────────── 단위원(unit_circle) 충실도 ─────────────────────────
/** "−3/5", "√3/2", "−2√2/3", "0", "1" → 수. 문자(x, y 등)가 있으면 null. */
export function parseUcNum(t: string): number | null {
  const m = t.trim().replace(/−/g, "-").replace(/\s+/g, "").match(/^(-?)(\d*)(?:√(\d+))?(?:\/(\d+))?$/);
  if (!m || (m[2] === "" && m[3] === undefined)) return null;
  const coef = m[2] === "" ? 1 : Number(m[2]); const root = m[3] === undefined ? 1 : Math.sqrt(Number(m[3])); const den = m[4] === undefined ? 1 : Number(m[4]);
  return (m[1] === "-" ? -1 : 1) * coef * root / den;
}
/** "5π/6", "π", "2π/3", "120°" → 도. 아니면 null. */
export function parseUcAngle(t: string): number | null {
  const s = t.trim().replace(/−/g, "-").replace(/\s+/g, "");
  let m = s.match(/^(\d+(?:\.\d+)?)°$/); if (m) return Number(m[1]);
  m = s.match(/^(\d*)π(?:\/(\d+))?$/); if (m) return ((m[1] === "" ? 1 : Number(m[1])) * 180) / (m[2] === undefined ? 1 : Number(m[2]));
  return null;
}
function checkUnitCircleFidelity(spec: Spec, svg: string, issues: QaIssue[]) {
  const pts = spec.points as { name?: string; angle: number; label?: string; ray?: boolean }[]; const arcs = (spec.arcs ?? []) as { from?: number; to: number; label?: string }[];
  const outline = [...svg.matchAll(/<circle\b([^>]*)\/?>/g)].map((m) => ({ cx: Number(attr(m[1], "cx")), cy: Number(attr(m[1], "cy")), r: Number(attr(m[1], "r")), fill: attr(m[1], "fill") ?? "" })).find((c) => c.r > 50 && c.fill === "none");
  if (!outline) { issues.push({ code: "render_empty", message: "단위원(원)이 그려지지 않았습니다." }); return; }
  const dots = [...svg.matchAll(/<circle\b([^>]*)\/?>/g)].map((m) => ({ cx: Number(attr(m[1], "cx")), cy: Number(attr(m[1], "cy")), r: Number(attr(m[1], "r")) })).filter((c) => c.r === 4);
  if (dots.length !== pts.length) { issues.push({ code: dots.length === 0 ? "render_empty" : "render_value_mismatch", message: `그려진 점 ${dots.length}개 ≠ 데이터 점 ${pts.length}개.` }); return; }
  const used = new Set<number>(); const ts = texts(svg);
  for (const p of pts) {
    const ex = outline.cx + outline.r * Math.cos((p.angle * Math.PI) / 180), ey = outline.cy - outline.r * Math.sin((p.angle * Math.PI) / 180);
    let best = -1, bd = Infinity; dots.forEach((d, i) => { if (used.has(i)) return; const q = Math.hypot(d.cx - ex, d.cy - ey); if (q < bd) { bd = q; best = i; } }); if (best >= 0) used.add(best);
    if (bd > 1.5) issues.push({ code: "render_value_mismatch", message: `점 ${p.name ?? ""}(${p.angle.toFixed(1)}°) 이 원 위 제 자리에서 ${bd.toFixed(1)}px 벗어나 그려졌습니다(각·위치 불일치).` });
    if (p.ray !== false && !lines(svg).some((l) => Math.hypot(l.x1 - outline.cx, l.y1 - outline.cy) < 1 && Math.hypot(l.x2 - ex, l.y2 - ey) < 1.5)) issues.push({ code: "render_empty", message: `점 ${p.name ?? ""} 로 가는 반직선이 그려지지 않았습니다.` });
    if (p.label) {
      if (!ts.some((q) => q.text === p.label)) issues.push({ code: "label_missing", message: `좌표 라벨 '${p.label}' 가 그려지지 않았습니다.` });
      const m = p.label.replace(/−/g, "-").match(/^\(\s*([^,]+?)\s*,\s*([^)]+?)\s*\)$/);
      if (m) { const x = parseUcNum(m[1]), y = parseUcNum(m[2]); const cx = Math.cos((p.angle * Math.PI) / 180), cy = Math.sin((p.angle * Math.PI) / 180);
        if ((x !== null && Math.abs(x - cx) > 0.02) || (y !== null && Math.abs(y - cy) > 0.02)) issues.push({ code: "render_value_mismatch", message: `점 ${p.name ?? ""} 의 좌표 라벨 ${p.label} 이 그려진 위치의 (cos, sin) = (${cx.toFixed(2)}, ${cy.toFixed(2)}) 와 다릅니다(그림이 참값과 다름).` }); }
    }
    if (p.name && !ts.some((q) => q.text === p.name)) issues.push({ code: "label_missing", message: `점 이름 '${p.name}' 가 그려지지 않았습니다.` });
  }
  for (const a of arcs) if (a.label) {
    if (!ts.some((q) => q.text === a.label)) issues.push({ code: "label_missing", message: `각 라벨 '${a.label}' 가 그려지지 않았습니다.` });
    const want = parseUcAngle(a.label); if (want === null) continue;
    const a1 = a.from === undefined ? 0 : pts[a.from].angle, a2 = pts[a.to].angle; let sweep = a2 - a1; if (sweep <= 0) sweep += 360;
    if (Math.abs(sweep - want) > 1.5 && Math.abs(sweep - want - 360) > 1.5) issues.push({ code: "render_value_mismatch", message: `각 라벨 ${a.label}(${want.toFixed(1)}°) 인데 그려진 각은 ${sweep.toFixed(1)}° 입니다(그림이 참값과 다름).` });
  }
}


// ───────────────────────── 삼각함수 곡선(trig_curve) 충실도 ─────────────────────────
/** 눈금·라벨의 수: "π/6"·"−3π/2"·"1/2"·"−3/5"·"9" → 수(π 는 단위 1). 해석 불가면 null. */
export function parseTcNum(t: string): number | null {
  const s = t.trim().replace(/−/g, "-").replace(/\s+/g, "");
  let m = s.match(/^(-?)(\d*)π(?:\/(\d+))?$/); if (m) return (m[1] === "-" ? -1 : 1) * (m[2] === "" ? 1 : Number(m[2])) / (m[3] === undefined ? 1 : Number(m[3]));
  m = s.match(/^(-?\d+(?:\.\d+)?)(?:\/(\d+))?$/); if (m) return Number(m[1]) / (m[2] === undefined ? 1 : Number(m[2]));
  return null;
}
function checkTrigCurveFidelity(spec: Spec, svg: string, issues: QaIssue[]) {
  const S = spec as unknown as { fn: "sin" | "cos"; amp: number; period: number; mid?: number; shift?: number; xUnit: "pi" | "plain"; xRange: [number, number]; yRange: [number, number]; xTitle?: string; yTitle?: string; points?: { x: number; label?: string; name?: string }[] };
  const val = (x: number) => { const a = (2 * Math.PI * (x - (S.shift ?? 0))) / S.period; return (S.mid ?? 0) + S.amp * (S.fn === "sin" ? Math.sin(a) : Math.cos(a)); };
  const ts = texts(svg).filter((t) => !t.rotated);
  // 눈금 → 축척: 가로는 같은 줄의 가운데 정렬 글자(π 단위 해석 포함), 세로는 오른쪽 정렬 숫자
  const mids = ts.filter((t) => t.anchor === "middle" && parseTcNum(t.text) !== null && t.size <= 12); const byY = new Map<number, typeof mids>(); for (const t of mids) byY.set(t.y, [...(byY.get(t.y) ?? []), t]);
  const row = [...byY.entries()].sort((p, q) => q[1].length - p[1].length)[0]?.[1] ?? [];
  const fx = fit(row.map((t) => ({ v: parseTcNum(t.text)!, pos: t.x }))); const fy = fit(ts.filter((t) => t.anchor === "end" && NUM.test(t.text)).map((t) => ({ v: toNum(t.text), pos: t.y - 4 })));
  if (!fx || row.length < 3) issues.push({ code: "axis_ticks_missing", message: `가로축 눈금 숫자가 ${row.length}개뿐입니다(3개 이상 필요).` });
  else if (fx.maxRes > 1.5) issues.push({ code: "render_scale_nonlinear", message: `가로축 눈금 숫자의 위치가 일정한 간격이 아닙니다(잔차 ${fx.maxRes.toFixed(1)}px).` });
  if (!fy) issues.push({ code: "axis_ticks_missing", message: "세로축 눈금 숫자가 없습니다." });
  else if (fy.maxRes > 1.5) issues.push({ code: "render_scale_nonlinear", message: `세로축 눈금 숫자의 위치가 일정한 간격이 아닙니다(잔차 ${fy.maxRes.toFixed(1)}px).` });
  // 축 제목·단위(순수 xy 그래프는 'x'/'y' 허용 — 오너 승인 2026-10-05)
  for (const [n, t, pure] of [["가로", S.xTitle, "x"], ["세로", S.yTitle, "y"]] as const) { if (!t) issues.push({ code: "axis_title_missing", message: `${n}축 제목이 없습니다.` }); else if (t.trim() !== pure && !/\([^)]+\)/.test(t)) issues.push({ code: "unit_missing_in_title", message: `${n}축 제목 '${t}' 에 단위(괄호)가 없습니다.` }); else if (!texts(svg).some((q) => q.text.replace(/\s+/g, " ") === t.replace(/\s+/g, " "))) issues.push({ code: "axis_title_missing", message: `${n}축 제목 '${t}' 가 그림에 그려지지 않았습니다.` }); }
  if (!fx || !fy) return;
  // 곡선: 그려진 폴리라인의 모든 표본이 식 위에 있는가
  const pl = polylines(svg).find((q) => q.stroke === "#111" && q.pts.length > 100);
  if (!pl) { issues.push({ code: "render_empty", message: "곡선이 그려지지 않았습니다." }); } else {
    let worst = 0, wx = 0; for (const [pxx, pyy] of pl.pts) { const x = fx.a * pxx + fx.b; const y = fy.a * pyy + fy.b; const want = Math.min(S.yRange[1], Math.max(S.yRange[0], val(x))); const d = Math.abs(want - y) / Math.abs(fy.a); if (d > worst) { worst = d; wx = x; } }
    if (worst > 1.5) issues.push({ code: "render_value_mismatch", message: `곡선이 데이터의 식과 ${worst.toFixed(1)}px 어긋납니다(x = ${wx.toFixed(2)} 근처 — 진폭·주기·중심선·위상 불일치).` });
  }
  // 표시점·라벨
  const dots = [...svg.matchAll(/<circle\b([^>]*)\/?>/g)].map((m) => ({ cx: Number(attr(m[1], "cx")), cy: Number(attr(m[1], "cy")), r: Number(attr(m[1], "r")) })).filter((c) => c.r === 4);
  const pts = S.points ?? []; if (dots.length !== pts.length) { issues.push({ code: dots.length === 0 && pts.length ? "render_empty" : "render_value_mismatch", message: `그려진 표시점 ${dots.length}개 ≠ 데이터 점 ${pts.length}개.` }); return; }
  const used = new Set<number>();
  for (const p of pts) {
    const ex = (p.x - fx.b) / fx.a, ey = (val(p.x) - fy.b) / fy.a; let best = -1, bd = Infinity; dots.forEach((d, i) => { if (used.has(i)) return; const q = Math.hypot(d.cx - ex, d.cy - ey); if (q < bd) { bd = q; best = i; } }); if (best >= 0) used.add(best);
    if (bd > 1.5) issues.push({ code: "render_value_mismatch", message: `표시점 x = ${p.x} 이 곡선 위 제 자리에서 ${bd.toFixed(1)}px 벗어나 그려졌습니다.` });
    const lab = p.label?.replace(/−/g, "-").match(/^\(\s*([^,]+?)\s*,\s*([^)]+?)\s*\)$/);
    if (p.label && !ts.some((q) => q.text.includes(p.label!))) issues.push({ code: "label_missing", message: `표시점 라벨 '${p.label}' 이 그려지지 않았습니다.` });
    if (lab) { const lx = parseTcNum(lab[1]), ly = parseTcNum(lab[2]); if ((lx !== null && Math.abs(lx - p.x) > 0.02 * Math.max(1, Math.abs(p.x))) || (ly !== null && Math.abs(ly - val(p.x)) > 0.02 * Math.max(1, Math.abs(val(p.x))))) issues.push({ code: "render_value_mismatch", message: `표시점 라벨 ${p.label} 이 곡선 위 점 (${p.x.toFixed(3)}, ${val(p.x).toFixed(3)}) 과 다릅니다(그림이 참값과 다름).` }); }
  }
}


// ───────────────────────── 벤·수형도(venn_tree) 충실도 ─────────────────────────
function checkVennTreeFidelity(spec: Spec, svg: string, issues: QaIssue[]) {
  const ts = texts(svg);
  if (spec.kind === "venn") {
    const regs = spec.regions as { id: string; label: string }[]; const cs = [...svg.matchAll(/<circle\b([^>]*)\/?>/g)].map((m) => ({ cx: Number(attr(m[1], "cx")), cy: Number(attr(m[1], "cy")), r: Number(attr(m[1], "r")) })).filter((c) => c.r > 50);
    if (cs.length !== 2) { issues.push({ code: "render_empty", message: `벤 다이어그램의 원이 ${cs.length}개입니다(2개 필요).` }); return; }
    const [A, B] = cs.sort((p, q) => p.cx - q.cx); const rect = [...svg.matchAll(/<rect\b([^>]*)\/?>/g)].map((m) => ({ x: Number(attr(m[1], "x")), y: Number(attr(m[1], "y")), w: Number(attr(m[1], "width")), h: Number(attr(m[1], "height")) }))[0];
    const inC = (c: typeof A, x: number, y: number) => Math.hypot(x - c.cx, y - c.cy) < c.r - 2;
    const inR = (x: number, y: number) => !rect || (x > rect.x && x < rect.x + rect.w && y > rect.y && y < rect.y + rect.h);
    const want: Record<string, (x: number, y: number) => boolean> = { a: (x, y) => inC(A, x, y) && !inC(B, x, y), ab: (x, y) => inC(A, x, y) && inC(B, x, y), b: (x, y) => !inC(A, x, y) && inC(B, x, y), out: (x, y) => !inC(A, x, y) && !inC(B, x, y) && inR(x, y) };
    for (const r of regs) if (!ts.some((t) => t.text === r.label && !t.rotated && want[r.id](t.x, t.y - 5))) issues.push({ code: "render_value_mismatch", message: `영역 ${r.id} 의 값 '${r.label}' 가 그 영역 안에 그려지지 않았습니다.` });
    const sets = spec.sets as string[]; for (const n of sets) if (!ts.some((t) => t.text === n)) issues.push({ code: "label_missing", message: `집합 이름 '${n}' 이 그려지지 않았습니다.` });
    const nums = regs.map((r) => (/^\d+$/.test(r.label) ? Number(r.label) : NaN)); const tot = (spec.total as { label: string } | undefined)?.label;
    if (tot && /^\d+$/.test(tot) && nums.every((v) => !Number.isNaN(v)) && nums.reduce((a, b) => a + b, 0) !== Number(tot)) issues.push({ code: "render_value_mismatch", message: `영역 값의 합 ${nums.reduce((a, b) => a + b, 0)} 이 전체 ${tot} 와 다릅니다.` });
    return;
  }
  const br = spec.branches as { name: string; label: string; next: { name: string; label: string }[] }[];
  const ls = lines(svg).filter((l) => l.stroke === "#111"); const need = br.length + br.reduce((n, b) => n + b.next.length, 0);
  if (ls.length !== need) issues.push({ code: "render_value_mismatch", message: `그려진 가지 ${ls.length}개 ≠ 데이터 ${need}개.` });
  const near = (l: { x1: number; y1: number; x2: number; y2: number }, lab: string) => ts.some((t) => t.text === lab && Math.hypot(t.x - (l.x1 + l.x2) / 2, t.y - 5 - (l.y1 + l.y2) / 2) < 26);
  const byX = [...ls].sort((p, q) => p.x1 - q.x1); const l1 = byX.filter((l) => l.x1 === Math.min(...ls.map((q) => q.x1))).sort((p, q) => p.y2 - q.y2); const l2 = ls.filter((l) => !l1.includes(l)).sort((p, q) => p.y2 - q.y2);
  br.forEach((b, i) => { if (l1[i] && !near(l1[i], b.label)) issues.push({ code: "render_value_mismatch", message: `첫 단계 가지 '${b.name}' 의 확률 라벨 '${b.label}' 이 그 가지 옆에 없습니다.` }); if (!ts.some((t) => t.text === b.name)) issues.push({ code: "label_missing", message: `가지 이름 '${b.name}' 이 그려지지 않았습니다.` }); });
  const flat = br.flatMap((b) => b.next); flat.forEach((n, i) => { if (l2[i] && !near(l2[i], n.label)) issues.push({ code: "render_value_mismatch", message: `둘째 단계 가지 '${n.name}' 의 확률 라벨 '${n.label}' 이 그 가지 옆에 없습니다.` }); });
  const val = (t: string) => { const m = t.match(/^(\d+)\/(\d+)$/); return m ? Number(m[1]) / Number(m[2]) : /^\d*\.?\d+$/.test(t) ? Number(t) : NaN; };
  const sum = (a: { label: string }[]) => { const v = a.map((x) => val(x.label)); return v.some(Number.isNaN) ? null : v.reduce((p, q) => p + q, 0); };
  for (const [what, a] of [["첫 단계", br], ...br.map((b, i) => [`가지 ${i + 1} 의 둘째 단계`, b.next] as const)] as [string, { label: string }[]][]) { const s = sum(a); if (s !== null && Math.abs(s - 1) > 1e-9) issues.push({ code: "render_value_mismatch", message: `${what} 형제 가지의 확률 합이 ${s.toFixed(3)} 로 1 이 아닙니다.` }); }
}


// ───────────────────────── 삼각형 중첩(triangle_nested) 충실도 ─────────────────────────
function checkTriNestedFidelity(spec: Spec, svg: string, issues: QaIssue[]) {
  const S = spec as unknown as { kind: "parallel" | "altitude"; vertices: string[]; points: string[]; sides?: { between: [string, string]; label?: string }[] };
  const dots = [...svg.matchAll(/<circle\b([^>]*)\/?>/g)].map((m) => ({ x: Number(attr(m[1], "cx")), y: Number(attr(m[1], "cy")), r: Number(attr(m[1], "r")) })).filter((c) => Math.abs(c.r - 2.8) < 1e-6);
  const names = [...S.vertices, ...S.points]; if (dots.length !== names.length) { issues.push({ code: "render_empty", message: `그려진 점 ${dots.length}개 ≠ 데이터 점 ${names.length}개.` }); return; }
  const ts = texts(svg).filter((t) => t.size >= 14 && names.includes(t.text)); const at = new Map<string, [number, number]>();
  for (const n of names) { const tx = ts.find((t) => t.text === n); if (!tx) { issues.push({ code: "label_missing", message: `점 이름 '${n}' 이 그려지지 않았습니다.` }); return; } let best = dots[0], bd = Infinity; for (const d of dots) { const q = Math.hypot(d.x - tx.x, d.y - tx.y); if (q < bd) { bd = q; best = d; } } at.set(n, [best.x, best.y]); }
  if (new Set([...at.values()].map((p) => p.join(","))).size !== names.length) return;
  const len = (a: string, b: string) => Math.hypot(at.get(a)![0] - at.get(b)![0], at.get(a)![1] - at.get(b)![1]);
  const dir = (a: string, b: string) => Math.atan2(at.get(b)![1] - at.get(a)![1], at.get(b)![0] - at.get(a)![0]);
  const [v0, v1, v2] = S.vertices;
  if (S.kind === "parallel") {
    let d = Math.abs(dir(S.points[0], S.points[1]) - dir(v1, v2)) * 180 / Math.PI; d = Math.min(d, 180 - d); if (d > 1.5) issues.push({ code: "render_value_mismatch", message: `${S.points.join("")} 가 ${v1}${v2} 와 평행하게 그려지지 않았습니다(${d.toFixed(1)}° 어긋남).` });
    const lines0 = lines(svg).filter((l) => l.stroke === "#111"); void lines0;
  } else {
    const dc = dir(S.points[0], v2), ab = dir(v0, v1); let d = Math.abs(dc - ab) * 180 / Math.PI; d = Math.abs(d - 90); if (d > 1.5) issues.push({ code: "render_value_mismatch", message: `수선 ${v2}${S.points[0]} 가 ${v0}${v1} 에 수직으로 그려지지 않았습니다.` });
    const g = Math.abs(dir(v2, v0) - dir(v2, v1)) * 180 / Math.PI; if (Math.abs(g - 90) > 2) issues.push({ code: "render_value_mismatch", message: `${v2} 의 각이 직각으로 그려지지 않았습니다.` });
  }
  // 숫자 길이 라벨은 그려진 길이와 비례해야 한다
  const num = (S.sides ?? []).map((q) => ({ v: /^\d+(?:\.\d+)?$/.test((q.label ?? "").trim()) ? Number(q.label) : null, a: q.between[0], b: q.between[1] })).filter((q) => q.v !== null && at.has(q.a) && at.has(q.b)) as { v: number; a: string; b: string }[];
  if (!(spec as { notToScale?: boolean }).notToScale) for (let i = 1; i < num.length; i++) { const r0 = len(num[0].a, num[0].b) / num[0].v, ri = len(num[i].a, num[i].b) / num[i].v; if (Math.abs(ri / r0 - 1) > 0.07) { issues.push({ code: "render_value_mismatch", message: `변 ${num[i].a}${num[i].b} 의 길이 비율이 변 ${num[0].a}${num[0].b} 와 라벨 ${num[i].v}:${num[0].v} 에 맞지 않게 그려졌습니다.` }); break; } }
}


// ───────────────────────── 입체 확장(solid_x) 충실도 ─────────────────────────
function checkSolidXFidelity(spec: Spec, svg: string, issues: QaIssue[]) {
  const S = spec as unknown as { kind: string; dims: { id: string; label: string }[]; diagonal?: string };
  const ts = texts(svg); for (const d of S.dims) if (!ts.some((t) => t.text === d.label)) issues.push({ code: "label_missing", message: `치수 라벨 '${d.id} = ${d.label}' 이 그려지지 않았습니다.` });
  const all = [...svg.matchAll(/<line\b([^>]*)\/?>/g)].map((m) => ({ x1: Number(attr(m[1], "x1")), y1: Number(attr(m[1], "y1")), x2: Number(attr(m[1], "x2")), y2: Number(attr(m[1], "y2")), dash: /stroke-dasharray/.test(m[1]), w: Number(attr(m[1], "stroke-width") ?? 0), stroke: attr(m[1], "stroke") ?? "" })).filter((l) => l.stroke === "#111");
  const key = (x: number, y: number) => `${Math.round(x)},${Math.round(y)}`; const ends = new Map<string, number>(); for (const l of all) { for (const k of [key(l.x1, l.y1), key(l.x2, l.y2)]) ends.set(k, (ends.get(k) ?? 0) + 1); }
  const diags = all.filter((l) => l.dash && l.w >= 2.1); const wantDiag = S.kind === "box_diagonal" ? (S.diagonal === "both" ? 1 : S.diagonal === "face_bottom" || S.diagonal === "face_front" ? 0 : 1) : S.kind === "cylinder_section" ? 1 : 0;
  if (diags.length < wantDiag) issues.push({ code: "render_empty", message: "대각선(굵은 점선)이 그려지지 않았습니다." });
  const dashed = all.filter((l) => l.dash).length; const need = S.kind === "box_diagonal" ? 3 + (S.diagonal === "both" ? 2 : 1) : S.kind === "triangular_prism" ? 3 : 0;
  if (need && dashed < need) issues.push({ code: "render_value_mismatch", message: `점선 ${dashed}개 < 기대 ${need}개(숨은 모서리·대각선).` });
  const need2 = S.kind === "box_diagonal" ? 3 : 2; // 모서리 꼭짓점에는 선이 여럿 모인다
  for (const l of [...diags, ...(S.kind === "box_diagonal" ? all.filter((q) => q.dash && q.w < 2.1 && (S.diagonal === "face_bottom" || S.diagonal === "face_front" || S.diagonal === "both") && Math.hypot(q.x2 - q.x1, q.y2 - q.y1) > 60) : [])]) for (const k of [key(l.x1, l.y1), key(l.x2, l.y2)]) if ((ends.get(k) ?? 0) < need2) issues.push({ code: "render_value_mismatch", message: `대각선의 끝점 (${k}) 이 입체의 꼭짓점이 아닙니다(모서리가 ${(ends.get(k) ?? 0)}개만 만남).` });
  if (!/Figure not drawn to scale/.test(svg)) issues.push({ code: "render_value_mismatch", message: "입체 확장 도식은 'not drawn to scale' 표기가 있어야 합니다." });
}


// ───────────────────────── L자형(l_shape) 충실도 ─────────────────────────
function checkLShapeFidelity(spec: Spec, svg: string, issues: QaIssue[]) {
  const S = spec as unknown as { shape: { W: number; H: number; w1: number; h1: number }; sides?: { edge: number; label: string }[]; notToScale?: boolean };
  const ls = [...svg.matchAll(/<line\b([^>]*)\/?>/g)].map((m) => ({ x1: Number(attr(m[1], "x1")), y1: Number(attr(m[1], "y1")), x2: Number(attr(m[1], "x2")), y2: Number(attr(m[1], "y2")), w: attr(m[1], "stroke-width"), stroke: attr(m[1], "stroke") })).filter((l) => l.stroke === "#111" && l.w === "2");
  if (ls.length !== 6) { issues.push({ code: "render_empty", message: `L자형의 변이 ${ls.length}개 그려졌습니다(6개 필요).` }); return; }
  // 모든 변이 가로·세로여야 하고(직각), 변 길이 비가 shape 와 같아야 한다
  for (const l of ls) if (Math.abs(l.x1 - l.x2) > 0.6 && Math.abs(l.y1 - l.y2) > 0.6) issues.push({ code: "render_value_mismatch", message: "가로·세로가 아닌 변이 있습니다(직각 도형이어야 함)." });
  const len = (l: { x1: number; y1: number; x2: number; y2: number }) => Math.hypot(l.x2 - l.x1, l.y2 - l.y1); const { W, H, w1, h1 } = S.shape; const want = [W, h1, W - w1, H - h1, w1, H];
  const big = Math.max(...ls.map(len)), bigW = Math.max(W, H); const k = big / bigW;
  const sorted = [...ls].sort((a, b) => len(a) - len(b)); const ws = [...want].sort((a, b) => a - b);
  sorted.forEach((l, i) => { if (Math.abs(len(l) - ws[i] * k) > 2.5) issues.push({ code: "render_value_mismatch", message: `그려진 변 길이 ${len(l).toFixed(1)}px 이 shape 의 ${ws[i]} (환산 ${(ws[i] * k).toFixed(1)}px) 와 다릅니다.` }); });
  const ts = texts(svg); for (const q of S.sides ?? []) if (!ts.some((t) => t.text === q.label)) issues.push({ code: "label_missing", message: `변 라벨 '${q.label}' 이 그려지지 않았습니다.` });
  // 숫자 라벨은 shape 의 해당 변과 비례(= 라벨 값 ÷ 참값 이 모두 같아야 함)
  if (!S.notToScale) { const r = (S.sides ?? []).map((q) => ({ v: /^\d+(?:\.\d+)?$/.test(q.label) ? Number(q.label) : null, t: want[q.edge] })).filter((q) => q.v !== null) as { v: number; t: number }[]; for (let i = 1; i < r.length; i++) if (Math.abs(r[i].v / r[i].t / (r[0].v / r[0].t) - 1) > 0.05) { issues.push({ code: "render_value_mismatch", message: `라벨 ${r[i].v} 과 ${r[0].v} 의 비가 그려진 변의 비와 다릅니다(그림이 라벨과 비례하지 않음).` }); break; } }
}

/** 그림 하나(자식 포함하지 않음)의 구조 검사. */
export function checkRenderedFigure(spec: Spec, markup: string): QaIssue[] {
  const issues: QaIssue[] = [];
  if (!markup || markup.length < 50) return [{ code: "render_empty", message: "그림이 비어 있습니다." }];
  if (spec.type === "data" && spec.kind === "two_way") { checkTwoWay(spec, markup, issues); return issues; }
  if (spec.type === "data" && spec.kind === "table") { checkTable(spec, markup, issues); return issues; }
  if (spec.type === "data" && spec.kind === "statement") { checkStatement(spec, markup, issues); return issues; }
  if (spec.type === "data" && spec.kind === "scatter") { checkAxes(spec, markup, issues, false); checkScatterFidelity(spec, markup, issues); checkOverlapAndClip(markup, issues); return issues; }
  if (spec.type === "data" && spec.kind === "line") { checkAxes({ ...spec, xTitle: spec.xTitle, yTitle: spec.yTitle }, markup, issues, false); checkLineChartFidelity(spec, markup, issues); checkOverlapAndClip(markup, issues); return issues; }
  if (spec.type === "data" && spec.kind === "bar") { checkChartAxes(spec, markup, issues, { xNum: false, yNum: true, xTitle: true, yTitle: true, xUnit: false }); checkBarFidelity(spec, markup, issues); checkOverlapAndClip(markup, issues); return issues; }
  if (spec.type === "data" && spec.kind === "histogram") { checkChartAxes(spec, markup, issues, { xNum: true, yNum: true, xTitle: true, yTitle: true }); checkHistogramFidelity(spec, markup, issues); checkOverlapAndClip(markup, issues); return issues; }
  if (spec.type === "data" && spec.kind === "dot_plot") { checkChartAxes(spec, markup, issues, { xNum: true, yNum: false, xTitle: true, yTitle: false }); checkDotPlotFidelity(spec, markup, issues); checkOverlapAndClip(markup, issues); return issues; }
  if (spec.type === "data" && spec.kind === "boxplot") { checkChartAxes(spec, markup, issues, { xNum: true, yNum: false, xTitle: true, yTitle: false }); checkBoxplotFidelity(spec, markup, issues); checkOverlapAndClip(markup, issues); return issues; }
  if (spec.type === "triangle") { checkTriangleFidelity(spec, markup, issues); return issues; } // 글자 겹침은 엔진이 라벨 자리를 정할 때 이미 검사한다
  if (spec.type === "l_shape") { checkLShapeFidelity(spec, markup, issues); return issues; }
  if (spec.type === "solid_x") { checkSolidXFidelity(spec, markup, issues); return issues; }
  if (spec.type === "triangle_nested") { checkTriNestedFidelity(spec, markup, issues); return issues; }
  if (spec.type === "venn_tree") { checkVennTreeFidelity(spec, markup, issues); checkOverlapAndClip(markup, issues); return issues; }
  if (spec.type === "trig_curve") { checkTrigCurveFidelity(spec, markup, issues); checkOverlapAndClip(markup, issues); return issues; }
  if (spec.type === "unit_circle") { checkUnitCircleFidelity(spec, markup, issues); checkOverlapAndClip(markup, issues); return issues; }
  if (spec.type === "plane") { checkAxes(spec, markup, issues, true); checkPlaneScatter(spec, markup, issues); checkPlaneLines(spec, markup, issues); checkOverlapAndClip(markup, issues); return issues; }
  return issues;
}

const tickSig = (svg: string) => { const s = readScale(svg); return JSON.stringify([s.xTicks, s.yTicks]); };
/** 복수 그림(figure_set 자료 / figure_choice 선택지): 같은 단위·같은 축척(눈금)·같은 크기여야 한다. */
export function checkMultiFigure(children: Spec[], kind: "figure_set" | "figure_choice", textForLabels?: string): QaIssue[] {
  const issues: QaIssue[] = []; const svgs = children.map((c) => renderFigureSvg(c as unknown as FigureSpec, textForLabels === undefined ? undefined : { text: textForLabels }));
  children.forEach((c, i) => checkRenderedFigure(c, svgs[i]).forEach((q) => issues.push({ code: q.code, message: `${kind === "figure_choice" ? "선택지" : "자료"} ${"ABCD"[i]}: ${q.message}` })));
  const graphs = children.every((c) => (c.type === "data" && (c.kind === "scatter" || c.kind === "line" || c.kind === "bar" || c.kind === "dot_plot" || c.kind === "histogram" || c.kind === "boxplot")) || c.type === "plane" || c.type === "trig_curve");
  if (graphs) {
    if (new Set(svgs.map(tickSig)).size > 1) issues.push({ code: kind === "figure_choice" ? "choice_axes_differ" : "scale_mismatch_between_figures", message: "복수 그림의 눈금(축척)이 서로 다릅니다 — 같은 단위의 값은 같은 축척으로 그려야 합니다." });
    if (new Set(svgs.map(viewBox)).size > 1) issues.push({ code: "choice_size_differ", message: "복수 그림의 크기가 서로 다릅니다." });
    const titles = new Set(children.map((c) => JSON.stringify([c.xTitle ?? (c.axes as { x?: { title?: string } } | undefined)?.x?.title, c.yTitle ?? (c.axes as { y?: { title?: string } } | undefined)?.y?.title]))); if (titles.size > 1 && kind === "figure_choice") issues.push({ code: "choice_axes_differ", message: "선택지 그림의 축 제목(단위)이 서로 다릅니다." });
  }
  return issues;
}

/**
 * 선택지 그림이 서로 눈으로 구별되는가 — 선택지를 가르는 특징(추세선 위치·추세선 위 점 수·상관의 정도)이 모두 같으면 구별 불가다.
 * 추세선 선택지는 양 끝 높이 차가 축 높이의 5% 이상이어야 하고, 같은 선이라도 위쪽 점 수나 상관계수(0.1 단위)가 다르면 구별된다(점 수·연관 선택지).
 */
export function checkChoiceDistinct(children: Spec[]): QaIssue[] {
  const issues: QaIssue[] = []; const sc = children.map((c) => (c.objects as { kind: string; points?: [number, number][]; fitLine?: { slope: number; intercept: number } }[] | undefined)?.find((o) => o.kind === "scatter")); if (!sc.every((o) => o?.fitLine && o.points)) return issues;
  const ax = (children[0].axes as { x: { max: number }; y: { max: number } }); const yr = ax.y.max, xm = ax.x.max;
  const feat = sc.map((o) => { const f = o!.fitLine!, ps = o!.points!; const mx = ps.reduce((a, p) => a + p[0], 0) / ps.length, my = ps.reduce((a, p) => a + p[1], 0) / ps.length; let sxy = 0, sxx = 0, syy = 0; for (const [x, y] of ps) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; } return { f, above: ps.filter((p) => p[1] > f.slope * p[0] + f.intercept).length, r: sxy / Math.sqrt(sxx * syy || 1) }; });
  for (let i = 0; i < feat.length; i++) for (let j = i + 1; j < feat.length; j++) {
    const f = feat[i].f, g = feat[j].f; const d = Math.max(Math.abs(f.intercept - g.intercept), Math.abs(f.intercept + f.slope * xm - (g.intercept + g.slope * xm)));
    if (d < 0.05 * yr && feat[i].above === feat[j].above && Math.abs(feat[i].r - feat[j].r) < 0.1) issues.push({ code: "choice_indistinct", message: `선택지 ${"ABCD"[i]} 와 ${"ABCD"[j]} 가 눈으로 구별되지 않습니다(추세선 양 끝 높이 차 ${d.toFixed(1)} < 축 높이의 5%, 위쪽 점 수·상관계수도 같음).` });
  }
  return issues;
}

/** 인스턴스 전체의 구조 검사 — 자료 존재·렌더 충실도·복수 그림 일관성·선택지 구별. */
export function checkInstanceFigureQa(inst: Instance): QaIssue[] {
  const issues: QaIssue[] = []; const fig = inst.figure as Spec | null | undefined; const text = `${inst.stimulus} ${inst.question}`;
  // 앱과 같은 규칙으로 그린다: 문제 텍스트(지문·질문·선택지)에 안 나오는 직선·곡선 라벨은 빠진다(label-rule.ts).
  const allText = problemText(inst.stimulus, inst.question, inst.options);
  if (!fig) { if (mentionsFigure(text)) issues.push({ code: "figure_missing", message: "지문이 그림·표를 가리키는데 자료가 없습니다(needsFigure 인데 figure 없음)." }); return issues; }
  if (fig.type === "figure_choice") { const ch = fig.choices as Spec[]; issues.push(...checkMultiFigure(ch, "figure_choice", allText), ...checkChoiceDistinct(ch)); if (ch.length !== 4) issues.push({ code: "choice_count", message: `선택지 그림 ${ch.length}개` }); }
  else if (fig.type === "figure_set") issues.push(...checkMultiFigure((fig.figures as { spec: Spec }[]).map((f) => f.spec), "figure_set", allText));
  else issues.push(...checkRenderedFigure(fig, renderFigureSvg(fig as unknown as FigureSpec, { text: allText })));
  return issues;
}
