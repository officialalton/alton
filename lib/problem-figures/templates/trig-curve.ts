// 표준 렌더링 엔진 — 템플릿: 삼각함수 곡선(사인·코사인 모양) 그래프
//
// 관계만 받는다: 함수 종류(sin|cos)·진폭·주기·중심선·위상, 축 범위·눈금, 곡선 위에 표시할 점(x 만 주면 y 는 곡선에서 계산)과 그 라벨.
// 곡선·눈금·격자는 여기서 그리므로 그림은 항상 데이터와 맞는다(G8 가 곡선 표본·표시점·눈금 숫자를 다시 읽어 대조).
// xUnit "pi": x 값을 π 단위로 쓰고 눈금 숫자는 π/2, π, 3π/2 … 로 인쇄한다. xUnit "plain": 일반 수(단위는 축 제목).

import { dedupe, f, type FigureIssue } from "./_layout";
import { labelWidth } from "./_layout";

export type TrigPoint = { x: number; label?: string; open?: boolean; name?: string };
export type TrigCurveSpec = {
  type: "trig_curve";
  fn: "sin" | "cos";
  amp: number;
  /** 주기 — xUnit 이 pi 면 π 단위(2 → 2π). */
  period: number;
  mid?: number;
  /** 위상: 곡선이 x = shift 에서 sin 이면 중심선을 올라가며 지나고, cos 이면 최댓값에 있다. */
  shift?: number;
  xUnit: "pi" | "plain";
  xRange: [number, number];
  xStep: number;
  yRange: [number, number];
  yStep: number;
  xTitle?: string;
  yTitle?: string;
  points?: TrigPoint[];
};

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isRange = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1]) && v[0] < v[1];

export function validateTrigCurve(input: unknown): { ok: true; spec: TrigCurveSpec } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "그림 데이터가 객체가 아닙니다." };
  const s = input as Record<string, unknown>;
  if (s.type !== "trig_curve") return { ok: false, error: "type 이 trig_curve 가 아닙니다." };
  if (s.fn !== "sin" && s.fn !== "cos") return { ok: false, error: "fn 은 sin|cos 입니다." };
  if (!isNum(s.amp) || s.amp <= 0) return { ok: false, error: "amp 는 0 보다 큰 수입니다." };
  if (!isNum(s.period) || s.period <= 0) return { ok: false, error: "period 는 0 보다 큰 수입니다." };
  if (s.mid !== undefined && !isNum(s.mid)) return { ok: false, error: "mid 는 수입니다." };
  if (s.shift !== undefined && !isNum(s.shift)) return { ok: false, error: "shift 는 수입니다." };
  if (s.xUnit !== "pi" && s.xUnit !== "plain") return { ok: false, error: "xUnit 은 pi|plain 입니다." };
  if (!isRange(s.xRange) || !isRange(s.yRange)) return { ok: false, error: "xRange/yRange 는 [작은 수, 큰 수] 입니다." };
  if (!isNum(s.xStep) || s.xStep <= 0 || !isNum(s.yStep) || s.yStep <= 0) return { ok: false, error: "xStep/yStep 은 0 보다 큰 수입니다." };
  if ((s.xRange[1] - s.xRange[0]) / s.xStep > 24 || (s.yRange[1] - s.yRange[0]) / s.yStep > 24) return { ok: false, error: "눈금이 24개를 넘습니다." };
  for (const k of ["xTitle", "yTitle"]) if (s[k] !== undefined && (typeof s[k] !== "string" || (s[k] as string).length > 40)) return { ok: false, error: `${k} 는 40자 이내 문자열입니다.` };
  if (s.points !== undefined) {
    if (!Array.isArray(s.points) || s.points.length > 4) return { ok: false, error: "points 는 4개 이내 배열입니다." };
    for (const p of s.points as Record<string, unknown>[]) {
      if (!p || !isNum(p.x) || p.x < s.xRange[0] - 1e-9 || p.x > s.xRange[1] + 1e-9) return { ok: false, error: "points[].x 는 xRange 안의 수입니다." };
      if (p.label !== undefined && (typeof p.label !== "string" || p.label.length > 22)) return { ok: false, error: "points[].label 은 22자 이내 문자열입니다." };
      if (p.name !== undefined && (typeof p.name !== "string" || p.name.length > 3)) return { ok: false, error: "points[].name 은 3자 이내입니다." };
    }
  }
  return { ok: true, spec: s as unknown as TrigCurveSpec };
}

/** 곡선의 값. xUnit 이 pi 여도 x, shift, period 는 같은 단위이므로 식이 같다. */
export const trigValue = (s: Pick<TrigCurveSpec, "fn" | "amp" | "period" | "mid" | "shift">, x: number): number => {
  const a = (2 * Math.PI * (x - (s.shift ?? 0))) / s.period;
  return (s.mid ?? 0) + s.amp * (s.fn === "sin" ? Math.sin(a) : Math.cos(a));
};

const GCD = (a: number, b: number): number => (b ? GCD(b, a % b) : a);
/** π 단위 값 → "π/2", "3π/2", "−π", "0". 분모 12 이하 유리수만. */
export function piLabel(v: number): string {
  if (Math.abs(v) < 1e-9) return "0";
  for (const d of [1, 2, 3, 4, 6, 12]) {
    const n = Math.round(v * d);
    if (Math.abs(n / d - v) < 1e-9) {
      const g = GCD(Math.abs(n), d); const nn = Math.abs(n) / g, dd = d / g;
      return `${n < 0 ? "−" : ""}${nn === 1 ? "" : nn}π${dd === 1 ? "" : `/${dd}`}`;
    }
  }
  return String(Math.round(v * 100) / 100);
}
const numLabel = (v: number) => (Math.round(v * 100) / 100).toString().replace("-", "−");

export const TC_GEOM = { W: 460, H: 320, PADL: 58, PADR: 44, PADT: 36, PADB: 56 } as const;
const FONT = "Georgia, 'Times New Roman', serif";

export function renderTrigCurve(spec: TrigCurveSpec): { svg: string; alt: string; issues: FigureIssue[] } {
  const { W, H, PADL, PADR, PADT, PADB } = TC_GEOM;
  const issues: FigureIssue[] = [];
  const [x0, x1] = spec.xRange, [y0, y1] = spec.yRange;
  const sx = (x: number) => PADL + ((x - x0) / (x1 - x0)) * (W - PADL - PADR);
  const sy = (y: number) => H - PADB - ((y - y0) / (y1 - y0)) * (H - PADB - PADT);
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="trig graph" font-family="${FONT}" font-size="12" style="max-width:100%;height:auto">`);
  const xs: number[] = [], ys: number[] = [];
  for (let x = Math.ceil(x0 / spec.xStep - 1e-9) * spec.xStep; x <= x1 + 1e-9; x += spec.xStep) xs.push(Math.round(x * 1e6) / 1e6);
  for (let y = Math.ceil(y0 / spec.yStep - 1e-9) * spec.yStep; y <= y1 + 1e-9; y += spec.yStep) ys.push(Math.round(y * 1e6) / 1e6);
  const axX = x0 <= 0 && x1 >= 0 ? 0 : x0, axY = y0 <= 0 && y1 >= 0 ? 0 : y0;
  for (const x of xs) out.push(`<line x1="${f(sx(x))}" y1="${PADT}" x2="${f(sx(x))}" y2="${f(H - PADB)}" stroke="#9ca3af" stroke-width="0.8"/>`);
  for (const y of ys) out.push(`<line x1="${PADL}" y1="${f(sy(y))}" x2="${W - PADR}" y2="${f(sy(y))}" stroke="#9ca3af" stroke-width="0.8"/>`);
  out.push(`<defs><marker id="tc-ax" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#111"/></marker></defs>`);
  out.push(`<line x1="${PADL}" y1="${f(sy(axY))}" x2="${W - PADR + 16}" y2="${f(sy(axY))}" stroke="#111" stroke-width="1.8" marker-end="url(#tc-ax)"/>`);
  out.push(`<line x1="${f(sx(axX))}" y1="${f(H - PADB)}" x2="${f(sx(axX))}" y2="${PADT - 16}" stroke="#111" stroke-width="1.8" marker-end="url(#tc-ax)"/>`);
  // 눈금 숫자: 가로는 같은 줄에 가운데 정렬, 세로는 오른쪽 정렬(글자 y = 격자선 + 4)
  const fmtX = spec.xUnit === "pi" ? piLabel : numLabel;
  // 가로축이 그래프 가운데를 지나면 곡선이 눈금 숫자를 가로지르므로 숫자는 그림 아래 가장자리에 둔다.
  const xLabelY = (axY > y0 + 1e-9 ? H - PADB : sy(axY)) + 15;
  const everyX = xs.length > 14 ? 2 : 1;
  xs.forEach((x, i) => { if (Math.abs(x - axX) < 1e-9 || i % everyX !== 0) return; out.push(`<text x="${f(sx(x))}" y="${f(xLabelY)}" text-anchor="middle" fill="#111" stroke="#fff" stroke-width="3" paint-order="stroke">${fmtX(x)}</text>`); });
  const everyY = ys.length > 12 ? 2 : 1;
  ys.forEach((y, i) => { if (Math.abs(y - axY) < 1e-9 || i % everyY !== 0) return; out.push(`<text x="${f(sx(axX) - 6)}" y="${f(sy(y) + 4)}" text-anchor="end" fill="#111" stroke="#fff" stroke-width="3" paint-order="stroke">${numLabel(y)}</text>`); });
  if (axX === 0 && axY === 0) out.push(`<text x="${f(sx(0) - 6)}" y="${f(sy(0) + 15)}" text-anchor="end" fill="#111" font-style="italic">O</text>`);
  // 축 이름 글자(x, y)는 순수 xy 그래프(제목이 x·y)에서만 그린다 — 맥락 그래프는 제목(단위 포함)이 대신한다.
  if (!spec.xTitle || spec.xTitle.trim() === "x") out.push(`<text x="${W - PADR + 22}" y="${f(sy(axY) + 4)}" fill="#111" font-style="italic">x</text>`);
  if (!spec.yTitle || spec.yTitle.trim() === "y") out.push(`<text x="${f(sx(axX) + 10)}" y="${PADT - 14}" fill="#111" font-style="italic">y</text>`);
  if (spec.xTitle && spec.xTitle.trim() !== "x") out.push(`<text x="${f((PADL + W - PADR) / 2)}" y="${H - 8}" text-anchor="middle" fill="#111">${spec.xTitle.replace(/[&<>"']/g, "")}</text>`);
  if (spec.yTitle && spec.yTitle.trim() !== "y") out.push(`<text transform="translate(14 ${f((PADT + H - PADB) / 2)}) rotate(-90)" text-anchor="middle" fill="#111">${spec.yTitle.replace(/[&<>"']/g, "")}</text>`);

  // 곡선 — 표본 점을 이은 폴리라인(범위 밖은 자른다)
  const n = 240; const pts: string[] = [];
  const clipY = (y: number) => Math.min(y1, Math.max(y0, y));
  for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n; const y = trigValue(spec, x); pts.push(`${f(sx(x))},${f(sy(clipY(y)))}`); }
  const yMin = (spec.mid ?? 0) - spec.amp, yMax = (spec.mid ?? 0) + spec.amp;
  if (yMin < y0 - 1e-9 || yMax > y1 + 1e-9) issues.push({ code: "clipped", message: `곡선의 값 범위 [${yMin}, ${yMax}] 가 y 축 범위 [${y0}, ${y1}] 를 벗어납니다.` });
  out.push(`<polyline points="${pts.join(" ")}" fill="none" stroke="#111" stroke-width="2.6" stroke-linejoin="round"/>`);

  // 표시점·라벨
  const placed: { x1: number; y1: number; x2: number; y2: number }[] = [];
  xs.forEach((x, i) => { if (Math.abs(x - axX) < 1e-9 || i % everyX !== 0) return; const w = labelWidth(fmtX(x), 12); placed.push({ x1: sx(x) - w / 2, y1: xLabelY - 11, x2: sx(x) + w / 2, y2: xLabelY + 4 }); });
  ys.forEach((y, i) => { if (Math.abs(y - axY) < 1e-9 || i % everyY !== 0) return; const w = labelWidth(numLabel(y), 12); placed.push({ x1: sx(axX) - 6 - w, y1: sy(y) - 8, x2: sx(axX) - 6, y2: sy(y) + 7 }); });
  for (const p of spec.points ?? []) {
    const px = sx(p.x), py = sy(trigValue(spec, p.x));
    out.push(`<circle cx="${f(px)}" cy="${f(py)}" r="4" fill="${p.open ? "#fff" : "#111"}" stroke="#111" stroke-width="2"/>`);
    const txt = [p.name, p.label].filter(Boolean).join(" ");
    if (!txt) continue;
    const w = labelWidth(txt, 13), h = 16;
    const cands: [number, number][] = [];
    for (const d of [16, 24, 34, 46, 60, 78]) for (let a = 0; a < 360; a += 20) { const rr = (a * Math.PI) / 180; cands.push([px + Math.cos(rr) * (d + (Math.abs(Math.cos(rr)) * w) / 2), py - Math.sin(rr) * (d + 6)]); }
    const ok = (c: [number, number]) => {
      const b = { x1: c[0] - w / 2, y1: c[1] - h / 2, x2: c[0] + w / 2, y2: c[1] + h / 2 };
      if (b.x1 < 4 || b.x2 > W - 4 || b.y1 < 4 || b.y2 > H - 4) return false;
      if (placed.some((q) => b.x1 < q.x2 + 2 && q.x1 < b.x2 + 2 && b.y1 < q.y2 + 2 && q.y1 < b.y2 + 2)) return false;
      // 곡선과 겹치지 않기(표본 점과의 거리)
      for (let i = 0; i <= 120; i++) { const x = x0 + ((x1 - x0) * i) / 120; const cx = sx(x), cy = sy(clipY(trigValue(spec, x))); if (cx > b.x1 - 3 && cx < b.x2 + 3 && cy > b.y1 - 3 && cy < b.y2 + 3) return false; }
      // x축·y축 선과 겹치지 않기
      const ay = sy(axY), ax = sx(axX); if (b.y1 - 2 < ay && ay < b.y2 + 2) return false; if (b.x1 - 2 < ax && ax < b.x2 + 2) return false;
      // 눈금 숫자 줄과 겹치지 않기
      if (b.y2 > xLabelY - 12 && b.y1 < xLabelY + 4) return false;
      return true;
    };
    const spot = cands.find(ok);
    if (!spot) { issues.push({ code: "label_collision", message: `표시점 라벨 '${txt}' 가 곡선·축과 겹치지 않는 자리를 찾지 못했습니다.` }); continue; }
    placed.push({ x1: spot[0] - w / 2, y1: spot[1] - h / 2, x2: spot[0] + w / 2, y2: spot[1] + h / 2 });
    out.push(`<text x="${f(spot[0])}" y="${f(spot[1] + 4)}" text-anchor="middle" fill="#111" font-size="13" stroke="#fff" stroke-width="3" paint-order="stroke">${txt.replace(/[&<>"']/g, "")}</text>`);
  }
  const alt = `${spec.fn === "sin" ? "사인" : "코사인"} 모양 곡선: 진폭 ${spec.amp}, 주기 ${spec.xUnit === "pi" ? `${spec.period}π` : spec.period}, 중심선 y = ${spec.mid ?? 0}` + ((spec.points ?? []).length ? `. 표시점: ${(spec.points ?? []).map((p) => p.label ?? "").filter(Boolean).join(", ")}` : "") + ".";
  out.push("</svg>");
  return { svg: out.join("").replace('aria-label="trig graph"', `aria-label="${alt.replace(/"/g, "")}"`), alt, issues: dedupe(issues) };
}

/** 지문 참조 검사 — "point P" 이름이 그림에 있는가. */
export function lintTrigCurveAgainstText(spec: TrigCurveSpec, passage: string): FigureIssue[] {
  const issues: FigureIssue[] = [];
  const text = passage.replace(/\$/g, "");
  const names = new Set((spec.points ?? []).map((p) => p.name).filter(Boolean) as string[]);
  for (const m of text.matchAll(/\b[Pp]oints?\s+([A-Z])\b/g)) if (!names.has(m[1])) issues.push({ code: "ref_missing", message: `지문의 점 ${m[1]} 가 그림에 없습니다.` });
  return dedupe(issues);
}
