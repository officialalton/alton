"use client";

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
  return (
    <div className={"flex items-center gap-5 border-b border-grey-200" + (className ? ` ${className}` : "")}>
      {items.map((item) => {
        const count = badgeCounts?.[item.id] ?? 0;
        const active = activeId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={
              "relative pb-2.5 -mb-px text-[13.5px] font-semibold border-b-2 transition-colors " +
              (active ? "border-ink text-ink" : "border-transparent text-grey-400")
            }
          >
            {item.label}
            {count > 0 && (
              <span className="ml-1.5 inline-flex min-w-[16px] h-[16px] px-1 rounded-full bg-red text-white text-[9.5px] font-bold items-center justify-center align-middle">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
