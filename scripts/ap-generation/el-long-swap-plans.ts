// EL1/EL2 공식 5묶음 구조 새 버전 교체 계획 생성(무료·DB 없음).
//   npx tsx scripts/ap-generation/el-long-swap-plans.ts
// 현재 공개 v3(= data/ap/stock/exact-assign-el-el1-el2.json 의 el-rv 키)의 MC 슬롯에서, 새 배정(exact-assign-el-long-el1-el2.json)의 묶음으로 슬롯 단위 재편 교체를 쓴다.
// 짧은 글쓰기 묶음(EL1 w22·EL2 w32)은 v3 에서 이미 마지막 슬롯에 있으므로 건드리지 않는다(DB RPC 는 이미 세트에 있는 문제를 다른 슬롯으로 옮길 수 없다). FRQ 는 그대로.
import { readFileSync, writeFileSync } from "node:fs";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const rd = (f: string) => JSON.parse(readFileSync(f, "utf-8")) as Json;
const size = (rows: Json[]) => (k: string) => (rows.find((r) => r.stockKey === k)?.payload.items as unknown[] | undefined)?.length ?? 0;
const rv = rd("data/ap/stock/el-rv-items.json") as unknown as Json[], lg = rd("data/ap/stock/el-long-items.json") as unknown as Json[];
const sizeOf = (k: string) => size(rv)(k) || size(lg)(k);
const cur = rd("data/ap/stock/exact-assign-el-el1-el2.json").sets as Json[], nxt = rd("data/ap/stock/exact-assign-el-long-el1-el2.json").sets as Json[];
const rvKey = (k: string) => (k.startsWith("el-rv:") ? k : `el-rv:${k.split(":")[1]}`); // 공개 v3 는 el-rv 교정본 키를 쓴다(슬롯 순서는 원본 배정과 같다)
const layout = (keys: string[]) => { let p = 1; return keys.map((k) => { const n = sizeOf(k); const o = { key: k, from: p, n }; p += n; return o; }); };
export function buildPlan(id: string) {
  const c = cur.find((s) => s.id === id)!, n = nxt.find((s) => s.id === id)!;
  const old = layout((c.mcA as string[]).map(rvKey)), neu = layout(n.mcA); const oldAt = (p: number) => old.find((o) => p >= o.from && p < o.from + o.n)!.key;
  const swaps: Json[] = [];
  for (const s of neu) { const keptInPlace = old.some((o) => o.key === s.key); if (keptInPlace) { const o = old.find((x) => x.key === s.key)!; if (o.from !== s.from) throw new Error(`${s.key} 는 제자리에 있지 않다(${o.from} -> ${s.from})`); continue; } for (let j = 0; j < s.n; j++) swaps.push({ section: "ap_mc", position: s.from + j, removeKey: oldAt(s.from + j), addKey: s.key, addIndex: j }); }
  const covered = new Set(swaps.map((x) => x.position)); const total = neu.reduce((a, s) => a + s.n, 0);
  for (const o of old) if (!(n.mcA as string[]).includes(o.key) && ![...Array(o.n)].every((_, j) => covered.has(o.from + j))) throw new Error(`기존 묶음 ${o.key} 의 슬롯이 다 교체되지 않는다`);
  return { kind: "ap_new_version_swap_plan", set: id, sourceSetName: `AP English Language — Practice Exam ${id.slice(2)}`, sourceVersionNo: 3, regroup: "official 5-set MC structure (reading 2 sets of 11-14, writing 7-9 / 7-9 / 4-6); MC slots only, FRQ unchanged", mcTotal: total, swaps };
}
if (process.argv[1]?.endsWith("el-long-swap-plans.ts")) for (const id of ["EL1", "EL2"]) { const p = buildPlan(id); writeFileSync(`data/ap/stock/${id.toLowerCase()}-long-v4-swap-plan.json`, JSON.stringify(p, null, 1)); console.log(`${id}: ${p.swaps.length} swaps, MC ${p.mcTotal}`); }
