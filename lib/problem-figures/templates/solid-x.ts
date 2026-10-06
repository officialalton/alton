// 표준 렌더링 엔진 — 템플릿: 입체 확장(직육면체 대각선·삼각기둥·원기둥 축 단면·원기둥+반구 합성)
//
// 치수는 dims[].label(숫자·문자·식)로만 받는다. 모양·숨은 모서리(점선)·대각선·단면은 여기서 그린다. 도식은 항상 "not drawn to scale"(SAT 규칙)이다.
//  box_diagonal      직육면체 + 공간 대각선(space)·밑면 대각선(face_bottom)·앞면 대각선(face_front)·둘 다(both = 밑면 + 공간)
//  triangular_prism  직각삼각형 밑면(legA 가로, legB 세로, hyp 빗변)과 기둥 길이(length)
//  cylinder_section  원기둥과 축을 지나는 단면(점선 직사각형)과 그 대각선(diag)
//  cylinder_hemisphere 원기둥 위에 반구(반지름 radius, 원기둥 높이 height)

import { dedupe, f, halfDiag, Sheet, type FigureIssue, type Pt } from "./_layout";

export type SolidXKind = "box_diagonal" | "triangular_prism" | "cylinder_section" | "cylinder_hemisphere";
const IDS: Record<SolidXKind, string[]> = {
  box_diagonal: ["length", "width", "height", "diag", "face"],
  triangular_prism: ["legA", "legB", "hyp", "length"],
  cylinder_section: ["radius", "diameter", "height", "diag"],
  cylinder_hemisphere: ["radius", "height"],
};
export type SolidXSpec = {
  type: "solid_x";
  kind: SolidXKind;
  dims: { id: string; label: string }[];
  /** box_diagonal 전용. */
  diagonal?: "space" | "face_bottom" | "face_front" | "both";
  notToScale?: boolean;
};
const isLabel = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0 && v.trim().length <= 12;

export function validateSolidX(input: unknown): { ok: true; spec: SolidXSpec } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "그림 데이터가 객체가 아닙니다." };
  const s = input as Record<string, unknown>;
  if (s.type !== "solid_x") return { ok: false, error: "type 이 solid_x 가 아닙니다." };
  if (!(String(s.kind) in IDS)) return { ok: false, error: `kind 는 ${Object.keys(IDS).join("|")} 입니다.` };
  if (!Array.isArray(s.dims)) return { ok: false, error: "dims 배열이 필요합니다." };
  const seen = new Set<string>();
  for (const d of s.dims as Record<string, unknown>[]) {
    if (!d || !IDS[s.kind as SolidXKind].includes(String(d.id))) return { ok: false, error: `${String(s.kind)} 의 dims.id 는 ${IDS[s.kind as SolidXKind].join(", ")} 입니다.` };
    if (!isLabel(d.label)) return { ok: false, error: "dims[].label 은 12자 이내 문자열입니다." };
    if (seen.has(String(d.id))) return { ok: false, error: `dims.id ${String(d.id)} 가 중복됩니다.` }; seen.add(String(d.id));
  }
  if (s.diagonal !== undefined && (s.kind !== "box_diagonal" || !["space", "face_bottom", "face_front", "both"].includes(String(s.diagonal)))) return { ok: false, error: "diagonal 은 box_diagonal 의 space|face_bottom|face_front|both 입니다." };
  return { ok: true, spec: s as unknown as SolidXSpec };
}

export const SX_GEOM = { W: 400, H: 290 } as const;
export function renderSolidX(spec: SolidXSpec): { svg: string; alt: string; issues: FigureIssue[] } {
  const { W, H } = SX_GEOM; const sheet = new Sheet(W, H); const issues: FigureIssue[] = [];
  const lab = (id: string) => spec.dims.find((d) => d.id === id)?.label;
  const dash = (a: Pt, b: Pt) => sheet.line(a, b, { w: 1.6, dashed: true });
  const ell = (c: Pt, rx: number, ry: number, half: "front" | "back" | "full") => {
    const pts: Pt[] = []; for (let i = 0; i <= 40; i++) { const t = (i / 40) * Math.PI * (half === "full" ? 2 : 1) + (half === "back" ? Math.PI : 0); pts.push([c[0] + rx * Math.cos(t), c[1] - (half === "front" ? -1 : 1) * ry * Math.sin(half === "back" ? t - Math.PI : t) * (half === "front" ? 1 : 1)]); }
    if (half === "front") { const p: Pt[] = []; for (let i = 0; i <= 40; i++) { const t = (i / 40) * Math.PI; p.push([c[0] - rx * Math.cos(t), c[1] + ry * Math.sin(t)]); } sheet.polyline(p, { w: 2 }); }
    else if (half === "back") { const p: Pt[] = []; for (let i = 0; i <= 40; i++) { const t = (i / 40) * Math.PI; p.push([c[0] - rx * Math.cos(t), c[1] - ry * Math.sin(t)]); } sheet.polyline(p, { w: 1.6, dashed: true }); }
    else { const p: Pt[] = []; for (let i = 0; i <= 80; i++) { const t = (i / 80) * 2 * Math.PI; p.push([c[0] + rx * Math.cos(t), c[1] + ry * Math.sin(t)]); } sheet.polyline(p, { w: 2 }); }
  };
  const place = (cands: Pt[], t: string | undefined, what: string) => { if (!t) return; const spot = sheet.firstFree(cands, t); if (spot) sheet.label(spot[0], spot[1], t, what); else issues.push({ code: "label_collision", message: `${what} '${t}' 을 놓을 자리가 없습니다.` }); };
  const ring = (c: Pt, rs: number[]): Pt[] => rs.flatMap((r) => [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a): Pt => [c[0] + r * Math.cos((a * Math.PI) / 180), c[1] - r * Math.sin((a * Math.PI) / 180)]));
  const parts: string[] = [];
  if (spec.kind === "box_diagonal") {
    const w = 160, h = 104, dep: Pt = [68, -30]; const x0 = 70, y0 = 215;
    const A: Pt = [x0, y0], B: Pt = [x0 + w, y0], C: Pt = [x0 + w, y0 - h], D: Pt = [x0, y0 - h]; const sh = (p: Pt): Pt => [p[0] + dep[0], p[1] + dep[1]]; const A2 = sh(A), B2 = sh(B), C2 = sh(C), D2 = sh(D);
    for (const [p, q] of [[A, B], [B, C], [C, D], [D, A], [B, B2], [C, C2], [D, D2], [B2, C2], [C2, D2]] as [Pt, Pt][]) sheet.line(p, q);
    for (const [p, q] of [[A, A2], [A2, B2], [A2, D2]] as [Pt, Pt][]) dash(p, q);
    const dg = spec.diagonal ?? "space";
    if (dg === "space" || dg === "both") sheet.line(A, C2, { w: 2.2, dashed: true });
    if (dg === "face_bottom" || dg === "both") dash(A, B2);
    if (dg === "face_front") dash(A, C);
    place([[(A[0] + B[0]) / 2, A[1] + 17], [(A[0] + B[0]) / 2 - 30, A[1] + 17]], lab("length"), "길이 라벨");
    place([[(B[0] + B2[0]) / 2 + 16, (B[1] + B2[1]) / 2 + 12], [(B[0] + B2[0]) / 2 + 20, (B[1] + B2[1]) / 2 + 22]], lab("width"), "너비 라벨");
    place([[B[0] + 18, (B[1] + C[1]) / 2], [B[0] - 18, (B[1] + C[1]) / 2 + 14], [A[0] - 16, (A[1] + D[1]) / 2]], lab("height"), "높이 라벨");
    const dm: Pt = dg === "face_front" ? [(A[0] + C[0]) / 2, (A[1] + C[1]) / 2] : dg === "face_bottom" ? [(A[0] + B2[0]) / 2, (A[1] + B2[1]) / 2] : [(A[0] + C2[0]) / 2, (A[1] + C2[1]) / 2];
    place(ring(dm, [16, 26, 38]), lab("diag"), "대각선 라벨");
    if (dg === "both") place(ring([(A[0] + B2[0]) / 2, (A[1] + B2[1]) / 2], [14, 24, 36, 50]), lab("face"), "밑면 대각선 라벨");
    parts.push(`직육면체(대각선 ${dg}), 길이 ${lab("length") ?? "?"}, 너비 ${lab("width") ?? "?"}, 높이 ${lab("height") ?? "?"}${lab("diag") ? `, 대각선 ${lab("diag")}` : ""}`);
  } else if (spec.kind === "triangular_prism") {
    const a = 170, b = 120, dep: Pt = [64, -42]; const x0 = 62, y0 = 225;
    const P0: Pt = [x0, y0], P1: Pt = [x0 + a, y0], P2: Pt = [x0, y0 - b]; const sh = (p: Pt): Pt => [p[0] + dep[0], p[1] + dep[1]]; const Q0 = sh(P0), Q1 = sh(P1), Q2 = sh(P2);
    for (const [p, q] of [[P0, P1], [P1, P2], [P2, P0], [P1, Q1], [P2, Q2], [Q2, Q1]] as [Pt, Pt][]) sheet.line(p, q);
    for (const [p, q] of [[P0, Q0], [Q0, Q1], [Q0, Q2]] as [Pt, Pt][]) dash(p, q);
    sheet.rightAngle(P0, 0, Math.PI / 2, 10);
    place([[(P0[0] + P1[0]) / 2, P0[1] + 17]], lab("legA"), "밑변 라벨");
    place([[P0[0] - 18, (P0[1] + P2[1]) / 2], [P0[0] - 28, (P0[1] + P2[1]) / 2 - 8]], lab("legB"), "높이 라벨");
    place(ring([(P1[0] + P2[0]) / 2, (P1[1] + P2[1]) / 2], [16, 26]), lab("hyp"), "빗변 라벨");
    place([[(P1[0] + Q1[0]) / 2 + 16, (P1[1] + Q1[1]) / 2 + 12], [(P1[0] + Q1[0]) / 2 + 22, (P1[1] + Q1[1]) / 2 + 24]], lab("length"), "기둥 길이 라벨");
    parts.push(`삼각기둥, 밑면은 직각삼각형(가로 ${lab("legA") ?? "?"}, 세로 ${lab("legB") ?? "?"}${lab("hyp") ? `, 빗변 ${lab("hyp")}` : ""}), 기둥 길이 ${lab("length") ?? "?"}`);
  } else {
    const hasSection = spec.kind === "cylinder_section"; const rx = 70, ry = 30; const c: Pt = [170, hasSection ? 62 : 118]; const hpx = hasSection ? 150 : 100;
    const bot: Pt = [c[0], c[1] + hpx];
    if (spec.kind === "cylinder_hemisphere") {
      // 반구: 윗면 타원 위의 반원(지름 = 윗면 지름)
      const dome: Pt[] = []; for (let i = 0; i <= 60; i++) { const t = (i / 60) * Math.PI; dome.push([c[0] - rx * Math.cos(t), c[1] - rx * Math.sin(t)]); }
      sheet.polyline(dome, { w: 2 }); ell(c, rx, ry, "front"); ell(c, rx, ry, "back");
    } else ell(c, rx, ry, "full");
    sheet.line([c[0] - rx, c[1]], [c[0] - rx, bot[1]]); sheet.line([c[0] + rx, c[1]], [c[0] + rx, bot[1]]); ell(bot, rx, ry, "front"); ell(bot, rx, ry, "back");
    const hx = c[0] + rx + 40;
    sheet.line([c[0] + rx, c[1]], [hx, c[1]], { w: 0.8, dashed: true }); sheet.line([c[0] + rx, bot[1]], [hx, bot[1]], { w: 0.8, dashed: true }); sheet.line([hx, c[1]], [hx, bot[1]], { w: 1.3 });
    for (const y of [c[1], bot[1]]) sheet.raw(`<line x1="${f(hx - 4)}" y1="${f(y)}" x2="${f(hx + 4)}" y2="${f(y)}" stroke="#111" stroke-width="1.3"/>`);
    place([[hx + 12 + halfDiag(lab("height") ?? ""), (c[1] + bot[1]) / 2]], lab("height"), "높이 라벨");
    const rl = lab("radius"), dl = lab("diameter");
    if (rl) { sheet.dot(c); sheet.line(c, [c[0] + rx, c[1]], { w: 1.3 }); place([[c[0] + rx / 2, c[1] - 13], [c[0] + rx / 2, c[1] - 14], [c[0] + rx / 2, c[1] + 14], [c[0] + rx * 0.7, c[1] + 15], [c[0] + rx + 17, c[1] - 13], [c[0] + rx + 17, c[1] + 14]], rl, "반지름 라벨"); }
    if (dl) { sheet.line([c[0] - rx, c[1]], [c[0] + rx, c[1]], { w: 1.3 }); place([[c[0], c[1] - 14], [c[0], c[1] + 16], [c[0] + rx + 17, c[1] - 13]], dl, "지름 라벨"); }
    if (hasSection) {
      const TL: Pt = [c[0] - rx, c[1]], TR: Pt = [c[0] + rx, c[1]], BL: Pt = [c[0] - rx, bot[1]], BR: Pt = [c[0] + rx, bot[1]];
      dash(TL, TR); dash(BL, BR); sheet.line(TL, BR, { w: 2.2, dashed: true });
      place(ring([(TL[0] + BR[0]) / 2, (TL[1] + BR[1]) / 2], [14, 24, 36]), lab("diag"), "단면 대각선 라벨");
    }
    parts.push(spec.kind === "cylinder_section" ? `원기둥과 축 단면(대각선 ${lab("diag") ?? "?"}), ${rl ? `반지름 ${rl}` : dl ? `지름 ${dl}` : ""}, 높이 ${lab("height") ?? "?"}` : `원기둥 위에 반구, 반지름 ${rl ?? "?"}, 원기둥 높이 ${lab("height") ?? "?"}`);
  }
  sheet.note("Note: Figure not drawn to scale.");
  const alt = `${parts.join("")}. 숨은 모서리는 점선.`;
  return { svg: sheet.svg(alt), alt, issues: dedupe([...issues, ...sheet.uniqueIssues()]) };
}

export function lintSolidXAgainstText(spec: SolidXSpec, passage: string): FigureIssue[] {
  const issues: FigureIssue[] = []; const text = passage.replace(/\$/g, "");
  const words: Record<SolidXKind, RegExp> = { box_diagonal: /\b(rectangular (?:prism|box)|box)\b/i, triangular_prism: /\btriangular prism\b/i, cylinder_section: /\bcylind(?:er|rical)\b/i, cylinder_hemisphere: /\b(?:cylinder|hemisphere)\b/i };
  void spec;
  void words;
  return dedupe(issues);
}
