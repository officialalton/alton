// 표준 렌더링 엔진 — 템플릿 3: 좌표평면 (docs/2026-09-14-standard-rendering-engine-design.md 1-3)
//
// 객체 **id** 기반. AI 는 축 범위와 객체(점·직선·함수·선분·산점도)의 수학적 정의만 낸다. 격자·굵은 축·화살표·눈금 숫자·원점 O·
// 축 제목·라벨 자리(후보 중 겹치지 않는 첫 자리)는 여기서 정한다. 라벨을 놓을 자리가 없거나 잘리면 검증 실패.

import { dedupe, f, FONT, halfDiag, Sheet, type FigureIssue, type Pt } from "./_layout";

export type FnKind = "linear" | "quadratic" | "exponential" | "abs" | "sqrt" | "cubic" | "rational";
export type PointRef = string | Pt; // 점 객체 id 또는 좌표

export type PlaneObject =
  | { id: string; kind: "point"; at: Pt; label?: string; open?: boolean }
  | { id: string; kind: "line"; through?: [PointRef, PointRef]; slope?: number; intercept?: number; label?: string; style?: "solid" | "dashed" }
  | { id: string; kind: "function"; fn: FnKind; params: number[]; label?: string; domain?: [number, number]; style?: "solid" | "dashed" }
  | { id: string; kind: "segment"; from: PointRef; to: PointRef; label?: string; style?: "solid" | "dashed" }
  | { id: string; kind: "scatter"; points: Pt[]; fitLine?: { slope: number; intercept: number; label?: string } }
  /** 부등식 y (≤|<|≥|>) mx + b — 경계는 실선(≤,≥)/점선(<,>), 음영은 부등호 방향. 여러 개면 공통 영역이 겹쳐 진해진다. */
  | { id: string; kind: "inequality"; op: "<=" | "<" | ">=" | ">"; slope: number; intercept: number; label?: string }
  /** 조각함수 — 구간별 일차식, 끝점은 열림(open)/닫힘. */
  | { id: string; kind: "piecewise"; pieces: { from: number; to: number; slope: number; intercept: number; openFrom?: boolean; openTo?: boolean }[]; label?: string }
  /** 좌표기하 — 다각형(꼭짓점은 점 id 또는 좌표). 라벨은 도형 이름. */
  | { id: string; kind: "polygon"; vertices: PointRef[]; label?: string; fill?: boolean; style?: "solid" | "dashed" }
  /** 좌표기하 — 원(중심 점 id 또는 좌표, 반지름). */
  | { id: string; kind: "circle"; center: PointRef; radius: number; label?: string; style?: "solid" | "dashed" }
  /** 파생 점 — 선분의 중점 / 두 직선의 교점. 라벨을 붙이면 점으로 그린다. */
  | { id: string; kind: "midpoint"; of: [PointRef, PointRef]; label?: string }
  | { id: string; kind: "intersection"; of: [string, string]; label?: string }
  /** 변환 — 다각형(id)의 평행이동·대칭·확대. 상(image)은 점선 + 프라임 라벨(A′). */
  | { id: string; kind: "transform"; of: string; op: { type: "translate"; dx: number; dy: number } | { type: "reflect"; over: "x-axis" | "y-axis" | "y=x" | "y=-x" } | { type: "dilate"; k: number } | { type: "rotate"; deg: 90 | 180 | 270 }; label?: string; style?: "solid" | "dashed" };

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

/** AI 가 같은 뜻을 다른 모양으로 보내는 흔한 변형을 표준 모양으로 — axes:{xmin,xmax,…}, objects[].type→kind, line.points→through. 의미는 바꾸지 않는다. */
export function normalizePlaneInput(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const s = { ...(input as Record<string, unknown>) };
  const ax = s.axes as Record<string, unknown> | undefined;
  if (ax && (ax.xmin !== undefined || ax.xMin !== undefined) && ax.x === undefined) {
    const g = (a: string, b: string) => (ax[a] !== undefined ? ax[a] : ax[b]);
    s.axes = {
      x: { min: g("xmin", "xMin"), max: g("xmax", "xMax"), ...(g("xstep", "xStep") !== undefined ? { step: g("xstep", "xStep") } : {}), ...(g("xtitle", "xTitle") !== undefined ? { title: g("xtitle", "xTitle") } : {}) },
      y: { min: g("ymin", "yMin"), max: g("ymax", "yMax"), ...(g("ystep", "yStep") !== undefined ? { step: g("ystep", "yStep") } : {}), ...(g("ytitle", "yTitle") !== undefined ? { title: g("ytitle", "yTitle") } : {}) },
    };
  }
  if (Array.isArray(s.objects)) {
    s.objects = (s.objects as Record<string, unknown>[]).map((o, i) => {
      if (!o || typeof o !== "object") return o;
      const n = { ...o };
      if (n.kind === undefined && typeof n.type === "string") { n.kind = n.type; delete n.type; }
      if (n.id === undefined) n.id = `${String(n.kind ?? "obj")}${i + 1}`;
      if (n.kind === "line" && Array.isArray(n.points) && n.through === undefined && n.slope === undefined) { n.through = n.points; delete n.points; }
      if (n.kind === "point" && Array.isArray(n.position) && n.at === undefined) { n.at = n.position; delete n.position; }
      return n;
    });
  }
  for (const k of ["options", "correct_index", "correctIndex"]) delete s[k];
  return s;
}

export function validatePlane(input: unknown): { ok: true; spec: PlaneSpec } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "그림 데이터가 객체가 아닙니다." };
  const s = normalizePlaneInput(input) as Record<string, unknown>;
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
      case "inequality":
        if (!["<=", "<", ">=", ">"].includes(String(o.op)) || !isNum(o.slope) || !isNum(o.intercept)) return { ok: false, error: `부등식 ${o.id} 는 op(<=|<|>=|>) 와 slope/intercept 가 필요합니다.` };
        break;
      case "piecewise": {
        if (!Array.isArray(o.pieces) || o.pieces.length < 2 || o.pieces.length > 5) return { ok: false, error: `조각함수 ${o.id} 는 pieces 2~5개가 필요합니다.` };
        let prevTo: number | null = null;
        for (const pc of o.pieces as Record<string, unknown>[]) {
          if (!pc || !isNum(pc.from) || !isNum(pc.to) || pc.from >= pc.to || !isNum(pc.slope) || !isNum(pc.intercept)) return { ok: false, error: `조각함수 ${o.id} 의 각 조각은 from < to, slope, intercept 가 필요합니다.` };
          if (prevTo !== null && (pc.from as number) < prevTo - 1e-9) return { ok: false, error: `조각함수 ${o.id} 의 구간이 겹칩니다.` };
          prevTo = pc.to as number;
        }
        break;
      }
      case "polygon":
        if (!Array.isArray(o.vertices) || o.vertices.length < 3 || o.vertices.length > 8 || !o.vertices.every(refOk)) return { ok: false, error: `다각형 ${o.id} 의 vertices 는 점 id 또는 좌표 3~8개여야 합니다.` };
        break;
      case "circle":
        if (!refOk(o.center) || !isNum(o.radius) || (o.radius as number) <= 0) return { ok: false, error: `원 ${o.id} 는 center(점 id 또는 좌표)와 radius(>0) 가 필요합니다.` };
        break;
      case "midpoint":
        if (!Array.isArray(o.of) || o.of.length !== 2 || !o.of.every(refOk)) return { ok: false, error: `중점 ${o.id} 의 of 는 점 2개여야 합니다.` };
        break;
      case "intersection": {
        if (!Array.isArray(o.of) || o.of.length !== 2 || !o.of.every((x: unknown) => typeof x === "string" && objs.some((q) => q.id === x && q.kind === "line"))) return { ok: false, error: `교점 ${o.id} 의 of 는 직선 id 2개여야 합니다.` };
        break;
      }
      case "transform": {
        if (typeof o.of !== "string" || !objs.some((q) => q.id === o.of && q.kind === "polygon")) return { ok: false, error: `변환 ${o.id} 의 of 는 다각형 id 여야 합니다.` };
        const op = o.op as Record<string, unknown> | undefined;
        if (!op) return { ok: false, error: `변환 ${o.id} 의 op 가 필요합니다.` };
        if (op.type === "translate") { if (!isNum(op.dx) || !isNum(op.dy)) return { ok: false, error: "translate 는 dx, dy 가 필요합니다." }; }
        else if (op.type === "reflect") { if (!["x-axis", "y-axis", "y=x", "y=-x"].includes(String(op.over))) return { ok: false, error: "reflect.over 는 x-axis|y-axis|y=x|y=-x 입니다." }; }
        else if (op.type === "dilate") { if (!isNum(op.k) || (op.k as number) <= 0) return { ok: false, error: "dilate.k 는 0보다 큰 숫자입니다." }; }
        else if (op.type === "rotate") { if (![90, 180, 270].includes(Number(op.deg))) return { ok: false, error: "rotate.deg 는 90|180|270 입니다." }; }
        else return { ok: false, error: `변환 op.type 을 모릅니다: ${String(op.type)}` };
        break;
      }
      case "function": {
        const need: Record<FnKind, number> = { linear: 2, quadratic: 3, cubic: 4, exponential: 3, abs: 3, sqrt: 3, rational: 4 };
        if (!(String(o.fn) in need)) return { ok: false, error: `함수 ${o.id} 의 fn 은 linear|quadratic|exponential|abs|sqrt|cubic|rational 입니다.` };
        if (o.fn === "rational" && Math.abs((o.params as number[])[2] ?? 0) < 1e-12) return { ok: false, error: `유리함수 ${o.id} 의 분모 계수 c 는 0 이 아니어야 합니다((ax+b)/(cx+d)).` };
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
    case "rational": return (p[0] * x + p[1]) / (p[2] * x + p[3]);
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
    case "rational": return `y = (${poly([[p[0], "x"], [p[1], ""]])}) / (${poly([[p[2], "x"], [p[3], ""]])})`;
  }
}

/** 점 id → 좌표. 파생 점(중점·교점)도 푼다. */
export function resolvePoints(spec: PlaneSpec): Map<string, Pt> {
  const points = new Map<string, Pt>();
  for (const o of spec.objects) if (o.kind === "point") points.set(o.id, o.at);
  const res = (r: PointRef): Pt | null => (typeof r === "string" ? points.get(r) ?? null : r);
  // 파생 점은 순서에 상관없이 두 번 돈다(중점의 중점 정도까지).
  for (let pass = 0; pass < 2; pass++) {
    for (const o of spec.objects) {
      if (o.kind === "midpoint") { const a = res(o.of[0]), b = res(o.of[1]); if (a && b) points.set(o.id, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); }
      if (o.kind === "intersection") {
        const [l1, l2] = o.of.map((id) => spec.objects.find((q) => q.id === id)) as (Extract<PlaneObject, { kind: "line" }> | undefined)[];
        if (!l1 || !l2) continue;
        const a = lineParams(l1, (r) => res(r) ?? [0, 0]), b = lineParams(l2, (r) => res(r) ?? [0, 0]);
        if ("vertical" in a && "vertical" in b) continue;
        if ("vertical" in a && !("vertical" in b)) points.set(o.id, [a.vertical, b.m * a.vertical + b.b]);
        else if ("vertical" in b && !("vertical" in a)) points.set(o.id, [b.vertical, a.m * b.vertical + a.b]);
        else if (!("vertical" in a) && !("vertical" in b) && Math.abs(a.m - b.m) > 1e-12) { const x = (b.b - a.b) / (a.m - b.m); points.set(o.id, [x, a.m * x + a.b]); }
      }
    }
  }
  return points;
}

export function applyTransform(p: Pt, op: Extract<PlaneObject, { kind: "transform" }>["op"]): Pt {
  switch (op.type) {
    case "translate": return [p[0] + op.dx, p[1] + op.dy];
    case "reflect": return op.over === "x-axis" ? [p[0], -p[1]] : op.over === "y-axis" ? [-p[0], p[1]] : op.over === "y=x" ? [p[1], p[0]] : [-p[1], -p[0]];
    case "dilate": return [p[0] * op.k, p[1] * op.k];
    case "rotate": return op.deg === 90 ? [-p[1], p[0]] : op.deg === 180 ? [-p[0], -p[1]] : [p[1], -p[0]];
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
  // 원이 있으면 x·y 단위 길이를 같게(등축) — 원이 찌그러지지 않게. 남는 공간은 가운데 맞춤.
  const hasCircle = spec.objects.some((o) => o.kind === "circle");
  const plotW = W - padL - PAD, plotH = H - padB - PAD;
  const unit = hasCircle ? Math.min(plotW / (ax.max - ax.min), plotH / (ay.max - ay.min)) : null;
  const offX = unit ? (plotW - unit * (ax.max - ax.min)) / 2 : 0, offY = unit ? (plotH - unit * (ay.max - ay.min)) / 2 : 0;
  const sx = (x: number) => padL + offX + ((x - ax.min) / (ax.max - ax.min)) * (unit ? unit * (ax.max - ax.min) : plotW);
  const sy = (y: number) => H - padB - offY - ((y - ay.min) / (ay.max - ay.min)) * (unit ? unit * (ay.max - ay.min) : plotH);
  const inRange = (x: number, y: number) => x >= ax.min - 1e-9 && x <= ax.max + 1e-9 && y >= ay.min - 1e-9 && y <= ay.max + 1e-9;
  const points = resolvePoints(spec);
  const resolve = (r: PointRef): Pt => (typeof r === "string" ? points.get(r) ?? [NaN, NaN] : r);
  for (const o of spec.objects) if ((o.kind === "midpoint" || o.kind === "intersection") && !points.has(o.id)) issues.push({ code: "impossible", message: `파생 점 ${o.id} 을 구할 수 없습니다(평행한 직선의 교점 등).` });

  // ---- 격자·축(배경 — 충돌 검사 대상 아님, 단 축은 라벨과 겹치면 안 되므로 등록)
  const xs: number[] = [], ys: number[] = [];
  for (let x = Math.ceil(ax.min / xStep) * xStep; x <= ax.max + 1e-9; x += xStep) xs.push(Math.round(x * 1e6) / 1e6);
  for (let y = Math.ceil(ay.min / yStep) * yStep; y <= ay.max + 1e-9; y += yStep) ys.push(Math.round(y * 1e6) / 1e6);
  if (spec.grid !== false) {
    for (const x of xs) sheet.raw(`<line x1="${f(sx(x))}" y1="${f(sy(ay.max))}" x2="${f(sx(x))}" y2="${f(sy(ay.min))}" stroke="#9ca3af" stroke-width="0.8"/>`);
    for (const y of ys) sheet.raw(`<line x1="${f(sx(ax.min))}" y1="${f(sy(y))}" x2="${f(sx(ax.max))}" y2="${f(sy(y))}" stroke="#9ca3af" stroke-width="0.8"/>`);
  }
  const axX = ax.min <= 0 && ax.max >= 0 ? 0 : ax.min, axY = ay.min <= 0 && ay.max >= 0 ? 0 : ay.min;
  sheet.raw(`<defs><marker id="ax" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#111"/></marker></defs>`);
  sheet.raw(`<line x1="${f(sx(ax.min))}" y1="${f(sy(axY))}" x2="${f(sx(ax.max))}" y2="${f(sy(axY))}" stroke="#111" stroke-width="1.8" marker-end="url(#ax)"/>`);
  sheet.raw(`<line x1="${f(sx(axX))}" y1="${f(sy(ay.min))}" x2="${f(sx(axX))}" y2="${f(sy(ay.max))}" stroke="#111" stroke-width="1.8" marker-end="url(#ax)"/>`);
  sheet.registerSegment([sx(ax.min), sy(axY)], [sx(ax.max), sy(axY)]);
  sheet.registerSegment([sx(axX), sy(ay.min)], [sx(axX), sy(ay.max)]);
  const every = (n: number) => (n > 12 ? 3 : n > 8 ? 2 : 1);
  const ex = every(xs.length), ey = every(ys.length);
  // 눈금 숫자는 (간격 × 건너뛰기) 의 배수에만 — 인덱스 기준이면 -8, -5, -2, 1 … 처럼 0 을 지나지 않는 숫자가 나온다(E2E 실례).
  const onGrid = (v: number, unit: number) => Math.abs(v / unit - Math.round(v / unit)) < 1e-9;
  xs.forEach((x) => { if (Math.abs(x - axX) > 1e-9 && onGrid(x, xStep * ex)) sheet.raw(`<text x="${f(sx(x))}" y="${f(sy(axY) + 15)}" font-family="${FONT}" font-size="12" text-anchor="middle" fill="#111">${f(x)}</text>`); });
  ys.forEach((y) => { if (Math.abs(y - axY) > 1e-9 && onGrid(y, yStep * ey)) sheet.raw(`<text x="${f(sx(axX) - 6)}" y="${f(sy(y) + 4)}" font-family="${FONT}" font-size="12" text-anchor="end" fill="#111">${f(y)}</text>`); });
  if (axX === 0 && axY === 0) sheet.raw(`<text x="${f(sx(0) - 5)}" y="${f(sy(0) + 14)}" font-family="${FONT}" font-size="12" text-anchor="end" fill="#111" font-style="italic">O</text>`);
  sheet.raw(`<text x="${f(sx(ax.max) + 2)}" y="${f(sy(axY) + 4)}" font-family="${FONT}" font-size="12" fill="#111" font-style="italic">${ax.label ?? "x"}</text>`);
  sheet.raw(`<text x="${f(sx(axX))}" y="${f(sy(ay.max) - 6)}" font-family="${FONT}" font-size="12" text-anchor="middle" fill="#111" font-style="italic">${ay.label ?? "y"}</text>`);
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
  const ring = (p: Pt, d: number): Pt[] => [[p[0] + d, p[1] - d], [p[0] - d, p[1] - d], [p[0] + d, p[1] + d], [p[0] - d, p[1] + d], [p[0], p[1] - d - 4], [p[0], p[1] + d + 4], [p[0] + d + 4, p[1]], [p[0] - d - 4, p[1]]];
  /** 라벨 후보 — 가까운 고리부터 세 고리(규칙). 못 놓으면 거부. */
  const around = (p: Pt, d = 14): Pt[] => [...ring(p, d), ...ring(p, d + 10), ...ring(p, d + 20)];

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
      if (o.fn === "rational") {
        // 점근선(수직 x = −d/c, 수평 y = a/c)은 점선으로 — 표준 표현.
        const xv = -o.params[3] / o.params[2], yh = o.params[0] / o.params[2];
        if (xv > ax.min && xv < ax.max) sheet.raw(`<line x1="${f(sx(xv))}" y1="${f(sy(ay.max))}" x2="${f(sx(xv))}" y2="${f(sy(ay.min))}" stroke="${color}" stroke-width="1.2" stroke-dasharray="4 4"/>`);
        if (yh > ay.min && yh < ay.max) sheet.raw(`<line x1="${f(sx(ax.min))}" y1="${f(sy(yh))}" x2="${f(sx(ax.max))}" y2="${f(sy(yh))}" stroke="${color}" stroke-width="1.2" stroke-dasharray="4 4"/>`);
      }
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
    } else if (o.kind === "inequality") {
      // 경계선 + 음영. 음영은 반투명이라 여러 부등식이 겹치는 공통 영역이 더 진하다.
      const m = o.slope, b = o.intercept;
      const ends = clipLine(m, b);
      const dashed = o.op === "<" || o.op === ">";
      const above = o.op === ">=" || o.op === ">";
      // 음영 다각형 = 경계선의 잘린 두 끝점 + 부등호 쪽에 있는 프레임 모서리. 각으로 정렬해 볼록 다각형을 만든다.
      const corners: Pt[] = [[ax.min, ay.min], [ax.max, ay.min], [ax.max, ay.max], [ax.min, ay.max]];
      const side = corners.filter(([x, y]) => (above ? y - (m * x + b) >= -1e-9 : y - (m * x + b) <= 1e-9));
      const poly = [...ends, ...side];
      if (poly.length >= 3) {
        const cx0 = poly.reduce((a, q) => a + q[0], 0) / poly.length, cy0 = poly.reduce((a, q) => a + q[1], 0) / poly.length;
        poly.sort((p1, p2) => Math.atan2(p1[1] - cy0, p1[0] - cx0) - Math.atan2(p2[1] - cy0, p2[0] - cx0));
        sheet.raw(`<polygon points="${poly.map(([x, y]) => `${f(sx(x))},${f(sy(y))}`).join(" ")}" fill="${color}" fill-opacity="0.16"/>`);
      }
      if (ends.length < 2) issues.push({ code: "out_of_range", message: `부등식 ${o.id} 의 경계선이 축 범위 안에 보이지 않습니다.` });
      else {
        sheet.polyline(ends.map(([x, y]) => [sx(x), sy(y)] as Pt), { color, dashed });
        if (o.label) { const end: Pt = [sx(ends[1][0]), sy(ends[1][1])]; labelJobs.push({ text: o.label, anchor: end, color, what: `부등식 ${o.id} 라벨`, prefer: [[end[0] - halfDiag(o.label) - 4, end[1] - 12], [end[0] - halfDiag(o.label) - 4, end[1] + 12], ...around(end, 18)] }); }
      }
      altParts.push(`부등식 ${o.label ?? o.id}: y ${o.op === "<=" ? "≤" : o.op === ">=" ? "≥" : o.op} ${formatFn("linear", [m, b]).slice(4)} (${dashed ? "점선" : "실선"} 경계, ${above ? "위쪽" : "아래쪽"} 음영)`);
    } else if (o.kind === "piecewise") {
      for (const pc of o.pieces) {
        const y0 = pc.slope * pc.from + pc.intercept, y1 = pc.slope * pc.to + pc.intercept;
        if (!inRange(pc.from, y0) || !inRange(pc.to, y1)) issues.push({ code: "out_of_range", message: `조각함수 ${o.id} 의 구간 [${pc.from}, ${pc.to}] 끝점이 축 범위 밖입니다.` });
        sheet.polyline([[sx(pc.from), sy(y0)], [sx(pc.to), sy(y1)]], { color });
        // 끝점: 열림은 흰 속, 닫힘은 채움. 이웃 조각과 같은 점이면 닫힘 하나로.
        const dot = (x: number, y: number, open: boolean | undefined) => sheet.raw(`<circle cx="${f(sx(x))}" cy="${f(sy(y))}" r="4" fill="${open ? "#fff" : color}" stroke="${color}" stroke-width="2"/>`);
        dot(pc.from, y0, pc.openFrom); dot(pc.to, y1, pc.openTo);
      }
      if (o.label) { const last = o.pieces[o.pieces.length - 1]; const end: Pt = [sx(last.to), sy(last.slope * last.to + last.intercept)]; labelJobs.push({ text: o.label, anchor: end, color, what: `조각함수 ${o.id} 라벨`, prefer: around(end, 18) }); }
      altParts.push(`조각함수 ${o.label ?? o.id}: ${o.pieces.map((pc) => `${pc.openFrom ? "(" : "["}${pc.from}, ${pc.to}${pc.openTo ? ")" : "]"} 에서 ${formatFn("linear", [pc.slope, pc.intercept]).slice(4)}`).join("; ")}`);
    } else if (o.kind === "polygon" || o.kind === "transform") {
      const src = o.kind === "polygon" ? o : (spec.objects.find((q) => q.id === o.of) as Extract<PlaneObject, { kind: "polygon" }>);
      const verts = src.vertices.map(resolve).map((p) => (o.kind === "transform" ? applyTransform(p, o.op) : p));
      for (const [x, y] of verts) if (!inRange(x, y)) issues.push({ code: "out_of_range", message: `${o.kind === "transform" ? "변환된 " : ""}다각형 ${o.id} 의 꼭짓점 (${f(x)}, ${f(y)}) 이 축 범위 밖입니다 — 축 범위를 넓히세요.` });
      const scr = verts.map(([x, y]) => [sx(x), sy(y)] as Pt);
      const dashed = o.kind === "transform" ? o.style !== "solid" : o.style === "dashed";
      const fill = o.kind === "polygon" && o.fill;
      if (fill) sheet.raw(`<polygon points="${scr.map((p) => `${f(p[0])},${f(p[1])}`).join(" ")}" fill="${color}" fill-opacity="0.12"/>`);
      sheet.polyline([...scr, scr[0]], { color, dashed });
      // 꼭짓점 이름: 원 다각형은 점 id, 변환 상은 프라임(A′)
      const cxp = scr.reduce((a, p) => a + p[0], 0) / scr.length, cyp = scr.reduce((a, p) => a + p[1], 0) / scr.length;
      src.vertices.forEach((v, i) => {
        if (typeof v !== "string") return;
        const name = o.kind === "transform" ? `${v}′` : v;
        if (o.kind === "polygon" && spec.objects.some((q) => q.kind === "point" && q.id === v && q.label)) return; // 점 객체 라벨이 따로 있으면 그것을 쓴다
        const p = scr[i]; const dx = p[0] - cxp, dy = p[1] - cyp; const L = Math.hypot(dx, dy) || 1;
        sheet.raw(`<circle cx="${f(p[0])}" cy="${f(p[1])}" r="3.5" fill="${color}"/>`);
        labelJobs.push({ text: name, anchor: p, color, what: `꼭짓점 ${name}`, prefer: [[p[0] + (dx / L) * 14, p[1] + (dy / L) * 14], ...around(p, 14)] });
      });
      // 꼭짓점이 모두 이름 붙은 점이면 도형 이름 라벨(ABC)은 중복이라 두지 않는다(작은 삼각형 안에서 변과 겹친다 — E2E 실례).
      const allNamed = src.vertices.every((v) => typeof v === "string");
      if (o.label && !allNamed) labelJobs.push({ text: o.label, anchor: [cxp, cyp], color, what: `도형 ${o.id} 라벨`, prefer: [[cxp, cyp], ...around([cxp, cyp], 16)] });
      const opKo = o.kind === "transform" ? (o.op.type === "translate" ? `(${o.op.dx}, ${o.op.dy}) 평행이동` : o.op.type === "reflect" ? `${o.op.over} 대칭` : o.op.type === "dilate" ? `${o.op.k}배 확대` : `${o.op.deg}° 회전`) : "";
      altParts.push(o.kind === "polygon" ? `다각형 ${o.label ?? o.id}: ${src.vertices.map((v, i) => `${typeof v === "string" ? v : ""}(${f(verts[i][0])}, ${f(verts[i][1])})`).join(", ")}` : `${o.of} 의 ${opKo} 상 ${o.id}: ${verts.map(([x, y]) => `(${f(x)}, ${f(y)})`).join(", ")}`);
    } else if (o.kind === "circle") {
      const c = resolve(o.center);
      const rx = Math.abs(sx(c[0] + o.radius) - sx(c[0])), ry = Math.abs(sy(c[1] + o.radius) - sy(c[1]));
      if (!inRange(c[0] - o.radius, c[1] - o.radius) || !inRange(c[0] + o.radius, c[1] + o.radius)) issues.push({ code: "out_of_range", message: `원 ${o.id} 이 축 범위를 벗어납니다 — 축 범위를 넓히세요.` });
      if (Math.abs(rx - ry) > 0.5) issues.push({ code: "impossible", message: `원 ${o.id} 이 찌그러집니다 — x·y 축의 단위 길이가 같아야 합니다(범위 폭을 같은 비율로).` });
      sheet.raw(`<ellipse cx="${f(sx(c[0]))}" cy="${f(sy(c[1]))}" rx="${f(rx)}" ry="${f(ry)}" fill="none" stroke="${color}" stroke-width="2"${o.style === "dashed" ? ' stroke-dasharray="6 4"' : ""}/>`);
      for (let i = 0; i < 24; i++) sheet.registerSegment([sx(c[0]) + rx * Math.cos((i * Math.PI) / 12), sy(c[1]) - ry * Math.sin((i * Math.PI) / 12)], [sx(c[0]) + rx * Math.cos(((i + 1) * Math.PI) / 12), sy(c[1]) - ry * Math.sin(((i + 1) * Math.PI) / 12)]);
      sheet.raw(`<circle cx="${f(sx(c[0]))}" cy="${f(sy(c[1]))}" r="3" fill="${color}"/>`);
      if (o.label) labelJobs.push({ text: o.label, anchor: [sx(c[0]), sy(c[1]) - ry], color, what: `원 ${o.id} 라벨`, prefer: around([sx(c[0]) + rx * 0.72, sy(c[1]) - ry * 0.72], 12) });
      altParts.push(`원 ${o.label ?? o.id}: 중심 (${f(c[0])}, ${f(c[1])}), 반지름 ${f(o.radius)}`);
    } else if (o.kind === "midpoint" || o.kind === "intersection") {
      const p = points.get(o.id);
      if (p && o.label) { const q: Pt = [sx(p[0]), sy(p[1])]; sheet.raw(`<circle cx="${f(q[0])}" cy="${f(q[1])}" r="4" fill="${color}"/>`); labelJobs.push({ text: o.label, anchor: q, color, what: `점 ${o.id} 라벨`, prefer: around(q, 15) }); }
      if (p) altParts.push(`${o.kind === "midpoint" ? "중점" : "교점"} ${o.label ?? o.id} (${f(p[0])}, ${f(p[1])})`);
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
export function lintPlaneAgainstText(spec: PlaneSpec, passage: string, options?: string[] | null): FigureIssue[] {
  const issues: FigureIssue[] = [];
  const text = passage.replace(/\$/g, "").replace(/−/g, "-").replace(/\\frac\{(-?\d+)\}\{(\d+)\}/g, "$1/$2");
  // 선택지(부등식 문항은 선택지가 부등식인 경우가 많다)에서는 **부등호·경계 포함 여부만** 대조한다. 좌표는 지문에서만.
  const optionText = (options ?? []).join("\n").replace(/\$/g, "").replace(/−/g, "-");
  // 선택지의 좌표가 그림에 점으로 찍혀 있으면 정답이 드러난다(E2E 실례: 네 선택지 점을 모두 그림에 찍음).
  if (optionText) {
    for (const m of optionText.matchAll(/\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)/g)) {
      const x = Number(m[1]), y = Number(m[2]);
      if (spec.objects.some((o) => o.kind === "point" && Math.abs(o.at[0] - x) < 1e-9 && Math.abs(o.at[1] - y) < 1e-9)) issues.push({ code: "option_leak", message: `선택지의 점 (${m[1]}, ${m[2]}) 이 그림에 찍혀 있습니다 — 선택지 좌표는 그림에 넣지 않습니다(정답 노출).` });
    }
  }
  if (optionText && spec.objects.some((o) => o.kind === "inequality")) {
    for (const m of optionText.matchAll(/y\s*(<=|>=|<|>|≤|≥)\s*(-?\d+(?:\.\d+)?(?:\/\d+)?)?\s*x\s*([+-])\s*(\d+(?:\.\d+)?(?:\/\d+)?)(?![\d.x²^])/g)) {
      const op = m[1] === "≤" ? "<=" : m[1] === "≥" ? ">=" : m[1];
      const slope = m[2] === undefined ? 1 : Number(m[2].includes("/") ? m[2].split("/").map(Number).reduce((a, b) => a / b) : m[2]);
      const intercept = (m[3] === "-" ? -1 : 1) * Number(m[4].includes("/") ? m[4].split("/").map(Number).reduce((a, b) => a / b) : m[4]);
      const sameLine = spec.objects.filter((o) => o.kind === "inequality" && Math.abs(o.slope - slope) < 1e-6 && Math.abs(o.intercept - intercept) < 1e-6) as Extract<PlaneObject, { kind: "inequality" }>[];
      // 같은 경계선의 부등식이 그림에 있는데 부등호(방향·경계 포함)가 다르면 — 정답 선택지가 그림과 어긋날 수 있으니 확인 대상.
      if (sameLine.length && !sameLine.some((o) => o.op === op)) issues.push({ code: "option_mismatch", message: `선택지의 'y ${m[1]} ${m[2] ?? ""}x ${m[3]} ${m[4]}' 는 그림의 같은 경계선 부등식(${sameLine.map((o) => o.op).join(", ")})과 부등호·경계 포함이 다릅니다 — 정답 선택지가 그림과 맞는지 확인하세요.` });
    }
  }
  const labels = new Set<string>();
  for (const o of spec.objects) {
    const lbl = o.kind === "scatter" ? o.fitLine?.label : o.label;
    if (lbl) labels.add(lbl.replace(/\s+/g, ""));
    labels.add(o.id);
  }
  const resolve = (r: PointRef): Pt => (typeof r === "string" ? pts.get(r) ?? [NaN, NaN] : r);
  const num = (t: string) => { const m = t.match(/^(-?\d+(?:\.\d+)?)(?:\/(\d+))?$/); return m ? Number(m[1]) / (m[2] ? Number(m[2]) : 1) : NaN; };
  const onSomething = (x: number, y: number): boolean => {
    for (const [, p] of pts) if (Math.abs(p[0] - x) < 1e-6 && Math.abs(p[1] - y) < 1e-6) return true;
    for (const o of spec.objects) {
      if (o.kind === "polygon" && o.vertices.some((v) => { const p = typeof v === "string" ? P(v) : v; return p && Math.abs(p[0] - x) < 1e-6 && Math.abs(p[1] - y) < 1e-6; })) return true;
      if (o.kind === "transform") { const src = spec.objects.find((q) => q.id === o.of) as Extract<PlaneObject, { kind: "polygon" }> | undefined; if (src && src.vertices.some((v) => { const p0 = typeof v === "string" ? P(v) : v; if (!p0) return false; const p = applyTransform(p0, o.op); return Math.abs(p[0] - x) < 1e-6 && Math.abs(p[1] - y) < 1e-6; })) return true; }
      if (o.kind === "circle") { const c = typeof o.center === "string" ? P(o.center) : o.center; if (c && Math.abs(Math.hypot(x - c[0], y - c[1]) - o.radius) < 1e-6) return true; if (c && Math.abs(c[0] - x) < 1e-6 && Math.abs(c[1] - y) < 1e-6) return true; }
      if (o.kind === "point" && Math.abs(o.at[0] - x) < 1e-6 && Math.abs(o.at[1] - y) < 1e-6) return true;
      if (o.kind === "line") { const lp = lineParams(o, resolve); if ("vertical" in lp ? Math.abs(lp.vertical - x) < 1e-6 : Math.abs(lp.m * x + lp.b - y) < 1e-6) return true; }
      if (o.kind === "function" && Math.abs(evalFn(o.fn, o.params, x) - y) < 1e-6) return true;
      if (o.kind === "scatter" && o.points.some(([px, py]) => Math.abs(px - x) < 1e-6 && Math.abs(py - y) < 1e-6)) return true;
    }
    return false;
  };
  const pts = resolvePoints(spec);
  const P = (id: string) => pts.get(id);
  // 기울기·거리·넓이·중점 — 지문의 값과 계산값이 같아야 한다.
  const fmtN = (v: number) => Math.round(v * 1e6) / 1e6;
  const numTok = (t: string) => { const m = t.match(/^(-?\d+(?:\.\d+)?)(?:\/(\d+))?$/); return m ? Number(m[1]) / (m[2] ? Number(m[2]) : 1) : NaN; };
  for (const m of text.matchAll(/\bslope\s+of\s+(?:line\s+|segment\s+)?([A-Za-zℓ]{1,2})\s+is\s+(-?\d+(?:\.\d+)?(?:\/\d+)?)/g)) {
    const [name, valS] = [m[1], m[2]];
    let slope: number | null = null;
    if (name.length === 2 && P(name[0]) && P(name[1])) { const a = P(name[0])!, b = P(name[1])!; slope = Math.abs(b[0] - a[0]) < 1e-12 ? null : (b[1] - a[1]) / (b[0] - a[0]); }
    else { const ln = spec.objects.find((o) => o.kind === "line" && (o.label === name || o.id === name)) as Extract<PlaneObject, { kind: "line" }> | undefined; if (ln) { const lp = lineParams(ln, (r) => (typeof r === "string" ? P(r) ?? [0, 0] : r)); slope = "vertical" in lp ? null : lp.m; } }
    if (slope !== null && Math.abs(slope - numTok(valS)) > 1e-6) issues.push({ code: "ref_mismatch", message: `지문은 ${name} 의 기울기를 ${valS} 라 하지만 그림에서는 ${fmtN(slope)} 입니다.` });
  }
  for (const m of text.matchAll(/\b([A-Z])([A-Z])\s*=\s*(\d+(?:\.\d+)?|√\d+)\b/g)) {
    const a = P(m[1]), b = P(m[2]); if (!a || !b) continue;
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const want = m[3].startsWith("√") ? Math.sqrt(Number(m[3].slice(1))) : Number(m[3]);
    if (Math.abs(d - want) > 1e-6) issues.push({ code: "ref_mismatch", message: `지문은 ${m[1]}${m[2]} = ${m[3]} 인데 좌표로 계산한 길이는 ${fmtN(d)} 입니다.` });
  }
  for (const m of text.matchAll(/\bmidpoint\s+of\s+(?:segment\s+)?([A-Z])([A-Z])\s+is\s+\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)/g)) {
    const a = P(m[1]), b = P(m[2]); if (!a || !b) continue;
    const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    if (Math.abs(mid[0] - Number(m[3])) > 1e-6 || Math.abs(mid[1] - Number(m[4])) > 1e-6) issues.push({ code: "ref_mismatch", message: `지문은 ${m[1]}${m[2]} 의 중점을 (${m[3]}, ${m[4]}) 라 하지만 계산하면 (${fmtN(mid[0])}, ${fmtN(mid[1])}) 입니다.` });
  }
  for (const m of text.matchAll(/\barea\s+of\s+(?:triangle|polygon|quadrilateral|rectangle|square)\s+([A-Z]{3,8})\s+is\s+(\d+(?:\.\d+)?)/gi)) {
    const vs = Array.from(m[1]).map((c) => P(c)); if (vs.some((v) => !v)) continue;
    let area = 0; for (let i = 0; i < vs.length; i++) { const a = vs[i]!, b = vs[(i + 1) % vs.length]!; area += a[0] * b[1] - b[0] * a[1]; } area = Math.abs(area) / 2;
    if (Math.abs(area - Number(m[2])) > 1e-6) issues.push({ code: "ref_mismatch", message: `지문은 ${m[1]} 의 넓이를 ${m[2]} 라 하지만 좌표로 계산하면 ${fmtN(area)} 입니다.` });
  }
  for (const m of text.matchAll(/\b(?:polygon|triangle|quadrilateral|rectangle|square|parallelogram)\s+([A-Z]{3,8})\b/g)) for (const ch of m[1]) if (!pts.has(ch)) issues.push({ code: "ref_missing", message: `지문의 도형 ${m[1]} 의 점 '${ch}' 가 그림에 없습니다.` });
  for (const m of text.matchAll(/\b([A-Z])([A-Z])\s+(?:is\s+)?(parallel|perpendicular)\s+to\s+([A-Z])([A-Z])\b/g)) {
    const a = P(m[1]), b = P(m[2]), c = P(m[4]), d = P(m[5]); if (!a || !b || !c || !d) continue;
    const v1: Pt = [b[0] - a[0], b[1] - a[1]], v2: Pt = [d[0] - c[0], d[1] - c[1]];
    const cross = v1[0] * v2[1] - v1[1] * v2[0], dot = v1[0] * v2[0] + v1[1] * v2[1];
    if (m[3] === "parallel" && Math.abs(cross) > 1e-6) issues.push({ code: "ref_mismatch", message: `지문은 ${m[1]}${m[2]} ∥ ${m[4]}${m[5]} 라 하지만 좌표상 평행하지 않습니다.` });
    if (m[3] === "perpendicular" && Math.abs(dot) > 1e-6) issues.push({ code: "ref_mismatch", message: `지문은 ${m[1]}${m[2]} ⟂ ${m[4]}${m[5]} 라 하지만 좌표상 수직이 아닙니다.` });
  }
  // 변환 — "translated 3 units to the right and 2 units up", "reflected across the x-axis", "dilated by a scale factor of 2"
  const tr = spec.objects.filter((o) => o.kind === "transform") as Extract<PlaneObject, { kind: "transform" }>[];
  if (tr.length) {
    const t0 = tr[0];
    const mt = text.match(/translated\s+(\d+)\s+units?\s+(?:to the\s+)?(right|left)(?:\s+and\s+(\d+)\s+units?\s+(up|down))?/i);
    if (mt && t0.op.type === "translate") {
      const dx = (mt[2].toLowerCase() === "left" ? -1 : 1) * Number(mt[1]); const dy = mt[3] ? (mt[4].toLowerCase() === "down" ? -1 : 1) * Number(mt[3]) : 0;
      if (Math.abs(dx - t0.op.dx) > 1e-9 || Math.abs(dy - t0.op.dy) > 1e-9) issues.push({ code: "ref_mismatch", message: `지문의 평행이동(${dx}, ${dy}) 과 그림의 변환(${t0.op.dx}, ${t0.op.dy}) 이 다릅니다.` });
    } else if (mt && t0.op.type !== "translate") issues.push({ code: "ref_mismatch", message: "지문은 평행이동을 말하지만 그림의 변환은 다른 종류입니다." });
    const mr = text.match(/reflected\s+(?:across|over)\s+the\s+(x-axis|y-axis|line\s+y\s*=\s*-?x)/i);
    if (mr && (t0.op.type !== "reflect" || !mr[1].toLowerCase().replace(/\s|line/g, "").includes(t0.op.over.replace(/\s/g, "")))) issues.push({ code: "ref_mismatch", message: `지문의 대칭(${mr[1]}) 과 그림의 변환이 다릅니다.` });
    const md = text.match(/scale factor of\s+(\d+(?:\.\d+)?(?:\/\d+)?)/i);
    if (md && (t0.op.type !== "dilate" || Math.abs(numTok(md[1]) - t0.op.k) > 1e-9)) issues.push({ code: "ref_mismatch", message: `지문의 확대 배율 ${md[1]} 과 그림의 변환이 다릅니다.` });
  }
  // 좌표 (a, b) — 점 객체이거나 어떤 그래프 위에 있어야 한다.
  for (const m of text.matchAll(/\((-?\d+(?:\.\d+)?(?:\/\d+)?),\s*(-?\d+(?:\.\d+)?(?:\/\d+)?)\)/g)) {
    const x = num(m[1]), y = num(m[2]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (!onSomething(x, y)) issues.push({ code: "ref_mismatch", message: `지문의 좌표 (${m[1]}, ${m[2]}) 가 그림의 점이나 그래프 위에 없습니다.` });
  }
  // point P / points A and B
  for (const m of text.matchAll(/\bpoints?\s+([A-Z])\b(?:\s*(?:and|,)\s*([A-Z])\b)?/g)) {
    for (const id of m.slice(1).filter(Boolean)) if (!pts.has(id) && !labels.has(id)) issues.push({ code: "ref_missing", message: `지문의 점 '${id}' 가 그림에 없습니다.` });
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
  // y ≤ mx + b / y > mx + b — 같은 부등식 객체가 있어야 한다.
  for (const m of text.matchAll(/y\s*(<=|>=|<|>|≤|≥)\s*(-?\d+(?:\.\d+)?(?:\/\d+)?)?\s*x\s*([+-])\s*(\d+(?:\.\d+)?(?:\/\d+)?)(?![\d.x²^])/g)) {
    const op = m[1] === "≤" ? "<=" : m[1] === "≥" ? ">=" : m[1];
    const slope = m[2] === undefined ? 1 : num(m[2]);
    const intercept = (m[3] === "-" ? -1 : 1) * num(m[4]);
    const has = spec.objects.some((o) => o.kind === "inequality" && o.op === op && Math.abs(o.slope - slope) < 1e-6 && Math.abs(o.intercept - intercept) < 1e-6);
    if (!has) issues.push({ code: "ref_mismatch", message: `지문의 부등식 y ${m[1]} ${m[2] ?? ""}x ${m[3]} ${m[4]} 과 같은 음영 영역이 그림에 없습니다.` });
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

