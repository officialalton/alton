// 표준 렌더링 엔진 — 누적(쌓은) 막대그래프(stacked_bar): 범주마다 막대 하나, 계열(series)이 아래에서 위로 쌓인다.
// 한 조각의 값 = 그 조각의 높이(눈금 간격에 맞춰 읽는다). showValues 면 조각 안에 값을 적는다. 범례에 계열 이름이 있다.

import { dedupe, esc, f, FONT, labelWidth, Sheet, type FigureIssue } from "./_layout";
import { drawXTitle, drawYAxis, fmtTick, niceStep, type Frame } from "./_chart";

export type StackedBarSpec = {
  type: "stacked_bar";
  title?: string;
  categories: string[];
  series: { name: string; values: number[] }[];
  xTitle: string;
  yTitle: string;
  yMax?: number;
  yStep?: number;
  showValues?: boolean;
};

export const SB_COLORS = ["#8fb8de", "#f2a7b1", "#a8d5ba", "#f1d58a"];
const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const isName = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0 && v.trim().length <= 24;
const W = 440;

export function validateStackedBar(input: unknown): { ok: true; spec: StackedBarSpec } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "그림 데이터가 객체가 아닙니다." };
  const s = input as Record<string, unknown>;
  if (s.type !== "stacked_bar") return { ok: false, error: "type 이 stacked_bar 가 아닙니다." };
  if (s.title !== undefined && (typeof s.title !== "string" || !s.title.trim() || s.title.length > 70)) return { ok: false, error: "title 은 70자 이내 문자열입니다." };
  for (const k of ["xTitle", "yTitle"]) if (typeof s[k] !== "string" || !(s[k] as string).trim() || (s[k] as string).length > 60) return { ok: false, error: `${k} 는 60자 이내 문자열입니다.` };
  if (!Array.isArray(s.categories) || s.categories.length < 2 || s.categories.length > 6 || !s.categories.every(isName)) return { ok: false, error: "stacked_bar 는 categories(2~6개) 가 필요합니다." };
  if (new Set((s.categories as string[]).map((c) => c.trim().toLowerCase())).size !== s.categories.length) return { ok: false, error: "categories 가 중복됩니다." };
  if (!Array.isArray(s.series) || s.series.length < 2 || s.series.length > 4) return { ok: false, error: "stacked_bar 는 series(2~4개) 가 필요합니다." };
  for (const se of s.series as Record<string, unknown>[]) {
    if (!se || !isName(se.name)) return { ok: false, error: "series[].name 이 필요합니다(범례)." };
    if (!Array.isArray(se.values) || se.values.length !== (s.categories as unknown[]).length || !se.values.every((v) => isNum(v) && v >= 0)) return { ok: false, error: "series[].values 는 categories 와 같은 개수의 0 이상 숫자여야 합니다." };
  }
  if (new Set((s.series as { name: string }[]).map((x) => x.name.trim().toLowerCase())).size !== s.series.length) return { ok: false, error: "series 이름이 중복됩니다." };
  if (s.yMax !== undefined && !isNum(s.yMax)) return { ok: false, error: "yMax 는 숫자입니다." };
  if (s.yStep !== undefined && (!isNum(s.yStep) || s.yStep <= 0)) return { ok: false, error: "yStep 은 양수입니다." };
  if (s.showValues !== undefined && typeof s.showValues !== "boolean") return { ok: false, error: "showValues 는 true/false 입니다." };
  return { ok: true, spec: s as unknown as StackedBarSpec };
}

export function stackedTotals(spec: StackedBarSpec): number[] { return spec.categories.map((_, i) => spec.series.reduce((a, s) => a + s.values[i], 0)); }
export function stackedYDomain(spec: StackedBarSpec): { min: number; max: number; step: number } {
  const hi = Math.max(...stackedTotals(spec)); const step = spec.yStep ?? niceStep(hi || 1);
  let max = spec.yMax ?? Math.ceil(hi / step) * step; if (spec.yMax === undefined && max === hi) max += step;
  return { min: 0, max: max <= 0 ? step : max, step };
}

export function renderStackedBar(spec: StackedBarSpec): { svg: string; alt: string; issues: FigureIssue[] } {
  const issues: FigureIssue[] = [];
  const cats = spec.categories, series = spec.series;
  const H = 300 + 16 + 22 + (spec.title ? 22 : 0);
  const sheet = new Sheet(W, H);
  const top = 20 + (spec.title ? 22 : 0) + 22;
  const fr: Frame = { x0: 64 + 14, y0: top, x1: W - 24, y1: H - 40 - 16 };
  if (spec.title) sheet.text(W / 2, 14, spec.title, { size: spec.title.length > 40 ? 11 : 14, anchor: "middle" });
  // 범례(가로 한 줄) — 막대 조각 색과 같다.
  let lx = fr.x0; const ly = top - 12;
  series.forEach((s, i) => {
    sheet.raw(`<rect x="${f(lx)}" y="${f(ly - 6)}" width="12" height="12" fill="${SB_COLORS[i % 4]}" stroke="#111" stroke-width="1" data-sb-legend="${i}"/>`);
    sheet.text(lx + 18 + labelWidth(s.name, 12) / 2 - 3, ly, s.name, { size: 12, anchor: "middle" });
    lx += 18 + labelWidth(s.name, 12) + 14;
  });
  if (lx > W - 8) issues.push({ code: "clipped", message: "범례가 그림 밖으로 나갑니다 — 계열 이름을 줄이세요." });
  const dom = stackedYDomain(spec);
  const totals = stackedTotals(spec);
  if (totals.some((t) => t > dom.max + 1e-9)) issues.push({ code: "out_of_range", message: `막대 높이가 세로축 범위(0~${dom.max}) 밖에 있습니다 — yMax 를 고치세요.` });
  const sy = drawYAxis(sheet, fr, dom.min, dom.max, dom.step, spec.yTitle);
  const slot = (fr.x1 - fr.x0) / cats.length, barW = slot * 0.56;
  cats.forEach((c, i) => {
    const x = fr.x0 + slot * i + (slot - barW) / 2; let base = 0;
    series.forEach((s, k) => {
      const v = s.values[i]; if (v <= 0) return;
      const yTop = sy(base + v), yBot = sy(base);
      sheet.raw(`<rect x="${f(x)}" y="${f(yTop)}" width="${f(barW)}" height="${f(yBot - yTop)}" fill="${SB_COLORS[k % 4]}" stroke="#111" stroke-width="1" data-sb="${k},${i}"/>`);
      sheet.registerSegment([x, yTop], [x + barW, yTop]);
      if (spec.showValues) {
        if (yBot - yTop < 17) issues.push({ code: "label_collision", message: `'${c}' 막대의 '${s.name}' 조각이 낮아 값 라벨이 들어가지 않습니다.` });
        else sheet.raw(`<text x="${f(x + barW / 2)}" y="${f((yTop + yBot) / 2 + 4)}" font-family="${FONT}" font-size="12" text-anchor="middle" fill="#111" data-sb-value="${k},${i}">${fmtTick(v)}</text>`);
      }
      base += v;
    });
    const wlab = labelWidth(c, 12);
    if (wlab > slot - 4) issues.push({ code: "label_collision", message: `범주 이름 '${c}' 가 칸보다 길어 겹칩니다 — 짧게 줄이세요.` });
    sheet.raw(`<text x="${f(fr.x0 + slot * (i + 0.5))}" y="${f(fr.y1 + 15)}" font-family="${FONT}" font-size="12" text-anchor="middle" fill="#111">${esc(c)}</text>`);
  });
  drawXTitle(sheet, fr, H, spec.xTitle);
  const alt = `${spec.title ? spec.title + " — " : ""}누적 막대그래프, 가로축 ${spec.xTitle}, 세로축 ${spec.yTitle}. ` + cats.map((c, i) => `${c}: ${series.map((s) => `${s.name} ${fmtTick(s.values[i])}`).join(", ")}`).join("; ") + ".";
  return { svg: sheet.svg(alt), alt, issues: dedupe([...issues, ...sheet.uniqueIssues()]) };
}

export function lintStackedBarAgainstText(spec: StackedBarSpec, passage: string): FigureIssue[] {
  const issues: FigureIssue[] = [];
  const text = passage.replace(/\$/g, "");
  const names = new Set([...spec.categories, ...spec.series.map((s) => s.name), spec.xTitle, spec.yTitle, spec.title ?? ""].map((n) => n.trim().toLowerCase()));
  for (const m of text.matchAll(/["“]([^"”]{1,40})["”]/g)) {
    const q = m[1].trim().toLowerCase(); if (q.split(/\s+/).length > 6) continue;
    if (!Array.from(names).some((n) => n === q || n.includes(q) || q.includes(n))) issues.push({ code: "ref_missing", message: `지문의 "${m[1]}" 가 그래프의 항목(범주·계열·축 제목)에 없습니다.` });
  }
  if (/\b(northeast|northwest|southeast|southwest|region)\b/i.test(text)) issues.push({ code: "wording", message: "지문에 배치 용어(region 등)가 있습니다." });
  return issues;
}
