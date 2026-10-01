"use client";

import { useState } from "react";
import NavIcon, { type NavIconName } from "./NavIcon";

export type MobileNavItem = { id: string; label: string; icon: NavIconName };

// 2026-09-10(UI/UX 정리 1차, 배치4) — 학생/학부모/교사 포털 공용 모바일 하단
// 내비게이션. 88px 고정 사이드바를 모바일에 그대로 두지 않기 위해 만든
// 공통 부품 — 각 포털 Shell은 이 컴포넌트만 끼워 넣고, 데스크톱 사이드바는
// `hidden md:flex`로 모바일에서만 숨긴다(Shell 전체를 새로 만들지 않음).
// primary(최대 4개)는 항상 보이는 탭, more는 "더보기" 시트에 담는다.
export default function MobileBottomNav({
  primary,
  more,
  activeId,
  onSelect,
  badgeCounts,
}: {
  primary: MobileNavItem[];
  more: MobileNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
  /** 2026-09-22(사용자 지시) — 탭 id별 숫자 배지(메신저 안읽음 등). 0이거나 없으면 표시 안 함. */
  badgeCounts?: Record<string, number>;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = more.some((m) => m.id === activeId);

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-grey-200 flex items-stretch">
        {primary.map((item) => {
          const count = badgeCounts?.[item.id] ?? 0;
          return (
            <button
              key={item.id}
              onClick={() => {
                setMoreOpen(false);
                onSelect(item.id);
              }}
              className={
                "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10.5px] font-semibold " +
                (activeId === item.id ? "text-ink" : "text-grey-300")
              }
            >
              <span className="relative">
                <NavIcon name={item.icon} className="w-[18px] h-[18px]" />
                {count > 0 && (
                  <span className="absolute -top-1 -right-1.5 min-w-[13px] h-[13px] px-[3px] rounded-full bg-red text-white text-[8.5px] font-bold flex items-center justify-center">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </span>
              {item.label}
            </button>
          );
        })}
        {more.length > 0 && (() => {
          const moreCount = more.reduce((sum, m) => sum + (badgeCounts?.[m.id] ?? 0), 0);
          return (
            <button
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              aria-haspopup="true"
              className={
                "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10.5px] font-semibold " +
                (moreOpen || moreActive ? "text-ink" : "text-grey-300")
              }
            >
              <span className="relative text-[18px]">
                ⋯
                {moreCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 min-w-[13px] h-[13px] px-[3px] rounded-full bg-red text-white text-[8.5px] font-bold flex items-center justify-center">
                    {moreCount > 9 ? "9+" : moreCount}
                  </span>
                )}
              </span>
              더보기
            </button>
          );
        })()}
      </nav>

      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full bg-white rounded-t-2xl px-4 pt-4 pb-8 max-h-[70vh] overflow-y-auto"
          >
            <div className="w-10 h-1 bg-grey-200 rounded-full mx-auto mb-4" />
            <div className="grid grid-cols-3 gap-3">
              {more.map((item) => {
                const count = badgeCounts?.[item.id] ?? 0;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setMoreOpen(false);
                      onSelect(item.id);
                    }}
                    className={
                      "flex flex-col items-center gap-1 py-3 rounded-xl text-[12px] font-semibold " +
                      (activeId === item.id ? "bg-grey-100 text-ink" : "text-grey-500")
                    }
                  >
                    <span className="relative">
                      <NavIcon name={item.icon} className="w-5 h-5" />
                      {count > 0 && (
                        <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] px-1 rounded-full bg-red text-white text-[9px] font-bold flex items-center justify-center">
                          {count > 9 ? "9+" : count}
                        </span>
                      )}
                    </span>
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
