// 표준 렌더링 엔진 — 템플릿 5: 원 (중심·반지름·현·호·부채꼴·접선·중심각·원주각)
// AI 는 관계만 낸다. 원 위의 점은 **각도(도)** 로 자리를 지정한다 — 좌표가 아니라 배치 규칙이다. 반지름 길이는 항상 표준(100px).

import { ARC_R, dedupe, halfDiag, norm, Sheet, type FigureIssue, type Pt } from "./_layout";

export type CircleSpec = {
  type: "circle";
  /** 중심 이름(기본 O). 표시하지 않으려면 null. */
  center?: string | null;
  /** 원 위의 점 — id 와 각도(도, 0=오른쪽, 반시계). */
  points: { id: string; angle: number }[];
  /** 반지름(중심→점) — 라벨은 길이. */
  radii?: { to: string; label?: string }[];
  /** 현(두 점) — 라벨은 길이. 지름이면 두 점의 각이 180° 차이여야 한다. */
  chords?: { between: [string, string]; label?: string; diameter?: boolean }[];
  /** 호(from→to 반시계) — 굵게 표시, 라벨은 길이·각. */
  arcs?: { from: string; to: string; label?: string }[];
  /** 부채꼴(중심·두 점) — 음영. */
  sector?: { from: string; to: string; label?: string };
  /** 중심각 — 두 점 사이. */
  centralAngles?: { between: [string, string]; label?: string; right?: boolean }[];
  /** 원주각 — 꼭짓점(원 위) 과 두 점. */
  inscribedAngles?: { at: string; between: [string, string]; label?: string }[];
  /** 접선 — 원 위 점에서. external 은 접선 위 바깥 점 이름(선택), 반지름과 직각 표시. */
  tangents?: { at: string; label?: string; external?: string }[];
  notToScale?: boolean;
};

const isName = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0 && v.trim().length <= 3;
const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

export function validateCircle(input: unknown): { ok: true; spec: CircleSpec } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "그림 데이터가 객체가 아닙니다." };
  const s = input as Record<string, unknown>;
  if (s.type !== "circle") return { ok: false, error: "type 이 circle 이 아닙니다." };
  if (s.center !== undefined && s.center !== null && !isName(s.center)) return { ok: false, error: "center 는 짧은 이름 또는 null 입니다." };
  if (!Array.isArray(s.points) || s.points.length > 8) return { ok: false, error: "points 는 원 위의 점 목록(0~8개) 이어야 합니다." };
  const ids = new Set<string>();
  for (const p of s.points as Record<string, unknown>[]) {
    if (!p || !isName(p.id) || !isNum(p.angle)) return { ok: false, error: "points[] 는 id 와 angle(도) 이 필요합니다." };
    if (ids.has(p.id)) return { ok: false, error: `점 이름 '${p.id}' 가 중복됩니다.` };
    ids.add(p.id);
  }
  const centerName = s.center === undefined ? "O" : s.center;
  if (centerName && ids.has(centerName as string)) return { ok: false, error: "중심 이름이 원 위의 점과 같습니다." };
  const has = (v: unknown) => typeof v === "string" && ids.has(v);
  const angleOf = (id: string) => (s.points as { id: string; angle: number }[]).find((p) => p.id === id)!.angle;
  for (const r of (s.radii ?? []) as Record<string, unknown>[]) if (!r || !has(r.to)) return { ok: false, error: "radii[].to 는 원 위의 점이어야 합니다." };
  for (const c of (s.chords ?? []) as Record<string, unknown>[]) {
    if (!c || !Array.isArray(c.between) || c.between.length !== 2 || !c.between.every(has) || c.between[0] === c.between[1]) return { ok: false, error: "chords[].between 은 서로 다른 원 위의 점 2개여야 합니다." };
    if (c.diameter) {
      const d = Math.abs(norm(((angleOf(c.between[0] as string) - angleOf(c.between[1] as string)) * Math.PI) / 180) - Math.PI);
      if (d > 0.02) return { ok: false, error: `지름 ${(c.between as string[]).join("")} 의 두 점은 각이 180° 차이여야 합니다.` };
    }
  }
  for (const a of (s.arcs ?? []) as Record<string, unknown>[]) if (!a || !has(a.from) || !has(a.to) || a.from === a.to) return { ok: false, error: "arcs[] 는 서로 다른 from/to 점이 필요합니다." };
  if (s.sector !== undefined) { const sc = s.sector as Record<string, unknown>; if (!sc || !has(sc.from) || !has(sc.to) || sc.from === sc.to) return { ok: false, error: "sector 는 서로 다른 from/to 점이 필요합니다." }; }
  for (const a of (s.centralAngles ?? []) as Record<string, unknown>[]) if (!a || !Array.isArray(a.between) || a.between.length !== 2 || !a.between.every(has)) return { ok: false, error: "centralAngles[].between 은 원 위의 점 2개여야 합니다." };
  for (const a of (s.inscribedAngles ?? []) as Record<string, unknown>[]) if (!a || !has(a.at) || !Array.isArray(a.between) || a.between.length !== 2 || !a.between.every(has) || a.between.includes(a.at)) return { ok: false, error: "inscribedAngles[] 는 at(원 위) 과 다른 두 점이 필요합니다." };
  for (const t of (s.tangents ?? []) as Record<string, unknown>[]) {
    if (!t || !has(t.at)) return { ok: false, error: "tangents[].at 은 원 위의 점이어야 합니다." };
    if (t.external !== undefined && (!isName(t.external) || ids.has(t.external as string) || t.external === centerName)) return { ok: false, error: "tangents[].external 은 새 이름이어야 합니다." };
  }
  return { ok: true, spec: s as unknown as CircleSpec };
}

export function renderCircle(spec: CircleSpec): { svg: string; alt: string; issues: FigureIssue[] } {
  const hasTangent = (spec.tangents ?? []).length > 0;
  const W = hasTangent ? 440 : 360, H = hasTangent ? 340 : 300, R = 100;
  const c: Pt = [W / 2, H / 2];
  const sheet = new Sheet(W, H);
  const issues: FigureIssue[] = [];
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const at = (id: string): Pt => { const p = spec.points.find((q) => q.id === id)!; return [c[0] + R * Math.cos(rad(p.angle)), c[1] - R * Math.sin(rad(p.angle))]; };
  const angOf = (id: string) => norm(rad(spec.points.find((q) => q.id === id)!.angle));
  const centerName = spec.center === undefined ? "O" : spec.center;

  // 부채꼴 음영(원 아래에 깔리도록 먼저)
  if (spec.sector) {
    const a1 = angOf(spec.sector.from); let a2 = angOf(spec.sector.to); if (a2 <= a1) a2 += 2 * Math.PI;
    const p1 = at(spec.sector.from), p2 = at(spec.sector.to);
    const large = a2 - a1 > Math.PI ? 1 : 0;
    sheet.raw(`<path d="M ${c[0]} ${c[1]} L ${p1[0].toFixed(2)} ${p1[1].toFixed(2)} A ${R} ${R} 0 ${large} 0 ${p2[0].toFixed(2)} ${p2[1].toFixed(2)} Z" fill="#111" fill-opacity="0.12"/>`);
    sheet.line(c, p1); sheet.line(c, p2);
    if (spec.sector.label) { const mid = (a1 + a2) / 2; sheet.label(c[0] + R * 0.55 * Math.cos(mid), c[1] - R * 0.55 * Math.sin(mid), spec.sector.label, "부채꼴 라벨"); }
  }
  sheet.raw(`<circle cx="${c[0]}" cy="${c[1]}" r="${R}" fill="none" stroke="#111" stroke-width="2"/>`);
  // 원둘레를 충돌 검사용 다각 선분으로 등록
  for (let i = 0; i < 36; i++) sheet.registerSegment([c[0] + R * Math.cos((i * Math.PI) / 18), c[1] - R * Math.sin((i * Math.PI) / 18)], [c[0] + R * Math.cos(((i + 1) * Math.PI) / 18), c[1] - R * Math.sin(((i + 1) * Math.PI) / 18)]);

  // 호 강조
  for (const a of spec.arcs ?? []) {
    const a1 = angOf(a.from); let a2 = angOf(a.to); if (a2 <= a1) a2 += 2 * Math.PI;
    const p1 = at(a.from), p2 = at(a.to);
    const large = a2 - a1 > Math.PI ? 1 : 0;
    sheet.raw(`<path d="M ${p1[0].toFixed(2)} ${p1[1].toFixed(2)} A ${R} ${R} 0 ${large} 0 ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}" fill="none" stroke="#C8102E" stroke-width="4"/>`);
    if (a.label) { const mid = (a1 + a2) / 2; sheet.label(c[0] + (R + 14 + halfDiag(a.label) * 0.6) * Math.cos(mid), c[1] - (R + 14 + halfDiag(a.label) * 0.6) * Math.sin(mid), a.label, "호 라벨"); }
  }
  // 반지름·현·접선
  for (const r of spec.radii ?? []) {
    const p = at(r.to); sheet.line(c, p);
    if (r.label) { const mid: Pt = [(c[0] + p[0]) / 2, (c[1] + p[1]) / 2]; const a = angOf(r.to) + Math.PI / 2; const d = halfDiag(r.label) + 5; sheet.label(mid[0] + d * Math.cos(a), mid[1] - d * Math.sin(a), r.label, "반지름 라벨"); }
  }
  for (const ch of spec.chords ?? []) {
    const p = at(ch.between[0]), q = at(ch.between[1]); sheet.line(p, q);
    if (ch.label) {
      // 현 라벨: 중심 반대쪽(바깥) → 원둘레와 겹치면 중심 쪽(안) 순으로 놓는다. 둘 다 안 되면 문제로 기록.
      const mid: Pt = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; const d = Math.hypot(mid[0] - c[0], mid[1] - c[1]);
      const dir: Pt = d < 1 ? [0, -1] : [(mid[0] - c[0]) / d, (mid[1] - c[1]) / d]; const off = halfDiag(ch.label) + 5;
      const spot = sheet.firstFree([[mid[0] + dir[0] * off, mid[1] + dir[1] * off], [mid[0] - dir[0] * off, mid[1] - dir[1] * off]], ch.label);
      if (spot) sheet.label(spot[0], spot[1], ch.label, "현 라벨");
      else issues.push({ code: "label_collision", message: `현 라벨 '${ch.label}' 을 겹치지 않게 놓을 자리가 없습니다.` });
    }
  }
  for (const t of spec.tangents ?? []) {
    const p = at(t.at); const a = angOf(t.at);
    let dir: Pt = [-Math.sin(a), -Math.cos(a)]; // 접선 방향(화면 좌표), 반지름에 수직
    // 바깥 점은 화면 안쪽으로 더 여유 있는 쪽에 둔다(규칙). 길이는 화면을 벗어나지 않게 자른다.
    const room = (q: Pt) => Math.min(q[0] - 24, W - 24 - q[0], q[1] - 24, H - 24 - q[1]);
    if (room([p[0] + dir[0] * 70, p[1] + dir[1] * 70]) < room([p[0] - dir[0] * 70, p[1] - dir[1] * 70])) dir = [-dir[0], -dir[1]];
    const maxL = (d: Pt) => { let L = 90; while (L > 20 && room([p[0] + d[0] * L, p[1] + d[1] * L]) < 16) L -= 5; return L; };
    const L1 = maxL(dir), L2 = maxL([-dir[0], -dir[1]]);
    const e1: Pt = [p[0] + dir[0] * L1, p[1] + dir[1] * L1], e2: Pt = [p[0] - dir[0] * L2, p[1] - dir[1] * L2];
    sheet.line(e1, e2);
    if (!(spec.radii ?? []).some((r) => r.to === t.at)) sheet.line(c, p);
    // 반지름 ⟂ 접선 직각 표시
    const aR = norm(a + Math.PI), aT = norm(a + Math.PI / 2);
    let [x1, x2] = [aR, aT].sort((u, v) => u - v); if (x2 - x1 > Math.PI) [x1, x2] = [x2, x1 + 2 * Math.PI];
    sheet.rightAngle(p, x1, x2, 9);
    const out: Pt = [Math.cos(a), -Math.sin(a)]; // 원 바깥 방향(화면 좌표)
    if (t.external) {
      sheet.dot(e1);
      sheet.label(e1[0] + out[0] * (halfDiag(t.external) + 6), e1[1] + out[1] * (halfDiag(t.external) + 6), t.external, `점 이름(${t.external})`, { italic: true });
      if (t.label) sheet.label((p[0] + e1[0]) / 2 + out[0] * (halfDiag(t.label) + 5), (p[1] + e1[1]) / 2 + out[1] * (halfDiag(t.label) + 5), t.label, "접선 라벨");
    } else if (t.label) sheet.label(e1[0] + out[0] * (halfDiag(t.label) + 5), e1[1] + out[1] * (halfDiag(t.label) + 5), t.label, "접선 라벨", { italic: true });
  }
  // 중심각·원주각
  for (const a of spec.centralAngles ?? []) {
    const [u, v] = a.between.map(angOf); let [a1, a2] = [u, v].sort((x, y) => x - y); if (a2 - a1 > Math.PI) [a1, a2] = [a2, a1 + 2 * Math.PI];
    for (const id of a.between) if (!(spec.radii ?? []).some((r) => r.to === id) && !spec.sector) sheet.line(c, at(id));
    if (a.right) { sheet.rightAngle(c, a1, a2); if (Math.abs(a2 - a1 - Math.PI / 2) > 0.03) issues.push({ code: "impossible", message: `중심각 ${a.between.join("")} 을 직각으로 표시했지만 두 점의 각 차이가 90° 가 아닙니다.` }); }
    else sheet.arc(c, ARC_R + 3, a1, a2);
    if (a.label) { const mid = (a1 + a2) / 2; const r = Math.max(ARC_R + 3 + halfDiag(a.label) + 4, (halfDiag(a.label) + 4) / Math.max(Math.sin((a2 - a1) / 2), 0.25)); sheet.label(c[0] + r * Math.cos(mid), c[1] - r * Math.sin(mid), a.label, `중심각 라벨(${a.between.join("")})`); }
  }
  for (const a of spec.inscribedAngles ?? []) {
    const v = at(a.at);
    const dirs = a.between.map((id) => { const p = at(id); return norm(Math.atan2(-(p[1] - v[1]), p[0] - v[0])); });
    for (const id of a.between) sheet.line(v, at(id));
    let [a1, a2] = [...dirs].sort((x, y) => x - y); if (a2 - a1 > Math.PI) [a1, a2] = [a2, a1 + 2 * Math.PI];
    sheet.arc(v, ARC_R, a1, a2);
    if (a.label) { const mid = (a1 + a2) / 2; const r = Math.max(30, (halfDiag(a.label) + 4) / Math.max(Math.sin((a2 - a1) / 2), 0.25)); sheet.label(v[0] + r * Math.cos(mid), v[1] - r * Math.sin(mid), a.label, `원주각 라벨(${a.at})`); }
  }
  // 점·이름
  for (const p of spec.points) {
    const q = at(p.id); sheet.dot(q); const a = angOf(p.id);
    sheet.label(q[0] + (halfDiag(p.id) + 8) * Math.cos(a), q[1] - (halfDiag(p.id) + 8) * Math.sin(a), p.id, `점 이름(${p.id})`, { italic: true });
  }
  if (centerName) {
    sheet.dot(c);
    // 반지름·현이 지나지 않는 쪽 대각선 자리(규칙: 좌하 → 우하 → 좌상 → 우상 순)에 놓는다.
    const d = halfDiag(centerName) + 6;
    const spot = sheet.firstFree([[c[0] - d, c[1] + d], [c[0] + d, c[1] + d], [c[0] - d, c[1] - d], [c[0] + d, c[1] - d]], centerName);
    if (spot) sheet.label(spot[0], spot[1], centerName, "중심 이름", { italic: true });
    else issues.push({ code: "label_collision", message: `중심 이름 '${centerName}' 을 겹치지 않게 놓을 자리가 없습니다 — 반지름·현 수를 줄이세요.` });
  }
  if (spec.notToScale) sheet.note("Note: Figure not drawn to scale.");
  const alt = `원${centerName ? `(중심 ${centerName})` : ""}. 원 위의 점: ${spec.points.map((p) => p.id).join(", ") || "없음"}` +
    ((spec.radii ?? []).length ? `. 반지름: ${spec.radii!.map((r) => `${centerName ?? "중심"}${r.to}${r.label ? ` = ${r.label}` : ""}`).join(", ")}` : "") +
    ((spec.chords ?? []).length ? `. ${spec.chords!.map((ch) => `${ch.diameter ? "지름" : "현"} ${ch.between.join("")}${ch.label ? ` = ${ch.label}` : ""}`).join(", ")}` : "") +
    ((spec.arcs ?? []).length ? `. 호: ${spec.arcs!.map((a) => `${a.from}${a.to}${a.label ? ` (${a.label})` : ""}`).join(", ")}` : "") +
    (spec.sector ? `. 부채꼴 ${centerName ?? ""}${spec.sector.from}${spec.sector.to}${spec.sector.label ? ` (${spec.sector.label})` : ""}` : "") +
    ((spec.centralAngles ?? []).length ? `. 중심각: ${spec.centralAngles!.map((a) => `${a.between[0]}${centerName ?? ""}${a.between[1]}${a.right ? " 직각" : a.label ? ` = ${a.label}` : ""}`).join(", ")}` : "") +
    ((spec.inscribedAngles ?? []).length ? `. 원주각: ${spec.inscribedAngles!.map((a) => `${a.between[0]}${a.at}${a.between[1]}${a.label ? ` = ${a.label}` : ""}`).join(", ")}` : "") +
    ((spec.tangents ?? []).length ? `. 접선: ${spec.tangents!.map((t) => `${t.at}에서${t.external ? ` (${t.external} 지남)` : ""}`).join(", ")}` : "") + ".";
  return { svg: sheet.svg(alt), alt, issues: dedupe([...issues, ...sheet.uniqueIssues()]) };
}

/** 지문 참조 — center O, point A, chord/diameter AB, arc AB, radius, angle AOB/∠ABC, tangent at A, 길이 AB = 6, 각도 라벨. */
export function lintCircleAgainstText(spec: CircleSpec, passage: string): FigureIssue[] {
  const issues: FigureIssue[] = [];
  const text = passage.replace(/\$/g, "").replace(/\\overline\{([A-Z]{2})\}/g, "$1").replace(/\\angle/g, "∠").replace(/−/g, "-");
  const centerName = spec.center === undefined ? "O" : spec.center;
  const names = new Set<string>([...spec.points.map((p) => p.id), ...(centerName ? [centerName] : []), ...(spec.tangents ?? []).flatMap((t) => (t.external ? [t.external] : []))]);
  const labels = new Set<string>([...(spec.radii ?? []), ...(spec.chords ?? []), ...(spec.arcs ?? []), ...(spec.centralAngles ?? []), ...(spec.inscribedAngles ?? [])].map((x) => (x.label ?? "").replace(/\s+/g, "").replace(/−/g, "-")).filter(Boolean));
  const m0 = text.match(/\bcenter\s+([A-Z])\b/);
  if (m0 && m0[1] !== centerName) issues.push({ code: "ref_missing", message: `지문의 중심 '${m0[1]}' 이 도형의 중심 이름(${centerName ?? "없음"})과 다릅니다.` });
  for (const m of text.matchAll(/\bpoints?\s+([A-Z])\b(?:\s*(?:and|,)\s*([A-Z])\b)?/g)) for (const id of m.slice(1).filter(Boolean)) if (!names.has(id)) issues.push({ code: "ref_missing", message: `지문의 점 '${id}' 가 원에 없습니다.` });
  for (const m of text.matchAll(/\b([Cc]hord|[Dd]iameter|[Aa]rc|[Ss]egment)\s+([A-Z])([A-Z])\b/g)) {
    const [a, b] = [m[2], m[3]];
    if (!names.has(a) || !names.has(b)) { issues.push({ code: "ref_missing", message: `지문의 ${m[1]} ${a}${b} 의 점이 원에 없습니다.` }); continue; }
    const kind = m[1].toLowerCase();
    if (kind === "chord" || kind === "diameter") {
      const ch = (spec.chords ?? []).find((x) => (x.between[0] === a && x.between[1] === b) || (x.between[0] === b && x.between[1] === a));
      if (!ch) issues.push({ code: "ref_missing", message: `지문의 ${kind} ${a}${b} 가 도형에 없습니다.` });
      else if (kind === "diameter" && !ch.diameter) issues.push({ code: "ref_mismatch", message: `지문은 ${a}${b} 를 지름이라 하는데 도형에서는 지름(diameter:true)이 아닙니다.` });
    }
    // 호는 표시 없이도 물을 수 있다(구하라는 값) — 두 점만 있으면 된다.
  }
  // "AB is a diameter" / "segment AB is a chord" 어순도 본다.
  for (const m of text.matchAll(/\b([A-Z])([A-Z])\s+is\s+(?:a\s+)?(diameter|chord)\b/g)) {
    const [a, b, kind] = [m[1], m[2], m[3]];
    const ch = (spec.chords ?? []).find((x) => (x.between[0] === a && x.between[1] === b) || (x.between[0] === b && x.between[1] === a));
    if (!ch) issues.push({ code: "ref_missing", message: `지문의 ${kind} ${a}${b} 가 도형에 없습니다.` });
    else if (kind === "diameter" && !ch.diameter) issues.push({ code: "ref_mismatch", message: `지문은 ${a}${b} 를 지름이라 하는데 도형에서는 지름(diameter:true)이 아닙니다.` });
  }
  for (const m of text.matchAll(/(?:∠|\bangle\s+)([A-Z]{3})\b/g)) for (const ch of m[1]) if (!names.has(ch)) issues.push({ code: "ref_missing", message: `지문의 각 ${m[1]} 의 점 '${ch}' 가 원에 없습니다.` });
  for (const m of text.matchAll(/\btangent(?:\s+to the circle)?\s+at\s+(?:point\s+)?([A-Z])\b/gi)) if (!(spec.tangents ?? []).some((t) => t.at === m[1])) issues.push({ code: "ref_missing", message: `지문은 ${m[1]} 에서의 접선을 말하지만 도형에 접선이 없습니다.` });
  for (const m of text.matchAll(/\b([A-Z])([A-Z])\s*=\s*(\d+(?:\.\d+)?|√\d+|\d+π|\d+\/\d+)/g)) {
    const lbl = (spec.chords ?? []).find((x) => (x.between[0] === m[1] && x.between[1] === m[2]) || (x.between[0] === m[2] && x.between[1] === m[1]))?.label
      ?? (spec.radii ?? []).find((r) => (m[1] === centerName && r.to === m[2]) || (m[2] === centerName && r.to === m[1]))?.label
      ?? (spec.tangents ?? []).find((t) => t.external && ((t.at === m[1] && t.external === m[2]) || (t.at === m[2] && t.external === m[1])))?.label;
    if (lbl !== undefined && lbl.replace(/\s+/g, "") !== m[3]) issues.push({ code: "ref_mismatch", message: `지문은 ${m[1]}${m[2]} = ${m[3]} 인데 그림 라벨은 '${lbl}' 입니다.` });
    if (lbl === undefined && names.has(m[1]) && names.has(m[2])) issues.push({ code: "ref_missing", message: `지문은 ${m[1]}${m[2]} = ${m[3]} 인데 그림에 그 길이 라벨이 없습니다.` });
  }
  for (const m of text.matchAll(/(\([^()]{1,24}\)|\b\d+(?:\.\d+)?|\b[a-zθ])\s*(?:°|degrees|\^\\?circ)/g)) {
    const lbl = `${m[1].trim()}°`.replace(/\s+/g, "");
    if (!labels.has(lbl)) issues.push({ code: "ref_missing", message: `지문의 각 '${m[1].trim()}°' 가 도형의 각 라벨에 없습니다.` });
  }
  if (/\b(northeast|northwest|southeast|southwest|region)\b/i.test(text)) issues.push({ code: "wording", message: "지문에 배치 용어가 있습니다 — 점·현·호 이름으로 부릅니다." });
  return dedupe(issues);
}
