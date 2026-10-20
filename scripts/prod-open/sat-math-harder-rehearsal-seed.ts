// 로컬 격리 스택 리허설용 시작 상태 복사(원격은 읽기 SELECT 만, 로컬에만 쓴다). 수학 상향 44번 SQL 리허설용.
//   LOCAL_DB_URL=postgresql://postgres:postgres@127.0.0.1:54722/postgres npx tsx scripts/prod-open/sat-math-harder-rehearsal-seed.ts
// 복사: subjects, subject_keywords, 관리자 프로필 1건, 게시 'SAT Practice Test N' 세트 행 전부와 그 문항(mock_exam_set_items), 그 문항·교체 후보가 가리키는 problems + 게시 버전.
// FK 는 session_replication_role=replica 로 우회한다(리허설 한정). 도커 컨테이너로 로컬 DB 대상임을 확인한 뒤 쓴다.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const LOCAL = process.env.LOCAL_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54722/postgres";
if (!/127\.0\.0\.1|localhost/.test(LOCAL) || /5442[12]\b/.test(LOCAL)) throw new Error(`로컬 격리 스택이 아니다: ${LOCAL}`);
const specs = JSON.parse(readFileSync("data/mock-exam-generation/sat-math-harder-20261020/final/old-set-specs.json", "utf8")) as { slots: { newProblemId?: string }[] }[];
const candIds = [...new Set(specs.flatMap((s) => s.slots.map((x) => x.newProblemId).filter(Boolean) as string[]))];
function remote(sql: string): unknown[] {
  const r = spawnSync("supabase", ["db", "query", "--linked", `select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) as j from (${sql}) t`], { encoding: "utf-8", maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout).slice(0, 300));
  return JSON.parse(r.stdout.slice(r.stdout.indexOf("{"), r.stdout.lastIndexOf("}") + 1)).rows[0].j;
}
const parts: string[] = ["set session_replication_role = replica;", "delete from subject_keywords;", "delete from subjects;"];
const put = (table: string, rows: unknown[]) => { if (!rows.length) return; parts.push(`do $do$ declare v jsonb := $seed$${JSON.stringify(rows)}$seed$::jsonb; c text; begin select string_agg(quote_ident(column_name), ',' order by ordinal_position) into c from information_schema.columns where table_schema = 'public' and table_name = '${table}' and is_generated = 'NEVER'; execute format('insert into ${table} (%s) select %s from jsonb_populate_recordset(null::${table}, $1) on conflict do nothing', c, c) using v; end $do$;`); console.error(`${table}: ${rows.length}`); };
put("subjects", remote("select * from subjects"));
put("subject_keywords", remote("select * from subject_keywords"));
put("profiles", remote("select * from profiles where role = 'admin' order by created_at limit 1"));
const SETS = "select id from mock_exam_sets where status = 'published' and archived_at is null and name ~ '^SAT Practice Test [0-9]+$'";
put("mock_exam_sets", remote(`select * from mock_exam_sets where id in (${SETS})`));
put("mock_exam_set_items", remote(`select * from mock_exam_set_items where exam_set_id in (${SETS})`));
const idArr = `array[${candIds.map((i) => `'${i}'`).join(",")}]::uuid[]`;
const PROB = `select problem_id from mock_exam_set_items where exam_set_id in (${SETS}) union select unnest(${idArr})`;
put("problems", remote(`select * from problems where id in (${PROB})`));
put("problem_versions", remote(`select pv.* from problem_versions pv join problems p on p.published_version_id = pv.id where p.id in (${PROB}) union select pv.* from problem_versions pv join mock_exam_set_items i on i.problem_version_id = pv.id where i.exam_set_id in (${SETS})`));
const out = path.resolve("tmp/mathharder-seed.sql"); writeFileSync(out, parts.join("\n") + "\n");
const r = spawnSync("psql", [LOCAL, "-v", "ON_ERROR_STOP=1", "-q", "-f", out], { encoding: "utf-8" });
console.error(r.status === 0 ? "seed ok" : `seed FAILED: ${(r.stderr || r.stdout).slice(0, 600)}`);
process.exit(r.status ?? 1);
