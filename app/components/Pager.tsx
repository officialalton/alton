"use client";

// 2026-10-08 — 목록 공용 페이지 이동(이전/다음 + "Page x of y"). 한 페이지로 끝나면 렌더하지 않는다.
export default function Pager({ page, pageCount, onPage }: { page: number; pageCount: number; onPage: (p: number) => void }) {
  if (pageCount <= 1) return null;
  const btn = "text-[12.5px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-40";
  return (
    <nav aria-label="Pagination" className="mt-3 flex items-center justify-between gap-2">
      <button type="button" className={btn} disabled={page <= 0} onClick={() => onPage(page - 1)}>Previous</button>
      <span className="text-[12.5px] text-grey-500" aria-live="polite">Page {page + 1} of {pageCount}</span>
      <button type="button" className={btn} disabled={page >= pageCount - 1} onClick={() => onPage(page + 1)}>Next</button>
    </nav>
  );
}
