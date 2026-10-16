// 2026-09-29 — `.in(col, ids)` 는 id 가 ~200개를 넘으면 PostgREST GET URL 이 너무 길어져
// ("URI too long") 실패한다. id 목록을 나눠 조회하고 합친다. 한 id 의 행은 한 청크에만
// 있으므로(중복 id 는 먼저 제거) 청크 안 정렬은 유지되고, 전체 정렬이 필요하면 `sort` 로 다시 맞춘다.
// 오류는 삼키지 않는다 — 첫 오류에서 멈추고 { data: 그때까지 모은 행, error } 를 돌려준다.
export const IN_CHUNK_SIZE = 100;

export type ChunkError = { code?: string; message?: string };
type ChunkResult<T> = PromiseLike<{ data: T[] | null; error: ChunkError | null }>;

export type SelectInChunksOptions<T> = { size?: number; sort?: (a: T, b: T) => number };

export async function selectInChunks<T>(
  ids: readonly string[],
  run: (chunk: string[]) => ChunkResult<T>,
  sizeOrOptions: number | SelectInChunksOptions<T> = {}
): Promise<{ data: T[]; error: ChunkError | null }> {
  const opts = typeof sizeOrOptions === "number" ? { size: sizeOrOptions } : sizeOrOptions;
  const size = Math.max(1, opts.size ?? IN_CHUNK_SIZE);
  const unique = Array.from(new Set(ids));
  const rows: T[] = [];
  for (let i = 0; i < unique.length; i += size) {
    const { data, error } = await run(unique.slice(i, i + size));
    if (error) return { data: rows, error };
    if (data) rows.push(...data);
  }
  if (opts.sort) rows.sort(opts.sort);
  return { data: rows, error: null };
}

// 청크를 병렬로(동시 4개) 조회한다 — 왕복이 많은 큰 목록용. 순서는 청크 순서를 지킨다.
export async function selectInChunksParallel<T>(
  ids: readonly string[],
  run: (chunk: string[]) => ChunkResult<T>,
  sizeOrOptions: number | SelectInChunksOptions<T> = {}
): Promise<{ data: T[]; error: ChunkError | null }> {
  const opts = typeof sizeOrOptions === "number" ? { size: sizeOrOptions } : sizeOrOptions;
  const size = Math.max(1, opts.size ?? IN_CHUNK_SIZE);
  const unique = Array.from(new Set(ids));
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += size) chunks.push(unique.slice(i, i + size));
  if (chunks.length <= 1) return selectInChunks(unique, run, opts);
  const results: Array<{ data: T[] | null; error: ChunkError | null }> = [];
  for (let i = 0; i < chunks.length; i += 4) {
    results.push(...(await Promise.all(chunks.slice(i, i + 4).map((c) => run(c)))));
  }
  const rows: T[] = [];
  for (const r of results) {
    if (r.error) return { data: rows, error: r.error };
    if (r.data) rows.push(...r.data);
  }
  if (opts.sort) rows.sort(opts.sort);
  return { data: rows, error: null };
}

// PostgREST `.order(col, { ascending })` 와 같은 순서로 청크 결과를 다시 맞추는 비교 함수.
// Postgres 기본 NULL 순서(오름차순=NULL 마지막, 내림차순=NULL 처음)를 따른다.
export function orderComparator(...specs: Array<[column: string, ascending?: boolean]>) {
  return (a: unknown, b: unknown): number => {
    const ra = a as Record<string, unknown>;
    const rb = b as Record<string, unknown>;
    for (const [col, asc = true] of specs) {
      const x = ra[col];
      const y = rb[col];
      if (x === y) continue;
      let c: number;
      if (x == null) c = 1;
      else if (y == null) c = -1;
      else c = (x as string | number) < (y as string | number) ? -1 : 1;
      return asc ? c : -c;
    }
    return 0;
  };
}
