// 문항군 수 비교(무료·읽기 전용). STRUCTURE_GROUPS_FILE 로 묶음 파일을 바꿔 엄격(committed)·보수(스크래치) 시나리오의 군집 수를 확인한다.
//   npx tsx scripts/ap-generation/family-count.ts [--list]
import { loadPool } from "./assign-pool";
const { all } = loadPool({ strictFamilies: true });
const mc = all.filter((c) => c.kind === "mc");
const supp = mc.filter((c) => c.pending === "supp");
const indep = [...new Set(supp.map((c) => c.fam))].filter((f) => !mc.some((c) => c.pending !== "supp" && c.fam === f));
console.log(`MC 재고 ${mc.length} 문항군 ${new Set(mc.map((c) => c.fam)).size} / 보강 MC ${supp.length} 중 기존 군과 섞이지 않는 독립 군 ${indep.length}`);
if (process.argv.includes("--list")) for (const f of indep) console.log(`  ${[...new Set(supp.filter((c) => c.fam === f).map((c) => c.archetype))].join("+")}`);
