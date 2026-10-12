// 예비 보충 2차(무료·읽기 전용): 5세트(exact-assign-5sets-cons.json) + 게시 AB#1 의 10건 교체안(하한 10 안)을 예약으로 보고 1.5배 예비 부족을 칸별로 센다.
//   npx tsx scripts/ap-generation/topup2-status.ts [--assignment <file>] [--no-swap]
import { readFileSync } from "node:fs";
import { loadPool, published } from "./assign-pool";
const arg = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const asg = JSON.parse(readFileSync(arg("--assignment", "data/ap/stock/exact-assign-5sets-cons.json"), "utf-8")) as { sets: { mcA: string[]; mcB: string[]; frqA: string[]; frqB: string[] }[] };
export const SWAP = ["s3c-graph-ab-final:ap_calculus_ab-m06-k0", "run1:ap_calculus_ab-c010-k0", "run2:ap_calculus_ab-m24-k0", "run2:ap_calculus_ab-m04-k2", "run2:ap_calculus_ab-m02-k2", "s3a-graph-ab-final:ap_calculus_ab-m17-k0", "supp-b3-ab-final:ap_calculus_ab-m10-k0", "s3a-graph-ab-final:ap_calculus_ab-m20-k0", "supp-b3-ab-final:ap_calculus_ab-m13-k0", "s1a-final:ap_calculus_ab-m27-k0"];
const pub = published(); const pubKeys = new Set([...pub.mcA, ...pub.mcB, ...pub.frqA, ...pub.frqB]);
const reserved5 = new Set(asg.sets.flatMap((s) => [...s.mcA, ...s.mcB, ...s.frqA, ...s.frqB]));
const { pool } = loadPool({ strictFamilies: true });
const noSwap = process.argv.includes("--no-swap");
const swapIn = noSwap ? [] : SWAP.filter((k) => pool.some((c) => c.key === k));
const swapOverlap = swapIn.filter((k) => reserved5.has(k));
const swapConsumed = swapIn.filter((k) => !reserved5.has(k));
const reserved = new Set([...reserved5, ...swapIn]);
const free = pool.filter((c) => !pubKeys.has(c.key));
const mc = free.filter((c) => c.kind === "mc");
const up = (x: number) => Math.ceil(x - 1e-9);
const rows: [string, number, (c: (typeof mc)[number]) => boolean][] = [
  ["MC 그래프 필수(5세트 하한 50)", 50, (c) => c.graph], ["MC 계산기 필수 Part B", 65, (c) => c.calc === "required"], ["MC 계산기 불가 Part A", 145, (c) => c.calc === "not_allowed"], ["MC BC 전용 9·10", 36, (c) => c.unit >= 9],
];
console.log(`교체안 10건 중 재고에 있음 ${swapIn.length}, 5세트와 겹침 ${swapOverlap.length}${swapOverlap.length ? " (" + swapOverlap.join(", ") + ")" : ""}, 추가로 소비하는 예비 ${swapConsumed.length}`);
for (const k of swapConsumed) { const c = pool.find((x) => x.key === k)!; console.log(`  소비: ${k} (단원 ${c.unit}, 스킬 ${c.skill}, 계산기 ${c.calc}, 그래프 ${c.graph}, 군 ${c.fam})`); }
const sw = new Set(swapIn);
console.log("\n| 묶음 | 목표 | 총재고 | 부족(교체안 전) | 교체안 소비 | 부족(교체안 후) | 미사용 |\n|---|---|---|---|---|---|---|");
for (const [n, d, f] of rows) { const it = mc.filter(f); const t = up(d * 1.5); const unused = it.filter((c) => !reserved.has(c.key)).length; const cons = it.filter((c) => sw.has(c.key)).length; console.log(`| ${n} | ${t} | ${it.length} | ${Math.max(0, t - it.length)} | ${cons} | ${Math.max(0, t - it.length + cons)} | ${unused} |`); }
const LO: Record<number, number> = { 1: 19, 2: 19, 3: 15, 4: 19, 5: 29, 6: 35, 7: 15, 8: 19, 9: 15, 10: 21 };
console.log("\n| 단원 | 목표 | 총재고 | 부족(교체안 전) | 교체안 소비 | 부족(교체안 후) | 미사용 | 미사용 계산기필수 | 미사용 그래프 |\n|---|---|---|---|---|---|---|---|---|");
for (let u = 1; u <= 10; u++) { const x = mc.filter((c) => c.unit === u); const t = up(LO[u] * 1.5); const un = x.filter((c) => !reserved.has(c.key)); const cu = x.filter((c) => sw.has(c.key)).length; console.log(`| ${u} | ${t} | ${x.length} | ${Math.max(0, t - x.length)} | ${cu} | ${Math.max(0, t - x.length + cu)} | ${un.length} | ${un.filter((c) => c.calc === "required").length} | ${un.filter((c) => c.graph).length} |`); }
