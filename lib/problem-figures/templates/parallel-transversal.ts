// 표준 렌더링 엔진 — 템플릿 1: 평행선·횡단선·각도 (docs/2026-09-14-standard-rendering-engine-design.md 1-4)
//
// AI 는 **관계만** 낸다(평행선 이름, 횡단선 이름, 교점 이름, 어느 교점·어느 사분면에 어떤 각). 좌표·선 굵기·호·직각
// 표시·라벨 자리·여백은 여기서 정한다. 라벨이 선·호·다른 라벨과 겹치거나 화면 밖이면 **자동으로 밀지 않고 검증 실패**로
// 돌려준다 — 그런 그림은 공개되면 안 된다.

export type Region = "NE" | "NW" | "SE" | "SW";

export type ParallelTransversalSpec = {
  type: "parallel_transversal";
  /** 평행선 이름, 위→아래. 정확히 2개. */
  parallel: [string, string];
  /** 횡단선 1~2개. slant: 좌상→우하(right, 기본) 또는 우상→좌하(left). */
  transversals: { id: string; slant?: "left" | "right" }[];
  /** 교점 이름 — 두 선(평행선 하나 + 횡단선 하나)의 교점. */
  points?: { id: string; on: [string, string] }[];
  /** 각 — 어느 교점(두 선), 어느 사분면, 라벨. right 면 직각 표시. */
  angles: { at: [string, string]; region: Region; label?: string; right?: boolean }[];
  notToScale?: boolean;
};

import { ARC_R, dedupe, LABEL_SIZE, labelWidth, RIGHT_R, Sheet, type FigureIssue, type Pt } from "./_layout";
export type { FigureIssue } from "./_layout";

const W = 360;
const PAD = 36;
const TOP_Y = 78;
const MIN_GAP = 94; // 평행선 기본 간격 — 사이에 놓이는 라벨이 크면 늘린다(규칙, 보정 아님)
const SLANT_DEG = 55;
const LABEL_R = 30;

/**
 * 모델이 자주 내는 옛 각 표기를 표준 모양으로 옮긴다(2026-09-15): {line, quadrant, text, at:'A'} → {at:[평행선, 횡단선], region, label}.
 * 점 이름(at:'A')이 있으면 points 에서 교점을 찾고, 없으면 line 이 평행선이고 횡단선이 하나일 때만 짝을 만든다. 못 옮기면 그대로 두어 검증이 사유를 말한다.
 */
export function normalizeParallelTransversalInput(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const s = { ...(input as Record<string, unknown>) };
  if (!Array.isArray(s.angles)) return s;
  const parallel = Array.isArray(s.parallel) ? (s.parallel as unknown[]).map(String) : [];
  const transversals = Array.isArray(s.transversals) ? (s.transversals as { id?: unknown }[]).map((t) => String(t?.id ?? "")) : [];
  // points: 교점이 아닌 점(선 하나 위) 은 이 템플릿에 자리가 없어 뺀다. 선 3개가 만난다고 쓴 점은 평행선 하나 + 첫 횡단선로 줄인다.
  if (Array.isArray(s.points)) {
    s.points = (s.points as unknown[])
      .map((raw) => {
        if (!raw || typeof raw !== "object") return raw;
        const pt = { ...(raw as Record<string, unknown>) };
        const on = Array.isArray(pt.on) ? (pt.on as unknown[]).map(String) : typeof pt.on === "string" ? pt.on.split(/[^\w]+/).filter(Boolean) : Array.isArray(pt.lines) ? (pt.lines as unknown[]).map(String) : [];
        const par = on.find((x) => parallel.includes(x));
        const tr = on.find((x) => transversals.includes(x));
        if (par && tr) pt.on = [par, tr];
        delete pt.lines;
        return pt;
      })
      .filter((pt) => pt && typeof pt === "object" && Array.isArray((pt as { on?: unknown }).on) && ((pt as { on: unknown[] }).on).length === 2);
  }
  const points = Array.isArray(s.points) ? (s.points as { id?: unknown; on?: unknown }[]) : [];
  s.angles = (s.angles as unknown[]).map((raw) => {
    if (!raw || typeof raw !== "object") return raw;
    const a = { ...(raw as Record<string, unknown>) };
    if (a.label === undefined && typeof a.text === "string") { a.label = a.text; delete a.text; }
    if (a.region === undefined && typeof a.quadrant === "string") { a.region = String(a.quadrant).toUpperCase(); delete a.quadrant; }
    if (!Array.isArray(a.at)) {
      const pointId = typeof a.at === "string" ? a.at : typeof a.point === "string" ? a.point : null;
      const pt = pointId ? points.find((p) => String(p.id) === pointId) : undefined;
      if (pt && Array.isArray(pt.on) && pt.on.length === 2) a.at = [String(pt.on[0]), String(pt.on[1])];
      else if (typeof a.line === "string" && parallel.includes(a.line) && transversals.length === 1) a.at = [a.line, transversals[0]];
      else if (typeof a.line === "string" && transversals.includes(a.line) && parallel.length === 2 && typeof a.parallel === "string") a.at = [String(a.parallel), a.line];
    }
    delete a.line; delete a.point;
    return a;
  });
  return s;
}

export function validateParallelTransversal(rawInput: unknown): { ok: true; spec: ParallelTransversalSpec } | { ok: false; error: string } {
  const input = normalizeParallelTransversalInput(rawInput);
  if (!input || typeof input !== "object") return { ok: false, error: "그림 데이터가 객체가 아닙니다." };
  const s = input as Record<string, unknown>;
  if (s.type !== "parallel_transversal") return { ok: false, error: "type 이 parallel_transversal 이 아닙니다." };
  const isName = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0 && v.trim().length <= 6;
  if (!Array.isArray(s.parallel) || s.parallel.length !== 2 || !s.parallel.every(isName)) {
    return { ok: false, error: "parallel 은 평행선 이름 2개(위, 아래)여야 합니다. 평행선이 3개 이상이면 이 템플릿으로 그릴 수 없습니다." };
  }
  if (!Array.isArray(s.transversals) || s.transversals.length < 1 || s.transversals.length > 2) {
    return { ok: false, error: "transversals 는 횡단선 1~2개여야 합니다." };
  }
  for (const t of s.transversals as Record<string, unknown>[]) {
    if (!t || !isName(t.id)) return { ok: false, error: "transversals[].id 가 필요합니다." };
    if (t.slant !== undefined && t.slant !== "left" && t.slant !== "right") return { ok: false, error: "transversals[].slant 는 left|right 입니다." };
  }
  const lineIds = new Set<string>([...(s.parallel as string[]), ...(s.transversals as { id: string }[]).map((t) => t.id)]);
  if (lineIds.size !== 2 + (s.transversals as unknown[]).length) return { ok: false, error: "선 이름이 중복됩니다." };
  const isPair = (p: unknown): p is [string, string] => Array.isArray(p) && p.length === 2 && p.every(isName);
  const pairOk = (p: [string, string]) => {
    const onParallel = p.filter((x) => (s.parallel as string[]).includes(x)).length;
    const onTrans = p.filter((x) => (s.transversals as { id: string }[]).some((t) => t.id === x)).length;
    return onParallel === 1 && onTrans === 1;
  };
  if (s.points !== undefined) {
    if (!Array.isArray(s.points)) return { ok: false, error: "points 는 배열이어야 합니다." };
    for (const p of s.points as Record<string, unknown>[]) {
      if (!p || !isName(p.id) || !isPair(p.on)) return { ok: false, error: "points[] 는 id 와 on:[평행선, 횡단선] 이 필요합니다." };
      if (!pairOk(p.on)) return { ok: false, error: `점 ${String(p.id)} 의 on 은 평행선 하나와 횡단선 하나여야 합니다.` };
    }
  }
  if (!Array.isArray(s.angles)) return { ok: false, error: "angles 배열이 필요합니다(비어 있어도 됨)." };
  for (const a of s.angles as Record<string, unknown>[]) {
    if (!a || !isPair(a.at) || !["NE", "NW", "SE", "SW"].includes(String(a.region))) {
      return { ok: false, error: "angles[] 는 at:[평행선, 횡단선] 과 region(NE|NW|SE|SW) 이 필요합니다." };
    }
    if (!pairOk(a.at)) return { ok: false, error: `각의 at ${JSON.stringify(a.at)} 은 평행선 하나와 횡단선 하나여야 합니다.` };
    if (a.label !== undefined && typeof a.label !== "string") return { ok: false, error: "angles[].label 은 문자열입니다." };
    if (!a.right && !(typeof a.label === "string" && a.label.trim())) return { ok: false, error: "각은 label 이 있거나 right(직각) 여야 합니다." };
  }
  return { ok: true, spec: s as unknown as ParallelTransversalSpec };
}

export function renderParallelTransversal(spec: ParallelTransversalSpec): { svg: string; alt: string; issues: FigureIssue[] } {
  const sheet = new Sheet(W, 250);
  const issues = sheet.issues;
  const line = (a: Pt, b: Pt) => sheet.line(a, b);
  const putLabel = (x: number, y: number, t: string, what: string, italic = false) => sheet.label(x, y, t, what, { italic });

  // ---- 배치 계산: 라벨이 필요한 반지름과 두 평행선 사이 간격(사이에 놓이는 라벨 높이에 맞춰 늘린다)
  const slant = (SLANT_DEG * Math.PI) / 180;
  const halfAcute = slant / 2, halfObtuse = (Math.PI - slant) / 2;
  const labelRadius = (label: string, wedgeHalf: number, right?: boolean) => {
    const w = labelWidth(label);
    const diag = Math.hypot(w, LABEL_SIZE + 2) / 2;
    return Math.max(LABEL_R, (diag + 4) / Math.max(Math.sin(wedgeHalf), 0.2), (right ? RIGHT_R * Math.SQRT2 : ARC_R) + diag + 3);
  };
  const wedgeHalfOf = (region: Region, right: boolean) => ((region === "NW" || region === "SE") === right ? halfAcute : halfObtuse);
  let innerTop = 0, innerBottom = 0;
  for (const a of spec.angles) {
    if (!a.label) continue;
    const t = spec.transversals.find((tr) => a.at.includes(tr.id))!;
    const idx = spec.transversals.indexOf(t);
    const rightSlant = (t.slant ?? (idx === 0 ? "right" : (spec.transversals[0].slant ?? "right"))) === "right";
    const half = wedgeHalfOf(a.region, rightSlant);
    const r = labelRadius(a.label, half, a.right);
    const vertical = r * Math.sin(half) + (LABEL_SIZE + 2) / 2; // 라벨 상자의 세로 도달 거리(대략)
    const onTop = a.at.includes(spec.parallel[0]);
    const inner = onTop ? a.region === "SE" || a.region === "SW" : a.region === "NE" || a.region === "NW";
    if (inner) {
      if (onTop) innerTop = Math.max(innerTop, vertical);
      else innerBottom = Math.max(innerBottom, vertical);
    }
  }
  const gap = Math.max(MIN_GAP, Math.ceil(innerTop + innerBottom + 12));
  const LINE_Y: [number, number] = [TOP_Y, TOP_Y + gap];
  const H = LINE_Y[1] + 78;
  sheet.height = H;

  // ---- 평행선
  const slantMain = (spec.transversals[0].slant ?? "right") === "right";
  LINE_Y.forEach((y) => line([PAD, y], [W - PAD, y]));
  // ---- 횡단선(1~2) — 두 번째는 반대 기울기·중심 오프셋
  const inter = new Map<string, Pt>(); // key `${parallel}|${transversal}`
  const transDir = new Map<string, Pt>(); // 아래쪽으로 향하는 단위 방향
  spec.transversals.forEach((t, i) => {
    // 두 번째 횡단선은 기본으로 첫 번째와 같은 기울기(나란한 두 횡단선) — 반대로 두면 두 평행선 사이에서 서로 교차한다.
    const right = (t.slant ?? (i === 0 ? "right" : slantMain ? "right" : "left")) === "right";
    const xMid = spec.transversals.length === 1 ? 190 : i === 0 ? 150 : 230;
    const dx = (LINE_Y[1] - LINE_Y[0]) / 2 / Math.tan(slant);
    const top: Pt = [right ? xMid - dx : xMid + dx, LINE_Y[0]];
    const bottom: Pt = [right ? xMid + dx : xMid - dx, LINE_Y[1]];
    const dir: Pt = [(bottom[0] - top[0]) / Math.hypot(bottom[0] - top[0], bottom[1] - top[1]), (bottom[1] - top[1]) / Math.hypot(bottom[0] - top[0], bottom[1] - top[1])];
    const ext = 46;
    const k0: Pt = [top[0] - dir[0] * ext, top[1] - dir[1] * ext];
    const k1: Pt = [bottom[0] + dir[0] * ext, bottom[1] + dir[1] * ext];
    line(k0, k1);
    inter.set(`${spec.parallel[0]}|${t.id}`, top);
    inter.set(`${spec.parallel[1]}|${t.id}`, bottom);
    transDir.set(t.id, dir);
    // 이름은 선 끝을 **지나서**(선 방향으로) 놓는다 — 선 옆에 붙이면 기울어진 선과 겹친다.
    const nameOff = 12 + labelWidth(t.id) / 2;
    putLabel(k1[0] + dir[0] * nameOff, k1[1] + dir[1] * nameOff, t.id, "횡단선 이름", true);
  });
  // 평행선 이름(오른쪽 끝 바깥)
  LINE_Y.forEach((y, i) => putLabel(W - PAD + 14, y, spec.parallel[i], "평행선 이름", true));

  const keyOf = (pair: [string, string]) => {
    const p = pair.find((x) => spec.parallel.includes(x))!;
    const t = pair.find((x) => spec.transversals.some((tr) => tr.id === x))!;
    return { key: `${p}|${t}`, t };
  };
  /** 사분면 → 두 반직선의 방향각(수학 좌표, 라디안). 가로선은 0/π, 횡단선은 위쪽 방향각 u 와 아래쪽 u+π. */
  const rays = (t: string, region: Region): [number, number] => {
    const d = transDir.get(t)!; // 아래로 향함(화면 y 아래 = 수학 y 음수)
    const down = Math.atan2(-d[1], d[0]); // 수학 각(-)
    const up = down + Math.PI;
    const norm = (a: number) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const u = norm(up), dn = norm(down);
    // 각 사분면: 시작각→끝각(반시계). 가로선 0(오른쪽), π(왼쪽).
    const upRight = u < Math.PI / 2; // 횡단선의 위쪽이 오른쪽으로 기울었나
    if (region === "NE") return upRight ? [0, u] : [0, u];
    if (region === "NW") return [upRight ? u : u, Math.PI];
    if (region === "SW") return [Math.PI, upRight ? dn : dn];
    return [upRight ? dn : dn, 2 * Math.PI]; // SE
  };

  // ---- 각
  const seenRegion = new Set<string>();
  for (const a of spec.angles) {
    const { key, t } = keyOf(a.at);
    const c = inter.get(key)!;
    const rk = `${key}|${a.region}`;
    if (seenRegion.has(rk)) issues.push({ code: "duplicate_angle", message: `교점 (${a.at.join(", ")}) ${a.region} 에 각이 두 개입니다.` });
    seenRegion.add(rk);
    const [a1, a2Raw] = rays(t, a.region);
    let a2 = a2Raw;
    if (a2 < a1) a2 += 2 * Math.PI;
    const mid = (a1 + a2) / 2;
    if (a.right) {
      sheet.rightAngle(c, a1, a2, RIGHT_R);
      if (Math.abs(a2 - a1 - Math.PI / 2) > 0.02) issues.push({ code: "impossible", message: `교점 (${a.at.join(", ")}) ${a.region} 은 직각이 아닙니다 — 평행선과 횡단선은 이 템플릿에서 ${SLANT_DEG}° 로 만납니다. 수직인 횡단선은 지원하지 않습니다.` });
    } else {
      sheet.arc(c, ARC_R, a1, a2);
    }
    if (a.label && a.label.trim()) {
      // 배치 규칙: 상자(반대각선)가 두 반직선과 자기 호를 모두 벗어나는 최소 반지름. 좁은 각(55°)일수록 멀리.
      const r = labelRadius(a.label.trim(), (a2 - a1) / 2, a.right);
      const lx = c[0] + r * Math.cos(mid), ly = c[1] - r * Math.sin(mid);
      putLabel(lx, ly, a.label.trim(), "각 라벨");
    }
  }

  // ---- 교점 이름 — 각이 없는 사분면 쪽에 놓는다(있으면 충돌로 기록)
  const pointNames = new Set<string>();
  for (const p of spec.points ?? []) {
    if (pointNames.has(p.id)) issues.push({ code: "duplicate_label", message: `점 이름 '${p.id}' 가 중복됩니다.` });
    pointNames.add(p.id);
    const { key, t } = keyOf(p.on);
    const c = inter.get(key)!;
    sheet.dot(c);
    const used = new Set(spec.angles.filter((a) => keyOf(a.at).key === key).map((a) => a.region));
    const order: Region[] = ["NW", "NE", "SW", "SE"];
    const free = order.find((r) => !used.has(r)) ?? "NW";
    const [a1, a2r] = rays(t, free);
    const a2 = a2r < a1 ? a2r + 2 * Math.PI : a2r;
    const mid = (a1 + a2) / 2;
    // 각 라벨과 같은 배치 규칙 — 상자 반대각선이 두 반직선을 벗어나는 최소 반지름.
    const w = labelWidth(p.id);
    const r = Math.max(18, (Math.hypot(w, LABEL_SIZE + 2) / 2 + 3) / Math.max(Math.sin((a2 - a1) / 2), 0.2));
    putLabel(c[0] + r * Math.cos(mid), c[1] - r * Math.sin(mid), p.id, "점 이름", true);
  }
  // 라벨 전체 중복
  const labels = [...spec.parallel, ...spec.transversals.map((t) => t.id), ...(spec.points ?? []).map((p) => p.id)];
  const dup = labels.filter((l, i) => labels.indexOf(l) !== i);
  for (const d of new Set(dup)) issues.push({ code: "duplicate_label", message: `이름 '${d}' 가 선과 점에 중복으로 쓰였습니다.` });

  if (spec.notToScale) sheet.note("Note: Figure not drawn to scale.");

  const regionKo: Record<Region, string> = { NE: "위 오른쪽", NW: "위 왼쪽", SE: "아래 오른쪽", SW: "아래 왼쪽" };
  const alt =
    `평행선 ${spec.parallel[0]}과 ${spec.parallel[1]}을 횡단선 ${spec.transversals.map((t) => t.id).join(", ")}이(가) 가로지른다.` +
    (spec.points?.length ? ` 교점: ${spec.points.map((p) => `${p.id}(${p.on.join("과 ")})`).join(", ")}.` : "") +
    (spec.angles.length ? ` 각: ${spec.angles.map((a) => `${a.at.join("과 ")}의 교점 ${regionKo[a.region]}은 ${a.right ? "직각" : a.label}`).join(", ")}.` : "");

  return { svg: sheet.svg(alt), alt, issues: sheet.uniqueIssues() };
}

/**
 * 지문 참조 검사 — 지문이 말하는 선·점·각이 데이터에 있어야 한다.
 * 잡는 표현: "line m", "lines m and n", "transversal k", "point A", "angle x", "x°", "37°", "∠ABC", "m ∥ n".
 */
export function lintParallelTransversalAgainstText(spec: ParallelTransversalSpec, passage: string): FigureIssue[] {
  const issues: FigureIssue[] = [];
  const lineIds = new Set<string>([...spec.parallel, ...spec.transversals.map((t) => t.id)]);
  const pointIds = new Set<string>((spec.points ?? []).map((p) => p.id));
  const angleLabels = new Set<string>(spec.angles.map((a) => (a.label ?? "").replace(/\s+/g, "")));
  const text = passage.replace(/\$/g, "");
  const named = (re: RegExp) => Array.from(text.matchAll(re)).flatMap((m) => m.slice(1).filter(Boolean));
  for (const id of named(/\blines?\s+([a-zℓ])\b(?:\s*(?:and|,)\s*([a-zℓ])\b)?/gi)) {
    if (!lineIds.has(id)) issues.push({ code: "ref_missing", message: `지문의 선 '${id}' 가 도형 데이터에 없습니다.` });
  }
  for (const id of named(/\btransversal\s+([a-zℓ])\b/gi)) {
    if (!lineIds.has(id)) issues.push({ code: "ref_missing", message: `지문의 횡단선 '${id}' 가 도형 데이터에 없습니다.` });
  }
  for (const id of named(/\bpoints?\s+([A-Z])\b(?:\s*(?:and|,)\s*([A-Z])\b)?/g)) {
    if (!pointIds.has(id)) issues.push({ code: "ref_missing", message: `지문의 점 '${id}' 가 도형 데이터에 없습니다(points 에 넣으세요). 횡단선끼리 만나는 점·삼각형은 이 템플릿이 그리지 못합니다 — 그런 문항이면 재생성하거나 그림을 올리세요.` });
  }
  // 각: 숫자("118°"), 한 글자 변수("x°"), 괄호식("(2x + 10)°"). 문장을 통째로 잡지 않는다.
  for (const m of text.matchAll(/(\([^()]{1,24}\)|\b\d+(?:\.\d+)?|\b[a-z])\s*(?:°|degrees|\^\\?circ)/g)) {
    const lbl = `${m[1].trim()}°`.replace(/\s+/g, "").replace(/−/g, "-");
    const has = Array.from(angleLabels).some((l) => l.replace(/−/g, "-") === lbl);
    if (!has) issues.push({ code: "ref_missing", message: `지문의 각 '${m[1].trim()}°' 가 도형의 각 라벨에 없습니다.` });
  }
  // 시험 문제는 각을 라벨·점 이름으로 부른다. "northeast region", "north side of line m" 같은 배치 용어가 지문에 새면 거부.
  if (/\b(north|south|east|west|northeast|northwest|southeast|southwest|quadrant|region)\b/i.test(text)) {
    issues.push({ code: "wording", message: "지문에 방위·사분면 표현(north/south/east/west, region, quadrant)이 있습니다 — 각은 'the angle marked 37°', 'the angle at A' 처럼 라벨·점 이름으로 부릅니다." });
  }
  for (const m of text.matchAll(/∠\s*([A-Z]{1,3})/g)) {
    for (const ch of m[1]) if (!pointIds.has(ch)) issues.push({ code: "ref_missing", message: `지문의 ∠${m[1]} 의 점 '${ch}' 가 도형 데이터에 없습니다.` });
  }
  return dedupe(issues);
}
