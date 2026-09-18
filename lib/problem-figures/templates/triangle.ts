// 표준 렌더링 엔진 — 템플릿 2: 삼각형·직각삼각형·합동/닮음 표기 (docs/2026-09-14-standard-rendering-engine-design.md 1-4)
//
// AI 는 **관계만** 낸다: 꼭짓점 이름, 종류(직각·이등변·정삼각형·일반), 직각 위치, 변 라벨·등변 눗금, 각 라벨·호, 높이(수선),
// 닮음·합동용 두 번째 삼각형. 좌표·라벨 자리·호 반지름은 여기서 정한다. 충돌·잘림은 검증 실패.

import { ARC_R, dedupe, halfDiag, norm, Sheet, type FigureIssue, type Pt } from "./_layout";

export type TriangleKind = "scalene" | "isosceles" | "right" | "equilateral";

export type TriangleBody = {
  /** 꼭짓점 이름 3개. 표준 배치: [0] 위, [1] 왼쪽 아래, [2] 오른쪽 아래. 직각이면 직각 꼭짓점이 왼쪽 아래로 온다. */
  vertices: [string, string, string];
  kind?: TriangleKind;
  rightAngleAt?: string;
  /** 변 — 두 꼭짓점 사이. label 은 길이('6', 'x', '√2'), tick 은 등변 표시 개수(1~3). */
  sides?: { between: [string, string]; label?: string; tick?: 1 | 2 | 3 }[];
  /** 각 — 꼭짓점. label('40°', 'θ'), arc(기본 true), tick 은 등각 표시(호 개수 1~2). */
  angles?: { at: string; label?: string; arc?: boolean; tick?: 1 | 2 }[];
  /** 높이(수선) — 꼭짓점에서 맞은변으로. foot 은 발 이름(선택). */
  altitude?: { from: string; foot?: string; label?: string };
};

export type TriangleSpec = {
  type: "triangle";
  /** 두 번째 삼각형(합동·닮음 문제). 같은 모양을 scale 배로 오른쪽에 그린다. */
  second?: TriangleBody & { scale?: number };
  notToScale?: boolean;
} & TriangleBody;

const isName = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0 && v.trim().length <= 3;

function validateBody(b: Record<string, unknown>, who: string): string | null {
  if (!Array.isArray(b.vertices) || b.vertices.length !== 3 || !b.vertices.every(isName)) return `${who}vertices 는 꼭짓점 이름 3개여야 합니다.`;
  const vs = b.vertices as string[];
  if (new Set(vs).size !== 3) return `${who}꼭짓점 이름이 중복됩니다.`;
  if (b.kind !== undefined && !["scalene", "isosceles", "right", "equilateral"].includes(String(b.kind))) return `${who}kind 는 scalene|isosceles|right|equilateral 입니다.`;
  if (b.rightAngleAt !== undefined && !vs.includes(String(b.rightAngleAt))) return `${who}rightAngleAt 은 꼭짓점 이름이어야 합니다.`;
  if (b.kind === "right" && b.rightAngleAt === undefined) return `${who}직각삼각형은 rightAngleAt 이 필요합니다.`;
  if (b.sides !== undefined) {
    if (!Array.isArray(b.sides)) return `${who}sides 는 배열이어야 합니다.`;
    for (const s of b.sides as Record<string, unknown>[]) {
      if (!s || !Array.isArray(s.between) || s.between.length !== 2 || !s.between.every((v: unknown) => vs.includes(String(v))) || s.between[0] === s.between[1]) return `${who}sides[].between 은 서로 다른 꼭짓점 2개여야 합니다.`;
      if (s.label !== undefined && typeof s.label !== "string") return `${who}sides[].label 은 문자열입니다.`;
      if (s.tick !== undefined && ![1, 2, 3].includes(Number(s.tick))) return `${who}sides[].tick 은 1~3 입니다.`;
    }
  }
  if (b.angles !== undefined) {
    if (!Array.isArray(b.angles)) return `${who}angles 는 배열이어야 합니다.`;
    for (const a of b.angles as Record<string, unknown>[]) {
      if (!a || !vs.includes(String(a.at))) return `${who}angles[].at 은 꼭짓점 이름이어야 합니다.`;
      if (a.label !== undefined && typeof a.label !== "string") return `${who}angles[].label 은 문자열입니다.`;
      if (String(a.at) === String(b.rightAngleAt) && a.label) return `${who}직각 꼭짓점 ${String(a.at)} 에는 각 라벨을 따로 두지 않습니다(직각 표시가 대신합니다).`;
    }
  }
  if (b.altitude !== undefined) {
    const al = b.altitude as Record<string, unknown>;
    if (!al || !vs.includes(String(al.from))) return `${who}altitude.from 은 꼭짓점 이름이어야 합니다.`;
    if (al.foot !== undefined && (!isName(al.foot) || vs.includes(String(al.foot)))) return `${who}altitude.foot 은 꼭짓점과 다른 새 이름이어야 합니다.`;
  }
  return null;
}

export function validateTriangle(input: unknown): { ok: true; spec: TriangleSpec } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "그림 데이터가 객체가 아닙니다." };
  const s = input as Record<string, unknown>;
  if (s.type !== "triangle") return { ok: false, error: "type 이 triangle 이 아닙니다." };
  const e = validateBody(s, "");
  if (e) return { ok: false, error: e };
  if (s.second !== undefined) {
    if (!s.second || typeof s.second !== "object") return { ok: false, error: "second 는 객체여야 합니다." };
    const e2 = validateBody(s.second as Record<string, unknown>, "second.");
    if (e2) return { ok: false, error: e2 };
    const sc = (s.second as Record<string, unknown>).scale;
    if (sc !== undefined && (typeof sc !== "number" || sc < 0.4 || sc > 1.6)) return { ok: false, error: "second.scale 은 0.4~1.6 사이 숫자입니다." };
  }
  return { ok: true, spec: s as unknown as TriangleSpec };
}

/** side/altitude 라벨을 순수 숫자로 파싱(변수 라벨이면 null). */
function parseLabel(t?: string): number | null {
  if (!t) return null;
  const n = Number(t.trim().replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}
function labelBetween(sides: TriangleBody["sides"], a: string, b: string): number | null {
  const s = (sides ?? []).find((s) => (s.between[0] === a && s.between[1] === b) || (s.between[0] === b && s.between[1] === a));
  return parseLabel(s?.label);
}

/** 표준형 좌표(단위 프레임, 폭 1 기준) — kind 와 직각 위치로 모양을 정한다. 반환은 vertices 순서대로. */
function shapeOf(b: TriangleBody): { pts: Pt[]; order: string[] } {
  const [v0, v1, v2] = b.vertices;
  const kind: TriangleKind = b.kind ?? (b.rightAngleAt ? "right" : "scalene");
  if (kind === "right") {
    // 직각 꼭짓점 왼쓱 아래, 다음 꼭짓점(순환) 오른쪽 아래, 나머지 위.
    const r = b.rightAngleAt ?? v1;
    const i = b.vertices.indexOf(r);
    const bl = b.vertices[i], br = b.vertices[(i + 1) % 3], top = b.vertices[(i + 2) % 3];
    // 2026-09-19(제품 오너 발견) — 두 직각변 값과 무관하게 항상 가로:세로 = 4:3 고정이었다
    // (예: AB=18, AC=80인데 거의 정사각형에 가까운 삼각형으로 보임). bl-br·bl-top 변의
    // 숫자 라벨이 둘 다 있으면 그 실제 비율로 그린다(단위 프레임 안에서 상대 비율만
    // 맞으면 되므로 두 값을 서로에 대해 정규화 — 더 긴 변을 1로 둔다).
    const legBR = labelBetween(b.sides, bl, br); // 가로변(밑변)
    const legTop = labelBetween(b.sides, bl, top); // 세로변(높이)
    let w = 1, h = 0.75;
    if (legBR !== null && legTop !== null) {
      const maxLeg = Math.max(legBR, legTop);
      w = legBR / maxLeg;
      h = legTop / maxLeg;
    }
    const map: Record<string, Pt> = { [bl]: [0, 0], [br]: [w, 0], [top]: [0, h] };
    return { pts: b.vertices.map((v) => map[v]), order: [top, bl, br] };
  }
  if (kind === "equilateral") return { pts: [[0.5, Math.sqrt(3) / 2], [0, 0], [1, 0]], order: [v0, v1, v2] };
  if (kind === "isosceles") return { pts: [[0.5, 0.85], [0, 0], [1, 0]], order: [v0, v1, v2] };
  // scalene — 밑변(v1-v2)에 대한 높이(altitude)가 숫자 라벨로 있으면 실제 밑변:높이 비율로.
  // (예: base=26, height=4처럼 아주 납작한 삼각형인데 고정 비율 탓에 정삼각형에 가깝게 보이던 사례.)
  const base = labelBetween(b.sides, v1, v2);
  const alt = b.altitude?.from === v0 ? parseLabel(b.altitude.label) : null;
  if (base !== null && alt !== null) {
    const maxV = Math.max(base, alt);
    // 꼭짓점 x좌표(발의 위치)는 임의로 밑변의 40% 지점에 둔다 — altitude foot 표시는 실제 발
    // 위치를 요구하지 않으므로(수선 표시일 뿐) 비율만 맞으면 된다.
    return { pts: [[0.4 * (base / maxV), alt / maxV], [0, 0], [base / maxV, 0]], order: [v0, v1, v2] };
  }
  return { pts: [[0.36, 0.72], [0, 0], [1, 0]], order: [v0, v1, v2] }; // scalene(라벨 없음, 기존 고정 비율)
}

function drawTriangle(sheet: Sheet, b: TriangleBody, frame: { x: number; y: number; w: number; h: number }, opts: { skipNoteSpace?: boolean } = {}): { alt: string } {
  void opts;
  const { pts } = shapeOf(b);
  // 단위 프레임 → 화면. 위쪽 라벨·호 여백을 남긴다.
  const maxY = Math.max(...pts.map((p) => p[1]));
  const sx = frame.w, sy = frame.h / Math.max(maxY, 0.7);
  const scale = Math.min(sx, sy);
  const usedW = scale * 1, usedH = scale * maxY;
  const ox = frame.x + (frame.w - usedW) / 2, oy = frame.y + frame.h - (frame.h - usedH) / 2;
  const P = new Map<string, Pt>();
  b.vertices.forEach((v, i) => P.set(v, [ox + pts[i][0] * scale, oy - pts[i][1] * scale]));
  const at = (v: string) => P.get(v)!;
  const cx = b.vertices.reduce((s, v) => s + at(v)[0], 0) / 3, cy = b.vertices.reduce((s, v) => s + at(v)[1], 0) / 3;

  // 변
  const edges: [string, string][] = [[b.vertices[0], b.vertices[1]], [b.vertices[1], b.vertices[2]], [b.vertices[2], b.vertices[0]]];
  for (const [p, q] of edges) sheet.line(at(p), at(q));

  // 직각 표시
  if (b.rightAngleAt) {
    const c = at(b.rightAngleAt);
    const others = b.vertices.filter((v) => v !== b.rightAngleAt).map((v) => at(v));
    const angs = others.map((o) => norm(Math.atan2(-(o[1] - c[1]), o[0] - c[0]))).sort((x, y) => x - y);
    let [a1, a2] = angs;
    if (a2 - a1 > Math.PI) [a1, a2] = [a2, a1 + 2 * Math.PI];
    if (Math.abs(a2 - a1 - Math.PI / 2) > 0.05) sheet.issues.push({ code: "impossible", message: `${b.rightAngleAt} 의 각이 직각으로 그려지지 않습니다 — kind 를 'right' 로 두고 rightAngleAt 만 지정하세요.` });
    sheet.rightAngle(c, a1, a2);
  }

  // 높이(수선)
  if (b.altitude) {
    const from = at(b.altitude.from);
    const [p, q] = b.vertices.filter((v) => v !== b.altitude!.from).map((v) => at(v));
    const vx = q[0] - p[0], vy = q[1] - p[1];
    const t = ((from[0] - p[0]) * vx + (from[1] - p[1]) * vy) / (vx * vx + vy * vy);
    const foot: Pt = [p[0] + t * vx, p[1] + t * vy];
    if (t < 0.02 || t > 0.98) sheet.issues.push({ code: "impossible", message: `${b.altitude.from} 에서 내린 높이의 발이 맞은변 밖에 떨어집니다 — 이 모양에서는 높이를 그릴 수 없습니다.` });
    sheet.line(from, foot, { dashed: true, w: 1.6 });
    // 발에 직각 표시(밑변 방향과 수선 방향)
    const dirBase = norm(Math.atan2(-(q[1] - foot[1]), q[0] - foot[0]));
    const dirUp = norm(Math.atan2(-(from[1] - foot[1]), from[0] - foot[0]));
    let [a1, a2] = [dirBase, dirUp].sort((x, y) => x - y);
    if (a2 - a1 > Math.PI) [a1, a2] = [a2, a1 + 2 * Math.PI];
    sheet.rightAngle(foot, a1, a2, 8);
    if (b.altitude.foot) sheet.label(foot[0], foot[1] + 14, b.altitude.foot, "높이 발 이름", { italic: true });
    if (b.altitude.label) {
      // 2026-09-19(제품 오너 발견) — 아주 납작한 삼각형(높이가 밑변에 비해 매우 짧게 스케일됨)에서
      // 고정 오프셋 한 곳만 시도하면 발의 직각 표시나 옆면 선과 겹쳤다. 좌우 여러 후보 중 첫
      // 번째로 안 겹치는 자리를 고른다.
      const mx = (from[0] + foot[0]) / 2, my = (from[1] + foot[1]) / 2;
      const d = 8 + halfDiag(b.altitude.label) * 0.8;
      const offsets = [0, 10, 20, 35, 55];
      const candidates: Pt[] = offsets.flatMap((o): Pt[] => [
        [mx + d + o, my],
        [mx - d - o, my],
        [mx + d + o, my - 12],
        [mx - d - o, my - 12],
        [mx + d + o, my + 12],
        [mx - d - o, my + 12],
      ]);
      const spot = sheet.firstFree(candidates, b.altitude.label);
      const [lx, ly] = spot ?? candidates[0];
      sheet.label(lx, ly, b.altitude.label, "높이 라벨");
    }
  }

  // 각 호·라벨
  for (const a of b.angles ?? []) {
    const c = at(a.at);
    const others = b.vertices.filter((v) => v !== a.at).map((v) => at(v));
    const angs = others.map((o) => norm(Math.atan2(-(o[1] - c[1]), o[0] - c[0]))).sort((x, y) => x - y);
    let [a1, a2] = angs;
    if (a2 - a1 > Math.PI) [a1, a2] = [a2, a1 + 2 * Math.PI];
    const isRight = a.at === b.rightAngleAt;
    const n = a.tick ?? 1;
    if (!isRight && a.arc !== false) for (let i = 0; i < n; i++) sheet.arc(c, ARC_R + i * 5, a1, a2);
    if (a.label) {
      const mid = (a1 + a2) / 2;
      const half = (a2 - a1) / 2;
      const r = Math.max((halfDiag(a.label) + 4) / Math.max(Math.sin(half), 0.25), ARC_R + (n - 1) * 5 + halfDiag(a.label) + 3);
      sheet.label(c[0] + r * Math.cos(mid), c[1] - r * Math.sin(mid), a.label, `각 라벨(${a.at})`);
    }
  }

  // 변 라벨·눗금 — 중점에서 바깥(무게중심 반대) 쪽으로
  for (const s of b.sides ?? []) {
    const p = at(s.between[0]), q = at(s.between[1]);
    // 높이가 이 변으로 내려오면 발(과 그 이름)이 중점 근처를 차지한다 — 라벨은 3/4 지점으로 비켜 놓는 것이 규칙.
    const isAltitudeBase = Boolean(b.altitude && !s.between.includes(b.altitude.from));
    const tPos = isAltitudeBase ? 0.76 : 0.5;
    const mx = p[0] + (q[0] - p[0]) * tPos, my = p[1] + (q[1] - p[1]) * tPos;
    if (s.tick) sheet.ticks(p, q, s.tick);
    if (s.label) {
      // 2026-09-19(제품 오너 발견 — 극단 비율 도형에서) — "무게중심 반대쪽" 한 방향만 시도하면
      // 아주 납작/뾰족한 삼각형(비율을 실제 값대로 그리기 시작한 뒤 생김)에서 그 방향이 변과
      // 거의 평행해 라벨이 여전히 선과 겹쳤다. 변에 수직인 방향(과 그 반대) + 기존 방식을
      // 후보로 두고 첫 번째로 안 겹치는 자리를 고른다(입체도형 sideLabel과 같은 패턴).
      const dx = mx - cx, dy = my - cy;
      const len = Math.hypot(dx, dy) || 1;
      const d = halfDiag(s.label) + 6;
      const ex = q[0] - p[0], ey = q[1] - p[1];
      const elen = Math.hypot(ex, ey) || 1;
      let nx = -ey / elen, ny = ex / elen;
      if (nx * dx + ny * dy < 0) { nx = -nx; ny = -ny; }
      const candidates: Pt[] = [
        [mx + nx * d, my + ny * d],
        [mx + (dx / len) * d, my + (dy / len) * d],
        [mx + nx * (d + 12), my + ny * (d + 12)],
        [mx + nx * (d + 24), my + ny * (d + 24)],
      ];
      const spot = sheet.firstFree(candidates, s.label);
      const [lx, ly] = spot ?? candidates[0];
      sheet.label(lx, ly, s.label, `변 라벨(${s.between.join("")})`);
    }
  }

  // 꼭짓점 이름 — 무게중심 반대쪽. 극단 비율(예: 매우 납작한 삼각형)에서는 그 한 방향도
  // 다른 변과 겹칠 수 있어 여러 반지름의 후보 중 첫 번째로 안 겹치는 자리를 고른다.
  for (const v of b.vertices) {
    const c = at(v);
    const dx = c[0] - cx, dy = c[1] - cy;
    const len = Math.hypot(dx, dy) || 1;
    const base = halfDiag(v) + 6;
    const candidates: Pt[] = [0, 10, 20, 35].map((extra): Pt => [c[0] + (dx / len) * (base + extra), c[1] + (dy / len) * (base + extra)]);
    const spot = sheet.firstFree(candidates, v);
    const [lx, ly] = spot ?? candidates[0];
    sheet.label(lx, ly, v, `꼭짓점 이름(${v})`, { italic: true });
  }

  const kindKo: Record<TriangleKind, string> = { scalene: "삼각형", isosceles: "이등변삼각형", right: "직각삼각형", equilateral: "정삼각형" };
  const kind = b.kind ?? (b.rightAngleAt ? "right" : "scalene");
  const alt =
    `${kindKo[kind]} ${b.vertices.join("")}` +
    (b.rightAngleAt ? `, ${b.rightAngleAt}에서 직각` : "") +
    ((b.sides ?? []).filter((s) => s.label).length ? `. 변: ${(b.sides ?? []).filter((s) => s.label).map((s) => `${s.between.join("")} = ${s.label}`).join(", ")}` : "") +
    ((b.angles ?? []).filter((a) => a.label).length ? `. 각: ${(b.angles ?? []).filter((a) => a.label).map((a) => `${a.at} = ${a.label}`).join(", ")}` : "") +
    (b.altitude ? `. ${b.altitude.from}에서 맞은변에 내린 높이${b.altitude.label ? ` ${b.altitude.label}` : ""}` : "") +
    ".";
  return { alt };
}

export function renderTriangle(spec: TriangleSpec): { svg: string; alt: string; issues: FigureIssue[] } {
  const W = spec.second ? 580 : 360, H = 270;
  const sheet = new Sheet(W, H);
  const PADX = 58, PADTOP = 46, PADBOT = spec.notToScale ? 52 : 40;
  let alt: string;
  if (!spec.second) {
    alt = drawTriangle(sheet, spec, { x: PADX, y: PADTOP, w: W - PADX * 2, h: H - PADTOP - PADBOT }).alt;
  } else {
    const sc = spec.second.scale ?? 0.7;
    const gap = 84; // 두 삼각형 사이 — 양쪽 꼭짓점 이름이 서로 닿지 않게
    const totalUnits = 1 + sc;
    const wAvail = W - PADX * 2 - gap;
    const w1 = (wAvail * 1) / totalUnits, w2 = (wAvail * sc) / totalUnits;
    const hAvail = H - PADTOP - PADBOT;
    const a1 = drawTriangle(sheet, spec, { x: PADX, y: PADTOP, w: w1, h: hAvail }).alt;
    const a2 = drawTriangle(sheet, spec.second, { x: PADX + w1 + gap, y: PADTOP + hAvail * (1 - sc), w: w2, h: hAvail * sc }).alt;
    alt = `${a1} ${a2}`;
  }
  // 라벨 중복(꼭짓점·발 이름)
  const names = [...spec.vertices, ...(spec.altitude?.foot ? [spec.altitude.foot] : []), ...(spec.second?.vertices ?? []), ...(spec.second?.altitude?.foot ? [spec.second.altitude.foot] : [])];
  const dup = names.filter((n, i) => names.indexOf(n) !== i);
  for (const d of new Set(dup)) sheet.issues.push({ code: "duplicate_label", message: `점 이름 '${d}' 가 중복됩니다(두 삼각형은 서로 다른 이름을 씁니다).` });
  if (spec.notToScale) sheet.note("Note: Figure not drawn to scale.");
  return { svg: sheet.svg(alt), alt, issues: sheet.uniqueIssues() };
}

/**
 * 지문 참조 검사 — "triangle ABC", "side AB", "AB = 6", "angle B", "∠ABC", "right angle at B", "right triangle", 각도 라벨.
 */
export function lintTriangleAgainstText(spec: TriangleSpec, passage: string): FigureIssue[] {
  const issues: FigureIssue[] = [];
  const text = passage.replace(/\$/g, "").replace(/\\overline\{([A-Z]{2})\}/g, "$1").replace(/\\angle/g, "∠").replace(/\\triangle/g, "△");
  const bodies = [spec, ...(spec.second ? [spec.second] : [])];
  const allVertices = new Set(bodies.flatMap((b) => [...b.vertices, ...(b.altitude?.foot ? [b.altitude.foot] : [])]));
  const hasSide = (a: string, b: string) => bodies.some((bd) => bd.vertices.includes(a) && bd.vertices.includes(b)) || bodies.some((bd) => bd.altitude?.foot && [a, b].includes(bd.altitude.foot) && (bd.vertices.includes(a) || bd.vertices.includes(b)));
  const sideLabel = (a: string, b: string) => bodies.flatMap((bd) => bd.sides ?? []).find((s) => (s.between[0] === a && s.between[1] === b) || (s.between[0] === b && s.between[1] === a))?.label;
  const angleLabels = new Set(bodies.flatMap((b) => (b.angles ?? []).map((a) => (a.label ?? "").replace(/\s+/g, "").replace(/−/g, "-"))));

  for (const m of text.matchAll(/(?:triangles?|△)\s+([A-Z]{3})/g)) {
    for (const ch of m[1]) if (!allVertices.has(ch)) issues.push({ code: "ref_missing", message: `지문의 삼각형 ${m[1]} 의 점 '${ch}' 가 도형 데이터에 없습니다.` });
  }
  for (const m of text.matchAll(/\b(?:side|segment|length of)\s+([A-Z])([A-Z])\b/g)) {
    if (!hasSide(m[1], m[2])) issues.push({ code: "ref_missing", message: `지문의 변 ${m[1]}${m[2]} 가 도형에 없습니다.` });
  }
  for (const m of text.matchAll(/\b([A-Z])([A-Z])\s*=\s*([0-9]+(?:\.[0-9]+)?|√\d+|\\sqrt\{[^}]+\})/g)) {
    if (!hasSide(m[1], m[2])) issues.push({ code: "ref_missing", message: `지문의 변 ${m[1]}${m[2]} 가 도형에 없습니다.` });
    else {
      const lbl = sideLabel(m[1], m[2]);
      if (lbl === undefined) issues.push({ code: "ref_missing", message: `지문은 ${m[1]}${m[2]} = ${m[3]} 인데 그림에 그 변의 길이 라벨이 없습니다.` });
      else if (lbl.replace(/\s+/g, "") !== m[3].replace(/\s+/g, "").replace(/\\sqrt\{([^}]+)\}/, "√$1")) issues.push({ code: "ref_mismatch", message: `지문은 ${m[1]}${m[2]} = ${m[3]} 인데 그림 라벨은 '${lbl}' 입니다.` });
    }
  }
  for (const m of text.matchAll(/(?:∠|\bangle\s+)([A-Z]{1,3})\b/g)) {
    for (const ch of m[1]) if (!allVertices.has(ch)) issues.push({ code: "ref_missing", message: `지문의 각 ${m[1]} 의 점 '${ch}' 가 도형 데이터에 없습니다.` });
  }
  const rightAt = text.match(/right angle (?:is )?at\s+(?:point\s+)?([A-Z])\b/i);
  if (rightAt && !bodies.some((b) => b.rightAngleAt === rightAt[1])) issues.push({ code: "ref_missing", message: `지문은 ${rightAt[1]} 에서 직각이라는데 도형에 직각 표시가 없습니다.` });
  if (/\bright triangle\b/i.test(text) && !bodies.some((b) => b.rightAngleAt)) issues.push({ code: "ref_missing", message: "지문은 직각삼각형인데 도형에 직각(rightAngleAt)이 없습니다." });
  for (const m of text.matchAll(/(\([^()]{1,24}\)|\b\d+(?:\.\d+)?|\b[a-zθ])\s*(?:°|degrees|\^\\?circ)/g)) {
    const lbl = `${m[1].trim()}°`.replace(/\s+/g, "").replace(/−/g, "-");
    if (!angleLabels.has(lbl)) issues.push({ code: "ref_missing", message: `지문의 각 '${m[1].trim()}°' 가 도형의 각 라벨에 없습니다.` });
  }
  if (/\b(north|south|east|west|quadrant|region)\b/i.test(text)) {
    issues.push({ code: "wording", message: "지문에 방위·영역 표현이 있습니다 — 점·변·각 이름으로 부릅니다." });
  }
  return dedupe(issues);
}
