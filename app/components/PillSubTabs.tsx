"use client";

// 2026-09-18(학부모 포털 UI 폴리싱) — 학생 포털 "수업" 탭(구 ClassesTab)에서
// 쓰던 pill 서브탭 스타일을 공용 컴포넌트로 뽑았다. 페이지 상단에 큰 제목 없이,
// 여백 적게, pill 버튼만 깔끔하게 — 이걸 모든 탭의 서브탭 표준으로 통일한다.
export type PillSubTabItem<T extends string> = {
  id: T;
  label: string;
};

export default function PillSubTabs<T extends string>({
  items,
  activeId,
  onSelect,
  className,
  badgeCounts,
}: {
  items: readonly PillSubTabItem<T>[];
  activeId: T;
  onSelect: (id: T) => void;
  className?: string;
  /** 탭 id별 숫자 배지(예: 메신저 안읽음 수) — 0이거나 없으면 표시 안 함. */
  badgeCounts?: Partial<Record<T, number>>;
}) {
  return (
    <div className={"flex gap-1.5" + (className ? ` ${className}` : "")}>
      {items.map((item) => {
        const count = badgeCounts?.[item.id] ?? 0;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={
              "relative text-[11px] font-bold px-2.5 py-1 rounded-full " +
              (activeId === item.id ? "bg-ink text-white" : "bg-grey-100 text-grey-500")
            }
          >
            {item.label}
            {count > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-red text-white text-[9.5px] font-bold flex items-center justify-center">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
