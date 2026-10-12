// 보강 이후 5세트(AB#2·AB#3·BC#1·BC#2·BC#3) 재고 상태(무료·읽기 전용): 묶음별로 게시(AB#1 고정)·예약(5세트 정확 배정에 쓰인 항목)·미사용 예비를 이중 계산 없이 세고 1.5배 목표 대비 채움률을 낸다.
//   npx tsx scripts/ap-generation/supplement-status.ts [--assignment data/ap/stock/exact-assign-5sets-supp-strict.json] [--no-strict]
// 재고 = 자동 통과·결함 0·완전 중복 제외·렌더 게이트 통과·화면 증거 보유. (검증 대기) = 비프로덕션 DB 에 아직 검증 기록이 없는 항목(신규 70 + 형제 21 + 보강 49).
import { readFileSync } from "node:fs";
import { loadPool, published } from "./assign-pool";

const arg = (n: string, d: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const strict = !process.argv.includes("--no-strict");
const asg = JSON.parse(readFileSync(arg("--assignment", "data/ap/stock/exact-assign-5sets-supp-strict.json"), "utf-8")) as { sets: { id: string; mcA: string[]; mcB: string[]; frqA: string[]; frqB: string[] }[] };
const pub = published(); const pubKeys = new Set([...pub.mcA, ...pub.mcB, ...pub.frqA, ...pub.frqB]);
const reserved = new Set(asg.sets.flatMap((s) => [...s.mcA, ...s.mcB, ...s.frqA, ...s.frqB]));
const { pool } = loadPool({ strictFamilies: strict });
const free = pool.filter((c) => !pubKeys.has(c.key)); const mc = free.filter((c) => c.kind === "mc"), fr = free.filter((c) => c.kind === "frq");
const up = (x: number) => Math.ceil(x - 1e-9);
type G = { name: string; demand: number; pick: (c: (typeof pool)[number]) => boolean; kind: "mc" | "frq" };
const groups: G[] = [
  { name: "MC 계산기 불가(Part A)", demand: 145, kind: "mc", pick: (c) => c.calc === "not_allowed" },
  { name: "MC 계산기 필수(Part B)", demand: 65, kind: "mc", pick: (c) => c.calc === "required" },
  { name: "MC 그래프 필수(세트당 하한 10)", demand: 50, kind: "mc", pick: (c) => c.graph },
  { name: "MC BC 전용 단원 9·10", demand: 36, kind: "mc", pick: (c) => c.unit >= 9 },
  { name: "FRQ Part A(계산기)", demand: 10, kind: "frq", pick: (c) => c.calc === "required" },
  { name: "FRQ Part B(계산기 불가)", demand: 20, kind: "frq", pick: (c) => c.calc !== "required" },
  { name: "FRQ BC 전용", demand: 6, kind: "frq", pick: (c) => c.native },
];
console.log("| 묶음 | 5세트 수요 | 게시(AB#1 고정, 참고) | 예약(5세트 배정) | 미사용 예비 | (그중 검증 대기) | 합계(예약+미사용) | 1.5배 목표 | 채움률 | 그중 보강 신규 |");
console.log("|---|---|---|---|---|---|---|---|---|---|");
for (const g of groups) {
  const src = g.kind === "mc" ? mc : fr; const items = src.filter(g.pick);
  const res = items.filter((c) => reserved.has(c.key)).length; const unused = items.filter((c) => !reserved.has(c.key));
  const tgt = up(g.demand * 1.5); const pubN = pool.filter((c) => pubKeys.has(c.key) && c.kind === g.kind && g.pick(c)).length;
  console.log(`| ${g.name} | ${g.demand} | ${pubN} | ${res} | ${unused.length} | ${unused.filter((c) => c.pending).length} | ${items.length} | ${tgt} | ${(100 * items.length / tgt).toFixed(0)}% | ${items.filter((c) => c.pending === "supp").length} |`);
}
console.log("\n| 단원(MC) | 필수 하한(5세트) | 예약 | 미사용 예비 | 합계 | 1.5배 목표(하한 기준) | 채움률 | 그중 보강 신규 |");
console.log("|---|---|---|---|---|---|---|---|");
const LO = (u: number) => ({ 1: 19, 2: 19, 3: 15, 4: 19, 5: 29, 6: 35, 7: 15, 8: 19, 9: 15, 10: 21 } as Record<number, number>)[u];
for (let u = 1; u <= 10; u++) { const x = mc.filter((c) => c.unit === u); const res = x.filter((c) => reserved.has(c.key)).length; const tgt = up(LO(u) * 1.5); console.log(`| ${u} | ${LO(u)} | ${res} | ${x.length - res} | ${x.length} | ${tgt} | ${(100 * x.length / tgt).toFixed(0)}% | ${x.filter((c) => c.pending === "supp").length} |`); }
console.log(`\n세트 구성: 게시 AB#1(MC 42·FRQ 6, 변경 없음) + 예약 5세트(MC ${asg.sets.reduce((a, s) => a + s.mcA.length + s.mcB.length, 0)}·FRQ ${asg.sets.reduce((a, s) => a + s.frqA.length + s.frqB.length, 0)}) ; 재고 MC ${mc.length}(군집 ${new Set(mc.map((c) => c.fam)).size}) FRQ ${fr.length}.`);
console.log(`보강 신규 중 예약에 쓰인 항목: MC ${mc.filter((c) => c.pending === "supp" && reserved.has(c.key)).length}, FRQ ${fr.filter((c) => c.pending === "supp" && reserved.has(c.key)).length}.`);
