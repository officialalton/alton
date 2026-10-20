// rebalance-sets.ts(문학 25% 옵션) 산출을 SQL 생성기 입력으로 바꾼다(2026-10-19). DB 접근 없음.
//   new-sets.json(T27~30, 투영 id `proj:<gid>` 혼합) -> new-sets-resolved.json,
//   repair-plan.json 의 T4~T9 교체(swaps) -> old-set-specs.json (sat-expand-sql.ts SAT_LIT25 의 oldSetSql 입력: slots[{section, position, oldVersionId, newGid|newProblemId}])
//   npx tsx scripts/prod-open/lit25-resolve.ts --plan DIR --out data/mock-exam-generation/sat-lit25-20261019/final --sets "SAT Practice Test 4,...,SAT Practice Test 9"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const dir = arg("--plan")!; const out = arg("--out")!; mkdirSync(out, { recursive: true });
const only = new Set((arg("--sets") ?? "").split(",").filter(Boolean));
const sets = JSON.parse(readFileSync(`${dir}/new-sets.json`, "utf-8")) as any[][];
const names = (JSON.parse(readFileSync(`${dir}/new-sets-meta.json`, "utf-8")) as { names: string[] }).names;
const resolved = sets.map((items, i) => ({
  name: names[i],
  items: items.map((it) => {
    const proj = String(it.problemId).startsWith("proj:");
    return { section: it.section ?? (String(it.domain).startsWith("rw_") ? "rw" : "math"), position: it.position, problemId: proj ? null : it.problemId, gid: proj ? String(it.problemId).slice(5) : null, domain: it.domain, skill: it.skill, difficulty: it.difficulty, moduleKey: it.moduleKey, route: it.route ?? null };
  }),
}));
writeFileSync(path.join(out, "new-sets-resolved.json"), JSON.stringify({ generatedFrom: "rebalance-sets.ts --lit-max new-sets.json (projection ids resolved to gid)", sets: resolved }));
const swaps = JSON.parse(readFileSync(`${dir}/repair-plan.json`, "utf-8")) as any[];
const bad = swaps.filter((s) => (!only.size || only.has(s.setName)) && s.status === "NO_REPLACEMENT");
if (bad.length) throw new Error(`교체 불가 ${bad.length}건: ${bad.slice(0, 3).map((b) => `${b.setName}#${b.position}`).join(", ")}`);
const specs: any[] = [];
for (const name of [...new Set(swaps.map((s) => s.setName as string))].filter((n) => !only.size || only.has(n)).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))) {
  const slots = swaps.filter((s) => s.setName === name).map((s) => {
    const proj = String(s.newProblemId).startsWith("proj:");
    return { section: s.section, position: s.position, oldVersionId: s.oldVersionId, ...(proj ? { newGid: String(s.newProblemId).slice(5) } : { newProblemId: s.newProblemId }) };
  });
  specs.push({ name, repointProblemIds: [], slots });
}
writeFileSync(path.join(out, "old-set-specs.json"), JSON.stringify(specs));
console.log(resolved.map((s) => `${s.name}: ${s.items.length} items, new gids ${s.items.filter((x) => x.gid).length}`).join("\n"));
console.log(specs.map((s) => `${s.name}: ${s.slots.length} slots (${s.slots.filter((x: any) => x.newGid).length} new gids)`).join("\n"));
