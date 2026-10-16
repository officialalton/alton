// 적재 점검(읽기 전용) 순수 계산. scripts/ap-generation/check-load.ts 와 관리자 화면이 같이 쓴다.
export type ReviewStatusRow = { candidate_key: string; review_state: string; render_verified: boolean; screen_verified: boolean; review_env_ready: boolean };
export type BatchKeys = { id: string; label: string; keys: string[] };
export type BatchCheck = { id: string; label: string; keys: number; loaded: number; render: number; screen: number; ready: number; missingKeys: string[]; short: boolean };

export function computeLoadCheck(batches: BatchKeys[], rows: ReviewStatusRow[]) {
  const byKey = new Map(rows.map((r) => [r.candidate_key, r]));
  const out: BatchCheck[] = batches.map((b) => {
    const got = b.keys.map((k) => byKey.get(k)).filter((r): r is ReviewStatusRow => !!r);
    const n = (p: (r: ReviewStatusRow) => boolean) => got.filter(p).length;
    const ready = n((r) => r.review_env_ready);
    return { id: b.id, label: b.label, keys: b.keys.length, loaded: got.length, render: n((r) => r.render_verified), screen: n((r) => r.screen_verified), ready, missingKeys: b.keys.filter((k) => !byKey.has(k)), short: ready !== b.keys.length };
  });
  const totals = { keys: out.reduce((a, b) => a + b.keys, 0), ready: out.reduce((a, b) => a + b.ready, 0), shortBatches: out.filter((b) => b.short).length, dbRows: rows.length };
  return { batches: out, totals };
}
