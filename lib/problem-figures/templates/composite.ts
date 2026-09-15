// 표준 렌더링 엔진 — 템플릿 8: 복합 도형(겹침·음영 영역). Digital SAT Math 'Area and volume' 에 나오는 "shaded region" 문항.
// 바깥 도형 안에 안쪽 도형을 표준 배치(중심 맞춤 또는 밑변 위)로 두고, 음영은 바깥−안쪽 또는 안쪽. 치수 라벨만 받는다.
import { dedupe, f, halfDiag, Sheet, type FigureIssue, type Pt } from "./_layout";

export type CompositeOuter = { kind: "square" | "rectangle" | "circle"; width?: string; height?: string; side?: string; radius?: string; diameter?: string };
export type CompositeInner = { kind: "circle" | "square" | "rectangle" | "semicircle" | "triangle"; side?: string; width?: string; height?: string; radius?: string; diameter?: string; placement?: "center" | "on_base" | "corner" };
export type CompositeSpec = { type: "composite"; outer: CompositeOuter; inner: CompositeInner; shaded: "outer_minus_inner" | "inner" | "none"; notToScale?: boolean };

const isLabel = (v: unknown) => typeof v === "string" && v.trim().length > 0 && v.trim().length <= 12;

export function validateComposite(input: unknown): { ok: true; spec: CompositeSpec } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "그림 데이터가 객체가 아닙니다." };
  const s = input as Record<string, unknown>;
  if (s.type !== "composite") return { ok: false, error: "type 이 composite 가 아닙니다." };
  const o = s.outer as Record<string, unknown> | undefined, i = s.inner as Record<string, unknown> | undefined;
  if (!o || !["square", "rectangle", "circle"].includes(String(o.kind))) return { ok: false, error: "outer.kind 는 square|rectangle|circle 입니다." };
  if (!i || !["circle", "square", "rectangle", "semicircle", "triangle"].includes(String(i.kind))) return { ok: false, error: "inner.kind 는 circle|square|rectangle|semicircle|triangle 입니다." };
  if (!["outer_minus_inner", "inner", "none"].includes(String(s.shaded))) return { ok: false, error: "shaded 는 outer_minus_inner|inner|none 입니다." };
  for (const [who, obj] of [["outer", o], ["inner", i]] as const) for (const [k, v] of Object.entries(obj)) if (!["kind", "placement"].includes(k) && v !== undefined && !isLabel(v)) return { ok: false, error: `${who}.${k} 는 12자 이내 라벨입니다.` };
  if (o.kind === "circle" && !["square", "triangle", "rectangle"].includes(String(i.kind))) return { ok: false, error: "원 안에는 정사각형·직사각형·삼각형(내접)만 둘 수 있습니다." };
  if (i.kind === "semicircle" && o.kind !== "rectangle" && o.kind !== "square") return { ok: false, error: "반원은 직사각형·정사각형 위(on_base)에만 둘 수 있습니다." };
  return { ok: true, spec: s as unknown as CompositeSpec };
}

export function renderComposite(spec: CompositeSpec): { svg: string; alt: string; issues: FigureIssue[] } {
  // 반원이 직사각형 위에 얹히면 그만큼 위 여백을 늘린다(규칙).
  const semi = spec.inner.kind === "semicircle";
  const W = 360, H = semi ? 380 : 280;
  const sheet = new Sheet(W, H);
  const issues: FigureIssue[] = [];
  const c: Pt = [180, semi ? 250 : 140];
  /** 라벨 후보 자리 중 겹치지 않는 첫 자리 — 없으면 문제로 기록. */
  const put = (cands: Pt[], t: string, what: string) => { const spot = sheet.firstFree(cands, t); if (spot) sheet.label(spot[0], spot[1], t, what); else issues.push({ code: "label_collision", message: `${what} '${t}' 을 놓을 자리가 없습니다.` }); };
  const outerW = spec.outer.kind === "rectangle" ? 220 : 180, outerH = spec.outer.kind === "rectangle" ? 150 : 180, R = 90;
  const shadeOuter = spec.shaded === "outer_minus_inner", shadeInner = spec.shaded === "inner";
  const fill = (on: boolean) => (on ? 'fill="#111" fill-opacity="0.14"' : 'fill="none"');
  // 바깥
  let outerBox: [number, number, number, number];
  if (spec.outer.kind === "circle") { sheet.raw(`<circle cx="${c[0]}" cy="${c[1]}" r="${R}" ${fill(shadeOuter)} stroke="#111" stroke-width="2"/>`); outerBox = [c[0] - R, c[1] - R, c[0] + R, c[1] + R]; for (let k = 0; k < 24; k++) sheet.registerSegment([c[0] + R * Math.cos((k * Math.PI) / 12), c[1] - R * Math.sin((k * Math.PI) / 12)], [c[0] + R * Math.cos(((k + 1) * Math.PI) / 12), c[1] - R * Math.sin(((k + 1) * Math.PI) / 12)]); }
  else { const x0 = c[0] - outerW / 2, y0 = c[1] - outerH / 2; sheet.raw(`<rect x="${x0}" y="${y0}" width="${outerW}" height="${outerH}" ${fill(shadeOuter)} stroke="#111" stroke-width="2"/>`); outerBox = [x0, y0, x0 + outerW, y0 + outerH]; const P: Pt[] = [[x0, y0], [x0 + outerW, y0], [x0 + outerW, y0 + outerH], [x0, y0 + outerH]]; for (let k = 0; k < 4; k++) sheet.registerSegment(P[k], P[(k + 1) % 4]); }
  // 안쪽 — 흰 채움으로 바깥 음영을 뚫는다(outer_minus_inner), 또는 안쪽만 음영
  const innerFill = shadeOuter ? 'fill="#fff"' : fill(shadeInner);
  const [ox0, oy0, ox1, oy1] = outerBox; const ow = ox1 - ox0, oh = oy1 - oy0;
  const placement = spec.inner.placement ?? (spec.inner.kind === "semicircle" ? "on_base" : "center");
  if (spec.inner.kind === "circle") { const r = Math.min(ow, oh) / 2 - (spec.outer.kind === "circle" ? 30 : 0); sheet.raw(`<circle cx="${c[0]}" cy="${c[1]}" r="${f(r)}" ${innerFill} stroke="#111" stroke-width="2"/>`); if (spec.inner.radius) { sheet.line(c, [c[0] + r, c[1]], { w: 1.4 }); sheet.dot(c); sheet.label(c[0] + r / 2, c[1] - 12, spec.inner.radius, "안쪽 원 반지름"); } if (spec.inner.diameter) { sheet.line([c[0] - r, c[1]], [c[0] + r, c[1]], { w: 1.4 }); sheet.label(c[0], c[1] - 12, spec.inner.diameter, "안쪽 원 지름"); } }
  else if (spec.inner.kind === "semicircle") { const r = ow / 2; sheet.raw(`<path d="M ${f(ox0)} ${f(oy0)} A ${f(r)} ${f(r)} 0 0 1 ${f(ox1)} ${f(oy0)}" ${shadeInner ? 'fill="#111" fill-opacity="0.14"' : 'fill="none"'} stroke="#111" stroke-width="2"/>`); if (spec.inner.radius) { sheet.line([c[0], oy0], [c[0] + r, oy0], { w: 1.4 }); sheet.dot([c[0], oy0]); put([[c[0] + r / 2, oy0 - 12], [c[0] + r / 2, oy0 - 20]], spec.inner.radius, "반원 반지름"); } }
  else if (spec.inner.kind === "triangle") { const P: Pt[] = spec.outer.kind === "circle" ? [[c[0], c[1] - R], [c[0] - R * 0.866, c[1] + R / 2], [c[0] + R * 0.866, c[1] + R / 2]] : [[c[0], oy0], [ox0, oy1], [ox1, oy1]]; sheet.raw(`<polygon points="${P.map((p) => `${f(p[0])},${f(p[1])}`).join(" ")}" ${innerFill} stroke="#111" stroke-width="2"/>`); for (let k = 0; k < 3; k++) sheet.registerSegment(P[k], P[(k + 1) % 3]); if (spec.inner.height) { sheet.line(P[0], [P[0][0], P[1][1]], { dashed: true, w: 1.4 }); sheet.label(P[0][0] + halfDiag(spec.inner.height) + 6, (P[0][1] + P[1][1]) / 2, spec.inner.height, "삼각형 높이"); } }
  else { // square / rectangle
    const iw = spec.inner.kind === "square" ? Math.min(ow, oh) * (spec.outer.kind === "circle" ? 0.707 : 0.5) : ow * 0.5, ih = spec.inner.kind === "square" ? iw : oh * 0.5;
    let x0 = c[0] - iw / 2, y0 = c[1] - ih / 2;
    if (placement === "corner") { x0 = ox0; y0 = oy0; } else if (placement === "on_base") { y0 = oy1 - ih; }
    sheet.raw(`<rect x="${f(x0)}" y="${f(y0)}" width="${f(iw)}" height="${f(ih)}" ${innerFill} stroke="#111" stroke-width="2"/>`);
    const P: Pt[] = [[x0, y0], [x0 + iw, y0], [x0 + iw, y0 + ih], [x0, y0 + ih]]; for (let k = 0; k < 4; k++) sheet.registerSegment(P[k], P[(k + 1) % 4]);
    if (spec.inner.side) sheet.label(x0 + iw / 2, y0 + ih + 14, spec.inner.side, "안쪽 변");
    if (spec.inner.width) sheet.label(x0 + iw / 2, y0 + ih + 14, spec.inner.width, "안쪽 너비");
    if (spec.inner.height) sheet.label(x0 + iw + halfDiag(spec.inner.height) + 4, y0 + ih / 2, spec.inner.height, "안쪽 높이");
  }
  // 바깥 치수 라벨(바깥쪽)
  if (spec.outer.kind === "circle") {
    if (spec.outer.radius) {
      // 내접 도형의 꼭짓점 방향(정사각형 45°, 삼각형 90°)으로 반지름을 그리고 라벨은 원 안·도형 밖 자리 후보 중 고른다.
      // 삼각형(꼭짓점 위)은 아래쪽 반지름(밑변을 지나 원까지) — 라벨이 밑변 아래 빈 자리에 놓인다.
      const ang = spec.inner.kind === "triangle" ? -Math.PI / 2 : Math.PI / 4;
      const end: Pt = [c[0] + R * Math.cos(ang), c[1] - R * Math.sin(ang)];
      sheet.line(c, end, { w: 1.4 }); sheet.dot(c);
      const cands: Pt[] = [0.62, 0.75, 0.5].flatMap((t) => { const m: Pt = [c[0] + (end[0] - c[0]) * t, c[1] + (end[1] - c[1]) * t]; const d = halfDiag(spec.outer.radius!) + 4; return [[m[0] + d * Math.sin(ang), m[1] + d * Math.cos(ang)], [m[0] - d * Math.sin(ang), m[1] - d * Math.cos(ang)]] as Pt[]; });
      put(cands, spec.outer.radius, "바깥 원 반지름");
    }
    if (spec.outer.diameter) put([[c[0] + R + 14 + halfDiag(spec.outer.diameter), c[1]]], spec.outer.diameter, "바깥 원 지름");
  }
  else { const lbl = spec.outer.kind === "square" ? spec.outer.side : spec.outer.width; if (lbl) sheet.label(c[0], oy1 + 16, lbl, "바깥 아래 변"); if (spec.outer.kind === "rectangle" && spec.outer.height) sheet.label(ox1 + halfDiag(spec.outer.height) + 6, c[1], spec.outer.height, "바깥 높이"); if (spec.outer.kind === "square" && spec.outer.side && spec.inner.kind === "semicircle") { /* 위에 반원이 있어 아래만 */ } }
  if (spec.notToScale) sheet.note("Note: Figure not drawn to scale.");
  const ko = { square: "정사각형", rectangle: "직사각형", circle: "원", semicircle: "반원", triangle: "삼각형" } as const;
  const alt = `${ko[spec.outer.kind]} 안에 ${ko[spec.inner.kind]}${spec.inner.kind === "semicircle" ? "(위 변 위)" : ""}. 음영: ${spec.shaded === "outer_minus_inner" ? "바깥 도형에서 안쪽 도형을 뺀 영역" : spec.shaded === "inner" ? "안쪽 도형" : "없음"}. ` + Object.entries({ ...spec.outer, ...Object.fromEntries(Object.entries(spec.inner).map(([k, v]) => ["inner_" + k, v])) }).filter(([k, v]) => !["kind", "inner_kind", "inner_placement"].includes(k) && v).map(([k, v]) => `${k} = ${v}`).join(", ");
  return { svg: sheet.svg(alt), alt, issues: dedupe([...issues, ...sheet.uniqueIssues()]) };
}

export function lintCompositeAgainstText(spec: CompositeSpec, passage: string): FigureIssue[] {
  const issues: FigureIssue[] = [];
  const text = passage.replace(/\$/g, "");
  const words: Record<string, RegExp> = { square: /\bsquare\b/i, rectangle: /\brectangl/i, circle: /\bcircle|circular\b/i, semicircle: /\bsemicircle|semicircular\b/i, triangle: /\btriangl/i };
  if (!words[spec.outer.kind].test(text)) issues.push({ code: "ref_missing", message: `지문에 바깥 도형(${spec.outer.kind})이 언급되지 않습니다.` });
  if (!words[spec.inner.kind].test(text)) issues.push({ code: "ref_missing", message: `지문에 안쪽 도형(${spec.inner.kind})이 언급되지 않습니다.` });
  if (/\bshaded\b/i.test(text) && spec.shaded === "none") issues.push({ code: "ref_mismatch", message: "지문은 음영 영역을 말하지만 도형에 음영이 없습니다." });
  const labels = [...Object.values(spec.outer), ...Object.values(spec.inner)].filter((v): v is string => typeof v === "string").map((v) => v.replace(/\s+/g, ""));
  for (const m of text.matchAll(/\b(?:radius|side|side length|width|height|diameter|length)\s+(?:of\s+)?(?:is\s+)?(\d+(?:\.\d+)?)\b/gi)) if (!labels.some((l) => l.replace(/[a-zA-Z]+$/, "") === m[1])) issues.push({ code: "ref_missing", message: `지문의 치수 ${m[0]} 가 도형 라벨에 없습니다.` });
  return dedupe(issues);
}
