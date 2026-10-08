// AP 그림 렌더링 게이트 — 후보 하나의 stimulus 를 정규화·렌더하고 결정적 검사를 돌린다(LLM 없음).
// 결과: 상태(pass/fail/not_applicable), 분류(그림이 있어야 풀리는가 vs 본문만으로 충분한가), 이슈 목록, 렌더 산출물.
// 오류(error)가 하나라도 있으면 fail → render_verified 를 true 로 올릴 수 없다.

import { checkFigure } from "../problem-figures/check";
import { validateFigureSpec } from "../problem-figures/spec";
import { renderFigureSvg } from "../problem-figures/render";
import { niceTicks, interpAt, type ApGraphSpec, type ApSpec } from "../problem-figures/templates/ap-figures";
import { normalizeStimulus, parseStimulusEx, type Feature, type NormIssue } from "./normalize";

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

export type ApCandidateLike = { stockKey?: string; candidateKey: string; apSubjectCode: string; kind: string; validation?: string; payload: Json };

export type FigureNeed = "required" | "supporting" | "text_only";
export type GateIssue = { level: "error" | "warn" | "info"; code: string; message: string };
export type GateResult = {
  key: string;
  subject: string;
  kind: string;
  /** 정규화된 종류: graph | table | payoff_matrix | diagram | text | none */
  stimKind: string;
  /** 렌더 유형(스냅샷 폴더): ap_graph:<서브유형> | ap_table | ap_diagram:<variant> | none */
  renderType: string;
  need: FigureNeed;
  needReason: string;
  status: "pass" | "fail" | "not_applicable";
  issues: GateIssue[];
  spec: ApSpec | null;
  output: string | null;
  alt: string | null;
  validation?: string;
};

/** 학생이 보는 문제 텍스트(질문·선택지·FRQ 파트 프롬프트). 표식·라벨이 본문에서 가리켜지는지 판단하는 기준. */
export function visibleTextOf(payload: Json): { stem: string; options: string; all: string } {
  const stems: string[] = [], opts: string[] = [];
  if (typeof payload.stem === "string") stems.push(payload.stem);
  if (Array.isArray(payload.options)) opts.push(...(payload.options as unknown[]).map(String));
  if (Array.isArray(payload.items)) for (const it of payload.items as Json[]) { if (typeof it.stem === "string") stems.push(it.stem); if (Array.isArray(it.options)) opts.push(...(it.options as unknown[]).map(String)); }
  if (Array.isArray(payload.parts)) for (const p of payload.parts as Json[]) if (typeof p.prompt === "string") stems.push(p.prompt);
  if (typeof payload.title === "string") stems.push(payload.title);
  const stimDesc = isObj(payload.stimulus) && typeof payload.stimulus.description === "string" ? "" : "";
  return { stem: stems.join("\n"), options: opts.join("\n"), all: [...stems, ...opts, stimDesc].join("\n") };
}

const numTokens = (s: string): string[] => (s.match(/-?\d+(?:,\d{3})*(?:\.\d+)?/g) ?? []).map((t) => t.replace(/,/g, ""));
const numsIn = (v: unknown): string[] => (typeof v === "number" ? [String(v)] : typeof v === "string" ? numTokens(v) : Array.isArray(v) ? v.flatMap(numsIn) : isObj(v) ? Object.values(v).flatMap(numsIn) : []);

// ── 특징 계산(코드가 곡선에서 직접) ────────────────────────────────────
function crossingsOf(points: [number, number][], level = 0): number[] {
  const out: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i], [x1, y1] = points[i + 1];
    const a = y0 - level, b = y1 - level;
    if (a === 0) out.push(x0);
    else if (a * b < 0) out.push(x0 + ((0 - a) / (b - a)) * (x1 - x0));
  }
  const last = points[points.length - 1]; if (last && last[1] - level === 0) out.push(last[0]);
  return out;
}
const dedup = (xs: number[], tol: number) => xs.sort((a, b) => a - b).filter((x, i, a) => i === 0 || Math.abs(x - a[i - 1]) > tol);

export function computeFeatures(spec: ApGraphSpec) {
  const xr = spec.x.max - spec.x.min, yr = spec.y.max - spec.y.min;
  const xInt = dedup(spec.series.flatMap((s) => crossingsOf(s.points)), xr * 0.004);
  const inter: { i: number; j: number; x: number; y: number }[] = [];
  // 일반 꺾은선 교차(함수가 아닌 곡선 x=f(y) 도 처리). 끝점이 거의 닿는 경우(허용 오차)도 교점으로 본다.
  const eps = Math.max(xr, yr) * 2e-4;
  const segInter = (p: [number, number], q: [number, number], r: [number, number], s: [number, number]): [number, number] | null => {
    const d1x = q[0] - p[0], d1y = q[1] - p[1], d2x = s[0] - r[0], d2y = s[1] - r[1];
    const den = d1x * d2y - d1y * d2x;
    if (Math.abs(den) < 1e-12) return null;
    const t = ((r[0] - p[0]) * d2y - (r[1] - p[1]) * d2x) / den, u = ((r[0] - p[0]) * d1y - (r[1] - p[1]) * d1x) / den;
    const tol = 1e-9;
    if (t < -tol || t > 1 + tol || u < -tol || u > 1 + tol) return null;
    return [p[0] + t * d1x, p[1] + t * d1y];
  };
  for (let i = 0; i < spec.series.length; i++) for (let j = i + 1; j < spec.series.length; j++) {
    const a = spec.series[i].points, b = spec.series[j].points;
    const found: [number, number][] = [];
    for (let m = 0; m < a.length - 1; m++) for (let n = 0; n < b.length - 1; n++) { const pt = segInter(a[m], a[m + 1], b[n], b[n + 1]); if (pt) found.push(pt); }
    // 끝점 접촉
    for (const pa of [a[0], a[a.length - 1]]) for (const pb of [b[0], b[b.length - 1]]) if (Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) <= eps) found.push(pa);
    for (const pt of found) if (!inter.some((q) => q.i === i && q.j === j && Math.hypot(q.x - pt[0], q.y - pt[1]) <= Math.max(xr, yr) * 0.004)) inter.push({ i, j, x: pt[0], y: pt[1] });
  }
  const ext: { s: number; x: number; y: number; kind: "max" | "min" }[] = [];
  spec.series.forEach((s, si) => {
    // 표본이 촘촘하지 않은 꺾은선은 꼭짓점이 극값, 촘촘한 곡선은 이웃 비교(잡음 방지 임계)
    const p = s.points;
    for (let k = 1; k < p.length - 1; k++) {
      const a = p[k - 1][1], b = p[k][1], c = p[k + 1][1];
      if (b > a && b >= c && b - Math.min(a, c) > yr * 1e-4) ext.push({ s: si, x: p[k][0], y: b, kind: "max" });
      if (b < a && b <= c && Math.max(a, c) - b > yr * 1e-4) ext.push({ s: si, x: p[k][0], y: b, kind: "min" });
    }
  });
  return { xInt, inter, ext, tolX: xr * 0.02, tolY: yr * 0.02 };
}

function onAnySeries(spec: ApGraphSpec, x: number, y: number | undefined, tolY: number, tolX: number): boolean {
  for (const s of spec.series) {
    if (y === undefined) { if (interpAt(s.points, x) !== null) return true; continue; }
    // 점 근방(수평 허용 오차 안에서 가장 가까운 y)
    for (const dx of [0, -tolX / 2, tolX / 2]) { const v = interpAt(s.points, x + dx); if (v !== null && Math.abs(v - y) <= tolY) return true; }
    // 불연속 구간 끝점(점프)처럼 선이 끊긴 곳 — 표식으로 선언된 점은 세그먼트 끝점이면 통과
    if (s.points.some(([px, py]) => Math.abs(px - x) <= tolX / 4 && Math.abs(py - y) <= tolY)) return true;
  }
  return false;
}

function pairsInStem(stem: string): [number, number][] {
  // "points (0,2), (2,0), ..." 형태의 좌표 나열만 신뢰한다. 구간 표기 (a,b) 와 구분하기 위해 앞에 points 가 있거나 3개 이상 이어질 때만.
  const res: [number, number][] = [];
  const re = /\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g;
  const found: { i: number; p: [number, number] }[] = [];
  for (const m of stem.matchAll(re)) found.push({ i: m.index ?? 0, p: [Number(m[1]), Number(m[2])] });
  const pre = (i: number, n = 40) => stem.slice(Math.max(0, i - n), i).toLowerCase();
  const consecutive = found.length >= 3;
  for (const f of found) {
    if (/\b(on|over|in|for|interval|domain|between|from|at)\s*(the\s+)?(open\s+|closed\s+)?(interval\s*)?\$?\s*$/.test(pre(f.i, 24))) continue; // 구간 표기
    if (/points?\b|passes through|through|joining/.test(pre(f.i)) || consecutive) res.push(f.p);
  }
  return res;
}

function classifyNeed(stimKind: string, spec: ApSpec | null, text: { stem: string; options: string; all: string }, stimData: unknown): { need: FigureNeed; reason: string } {
  const refs = /\b(graph|figure|table|diagram|shown|plotted|curve|matrix|chart|data below|data above|the data|illustrated)\b/i.test(text.stem);
  if (stimKind === "none" || (stimKind === "text" && !spec)) return { need: "text_only", reason: stimKind === "none" ? "자료 없음" : "텍스트 자료(식·조건)가 본문에 모두 있음" };
  if (stimKind === "diagram" && !spec) return { need: "text_only", reason: "도식이지만 본문이 모든 정보를 담음(그리지 않음)" };
  if (stimKind === "graph") {
    if (refs) return { need: "required", reason: "본문이 그래프를 가리키고 값은 그림에서 읽어야 함" };
    return { need: "supporting", reason: "본문이 그래프를 직접 가리키지 않음 — 보조 그림" };
  }
  if (stimKind === "text" && spec) return { need: "required", reason: "본문에 없는 조건·식·수치를 자료 패널이 담고 있음" };
  if (stimKind === "text" || stimKind === "none") return { need: "text_only", reason: stimKind === "none" ? "자료 없음" : "텍스트 자료(식·조건)가 본문에 모두 있음" };
  if (stimKind === "table" || stimKind === "payoff_matrix") {
    const cells = spec && spec.type === "ap_table" ? spec.rows.flat().map(String).flatMap(numTokens) : spec && spec.type === "ap_table_set" ? spec.tables.flatMap((t) => t.rows.flat().map(String).flatMap(numTokens)) : [];
    const textNums = new Set(numTokens(text.all));
    const missing = cells.filter((c) => !textNums.has(c));
    if (missing.length >= 2 || (refs && missing.length >= 1)) return { need: "required", reason: `표의 숫자 ${missing.length}개가 본문에 없음 — 표가 있어야 풀림` };
    if (refs) return { need: "supporting", reason: "표의 값이 본문에도 있음" };
    return { need: "supporting", reason: "본문이 표를 가리키지 않음 — 보조 자료" };
  }
  void stimData;
  return { need: "required", reason: "도식/그림 자료" };
}

export function renderTypeOf(stimKind: string, spec: ApSpec | null, subject: string): string {
  if (!spec) return stimKind === "diagram" ? "none(diagram_text_only)" : stimKind;
  if (spec.type === "ap_table_set") return "ap_table:multi_panel";
  if (spec.type === "ap_table") return stimKind === "payoff_matrix" ? "ap_table:payoff_matrix" : stimKind === "text" ? "ap_table:given_info" : spec.columns.length === 2 && spec.columns[0] === "Item" ? "ap_table:given_info" : "ap_table";
  if (spec.type === "ap_diagram") return `ap_diagram:${spec.variant}`;
  // 그래프 하위 유형
  if (subject === "ap_biology") return "ap_graph:bio_line";
  if (subject === "ap_microeconomics") return "ap_graph:econ_curves";
  const hasMarkersOpen = (spec.markers ?? []).some((m) => m.style === "open");
  if (hasMarkersOpen) return "ap_graph:calc_piecewise_limits";
  if ((spec.shades ?? []).length) return "ap_graph:calc_region_between_curves";
  if (spec.series.length >= 2) return "ap_graph:calc_multi_curve";
  return "ap_graph:calc_function_or_derivative";
}

export function gateCandidate(c: ApCandidateLike): GateResult {
  const issues: GateIssue[] = [];
  const text = visibleTextOf(c.payload);
  const norm = normalizeStimulus(c.payload.stimulus, { subject: c.apSubjectCode, visibleText: text.all });
  for (const i of norm.issues) issues.push({ level: i.level, code: i.code, message: i.message });
  const stimData = parseStimulusEx(c.payload.stimulus).value;
  const key = c.stockKey ?? c.candidateKey;
  const base = { key, subject: c.apSubjectCode, kind: c.kind, validation: c.validation };
  const { need, reason } = classifyNeed(norm.stimKind, norm.spec, text, stimData);
  const renderType = renderTypeOf(norm.stimKind, norm.spec, c.apSubjectCode);

  // 그림이 없어야 하는 경우의 점검
  if (!norm.spec) {
    if (norm.stimKind === "none" || norm.stimKind === "text" || norm.stimKind === "diagram") {
      const refsFigure = /\b(graph|figure|diagram|table|shown|plotted|pictured|curve below|illustrat)/i.test(text.stem);
      const SHOWN = /(as shown|is shown|are shown|shown (?:below|above|in the)|in the (?:figure|graph|table|diagram)|the (?:figure|diagram|table) (?:above|below)|(?:graph|table|figure|diagram) (?:above|below)|graph shows|table shows|table gives|table lists|figure shows|diagram shows|shown in the|graph of \$?[a-zA-Z]'?\$? (?:is )?shown)/i;
      const claimsShown = SHOWN.test(text.stem);
      if (claimsShown && norm.stimKind !== "diagram") issues.push({ level: "error", code: "figure_referenced_but_missing", message: "본문이 그림·표를 가리키는데(" + (text.stem.match(SHOWN)?.[0] ?? "") + ") 자료가 텍스트뿐입니다." });
      void refsFigure;
      if (norm.stimKind === "text" && isObj(stimData?.data)) {
        // 텍스트 자료의 숫자·식이 학생에게 보이는 텍스트(본문+설명)에 모두 있어야 한다.
        const visible = text.all + " " + String(stimData?.description ?? "");
        const miss = [...new Set(numsIn(Object.entries(stimData!.data as Json).filter(([k]) => !/unit/i.test(k)).map(([, v]) => v)))].filter((n) => !numTokens(visible).includes(n));
        if (miss.length) issues.push({ level: "warn", code: "text_data_not_in_stem", message: `텍스트 자료의 숫자 ${miss.slice(0, 6).join(", ")}${miss.length > 6 ? " …" : ""} 가 본문에 없습니다(자료 설명을 문제 지문에 포함해야 학생이 볼 수 있음).` });
      }
      return { ...base, stimKind: norm.stimKind, renderType, need, needReason: reason, status: issues.some((i) => i.level === "error") ? "fail" : "not_applicable", issues, spec: null, output: null, alt: null };
    }
    issues.push({ level: "error", code: "not_renderable", message: "그림/표 자료가 있지만 표준 스펙으로 바꾸지 못했습니다." });
    return { ...base, stimKind: norm.stimKind, renderType, need, needReason: reason, status: "fail", issues, spec: null, output: null, alt: null };
  }

  // 표준 파이프라인(스펙 검증 → 렌더 → 라벨 충돌/단위 검사)
  const v = validateFigureSpec(norm.spec);
  if (!v.ok) { issues.push({ level: "error", code: "schema", message: v.error }); return { ...base, stimKind: norm.stimKind, renderType, need, needReason: reason, status: "fail", issues, spec: norm.spec, output: null, alt: null }; }
  const chk = checkFigure(norm.spec, text.all, Array.isArray(c.payload.options) ? (c.payload.options as unknown[]).map(String) : null);
  for (const i of chk.issues) issues.push({ level: "error", code: i.code, message: i.message });
  const output = renderFigureSvg(norm.spec);
  const spec = norm.spec;

  if (spec.type === "ap_graph") graphChecks(spec, norm.features, text, c.apSubjectCode, issues);
  if (spec.type === "ap_table") tableChecks(spec, c.apSubjectCode, issues);
  if (spec.type === "ap_table_set") spec.tables.forEach((t) => tableChecks(t, c.apSubjectCode, issues, true));
  // 자료 완전성: 원본 데이터의 숫자가 렌더 결과(표·패널)에 모두 있는가(그림·표로 보여 주는 자료가 정보를 잃지 않았는지)
  if (spec.type === "ap_table" || spec.type === "ap_table_set") {
    const src = stimData && isObj(stimData.data) ? (stimData.data as Json) : {};
    const srcNums = new Set(numsIn(Object.entries(src).filter(([k]) => !/unit|^(design|answer|key|axes|curves_to_draw|intersections?)/i.test(k)).map(([, v]) => v)));
    const out = new Set(numTokens(JSON.stringify(spec)));
    const lost = [...srcNums].filter((n) => !out.has(n) && !numTokens(text.all).includes(n));
    if (lost.length) issues.push({ level: "warn", code: "data_not_rendered", message: `원본 자료의 숫자 ${lost.slice(0, 8).join(", ")}${lost.length > 8 ? " …" : ""} 가 표에 없습니다(본문에도 없음).` });
  }
  if (chk.alt !== undefined && chk.alt.length < 20) issues.push({ level: "error", code: "alt_too_short", message: "대체 설명(alt)이 너무 짧습니다." });
  return { ...base, stimKind: norm.stimKind, renderType, need, needReason: reason, status: issues.some((i) => i.level === "error") ? "fail" : "pass", issues, spec, output, alt: chk.alt ?? null };
}

function graphChecks(spec: ApGraphSpec, declared: Feature[], text: { stem: string; options: string; all: string }, subject: string, issues: GateIssue[]) {
  const add = (level: GateIssue["level"], code: string, message: string) => issues.push({ level, code, message });
  // 축 라벨·단위
  for (const [k, a] of [["x", spec.x], ["y", spec.y]] as const) {
    if (!a.label.trim()) add("error", "axis_label_missing", `${k} 축 라벨이 없습니다.`);
    const ticks = niceTicks(a.min, a.max, a.step);
    if (ticks.length < 3 || ticks.length > 24) add("error", "tick_count", `${k} 축 눈금 ${ticks.length}개 — 3~24개여야 읽을 수 있습니다.`);
    if (a.step && ticks.length > 16) add("warn", "tick_dense", `${k} 축 눈금이 ${ticks.length}개로 촘촘합니다(일부 숫자는 건너뜀).`);
    if (subject !== "ap_calculus_ab" && subject !== "ap_calculus_bc" && !/[(%$]|per |dollars|units|percent|hours|degrees|°C/i.test(a.label)) add("warn", "axis_units_missing", `${k} 축 라벨 "${a.label}"에 단위 표기가 없습니다.`);
    if ((subject === "ap_calculus_ab" || subject === "ap_calculus_bc") && /\(.*\)/.test(a.label) === false && a.label.length > 12) add("warn", "axis_label_long", `${k} 축 라벨이 깁니다.`);
  }
  // 곡선이 축 범위를 벗어나는가
  for (const s of spec.series) {
    const out = s.points.filter(([x, y]) => x < spec.x.min - 1e-9 || x > spec.x.max + 1e-9 || y < spec.y.min - 1e-9 || y > spec.y.max + 1e-9).length;
    if (out / s.points.length > 0.3) add("error", "curve_mostly_clipped", `"${s.label || "곡선"}" 표본의 ${Math.round((100 * out) / s.points.length)}% 가 축 범위 밖입니다.`);
    else if (out > 0 && !s.source) add("warn", "curve_clipped", `"${s.label || "곡선"}" 일부가 축 범위 밖입니다.`);
  }
  const { xInt, inter, tolX, tolY } = computeFeatures(spec);
  // 선언된 특징이 곡선과 일치하는가
  for (const f of declared) {
    if (f.kind === "x_intercept") { if (!xInt.some((x) => Math.abs(x - f.x) <= tolX)) add("error", "declared_intercept_mismatch", `선언된 x절편 ${f.x} 이(가) 곡선과 맞지 않습니다(코드 계산: ${xInt.map((x) => Math.round(x * 100) / 100).join(", ") || "없음"}).`); }
    else if (f.kind === "intersection") { if (!inter.some((p) => Math.abs(p.x - f.x) <= Math.max(tolX, 0.05) && (f.y === undefined || Math.abs(p.y - f.y) <= tolY))) add("error", "declared_intersection_mismatch", `선언된 교점 x=${f.x}${f.y !== undefined ? `, y=${f.y}` : ""} 이(가) 곡선 교차와 맞지 않습니다(코드 계산: ${inter.map((p) => `(${Math.round(p.x * 100) / 100}, ${Math.round(p.y * 100) / 100})`).join(", ") || "교차 없음"}).`); }
    else if (!onAnySeries(spec, f.x, f.y, tolY, tolX)) add("error", "declared_point_off_curve", `선언된 점 (${f.x}, ${f.y ?? "?"}) 이(가) 어느 곡선 위에도 없습니다(${f.source}).`);
  }
  // 그려진 표식이 곡선 위(또는 선분 끝점)에 있는가
  for (const m of spec.markers ?? []) if (!m.standalone && !onAnySeries(spec, m.x, m.y, tolY, tolX) && !m.label) add("error", "marker_off_curve", `표식 (${m.x}, ${m.y})이 곡선 위에 없습니다.`);
  for (const m of spec.markers ?? []) if (m.label && !onAnySeries(spec, m.x, m.y, tolY, tolX)) add("warn", "labeled_marker_off_curve", `라벨 점 ${m.label} (${m.x}, ${m.y})이 곡선 위에 없습니다(곡선 밖 점일 수 있음).`);
  // 본문이 인용한 좌표가 곡선 위에 있는가(좌표 나열만)
  for (const p of pairsInStem(text.stem)) if (!onAnySeries(spec, p[0], p[1], tolY, tolX) && !(spec.markers ?? []).some((m) => m.x === p[0] && m.y === p[1])) add("error", "cited_point_off_curve", `본문이 인용한 점 (${p[0]}, ${p[1]}) 이(가) 그린 곡선 위에 없습니다.`);
  // 본문 서술 ↔ 그림 요소
  if (/\bshaded\b/i.test(text.stem) && !(spec.shades ?? []).length) add("error", "shade_missing", "본문이 음영 영역을 말하는데 그림에 음영이 없습니다.");
  if (/open circle|open dot|\bhole\b/i.test(text.stem) && !(spec.markers ?? []).some((m) => m.style === "open")) add("error", "open_marker_missing", "본문이 열린 점을 말하는데 그림에 열린 점이 없습니다.");
  if (/\b(filled|solid) (dot|circle|point)/i.test(text.stem) && !(spec.markers ?? []).some((m) => m.style === "filled")) add("error", "filled_marker_missing", "본문이 채운 점을 말하는데 그림에 채운 점이 없습니다.");
  if (/dashed/i.test(text.stem) && !spec.series.some((s) => s.style === "dashed") && !(spec.guides ?? []).length) add("warn", "dashed_missing", "본문이 점선을 말하는데 그림에 점선이 없습니다.");
  if (/\bf'|derivative/i.test(text.stem) && spec.series.length === 1 && !/'|prime|derivative|rate|f'/i.test(spec.y.label + spec.series[0].label)) add("warn", "derivative_label", "도함수 그래프인데 y 축 라벨에 f′ 표기가 없습니다.");
  if (declared.length === 0 && (spec.markers ?? []).length === 0 && !spec.series.some((s) => s.source)) add("info", "no_checkable_features", "코드로 대조할 선언된 특징(절편·교점·극값)이 없어 구조 검사만 했습니다.");
}

function tableChecks(spec: Extract<ApSpec, { type: "ap_table" }>, subject: string, issues: GateIssue[], inSet = false) {
  const add = (level: GateIssue["level"], code: string, message: string) => issues.push({ level, code, message });
  if (!spec.title && !inSet && subject !== "ap_calculus_ab" && subject !== "ap_calculus_bc") add("warn", "table_no_title", "표에 제목이 없습니다.");
  const numericCols = spec.columns.map((_, ci) => spec.rows.every((r) => typeof r[ci] === "number" || /^-?[\d,.]+%?$/.test(String(r[ci]).trim())));
  spec.columns.forEach((c, ci) => { if (numericCols[ci] && ci > 0 && !/[(%$]|per |units|mean|percent|rate|\b(g|mg|mL|L|cm|m|s|min|h|°C)\b/i.test(c) && !spec.units && !(spec.notes ?? []).some((n) => /unit|\(|%/.test(n))) add("warn", "table_units_missing", `열 "${c}" 에 단위 표기가 없습니다.`); });
  const seen = new Set<string>();
  for (const r of spec.rows) { const k = JSON.stringify(r); if (seen.has(k)) { add("warn", "table_duplicate_row", "같은 행이 중복됩니다."); break; } seen.add(k); }
  // 숫자 열의 소수 자릿수 일관성
  spec.columns.forEach((c, ci) => { if (!numericCols[ci]) return; const ds = new Set(spec.rows.map((r) => (String(r[ci]).split(".")[1] ?? "").length)); if (ds.size > 2) add("info", "table_decimal_mix", `열 "${c}" 의 소수 자릿수가 일정하지 않습니다.`); });
}

export type { Feature, NormIssue };
