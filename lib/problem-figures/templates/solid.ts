// 표준 렌더링 엔진 — 템플릿 7: 입체도형 2.5D 도식 (직육면체·정육면체·원기둥·원뿔·구·사각뿔)
// 치수 라벨만 받는다. 숨은 모서리는 점선, 밑면·높이·반지름 라벨은 정해진 자리. 겉넓이·부피 문항의 도식.

import { dedupe, esc, f, halfDiag, Sheet, type FigureIssue, type Pt } from "./_layout";

export type SolidKind = "rectangular_prism" | "cube" | "cylinder" | "cone" | "sphere" | "square_pyramid";
export type SolidSpec = {
  type: "solid";
  kind: SolidKind;
  /** 치수 라벨(글자) — 값·미지수·단위 포함 가능. 종류마다 쓰는 키가 다르다. */
  dims: { length?: string; width?: string; height?: string; radius?: string; diameter?: string; slant?: string; edge?: string };
  notToScale?: boolean;
};

const isLabel = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0 && v.trim().length <= 12;
const ALLOWED: Record<SolidKind, (keyof SolidSpec["dims"])[]> = {
  rectangular_prism: ["length", "width", "height"],
  cube: ["edge"],
  cylinder: ["radius", "diameter", "height"],
  cone: ["radius", "diameter", "height", "slant"],
  sphere: ["radius", "diameter"],
  square_pyramid: ["edge", "height", "slant"],
};

export function validateSolid(input: unknown): { ok: true; spec: SolidSpec } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "그림 데이터가 객체가 아닙니다." };
  const s = input as Record<string, unknown>;
  if (s.type !== "solid") return { ok: false, error: "type 이 solid 가 아닙니다." };
  if (!(String(s.kind) in ALLOWED)) return { ok: false, error: `kind 는 ${Object.keys(ALLOWED).join("|")} 입니다.` };
  if (!s.dims || typeof s.dims !== "object") return { ok: false, error: "dims 객체가 필요합니다." };
  const dims = s.dims as Record<string, unknown>;
  for (const [k, v] of Object.entries(dims)) {
    if (v === undefined || v === null) continue;
    if (!ALLOWED[s.kind as SolidKind].includes(k as keyof SolidSpec["dims"])) return { ok: false, error: `${String(s.kind)} 에는 dims.${k} 를 쓰지 않습니다(허용: ${ALLOWED[s.kind as SolidKind].join(", ")}).` };
    if (!isLabel(v)) return { ok: false, error: `dims.${k} 는 12자 이내 라벨입니다.` };
  }
  if (dims.radius && dims.diameter) return { ok: false, error: "radius 와 diameter 는 하나만 씁니다." };
  return { ok: true, spec: s as unknown as SolidSpec };
}

export function renderSolid(spec: SolidSpec): { svg: string; alt: string; issues: FigureIssue[] } {
  const W = 360, H = 280;
  const sheet = new Sheet(W, H);
  const issues: FigureIssue[] = [];
  const d = spec.dims;
  const dash = (a: Pt, b: Pt) => sheet.line(a, b, { dashed: true, w: 1.4 });
  const ell = (c: Pt, rx: number, ry: number, half?: "front" | "back", dashed = false) => {
    if (!half) sheet.raw(`<ellipse cx="${f(c[0])}" cy="${f(c[1])}" rx="${f(rx)}" ry="${f(ry)}" fill="none" stroke="#111" stroke-width="2"/>`);
    else {
      const sweep = half === "front" ? 0 : 1;
      sheet.raw(`<path d="M ${f(c[0] - rx)} ${f(c[1])} A ${f(rx)} ${f(ry)} 0 0 ${sweep} ${f(c[0] + rx)} ${f(c[1])}" fill="none" stroke="#111" stroke-width="${dashed ? 1.4 : 2}"${dashed ? ' stroke-dasharray="5 4"' : ""}/>`);
    }
  };
  const dimLabel = (x: number, y: number, t: string | undefined, what: string) => { if (t) sheet.label(x, y, t, what); };
  /** 세로 선 옆 라벨 — 오른쪽·왼쪽 후보 중 겹치지 않는 자리(규칙). */
  const sideLabel = (mid: Pt, t: string, what: string) => {
    const off = halfDiag(t) + 5;
    const spot = sheet.firstFree([[mid[0] + off, mid[1]], [mid[0] - off, mid[1]], [mid[0] + off + 8, mid[1] - 10], [mid[0] - off - 8, mid[1] - 10], [mid[0] + off + 16, mid[1] + 12], [mid[0] - off - 16, mid[1] + 12], [mid[0] + off + 6, mid[1] + 26], [mid[0] - off - 6, mid[1] + 26]], t);
    if (spot) sheet.label(spot[0], spot[1], t, what); else issues.push({ code: "label_collision", message: `${what} '${t}' 을 놓을 자리가 없습니다.` });
  };
  const parts: string[] = [];
  switch (spec.kind) {
    case "rectangular_prism":
    case "cube": {
      const w = spec.kind === "cube" ? 130 : 170, h = spec.kind === "cube" ? 130 : 110, dep: Pt = [60, -40];
      const x0 = 70, y0 = 215;
      const A: Pt = [x0, y0], B: Pt = [x0 + w, y0], C: Pt = [x0 + w, y0 - h], D: Pt = [x0, y0 - h];
      const A2: Pt = [A[0] + dep[0], A[1] + dep[1]], B2: Pt = [B[0] + dep[0], B[1] + dep[1]], C2: Pt = [C[0] + dep[0], C[1] + dep[1]], D2: Pt = [D[0] + dep[0], D[1] + dep[1]];
      sheet.line(A, B); sheet.line(B, C); sheet.line(C, D); sheet.line(D, A);
      sheet.line(B, B2); sheet.line(C, C2); sheet.line(D, D2); sheet.line(B2, C2); sheet.line(C2, D2);
      dash(A, A2); dash(A2, B2); dash(A2, D2);
      const L = spec.kind === "cube" ? d.edge : d.length, Wd = spec.kind === "cube" ? undefined : d.width, Hd = spec.kind === "cube" ? undefined : d.height;
      dimLabel((A[0] + B[0]) / 2, A[1] + 16, L, "길이 라벨");
      dimLabel((B[0] + B2[0]) / 2 + 14, (B[1] + B2[1]) / 2 + 10, Wd, "너비 라벨");
      dimLabel(B[0] + 14 + (Hd ? halfDiag(Hd) : 0), (B[1] + C[1]) / 2, Hd, "높이 라벨");
      parts.push(spec.kind === "cube" ? `정육면체, 모서리 ${d.edge ?? "?"}` : `직육면체, 길이 ${d.length ?? "?"}, 너비 ${d.width ?? "?"}, 높이 ${d.height ?? "?"}`);
      break;
    }
    case "cylinder": {
      const c: Pt = [180, 70], rx = 80, ry = 24, h = 130;
      ell(c, rx, ry);
      sheet.line([c[0] - rx, c[1]], [c[0] - rx, c[1] + h]); sheet.line([c[0] + rx, c[1]], [c[0] + rx, c[1] + h]);
      ell([c[0], c[1] + h], rx, ry, "front"); ell([c[0], c[1] + h], rx, ry, "back", true);
      const r = d.radius ?? d.diameter;
      if (r) { if (d.radius) { sheet.line(c, [c[0] + rx, c[1]], { w: 1.4 }); sheet.dot(c); dimLabel(c[0] + rx / 2, c[1] - 12, d.radius, "반지름 라벨"); } else { sheet.line([c[0] - rx, c[1]], [c[0] + rx, c[1]], { w: 1.4 }); dimLabel(c[0], c[1] - 12, d.diameter, "지름 라벨"); } }
      dimLabel(c[0] + rx + 12 + (d.height ? halfDiag(d.height) : 0), c[1] + h / 2, d.height, "높이 라벨");
      parts.push(`원기둥, ${d.radius ? `반지름 ${d.radius}` : d.diameter ? `지름 ${d.diameter}` : ""}${d.height ? `, 높이 ${d.height}` : ""}`);
      break;
    }
    case "cone": {
      const c: Pt = [180, 215], rx = 85, ry = 24, apex: Pt = [180, 60];
      ell(c, rx, ry, "front"); ell(c, rx, ry, "back", true);
      sheet.line(apex, [c[0] - rx, c[1]]); sheet.line(apex, [c[0] + rx, c[1]]);
      if (d.height) { dash(apex, c); sheet.rightAngle(c, 0, Math.PI / 2, 8); sideLabel([c[0], (apex[1] + c[1]) / 2], d.height, "높이 라벨"); }
      if (d.radius) { sheet.line(c, [c[0] + rx, c[1]], { w: 1.4 }); sheet.dot(c); dimLabel(c[0] + rx / 2, c[1] + 14, d.radius, "반지름 라벨"); }
      if (d.diameter) { sheet.line([c[0] - rx, c[1]], [c[0] + rx, c[1]], { w: 1.4 }); dimLabel(c[0], c[1] + 14, d.diameter, "지름 라벨"); }
      dimLabel((apex[0] + c[0] + rx) / 2 + 12 + (d.slant ? halfDiag(d.slant) : 0), (apex[1] + c[1]) / 2, d.slant, "모선 라벨");
      parts.push(`원뿔${d.radius ? `, 반지름 ${d.radius}` : ""}${d.diameter ? `, 지름 ${d.diameter}` : ""}${d.height ? `, 높이 ${d.height}` : ""}${d.slant ? `, 모선 ${d.slant}` : ""}`);
      break;
    }
    case "sphere": {
      const c: Pt = [180, 140], R = 90;
      sheet.raw(`<circle cx="${c[0]}" cy="${c[1]}" r="${R}" fill="none" stroke="#111" stroke-width="2"/>`);
      ell(c, R, 26, "front"); ell(c, R, 26, "back", true);
      sheet.dot(c);
      if (d.radius) { sheet.line(c, [c[0] + R, c[1]], { w: 1.4 }); dimLabel(c[0] + R / 2, c[1] - 12, d.radius, "반지름 라벨"); }
      if (d.diameter) { sheet.line([c[0] - R, c[1]], [c[0] + R, c[1]], { w: 1.4 }); dimLabel(c[0], c[1] - 12, d.diameter, "지름 라벨"); }
      parts.push(`구${d.radius ? `, 반지름 ${d.radius}` : ""}${d.diameter ? `, 지름 ${d.diameter}` : ""}`);
      break;
    }
    case "square_pyramid": {
      const x0 = 80, y0 = 220, w = 150, dep: Pt = [60, -35];
      const A: Pt = [x0, y0], B: Pt = [x0 + w, y0], C: Pt = [B[0] + dep[0], B[1] + dep[1]], D: Pt = [A[0] + dep[0], A[1] + dep[1]];
      const base: Pt = [(A[0] + C[0]) / 2, (A[1] + C[1]) / 2], apex: Pt = [base[0], 55];
      sheet.line(A, B); sheet.line(B, C); dash(C, D); dash(D, A);
      sheet.line(apex, A); sheet.line(apex, B); sheet.line(apex, C); dash(apex, D);
      // 높이 라벨은 옆 모서리가 벌어진 밑면 가까이(규칙) — 가운데 높이에서는 네 모서리와 겹친다.
      if (d.height) { dash(apex, base); sheet.rightAngle(base, 0, Math.PI / 2, 7); sideLabel([base[0], base[1] - 34], d.height, "높이 라벨"); }
      dimLabel((A[0] + B[0]) / 2, A[1] + 16, d.edge, "밑면 모서리 라벨");
      if (d.slant) { const mid: Pt = [(A[0] + B[0]) / 2, A[1]]; dash(apex, mid); dimLabel((apex[0] + mid[0]) / 2 - 10 - halfDiag(d.slant), (apex[1] + mid[1]) / 2, d.slant, "모선(경사 높이) 라벨"); }
      parts.push(`정사각뿔${d.edge ? `, 밑면 모서리 ${d.edge}` : ""}${d.height ? `, 높이 ${d.height}` : ""}${d.slant ? `, 경사 높이 ${d.slant}` : ""}`);
      break;
    }
  }
  if (spec.notToScale) sheet.note("Note: Figure not drawn to scale.");
  const alt = `${parts.join("")}. 숨은 모서리는 점선.`;
  return { svg: sheet.svg(alt), alt, issues: dedupe([...issues, ...sheet.uniqueIssues()]) };
}

/** 지문 참조 — 종류 낱말(cylinder …)과 치수 값("radius of 3", "height 10 inches", "edge length 4"). */
export function lintSolidAgainstText(spec: SolidSpec, passage: string): FigureIssue[] {
  const issues: FigureIssue[] = [];
  const text = passage.replace(/\$/g, "").replace(/−/g, "-");
  const kindWords: Record<SolidKind, RegExp> = { rectangular_prism: /\b(rectangular prism|rectangular box|box)\b/i, cube: /\bcube\b/i, cylinder: /\bcylind(er|rical)\b/i, cone: /\bcone\b/i, sphere: /\bsphere|spherical\b/i, square_pyramid: /\bpyramid\b/i };
  for (const [k, re] of Object.entries(kindWords) as [SolidKind, RegExp][]) if (k !== spec.kind && re.test(text)) issues.push({ code: "ref_mismatch", message: `지문은 ${k.replace("_", " ")} 를 말하지만 도식의 kind 는 ${spec.kind} 입니다.` });
  // 라벨 '10 cm' 의 단위는 떼고 비교하되, 'h'·'r' 같은 미지수 한 글자는 그대로 둔다.
  const val = (t?: string) => { const c = (t ?? "").replace(/\s+/g, ""); return /^\d/.test(c) ? c.replace(/[a-zA-Z]+$/, "") : c; };
  const checks: [RegExp, keyof SolidSpec["dims"], string][] = [
    [/\bradius\s+(?:of\s+)?(?:is\s+)?(\d+(?:\.\d+)?|[a-z])\b/gi, "radius", "반지름"],
    [/\bdiameter\s+(?:of\s+)?(?:is\s+)?(\d+(?:\.\d+)?|[a-z])\b/gi, "diameter", "지름"],
    [/(?<!slant\s)\bheight\s+(?:of\s+)?(?:is\s+)?(\d+(?:\.\d+)?|[a-z])\b/gi, "height", "높이"],
    [/\bslant height\s+(?:of\s+)?(?:is\s+)?(\d+(?:\.\d+)?|[a-z])\b/gi, "slant", "모선"],
    [/\b(?:edge|side)\s+(?:length\s+)?(?:of\s+)?(?:is\s+)?(\d+(?:\.\d+)?|[a-z])\b/gi, "edge", "모서리"],
    [/\blength\s+(?:of\s+)?(?:is\s+)?(\d+(?:\.\d+)?)\b/gi, "length", "길이"],
    [/\bwidth\s+(?:of\s+)?(?:is\s+)?(\d+(?:\.\d+)?)\b/gi, "width", "너비"],
  ];
  for (const [re, key, ko] of checks) {
    for (const m of text.matchAll(re)) {
      const lbl = spec.dims[key];
      if (lbl === undefined) { if (ALLOWED[spec.kind].includes(key)) issues.push({ code: "ref_missing", message: `지문은 ${ko} ${m[1]} 을 말하지만 도식에 ${ko} 라벨이 없습니다.` }); }
      else if (val(lbl) !== m[1] && !/^[a-z]$/i.test(val(lbl))) issues.push({ code: "ref_mismatch", message: `지문은 ${ko} ${m[1]} 인데 도식 라벨은 '${lbl}' 입니다.` });
    }
  }
  return dedupe(issues);
}
