"use client";

// 모의고사 풀이용 화이트보드(2026-10-02 오너 확정): 응시×문항 하나당 스크래치 캔버스. 펜·지우개·전체 지우기·색 3개,
// 그리는 대로 디바운스 저장, 문항으로 돌아오면 복원. 저장소는 기존 problem_note_strokes('mock_exam') 그대로 —
// 모듈·시험 제출 후에는 서버가 쓰기를 거부하고(결과 화면은 ProblemNoteSnapshot 으로 읽기 전용 표시) 여기서도 잠근다.
// 2026-10-13: 보드를 키울 수 있다(Small/Medium/Large/Extra large, −/+, 드래그 핸들·키보드). 논리 폭 640 고정 × 높이 가변,
// 선분 좌표는 크기와 무관(영역만 늘고 줄일 땐 그린 곳 아래까지만). 높이는 필기와 함께 서버(problem_note_strokes.board_height)에 저장.
// 크기 조절 UI 는 FRQ 손글씨 패드와 같은 BoardSizeControls 를 쓴다.

import { useCallback, useEffect, useRef, useState } from "react";
import { loadProblemNoteBoardAction, saveProblemNoteBoardAction, type StrokeSegment } from "@/lib/problem-notes-actions";
import { drawAll } from "@/app/components/ProblemNoteCanvas";
import { WB_H_PRESETS, WB_MAX_H, WB_MAX_SEGMENTS, WB_MIN_H, WB_TOO_LARGE, WB_WIDTH, clampWbHeight, wbSizeProblem } from "@/lib/mock-exam/whiteboard-size";
import { BoardResizeHandle, BoardScrollGutter, BoardSizeButtons } from "./BoardSizeControls";

export { WB_WIDTH };
export const WB_HEIGHT = WB_MIN_H; // 기본(Small) 높이 — 기존 고정 크기
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
  const penSeenRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [height, setHeightState] = useState<number>(WB_MIN_H);
  const heightRef = useRef<number>(WB_MIN_H);
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
    const tooLarge = wbSizeProblem(strokesRef.current);
    if (tooLarge) {
      setError(tooLarge);
      return;
    }
    dirtyRef.current = false;
    const r = await saveProblemNoteBoardAction("mock_exam", attemptId, itemId, strokesRef.current, heightRef.current);
    if (!r.ok) {
      dirtyRef.current = true;
      setError(r.error);
    } else setError(null);
  }, [attemptId, itemId, locked]);

  useEffect(() => {
    let cancelled = false;
    loadProblemNoteBoardAction("mock_exam", attemptId, itemId)
      .then((board) => {
        if (cancelled) return;
        strokesRef.current = board.strokes;
        heightRef.current = clampWbHeight(board.boardHeight, board.strokes);
        setHeightState(heightRef.current);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [attemptId, itemId]);

  // 높이가 바뀌면 canvas 속성이 비워지므로 다시 그린다(선분 좌표는 그대로).
  useEffect(() => {
    if (ready) redraw();
  }, [ready, height, redraw]);

  // 문항이 바뀌거나(부모가 key 로 다시 마운트) 닫힐 때 남은 변경을 저장한다.
  useEffect(() => () => void flush(), [flush]);

  function schedule() {
    dirtyRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
  }

  const setHeight = (h: number) => {
    if (locked) return;
    const next = clampWbHeight(h, strokesRef.current);
    if (next === heightRef.current) return;
    heightRef.current = next;
    setHeightState(next);
    schedule();
  };

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = rect.width ? WB_WIDTH / rect.width : 1;
    const sy = rect.height ? heightRef.current / rect.height : 1;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    if (locked) return;
    if (e.pointerType === "pen") penSeenRef.current = true;
    if (e.pointerType === "touch" && penSeenRef.current) return; // 스타일러스를 쓰는 중 손바닥 접촉 무시
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
      if (strokesRef.current.length >= WB_MAX_SEGMENTS) {
        setError(WB_TOO_LARGE);
        return;
      }
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

  // 큰 보드는 패널도 넓힌다(Large 이상). 패널 높이는 화면에 맞추고 보드 영역만 세로 스크롤한다.
  const wide = height >= 1000;

  return (
    <aside
      aria-label="Whiteboard"
      data-testid="mst-whiteboard"
      className={`fixed right-4 top-[72px] z-20 flex max-h-[calc(100vh-88px)] flex-col rounded-lg border border-grey-300 bg-white shadow-lg ${
        wide ? "w-[min(720px,calc(100vw-2rem))]" : "w-[min(540px,calc(100vw-2rem))]"
      }`}
    >
      <div className="flex flex-wrap items-center gap-1.5 border-b border-grey-200 px-2.5 py-2">
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
            <BoardSizeButtons presets={WB_H_PRESETS} height={height} onSet={setHeight} groupTestId="wb-size" presetTestId={(h) => `wb-size-${h}`} />
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
        <>
          <div className="flex min-h-0 flex-1 overflow-y-auto">
            <canvas
              ref={canvasRef}
              width={WB_WIDTH}
              height={height}
              className={`block h-fit w-full touch-none ${locked ? "" : "cursor-crosshair"}`}
              style={{ aspectRatio: `${WB_WIDTH} / ${height}` }}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
              onPointerLeave={up}
              aria-label="Scratch canvas"
              data-testid="wb-canvas"
            />
            {/* 모바일: 캔버스는 touch-action:none(그리기). 오른쪽 띠(pan-y)로 보드 영역을 스크롤한다. */}
            <BoardScrollGutter testId="wb-scroll-gutter" />
          </div>
          {!locked && (
            <BoardResizeHandle
              height={height}
              min={WB_MIN_H}
              max={WB_MAX_H}
              logicalWidth={WB_WIDTH}
              getCanvasWidth={() => canvasRef.current?.getBoundingClientRect().width}
              ariaLabel="Whiteboard height"
              testId="wb-resize"
              onSet={setHeight}
            />
          )}
        </>
      ) : (
        <p className="p-3 text-[12px] text-grey-400">Loading…</p>
      )}
      {error && <p className="px-3 pb-2 text-[11.5px] text-red">{error}</p>}
    </aside>
  );
}
