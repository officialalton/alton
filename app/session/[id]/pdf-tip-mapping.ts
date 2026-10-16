// 이전 버전 팁 가져오기의 쪽 매핑 — 순수 함수. 화면(PdfTipImportPanel)이 행별 대상 쪽을 고르고,
// 빠른 조작(밀기·맞바꾸기)은 이 함수로 매핑을 바꾼다. 자동 비교는 하지 않는다.

export type TipMapRow = { from: number; to: number | null };

/** 기본값 = 같은 쪽수. 새 버전에 없는 쪽이면 건너뛴다(null). */
export function identityMapping(fromPages: number[], toPageCount: number): TipMapRow[] {
  return fromPages.map((from) => ({ from, to: from <= toPageCount ? from : null }));
}

/** startPage 이상(옛 쪽 기준)의 대상 쪽을 delta 만큼 민다(삽입 +1, 삭제 -1). 범위 밖이면 건너뛴다. */
export function shiftFrom(rows: TipMapRow[], startPage: number, delta: number, toPageCount: number): TipMapRow[] {
  return rows.map((r) => {
    if (r.from < startPage || r.to === null) return r;
    const to = r.to + delta;
    return { from: r.from, to: to >= 1 && to <= toPageCount ? to : null };
  });
}

/** 옛 쪽 a, b 의 대상 쪽을 서로 바꾼다. 둘 중 하나가 목록에 없으면 그대로 둔다. */
export function swapTargets(rows: TipMapRow[], a: number, b: number): TipMapRow[] {
  const ra = rows.find((r) => r.from === a);
  const rb = rows.find((r) => r.from === b);
  if (!ra || !rb || a === b) return rows;
  return rows.map((r) => (r.from === a ? { ...r, to: rb.to } : r.from === b ? { ...r, to: ra.to } : r));
}

export function setTarget(rows: TipMapRow[], from: number, to: number | null): TipMapRow[] {
  return rows.map((r) => (r.from === from ? { ...r, to } : r));
}

/** 같은 대상 쪽으로 둘 이상 매핑된 쪽 번호(오름차순). 비어 있어야 실행할 수 있다. */
export function duplicateTargets(rows: TipMapRow[]): number[] {
  const seen = new Map<number, number>();
  for (const r of rows) if (r.to !== null) seen.set(r.to, (seen.get(r.to) ?? 0) + 1);
  return [...seen.entries()].filter(([, n]) => n > 1).map(([p]) => p).sort((a, b) => a - b);
}
