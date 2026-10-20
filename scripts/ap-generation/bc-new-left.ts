// 임시 진단: 공개 세트(AB1~3·BC1~3)에 쓰인 문항군·아키타입과 겹치지 않는 재고 수. 사용: npx tsx scripts/ap-generation/bc-new-left.ts <excl.json>
import { readFileSync } from "node:fs";
import { loadPool, published } from "./assign-pool";
const ex = JSON.parse(readFileSync(process.argv[2], "utf-8")) as { keys: Record<string, string[]> };
const pub = published();
const used = new Set([...pub.mcA, ...pub.mcB, ...pub.frqA, ...pub.frqB, ...Object.values(ex.keys).flat()]);
const { all } = loadPool({ requireScreen: false, strictFamilies: true });
const usedItems = all.filter((c) => used.has(c.key));
const usedFam = new Set(usedItems.map((c) => c.fam)); const usedArch = new Set(usedItems.map((c) => c.archetype));
const left = all.filter((c) => !used.has(c.key));
const fresh = left.filter((c) => !usedFam.has(c.fam) && !usedArch.has(c.archetype));
console.log(`used items ${usedItems.length} (of keys ${used.size}); archetypes used ${usedArch.size}; fam used ${usedFam.size}`);
console.log(`left ${left.length} (mc ${left.filter((c) => c.kind === "mc").length}, frq ${left.filter((c) => c.kind === "frq").length}); fresh vs published ${fresh.length} (mc ${fresh.filter((c) => c.kind === "mc").length}, frq ${fresh.filter((c) => c.kind === "frq").length})`);
const by = new Map<string, number>(); for (const c of fresh.filter((c) => c.kind === "mc")) { const k = `u${c.unit}${c.calc === "required" ? "B" : "A"}`; by.set(k, (by.get(k) ?? 0) + 1); }
console.log([...by].sort().map(([k, v]) => `${k}:${v}`).join(" "));
console.log("fresh unique archetypes", new Set(fresh.map((c) => c.archetype)).size, "fresh unique fams", new Set(fresh.map((c) => c.fam)).size);
console.log("fresh frq types", fresh.filter((c) => c.kind === "frq").map((c) => `${c.archetype}/${c.calc}/${c.native ? "bc" : "sh"}`).join(", "));
