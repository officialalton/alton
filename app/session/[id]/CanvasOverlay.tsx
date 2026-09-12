"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import { saveCanvasStrokes } from "./canvas-actions";
import { appendScopedStrokeEvents } from "./annotation-events-actions";
import type { CanvasStroke } from "./material-data";

const COLORS = ["#1A1A1A", "#C8102E", "#1B6FB0"];

/**
 * 교재 본문 위에 얹는 필기 캔버스 — 콘텐츠 전체 높이에 걸친 단일 캔버스다
 * (섹션마다 따로 두면 필기가 섹션 경계에서 끊긴다, functional-spec §5).
 *
 * P3 3단계(제품 오너 피드백 4) — 필기 범위가 저장·조회·실시간 공유에 똑같이
 * 적용된다. 예전에는 범위 개념 없이 (세션, 교재) 하나의 공용 캔버스만 있어서,
 * 학생이 자기 교재에 남긴 필기가 브로드캐스트로 교사 화면에 즉시 그려지고
 * canvas_annotations의 같은 행에 저장됐다.
 *
 *   - `teacher_shared`: 함께 보는 설명용 필기. 기존대로 브로드캐스트하고
 *     공용 캔버스에 저장한다.
 *   - `student_private`: 학생 본인만 보는 교재 필기. **채널을 아예 열지
 *     않는다** — 구독도 송신도 없다. 저장은 범위가 붙는 이벤트 경로로만 하고
 *     공용 캔버스(canvas_annotations)는 건드리지 않는다.
 */
export type CanvasScope = "teacher_shared" | "student_private";

export default function CanvasOverlay({
  sessionId,
  curriculumDocId,
  initialStrokes,
  canDraw,
  scope = "teacher_shared",
  children,
}: {
  sessionId: string;
  curriculumDocId: string;
  initialStrokes: CanvasStroke[];
  canDraw: boolean;
  scope?: CanvasScope;
  children: React.ReactNode;
}) {
  const isPrivate = scope === "student_private";
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const strokesRef = useRef<CanvasStroke[]>(initialStrokes);
  const drawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 개인 필기는 append-only라 "아직 안 보낸 세그먼트"만 따로 모은다.
  const pendingRef = useRef<CanvasStroke[]>([]);

  const [drawMode, setDrawMode] = useState(false);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const drawSegment = useCallback((seg: CanvasStroke) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.lineCap = "round";
    if (seg.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = 22;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = seg.color;
      ctx.lineWidth = 2.5;
    }
    ctx.beginPath();
    ctx.moveTo(seg.x0, seg.y0);
    ctx.lineTo(seg.x1, seg.y1);
    ctx.stroke();
  }, []);

  const clearCanvasLocal = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  // 콘텐츠 높이(스크롤 전체 높이)에 맞춰 캔버스 크기를 잡고, 기존 필기를 다시 그린다.
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const width = wrap.clientWidth;
    const height = wrap.scrollHeight;
    if (width > 0 && height > 0 && (canvas.width !== width || canvas.height !== height)) {
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      strokesRef.current.forEach(drawSegment);
    }
  }, [drawSegment]);

  useEffect(() => {
    resize();
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [resize]);

  useEffect(() => {
    // 개인 필기는 실시간 경로 자체를 만들지 않는다. 채널 이름을 분리하는 것만으론
    // 부족하다 — 구독이 있으면 언젠가 누가 같은 이름으로 들어올 수 있고, 애초에
    // 남에게 전달될 경로가 없어야 한다.
    if (isPrivate) return;
    const supabase = createClient();
    const channel = supabase.channel(`session-canvas:${sessionId}:${curriculumDocId}`);
    channel
      .on("broadcast", { event: "stroke" }, ({ payload }) => {
        const seg = payload as CanvasStroke;
        drawSegment(seg);
        strokesRef.current.push(seg);
      })
      .on("broadcast", { event: "clear" }, () => {
        clearCanvasLocal();
        strokesRef.current = [];
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, curriculumDocId, drawSegment, clearCanvasLocal, isPrivate]);

  function scheduleSave() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        if (isPrivate) {
          // 범위가 붙는 append-only 경로로만 남긴다. 공용 캔버스 행을 덮어쓰면
          // 교사가 다음 로드에서 그대로 보게 된다.
          await appendScopedStrokeEvents({
            sessionId,
            segments: pendingRef.current,
            scope: "student_private",
            curriculumDocId,
          });
          pendingRef.current = [];
        } else {
          await saveCanvasStrokes(sessionId, curriculumDocId, strokesRef.current);
        }
        setSaveError(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      } catch {
        setSaveError(true);
      }
    }, 600);
  }

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawMode) return;
    drawingRef.current = true;
    lastPosRef.current = pos(e);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawMode || !drawingRef.current || !lastPosRef.current) return;
    const p = pos(e);
    const seg: CanvasStroke = {
      x0: lastPosRef.current.x,
      y0: lastPosRef.current.y,
      x1: p.x,
      y1: p.y,
      color,
      tool,
    };
    drawSegment(seg);
    strokesRef.current.push(seg);
    if (isPrivate) {
      pendingRef.current.push(seg);
    } else {
      channelRef.current?.send({ type: "broadcast", event: "stroke", payload: seg });
    }
    lastPosRef.current = p;
  }

  function handlePointerUp() {
    if (drawingRef.current) {
      drawingRef.current = false;
      scheduleSave();
    }
  }

  function handleClearAll() {
    clearCanvasLocal();
    strokesRef.current = [];
    if (!isPrivate) {
      channelRef.current?.send({ type: "broadcast", event: "clear", payload: {} });
      scheduleSave();
    }
  }

  return (
    <div>
      {canDraw && (
        <div className="flex items-center gap-3 mb-3 sticky top-0 bg-white/95 py-2 z-20">
          <button
            onClick={() => setDrawMode((v) => !v)}
            className={
              "text-[12.5px] font-bold px-4 py-1.5 rounded-full border-[1.5px] " +
              (drawMode ? "bg-ink text-white border-ink" : "border-grey-200 text-ink")
            }
          >
            ✏️ 필기 모드
          </button>
          {drawMode && (
            <>
              <div className="flex items-center gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={
                      "w-5 h-5 rounded-full border-2 " +
                      (color === c ? "border-ink" : "border-transparent")
                    }
                    style={{ background: c }}
                  />
                ))}
              </div>
              <div className="flex text-[12px] font-bold rounded-lg overflow-hidden border border-grey-200">
                <button
                  onClick={() => setTool("pen")}
                  className={"px-3 py-1 " + (tool === "pen" ? "bg-grey-100 text-ink" : "text-grey-500")}
                >
                  펜
                </button>
                <button
                  onClick={() => setTool("eraser")}
                  className={"px-3 py-1 " + (tool === "eraser" ? "bg-grey-100 text-ink" : "text-grey-500")}
                >
                  지우개
                </button>
              </div>
              <button
                onClick={handleClearAll}
                className="text-[12px] font-bold px-3 py-1.5 rounded-lg border border-grey-200"
              >
                전체 지우기
              </button>
            </>
          )}
          {/* 피드백 7 — 저장 중·저장 실패를 명확히 표현한다. 개인 필기는 누구와도
              공유되지 않는다는 사실도 화면에서 읽혀야 한다. */}
          {isPrivate && (
            <span className="text-[11px] font-semibold text-grey-500">
              나만 보는 필기
            </span>
          )}
          {saveError ? (
            <span className="text-[11px] font-bold text-red">
              저장하지 못했습니다 — 잠시 뒤 다시 그리면 저장됩니다
            </span>
          ) : (
            saved && (
              <span className="text-[11px] font-bold text-green">
                ✓ 이번 수업 필기 저장됨
              </span>
            )
          )}
        </div>
      )}

      <div ref={wrapRef} className="relative">
        {children}
        <canvas
          ref={canvasRef}
          className={
            "absolute top-0 left-0 " +
            (drawMode ? "pointer-events-auto cursor-crosshair" : "pointer-events-none")
          }
          style={{ zIndex: 5, touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>
    </div>
  );
}
