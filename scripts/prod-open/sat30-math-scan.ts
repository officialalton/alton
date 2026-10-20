// 새 SAT 세트(27~30) 후보 풀에서 외부 검수 오류 신고(2026-10-18) 결함 유형에 걸리는 미사용 Math 문항을 찾아 제외 목록으로 만든다.
// 읽기 전용: `supabase db query --linked` SELECT 만. 목록은 rebalance-sets.ts --exclude-problems 입력(문항 id 배열)이다.
//   npx tsx scripts/prod-open/sat30-math-scan.ts --dump tmp/bank-dump-sat30/dump.json --out data/mock-exam-generation/sat-expand-20261019/math-exclude.json
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { planSatErrorReportFix, type SatRow } from "../../lib/audit-fix/sat-error-report-1018";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const dump = JSON.parse(readFileSync(path.resolve(arg("--dump")!), "utf-8"));
const live = new Set<string>(dump.sets.filter((s: any) => !s.archived_at && s.status !== "failed").map((s: any) => s.id));
const used = new Set<string>(dump.items.filter((i: any) => live.has(i.exam_set_id)).map((i: any) => i.problem_id));
const MATH = new Set(["math_algebra", "math_advanced", "math_psda", "math_geometry"]);
const ids: string[] = dump.problems.filter((p: any) => !used.has(p.id) && !p.archived_at && p.status === "confirmed" && p.usage_scope === "mock_exam" && p.sat_domain && !String(p.sat_domain).startsWith("rw_")).map((p: any) => p.id);
console.error(`unused math candidates ${ids.length}`);
const rows: SatRow[] = [];
for (let i = 0; i < ids.length; i += 200) {
  const sql = `select coalesce(jsonb_agg(t),'[]'::jsonb) as j from (select p.id as problem_id, pv.id as version_id, p.skill_code, pv.passage, pv.question, pv.options, pv.correct_index, pv.explanation, pv.explanation_en, pv.figure from problems p join problem_versions pv on pv.id = p.published_version_id where p.id = any (array[${ids.slice(i, i + 200).map((x) => `'${x}'`).join(",")}]::uuid[])) t`;
  const r = spawnSync("supabase", ["db", "query", "--linked", sql], { encoding: "utf-8", maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout).slice(0, 300));
  rows.push(...JSON.parse(r.stdout.slice(r.stdout.indexOf("{"), r.stdout.lastIndexOf("}") + 1)).rows[0].j);
}
const byRule: Record<string, number> = {}; const exclude: string[] = [];
for (const row of rows) { const hit = planSatErrorReportFix(row); if (!hit) continue; byRule[hit.rule] = (byRule[hit.rule] ?? 0) + 1; exclude.push(row.problem_id!); }
void MATH;
writeFileSync(path.resolve(arg("--out")!), JSON.stringify(exclude));
console.log(JSON.stringify({ scanned: rows.length, excluded: exclude.length, byRule }));
