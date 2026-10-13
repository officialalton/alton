// AP Statistics 그림 어댑터 `ap_stat_chart` — SAT 표준 차트 템플릿(data: histogram·dot_plot·boxplot·scatter·two_way·bar·table, venn_tree: 확률 트리)을 AP 그림 게이트·렌더·정규화·렌더 검사에 연결하는 래퍼.
// 추가 표현(2027 CED 통계 파일럿 필요분): 컴퓨터 출력 블록("output"), 이중 눈금(원래 단위 + z) 정규/t 곡선과 꼬리 음영("curve"), 상자그림 이상치 점·산점도 점 강조(data.ts 확장).
// 모든 수치는 Python 원형이 계산한다(곡선 pdf 점열 포함). 이 모듈은 값을 그리고 일관성을 검사할 뿐 계산하지 않는다.

import { validateData, renderData, type DataSpec } from "./data";
import { validateVennTree, renderVennTree, type VennTreeSpec } from "./venn-tree";
import { esc, f, Sheet, type FigureIssue, type Pt } from "./_layout";

export const STAT_CHART_KINDS = ["histogram", "dot_plot", "boxplot", "scatter", "two_way", "bar", "table", "tree", "curve", "output"] as const;
export type StatChartKind = (typeof STAT_CHART_KINDS)[number];
const DATA_KINDS: Record<string, DataSpec["kind"]> = { histogram: "histogram", dot_plot: "dot_plot", boxplot: "boxplot", scatter: "scatter", two_way: "two_way", bar: "bar", table: "table" };

/** 이중 눈금 곡선: x(원래 단위) 눈금 + 선택적 z 눈금(mean + z·sd 자리에 z 값 라벨). points 는 밀도(면적 1). */
export type StatCurve = {
  x: { label: string; min: number; max: number; ticks: number[] };
  z?: { mean: number; sd: number; ticks: number[]; label?: string };
  points: Pt[];
  shades?: { from: number; to: number; label?: string }[];
  marks?: { at: number; label: string }[];
  /** 곡선 이름(범례 없음, 제목·alt 용): "normal" | "t" | "chi-square" 등 */
  family?: string;
};
export type StatOutput = { title: string; sections: { heading?: string; columns?: string[]; rows: (string | number)[][] }[]; notes?: string[] };
export type ApStatChartSpec = {
  type: "ap_stat_chart";
  chart: StatChartKind;
  title?: string;
  /** data 계열: histogram | dot_plot | boxplot | scatter | two_way | bar | table 의 SAT data 스펙 필드(type·kind 제외) */
  data?: Record<string, unknown>;
  /** tree: venn_tree(kind:"tree") 필드(type 제외) */
  tree?: Record<string, unknown>;
  curve?: StatCurve;
  output?: StatOutput;
};

const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const dataSpecOf = (s: ApStatChartSpec): DataSpec => ({ type: "data", kind: DATA_KINDS[s.chart], ...(s.title && !(s.data as Record<string, unknown>)?.title ? { title: s.title } : {}), ...(s.data as object) } as DataSpec);
const treeSpecOf = (s: ApStatChartSpec): VennTreeSpec => ({ type: "venn_tree", kind: "tree", ...(s.tree as object) } as VennTreeSpec);

export function validateApStatChart(s: Record<string, unknown>): { ok: true; spec: ApStatChartSpec } | { ok: false; error: string } {
  if (s.type !== "ap_stat_chart") return { ok: false, error: "type 이 ap_stat_chart 가 아닙니다." };
  const chart = String(s.chart) as StatChartKind;
  if (!STAT_CHART_KINDS.includes(chart)) return { ok: false, error: `chart 는 ${STAT_CHART_KINDS.join("|")} 중 하나입니다.` };
  if (s.title !== undefined && (typeof s.title !== "string" || !s.title.trim() || s.title.length > 90)) return { ok: false, error: "title 은 90자 이내 문자열입니다." };
  const spec = s as unknown as ApStatChartSpec;
  if (DATA_KINDS[chart]) {
    if (!isObj(s.data)) return { ok: false, error: `${chart} 는 data(SAT data 스펙 필드)가 필요합니다.` };
    const v = validateData(dataSpecOf(spec));
    return v.ok ? { ok: true, spec } : v;
  }
  if (chart === "tree") {
    if (!isObj(s.tree)) return { ok: false, error: "tree 는 tree(branches)가 필요합니다." };
    const v = validateVennTree(treeSpecOf(spec));
    return v.ok ? { ok: true, spec } : v;
  }
  if (chart === "curve") {
    const c = s.curve as Record<string, unknown> | undefined;
    if (!isObj(c) || !isObj(c.x)) return { ok: false, error: "curve 는 x 축(label·min·max·ticks)과 points 가 필요합니다." };
    const x = c.x as Record<string, unknown>;
    if (typeof x.label !== "string" || !x.label.trim() || !isNum(x.min) || !isNum(x.max) || x.min >= x.max || !Array.isArray(x.ticks) || x.ticks.length < 3 || x.ticks.length > 12 || !x.ticks.every((t) => isNum(t) && t >= (x.min as number) - 1e-9 && t <= (x.max as number) + 1e-9)) return { ok: false, error: "curve.x 는 label, min<max, ticks(3~12개, 범위 안)가 필요합니다." };
    if (!Array.isArray(c.points) || c.points.length < 20 || !c.points.every((p) => Array.isArray(p) && p.length === 2 && isNum(p[0]) && isNum(p[1]) && p[1] >= 0)) return { ok: false, error: "curve.points 는 [x, 밀도≥0] 20개 이상입니다." };
    const pts = c.points as Pt[];
    for (let i = 1; i < pts.length; i++) if (pts[i][0] <= pts[i - 1][0]) return { ok: false, error: "curve.points 의 x 는 증가해야 합니다." };
    if (c.z !== undefined) { const z = c.z as Record<string, unknown>; if (!isObj(z) || !isNum(z.mean) || !isNum(z.sd) || (z.sd as number) <= 0 || !Array.isArray(z.ticks) || z.ticks.length < 3 || !z.ticks.every(isNum)) return { ok: false, error: "curve.z 는 mean, sd>0, ticks(3개 이상 z 값)이 필요합니다." }; }
    for (const sh of (c.shades as Record<string, unknown>[] | undefined) ?? []) if (!isObj(sh) || !isNum(sh.from) || !isNum(sh.to) || sh.from >= sh.to || (sh.from as number) < (x.min as number) - 1e-9 || (sh.to as number) > (x.max as number) + 1e-9) return { ok: false, error: "curve.shades[] 는 범위 안의 from<to 입니다." };
    for (const m of (c.marks as Record<string, unknown>[] | undefined) ?? []) if (!isObj(m) || !isNum(m.at) || typeof m.label !== "string" || !m.label.trim() || m.label.length > 24) return { ok: false, error: "curve.marks[] 는 at 과 24자 이내 label 입니다." };
    return { ok: true, spec };
  }
  // output
  const o = s.output as Record<string, unknown> | undefined;
  if (!isObj(o) || typeof o.title !== "string" || !o.title.trim() || !Array.isArray(o.sections) || o.sections.length < 1 || o.sections.length > 4) return { ok: false, error: "output 은 title 과 sections(1~4개)가 필요합니다." };
  for (const sec of o.sections as Record<string, unknown>[]) {
    if (!isObj(sec) || !Array.isArray(sec.rows) || sec.rows.length < 1 || sec.rows.length > 14) return { ok: false, error: "output.sections[].rows 는 1~14행입니다." };
    const w = Array.isArray(sec.columns) ? sec.columns.length : (sec.rows as unknown[][])[0].length;
    for (const r of sec.rows as unknown[]) if (!Array.isArray(r) || r.length !== w || !r.every((c) => typeof c === "string" || isNum(c))) return { ok: false, error: "output 의 모든 행은 같은 칸 수의 문자열·숫자입니다." };
  }
  return { ok: true, spec };
}

/** 코드 검사(일관성): 렌더 전에 값이 말이 되는지. 오류는 gate 에서 fail. */
export function statChartChecks(spec: ApStatChartSpec): FigureIssue[] {
  const out: FigureIssue[] = [];
  const add = (code: string, message: string) => out.push({ code, message });
  const d = (spec.data ?? {}) as Record<string, unknown>;
  if (spec.chart === "histogram") {
    const bins = (d.bins ?? []) as { from: number; to: number; count: number }[];
    const w = bins.map((b) => b.to - b.from);
    if (w.some((x) => Math.abs(x - w[0]) > 1e-9)) add("histogram_unequal_bins", "히스토그램 계급 폭이 같지 않습니다(도수 막대가 밀도로 오해됨).");
    if (bins.reduce((a, b) => a + b.count, 0) < 5) add("histogram_too_few", "관측 수가 너무 적습니다.");
  }
  if (spec.chart === "dot_plot") { const n = ((d.dots ?? []) as { count: number }[]).reduce((a, b) => a + b.count, 0); if (n < 5 || n > 80) add("dot_plot_count", `점도표 관측 수 ${n} — 5~80 이어야 읽을 수 있습니다.`); }
  if (spec.chart === "tree") {
    const t = (spec.tree ?? {}) as { branches?: { label: string; next: { label: string }[] }[] };
    const num = (l: string) => (/^\d*\.?\d+$/.test(l) ? Number(l) : null);
    const top = (t.branches ?? []).map((b) => num(b.label));
    if (top.every((x) => x !== null) && Math.abs(top.reduce((a, b) => a + (b as number), 0) - 1) > 0.011) add("tree_probabilities_not_one", "첫 단계 가지 확률의 합이 1 이 아닙니다.");
    for (const b of t.branches ?? []) { const nx = b.next.map((n) => num(n.label)); if (nx.every((x) => x !== null) && Math.abs(nx.reduce((a, c) => a + (c as number), 0) - 1) > 0.011) add("tree_conditional_not_one", "한 가지에서 이어지는 조건부 확률의 합이 1 이 아닙니다."); }
  }
  if (spec.chart === "curve" && spec.curve) {
    const pts = spec.curve.points;
    let area = 0; for (let i = 1; i < pts.length; i++) area += ((pts[i][1] + pts[i - 1][1]) / 2) * (pts[i][0] - pts[i - 1][0]);
    if (area < 0.97 || area > 1.03) add("curve_not_density", `곡선 아래 면적이 ${area.toFixed(3)} — 밀도곡선(면적 1)이어야 합니다.`);
    if (pts[0][0] > spec.curve.x.min + 1e-9 || pts[pts.length - 1][0] < spec.curve.x.max - 1e-9) add("curve_short_of_axis", "곡선이 x 축 범위를 다 덮지 못합니다.");
  }
  if (spec.chart === "output" && spec.output) for (const s of spec.output.sections) for (const r of s.rows) if (r.some((c) => String(c).trim() === "")) add("output_empty_cell", "컴퓨터 출력에 빈 칸이 있습니다.");
  return out;
}

const fnum = (n: number) => (Math.abs(n) >= 1000 ? new Intl.NumberFormat("en-US").format(n) : (Math.round(n * 1000) / 1000).toString());

function renderCurve(spec: ApStatChartSpec): { svg: string; alt: string; issues: FigureIssue[] } {
  const c = spec.curve!;
  const W = 440, top = 24 + (spec.title ? 22 : 0), x0 = 28, x1 = W - 28, base = top + 150;
  const H = base + (c.z ? 72 : 46);
  const sheet = new Sheet(W, H);
  const sx = (v: number) => x0 + ((v - c.x.min) / (c.x.max - c.x.min)) * (x1 - x0);
  const ymax = Math.max(...c.points.map((p) => p[1])) * 1.12;
  const sy = (v: number) => base - (v / ymax) * (base - top);
  if (spec.title) sheet.text(W / 2, 14, spec.title, { size: spec.title.length > 40 ? 11 : 14, anchor: "middle" });
  const interp = (x: number): number => { const p = c.points; if (x <= p[0][0]) return p[0][1]; for (let i = 1; i < p.length; i++) if (x <= p[i][0]) { const t = (x - p[i - 1][0]) / (p[i][0] - p[i - 1][0]); return p[i - 1][1] + t * (p[i][1] - p[i - 1][1]); } return p[p.length - 1][1]; };
  for (const sh of c.shades ?? []) {
    const xs: number[] = [sh.from, ...c.points.map((p) => p[0]).filter((x) => x > sh.from && x < sh.to), sh.to];
    const poly = [`${f(sx(sh.from))},${f(sy(0))}`, ...xs.map((x) => `${f(sx(x))},${f(sy(interp(x)))}`), `${f(sx(sh.to))},${f(sy(0))}`].join(" ");
    sheet.raw(`<polygon points="${poly}" fill="#1B6FB0" fill-opacity="0.28" stroke="none"/>`);
  }
  sheet.polyline(c.points.map(([x, y]) => [sx(x), sy(y)] as Pt), { w: 2, color: "#111" });
  sheet.raw(`<line x1="${f(x0)}" y1="${f(base)}" x2="${f(x1)}" y2="${f(base)}" stroke="#111" stroke-width="1.6"/>`);
  for (const t of c.x.ticks) {
    sheet.raw(`<line x1="${f(sx(t))}" y1="${f(base)}" x2="${f(sx(t))}" y2="${f(base + 5)}" stroke="#111" stroke-width="1.2"/>`);
    sheet.label(sx(t), base + 17, fnum(t), "x 눈금", { size: 12 });
  }
  sheet.text((x0 + x1) / 2, base + 33, c.x.label, { size: 12.5, anchor: "middle" });
  if (c.z) {
    const zb = base + 46;
    sheet.raw(`<line x1="${f(x0)}" y1="${f(zb)}" x2="${f(x1)}" y2="${f(zb)}" stroke="#6b7280" stroke-width="1"/>`);
    for (const z of c.z.ticks) {
      const xv = c.z.mean + z * c.z.sd; if (xv < c.x.min - 1e-9 || xv > c.x.max + 1e-9) continue;
      sheet.raw(`<line x1="${f(sx(xv))}" y1="${f(zb)}" x2="${f(sx(xv))}" y2="${f(zb - 4)}" stroke="#6b7280" stroke-width="1"/>`);
      sheet.label(sx(xv), zb + 13, fnum(z), "z 눈금", { size: 11 });
    }
    sheet.text(x0 - 2, zb - 8, c.z.label ?? "z", { size: 11, anchor: "start", italic: true, color: "#374151" });
  }
  for (const m of c.marks ?? []) {
    sheet.raw(`<line x1="${f(sx(m.at))}" y1="${f(top + 8)}" x2="${f(sx(m.at))}" y2="${f(base)}" stroke="#C8102E" stroke-width="1.6" stroke-dasharray="4 3"/>`);
    sheet.label(sx(m.at), top - 2, m.label, "표시 값", { size: 12 });
  }
  for (const sh of c.shades ?? []) if (sh.label) sheet.label(sx((sh.from + sh.to) / 2), sy(interp((sh.from + sh.to) / 2) * 0.45), sh.label, "음영 라벨", { size: 12 });
  const alt = `${spec.title ? spec.title + ". " : ""}${c.family ? `${c.family} ` : ""}density curve. Horizontal axis: ${c.x.label}, from ${fnum(c.x.min)} to ${fnum(c.x.max)}${c.z ? `, with a second z-score scale (z = ${c.z.ticks.map(fnum).join(", ")})` : ""}.${(c.shades ?? []).length ? ` Shaded area: ${(c.shades ?? []).map((s) => `${fnum(s.from)} to ${fnum(s.to)}${s.label ? ` (${s.label})` : ""}`).join("; ")}.` : ""}${(c.marks ?? []).length ? ` Marked values: ${(c.marks ?? []).map((m) => `${m.label} at ${fnum(m.at)}`).join(", ")}.` : ""}`;
  return { svg: sheet.svg(alt), alt, issues: sheet.uniqueIssues() };
}

function renderOutput(spec: ApStatChartSpec): { markup: string; alt: string; issues: FigureIssue[] } {
  const o = spec.output!;
  const cell = (c: string | number) => esc(typeof c === "number" ? fnum(c) : c);
  const sections = o.sections.map((sec) => {
    const head = sec.columns ? `<tr>${sec.columns.map((c, i) => `<th scope="col" style="text-align:${i === 0 ? "left" : "right"};padding:3px 12px 3px 0;border-bottom:1px solid #111;font-weight:700">${cell(c)}</th>`).join("")}</tr>` : "";
    const body = sec.rows.map((r) => `<tr>${r.map((c, i) => `<td style="text-align:${i === 0 ? "left" : "right"};padding:3px 12px 3px 0;white-space:nowrap">${cell(c)}</td>`).join("")}</tr>`).join("");
    return `${sec.heading ? `<div style="margin:8px 0 3px;font-weight:700">${esc(sec.heading)}</div>` : ""}<table role="table" style="border-collapse:collapse;font-family:Menlo,Consolas,'Courier New',monospace;font-size:13px;color:#111"><thead>${head}</thead><tbody>${body}</tbody></table>`;
  }).join("");
  const notes = (o.notes ?? []).length ? `<div style="margin-top:8px;font-family:Menlo,Consolas,'Courier New',monospace;font-size:12px;color:#374151">${(o.notes ?? []).map((n) => `<div>${esc(n)}</div>`).join("")}</div>` : "";
  const markup = `<div class="figure-stat-output" style="font-family:Menlo,Consolas,'Courier New',monospace;color:#111;border:1.5px solid #9ca3af;border-radius:6px;padding:10px 14px;max-width:100%;overflow-x:auto;background:#fafafa"><div style="font-weight:700;margin-bottom:4px">${esc(o.title)}</div>${sections}${notes}</div>`;
  const alt = `Computer output: ${o.title}. ${o.sections.map((sec) => `${sec.heading ? sec.heading + ": " : ""}${sec.rows.map((r) => r.map((c) => (typeof c === "number" ? fnum(c) : c)).join(" ")).join("; ")}`).join(". ")}.${(o.notes ?? []).length ? " " + (o.notes ?? []).join(" ") : ""}`;
  return { markup, alt, issues: [] };
}

/** 영어 alt(AP 화면은 영어) — SAT data 렌더러의 한국어 alt 를 대체한다. */
function dataAlt(spec: ApStatChartSpec, d: DataSpec): string {
  const t = spec.title ?? d.title; const pre = t ? `${t}. ` : "";
  const ax = `${d.xTitle ? ` Horizontal axis: ${d.xTitle}.` : ""}${d.yTitle ? ` Vertical axis: ${d.yTitle}.` : ""}`;
  switch (spec.chart) {
    case "histogram": return `${pre}Histogram.${ax} Classes: ${(d.bins ?? []).map((b) => `${fnum(b.from)} to ${fnum(b.to)}: ${fnum(b.count)}`).join(", ")}.`;
    case "dot_plot": return `${pre}Dotplot.${ax} Counts: ${(d.dots ?? []).map((x) => `${fnum(x.value)}: ${x.count}`).join(", ")}.`;
    case "boxplot": return `${pre}Boxplot.${ax} ${(d.boxes ?? []).map((b) => `${b.name}: minimum ${fnum(b.min)}, Q1 ${fnum(b.q1)}, median ${fnum(b.median)}, Q3 ${fnum(b.q3)}, maximum ${fnum(b.max)}${b.outliers?.length ? `, outliers at ${b.outliers.map(fnum).join(", ")}` : ""}`).join("; ")}.`;
    case "scatter": return `${pre}Scatterplot of ${(d.points ?? []).length} points.${ax}${d.fitLine ? ` Line: y = ${fnum(d.fitLine.slope)}x + ${fnum(d.fitLine.intercept)}.` : ""}${(d.highlights ?? []).length ? ` Highlighted point${(d.highlights ?? []).length > 1 ? "s" : ""}: ${(d.highlights ?? []).map((h) => `(${fnum(d.points![h.index][0])}, ${fnum(d.points![h.index][1])})${h.label ? ` ${h.label}` : ""}`).join("; ")}.` : ""}`;
    case "two_way": return `${pre}Two-way table with row variable ${d.rowHeader ?? ""}. ${(d.rowLabels ?? []).map((r, i) => `${r}: ${(d.colLabels ?? []).map((c, j) => `${c} ${fnum(d.cells![i][j])}`).join(", ")}`).join("; ")}.`;
    case "bar": return `${pre}Bar chart.${ax} ${(d.categories ?? []).map((c, i) => `${c}: ${(d.series ?? []).map((s) => fnum(s.values[i])).join("/")}`).join(", ")}.`;
    default: return `${pre}Table with columns ${(d.columns ?? []).join(", ")}.`;
  }
}

export function renderApStatChart(spec: ApStatChartSpec): { svg: string; alt: string; issues: FigureIssue[] } {
  const checks = statChartChecks(spec);
  if (spec.chart === "curve") { const r = renderCurve(spec); return { ...r, issues: [...r.issues, ...checks] }; }
  if (spec.chart === "output") { const r = renderOutput(spec); return { svg: r.markup, alt: r.alt, issues: [...r.issues, ...checks] }; }
  if (spec.chart === "tree") { const r = renderVennTree(treeSpecOf(spec)); return { svg: r.svg, alt: spec.title ? `${spec.title}. ${r.alt}` : r.alt, issues: [...r.issues, ...checks] }; }
  const ds = dataSpecOf(spec); const r = renderData(ds);
  return { svg: r.markup, alt: dataAlt(spec, ds), issues: [...r.issues, ...checks] };
}

