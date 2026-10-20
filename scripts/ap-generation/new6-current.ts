// 현재 공개(기준) 키 = 기준 배정 + 교체 계획 적용. 남은 재고(문항·문항군 모두 현재 세트와 겹치지 않는 것) 요약(읽기 전용).
import { readdirSync, readFileSync } from "node:fs";
import { loadUshPool } from "./ush-pool";
import { loadWhPool } from "./wh-pool";
import { loadElPool } from "./el-pool";
import { loadLtPool } from "./lt-pool";
import { loadPsychPool } from "./psych-pool";

const J = (f: string) => JSON.parse(readFileSync(`data/ap/stock/${f}`, "utf-8"));
export function currentKeys(base: string[], swapRe: RegExp | null): Set<string> {
  const cur = new Set<string>();
  for (const f of base) for (const s of J(f).sets) for (const k of [...(s.mcA ?? []), ...(s.mcB ?? []), ...(s.frqA ?? []), ...(s.frqB ?? [])]) cur.add(k);
  if (swapRe) for (const f of readdirSync("data/ap/stock").filter((x) => swapRe.test(x)).sort()) { const p = J(f); for (const s of p.swaps ?? []) { if (s.removeKey) cur.delete(s.removeKey); if (s.addKey) cur.add(s.addKey); for (const k of s.removeKeys ?? []) cur.delete(k); for (const k of s.addKeys ?? []) cur.add(k); } }
  return cur;
}
type P = { key: string; kind: string; batch: string; fam: string; archetype?: string };
const cfg: Record<string, { base: string[]; swap: RegExp | null; load: () => P[] }> = {
  US: { base: ["exact-assign-ushistory-us1-us2.json"], swap: /^us\d-v\d-.*swap-plan\.json$/, load: () => loadUshPool().pool as unknown as P[] },
  WH: { base: ["exact-assign-worldhistory-wh1-wh2.json"], swap: /^wh\d-v\d-.*swap-plan\.json$/, load: () => loadWhPool().pool as unknown as P[] },
  EL: { base: ["exact-assign-el-long-el1-el2.json"], swap: null, load: () => loadElPool().pool as unknown as P[] },
  LT: { base: ["exact-assign-englit-lt1-lt2.json"], swap: /^lt\d-v\d-.*swap-plan\.json$/, load: () => loadLtPool().pool as unknown as P[] },
  PS: { base: ["exact-assign-psych-ps1-ps2-v3.json"], swap: null, load: () => loadPsychPool().pool as unknown as P[] },
};
if (process.argv[1]?.endsWith("new6-current.ts")) {
  for (const [name, c] of Object.entries(cfg)) {
    const cur = currentKeys(c.base, c.swap); const pool = c.load(); const fams = new Set(pool.filter((p) => cur.has(p.key)).map((p) => p.fam));
    const missing = [...cur].filter((k) => !pool.some((p) => p.key === k));
    const rest = pool.filter((p) => !cur.has(p.key)); const rest2 = rest.filter((p) => !fams.has(p.fam));
    const by: Record<string, number> = {}; for (const p of rest2) by[`${p.kind}:${p.batch}`] = (by[`${p.kind}:${p.batch}`] ?? 0) + 1;
    console.log(name, "current", cur.size, "(not in pool", missing.length + ")", "pool", pool.length, "unused", rest.length, "unused&famfree", rest2.length, JSON.stringify(by));
  }
}
