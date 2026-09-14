"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import { annotationScale, pointerToCanvas } from "./annotation-scale";
import {
  appendPageStrokeEvents,
  loadPageStrokes,
  type PageStrokePayload,
  type StrokeLayerTarget,
} from "./annotation-events-actions";
import {
  ackSaved,
  addStroke,
  emptyStore,
  failBatch,
  hasUnsaved,
  pageStoreKey,
  persist,
  recover,
  strokeTargetKey,
  takeBatch,
  type PageStrokeScope,
  type StrokeWithId,
} from "./pdf-page-store";
import type { MaterialLayerRole } from "./MaterialAnnotationLayers";

// PDF 한 페이지 위의 필기 — 교사 공유 / 학생 공유 두 레이어.
//
// 기존 MaterialAnnotationLayers 와 다른 점 세 가지(2026-09-14 조사 문서):
//   1. 대상이 (수업, 공개 버전, 자료, 페이지) 다. 이 컴포넌트는 대상마다 **다시 마운트**
//      되고(key), 보관함·채널·조회가 전부 그 대상으로 좁혀진다 — 다른 페이지의 획이 섞이지
//      않는다. 저장 응답이 늦게 와도 그 응답은 이 인스턴스의 보관함에만 닿는다.
//   2. 대기 중·전송 중 획을 둘 다 남기고, 서버가 확인한 것만 지운다(pdf-page-store).
//   3. 교사·학생 레이어를 **각자의 캔버스**에 그린다. 지우개(destination-out)는 자기
//      캔버스에만 닿으므로 상대 필기를 지우지 못한다.
//
// 좌표는 그릴 때의 캔버스 너비(w)를 함께 저장해 확대·창 크기 변화에도 자리를 지킨다
// (annotation-scale). 캔버스 크기는 렌더된 PDF 페이지 크기에 맞춘다(부모가 준다).

const COLORS = ["#1A1A1A", "#C8102E", "#1B6FB0"];
const SAVE_DELAY_MS = 600;
// 텍스트 상자 글자 크기(캔버스 px, 그릴 때 너비 기준) — 2026-09-14 UAT: PC 수업 교사의 타이핑 필기.
const TEXT_SIZE = 18;
const TEXT_LINE_HEIGHT = 1.3;

export type PdfPageAnnotationHandle = {
  /** 대기 중 획을 지금 저장한다. 성공(또는 저장할 것이 없음)이면 true. */
  flush: () => Promise<boolean>;
  hasUnsaved: () => boolean;
};

export default forwardRef<
  PdfPageAnnotationHandle,
  {
    /** PDF 페이지 또는 문제 한 장(2026-09-14) — 대상마다 다시 마운트된다(key). */
    target: StrokeLayerTarget;
    role: MaterialLayerRole;
    viewerUserId?: string;
    /** 렌더된 페이지의 픽셀 크기. 0 이면 아직 렌더 전 — 입력을 열지 않는다. */
    width: number;
    height: number;
    onSaveStateChange?: (state: "idle" | "saving" | "saved" | "error") => void;
  }
>(function PdfPageAnnotationLayer({ target, role, viewerUserId, width, height, onSaveStateChange }, ref) {
  const teacherCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const studentCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const drawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storeRef = useRef(emptyStore());
  const teacherStrokesRef = useRef<PageStrokePayload[]>([]);
  const studentStrokesRef = useRef<PageStrokePayload[]>([]);

  const [drawMode, setDrawMode] = useState(false);
  const [tool, setTool] = useState<"pen" | "eraser" | "text">("pen");
  /** 텍스트 도구로 클릭한 자리(캔버스 좌표). 입력 중이면 값이 있다. */
  const [textDraft, setTextDraft] = useState<{ x: number; y: number; value: string } | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const [showTeacher, setShowTeacher] = useState(true);
  const [showStudent, setShowStudent] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveStateRaw] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const setSaveState = useCallback(
    (s: "idle" | "saving" | "saved" | "error") => {
      setSaveStateRaw(s);
      onSaveStateChange?.(s);
    },
    [onSaveStateChange]
  );

  const myScope: PageStrokeScope | null =
    role === "teacher" ? "teacher_shared" : role === "student" ? "student_shared" : null;
  const targetKey = strokeTargetKey(target);
  const storeKey =
    viewerUserId && myScope
      ? pageStoreKey({ viewerUserId, sessionId: target.sessionId, targetKey, scope: myScope })
      : null;

  const canvasFor = (scope: PageStrokeScope) =>
    scope === "teacher_shared" ? teacherCanvasRef.current : studentCanvasRef.current;

  const drawSegment = useCallback((scope: PageStrokeScope, seg: PageStrokePayload) => {
    const canvas = canvasFor(scope);
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const scale = annotationScale(canvas.width, seg.w);
    if (seg.tool === "clear") {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    if (seg.tool === "text") {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = seg.color;
      const size = (seg.size ?? TEXT_SIZE) * scale;
      ctx.font = `600 ${size}px system-ui, -apple-system, sans-serif`;
      ctx.textBaseline = "top";
      (seg.text ?? "").split("\n").forEach((line, i) => {
        ctx.fillText(line, seg.x0 * scale, seg.y0 * scale + i * size * TEXT_LINE_HEIGHT);
      });
      return;
    }
    ctx.lineCap = "round";
    if (seg.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = 22 * scale;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = seg.color;
      ctx.lineWidth = (scope === "teacher_shared" ? 3.2 : 2.5) * scale;
    }
    ctx.beginPath();
    ctx.moveTo(seg.x0 * scale, seg.y0 * scale);
    ctx.lineTo(seg.x1 * scale, seg.y1 * scale);
    ctx.stroke();
  }, []);

  const redraw = useCallback(() => {
    for (const scope of ["teacher_shared", "student_shared"] as PageStrokeScope[]) {
      const canvas = canvasFor(scope);
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) continue;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const saved = scope === "teacher_shared" ? teacherStrokesRef.current : studentStrokesRef.current;
      saved.forEach((s) => drawSegment(scope, s));
      if (scope === myScope) {
        [...storeRef.current.inFlight, ...storeRef.current.pending].forEach((s) => drawSegment(scope, s));
      }
    }
  }, [drawSegment, myScope]);

  // 캔버스 크기 = 렌더된 페이지 크기.
  useEffect(() => {
    for (const c of [teacherCanvasRef.current, studentCanvasRef.current]) {
      if (!c || width <= 0 || height <= 0) continue;
      if (c.width !== width || c.height !== height) {
        c.width = width;
        c.height = height;
      }
    }
    redraw();
  }, [width, height, redraw]);

  // 저장된 필기 + 남겨 둔 미저장 획을 불러온다 — 이 대상만.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [teacher, student] = await Promise.all([
          loadPageStrokes(target, "teacher_shared"),
          loadPageStrokes(target, "student_shared"),
        ]);
        if (cancelled) return;
        teacherStrokesRef.current = teacher;
        studentStrokesRef.current = student;
      } catch {
        // 조회 실패 — 빈 페이지로 시작하되 새 필기는 저장한다.
      }
      if (cancelled) return;
      if (storeKey) {
        const recovered = recover(storeKey);
        if (recovered.length) {
          storeRef.current.pending = [...recovered, ...storeRef.current.pending];
          persist(storeKey, storeRef.current);
          scheduleSave();
        }
      }
      setLoaded(true);
      redraw();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.sessionId, targetKey, storeKey]);

  // 실시간 — 이 페이지 채널만. 상대 획은 상대 레이어에 그린다.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`session-pdf-page:${target.sessionId}:${targetKey}`);
    channel
      .on("broadcast", { event: "stroke" }, ({ payload }) => {
        const incoming = payload as { scope: PageStrokeScope; seg: PageStrokePayload };
        if (!incoming?.seg || !incoming.scope) return;
        if (myScope && incoming.scope === myScope) return;
        const bucket = incoming.scope === "teacher_shared" ? teacherStrokesRef : studentStrokesRef;
        if (incoming.seg.tool === "clear") {
          // 상대가 자기 레이어를 전부 지웠다 — 그 레이어만 비운다.
          bucket.current = [];
          drawSegment(incoming.scope, incoming.seg);
          return;
        }
        bucket.current.push(incoming.seg);
        const visible = incoming.scope === "teacher_shared" ? showTeacher : showStudent;
        if (visible) drawSegment(incoming.scope, incoming.seg);
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, [target.sessionId, targetKey, myScope, showTeacher, showStudent, drawSegment]);

  const flush = useCallback(async (): Promise<boolean> => {
    if (!myScope) return true;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const store = storeRef.current;
    const batch = takeBatch(store);
    if (batch.length === 0) {
      if (!hasUnsaved(store)) setSaveState("idle");
      return !hasUnsaved(store);
    }
    if (storeKey) persist(storeKey, store);
    setSaveState("saving");
    try {
      const { savedEventIds } = await appendPageStrokeEvents({ target, segments: batch, scope: myScope });
      ackSaved(store, savedEventIds, batch);
      // 저장된 획은 이제 "저장된 필기" 목록에 있어야 한다 — 보관함에서만 지우면 다음 다시 그리기(창 크기
      // 변경·확대)에서 사라진다(2026-09-14 UAT: 창을 줄이자 필기가 통째로 없어졌다).
      const own = myScope === "teacher_shared" ? teacherStrokesRef : studentStrokesRef;
      for (const seg of batch) {
        if (seg.tool === "clear") own.current = [];
        else own.current.push(seg);
      }
      if (storeKey) persist(storeKey, store);
      setSaveState(hasUnsaved(store) ? "saving" : "saved");
      return !hasUnsaved(store);
    } catch {
      failBatch(store, batch);
      if (storeKey) persist(storeKey, store);
      setSaveState("error");
      return false;
    }
  }, [myScope, storeKey, target, setSaveState]);

  function scheduleSave() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveState("saving");
    saveTimerRef.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
  }

  useImperativeHandle(ref, () => ({ flush, hasUnsaved: () => hasUnsaved(storeRef.current) }), [flush]);

  // 화면을 떠날 때 남은 획을 보관함에 둔다(다음 방문에서 복구·재시도).
  useEffect(() => {
    const store = storeRef.current; // 이 인스턴스의 보관함 하나 — 마운트 내내 같은 객체다.
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (storeKey) persist(storeKey, store);
    };
  }, [storeKey]);

  const ownCanvas = myScope === "teacher_shared" ? teacherCanvasRef : studentCanvasRef;

  /** 내 레이어에 조각 하나를 더한다 — 그리고, 보관하고, 상대에게 보내고, 저장을 예약한다. */
  function commitSegment(seg: PageStrokePayload): void {
    if (!myScope) return;
    const withId: StrokeWithId = addStroke(storeRef.current, seg);
    drawSegment(myScope, withId);
    if (storeKey) persist(storeKey, storeRef.current);
    channelRef.current?.send({ type: "broadcast", event: "stroke", payload: { scope: myScope, seg: withId } });
  }

  function commitText(): void {
    const draft = textDraft;
    setTextDraft(null);
    if (!draft || !myScope) return;
    const text = draft.value.replace(/\s+$/, "");
    if (!text.trim()) return;
    commitSegment({
      x0: draft.x,
      y0: draft.y,
      x1: draft.x,
      y1: draft.y,
      color,
      tool: "text",
      text,
      size: TEXT_SIZE,
      w: ownCanvas.current?.width,
    });
    scheduleSave();
  }

  /**
   * 이 페이지의 내 필기 전체 지우기(2026-09-14 UAT). 상대 레이어는 건드리지 않는다.
   * 먼저 대기 중 획을 저장한 뒤 clear 를 남긴다 — 그래야 서버 순서가 "획 → 지우기"로 남아
   * 다시 열었을 때 지운 획이 되살아나지 않는다.
   */
  async function clearMine(): Promise<void> {
    if (!myScope) return;
    if (typeof window !== "undefined" && !window.confirm("이 페이지의 내 필기를 모두 지울까요?")) return;
    await flush();
    if (myScope === "teacher_shared") teacherStrokesRef.current = [];
    else studentStrokesRef.current = [];
    commitSegment({ x0: 0, y0: 0, x1: 0, y1: 0, color, tool: "clear", w: ownCanvas.current?.width });
    redraw();
    await flush();
  }

  const canDraw = myScope !== null && drawMode && loaded && width > 0 && (myScope === "teacher_shared" ? showTeacher : showStudent);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = e.currentTarget;
    return pointerToCanvas(e.clientX, e.clientY, canvas.getBoundingClientRect(), canvas);
  }

  // 2026-09-14 UAT: 창을 줄이면 페이지는 작아지는데 필기는 그대로였다 — 레이어가 부모 폭(w-full)을 따라
  // 페이지보다 커질 수 있었다. 렌더된 페이지 크기(논리 px)에 **정확히** 맞춘다.
  const layerStyle = width > 0 && height > 0 ? { width: `${width}px`, height: `${height}px` } : undefined;

  return (
    // 2026-09-14 UAT: "화면에 클릭 자체가 안 된다" — 이 감싸는 div 가 문제 화면 전체를 덮고 있어서 선택지·버튼
    // 클릭을 먹었다. 감싸는 쪽은 클릭을 통과시키고, 입력 캔버스(필기 중)·도구 막대·글 상자만 받는다.
    <div className="absolute inset-0 pointer-events-none" data-testid="pdf-page-annotation-layer">
      <canvas
        ref={teacherCanvasRef}
        data-testid="pdf-teacher-layer"
        className="absolute top-0 left-0 pointer-events-none"
        style={{ visibility: showTeacher ? "visible" : "hidden", zIndex: 6, ...layerStyle }}
      />
      <canvas
        ref={studentCanvasRef}
        data-testid="pdf-student-layer"
        className="absolute top-0 left-0 pointer-events-none"
        style={{ visibility: showStudent ? "visible" : "hidden", zIndex: 5, ...layerStyle }}
      />
      {/* 입력은 자기 레이어 캔버스 위의 투명 캔버스가 받는다 — 어느 레이어가 위에 있든 상관없이. */}
      {myScope && (
        <canvas
          data-testid="pdf-input-layer"
          width={width}
          height={height}
          className={
            "absolute top-0 left-0 " +
            (canDraw ? "pointer-events-auto cursor-crosshair" : "pointer-events-none")
          }
          style={{ zIndex: 7, touchAction: "none", ...layerStyle }}
          onPointerDown={(e) => {
            if (!canDraw) return;
            if (tool === "text") {
              // 글 상자는 pointerUp 에서 만든다 — pointerDown 에서 만들면 곧 이어지는 pointerUp/click 이
              // 새 상자의 포커스를 빼앗아 blur → 빈 상자 제거로 사라졌다(2026-09-14 UAT: "클릭이 안 된다").
              e.preventDefault();
              return;
            }
            drawingRef.current = true;
            lastPosRef.current = pos(e);
          }}
          onPointerMove={(e) => {
            if (!canDraw || !drawingRef.current || !lastPosRef.current || tool === "text") return;
            const p = pos(e);
            commitSegment({
              x0: lastPosRef.current.x,
              y0: lastPosRef.current.y,
              x1: p.x,
              y1: p.y,
              color,
              tool,
              w: ownCanvas.current?.width,
            });
            lastPosRef.current = p;
          }}
          onPointerUp={(e) => {
            if (canDraw && tool === "text") {
              if (textDraft) commitText();
              const p = pos(e);
              setTextDraft({ x: p.x, y: p.y, value: "" });
              return;
            }
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
      )}

      {textDraft && myScope && width > 0 && (
        <textarea
          autoFocus
          aria-label="텍스트 필기"
          data-testid="pdf-text-input"
          value={textDraft.value}
          onChange={(e) => setTextDraft((d) => (d ? { ...d, value: e.target.value } : d))}
          onBlur={() => commitText()}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              setTextDraft(null);
            } else if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commitText();
            }
          }}
          placeholder="입력 후 Enter (줄바꿈은 Shift+Enter)"
          className="absolute pointer-events-auto bg-white/90 border-2 border-red rounded px-1.5 py-1 outline-none resize-none font-semibold text-ink shadow-md"
          style={{
            zIndex: 9,
            left: `${(textDraft.x / width) * 100}%`,
            top: `${(textDraft.y / height) * 100}%`,
            fontSize: `${(TEXT_SIZE * (ownCanvas.current?.getBoundingClientRect().width ?? width)) / width}px`,
            lineHeight: TEXT_LINE_HEIGHT,
            minWidth: "12ch",
            maxWidth: "60%",
          }}
          rows={1}
        />
      )}

      <div
        className="absolute top-2 right-2 pointer-events-auto flex flex-wrap items-center gap-1.5 bg-white/60 backdrop-blur-sm border border-white/60 shadow-sm rounded-lg px-2 py-1"
        style={{ zIndex: 8 }}
      >
        {myScope && (
          <>
            <button
              type="button"
              disabled={!loaded}
              onClick={() => setDrawMode((v) => !v)}
              aria-pressed={drawMode}
              className={"text-[11.5px] font-bold px-2 py-1 rounded disabled:opacity-60 " + (drawMode ? "bg-ink text-white" : "text-ink")}
            >
              {!loaded ? "필기 준비 중…" : drawMode ? "✏️ 필기 끄기" : "✏️ 필기 시작"}
            </button>
            {drawMode && (
              <>
                <button type="button" onClick={() => setTool("pen")} aria-pressed={tool === "pen"} className={"text-[11.5px] px-1.5 py-1 rounded " + (tool === "pen" ? "bg-grey-100 font-bold" : "")}>펜</button>
                <button type="button" onClick={() => setTool("eraser")} aria-pressed={tool === "eraser"} className={"text-[11.5px] px-1.5 py-1 rounded " + (tool === "eraser" ? "bg-grey-100 font-bold" : "")}>지우개</button>
                <button type="button" onClick={() => setTool("text")} aria-pressed={tool === "text"} title="클릭한 자리에 글을 쓴다" className={"text-[11.5px] px-1.5 py-1 rounded " + (tool === "text" ? "bg-grey-100 font-bold" : "")}>T 텍스트</button>
                <button type="button" onClick={() => void clearMine()} title="이 페이지의 내 필기를 모두 지운다" className="text-[11.5px] px-1.5 py-1 rounded text-red">전체 지우기</button>
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`색 ${c}`}
                    aria-pressed={color === c}
                    onClick={() => setColor(c)}
                    className={"w-4 h-4 rounded-full border-2 " + (color === c ? "border-ink" : "border-transparent")}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </>
            )}
          </>
        )}
        {myScope && drawMode && tool === "text" && !textDraft && (
          <span className="text-[11px] font-semibold text-ink bg-yellow-50 border border-yellow-200 rounded px-1.5 py-0.5" data-testid="pdf-text-hint">
            페이지에서 글을 놓을 자리를 클릭하세요
          </span>
        )}
        <label className="text-[11px] text-grey-500 flex items-center gap-1">
          <input type="checkbox" checked={showTeacher} onChange={(e) => setShowTeacher(e.target.checked)} /> 선생님
        </label>
        <label className="text-[11px] text-grey-500 flex items-center gap-1">
          <input type="checkbox" checked={showStudent} onChange={(e) => setShowStudent(e.target.checked)} /> 학생
        </label>
        <span
          data-testid="pdf-save-state"
          className={"text-[11px] font-semibold " + (saveState === "error" ? "text-red" : "text-grey-500")}
        >
          {saveState === "saving" ? "저장 중…" : saveState === "saved" ? "저장됨" : saveState === "error" ? "저장 안 됨" : ""}
        </span>
        {saveState === "error" && (
          <button type="button" onClick={() => void flush()} className="text-[11px] font-bold text-red underline">
            다시 시도
          </button>
        )}
      </div>
    </div>
  );
});
