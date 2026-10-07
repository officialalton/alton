// 근접 중복 판정(2026-10-07 오너 정정). 같은 원형(archetypeId)/같은 유사문항 그룹의 서로 다른 인스턴스는 근접 중복이 아니다.
// 정확히 같은 문제(정규화 지문·질문·선택지 동일)만 막고, 다른 원형·외부 문항과는 3-gram Jaccard 0.6 규칙을 유지한다.
export const shingles = (t: string) => {
  const w = t.toLowerCase().replace(/[0-9]+([.,][0-9]+)*/g, "#").replace(/[^a-z#\s]+/g, " ").split(/\s+/).filter(Boolean);
  const s = new Set<string>(); for (let i = 0; i + 3 <= w.length; i++) s.add(w.slice(i, i + 3).join(" ")); return s;
};
export const jaccard = (a: Set<string>, b: Set<string>) => { if (!a.size || !b.size) return 0; let x = 0; for (const v of a) if (b.has(v)) x++; return x / (a.size + b.size - x); };
/** 정확 동일 판정용 정규화 — 공백·대소문자만 무시(숫자는 그대로, 값이 다르면 다른 문제). */
export const exactKey = (stimulus: string, question: string | null, options: string[] | null | undefined) =>
  `${stimulus}\u0000${question ?? ""}\u0000${(options ?? []).join("\u0001")}`.toLowerCase().replace(/\s+/g, " ").trim();
export type PoolEntry = { problemId: string; sh: Set<string>; group?: string | null };
/** 같은 그룹 키(원형 id 또는 similarity_group)를 공유하면 근접 중복 판정에서 제외한다. */
export function findNearDuplicate(sh: Set<string>, group: string | null | undefined, pool: PoolEntry[], threshold = 0.6): PoolEntry | undefined {
  return pool.find((e) => !(group && e.group && e.group === group) && jaccard(sh, e.sh) >= threshold);
}
