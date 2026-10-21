// BC4·BC5 엄격 정확 배정(무료·읽기 전용). exact-assign.ts 의 풀·ILP 를 그대로 쓰되, 새 세트는 공개 세트(AB1~3·BC1~3)와 문항·문항군·아키타입이 하나도 겹치지 않아야 하고
// 새 세트끼리도 문항군·아키타입이 겹치지 않는다(풀이 틀이 같은 형제 금지). 공개 구성 = scripts/audit/ap-type-defect-scan.py 로 재구성한 published.json(미적분 6세트).
//   npx tsx scripts/ap-generation/bc-expansion-assign.ts --published <published.json> [--sets BC4,BC5] [--extra-exclude a.json,b.json] [--write-report <경로>] [--time-ms N]
import { readFileSync, writeFileSync } from "node:fs";
import { loadPool } from "./assign-pool";
import { solveFrq, solveMc, verifyAssignment, type SetResult, type Spec } from "./exact-assign";
import { tooSimilar } from "./_strict-lib";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const has = (n: string) => process.argv.includes(n);
const ids = arg("--sets", "AB4,AB5").split(",");
const sets: Spec[] = ids.map((id) => ({ id, subj: "ab", floor: Number(arg("--floor", "10")) }));
const pub = JSON.parse(readFileSync(arg("--published"), "utf-8")) as { used_keys: string[] };
const blocked = new Set(pub.used_keys);
for (const f of arg("--extra-exclude").split(",").filter(Boolean)) {
  const o = JSON.parse(readFileSync(f, "utf-8")) as { keys?: Record<string, string[]>; sets?: { mcA: string[]; mcB: string[]; frqA: string[]; frqB: string[] }[] };
  for (const g of o.keys ? [o.keys] : o.sets ?? []) for (const k of [...(g.mcA ?? []), ...(g.mcB ?? []), ...(g.frqA ?? []), ...(g.frqB ?? [])]) blocked.add(k);
}
const base = (a: string) => a.replace(/-s\d+(-.*)?$/, "");
const { all, pool } = loadPool({ strictFamilies: true });
const src = has("--screen-all") ? all : pool;
const usedItems = all.filter((c) => blocked.has(c.key));
const usedFam = new Set(usedItems.map((c) => c.fam)); const usedArch = new Set(usedItems.map((c) => base(c.archetype)));
const pubKeys = new Set(usedItems.map((c) => c.key));
const simBlocked = new Set<string>(); // 공개 문항과 문장(본문+선택지+파트) 단어 집합 자카드가 --sim(기본 0.75) 이상이면 막는다(_strict-lib.ts). 다른 과목 라운드의 0.5 는 미적분에서 "The graph of the function f is shown and consists of line segments" 같은 공통 문장 틀 때문에 풀이 틀이 다른 문항까지 막아 0.75 로 둔다.
const SIM = Number(arg("--sim", "0.75"));
const FAM_ONLY = has("--family-only"); // 2026-10-21 오너 정정: 아키타입(생성 원형) 단위 세트 간 금지는 정책이 아니다 — 구조적 문항군(fam·look-alike)과 문장 유사도만 막는다
for (const [subj, code] of [["ab", "ap_calculus_ab"], ["bc", "ap_calculus_bc"]] as const) for (const k of tooSimilar(code, pubKeys, src.filter((c) => c.subj === subj).map((c) => c.key), SIM).keys()) simBlocked.add(k);
console.error(`문장 유사도 ${SIM} 이상으로 막은 재고: ${simBlocked.size}`);
const items = src.filter((c) => !blocked.has(c.key) && !simBlocked.has(c.key) && !usedFam.has(c.fam) && (FAM_ONLY || !usedArch.has(base(c.archetype))) && !(c.kind === "mc" && c.calc === "na"));
console.error(`공개+제외 문항 ${usedItems.length}, 새 세트 후보 MC ${items.filter((c) => c.kind === "mc").length} FRQ ${items.filter((c) => c.kind === "frq").length}`);
const mcItems = items.filter((c) => c.kind === "mc");
const m = solveMc(sets, items, {
  timeMs: Number(arg("--time-ms", "120000")), log: (s) => console.error(s),
  extra: ({ x }) => { // 새 세트끼리: 같은 문항군·같은 아키타입은 두 세트에 동시에 못 쓴다
    const cons: { coef: [number, number][]; sense: "<="; rhs: number }[] = [];
    for (const key of (FAM_ONLY ? ["fam"] : ["fam", "archetype"]) as ("fam" | "archetype")[]) {
      const g = new Map<string, [number, number][]>();
      mcItems.forEach((c, i) => sets.forEach((_, si) => { const j = x(i, si); if (j >= 0) { const k = key === "archetype" ? base(c.archetype) : c.fam; (g.get(k) ?? g.set(k, []).get(k)!).push([j, 1]); } }));
      for (const co of g.values()) if (co.length > 1) cons.push({ coef: co, sense: "<=", rhs: 1 });
    }
    return cons;
  },
});
// FRQ: 세트를 차례로 푼다(앞 세트가 쓴 유형·문항군·아키타입은 뒤 세트에서 막는다).
const frqOut: { id: string; frqA: typeof items; frqB: typeof items; frqVirtual: { set: string; part: "A" | "B"; native: boolean }[] }[] = []; let frqObj = 0; let frqOk = true;
const frqUsed = new Set<string>();
for (const s of sets) {
  const pool2 = items.filter((c) => c.kind !== "frq" || !(frqUsed.has("t:" + c.type) || frqUsed.has("f:" + c.fam) || (!FAM_ONLY && frqUsed.has("a:" + base(c.archetype)))));
  const r = solveFrq([s], pool2, { timeMs: Number(arg("--time-ms", "120000")), log: (x) => console.error(x) });
  frqOk = frqOk && r.res.x.length > 0; frqObj += r.res.obj; frqOut.push(r.out[0]);
  for (const c of [...r.out[0].frqA, ...r.out[0].frqB]) { frqUsed.add("t:" + c.type); frqUsed.add("f:" + c.fam); frqUsed.add("a:" + base(c.archetype)); }
}
const f = { res: { x: frqOk ? [1] : [], obj: frqObj, status: frqOk ? "optimal" : "infeasible" }, out: frqOut };
const results: SetResult[] = sets.map((s, i) => ({ ...m.out[i], ...f.out[i] }));
const bad = m.res.x.length && f.res.x.length ? verifyAssignment(sets, results, blocked) : ["해 없음"];
// 세트 간 아키타입 중복 점검(MC·FRQ)
const seenArch = new Map<string, string>();
for (const r of results) for (const c of [...r.mcA, ...r.mcB, ...r.frqA, ...r.frqB]) { const k = base(c.archetype); if (!FAM_ONLY && seenArch.has(k) && seenArch.get(k) !== r.id) bad.push(`아키타입 ${k}: ${seenArch.get(k)} 와 ${r.id} 중복`); seenArch.set(k, r.id); }
console.log(`MC status=${m.res.status} 가상=${m.out.reduce((a, r) => a + r.virtual.length, 0)} / FRQ status=${f.res.status} 가상=${f.res.obj} / 독립 검증기 위반: ${bad.length ? bad.join("; ") : "0"}`);
for (const r of results) {
  const all2 = [...r.mcA, ...r.mcB]; const u = new Map<number, number>(); for (const c of all2) u.set(c.unit, (u.get(c.unit) ?? 0) + 1); for (const v of r.virtual) u.set(v.unit, (u.get(v.unit) ?? 0) + 1);
  console.log(`- ${r.id}: MC A ${r.mcA.length}+가상${r.virtual.filter((v) => v.part === "A").length} / B ${r.mcB.length}+가상${r.virtual.filter((v) => v.part === "B").length}, 그래프 ${all2.filter((c) => c.graph).length}+가상${r.virtual.filter((v) => v.graph).length} / 단원 ${[...u].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(" ")} / FRQ A ${r.frqA.length} B ${r.frqB.length} 가상 ${r.frqVirtual.length}, BC 전용 ${[...r.frqA, ...r.frqB].filter((c) => c.native).length}, 검증 대기 ${[...all2, ...r.frqA, ...r.frqB].filter((c) => c.pending).length}`);
  for (const v of r.virtual) console.log(`    가상 MC: Part ${v.part} 단원 ${v.unit} 스킬 ${v.skill} ${v.graph ? "그래프" : "비그래프"}`);
  for (const v of r.frqVirtual) console.log(`    가상 FRQ: Part ${v.part} ${v.native ? "BC 전용" : "공유"}`);
}
const w = arg("--write-report");
if (w) writeFileSync(w, JSON.stringify({ sets: results.map((r) => ({ id: r.id, mcA: r.mcA.map((c) => c.key), mcB: r.mcB.map((c) => c.key), virtual: r.virtual, frqA: r.frqA.map((c) => c.key), frqB: r.frqB.map((c) => c.key), frqVirtual: r.frqVirtual, pendingNonprod: [...r.mcA, ...r.mcB, ...r.frqA, ...r.frqB].filter((c) => c.pending).map((c) => c.key) })), mcShortage: m.out.reduce((a, r) => a + r.virtual.length, 0), frqShortage: f.res.obj, verifierViolations: bad, ab1: "published" }, null, 1));
