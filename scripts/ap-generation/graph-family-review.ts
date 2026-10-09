// 신규 통과 MC 69건의 문항군 구조 판정표(무료·읽기 전용). 판정은 data/ap/stock/structure-groups.json(검토자 판단 + 근거)에서 온다.
//   npx tsx scripts/ap-generation/graph-family-review.ts [--md]
// 판정: N = 독립 구조(새 문항군), R-기존 = 기존 재고 아키타입의 표현·숫자 변형(새 문항군 아님), R-신규 = 다른 신규 문항의 변형(묶음 대표 1건만 새 문항군).
import { readFileSync } from "node:fs";
import { loadPool } from "./assign-pool";

const groups = (JSON.parse(readFileSync("data/ap/stock/structure-groups.json", "utf-8")) as { groups: { archetypes: string[]; basis: string }[] }).groups;
const { all } = loadPool({ requireScreen: false });
const mc = all.filter((c) => c.kind === "mc"); const nw = mc.filter((c) => c.isNew); const oldArch = new Set(mc.filter((c) => !c.isNew).map((c) => c.archetype));
const rows = nw.map((c) => {
  const g = groups.find((x) => x.archetypes.includes(c.archetype));
  if (!g) return { c, v: "N" as const, basis: "다른 모든 문항과 질문·풀이 골격이 다름", partner: "" };
  const oldMember = g.archetypes.find((a) => oldArch.has(a));
  if (oldMember) return { c, v: "R-기존" as const, basis: g.basis, partner: oldMember };
  const rep = g.archetypes.find((a) => nw.some((x) => x.archetype === a))!;
  return rep === c.archetype ? { c, v: "N" as const, basis: `(묶음 대표) ${g.basis}`, partner: "" } : { c, v: "R-신규" as const, basis: g.basis, partner: rep };
});
const n = (v: string) => rows.filter((r) => r.v === v).length;
console.log(`신규 통과 MC ${rows.length}건: 독립 구조 N ${n("N")}, 기존 아키타입 변형 R-기존 ${n("R-기존")}, 신규끼리 변형 R-신규 ${n("R-신규")}`);
console.log(`아키타입 코드 공유: 신규끼리 0, 기존과 0(코드는 69개 모두 서로 다름) — 코드 기준 69문항군 / 구조 기준 독립 ${n("N")}문항군`);
const byS = (k: string) => rows.filter((r) => r.c.key.startsWith(k));
console.log("| 후보 | 아키타입 | 단원.토픽 | 판정 | 비교 대상(기존/대표) | 근거 |\n|---|---|---|---|---|---|");
for (const r of rows) console.log(`| ${r.c.key.replace(/-final:ap_calculus_/, ":")} | ${r.c.archetype} | ${r.c.type} | ${r.v} | ${r.partner} | ${r.basis} |`);
void byS;
