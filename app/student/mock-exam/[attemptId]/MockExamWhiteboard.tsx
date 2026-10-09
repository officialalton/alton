"use client";

// 모의고사 풀이용 화이트보드(2026-10-02 오너 확정): 응시×문항 하나당 스크래치 캔버스. 펜·지우개·전체 지우기·색 3개,
// 그리는 대로 디바운스 저장, 문항으로 돌아오면 복원. 저장소는 기존 problem_note_strokes('mock_exam') 그대로 —
// 모듈·시험 제출 후에는 서버가 쓰기를 거부하고(결과 화면은 ProblemNoteSnapshot 으로 읽기 전용 표시) 여기서도 잠근다.

import { useCallback, useEffect, useRef, useState } from "react";
import { loadProblemNoteStrokesAction, saveProblemNoteStrokesAction, type StrokeSegment } from "@/lib/problem-notes-actions";
import { drawAll } from "@/app/components/ProblemNoteCanvas";

export const WB_WIDTH = 640;
export const WB_HEIGHT = 480;
export const WB_COLORS = [
  { name: "Black", value: "#111111" },
  { name: "Red", value: "#e11d48" },
  { name: "Blue", value: "#2563eb" },
] as const;
const ERASE_RADIUS = 12;
const SAVE_DEBOUNCE_MS = 800;

/** 점 (x,y) 에서 ERASE_RADIUS 안을 지나는 선분을 지운다(선분 단위 지우개). */
export function eraseNear(strokes: StrokeSegment[], x: number, y: number, radius = ERASE_RADIUS): StrokeSegment[] {
  return strokes.filter((s) => {
    const dx = s.x1 - s.x0;
    const dy = s.y1 - s.y0;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - s.x0) * dx + (y - s.y0) * dy) / len2));
    return Math.hypot(x - (s.x0 + t * dx), y - (s.y0 + t * dy)) > radius;
  });
}

export default function MockExamWhiteboard({
  attemptId,
  itemId,
  locked = false,
  onClose,
}: {
  attemptId: string;
  itemId: string;
  locked?: boolean;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<StrokeSegment[]>([]);
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawingRef = useRef<{ x: number; y: number } | null>(null);
  const [ready, setReady] = useState(false);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState<string>(WB_COLORS[0].value);
  const [error, setError] = useState<string | null>(null);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext?.("2d");
    if (canvas && ctx) drawAll(ctx, strokesRef.current, canvas.width);
  }, []);

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (locked || !dirtyRef.current) return;
    dirtyRef.current = false;
    const r = await saveProblemNoteStrokesAction("mock_exam", attemptId, itemId, strokesRef.current);
    if (!r.ok) {
      dirtyRef.current = true;
      setError(r.error);
    } else setError(null);
  }, [attemptId, itemId, locked]);

  useEffect(() => {
    let cancelled = false;
    loadProblemNoteStrokesAction("mock_exam", attemptId, itemId)
      .then((rows) => {
        if (cancelled) return;
        strokesRef.current = rows;
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attemptId, itemId]);

  useEffect(() => {
    if (ready) redraw();
  }, [ready, redraw]);

  // 문항이 바뀌거나(부모가 key 로 다시 마운트) 닫힐 때 남은 변경을 저장한다.
  useEffect(() => () => void flush(), [flush]);

  function schedule() {
    dirtyRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
  }

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = rect.width ? WB_WIDTH / rect.width : 1;
    const sy = rect.height ? WB_HEIGHT / rect.height : 1;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    if (locked) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drawingRef.current = point(e);
    if (tool === "eraser") move(e);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    const last = drawingRef.current;
    if (locked || !last) return;
    const p = point(e);
    if (tool === "eraser") {
      const next = eraseNear(strokesRef.current, p.x, p.y);
      if (next.length !== strokesRef.current.length) {
        strokesRef.current = next;
        redraw();
        schedule();
      }
    } else {
      const seg: StrokeSegment = { x0: last.x, y0: last.y, x1: p.x, y1: p.y, color, w: WB_WIDTH };
      strokesRef.current = [...strokesRef.current, seg];
      const ctx = canvasRef.current?.getContext?.("2d");
      if (ctx) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(seg.x0, seg.y0);
        ctx.lineTo(seg.x1, seg.y1);
        ctx.stroke();
      }
      schedule();
    }
    drawingRef.current = p;
  }

  function up() {
    // 획을 마칠 때 바로 저장한다 — 디바운스 중에 모듈을 제출하면 서버가 쓰기를 거부해 마지막 획이 사라질 수 있다.
    if (drawingRef.current && dirtyRef.current) void flush();
    drawingRef.current = null;
  }

  function clearAll() {
    if (locked) return;
    strokesRef.current = [];
    redraw();
    schedule();
  }

  const btn = (active: boolean) =>
    `rounded border px-2 py-1 text-[11.5px] font-bold ${active ? "border-ink bg-ink text-white" : "border-grey-300 text-grey-600"}`;

  return (
    <aside
      aria-label="Whiteboard"
      data-testid="mst-whiteboard"
      className="fixed right-4 top-[72px] z-20 w-[min(540px,calc(100vw-2rem))] rounded-lg border border-grey-300 bg-white shadow-lg"
    >
      <div className="flex items-center gap-1.5 border-b border-grey-200 px-2.5 py-2">
        <span className="mr-1 text-[12px] font-extrabold text-ink">Whiteboard</span>
        {!locked && (
          <>
            <button type="button" className={btn(tool === "pen")} aria-pressed={tool === "pen"} onClick={() => setTool("pen")}>
              Pen
            </button>
            <button type="button" className={btn(tool === "eraser")} aria-pressed={tool === "eraser"} onClick={() => setTool("eraser")}>
              Eraser
            </button>
            {WB_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                aria-label={`${c.name} pen`}
                aria-pressed={tool === "pen" && color === c.value}
                onClick={() => {
                  setColor(c.value);
                  setTool("pen");
                }}
                className={`h-5 w-5 rounded-full border-2 ${tool === "pen" && color === c.value ? "border-ink" : "border-grey-200"}`}
                style={{ backgroundColor: c.value }}
              />
            ))}
            <button type="button" onClick={clearAll} className="ml-auto text-[11.5px] font-semibold text-grey-500 underline">
              Clear
            </button>
          </>
        )}
        <button type="button" onClick={onClose} aria-label="Close whiteboard" className={`${locked ? "ml-auto" : ""} px-1 text-[16px] leading-none text-grey-500`}>
          ×
        </button>
      </div>
      {ready ? (
        <canvas
          ref={canvasRef}
          width={WB_WIDTH}
          height={WB_HEIGHT}
          className={`w-full touch-none ${locked ? "" : "cursor-crosshair"}`}
          style={{ aspectRatio: `${WB_WIDTH} / ${WB_HEIGHT}` }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
          aria-label="Scratch canvas"
        />
      ) : (
        <p className="p-3 text-[12px] text-grey-400">Loading…</p>
      )}
      {error && <p className="px-3 pb-2 text-[11.5px] text-red">{error}</p>}
    </aside>
  );
}
