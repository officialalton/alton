"use client";

import { useEffect, useRef, useState } from "react";
import { loadProblemNoteStrokesAction, type ProblemNoteContext, type StrokeSegment } from "@/lib/problem-notes-actions";
import { CANVAS_HEIGHT, drawAll } from "./ProblemNoteCanvas";

/** 2026-10-02(오너 확정) — 화이트보드는 "풀 때 쓰는 풀이용"이다. 결과·오답 풀이 화면에서는 제출 시점에 남은
 * 필기 스냅샷을 읽기 전용으로 보여주기만 한다(그리기·지우기·저장 없음). 필기가 없는 문항은 영역 자체를 숨긴다. */
export default function ProblemNoteSnapshot({
  context,
  targetId,
  itemId,
  authorId,
  label = "My scratch work (submitted)",
}: {
  context: ProblemNoteContext;
  targetId: string;
  itemId: string;
  /** 남의(학생의) 필기를 볼 때만. 생략하면 본인 필기. */
  authorId?: string;
  label?: string;
}) {
  const [strokes, setStrokes] = useState<StrokeSegment[] | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadProblemNoteStrokesAction(context, targetId, itemId, authorId)
      .then((rows) => {
        if (!cancelled) setStrokes(rows);
      })
      .catch(() => {
        if (!cancelled) setStrokes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [context, targetId, itemId, authorId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext?.("2d");
    if (!canvas || !ctx || !strokes) return;
    drawAll(ctx, strokes, canvas.width);
  }, [strokes]);

  if (!strokes || strokes.length === 0) return null;
  // 풀이용 화이트보드는 기본 캔버스보다 길게 쓸 수 있으므로, 획이 잘리지 않게 높이를 늘린다.
  const maxY = Math.max(...strokes.map((s) => Math.max(s.y0, s.y1) * (s.w ? 640 / s.w : 1)));
  const height = Math.max(CANVAS_HEIGHT, Math.ceil(maxY) + 12);
  return (
    <details open className="mt-3 rounded-lg border border-grey-200 bg-white" data-testid="problem-note-snapshot">
      <summary className="cursor-pointer px-3 py-2 text-[12px] font-bold text-grey-600">{label}</summary>
      <canvas
        ref={canvasRef}
        width={640}
        height={height}
        className="w-full"
        style={{ aspectRatio: `640 / ${height}` }}
        aria-label={label}
        role="img"
      />
    </details>
  );
}
