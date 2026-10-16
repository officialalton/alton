// 시험 중 스크래치 화이트보드(MockExamWhiteboard) 보드 크기 기준(2026-10-13, 오너 요청: FRQ 패드처럼 키울 수 있게).
// 논리 좌표계는 폭 640 고정 × 높이 가변. 저장된 선분(problem_note_strokes, w=640 기준)은 크기를 바꿔도 좌표가 변하지 않는다 —
// 영역만 늘고, 줄일 때는 그린 곳(maxY+10) 아래까지만 줄어든다. 상한은 마이그레이션 590 과 같은 값(바꾸면 둘 다).
import type { StrokeSegment } from "@/lib/problem-notes-actions";

export const WB_WIDTH = 640;
export const WB_MIN_H = 480; // 기존 고정 크기 = Small(기본)
export const WB_MAX_H = 1600;
export const WB_H_PRESETS = [
  { label: "Small", h: 480 },
  { label: "Medium", h: 720 },
  { label: "Large", h: 1000 },
  { label: "Extra large", h: 1400 },
] as const;
export const WB_MAX_SEGMENTS = 20000; // 선분 수 상한(약 1.5MB)
export const WB_MAX_BYTES = 2_000_000; // strokes JSON 상한
export const WB_TOO_LARGE = "This drawing is too large to save. Erase or clear some strokes.";

export function strokesMaxY(strokes: StrokeSegment[]): number {
  let m = 0;
  for (const s of strokes) {
    const k = s.w ? WB_WIDTH / s.w : 1;
    m = Math.max(m, s.y0 * k, s.y1 * k);
  }
  return m;
}

export function clampWbHeight(h: number, strokes: StrokeSegment[] = []): number {
  const min = Math.min(WB_MAX_H, Math.max(WB_MIN_H, Math.ceil(strokesMaxY(strokes)) + 10));
  return Math.max(min, Math.min(WB_MAX_H, Math.round(Number.isFinite(h) ? h : WB_MIN_H)));
}

/** 저장 전 클라이언트 검사. 문제 있으면 영어 문구, 없으면 null. */
export function wbSizeProblem(strokes: StrokeSegment[]): string | null {
  if (strokes.length > WB_MAX_SEGMENTS) return WB_TOO_LARGE;
  if (strokes.length > 5000 && JSON.stringify(strokes).length > WB_MAX_BYTES) return WB_TOO_LARGE;
  return null;
}
