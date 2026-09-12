"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import { saveCanvasStrokes } from "./canvas-actions";
import { appendScopedStrokeEvents } from "./annotation-events-actions";
import type { CanvasStroke } from "./material-data";
import { annotationScale, pointerToCanvas } from "./annotation-scale";

const COLORS = ["#1A1A1A", "#C8102E", "#1B6FB0"];

// 필기를 얹는 동안 본문이 재배치되지 않도록 고정하는 논리 폭.
//
// 기준 너비로 좌표를 비례 환산하는 것만으로는 부족하다 — 이미지처럼 통째로
// 확대되는 콘텐츠는 맞지만, 텍스트 본문은 화면이 좁아지면 줄이 다시 나뉘어
// "세 번째 줄의 그 단어"가 아예 다른 자리로 간다. 비율 환산은 그 이동을
// 따라갈 수 없다.
//
// 그래서 필기가 있는 동안에는 본문을 이 논리 폭으로 고정해 두고, 화면이 좁으면
// 통째로 축소해서 보여준다. 줄바꿈이 어느 화면에서나 동일하므로 필기는 언제나
// 같은 문장·같은 그림 위에 남는다. 필기를 숨기면 다시 화면 폭에 맞춰 편하게
// 읽는 모드로 돌아간다.
//
// 값은 데스크톱 읽기 영역의 실제 본문 폭과 같게 맞춘다(컬럼 760 - 좌우 여백 80).
// 그래야 데스크톱에서는 축소가 전혀 일어나지 않고, 좁은 화면에서만 줄어든다.
const ANNOTATION_LAYOUT_WIDTH = 680;

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
  persistence = "legacy",
  children,
}: {
  sessionId: string;
  curriculumDocId: string;
  initialStrokes: CanvasStroke[];
  canDraw: boolean;
  scope?: CanvasScope;
  /**
   * 어디에 저장할지. canvas_annotations는 session_id가 legacy_sessions를
   * 가리키므로 v3 수업에서는 쓸 수 없다 — 그래서 v3 수업의 교재 필기는 지금까지
   * 저장 경로가 없어 아예 막혀 있었다. v3는 범위가 붙는 이벤트 로그에 남긴다.
   */
  persistence?: "legacy" | "events";
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
  const [showAnnotations, setShowAnnotations] = useState(true);
  // 그림이 늦게 로드되면 본문 높이가 늘어나 그 아래 내용이 밀린다. 그 전에
  // 그은 필기는 밀리기 전 자리를 가리키게 되므로, 본문 안의 그림이 전부
  // 자리를 잡은 뒤에 필기를 시작할 수 있게 한다.
  const [contentReady, setContentReady] = useState(false);

  // 저장하지 못한 획은 브라우저에 남겨 둔다. 연결이 끊긴 채로 새로고침하거나
  // 탭이 닫히면 메모리에만 있던 버퍼가 통째로 사라져, 학생이 그린 필기가
  // 소리 없이 없어진다. 다시 열었을 때 이어서 저장한다.
  const pendingKey = `alton:unsaved-strokes:${sessionId}:${curriculumDocId}:${scope}`;

  const rememberPending = useCallback(() => {
    try {
      if (pendingRef.current.length === 0) window.localStorage.removeItem(pendingKey);
      else window.localStorage.setItem(pendingKey, JSON.stringify(pendingRef.current));
    } catch {
      // 저장소를 못 쓰는 환경(시크릿 모드 등)에서는 조용히 넘어간다 —
      // 이 기능이 없다고 해서 필기 자체가 막혀서는 안 된다.
    }
  }, [pendingKey]);
  const [layoutScale, setLayoutScale] = useState(1);
  const [layoutHeight, setLayoutHeight] = useState<number | null>(null);
  const outerRef = useRef<HTMLDivElement | null>(null);

  // 필기는 교재 본문 위에 얹힌다. 창 크기나 확대 배율이 바뀌면 본문이 다시
  // 흐르고 캔버스 너비도 달라지므로, 그릴 때의 기준 너비(w)로 환산해서 다시
  // 그린다 — 그래야 필기가 원래 문장 위에 그대로 남는다. w가 없는 과거 필기는
  // 지금 너비에서 그렸다고 보고 그대로 그린다(기존 동작 유지).
  const drawSegment = useCallback((seg: CanvasStroke) => {
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
      ctx.lineWidth = 2.5 * scale;
    }
    ctx.beginPath();
    ctx.moveTo(seg.x0 * scale, seg.y0 * scale);
    ctx.lineTo(seg.x1 * scale, seg.y1 * scale);
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
      // 크기를 바꾸면 캔버스는 비워진다. 기준 너비로 환산해 전부 다시 그린다.
      canvas.getContext("2d")?.clearRect(0, 0, width, height);
      strokesRef.current.forEach(drawSegment);
    }
  }, [drawSegment]);

  // 필기를 보여주는 동안에는 본문 폭을 ANNOTATION_LAYOUT_WIDTH로 고정하고,
  // 화면이 그보다 좁으면 통째로 축소한다. 줄바꿈이 화면 크기와 무관해지므로
  // 필기가 가리키는 문장이 달라지지 않는다.
  const layoutPinned = showAnnotations;

  const measureLayout = useCallback(() => {
    const outer = outerRef.current;
    const wrap = wrapRef.current;
    if (!outer || !wrap) return;
    if (!layoutPinned) {
      setLayoutScale(1);
      setLayoutHeight(null);
      return;
    }
    const available = outer.clientWidth;
    const next = available > 0 && available < ANNOTATION_LAYOUT_WIDTH
      ? available / ANNOTATION_LAYOUT_WIDTH
      : 1;
    setLayoutScale(next);
    // 축소한 만큼 바깥 높이도 줄여야 아래 내용과 겹치지 않는다.
    setLayoutHeight(wrap.scrollHeight * next);
  }, [layoutPinned]);

  // 지난번에 저장하지 못한 획을 되살린다 — 화면에 다시 그리고, 저장도 다시 시도한다.
  //
  // 복구는 반드시 한 번만 일어나야 한다. 남아 있는 버퍼를 "읽기만" 하면 이
  // effect가 두 번 실행될 때(개발 모드의 StrictMode, 빠른 재마운트 등) 같은
  // 획이 두 번 저장된다 — 실제로 그렇게 중복 저장되는 것을 확인했다. 그래서
  // 읽는 즉시 저장소에서 지워 "가져갔다"고 표시하고, 저장에 실패하면
  // rememberPending()이 다시 써 넣는다.
  const recoveredOnceRef = useRef(false);
  useEffect(() => {
    if (recoveredOnceRef.current) return;
    recoveredOnceRef.current = true;

    let recovered: CanvasStroke[] = [];
    try {
      const raw = window.localStorage.getItem(pendingKey);
      if (raw) recovered = JSON.parse(raw) as CanvasStroke[];
      window.localStorage.removeItem(pendingKey);
    } catch {
      recovered = [];
    }
    if (!Array.isArray(recovered) || recovered.length === 0) return;
    pendingRef.current = [...recovered, ...pendingRef.current];
    strokesRef.current = [...strokesRef.current, ...recovered];
    recovered.forEach(drawSegment);
    scheduleSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const images = Array.from(wrap.querySelectorAll("img"));
    const pending = images.filter((img) => !img.complete);
    if (pending.length === 0) {
      setContentReady(true);
      return;
    }
    let left = pending.length;
    const done = () => {
      left -= 1;
      if (left <= 0) {
        setContentReady(true);
        measureLayout();
        resize();
      }
    };
    pending.forEach((img) => {
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
    });
    return () => {
      pending.forEach((img) => {
        img.removeEventListener("load", done);
        img.removeEventListener("error", done);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children]);

  useEffect(() => {
    measureLayout();
    const outer = outerRef.current;
    const wrap = wrapRef.current;
    if (!outer || !wrap || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measureLayout);
    ro.observe(outer);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [measureLayout]);

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
        if (isPrivate || persistence === "events") {
          // append-only라 "아직 안 보낸 것"만 보낸다. 실패하면 되돌려 다음
          // 시도에 함께 보내므로 필기가 사라지지도, 중복되지도 않는다.
          const batch = pendingRef.current;
          pendingRef.current = [];
          try {
            await appendScopedStrokeEvents({
              sessionId,
              segments: batch,
              scope: isPrivate ? "student_private" : "teacher_shared",
              curriculumDocId,
            });
          } catch (e) {
            pendingRef.current = [...batch, ...pendingRef.current];
            rememberPending();
            throw e;
          }
          rememberPending();
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
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    // 화면에 보이는 크기(축소 포함)와 캔버스 내부 논리 픽셀 크기가 다르다.
    // 항상 논리 좌표계로 바꿔 기록한다.
    return pointerToCanvas(e.clientX, e.clientY, rect, canvas);
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
      w: canvasRef.current?.width,
    };
    drawSegment(seg);
    strokesRef.current.push(seg);
    if (isPrivate || persistence === "events") {
      pendingRef.current.push(seg);
      rememberPending();
    }
    if (!isPrivate) {
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
      <div className="flex flex-wrap items-center gap-3 mb-3 sticky top-0 bg-white/95 py-2 z-20">
        {/* 필기를 보여주는 동안에는 본문 폭이 고정된다(줄바꿈이 달라지면 필기가
            가리키는 문장이 바뀌므로). 편하게 읽고 싶을 때는 필기를 숨기면
            화면 폭에 맞춰 다시 흐른다. */}
        <button
          onClick={() => setShowAnnotations((v) => !v)}
          aria-pressed={showAnnotations}
          className={
            "text-[12px] font-bold px-3 py-1.5 rounded-full border-[1.5px] " +
            (showAnnotations ? "border-grey-200 text-ink" : "bg-ink text-white border-ink")
          }
        >
          {showAnnotations ? "필기 숨기고 넓게 읽기" : "필기 보기"}
        </button>
        {layoutPinned && layoutScale < 1 && (
          <span className="text-[11px] text-grey-500">
            필기 위치를 지키려고 본문을 축소해서 보여주고 있어요
          </span>
        )}
      </div>

      {canDraw && showAnnotations && !contentReady && (
        <p className="text-[11.5px] text-grey-500 mb-2">
          교재의 그림을 불러오는 중입니다 — 다 불러온 뒤에 필기해야 위치가 어긋나지 않아요.
        </p>
      )}

      {canDraw && showAnnotations && contentReady && (
        <div className="flex flex-wrap items-center gap-3 mb-3 sticky top-0 bg-white/95 py-2 z-20">
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

      <div
        ref={outerRef}
        className="relative"
        style={
          layoutPinned && layoutScale < 1
            ? { overflow: "hidden", height: layoutHeight ?? undefined }
            : undefined
        }
      >
        <div
          ref={wrapRef}
          className="relative"
          style={
            layoutPinned
              ? {
                  width: ANNOTATION_LAYOUT_WIDTH,
                  maxWidth: "none",
                  transform: layoutScale < 1 ? `scale(${layoutScale})` : undefined,
                  transformOrigin: "top left",
                }
              : undefined
          }
        >
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
          hidden={!showAnnotations}
        />
        </div>
      </div>
    </div>
  );
}
