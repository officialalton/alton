"use client";

import { useState } from "react";
import type { MobileNavItem } from "./MobileBottomNav";

export type MobileNavGroup = { label: string; items: MobileNavItem[] };

// 2026-09-10(UI/UX 정리 1차, 배치4) — 관리자 포털 전용 모바일 내비게이션.
// 항목이 많아(13개) 바텀탭에 담을 수 없으므로 햄버거 드로어 + 그룹 헤더로
// 정리한다. 데스크톱 사이드바는 손대지 않고 `hidden md:flex`로 모바일에서만
// 숨긴다.
export default function MobileDrawerNav({
  groups,
  activeId,
  onSelect,
}: {
  groups: MobileNavGroup[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="md:hidden fixed top-3 left-3 z-40 w-9 h-9 rounded-full bg-white border border-grey-200 flex items-center justify-center text-[16px]"
        aria-label="메뉴 열기"
        aria-expanded={open}
        aria-haspopup="true"
      >
        ☰
      </button>

      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-[260px] max-w-[80vw] h-full bg-white overflow-y-auto py-5 px-3"
          >
            {groups.map((group) => (
              <div key={group.label} className="mb-4">
                <div className="text-[10.5px] font-bold text-grey-300 uppercase tracking-wide px-2.5 mb-1.5">
                  {group.label}
                </div>
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setOpen(false);
                      onSelect(item.id);
                    }}
                    className={
                      "w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-[13.5px] font-semibold text-left " +
                      (activeId === item.id ? "bg-grey-100 text-ink" : "text-grey-500")
                    }
                  >
                    <span className="text-[16px]">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
