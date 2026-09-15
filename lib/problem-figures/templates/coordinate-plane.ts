// 표준 렌더링 엔진 — 템플릿 3: 좌표평면 (docs/2026-09-14-standard-rendering-engine-design.md 1-3)
//
// 객체 **id** 기반. AI 는 축 범위와 객체(점·직선·함수·선분·산점도)의 수학적 정의만 낸다. 격자·굵은 축·화살표·눈금 숫자·원점 O·
// 축 제목·라벨 자리(후보 중 겹치지 않는 첫 자리)는 여기서 정한다. 라벨을 놓을 자리가 없거나 잘리면 검증 실패.

import { dedupe, f, FONT, halfDiag, Sheet, type FigureIssue, type Pt } from "./_layout";

export type FnKind = "linear" | "quadratic" | "exponential" | "abs" | "sqrt" | "cubic";
export type PointRef = string | Pt; // 점 객체 id 또는 좌표

export type PlaneObject =
  | { id: string; kind: "point"; at: Pt; label?: string; open?: boolean }
  | { id: string; kind: "line"; through?: [PointRef, PointRef]; slope?: number; intercept?: number; label?: string; style?: "solid" | "dashed" }
  | { id: string; kind: "function"; fn: FnKind; params: number[]; label?: string; domain?: [number, number]; style?: "solid" | "dashed" }
  | { id: string; kind: "segment"; from: PointRef; to: PointRef; label?: string; style?: "solid" | "dashed" }
  | { id: string; kind: "scatter"; points: Pt[]; fitLine?: { slope: number; intercept: number; label?: string } };

export type PlaneAxis = { min: number; max: number; step?: number; label?: string; title?: string };
export type PlaneSpec = {
  type: "plane";
  axes: { x: PlaneAxis; y: PlaneAxis };
  objects: PlaneObject[];
  grid?: boolean;
};

const W = 420, H = 300, PAD = 34;
const COLORS = ["#111", "#C8102E", "#1B6FB0", "#0f7b4a"];
const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const isPt = (p: unknown): p is Pt => Array.isArray(p) && p.length === 2 && p.every(isNum);
const isId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z][A-Za-z0-9_]{0,15}$/.test(v);

function niceStep(range: number): number {
  const raw = range / 8;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const cands = [1, 2, 5, 10].map((m) => m * pow);
  return cands.find((c) => c >= raw) ?? cands[cands.length - 1];
}

export function validatePlane(input: unknown): { ok: true; spec: PlaneSpec } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "그림 데이터가 객체가 아닙니다." };
  const s = input as Record<string, unknown>;
  if (s.type !== "plane") return { ok: false, error: "type 이 plane 이 아닙니다." };
  const axes = s.axes as Record<string, Record<string, unknown>> | undefined;
  for (const k of ["x", "y"] as const) {
    const a = axes?.[k];
    if (!a || !isNum(a.min) || !isNum(a.max) || a.min >= a.max) return { ok: false, error: `axes.${k} 는 min < max 인 숫자 범위가 필요합니다.` };
    if (a.step !== undefined && (!isNum(a.step) || a.step <= 0)) return { ok: false, error: `axes.${k}.step 은 0보다 큰 숫자입니다.` };
    if ((a.max - a.min) / (isNum(a.step) ? a.step : niceStep(a.max - a.min)) > 24) return { ok: false, error: `axes.${k} 눈금이 너무 많습니다(24개 이하).` };
  }
  if (!Array.isArray(s.objects) || s.objects.length === 0) return { ok: false, error: "objects 가 하나 이상 필요합니다." };
  const ids = new Set<string>();
  const pointIds = new Set<string>();
  const objs = s.objects as Record<string, unknown>[];
  for (const o of objs) {
    if (!o || !isId(o.id)) return { ok: false, error: "모든 객체에 id(영문자로 시작) 가 필요합니다." };
    if (ids.has(o.id)) return { ok: false, error: `객체 id '${o.id}' 가 중복됩니다.` };
    ids.add(o.id);
    if (o.kind === "point") pointIds.add(o.id);
  }
  const refOk = (r: unknown) => isPt(r) || (typeof r === "string" && pointIds.has(r));
  for (const o of objs) {
    switch (o.kind) {
      case "point":
        if (!isPt(o.at)) return { ok: false, error: `점 ${o.id} 의 at 은 [x, y] 여야 합니다.` };
        break;
      case "line":
        if (o.through !== undefined) {
          if (!Array.isArray(o.through) || o.through.length !== 2 || !o.through.every(refOk)) return { ok: false, error: `직선 ${o.id} 의 through 는 점 id 또는 좌표 2개여야 합니다.` };
        } else if (!isNum(o.slope) || !isNum(o.intercept)) return { ok: false, error: `직선 ${o.id} 는 through 두 점 또는 slope/intercept 가 필요합니다.` };
        break;
      case "function": {
        const need: Record<FnKind, number> = { linear: 2, quadratic: 3, cubic: 4, exponential: 3, abs: 3, sqrt: 3 };
        if (!(String(o.fn) in need)) return { ok: false, error: `함수 ${o.id} 의 fn 은 linear|quadratic|exponential|abs|sqrt|cubic 입니다.` };
        if (!Array.isArray(o.params) || !o.params.every(isNum) || o.params.length !== need[o.fn as FnKind]) return { ok: false, error: `함수 ${o.id}(${String(o.fn)}) 의 params 는 숫자 ${need[o.fn as FnKind]}개입니다.` };
        if (o.domain !== undefined && (!isPt(o.domain) || o.domain[0] >= o.domain[1])) return { ok: false, error: `함수 ${o.id} 의 domain 은 [min, max] 입니다.` };
        break;
      }
      case "segment":
        if (!refOk(o.from) || !refOk(o.to)) return { ok: false, error: `선분 ${o.id} 의 from/to 는 점 id 또는 좌표여야 합니다.` };
        break;
      case "scatter":
        if (!Array.isArray(o.points) || o.points.length < 3 || !o.points.every(isPt)) return { ok: false, error: `산점도 ${o.id} 는 점 3개 이상이 필요합니다.` };
        if (o.fitLine !== undefined) {
          const fl = o.fitLine as Record<string, unknown>;
          if (!fl || !isNum(fl.slope) || !isNum(fl.intercept)) return { ok: false, error: `산점도 ${o.id} 의 fitLine 은 slope/intercept 가 필요합니다.` };
        }
        break;
      default:
        return { ok: false, error: `객체 ${String(o.id)} 의 kind 를 모릅니다: ${String(o.kind)}` };
    }
    if (o.label !== undefined && typeof o.label !== "string") return { ok: false, error: `객체 ${o.id} 의 label 은 문자열입니다.` };
  }
  return { ok: true, spec: s as unknown as PlaneSpec };
}

export function evalFn(fn: FnKind, p: number[], x: number): number {
  switch (fn) {
    case "linear": return p[0] * x + p[1];
    case "quadratic": return p[0] * x * x + p[1] * x + p[2];
    case "cubic": return p[0] * x ** 3 + p[1] * x * x + p[2] * x + p[3];
    case "exponential": return p[0] * Math.pow(p[1], x) + p[2];
    case "abs": return p[0] * Math.abs(x - p[1]) + p[2];
    case "sqrt": return p[0] * Math.sqrt(Math.max(0, x - p[1])) + p[2];
  }
}

/** 직선의 기울기·절편(수직선은 null). */
export function lineParams(o: Extract<PlaneObject, { kind: "line" }>, resolve: (r: PointRef) => Pt): { m: number; b: number } | { vertical: number } {
  if (o.through) {
    const [a, c] = o.through.map(resolve);
    if (Math.abs(c[0] - a[0]) < 1e-12) return { vertical: a[0] };
    const m = (c[1] - a[1]) / (c[0] - a[0]);
    return { m, b: a[1] - m * a[0] };
  }
  return { m: o.slope!, b: o.intercept! };
}

/** 사람이 읽는 식 — 계수 1·0 정리, 부호 정리. alt 와 관리자 미리보기용. */
export function formatFn(fn: FnKind, p: number[]): string {
  const term = (c: number, v: string, first: boolean): string => {
    if (Math.abs(c) < 1e-12) return "";
    const sign = c < 0 ? "−" : first ? "" : "+";
    const a = Math.abs(c);
    const coef = v && Math.abs(a - 1) < 1e-12 ? "" : f(a);
    return `${first ? sign : ` ${sign} `}${coef}${v}`;
  };
  const poly = (coefs: [number, string][]) => {
    let out = "";
    for (const [c, v] of coefs) out += term(c, v, out === "");
    return out || "0";
  };
  switch (fn) {
    case "linear": return `y = ${poly([[p[0], "x"], [p[1], ""]])}`;
    case "quadratic": return `y = ${poly([[p[0], "x²"], [p[1], "x"], [p[2], ""]])}`;
    case "cubic": return `y = ${poly([[p[0], "x³"], [p[1], "x²"], [p[2], "x"], [p[3], ""]])}`;
    case "exponential": return `y = ${Math.abs(p[0] - 1) < 1e-12 ? "" : `${f(p[0])}·`}${f(p[1])}^x${poly([[p[2], ""]]) === "0" ? "" : ` ${p[2] < 0 ? "−" : "+"} ${f(Math.abs(p[2]))}`}`;
    case "abs": return `y = ${Math.abs(p[0] - 1) < 1e-12 ? "" : f(p[0])}|x${p[1] === 0 ? "" : ` ${p[1] < 0 ? "+" : "−"} ${f(Math.abs(p[1]))}`}|${p[2] === 0 ? "" : ` ${p[2] < 0 ? "−" : "+"} ${f(Math.abs(p[2]))}`}`;
    case "sqrt": return `y = ${Math.abs(p[0] - 1) < 1e-12 ? "" : f(p[0])}√(x${p[1] === 0 ? "" : ` ${p[1] < 0 ? "+" : "−"} ${f(Math.abs(p[1]))}`})${p[2] === 0 ? "" : ` ${p[2] < 0 ? "−" : "+"} ${f(Math.abs(p[2]))}`}`;
  }
}

export function renderPlane(spec: PlaneSpec): { svg: string; alt: string; issues: FigureIssue[] } {
  const issues: FigureIssue[] = [];
  // 축 제목은 단위·양("Time (hours)")용이다. AI 가 'x', 'y,' 처럼 변수 글자를 제목에 넣으면 무시한다(축 끝 라벨이 이미 x·y).
  const cleanTitle = (t?: string) => (t && !/^[xy][,.]?$/i.test(t.trim()) ? t.trim() : undefined);
  const ax = { ...spec.axes.x, title: cleanTitle(spec.axes.x.title) }, ay = { ...spec.axes.y, title: cleanTitle(spec.axes.y.title) };
  const xStep = ax.step ?? niceStep(ax.max - ax.min), yStep = ay.step ?? niceStep(ay.max - ay.min);
  const padL = PAD + (ay.title ? 22 : 0), padB = PAD + (ax.title ? 18 : 0);
  const sheet = new Sheet(W, H);
  const sx = (x: number) => padL + ((x - ax.min) / (ax.max - ax.min)) * (W - padL - PAD);
  const sy = (y: number) => H - padB - ((y - ay.min) / (ay.max - ay.min)) * (H - padB - PAD);
  const inRange = (x: number, y: number) => x >= ax.min - 1e-9 && x <= ax.max + 1e-9 && y >= ay.min - 1e-9 && y <= ay.max + 1e-9;
  const points = new Map<string, Pt>();
  for (const o of spec.objects) if (o.kind === "point") points.set(o.id, o.at);
  const resolve = (r: PointRef): Pt => (typeof r === "string" ? points.get(r)! : r);

  // ---- 격자·축(배경 — 충돌 검사 대상 아님, 단 축은 라벨과 겹치면 안 되므로 등록)
  const xs: number[] = [], ys: number[] = [];
  for (let x = Math.ceil(ax.min / xStep) * xStep; x <= ax.max + 1e-9; x += xStep) xs.push(Math.round(x * 1e6) / 1e6);
  for (let y = Math.ceil(ay.min / yStep) * yStep; y <= ay.max + 1e-9; y += yStep) ys.push(Math.round(y * 1e6) / 1e6);
  if (spec.grid !== false) {
    for (const x of xs) sheet.raw(`<line x1="${f(sx(x))}" y1="${PAD}" x2="${f(sx(x))}" y2="${f(H - padB)}" stroke="#9ca3af" stroke-width="0.8"/>`);
    for (const y of ys) sheet.raw(`<line x1="${f(padL)}" y1="${f(sy(y))}" x2="${W - PAD}" y2="${f(sy(y))}" stroke="#9ca3af" stroke-width="0.8"/>`);
  }
  const axX = ax.min <= 0 && ax.max >= 0 ? 0 : ax.min, axY = ay.min <= 0 && ay.max >= 0 ? 0 : ay.min;
  sheet.raw(`<defs><marker id="ax" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#111"/></marker></defs>`);
  sheet.raw(`<line x1="${f(padL)}" y1="${f(sy(axY))}" x2="${W - PAD}" y2="${f(sy(axY))}" stroke="#111" stroke-width="1.8" marker-end="url(#ax)"/>`);
  sheet.raw(`<line x1="${f(sx(axX))}" y1="${f(H - padB)}" x2="${f(sx(axX))}" y2="${PAD}" stroke="#111" stroke-width="1.8" marker-end="url(#ax)"/>`);
  sheet.registerSegment([padL, sy(axY)], [W - PAD, sy(axY)]);
  sheet.registerSegment([sx(axX), H - padB], [sx(axX), PAD]);
  const every = (n: number) => (n > 12 ? 3 : n > 8 ? 2 : 1);
  const ex = every(xs.length), ey = every(ys.length);
  xs.forEach((x, i) => { if (Math.abs(x - axX) > 1e-9 && i % ex === 0) sheet.raw(`<text x="${f(sx(x))}" y="${f(sy(axY) + 15)}" font-family="${FONT}" font-size="12" text-anchor="middle" fill="#111">${f(x)}</text>`); });
  ys.forEach((y, i) => { if (Math.abs(y - axY) > 1e-9 && i % ey === 0) sheet.raw(`<text x="${f(sx(axX) - 6)}" y="${f(sy(y) + 4)}" font-family="${FONT}" font-size="12" text-anchor="end" fill="#111">${f(y)}</text>`); });
  if (axX === 0 && axY === 0) sheet.raw(`<text x="${f(sx(0) - 5)}" y="${f(sy(0) + 14)}" font-family="${FONT}" font-size="12" text-anchor="end" fill="#111" font-style="italic">O</text>`);
  sheet.raw(`<text x="${W - PAD + 2}" y="${f(sy(axY) + 4)}" font-family="${FONT}" font-size="12" fill="#111" font-style="italic">${ax.label ?? "x"}</text>`);
  sheet.raw(`<text x="${f(sx(axX))}" y="${PAD - 6}" font-family="${FONT}" font-size="12" text-anchor="middle" fill="#111" font-style="italic">${ay.label ?? "y"}</text>`);
  if (ax.title) sheet.raw(`<text x="${f((padL + W - PAD) / 2)}" y="${H - 6}" font-family="${FONT}" font-size="12" text-anchor="middle" fill="#111">${ax.title}</text>`);
  if (ay.title) sheet.raw(`<text transform="translate(12 ${f((PAD + H - padB) / 2)}) rotate(-90)" font-family="${FONT}" font-size="12" text-anchor="middle" fill="#111">${ay.title}</text>`);

  // ---- 객체(곡선·선을 먼저 그려 라벨 충돌 대상으로 등록하고, 라벨은 마지막에)
  const labelJobs: { text: string; anchor: Pt; color: string; what: string; prefer: Pt[] }[] = [];
  const altParts: string[] = [];
  const clipLine = (m: number, b: number): Pt[] => {
    const cands: Pt[] = [[ax.min, m * ax.min + b], [ax.max, m * ax.max + b]];
    if (Math.abs(m) > 1e-12) cands.push([(ay.min - b) / m, ay.min], [(ay.max - b) / m, ay.max]);
    const pts = cands.filter((c) => inRange(c[0], c[1])).sort((p, q) => p[0] - q[0]);
    return pts.length >= 2 ? [pts[0], pts[pts.length - 1]] : [];
  };
  const around = (p: Pt, d = 14): Pt[] => [[p[0] + d, p[1] - d], [p[0] - d, p[1] - d], [p[0] + d, p[1] + d], [p[0] - d, p[1] + d], [p[0], p[1] - d - 4], [p[0], p[1] + d + 4]];

  spec.objects.forEach((o, idx) => {
    const color = COLORS[idx % COLORS.length];
    if (o.kind === "line") {
      const lp = lineParams(o, resolve);
      if ("vertical" in lp) {
        if (lp.vertical < ax.min || lp.vertical > ax.max) issues.push({ code: "out_of_range", message: `직선 ${o.id}(x = ${lp.vertical}) 이 축 범위 밖입니다.` });
        sheet.polyline([[sx(lp.vertical), sy(ay.min)], [sx(lp.vertical), sy(ay.max)]], { color, dashed: o.style === "dashed" });
        if (o.label) labelJobs.push({ text: o.label, anchor: [sx(lp.vertical), sy(ay.max)], color, what: `직선 ${o.id} 라벨`, prefer: around([sx(lp.vertical), sy(ay.max) + 12], 16) });
        altParts.push(`직선 ${o.label ?? o.id}: x = ${lp.vertical}`);
      } else {
        const ends = clipLine(lp.m, lp.b);
        if (ends.length < 2) issues.push({ code: "out_of_range", message: `직선 ${o.id}(y = ${lp.m}x + ${lp.b}) 이 축 범위 안에 보이지 않습니다.` });
        else {
          sheet.polyline(ends.map(([x, y]) => [sx(x), sy(y)] as Pt), { color, dashed: o.style === "dashed" });
          const end: Pt = [sx(ends[1][0]), sy(ends[1][1])];
          const q: Pt = [(sx(ends[0][0]) + end[0] * 3) / 4, (sy(ends[0][1]) + end[1] * 3) / 4];
          if (o.label) labelJobs.push({ text: o.label, anchor: end, color, what: `직선 ${o.id} 라벨`, prefer: [[end[0] - halfDiag(o.label) - 4, end[1] - 12], [end[0] - halfDiag(o.label) - 4, end[1] + 12], ...around(end, 18), ...around(q, 20)] });
        }
        altParts.push(`직선 ${o.label ?? o.id}: ${formatFn("linear", [lp.m, lp.b])}`);
      }
    } else if (o.kind === "function") {
      const [d0, d1] = o.domain ?? [ax.min, ax.max];
      const pts: Pt[] = [];
      let visible = 0;
      const N = 240;
      let run: Pt[] = [];
      let prev: { x: number; y: number } | null = null;
      // 축 범위를 벗어나는 구간은 **끊는다**(위·아래 경계에서 잘라 끝을 경계 위에 놓는다). 눌러 붙이면 가짜 수평선이 생긴다.
      const boundaryPoint = (a: { x: number; y: number }, b: { x: number; y: number }): Pt | null => {
        const yb = b.y > ay.max ? ay.max : b.y < ay.min ? ay.min : a.y > ay.max ? ay.max : a.y < ay.min ? ay.min : null;
        if (yb === null || a.y === b.y) return null;
        const t = (yb - a.y) / (b.y - a.y);
        return [sx(a.x + (b.x - a.x) * t), sy(yb)];
      };
      const flush = () => { if (run.length > 1) sheet.polyline(run, { color, dashed: o.style === "dashed" }); run = []; };
      for (let i = 0; i <= N; i++) {
        const x = d0 + ((d1 - d0) * i) / N;
        const y = evalFn(o.fn, o.params, x);
        const cur = { x, y };
        const inside = Number.isFinite(y) && y >= ay.min - 1e-9 && y <= ay.max + 1e-9;
        if (inside) {
          if (prev && !(prev.y >= ay.min - 1e-9 && prev.y <= ay.max + 1e-9) && Number.isFinite(prev.y)) { const bp = boundaryPoint(prev, cur); if (bp) run.push(bp); }
          const p: Pt = [sx(x), sy(y)];
          run.push(p); pts.push(p); visible++;
        } else {
          if (prev && prev.y >= ay.min - 1e-9 && prev.y <= ay.max + 1e-9 && Number.isFinite(y)) { const bp = boundaryPoint(prev, cur); if (bp) run.push(bp); }
          flush();
        }
        prev = cur;
      }
      flush();
      if (visible < 8) issues.push({ code: "out_of_range", message: `함수 ${o.id} 의 그래프가 축 범위 안에 거의 보이지 않습니다 — 축 범위를 고치세요.` });
      if (o.label && pts.length) {
        // 곡선 라벨 후보: 보이는 부분의 끝(오른쪽) 근처 → 3/4 지점 → 중간 지점, 곡선에서 떨어진 자리 순.
        const at = (t: number) => pts[Math.min(pts.length - 1, Math.floor((pts.length - 1) * t))];
        labelJobs.push({ text: o.label, anchor: at(1), color, what: `함수 ${o.id} 라벨`, prefer: [...around(at(1), 18), ...around(at(0.75), 20), ...around(at(0.5), 20)] });
      }
      altParts.push(`${o.label ?? o.id}: ${formatFn(o.fn, o.params)}`);
    } else if (o.kind === "segment") {
      const a = resolve(o.from), c = resolve(o.to);
      if (!inRange(a[0], a[1]) || !inRange(c[0], c[1])) issues.push({ code: "out_of_range", message: `선분 ${o.id} 의 끝점이 축 범위 밖입니다.` });
      sheet.polyline([[sx(a[0]), sy(a[1])], [sx(c[0]), sy(c[1])]], { color, dashed: o.style === "dashed" });
      if (o.label) { const mid: Pt = [(sx(a[0]) + sx(c[0])) / 2, (sy(a[1]) + sy(c[1])) / 2]; labelJobs.push({ text: o.label, anchor: mid, color, what: `선분 ${o.id} 라벨`, prefer: around(mid, 14) }); }
      altParts.push(`선분 ${o.label ?? o.id}: (${a.join(", ")})–(${c.join(", ")})`);
    } else if (o.kind === "scatter") {
      for (const [x, y] of o.points) {
        if (!inRange(x, y)) issues.push({ code: "out_of_range", message: `산점도 ${o.id} 의 점 (${x}, ${y}) 이 축 범위 밖입니다.` });
        sheet.raw(`<circle cx="${f(sx(x))}" cy="${f(sy(y))}" r="3.5" fill="${color}"/>`);
      }
      if (o.fitLine) {
        const ends = clipLine(o.fitLine.slope, o.fitLine.intercept);
        if (ends.length === 2) {
          sheet.polyline(ends.map(([x, y]) => [sx(x), sy(y)] as Pt), { color: "#111", w: 1.6 });
          if (o.fitLine.label) { const end: Pt = [sx(ends[1][0]), sy(ends[1][1])]; labelJobs.push({ text: o.fitLine.label, anchor: end, color: "#111", what: `추세선 라벨`, prefer: around(end, 18) }); }
        }
      }
      altParts.push(`산점도 ${o.id}: 점 ${o.points.length}개${o.fitLine ? `, 추세선 y = ${o.fitLine.slope}x + ${o.fitLine.intercept}` : ""}`);
    }
  });
  // 점은 선 위에 오도록 마지막에
  spec.objects.forEach((o, idx) => {
    if (o.kind !== "point") return;
    const color = COLORS[idx % COLORS.length];
    const [x, y] = o.at;
    if (!inRange(x, y)) issues.push({ code: "out_of_range", message: `점 ${o.id}(${x}, ${y}) 이 축 범위 밖입니다.` });
    const p: Pt = [sx(x), sy(y)];
    sheet.raw(`<circle cx="${f(p[0])}" cy="${f(p[1])}" r="4" fill="${o.open ? "#fff" : color}" stroke="${color}" stroke-width="2"/>`);
    if (o.label) labelJobs.push({ text: o.label, anchor: p, color, what: `점 ${o.id} 라벨`, prefer: around(p, 15) });
    altParts.push(`점 ${o.label ?? o.id} (${x}, ${y})`);
  });
  for (const job of labelJobs) {
    const spot = sheet.firstFree(job.prefer, job.text);
    if (!spot) { issues.push({ code: "label_collision", message: `${job.what} '${job.text}' 를 겹치지 않게 놓을 자리가 없습니다 — 축 범위를 넓히거나 라벨을 줄이세요.` }); continue; }
    sheet.label(spot[0], spot[1], job.text, job.what, { italic: true, size: 13, color: job.color });
  }
  const alt = `좌표평면(x ${ax.min}~${ax.max}, y ${ay.min}~${ay.max})${ax.title ? `, 가로축 ${ax.title}` : ""}${ay.title ? `, 세로축 ${ay.title}` : ""}. ${altParts.join("; ")}.`;
  return { svg: sheet.svg(alt), alt, issues: dedupe([...issues, ...sheet.uniqueIssues()]) };
}

/** 지문 참조 검사 — "point P", "(2, 1)" 좌표, "line ℓ", "f(x)/g(x)", "y = 2x − 3" 식, 축 제목·범위. */
export function lintPlaneAgainstText(spec: PlaneSpec, passage: string): FigureIssue[] {
  const issues: FigureIssue[] = [];
  const text = passage.replace(/\$/g, "").replace(/−/g, "-").replace(/\\frac\{(-?\d+)\}\{(\d+)\}/g, "$1/$2");
  const points = new Map<string, Pt>();
  const labels = new Set<string>();
  for (const o of spec.objects) {
    if (o.kind === "point") points.set(o.id, o.at);
    const lbl = o.kind === "scatter" ? o.fitLine?.label : o.label;
    if (lbl) labels.add(lbl.replace(/\s+/g, ""));
    labels.add(o.id);
  }
  const resolve = (r: PointRef): Pt => (typeof r === "string" ? points.get(r)! : r);
  const num = (t: string) => { const m = t.match(/^(-?\d+(?:\.\d+)?)(?:\/(\d+))?$/); return m ? Number(m[1]) / (m[2] ? Number(m[2]) : 1) : NaN; };
  const onSomething = (x: number, y: number): boolean => {
    for (const o of spec.objects) {
      if (o.kind === "point" && Math.abs(o.at[0] - x) < 1e-6 && Math.abs(o.at[1] - y) < 1e-6) return true;
      if (o.kind === "line") { const lp = lineParams(o, resolve); if ("vertical" in lp ? Math.abs(lp.vertical - x) < 1e-6 : Math.abs(lp.m * x + lp.b - y) < 1e-6) return true; }
      if (o.kind === "function" && Math.abs(evalFn(o.fn, o.params, x) - y) < 1e-6) return true;
      if (o.kind === "scatter" && o.points.some(([px, py]) => Math.abs(px - x) < 1e-6 && Math.abs(py - y) < 1e-6)) return true;
    }
    return false;
  };
  // 좌표 (a, b) — 점 객체이거나 어떤 그래프 위에 있어야 한다.
  for (const m of text.matchAll(/\((-?\d+(?:\.\d+)?(?:\/\d+)?),\s*(-?\d+(?:\.\d+)?(?:\/\d+)?)\)/g)) {
    const x = num(m[1]), y = num(m[2]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (!onSomething(x, y)) issues.push({ code: "ref_mismatch", message: `지문의 좌표 (${m[1]}, ${m[2]}) 가 그림의 점이나 그래프 위에 없습니다.` });
  }
  // point P / points A and B
  for (const m of text.matchAll(/\bpoints?\s+([A-Z])\b(?:\s*(?:and|,)\s*([A-Z])\b)?/g)) {
    for (const id of m.slice(1).filter(Boolean)) if (!points.has(id) && !labels.has(id)) issues.push({ code: "ref_missing", message: `지문의 점 '${id}' 가 그림에 없습니다.` });
  }
  // line ℓ / line k
  for (const m of text.matchAll(/\blines?\s+([a-zℓ])\b(?:\s*(?:and|,)\s*([a-zℓ])\b)?/gi)) {
    // "Lines x = 2 and y = -1" 의 x·y 는 변수다 — 직선 이름이 아니다.
    for (const id of m.slice(1).filter(Boolean)) if (!/^[xy]$/i.test(id) && !labels.has(id)) issues.push({ code: "ref_missing", message: `지문의 직선 '${id}' 가 그림에 없습니다(직선 객체의 label 로 두세요).` });
  }
  // f(x), g(x)
  for (const m of text.matchAll(/\b([fgh])\(x\)/g)) {
    if (!Array.from(labels).some((l) => l.startsWith(m[1]))) issues.push({ code: "ref_missing", message: `지문의 함수 ${m[1]}(x) 에 해당하는 그래프 라벨이 없습니다(label 을 '${m[1]}' 또는 'y = ${m[1]}(x)' 로).` });
  }
  // y = mx + b 식 — 어떤 직선/일차함수와 같아야 한다.
  for (const m of text.matchAll(/y\s*=\s*(-?\d+(?:\.\d+)?(?:\/\d+)?)?\s*x\s*([+-])\s*(\d+(?:\.\d+)?(?:\/\d+)?)(?![\d.x²^])/g)) {
    const slope = m[1] === undefined ? 1 : num(m[1]);
    const intercept = (m[2] === "-" ? -1 : 1) * num(m[3]);
    const has = spec.objects.some((o) => {
      if (o.kind === "line") { const lp = lineParams(o, resolve); return !("vertical" in lp) && Math.abs(lp.m - slope) < 1e-6 && Math.abs(lp.b - intercept) < 1e-6; }
      if (o.kind === "function" && o.fn === "linear") return Math.abs(o.params[0] - slope) < 1e-6 && Math.abs(o.params[1] - intercept) < 1e-6;
      if (o.kind === "scatter" && o.fitLine) return Math.abs(o.fitLine.slope - slope) < 1e-6 && Math.abs(o.fitLine.intercept - intercept) < 1e-6;
      return false;
    });
    if (!has) issues.push({ code: "ref_mismatch", message: `지문의 식 y = ${m[1] ?? ""}x ${m[2]} ${m[3]} 과 같은 직선이 그림에 없습니다.` });
  }
  // y = ax² + bx + c
  for (const m of text.matchAll(/y\s*=\s*(-?\d+(?:\.\d+)?)?\s*x(?:\^2|²)\s*(?:([+-])\s*(\d+(?:\.\d+)?)\s*x)?\s*(?:([+-])\s*(\d+(?:\.\d+)?))?(?![\d.x])/g)) {
    const a = m[1] === undefined ? 1 : Number(m[1]);
    const b = m[2] ? (m[2] === "-" ? -1 : 1) * Number(m[3]) : 0;
    const c = m[4] ? (m[4] === "-" ? -1 : 1) * Number(m[5]) : 0;
    const has = spec.objects.some((o) => o.kind === "function" && o.fn === "quadratic" && Math.abs(o.params[0] - a) < 1e-6 && Math.abs(o.params[1] - b) < 1e-6 && Math.abs(o.params[2] - c) < 1e-6);
    if (!has) issues.push({ code: "ref_mismatch", message: `지문의 이차식 y = ${a}x² + ${b}x + ${c} 과 같은 포물선이 그림에 없습니다.` });
  }
  // 좌표평면 문제에서 quadrant I~IV 는 정당한 수학 용어다. 배치 용어(region, northeast 등)만 막는다.
  if (/\b(northeast|northwest|southeast|southwest|region)\b/i.test(text)) {
    issues.push({ code: "wording", message: "지문에 배치 용어(region, northeast 등)가 있습니다 — 좌표·점 이름·직선 이름으로 부릅니다." });
  }
  return dedupe(issues);
}

