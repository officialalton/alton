// 표준 렌더링 엔진 — B형 묶음(figure_bundle): 지문에 쓰이는 그림(stem) 하나와 선택지 그림 4개(choices: figure_choice)가 한 문항에 함께 있다.
// 두 부분은 각자의 렌더러·검사를 그대로 쓴다(stem 은 일반 그림, choices 는 figure_choice 규칙). 정답은 stem 과 choices 의 관계(예: stem 의 닮은 도형·이동한 상)로 정해진다.

import { dedupe, esc, type FigureIssue } from "./_layout";
import { lintFigureChoice, renderFigureChoice, validateFigureChoice, type ChildCheck, type ChildRender, type ChildValidate, type FigureChoiceSpec } from "./figure-choice";

export type FigureBundleSpec = { type: "figure_bundle"; stem: unknown; choices: FigureChoiceSpec; stemCaption?: string };
const NOT_STEM = ["figure_choice", "figure_set", "figure_bundle", "image"];

export function validateFigureBundle(input: unknown, validateChild: ChildValidate): { ok: true; spec: FigureBundleSpec } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "그림 데이터가 객체가 아닙니다." };
  const s = { ...(input as Record<string, unknown>) };
  for (const k of ["options", "correct_index", "correctIndex"]) delete s[k];
  if (s.type !== "figure_bundle") return { ok: false, error: "type 이 figure_bundle 이 아닙니다." };
  const stem = s.stem as Record<string, unknown> | null;
  if (!stem || typeof stem !== "object" || NOT_STEM.includes(String(stem.type))) return { ok: false, error: "stem 은 일반 그림(표준 템플릿) 하나여야 합니다." };
  const v = validateChild(stem); if (!v.ok) return { ok: false, error: `stem: ${v.error}` };
  const c = validateFigureChoice(s.choices, validateChild); if (!c.ok) return { ok: false, error: `choices: ${c.error}` };
  if (s.stemCaption !== undefined && (typeof s.stemCaption !== "string" || s.stemCaption.length > 60)) return { ok: false, error: "stemCaption 은 60자 이내입니다." };
  return { ok: true, spec: { ...(s as unknown as FigureBundleSpec), choices: c.spec } };
}

export function lintFigureBundle(spec: FigureBundleSpec, options: string[] | null | undefined, childCheck: ChildCheck, ctx: { passage: string; correctIndex?: number | null }): FigureIssue[] {
  const issues: FigureIssue[] = [];
  const r = childCheck(spec.stem, ctx.passage);
  for (const i of r.issues) issues.push({ code: i.code, message: `기준 그림: ${i.message}` });
  issues.push(...lintFigureChoice(spec.choices, options, childCheck, ctx));
  return dedupe(issues);
}

export function renderFigureBundle(spec: FigureBundleSpec, renderChild: ChildRender, childAlt: (c: unknown) => string | undefined): { markup: string; alt: string } {
  const ch = renderFigureChoice(spec.choices, renderChild);
  const stem = renderChild(spec.stem).replace(/style="max-width:100%;height:auto"/, 'style="width:100%;max-width:420px;height:auto;display:block"');
  const markup = `<div class="figure-bundle" data-testid="figure-bundle" style="display:flex;flex-direction:column;gap:14px;max-width:640px"><figure style="margin:0"><figcaption style="font-weight:700;font-size:13px;margin:0 0 4px;font-family:Georgia, serif">${esc(spec.stemCaption ?? "Given figure")}</figcaption>${stem}</figure>${ch.markup}</div>`;
  return { markup, alt: `기준 그림: ${childAlt(spec.stem) ?? ""} / ${ch.alt}` };
}
