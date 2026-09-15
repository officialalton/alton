// 표준 렌더링 엔진 — 그래프/도형 선택지(figure_choice)와 복수 자료(figure_set)
//
// figure_choice: 선택지 4개가 그림이다. 같은 축·눈금·크기·여백으로 나란히 그리고, 정답을 암시하는 보조 점·라벨·색은 거부한다.
//   정답 인덱스는 problem_versions.correct_index 에 따로 있고, 선택지 i ↔ 그림 i 가 같은 자리다(순서를 바꾸면 둘을 함께 바꾼다).
// figure_set: 그림 A/B 처럼 자료가 둘 이상. 자료마다 id 공간이 따로고, 지문은 "Figure A" 로 어느 자료인지 가리킨다.

import { esc, type FigureIssue } from "./_layout";
import { dedupe } from "./_layout";

export type ChildValidate = (input: unknown) => { ok: true; spec: unknown } | { ok: false; error: string };
export type ChildRender = (spec: unknown) => string;
export type ChildCheck = (spec: unknown, passage: string) => { issues: FigureIssue[]; alt?: string };

export type FigureChoiceSpec = { type: "figure_choice"; choices: unknown[]; notToScale?: boolean };
export type FigureSetSpec = { type: "figure_set"; figures: { id: string; title?: string; spec: unknown }[] };

const LETTERS = ["A", "B", "C", "D", "E"];
const CHILD_TYPES_ALLOWED = ["plane", "parallel_transversal", "triangle", "circle", "polygon", "solid", "data"];

/** 지문의 일차식과 같은 그래프가 든 선택지 번호(정확히 하나일 때). */
export function findEquationChoice(spec: FigureChoiceSpec, passage: string): number | null {
  const text = passage.replace(/\$/g, "").replace(/−/g, "-");
  const lin = text.match(/y\s*=\s*(-?\d+(?:\.\d+)?(?:\/\d+)?)?\s*x\s*(?:([+-])\s*(\d+(?:\.\d+)?(?:\/\d+)?))?(?![\d.x²^])/);
  if (!lin) return null;
  const num = (t: string) => (t.includes("/") ? t.split("/").map(Number).reduce((a, b) => a / b) : Number(t));
  const m = lin[1] === undefined ? 1 : lin[1] === "-" ? -1 : num(lin[1]);
  const b = lin[2] ? (lin[2] === "-" ? -1 : 1) * num(lin[3]) : 0;
  const hits = spec.choices.map((c, i) => (((c as { objects?: Record<string, unknown>[] }).objects ?? []).some((o) => (o.kind === "line" && Math.abs(Number(o.slope) - m) < 1e-6 && Math.abs(Number(o.intercept) - b) < 1e-6) || (o.kind === "function" && o.fn === "linear" && Array.isArray(o.params) && Math.abs(Number(o.params[0]) - m) < 1e-6 && Math.abs(Number(o.params[1]) - b) < 1e-6)) ? i : -1)).filter((i) => i >= 0);
  return hits.length === 1 ? hits[0] : null;
}

/** 정답 그래프를 correct_index 자리로 옮긴다(선택지 글은 'A~D' 같은 자리표라 그림만 옮겨도 뜻이 같다). */
export function placeCorrectChoice(spec: FigureChoiceSpec, passage: string, correctIndex: number): FigureChoiceSpec {
  const at = findEquationChoice(spec, passage);
  if (at === null || at === correctIndex || correctIndex < 0 || correctIndex >= spec.choices.length) return spec;
  const choices = [...spec.choices];
  [choices[at], choices[correctIndex]] = [choices[correctIndex], choices[at]];
  return { ...spec, choices };
}

export function validateFigureChoice(input: unknown, validateChild: ChildValidate): { ok: true; spec: FigureChoiceSpec } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "그림 데이터가 객체가 아닙니다." };
  const s = { ...(input as Record<string, unknown>) };
  for (const k of ["options", "correct_index", "correctIndex"]) delete s[k]; // 그림 데이터에 답을 싣지 않는다
  if (s.type !== "figure_choice") return { ok: false, error: "type 이 figure_choice 가 아닙니다." };
  if (!Array.isArray(s.choices) || s.choices.length < 2 || s.choices.length > 5) return { ok: false, error: "figure_choice 는 choices 2~5개(보통 4개) 가 필요합니다." };
  let type: string | null = null;
  for (let i = 0; i < s.choices.length; i++) {
    const c = s.choices[i] as Record<string, unknown> | null;
    if (!c || typeof c !== "object") return { ok: false, error: `선택지 ${LETTERS[i]} 의 그림이 객체가 아닙니다.` };
    if (!CHILD_TYPES_ALLOWED.includes(String(c.type))) return { ok: false, error: `선택지 ${LETTERS[i]} 의 그림 type '${String(c.type)}' 은 선택지로 쓸 수 없습니다(${CHILD_TYPES_ALLOWED.join("|")}).` };
    if (type && c.type !== type) return { ok: false, error: `선택지 그림은 모두 같은 type 이어야 합니다(${type} vs ${String(c.type)}).` };
    type = String(c.type);
    const v = validateChild(c);
    if (!v.ok) return { ok: false, error: `선택지 ${LETTERS[i]}: ${v.error}` };
  }
  return { ok: true, spec: s as unknown as FigureChoiceSpec };
}

/** 정답 암시·불공정 검사: 같은 축, 같은 객체 수, 라벨·이름 붙은 점 없음. */
export function lintFigureChoice(spec: FigureChoiceSpec, options: string[] | null | undefined, childCheck: ChildCheck, ctx?: { passage?: string; correctIndex?: number | null }): FigureIssue[] {
  const issues: FigureIssue[] = [];
  const n = spec.choices.length;
  // 정답 그래프 일치: 지문의 y = mx + b (또는 y = ax² + bx + c) 는 정답 자리의 그림에만 있어야 한다.
  if (ctx?.passage && ctx.correctIndex !== null && ctx.correctIndex !== undefined && (spec.choices[0] as Record<string, unknown>).type === "plane") {
    const text = ctx.passage.replace(/\$/g, "").replace(/−/g, "-");
    const lin = text.match(/y\s*=\s*(-?\d+(?:\.\d+)?(?:\/\d+)?)?\s*x\s*(?:([+-])\s*(\d+(?:\.\d+)?(?:\/\d+)?))?(?![\d.x²^])/);
    const num = (t: string) => (t.includes("/") ? t.split("/").map(Number).reduce((a, b) => a / b) : Number(t));
    if (lin) {
      const m = lin[1] === undefined ? 1 : lin[1] === "-" ? -1 : num(lin[1]);
      const b = lin[2] ? (lin[2] === "-" ? -1 : 1) * num(lin[3]) : 0;
      const has = spec.choices.map((c) => ((c as { objects?: Record<string, unknown>[] }).objects ?? []).some((o) => (o.kind === "line" && Math.abs(Number(o.slope) - m) < 1e-6 && Math.abs(Number(o.intercept) - b) < 1e-6) || (o.kind === "function" && o.fn === "linear" && Array.isArray(o.params) && Math.abs(Number(o.params[0]) - m) < 1e-6 && Math.abs(Number(o.params[1]) - b) < 1e-6)));
      if (!has[ctx.correctIndex]) issues.push({ code: "answer_mismatch", message: `정답 자리 ${LETTERS[ctx.correctIndex]} 의 그림에 지문의 식 y = ${lin[1] ?? ""}x ${lin[2] ?? "+"} ${lin[3] ?? "0"} 이 없습니다 — 정답 인덱스와 그림 자리가 어긋났습니다.` });
      has.forEach((h, i) => { if (h && i !== ctx.correctIndex) issues.push({ code: "answer_mismatch", message: `선택지 ${LETTERS[i]} 에도 정답 식의 그래프가 있습니다 — 정답이 둘이 됩니다.` }); });
    }
  }
  if (options && options.length !== n) issues.push({ code: "choice_count", message: `선택지 글 ${options.length}개와 선택지 그림 ${n}개의 수가 다릅니다.` });
  const first = spec.choices[0] as Record<string, unknown>;
  for (let i = 0; i < n; i++) {
    const c = spec.choices[i] as Record<string, unknown>;
    if (c.type === "plane") {
      if (JSON.stringify(c.axes) !== JSON.stringify(first.axes)) issues.push({ code: "choice_bias", message: `선택지 ${LETTERS[i]} 의 축 범위·눈금이 선택지 A 와 다릅니다 — 모든 선택지는 같은 축을 씁니다.` });
      const objs = (c.objects as Record<string, unknown>[]) ?? [];
      if (objs.length !== ((first.objects as unknown[]) ?? []).length) issues.push({ code: "choice_bias", message: `선택지 ${LETTERS[i]} 의 객체 수(${objs.length})가 선택지 A(${(first.objects as unknown[]).length})와 다릅니다.` });
      for (const o of objs) {
        if (o.label) issues.push({ code: "choice_bias", message: `선택지 ${LETTERS[i]} 의 그래프에 라벨 '${String(o.label)}' 이 있습니다 — 선택지 그림에는 라벨을 두지 않습니다.` });
        if (o.kind === "point") issues.push({ code: "choice_bias", message: `선택지 ${LETTERS[i]} 에 점이 찍혀 있습니다 — 보조 점은 정답을 암시할 수 있어 두지 않습니다.` });
      }
    } else if (c.type === "data") {
      if (c.kind !== first.kind) issues.push({ code: "choice_bias", message: `선택지 ${LETTERS[i]} 의 자료 종류가 선택지 A 와 다릅니다.` });
    }
    const r = childCheck(c, "");
    for (const iss of r.issues) if (iss.code !== "ref_missing" && iss.code !== "ref_mismatch" && iss.code !== "wording") issues.push({ code: iss.code, message: `선택지 ${LETTERS[i]}: ${iss.message}` });
  }
  return dedupe(issues);
}

/** 2×2 격자(모바일은 1열로 내려감)에 같은 크기로 그린다. 글자 A~D 는 격자 밖 캡션. */
export function renderFigureChoice(spec: FigureChoiceSpec, renderChild: ChildRender): { markup: string; alt: string } {
  const cells = spec.choices.map((c, i) => {
    const inner = renderChild(c).replace(/<svg /, '<svg data-choice="' + LETTERS[i] + '" ').replace(/style="max-width:100%;height:auto"/, 'style="width:100%;height:auto;display:block"');
    return `<figure style="margin:0;border:1.5px solid #ddd;border-radius:10px;padding:8px 8px 4px;background:#fff"><figcaption style="font-weight:700;font-size:13px;margin:0 0 4px;font-family:Georgia, serif">${LETTERS[i]}</figcaption>${inner}</figure>`;
  });
  const markup = `<div class="figure-choice" data-testid="figure-choice" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;max-width:640px">${cells.join("")}</div>`;
  const alt = `그래프/도형 선택지 ${spec.choices.length}개(${LETTERS.slice(0, spec.choices.length).join(", ")}) — 같은 축·크기로 나란히.`;
  return { markup, alt };
}

export function validateFigureSet(input: unknown, validateChild: ChildValidate): { ok: true; spec: FigureSetSpec } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "그림 데이터가 객체가 아닙니다." };
  const s = input as Record<string, unknown>;
  if (s.type !== "figure_set") return { ok: false, error: "type 이 figure_set 이 아닙니다." };
  if (!Array.isArray(s.figures) || s.figures.length < 2 || s.figures.length > 3) return { ok: false, error: "figure_set 은 figures 2~3개가 필요합니다." };
  const ids = new Set<string>();
  for (const fg of s.figures as Record<string, unknown>[]) {
    if (!fg || typeof fg.id !== "string" || !/^[A-Z]$/.test(fg.id)) return { ok: false, error: "figures[].id 는 대문자 한 글자(A, B …)여야 합니다." };
    if (ids.has(fg.id)) return { ok: false, error: `자료 id '${fg.id}' 가 중복됩니다.` };
    ids.add(fg.id);
    if (fg.title !== undefined && (typeof fg.title !== "string" || fg.title.length > 40)) return { ok: false, error: "figures[].title 은 40자 이내입니다." };
    const c = fg.spec as Record<string, unknown> | null;
    if (!c || !CHILD_TYPES_ALLOWED.includes(String(c.type))) return { ok: false, error: `자료 ${fg.id} 의 spec type 이 지원 밖입니다.` };
    const v = validateChild(c);
    if (!v.ok) return { ok: false, error: `자료 ${fg.id}: ${v.error}` };
  }
  return { ok: true, spec: s as unknown as FigureSetSpec };
}

/** 자료별 검사 + 지문의 "Figure A"/"graph B"/"table A" 참조가 실제 id 인지. 각 자료의 지문 참조는 그 자료 문장에만 적용하기 어려워 전체 지문으로 본다(참조 누락은 자료 중 하나라도 맞으면 통과). */
export function lintFigureSet(spec: FigureSetSpec, passage: string, childCheck: ChildCheck): FigureIssue[] {
  const issues: FigureIssue[] = [];
  const ids = new Set(spec.figures.map((f) => f.id));
  for (const m of passage.matchAll(/\b(?:[Ff]igure|[Gg]raph|[Tt]able|[Dd]iagram)\s+([A-Z])\b/g)) if (!ids.has(m[1])) issues.push({ code: "ref_missing", message: `지문의 자료 '${m[1]}' 가 없습니다(자료 id: ${Array.from(ids).join(", ")}).` });
  const perFigure = spec.figures.map((f) => childCheck(f.spec, passage));
  // 렌더 문제(충돌·잘림·범위)는 자료마다 그대로 문제. 참조 문제는 모든 자료에서 같이 났을 때만(어느 자료에서든 맞으면 그 자료를 가리킨 것).
  perFigure.forEach((r, i) => { for (const iss of r.issues) if (!["ref_missing", "ref_mismatch"].includes(iss.code)) issues.push({ code: iss.code, message: `자료 ${spec.figures[i].id}: ${iss.message}` }); });
  const refMsgs = perFigure.map((r) => new Set(r.issues.filter((i) => ["ref_missing", "ref_mismatch"].includes(i.code)).map((i) => i.message)));
  if (refMsgs.length) for (const msg of refMsgs[0]) if (refMsgs.every((set) => set.has(msg))) issues.push({ code: "ref_mismatch", message: msg });
  return dedupe(issues);
}

export function renderFigureSet(spec: FigureSetSpec, renderChild: ChildRender, childAlt: (spec: unknown) => string | undefined): { markup: string; alt: string } {
  const cells = spec.figures.map((f) => `<figure style="margin:0;min-width:0"><figcaption style="font-weight:700;font-size:13px;margin:0 0 4px;font-family:Georgia, serif">${esc(f.title ?? `Figure ${f.id}`)}</figcaption>${renderChild(f.spec).replace(/style="max-width:100%;height:auto"/, 'style="width:100%;height:auto;display:block"')}</figure>`);
  const markup = `<div class="figure-set" data-testid="figure-set" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;max-width:720px">${cells.join("")}</div>`;
  const alt = spec.figures.map((f) => `${f.title ?? `Figure ${f.id}`}: ${childAlt(f.spec) ?? ""}`).join(" / ");
  return { markup, alt };
}
