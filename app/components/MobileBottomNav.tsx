"use client";

import { useState } from "react";

export type MobileNavItem = { id: string; label: string; icon: string };

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
}: {
  primary: MobileNavItem[];
  more: MobileNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = more.some((m) => m.id === activeId);

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-grey-200 flex items-stretch">
        {primary.map((item) => (
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
            <span className="text-[18px]">{item.icon}</span>
            {item.label}
          </button>
        ))}
        {more.length > 0 && (
          <button
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            aria-haspopup="true"
            className={
              "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10.5px] font-semibold " +
              (moreOpen || moreActive ? "text-ink" : "text-grey-300")
            }
          >
            <span className="text-[18px]">⋯</span>
            더보기
          </button>
        )}
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
              {more.map((item) => (
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
                  <span className="text-[20px]">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
