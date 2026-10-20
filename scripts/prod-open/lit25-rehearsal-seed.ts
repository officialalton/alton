// 로컬 격리 스택 리허설용 시작 상태 복사(2026-10-19). 원격은 읽기 SELECT 만, 로컬에만 쓴다.
//   LOCAL_DB_URL=postgresql://postgres:postgres@127.0.0.1:58122/postgres npx tsx scripts/prod-open/lit25-rehearsal-seed.ts --plan data/mock-exam-generation/sat-lit25-20261019/final
// 복사: subjects, subject_keywords, 관리자 프로필 1건, 살아 있는 SAT 세트(Practice Test N, 초안 포함) + 문항행 + 그 문항의 problems/problem_versions(+게시 버전),
//       교체 후보로 계획된 기존 은행 문항(old-set-specs.json·new-sets-resolved.json 이 참조하는 uuid).
// FK 는 session_replication_role=replica 로 우회한다(리허설 한정, 트리거도 꺼짐).
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const LOCAL = process.env.LOCAL_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:58122/postgres";
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(LOCAL)) { console.error("LOCAL_DB_URL 이 로컬이 아님 — 중단"); process.exit(2); }
const plan = path.resolve(arg("--plan")!);
const specs = JSON.parse(readFileSync(path.join(plan, "old-set-specs.json"), "utf-8")) as { slots: { newProblemId?: string }[] }[];
const sets = (JSON.parse(readFileSync(path.join(plan, "new-sets-resolved.json"), "utf-8")) as { sets: { items: { problemId: string | null }[] }[] }).sets;
const extra = [...new Set([...specs.flatMap((s) => s.slots.map((x) => x.newProblemId)), ...sets.flatMap((s) => s.items.map((i) => i.problemId))].filter(Boolean) as string[])];
const extraArr = `array[${extra.map((i) => `'${i}'`).join(",")}]::uuid[]`;
const LIVE = "select id from mock_exam_sets where name ~ '^SAT Practice Test [0-9]+$' and archived_at is null and status <> 'archived'";
function remote(sql: string): unknown[] {
  const r = spawnSync("supabase", ["db", "query", "--linked", `select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) as j from (${sql}) t`], { encoding: "utf-8", maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout).slice(0, 300));
  return JSON.parse(r.stdout.slice(r.stdout.indexOf("{"), r.stdout.lastIndexOf("}") + 1)).rows[0].j;
}
const parts: string[] = ["set session_replication_role = replica;", "delete from mock_exam_set_items;", "delete from mock_exam_sets;", "delete from subject_keywords;", "delete from subjects;"];
const put = (table: string, rows: unknown[]) => { if (!rows.length) return; parts.push(`do $do$ declare c text; begin select string_agg(quote_ident(column_name), ',') into c from information_schema.columns where table_schema = 'public' and table_name = '${table}' and is_generated = 'NEVER'; execute format('insert into ${table} (%s) select %s from jsonb_populate_recordset(null::${table}, $1) on conflict do nothing', c, c) using $seed$${JSON.stringify(rows)}$seed$::jsonb; end $do$;`); console.error(`${table}: ${rows.length}`); };
put("subjects", remote("select * from subjects"));
put("subject_keywords", remote("select * from subject_keywords"));
put("profiles", remote("select * from profiles where role = 'admin' order by created_at limit 1"));
put("mock_exam_sets", remote(`select * from mock_exam_sets where id in (${LIVE})`));
const pidSql = `select distinct problem_id from mock_exam_set_items where exam_set_id in (${LIVE}) union select unnest(${extraArr})`;
for (let off = 0; ; off += 1500) { const rows = remote(`select * from mock_exam_set_items where exam_set_id in (${LIVE}) order by id limit 1500 offset ${off}`); if (!rows.length) break; put("mock_exam_set_items", rows); }
for (let off = 0; ; off += 400) { const rows = remote(`select * from problems where id in (${pidSql}) order by id limit 400 offset ${off}`); if (!rows.length) break; put("problems", rows); }
const vSql = `select id from problem_versions where id in (select problem_version_id from mock_exam_set_items where exam_set_id in (${LIVE})) or id in (select published_version_id from problems where id in (${pidSql}) and published_version_id is not null)`;
for (let off = 0; ; off += 300) { const rows = remote(`select * from problem_versions where id in (${vSql}) order by id limit 300 offset ${off}`); if (!rows.length) break; put("problem_versions", rows); }
const out = path.resolve("tmp/lit25-seed.sql"); writeFileSync(out, parts.join("\n") + "\n");
const r = spawnSync("psql", [LOCAL, "-v", "ON_ERROR_STOP=1", "-q", "-f", out], { encoding: "utf-8" });
console.error(r.status === 0 ? "seed ok" : `seed FAILED: ${(r.stderr || r.stdout).slice(0, 600)}`);
process.exit(r.status ?? 1);
