// 클라이언트(관리자 편집기)에서 같은 검증을 즉시 보여주기 위한 얇은 래퍼 — check.ts 는 node 전용 모듈을 쓰지 않으므로 그대로 재사용.
import { checkFigure } from "./check";
import type { FigureIssue } from "./templates/_layout";

export function checkFigureClient(spec: unknown, passage: string, options?: string[] | null, correctIndex?: number | null): FigureIssue[] {
  return checkFigure(spec, passage, options, correctIndex).issues;
}
