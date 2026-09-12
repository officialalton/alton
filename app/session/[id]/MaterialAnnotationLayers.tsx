"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import type { CanvasStroke } from "./material-data";
import { appendScopedStrokeEvents } from "./annotation-events-actions";
import { annotationScale, pointerToCanvas } from "./annotation-scale";

const COLORS = ["#1A1A1A", "#C8102E", "#1B6FB0"];

// 필기를 얹는 동안 본문이 재배치되지 않도록 고정하는 논리 폭. 데스크톱 읽기
// 영역의 실제 본문 폭과 같게 맞춰, 넓은 화면에서는 축소가 일어나지 않는다.
const ANNOTATION_LAYOUT_WIDTH = 680;

export type MaterialLayerRole = "student" | "teacher" | "reader";

/**
 * 교재 위의 두 필기 레이어.
 *
 *   학생 필기(student_shared)   — 학생이 쓰고, 학생·담당 교사·연결된 보호자가 본다.
 *   선생님 필기(teacher_shared) — 교사가 쓰고, 같은 사람들이 본다.
 *
 * 보는 사람은 두 레이어를 각자 켜고 끈다 — 그 선택은 **자기 화면에만** 적용되고
 * 남에게 전달되지 않는다. 쓰기는 자기 레이어에만 가능하고(학생은 학생 필기,
 * 교사는 선생님 필기), 보호자는 어느 쪽에도 쓰지 않는다. 실제 강제는 DB의
 * 범위별 정책이고 여기서는 쓸 수 없는 도구를 보여주지 않는다.
 */
export default function MaterialAnnotationLayers({
  sessionId,
  curriculumDocId,
  studentStrokes,
  teacherStrokes,
  /** 정책 변경 전에 본인이 남긴 비공개 필기(보존 기록, 본인에게만 내려온다). */
  legacyPrivateStrokes = [],
  role,
  viewerUserId,
  children,
}: {
  sessionId: string;
  curriculumDocId: string;
  studentStrokes: CanvasStroke[];
  teacherStrokes: CanvasStroke[];
  legacyPrivateStrokes?: CanvasStroke[];
  role: MaterialLayerRole;
  viewerUserId?: string;
  children: React.ReactNode;
}) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const drawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const pendingRef = useRef<CanvasStroke[]>([]);
  const mineRef = useRef<CanvasStroke[]>([]);
  const peerRef = useRef<CanvasStroke[]>([]);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recoveredOnceRef = useRef(false);

  const [showStudent, setShowStudent] = useState(true);
  const [showTeacher, setShowTeacher] = useState(true);
  const [drawMode, setDrawMode] = useState(false);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [contentReady, setContentReady] = useState(false);
  const [imageProblem, setImageProblem] = useState(false);
  const [imageRetry, setImageRetry] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [layoutScale, setLayoutScale] = useState(1);
  const [layoutHeight, setLayoutHeight] = useState<number | null>(null);

  const myScope = role === "student" ? "student_shared" : role === "teacher" ? "teacher_shared" : null;
  const writable = myScope !== null;

  // 내 레이어를 보이지 않게 해 둔 채로 그리면 방금 그은 획이 사라진 것처럼
  // 보인다 — 그래서 그리기는 내 레이어가 켜져 있을 때만 할 수 있다.
  const myLayerVisible = role === "student" ? showStudent : showTeacher;

  const pendingKey =
    viewerUserId && myScope
      ? `alton:unsaved-strokes:${viewerUserId}:${sessionId}:${curriculumDocId}:${myScope}`
      : null;

  const rememberPending = useCallback(() => {
    if (!pendingKey) return;
    try {
      if (pendingRef.current.length === 0) window.localStorage.removeItem(pendingKey);
      else window.localStorage.setItem(pendingKey, JSON.stringify(pendingRef.current));
    } catch {
      // 저장소를 못 쓰는 환경에서는 조용히 넘어간다.
    }
  }, [pendingKey]);

  const drawSegment = useCallback((seg: CanvasStroke, dim = false) => {
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
      ctx.lineWidth = (dim ? 3.2 : 2.5) * scale;
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

    const mineIsStudent = role === "student";
    if (showStudent) {
      studentStrokes.forEach((s) => drawSegment(s));
      legacyPrivateStrokes.forEach((s) => drawSegment(s));
      if (mineIsStudent) mineRef.current.forEach((s) => drawSegment(s));
      else peerRef.current.forEach((s) => drawSegment(s));
    }
    if (showTeacher) {
      teacherStrokes.forEach((s) => drawSegment(s, true));
      if (!mineIsStudent) mineRef.current.forEach((s) => drawSegment(s, true));
      else peerRef.current.forEach((s) => drawSegment(s, true));
    }
  }, [studentStrokes, teacherStrokes, legacyPrivateStrokes, showStudent, showTeacher, role, drawSegment]);

  const fit = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const width = wrap.clientWidth;
    const height = wrap.scrollHeight;
    if (width <= 0 || height <= 0) return;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
    redraw();
  }, [redraw]);

  const measureLayout = useCallback(() => {
    const outer = outerRef.current;
    const wrap = wrapRef.current;
    if (!outer || !wrap) return;
    const available = outer.clientWidth;
    const next =
      available > 0 && available < ANNOTATION_LAYOUT_WIDTH ? available / ANNOTATION_LAYOUT_WIDTH : 1;
    setLayoutScale(next);
    setLayoutHeight(wrap.scrollHeight * next * zoom);
  }, [zoom]);

  useEffect(() => {
    measureLayout();
    fit();
    const outer = outerRef.current;
    const wrap = wrapRef.current;
    if (!outer || !wrap || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      measureLayout();
      fit();
    });
    ro.observe(outer);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [measureLayout, fit]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // 그림이 늦게 로드되면 그 아래 내용이 밀린다 — 다 자리를 잡은 뒤에 그린다.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const images = Array.from(wrap.querySelectorAll("img"));
    const pendingImages = images.filter((img) => !img.complete);
    if (pendingImages.length === 0) {
      setContentReady(true);
      return;
    }
    let left = pendingImages.length;
    let failed = false;
    const unlock = () => {
      setContentReady(true);
      setImageProblem(failed);
      measureLayout();
      fit();
    };
    const done = (ok: boolean) => {
      if (!ok) failed = true;
      left -= 1;
      if (left <= 0) unlock();
    };
    const onLoad = () => done(true);
    const onError = () => done(false);
    pendingImages.forEach((img) => {
      img.addEventListener("load", onLoad, { once: true });
      img.addEventListener("error", onError, { once: true });
    });
    const timer = setTimeout(() => {
      if (left > 0) {
        failed = true;
        left = 0;
        unlock();
      }
    }, 8000);
    return () => {
      clearTimeout(timer);
      pendingImages.forEach((img) => {
        img.removeEventListener("load", onLoad);
        img.removeEventListener("error", onError);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [children, imageRetry]);

  // 실시간 — 두 레이어 모두 같은 수업의 사람들에게 전달된다. 어느 레이어인지
  // 함께 실어 보내, 받는 쪽이 자기 토글 상태에 맞게 그린다.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`session-material-layers:${sessionId}:${curriculumDocId}`);
    channel
      .on("broadcast", { event: "stroke" }, ({ payload }) => {
        const incoming = payload as { scope: string; seg: CanvasStroke };
        if (!incoming?.seg) return;
        if (myScope && incoming.scope === myScope) return; // 내가 보낸 것
        peerRef.current.push(incoming.seg);
        const visible = incoming.scope === "student_shared" ? showStudent : showTeacher;
        if (visible) drawSegment(incoming.seg, incoming.scope === "teacher_shared");
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, curriculumDocId, myScope, showStudent, showTeacher, drawSegment]);

  const flush = useCallback(async () => {
    if (!myScope) return;
    const batch = pendingRef.current;
    pendingRef.current = [];
    if (batch.length === 0) {
      setSaveState("idle");
      return;
    }
    try {
      await appendScopedStrokeEvents({
        sessionId,
        segments: batch,
        scope: myScope,
        curriculumDocId,
      });
      rememberPending();
      setSaveState("saved");
      setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 1500);
    } catch {
      pendingRef.current = [...batch, ...pendingRef.current];
      rememberPending();
      setSaveState("error");
    }
  }, [myScope, sessionId, curriculumDocId, rememberPending]);

  function scheduleSave() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveState("saving");
    saveTimerRef.current = setTimeout(() => void flush(), 600);
  }

  // 지난번에 저장하지 못한 획을 되살린다. 한 번만 — 읽는 즉시 저장소에서 지워
  // "가져갔다"고 표시하고, 실패하면 rememberPending()이 다시 쓴다.
  useEffect(() => {
    if (!pendingKey || recoveredOnceRef.current) return;
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
    mineRef.current = [...mineRef.current, ...recovered];
    redraw();
    scheduleSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    return pointerToCanvas(e.clientX, e.clientY, canvas.getBoundingClientRect(), canvas);
  }

  const canDrawNow = writable && drawMode && contentReady && myLayerVisible;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3 sticky top-0 bg-white/95 py-2 z-20">
        {/* 레이어 토글 — 각자 자기 화면에만 적용된다. */}
        <button
          onClick={() => setShowStudent((v) => !v)}
          aria-pressed={showStudent}
          className={
            "text-[12px] font-bold px-3 py-1.5 rounded-full border-[1.5px] " +
            (showStudent ? "bg-ink text-white border-ink" : "border-grey-200 text-grey-500")
          }
        >
          학생 필기
        </button>
        <button
          onClick={() => setShowTeacher((v) => !v)}
          aria-pressed={showTeacher}
          className={
            "text-[12px] font-bold px-3 py-1.5 rounded-full border-[1.5px] " +
            (showTeacher ? "bg-ink text-white border-ink" : "border-grey-200 text-grey-500")
          }
        >
          선생님 필기
        </button>

        {writable && (
          <button
            onClick={() => setDrawMode((v) => !v)}
            aria-pressed={drawMode}
            disabled={!myLayerVisible}
            title={!myLayerVisible ? "내 레이어를 켜야 필기할 수 있어요" : undefined}
            className={
              "text-[12px] font-bold px-3.5 py-1.5 rounded-full border-[1.5px] disabled:opacity-40 " +
              (drawMode ? "bg-ink text-white border-ink" : "border-grey-200 text-ink")
            }
          >
            ✏️ 필기 모드
          </button>
        )}

        {writable && drawMode && (
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
              {role === "student" ? "학생 필기로 기록됩니다" : "선생님 필기로 기록됩니다"}
            </span>
          </>
        )}

        {!writable && (
          <span className="text-[11px] text-grey-500">보호자는 읽기 전용입니다</span>
        )}

        {saveState === "saving" && <span className="text-[11px] text-grey-500">저장 중…</span>}
        {saveState === "saved" && <span className="text-[11px] font-bold text-green">✓ 저장됨</span>}
        {saveState === "error" && (
          <span className="text-[11px] font-bold text-red">
            저장하지 못했습니다 — 계속 그리면 다시 시도합니다
          </span>
        )}

        {layoutScale < 1 && (
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => setZoom((z) => Math.max(1, Math.round((z - 0.25) * 100) / 100))}
              disabled={zoom <= 1}
              aria-label="작게 보기"
              className="text-[12px] font-bold px-2.5 py-1 rounded-lg border border-grey-200 disabled:opacity-40"
            >
              －
            </button>
            <span className="text-[11px] font-semibold text-grey-500 tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(3, Math.round((z + 0.25) * 100) / 100))}
              disabled={zoom >= 3}
              aria-label="크게 보기"
              className="text-[12px] font-bold px-2.5 py-1 rounded-lg border border-grey-200 disabled:opacity-40"
            >
              ＋
            </button>
          </div>
        )}
      </div>

      {writable && !contentReady && (
        <p className="text-[11.5px] text-grey-500 mb-2">
          교재의 그림을 불러오는 중입니다 — 다 불러온 뒤에 필기해야 위치가 어긋나지 않아요.
        </p>
      )}
      {writable && contentReady && imageProblem && (
        <p className="text-[11.5px] text-grey-500 mb-2">
          일부 그림을 불러오지 못했습니다. 그대로 필기할 수 있지만, 그림이 나중에 나타나면
          위치가 밀릴 수 있어요.{" "}
          <button
            onClick={() => {
              setContentReady(false);
              setImageProblem(false);
              setImageRetry((n) => n + 1);
            }}
            className="font-bold text-ink underline"
          >
            다시 불러오기
          </button>
        </p>
      )}

      <div
        ref={outerRef}
        className="relative"
        style={
          layoutScale < 1
            ? {
                overflowX: zoom > 1 ? "auto" : "hidden",
                overflowY: "hidden",
                height: layoutHeight ?? undefined,
              }
            : undefined
        }
      >
        <div
          ref={wrapRef}
          className="relative"
          style={{
            width: ANNOTATION_LAYOUT_WIDTH,
            maxWidth: "none",
            transform: layoutScale < 1 ? `scale(${layoutScale * zoom})` : undefined,
            transformOrigin: "top left",
          }}
        >
          {children}
          <canvas
            ref={canvasRef}
            data-testid="material-annotation-canvas"
            className={
              "absolute top-0 left-0 " +
              (canDrawNow ? "pointer-events-auto cursor-crosshair" : "pointer-events-none")
            }
            style={{ zIndex: 5, touchAction: "none" }}
            onPointerDown={(e) => {
              if (!canDrawNow) return;
              drawingRef.current = true;
              lastPosRef.current = pos(e);
            }}
            onPointerMove={(e) => {
              if (!canDrawNow || !drawingRef.current || !lastPosRef.current) return;
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
              drawSegment(seg, role === "teacher");
              pendingRef.current.push(seg);
              mineRef.current.push(seg);
              rememberPending();
              channelRef.current?.send({
                type: "broadcast",
                event: "stroke",
                payload: { scope: myScope, seg },
              });
              lastPosRef.current = p;
            }}
            onPointerUp={() => {
              if (!drawingRef.current) return;
              drawingRef.current = false;
              scheduleSave();
            }}
            onPointerLeave={() => {
              if (!drawingRef.current) return;
              drawingRef.current = false;
              scheduleSave();
            }}
          />
        </div>
      </div>
    </div>
  );
}
