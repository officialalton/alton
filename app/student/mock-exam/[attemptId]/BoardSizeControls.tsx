"use client";

// FRQ 손글씨 패드와 시험 스크래치 화이트보드가 함께 쓰는 보드 크기 조절 UI(2026-10-13).
// 프리셋 버튼 + −/+ 버튼, 드래그/키보드 슬라이더 핸들, 모바일 스크롤 띠. 크기 계산(clamp)은 호출 쪽이 한다(획 아래로 못 줄이게).
import { useRef } from "react";

export const boardBtn = (active: boolean) =>
  `min-h-[36px] rounded border px-2.5 py-1 text-[12px] font-bold md:min-h-0 ${active ? "border-ink bg-ink text-white" : "border-grey-300 text-grey-600"}`;

export function BoardSizeButtons({ presets, height, step = 100, disabled, onSet, groupTestId, presetTestId }: {
  presets: readonly { label: string; h: number }[]; height: number; step?: number; disabled?: boolean; onSet: (h: number) => void; groupTestId: string; presetTestId: (h: number) => string;
}) {
  return (
    <div role="group" aria-label="Board size" className="flex items-center gap-1" data-testid={groupTestId}>
      <button type="button" className={boardBtn(false)} aria-label="Smaller board" onClick={() => onSet(height - step)} disabled={disabled}>−</button>
      {presets.map((pr) => (
        <button key={pr.h} type="button" className={boardBtn(height === pr.h)} aria-pressed={height === pr.h} onClick={() => onSet(pr.h)} disabled={disabled} data-testid={presetTestId(pr.h)}>{pr.label}</button>
      ))}
      <button type="button" className={boardBtn(false)} aria-label="Larger board" onClick={() => onSet(height + step)} disabled={disabled}>+</button>
    </div>
  );
}

/** 캔버스 오른쪽 띠: 캔버스는 touch-action:none(그리기)이라 손가락 스크롤 통로로 pan-y 띠를 둔다(모바일만). */
export function BoardScrollGutter({ testId }: { testId: string }) {
  return <div className="w-7 shrink-0 touch-pan-y bg-grey-50 md:hidden" aria-hidden data-testid={testId} />;
}

/** 보드 아래 드래그 핸들(role=slider): 포인터 드래그(화면 px → 논리 좌표), 화살표 ±50, PageUp/Down ±200. */
export function BoardResizeHandle({ height, min, max, logicalWidth, getCanvasWidth, disabled, ariaLabel, testId, onSet }: {
  height: number; min: number; max: number; logicalWidth: number; getCanvasWidth: () => number | undefined; disabled?: boolean; ariaLabel: string; testId: string; onSet: (h: number) => void;
}) {
  const drag = useRef<{ startY: number; startH: number } | null>(null);
  return (
    <div role="slider" tabIndex={0} aria-label={ariaLabel} aria-orientation="vertical" aria-valuemin={min} aria-valuemax={max} aria-valuenow={height}
      aria-valuetext={`${height} units tall`} data-testid={testId}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); onSet(height + 50); }
        else if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); onSet(height - 50); }
        else if (e.key === "PageDown") { e.preventDefault(); onSet(height + 200); }
        else if (e.key === "PageUp") { e.preventDefault(); onSet(height - 200); }
      }}
      onPointerDown={(e) => { if (disabled) return; e.currentTarget.setPointerCapture?.(e.pointerId); drag.current = { startY: e.clientY, startH: height }; }}
      onPointerMove={(e) => { const d = drag.current; if (d) onSet(d.startH + (e.clientY - d.startY) * (logicalWidth / (getCanvasWidth() || logicalWidth))); }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
      className="flex h-6 cursor-ns-resize touch-none items-center justify-center border-t border-grey-200 bg-grey-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40">
      <span className="h-1 w-10 rounded-full bg-grey-300" />
    </div>
  );
}
