// AP U.S. History 자료 세트 계획기(순수·결정적, 2026-10-14): 시대별 개수 → 자료 유형·발전 주제·스킬 슬롯. 이 파일은 동결 구성 해시 대상이다.
import { USH_STIM_SKILLS, USH_THEMES } from "./subjects/ushistory";

export type UshSetSpec = { id: string; period: number; stim: string; theme: string; skills: string[]; nItems: number; seed: number };
function rng(seed: number) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const shuffle = <T,>(a: T[], r: () => number): T[] => { const o = a.slice(); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; };
const STIM_CYCLE = ["primary_text", "secondary_text", "primary_text", "quantitative", "paired_text", "primary_text", "secondary_text", "quantitative"];
export type PlanCfg = { perPeriod: Record<string, number>; seed: number; startIndex?: number; usedThemes?: string[]; noQuantPeriods?: number[] };
export function planUshSets(c: PlanCfg): UshSetSpec[] {
  const r = rng(c.seed); const out: UshSetSpec[] = []; let idx = c.startIndex ?? 0; const used = new Set(c.usedThemes ?? []);
  for (const [pk, n] of Object.entries(c.perPeriod)) {
    const p = Number(pk); const themes = shuffle((USH_THEMES[p] ?? []).filter((t) => !used.has(t)), r); const rot = Math.floor(r() * STIM_CYCLE.length);
    for (let i = 0; i < n; i++) {
      let stim = STIM_CYCLE[(rot + i) % STIM_CYCLE.length]; if (stim === "quantitative" && (c.noQuantPeriods ?? [1]).includes(p)) stim = "primary_text";
      const theme = themes[i % themes.length]; used.add(theme); const slate = USH_STIM_SKILLS[stim]; const nItems = 4;
      const skills = slate.slice(0, nItems).map((opts, k) => opts[Math.floor(r() * opts.length + k) % opts.length]);
      out.push({ id: `u${p}${String(++idx).padStart(2, "0")}`, period: p, stim, theme, skills, nItems, seed: Math.floor(r() * 90000) + 10000 });
    }
  }
  return out;
}
export const planSummaryUsh = (specs: UshSetSpec[]) => { const by = (f: (s: UshSetSpec) => string) => specs.reduce<Record<string, number>>((o, s) => { const k = f(s); o[k] = (o[k] ?? 0) + 1; return o; }, {}); return { sets: specs.length, items: specs.reduce((a, s) => a + s.nItems, 0), byPeriod: by((s) => String(s.period)), byStim: by((s) => s.stim) }; };
