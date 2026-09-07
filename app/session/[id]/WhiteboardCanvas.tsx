"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import { saveWhiteboardStrokes } from "./scratchpad-actions";
import type { CanvasStroke } from "./material-data";
import {
  appendStrokeEvent,
  appendClearAllEvent,
  replayAnnotationEvents,
} from "./annotation-events-actions";
import { reconstructVisibleStrokes, type StrokePayload } from "./annotation-events-types";

const COLORS = ["#1A1A1A", "#C8102E", "#1B6FB0"];
const BOARD_HEIGHT = 2400;

// R9 — v3 세션은 legacy_sessions.whiteboard_strokes(픽셀 좌표, 마지막 스냅샷)가
// 아예 없으므로 session_annotation_events(정규화 좌표 0~1, append-only)를 쓴다.
// 레거시 세션은 기존 broadcast + debounce 저장 방식을 그대로 유지한다(정책상
// 레거시는 읽기 호환만 — 새 쓰기는 이벤트 로그에만 쌓는다).
export default function WhiteboardCanvas({
  sessionId,
  initialStrokes,
  canDraw,
  canClearAll = false,
  isV3 = false,
  initialAnnotationStrokes = [],
  currentUserId,
}: {
  sessionId: string;
  initialStrokes: CanvasStroke[];
  canDraw: boolean;
  canClearAll?: boolean;
  isV3?: boolean;
  initialAnnotationStrokes?: StrokePayload[];
  currentUserId?: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const strokesRef = useRef<CanvasStroke[]>(initialStrokes);
  const drawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentSegRef = useRef<CanvasStroke | null>(null);

  const [drawMode, setDrawMode] = useState(false);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  // 정규화(0~1) <-> 픽셀 좌표 변환. 캔버스 폭은 컨테이너 크기에 따라 달라지므로
  // 항상 "지금 이 캔버스의 width/BOARD_HEIGHT" 기준으로 변환한다.
  const toNormalized = useCallback((seg: CanvasStroke): StrokePayload => {
    const canvas = canvasRef.current;
    const w = canvas?.width || 1;
    return {
      x0: seg.x0 / w,
      y0: seg.y0 / BOARD_HEIGHT,
      x1: seg.x1 / w,
      y1: seg.y1 / BOARD_HEIGHT,
      color: seg.color,
      tool: seg.tool,
    };
  }, []);

  const toPixel = useCallback((p: StrokePayload): CanvasStroke => {
    const canvas = canvasRef.current;
    const w = canvas?.width || 1;
    return {
      x0: p.x0 * w,
      y0: p.y0 * BOARD_HEIGHT,
      x1: p.x1 * w,
      y1: p.y1 * BOARD_HEIGHT,
      color: p.color,
      tool: p.tool,
    };
  }, []);

  // v3 전용: 서버에서 이벤트를 다시 읽어(replay) 현재 보여야 할 stroke만 재구성하고
  // 캔버스를 지운 뒤 처음부터 다시 그린다. 최초 로드와 재접속(realtime 채널이
  // 다시 SUBSCRIBED 상태가 될 때) 양쪽에서 호출된다 — 클라이언트 상태를 신뢰하지
  // 않고 항상 서버 로그를 단일 진실 소스로 다시 반영한다.
  const replayAndRedraw = useCallback(async () => {
    if (!isV3) return;
    try {
      const events = await replayAnnotationEvents(sessionId);
      const visible = reconstructVisibleStrokes(events);
      clearCanvasLocal();
      const pixelStrokes = visible.map(toPixel);
      pixelStrokes.forEach(drawSegment);
      strokesRef.current = pixelStrokes;
      setErrorMsg(null);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "화이트보드를 불러오지 못했습니다.");
    }
  }, [isV3, sessionId, clearCanvasLocal, toPixel, drawSegment]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const width = wrap.clientWidth;
    if (width > 0) {
      canvas.width = width;
      canvas.height = BOARD_HEIGHT;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${BOARD_HEIGHT}px`;
      if (isV3) {
        initialAnnotationStrokes.map(toPixel).forEach(drawSegment);
      } else {
        strokesRef.current.forEach(drawSegment);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawSegment]);

  // 레거시 세션: 기존 broadcast-only 실시간 협업(영구 저장은 별도 debounce).
  useEffect(() => {
    if (isV3) return;
    const supabase = createClient();
    const channel = supabase.channel(`session-whiteboard:${sessionId}`);
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
  }, [isV3, sessionId, drawSegment, clearCanvasLocal]);

  // v3 세션: session_annotation_events INSERT를 실시간으로 구독한다. 본인이 방금
  // append한 이벤트는 이미 로컬에서 낙관적으로 그렸으므로 author_id로 걸러 중복
  // 드로잉을 막는다. 채널이 (재)연결될 때마다("SUBSCRIBED") replayAndRedraw로
  // 전체 상태를 서버 기준으로 다시 맞춘다 — 연결이 끊겼다 재접속해도 클라이언트
  // 메모리 상태를 신뢰하지 않고 항상 재동기화된다.
  useEffect(() => {
    if (!isV3) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`session-annotation-events:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "session_annotation_events",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as {
            author_id: string;
            event_type: "stroke" | "clear_all";
            payload: Record<string, unknown>;
          };
          if (row.author_id === currentUserId) return; // 본인 이벤트는 이미 로컬에 반영됨
          if (row.event_type === "clear_all") {
            clearCanvasLocal();
            strokesRef.current = [];
          } else {
            const seg = toPixel(row.payload as StrokePayload);
            drawSegment(seg);
            strokesRef.current.push(seg);
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void replayAndRedraw();
        }
      });
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
    // replayAndRedraw는 sessionId/isV3에만 실질적으로 의존하므로 deps에서 제외해도
    // 무한 재구독을 만들지 않는다(useCallback으로 안정화됨).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isV3, sessionId, currentUserId, clearCanvasLocal, drawSegment, toPixel]);

  function scheduleSave() {
    if (isV3) return; // v3는 매 액션이 이미 append로 영구 기록됨 — 별도 debounce 저장 없음.
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      await saveWhiteboardStrokes(sessionId, strokesRef.current);
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
    if (isV3) {
      currentSegRef.current = seg;
    } else {
      channelRef.current?.send({ type: "broadcast", event: "stroke", payload: seg });
    }
    lastPosRef.current = p;
  }

  async function handlePointerUp() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (isV3) {
      const seg = currentSegRef.current;
      currentSegRef.current = null;
      if (!seg) return;
      try {
        await appendStrokeEvent(sessionId, toNormalized(seg));
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "필기를 저장하지 못했습니다.");
      }
    } else {
      scheduleSave();
    }
  }

  async function handleClearAll() {
    if (!confirm("화이트보드를 전체 지우시겠습니까?")) return;
    if (isV3) {
      if (!canClearAll) {
        // 방어적 가드 — canClearAll이 false면 버튼 자체를 렌더링하지 않으므로
        // 정상 흐름에서는 도달하지 않는다. DB(RLS)도 동일하게 최종 강제한다.
        setErrorMsg("선생님만 전체 지우기를 할 수 있습니다.");
        return;
      }
      clearCanvasLocal();
      strokesRef.current = [];
      try {
        await appendClearAllEvent(sessionId);
        setErrorMsg(null);
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : "전체 지우기에 실패했습니다.");
        await replayAndRedraw(); // 서버가 거부했으면 로컬 낙관적 삭제를 되돌린다.
      }
    } else {
      clearCanvasLocal();
      strokesRef.current = [];
      channelRef.current?.send({ type: "broadcast", event: "clear", payload: {} });
      scheduleSave();
    }
  }

  return (
    <div>
      <p className="text-[13px] text-grey-500 mb-3">
        아래로 계속 스크롤하며 필기할 수 있습니다.
      </p>

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
              {/* v3는 canClearAll(선생님/관리자)일 때만, 레거시는 기존처럼 항상 노출 */}
              {(!isV3 || canClearAll) && (
                <button
                  onClick={handleClearAll}
                  className="text-[12px] font-bold px-3 py-1.5 rounded-lg border border-grey-200"
                >
                  전체 지우기
                </button>
              )}
            </>
          )}
          {saved && (
            <span className="text-[11px] font-bold text-green">
              ✓ 저장됨
            </span>
          )}
          {errorMsg && (
            <span className="text-[11px] font-bold text-red">
              ⚠ {errorMsg}
            </span>
          )}
        </div>
      )}

      <div ref={wrapRef} className="relative bg-grey-100 rounded-xl overflow-hidden">
        <canvas
          ref={canvasRef}
          className={
            drawMode ? "pointer-events-auto cursor-crosshair block" : "pointer-events-none block"
          }
          style={{ touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>
    </div>
  );
}
