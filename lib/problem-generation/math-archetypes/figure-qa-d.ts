// 시각 검수의 구조 검사(G8) — 새 렌더러 5종(수직선·줄기-잎·원그래프·도수다각형/누적도수곡선·누적 막대) 전용.
// figure-qa.ts 의 checkRenderedFigure 가 이 파일의 checkDFigure 를 부른다. 그려진 SVG 를 읽어 데이터와 같게 그려졌는지(값 충실도: 위치·길이·각도·글자)를 본다.
import { freqChartPoints, freqChartXTicks, type FreqChartSpec } from "@/lib/problem-figures/templates/freq-chart";
import { numberLineTicks, NL, type NumberLineSpec } from "@/lib/problem-figures/templates/number-line";
import { pieLabelText, PIE, type PieSpec } from "@/lib/problem-figures/templates/pie";
import { slKey, type StemLeafSpec } from "@/lib/problem-figures/templates/stem-leaf";
import { stackedTotals, type StackedBarSpec } from "@/lib/problem-figures/templates/stacked-bar";
import { titleNamesUnit } from "./skills/fig/axis-title";

export type QaIssue = { code: string; message: string };
const NUM = /^-?\d[\d,]*(\.\d+)?$/;
const toNum = (s: string) => Number(s.replace(/,/g, ""));
const attr = (a: string, n: string) => a.match(new RegExp(`(?:^|\\s)${n}="([^"]*)"`))?.[1];
const unesc = (t: string) => t.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
type T = { x: number; y: number; size: number; anchor: string; text: string; rotated: boolean; attrs: string };
const texts = (svg: string): T[] => [...svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)].map((m) => ({ x: Number(attr(m[1], "x") ?? NaN), y: Number(attr(m[1], "y") ?? NaN), size: Number(attr(m[1], "font-size") ?? 12), anchor: attr(m[1], "text-anchor") ?? "start", text: unesc(m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")), rotated: /transform=/.test(m[1]), attrs: m[1] }));
const lines = (svg: string) => [...svg.matchAll(/<line\b([^>]*)\/?>/g)].map((m) => ({ x1: Number(attr(m[1], "x1")), y1: Number(attr(m[1], "y1")), x2: Number(attr(m[1], "x2")), y2: Number(attr(m[1], "y2")), stroke: attr(m[1], "stroke") ?? "", w: attr(m[1], "stroke-width") ?? "", nl: attr(m[1], "data-nl") }));
const circles = (svg: string) => [...svg.matchAll(/<circle\b([^>]*)\/?>/g)].map((m) => ({ cx: Number(attr(m[1], "cx")), cy: Number(attr(m[1], "cy")), r: Number(attr(m[1], "r")), fill: attr(m[1], "fill") ?? "", nl: attr(m[1], "data-nl") }));
const rects = (svg: string) => [...svg.matchAll(/<rect\b([^>]*)\/?>/g)].map((m) => ({ x: Number(attr(m[1], "x")), y: Number(attr(m[1], "y")), w: Number(attr(m[1], "width")), h: Number(attr(m[1], "height")), fill: attr(m[1], "fill") ?? "", sb: attr(m[1], "data-sb"), legend: attr(m[1], "data-sb-legend") }));
const viewBox = (svg: string) => (svg.match(/viewBox="([^"]+)"/)?.[1] ?? "").split(/\s+/).map(Number);

type Fit = { a: number; b: number; maxRes: number } | null;
/** 값 = a·위치 + b 의 최소제곱 선형 대응(잔차는 픽셀). */
function fit(ticks: { v: number; pos: number }[]): Fit {
  if (ticks.length < 2) return null;
  const n = ticks.length, mp = ticks.reduce((s, t) => s + t.pos, 0) / n, mv = ticks.reduce((s, t) => s + t.v, 0) / n;
  let spv = 0, spp = 0; for (const t of ticks) { spv += (t.pos - mp) * (t.v - mv); spp += (t.pos - mp) ** 2; }
  if (spp === 0) return null; const a = spv / spp, b = mv - a * mp;
  return { a, b, maxRes: Math.max(...ticks.map((t) => Math.abs((t.v - b) / a - t.pos))) };
}
/** 가로 눈금(같은 y 에 놓인 가운데 맞춤 숫자 줄)과 세로 눈금(끝 맞춤 숫자, 글자 y−4 가 격자선 y). */
function scales(svg: string): { x: Fit; y: Fit; xTicks: number[]; yTicks: number[] } {
  const ts = texts(svg).filter((t) => NUM.test(t.text) && !t.rotated);
  const yT = ts.filter((t) => t.anchor === "end").map((t) => ({ v: toNum(t.text), pos: t.y - 4 }));
  const byY = new Map<number, T[]>(); for (const t of ts.filter((q) => q.anchor === "middle")) byY.set(t.y, [...(byY.get(t.y) ?? []), t]);
  const row = [...byY.entries()].sort((p, q) => q[1].length - p[1].length || q[0] - p[0])[0]?.[1] ?? [];
  const xT = row.map((t) => ({ v: toNum(t.text), pos: t.x }));
  return { y: fit(yT), x: fit(xT), yTicks: yT.map((t) => t.v), xTicks: xT.map((t) => t.v) };
}
const sameMulti = (a: number[], b: number[], tol: number) => { const rest = [...b]; for (const v of a) { const i = rest.findIndex((w) => Math.abs(w - v) <= tol); if (i < 0) return false; rest.splice(i, 1); } return rest.length === 0; };

/** 글자 잘림·겹침(figure-qa.ts 의 checkOverlapAndClip 과 같은 규칙, 이 파일의 data-속성 글자 포함). */
function checkClipAndOverlap(svg: string, issues: QaIssue[]) {
  const [, , W, H] = viewBox(svg);
  const bs = texts(svg).filter((t) => !t.rotated && t.text && Number.isFinite(t.x) && Number.isFinite(t.y) && !/data-sl="leaf"/.test(t.attrs)).map((t) => { const w = t.text.length * t.size * 0.52, h = t.size; const x1 = t.anchor === "middle" ? t.x - w / 2 : t.anchor === "end" ? t.x - w : t.x; return { t: t.text, x1, x2: x1 + w, y1: t.y - h * 0.8, y2: t.y + h * 0.2 }; });
  for (const b of bs) if (b.x1 < -2 || b.y1 < -2 || (W && b.x2 > W + 2) || (H && b.y2 > H + 2)) issues.push({ code: "label_clipped", message: `글자 '${b.t}' 가 그림 밖으로 잘립니다.` });
  for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const p = bs[i], q = bs[j]; if (p.x1 < q.x2 - 1 && q.x1 < p.x2 - 1 && p.y1 < q.y2 - 1 && q.y1 < p.y2 - 1) issues.push({ code: "label_overlap", message: `글자 '${p.t}' 와 '${q.t}' 가 겹칩니다.` }); }
}

// ───────── 수직선 ─────────
function checkNumberLine(spec: NumberLineSpec, svg: string, issues: QaIssue[]) {
  const sc = scales(svg);
  if (!sc.x || sc.xTicks.length < 3) { issues.push({ code: "axis_ticks_missing", message: `수직선의 눈금 숫자가 ${sc.xTicks.length}개뿐입니다(3개 이상 필요).` }); return; }
  if (sc.x.maxRes > 1.5) issues.push({ code: "render_scale_nonlinear", message: `수직선 눈금 숫자의 위치가 일정한 간격이 아닙니다(잔차 ${sc.x.maxRes.toFixed(1)}px).` });
  const want = numberLineTicks(spec);
  if (sc.xTicks.some((v) => !want.some((w) => Math.abs(w - v) < 1e-9))) issues.push({ code: "render_value_mismatch", message: `눈금 숫자 ${JSON.stringify(sc.xTicks)} 가 데이터의 눈금 ${JSON.stringify(want)} 에 없는 값을 포함합니다.` });
  // 눈금 막대(세로 짧은 선): 개수·균일 간격·숫자와의 일치
  const tk = lines(svg).filter((l) => l.stroke === "#111" && l.w === "1.4" && Math.abs(l.x1 - l.x2) < 1e-6).map((l) => l.x1).sort((a, b) => a - b);
  if (tk.length !== want.length) issues.push({ code: "render_value_mismatch", message: `눈금 막대 ${tk.length}개 ≠ 데이터 눈금 ${want.length}개.` });
  else { const gaps = tk.slice(1).map((x, i) => x - tk[i]); if (Math.max(...gaps) - Math.min(...gaps) > 0.8) issues.push({ code: "render_scale_nonlinear", message: "눈금 막대의 간격이 균일하지 않습니다." }); }
  for (const t of texts(svg).filter((q) => q.anchor === "middle" && NUM.test(q.text) && !q.rotated)) if (tk.length && Math.min(...tk.map((x) => Math.abs(x - t.x))) > 1.5) issues.push({ code: "label_misaligned", message: `눈금 숫자 '${t.text}' 가 어느 눈금 막대와도 맞지 않습니다.` });
  const tol = Math.abs(sc.x.a) * 1.5; const val = (px: number) => sc.x!.a * px + sc.x!.b;
  // 점(찬/빈)
  const exp: { v: number; open: boolean }[] = [];
  for (const it of spec.items) { if (it.kind === "point") exp.push({ v: it.at, open: !!it.open }); else if (it.kind === "ray") exp.push({ v: it.at, open: !!it.open }); else { exp.push({ v: it.lo, open: !!it.loOpen }, { v: it.hi, open: !!it.hiOpen }); } }
  const cs = circles(svg).filter((c) => c.nl === "open" || c.nl === "closed");
  if (cs.length !== exp.length) { issues.push({ code: cs.length === 0 ? "render_empty" : "render_value_mismatch", message: `그려진 점 ${cs.length}개 ≠ 데이터 점 ${exp.length}개.` }); }
  else {
    const rest = [...cs];
    for (const e of exp) { const i = rest.findIndex((c) => Math.abs(val(c.cx) - e.v) <= tol && (c.nl === "open") === e.open); if (i < 0) { issues.push({ code: "render_value_mismatch", message: `값 ${e.v} 의 ${e.open ? "빈" : "찬"} 점이 눈금 기준 자리에 그려지지 않았습니다(위치·포함 여부 불일치).` }); break; } rest.splice(i, 1); }
  }
  // 굵은 선분(구간·반직선)
  const segs = lines(svg).filter((l) => l.nl === "segment").map((l) => [Math.min(l.x1, l.x2), Math.max(l.x1, l.x2)] as [number, number]);
  const expSeg = spec.items.filter((i) => i.kind !== "point");
  if (segs.length !== expSeg.length) issues.push({ code: segs.length === 0 && expSeg.length ? "render_empty" : "render_value_mismatch", message: `그려진 굵은 선분 ${segs.length}개 ≠ 데이터 ${expSeg.length}개.` });
  else {
    const rest = [...segs];
    for (const it of expSeg) {
      const ok = (s: [number, number]) => it.kind === "interval" ? Math.abs(val(s[0]) - it.lo) <= tol && Math.abs(val(s[1]) - it.hi) <= tol : it.kind === "ray" ? (it.dir === "right" ? Math.abs(val(s[0]) - it.at) <= tol && s[1] >= NL.X_MAX + 8 : Math.abs(val(s[1]) - it.at) <= tol && s[0] <= NL.X_MIN - 8) : false;
      const i = rest.findIndex(ok); if (i < 0) { issues.push({ code: "render_value_mismatch", message: it.kind === "interval" ? `구간 ${it.lo}~${it.hi} 의 굵은 선이 눈금 기준 자리에 그려지지 않았습니다.` : `반직선(${it.kind === "ray" ? it.at : ""} 에서 ${it.kind === "ray" ? it.dir : ""})이 눈금 기준 자리·방향대로 그려지지 않았습니다.` }); break; } rest.splice(i, 1);
    }
  }
  checkClipAndOverlap(svg, issues);
}

// ───────── 줄기-잎 ─────────
function checkStemLeaf(spec: StemLeafSpec, svg: string, issues: QaIssue[]) {
  const ts = texts(svg); const stems = ts.filter((t) => /data-sl="stem"/.test(t.attrs)); const leaves = ts.filter((t) => /data-sl="leaf"/.test(t.attrs)); const key = ts.find((t) => /data-sl="key"/.test(t.attrs));
  if (stems.length !== spec.stems.length) { issues.push({ code: stems.length === 0 ? "render_empty" : "render_value_mismatch", message: `그려진 줄기 ${stems.length}개 ≠ 데이터 ${spec.stems.length}개.` }); return; }
  const order = [...stems].sort((a, b) => a.y - b.y).map((t) => Number(t.text));
  if (JSON.stringify(order) !== JSON.stringify(spec.stems.map((s) => s.stem))) issues.push({ code: "render_value_mismatch", message: `줄기 순서 ${JSON.stringify(order)} 이 데이터 ${JSON.stringify(spec.stems.map((s) => s.stem))} 와 다릅니다.` });
  for (const s of spec.stems) {
    const st = stems.find((t) => Number(t.text) === s.stem); if (!st) continue;
    const row = leaves.find((t) => Math.abs(t.y - st.y) < 2);
    const got = row ? row.text.split(/\s+/).filter(Boolean).join(" ") : "";
    if (got !== s.leaves.join(" ")) issues.push({ code: "render_value_mismatch", message: `줄기 ${s.stem} 의 잎 '${got}' 이 데이터 '${s.leaves.join(" ")}' 와 다릅니다.` });
    if (row) { const xs = [...(svg.match(new RegExp(`<text y="${row.y}"[^>]*data-sl="leaf">([\\s\\S]*?)</text>`))?.[1] ?? "").matchAll(/<tspan x="([^"]+)"/g)].map((m) => Number(m[1])); for (let i = 1; i < xs.length; i++) if (xs[i] <= xs[i - 1]) issues.push({ code: "render_value_mismatch", message: `줄기 ${s.stem} 의 잎이 왼쪽에서 오른쪽으로 놓이지 않았습니다.` }); }
  }
  if (!key || key.text !== slKey(spec)) issues.push({ code: "legend_missing", message: `Key 가 '${slKey(spec)}' 로 그려지지 않았습니다(${key?.text ?? "없음"}).` });
  if (!ts.some((t) => t.text === "Stem") || !ts.some((t) => t.text === "Leaf")) issues.push({ code: "table_header_missing", message: "'Stem'·'Leaf' 머리글이 그려지지 않았습니다." });
  const vl = lines(svg).find((l) => Math.abs(l.x1 - l.x2) < 1e-6 && l.w === "1.8"); if (!vl) issues.push({ code: "render_empty", message: "줄기와 잎 사이의 세로선이 없습니다." });
  checkClipAndOverlap(svg, issues);
}

// ───────── 원그래프 ─────────
function checkPie(spec: PieSpec, svg: string, issues: QaIssue[]) {
  const paths = [...svg.matchAll(/<path\b([^>]*)\/?>/g)].map((m) => ({ d: attr(m[1], "d") ?? "", i: attr(m[1], "data-slice"), fill: attr(m[1], "fill") ?? "" })).filter((p) => p.i !== undefined);
  if (paths.length !== spec.slices.length) { issues.push({ code: paths.length === 0 ? "render_empty" : "render_value_mismatch", message: `그려진 부채꼴 ${paths.length}개 ≠ 데이터 ${spec.slices.length}개.` }); return; }
  const total = spec.slices.reduce((a, b) => a + b.amount, 0); const cx = PIE.W / 2;
  const ang = (x: number, y: number, c: [number, number]) => { const a = Math.atan2(x - c[0], -(y - c[1])); return a < 0 ? a + 2 * Math.PI : a; };
  let prevEnd = 0; const fills = new Set<string>();
  paths.sort((a, b) => Number(a.i) - Number(b.i)).forEach((p, i) => {
    const m = p.d.match(/^M ([\d.-]+) ([\d.-]+) L ([\d.-]+) ([\d.-]+) A ([\d.-]+) ([\d.-]+) 0 (\d) 1 ([\d.-]+) ([\d.-]+) Z$/); if (!m) { issues.push({ code: "render_value_mismatch", message: `부채꼴 ${i + 1} 의 경로를 읽지 못했습니다.` }); return; }
    const c: [number, number] = [Number(m[1]), Number(m[2])]; const a1 = ang(Number(m[3]), Number(m[4]), c), a2 = ang(Number(m[8]), Number(m[9]), c);
    let sweep = a2 - a1; if (sweep <= 1e-9) sweep += 2 * Math.PI;
    const wantDeg = (spec.slices[i].amount / total) * 360, gotDeg = (sweep * 180) / Math.PI;
    if (Math.abs(gotDeg - wantDeg) > 0.8) issues.push({ code: "render_value_mismatch", message: `부채꼴 '${spec.slices[i].label}' 의 중심각이 ${gotDeg.toFixed(1)}° 로 그려졌지만 데이터 비율은 ${wantDeg.toFixed(1)}° 입니다(각도·값 비율 불일치).` });
    { let gap = Math.abs(a1 - prevEnd); if (gap > Math.PI) gap = 2 * Math.PI - gap; if (gap > 0.02) issues.push({ code: "render_value_mismatch", message: `부채꼴 '${spec.slices[i].label}' 가 앞 부채꼴에 이어 시작하지 않습니다.` }); }
    prevEnd = a2; if (i === 0 && Math.abs(c[0] - cx) > 1) issues.push({ code: "render_value_mismatch", message: "원의 중심이 그림 가운데가 아닙니다." }); fills.add(p.fill);
    // 라벨: 부채꼴 가운데 방향(±28°) 바깥에 있어야 한다.
    const lab = texts(svg).find((t) => t.text === pieLabelText(spec, i));
    if (!lab) { issues.push({ code: "category_label_missing", message: `부채꼴 '${spec.slices[i].label}' 의 라벨 '${pieLabelText(spec, i)}' 이 그려지지 않았습니다.` }); return; }
    const mid = a1 + sweep / 2; const la = ang(lab.x, lab.y - 4, c); let d = Math.abs(la - mid); if (d > Math.PI) d = 2 * Math.PI - d;
    if (d > (30 * Math.PI) / 180) issues.push({ code: "label_misaligned", message: `라벨 '${lab.text}' 가 자기 부채꼴 방향에 있지 않습니다(${((d * 180) / Math.PI).toFixed(0)}° 어긋남).` });
  });
  if (fills.size !== spec.slices.length) issues.push({ code: "render_value_mismatch", message: "부채꼴 색이 서로 구별되지 않습니다." });
  if (Math.abs(prevEnd - 2 * Math.PI) > 0.03 && Math.abs(prevEnd) > 0.03) issues.push({ code: "render_value_mismatch", message: "부채꼴들이 원을 한 바퀴로 채우지 않습니다." });
  checkClipAndOverlap(svg, issues);
}

// ───────── 도수다각형·누적도수곡선 ─────────
function checkAxisTitles(spec: { xTitle: string; yTitle: string }, svg: string, issues: QaIssue[]) {
  for (const [n, t] of [["가로", spec.xTitle], ["세로", spec.yTitle]] as const) { if (!titleNamesUnit(t)) issues.push({ code: "unit_missing_in_title", message: `${n}축 제목 '${t}' 에 단위(괄호)가 없습니다.` }); else if (!texts(svg).some((q) => q.text.replace(/\s+/g, " ") === t.replace(/\s+/g, " "))) issues.push({ code: "axis_title_missing", message: `${n}축 제목 '${t}' 가 그림에 그려지지 않았습니다.` }); }
}
function checkFreqChart(spec: FreqChartSpec, svg: string, issues: QaIssue[]) {
  const sc = scales(svg);
  if (!sc.y || sc.yTicks.length < 3) issues.push({ code: "axis_ticks_missing", message: `세로축 눈금 숫자가 ${sc.yTicks.length}개뿐입니다(3개 이상 필요).` });
  if (!sc.x || sc.xTicks.length < 3) issues.push({ code: "axis_ticks_missing", message: `가로축 눈금 숫자가 ${sc.xTicks.length}개뿐입니다(3개 이상 필요).` });
  if (sc.y && sc.y.maxRes > 1.5) issues.push({ code: "render_scale_nonlinear", message: `세로축 눈금 숫자의 위치가 일정한 간격이 아닙니다(잔차 ${sc.y.maxRes.toFixed(1)}px).` });
  if (sc.x && sc.x.maxRes > 1.5) issues.push({ code: "render_scale_nonlinear", message: `가로축 눈금 숫자의 위치가 일정한 간격이 아닙니다(잔차 ${sc.x.maxRes.toFixed(1)}px).` });
  const wantX = freqChartXTicks(spec); if (sc.x && sc.xTicks.some((v) => !wantX.some((w) => Math.abs(w - v) < 1e-9))) issues.push({ code: "render_value_mismatch", message: `가로 눈금 숫자 ${JSON.stringify(sc.xTicks)} 가 데이터의 값 ${JSON.stringify(wantX)} 에 없는 값을 포함합니다(구간·경계 불일치).` });
  const grid = lines(svg).filter((l) => l.stroke === "#d1d5db"); const hy = grid.filter((l) => Math.abs(l.y1 - l.y2) < 1e-6).map((l) => l.y1);
  for (const t of texts(svg).filter((q) => NUM.test(q.text) && !q.rotated && q.anchor === "end")) if (hy.length && Math.min(...hy.map((y) => Math.abs(y - (t.y - 4)))) > 1.5) issues.push({ code: "label_misaligned", message: `세로축 눈금 숫자 '${t.text}' 가 어느 격자선과도 맞지 않습니다.` });
  const pts = freqChartPoints(spec); const cs = circles(svg).filter((c) => Math.abs(c.r - 3.5) < 1e-9);
  if (cs.length !== pts.length) { issues.push({ code: cs.length === 0 ? "render_empty" : "render_value_mismatch", message: `그려진 점 ${cs.length}개 ≠ 데이터 점 ${pts.length}개.` }); }
  else if (sc.x && sc.y) {
    const used = new Set<number>();
    for (const [x, y] of pts) { const ex = (x - sc.x.b) / sc.x.a, ey = (y - sc.y.b) / sc.y.a; let best = -1, bd = Infinity; cs.forEach((c, i) => { if (used.has(i)) return; const d = Math.hypot(c.cx - ex, c.cy - ey); if (d < bd) { bd = d; best = i; } }); if (best >= 0) used.add(best); if (bd > 1.5) { issues.push({ code: "render_value_mismatch", message: `점 (${x}, ${y}) 이 눈금 기준 자리에서 ${bd.toFixed(1)}px 벗어나 그려졌습니다(길이·값 비율 불일치).` }); break; } }
    const pl = [...svg.matchAll(/<polyline\b([^>]*)\/?>/g)].map((m) => (attr(m[1], "points") ?? "").trim().split(/\s+/).map((p) => p.split(",").map(Number))).find((p) => p.length === pts.length);
    if (!pl) issues.push({ code: "render_empty", message: "점을 잇는 선이 그려지지 않았습니다." });
    else pl.forEach((p, i) => { const ex = (pts[i][0] - sc.x!.b) / sc.x!.a, ey = (pts[i][1] - sc.y!.b) / sc.y!.a; if (Math.hypot(p[0] - ex, p[1] - ey) > 1.5) issues.push({ code: "render_value_mismatch", message: `선의 ${i + 1}번째 꼭짓점이 데이터 점 (${pts[i][0]}, ${pts[i][1]}) 자리에 있지 않습니다.` }); });
  }
  checkAxisTitles(spec, svg, issues); checkClipAndOverlap(svg, issues);
}

// ───────── 누적 막대 ─────────
function checkStackedBar(spec: StackedBarSpec, svg: string, issues: QaIssue[]) {
  const sc = scales(svg);
  if (!sc.y || sc.yTicks.length < 3) { issues.push({ code: "axis_ticks_missing", message: `세로축 눈금 숫자가 ${sc.yTicks.length}개뿐입니다(3개 이상 필요).` }); return; }
  if (sc.y.maxRes > 1.5) issues.push({ code: "render_scale_nonlinear", message: `세로축 눈금 숫자의 위치가 일정한 간격이 아닙니다(잔차 ${sc.y.maxRes.toFixed(1)}px).` });
  const grid = lines(svg).filter((l) => l.stroke === "#d1d5db"); const hy = grid.filter((l) => Math.abs(l.y1 - l.y2) < 1e-6).map((l) => l.y1);
  for (const t of texts(svg).filter((q) => NUM.test(q.text) && !q.rotated && q.anchor === "end")) if (hy.length && Math.min(...hy.map((y) => Math.abs(y - (t.y - 4)))) > 1.5) issues.push({ code: "label_misaligned", message: `세로축 눈금 숫자 '${t.text}' 가 어느 격자선과도 맞지 않습니다.` });
  const val = (py: number) => sc.y!.a * py + sc.y!.b, tol = Math.abs(sc.y.a) * 1.5;
  const rs = rects(svg).filter((r) => r.sb !== undefined); const want = spec.series.flatMap((s, k) => s.values.map((v, i) => ({ k, i, v }))).filter((x) => x.v > 0);
  if (rs.length !== want.length) { issues.push({ code: rs.length === 0 ? "render_empty" : "render_value_mismatch", message: `그려진 막대 조각 ${rs.length}개 ≠ 데이터 ${want.length}개.` }); }
  else {
    for (const w of want) {
      const r = rs.find((q) => q.sb === `${w.k},${w.i}`); if (!r) { issues.push({ code: "render_value_mismatch", message: `계열 ${w.k + 1}·범주 ${w.i + 1} 의 조각이 없습니다.` }); continue; }
      const h = val(r.y) - val(r.y + r.h); // 값 단위 높이(화면 위쪽이 큰 값)
      if (Math.abs(h - w.v) > tol * 2) issues.push({ code: "render_value_mismatch", message: `'${spec.categories[w.i]}' 막대의 '${spec.series[w.k].name}' 조각 높이가 눈금 기준 ${h.toFixed(1)} 로 그려졌지만 데이터는 ${w.v} 입니다(길이·값 비율 불일치).` });
      const below = spec.series.slice(0, w.k).reduce((a, s) => a + s.values[w.i], 0); if (Math.abs(val(r.y + r.h) - below) > tol) issues.push({ code: "render_value_mismatch", message: `'${spec.categories[w.i]}' 막대의 '${spec.series[w.k].name}' 조각이 아래 조각 위에 쌓이지 않았습니다.` });
      if (spec.showValues) { const lab = texts(svg).find((t) => t.attrs.includes(`data-sb-value="${w.k},${w.i}"`)); if (!lab || toNum(lab.text) !== w.v) issues.push({ code: "table_value_mismatch", message: `조각 값 라벨이 ${lab?.text ?? "없음"} 이지만 데이터는 ${w.v} 입니다.` }); }
    }
  }
  const tot = stackedTotals(spec); void tot;
  for (const s of spec.series) if (!texts(svg).some((t) => t.text === s.name)) issues.push({ code: "legend_missing", message: `범례에 계열 이름 '${s.name}' 이 없습니다.` });
  for (const c of spec.categories) if (!texts(svg).some((t) => t.text === c)) issues.push({ code: "category_label_missing", message: `범주 이름 '${c}' 가 그려지지 않았습니다.` });
  const legend = rects(svg).filter((r) => r.legend !== undefined); if (legend.length !== spec.series.length) issues.push({ code: "legend_missing", message: `범례 견본 ${legend.length}개 ≠ 계열 ${spec.series.length}개.` });
  checkAxisTitles(spec, svg, issues); checkClipAndOverlap(svg, issues);
}

/** 새 렌더러 5종의 그림 하나를 검사. 해당 type 이 아니면 null. */
export function checkDFigure(spec: { type: string } & Record<string, unknown>, markup: string): QaIssue[] | null {
  const issues: QaIssue[] = [];
  switch (spec.type) {
    case "number_line": checkNumberLine(spec as unknown as NumberLineSpec, markup, issues); return issues;
    case "stem_leaf": checkStemLeaf(spec as unknown as StemLeafSpec, markup, issues); return issues;
    case "pie": checkPie(spec as unknown as PieSpec, markup, issues); return issues;
    case "freq_chart": checkFreqChart(spec as unknown as FreqChartSpec, markup, issues); return issues;
    case "stacked_bar": checkStackedBar(spec as unknown as StackedBarSpec, markup, issues); return issues;
    default: return null;
  }
}
