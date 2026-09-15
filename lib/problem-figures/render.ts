import type { CoordinatePlaneSpec, FigureSpec, GeometrySpec, PlaneItem, Point } from "./spec";
import { renderParallelTransversal } from "./templates/parallel-transversal";
import { renderTriangle } from "./templates/triangle";
import { renderPlane as renderPlaneTemplate } from "./templates/coordinate-plane";
import { renderData } from "./templates/data";
import { renderCircle } from "./templates/circle";
import { renderPolygon } from "./templates/polygon";
import { renderSolid } from "./templates/solid";
import { renderComposite } from "./templates/composite";
import { renderFigureChoice, renderFigureSet } from "./templates/figure-choice";
import { figureAlt } from "./alt";

// 순수 함수 — 서버·클라이언트 어디서든 같은 SVG 문자열을 만든다. 외부 입력은 숫자와 짧은 라벨뿐이고
// 라벨은 이스케이프하므로 그대로 innerHTML 로 넣어도 안전하다.

const W = 420;
const H = 300;
const PAD = 34;
// SAT 지면과 같은 인상: 세리프 글꼴, 굵은 곡선, 굵은 축, 얇은 격자.
const FONT = "Georgia, 'Times New Roman', serif";

/**
 * 그림 라벨은 SVG 글자라 LaTeX 를 그릴 수 없다 — AI 가 `$x^\\circ$` 처럼 써 보내면 그대로 보였다(2026-09-14 UAT).
 * 자주 쓰는 표기만 유니코드로 바꾼다. 모르는 명령은 백슬래시만 떼고 남긴다(내용이 사라지는 것이 더 나쁘다).
 */
export function plainLabel(text: string): string {
  let t = text.replace(/\$/g, "");
  t = t.replace(/\^\{?\\circ\}?/g, "°").replace(/\\circ/g, "°").replace(/\\degree/g, "°");
  t = t.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "$1/$2");
  t = t.replace(/\\sqrt\{([^{}]*)\}/g, "√$1").replace(/\\sqrt(\w)/g, "√$1");
  t = t.replace(/\\overline\{([^{}]*)\}/g, "$1").replace(/\\overrightarrow\{([^{}]*)\}/g, "$1→");
  const words: Record<string, string> = {
    angle: "∠", triangle: "△", pi: "π", theta: "θ", alpha: "α", beta: "β", gamma: "γ", cdot: "·", times: "×",
    le: "≤", leq: "≤", ge: "≥", geq: "≥", ne: "≠", neq: "≠", approx: "≈", parallel: "∥", perp: "⊥", cong: "≅", sim: "∼",
    infty: "∞", pm: "±", div: "÷",
  };
  t = t.replace(/\\([a-zA-Z]+)\s*/g, (_, w: string) => (words[w] ? words[w] : w + " "));
  t = t.replace(/\^\{?2\}?/g, "²").replace(/\^\{?3\}?/g, "³").replace(/\^\{([^{}]*)\}/g, "^$1");
  t = t.replace(/[{}]/g, "").replace(/\s+/g, " ").trim();
  return t;
}

function esc(text: string): string {
  return plainLabel(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}
const fmt = (n: number) => (Math.round(n * 100) / 100).toString();

export function renderFigureSvg(spec: FigureSpec): string {
  if (spec.type === "image") return ""; // 그림 파일은 컴포넌트가 서명 URL 로 그린다.
  if (spec.type === "parallel_transversal") return renderParallelTransversal(spec).svg;
  if (spec.type === "triangle") return renderTriangle(spec).svg;
  if (spec.type === "plane") return renderPlaneTemplate(spec).svg;
  if (spec.type === "data") return renderData(spec).markup;
  if (spec.type === "circle") return renderCircle(spec).svg;
  if (spec.type === "polygon") return renderPolygon(spec).svg;
  if (spec.type === "solid") return renderSolid(spec).svg;
  if (spec.type === "composite") return renderComposite(spec).svg;
  if (spec.type === "figure_choice") return renderFigureChoice(spec, (c) => renderFigureSvg(c as FigureSpec)).markup;
  if (spec.type === "figure_set") return renderFigureSet(spec, (c) => renderFigureSvg(c as FigureSpec), (c) => figureAlt(c as FigureSpec)).markup; // 표·숫자 목록은 HTML, 그래프는 SVG — 모두 우리 마크업
  return spec.type === "coordinate_plane" ? renderPlane(spec) : renderGeometry(spec);
}

function niceStep(range: number): number {
  const raw = range / 8;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const cands = [1, 2, 5, 10].map((m) => m * pow);
  return cands.find((c) => c >= raw) ?? cands[cands.length - 1];
}

function renderPlane(spec: CoordinatePlaneSpec): string {
  const [x0, x1] = spec.xRange;
  const [y0, y1] = spec.yRange;
  const xStep = spec.xStep ?? niceStep(x1 - x0);
  const yStep = spec.yStep ?? niceStep(y1 - y0);
  // 축 설명이 있으면 그 자리를 비운다.
  const padL = PAD + (spec.yTitle ? 22 : 0);
  const padB = PAD + (spec.xTitle ? 18 : 0);
  const sx = (x: number) => padL + ((x - x0) / (x1 - x0)) * (W - padL - PAD);
  const sy = (y: number) => H - padB - ((y - y0) / (y1 - y0)) * (H - padB - PAD);
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="coordinate plane" font-family="${FONT}" font-size="12">`);
  // grid
  // 격자(모든 눈금), 축, 눈금 숫자(SAT 는 3·6·9 처럼 큰 눈금에만 숫자를 쓴다 — 눈금 수가 많으면 하나 건너 표시)
  const xs: number[] = [];
  for (let x = Math.ceil(x0 / xStep) * xStep; x <= x1 + 1e-9; x += xStep) xs.push(Math.round(x * 1e6) / 1e6);
  const ys: number[] = [];
  for (let y = Math.ceil(y0 / yStep) * yStep; y <= y1 + 1e-9; y += yStep) ys.push(Math.round(y * 1e6) / 1e6);
  for (const x of xs) out.push(`<line x1="${fmt(sx(x))}" y1="${PAD}" x2="${fmt(sx(x))}" y2="${fmt(H - padB)}" stroke="#9ca3af" stroke-width="0.8"/>`);
  for (const y of ys) out.push(`<line x1="${fmt(padL)}" y1="${fmt(sy(y))}" x2="${W - PAD}" y2="${fmt(sy(y))}" stroke="#9ca3af" stroke-width="0.8"/>`);
  const axX = x0 <= 0 && x1 >= 0 ? 0 : x0;
  const axY = y0 <= 0 && y1 >= 0 ? 0 : y0;
  out.push(`<defs><marker id="ax" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#111"/></marker></defs>`);
  out.push(`<line x1="${fmt(padL)}" y1="${fmt(sy(axY))}" x2="${W - PAD}" y2="${fmt(sy(axY))}" stroke="#111" stroke-width="1.8" marker-end="url(#ax)"/>`);
  out.push(`<line x1="${fmt(sx(axX))}" y1="${fmt(H - padB)}" x2="${fmt(sx(axX))}" y2="${PAD}" stroke="#111" stroke-width="1.8" marker-end="url(#ax)"/>`);
  const labelEvery = (n: number) => (n > 12 ? 3 : n > 8 ? 2 : 1);
  const ex = labelEvery(xs.length), ey = labelEvery(ys.length);
  xs.forEach((x, i) => {
    if (Math.abs(x - axX) < 1e-9) return;
    if (i % ex !== 0) return;
    out.push(`<text x="${fmt(sx(x))}" y="${fmt(sy(axY) + 15)}" text-anchor="middle" fill="#111">${fmt(x)}</text>`);
  });
  ys.forEach((y, i) => {
    if (Math.abs(y - axY) < 1e-9) return;
    if (i % ey !== 0) return;
    out.push(`<text x="${fmt(sx(axX) - 6)}" y="${fmt(sy(y) + 4)}" text-anchor="end" fill="#111">${fmt(y)}</text>`);
  });
  // 원점 O(축이 0을 지날 때)
  if (axX === 0 && axY === 0) out.push(`<text x="${fmt(sx(0) - 5)}" y="${fmt(sy(0) + 14)}" text-anchor="end" fill="#111" font-style="italic">O</text>`);
  out.push(`<text x="${W - PAD + 2}" y="${fmt(sy(axY) + 4)}" fill="#111" font-style="italic">${esc(spec.xLabel ?? "x")}</text>`);
  out.push(`<text x="${fmt(sx(axX))}" y="${PAD - 6}" text-anchor="middle" fill="#111" font-style="italic">${esc(spec.yLabel ?? "y")}</text>`);
  if (spec.xTitle) out.push(`<text x="${fmt((padL + W - PAD) / 2)}" y="${H - 6}" text-anchor="middle" fill="#111">${esc(spec.xTitle)}</text>`);
  if (spec.yTitle) out.push(`<text transform="translate(12 ${fmt((PAD + H - padB) / 2)}) rotate(-90)" text-anchor="middle" fill="#111">${esc(spec.yTitle)}</text>`);

  const clip = (x: number, y: number) => x >= x0 - 1e-9 && x <= x1 + 1e-9 && y >= y0 - 1e-9 && y <= y1 + 1e-9;
  const colors = ["#111", "#C8102E", "#1B6FB0", "#0f7b4a"];
  spec.items.forEach((item, idx) => {
    const color = colors[idx % colors.length];
    out.push(renderPlaneItem(item, sx, sy, [x0, x1], [y0, y1], clip, color));
  });
  out.push("</svg>");
  return out.join("");
}

function evalFn(item: Extract<PlaneItem, { kind: "function" }>, x: number): number {
  const p = item.params;
  switch (item.fn) {
    case "linear": return (p[0] ?? 1) * x + (p[1] ?? 0);
    case "quadratic": return (p[0] ?? 1) * x * x + (p[1] ?? 0) * x + (p[2] ?? 0);
    case "cubic": return (p[0] ?? 1) * x ** 3 + (p[1] ?? 0) * x * x + (p[2] ?? 0) * x + (p[3] ?? 0);
    case "exponential": return (p[0] ?? 1) * Math.pow(p[1] ?? 2, x) + (p[2] ?? 0);
    case "abs": return (p[0] ?? 1) * Math.abs(x - (p[1] ?? 0)) + (p[2] ?? 0);
    case "sqrt": return (p[0] ?? 1) * Math.sqrt(Math.max(0, x - (p[1] ?? 0))) + (p[2] ?? 0);
  }
}

function renderPlaneItem(
  item: PlaneItem,
  sx: (x: number) => number,
  sy: (y: number) => number,
  xr: [number, number],
  yr: [number, number],
  clip: (x: number, y: number) => boolean,
  color: string
): string {
  const label = (x: number, y: number, text?: string) =>
    text ? `<text x="${fmt(sx(x) + 6)}" y="${fmt(sy(y) - 6)}" fill="${color}" font-style="italic">${esc(text)}</text>` : "";
  if (item.kind === "line") {
    let m: number, b: number, vertical: number | null = null;
    if ("through" in item) {
      const [[ax, ay], [bx, by]] = item.through;
      if (Math.abs(bx - ax) < 1e-12) { vertical = ax; m = 0; b = 0; }
      else { m = (by - ay) / (bx - ax); b = ay - m * ax; }
    } else { m = item.slope; b = item.intercept; }
    const dash = item.dashed ? ' stroke-dasharray="6 4"' : "";
    if (vertical !== null) {
      return `<line x1="${fmt(sx(vertical))}" y1="${fmt(sy(yr[0]))}" x2="${fmt(sx(vertical))}" y2="${fmt(sy(yr[1]))}" stroke="${color}" stroke-width="2"${dash}/>${label(vertical, yr[1], item.label)}`;
    }
    // clip to box: sample two ends within x range then clamp by y range
    const pts: Point[] = [];
    const cands: Point[] = [[xr[0], m * xr[0] + b], [xr[1], m * xr[1] + b]];
    if (Math.abs(m) > 1e-12) cands.push([(yr[0] - b) / m, yr[0]], [(yr[1] - b) / m, yr[1]]);
    for (const c of cands) if (clip(c[0], c[1])) pts.push(c);
    pts.sort((p, q) => p[0] - q[0]);
    if (pts.length < 2) return "";
    const a = pts[0], z = pts[pts.length - 1];
    return `<line x1="${fmt(sx(a[0]))}" y1="${fmt(sy(a[1]))}" x2="${fmt(sx(z[0]))}" y2="${fmt(sy(z[1]))}" stroke="${color}" stroke-width="2"${dash}/>${label(z[0], z[1], item.label)}`;
  }
  if (item.kind === "segment") {
    return `<line x1="${fmt(sx(item.from[0]))}" y1="${fmt(sy(item.from[1]))}" x2="${fmt(sx(item.to[0]))}" y2="${fmt(sy(item.to[1]))}" stroke="${color}" stroke-width="2"/>${label(item.to[0], item.to[1], item.label)}`;
  }
  if (item.kind === "points") {
    return item.points
      .map(([x, y], i) =>
        `<circle cx="${fmt(sx(x))}" cy="${fmt(sy(y))}" r="4" fill="${item.open ? "#fff" : color}" stroke="${color}" stroke-width="2"/>${label(x, y, item.labels?.[i])}`
      )
      .join("");
  }
  if (item.kind === "polyline") {
    const d = item.points.map(([x, y], i) => `${i ? "L" : "M"}${fmt(sx(x))},${fmt(sy(y))}`).join(" ");
    const last = item.points[item.points.length - 1];
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2"/>${label(last[0], last[1], item.label)}`;
  }
  // function: sample
  const [d0, d1] = item.domain ?? xr;
  const n = 160;
  let d = "";
  let pen = false;
  let lastVisible: Point | null = null;
  for (let i = 0; i <= n; i++) {
    const x = d0 + ((d1 - d0) * i) / n;
    const y = evalFn(item, x);
    if (!Number.isFinite(y) || !clip(x, y)) { pen = false; continue; }
    d += `${pen ? "L" : "M"}${fmt(sx(x))},${fmt(sy(y))} `;
    pen = true;
    lastVisible = [x, y];
  }
  return `<path d="${d.trim()}" fill="none" stroke="${color}" stroke-width="2.6"/>${lastVisible ? label(lastVisible[0], lastVisible[1], item.label) : ""}`;
}

function renderGeometry(spec: GeometrySpec): string {
  // 뷰: 명시가 없으면 도형 점들의 경계 + 여백.
  const pts: Point[] = [];
  for (const sh of spec.shapes) {
    if (sh.kind === "polygon") pts.push(...sh.points);
    else if (sh.kind === "circle") pts.push([sh.center[0] - sh.radius, sh.center[1] - sh.radius], [sh.center[0] + sh.radius, sh.center[1] + sh.radius]);
    else if (sh.kind === "segment") pts.push(sh.from, sh.to);
    else if (sh.kind === "parallel_lines") pts.push(...sh.transversal, [sh.transversal[0][0] - 3, sh.y1], [sh.transversal[1][0] + 3, sh.y2]);
    else pts.push(sh.at);
  }
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const view = spec.view ?? {
    xRange: [Math.min(...xs) - 1, Math.max(...xs) + 1] as [number, number],
    yRange: [Math.min(...ys) - 1, Math.max(...ys) + 1] as [number, number],
  };
  const [x0, x1] = view.xRange, [y0, y1] = view.yRange;
  // 등비율 유지
  const scale = Math.min((W - 2 * PAD) / (x1 - x0), (H - 2 * PAD) / (y1 - y0));
  const ox = (W - scale * (x1 - x0)) / 2, oy = (H - scale * (y1 - y0)) / 2;
  const sx = (x: number) => ox + (x - x0) * scale;
  const sy = (y: number) => H - oy - (y - y0) * scale;
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="figure" font-family="${FONT}" font-size="13">`);
  // 라벨은 선 위에 놓여도 읽히게 흰 테두리(halo)를 준다.
  const text = (x: number, y: number, t: string, anchor = "middle", italic = true) =>
    `<text x="${fmt(x)}" y="${fmt(y)}" text-anchor="${anchor}" fill="#111" stroke="#fff" stroke-width="3" paint-order="stroke"${italic ? ' font-style="italic"' : ""}>${esc(t)}</text>`;
  for (const sh of spec.shapes) {
    if (sh.kind === "polygon") {
      const d = sh.points.map(([x, y], i) => `${i ? "L" : "M"}${fmt(sx(x))},${fmt(sy(y))}`).join(" ") + " Z";
      out.push(`<path d="${d}" fill="none" stroke="#111" stroke-width="2"/>`);
      const cx = sh.points.reduce((a, p) => a + p[0], 0) / sh.points.length;
      const cy = sh.points.reduce((a, p) => a + p[1], 0) / sh.points.length;
      sh.points.forEach(([x, y], i) => {
        const vl = sh.vertexLabels?.[i];
        if (vl) {
          const dx = Math.sign(x - cx) || 0, dy = Math.sign(y - cy) || 0;
          out.push(text(sx(x) + dx * 12, sy(y) - dy * 12 + 4, vl));
        }
        const al = sh.angleLabels?.find((a) => a.at === i);
        if (al) {
          // 꼭짓점 안쪽에 호를 그리고 라벨은 이등분선 위에 둔다 — 어느 각인지 분명하게.
          const prev = sh.points[(i + sh.points.length - 1) % sh.points.length], next = sh.points[(i + 1) % sh.points.length];
          const u = unit([prev[0] - x, prev[1] - y]), v = unit([next[0] - x, next[1] - y]);
          const r = 0.9;
          const a1 = Math.atan2(u[1], u[0]), a2 = Math.atan2(v[1], v[0]);
          out.push(arc(sx, sy, [x, y], r, a1, a2));
          const bis = unit([u[0] + v[0], u[1] + v[1]]);
          out.push(text(sx(x + bis[0] * r * 1.9), sy(y + bis[1] * r * 1.9) + 4, al.text, "middle", false));
        }
        if (sh.rightAngleAt?.includes(i)) {
          const prev = sh.points[(i + sh.points.length - 1) % sh.points.length], next = sh.points[(i + 1) % sh.points.length];
          const u = unit([prev[0] - x, prev[1] - y]), v = unit([next[0] - x, next[1] - y]);
          const s = 0.6;
          const p1: Point = [x + u[0] * s, y + u[1] * s], p2: Point = [x + (u[0] + v[0]) * s, y + (u[1] + v[1]) * s], p3: Point = [x + v[0] * s, y + v[1] * s];
          out.push(`<path d="M${fmt(sx(p1[0]))},${fmt(sy(p1[1]))} L${fmt(sx(p2[0]))},${fmt(sy(p2[1]))} L${fmt(sx(p3[0]))},${fmt(sy(p3[1]))}" fill="none" stroke="#111" stroke-width="1.5"/>`);
        }
        const sl = sh.sideLabels?.[i];
        if (sl) {
          const nx = sh.points[(i + 1) % sh.points.length];
          const mx = (x + nx[0]) / 2, my = (y + nx[1]) / 2;
          const dx = Math.sign(mx - cx), dy = Math.sign(my - cy);
          out.push(text(sx(mx) + dx * 14, sy(my) - dy * 12 + 4, sl));
        }
      });
    } else if (sh.kind === "circle") {
      out.push(`<circle cx="${fmt(sx(sh.center[0]))}" cy="${fmt(sy(sh.center[1]))}" r="${fmt(sh.radius * scale)}" fill="none" stroke="#111" stroke-width="2"/>`);
      out.push(`<circle cx="${fmt(sx(sh.center[0]))}" cy="${fmt(sy(sh.center[1]))}" r="2.5" fill="#111"/>`);
      if (sh.centerLabel) out.push(text(sx(sh.center[0]) - 10, sy(sh.center[1]) + 14, sh.centerLabel));
      if (sh.radiusLabel) {
        out.push(`<line x1="${fmt(sx(sh.center[0]))}" y1="${fmt(sy(sh.center[1]))}" x2="${fmt(sx(sh.center[0] + sh.radius))}" y2="${fmt(sy(sh.center[1]))}" stroke="#111" stroke-width="1.5"/>`);
        out.push(text(sx(sh.center[0] + sh.radius / 2), sy(sh.center[1]) - 8, sh.radiusLabel));
      }
    } else if (sh.kind === "segment") {
      out.push(`<line x1="${fmt(sx(sh.from[0]))}" y1="${fmt(sy(sh.from[1]))}" x2="${fmt(sx(sh.to[0]))}" y2="${fmt(sy(sh.to[1]))}" stroke="#111" stroke-width="2"${sh.dashed ? ' stroke-dasharray="6 4"' : ""}/>`);
      if (sh.label) out.push(text(sx((sh.from[0] + sh.to[0]) / 2), sy((sh.from[1] + sh.to[1]) / 2) - 8, sh.label));
    } else if (sh.kind === "parallel_lines") {
      const xa = x0, xb = x1;
      out.push(`<line x1="${fmt(sx(xa))}" y1="${fmt(sy(sh.y1))}" x2="${fmt(sx(xb))}" y2="${fmt(sy(sh.y1))}" stroke="#111" stroke-width="2"/>`);
      out.push(`<line x1="${fmt(sx(xa))}" y1="${fmt(sy(sh.y2))}" x2="${fmt(sx(xb))}" y2="${fmt(sy(sh.y2))}" stroke="#111" stroke-width="2"/>`);
      const [t0, t1] = sh.transversal;
      out.push(`<line x1="${fmt(sx(t0[0]))}" y1="${fmt(sy(t0[1]))}" x2="${fmt(sx(t1[0]))}" y2="${fmt(sy(t1[1]))}" stroke="#111" stroke-width="2"/>`);
      if (sh.labels) {
        out.push(text(sx(xb) - 8, sy(sh.y1) - 6, sh.labels[0], "end"));
        out.push(text(sx(xb) - 8, sy(sh.y2) - 6, sh.labels[1], "end"));
        out.push(text(sx(t1[0]) + 8, sy(t1[1]) + 4, sh.labels[2], "start"));
      }
      for (const a of sh.angleLabels ?? []) {
        // (구형) 좌표로 놓은 라벨 — 평행선과 겹치면 조금 위로 올린다.
        const onLine = Math.abs(a.at[1] - sh.y1) < 1e-6 || Math.abs(a.at[1] - sh.y2) < 1e-6;
        out.push(text(sx(a.at[0]), sy(a.at[1]) + (onLine ? -8 : 4), a.text, "middle", false));
      }
      // 교점 기준 사분면으로 놓는 각: 호 + 이등분선 위 라벨. 어느 각인지 헷갈리지 않게.
      const dir = unit([t1[0] - t0[0], t1[1] - t0[1]]);
      for (const a of sh.angles ?? []) {
        const yLine = a.line === "y1" ? sh.y1 : sh.y2;
        if (Math.abs(dir[1]) < 1e-9) continue;
        const tpar = (yLine - t0[1]) / dir[1];
        const ix = t0[0] + dir[0] * tpar;
        const east = a.quadrant === "NE" || a.quadrant === "SE";
        const north = a.quadrant === "NE" || a.quadrant === "NW";
        const hRay: Point = [east ? 1 : -1, 0];
        // 횡단선 방향 중 원하는 남북 쪽을 고른다.
        const tRay: Point = (dir[1] > 0) === north ? dir : [-dir[0], -dir[1]];
        const r = Math.max(0.35, (x1 - x0) * 0.06);
        out.push(arc(sx, sy, [ix, yLine], r, Math.atan2(hRay[1], hRay[0]), Math.atan2(tRay[1], tRay[0])));
        const bis = unit([hRay[0] + tRay[0], hRay[1] + tRay[1]]);
        out.push(text(sx(ix + bis[0] * r * 2.3), sy(yLine + bis[1] * r * 2.3) + 4, a.text, "middle", false));
      }
    } else {
      out.push(text(sx(sh.at[0]), sy(sh.at[1]) + 4, sh.text));
    }
  }
  if (spec.notToScale) out.push(`<text x="${PAD}" y="${H - 8}" fill="#374151" font-size="11">Note: Figure not drawn to scale.</text>`);
  out.push("</svg>");
  return out.join("");
}

/** 점 c 를 중심으로 각 a1 → a2(수학 좌표, 라디안) 사이의 짧은 호. */
function arc(sx: (x: number) => number, sy: (y: number) => number, c: Point, r: number, a1: number, a2: number): string {
  let d = a2 - a1;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const p1: Point = [c[0] + Math.cos(a1) * r, c[1] + Math.sin(a1) * r];
  const p2: Point = [c[0] + Math.cos(a1 + d) * r, c[1] + Math.sin(a1 + d) * r];
  // SVG y 축은 아래로 — 수학 좌표에서 양의 회전은 화면에서 반대이므로 sweep 을 뒤집는다.
  const sweep = d > 0 ? 0 : 1;
  const rx = Math.abs(sx(c[0] + r) - sx(c[0]));
  return `<path d="M${fmt(sx(p1[0]))},${fmt(sy(p1[1]))} A${fmt(rx)},${fmt(rx)} 0 0 ${sweep} ${fmt(sx(p2[0]))},${fmt(sy(p2[1]))}" fill="none" stroke="#111" stroke-width="1.3"/>`;
}

function unit(v: Point): Point {
  const l = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / l, v[1] / l];
}
