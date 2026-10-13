"use client";

import { useRef } from "react";

export type TabDef<T extends string> = { id: T; label: string };

/** 키보드 접근 가능한 탭 막대(←/→/Home/End로 이동, 선택은 포커스를 따른다). */
export function TabBar<T extends string>({ tabs, value, onChange, label, idPrefix }: { tabs: TabDef<T>[]; value: T; onChange: (id: T) => void; label: string; idPrefix: string }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  function onKey(e: React.KeyboardEvent, i: number) {
    let next = i;
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    onChange(tabs[next].id);
    refs.current[tabs[next].id]?.focus();
  }
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1">
      {tabs.map((t, i) => (
        <button
          key={t.id} ref={(el) => { refs.current[t.id] = el; }} type="button" role="tab" id={`${idPrefix}-tab-${t.id}`}
          aria-selected={value === t.id} aria-controls={`${idPrefix}-panel-${t.id}`} tabIndex={value === t.id ? 0 : -1}
          onClick={() => onChange(t.id)} onKeyDown={(e) => onKey(e, i)} data-testid={`${idPrefix}-tab-${t.id}`}
          className={`min-h-[44px] rounded-md px-3 md:min-h-[40px] py-1.5 text-[12.5px] font-bold ${value === t.id ? "bg-ink text-white" : "border border-grey-300 text-grey-600"}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
