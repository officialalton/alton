// AP English Literature 지문 묶음 계획기(순수·결정적, 2026-10-14): 장르 묶음(시·단편·장편/희곡)마다 스킬 범주 쿼터대로 문항 스킬을 배정하고 시대·소재를 겹치지 않게 고른다.
import { LT_DRAMA_PREMISES, LT_ERAS, LT_POEM_SUBJECTS, LT_PROSE_PREMISES } from "./subjects/englit";
import type { EnglitGroup } from "../ap-exam/englit-rules";
import type { SetSpec } from "./englit-prompts";

type Quota = Record<string, number>;
/** 묶음당 요청 문항 수와 범주 쿼터(요청이 통과 목표보다 많다: 게이트 탈락분을 흡수해 묶음당 8문항 이상을 남기기 위해). */
export const LT_SET_QUOTA: Record<EnglitGroup, Quota> = {
  poetry: { "1": 1, "2": 1, "3": 3, "4": 3, "5": 2, "6": 2, "7": 2 },
  short: { "1": 3, "2": 2, "3": 3, "4": 3, "5": 1, "6": 1, "7": 2 },
  longer: { "1": 3, "3": 3, "4": 3, "5": 1, "7": 3 },
};
export const LT_SKILL_MENU: Record<EnglitGroup, Record<string, string[]>> = {
  poetry: { "1": ["1.A", "1.E", "1.D"], "2": ["2.A", "2.B"], "3": ["3.C", "3.D", "3.B"], "4": ["4.A", "4.C", "4.B"], "5": ["5.B", "5.D", "5.A", "5.C"], "6": ["6.A", "6.B", "6.C", "6.D"], "7": ["7.A", "7.B", "7.C", "7.D"] },
  short: { "1": ["1.A", "1.B", "1.D", "1.E", "1.C"], "2": ["2.A", "2.B", "2.C"], "3": ["3.A", "3.B", "3.D", "3.C"], "4": ["4.A", "4.B", "4.C", "4.D"], "5": ["5.B", "5.D", "5.C", "5.A"], "6": ["6.A", "6.B", "6.C", "6.D"], "7": ["7.A", "7.B", "7.C", "7.D"] },
  longer: { "1": ["1.B", "1.E", "1.D", "1.A"], "3": ["3.E", "3.F", "3.B", "3.D"], "4": ["4.C", "4.D", "4.B", "4.A"], "5": ["5.B", "5.C"], "7": ["7.B", "7.C", "7.D"] },
};
const ERA_CYCLE = ["contemporary", "mid-20th-century manner", "19th-century manner", "contemporary", "early 20th-century manner", "mid-20th-century manner"] as const;
void LT_ERAS;
function rng(seed: number) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const shuffle = <T,>(a: readonly T[], r: () => number): T[] => { const o = a.slice(); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; };

export type PlanOpts = { group: EnglitGroup; sets: number; seed: number; startIndex?: number; dramaSets?: number; usedPremises?: Set<string> };
export function planSets(o: PlanOpts): SetSpec[] {
  const r = rng(o.seed); const quota = LT_SET_QUOTA[o.group]; const menu = LT_SKILL_MENU[o.group];
  const pool = o.group === "poetry" ? LT_POEM_SUBJECTS : LT_PROSE_PREMISES; const dramaPool = shuffle(LT_DRAMA_PREMISES.filter((p) => !o.usedPremises?.has(p)), r);
  const premises = shuffle(pool.filter((p) => !o.usedPremises?.has(p)), r); const prefix = o.group === "poetry" ? "p" : o.group === "short" ? "s" : "l"; const out: SetSpec[] = []; const eraOffset = Math.floor(r() * ERA_CYCLE.length);
  for (let i = 0; i < o.sets; i++) {
    const idx = (o.startIndex ?? 0) + i + 1; const skills: string[] = [];
    for (const [c, n] of Object.entries(quota)) { const off = (i + Math.floor(r() * 4)) % menu[c].length; for (let j = 0; j < n; j++) skills.push(menu[c][(off + j) % menu[c].length]); }
    const drama = o.group === "longer" && i < (o.dramaSets ?? 1); const premise = drama ? dramaPool[i % dramaPool.length] : premises[i % premises.length];
    out.push({ id: `${prefix}${String(idx).padStart(2, "0")}`, group: o.group, form: o.group === "poetry" ? "poem" : drama ? "drama" : "prose", era: ERA_CYCLE[(i + eraOffset) % ERA_CYCLE.length], premise, skills: shuffle(skills, r), seed: Math.floor(r() * 90000) + 10000 });
  }
  return out;
}
export const planSummary = (specs: SetSpec[]) => { const c: Record<string, number> = {}; for (const s of specs) for (const k of s.skills) c[k.split(".")[0]] = (c[k.split(".")[0]] ?? 0) + 1; return { sets: specs.length, items: specs.reduce((a, s) => a + s.skills.length, 0), byCategory: c }; };
