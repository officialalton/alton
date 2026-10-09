// 표준 렌더링 엔진 — 템플릿: 단위원·표준위치 각 (삼각비·라디안 문항의 도식)
//
// AI/생성기는 **관계만** 낸다: 단위원 위의 점(이름·좌표 라벨), 각 호(양의 x축 → 점 방향)의 라벨.
// 점의 실제 위치는 angle(도, 0 이상 360 미만 — 인쇄하지 않는다)로 정하고 라벨은 데이터와 별개로 인쇄된다.
// 라벨의 좌표 (x, y) 는 cos·sin 에 맞아야 하고(G8 가 확인), 좌표·눈금 숫자는 우리가 그린다.

import { ARC_R, dedupe, f, halfDiag, Sheet, type FigureIssue, type Pt } from "./_layout";

export type UnitCirclePoint = {
  /** 점 이름(P, Q …). */
  name?: string;
  /** 그림에서 점이 놓일 각(도, [0, 360)) — 인쇄되지 않는다. */
  angle: number;
  /** 점 옆에 인쇄되는 좌표 라벨 — "(3/5, 4/5)", "(−√3/2, 1/2)", "(x, 4/5)". */
  label?: string;
  /** 원점에서 점까지 반직선을 그릴지(기본 true). */
  ray?: boolean;
};
export type UnitCircleArc = {
  /** 호의 시작: 양의 x축(기본) 또는 다른 점의 index. */
  from?: number;
  /** 호의 끝 점 index(points). */
  to: number;
  /** 호 라벨 — "θ", "5π/6", "120°". */
  label?: string;
};
export type UnitCircleSpec = {
  type: "unit_circle";
  points: UnitCirclePoint[];
  arcs?: UnitCircleArc[];
  /** 축·원 위 눈금 숫자 1, −1 을 인쇄할지(기본 true). */
  unitTicks?: boolean;
};

const isName = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0 && v.trim().length <= 3;
const isLab = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0 && v.trim().length <= 18;

export function validateUnitCircle(input: unknown): { ok: true; spec: UnitCircleSpec } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "그림 데이터가 객체가 아닙니다." };
  const s = input as Record<string, unknown>;
  if (s.type !== "unit_circle") return { ok: false, error: "type 이 unit_circle 이 아닙니다." };
  if (!Array.isArray(s.points) || s.points.length < 1 || s.points.length > 3) return { ok: false, error: "points 는 1~3개여야 합니다." };
  const names: string[] = [];
  for (const p of s.points as Record<string, unknown>[]) {
    if (!p || typeof p.angle !== "number" || !Number.isFinite(p.angle) || p.angle < 0 || p.angle >= 360) return { ok: false, error: "points[].angle 은 0 이상 360 미만 숫자(도)여야 합니다." };
    if (p.name !== undefined) { if (!isName(p.name)) return { ok: false, error: "points[].name 은 3자 이내 이름입니다." }; names.push(p.name); }
    if (p.label !== undefined && !isLab(p.label)) return { ok: false, error: "points[].label 은 18자 이내 문자열입니다." };
  }
  if (new Set(names).size !== names.length) return { ok: false, error: "점 이름이 중복됩니다." };
  if (s.arcs !== undefined) {
    if (!Array.isArray(s.arcs) || s.arcs.length > 3) return { ok: false, error: "arcs 는 3개 이내 배열입니다." };
    const n = s.points.length;
    for (const a of s.arcs as Record<string, unknown>[]) {
      if (!a || !Number.isInteger(a.to) || (a.to as number) < 0 || (a.to as number) >= n) return { ok: false, error: "arcs[].to 는 points 의 index 여야 합니다." };
      if (a.from !== undefined && (!Number.isInteger(a.from) || (a.from as number) < 0 || (a.from as number) >= n)) return { ok: false, error: "arcs[].from 은 points 의 index 여야 합니다." };
      if (a.label !== undefined && !isLab(a.label)) return { ok: false, error: "arcs[].label 은 18자 이내 문자열입니다." };
    }
  }
  return { ok: true, spec: s as unknown as UnitCircleSpec };
}

export const UC_GEOM = { W: 460, H: 380, CX: 230, CY: 190, R: 120 } as const;
const rad = (d: number) => (d * Math.PI) / 180;

export function renderUnitCircle(spec: UnitCircleSpec): { svg: string; alt: string; issues: FigureIssue[] } {
  const { W, H, CX, CY, R } = UC_GEOM;
  const sheet = new Sheet(W, H);
  const C: Pt = [CX, CY];
  const at = (deg: number, r = R): Pt => [CX + r * Math.cos(rad(deg)), CY - r * Math.sin(rad(deg))];

  // 축(화살표) — 격자 없이 SAT 단위원 도식처럼 십자 축과 원만.
  const L = R + 42;
  sheet.raw(`<defs><marker id="uc-ax" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#111"/></marker></defs>`);
  sheet.raw(`<line x1="${CX - L}" y1="${CY}" x2="${CX + L}" y2="${CY}" stroke="#111" stroke-width="1.8" marker-end="url(#uc-ax)"/>`);
  sheet.raw(`<line x1="${CX}" y1="${CY + L}" x2="${CX}" y2="${CY - L}" stroke="#111" stroke-width="1.8" marker-end="url(#uc-ax)"/>`);
  sheet.registerSegment([CX - L, CY], [CX + L, CY]);
  sheet.registerSegment([CX, CY + L], [CX, CY - L]);
  sheet.raw(`<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="#111" stroke-width="2"/>`);
  const ring: Pt[] = Array.from({ length: 72 }, (_, i) => at((i * 360) / 72));
  for (let i = 0; i < ring.length; i++) sheet.registerSegment(ring[i], ring[(i + 1) % ring.length]);

  sheet.label(CX + L + 6, CY + 14, "x", "축 이름", { italic: true });
  sheet.label(CX + 12, CY - L - 4, "y", "축 이름", { italic: true });
  if (spec.unitTicks !== false) {
    for (const [x, y, t] of [[CX + R, CY, "1"], [CX - R, CY, "−1"], [CX, CY - R, "1"], [CX, CY + R, "−1"]] as [number, number, string][]) {
      sheet.raw(x === CX ? `<line x1="${CX - 4}" y1="${y}" x2="${CX + 4}" y2="${y}" stroke="#111" stroke-width="1.5"/>` : `<line x1="${x}" y1="${CY - 4}" x2="${x}" y2="${CY + 4}" stroke="#111" stroke-width="1.5"/>`);
      const cands: Pt[] = x === CX
        ? [[CX + 14, y + (t === "1" ? -12 : 12)], [CX - 14, y + (t === "1" ? -12 : 12)], [CX + 18, y + (t === "1" ? -16 : 16)]]
        : [[x + (t === "1" ? 12 : -14), CY + 15], [x + (t === "1" ? 14 : -16), CY - 15], [x + (t === "1" ? 20 : -22), CY + 15]];
      const lp = sheet.firstFree(cands, t) ?? cands[0];
      sheet.label(lp[0], lp[1], t, "단위 눈금");
    }
  }

  // 반직선·점
  spec.points.forEach((p) => {
    const P = at(p.angle);
    if (p.ray !== false) sheet.line(C, P);
  });
  // 호 — 반직선·원 위 눈금보다 안쪽.
  (spec.arcs ?? []).forEach((a, i) => {
    const a1 = a.from === undefined ? 0 : spec.points[a.from].angle;
    const a2 = spec.points[a.to].angle;
    const lo = rad(a1), hi = rad(a2 <= a1 ? a2 + 360 : a2);
    const half = (hi - lo) / 2;
    // 좁은 각은 호 반지름을 키워 라벨이 두 반직선 사이에 들어갈 자리를 만든다.
    const r = Math.min(92, Math.max(ARC_R + 8 + i * 8, 17 / Math.max(Math.sin(Math.min(half, Math.PI / 2)), 0.1)));
    sheet.arc(C, r, lo, hi);
    if (a.label) {
      const mid = (lo + hi) / 2, hd = halfDiag(a.label);
      const radii = [r + hd + 5, r + hd + 13, r + hd + 22, r + hd + 32, Math.max(r - hd - 6, 12)];
      const cands: Pt[] = [];
      for (const off of [0, 20, -20, 36, -36, 55, -55]) for (const rr of radii) cands.push([CX + rr * Math.cos(mid + rad(off)), CY - rr * Math.sin(mid + rad(off))]);
      if (half > Math.PI * 0.75) for (const off of [0, 20, -20, 36, -36]) for (const rr of radii.slice(0, 3)) cands.push([CX + rr * Math.cos(mid + Math.PI + rad(off)), CY - rr * Math.sin(mid + Math.PI + rad(off))]);
      const spot = sheet.firstFree(cands, a.label) ?? cands[0];
      sheet.label(spot[0], spot[1], a.label, `각 라벨(${a.label})`);
    }
  });
  spec.points.forEach((p) => {
    const P = at(p.angle);
    sheet.raw(`<circle cx="${f(P[0])}" cy="${f(P[1])}" r="4" fill="#111"/>`);
    const dir: Pt = [Math.cos(rad(p.angle)), -Math.sin(rad(p.angle))];
    const tryLabel = (txt: string, what: string, italic: boolean) => {
      const w = txt.length * 8.2 + 8;
      const cands: Pt[] = [];
      for (const dist of [16, 24, 34, 48, 66]) for (const off of [0, 22, -22, 44, -44, 66, -66, 90, -90, 125, -125, 160, -160, 180]) {
        const a = Math.atan2(dir[1], dir[0]) + (off * Math.PI) / 180;
        const ux = Math.cos(a), uy = Math.sin(a);
        cands.push([P[0] + ux * (dist + Math.abs(ux) * w / 2), P[1] + uy * (dist + Math.abs(uy) * 9)]);
      }
      const spot = sheet.firstFree(cands, txt) ?? cands[0];
      sheet.label(spot[0], spot[1], txt, what, { italic });
    };
    if (p.label) tryLabel(p.label, `점 좌표 라벨(${p.name ?? ""})`, false);
    if (p.name) tryLabel(p.name, `점 이름(${p.name})`, true);
  });

  const alt = `단위원(반지름 1)과 십자 좌표축. ${spec.points.map((p) => `${p.name ? `점 ${p.name}` : "점"}${p.label ? ` ${p.label}` : ""}`).join(", ")}${(spec.arcs ?? []).filter((a) => a.label).length ? `. 각: ${(spec.arcs ?? []).filter((a) => a.label).map((a) => a.label).join(", ")}` : ""}.`;
  return { svg: sheet.svg(alt), alt, issues: sheet.uniqueIssues() };
}

/** 지문 참조 검사 — "point P", "angle θ"(호 라벨), 호 라벨 기호가 지문에 나오는가. */
export function lintUnitCircleAgainstText(spec: UnitCircleSpec, passage: string): FigureIssue[] {
  const issues: FigureIssue[] = [];
  const text = passage.replace(/\$/g, "");
  const names = new Set(spec.points.map((p) => p.name).filter(Boolean) as string[]);
  for (const m of text.matchAll(/\b[Pp]oints?\s+([A-Z])\b/g)) if (!names.has(m[1])) issues.push({ code: "ref_missing", message: `지문의 점 ${m[1]} 가 그림에 없습니다.` });
  return dedupe(issues);
}
