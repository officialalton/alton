"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { StrokePayload } from "./annotation-events-types";
import { annotationScale, pointerToCanvas } from "./annotation-scale";
import { appendProblemWorkStrokes } from "./problem-work-actions";

const COLORS = ["#1A1A1A", "#C8102E", "#1B6FB0"];
const BOARD_HEIGHT = 420;

export type ProblemBoardHandle = {
  /** 아직 저장되지 않은 획을 즉시 저장한다. 성공하면 true. */
  flush: () => Promise<boolean>;
  hasUnsaved: () => boolean;
};

/**
 * 문제 하나를 풀기 위한 화이트보드. 이 판은 (수업, 학생, 문제, 풀이 회차)
 * 하나에 묶여 있어 문제를 바꾸거나 다시 풀어도 기록이 섞이지 않는다.
 *
 * 학생 원본과 교사 피드백은 같은 판 위의 다른 레이어다. 교사는 학생 원본을
 * 고치거나 지울 수 없고(DB가 막는다) 피드백만 얹는다.
 */
const ProblemWorkBoard = forwardRef<
  ProblemBoardHandle,
  {
    sessionId: string;
    problemId: string;
    workId: string;
    attemptNo: number;
    studentStrokes: StrokePayload[];
    feedbackStrokes: StrokePayload[];
    canDraw: boolean;
    drawAsFeedback: boolean;
    readOnlyReason?: string;
    onSaveStateChange?: (state: "idle" | "saving" | "saved" | "error") => void;
  }
>(function ProblemWorkBoard(
  {
    sessionId,
    problemId,
    workId,
    attemptNo,
    studentStrokes,
    feedbackStrokes,
    canDraw,
    drawAsFeedback,
    readOnlyReason,
    onSaveStateChange,
  },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const pendingRef = useRef<StrokePayload[]>([]);
  const localRef = useRef<StrokePayload[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [showFeedback, setShowFeedback] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  function setSave(next: "idle" | "saving" | "saved" | "error") {
    setSaveState(next);
    onSaveStateChange?.(next);
  }

  // 그릴 때의 기준 너비로 환산해서 그린다 — 창 크기·확대 배율이 바뀌어도
  // 필기가 콘텐츠 위 원래 자리에 남는다.
  const drawSegment = useCallback((seg: StrokePayload, dim = false) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const scale = annotationScale(canvas.width, seg.w);
    ctx.lineCap = "round";
    if (seg.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = 22 * scale;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = seg.color;
      ctx.lineWidth = (dim ? 3.5 : 2.5) * scale;
    }
    ctx.globalAlpha = dim ? 0.85 : 1;
    ctx.beginPath();
    ctx.moveTo(seg.x0 * scale, seg.y0 * scale);
    ctx.lineTo(seg.x1 * scale, seg.y1 * scale);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    studentStrokes.forEach((s) => drawSegment(s, drawAsFeedback ? false : false));
    localRef.current.forEach((s) => drawSegment(s, drawAsFeedback));
    if (showFeedback) feedbackStrokes.forEach((s) => drawSegment(s, true));
  }, [studentStrokes, feedbackStrokes, showFeedback, drawAsFeedback, drawSegment]);

  const fit = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.parentElement?.clientWidth ?? 640;
    if (width <= 0) return;
    canvas.width = width;
    canvas.height = BOARD_HEIGHT;
    redraw();
  }, [redraw]);

  useEffect(() => {
    fit();
    const el = canvasRef.current?.parentElement;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  const flush = useCallback(async (): Promise<boolean> => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const batch = pendingRef.current;
    if (batch.length === 0) return true;
    setSave("saving");
    try {
      await appendProblemWorkStrokes({
        sessionId,
        problemId,
        workId,
        segments: batch,
        asFeedback: drawAsFeedback,
      });
      pendingRef.current = pendingRef.current.slice(batch.length);
      setSave("saved");
      return true;
    } catch {
      setSave("error");
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, problemId, workId, drawAsFeedback]);

  useImperativeHandle(ref, () => ({
    flush,
    hasUnsaved: () => pendingRef.current.length > 0,
  }));

  function scheduleSave() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSave("saving");
    saveTimerRef.current = setTimeout(() => void flush(), 600);
  }

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const canvas = canvasRef.current!;
    // 화면에 그려진 크기와 캔버스 내부 픽셀 크기가 다를 수 있다(확대·축소).
    return pointerToCanvas(e.clientX, e.clientY, rect, canvas);
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
                    "w-6 h-6 rounded-full border-2 " +
                    (color === c && tool === "pen" ? "border-ink" : "border-transparent")
                  }
                />
              ))}
            </div>
            <button
              onClick={() => setTool(tool === "eraser" ? "pen" : "eraser")}
              aria-pressed={tool === "eraser"}
              className={
                "text-[11.5px] font-bold px-3 py-1.5 rounded-full border-[1.5px] " +
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
            className="text-[11.5px] font-bold px-3 py-1.5 rounded-full border-[1.5px] border-grey-200 text-ink ml-auto"
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
          style={{ height: BOARD_HEIGHT }}
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
              w: canvasRef.current?.width,
            };
            drawSegment(seg, drawAsFeedback);
            pendingRef.current.push(seg);
            localRef.current.push(seg);
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
});

export default ProblemWorkBoard;
