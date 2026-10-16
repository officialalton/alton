"use client";

import { pageWindow, rangeLabel } from "./users-pagination";

export default function UsersPagination({
  page,
  pageCount,
  pageSize,
  total,
  disabled,
  onChange,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  disabled?: boolean;
  onChange: (page: number) => void;
}) {
  const { from, to } = rangeLabel(page, pageSize, total);
  const btn = "min-w-[30px] h-[30px] px-2 rounded-lg text-[12px] font-semibold border-[1.5px] border-grey-200 disabled:opacity-40";
  return (
    <nav aria-label="페이지 이동" className="flex flex-wrap items-center justify-between gap-2 mt-3" data-testid="users-pagination">
      <span className="text-[12px] text-grey-500" data-testid="users-range">
        {total === 0 ? "총 0명" : `${from}–${to} / 총 ${total}명`}
      </span>
      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <button type="button" className={btn} disabled={disabled || page <= 1} onClick={() => onChange(page - 1)} aria-label="이전 페이지">
            ‹
          </button>
          {pageWindow(page, pageCount).map((n, i) =>
            n === "gap" ? (
              <span key={`g${i}`} className="px-1 text-grey-400 text-[12px]" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={n}
                type="button"
                className={btn + (n === page ? " bg-ink text-white border-ink" : " text-ink")}
                aria-current={n === page ? "page" : undefined}
                aria-label={`${n}페이지`}
                disabled={disabled}
                onClick={() => onChange(n)}
              >
                {n}
              </button>
            )
          )}
          <button type="button" className={btn} disabled={disabled || page >= pageCount} onClick={() => onChange(page + 1)} aria-label="다음 페이지">
            ›
          </button>
        </div>
      )}
    </nav>
  );
}
