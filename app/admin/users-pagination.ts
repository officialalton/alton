// 사용자 탭 페이지네이션 순수 헬퍼 — 서버(users-data.ts)·UI(UsersPagination.tsx) 공용.

export function pageCountFor(total: number, pageSize: number): number {
  if (!Number.isFinite(total) || total <= 0 || pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}

export function clampPage(page: number, pageCount: number): number {
  const p = Number.isFinite(page) ? Math.floor(page) : 1;
  return Math.min(Math.max(1, p), Math.max(1, pageCount));
}

/** 현재 페이지 주변 + 처음/끝 페이지. 건너뛴 구간은 "gap"으로 표시한다. */
export function pageWindow(current: number, pageCount: number, siblings = 1): (number | "gap")[] {
  if (pageCount <= 1) return [1];
  const keep = new Set<number>([1, pageCount]);
  for (let i = current - siblings; i <= current + siblings; i++) if (i >= 1 && i <= pageCount) keep.add(i);
  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) {
      // 한 페이지만 빠지면 gap 대신 그 숫자를 보여준다.
      if (n - sorted[i - 1] === 2) out.push(n - 1);
      else out.push("gap");
    }
    out.push(n);
  });
  return out;
}

/** "1–10 / 총 253명" 범위 표기용. */
export function rangeLabel(page: number, pageSize: number, total: number): { from: number; to: number } {
  if (total <= 0) return { from: 0, to: 0 };
  return { from: (page - 1) * pageSize + 1, to: Math.min(total, page * pageSize) };
}
