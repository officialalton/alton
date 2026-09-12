"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StrokePayload } from "./annotation-events-types";
import { appendProblemWorkStrokes } from "./problem-work-actions";

const COLORS = ["#1A1A1A", "#C8102E", "#1B6FB0"];

/**
 * 문제 하나를 풀기 위한 화이트보드. 이 판은 (수업, 학생, 문제, 재풀이 회차)
 * 하나에 묶여 있어, 문제를 바꾸거나 다시 풀어도 기록이 섞이지 않는다.
 *
 * 학생 원본 풀이와 교사 피드백은 같은 판 위의 **다른 레이어**다. 교사는 학생
 * 원본을 고치거나 지울 수 없고(DB가 막는다), 피드백만 얹는다.
 */
export default function ProblemWorkBoard({
  sessionId,
  problemId,
  workId,
  attemptNo,
  studentStrokes,
  feedbackStrokes,
  canDraw,
  drawAsFeedback,
  readOnlyReason,
}: {
  sessionId: string;
  problemId: string;
  workId: string;
  attemptNo: number;
  studentStrokes: StrokePayload[];
  feedbackStrokes: StrokePayload[];
  canDraw: boolean;
  /** 교사면 true — 피드백 레이어에 그린다. */
  drawAsFeedback: boolean;
  /** 그릴 수 없는 이유(복습 중, 보호자 열람 등). 있으면 화면에 설명한다. */
  readOnlyReason?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const pendingRef = useRef<StrokePayload[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [showFeedback, setShowFeedback] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const drawSegment = useCallback((seg: StrokePayload, dim = false) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.lineCap = "round";
    if (seg.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = 22;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = seg.color;
      ctx.lineWidth = dim ? 3.5 : 2.5;
    }
    ctx.globalAlpha = dim ? 0.85 : 1;
    ctx.beginPath();
    ctx.moveTo(seg.x0, seg.y0);
    ctx.lineTo(seg.x1, seg.y1);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    studentStrokes.forEach((s) => drawSegment(s));
    if (showFeedback) feedbackStrokes.forEach((s) => drawSegment(s, true));
  }, [studentStrokes, feedbackStrokes, showFeedback, drawSegment]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.parentElement?.clientWidth ?? 640;
    canvas.width = width;
    canvas.height = 420;
    redraw();
  }, [redraw]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function scheduleSave() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveState("saving");
    saveTimerRef.current = setTimeout(async () => {
      const batch = pendingRef.current;
      pendingRef.current = [];
      if (batch.length === 0) {
        setSaveState("idle");
        return;
      }
      try {
        await appendProblemWorkStrokes({
          sessionId,
          problemId,
          workId,
          segments: batch,
          asFeedback: drawAsFeedback,
        });
        setSaveState("saved");
      } catch {
        // 저장하지 못한 세그먼트는 되돌려 다음 시도에 함께 보낸다.
        pendingRef.current = [...batch, ...pendingRef.current];
        setSaveState("error");
      }
    }, 600);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-[11px] font-bold text-grey-500">{attemptNo}번째 풀이</span>
        {canDraw ? (
          <>
            <div className="flex items-center gap-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  aria-label={`색 ${c}`}
                  onClick={() => {
                    setColor(c);
                    setTool("pen");
                  }}
                  style={{ background: c }}
                  className={
                    "w-5 h-5 rounded-full border-2 " +
                    (color === c && tool === "pen" ? "border-ink" : "border-transparent")
                  }
                />
              ))}
            </div>
            <button
              onClick={() => setTool(tool === "eraser" ? "pen" : "eraser")}
              aria-pressed={tool === "eraser"}
              className={
                "text-[11.5px] font-bold px-2.5 py-1 rounded-full border-[1.5px] " +
                (tool === "eraser" ? "bg-ink text-white border-ink" : "border-grey-200 text-ink")
              }
            >
              지우개
            </button>
            <span className="text-[11px] font-semibold text-grey-500">
              {drawAsFeedback ? "피드백으로 기록됩니다" : "내 풀이로 기록됩니다"}
            </span>
          </>
        ) : (
          <span className="text-[11.5px] text-grey-500">{readOnlyReason ?? "읽기 전용"}</span>
        )}

        {feedbackStrokes.length > 0 && (
          <button
            onClick={() => setShowFeedback((v) => !v)}
            aria-pressed={showFeedback}
            className="text-[11.5px] font-bold px-2.5 py-1 rounded-full border-[1.5px] border-grey-200 text-ink ml-auto"
          >
            {showFeedback ? "선생님 피드백 숨기기" : "선생님 피드백 보기"}
          </button>
        )}

        {saveState === "saving" && <span className="text-[11px] text-grey-500">저장 중…</span>}
        {saveState === "saved" && <span className="text-[11px] font-bold text-green">✓ 저장됨</span>}
        {saveState === "error" && (
          <span className="text-[11px] font-bold text-red">
            저장하지 못했습니다 — 계속 그리면 다시 시도합니다
          </span>
        )}
      </div>

      <div className="border-[1.5px] border-grey-200 rounded-xl overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          data-testid="problem-work-canvas"
          className={"block w-full touch-none " + (canDraw ? "cursor-crosshair" : "")}
          onPointerDown={(e) => {
            if (!canDraw) return;
            drawingRef.current = true;
            lastPosRef.current = pos(e);
          }}
          onPointerMove={(e) => {
            if (!canDraw || !drawingRef.current || !lastPosRef.current) return;
            const p = pos(e);
            const seg: StrokePayload = {
              x0: lastPosRef.current.x,
              y0: lastPosRef.current.y,
              x1: p.x,
              y1: p.y,
              color,
              tool,
            };
            drawSegment(seg, drawAsFeedback);
            pendingRef.current.push(seg);
            lastPosRef.current = p;
          }}
          onPointerUp={() => {
            if (!drawingRef.current) return;
            drawingRef.current = false;
            scheduleSave();
          }}
        />
      </div>
    </div>
  );
}
