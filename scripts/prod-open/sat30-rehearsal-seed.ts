// 로컬 격리 스택 리허설용 시작 상태 복사(원격은 읽기 SELECT 만, 로컬에만 쓴다).
//   LOCAL_DB_URL=postgresql://postgres:postgres@127.0.0.1:57122/postgres npx tsx scripts/prod-open/sat30-rehearsal-seed.ts --plan data/mock-exam-generation/sat-expand-20261019/final
// 복사: subjects, subject_keywords, 관리자 프로필 1건, 세트 27~30 이 참조하는 기존 은행 문항(problems + 게시 버전), 템플릿 세트 'SAT Practice Test 13' 행.
// FK 는 session_replication_role=replica 로 우회한다(리허설 한정).
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const LOCAL = process.env.LOCAL_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:57122/postgres";
const sets = (JSON.parse(readFileSync(path.resolve(arg("--plan")!, "new-sets-resolved.json"), "utf-8")) as { sets: { items: { problemId: string | null }[] }[] }).sets;
const ids = [...new Set(sets.flatMap((s) => s.items.map((i) => i.problemId).filter(Boolean) as string[]))];
const idArr = `array[${ids.map((i) => `'${i}'`).join(",")}]::uuid[]`;
function remote(sql: string): unknown[] {
  const r = spawnSync("supabase", ["db", "query", "--linked", `select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) as j from (${sql}) t`], { encoding: "utf-8", maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout).slice(0, 300));
  return JSON.parse(r.stdout.slice(r.stdout.indexOf("{"), r.stdout.lastIndexOf("}") + 1)).rows[0].j;
}
const parts: string[] = ["set session_replication_role = replica;", "delete from subject_keywords;", "delete from subjects;"];
const put = (table: string, rows: unknown[]) => { if (!rows.length) return; parts.push(`insert into ${table} select * from jsonb_populate_recordset(null::${table}, $seed$${JSON.stringify(rows)}$seed$::jsonb) on conflict do nothing;`); console.error(`${table}: ${rows.length}`); };
put("subjects", remote("select * from subjects"));
put("subject_keywords", remote("select * from subject_keywords"));
put("profiles", remote("select * from profiles where role = 'admin' order by created_at limit 1"));
put("problems", remote(`select * from problems where id = any (${idArr})`));
put("problem_versions", remote(`select pv.* from problem_versions pv join problems p on p.published_version_id = pv.id where p.id = any (${idArr})`));
put("mock_exam_sets", remote("select * from mock_exam_sets where name = 'SAT Practice Test 13' and status = 'published' and archived_at is null limit 1"));
const out = path.resolve("tmp/sat30-seed.sql"); writeFileSync(out, parts.join("\n") + "\n");
const r = spawnSync("psql", [LOCAL, "-v", "ON_ERROR_STOP=1", "-q", "-f", out], { encoding: "utf-8" });
console.error(r.status === 0 ? "seed ok" : `seed FAILED: ${(r.stderr || r.stdout).slice(0, 600)}`);
process.exit(r.status ?? 1);
