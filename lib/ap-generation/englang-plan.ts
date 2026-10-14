// AP English Language 지문 묶음 계획기(순수·결정적, 2026-10-14): 스킬 범주 비중(ELANG_FULL_TARGET)에 맞춰 묶음마다 스킬 6개를 배정하고 장르·주제를 겹치지 않게 고른다.
// 블루프린트/커버리지 계획: 어떤 스킬 범주가 몇 문항 필요한지 → 묶음 수 → 묶음별 스킬 목록.
import { ELANG_FULL_TARGET } from "../ap-exam/elang-rules";
import { EL_READING_GENRES, EL_THEMES, EL_WRITING_GENRES } from "./subjects/englang";
import type { SetSpec } from "./englang-prompts";

const READ_CAT_SKILLS: Record<string, string[]> = { "RS-R": ["1.A", "1.B"], "CE-R": ["3.A", "3.B", "3.C"], "RO-R": ["5.A", "5.B", "5.C"], "S-R": ["7.A", "7.B", "7.C"] };
const WRITE_CAT_SKILLS: Record<string, string[]> = { "RS-W": ["2.A", "2.B"], "CE-W": ["4.A", "4.B", "4.C"], "RO-W": ["6.A", "6.B", "6.C"], "S-W": ["8.A", "8.B", "8.C"] };

function rng(seed: number) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const shuffle = <T,>(a: T[], r: () => number): T[] => { const o = a.slice(); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; };

/** n 칸을 가중치 비율로 최대잔여법 배분. */
export function apportion(weights: Record<string, number>, n: number): Record<string, number> {
  const tot = Object.values(weights).reduce((a, b) => a + b, 0); const raw = Object.entries(weights).map(([k, w]) => [k, (w / tot) * n] as const);
  const out: Record<string, number> = Object.fromEntries(raw.map(([k, x]) => [k, Math.floor(x)])); let left = n - Object.values(out).reduce((a, b) => a + b, 0);
  for (const [k] of [...raw].sort((a, b) => (b[1] - Math.floor(b[1])) - (a[1] - Math.floor(a[1])) || a[0].localeCompare(b[0]))) { if (left-- > 0) out[k] += 1; }
  return out;
}

export type PlanOpts = { kind: "reading" | "writing"; sets: number; perSet?: number; seed: number; startIndex?: number; idPrefix?: string; usedThemes?: Set<string> };
/** 한 종류(읽기/글쓰기)의 묶음 계획. 같은 범주 슬롯을 묶음 사이에 돌려 가며 나눠 묶음마다 범주가 섞이고, 범주 안 스킬 코드는 고르게 돈다. */
export function planSets(o: PlanOpts): SetSpec[] {
  const per = o.perSet ?? 6; const r = rng(o.seed); const catSkills = o.kind === "reading" ? READ_CAT_SKILLS : WRITE_CAT_SKILLS;
  const weights = Object.fromEntries(Object.keys(catSkills).map((c) => [c, ELANG_FULL_TARGET.categories[c]]));
  const slots = apportion(weights, o.sets * per); const cats = Object.keys(catSkills);
  const counters: Record<string, number> = {}; const skillOf = (c: string) => { const l = catSkills[c]; const i = (counters[c] = (counters[c] ?? 0) + 1) - 1; return l[(i + Math.floor(r() * 2)) % l.length]; };
  // 슬롯 목록을 범주별로 정렬한 뒤 묶음에 순환 배정 → 각 묶음이 여러 범주를 섞어 받는다.
  const list: string[] = cats.flatMap((c) => Array.from({ length: slots[c] }, () => c));
  const bucket: string[][] = Array.from({ length: o.sets }, () => []);
  list.forEach((c, i) => bucket[i % o.sets].push(c));
  const themes = shuffle(EL_THEMES.filter((t) => !o.usedThemes?.has(t)), r); const genres = shuffle(o.kind === "reading" ? [...EL_READING_GENRES] : [...EL_WRITING_GENRES], r);
  return bucket.map((cs, i) => {
    const idx = (o.startIndex ?? 0) + i + 1; const skills = shuffle(cs.map((c) => skillOf(c)), r).sort((a, b) => Number(a.split(".")[0]) - Number(b.split(".")[0]) || a.localeCompare(b));
    return { id: `${o.idPrefix ?? (o.kind === "reading" ? "r" : "w")}${String(idx).padStart(2, "0")}`, kind: o.kind, genre: genres[i % genres.length], theme: themes[i % themes.length], skills, seed: Math.floor(r() * 90000) + 10000 };
  });
}
export const planSummary = (specs: SetSpec[]) => { const c: Record<string, number> = {}; for (const s of specs) for (const k of s.skills) { const cat = `${k.split(".")[0]}`; c[cat] = (c[cat] ?? 0) + 1; } return { sets: specs.length, items: specs.reduce((a, s) => a + s.skills.length, 0), byCategoryDigit: c, skills: specs.flatMap((s) => s.skills).reduce<Record<string, number>>((m, k) => { m[k] = (m[k] ?? 0) + 1; return m; }, {}) }; };
