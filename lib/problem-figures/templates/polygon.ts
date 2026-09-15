// 표준 렌더링 엔진 — 템플릿 6: 사각형·다각형 (직사각형·정사각형·평행사변형·마름모·사다리꼴·정n각형)
// 관계만 받고 표준형 배치로 그린다. 변 라벨·등변 눗금·각 라벨·직각·대각선·높이. 넓이·둘레 문항의 도식.

import { ARC_R, dedupe, halfDiag, norm, Sheet, type FigureIssue, type Pt } from "./_layout";

export type PolygonKind = "rectangle" | "square" | "parallelogram" | "rhombus" | "trapezoid" | "regular";

export type PolygonSpec = {
  type: "polygon";
  kind: PolygonKind;
  /** 꼭짓점 이름 — 왼쪽 아래에서 반시계. 사각형은 4개, 정n각형은 sides 개(3~8). */
  vertices: string[];
  /** 정n각형의 변 수(kind 'regular'). */
  sides?: number;
  sideLabels?: { between: [string, string]; label?: string; tick?: 1 | 2 | 3 }[];
  angles?: { at: string; label?: string; arc?: boolean; right?: boolean }[];
  diagonals?: { between: [string, string]; label?: string }[];
  /** 높이 — 꼭짓점에서 맞은 변(밑변)으로 수선, 점선 + 직각 표시. */
  height?: { from: string; label?: string; foot?: string };
  notToScale?: boolean;
};

const isName = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0 && v.trim().length <= 3;

export function validatePolygon(input: unknown): { ok: true; spec: PolygonSpec } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "그림 데이터가 객체가 아닙니다." };
  const s = input as Record<string, unknown>;
  if (s.type !== "polygon") return { ok: false, error: "type 이 polygon 이 아닙니다." };
  const kinds: PolygonKind[] = ["rectangle", "square", "parallelogram", "rhombus", "trapezoid", "regular"];
  if (!kinds.includes(s.kind as PolygonKind)) return { ok: false, error: `kind 는 ${kinds.join("|")} 입니다.` };
  const n = s.kind === "regular" ? Number(s.sides) : 4;
  if (s.kind === "regular" && (!Number.isInteger(n) || n < 3 || n > 8)) return { ok: false, error: "정n각형의 sides 는 3~8 입니다." };
  if (!Array.isArray(s.vertices) || s.vertices.length !== n || !s.vertices.every(isName)) return { ok: false, error: `vertices 는 꼭짓점 이름 ${n}개여야 합니다.` };
  if (new Set(s.vertices as string[]).size !== n) return { ok: false, error: "꼭짓점 이름이 중복됩니다." };
  const vs = s.vertices as string[];
  const has = (v: unknown) => typeof v === "string" && vs.includes(v);
  const adjacent = (a: string, b: string) => { const i = vs.indexOf(a), j = vs.indexOf(b); return (i + 1) % n === j || (j + 1) % n === i; };
  for (const sl of (s.sideLabels ?? []) as Record<string, unknown>[]) {
    if (!sl || !Array.isArray(sl.between) || sl.between.length !== 2 || !sl.between.every(has) || sl.between[0] === sl.between[1]) return { ok: false, error: "sideLabels[].between 은 서로 다른 꼭짓점 2개여야 합니다." };
    if (!adjacent(sl.between[0] as string, sl.between[1] as string)) return { ok: false, error: `${(sl.between as string[]).join("")} 은 변이 아닙니다(이웃 꼭짓점이 아님) — 대각선이면 diagonals 에.` };
    if (sl.tick !== undefined && ![1, 2, 3].includes(Number(sl.tick))) return { ok: false, error: "sideLabels[].tick 은 1~3 입니다." };
  }
  for (const a of (s.angles ?? []) as Record<string, unknown>[]) if (!a || !has(a.at)) return { ok: false, error: "angles[].at 은 꼭짓점 이름이어야 합니다." };
  for (const d of (s.diagonals ?? []) as Record<string, unknown>[]) {
    if (!d || !Array.isArray(d.between) || d.between.length !== 2 || !d.between.every(has) || d.between[0] === d.between[1]) return { ok: false, error: "diagonals[].between 은 서로 다른 꼭짓점 2개여야 합니다." };
    if (adjacent(d.between[0] as string, d.between[1] as string)) return { ok: false, error: `${(d.between as string[]).join("")} 은 변입니다 — 대각선이 아닙니다.` };
  }
  if (s.height !== undefined) {
    const h = s.height as Record<string, unknown>;
    if (!h || !has(h.from)) return { ok: false, error: "height.from 은 꼭짓점 이름이어야 합니다." };
    if (h.foot !== undefined && (!isName(h.foot) || vs.includes(h.foot as string))) return { ok: false, error: "height.foot 은 새 이름이어야 합니다." };
    if (s.kind === "regular") return { ok: false, error: "정n각형에는 height 를 두지 않습니다." };
  }
  return { ok: true, spec: s as unknown as PolygonSpec };
}

/** 표준형 좌표(화면 px, 프레임 안). 왼쪽 아래부터 반시계. */
function shape(spec: PolygonSpec): Pt[] {
  const cx = 180, baseY = 210;
  switch (spec.kind) {
    case "rectangle": return [[cx - 110, baseY], [cx + 110, baseY], [cx + 110, baseY - 140], [cx - 110, baseY - 140]];
    case "square": return [[cx - 80, baseY], [cx + 80, baseY], [cx + 80, baseY - 160], [cx - 80, baseY - 160]];
    case "parallelogram": return [[cx - 120, baseY], [cx + 70, baseY], [cx + 120, baseY - 120], [cx - 70, baseY - 120]];
    case "rhombus": return [[cx - 110, baseY - 70], [cx, baseY], [cx + 110, baseY - 70], [cx, baseY - 140]];
    case "trapezoid": return [[cx - 120, baseY], [cx + 120, baseY], [cx + 70, baseY - 120], [cx - 70, baseY - 120]];
    case "regular": {
      const n = spec.sides ?? 5, R = 78, c: Pt = [cx, baseY - 88];
      const pts: Pt[] = [];
      // 밑변이 수평이 되도록 회전: 첫 꼭짓점을 왼쪽 아래에.
      const start = -Math.PI / 2 - Math.PI / n;
      for (let i = 0; i < n; i++) { const a = start - (2 * Math.PI * i) / n; pts.push([c[0] + R * Math.cos(a), c[1] - R * Math.sin(a)]); }
      // 반시계(수학) 순서로 정렬: 위 식은 시계이므로 뒤집되 첫 점 유지
      return [pts[0], ...pts.slice(1).reverse()];
    }
  }
}

export function renderPolygon(spec: PolygonSpec): { svg: string; alt: string; issues: FigureIssue[] } {
  const W = 360, H = spec.notToScale ? 270 : 250;
  const sheet = new Sheet(W, H);
  const issues: FigureIssue[] = [];
  const pts = shape(spec);
  const n = pts.length;
  const P = new Map(spec.vertices.map((v, i) => [v, pts[i]]));
  const at = (v: string) => P.get(v)!;
  const cx = pts.reduce((a, p) => a + p[0], 0) / n, cy = pts.reduce((a, p) => a + p[1], 0) / n;
  for (let i = 0; i < n; i++) sheet.line(pts[i], pts[(i + 1) % n]);

  // 직각 표시: 직사각형·정사각형은 네 모서리 자동, 그 외는 angles[].right
  const rightAt = new Set<string>(spec.kind === "rectangle" || spec.kind === "square" ? spec.vertices : []);
  for (const a of spec.angles ?? []) if (a.right) rightAt.add(a.at);
  const raysAt = (v: string): [number, number] => {
    const i = spec.vertices.indexOf(v); const c = at(v);
    const prev = pts[(i + n - 1) % n], next = pts[(i + 1) % n];
    const a1 = norm(Math.atan2(-(next[1] - c[1]), next[0] - c[0])), a2 = norm(Math.atan2(-(prev[1] - c[1]), prev[0] - c[0]));
    let [lo, hi] = [a1, a2].sort((x, y) => x - y); if (hi - lo > Math.PI) [lo, hi] = [hi, lo + 2 * Math.PI];
    return [lo, hi];
  };
  for (const v of rightAt) {
    const [lo, hi] = raysAt(v);
    if (Math.abs(hi - lo - Math.PI / 2) > 0.05) issues.push({ code: "impossible", message: `${v} 의 각은 이 모양에서 직각이 아닙니다 — kind 를 바꾸거나 right 를 지우세요.` });
    sheet.rightAngle(at(v), lo, hi, 10);
  }
  // 각 호·라벨
  for (const a of spec.angles ?? []) {
    const [lo, hi] = raysAt(a.at); const c = at(a.at);
    if (!a.right && a.arc !== false) sheet.arc(c, ARC_R, lo, hi);
    if (a.label) { const mid = (lo + hi) / 2; const r = Math.max((halfDiag(a.label) + 4) / Math.max(Math.sin((hi - lo) / 2), 0.25), ARC_R + halfDiag(a.label) + 3); sheet.label(c[0] + r * Math.cos(mid), c[1] - r * Math.sin(mid), a.label, `각 라벨(${a.at})`); }
  }
  // 대각선
  for (const d of spec.diagonals ?? []) {
    const p = at(d.between[0]), q = at(d.between[1]); sheet.line(p, q, { w: 1.6 });
    if (d.label) {
      // 두 대각선이 가운데서 만나므로 라벨은 1/4 지점(꼭짓점 쪽) 옆에 놓는다.
      const dx = q[0] - p[0], dy = q[1] - p[1]; const L = Math.hypot(dx, dy) || 1; const off = halfDiag(d.label) + 4;
      const cands: Pt[] = [];
      for (const t of [0.28, 0.72, 0.5]) { const m: Pt = [p[0] + dx * t, p[1] + dy * t]; cands.push([m[0] - (dy / L) * off, m[1] + (dx / L) * off], [m[0] + (dy / L) * off, m[1] - (dx / L) * off]); }
      const spot = sheet.firstFree(cands, d.label);
      if (spot) sheet.label(spot[0], spot[1], d.label, `대각선 라벨`); else issues.push({ code: "label_collision", message: `대각선 라벨 '${d.label}' 을 놓을 자리가 없습니다.` });
    }
  }
  // 높이
  if (spec.height) {
    const from = at(spec.height.from);
    // 밑변 = 가장 아래 변(y 최대) — 표준형은 항상 아래가 수평 밑변(마름모는 아래 꼭짓점 → 대각선 방향으로 정의하지 않음: 마름모 높이는 지원 밖)
    if (spec.kind === "rhombus") issues.push({ code: "unsupported", message: "마름모의 높이는 이 템플릿에서 지원하지 않습니다 — 대각선으로 표현하세요." });
    else {
      const baseY = Math.max(...pts.map((p) => p[1]));
      const foot: Pt = [from[0], baseY];
      const xs = pts.filter((p) => Math.abs(p[1] - baseY) < 0.5).map((p) => p[0]);
      const inside = from[0] >= Math.min(...xs) - 0.5 && from[0] <= Math.max(...xs) + 0.5;
      if (!inside) issues.push({ code: "impossible", message: `${spec.height.from} 에서 내린 높이의 발이 밑변 밖에 떨어집니다 — 다른 꼭짓점에서 내리거나 모양을 바꾸세요.` });
      if (Math.abs(from[1] - baseY) < 1) issues.push({ code: "impossible", message: `${spec.height.from} 은 밑변 위의 점이라 높이를 내릴 수 없습니다.` });
      else {
        sheet.line(from, foot, { dashed: true, w: 1.6 });
        sheet.rightAngle(foot, 0, Math.PI / 2, 8);
        if (spec.height.foot) sheet.label(foot[0], foot[1] + 14, spec.height.foot, "높이 발 이름", { italic: true });
        if (spec.height.label) {
          const off = halfDiag(spec.height.label) + 6, my = (from[1] + foot[1]) / 2;
          const spot = sheet.firstFree([[from[0] + off, my], [from[0] - off, my], [from[0] + off + 6, my + 14], [from[0] - off - 6, my + 14]], spec.height.label);
          if (spot) sheet.label(spot[0], spot[1], spec.height.label, "높이 라벨"); else issues.push({ code: "label_collision", message: `높이 라벨 '${spec.height.label}' 을 놓을 자리가 없습니다.` });
        }
      }
    }
  }
  // 변 라벨·눗금 — 바깥쪽
  for (const sl of spec.sideLabels ?? []) {
    const p = at(sl.between[0]), q = at(sl.between[1]);
    const mid: Pt = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    if (sl.tick) sheet.ticks(p, q, sl.tick);
    if (sl.label) { const dx = mid[0] - cx, dy = mid[1] - cy; const L = Math.hypot(dx, dy) || 1; const d = halfDiag(sl.label) + 6; sheet.label(mid[0] + (dx / L) * d, mid[1] + (dy / L) * d, sl.label, `변 라벨(${sl.between.join("")})`); }
  }
  // 꼭짓점 이름
  for (const v of spec.vertices) { const c = at(v); const dx = c[0] - cx, dy = c[1] - cy; const L = Math.hypot(dx, dy) || 1; const d = halfDiag(v) + 6; sheet.label(c[0] + (dx / L) * d, c[1] + (dy / L) * d, v, `꼭짓점 이름(${v})`, { italic: true }); }
  if (spec.notToScale) sheet.note("Note: Figure not drawn to scale.");
  const kindKo: Record<PolygonKind, string> = { rectangle: "직사각형", square: "정사각형", parallelogram: "평행사변형", rhombus: "마름모", trapezoid: "사다리꼴", regular: `정${spec.sides ?? n}각형` };
  const alt = `${kindKo[spec.kind]} ${spec.vertices.join("")}` +
    ((spec.sideLabels ?? []).filter((x) => x.label).length ? `. 변: ${(spec.sideLabels ?? []).filter((x) => x.label).map((x) => `${x.between.join("")} = ${x.label}`).join(", ")}` : "") +
    ((spec.angles ?? []).filter((x) => x.label || x.right).length ? `. 각: ${(spec.angles ?? []).filter((x) => x.label || x.right).map((x) => `${x.at}${x.right ? " 직각" : ` = ${x.label}`}`).join(", ")}` : "") +
    ((spec.diagonals ?? []).length ? `. 대각선: ${(spec.diagonals ?? []).map((d) => `${d.between.join("")}${d.label ? ` = ${d.label}` : ""}`).join(", ")}` : "") +
    (spec.height ? `. ${spec.height.from}에서 밑변에 내린 높이${spec.height.label ? ` ${spec.height.label}` : ""}` : "") + ".";
  return { svg: sheet.svg(alt), alt, issues: dedupe([...issues, ...sheet.uniqueIssues()]) };
}

/** 지문 참조 — "rectangle ABCD", "side AB", "AB = 6", "∠/angle", "diagonal AC", "height", 각도 라벨. */
export function lintPolygonAgainstText(spec: PolygonSpec, passage: string): FigureIssue[] {
  const issues: FigureIssue[] = [];
  const text = passage.replace(/\$/g, "").replace(/\\overline\{([A-Z]{2})\}/g, "$1").replace(/\\angle/g, "∠").replace(/−/g, "-");
  const names = new Set<string>([...spec.vertices, ...(spec.height?.foot ? [spec.height.foot] : [])]);
  const kindWords: Record<PolygonKind, RegExp> = { rectangle: /\brectangle\b/i, square: /\bsquare\b/i, parallelogram: /\bparallelogram\b/i, rhombus: /\brhombus\b/i, trapezoid: /\btrapezoid\b/i, regular: /\b(regular\s+)?(pentagon|hexagon|heptagon|octagon|polygon|triangle)\b/i };
  for (const [k, re] of Object.entries(kindWords) as [PolygonKind, RegExp][]) {
    if (k !== spec.kind && re.test(text) && !(spec.kind === "square" && k === "rectangle")) issues.push({ code: "ref_mismatch", message: `지문은 ${k} 를 말하지만 도형의 kind 는 ${spec.kind} 입니다.` });
  }
  for (const m of text.matchAll(/\b(?:rectangle|square|parallelogram|rhombus|trapezoid|pentagon|hexagon|polygon|quadrilateral)\s+([A-Z]{3,8})\b/gi)) for (const ch of m[1]) if (!names.has(ch)) issues.push({ code: "ref_missing", message: `지문의 도형 ${m[1]} 의 점 '${ch}' 가 도형 데이터에 없습니다.` });
  const sideLabel = (a: string, b: string) => (spec.sideLabels ?? []).find((s) => (s.between[0] === a && s.between[1] === b) || (s.between[0] === b && s.between[1] === a))?.label;
  const diag = (a: string, b: string) => (spec.diagonals ?? []).find((d) => (d.between[0] === a && d.between[1] === b) || (d.between[0] === b && d.between[1] === a));
  for (const m of text.matchAll(/\b(?:side|segment|length of)\s+([A-Z])([A-Z])\b/g)) if (!names.has(m[1]) || !names.has(m[2])) issues.push({ code: "ref_missing", message: `지문의 변 ${m[1]}${m[2]} 의 점이 도형에 없습니다.` });
  for (const m of text.matchAll(/\bdiagonal\s+([A-Z])([A-Z])\b/gi)) if (!diag(m[1], m[2])) issues.push({ code: "ref_missing", message: `지문의 대각선 ${m[1]}${m[2]} 가 도형에 없습니다.` });
  for (const m of text.matchAll(/\b([A-Z])([A-Z])\s*=\s*(\d+(?:\.\d+)?|√\d+|\d+\/\d+)/g)) {
    const lbl = sideLabel(m[1], m[2]) ?? diag(m[1], m[2])?.label;
    if (lbl === undefined) { if (names.has(m[1]) && names.has(m[2])) issues.push({ code: "ref_missing", message: `지문은 ${m[1]}${m[2]} = ${m[3]} 인데 그림에 그 길이 라벨이 없습니다.` }); }
    else if (lbl.replace(/\s+/g, "") !== m[3]) issues.push({ code: "ref_mismatch", message: `지문은 ${m[1]}${m[2]} = ${m[3]} 인데 그림 라벨은 '${lbl}' 입니다.` });
  }
  for (const m of text.matchAll(/(?:∠|\bangle\s+)([A-Z]{1,3})\b/g)) for (const ch of m[1]) if (!names.has(ch)) issues.push({ code: "ref_missing", message: `지문의 각 ${m[1]} 의 점 '${ch}' 가 도형에 없습니다.` });
  const angleLabels = new Set((spec.angles ?? []).map((a) => (a.label ?? "").replace(/\s+/g, "")));
  for (const m of text.matchAll(/(\([^()]{1,24}\)|\b\d+(?:\.\d+)?|\b[a-zθ])\s*(?:°|degrees|\^\\?circ)/g)) { const lbl = `${m[1].trim()}°`.replace(/\s+/g, ""); if (!angleLabels.has(lbl)) issues.push({ code: "ref_missing", message: `지문의 각 '${m[1].trim()}°' 가 도형의 각 라벨에 없습니다.` }); }
  if (/\bheight\b/i.test(text) && !spec.height && !["rectangle", "square"].includes(spec.kind) && !(spec.sideLabels ?? []).length) issues.push({ code: "ref_missing", message: "지문은 높이를 말하지만 도형에 높이(height)나 변 라벨이 없습니다." });
  if (/\b(northeast|northwest|southeast|southwest|region)\b/i.test(text)) issues.push({ code: "wording", message: "지문에 배치 용어가 있습니다." });
  return dedupe(issues);
}
