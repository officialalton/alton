"use client";

import { useState } from "react";
import MockExamWhiteboard from "@/app/student/mock-exam/[attemptId]/MockExamWhiteboard";
import type { ProblemNoteContext } from "@/lib/problem-notes-actions";

export const CANVAS_HEIGHT = 220; // ProblemNoteSnapshot 이 쓰는 기본(레거시) 높이 — 저장 필기 표시용
export { drawAll } from "@/lib/problem-note-draw";

/** 과제·문제 풀이 중 화이트보드. 2026-10-14: 레거시 640×220 전용 캔버스 대신 모의고사와 같은 공유 보드(MockExamWhiteboard, 인라인)를 연다.
 * 저장 형식(problem_note_strokes 선분, w=640 기준)과 기존 저장 필기는 그대로 — 읽기 전용 경로(authorId·readOnly)도 같은 RPC 권한을 쓴다.
 * 세션뷰의 실시간 공유 필기(PdfPageAnnotationLayer)와는 별개다. */
export default function ProblemNoteCanvas({
  context,
  targetId,
  itemId,
  authorId,
  readOnly = false,
}: {
  context: ProblemNoteContext;
  targetId: string;
  itemId: string;
  authorId?: string;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-pressed={open}
        className={`rounded border px-2.5 py-1 text-[11.5px] font-bold ${open ? "border-ink bg-ink text-white" : "border-grey-300 text-grey-600"}`}
      >
        {readOnly ? (open ? "Hide whiteboard" : "View whiteboard") : open ? "Close whiteboard" : "📝 Whiteboard"}
      </button>
      {open && <MockExamWhiteboard inline context={context} attemptId={targetId} itemId={itemId} authorId={authorId} readOnly={readOnly} />}
    </div>
  );
}
