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
  type PageStrokeTarget,
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

export type PdfPageAnnotationHandle = {
  /** 대기 중 획을 지금 저장한다. 성공(또는 저장할 것이 없음)이면 true. */
  flush: () => Promise<boolean>;
  hasUnsaved: () => boolean;
};

export default forwardRef<
  PdfPageAnnotationHandle,
  {
    target: PageStrokeTarget;
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
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
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
  const storeKey =
    viewerUserId && myScope
      ? pageStoreKey({
          viewerUserId,
          sessionId: target.sessionId,
          curriculumDocVersionId: target.curriculumDocVersionId,
          pageNumber: target.pageNumber,
          scope: myScope,
        })
      : null;

  const canvasFor = (scope: PageStrokeScope) =>
    scope === "teacher_shared" ? teacherCanvasRef.current : studentCanvasRef.current;

  const drawSegment = useCallback((scope: PageStrokeScope, seg: PageStrokePayload) => {
    const canvas = canvasFor(scope);
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
  }, [target.sessionId, target.curriculumDocVersionId, target.pageNumber, storeKey]);

  // 실시간 — 이 페이지 채널만. 상대 획은 상대 레이어에 그린다.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(
      `session-pdf-page:${target.sessionId}:${target.curriculumDocVersionId}:${target.pageNumber}`
    );
    channel
      .on("broadcast", { event: "stroke" }, ({ payload }) => {
        const incoming = payload as { scope: PageStrokeScope; seg: PageStrokePayload };
        if (!incoming?.seg || !incoming.scope) return;
        if (myScope && incoming.scope === myScope) return;
        if (incoming.scope === "teacher_shared") teacherStrokesRef.current.push(incoming.seg);
        else studentStrokesRef.current.push(incoming.seg);
        const visible = incoming.scope === "teacher_shared" ? showTeacher : showStudent;
        if (visible) drawSegment(incoming.scope, incoming.seg);
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, [target.sessionId, target.curriculumDocVersionId, target.pageNumber, myScope, showTeacher, showStudent, drawSegment]);

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

  const canDraw = myScope !== null && drawMode && loaded && width > 0 && (myScope === "teacher_shared" ? showTeacher : showStudent);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = e.currentTarget;
    return pointerToCanvas(e.clientX, e.clientY, canvas.getBoundingClientRect(), canvas);
  }

  const ownCanvas = myScope === "teacher_shared" ? teacherCanvasRef : studentCanvasRef;

  return (
    <div className="absolute inset-0" data-testid="pdf-page-annotation-layer">
      <canvas
        ref={teacherCanvasRef}
        data-testid="pdf-teacher-layer"
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        style={{ visibility: showTeacher ? "visible" : "hidden", zIndex: 6 }}
      />
      <canvas
        ref={studentCanvasRef}
        data-testid="pdf-student-layer"
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        style={{ visibility: showStudent ? "visible" : "hidden", zIndex: 5 }}
      />
      {/* 입력은 자기 레이어 캔버스 위의 투명 캔버스가 받는다 — 어느 레이어가 위에 있든 상관없이. */}
      {myScope && (
        <canvas
          data-testid="pdf-input-layer"
          width={width}
          height={height}
          className={
            "absolute top-0 left-0 w-full h-full " +
            (canDraw ? "pointer-events-auto cursor-crosshair" : "pointer-events-none")
          }
          style={{ zIndex: 7, touchAction: "none" }}
          onPointerDown={(e) => {
            if (!canDraw) return;
            drawingRef.current = true;
            lastPosRef.current = pos(e);
          }}
          onPointerMove={(e) => {
            if (!canDraw || !drawingRef.current || !lastPosRef.current) return;
            const p = pos(e);
            const seg: PageStrokePayload = {
              x0: lastPosRef.current.x,
              y0: lastPosRef.current.y,
              x1: p.x,
              y1: p.y,
              color,
              tool,
              w: ownCanvas.current?.width,
            };
            const withId: StrokeWithId = addStroke(storeRef.current, seg);
            drawSegment(myScope, withId);
            if (storeKey) persist(storeKey, storeRef.current);
            channelRef.current?.send({ type: "broadcast", event: "stroke", payload: { scope: myScope, seg: withId } });
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
      )}

      <div
        className="absolute top-2 right-2 flex flex-wrap items-center gap-1.5 bg-white/60 backdrop-blur-sm border border-white/60 shadow-sm rounded-lg px-2 py-1"
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
