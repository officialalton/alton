"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import { saveCanvasStrokes } from "./canvas-actions";
import type { CanvasStroke } from "./material-data";

const COLORS = ["#1A1A1A", "#C8102E", "#1B6FB0"];

/**
 * 교재 본문 위에 얹는 필기 캔버스 — 콘텐츠 전체 높이에 걸친 단일 캔버스다
 * (섹션마다 따로 두면 필기가 섹션 경계에서 끊긴다, functional-spec §5).
 * 실시간 동기화는 Supabase Realtime Broadcast로, 영속 저장은 canvas_annotations로.
 */
export default function CanvasOverlay({
  sessionId,
  curriculumDocId,
  initialStrokes,
  canDraw,
  children,
}: {
  sessionId: string;
  curriculumDocId: string;
  initialStrokes: CanvasStroke[];
  canDraw: boolean;
  children: React.ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const strokesRef = useRef<CanvasStroke[]>(initialStrokes);
  const drawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [drawMode, setDrawMode] = useState(false);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [saved, setSaved] = useState(false);

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
  }, [sessionId, curriculumDocId, drawSegment, clearCanvasLocal]);

  function scheduleSave() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      await saveCanvasStrokes(sessionId, curriculumDocId, strokesRef.current);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
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
    channelRef.current?.send({ type: "broadcast", event: "stroke", payload: seg });
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
    channelRef.current?.send({ type: "broadcast", event: "clear", payload: {} });
    scheduleSave();
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
          {saved && (
            <span className="text-[11px] font-bold text-green">
              ✓ 이번 수업 필기 저장됨
            </span>
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
