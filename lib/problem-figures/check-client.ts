// 클라이언트(관리자 편집기)에서 같은 검증을 즉시 보여주기 위한 얇은 래퍼 — check.ts 는 node 전용 모듈을 쓰지 않으므로 그대로 재사용.
import { checkFigure } from "./check";
import type { FigureIssue } from "./templates/_layout";

export function checkFigureClient(spec: unknown, passage: string, options?: string[] | null, correctIndex?: number | null): FigureIssue[] {
  return checkFigure(spec, passage, options, correctIndex).issues;
}

import { figureAlt } from "./alt";
import { validateFigureSpec } from "./spec";
/** 대체 설명 — 정규화·검증을 통과한 spec 으로만 만든다(원문에 옛 표기가 남아 있어도 화면이 깨지지 않게, 2026-09-15). */
export function figureAltClient(spec: unknown): string | null {
  const v = validateFigureSpec(spec);
  if (!v.ok) return null;
  try {
    return figureAlt(v.spec) ?? null;
  } catch {
    return null;
  }
}
