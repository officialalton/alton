// 프로토타입: 의미 데이터 → SVG (표준 배치 규칙). 본 구현의 기준선용 표본.
import { writeFileSync } from "node:fs";
const FONT = "Georgia, 'Times New Roman', serif";
const esc = (t) => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const f = (n) => Math.round(n * 100) / 100;
const text = (x, y, t, o = {}) => `<text x="${f(x)}" y="${f(y)}" font-family="${FONT}" font-size="${o.size ?? 15}" font-style="${o.italic ? "italic" : "normal"}" text-anchor="${o.anchor ?? "middle"}" dominant-baseline="middle" fill="#111" stroke="#fff" stroke-width="4" paint-order="stroke" stroke-linejoin="round">${esc(t)}</text>`;
const line = (a, b, w = 2) => `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="#111" stroke-width="${w}" stroke-linecap="round"/>`;
const arc = (c, r, a1, a2) => { const p = (a) => [c[0] + r * Math.cos(a), c[1] - r * Math.sin(a)]; const [x1, y1] = p(a1), [x2, y2] = p(a2); const large = Math.abs(a2 - a1) > Math.PI ? 1 : 0; return `<path d="M ${f(x1)} ${f(y1)} A ${r} ${r} 0 ${large} 0 ${f(x2)} ${f(y2)}" fill="none" stroke="#111" stroke-width="1.6"/>`; };
const note = (W, H) => text(24, H - 14, "Note: Figure not drawn to scale.", { size: 12.5, italic: true, anchor: "start" });
const wrap = (W, H, body, alt) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(alt)}"><title>${esc(alt)}</title><rect width="${W}" height="${H}" fill="#fff"/>${body}</svg>`;

// ---------- 템플릿 1: 평행선·횡단선·각도 (좌표 없음 — 관계만)
export function parallelTransversal(t) {
  const W = 360, H = 250, PAD = 36;
  const ys = [78, 172];                       // 평행선 표준 간격
  const slant = 55 * Math.PI / 180;           // 횡단선 표준 기울기
  const xMid = 190; const dx = (ys[1] - ys[0]) / 2 / Math.tan(slant);
  const inter = [[xMid - dx, ys[0]], [xMid + dx, ys[1]]];  // 교점(위, 아래) — 횡단선은 좌상→우하
  const lineName = (i) => t.parallel[i];
  const out = [];
  ys.forEach((y, i) => { out.push(line([PAD, y], [W - PAD, y])); out.push(text(W - PAD + 12, y, lineName(i), { italic: true })); });
  const ext = 46; const dir = [Math.cos(slant), Math.sin(slant)];
  const k0 = [inter[0][0] - dir[0] * ext, inter[0][1] - dir[1] * ext], k1 = [inter[1][0] + dir[0] * ext, inter[1][1] + dir[1] * ext];
  out.push(line(k0, k1)); out.push(text(k1[0] + 10, k1[1] + 6, t.transversals[0].id, { italic: true }));
  const placed = [];
  const angleOf = (region) => {                // 횡단선 방향각(위쪽으로 향하는 방향): 180-55=125°, 아래쪽 -55°
    const up = Math.PI - slant, down = -slant;  // 사분면별 두 반직선 각
    return { NE: [0, up], NW: [up, Math.PI], SW: [Math.PI, Math.PI + (Math.PI/2 - slant) + Math.PI/2 - (Math.PI/2 - slant)], SE: [down, 0] }[region];
  };
  for (const a of t.angles) {
    const li = a.at.includes(t.parallel[0]) ? 0 : 1; const c = inter[li];
    let [a1, a2] = angleOf(a.region); if (a.region === "SW") { a1 = Math.PI; a2 = Math.PI + slant; }
    if (a.right) { const r = 11; const m = (a1 + a2) / 2; const p1 = [c[0] + r * Math.cos(a1), c[1] - r * Math.sin(a1)], p2 = [c[0] + r * Math.cos(a2), c[1] - r * Math.sin(a2)], pm = [c[0] + r * 1.414 * Math.cos(m), c[1] - r * 1.414 * Math.sin(m)]; out.push(`<polyline points="${f(p1[0])},${f(p1[1])} ${f(pm[0])},${f(pm[1])} ${f(p2[0])},${f(p2[1])}" fill="none" stroke="#111" stroke-width="1.6"/>`); }
    else out.push(arc(c, 15, a1, a2));
    const m = (a1 + a2) / 2; let r = 30; let pos = [c[0] + r * Math.cos(m), c[1] - r * Math.sin(m)];
    while (placed.some((p) => Math.hypot(p[0] - pos[0], p[1] - pos[1]) < 28)) { r += 12; pos = [c[0] + r * Math.cos(m), c[1] - r * Math.sin(m)]; }
    placed.push(pos); out.push(text(pos[0], pos[1], a.label));
  }
  for (const p of t.points ?? []) { const li = p.on.includes(t.parallel[0]) ? 0 : 1; const c = inter[li]; out.push(`<circle cx="${f(c[0])}" cy="${f(c[1])}" r="2.6" fill="#111"/>`); out.push(text(c[0] - 14, c[1] - 12, p.id, { italic: true })); }
  if (t.notToScale) out.push(note(W, H));
  const alt = `평행선 ${t.parallel.join("과 ")}을 횡단선 ${t.transversals[0].id}가 가로지른다. ` + t.angles.map((a) => `${a.at.join("과 ")}의 교점 ${({NE:"위 오른쪽",NW:"위 왼쪽",SE:"아래 오른쪽",SW:"아래 왼쪽"})[a.region]} 각은 ${a.right ? "직각" : a.label}`).join(", ") + ".";
  return wrap(W, H, out.join(""), alt);
}

// ---------- 템플릿 2: 삼각형(직각 표준형)
export function triangle(t) {
  const W = 360, H = 250; const [A, B, C] = t.vertices;
  const P = { [B]: [110, 190], [A]: [110, 60], [C]: [290, 190] }; // 직각은 B(좌하단), A 위, C 오른쪽
  const out = [line(P[A], P[B]), line(P[B], P[C]), line(P[C], P[A])];
  const lbl = { [A]: [-14, -8], [B]: [-14, 14], [C]: [14, 14] };
  for (const v of t.vertices) out.push(text(P[v][0] + lbl[v][0], P[v][1] + lbl[v][1], v, { italic: true }));
  if (t.rightAngleAt) { const c = P[t.rightAngleAt]; out.push(`<polyline points="${c[0]},${c[1] - 14} ${c[0] + 14},${c[1] - 14} ${c[0] + 14},${c[1]}" fill="none" stroke="#111" stroke-width="1.6"/>`); }
  for (const s of t.sides ?? []) { const [p, q] = s.between.map((v) => P[v]); const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2; const cx = (P[A][0] + P[B][0] + P[C][0]) / 3, cy = (P[A][1] + P[B][1] + P[C][1]) / 3; const d = [mx - cx, my - cy]; const n = Math.hypot(...d); out.push(text(mx + d[0] / n * 18, my + d[1] / n * 18, s.label)); }
  for (const a of t.angles ?? []) { const c = P[a.at]; const others = t.vertices.filter((v) => v !== a.at).map((v) => P[v]); const ang = others.map((o) => Math.atan2(-(o[1] - c[1]), o[0] - c[0])); let [a1, a2] = ang; if (a2 < a1) [a1, a2] = [a2, a1]; if (a2 - a1 > Math.PI) [a1, a2] = [a2, a1 + 2 * Math.PI]; if (a.arc) out.push(arc(c, 18, a1, a2)); const m = (a1 + a2) / 2; out.push(text(c[0] + 34 * Math.cos(m), c[1] - 34 * Math.sin(m), a.label)); }
  if (t.notToScale) out.push(note(W, H));
  return wrap(W, H, out.join(""), `삼각형 ${t.vertices.join("")}${t.rightAngleAt ? `, ${t.rightAngleAt}에서 직각` : ""}.`);
}

const samples = {
  "01-parallel-x-37": parallelTransversal({ template: "parallel_transversal", parallel: ["m", "n"], transversals: [{ id: "k" }], angles: [{ at: ["m", "k"], region: "NW", label: "x°" }, { at: ["n", "k"], region: "SE", label: "37°" }], notToScale: true }),
  "02-parallel-points": parallelTransversal({ template: "parallel_transversal", parallel: ["ℓ", "m"], transversals: [{ id: "t" }], points: [{ id: "A", on: ["ℓ", "t"] }, { id: "B", on: ["m", "t"] }], angles: [{ at: ["ℓ", "t"], region: "NE", label: "(2x + 10)°" }, { at: ["m", "t"], region: "SW", label: "110°" }, { at: ["m", "t"], region: "NE", label: "y°" }] }),
  "03-right-triangle": triangle({ template: "triangle", vertices: ["A", "B", "C"], rightAngleAt: "B", sides: [{ between: ["A", "B"], label: "6" }, { between: ["B", "C"], label: "8" }, { between: ["C", "A"], label: "x" }], angles: [{ at: "C", label: "θ", arc: true }], notToScale: true }),
};
for (const [name, svg] of Object.entries(samples)) writeFileSync(new URL(`./${name}.svg`, import.meta.url), svg);
console.log(Object.keys(samples).join(","));
