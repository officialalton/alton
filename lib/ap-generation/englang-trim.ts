// 확장 묶음의 문항 선택(순수): 통과한 새 문항 중 어떤 것을 남겨야 한 시험의 구성이 공식 구조와 8범주 범위를 만족하는지 정수계획으로 고른다.
// 기존(재사용) 문항은 항상 남는다. 시험 하나 = 읽기 확장 묶음 2 + 글쓰기 확장 묶음 2 + 고정 짧은 글쓰기 묶음 1.
import { solveMip, type Cons } from "../ap-exam/ilp";
import { ELANG_CATEGORIES, ELANG_FULL_TARGET, ELANG_MC_COUNT, ELANG_OFFICIAL_READING_SETS, ELANG_OFFICIAL_WRITING_SETS, ELANG_READING_RANGE, ELANG_WRITING_RANGE, elangCategoryBounds } from "../ap-exam/elang-rules";

export type TrimCand = { cat: string; score: number };
export type TrimSet = { id: string; section: "reading" | "writing"; baseCats: string[]; cands: TrimCand[] };
export type TrimInput = { sets: TrimSet[]; fixedCats: string[]; timeMs?: number };
export type TrimResult = { ok: boolean; reason?: string; keep: Record<string, number[]>; counts: Record<string, number>; sizes: Record<string, number> };

/** keep[setId] = 남길 새 문항의 인덱스(cands 기준). */
export function chooseTrim(inp: TrimInput): TrimResult {
  const bounds = elangCategoryBounds(); const target = ELANG_FULL_TARGET.categories;
  let n = 0; const xv = new Map<string, number>(); for (const s of inp.sets) s.cands.forEach((_, i) => xv.set(`${s.id}|${i}`, n++));
  const dv = new Map<string, number>(); for (const c of ELANG_CATEGORIES) dv.set(c, n++);
  const obj = new Array<number>(n).fill(0); const cons: Cons[] = [];
  for (const d of dv.values()) obj[d] = 10; // 범주 목표 이탈
  for (const s of inp.sets) s.cands.forEach((c, i) => { obj[xv.get(`${s.id}|${i}`)!] += (1 - c.score) * 2; }); // 키 신뢰도 높은 문항 선호
  const base = (pred: (s: TrimSet) => boolean) => inp.sets.filter(pred).reduce((a, s) => a + s.baseCats.length, 0);
  for (const s of inp.sets) {
    const co = s.cands.map((_, i) => [xv.get(`${s.id}|${i}`)!, 1] as [number, number]); const b = s.baseCats.length;
    const [lo, hi] = s.section === "reading" ? [ELANG_OFFICIAL_READING_SETS.size.min, ELANG_OFFICIAL_READING_SETS.size.max] : [ELANG_OFFICIAL_WRITING_SETS.sizes[0].min, ELANG_OFFICIAL_WRITING_SETS.sizes[0].max];
    cons.push({ coef: co, sense: ">=", rhs: lo - b }); cons.push({ coef: co, sense: "<=", rhs: hi - b });
  }
  for (const [sec, range] of [["reading", ELANG_READING_RANGE], ["writing", ELANG_WRITING_RANGE]] as const) {
    const co: [number, number][] = inp.sets.filter((s) => s.section === sec).flatMap((s) => s.cands.map((_, i) => [xv.get(`${s.id}|${i}`)!, 1] as [number, number]));
    const fixed = base((s) => s.section === sec) + (sec === "writing" ? inp.fixedCats.length : 0);
    cons.push({ coef: co, sense: ">=", rhs: range.min - fixed }); cons.push({ coef: co, sense: "<=", rhs: range.max - fixed });
  }
  { const all: [number, number][] = [...xv.values()].map((j) => [j, 1] as [number, number]); const fixedAll = inp.sets.reduce((a, s) => a + s.baseCats.length, 0) + inp.fixedCats.length; cons.push({ coef: all, sense: "=", rhs: ELANG_MC_COUNT - fixedAll }); } // 45문항
  for (const c of ELANG_CATEGORIES) {
    const co: [number, number][] = inp.sets.flatMap((s) => s.cands.map((cd, i) => [xv.get(`${s.id}|${i}`)!, cd.cat === c ? 1 : 0] as [number, number])).filter(([, v]) => v > 0);
    const fixed = inp.sets.reduce((a, s) => a + s.baseCats.filter((x) => x === c).length, 0) + inp.fixedCats.filter((x) => x === c).length; const d = dv.get(c)!;
    cons.push({ coef: co, sense: ">=", rhs: bounds[c].min - fixed }); cons.push({ coef: co, sense: "<=", rhs: bounds[c].max - fixed });
    cons.push({ coef: [...co, [d, -1]], sense: "<=", rhs: target[c] - fixed }); cons.push({ coef: [...co.map(([j, v]) => [j, -v] as [number, number]), [d, -1]], sense: "<=", rhs: fixed - target[c] });
  }
  const binary = new Array<boolean>(n).fill(false); for (const j of xv.values()) binary[j] = true;
  for (const j of xv.values()) cons.push({ coef: [[j, 1]], sense: "<=", rhs: 1 });
  const r = solveMip({ n, obj, cons, integer: new Array(n).fill(true), binary }, { timeMs: inp.timeMs ?? 20000 });
  if (!r.x.length) return { ok: false, reason: "infeasible", keep: {}, counts: {}, sizes: {} };
  const keep: Record<string, number[]> = {}; const counts: Record<string, number> = Object.fromEntries(ELANG_CATEGORIES.map((c) => [c, 0])); const sizes: Record<string, number> = {};
  for (const s of inp.sets) { keep[s.id] = s.cands.map((_, i) => i).filter((i) => r.x[xv.get(`${s.id}|${i}`)!] > 0.5); sizes[s.id] = s.baseCats.length + keep[s.id].length; for (const c of s.baseCats) counts[c]++; for (const i of keep[s.id]) counts[s.cands[i].cat]++; }
  for (const c of inp.fixedCats) counts[c]++;
  return { ok: true, keep, counts, sizes };
}
