// rebalance-sets.ts 산출(new-sets.json: 투영 id `proj:<gid>` 혼합)을 SQL 생성기 입력(new-sets-resolved.json)으로 바꾼다. DB 접근 없음.
//   npx tsx scripts/prod-open/sat30-resolve.ts --plan data/mock-exam-generation/sat-expand-20261019/final
import { readFileSync, writeFileSync } from "node:fs";
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const dir = arg("--plan")!;
const sets = JSON.parse(readFileSync(`${dir}/new-sets.json`, "utf-8")) as any[][];
const names = (JSON.parse(readFileSync(`${dir}/new-sets-meta.json`, "utf-8")) as { names: string[] }).names;
const out = sets.map((items, i) => ({
  name: names[i],
  items: items.map((it) => {
    const proj = String(it.problemId).startsWith("proj:");
    return { section: it.section ?? (String(it.domain).startsWith("rw_") ? "rw" : "math"), position: it.position, problemId: proj ? null : it.problemId, gid: proj ? String(it.problemId).slice(5) : null, domain: it.domain, skill: it.skill, difficulty: it.difficulty, moduleKey: it.moduleKey, route: it.route ?? null };
  }),
}));
writeFileSync(`${dir}/new-sets-resolved.json`, JSON.stringify({ generatedFrom: "rebalance-sets.ts new-sets.json (projection ids resolved to gid)", sets: out }));
console.log(out.map((s) => `${s.name}: ${s.items.length} items, new gids ${s.items.filter((x) => x.gid).length}, secs ${[...new Set(s.items.map((x) => x.section))]}`).join("\n"));
