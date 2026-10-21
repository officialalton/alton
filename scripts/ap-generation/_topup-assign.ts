// 5세트 채우기(Macro MA4·MA5 / Micro MI4·MI5) 배정 드라이버: DB 공개 세트 키(blocked-db-*.json)·같은 sig·문장 유사도(>=0.5)를 막고 순차로 푼 뒤 부족 칸(가상)을 낸다.
//   npx tsx scripts/ap-generation/_topup-assign.ts macro|micro [--screen] [--write <report.json>]
import { readFileSync, writeFileSync } from "node:fs";
import { loadMacroPool, type MacroItem } from "./macro-pool";
import { loadMicroPool, type MicroItem } from "./micro-pool";
import * as MA from "./macro-assign";
import * as MI from "./micro-assign";
import { tooSimilar } from "./_strict-lib";

const which = process.argv[2] === "micro" ? "micro" : "macro";
const requireScreen = process.argv.includes("--screen");
const wi = process.argv.indexOf("--write");
const sets = which === "macro" ? ["MA4", "MA5"] : ["MI4", "MI5"];
const blockedKeys = new Set<string>();
for (const st of (JSON.parse(readFileSync(`data/ap/stock/blocked-db-${which}.json`, "utf-8")) as { sets: { mcA?: string[]; frqA?: string[] }[] }).sets) for (const k of [...(st.mcA ?? []), ...(st.frqA ?? [])]) blockedKeys.add(k);
const { pool } = (which === "macro" ? loadMacroPool({ requireScreen }) : loadMicroPool({ requireScreen })) as { pool: (MacroItem | MicroItem)[] };
const subject = which === "macro" ? "ap_macroeconomics" : "ap_microeconomics";
const strict = process.argv.includes("--strict");
const sim = strict ? tooSimilar(subject, blockedKeys, pool.map((c) => c.key), 0.5) : new Map<string, { nearest: string; score: number }>();
const pubSigs = new Set<string>(); for (const c of pool) if (blockedKeys.has(c.key) && (c as MacroItem).sig) pubSigs.add((c as MacroItem).sig);
const pubFams = strict ? new Set(pool.filter((c) => blockedKeys.has(c.key)).map((c) => c.fam)) : new Set<string>();
const ok = pool.filter((c) => !blockedKeys.has(c.key) && !sim.has(c.key) && !(((c as MacroItem).sig) && pubSigs.has((c as MacroItem).sig)) && !pubFams.has(c.fam));
console.error(`pool ${pool.length}, blocked keys ${blockedKeys.size}, similarity-blocked ${sim.size}, same-fam-as-published ${pool.filter((c) => !blockedKeys.has(c.key) && pubFams.has(c.fam)).length}, usable ${ok.length}`);
const out: { id: string; singles: any[]; frq: any[]; virtual: any[]; frqVirtual: any[] }[] = [];
const bl = new Set<string>(); const blSig = new Set<string>(pubSigs); const blArch = new Set<string>();
for (const id of sets) {
  const one: any = which === "macro"
    ? MA.solveMacroSets([id], ok as MacroItem[], { timeMs: 90000, log: () => {}, blocked: bl, blockedArchetypes: blArch, blockedSigs: blSig })
    : MI.solveMicroSets([id], ok as MicroItem[], { timeMs: 90000, log: () => {}, blocked: bl, blockedArchetypes: blArch });
  out.push(...one.out);
  for (const it of [...one.out[0].singles, ...one.out[0].frq]) { bl.add(it.key); if (it.sig) blSig.add(it.sig); }
  const one_only = which === "macro" ? MA.ONE_EXAM_ONLY : MI.ONE_EXAM_ONLY;
  for (const a of [...one.out[0].singles.map((c: any) => c.archetype), ...one.out[0].virtual.map((v: any) => v.archetype)]) if (one_only.has(a)) blArch.add(a);
  for (const c of one.out[0].frq) blArch.add(c.archetype);
}
const bad = which === "macro" ? MA.verifyMacroAssignment(out as MA.MacroResult[]) : MI.verifyMicroAssignment(out as MI.MicroResult[]);
console.log(`# ${which} sets=${sets.join(",")} requireScreen=${requireScreen} 독립 검증기 위반: ${bad.length ? bad.join("; ") : "0"}`);
for (const r of out) {
  console.log(`- ${r.id}: 단독 ${r.singles.length}+가상 ${r.virtual.length}, FRQ ${r.frq.length}+가상 ${r.frqVirtual.length}`);
  for (const v of r.virtual) console.log(`    가상 MC: 단원 ${v.unit} 스킬 ${v.skill} 원형 ${v.archetype} (${v.topic})`);
  for (const v of r.frqVirtual) console.log(`    가상 FRQ: ${v.type}`);
}
const usedKeys = new Set(out.flatMap((r) => [...r.singles, ...r.frq].map((c: any) => c.key)));
const spare = (ok as any[]).filter((c) => c.kind === "mc" && !usedKeys.has(c.key));
const seenSig = new Set<string>(); const spareDistinct = spare.filter((c) => { const k = c.sig || c.key; if (seenSig.has(k)) return false; seenSig.add(k); return true; });
console.log(`예비 후보(미사용·공개 아님·sig 중복 제거) MC ${spareDistinct.length}`);
const si = process.argv.indexOf("--write-spare"); if (si > 0) writeFileSync(process.argv[si + 1], JSON.stringify({ sets, spare: spareDistinct.map((c: any) => ({ key: c.key, unit: c.members[0].unit, skill: c.members[0].skill, archetype: c.archetype, screen: c.screen })) }, null, 1) + "\n");
if (wi > 0) { const toRep = which === "macro" ? MA.toReportSet : MI.toReportSet; writeFileSync(process.argv[wi + 1], JSON.stringify({ sets: out.map((r) => (toRep as any)(r)) }, null, 1)); console.error(`보고서: ${process.argv[wi + 1]}`); }
