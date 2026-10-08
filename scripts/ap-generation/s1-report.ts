// S1a/S1b 비교 보고: 최초 후보·최초 통과·수선 후 통과·사용 가능 고유당 총비용·스킬별·구조별. 수선·재검토 호출은 최초 후보 수에 섞지 않는다.
//   npx tsx scripts/ap-generation/s1-report.ts --a s1a --b s1b
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { armReport, type ReportedRecord } from "../../lib/ap-generation/pipeline-policy";
import { gateDuplicate, type McPack, type FrqPack } from "../../lib/ap-generation/gates";

const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const root = path.resolve("data/ap/sample-2027");
type Json = Record<string, unknown>;
const rj = <T,>(f: string): T => JSON.parse(readFileSync(f, "utf-8")) as T;
const jl = (f: string) => (existsSync(f) ? readFileSync(f, "utf-8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Json) : []);
type V = { key: string; cellId: string; passed: boolean; soft?: string[]; reasons: string[] };
type Cell = { cellId: string; archetype: string; kind: string; skill: string; topic: string };

function arm(name: string, main: string, rep: string) {
  const cells = rj<Cell[]>(path.join(root, main, "cells.json")); const cellOf = new Map(cells.map((c) => [c.cellId, c]));
  const v0 = rj<V[]>(path.join(root, main, "verdicts.json")); const v1 = rj<V[]>(path.join(root, rep, "verdicts.json")); const map = rj<Record<string, string>>(path.join(root, rep, "repair_map.json"));
  const costOf = (dir: string) => { const m = new Map<string, { cost: number; calls: number }>(); for (const f of ["gen", "solve", "review", "review2", "difficulty"]) for (const r of jl(path.join(root, dir, `${f}.results.jsonl`))) { const id = String(r.custom_id).replace(/^[srdx]-/, ""); const e = m.get(id) ?? { cost: 0, calls: 0 }; e.cost += Number(r.cost ?? 0); e.calls += 1; m.set(id, e); } return m; };
  const c0 = costOf(main), c1 = costOf(rep);
  const strict = (v: V) => v.passed && !(v.soft ?? []).length;
  const mk = (variant: "strict" | "soft"): ReportedRecord[] => {
    const ok = (v: V) => (variant === "strict" ? strict(v) : v.passed);
    const rows: ReportedRecord[] = [];
    v0.forEach((v, n) => { const c = cellOf.get(v.cellId)!; const e = c0.get(v.key) ?? { cost: 0, calls: 0 }; rows.push({ templateId: c.archetype, cellId: v.cellId, attempt: 0, seed: n, passed: ok(v), reasons: v.reasons, costUsd: e.cost, calls: e.calls, skill: c.skill, structure: c.kind }); });
    v1.forEach((v) => { const orig = map[v.key]; const o0 = v0.findIndex((x) => x.key === orig); const c = cellOf.get(v0[o0].cellId)!; const e = c1.get(v.key) ?? { cost: 0, calls: 0 }; rows.push({ templateId: c.archetype, cellId: v0[o0].cellId, attempt: 1, seed: o0, passed: ok(v), reasons: v.reasons, costUsd: e.cost, calls: e.calls, skill: c.skill, structure: c.kind }); });
    return rows;
  };
  const sum = (m: Map<string, { cost: number; calls: number }>) => [...m.values()].reduce((a, x) => ({ cost: a.cost + x.cost, calls: a.calls + x.calls }), { cost: 0, calls: 0 });
  const t0 = sum(c0), t1 = sum(c1);
  // 사용 가능 고유: 통과한 후보(수선 후 포함)에서 완전 중복 제거, 근사 중복은 문항군 수로만 센다
  const passedPacks = (variant: "strict" | "soft") => { const ok = (v: V) => (variant === "strict" ? strict(v) : v.passed); const out: { key: string; pack: McPack | FrqPack }[] = [];
    for (const [dir, vs] of [[main, v0], [rep, v1]] as const) { const packs = rj<Record<string, (McPack | FrqPack)[]>>(path.join(root, dir, "packs.json")); const polished = new Map(jl(path.join(root, dir, "gen.results.jsonl")).map((r) => [String(r.custom_id), r]));
      void polished; for (const v of vs) if (ok(v)) { const m = v.key.match(/^(.*)-k(\d+)$/)!; if (dir === rep) { const o = map[v.key]; if (v0.find((x) => x.key === o && ok(x))) continue; } out.push({ key: v.key, pack: packs[m[1]][Number(m[2])] }); } }
    return out; };
  const dedupe = (items: { key: string; pack: McPack | FrqPack }[]) => { const acc: (McPack | FrqPack)[] = []; let exact = 0; let near = 0; for (const it of items) { const g = gateDuplicate(it.pack, acc); if (g.includes("exact_duplicate")) { exact++; continue; } if (g.length) near++; acc.push(it.pack); } return { unique: items.length - exact, exact, families: items.length - exact - near }; };
  const out: Record<string, unknown> = { arm: name };
  for (const variant of ["strict", "soft"] as const) {
    const rows = mk(variant); const [all] = armReport(rows, "all"); const d = dedupe(passedPacks(variant));
    const total = t0.cost + t1.cost; const unreachedPass = d.unique;
    out[variant] = { firstCandidates: all.firstCandidates, firstPass: all.firstPass, repairAttempts: v1.length, repairPass: all.postRepairPass - all.firstPass, postRepairPass: all.postRepairPass, uniqueUsable: d.unique, exactDuplicates: d.exact, familiesApprox: d.families, firstPassCostUsd: Number(t0.cost.toFixed(3)), repairCostUsd: Number(t1.cost.toFixed(3)), totalCostUsd: Number(total.toFixed(3)), calls: { first: t0.calls, repair: t1.calls }, costPerUsableUnique: unreachedPass ? Number((total / unreachedPass).toFixed(4)) : null, bySkill: armReport(rows, "skill"), byStructure: armReport(rows, "structure") };
  }
  return out;
}
const A = arm("A code-first", `${arg("--a", "s1a")}`, `${arg("--a", "s1a")}-r`); const B = arm("B old LLM-direct", `${arg("--b", "s1b")}`, `${arg("--b", "s1b")}-r`);
writeFileSync(path.join(root, "s1-report.json"), JSON.stringify({ A, B }, null, 1));
for (const x of [A, B]) { for (const v of ["strict", "soft"] as const) { const r = (x as Record<string, Record<string, unknown>>)[v]; console.log(`${x.arm} [${v}] 최초 ${r.firstCandidates} / 최초통과 ${r.firstPass} / 수선시도 ${r.repairAttempts} / 수선통과 ${r.repairPass} / 수선후통과 ${r.postRepairPass} / 고유 ${r.uniqueUsable}(완전중복 ${r.exactDuplicates}, 문항군≈${r.familiesApprox}) / 비용 최초 $${r.firstPassCostUsd} 수선 $${r.repairCostUsd} 합 $${r.totalCostUsd} / 고유당 $${r.costPerUsableUnique}`); } }
