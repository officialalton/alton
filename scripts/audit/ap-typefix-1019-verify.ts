// 외부 AP 검수 유형 단위 수정(2026-10-19) 미적분 교체안(AB2·AB3 FRQ-B) 독립 검증(로컬 파일만, DB 없음).
//   npx tsx scripts/audit/ap-typefix-1019-verify.ts
// 게시 구성(재고 파일 + 이미 만들어진 교체안 모두) 6세트에 이번 교체안을 적용해 verifyAssignment 위반이 늘지 않는지 확인한다.
import { readFileSync, readdirSync } from "node:fs";
import { loadPool, type Item } from "../ap-generation/assign-pool";
import { verifyAssignment, type SetResult, type Spec } from "../ap-generation/exact-assign";

type Keys = Record<"mcA" | "mcB" | "frqA" | "frqB", string[]>;
type Swap = { section: string; position?: number; removeKey: string; addKey: string };
type PlanFile = { set: string; sourceVersionNo: number; swaps: Swap[] };
const rd = <T>(p: string) => JSON.parse(readFileSync(p, "utf-8")) as T;
const D = "data/ap/stock/";
const MINE = /-audit-1019-swap-plan\.json$/;
const SEC: Record<string, keyof Keys> = { ap_mc_a: "mcA", ap_mc_b: "mcB", ap_frq_a: "frqA", ap_frq_b: "frqB" };

export function composeCalc(includeMine: boolean) {
  const comp = new Map<string, Keys>();
  comp.set("AB1", rd<{ keys: Keys }>(D + "ab-full-set-selection.json").keys);
  for (const s of rd<{ sets: ({ id: string } & Keys)[] }>(D + "exact-assign-5sets-cons.json").sets) comp.set(s.id, { mcA: [...s.mcA], mcB: [...s.mcB], frqA: [...s.frqA], frqB: [...s.frqB] });
  for (const [id, k] of comp) comp.set(id, { mcA: [...k.mcA], mcB: [...k.mcB], frqA: [...k.frqA], frqB: [...k.frqB] });
  const files = readdirSync(D).filter((f) => /swap-plan/.test(f) && (includeMine || !MINE.test(f)));
  const plans = files.map((f) => ({ f, p: rd<PlanFile>(D + f) })).filter((x) => comp.has(x.p.set)).sort((a, b) => a.p.sourceVersionNo - b.p.sourceVersionNo || a.f.localeCompare(b.f));
  const log: string[] = [];
  for (const { f, p } of plans) for (const s of p.swaps) {
    const c = comp.get(p.set)!; let done = false;
    for (const g of ["mcA", "mcB", "frqA", "frqB"] as const) { const i = c[g].indexOf(s.removeKey); if (i >= 0 && !done) { c[g][i] = s.addKey; done = true; } }
    log.push(`${done ? "applied" : "skipped"} ${f} ${p.set} ${s.removeKey}`);
  }
  return { comp, log };
}

export function verifyCalc(includeMine: boolean) {
  const { comp, log } = composeCalc(includeMine);
  const { all } = loadPool({ strictFamilies: true });
  const by = new Map(all.map((c: Item) => [c.key, c]));
  const spec = (id: string): Spec => ({ id, subj: id.startsWith("BC") ? "bc" : "ab", floor: id === "AB1" ? 9 : 10 });
  const missing: string[] = [];
  const mk = (id: string, k: Keys): SetResult => {
    const g = (l: string[]) => l.map((x) => { const c = by.get(x); if (!c) missing.push(`${id}:${x}`); return c!; });
    return { id, mcA: g(k.mcA), mcB: g(k.mcB), virtual: [], frqA: g(k.frqA), frqB: g(k.frqB), frqVirtual: [] };
  };
  const ids = [...comp.keys()];
  const v = verifyAssignment(ids.map(spec), ids.map((i) => mk(i, comp.get(i)!)), new Set());
  return { violations: v, missing, comp, log };
}

if (new RegExp("ap-typefix-1019-verify\\.ts$").test(process.argv[1] ?? "")) {
  const base = verifyCalc(false); const after = verifyCalc(true);
  console.log(`Calculus 기준(교체 전) 위반 ${base.violations.length}, 교체 후 ${after.violations.length}, 풀에 없는 키 ${after.missing.length}`);
  const introduced = after.violations.filter((x) => !base.violations.includes(x));
  const mine = after.log.filter((l) => /audit-1019/.test(l));
  for (const l of mine) console.log("  " + l);
  if (introduced.length || after.missing.length || mine.some((l) => l.startsWith("skipped"))) { console.log("새 위반:", introduced, "없는 키:", after.missing); process.exit(1); }
}
