// 표준 렌더링 엔진 — 검증 계층(docs/2026-09-14-standard-rendering-engine-design.md 3절).
// 초안 저장 시 서버가 돌리고 결과(render_check)를 버전에 남긴다. 공개 게이트는 ok=true + 그림 해시 일치를 요구한다.

import { createHash } from "node:crypto";
import { LEGACY_FIGURE_TYPES, validateFigureSpec } from "./spec";
import { lintParallelTransversalAgainstText, renderParallelTransversal, type FigureIssue } from "./templates/parallel-transversal";
import { lintTriangleAgainstText, renderTriangle } from "./templates/triangle";
import { lintPlaneAgainstText, renderPlane } from "./templates/coordinate-plane";

export const RENDERER_VERSION = "std-1";

export type RenderCheck = {
  ok: boolean;
  renderer: string;
  checkedAt: string;
  issues: FigureIssue[];
  alt?: string;
};

/** Postgres `md5(figure::text)` 와 같게 — jsonb 정규화 텍스트는 서버에서 만들므로 여기서는 참고용. */
export function hashFigure(figure: unknown): string {
  return createHash("md5").update(JSON.stringify(figure)).digest("hex");
}

/** 지문이 그림을 요구하는가("as shown", "in the figure", "the graph", "in the diagram"). */
export function passageRequiresFigure(passage: string): boolean {
  return /\b(as shown|in the figure|the figure|the diagram|shown below|shown above|the graph (?:above|below|shown))\b/i.test(passage);
}

export function checkFigure(figure: unknown, passage: string): RenderCheck {
  const checkedAt = new Date().toISOString();
  const issues: FigureIssue[] = [];
  if (figure === null || figure === undefined) {
    if (passageRequiresFigure(passage)) issues.push({ code: "figure_required", message: "지문이 그림을 가리키는데(\"as shown\", \"figure\") 그림이 없습니다." });
    return { ok: issues.length === 0, renderer: RENDERER_VERSION, checkedAt, issues };
  }
  const v = validateFigureSpec(figure);
  if (!v.ok) return { ok: false, renderer: RENDERER_VERSION, checkedAt, issues: [{ code: "schema", message: v.error }] };
  const spec = v.spec;
  if (LEGACY_FIGURE_TYPES.includes(spec.type)) {
    return {
      ok: false, renderer: RENDERER_VERSION, checkedAt,
      issues: [{ code: "legacy", message: `옛 형식 그림(${spec.type})은 지원이 끝났습니다 — 재생성 필요. 표준 템플릿(평행선·삼각형·좌표평면)으로 다시 만드세요.` }],
    };
  }
  if (spec.type === "image") {
    if (!spec.alt || !spec.alt.trim()) issues.push({ code: "alt_required", message: "올린 그림에는 대체 설명(alt)이 필요합니다 — 그림에 무엇이 있는지 한 문장." });
    return { ok: issues.length === 0, renderer: RENDERER_VERSION, checkedAt, issues, alt: spec.alt };
  }
  if (spec.type === "parallel_transversal") {
    const r = renderParallelTransversal(spec);
    issues.push(...r.issues, ...lintParallelTransversalAgainstText(spec, passage));
    return { ok: issues.length === 0, renderer: RENDERER_VERSION, checkedAt, issues, alt: r.alt };
  }
  if (spec.type === "triangle") {
    const r = renderTriangle(spec);
    issues.push(...r.issues, ...lintTriangleAgainstText(spec, passage));
    return { ok: issues.length === 0, renderer: RENDERER_VERSION, checkedAt, issues, alt: r.alt };
  }
  if (spec.type === "plane") {
    const r = renderPlane(spec);
    issues.push(...r.issues, ...lintPlaneAgainstText(spec, passage));
    return { ok: issues.length === 0, renderer: RENDERER_VERSION, checkedAt, issues, alt: r.alt };
  }
  return { ok: false, renderer: RENDERER_VERSION, checkedAt, issues: [{ code: "schema", message: `지원하지 않는 그림 type: ${(spec as { type: string }).type}` }] };
}
