"use client";

import { useEffect, useRef } from "react";

// 2026-09-19(UI 통일화) — 1단 서브탭(같은 레벨의 서브탭, 예: "예정 과제 / 지난
// 과제") 표준 스타일. 밑줄 강조 텍스트 버튼형(Acely 레퍼런스). 2단 서브탭
// (서브탭 안의 서브탭)은 계속 PillSubTabs를 쓴다.
export type UnderlineSubTabItem<T extends string> = {
  id: T;
  label: string;
};

export default function UnderlineSubTabs<T extends string>({
  items,
  activeId,
  onSelect,
  className,
  badgeCounts,
}: {
  items: readonly UnderlineSubTabItem<T>[];
  activeId: T;
  onSelect: (id: T) => void;
  className?: string;
  badgeCounts?: Partial<Record<T, number>>;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  // 활성 탭이 가려져 있으면 줄 안에서만 가로로 스크롤해 보이게 한다(페이지 스크롤은 건드리지 않음).
  useEffect(() => {
    const strip = stripRef.current;
    const el = strip?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!strip || !el) return;
    if (el.offsetLeft < strip.scrollLeft) strip.scrollLeft = el.offsetLeft - 8;
    else if (el.offsetLeft + el.offsetWidth > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = el.offsetLeft + el.offsetWidth - strip.clientWidth + 8;
  }, [activeId]);
  return (
    <div ref={stripRef} className={"flex items-center gap-5 border-b border-brand-border overflow-x-auto overflow-y-hidden scrollbar-hide whitespace-nowrap" + (className ? ` ${className}` : "")}>
      {items.map((item) => {
        const count = badgeCounts?.[item.id] ?? 0;
        const active = activeId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => onSelect(item.id)}
            className={
              "relative shrink-0 pb-2.5 text-[13.5px] font-semibold border-b-2 transition-colors " +
              (active ? "border-navy text-navy" : "border-transparent text-grey-400")
            }
          >
            {item.label}
            {count > 0 && (
              <span className="ml-1.5 inline-flex min-w-[16px] h-[16px] px-1 rounded-full bg-brand-red text-white text-[9.5px] font-bold items-center justify-center align-middle">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
