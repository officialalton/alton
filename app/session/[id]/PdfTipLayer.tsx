"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { pointerToCanvas } from "./annotation-scale";
import { TEXT_LINE_HEIGHT, TEXT_SIZE, drawPageSegment } from "./page-stroke-draw";
import { appendPdfTipEvents, loadPdfTipStrokes } from "./pdf-tip-actions";
import type { PageStrokePayload } from "./annotation-events-actions";
import { ackSaved, addStroke, emptyStore, failBatch, hasUnsaved, pageStoreKey, persist, recover, takeBatch, type StrokeWithId } from "./pdf-page-store";

// PDF 한 페이지 위의 "교사용 팁" 레이어 (2026-10-01).
//
// 기존 페이지 필기(PdfPageAnnotationLayer)와 같은 조각 그리기(page-stroke-draw)·보관함(pdf-page-store)
// ·좌표 추종(annotation-scale)을 쓴다. 다른 점: 대상이 (공개 버전, 페이지) 이고 수업과 무관하며,
//   view  선생님·관리자 — 읽기 전용. 입력 캔버스가 없어 아래 화면의 클릭을 그대로 통과시킨다.
//   edit  관리자 — 기존 도구(펜·지우개·텍스트·전체 지우기)로 쓰고 자동 저장한다.
// 대상마다 다시 마운트된다(key) — 다른 페이지 획이 섞이지 않는다. 학생·보호자 화면에는 마운트하지 않는다.

const TIP_COLORS = ["#7B3FA0", "#0E7C66", "#B45309"];
const SAVE_DELAY_MS = 600;

export type PdfTipLayerHandle = {
  flush: () => Promise<boolean>;
  hasUnsaved: () => boolean;
};

type SaveState = "idle" | "saving" | "saved" | "error";

export default forwardRef<
  PdfTipLayerHandle,
  {
    versionId: string;
    page: number;
    mode: "view" | "edit";
    viewerUserId?: string;
    width: number;
    height: number;
    onSaveStateChange?: (s: SaveState) => void;
    /** 저장이 성공한 뒤(검토 전 쪽이 고쳐지면 서버가 확인 처리한다 — 상태를 다시 읽을 때). */
    onSaved?: () => void;
    /** 이 쪽 팁을 읽었을 때 획이 있었는지. */
    onLoaded?: (info: { empty: boolean }) => void;
  }
>(function PdfTipLayer({ versionId, page, mode, viewerUserId, width, height, onSaveStateChange, onSaved, onLoaded }, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const savedRef = useRef<PageStrokePayload[]>([]);
  const storeRef = useRef(emptyStore());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const editable = mode === "edit";
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [tool, setTool] = useState<"pen" | "eraser" | "text">("pen");
  const [color, setColor] = useState(TIP_COLORS[0]);
  const [textDraft, setTextDraft] = useState<{ x: number; y: number; value: string } | null>(null);
  const [saveState, setSaveStateRaw] = useState<SaveState>("idle");

  const setSaveState = useCallback(
    (s: SaveState) => {
      setSaveStateRaw(s);
      onSaveStateChange?.(s);
    },
    [onSaveStateChange]
  );

  const storeKey =
    editable && viewerUserId
      ? pageStoreKey({ viewerUserId, sessionId: "tip", targetKey: `tip:${versionId}:${page}`, scope: "teacher_shared" })
      : null;

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    savedRef.current.forEach((s) => drawPageSegment(canvas, s, 3.2));
    [...storeRef.current.inFlight, ...storeRef.current.pending].forEach((s) => drawPageSegment(canvas, s, 3.2));
  }, []);

  // 캔버스 크기 = 렌더된 페이지 크기.
  useEffect(() => {
    const c = canvasRef.current;
    if (c && width > 0 && height > 0 && (c.width !== width || c.height !== height)) {
      c.width = width;
      c.height = height;
    }
    redraw();
  }, [width, height, redraw]);

  const flush = useCallback(async (): Promise<boolean> => {
    if (!editable) return true;
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
      const { savedEventIds } = await appendPdfTipEvents({ versionId, pageNumber: page, segments: batch });
      ackSaved(store, savedEventIds, batch);
      for (const seg of batch) {
        if (seg.tool === "clear") savedRef.current = [];
        else savedRef.current.push(seg);
      }
      if (storeKey) persist(storeKey, store);
      setSaveState(hasUnsaved(store) ? "saving" : "saved");
      onSaved?.();
      return !hasUnsaved(store);
    } catch {
      failBatch(store, batch);
      if (storeKey) persist(storeKey, store);
      setSaveState("error");
      return false;
    }
  }, [editable, storeKey, versionId, page, setSaveState, onSaved]);

  function scheduleSave() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveState("saving");
    saveTimerRef.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
  }

  useImperativeHandle(ref, () => ({ flush, hasUnsaved: () => hasUnsaved(storeRef.current) }), [flush]);

  // 이 쪽의 팁을 불러온다(쪽당 1회) + 편집이면 남겨 둔 미저장 획을 되살린다.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let strokes: PageStrokePayload[] = [];
      try {
        strokes = await loadPdfTipStrokes(versionId, page);
        if (cancelled) return;
        savedRef.current = strokes;
      } catch {
        if (cancelled) return;
        setLoadError(true);
      }
      if (storeKey) {
        const recovered = recover(storeKey);
        if (recovered.length) {
          storeRef.current.pending = [...recovered, ...storeRef.current.pending];
          persist(storeKey, storeRef.current);
          scheduleSave();
        }
      }
      const isEmpty = strokes.length === 0 && !hasUnsaved(storeRef.current);
      setEmpty(isEmpty);
      setLoaded(true);
      onLoaded?.({ empty: isEmpty });
      redraw();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionId, page, storeKey]);

  // 화면을 떠날 때 남은 획을 보관함에 둔다.
  useEffect(() => {
    const store = storeRef.current;
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (storeKey) persist(storeKey, store);
    };
  }, [storeKey]);

  function commitSegment(seg: PageStrokePayload): void {
    const withId: StrokeWithId = addStroke(storeRef.current, seg);
    drawPageSegment(canvasRef.current, withId, 3.2);
    if (storeKey) persist(storeKey, storeRef.current);
    setEmpty(false);
  }

  function commitText(): void {
    const draft = textDraft;
    setTextDraft(null);
    if (!draft) return;
    const text = draft.value.replace(/\s+$/, "");
    if (!text.trim()) return;
    commitSegment({ x0: draft.x, y0: draft.y, x1: draft.x, y1: draft.y, color, tool: "text", text, size: TEXT_SIZE, w: canvasRef.current?.width });
    scheduleSave();
  }

  async function clearAll(): Promise<void> {
    if (typeof window !== "undefined" && !window.confirm("이 페이지의 팁을 모두 지울까요?")) return;
    await flush();
    savedRef.current = [];
    commitSegment({ x0: 0, y0: 0, x1: 0, y1: 0, color, tool: "clear", w: canvasRef.current?.width });
    redraw();
    setEmpty(true);
    await flush();
  }

  const canDraw = editable && drawMode && loaded && width > 0;
  const layerStyle = width > 0 && height > 0 ? { width: `${width}px`, height: `${height}px` } : undefined;

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = e.currentTarget;
    return pointerToCanvas(e.clientX, e.clientY, canvas.getBoundingClientRect(), canvas);
  }

  return (
    <div className="absolute inset-0 pointer-events-none" data-testid="pdf-tip-layer-root" data-mode={mode}>
      {/* 교사용 팁임을 한눈에 — 선생님 자기 필기(검정·빨강·파랑)와 섞이지 않게 점선 테두리 + 라벨. */}
      <div
        className="absolute top-0 left-0 pointer-events-none"
        style={{ outline: "2px dashed rgba(123,63,160,0.55)", outlineOffset: "-2px", zIndex: 4, ...layerStyle }}
      />
      <canvas
        ref={canvasRef}
        data-testid="pdf-tip-layer"
        className="absolute top-0 left-0 pointer-events-none"
        style={{ zIndex: 4, ...layerStyle }}
      />
      {editable && (
        <canvas
          data-testid="pdf-tip-input-layer"
          width={width}
          height={height}
          className={"absolute top-0 left-0 " + (canDraw ? "pointer-events-auto cursor-crosshair" : "pointer-events-none")}
          style={{ zIndex: 7, touchAction: "none", ...layerStyle }}
          onPointerDown={(e) => {
            if (!canDraw) return;
            if (tool === "text") {
              e.preventDefault();
              return;
            }
            drawingRef.current = true;
            lastPosRef.current = pos(e);
          }}
          onPointerMove={(e) => {
            if (!canDraw || !drawingRef.current || !lastPosRef.current || tool === "text") return;
            const p = pos(e);
            commitSegment({ x0: lastPosRef.current.x, y0: lastPosRef.current.y, x1: p.x, y1: p.y, color, tool, w: canvasRef.current?.width });
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

      {editable && textDraft && width > 0 && (
        <textarea
          autoFocus
          aria-label="팁 텍스트"
          data-testid="pdf-tip-text-input"
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
          className="absolute pointer-events-auto bg-white/90 border-2 rounded px-1.5 py-1 outline-none resize-none font-semibold text-ink shadow-md"
          style={{
            zIndex: 9,
            borderColor: "#7B3FA0",
            left: `${(textDraft.x / width) * 100}%`,
            top: `${(textDraft.y / height) * 100}%`,
            fontSize: `${(TEXT_SIZE * (canvasRef.current?.getBoundingClientRect().width ?? width)) / width}px`,
            lineHeight: TEXT_LINE_HEIGHT,
            minWidth: "24ch",
            maxWidth: "70%",
          }}
          rows={Math.max(5, textDraft.value.split("\n").length + 1)}
        />
      )}

      {editable && (
        <div
          className="absolute top-2 left-2 pointer-events-auto flex flex-wrap items-center gap-1.5 bg-white/70 backdrop-blur-sm border shadow-sm rounded-lg px-2 py-1 max-w-[calc(100%-1rem)]"
          style={{ zIndex: 8, borderColor: "rgba(123,63,160,0.4)" }}
          data-testid="pdf-tip-toolbar"
        >
          <span className="text-[11px] font-extrabold" style={{ color: "#7B3FA0" }}>교사용 팁</span>
          <button
            type="button"
            disabled={!loaded}
            onClick={() => setDrawMode((v) => !v)}
            aria-pressed={drawMode}
            className={"text-[11.5px] font-bold px-2 py-1 rounded disabled:opacity-60 " + (drawMode ? "bg-ink text-white" : "text-ink")}
          >
            {!loaded ? "팁 불러오는 중…" : drawMode ? "✏️ 팁 쓰기 끄기" : "✏️ 팁 쓰기 시작"}
          </button>
          {drawMode && (
            <>
              <button type="button" onClick={() => setTool("pen")} aria-pressed={tool === "pen"} className={"text-[11.5px] px-1.5 py-1 rounded " + (tool === "pen" ? "bg-grey-100 font-bold" : "")}>펜</button>
              <button type="button" onClick={() => setTool("eraser")} aria-pressed={tool === "eraser"} className={"text-[11.5px] px-1.5 py-1 rounded " + (tool === "eraser" ? "bg-grey-100 font-bold" : "")}>지우개</button>
              <button type="button" onClick={() => setTool("text")} aria-pressed={tool === "text"} title="클릭한 자리에 글을 쓴다" className={"text-[11.5px] px-1.5 py-1 rounded " + (tool === "text" ? "bg-grey-100 font-bold" : "")}>T 텍스트</button>
              <button type="button" onClick={() => void clearAll()} title="이 페이지의 팁을 모두 지운다" className="text-[11.5px] px-1.5 py-1 rounded text-red">전체 지우기</button>
              {TIP_COLORS.map((c) => (
                <button key={c} type="button" aria-label={`색 ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} className={"w-4 h-4 rounded-full border-2 " + (color === c ? "border-ink" : "border-transparent")} style={{ backgroundColor: c }} />
              ))}
            </>
          )}
          {drawMode && tool === "text" && !textDraft && (
            <span className="text-[11px] font-semibold text-ink bg-yellow-50 border border-yellow-200 rounded px-1.5 py-0.5">페이지에서 글을 놓을 자리를 클릭하세요</span>
          )}
          <span data-testid="pdf-tip-save-state" className={"text-[11px] font-semibold " + (saveState === "error" ? "text-red" : "text-grey-500")}>
            {saveState === "saving" ? "저장 중…" : saveState === "saved" ? "저장됨" : saveState === "error" ? "저장 안 됨" : ""}
          </span>
          {saveState === "error" && (
            <button type="button" onClick={() => void flush()} className="text-[11px] font-bold text-red underline">다시 시도</button>
          )}
        </div>
      )}

      {/* 상태 안내 — 읽기 전용 화면은 조용히(빈·오류는 표시하지 않는다: 교재 사용을 방해하지 않는다). */}
      {editable && loaded && loadError && (
        <p className="absolute bottom-2 left-2 text-[12px] text-red bg-white/80 rounded px-2 py-1 pointer-events-none" style={{ zIndex: 8 }} data-testid="pdf-tip-load-error">팁을 불러오지 못했습니다.</p>
      )}
      {editable && loaded && !loadError && empty && !drawMode && (
        <p className="absolute bottom-2 left-2 text-[12px] text-grey-500 bg-white/80 rounded px-2 py-1 pointer-events-none" style={{ zIndex: 8 }} data-testid="pdf-tip-empty">이 쪽에는 팁이 없습니다.</p>
      )}
    </div>
  );
});
