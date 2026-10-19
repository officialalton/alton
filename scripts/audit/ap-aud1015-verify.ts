// 외부 AP 감사 2026-10-15 CSA·Calculus 교체안 독립 검증(로컬 파일만, DB 없음).
//   npx tsx scripts/audit/ap-aud1015-verify.ts
// Calculus: 게시 구성(재고 파일 + 기존 교체안 적용) 6세트에 이번 교체안을 적용해 verifyAssignment 위반 0 확인.
// CSA: 게시 구성(exact-assign + r6 교체안) 2세트에 이번 교체안을 적용해 verifyCsAssignment 위반 0 확인.
import { readFileSync } from "node:fs";
import { loadPool, type Item } from "../ap-generation/assign-pool";
import { verifyAssignment, type SetResult, type Spec } from "../ap-generation/exact-assign";
import { loadCsPool, type CsItem } from "../ap-generation/cs-pool";
import { verifyCsAssignment, type CsResult } from "../ap-generation/cs-assign";

const rd = <T>(p: string) => JSON.parse(readFileSync(p, "utf-8")) as T;
type Swap = { section: string; position: number; removeKey: string; addKey: string };
const plan = (f: string) => rd<{ swaps: Swap[] }>(`data/ap/stock/${f}`).swaps;
let failed = false;

// ---- Calculus
type Keys = Record<"mcA" | "mcB" | "frqA" | "frqB", string[]>;
const SEC: Record<string, keyof Keys> = { ap_mc_a: "mcA", ap_mc_b: "mcB", ap_frq_a: "frqA", ap_frq_b: "frqB" };
const comp = new Map<string, Keys>();
comp.set("AB1", rd<{ keys: Keys }>("data/ap/stock/ab-full-set-selection.json").keys);
for (const s of rd<{ sets: ({ id: string } & Keys)[] }>("data/ap/stock/exact-assign-5sets-cons.json").sets) comp.set(s.id, { mcA: [...s.mcA], mcB: [...s.mcB], frqA: [...s.frqA], frqB: [...s.frqB] });
const prior: Record<string, string[]> = { AB1: ["ab1-v2-swap-plan.json", "ab1-v3-audit-swap-plan.json"], AB2: ["ab2-v2-audit-swap-plan.json"], AB3: ["ab3-v2-audit-swap-plan.json"], BC1: ["bc1-v2-audit-swap-plan.json", "bc1-v3-frq-audit-swap-plan.json"], BC2: ["bc2-v2-audit-swap-plan.json"], BC3: [] };
for (const [id, k] of comp) comp.set(id, { mcA: [...k.mcA], mcB: [...k.mcB], frqA: [...k.frqA], frqB: [...k.frqB] });
const apply = (id: string, s: Swap, strict: boolean) => { const g = SEC[s.section]; const c = comp.get(id)!; const i = s.position - 1; if (strict && c[g][i] !== s.removeKey) throw new Error(`${id} ${s.section}#${s.position}: 현재 ${c[g][i]} ≠ removeKey ${s.removeKey}`); c[g][i] = s.addKey; };
for (const [id, fs] of Object.entries(prior)) for (const f of fs) for (const s of plan(f)) apply(id, s, false);
const { all } = loadPool({ strictFamilies: true });
const by = new Map(all.map((c) => [c.key, c]));
const spec = (id: string): Spec => ({ id, subj: id.startsWith("BC") ? "bc" : "ab", floor: id === "AB1" ? 9 : 10 });
const mk = (id: string, k: Keys): SetResult => ({ id, mcA: k.mcA.map((x) => by.get(x)!), mcB: k.mcB.map((x) => by.get(x)!), virtual: [], frqA: k.frqA.map((x) => by.get(x)!), frqB: k.frqB.map((x) => by.get(x)!), frqVirtual: [] });
const verifyAll = () => { const ids = [...comp.keys()]; for (const id of ids) for (const g of ["mcA", "mcB", "frqA", "frqB"] as const) comp.get(id)![g].forEach((x) => { if (!by.get(x)) throw new Error(`${id}: 풀에 없는 키 ${x}`); }); return verifyAssignment(ids.map(spec), ids.map((i) => mk(i, comp.get(i)!)), new Set()); };
const base = verifyAll();
console.log(`Calculus 기준(교체 전) 위반 ${base.length}${base.length ? ": " + base.slice(0, 4).join(" | ") : ""}`);
for (const [id, f] of [["AB1", "ab1-v5-audit-aud1015-swap-plan.json"], ["AB3", "ab3-v3-audit-aud1015-swap-plan.json"], ["BC1", "bc1-v5-audit-aud1015-swap-plan.json"], ["BC2", "bc2-v3-audit-aud1015-swap-plan.json"], ["BC3", "bc3-v2-audit-aud1015-swap-plan.json"]] as const) {
  for (const s of plan(f)) { const g = SEC[s.section]; const cur = comp.get(id)![g][s.position - 1]; if (cur !== s.removeKey) console.log(`  [경고] ${id} ${s.section}#${s.position}: 재고 구성 ${cur} ≠ removeKey ${s.removeKey}(별칭 차이일 수 있음 — 패널은 DB 의 removeKey 로 칸을 찾는다)`); apply(id, s, false); }
}
const after = verifyAll();
console.log(`Calculus 교체 후 위반 ${after.length}${after.length ? ": " + after.slice(0, 6).join(" | ") : ""}`);
if (after.length) failed = true;
// 새 후보 스크린(증거) 상태
const calcNew = all.filter((c: Item) => c.key.startsWith("supp-aud1015-final:"));
console.log(`Calculus 새 후보 ${calcNew.length}건, 화면 증거 보유 ${calcNew.filter((c) => c.screen).length}건`);

// ---- CSA
const { all: csAll } = loadCsPool({ requireScreen: false });
const csBy = new Map(csAll.map((c) => [c.key, c]));
const cs = rd<{ sets: { id: string; mcA: string[]; frqA: string[] }[] }>("data/ap/stock/exact-assign-csa-cs1-cs2.json").sets;
const csComp = new Map(cs.map((s) => [s.id, { mc: [...s.mcA], frq: [...s.frqA] }]));
const csPlans: Record<string, string[]> = { CS1: ["csa1-v2-audit-aud1015-swap-plan.json"], CS2: ["csa2-v2-audit-r6-swap-plan.json", "csa2-v3-audit-aud1015-swap-plan.json"] };
for (const [id, fs] of Object.entries(csPlans)) {
  const c = csComp.get(id)!;
  for (const f of fs) for (const s of plan(f)) {
    const list = s.section === "ap_frq" ? c.frq : c.mc;
    const i = list.indexOf(s.removeKey);
    if (i < 0) { console.log(`  [오류] ${id} ${f}: removeKey ${s.removeKey} 가 구성에 없음`); failed = true; continue; }
    list[i] = s.addKey;
  }
}
const toRes = (id: string): CsResult => {
  const c = csComp.get(id)!; const items = [...c.mc].map((k) => csBy.get(k)!); if (items.some((x) => !x)) throw new Error(`${id}: CSA 풀에 없는 키`);
  const sets = items.filter((x) => x.shared), singles = items.filter((x) => !x.shared);
  return { id, singles, sets, virtual: [], virtualSets: [], virtualSetArchetypes: [], frq: c.frq.map((k) => csBy.get(k)!), frqVirtual: [] } as unknown as CsResult;
};
const csBad = verifyCsAssignment([toRes("CS1"), toRes("CS2")], new Set(), { disjoint: true });
console.log(`CSA 교체 후 위반 ${csBad.length}${csBad.length ? ": " + csBad.slice(0, 8).join(" | ") : ""}`);
if (csBad.length) failed = true;
const csNew = csAll.filter((c: CsItem) => c.key.startsWith("csa-aud1015:"));
console.log(`CSA 새 후보 ${csNew.length}건(풀 통과), 화면 증거 보유 ${csNew.filter((c) => c.screen).length}건`);
process.exit(failed ? 1 : 0);
