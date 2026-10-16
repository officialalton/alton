// 외부 검수자 계정(비밀번호 해시 포함) + 검수 산출물 내보내기. 읽기 전용(트랜잭션 read-only).
//   SOURCE_DB_URL=postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres \
//   npx tsx scripts/prod-launch/export-reviewers.ts [--emails reviewers.txt] [--out DIR]
// 대상 선정: auth.users.raw_app_meta_data.external_reviewer = true 인 계정 ∪ --emails 파일(줄당 이메일)의 계정.
// 비밀번호 해시는 auth.users.encrypted_password 라 REST/Admin API 로는 못 얻는다 → 직접 DB 접속이 필요하다.
// 산출 디렉터리에는 해시가 들어 있으므로 저장소 밖(기본 ~/.alton-secrets/prod-reviewers)에만 두고 커밋하지 않는다.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };
const dbUrl = process.env.SOURCE_DB_URL;
if (!dbUrl) { console.error("SOURCE_DB_URL 필요"); process.exit(2); }
const u = new URL(dbUrl);
const env = { ...process.env, PGHOST: u.hostname, PGPORT: u.port || "5432", PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password), PGDATABASE: u.pathname.slice(1) || "postgres", PGSSLMODE: ["127.0.0.1", "localhost"].includes(u.hostname) ? "disable" : "require", PGOPTIONS: "-c default_transaction_read_only=on" };
const q = (sql: string) => {
  const r = spawnSync("psql", ["-X", "-At", "-q", "-v", "ON_ERROR_STOP=1", "-c", sql], { env, encoding: "utf-8", maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`psql 실패: ${r.stderr.trim().slice(0, 800)}`);
  return r.stdout.split("\n").filter(Boolean);
};
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const out = arg("--out") ?? path.join(os.homedir(), ".alton-secrets", "prod-reviewers", stamp);
mkdirSync(out, { recursive: true, mode: 0o700 });

const emails = arg("--emails") ? readFileSync(arg("--emails")!, "utf-8").split("\n").map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith("#")) : [];
const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;
const where = `(raw_app_meta_data->>'external_reviewer' = 'true'${emails.length ? ` or lower(email) in (${emails.map(lit).join(",")})` : ""})`;
const ids = q(`select id from auth.users where ${where} order by id`);
if (!ids.length) { console.error("대상 검수자 0명 — 표시(external_reviewer)나 --emails 를 확인하세요."); process.exit(1); }
const IDS = `array[${ids.map(lit).join(",")}]::uuid[]`;
const missing = emails.filter((e) => !q(`select 1 from auth.users where lower(email)=${lit(e)}`).length);
if (missing.length) console.warn(`경고: 원본에 없는 이메일 ${missing.length}개: ${missing.join(", ")}`);

const specs: { key: string; sql: string; pk: string[] }[] = [
  { key: "auth.users", pk: ["id"], sql: `select row_to_json(t) from auth.users t where t.id = any(${IDS}) order by t.id` },
  { key: "auth.identities", pk: ["id"], sql: `select row_to_json(t) from auth.identities t where t.user_id = any(${IDS}) order by t.id` },
  { key: "profiles", pk: ["id"], sql: `select row_to_json(t) from public.profiles t where t.id = any(${IDS}) order by t.id` },
  { key: "students", pk: ["id"], sql: `select row_to_json(t) from public.students t where t.id = any(${IDS}) order by t.id` },
  { key: "student_terms_acceptances", pk: ["id"], sql: `select row_to_json(t) from public.student_terms_acceptances t where t.student_id = any(${IDS}) order by t.id` },
  { key: "problem_error_verdicts", pk: ["id"], sql: `select row_to_json(t) from public.problem_error_verdicts t where t.id in (select resolved_verdict_id from public.problem_error_reports where reporter_id = any(${IDS}) and resolved_verdict_id is not null) order by t.id` },
  { key: "problem_error_reports", pk: ["id"], sql: `select row_to_json(t) from public.problem_error_reports t where t.reporter_id = any(${IDS}) order by t.id` },
];
const manifest: any = { exportedAt: new Date().toISOString(), source: u.hostname, reviewers: ids.length, tables: {} };
for (const s of specs) {
  const rows = q(s.sql);
  writeFileSync(path.join(out, `${s.key}.jsonl`), rows.length ? rows.join("\n") + "\n" : "");
  const first = rows.length ? Object.keys(JSON.parse(rows[0])) : [];
  const h = createHash("sha256");
  rows.forEach((r) => { const o = JSON.parse(r); h.update(s.pk.map((k) => String(o[k])).join("|") + "\n"); });
  manifest.tables[s.key] = { count: rows.length, pk: s.pk, columns: first, pkSha256: h.digest("hex") };
  console.log(`  ${s.key.padEnd(30)} ${rows.length}`);
}
writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`완료: ${out} (비밀번호 해시 포함 — 저장소 밖, 권한 700 유지)`);
