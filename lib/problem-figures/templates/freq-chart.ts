// 표준 렌더링 엔진 — 도수다각형(polygon)과 누적도수곡선(ogive): 같은 구간표(bins)에서 그린다.
//  · polygon: 각 계급의 가운데 값(계급값)에 도수를 찍고 선으로 잇는다. 양 끝에는 도수 0 인 빈 계급(앞뒤 한 칸)을 붙여 축까지 닫는다. 가로 눈금 = 계급값.
//  · ogive: (첫 하한, 0) 과 (각 계급의 상한, 그 계급까지의 누적도수) 를 잇는다. 가로 눈금 = 계급 경계. percent:true 면 세로축이 누적 상대도수(%)다.
// 구간은 빈틈·겹침 없이 같은 폭으로 이어진다(균일 계급). 값 이름은 bins[].count 로 히스토그램과 같다.

import { dedupe, f, labelWidth, Sheet, type FigureIssue } from "./_layout";
import { COLORS, drawXTitle, drawYAxis, fmtTick, niceStep, type Frame } from "./_chart";

export type FreqChartSpec = {
  type: "freq_chart";
  kind: "polygon" | "ogive";
  title?: string;
  bins: { from: number; to: number; count: number }[];
  xTitle: string;
  yTitle: string;
  /** ogive 전용: 세로축을 누적 상대도수(%)로. */
  percent?: boolean;
  yMax?: number;
  yStep?: number;
};

const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const W = 440;

export function validateFreqChart(input: unknown): { ok: true; spec: FreqChartSpec } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "그림 데이터가 객체가 아닙니다." };
  const s = input as Record<string, unknown>;
  if (s.type !== "freq_chart") return { ok: false, error: "type 이 freq_chart 가 아닙니다." };
  if (s.kind !== "polygon" && s.kind !== "ogive") return { ok: false, error: "freq_chart 의 kind 는 polygon|ogive 입니다." };
  if (s.title !== undefined && (typeof s.title !== "string" || !s.title.trim() || s.title.length > 70)) return { ok: false, error: "title 은 70자 이내 문자열입니다." };
  for (const k of ["xTitle", "yTitle"]) if (typeof s[k] !== "string" || !(s[k] as string).trim() || (s[k] as string).length > 60) return { ok: false, error: `${k} 는 60자 이내 문자열입니다.` };
  if (s.percent !== undefined && typeof s.percent !== "boolean") return { ok: false, error: "percent 는 true/false 입니다." };
  if (s.percent && s.kind !== "ogive") return { ok: false, error: "percent 는 ogive 에서만 씁니다." };
  if (!Array.isArray(s.bins) || s.bins.length < 3 || s.bins.length > 10) return { ok: false, error: "freq_chart 는 bins(3~10개) 가 필요합니다." };
  let prev: number | null = null; let w: number | null = null; let total = 0;
  for (const b of s.bins as Record<string, unknown>[]) {
    if (!b || !isNum(b.from) || !isNum(b.to) || !isNum(b.count) || b.from >= b.to || b.count < 0 || !Number.isInteger(b.count)) return { ok: false, error: "bins[] 는 from < to, count ≥ 0 정수여야 합니다." };
    if (prev !== null && Math.abs(b.from - prev) > 1e-9) return { ok: false, error: "freq_chart 의 구간은 빈틈·겹침 없이 이어져야 합니다." };
    if (w !== null && Math.abs(b.to - b.from - w) > 1e-9) return { ok: false, error: "freq_chart 의 구간 폭은 모두 같아야 합니다." };
    w = b.to - b.from; prev = b.to; total += b.count;
  }
  if (total <= 0) return { ok: false, error: "freq_chart 의 도수 합이 0 입니다." };
  if (s.yMax !== undefined && !isNum(s.yMax)) return { ok: false, error: "yMax 는 숫자입니다." };
  if (s.yStep !== undefined && (!isNum(s.yStep) || s.yStep <= 0)) return { ok: false, error: "yStep 은 양수입니다." };
  return { ok: true, spec: s as unknown as FreqChartSpec };
}

/** 그려지는 점들(x 값, y 값) — 렌더러와 구조 검사가 같은 정의를 쓴다. */
export function freqChartPoints(spec: FreqChartSpec): [number, number][] {
  const bins = spec.bins; const w = bins[0].to - bins[0].from;
  if (spec.kind === "polygon") {
    const mids = bins.map((b) => (b.from + b.to) / 2);
    return [[mids[0] - w, 0], ...bins.map((b, i): [number, number] => [mids[i], b.count]), [mids[mids.length - 1] + w, 0]];
  }
  const total = bins.reduce((a, b) => a + b.count, 0); let acc = 0;
  const y = (c: number) => (spec.percent ? (c / total) * 100 : c);
  return [[bins[0].from, 0], ...bins.map((b): [number, number] => { acc += b.count; return [b.to, y(acc)]; })];
}
/** 가로 눈금 값. */
export const freqChartXTicks = (spec: FreqChartSpec): number[] => freqChartPoints(spec).map((p) => Math.round(p[0] * 1e6) / 1e6);

export function freqChartYDomain(spec: FreqChartSpec): { min: number; max: number; step: number } {
  const hi = Math.max(...freqChartPoints(spec).map((p) => p[1]));
  if (spec.percent) { const step = spec.yStep ?? 10; return { min: 0, max: spec.yMax ?? 100, step }; }
  const step = spec.yStep ?? niceStep(hi || 1);
  let max = spec.yMax ?? Math.ceil(hi / step) * step; if (spec.yMax === undefined && max === hi) max += step;
  return { min: 0, max: max <= 0 ? step : max, step };
}

export function renderFreqChart(spec: FreqChartSpec): { svg: string; alt: string; issues: FigureIssue[] } {
  const issues: FigureIssue[] = [];
  const H = 300 + 16 + (spec.title ? 22 : 0);
  const sheet = new Sheet(W, H);
  const fr: Frame = { x0: 64 + 14, y0: 20 + (spec.title ? 22 : 0), x1: W - 24, y1: H - 40 - 16 };
  if (spec.title) sheet.text(W / 2, 14, spec.title, { size: spec.title.length > 40 ? 11 : 14, anchor: "middle" });
  const pts = freqChartPoints(spec); const dom = freqChartYDomain(spec);
  if (pts.some((p) => p[1] > dom.max + 1e-9)) issues.push({ code: "out_of_range", message: `값이 세로축 범위(0~${dom.max}) 밖에 있습니다 — yMax 를 고치세요.` });
  const sy = drawYAxis(sheet, fr, dom.min, dom.max, dom.step, spec.yTitle);
  const w = spec.bins[0].to - spec.bins[0].from;
  const lo = pts[0][0] - w / 2, hi = pts[pts.length - 1][0] + w / 2;
  const sx = (v: number) => fr.x0 + ((v - lo) / (hi - lo)) * (fr.x1 - fr.x0);
  const ticks = freqChartXTicks(spec);
  const slot = (fr.x1 - fr.x0) / ticks.length; const widest = Math.max(...ticks.map((t) => labelWidth(fmtTick(t), 12)));
  const every = widest > slot - 2 ? 2 : 1;
  ticks.forEach((t, i) => {
    sheet.raw(`<line x1="${f(sx(t))}" y1="${f(fr.y0)}" x2="${f(sx(t))}" y2="${f(fr.y1)}" stroke="#d1d5db" stroke-width="0.8"/>`);
    if (i % every === 0) sheet.raw(`<text x="${f(sx(t))}" y="${f(fr.y1 + 15)}" font-family="${"Georgia, 'Times New Roman', serif"}" font-size="12" text-anchor="middle" fill="#111">${fmtTick(t)}</text>`);
  });
  sheet.polyline(pts.map((p): [number, number] => [sx(p[0]), sy(p[1])]), { color: COLORS[0], w: 2 });
  for (const p of pts) sheet.raw(`<circle cx="${f(sx(p[0]))}" cy="${f(sy(p[1]))}" r="3.5" fill="#111"/>`);
  drawXTitle(sheet, fr, H, spec.xTitle);
  const alt = `${spec.title ? spec.title + " — " : ""}${spec.kind === "polygon" ? "도수다각형" : "누적도수곡선"}, 가로축 ${spec.xTitle}, 세로축 ${spec.yTitle}. ` +
    (spec.kind === "polygon" ? spec.bins.map((b) => `${fmtTick(b.from)}~${fmtTick(b.to)}(계급값 ${fmtTick((b.from + b.to) / 2)}): ${b.count}`).join(", ") : pts.map((p) => `(${fmtTick(p[0])}, ${fmtTick(p[1])})`).join(", ")) + ".";
  return { svg: sheet.svg(alt), alt, issues: dedupe([...issues, ...sheet.uniqueIssues()]) };
}

export function lintFreqChartAgainstText(_spec: FreqChartSpec, passage: string): FigureIssue[] {
  const issues: FigureIssue[] = [];
  if (/\b(northeast|northwest|southeast|southwest|region)\b/i.test(passage)) issues.push({ code: "wording", message: "지문에 배치 용어(region 등)가 있습니다." });
  return issues;
}
