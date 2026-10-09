"use server";

import { loadStaffViewBoardCardsAction } from "@/app/components/staff-student-view-actions";
import type { BoardCard } from "@/lib/board/types";

// 학부모 홈 보드/오버뷰 — 역할 공통 열람 로더(본인 자녀 검사 + 읽기 전용, 열람 기록 없음)를
// 그대로 쓴다. ParentShell 고유 레이아웃(타임라인·예정 수업)은 그대로 두고 데이터 경로만 통합.
export async function loadChildBoardCardsAction(studentId: string): Promise<BoardCard[]> {
  const r = await loadStaffViewBoardCardsAction(studentId);
  if (!r.ok) throw new Error(r.error);
  return r.cards;
}
