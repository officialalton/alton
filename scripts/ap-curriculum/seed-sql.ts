// AP 커리큘럼 시드 SQL 생성(순수 파일 출력, DB·키 불필요). 2026-10-14.
//   npx tsx scripts/ap-curriculum/seed-sql.ts --only ap_psychology [--track compact|full] [--existing existing.json] [--out data/ap/seed-sql]
// --existing: `select ap_subject_code from subjects where ap_subject_code is not null` 결과 JSON(배열 또는 {rows:[...]} / {data:{rows}}).
// 지정 없고 --only 도 없으면 --existing 에 없는 과목 전부(--existing 없으면 전체).
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { generateRollbackSql, generateSeedSql, generateVerifySql } from "../../lib/ap-curriculum/seed-sql";
import type { ApCurriculumFile } from "../../lib/ap-curriculum/types";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const track = (arg("--track") ?? "compact") as "compact" | "full";
if (track !== "compact" && track !== "full") throw new Error("--track 은 compact|full");
const only = arg("--only");
const out = path.resolve(process.cwd(), arg("--out") ?? "data/ap/seed-sql");
const dir = path.resolve(process.cwd(), "data/ap/curriculum-2027");

let have = new Set<string>();
const ex = arg("--existing");
if (ex) {
  const j = JSON.parse(readFileSync(ex, "utf-8"));
  const rows: { ap_subject_code?: string }[] = Array.isArray(j) ? j : j.rows ?? j.data?.rows ?? j.data ?? [];
  have = new Set(rows.map((r) => r.ap_subject_code).filter(Boolean) as string[]);
}
const files = readdirSync(dir).filter((n) => n.endsWith(".json")).filter((n) => (only ? n === `${only}.json` : !have.has(n.replace(/\.json$/, "")))).sort();
if (!files.length) { console.log("생성할 과목 없음(이미 모두 존재하거나 --only 파일 없음)."); process.exit(0); }
mkdirSync(out, { recursive: true });
for (const n of files) {
  const f = JSON.parse(readFileSync(path.join(dir, n), "utf-8")) as ApCurriculumFile;
  const c = f.subject.apCode;
  writeFileSync(path.join(out, `${c}.sql`), generateSeedSql(f, track));
  writeFileSync(path.join(out, `${c}.verify.sql`), generateVerifySql(f, track));
  writeFileSync(path.join(out, `${c}.rollback.sql`), generateRollbackSql(f));
  console.log(`${c}: ${path.relative(process.cwd(), out)}/${c}.{sql,verify.sql,rollback.sql}`);
}
