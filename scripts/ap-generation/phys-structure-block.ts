// Physics 1 5번째 세트용 구조 차단 목록(2026-10-22, 읽기 전용·무료·DB 없음). 오너 규칙: 자료·조건·질문·풀이 단계를 숫자·이름을 가린 뒤 비교(structure-compare.sameStructure).
// 공개 문항과 구조 동일인 후보(MC 단독·세트)와, 공개 FRQ와 같은 시나리오 제목(숫자·이름 마스킹)인 FRQ 를 막는 보고서(.json, phys-assign --block-file 형식)를 쓴다.
//   npx tsx scripts/ap-generation/phys-structure-block.ts [--write data/ap/stock/blocked-structure-phys1.json]
import { readFileSync, writeFileSync } from "node:fs";
import { loadRaws, sameStructure } from "./structure-compare";
import { loadPhysPool } from "./phys-pool";
const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const RAW = loadRaws();
const pub = (JSON.parse(readFileSync("data/ap/stock/blocked-db-phys1.json", "utf-8")) as { sets: { mcA?: string[]; frqA?: string[] }[] }).sets;
const pubKeys = new Set(pub.flatMap((s) => [...(s.mcA ?? []), ...(s.frqA ?? [])]));
const { all } = loadPhysPool({ requireScreen: false });
const titleMask = (r: { payload: any }) => String(r.payload?.title ?? "").replace(/\b\d+(\.\d+)?\b/g, "N").toLowerCase().replace(/\s+/g, " ").trim();
const pubItems = all.filter((c) => pubKeys.has(c.key));
const pubMc = pubItems.filter((c) => c.kind === "mc").map((c) => RAW.get(c.key)).filter(Boolean) as NonNullable<ReturnType<typeof RAW.get>>[];
const pubFrqTitles = new Set(pubItems.filter((c) => c.kind === "frq").map((c) => RAW.get(c.key)).filter(Boolean).map((r) => titleMask(r!)));
const rest = all.filter((c) => !pubKeys.has(c.key));
const verdicts = JSON.parse(readFileSync("data/ap/stock/structure-manual-verdicts-phys1.json", "utf-8")) as { independent: Record<string, string>; twin: Record<string, string> };
const blockMc: string[] = [], blockFrq: string[] = [];
for (const c of rest) {
  const r = RAW.get(c.key); if (!r) continue;
  const arch = String((r.payload as { archetype?: string }).archetype ?? "");
  if (c.kind === "mc") { if (arch in verdicts.twin || (!(arch in verdicts.independent) && pubMc.some((p) => sameStructure(r, p)))) blockMc.push(c.key); }  // 수동 판정(독립/쌍둥이)이 자동 비교보다 우선한다
  else if (pubFrqTitles.has(titleMask(r))) blockFrq.push(c.key);
}
const restMc = rest.filter((c) => c.kind === "mc"), restFrq = rest.filter((c) => c.kind === "frq");
console.log(`공개 키 ${pubKeys.size} (MC ${pubMc.length}, FRQ 제목 ${pubFrqTitles.size}) | 재고(공개 제외) MC ${restMc.length}(세트 ${restMc.filter((c) => c.shared).length}) FRQ ${restFrq.length}`);
console.log(`구조 동일로 차단: MC ${blockMc.length}, FRQ ${blockFrq.length} → 남은 MC ${restMc.length - blockMc.length}, FRQ ${restFrq.length - blockFrq.length}`);
const w = arg("--write"); if (w) writeFileSync(w, JSON.stringify({ sets: [{ mcA: blockMc, frqA: blockFrq }] }, null, 1));
