// 예비 3차(R3) 신규 통과 항목의 구조 판정(무료·읽기 전용): 기존 재고 전체와 look-alike 군집이 되는지, 새 구조 문항군으로 세는지 확인한다.
//   npx tsx scripts/ap-generation/r3-structure.ts supp-r3a-pass-keys.json [...]
import { readFileSync } from "node:fs";
import { loadPool } from "./assign-pool";
const keys = process.argv.slice(2).flatMap((f) => JSON.parse(readFileSync(`data/ap/stock/${f}`, "utf-8")) as string[]);
const { all } = loadPool({ requireScreen: false, strictFamilies: true });
const newSet = new Set(keys);
let independent = 0;
const fams = new Set<string>();
for (const k of keys) {
  const c = all.find((x) => x.key === k);
  if (!c) { console.log("MISSING", k); continue; }
  const peers = all.filter((x) => x.fam === c.fam && x.key !== k);
  const old = peers.filter((x) => !newSet.has(x.key));
  const joined = old.length > 0;
  if (!joined) { independent++; fams.add(c.fam); }
  console.log(`${joined ? "JOIN" : "new "} ${c.archetype.padEnd(40)} u${c.unit} s${c.skill} ${c.calc.padEnd(11)} ${c.graph ? "G" : "-"} ${c.rep.padEnd(40)} 기존 같은 군 ${old.length}${joined ? " (" + old.slice(0, 2).map((x) => x.key).join(", ") + ")" : ""}`);
}
console.log(`\n신규 통과 ${keys.length}, 새 독립 구조 군 ${independent}(신규끼리 같은 군 포함 시 군 ${fams.size}), 기존 군에 합류 ${keys.length - independent}`);
