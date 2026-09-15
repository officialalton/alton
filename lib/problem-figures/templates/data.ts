// 표준 렌더링 엔진 — 템플릿 4: 표·데이터 그래프 (docs/2026-09-14-standard-rendering-engine-design.md 1-5)
//
// 하나의 원본 데이터(type 'data')에서 표·막대·선·히스토그램·산점도·상자그림·숫자 목록을 조판한다. AI 는 값·이름·단위만 낸다.
// 축 범위·눈금·막대 폭·범례·라벨 자리는 렌더러가 정하고, 라벨이 겹치거나 잘리면 검증 실패. 표는 접근성을 위해 <table> 로 조판한다.

import { dedupe, esc, f, FONT, labelWidth, Sheet, type FigureIssue, type Pt } from "./_layout";

export type DataKind = "table" | "two_way" | "number_list" | "bar" | "line" | "histogram" | "scatter" | "boxplot" | "dot_plot" | "statement";
export type Cell = string | number;

export type DataSpec = {
  type: "data";
  kind: DataKind;
  title?: string;
  /** table */
  columns?: string[];
  rows?: Cell[][];
  align?: ("l" | "c" | "r")[];
  /** number_list */
  values?: Cell[];
  label?: string;
  /** bar · line */
  categories?: string[];
  series?: { name?: string; values: number[] }[];
  xTitle?: string;
  yTitle?: string;
  yMin?: number;
  yMax?: number;
  yStep?: number;
  /** histogram */
  bins?: { from: number; to: number; count: number }[];
  /** scatter */
  points?: Pt[];
  fitLine?: { slope: number; intercept: number };
  /** boxplot */
  boxes?: { name: string; min: number; q1: number; median: number; q3: number; max: number }[];
  /** dot_plot — 값과 개수. 값은 정수·소수. */
  dots?: { value: number; count: number }[];
  /** two_way — 행·열 범주와 칸 값. 합계 행·열은 렌더러가 계산해 붙인다(totals !== false). */
  rowHeader?: string;
  rowLabels?: string[];
  colLabels?: string[];
  cells?: number[][];
  totals?: boolean;
  /** statement — 문장형 자료(표본 추정·오차범위·연구 설계). 값은 지문 참조 검증 대상. */
  facts?: { label: string; value: string | number; unit?: string }[];
  note?: string;
};

const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const isCell = (c: unknown): c is Cell => typeof c === "string" || isNum(c);
const isName = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0 && v.trim().length <= 40;
// HTML 로 그리는 이름(표 열·양방향표 라벨·문장형 라벨)은 줄바꿈되므로 길어도 된다 — 실제 시험 표 열 이름은 40자를 넘는다(2026-09-15).
const isText = (v: unknown, max: number): v is string => typeof v === "string" && v.trim().length > 0 && v.trim().length <= max;

/** AI 가 `{kind:'table', table:{columns,rows}}` 처럼 종류 이름 아래에 필드를 넣어 보내면 위로 올린다(같은 뜻, 다른 모양). */
export function normalizeDataInput(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const s = { ...(input as Record<string, unknown>) };
  const nested = s[String(s.kind)];
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    for (const [k, v] of Object.entries(nested as Record<string, unknown>)) if (s[k] === undefined) s[k] = v;
    delete s[String(s.kind)];
  }
  if (s.data && typeof s.data === "object" && !Array.isArray(s.data)) {
    for (const [k, v] of Object.entries(s.data as Record<string, unknown>)) if (s[k] === undefined) s[k] = v;
    delete s.data;
  }
  return s;
}

export function validateData(input: unknown): { ok: true; spec: DataSpec } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "그림 데이터가 객체가 아닙니다." };
  const s = normalizeDataInput(input) as Record<string, unknown>;
  if (s.type !== "data") return { ok: false, error: "type 이 data 가 아닙니다." };
  const kinds: DataKind[] = ["table", "two_way", "number_list", "bar", "line", "histogram", "scatter", "boxplot", "dot_plot", "statement"];
  if (!kinds.includes(s.kind as DataKind)) return { ok: false, error: `지원하지 않는 자료 유형: ${String(s.kind)} (table|two_way|number_list|bar|line|histogram|scatter|boxplot|dot_plot|statement)` };
  // 제목: 표·목록·문장형(HTML, 줄바꿈됨)은 90자, SVG 그래프는 70자까지(40자 넘으면 글자를 줄여 그린다). 실제 시험 표 제목은 40자를 넘는 경우가 흔하다(2026-09-15).
  if (s.title !== undefined && (typeof s.title !== "string" || s.title.trim().length === 0 || s.title.length > (["table", "two_way", "number_list", "statement"].includes(String(s.kind)) ? 90 : 70))) {
    return { ok: false, error: `title 은 ${["table", "two_way", "number_list", "statement"].includes(String(s.kind)) ? 90 : 70}자 이내 문자열입니다.` };
  }
  switch (s.kind) {
    case "table": {
      // 첫 열 이름은 비울 수 있다(2×2 표의 모서리 칸).
      if (!Array.isArray(s.columns) || s.columns.length < 2 || s.columns.length > 8 || !s.columns.every((c, i) => isText(c, 90) || (i === 0 && c === ""))) return { ok: false, error: "table 은 columns(2~8개, 각 90자 이내 이름) 가 필요합니다." };
      if (!Array.isArray(s.rows) || s.rows.length < 1 || s.rows.length > 20) return { ok: false, error: "table 은 rows(1~20행) 가 필요합니다." };
      for (const r of s.rows as unknown[]) if (!Array.isArray(r) || r.length !== (s.columns as unknown[]).length || !r.every(isCell)) return { ok: false, error: "table 의 각 행은 columns 와 같은 길이의 값 목록이어야 합니다." };
      if (new Set((s.columns as string[]).map((c) => c.trim().toLowerCase())).size !== (s.columns as string[]).length) return { ok: false, error: "table 의 열 이름이 중복됩니다." };
      break;
    }
    case "number_list":
      if (!Array.isArray(s.values) || s.values.length < 2 || s.values.length > 30 || !s.values.every(isCell)) return { ok: false, error: "number_list 는 values(2~30개) 가 필요합니다." };
      break;
    case "bar":
    case "line": {
      if (!Array.isArray(s.categories) || s.categories.length < 2 || s.categories.length > 12 || !s.categories.every(isName)) return { ok: false, error: `${s.kind} 는 categories(2~12개) 가 필요합니다.` };
      if (!Array.isArray(s.series) || s.series.length < 1 || s.series.length > 4) return { ok: false, error: `${s.kind} 는 series(1~4개) 가 필요합니다.` };
      for (const se of s.series as Record<string, unknown>[]) {
        if (!se || !Array.isArray(se.values) || se.values.length !== (s.categories as unknown[]).length || !se.values.every(isNum)) return { ok: false, error: "series[].values 는 categories 와 같은 개수의 숫자여야 합니다." };
        if (se.name !== undefined && !isText(se.name, 60)) return { ok: false, error: "series[].name 은 60자 이내 문자열입니다." };
      }
      if ((s.series as unknown[]).length > 1 && (s.series as Record<string, unknown>[]).some((se) => !se.name)) return { ok: false, error: "계열이 둘 이상이면 범례를 위해 모든 series 에 name 이 필요합니다." };
      if (new Set((s.categories as string[]).map((c) => c.trim().toLowerCase())).size !== (s.categories as string[]).length) return { ok: false, error: "categories 가 중복됩니다." };
      break;
    }
    case "histogram": {
      if (!Array.isArray(s.bins) || s.bins.length < 2 || s.bins.length > 12) return { ok: false, error: "histogram 은 bins(2~12개) 가 필요합니다." };
      let prev: number | null = null;
      for (const b of s.bins as Record<string, unknown>[]) {
        if (!b || !isNum(b.from) || !isNum(b.to) || !isNum(b.count) || b.from >= b.to || b.count < 0) return { ok: false, error: "bins[] 는 from < to, count ≥ 0 인 숫자여야 합니다." };
        if (prev !== null && Math.abs(b.from - prev) > 1e-9) return { ok: false, error: "histogram 의 구간은 빈틈·겹침 없이 이어져야 합니다(앞 구간의 to = 다음 from)." };
        prev = b.to;
      }
      break;
    }
    case "scatter": {
      if (!Array.isArray(s.points) || s.points.length < 3 || s.points.length > 60 || !s.points.every((p) => Array.isArray(p) && p.length === 2 && p.every(isNum))) return { ok: false, error: "scatter 는 points(3~60개 [x,y]) 가 필요합니다." };
      if (s.fitLine !== undefined) { const fl = s.fitLine as Record<string, unknown>; if (!fl || !isNum(fl.slope) || !isNum(fl.intercept)) return { ok: false, error: "fitLine 은 slope/intercept 가 필요합니다." }; }
      break;
    }
    case "dot_plot": {
      if (!Array.isArray(s.dots) || s.dots.length < 2 || s.dots.length > 20) return { ok: false, error: "dot_plot 은 dots(값·개수 2~20개) 가 필요합니다." };
      for (const d of s.dots as Record<string, unknown>[]) if (!d || !isNum(d.value) || !isNum(d.count) || d.count < 0 || d.count > 15 || !Number.isInteger(d.count)) return { ok: false, error: "dots[] 는 value(숫자)와 count(0~15 정수)가 필요합니다." };
      if (new Set((s.dots as { value: number }[]).map((d) => d.value)).size !== (s.dots as unknown[]).length) return { ok: false, error: "dot_plot 의 값이 중복됩니다." };
      break;
    }
    case "two_way": {
      if (!Array.isArray(s.rowLabels) || s.rowLabels.length < 2 || s.rowLabels.length > 6 || !s.rowLabels.every((x) => isText(x, 90))) return { ok: false, error: "two_way 는 rowLabels(2~6개) 가 필요합니다." };
      if (!Array.isArray(s.colLabels) || s.colLabels.length < 2 || s.colLabels.length > 6 || !s.colLabels.every((x) => isText(x, 90))) return { ok: false, error: "two_way 는 colLabels(2~6개) 가 필요합니다." };
      if (!Array.isArray(s.cells) || s.cells.length !== (s.rowLabels as unknown[]).length || !s.cells.every((r) => Array.isArray(r) && r.length === (s.colLabels as unknown[]).length && r.every((v) => isNum(v) && v >= 0))) return { ok: false, error: "two_way 의 cells 는 rowLabels × colLabels 크기의 0 이상 숫자 표여야 합니다." };
      if ((s.rowLabels as string[]).some((l) => /^total$/i.test(l)) || (s.colLabels as string[]).some((l) => /^total$/i.test(l))) return { ok: false, error: "two_way 의 합계(Total)는 넣지 않습니다 — 렌더러가 계산합니다." };
      break;
    }
    case "statement": {
      if (!Array.isArray(s.facts) || s.facts.length < 1 || s.facts.length > 8) return { ok: false, error: "statement 는 facts(1~8개) 가 필요합니다." };
      for (const fct of s.facts as Record<string, unknown>[]) if (!fct || !isText(fct.label, 90) || !isCell(fct.value) || (fct.unit !== undefined && !isText(fct.unit, 40))) return { ok: false, error: "facts[] 는 label 과 value(숫자 또는 짧은 글), 선택 unit 이 필요합니다." };
      if (s.note !== undefined && (typeof s.note !== "string" || s.note.length > 300)) return { ok: false, error: "statement.note 는 300자 이내입니다." };
      break;
    }
    case "boxplot": {
      if (!Array.isArray(s.boxes) || s.boxes.length < 1 || s.boxes.length > 4) return { ok: false, error: "boxplot 은 boxes(1~4개) 가 필요합니다." };
      for (const b of s.boxes as Record<string, unknown>[]) {
        if (!b || !isName(b.name) || ![b.min, b.q1, b.median, b.q3, b.max].every(isNum)) return { ok: false, error: "boxes[] 는 name 과 min, q1, median, q3, max 숫자가 필요합니다." };
        const v = [b.min, b.q1, b.median, b.q3, b.max] as number[];
        for (let i = 1; i < 5; i++) if (v[i] < v[i - 1]) return { ok: false, error: `상자그림 '${String(b.name)}' 의 값은 min ≤ q1 ≤ median ≤ q3 ≤ max 여야 합니다.` };
      }
      break;
    }
  }
  return { ok: true, spec: s as unknown as DataSpec };
}

function niceStep(range: number, target = 6): number {
  const raw = range / target;
  const pow = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const cands = [1, 2, 2.5, 5, 10].map((m) => m * pow);
  return cands.find((c) => c >= raw) ?? cands[cands.length - 1];
}
const fmtNum = (n: number) => (Math.abs(n) >= 1000 ? n.toLocaleString("en-US") : f(n));
const COLORS = ["#111", "#C8102E", "#1B6FB0", "#0f7b4a"];

/** 표 — <table> 시맨틱(접근성). 학생 화면·관리자 미리보기 공통 인라인 스타일. */
function renderTable(spec: DataSpec): { html: string; alt: string; issues: FigureIssue[] } {
  const cols = spec.columns!, rows = spec.rows!;
  const numericCol = cols.map((_, i) => rows.every((r) => isNum(r[i]) || /^-?[\d,]+(\.\d+)?%?$/.test(String(r[i]).trim())));
  const align = cols.map((_, i) => spec.align?.[i] ?? (numericCol[i] ? "r" : "l"));
  const alignCss = { l: "left", c: "center", r: "right" } as const;
  const cell = (c: Cell) => esc(isNum(c) ? fmtNum(c) : String(c));
  const th = cols.map((c, i) => `<th scope="col" style="text-align:${alignCss[align[i]]};padding:6px 12px;border-bottom:1.5px solid #111;font-weight:700;background:#f7f7f8;white-space:nowrap">${esc(c)}</th>`).join("");
  const body = rows.map((r) => `<tr>${r.map((c, i) => `<td style="text-align:${alignCss[align[i]]};padding:6px 12px;border-bottom:1px solid #ddd;white-space:nowrap">${cell(c)}</td>`).join("")}</tr>`).join("");
  const caption = spec.title ? `<caption style="caption-side:top;text-align:left;font-weight:700;padding:0 0 6px;font-family:${FONT}">${esc(spec.title)}</caption>` : "";
  const html = `<div class="figure-table" style="overflow-x:auto;max-width:100%"><table role="table" style="border-collapse:collapse;font-family:${FONT};font-size:14px;color:#111;min-width:200px;border-top:2px solid #111">${caption}<thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></div>`;
  const alt = `${spec.title ? spec.title + " — " : ""}표(${cols.length}열 ${rows.length}행). 열: ${cols.join(", ")}. ${rows.map((r) => r.map(cell).join(" / ")).join("; ")}.`;
  return { html, alt, issues: [] };
}

function renderNumberList(spec: DataSpec): { html: string; alt: string; issues: FigureIssue[] } {
  const vals = spec.values!.map((v) => (isNum(v) ? fmtNum(v) : String(v)));
  const html = `<div class="figure-number-list" style="font-family:${FONT};font-size:15px;color:#111;padding:8px 12px;border:1.5px solid #ddd;border-radius:8px;display:inline-block">${spec.title ? `<div style="font-weight:700;margin-bottom:4px">${esc(spec.title)}</div>` : ""}${spec.label ? `<span style="color:#555;margin-right:8px">${esc(spec.label)}:</span>` : ""}${vals.map(esc).join(",&nbsp; ")}</div>`;
  return { html, alt: `${spec.title ? spec.title + " — " : ""}숫자 목록: ${vals.join(", ")}.`, issues: [] };
}

type Frame = { x0: number; y0: number; x1: number; y1: number };

/** 세로축(값) — 범위·눈금·격자·숫자. */
function drawYAxis(sheet: Sheet, fr: Frame, min: number, max: number, step: number, title?: string) {
  const sy = (v: number) => fr.y1 - ((v - min) / (max - min)) * (fr.y1 - fr.y0);
  for (let v = min; v <= max + 1e-9; v += step) {
    const y = sy(v);
    sheet.raw(`<line x1="${f(fr.x0)}" y1="${f(y)}" x2="${f(fr.x1)}" y2="${f(y)}" stroke="#d1d5db" stroke-width="0.8"/>`);
    sheet.raw(`<text x="${f(fr.x0 - 6)}" y="${f(y + 4)}" font-family="${FONT}" font-size="12" text-anchor="end" fill="#111">${fmtNum(Math.round(v * 1e6) / 1e6)}</text>`);
  }
  sheet.raw(`<line x1="${f(fr.x0)}" y1="${f(fr.y0)}" x2="${f(fr.x0)}" y2="${f(fr.y1)}" stroke="#111" stroke-width="1.6"/>`);
  sheet.raw(`<line x1="${f(fr.x0)}" y1="${f(fr.y1)}" x2="${f(fr.x1)}" y2="${f(fr.y1)}" stroke="#111" stroke-width="1.6"/>`);
  sheet.registerSegment([fr.x0, fr.y0], [fr.x0, fr.y1]);
  sheet.registerSegment([fr.x0, fr.y1], [fr.x1, fr.y1]);
  if (title) sheet.raw(`<text transform="translate(14 ${f((fr.y0 + fr.y1) / 2)}) rotate(-90)" font-family="${FONT}" font-size="12.5" text-anchor="middle" fill="#111">${esc(title)}</text>`);
  return sy;
}

function yDomain(values: number[], spec: DataSpec): { min: number; max: number; step: number } {
  const lo = Math.min(0, ...values), hi = Math.max(0, ...values);
  const step = spec.yStep ?? niceStep((hi - lo) || 1);
  const min = spec.yMin ?? Math.floor(lo / step) * step;
  const max = spec.yMax ?? Math.ceil((hi + step * 0.0001) / step) * step + (hi === Math.ceil(hi / step) * step ? step : 0);
  return { min, max: max <= min ? min + step : max, step };
}

/** 가로 범주 라벨 — 칸 폭에 맞지 않으면 45° 기울인다(규칙). 기울여도 넘치면 문제로 기록. */
function drawCategoryLabels(sheet: Sheet, fr: Frame, categories: string[], issues: FigureIssue[]) {
  const slot = (fr.x1 - fr.x0) / categories.length;
  const widest = Math.max(...categories.map((c) => labelWidth(c, 12)));
  const rotate = widest > slot - 6;
  categories.forEach((c, i) => {
    const x = fr.x0 + slot * (i + 0.5);
    if (!rotate) sheet.label(x, fr.y1 + 14, c, `범주 라벨`, { size: 12 });
    else {
      sheet.raw(`<text transform="translate(${f(x)} ${f(fr.y1 + 8)}) rotate(-40)" font-family="${FONT}" font-size="11.5" text-anchor="end" fill="#111">${esc(c)}</text>`);
      if (labelWidth(c, 11.5) > 96) issues.push({ code: "label_collision", message: `범주 이름 '${c}' 가 너무 길어 축 아래에 놓을 수 없습니다 — 짧게 줄이세요.` });
    }
  });
  return { slot, rotate };
}

function drawLegend(sheet: Sheet, names: string[], x0: number, y: number) {
  let x = x0;
  names.forEach((n, i) => {
    sheet.raw(`<rect x="${f(x)}" y="${f(y - 6)}" width="12" height="12" fill="${COLORS[i % COLORS.length]}"/>`);
    sheet.text(x + 18 + labelWidth(n, 12) / 2 - 3, y, n, { size: 12, anchor: "middle" });
    x += 18 + labelWidth(n, 12) + 14;
  });
  return x;
}

function renderBarOrLine(spec: DataSpec): { svg: string; alt: string; issues: FigureIssue[] } {
  const W = 440, cats = spec.categories!, series = spec.series!;
  const legend = series.length > 1;
  const widest = Math.max(...cats.map((c) => labelWidth(c, 12)));
  const rotate = widest > (W - 110) / cats.length - 6;
  const H = 300 + (rotate ? 40 : 0) + (legend ? 22 : 0) + (spec.xTitle ? 16 : 0) + (spec.title ? 22 : 0);
  const sheet = new Sheet(W, H);
  const issues: FigureIssue[] = [];
  const top = 20 + (spec.title ? 22 : 0) + (legend ? 22 : 0);
  const fr: Frame = { x0: 64 + (spec.yTitle ? 14 : 0), y0: top, x1: W - 24, y1: H - 40 - (rotate ? 40 : 0) - (spec.xTitle ? 16 : 0) };
  if (spec.title) sheet.text(W / 2, 14, spec.title, { size: spec.title.length > 40 ? 11 : 14, anchor: "middle" });
  if (legend) drawLegend(sheet, series.map((s) => s.name!), fr.x0, top - 12);
  const allValues = series.flatMap((s) => s.values);
  const dom = yDomain(allValues, spec);
  if (allValues.some((v) => v < dom.min || v > dom.max)) issues.push({ code: "out_of_range", message: `값이 세로축 범위(${dom.min}~${dom.max}) 밖에 있습니다 — yMin/yMax 를 고치세요.` });
  const sy = drawYAxis(sheet, fr, dom.min, dom.max, dom.step, spec.yTitle);
  const { slot } = drawCategoryLabels(sheet, fr, cats, issues);
  if (spec.xTitle) sheet.raw(`<text x="${f((fr.x0 + fr.x1) / 2)}" y="${f(H - 8)}" font-family="${FONT}" font-size="12.5" text-anchor="middle" fill="#111">${esc(spec.xTitle)}</text>`);
  if (spec.kind === "bar") {
    const groupW = slot * 0.7, barW = groupW / series.length;
    cats.forEach((_, i) => {
      series.forEach((s, k) => {
        const v = s.values[i];
        const x = fr.x0 + slot * i + (slot - groupW) / 2 + barW * k;
        const y = sy(Math.max(v, dom.min)), y0 = sy(Math.max(Math.min(0, dom.max), dom.min));
        sheet.raw(`<rect x="${f(x)}" y="${f(Math.min(y, y0))}" width="${f(barW - 2)}" height="${f(Math.abs(y0 - y))}" fill="${COLORS[k % COLORS.length]}"/>`);
        sheet.registerSegment([x, Math.min(y, y0)], [x + barW - 2, Math.min(y, y0)]);
      });
    });
  } else {
    series.forEach((s, k) => {
      const pts: Pt[] = s.values.map((v, i) => [fr.x0 + slot * (i + 0.5), sy(v)]);
      sheet.polyline(pts, { color: COLORS[k % COLORS.length], w: 2 });
      for (const p of pts) sheet.raw(`<circle cx="${f(p[0])}" cy="${f(p[1])}" r="3.5" fill="${COLORS[k % COLORS.length]}"/>`);
    });
  }
  const alt = `${spec.title ? spec.title + " — " : ""}${spec.kind === "bar" ? "막대그래프" : "선그래프"}${spec.xTitle ? `, 가로축 ${spec.xTitle}` : ""}${spec.yTitle ? `, 세로축 ${spec.yTitle}` : ""}. ` +
    series.map((s) => `${s.name ? s.name + ": " : ""}${cats.map((c, i) => `${c} ${fmtNum(s.values[i])}`).join(", ")}`).join("; ") + ".";
  return { svg: sheet.svg(alt), alt, issues: dedupe([...issues, ...sheet.uniqueIssues()]) };
}

function renderHistogram(spec: DataSpec): { svg: string; alt: string; issues: FigureIssue[] } {
  const W = 440, bins = spec.bins!;
  const H = 300 + (spec.xTitle ? 16 : 0) + (spec.title ? 22 : 0);
  const sheet = new Sheet(W, H);
  const issues: FigureIssue[] = [];
  const fr: Frame = { x0: 64 + (spec.yTitle ? 14 : 0), y0: 20 + (spec.title ? 22 : 0), x1: W - 24, y1: H - 40 - (spec.xTitle ? 16 : 0) };
  if (spec.title) sheet.text(W / 2, 14, spec.title, { size: spec.title.length > 40 ? 11 : 14, anchor: "middle" });
  const dom = yDomain(bins.map((b) => b.count), spec);
  const sy = drawYAxis(sheet, fr, dom.min, dom.max, dom.step, spec.yTitle ?? "Frequency");
  const lo = bins[0].from, hi = bins[bins.length - 1].to;
  const sx = (v: number) => fr.x0 + ((v - lo) / (hi - lo)) * (fr.x1 - fr.x0);
  bins.forEach((b) => {
    const x = sx(b.from), w = sx(b.to) - x;
    sheet.raw(`<rect x="${f(x)}" y="${f(sy(b.count))}" width="${f(w)}" height="${f(fr.y1 - sy(b.count))}" fill="#1B6FB0" stroke="#fff" stroke-width="1"/>`);
    sheet.registerSegment([x, sy(b.count)], [x + w, sy(b.count)]);
  });
  const edges = [lo, ...bins.map((b) => b.to)];
  const slotW = (fr.x1 - fr.x0) / bins.length;
  const every = labelWidth(fmtNum(hi), 12) > slotW - 4 ? 2 : 1;
  edges.forEach((e, i) => { if (i % every === 0 || i === edges.length - 1) sheet.label(sx(e), fr.y1 + 14, fmtNum(e), "구간 경계", { size: 12 }); });
  if (spec.xTitle) sheet.raw(`<text x="${f((fr.x0 + fr.x1) / 2)}" y="${f(H - 8)}" font-family="${FONT}" font-size="12.5" text-anchor="middle" fill="#111">${esc(spec.xTitle)}</text>`);
  const alt = `${spec.title ? spec.title + " — " : ""}히스토그램${spec.xTitle ? `, 가로축 ${spec.xTitle}` : ""}. ${bins.map((b) => `${fmtNum(b.from)}~${fmtNum(b.to)}: ${fmtNum(b.count)}`).join(", ")}.`;
  return { svg: sheet.svg(alt), alt, issues: dedupe([...issues, ...sheet.uniqueIssues()]) };
}

function renderScatter(spec: DataSpec): { svg: string; alt: string; issues: FigureIssue[] } {
  const W = 440, pts = spec.points!;
  const H = 320 + (spec.xTitle ? 16 : 0) + (spec.title ? 22 : 0);
  const sheet = new Sheet(W, H);
  const issues: FigureIssue[] = [];
  const fr: Frame = { x0: 64 + (spec.yTitle ? 14 : 0), y0: 20 + (spec.title ? 22 : 0), x1: W - 24, y1: H - 40 - (spec.xTitle ? 16 : 0) };
  if (spec.title) sheet.text(W / 2, 14, spec.title, { size: spec.title.length > 40 ? 11 : 14, anchor: "middle" });
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const xStep = niceStep((Math.max(...xs) - Math.min(0, ...xs)) || 1), xMin = Math.floor(Math.min(0, ...xs) / xStep) * xStep, xMax = Math.ceil(Math.max(...xs) / xStep) * xStep + (Math.max(...xs) % xStep === 0 ? xStep : 0);
  const dom = yDomain(ys, spec);
  const sy = drawYAxis(sheet, fr, dom.min, dom.max, dom.step, spec.yTitle);
  const sx = (v: number) => fr.x0 + ((v - xMin) / (xMax - xMin)) * (fr.x1 - fr.x0);
  for (let v = xMin; v <= xMax + 1e-9; v += xStep) {
    sheet.raw(`<line x1="${f(sx(v))}" y1="${f(fr.y0)}" x2="${f(sx(v))}" y2="${f(fr.y1)}" stroke="#d1d5db" stroke-width="0.8"/>`);
    sheet.raw(`<text x="${f(sx(v))}" y="${f(fr.y1 + 15)}" font-family="${FONT}" font-size="12" text-anchor="middle" fill="#111">${fmtNum(Math.round(v * 1e6) / 1e6)}</text>`);
  }
  for (const [x, y] of pts) sheet.raw(`<circle cx="${f(sx(x))}" cy="${f(sy(y))}" r="3.5" fill="#111"/>`);
  if (spec.fitLine) {
    const { slope: m, intercept: b } = spec.fitLine;
    const cands: Pt[] = [[xMin, m * xMin + b], [xMax, m * xMax + b]];
    if (Math.abs(m) > 1e-12) cands.push([(dom.min - b) / m, dom.min], [(dom.max - b) / m, dom.max]);
    const inside = cands.filter(([x, y]) => x >= xMin - 1e-9 && x <= xMax + 1e-9 && y >= dom.min - 1e-9 && y <= dom.max + 1e-9).sort((p, q) => p[0] - q[0]);
    if (inside.length >= 2) sheet.polyline([[sx(inside[0][0]), sy(inside[0][1])], [sx(inside[inside.length - 1][0]), sy(inside[inside.length - 1][1])]], { color: "#C8102E", w: 1.8 });
    else issues.push({ code: "out_of_range", message: "추세선이 그래프 범위 안에 보이지 않습니다 — slope/intercept 를 확인하세요." });
  }
  if (spec.xTitle) sheet.raw(`<text x="${f((fr.x0 + fr.x1) / 2)}" y="${f(H - 8)}" font-family="${FONT}" font-size="12.5" text-anchor="middle" fill="#111">${esc(spec.xTitle)}</text>`);
  const alt = `${spec.title ? spec.title + " — " : ""}산점도(점 ${pts.length}개)${spec.xTitle ? `, 가로축 ${spec.xTitle}` : ""}${spec.yTitle ? `, 세로축 ${spec.yTitle}` : ""}${spec.fitLine ? `, 추세선 y = ${f(spec.fitLine.slope)}x + ${f(spec.fitLine.intercept)}` : ""}.`;
  return { svg: sheet.svg(alt), alt, issues: dedupe([...issues, ...sheet.uniqueIssues()]) };
}

function renderBoxplot(spec: DataSpec): { svg: string; alt: string; issues: FigureIssue[] } {
  const W = 440, boxes = spec.boxes!;
  const rowH = 54;
  const H = 70 + boxes.length * rowH + (spec.title ? 22 : 0) + (spec.xTitle ? 16 : 0);
  const sheet = new Sheet(W, H);
  const issues: FigureIssue[] = [];
  const nameW = Math.max(...boxes.map((b) => labelWidth(b.name, 12))) + 12;
  const fr: Frame = { x0: 24 + nameW, y0: 16 + (spec.title ? 22 : 0), x1: W - 24, y1: H - 36 - (spec.xTitle ? 16 : 0) };
  if (spec.title) sheet.text(W / 2, 14, spec.title, { size: spec.title.length > 40 ? 11 : 14, anchor: "middle" });
  const lo = Math.min(...boxes.map((b) => b.min)), hi = Math.max(...boxes.map((b) => b.max));
  const step = niceStep((hi - lo) || 1, 8), min = Math.floor(lo / step) * step, max = Math.ceil(hi / step) * step + (hi === Math.ceil(hi / step) * step ? 0 : 0);
  const sx = (v: number) => fr.x0 + ((v - min) / ((max - min) || 1)) * (fr.x1 - fr.x0);
  for (let v = min; v <= max + 1e-9; v += step) {
    sheet.raw(`<line x1="${f(sx(v))}" y1="${f(fr.y0)}" x2="${f(sx(v))}" y2="${f(fr.y1)}" stroke="#e5e7eb" stroke-width="0.8"/>`);
    sheet.raw(`<text x="${f(sx(v))}" y="${f(fr.y1 + 15)}" font-family="${FONT}" font-size="12" text-anchor="middle" fill="#111">${fmtNum(Math.round(v * 1e6) / 1e6)}</text>`);
  }
  sheet.raw(`<line x1="${f(fr.x0)}" y1="${f(fr.y1)}" x2="${f(fr.x1)}" y2="${f(fr.y1)}" stroke="#111" stroke-width="1.6"/>`);
  boxes.forEach((b, i) => {
    const cy = fr.y0 + rowH * (i + 0.5), h = 22;
    sheet.text(fr.x0 - 10, cy, b.name, { size: 12, anchor: "end" });
    sheet.raw(`<line x1="${f(sx(b.min))}" y1="${f(cy)}" x2="${f(sx(b.q1))}" y2="${f(cy)}" stroke="#111" stroke-width="1.6"/>`);
    sheet.raw(`<line x1="${f(sx(b.q3))}" y1="${f(cy)}" x2="${f(sx(b.max))}" y2="${f(cy)}" stroke="#111" stroke-width="1.6"/>`);
    for (const v of [b.min, b.max]) sheet.raw(`<line x1="${f(sx(v))}" y1="${f(cy - h / 3)}" x2="${f(sx(v))}" y2="${f(cy + h / 3)}" stroke="#111" stroke-width="1.6"/>`);
    sheet.raw(`<rect x="${f(sx(b.q1))}" y="${f(cy - h / 2)}" width="${f(Math.max(1, sx(b.q3) - sx(b.q1)))}" height="${h}" fill="#fff" stroke="#111" stroke-width="1.6"/>`);
    sheet.raw(`<line x1="${f(sx(b.median))}" y1="${f(cy - h / 2)}" x2="${f(sx(b.median))}" y2="${f(cy + h / 2)}" stroke="#111" stroke-width="2.2"/>`);
  });
  if (spec.xTitle) sheet.raw(`<text x="${f((fr.x0 + fr.x1) / 2)}" y="${f(H - 8)}" font-family="${FONT}" font-size="12.5" text-anchor="middle" fill="#111">${esc(spec.xTitle)}</text>`);
  const alt = `${spec.title ? spec.title + " — " : ""}상자그림. ${boxes.map((b) => `${b.name}: 최소 ${fmtNum(b.min)}, Q1 ${fmtNum(b.q1)}, 중앙값 ${fmtNum(b.median)}, Q3 ${fmtNum(b.q3)}, 최대 ${fmtNum(b.max)}`).join("; ")}.`;
  return { svg: sheet.svg(alt), alt, issues: dedupe([...issues, ...sheet.uniqueIssues()]) };
}

/** 양방향 표 — 합계 행·열을 렌더러가 계산해 붙인다(조건부확률 문항의 표준 모양). */
function renderTwoWay(spec: DataSpec): { html: string; alt: string; issues: FigureIssue[] } {
  const rows = spec.rowLabels!, cols = spec.colLabels!, cells = spec.cells!;
  const totals = spec.totals !== false;
  const rowSums = cells.map((r) => r.reduce((a, b) => a + b, 0));
  const colSums = cols.map((_, j) => cells.reduce((a, r) => a + r[j], 0));
  const grand = rowSums.reduce((a, b) => a + b, 0);
  const td = (v: number | string, bold = false) => `<td style="text-align:${typeof v === "number" ? "right" : "left"};padding:6px 12px;border-bottom:1px solid #ddd;white-space:nowrap${bold ? ";font-weight:700;background:#f7f7f8" : ""}">${esc(typeof v === "number" ? fmtNum(v) : v)}</td>`;
  const th = (v: string) => `<th scope="col" style="text-align:right;padding:6px 12px;border-bottom:1.5px solid #111;font-weight:700;background:#f7f7f8;white-space:nowrap">${esc(v)}</th>`;
  const head = `<tr><th scope="col" style="text-align:left;padding:6px 12px;border-bottom:1.5px solid #111;background:#f7f7f8">${esc(spec.rowHeader ?? "")}</th>${cols.map(th).join("")}${totals ? th("Total") : ""}</tr>`;
  const body = rows.map((r, i) => `<tr><th scope="row" style="text-align:left;padding:6px 12px;border-bottom:1px solid #ddd;font-weight:700;white-space:nowrap">${esc(r)}</th>${cells[i].map((v) => td(v)).join("")}${totals ? td(rowSums[i], true) : ""}</tr>`).join("");
  const foot = totals ? `<tr><th scope="row" style="text-align:left;padding:6px 12px;font-weight:700;background:#f7f7f8">Total</th>${colSums.map((v) => td(v, true)).join("")}${td(grand, true)}</tr>` : "";
  const caption = spec.title ? `<caption style="caption-side:top;text-align:left;font-weight:700;padding:0 0 6px;font-family:${FONT}">${esc(spec.title)}</caption>` : "";
  const html = `<div class="figure-table" style="overflow-x:auto;max-width:100%"><table role="table" style="border-collapse:collapse;font-family:${FONT};font-size:14px;color:#111;min-width:240px;border-top:2px solid #111">${caption}<thead>${head}</thead><tbody>${body}${foot}</tbody></table></div>`;
  const alt = `${spec.title ? spec.title + " — " : ""}양방향 표(${rows.length}행 × ${cols.length}열${totals ? ", 합계 포함" : ""}). ${rows.map((r, i) => `${r}: ${cols.map((c, j) => `${c} ${fmtNum(cells[i][j])}`).join(", ")}${totals ? `, 합계 ${fmtNum(rowSums[i])}` : ""}`).join("; ")}${totals ? `; 전체 ${fmtNum(grand)}` : ""}.`;
  return { html, alt, issues: [] };
}

/** 점도표 — 값마다 세로로 점을 쌓는다. */
function renderDotPlot(spec: DataSpec): { svg: string; alt: string; issues: FigureIssue[] } {
  const dots = [...spec.dots!].sort((a, b) => a.value - b.value);
  const W = 440, maxCount = Math.max(1, ...dots.map((d) => d.count));
  const H = 60 + maxCount * 16 + (spec.title ? 22 : 0) + (spec.xTitle ? 16 : 0);
  const sheet = new Sheet(W, H);
  const issues: FigureIssue[] = [];
  const fr: Frame = { x0: 40, y0: 16 + (spec.title ? 22 : 0), x1: W - 40, y1: H - 36 - (spec.xTitle ? 16 : 0) };
  if (spec.title) sheet.text(W / 2, 14, spec.title, { size: spec.title.length > 40 ? 11 : 14, anchor: "middle" });
  const vals = dots.map((d) => d.value);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const step = niceStep((hi - lo) || 1, 10);
  const min = Math.floor(lo / step) * step, max = Math.ceil(hi / step) * step;
  const sx = (v: number) => fr.x0 + ((v - min) / ((max - min) || 1)) * (fr.x1 - fr.x0);
  sheet.raw(`<line x1="${f(fr.x0)}" y1="${f(fr.y1)}" x2="${f(fr.x1)}" y2="${f(fr.y1)}" stroke="#111" stroke-width="1.6"/>`);
  const ticks: number[] = [];
  for (let v = min; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  const every = labelWidth(fmtNum(max), 12) > (fr.x1 - fr.x0) / ticks.length - 4 ? 2 : 1;
  ticks.forEach((v, i) => {
    sheet.raw(`<line x1="${f(sx(v))}" y1="${f(fr.y1)}" x2="${f(sx(v))}" y2="${f(fr.y1 + 5)}" stroke="#111" stroke-width="1.2"/>`);
    if (i % every === 0) sheet.raw(`<text x="${f(sx(v))}" y="${f(fr.y1 + 17)}" font-family="${FONT}" font-size="12" text-anchor="middle" fill="#111">${fmtNum(v)}</text>`);
  });
  const slot = (fr.x1 - fr.x0) / Math.max(1, (max - min) / step);
  const r = Math.min(6, slot / 3);
  for (const d of dots) for (let k = 0; k < d.count; k++) sheet.raw(`<circle cx="${f(sx(d.value))}" cy="${f(fr.y1 - 8 - k * (r * 2 + 3))}" r="${f(r)}" fill="#111"/>`);
  if (dots.some((d) => Math.abs(d.value - Math.round(d.value / step) * step) > 1e-9 && slot < 14)) issues.push({ code: "label_collision", message: "점도표의 값이 너무 촘촘합니다 — 눈금 간격에 맞는 값을 쓰거나 값 수를 줄이세요." });
  if (spec.xTitle) sheet.raw(`<text x="${f((fr.x0 + fr.x1) / 2)}" y="${f(H - 8)}" font-family="${FONT}" font-size="12.5" text-anchor="middle" fill="#111">${esc(spec.xTitle)}</text>`);
  const alt = `${spec.title ? spec.title + " — " : ""}점도표${spec.xTitle ? `(${spec.xTitle})` : ""}. ${dots.map((d) => `${fmtNum(d.value)}: ${d.count}개`).join(", ")}.`;
  return { svg: sheet.svg(alt), alt, issues: dedupe([...issues, ...sheet.uniqueIssues()]) };
}

/** 문장형 자료 블록 — 표본 추정·오차범위·연구 설계의 값을 구조화해 보여준다(값은 지문 참조 검증 대상). */
function renderStatement(spec: DataSpec): { html: string; alt: string; issues: FigureIssue[] } {
  const facts = spec.facts!;
  const row = (fct: { label: string; value: string | number; unit?: string }) =>
    `<div style="display:flex;justify-content:space-between;gap:16px;padding:5px 0;border-bottom:1px solid #eee"><span style="color:#444">${esc(fct.label)}</span><span style="font-weight:700;white-space:nowrap">${esc(typeof fct.value === "number" ? fmtNum(fct.value) : String(fct.value))}${fct.unit ? ` ${esc(fct.unit)}` : ""}</span></div>`;
  const html = `<div class="figure-statement" style="font-family:${FONT};font-size:14px;color:#111;border:1.5px solid #ddd;border-radius:10px;padding:10px 14px;max-width:520px">${spec.title ? `<div style="font-weight:700;margin-bottom:6px">${esc(spec.title)}</div>` : ""}${facts.map(row).join("")}${spec.note ? `<div style="font-size:12.5px;color:#555;margin-top:8px">${esc(spec.note)}</div>` : ""}</div>`;
  const alt = `${spec.title ? spec.title + " — " : ""}자료: ${facts.map((fct) => `${fct.label} ${typeof fct.value === "number" ? fmtNum(fct.value) : fct.value}${fct.unit ? " " + fct.unit : ""}`).join(", ")}${spec.note ? `. ${spec.note}` : ""}.`;
  return { html, alt, issues: [] };
}

/** 렌더 — 표·숫자 목록은 HTML, 그래프는 SVG 문자열. 둘 다 우리가 만든 마크업이라 그대로 넣는다. */
export function renderData(spec: DataSpec): { markup: string; alt: string; issues: FigureIssue[] } {
  switch (spec.kind) {
    case "table": { const r = renderTable(spec); return { markup: r.html, alt: r.alt, issues: r.issues }; }
    case "number_list": { const r = renderNumberList(spec); return { markup: r.html, alt: r.alt, issues: r.issues }; }
    case "bar":
    case "line": { const r = renderBarOrLine(spec); return { markup: r.svg, alt: r.alt, issues: r.issues }; }
    case "histogram": { const r = renderHistogram(spec); return { markup: r.svg, alt: r.alt, issues: r.issues }; }
    case "scatter": { const r = renderScatter(spec); return { markup: r.svg, alt: r.alt, issues: r.issues }; }
    case "boxplot": { const r = renderBoxplot(spec); return { markup: r.svg, alt: r.alt, issues: r.issues }; }
    case "two_way": { const r = renderTwoWay(spec); return { markup: r.html, alt: r.alt, issues: r.issues }; }
    case "dot_plot": { const r = renderDotPlot(spec); return { markup: r.svg, alt: r.alt, issues: r.issues }; }
    case "statement": { const r = renderStatement(spec); return { markup: r.html, alt: r.alt, issues: r.issues }; }
  }
}

/**
 * 지문 참조 검사 — 지문이 부르는 표 항목·범주·계열·상자 이름이 데이터에 있어야 하고, "범주 + 열/계열 이름 + 숫자" 가 한 절에
 * 같이 나오면 그 숫자는 데이터의 그 값과 같아야 한다. 단위 언급(dollars 등)은 축 제목·열 이름 어딘가에 있어야 한다.
 */
export function lintDataAgainstText(spec: DataSpec, passage: string): FigureIssue[] {
  const issues: FigureIssue[] = [];
  const text = passage.replace(/\$/g, "").replace(/−/g, "-");
  const names = new Set<string>();
  const add = (v?: string) => { if (v) names.add(v.trim().toLowerCase()); };
  spec.columns?.forEach(add); spec.categories?.forEach(add); spec.series?.forEach((s) => add(s.name)); spec.boxes?.forEach((b) => add(b.name)); add(spec.title); add(spec.xTitle); add(spec.yTitle);
  spec.rows?.forEach((r) => { if (typeof r[0] === "string") add(r[0]); });
  spec.rowLabels?.forEach(add); spec.colLabels?.forEach(add); add(spec.rowHeader); spec.facts?.forEach((fct) => add(fct.label));
  if (spec.kind === "two_way") add("total");
  // 따옴표로 부른 이름은 데이터 어딘가에 있어야 한다.
  for (const m of text.matchAll(/["“]([^"”]{1,40})["”]/g)) {
    const q = m[1].trim().toLowerCase();
    if (!Array.from(names).some((n) => n === q || n.includes(q) || q.includes(n))) issues.push({ code: "ref_missing", message: `지문의 "${m[1]}" 가 표·그래프의 항목(열·범주·계열·제목)에 없습니다.` });
  }
  // "the X column/row/bar/group"
  for (const m of text.matchAll(/\bthe\s+([A-Za-z0-9][A-Za-z0-9 ]{0,24}?)\s+(column|row|bar|group|category|series|class|box)\b/gi)) {
    const q = m[1].trim().toLowerCase();
    if (!Array.from(names).some((n) => n === q || n.includes(q))) issues.push({ code: "ref_missing", message: `지문의 '${m[1]} ${m[2]}' 에 해당하는 항목이 데이터에 없습니다.` });
  }
  // 값 일치: 절(clause) 안에 [행 이름 + 열 이름 + 숫자] 또는 [범주 + 계열 이름 + 숫자]
  const clauses = text.split(/[.;?!](?=\s|$)|\n/);
  const num = (t: string) => Number(t.replace(/,/g, ""));
  /** 절 안의 숫자(천 단위 쉼표 포함). "10th" 같은 서수와 "…%" 는 데이터 값이 아니라 뺀다. */
  const numbersIn = (cl: string): number[] =>
    Array.from(cl.matchAll(/(?<![\w.])(-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?)(?![\dA-Za-z])(\s*%)?/g))
      .filter((m) => !m[2])
      .map((m) => num(m[1]));
  const escapeRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  /** 행/범주 이름이 절에 나오는가 — 짧은 이름('1', 'A')은 첫 열 이름과 붙어 나올 때만("Shift 4"). */
  const nameInClause = (cl: string, name: string, prefix?: string): boolean => {
    const n = name.trim();
    if (!n) return false;
    if (n.length <= 3 && prefix && prefix.trim()) return new RegExp(`\\b${escapeRe(prefix.trim())}\\s+${escapeRe(n)}\\b`, "i").test(cl);
    // 세 글자 알파벳 이름(Mar, Jan)은 그 말로 시작하는 낱말(March)도 같은 것으로 본다. 그보다 짧거나 숫자면 정확히 그 토큰만.
    if (n.length === 3 && /^[A-Za-z]+$/.test(n)) return new RegExp(`\\b${escapeRe(n)}[a-z]*\\b`, "i").test(cl);
    if (n.length <= 3) return new RegExp(`(?<![A-Za-z0-9])${escapeRe(n)}(?![A-Za-z0-9])`).test(cl);
    return new RegExp(`\\b${escapeRe(n)}`, "i").test(cl);
  };
  if (spec.kind === "table" && spec.columns && spec.rows) {
    const cols = spec.columns.map((c) => c.toLowerCase());
    for (const cl of clauses) {
      const low = cl.toLowerCase();
      const rowIdx = spec.rows.findIndex((r) => nameInClause(cl, String(r[0]), spec.columns![0]));
      if (rowIdx < 0) continue;
      // 열은 절에 나온 낱말이 가장 많이 겹치는 것 하나 — 비기면(둘 다 'bottles') 판단하지 않는다.
      const scores = cols.map((c, i) => (i === 0 ? -1 : c.split(/\s+/).filter((w) => w.length > 3 && new RegExp(`\\b${escapeRe(w)}`, "i").test(low)).length));
      const best = Math.max(...scores);
      if (best <= 0 || scores.filter((x) => x === best).length !== 1) continue;
      const colIdx = scores.indexOf(best);
      const cellV = spec.rows[rowIdx][colIdx];
      if (!isNum(cellV) && !/^-?[\d,]+(\.\d+)?$/.test(String(cellV))) continue;
      const nums = numbersIn(cl);
      const target = isNum(cellV) ? cellV : num(String(cellV));
      const rowName = String(spec.rows[rowIdx][0]);
      const rowNameNums = Array.from(rowName.matchAll(/\d+/g)).map((m) => Number(m[0]));
      const candidates = nums.filter((n) => !rowNameNums.includes(n));
      if (candidates.length && !candidates.some((n) => Math.abs(n - target) < 1e-9)) issues.push({ code: "ref_mismatch", message: `지문은 '${rowName}' 의 '${spec.columns[colIdx]}' 를 ${candidates.join("/")} 로 말하지만 표의 값은 ${fmtNum(target)} 입니다.` });
    }
  }
  // 양방향 표: 절 안에 [행 이름 + 열 이름 + 숫자] 이면 그 칸과 같아야 한다.
  if (spec.kind === "two_way" && spec.rowLabels && spec.colLabels && spec.cells) {
    for (const cl of clauses) {
      const low = cl.toLowerCase();
      const ri = spec.rowLabels.findIndex((r) => low.includes(r.toLowerCase()));
      const ci = spec.colLabels.findIndex((c) => low.includes(c.toLowerCase()));
      if (ri < 0 || ci < 0) continue;
      const target = spec.cells[ri][ci];
      const labelNums = [...spec.rowLabels[ri].matchAll(/\d+/g), ...spec.colLabels[ci].matchAll(/\d+/g)].map((m) => Number(m[0]));
      const nums = numbersIn(cl).filter((n) => !labelNums.includes(n));
      if (nums.length && !nums.some((n) => Math.abs(n - target) < 1e-9)) issues.push({ code: "ref_mismatch", message: `지문은 '${spec.rowLabels[ri]} · ${spec.colLabels[ci]}' 를 ${nums.join("/")} 로 말하지만 표의 칸은 ${fmtNum(target)} 입니다.` });
    }
  }
  // 문장형 자료: 절 안에 [항목 이름 + 숫자] 이면 그 값과 같아야 한다.
  if (spec.kind === "statement" && spec.facts) {
    for (const cl of clauses) {
      const low = cl.toLowerCase();
      for (const fct of spec.facts) {
        if (typeof fct.value !== "number") continue;
        const target: number = fct.value;
        const key = fct.label.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
        if (!key.length || !key.every((w) => low.includes(w))) continue;
        const nums = numbersIn(cl);
        if (nums.length && !nums.some((n) => Math.abs(n - target) < 1e-9)) issues.push({ code: "ref_mismatch", message: `지문은 '${fct.label}' 을 ${nums.join("/")} 로 말하지만 자료의 값은 ${fmtNum(target)} 입니다.` });
      }
    }
  }
  if ((spec.kind === "bar" || spec.kind === "line") && spec.categories && spec.series) {
    for (const cl of clauses) {
      const low = cl.toLowerCase();
      const ci = spec.categories.findIndex((c) => nameInClause(cl, c, spec.xTitle));
      if (ci < 0) continue;
      const si = spec.series.length === 1 ? 0 : spec.series.findIndex((s) => s.name && low.includes(s.name.toLowerCase()));
      if (si < 0) continue;
      const target = spec.series[si].values[ci];
      const catNums = Array.from(spec.categories[ci].matchAll(/\d+/g)).map((m) => Number(m[0]));
      const nums = numbersIn(cl).filter((n) => !catNums.includes(n));
      if (nums.length && !nums.some((n) => Math.abs(n - target) < 1e-9)) issues.push({ code: "ref_mismatch", message: `지문은 '${spec.categories[ci]}'${spec.series[si].name ? `(${spec.series[si].name})` : ""} 값을 ${nums.join("/")} 로 말하지만 그래프의 값은 ${fmtNum(target)} 입니다.` });
    }
  }
  // 단위 — 지문의 단위 낱말이 축 제목·열 이름·제목 어디에도 없으면 경고
  // percent·degrees 는 답의 형태로 자주 쓰여 단위 검사에서 뺀다.
  const UNITS = ["dollars", "hours", "minutes", "seconds", "meters", "kilometers", "miles", "feet", "inches", "grams", "kilograms", "pounds", "liters", "gallons"];
  const joined = Array.from(names).join(" ");
  for (const u of UNITS) if (new RegExp(`\\b${u}\\b`, "i").test(text) && spec.kind !== "number_list" && !new RegExp(u.slice(0, 4), "i").test(joined) && !new RegExp(`\\(${u.slice(0, 3)}`, "i").test(joined)) {
    if (spec.kind === "table" || spec.kind === "bar" || spec.kind === "line" || spec.kind === "scatter" || spec.kind === "histogram" || spec.kind === "dot_plot") issues.push({ code: "unit_missing", message: `지문은 '${u}' 단위를 쓰지만 표·그래프의 열 이름이나 축 제목에 단위가 없습니다(예: 'Cost (dollars)').` });
  }
  if (/\b(northeast|northwest|southeast|southwest|region)\b/i.test(text)) issues.push({ code: "wording", message: "지문에 배치 용어(region 등)가 있습니다." });
  return dedupe(issues);
}
