"use client";

import { useEffect, useRef, useState } from "react";
import {
  saveProblemNoteStrokesAction,
  loadProblemNoteStrokesAction,
  type ProblemNoteContext,
  type StrokeSegment,
} from "@/lib/problem-notes-actions";

const CANVAS_HEIGHT = 220;

function drawAll(ctx: CanvasRenderingContext2D, strokes: StrokeSegment[], width: number) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const s of strokes) {
    const scale = s.w ? width / s.w : 1;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(s.x0 * scale, s.y0 * scale);
    ctx.lineTo(s.x1 * scale, s.y1 * scale);
    ctx.stroke();
  }
}

/** 모의고사·과제·문제 풀이 중 필기(2026-09-21 사용자 지시). 실시간 공유가 아니라 혼자 쓰는
 * 필기판 — 문항을 벗어나거나(부모가 key를 바꿔 재마운트) "필기 끄기"를 누를 때 저장한다.
 * authorId를 주면 읽기 전용(교사·학부모가 학생의 필기를 나중에 보는 용도). */
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
  const [strokes, setStrokes] = useState<StrokeSegment[] | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const strokesRef = useRef<StrokeSegment[]>([]);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadProblemNoteStrokesAction(context, targetId, itemId, authorId)
      .then((rows) => {
        if (cancelled) return;
        setStrokes(rows);
        strokesRef.current = rows;
      })
      .catch(() => {
        if (!cancelled) setStrokes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, context, targetId, itemId, authorId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || strokes === null) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawAll(ctx, strokes, canvas.width);
  }, [strokes]);

  function flush() {
    if (readOnly || !dirtyRef.current) return;
    dirtyRef.current = false;
    void saveProblemNoteStrokesAction(context, targetId, itemId, strokesRef.current);
  }

  useEffect(() => {
    return () => flush();
    // flush는 매 렌더 새로 만들어지지만 ref만 읽으므로(closure 안정적) 의존성에 넣지 않는다 —
    // 넣으면 매 렌더마다 이 effect가 다시 실행돼 "문항이 바뀔 때만 이전 문항 저장" 의도가 깨진다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, targetId, itemId]);

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (readOnly) return;
    drawingRef.current = true;
    lastPointRef.current = pointFromEvent(e);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (readOnly || !drawingRef.current || !lastPointRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const point = pointFromEvent(e);
    const segment: StrokeSegment = {
      x0: lastPointRef.current.x,
      y0: lastPointRef.current.y,
      x1: point.x,
      y1: point.y,
      color: "#e11d48",
      w: canvas.width,
    };
    strokesRef.current = [...strokesRef.current, segment];
    dirtyRef.current = true;
    ctx.strokeStyle = segment.color;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(segment.x0, segment.y0);
    ctx.lineTo(segment.x1, segment.y1);
    ctx.stroke();
    lastPointRef.current = point;
  }

  function handlePointerUp() {
    drawingRef.current = false;
    lastPointRef.current = null;
  }

  function handleClear() {
    strokesRef.current = [];
    dirtyRef.current = true;
    setStrokes([]);
    flush();
  }

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (open) flush();
            setOpen((v) => !v);
          }}
          aria-pressed={open}
          className={`rounded border px-2.5 py-1 text-[11.5px] font-bold ${
            open ? "border-ink bg-ink text-white" : "border-grey-300 text-grey-600"
          }`}
        >
          {readOnly ? (open ? "필기 닫기" : "필기 보기") : open ? "필기 끄기" : "✏️ 필기 모드"}
        </button>
        {open && !readOnly && (
          <button type="button" onClick={handleClear} className="text-[11px] font-semibold text-grey-500 underline">
            지우기
          </button>
        )}
      </div>
      {open && (
        <div className="mt-2 overflow-hidden rounded-lg border border-grey-200 bg-white">
          {strokes === null ? (
            <p className="p-3 text-[12px] text-grey-400">불러오는 중…</p>
          ) : (
            <canvas
              ref={canvasRef}
              width={640}
              height={CANVAS_HEIGHT}
              className={`w-full touch-none ${readOnly ? "" : "cursor-crosshair"}`}
              style={{ height: CANVAS_HEIGHT }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />
          )}
        </div>
      )}
    </div>
  );
}
