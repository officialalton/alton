"use server";

// 모의고사·과제·문제 풀이 중 필기(2026-09-21) — 실시간 공유가 아니라 혼자 쓰는
// "문항당 필기 스냅샷 하나"다. 저장은 문항을 벗어날 때(응시 화면의 문항 이동 flush와
// 같은 타이밍)나 필기 도구를 끌 때 호출한다.

import { requireUser } from "@/lib/auth";

export type ProblemNoteContext = "mock_exam" | "homework" | "problem";
export type StrokeSegment = { x0: number; y0: number; x1: number; y1: number; color: string; w?: number };

export async function saveProblemNoteStrokesAction(
  context: ProblemNoteContext,
  targetId: string,
  itemId: string,
  strokes: StrokeSegment[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("save_problem_note_strokes", {
    p_context: context,
    p_target_id: targetId,
    p_item_id: itemId,
    p_strokes: strokes,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** authorId를 생략하면 본인 필기, 넘기면(교사·관리자·보호자) 그 학생의 필기를 읽기 전용으로 본다. */
export async function loadProblemNoteStrokesAction(
  context: ProblemNoteContext,
  targetId: string,
  itemId: string,
  authorId?: string,
): Promise<StrokeSegment[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("load_problem_note_strokes", {
    p_context: context,
    p_target_id: targetId,
    p_item_id: itemId,
    p_author_id: authorId ?? null,
  });
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? (data as StrokeSegment[]) : [];
}
