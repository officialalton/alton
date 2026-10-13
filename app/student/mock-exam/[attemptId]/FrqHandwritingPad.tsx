"use client";

// AP 종이 FRQ 과목의 파트별 손글씨 패드(2026-10-13). 펜·지우개(획 단위)·되돌리기·전체 지우기·색 3개. 마우스·터치·스타일러스 모두 포인터 이벤트로 처리한다.
// 저장은 부모가 한다: 획이 끝날 때마다 onChange(새 획 배열)만 호출한다(디바운스·flush·서버 시계 오류 처리는 ApExamTakeClient 의 useFrqInk).
import { useCallback, useEffect, useRef, useState } from "react";
import { INK_COLORS, INK_H_PRESETS, INK_MAX_H, INK_W, clampBoardHeight, eraseStrokesNear, simplifyPoints, type InkStroke } from "@/lib/ap-exam/frq-ink";

const HISTORY_MAX = 30;

function drawAll(ctx: CanvasRenderingContext2D, strokes: InkStroke[], height: number) {
  ctx.clearRect(0, 0, INK_W, height);
  ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = 2.5;
  for (const s of strokes) {
    ctx.strokeStyle = (INK_COLORS[s.c] ?? INK_COLORS[0]).value;
    ctx.beginPath();
    ctx.moveTo(s.p[0], s.p[1]);
    for (let i = 2; i < s.p.length; i += 2) ctx.lineTo(s.p[i], s.p[i + 1]);
    ctx.stroke();
  }
}

export default function FrqHandwritingPad({ label, strokes, height, disabled = false, onChange, onHeightChange }: { label: string; strokes: InkStroke[]; height: number; disabled?: boolean; onChange: (next: InkStroke[]) => void; onHeightChange: (h: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<InkStroke[]>(strokes);
  const historyRef = useRef<InkStroke[][]>([]);
  const curRef = useRef<{ c: number; p: number[] } | null>(null);
  const penSeenRef = useRef(false);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState(0);
  const [, force] = useState(0);
  const heightRef = useRef(height);
  heightRef.current = height;
  const resizeRef = useRef<{ startY: number; startH: number } | null>(null);

  const redraw = useCallback(() => {
    const ctx = canvasRef.current?.getContext?.("2d");
    if (ctx) drawAll(ctx, strokesRef.current, heightRef.current);
  }, []);
  useEffect(() => { strokesRef.current = strokes; redraw(); }, [strokes, height, redraw]); // 높이가 바뀌면 캔버스가 비워지므로 다시 그린다(획 좌표는 그대로)

  const commit = (next: InkStroke[], pushHistory = true) => {
    if (pushHistory) historyRef.current = [...historyRef.current.slice(-(HISTORY_MAX - 1)), strokesRef.current];
    strokesRef.current = next;
    redraw();
    force((n) => n + 1);
    onChange(next);
  };

  function pt(e: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const r = e.currentTarget.getBoundingClientRect();
    return [(e.clientX - r.left) * (r.width ? INK_W / r.width : 1), (e.clientY - r.top) * (r.height ? heightRef.current / r.height : 1)];
  }
  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    if (e.pointerType === "pen") penSeenRef.current = true;
    if (e.pointerType === "touch" && penSeenRef.current) return; // 스타일러스를 쓰는 중 손바닥 접촉 무시
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const [x, y] = pt(e);
    if (tool === "eraser") {
      curRef.current = { c: -1, p: [x, y] };
      const next = eraseStrokesNear(strokesRef.current, x, y);
      if (next.length !== strokesRef.current.length) commit(next);
    } else curRef.current = { c: color, p: [x, y] };
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    const cur = curRef.current;
    if (disabled || !cur) return;
    const [x, y] = pt(e);
    if (cur.c === -1) {
      const next = eraseStrokesNear(strokesRef.current, x, y);
      if (next.length !== strokesRef.current.length) commit(next, false);
      return;
    }
    const n = cur.p.length;
    if (Math.hypot(x - cur.p[n - 2], y - cur.p[n - 1]) < 1.5) return;
    const ctx = canvasRef.current?.getContext?.("2d");
    if (ctx) {
      ctx.strokeStyle = INK_COLORS[cur.c].value; ctx.lineWidth = 2.5; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(cur.p[n - 2], cur.p[n - 1]); ctx.lineTo(x, y); ctx.stroke();
    }
    cur.p.push(x, y);
  }
  function up() {
    const cur = curRef.current;
    curRef.current = null;
    if (!cur || cur.c === -1) return;
    commit([...strokesRef.current, { c: cur.c, p: simplifyPoints(cur.p) }]);
  }
  function undo() {
    const prev = historyRef.current[historyRef.current.length - 1];
    if (!prev || disabled) return;
    historyRef.current = historyRef.current.slice(0, -1);
    commit(prev, false);
  }
  const setHeight = (h: number) => {
    const next = clampBoardHeight(h, strokesRef.current);
    if (next !== heightRef.current) onHeightChange(next);
  };
  function resizeDown(e: React.PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    resizeRef.current = { startY: e.clientY, startH: heightRef.current };
  }
  function resizeMove(e: React.PointerEvent<HTMLDivElement>) {
    const r = resizeRef.current;
    if (!r) return;
    const cw = canvasRef.current?.getBoundingClientRect().width || INK_W;
    setHeight(r.startH + (e.clientY - r.startY) * (INK_W / cw)); // 화면 픽셀 → 논리 좌표
  }
  function clearAll() {
    if (disabled || strokesRef.current.length === 0) return;
    commit([]);
  }

  const btn = (active: boolean) => `min-h-[36px] rounded border px-2.5 py-1 text-[12px] font-bold md:min-h-0 ${active ? "border-ink bg-ink text-white" : "border-grey-300 text-grey-600"}`;
  return (
    <div className="mt-2 rounded-lg border border-grey-300 bg-white" data-testid={`frq-pad-${label}`}>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-grey-200 px-2 py-1.5">
        <button type="button" className={btn(tool === "pen")} aria-pressed={tool === "pen"} onClick={() => setTool("pen")}>Pen</button>
        <button type="button" className={btn(tool === "eraser")} aria-pressed={tool === "eraser"} onClick={() => setTool("eraser")}>Eraser</button>
        {INK_COLORS.map((c, i) => (
          <button key={c.value} type="button" aria-label={`${c.name} pen`} aria-pressed={tool === "pen" && color === i} onClick={() => { setColor(i); setTool("pen"); }}
            className={`h-7 w-7 rounded-full border-2 md:h-5 md:w-5 ${tool === "pen" && color === i ? "border-ink" : "border-grey-200"}`} style={{ backgroundColor: c.value }} />
        ))}
        <span className="mx-1 hidden h-5 w-px bg-grey-200 md:inline-block" aria-hidden />
        <div role="group" aria-label="Board size" className="flex items-center gap-1" data-testid={`frq-size-${label}`}>
          <button type="button" className={btn(false)} aria-label="Smaller board" onClick={() => setHeight(height - 100)} disabled={disabled}>−</button>
          {INK_H_PRESETS.map((pr) => (
            <button key={pr.h} type="button" className={btn(height === pr.h)} aria-pressed={height === pr.h} onClick={() => setHeight(pr.h)} disabled={disabled} data-testid={`frq-size-${label}-${pr.h}`}>{pr.label}</button>
          ))}
          <button type="button" className={btn(false)} aria-label="Larger board" onClick={() => setHeight(height + 100)} disabled={disabled}>+</button>
        </div>
        <button type="button" className={`${btn(false)} ml-auto`} onClick={undo} disabled={disabled || historyRef.current.length === 0} data-testid={`frq-undo-${label}`}>Undo</button>
        <button type="button" className={btn(false)} onClick={clearAll} disabled={disabled || strokesRef.current.length === 0} data-testid={`frq-clear-${label}`}>Clear</button>
      </div>
      <div className="flex">
      <canvas ref={canvasRef} width={INK_W} height={height} aria-label={`Handwriting area for part (${label})`} data-testid={`frq-canvas-${label}`}
        className={`block w-full touch-none ${disabled ? "" : "cursor-crosshair"}`} style={{ aspectRatio: `${INK_W} / ${height}` }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} />
      {/* 모바일: 캔버스는 touch-action:none 이라 손가락 접촉은 그리기용. 오른쪽 띠는 페이지 스크롤용(touch-action: pan-y). */}
      <div className="w-7 shrink-0 touch-pan-y bg-grey-50 md:hidden" aria-hidden data-testid={`frq-scroll-gutter-${label}`} />
      </div>
      <div role="slider" tabIndex={0} aria-label={`Board height for part (${label})`} aria-orientation="vertical" aria-valuemin={300} aria-valuemax={INK_MAX_H} aria-valuenow={height}
        aria-valuetext={`${height} units tall`} data-testid={`frq-resize-${label}`}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); setHeight(height + 50); }
          else if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); setHeight(height - 50); }
          else if (e.key === "PageDown") { e.preventDefault(); setHeight(height + 200); }
          else if (e.key === "PageUp") { e.preventDefault(); setHeight(height - 200); }
        }}
        onPointerDown={resizeDown} onPointerMove={resizeMove} onPointerUp={() => { resizeRef.current = null; }} onPointerCancel={() => { resizeRef.current = null; }}
        className="flex h-6 cursor-ns-resize touch-none items-center justify-center border-t border-grey-200 bg-grey-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40">
        <span className="h-1 w-10 rounded-full bg-grey-300" />
      </div>
    </div>
  );
}
