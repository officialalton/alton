"use client";

// SAT 응시 화면(4모듈)과 AP 응시 화면이 같이 쓰는 레이아웃 조각. 한 곳에서 고치면 두 화면이 같이 바뀐다(2026-10-09 통일).
import { useCallback, useEffect, useRef, useState } from "react";

// 이전·다음 화살표: 똑같은 중립 윤곽 버튼. 마우스 클릭 뒤에는 포커스 링을 남기지 않는다(focus-visible 만).
export const NAV_BTN =
  "flex h-11 w-14 items-center md:h-10 md:w-12 justify-center rounded-lg border-[1.5px] border-grey-300 bg-white text-[20px] font-semibold text-ink hover:bg-grey-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 disabled:opacity-40 disabled:hover:bg-white";

// 좁은 화면: 지문+선택지가 한 세로 흐름으로 스크롤된다. iOS 는 스크롤바가 사라지므로 아래에 더 있으면 페이드+화살표를 보여 준다.
export function ScrollPanes({ resetKey, children }: { resetKey: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [more, setMore] = useState(false);
  const update = useCallback(() => {
    const el = ref.current;
    if (el) setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 8);
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = 0;
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    Array.from(el.children).forEach((c) => ro?.observe(c));
    return () => ro?.disconnect();
  }, [resetKey, update]);
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={ref} onScroll={update} className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden" data-testid="mst-panes">
        {children}
      </div>
      {more && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-14 items-end justify-center bg-gradient-to-t from-white via-white/80 to-transparent pb-1 md:hidden" data-testid="mst-scroll-cue" aria-hidden="true">
          <span className="flex items-center gap-1 text-[11px] font-semibold text-grey-500">
            Scroll for more
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
          </span>
        </div>
      )}
    </div>
  );
}

export function ToolIconButton({
  label,
  title,
  pressed,
  onClick,
  testId,
  children,
}: {
  label: string;
  title: string;
  pressed: boolean;
  onClick: () => void;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={label}
      title={title}
      data-testid={testId}
      className={`inline-flex h-11 w-11 items-center justify-center rounded md:h-7 md:w-7 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 ${
        pressed ? "bg-ink text-white" : "text-ink hover:bg-black/10"
      }`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </button>
  );
}
