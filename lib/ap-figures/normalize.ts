// AP 후보의 stimulus(자유 형식 JSON) → 표준 그림 스펙(ap_graph / ap_table) 정규화.
// 원칙: (1) 학생이 문제를 풀려면 필요한 정보만 그린다 — 정답을 알려 주는 표식(교점·극값·절편 선언)은 그리지 않고 "검증용 특징"으로만 보관한다.
// (2) 식은 안전 파서로 표본점을 만들고, 점 목록만 있으면 꺾은선(구간선형)으로 이어 그린다(경고).
// (3) 해석 못 한 모양은 조용히 넘기지 않고 issues 로 남긴다(게이트가 실패로 센다).

import type { ApGraphSpec, ApMarker, ApSeries, ApShade, ApGuide, ApSpec, ApTableSpec } from "../problem-figures/templates/ap-figures";
import { compileExpr, freeIdentifiers, splitEquation } from "../problem-figures/templates/ap-expr";
import { labelMentioned } from "../problem-figures/label-rule";

type Json = Record<string, unknown>;
type Pt = [number, number];
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const num = (v: unknown): number | null => {
  if (isNum(v)) return v;
  if (typeof v === "string") {
    const t = v.trim();
    if (/^-?\d*\.?\d+$/.test(t)) return Number(t);
    const c = compileExpr(t, []);
    if (c) { try { const r = c.fn({}); if (Number.isFinite(r)) return r; } catch { /* ignore */ } }
  }
  return null;
};
const isPt = (v: unknown): v is Pt => Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1]);

export type NormIssue = { level: "error" | "warn" | "info"; code: string; message: string };
export type Feature = { kind: "point" | "x_intercept" | "intersection" | "extremum"; x: number; y?: number; source: string };
export type NormResult = {
  /** table | graph | text | diagram | none */
  stimKind: string;
  spec: ApSpec | null;
  features: Feature[];
  issues: NormIssue[];
  /** 데이터에서 읽었지만 그리지 않은 정보(검증 전용) */
  hidden: string[];
};

/** 문자열 stimulus 는 최종 `}` 가 빠진 채 저장된 경우가 있다(생성기 결함, 93건) — 닫는 중괄호를 최대 3개까지 보충해 읽고 repaired=true 로 알린다. */
export function parseStimulusEx(raw: unknown): { value: Json | null; repaired: boolean } {
  if (isObj(raw)) return { value: raw, repaired: false };
  if (typeof raw === "string") {
    try { const j = JSON.parse(raw); return { value: isObj(j) ? j : null, repaired: false }; } catch { /* repair below */ }
    for (let k = 1; k <= 3; k++) { try { const j = JSON.parse(raw + "}".repeat(k)); if (isObj(j)) return { value: j, repaired: true }; } catch { /* next */ } }
  }
  return { value: null, repaired: false };
}
export const parseStimulus = (raw: unknown): Json | null => parseStimulusEx(raw).value;

function axisOf(a: unknown): { label: string; min: number; max: number; step?: number } | null {
  if (!isObj(a)) return null;
  let min = num(a.min), max = num(a.max);
  if ((min === null || max === null) && Array.isArray(a.range) && a.range.length === 2) { min = num(a.range[0]); max = num(a.range[1]); }
  if (min === null || max === null || min >= max) return null;
  let step: number | undefined;
  for (const k of ["tick_step", "tick", "tick_interval", "ticks"]) {
    const v = a[k];
    if (isNum(v) && v > 0) { step = v; break; }
    if (Array.isArray(v) && v.length >= 2 && v.every(isNum)) {
      const d = v[1] - v[0];
      if (d > 0 && v.every((t, i) => Math.abs(t - v[0] - d * i) < 1e-9)) step = d;
      break;
    }
  }
  const label = typeof a.label === "string" ? a.label : "";
  return { label, min, max, step };
}

function xyVarNames(label: string): string[] {
  const names = new Set<string>();
  const first = label.trim().match(/^[A-Za-z]+(?=[\s(,]|$)/)?.[0];
  if (first && first.length <= 2) names.add(first);
  const l = label.toLowerCase();
  if (/quantity|output|units|bundles|runs|trips|crossings|classes|patches|hours|months|years|days|time/.test(l)) { names.add("Q"); names.add("x"); names.add("t"); }
  if (/price|cost|revenue|dollars|\$|rate|wage|value/.test(l)) { names.add("P"); names.add("y"); }
  return [...names];
}

/** 식 문자열 → 표본점. 반환 null 이면 해석 실패. */
export function sampleExpression(src: string, xr: [number, number], yr: [number, number], xNames: string[], yNames: string[], domain?: [number, number]): { points: Pt[]; lhs: string | null; gaps?: number[] } | null {
  let text = src.trim();
  // 설명 꼬리 "MC = 20 (constant, equals ATC)", "x = y^2 - 2y (parabola, opens right)" 제거
  const cut = text.search(/\s+\((?=[A-Za-z]{3,})/);
  if (cut > 0) text = text.slice(0, cut);
  text = text.replace(/;.*$/, "").replace(/\s+for\s+.*$/i, "").trim();
  // 원: x^2 + y^2 = r^2
  const circ = text.replace(/\s+/g, "").match(/^x\^2\+y\^2=(\d+(?:\.\d+)?)$/);
  if (circ) {
    const r = Math.sqrt(Number(circ[1])); const [d0, d1] = domain ?? [0, r];
    const pts: Pt[] = [];
    for (let k = 0; k <= 120; k++) { const x = d0 + ((d1 - d0) * k) / 120; pts.push([x, Math.sqrt(Math.max(0, r * r - x * x))]); }
    return { points: pts, lhs: null };
  }
  // 연쇄 등호 "MC = ATC = 20" → 마지막 우변
  const parts = text.split("=").map((s) => s.trim());
  const lhs = parts.length >= 2 ? parts[0].replace(/\(.*\)$/, "").trim() : null;
  const rhs = parts.length >= 2 ? parts[parts.length - 1] : text;
  const ids = freeIdentifiers(rhs);
  const [x0, x1] = domain ? [Math.max(xr[0], domain[0]), Math.min(xr[1], domain[1])] : xr;
  const N = 160;
  const pts: Pt[] = [];
  if (ids.length === 0) {
    const c = compileExpr(rhs, []); if (!c) return null;
    const v = c.fn({}); if (!Number.isFinite(v)) return null;
    if (lhs && xNames.includes(lhs) && !yNames.includes(lhs)) return { points: [[v, yr[0]], [v, yr[1]]], lhs }; // Q = 30 → 수직선
    return { points: [[x0, v], [x1, v]], lhs };
  }
  if (ids.length > 1) return null;
  const v = ids[0];
  const c = compileExpr(rhs, [v]); if (!c) return null;
  const xFromY = yNames.includes(v) && !xNames.includes(v) || (lhs !== null && xNames.includes(lhs) && !yNames.includes(lhs) && !xNames.includes(v));
  const inBox = (x: number, y: number) => x >= xr[0] - 1e-9 && x <= xr[1] + 1e-9 && y >= yr[0] - 1e-9 && y <= yr[1] + 1e-9;
  const gaps: number[] = [];
  let lastK = -2;
  const push = (k: number, x: number, y: number) => { if (!Number.isFinite(x) || !Number.isFinite(y) || !inBox(x, y)) return; if (pts.length && lastK !== k - 1) gaps.push(pts.length - 1); pts.push([x, y]); lastK = k; };
  if (xFromY) {
    for (let k = 0; k <= N; k++) { const y = yr[0] + ((yr[1] - yr[0]) * k) / N; push(k, c.fn({ [v]: y }), y); }
  } else {
    for (let k = 0; k <= N; k++) { const x = x0 + ((x1 - x0) * k) / N; push(k, x, c.fn({ [v]: x })); }
  }
  return pts.length >= 2 ? { points: pts, lhs, gaps: gaps.length ? gaps : undefined } : null;
}

function ptFrom(v: unknown, xKeys = ["x", "t", "Q"], yKeys = ["y", "P", "v", "f", "R", "C", "P_on_demand"]): Pt | null {
  if (isPt(v)) return v;
  if (isObj(v)) {
    let x: number | null = null, y: number | null = null;
    for (const k of xKeys) if (x === null && k in v) x = num(v[k]);
    for (const k of yKeys) if (y === null && k in v) y = num(v[k]);
    if (x !== null && y !== null) return [x, y];
    if (x !== null && "approx" in v) return null;
  }
  return null;
}

type Raw = { label: string; points?: Pt[]; keyOnly?: boolean; expr?: string; domain?: [number, number]; dashed: boolean; piecewiseHint: boolean; raw: unknown };

function curveToRaw(c: unknown, idx: number): Raw | null {
  if (typeof c === "string") {
    const m = c.trim();
    // 식("S'(t)=0.5t^3-6t^2", "2*sqrt(x)")이면 expr, 설명문("smooth, differentiable ...")·이름("f'")이면 라벨/무시
    const lhs = m.match(/^([^=]{1,10})=/);
    const isExpr = !!lhs || (!/[A-Za-z]{4,}\s|,/.test(m) && /[0-9^*/+]/.test(m) && freeIdentifiers(m).filter((id) => id.length <= 2).length <= 1 && freeIdentifiers(m).every((id) => id.length <= 4));
    if (isExpr) return { label: "", expr: m, dashed: false, piecewiseHint: false, raw: c };
    return { label: /^[A-Za-z][A-Za-z0-9_'()]{0,10}$/.test(m) ? m : "", dashed: false, piecewiseHint: false, raw: c };
  }
  if (!isObj(c)) return null;
  const label = [c.label, c.name, c.legend].find((v) => typeof v === "string") as string | undefined;
  const exprKey = ["expression", "expr", "formula", "equation", "function"].find((k) => typeof c[k] === "string");
  let points: Pt[] | undefined; let keyOnly = false;
  for (const k of ["points", "vertices", "key_points"]) {
    const v = c[k];
    if (Array.isArray(v) && v.length >= 2 && v.every((p) => ptFrom(p) !== null)) { points = v.map((p) => ptFrom(p) as Pt); keyOnly = k === "key_points"; break; }
  }
  const dom = Array.isArray(c.domain) && c.domain.length === 2 && isNum(c.domain[0]) && isNum(c.domain[1]) ? ([c.domain[0], c.domain[1]] as [number, number]) : undefined;
  const typ = String(c.type ?? c.curve_type ?? "");
  let expr = exprKey ? (c[exprKey] as string) : undefined;
  if (!expr && typeof label === "string" && /=/.test(label) && /[0-9]/.test(label)) expr = label;
  if (!expr && typeof c.curve === "string") expr = c.curve;
  return {
    label: label ?? "", points, keyOnly, expr, domain: dom,
    dashed: /dash/i.test(String(c.style ?? c.legend ?? "")), piecewiseHint: /piecewise|linear|segments/i.test(typ), raw: c,
  } as Raw & { idx?: number };
  void idx;
}

function collectCurves(d: Json, issues: NormIssue[]): Raw[] {
  const out: Raw[] = [];
  if (Array.isArray(d.curves)) d.curves.forEach((c, i) => { const r = curveToRaw(c, i); if (r) out.push(r); });
  if (Array.isArray(d.series)) d.series.forEach((c, i) => {
    const r = curveToRaw(c, i); if (r) out.push(r);
  });
  if (isObj(d.curve) || typeof d.curve === "string") {
    const r = curveToRaw(d.curve, 0);
    if (r) {
      // curve 는 이름·형태만 있고 점은 최상위 points/vertices/key_points 에 있는 형태
      if (!r.points && !r.expr) {
        for (const k of ["points", "vertices", "key_points"]) { const v = d[k]; if (Array.isArray(v) && v.length >= 2 && v.every((p) => ptFrom(p) !== null)) { r.points = v.map((p) => ptFrom(p) as Pt); break; } }
      }
      out.push(r);
    }
  }
  if (out.length === 0) {
    // 최상위 points/vertices/pieces 형태(단일 함수)
    for (const k of ["points", "vertices"]) { const v = d[k]; if (Array.isArray(v) && v.length >= 2 && v.every((p) => isPt(p))) { out.push({ label: "", points: v as Pt[], dashed: false, piecewiseHint: true, raw: d }); break; } }
  }
  void issues;
  return out;
}

export type StimCtx = { subject: string; visibleText: string };

export function normalizeStimulus(stimIn: unknown, ctx: StimCtx): NormResult {
  const issues: NormIssue[] = [];
  const features: Feature[] = [];
  const hidden: string[] = [];
  const { value: stim, repaired } = parseStimulusEx(stimIn);
  if (repaired) issues.push({ level: "warn", code: "stimulus_json_repaired", message: "stimulus 문자열 JSON 의 닫는 중괄호가 빠져 있어 보충해 읽었습니다(생성기 결함 — 새 생성분은 객체로 저장해야 합니다)." });
  if (!stim) return { stimKind: "none", spec: null, features, issues: stimIn == null ? [] : [{ level: "error", code: "stimulus_unparsable", message: "stimulus 를 JSON 객체로 읽지 못했습니다." }], hidden };
  const stimKind = typeof stim.kind === "string" ? stim.kind : stim.data ? "unknown" : "none";
  const data = isObj(stim.data) ? stim.data : null;
  if (stimKind === "none") return { stimKind, spec: null, features, issues, hidden };
  if (stimKind === "text") {
    // 텍스트 자료의 숫자·식이 학생이 보는 본문에 없으면 "Given information" 패널로 보여 준다.
    if (data) {
      const visible = ctx.visibleText + " " + String(stim.description ?? "");
      const vis = new Set((visible.match(/-?\d+(?:\.\d+)?/g) ?? []));
      const nums = [...new Set((JSON.stringify(Object.entries(data).filter(([k]) => !/unit/i.test(k) && !SKIP_KEYS.test(k)).map(([, v]) => v)).match(/-?\d+(?:\.\d+)?/g) ?? []))];
      const miss = nums.filter((n) => !vis.has(n));
      if (miss.length) { const g = genericPanel(data, ctx); if (g.spec) { issues.push({ level: "info", code: "text_data_as_panel", message: `본문에 없는 숫자 ${miss.length}개(${miss.slice(0, 5).join(", ")})가 있어 "Given information" 패널로 보여 줍니다.` }); return { stimKind, spec: g.spec, features, issues, hidden }; } }
    }
    return { stimKind, spec: null, features, issues, hidden };
  }
  if (stimKind === "diagram") return normalizeDiagram(data, stim, ctx, issues, features, hidden);
  if (stimKind === "payoff_matrix" && data) return normalizePayoff(data, stim, issues, features, hidden);
  if (!data) return { stimKind, spec: null, features, issues: [{ level: "error", code: "no_data", message: "그림/표 종류인데 data 가 없습니다." }], hidden };
  if (stimKind === "table") return normalizeTable(data, ctx, issues, features, hidden);
  if (stimKind === "graph") return normalizeGraph(data, stim, ctx, issues, features, hidden);
  return { stimKind, spec: null, features, issues: [{ level: "error", code: "unknown_kind", message: `알 수 없는 stimulus.kind: ${stimKind}` }], hidden };
}

// ── 표 ───────────────────────────────────────────────────────────────
const NOTE_KEYS = ["model", "equation", "initial_condition", "cost_function", "fixed_cost", "variable_cost", "market", "variables", "notes", "note", "setup", "background", "context", "definition", "definitions", "assumptions", "extra", "rule", "function", "conditions", "sequence_data", "demand_equation", "t_domain", "domain", "row_format", "relation"];
function toStr(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap(toStr);
  if (isObj(v)) return Object.entries(v).map(([k, x]) => `${k}: ${typeof x === "string" ? x : JSON.stringify(x)}`);
  if (isNum(v)) return [String(v)];
  return [];
}

function normalizeSingleTable(d: Json, ctx: StimCtx, issues: NormIssue[], features: Feature[], hidden: string[]): NormResult {
  let src: Json = d;
  let transposed: { columns: string[]; rows: (string | number)[][] } | null = null;
  if (isObj(d.table)) {
    const t = d.table as Json;
    const keys = Object.keys(t).filter((k) => k !== "columns" && k !== "rows" && k !== "title");
    if (Array.isArray(t.columns) && !t.rows && keys.length && keys.every((k) => Array.isArray(t[k]))) {
      // 가로형: columns = [변수, x값…], 나머지 키 = 한 행씩
      const head = (t.columns as unknown[]).map(String);
      transposed = { columns: head, rows: keys.map((k) => [k, ...((t[k] as unknown[]).map((v) => (isNum(v) ? v : String(v ?? "—"))))]) };
    } else if (!t.columns && !t.rows && keys.length && keys.every((k) => Array.isArray(t[k]))) {
      // 세로형: 키 = 열 머리글, 값 = 열 데이터
      const n = (t[keys[0]] as unknown[]).length;
      if (keys.every((k) => (t[k] as unknown[]).length === n)) transposed = { columns: keys, rows: Array.from({ length: n }, (_, i) => keys.map((k) => { const v = (t[k] as unknown[])[i]; return isNum(v) ? v : String(v ?? "—"); })) };
    } else src = { ...d, ...t };
  } else if (Array.isArray(d.table)) src = { ...d, rows: d.table };
  if (transposed) src = { ...d, columns: transposed.columns, rows: transposed.rows };
  if (!src.rows && Array.isArray(src.table_rows)) src = { ...src, rows: src.table_rows };
  if (!src.columns && !src.table_columns && Array.isArray(src.column_headers)) src = { ...src, columns: src.column_headers };
  if (!src.columns && !src.table_columns && Array.isArray(src.table_header)) src = { ...src, columns: src.table_header };
  let columns: string[] | null = null;
  if (Array.isArray(src.columns) && src.columns.every((c) => typeof c === "string")) columns = (src.columns as string[]).map((c) => (c.trim() === "" ? "–" : c));
  else if (Array.isArray(src.table_columns) && src.table_columns.every((c) => typeof c === "string")) columns = src.table_columns as string[];
  else if (typeof src.x_label === "string" && typeof src.y_label === "string") columns = [src.x_label, src.y_label];
  else if (typeof d.x_label === "string") columns = [String(d.x_label), String(d.y_label ?? "")];
  if (!src.rows && isObj(src.codon_table)) src = { ...src, codon_table: Object.entries(src.codon_table).map(([codon, meaning]) => ({ codon, meaning })) };
  if (!src.rows && Array.isArray(src.codon_table) && (src.codon_table as unknown[]).every(isObj)) {
    const ct = src.codon_table as Json[];
    src = { ...src, columns: ["Codon", "Meaning"], rows: ct.map((r) => [String(r.codon ?? ""), String(r.meaning ?? "")]), notes: [...toStr(src.notes), ...(typeof src.mRNA_5to3 === "string" ? [`mRNA (5' to 3'): ${src.mRNA_5to3}`] : [])] };
    columns = ["Codon", "Meaning"];
  }
  const rowsRaw = Array.isArray(src.rows) ? src.rows : null;
  if (!rowsRaw) {
    issues.push({ level: "error", code: "table_no_rows", message: "표 본문(rows)이 데이터에 없습니다 — 생성 결함(키: " + Object.keys(d).join(",") + ")." });
    return { stimKind: "table", spec: null, features, issues, hidden };
  }
  let rows: (string | number)[][] = [];
  if (rowsRaw.every((r) => Array.isArray(r))) rows = (rowsRaw as unknown[][]).map((r) => r.map((c) => (isNum(c) ? c : c === null || c === undefined ? "—" : texToPlain(String(c)))));
  else if (rowsRaw.every((r) => isObj(r) && Array.isArray((r as Json).values))) rows = (rowsRaw as Json[]).map((r) => [texToPlain(String(r.label ?? "")), ...(r.values as unknown[]).map((v) => (isNum(v) ? v : String(v)))]);
  else if (rowsRaw.every(isObj)) {
    if (!columns) columns = Object.keys(rowsRaw[0] as Json);
    rows = (rowsRaw as Json[]).map((r) => (columns as string[]).map((c) => { const v = r[c]; return isNum(v) ? v : String(v ?? ""); }));
  } else {
    issues.push({ level: "error", code: "table_rows_shape", message: "표 rows 가 배열의 배열도 객체 배열도 아닙니다." });
    return { stimKind: "table", spec: null, features, issues, hidden };
  }
  if (!columns) {
    issues.push({ level: "error", code: "table_no_header", message: "표 머리글(columns)이 없습니다." });
    return { stimKind: "table", spec: null, features, issues, hidden };
  }
  for (const r of rows) if (r.length !== columns.length) { issues.push({ level: "error", code: "table_row_width", message: `행 칸 수(${r.length})가 열 수(${columns.length})와 다릅니다.` }); break; }
  const notes: string[] = [];
  const used = new Set(["columns", "rows", "title", "x_label", "y_label", "table", "table_columns", "table_rows", "column_headers", "table_header", "units", "unit", "units_note"]);
  for (const k of NOTE_KEYS) if (k in d && !used.has(k)) { notes.push(...toStr(d[k]).map((t) => (k === "function" || k === "demand_equation" || k === "rule" ? `${k.replace("_", " ")}: ${t}` : t))); used.add(k); }
  if (isObj(d.table) && typeof (d.table as Json).title === "string") used.add("title");
  const extra = Object.keys(d).filter((k) => !used.has(k));
  if (extra.length) { hidden.push(...extra); issues.push({ level: "info", code: "table_unmapped_keys", message: `표에서 쓰지 않은 키: ${extra.join(", ")}` }); }
  const title = typeof d.title === "string" ? d.title : isObj(d.table) && typeof (d.table as Json).title === "string" ? String((d.table as Json).title) : undefined;
  const unitsStr = typeof d.units === "string" ? d.units : typeof d.unit === "string" ? d.unit : isObj(d.units) ? Object.entries(d.units).map(([k, v]) => `${k}: ${v}`).join("; ") : undefined;
  const spec: ApTableSpec = { type: "ap_table", title, columns: columns.map(texToPlain), rows, notes: notes.length ? notes.map(texToPlain) : undefined, units: unitsStr ? texToPlain(unitsStr) : undefined };
  void ctx; void features;
  return { stimKind: "table", spec, features, issues, hidden };
}

// ── 그래프 ───────────────────────────────────────────────────────────
function polyFromPieces(pieces: Json[], isolated: unknown[], opens: unknown[]): { series: ApSeries; markers: ApMarker[] } | null {
  const pts: Pt[] = []; const gaps: number[] = []; const markers: ApMarker[] = [];
  for (const p of pieces) {
    if (!p.from && !p.endpoints && Array.isArray(p.point)) {
      const q = ptFrom(p.point); if (q) { markers.push({ x: q[0], y: q[1], style: /open/i.test(String(p.marker ?? "")) ? "open" : "filled", standalone: true }); continue; }
    }
    const from = ptFrom(p.from ?? (Array.isArray(p.endpoints) ? p.endpoints[0] : undefined));
    const to = ptFrom(p.to ?? (Array.isArray(p.endpoints) ? p.endpoints[1] : undefined));
    if (!from || !to) return null;
    pts.push(from); pts.push(to); gaps.push(pts.length - 1);
    const lo = /open/i.test(String(p.left_end ?? "")) || p.start_open === true, ro = /open/i.test(String(p.right_end ?? "")) || p.end_open === true;
    markers.push({ x: from[0], y: from[1], style: lo ? "open" : "filled" }, { x: to[0], y: to[1], style: ro ? "open" : "filled" });
  }
  for (const i of isolated) {
    if (isObj(i)) {
      const q = ptFrom(i.point ?? i);
      if (q) markers.push({ x: q[0], y: q[1], style: i.style === "open" || i.filled === false ? "open" : "filled", standalone: true });
    }
  }
  for (const o of opens) { const q = ptFrom(o); if (q) markers.push({ x: q[0], y: q[1], style: "open" }); }
  // 같은 자리에 닫힘·열림이 겹치면(열린 점 + 단독 채운 점이 같은 좌표) 하나로 합친다 — 먼저 나온 것 유지
  const seen = new Set<string>(); const uniq = markers.filter((m) => { const k = `${m.x},${m.y},${m.style}`; if (seen.has(k)) return false; seen.add(k); return true; });
  // 열린 점과 같은 좌표의 닫힌 끝점은 제거(열린 점이 우선)
  const final = uniq.filter((m) => !(m.style === "filled" && uniq.some((o) => o.style === "open" && o.x === m.x && o.y === m.y)));
  return { series: { label: "", points: pts, gaps }, markers: final };
}

function normalizeGraph(dIn: Json, stim: Json, ctx: StimCtx, issues: NormIssue[], features: Feature[], hidden: string[]): NormResult {
  let d = dIn;
  const axesObj = isObj(d.axes) ? d.axes : null;
  let xa = axisOf(d.x_axis ?? axesObj?.x), ya = axisOf(d.y_axis ?? axesObj?.y);
  if ((!xa || !ya) && typeof d.x_axis === "string" && typeof d.y_axis === "string") {
    // 축이 이름 문자열뿐이면 점 목록에서 범위를 유도한다(경고 — 생성기는 min/max 를 줘야 함).
    const vs = (Array.isArray(d.vertices) ? d.vertices : Array.isArray(d.points) ? d.points : []) as unknown[];
    const pp = vs.map((v) => ptFrom(v)).filter((v): v is Pt => !!v);
    if (pp.length >= 2) {
      const xs = pp.map((p) => p[0]), ys = pp.map((p) => p[1]);
      const lo = Math.floor(Math.min(...ys)) - 1, hi = Math.ceil(Math.max(...ys)) + 1;
      xa = { label: d.x_axis, min: Math.min(...xs), max: Math.max(...xs), step: 1 }; ya = { label: d.y_axis, min: lo, max: hi, step: 1 };
      issues.push({ level: "warn", code: "axis_range_derived", message: "축 범위(min/max)가 없어 점 목록에서 유도했습니다(생성기가 범위를 줘야 함)." });
    }
  }
  const calc = ctx.subject === "ap_calculus_ab" || ctx.subject === "ap_calculus_bc";
  if (xa && ya && calc) {
    if (!xa.label.trim()) { xa.label = "x"; issues.push({ level: "warn", code: "axis_label_defaulted", message: "x 축 라벨이 없어 'x' 로 채웠습니다." }); }
    if (!ya.label.trim()) { ya.label = "y"; issues.push({ level: "warn", code: "axis_label_defaulted", message: "y 축 라벨이 없어 'y' 로 채웠습니다." }); }
  }
  // Micro 일부는 axes 안에 x/y
  if ((!xa || !ya) && isObj(d.functions) === false && typeof d.f === "string" && typeof d.g === "string" && Array.isArray(d.x_range) && d.x_range.length === 2) {
    const xr0 = [Number(d.x_range[0]), Number(d.x_range[1])] as [number, number];
    const ys: number[] = [];
    const cs = [d.f, d.g].map((e) => compileExpr(splitEquation(String(e)).rhs, ["x"]));
    cs.forEach((c) => { if (c) for (let k = 0; k <= 60; k++) { const y = c.fn({ x: xr0[0] + ((xr0[1] - xr0[0]) * k) / 60 }); if (Number.isFinite(y)) ys.push(y); } });
    if (ys.length) {
      xa = { label: "x", min: xr0[0], max: xr0[1], step: 1 }; ya = { label: "y", min: Math.floor(Math.min(...ys)) - 1, max: Math.ceil(Math.max(...ys)) + 1, step: 1 };
      issues.push({ level: "warn", code: "axis_range_derived", message: "축 범위가 없어 두 함수의 x_range 에서 유도했습니다." });
      d = { ...d, curves: [{ label: "f", expression: String(d.f) }, { label: "g", expression: String(d.g) }], shaded_region: typeof d.region === "string" ? d.region : d.region };
    }
  }
  if (!xa || !ya) {
    issues.push({ level: "error", code: "graph_axes", message: "그래프 축(x_axis/y_axis 의 label+min/max 또는 range)을 읽지 못했습니다." });
    return { stimKind: "graph", spec: null, features, issues, hidden };
  }
  if (!xa.label.trim() || !ya.label.trim()) issues.push({ level: "error", code: "axis_label_missing", message: "축 라벨이 비어 있습니다." });
  const xNames = xyVarNames(xa.label), yNames = xyVarNames(ya.label);
  const series: ApSeries[] = []; const markers: ApMarker[] = []; const shades: ApShade[] = []; const guides: ApGuide[] = [];
  const used = new Set(["x_axis", "y_axis", "axes", "legend", "unit", "units", "title", "functions", "region_R", "shade", "calculator", "line_of_revolution", "note", "notes", "context", "setting"]);

  // 1) 조각/구간 목록
  const pieces = Array.isArray(d.pieces) ? (d.pieces as Json[]) : Array.isArray(d.segments) ? (d.segments as Json[]) : null;
  let handledPieces = false;
  if (pieces && pieces.every(isObj)) {
    const r = polyFromPieces(pieces, Array.isArray(d.isolated_points) ? d.isolated_points : [], Array.isArray(d.open_circles) ? d.open_circles : []);
    if (r) { series.push(r.series); markers.push(...r.markers); handledPieces = true; ["pieces", "segments", "isolated_points", "open_circles"].forEach((k) => used.add(k)); }
    else issues.push({ level: "error", code: "pieces_shape", message: "구간 정의(pieces/segments)의 끝점을 읽지 못했습니다." });
  }
  // 2) 곡선
  if (!handledPieces) {
    const raws = collectCurves(d, issues);
    ["curves", "curve", "series", "points", "vertices", "key_points", "curve_type", "type", "function", "function_plotted", "function_graphed", "function_name", "curve_name"].forEach((k) => used.add(k));
    const yr: [number, number] = [ya.min, ya.max], xr: [number, number] = [xa.min, xa.max];
    raws.forEach((r, i) => {
      let pts: Pt[] | null = null; let source: string | undefined; let lhs: string | null = null; let gapsOut: number[] | undefined;
      if (r.expr) {
        const ext: [number, number] | undefined = r.domain ?? (r.points && !r.keyOnly && r.points.length >= 2 ? [Math.min(...r.points.map((p) => p[0])), Math.max(...r.points.map((p) => p[0]))] : undefined);
        const s = sampleExpression(r.expr, xr, yr, xNames, yNames, ext);
        if (s) { pts = s.points; source = r.expr; lhs = s.lhs; gapsOut = s.gaps; }
        else if (!r.points) issues.push({ level: "error", code: "expr_unparsed", message: `곡선 식을 해석하지 못했습니다: "${r.expr}"` });
      }
      if (!pts && r.points) {
        pts = r.points;
        if (!r.piecewiseHint && pts.length < 12) issues.push({ level: "warn", code: "points_only_curve", message: `"${r.label || `곡선 ${i + 1}`}"은 식 없이 점 ${pts.length}개만 있어 꺾은선으로 그렸습니다(부드러운 곡선이면 식이 필요).` });
      }
      if (!pts) return;
      let label = r.label;
      if (!label && lhs && lhs.length <= 12) label = lhs;
      series.push({ label, points: pts, style: r.dashed ? "dashed" : "solid", source, gaps: gapsOut });
    });
    // Micro 선 목록: lines:[{label,from,to}|{label,P}], dashed_lines:[{y,x_range}]
    if (Array.isArray(d.lines)) {
      used.add("lines");
      for (const l of d.lines as Json[]) {
        if (!isObj(l)) continue;
        const label = typeof l.label === "string" ? l.label : "";
        const f = ptFrom(l.from), t = ptFrom(l.to);
        if (f && t) { if (label === "x-axis") continue; series.push({ label, points: [f, t], style: "solid" }); }
        else if ("P" in l && isNum(l.P)) series.push({ label, points: [[xa.min, l.P], [xa.max, l.P]], style: "solid" });
        else if ("Q" in l && isNum(l.Q)) series.push({ label, points: [[l.Q, ya.min], [l.Q, ya.max]], style: "solid" });
      }
    }
    if (Array.isArray(d.dashed_lines)) {
      used.add("dashed_lines");
      for (const l of d.dashed_lines as Json[]) if (isObj(l) && isNum(l.y)) guides.push({ axis: "y", at: l.y });
    }
    if (Array.isArray(d.vertical_segments)) used.add("vertical_segments");
  }
  if (series.length === 0) {
    issues.push({ level: "error", code: "graph_no_series", message: `곡선을 하나도 만들지 못했습니다(키: ${Object.keys(d).join(",")}).` });
    return { stimKind: "graph", spec: null, features, issues, hidden };
  }
  // Bio 선그래프는 데이터점 표시
  if (ctx.subject === "ap_biology") series.forEach((s) => { s.dots = true; });
  if (series.length > 1) series.forEach((s, i) => { if (!s.label) s.label = `Curve ${i + 1}`; });

  // 3) 표식 — 문제 텍스트가 가리키는 것(또는 A/B/C 같은 짧은 이름)만 그린다. 나머지는 검증 전용 특징.
  const declare = (p: Pt, src: string, kind: Feature["kind"]) => features.push({ kind, x: p[0], y: p[1], source: src });
  const maybeMarker = (p: Pt, label: string | undefined, src: string) => {
    const show = label !== undefined && label.trim() !== "" && (/^[A-Z][A-Za-z0-9₀-₉']{0,2}$/.test(label.trim()) || labelMentioned(label, ctx.visibleText));
    if (show) markers.push({ x: p[0], y: p[1], style: "filled", label: label!.trim() });
    else { declare(p, src, "point"); hidden.push(`${src}:${label ?? `${p[0]},${p[1]}`}`); }
  };
  for (const k of ["points", "labeled_points", "marked_points", "marked_point", "key_points"]) {
    const v = d[k]; if (v === undefined) continue;
    if (k === "points" && series.length && Array.isArray(v) && v.every(isPt) && !handledPieces && collectCurves(d, []).some((c) => c.points === undefined || true) && (isObj(d.curve) || typeof d.curve === "string" || Array.isArray(d.curves))) { /* 곡선 정의 쪽에서 사용 */ }
    const list: unknown[] = Array.isArray(v) ? v : isObj(v) ? (ptFrom(v) ? [v] : Object.entries(v).map(([name, p]) => ({ __name: name, p }))) : [];
    for (const it of list) {
      if (isObj(it) && "__name" in it) { const p = ptFrom(it.p); if (p) maybeMarker(p, String(it.__name), k); continue; }
      const p = ptFrom(it); if (!p) continue;
      const label = isObj(it) && typeof it.label === "string" ? it.label : undefined;
      // 곡선 정의 점(k=points/key_points 가 곡선에 쓰였으면 건너뜀)
      if (k === "points" || k === "key_points") {
        const usedByCurve = series.some((s) => s.points.some(([x, y]) => x === p[0] && y === p[1]) && !s.source);
        if (usedByCurve && label === undefined) continue;
      }
      maybeMarker(p, label, k);
    }
  }
  // 선언된 특징(검증 전용)
  const pushNums = (key: string, kind: Feature["kind"]) => {
    const v = d[key]; if (v === undefined) return;
    const arr = Array.isArray(v) ? v : [v];
    for (const e of arr) { const n = num(e); if (n !== null && key.includes("x_int")) features.push({ kind, x: n, y: 0, source: key }); else { const p = ptFrom(e); if (p) features.push({ kind, x: p[0], y: p[1], source: key }); else if (n !== null && key.startsWith("intersections_")) features.push({ kind, x: n, source: key }); } }
    hidden.push(key);
  };
  pushNums("x_intercepts", "x_intercept"); pushNums("zero_crossing", "x_intercept"); pushNums("intersections", "intersection"); pushNums("intersection", "intersection"); pushNums("intersection_point", "intersection");
  pushNums("intersections_approx", "intersection"); pushNums("local_max", "extremum"); pushNums("local_min", "extremum");
  if (Array.isArray(d.intersections)) for (const e of d.intersections) if (isObj(e) && isNum(e.approx)) features.push({ kind: "intersection", x: e.approx, source: "intersections.approx" });
  if (Array.isArray(d.crossings)) hidden.push("crossings");

  // 4) 음영
  const shadeSrc = d.shaded_region ?? d.region ?? d.region_R;
  if (shadeSrc !== undefined) {
    used.add("shaded_region"); used.add("region"); used.add("region_R");
    const sh = parseShade(shadeSrc, series, xa);
    if (sh) shades.push(sh); else issues.push({ level: "warn", code: "shade_unparsed", message: "음영 영역 정의를 해석하지 못했습니다." });
  }
  const unusedKeys = Object.keys(d).filter((k) => !used.has(k) && !["intersections", "intersection", "intersection_point", "intersections_x", "intersections_approx", "x_intercepts", "zero_crossing", "local_max", "local_min", "labeled_points", "marked_points", "marked_point", "key_points", "dashed_lines", "vertical_segments", "lines", "crossings"].includes(k));
  if (unusedKeys.length) { hidden.push(...unusedKeys.map((k) => `unused:${k}`)); }
  void stim;
  const spec: ApGraphSpec = { type: "ap_graph", x: { label: xa.label, min: xa.min, max: xa.max, step: xa.step }, y: { label: ya.label, min: ya.min, max: ya.max, step: ya.step }, series, markers: markers.length ? markers : undefined, shades: shades.length ? shades : undefined, guides: guides.length ? guides : undefined };
  return { stimKind: "graph", spec, features, issues, hidden };
}

const shortNames = (label: string): string[] => {
  const out = new Set<string>();
  const l = label.trim(); if (l && l.length <= 12) out.add(l);
  for (const m of l.matchAll(/\b([A-Za-z])\s*\((?:x|t)\)/g)) out.add(m[1]);
  const lhs = l.match(/^([A-Za-z]{1,3})\s*=/); if (lhs && !/^[xyt]$/i.test(lhs[1])) out.add(lhs[1]);
  return [...out].filter((n) => !/^[xy]$/.test(n));
};
function parseShade(src: unknown, series: ApSeries[], xa: { min: number; max: number }): ApShade | null {
  const idxByName = (name: string): number | "axis" | null => {
    const n = name.trim().toLowerCase();
    if (/x-?axis|y\s*=\s*0|^0$/.test(n)) return "axis";
    for (let i = 0; i < series.length; i++) {
      const l = series[i].label.toLowerCase(); const s = (series[i].source ?? "").toLowerCase().replace(/\s+/g, "");
      const lname = l.replace(/[^a-z0-9']/g, ""); const nn = n.replace(/[^a-z0-9'^*+\-/().]/g, "");
      if (lname && (lname === nn.replace(/[^a-z0-9']/g, "") || l.split(/[\s=(]/)[0] === n)) return i;
      if (s && s.replace(/^[^=]*=/, "") === nn.replace(/\s+/g, "")) return i;
    }
    return null;
  };
  if (isObj(src)) {
    const between = Array.isArray(src.between) ? src.between.map(String) : [src.upper, src.lower].every((v) => typeof v === "string") ? [String(src.upper), String(src.lower)] : null;
    const xi = Array.isArray(src.x_interval) && src.x_interval.length === 2 ? [num(src.x_interval[0]), num(src.x_interval[1])] : null;
    if (between && xi && xi[0] !== null && xi[1] !== null) {
      const a = idxByName(between[0]), b = idxByName(between[1]);
      if (a !== null && b !== null) {
        const ya = a === "axis" ? 0 : series[a].points.reduce((s, p) => s + p[1], 0), yb = b === "axis" ? 0 : series[b].points.reduce((s, p) => s + p[1], 0);
        const [upper, lower] = ya >= yb ? [a, b] : [b, a];
        return { upper, lower, xMin: xi[0], xMax: xi[1] };
      }
    }
    if (typeof src.description === "string") return parseShade(src.description, series, xa);
    return null;
  }
  if (typeof src !== "string") return null;
  const s = src;
  const m = s.match(/(-?\d*\.?\d+)\s*(?:<=|≤)\s*(?:x|t)\s*(?:<=|≤)\s*(-?\d*\.?\d+(?:\.\d+)?)/) ?? s.match(/from\s+(?:x|t)\s*=\s*(-?\d*\.?\d+)\s+to\s+(?:x|t)\s*=\s*(-?\d*\.?\d+)/);
  let xMin: number | null = null, xMax: number | null = null;
  if (m) { xMin = Number(m[1]); xMax = Number(m[2]); }
  else {
    const sq = s.match(/-sqrt\s*\(?(\d+)\)?\s*<=\s*x\s*<=\s*sqrt\s*\(?(\d+)\)?/); if (sq) { xMin = -Math.sqrt(Number(sq[1])); xMax = Math.sqrt(Number(sq[2])); }
  }
  // 곡선 이름: 소문자/대문자 한 글자 라벨
  const names: (number | "axis")[] = [];
  if (/x-?axis|\by\s*=\s*0\b/i.test(s)) names.push("axis");
  for (let i = 0; i < series.length; i++) { if (shortNames(series[i].label).some((l) => new RegExp(`(^|[^A-Za-z])${l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Za-z]|$)`).test(s.replace(/\bR\b/, "")))) names.push(i); }
  const overY = /\by\s*(?:<=|≤)|(?:<=|≤)\s*y\b|0\s*<=\s*y/.test(s) && !/\bx\s*(?:<=|≤)|(?:<=|≤)\s*x\b/.test(s);
  if (overY) {
    const my = s.match(/(-?\d*\.?\d+)\s*(?:<=|≤)\s*y\s*(?:<=|≤)\s*(-?\d*\.?\d+)/);
    if (my && series.length >= 2) return { upper: 0, lower: 1, xMin: Number(my[1]), xMax: Number(my[2]), over: "y" };
  }
  if (series.length === 2 && /between the (?:two|line|curves)|two curves|between the line and/i.test(s) && names.length < 2 && xMin !== null && xMax !== null) names.splice(0, names.length, 0, 1);
  const uniq = [...new Set(names)];
  if (uniq.length === 1 && uniq[0] === "axis") { const fn = series.map((q, i) => ({ q, i })).filter(({ q }) => new Set(q.points.map((p) => p[0])).size > 1 && !/axis/i.test(q.label)); if (fn.length === 1) uniq.push(fn[0].i); }
  if (xMin === null || xMax === null) { if (uniq.length === 2) { xMin = Math.max(xa.min, 0); xMax = xa.max; } else return null; }
  if (uniq.length === 2) {
    const [a, b] = uniq as [number | "axis", number | "axis"];
    const mid = (xMin + xMax) / 2;
    const val = (k: number | "axis") => (k === "axis" ? 0 : interp(series[k].points, mid));
    const [upper, lower] = (val(a) ?? 0) >= (val(b) ?? 0) ? [a, b] : [b, a];
    return { upper, lower, xMin, xMax };
  }
  if (uniq.length === 1) return { upper: uniq[0], lower: "axis", xMin, xMax };
  if (/between curve and x-axis|under the curve/i.test(s) && series.length === 1) return { upper: 0, lower: "axis", xMin, xMax };
  return null;
}
function interp(points: Pt[], x: number): number | null {
  for (let i = 0; i < points.length - 1; i++) { const [x0, y0] = points[i], [x1, y1] = points[i + 1]; if (x >= Math.min(x0, x1) && x <= Math.max(x0, x1)) return x1 === x0 ? y0 : y0 + ((x - x0) / (x1 - x0)) * (y1 - y0); }
  return null;
}

// ── 보수형(payoff) 행렬 → 표 ──────────────────────────────────────────
function normalizePayoff(d: Json, stim: Json, issues: NormIssue[], features: Feature[], hidden: string[]): NormResult {
  const rows = Array.isArray(d.row_strategies) ? (d.row_strategies as unknown[]).map(String) : null;
  const colsRaw = d.col_strategies ?? d.column_strategies;
  const cols = Array.isArray(colsRaw) ? (colsRaw as unknown[]).map(String) : null;
  let pay = isObj(d.payoffs) ? d.payoffs : isObj(d.cells) ? d.cells : null;
  if (!pay && rows && cols && Array.isArray(d.payoffs) && (d.payoffs as unknown[]).length === rows.length) {
    // [행][열] = [a, b] 중첩 배열 → "행,열" 키 맵
    const m: Json = {}; let okShape = true;
    (d.payoffs as unknown[]).forEach((r, i) => { if (!Array.isArray(r) || r.length !== cols.length) { okShape = false; return; } r.forEach((cell, j) => { m[`${rows[i]},${cols[j]}`] = cell; }); });
    if (okShape) pay = m;
  }
  if (!rows || !cols || !pay) { issues.push({ level: "error", code: "payoff_shape", message: "payoff_matrix 의 row_strategies/col_strategies/payoffs 를 읽지 못했습니다." }); return { stimKind: "payoff_matrix", spec: null, features, issues, hidden }; }
  const find = (r: string, c: string): [number, number] | null => {
    for (const [k, v] of Object.entries(pay)) {
      const [a, b] = k.split(/[,|]/).map((t) => t.trim().toLowerCase());
      if (r.toLowerCase().startsWith(a) && c.toLowerCase().startsWith(b) && Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1])) return [v[0], v[1]];
    }
    return null;
  };
  const players = Array.isArray(d.players) ? (d.players as unknown[]).map((x) => String(x).replace(/\s*\((?:rows?|columns?)\)\s*/i, "").trim()) : [];
  const rp = String(d.row_player ?? players[0] ?? "Row"), cp = String(d.col_player ?? players[1] ?? "Column");
  const body: (string | number)[][] = [];
  for (const r of rows) {
    const line: (string | number)[] = [r];
    for (const c of cols) { const p = find(r, c); if (!p) { issues.push({ level: "error", code: "payoff_missing_cell", message: `보수 칸(${r}, ${c})이 없습니다.` }); return { stimKind: "payoff_matrix", spec: null, features, issues, hidden }; } line.push(`${p[0]}, ${p[1]}`); }
    body.push(line);
  }
  const unitStr = typeof d.units === "string" ? d.units : typeof d.payoffs_units === "string" ? d.payoffs_units : null;
  const notes = [unitStr ? `Payoffs (${rp}, ${cp}) in ${unitStr.replace(/,?\s*format.*$/i, "")}.` : `Payoffs listed as (${rp}, ${cp}).`, ...(typeof d.play === "string" ? [d.play] : []), ...(d.simultaneous === true && d.one_shot === true ? ["The firms choose simultaneously, once."] : [])];
  void stim;
  return { stimKind: "payoff_matrix", spec: { type: "ap_table", title: `Payoff matrix: ${rp} (rows) and ${cp} (columns)`, columns: [`${rp} \\ ${cp}`, ...cols], rows: body, notes }, features, issues, hidden };
}

// ── Bio 도식 3종 ─────────────────────────────────────────────────────
function normalizeDiagram(d: Json | null, stim: Json, ctx: StimCtx, issues: NormIssue[], features: Feature[], hidden: string[]): NormResult {
  void stim; void ctx;
  const fail = (code: string, message: string): NormResult => ({ stimKind: "diagram", spec: null, features, issues: [...issues, { level: "info", code, message }], hidden });
  if (!d) return fail("diagram_no_data", "도식 data 가 없습니다.");
  const strand = (s: unknown) => (isObj(s) && Array.isArray(s.bases) ? { label: String(s.label ?? s.type ?? ""), leftEnd: String(s.left_end ?? ""), rightEnd: String(s.right_end ?? ""), bases: (s.bases as unknown[]).map(String) } : null);
  if (isObj(d.top_strand) && isObj(d.bottom_strand)) {
    const top = strand(d.top_strand), bottom = strand(d.bottom_strand);
    if (!top || !bottom) return fail("diagram_strand", "가닥 정의를 읽지 못했습니다.");
    return { stimKind: "diagram", spec: { type: "ap_diagram", variant: "strand_pair", top, bottom, legend: typeof d.legend === "string" ? d.legend : undefined }, features, issues, hidden };
  }
  if (Array.isArray(d.templates) && Array.isArray(d.forks) && Array.isArray(d.new_strands)) {
    const t = d.templates as Json[]; const top = t.find((x) => x.y_position === "upper"), bot = t.find((x) => x.y_position === "lower");
    if (!top || !bot) return fail("diagram_templates", "템플릿 위치를 읽지 못했습니다.");
    const newStrands = (d.new_strands as Json[]).map((n) => ({ id: String(n.id), side: (String(n.paired_with).toLowerCase().startsWith("top") ? "top" : "bottom") as "top" | "bottom", region: (/left/i.test(String(n.region)) ? "left" : "right") as "left" | "right" }));
    const forks = (d.forks as Json[]).map((x) => ({ id: String(x.id), side: (/left/i.test(String(x.direction_of_movement)) ? "left" : "right") as "left" | "right" }));
    return { stimKind: "diagram", spec: { type: "ap_diagram", variant: "replication_bubble", title: typeof d.title === "string" ? d.title : undefined, topEnds: [String(top.left_end), String(top.right_end)], bottomEnds: [String(bot.left_end), String(bot.right_end)], newStrands, forks, originLabel: isObj(d.origin) ? String(d.origin.label ?? "Origin") : "Origin" }, features, issues, hidden };
  }
  if (Array.isArray(d.mRNA_5to3) && isObj(d.ribosome)) {
    const codons = (d.mRNA_5to3 as unknown[]).map(String); const r = d.ribosome as Json;
    const sites: { site: "E" | "P" | "A"; codonIndex: number; trna?: string }[] = [];
    for (const k of ["E", "P", "A"] as const) {
      const v = r[`${k}_site`]; if (v === undefined) continue;
      if (isObj(v) && typeof v.codon === "string") { const idx = codons.indexOf(v.codon); if (idx >= 0) sites.push({ site: k, codonIndex: idx, trna: isObj(v) && typeof v.tRNA_anticodon_3to5 === "string" ? `tRNA 3'-${v.tRNA_anticodon_3to5}-5'` : v.tRNA === "empty" ? undefined : undefined }); }
    }
    if (sites.length === 0) return fail("diagram_ribosome", "리보솜 자리를 읽지 못했습니다.");
    return { stimKind: "diagram", spec: { type: "ap_diagram", variant: "ribosome", codons, leftEnd: "5'", rightEnd: "3'", sites, codonTable: isObj(d.codon_table) ? (d.codon_table as Record<string, string>) : undefined }, features, issues, hidden };
  }
  return fail("diagram_unsupported", "그리지 않는 도식(본문이 모든 정보를 담음).");
}

const SUB: Record<string, string> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "-": "₋" };
const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
const conv = (t: string, m: Record<string, string>) => (/^[0-9-]+$/.test(t) ? [...t].map((c) => m[c]).join("") : null);
/** 표 칸의 간단한 LaTeX 를 유니코드로 바꾼다(그림 라벨은 KaTeX 를 거치지 않는다). 못 바꾼 제어문은 게이트가 잡는다. */
export function texToPlain(s: string): string {
  let t = s.replace(/\$/g, "");
  t = t.replace(/\\int\s*_\{?([^\s{}^]+)\}?\s*\^\{?([^\s{}]+)\}?/g, (_m, a: string, b: string) => `∫${conv(a, SUB) ?? `_(${a})`}${conv(b, SUP) ?? `^(${b})`}`);
  t = t.replace(/\\int/g, "∫").replace(/\\,|\\;|\\!/g, " ").replace(/\\cdot/g, "·").replace(/\\times/g, "×").replace(/\\pi/g, "π").replace(/\\infty/g, "∞").replace(/\\le(?:q)?\b/g, "≤").replace(/\\ge(?:q)?\b/g, "≥");
  t = t.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1)/($2)").replace(/\\sqrt\{([^{}]*)\}/g, "√($1)").replace(/\\(sin|cos|tan|ln|log|exp)\b/g, "$1").replace(/\\left|\\right/g, "");
  t = t.replace(/\^\{([^{}]*)\}/g, (_m, a: string) => conv(a, SUP) ?? `^(${a})`).replace(/\^([0-9])/g, (_m, a: string) => SUP[a]).replace(/_\{([^{}]*)\}/g, (_m, a: string) => conv(a, SUB) ?? `_(${a})`);
  return t.replace(/\s+/g, " ").trim();
}

// ── 일반 자료 패널(여러 표·조건·식) ─────────────────────────────────────
const SKIP_KEYS = /^(design|answer|key|solution|expected|verification|computed|hidden|curves_to_draw|key_points|intersections?|axes|graph_axes|firm_behavior|firm_type|model_assumptions_hidden)/i;
const pretty = (k: string) => { const t = k.replace(/_/g, " ").replace(/\s+/g, " ").trim(); return t.charAt(0).toUpperCase() + t.slice(1); };
const scalar = (v: unknown): v is string | number | boolean => typeof v === "string" || isNum(v) || typeof v === "boolean";
const cellOf = (v: unknown): string | number => (isNum(v) ? v : v === null || v === undefined ? "—" : texToPlain(String(v)));
const flat = (v: unknown): string => (scalar(v) ? String(v) : Array.isArray(v) ? v.map(flat).join(", ") : isObj(v) ? Object.entries(v).map(([k, x]) => `${k}: ${flat(x)}`).join("; ") : "");

/** 자료 객체 → 표들 + 조건 목록. 데이터를 버리지 않는다(게이트가 숫자 누락을 점검). */
export function genericPanel(d: Json, ctx: StimCtx): { spec: ApSpec | null; dropped: string[] } {
  const tables: ApTableSpec[] = []; const facts: (string | number)[][] = []; const notes: string[] = []; const dropped: string[] = [];
  // tableN_columns / tableN_rows / tableN_title 묶기
  const groups = new Map<string, Json>();
  const rest: [string, unknown][] = [];
  for (const [k, v] of Object.entries(d)) { const m = k.match(/^(.*?)_(columns|rows|title)$/); if (m && m[1] && /table/i.test(m[1])) { const g = groups.get(m[1]) ?? {}; g[m[2]] = v; groups.set(m[1], g); } else rest.push([k, v]); }
  for (const [k, g] of groups) rest.push([k, g]);
  let title: string | undefined;
  const tableFrom = (o: Json, name: string): ApTableSpec | null => {
    let cols: string[] | null = null; let rowsRaw: unknown[] | null = null;
    for (const ck of ["columns", "column_headers", "table_columns", "table_header", "header"]) if (Array.isArray(o[ck]) && (o[ck] as unknown[]).every((c) => typeof c === "string" || isNum(c))) { cols = (o[ck] as unknown[]).map((c) => (String(c).trim() === "" ? "–" : texToPlain(String(c)))); break; }
    for (const rk of ["rows", "table_rows", "data"]) if (Array.isArray(o[rk])) { rowsRaw = o[rk] as unknown[]; break; }
    if (!rowsRaw) return null;
    if (rowsRaw.every((r) => Array.isArray(r))) { const rr = rowsRaw as unknown[][]; if (!cols) cols = rr[0].map((_, i) => `Column ${i + 1}`); if (rr.some((r) => r.length !== cols!.length)) return null; return { type: "ap_table", title: typeof o.title === "string" ? texToPlain(o.title) : pretty(name), columns: cols, rows: rr.map((r) => r.map(cellOf)) }; }
    if (rowsRaw.every((r) => isObj(r))) { const ro = rowsRaw as Json[]; const keys = cols ?? Object.keys(ro[0]); return { type: "ap_table", title: typeof o.title === "string" ? texToPlain(o.title) : pretty(name), columns: keys.map(texToPlain), rows: ro.map((r) => keys.map((kk) => cellOf(r[kk]))) }; }
    return null;
  };
  const walk = (k: string, v: unknown, depth: number) => {
    if (SKIP_KEYS.test(k) || v === undefined) return;
    if (k === "title" && typeof v === "string") { title = texToPlain(v); return; }
    if (/^(notes?|setup|background|context|extra|assumptions|model_assumptions|business_context|game_note|gel_notes|description)$/i.test(k)) { notes.push(...toStr(v).map(texToPlain)); return; }
    if (scalar(v)) { facts.push([pretty(k), typeof v === "string" ? texToPlain(v) : String(v)]); return; }
    if (isObj(v)) {
      const t = tableFrom(v, k); if (t) { tables.push(t); return; }
      const vals = Object.values(v);
      if (vals.every(scalar)) { tables.push({ type: "ap_table", title: pretty(k), columns: ["Item", "Value"], rows: Object.entries(v).map(([a, b]) => [texToPlain(a), cellOf(b)]) }); return; }
      if (depth < 2) { for (const [kk, vv] of Object.entries(v)) walk(`${k} ${kk}`, vv, depth + 1); return; }
      facts.push([pretty(k), flat(v)]); return;
    }
    if (Array.isArray(v)) {
      if (v.length && v.every((r) => isObj(r) && Object.values(r as Json).every((x) => scalar(x) || x === null))) {
        const keys = [...new Set(v.flatMap((r) => Object.keys(r as Json)))];
        tables.push({ type: "ap_table", title: pretty(k), columns: keys, rows: (v as Json[]).map((r) => keys.map((kk) => cellOf(r[kk]))) }); return;
      }
      if (v.every(scalar)) { facts.push([pretty(k), v.join(", ")]); return; }
      facts.push([pretty(k), flat(v)]); return;
    }
    dropped.push(k);
  };
  for (const [k, v] of rest) walk(k, v, 0);
  const all: ApTableSpec[] = [];
  if (facts.length) all.push({ type: "ap_table", title: tables.length || title ? "Given information" : title ?? "Given information", columns: ["Item", "Value"], rows: facts });
  all.push(...tables);
  if (all.length === 0) return { spec: null, dropped };
  const setNotes = notes.length ? notes : undefined;
  void ctx;
  if (all.length === 1) return { spec: { ...all[0], title: title ?? all[0].title, notes: setNotes }, dropped };
  return { spec: { type: "ap_table_set", title, tables: all, notes: setNotes }, dropped };
}

function normalizeTable(d: Json, ctx: StimCtx, issues: NormIssue[], features: Feature[], hidden: string[]): NormResult {
  const trial: NormIssue[] = [];
  const single = normalizeSingleTable(d, ctx, trial, features, hidden);
  if (single.spec) { issues.push(...trial); return { ...single, issues }; }
  const g = genericPanel(d, ctx);
  if (g.spec) { issues.push({ level: "info", code: "table_generic_panel", message: `표 형식이 표준 형태가 아니라 자료 패널(표 ${g.spec.type === "ap_table_set" ? g.spec.tables.length : 1}개 + 조건 목록)로 그렸습니다.` }); return { stimKind: "table", spec: g.spec, features, issues, hidden }; }
  issues.push(...trial);
  return single;
}
