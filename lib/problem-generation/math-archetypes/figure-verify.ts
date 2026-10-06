// 자료(그림·표)가 붙는 원형 문항의 결정론 검증 도구.
//
// 원칙(조사 문서 5-2·5-4):
//  - verification_js 는 figure 데이터를 `const FIGURE = {...};` (지문형) 또는 `const CHOICES = [...];` (선택지형)로 받아 그 값만 읽어 정답을 다시 계산한다.
//    생성기 내부 변수는 접근할 수 없다 — 지문에 인쇄된 값은 `const P = {...};` 로만 넘어간다.
//  - FIGURE/CHOICES 상수가 실제 Instance.figure 와 같은지 확인한다(검증이 '인쇄된 자료'를 푸는지 보증).
//  - 자료 의존 검사: FIGURE 를 가리면(null) 풀 수 없어야 한다(그림이 장식이면 실패).
//  - 선택지형: 정답만 predicate 참, 오답 3개는 각각 선언한 서로 다른 오답 규칙으로 진단, 같은 그림 없음.
import vm from "node:vm";
import type { Instance } from "./types";

export const FIGURE_LINE = /^const FIGURE = (.*);$/m;
export const CHOICES_LINE = /^const CHOICES = (.*);$/m;

/** 값을 돌려주는 일반 실행기(숫자 제한 없음). */
export function runJs(js: string, timeout = 5000): unknown {
  return vm.runInNewContext(`(function(){${js}})()`, {}, { timeout });
}

const parseLine = (js: string, re: RegExp): unknown | undefined => { const m = js.match(re); if (!m) return undefined; try { return JSON.parse(m[1]); } catch { return undefined; } };
export const embeddedFigure = (js: string) => parseLine(js, FIGURE_LINE);
export const embeddedChoices = (js: string) => parseLine(js, CHOICES_LINE);
/** FIGURE/CHOICES 상수를 비워 '자료 없이' 돌려 본다. */
export const withoutFigure = (js: string) => js.replace(FIGURE_LINE, "const FIGURE = null;").replace(CHOICES_LINE, "const CHOICES = [];");
/** P 상수 한 줄(지문에 인쇄된 값). */
export const paramsLine = (js: string) => js.match(/^const P = \{.*\};$/m)?.[0] ?? "const P = {};";

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** 지문·질문이 자료를 가리키는가("table", "graph", "scatterplot", "figure", "plot", "shown"). */
export const mentionsFigure = (text: string) => /\b(tables?|graphs?|scatterplots?|scatter plots?|figures?|plots?|shown|diagrams?|charts?)\b/i.test(text);

/** figure 가 있는 인스턴스의 자료 결합 검사(숫자형·서술형). */
export function checkFigureBinding(inst: Instance): string[] {
  const issues: string[] = [];
  const fig = inst.figure as { type?: string; choices?: unknown[] } | null | undefined;
  if (!fig) return issues;
  const text = `${inst.stimulus} ${inst.question}`;
  if (!mentionsFigure(text)) issues.push("자료가 있는데 지문·질문이 자료를 가리키지 않음(\"the table/graph shown\")");
  if (fig.type === "figure_choice") {
    const ch = embeddedChoices(inst.verificationJs);
    if (ch === undefined) issues.push("verification_js 에 const CHOICES = [...] 없음");
    else if (!sameJson(ch, fig.choices)) issues.push("verification_js 의 CHOICES 가 Instance.figure.choices 와 다름(검증이 인쇄된 선택지를 풀지 않음)");
  } else {
    const f = embeddedFigure(inst.verificationJs);
    if (f === undefined) issues.push("verification_js 에 const FIGURE = {...} 없음");
    else if (!sameJson(f, inst.figure)) issues.push("verification_js 의 FIGURE 가 Instance.figure 와 다름(검증이 인쇄된 자료를 풀지 않음)");
  }
  // 자료 의존: 자료를 가리면 풀리지 않아야 한다.
  try {
    const r = runJs(withoutFigure(inst.verificationJs));
    const sameAsAnswer = inst.answerKind === "index" ? r === inst.correctIndex : typeof r === "number" && Number.isFinite(r);
    if (sameAsAnswer) issues.push("자료 의존 검사 실패: FIGURE 를 가려도 verification_js 가 답을 냄(자료가 장식이거나 값이 지문에 있음)");
  } catch { /* 던지면 자료 없이는 못 푼다 — 정상 */ }
  return issues;
}

const DATA_KEYS = new Set(["cells", "points", "values", "rows", "slope", "intercept", "dots", "bins", "count", "series", "through", "at", "params", "min", "q1", "median", "q3", "max", "sides"]);
export type TamperMode = "add" | "scale" | "neg" | "flipy" | "scramble" | "drop" | "swap" | "cell" | "line" | "label" | "label_last";
export const TAMPER_MODES: TamperMode[] = ["add", "scale", "neg", "flipy", "scramble", "drop", "swap", "cell", "line", "label", "label_last"];
const isPair = (p: unknown): p is [number, number] => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === "number");
/**
 * 돌연변이: 자료 수치(표 칸·점 좌표·계열 값·추세선)를 변조한다. 축·눈금 값은 건드리지 않는다.
 *  add(+3)·scale(×2)·neg(부호 반전)는 값의 크기를 바꾸고, 평행이동·배율에 불변인 통계(상관계수)를 겨냥해
 *  flipy(점의 y 만 부호 반전)·scramble(y 를 고정 순열로 섞음)·drop(첫 점 삭제: 개수가 바뀜)·swap(두 자료 Plot A/B 의 자리 교환, 선택지 그림 순서 뒤집기: 비교형 문항의 정답이 뒤바뀜)을 둔다. 한 모드라도 검출하면 변조가 잡힌 것이다.
 */
export function tamperFigure(fig: unknown, mode: TamperMode = "add"): unknown {
  const f = (n: number) => (mode === "add" ? n + 3 : mode === "scale" ? n * 2 : mode === "neg" ? -n - 1 : n);
  const walk = (v: unknown, inData: boolean, key = ""): unknown => {
    if (key === "points" && Array.isArray(v) && v.length && v.every(isPair)) {
      const pts = v as [number, number][]; const n = pts.length;
      if (mode === "flipy") return pts.map(([x, y]) => [x, -y - 1]);
      if (mode === "scramble") return pts.map(([x], i) => [x, pts[(i * 7 + 3) % n][1]]);
      if (mode === "drop") return pts.slice(1);
    }
    if (typeof v === "number") return inData ? f(v) : v;
    if (Array.isArray(v)) return v.map((x) => walk(x, inData, key));
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x, inData || DATA_KEYS.has(k), k)]));
    return v;
  };
  if (mode === "cell") {
    // 표의 칸 하나만 +1(마지막 행의 마지막 숫자 칸 / 이원표 첫 칸) — 평행이동·배율에 불변인 값(일차 관계의 기울기 등)을 겨냥한다.
    const o = fig as { kind?: string; rows?: unknown[][]; cells?: number[][]; choices?: unknown[]; figures?: { spec: unknown }[] } | null;
    if (o && Array.isArray(o.rows)) { const rows = o.rows.map((r) => [...r]); for (let i = rows.length - 1; i >= 0; i--) { const j = rows[i].map((c) => typeof c === "number").lastIndexOf(true); if (j > 0) { rows[i][j] = (rows[i][j] as number) + 1; return { ...o, rows }; } } return fig; }
    if (o && Array.isArray(o.cells)) { const cells = o.cells.map((r) => [...r]); cells[0][0] += 1; return { ...o, cells }; }
    // 자료 그래프: 점도표 마지막 값의 점 +1 · 히스토그램 마지막 구간 도수 +1 · 막대(첫 계열) 마지막 값 +1 · 상자그림 첫 상자의 최댓값 +1 — 평행이동·배율에 불변인 통계(범위·중앙값 위치 등)도 바꾼다.
    const g = fig as { dots?: { count: number }[]; bins?: { count: number }[]; series?: { values: number[] }[]; boxes?: { max: number }[] } | null;
    if (g && Array.isArray(g.dots) && g.dots.length) return { ...g, dots: g.dots.map((d, i) => (i === g.dots!.length - 1 ? { ...d, count: d.count + 1 } : d)) };
    if (g && Array.isArray(g.bins) && g.bins.length) return { ...g, bins: g.bins.map((d, i) => (i === g.bins!.length - 1 ? { ...d, count: d.count + 1 } : d)) };
    if (g && Array.isArray(g.series) && g.series.length) return { ...g, series: g.series.map((se, si) => (si === 0 ? { ...se, values: se.values.map((v, i) => (i === se.values.length - 1 ? v + 1 : v)) } : se)) };
    if (g && Array.isArray(g.boxes) && g.boxes.length) return { ...g, boxes: g.boxes.map((b, i) => (i === 0 ? { ...b, max: b.max + 1 } : b)) };
    if (o && Array.isArray(o.choices)) return { ...o, choices: o.choices.map((c, i) => (i === 0 ? tamperFigure(c, "cell") : c)) };
    if (o && Array.isArray(o.figures)) return { ...o, figures: o.figures.map((f, i) => (i === 0 ? { ...f, spec: tamperFigure(f.spec, "cell") } : f)) };
    return fig;
  }
  if (mode === "line") {
    // 좌표평면: 첫 직선(line)의 둘째 통과점 y 를 +1 — 두 점이 한 직선을 정하므로 평행이동·배율에 불변인 값(기울기·교점 x 의 차 등)도 바뀐다. 선택지·복수 자료는 첫 자식만.
    const shift = (o: { objects?: Record<string, unknown>[] }) => {
      if (!o || !Array.isArray(o.objects)) return null; const li = o.objects.findIndex((q) => q.kind === "line" && Array.isArray(q.through)); if (li < 0) return null;
      const ln = o.objects[li] as { through: [number, number][] }; const old = ln.through[1]; if (!isPair(old)) return null;
      return { ...o, objects: o.objects.map((q, i) => (i === li ? { ...q, through: [ln.through[0], [old[0], old[1] + 1]] } : q)) };
    };
    const o = fig as { objects?: Record<string, unknown>[]; choices?: unknown[]; figures?: { spec: unknown }[] } | null;
    const direct = o ? shift(o as { objects?: Record<string, unknown>[] }) : null; if (direct) return direct;
    if (o && Array.isArray(o.choices)) return { ...o, choices: o.choices.map((c, i) => (i === 0 ? tamperFigure(c, "line") : c)) };
    if (o && Array.isArray(o.figures)) return { ...o, figures: o.figures.map((f, i) => (i === 0 ? { ...f, spec: tamperFigure(f.spec, "line") } : f)) };
    return fig;
  }
  if (mode === "label" || mode === "label_last") {
    // 도형: 숫자가 든 첫(label)·마지막(label_last) 'label'(각·변 라벨)의 마지막 정수를 +1 — 라벨 속 값이 답을 정하는 도형 자료(삼각형·원·다각형·입체)의 변조.
    // 둘을 모두 두는 까닭: 두 직각변을 맞바꿔도 같은 답(둘레·직각변의 합)이 나오는 장면이 있어 첫 라벨만 바꾸면 못 잡는다.
    const LABEL_KEYS = new Set(["label", "width", "height", "side", "radius", "diameter", "edge", "length", "slant"]); // 복합 도형(composite)의 치수 문자열도 라벨처럼 변조한다
    const hasDigit = (v: unknown, key = ""): number => (typeof v === "string" ? (LABEL_KEYS.has(key) && /\d/.test(v) ? 1 : 0) : Array.isArray(v) ? v.reduce((n: number, x) => n + hasDigit(x, key), 0) : v && typeof v === "object" ? Object.entries(v as Record<string, unknown>).reduce((n, [k, x]) => n + hasDigit(x, k), 0) : 0);
    const total = hasDigit(fig); if (!total) return fig; const target = mode === "label" ? 1 : total; let seen = 0;
    const walkL = (v: unknown, key = ""): unknown => {
      if (typeof v === "string") { if (LABEL_KEYS.has(key) && /\d/.test(v)) { seen++; if (seen === target) { const idx = [...v.matchAll(/\d+/g)].pop()!; return `${v.slice(0, idx.index)}${Number(idx[0]) + 1}${v.slice((idx.index ?? 0) + idx[0].length)}`; } } return v; }
      if (Array.isArray(v)) return v.map((x) => walkL(x, key));
      if (v && typeof v === "object") return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walkL(x, k)]));
      return v;
    };
    return walkL(fig);
  }
  if (mode === "swap") {
    const o = fig as { figures?: { spec: unknown }[]; choices?: unknown[] } | null;
    if (o && Array.isArray(o.figures) && o.figures.length === 2) return { ...o, figures: [{ ...o.figures[0], spec: o.figures[1].spec }, { ...o.figures[1], spec: o.figures[0].spec }] };
    if (o && Array.isArray(o.choices)) return { ...o, choices: [...o.choices].reverse() };
    return fig;
  }
  return walk(fig, false);
}

/** 선택지형 일반 검증기 — verify 가 `answerKind:"index"` + figure_choice 인스턴스에 적용한다. */
export function checkChoiceInstance(inst: Instance, verifiedIndex: number | null): string[] {
  const issues: string[] = [];
  const fig = inst.figure as { type?: string; choices?: unknown[] } | null | undefined;
  const d = inst.choice;
  if (!fig || fig.type !== "figure_choice" || !Array.isArray(fig.choices)) return ["선택지형인데 figure 가 figure_choice 가 아님"];
  const n = fig.choices.length;
  if (n !== 4) issues.push(`선택지 그림 ${n}개(4개여야 함)`);
  if (inst.options.join("") !== ["A", "B", "C", "D"].slice(0, n).join("")) issues.push("선택지형 options 는 A~D 자리표여야 함");
  if (new Set(fig.choices.map((c) => JSON.stringify(c))).size !== n) issues.push("선택지 그림 중 같은 그림이 있음");
  if (!d) return [...issues, "선택지형인데 오답 규칙 선언(choice)이 없음"];
  if (d.rules.length !== n) issues.push("오답 규칙 선언 수가 선택지 수와 다름");
  if (d.rules[inst.correctIndex] !== "correct") issues.push("정답 자리의 규칙이 'correct' 가 아님");
  const wrong = d.rules.filter((_, i) => i !== inst.correctIndex);
  if (wrong.some((r) => !r || r === "correct")) issues.push("오답 규칙 id 누락");
  if (new Set(wrong).size !== wrong.length) issues.push(`한 문항에서 같은 오답 규칙이 두 번 쓰임: ${wrong.join(", ")}`);
  if (verifiedIndex === null) return issues;
  // 오답 3개가 선언한 규칙으로 진단되는가
  try {
    const js = `${paramsLine(inst.verificationJs)}\nconst CHOICES = ${JSON.stringify(fig.choices)};\nconst OK = CHOICES[${verifiedIndex}];\nconst diag = (c, ok, P) => { ${d.diagnoseJs} };\nreturn CHOICES.map((c, i) => (i === ${verifiedIndex} ? "correct" : diag(c, OK, P)));`;
    const got = runJs(js) as unknown[];
    if (!Array.isArray(got) || got.length !== n) issues.push("오답 진단 결과 형식 오류");
    else got.forEach((g, i) => { if (g !== d.rules[i]) issues.push(`선택지 ${"ABCD"[i]}: 선언한 규칙 '${d.rules[i]}' 인데 진단은 '${String(g)}'`); });
  } catch (e) { issues.push(`오답 진단 실행 실패: ${(e as Error).message}`); }
  return issues;
}
