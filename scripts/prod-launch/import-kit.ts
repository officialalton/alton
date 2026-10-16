// JSONL → 대상 Postgres 가져오기(기본 dry-run = 한 트랜잭션 안에서 전부 실행 후 ROLLBACK).
//   (--kit content 기본 | --kit reviewers: 검수자 계정·산출물, 콘텐츠 적재 이후에만)
//   TARGET_DB_URL=postgresql://... npx tsx scripts/prod-launch/import-kit.ts --dir DIR            # dry-run
//   TARGET_DB_URL=... npx tsx scripts/prod-launch/import-kit.ts --dir DIR --apply                 # 로컬 대상 반영
//   TARGET_DB_URL=... npx tsx scripts/prod-launch/import-kit.ts --dir DIR --apply \
//       --target-ref <새 운영 ref> --yes-production                                                   # 운영 반영(오너 승인 후)
// 옵션: --keep-authors  작성자 컬럼(created_by 등) 유지(같은 profiles.id 가 대상에 있을 때만)
//       --no-replica    session_replication_role=replica 를 쓰지 않음(트리거 발동 — 보통 실패하므로 비권장)
// 재실행 안전: 없는 행만 추가(on conflict do nothing), replace 표는 통째 교체. 두 번째 실행의 INS 는 0 이어야 한다.
// 비프로덕션 공유 프로젝트(worpsqwqgnspddnrtnvq)로는 반영을 거부한다.
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import os from "node:os";
import { CONTENT_TABLES, FK_CHECKS, REVIEWER_TABLES, REVIEWER_FK_CHECKS, type TableSpec } from "./content-tables";

const NONPROD_REF = "worpsqwqgnspddnrtnvq";
const flag = (n: string) => process.argv.includes(n);
const arg = (n: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };

const kit = arg("--kit") ?? "content";
if (kit !== "content" && kit !== "reviewers") { console.error("--kit 은 content | reviewers"); process.exit(2); }
const TABLES: TableSpec[] = kit === "content" ? CONTENT_TABLES : REVIEWER_TABLES;
const CHECKS = kit === "content" ? FK_CHECKS : REVIEWER_FK_CHECKS;
const overrides: Record<string, string> = {};
process.argv.forEach((a, i) => { if (a === "--override") { const [k, v] = (process.argv[i + 1] ?? "").split("="); if (k && v) overrides[k] = v; } });
const dir = arg("--dir");
const apply = flag("--apply");
const keepAuthors = flag("--keep-authors");
const useReplica = !flag("--no-replica");
const dbUrl = process.env.TARGET_DB_URL;
if (!dir || !dbUrl) { console.error("--dir 와 TARGET_DB_URL 필요"); process.exit(2); }

const u = new URL(dbUrl);
const isLocal = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(u.hostname);
const hostRef = (u.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1]) ?? (u.username.match(/^postgres\.([a-z0-9]+)$/)?.[1]);
if (!isLocal) {
  const need = arg("--target-ref");
  if (!hostRef || !need || need !== hostRef) { console.error(`원격 대상은 --target-ref 가 접속 주소의 ref(${hostRef ?? "?"})와 같아야 합니다.`); process.exit(2); }
  if (hostRef === NONPROD_REF || dbUrl.includes(NONPROD_REF)) { console.error("공유 비프로덕션 프로젝트는 대상이 될 수 없습니다."); process.exit(2); }
  if (apply && !flag("--yes-production")) { console.error("원격 반영은 --yes-production 이 필요합니다(오너 승인 후)."); process.exit(2); }
}
const penv = { ...process.env, PGHOST: u.hostname, PGPORT: u.port || "5432", PGUSER: decodeURIComponent(u.username), PGPASSWORD: decodeURIComponent(u.password), PGDATABASE: u.pathname.slice(1) || "postgres", PGSSLMODE: isLocal ? "disable" : "require" };

function psql(sql: string): string {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "alton-import-"));
  const f = path.join(tmp, "q.sql");
  writeFileSync(f, sql);
  try {
    const r = spawnSync("psql", ["-X", "-At", "-q", "-v", "ON_ERROR_STOP=1", "-f", f], { env: penv, encoding: "utf-8", maxBuffer: 1 << 28 });
    if (r.status !== 0) throw new Error(`psql 실패: ${r.stderr.trim().slice(0, 1500)}`);
    return r.stdout;
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

type Manifest = { tables: Record<string, { count: number; pk: string[]; columns: string[] }>; storage?: string[] };
const manifest: Manifest = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf-8"));
const readRows = (t: string): any[] => {
  const f = path.join(dir, `${t}.jsonl`);
  if (!existsSync(f)) throw new Error(`${f} 없음`);
  return readFileSync(f, "utf-8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
};
const qi = (s: string) => `"${s.replace(/"/g, '""')}"`;

const schemaOf = (sp: TableSpec) => sp.schema ?? "public";
const keyOf = (sp: TableSpec) => (schemaOf(sp) === "public" ? sp.name : `${schemaOf(sp)}.${sp.name}`);
const relOf = (sp: TableSpec) => `${qi(schemaOf(sp))}.${qi(sp.name)}`;
const rel = (dotted: string) => (dotted.includes(".") ? dotted.split(".").map(qi).join(".") : `public.${qi(dotted)}`);

function targetColumns(schema: string, table: string): { name: string; generated: boolean }[] {
  const out = psql(`select column_name||'|'||(is_generated='ALWAYS' or coalesce(identity_generation,'')='ALWAYS') from information_schema.columns where table_schema='${schema}' and table_name='${table}' order by ordinal_position;`);
  return out.split("\n").filter(Boolean).map((l) => { const [name, g] = l.split("|"); return { name, generated: g === "true" }; });
}

function build(): { sql: string; plan: string[] } {
  const plan: string[] = [];
  const parts: string[] = ["begin;"];
  if (useReplica) parts.push("set local session_replication_role = replica;");
  const deferredUpdates: string[] = [];
  const tag = () => `$j${randomBytes(6).toString("hex")}$`;

  for (const spec of TABLES) {
    const key = keyOf(spec), R = relOf(spec);
    const m = manifest.tables[key];
    if (!m) throw new Error(`manifest 에 ${key} 없음`);
    const tcols = targetColumns(schemaOf(spec), spec.name);
    if (!tcols.length) throw new Error(`대상에 ${key} 테이블이 없습니다 — 마이그레이션 적용 여부 확인`);
    const tnames = new Set(tcols.map((c) => c.name));
    const missing = m.columns.filter((c) => !tnames.has(c));
    if (missing.length) throw new Error(`${key}: 대상에 없는 컬럼 ${missing.join(",")} — 마이그레이션 버전 불일치`);
    const genCols = new Set(tcols.filter((c) => c.generated).map((c) => c.name));
    const cols = m.columns.filter((c) => !genCols.has(c));
    const nulls = new Set<string>([...(spec.nullAlways ?? []), ...(keepAuthors ? [] : spec.nullAuthors ?? []), ...(spec.deferred ?? [])]);
    const rows = readRows(key);
    if (rows.length !== m.count) throw new Error(`${key}: 파일 ${rows.length} ≠ manifest ${m.count}`);

    if (spec.deferred?.length) {
      const d = spec.deferred[0];
      const pairs = rows.filter((r) => r[d]).map((r) => ({ id: r[spec.pk[0]], v: r[d] }));
      const t = tag();
      deferredUpdates.push(`with u as (update ${R} p set ${qi(d)} = x.v from jsonb_to_recordset(${t}${JSON.stringify(pairs)}${t}::jsonb) as x(id uuid, v uuid) where p.${qi(spec.pk[0])} = x.id and p.${qi(d)} is distinct from x.v returning 1) select 'DEF|${key}.${d}|'||count(*) from u;`);
    }
    plan.push(`${key} (${spec.mode}) ${rows.length}행`);

    if (spec.mode === "replace") parts.push(`with d as (delete from ${R} returning 1) select 'DEL|${key}|'||count(*) from d;`);
    const collist = cols.map(qi).join(",");
    const conflict = `on conflict (${spec.pk.map(qi).join(",")}) do nothing`;
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100).map((r) => { const o = { ...r };
        for (const c of nulls) if (c in o) o[c] = null;
        for (const c of spec.blankCols ?? []) if (c in o) o[c] = "";
        for (const [c, add] of Object.entries(spec.jsonMerge ?? {})) if (c in o) o[c] = { ...(o[c] ?? {}), ...add };
        for (const c of spec.overridable ?? []) { const v = overrides[`${spec.name}.${c}`]; if (v) o[c] = v; else if (!keepAuthors) throw new Error(`${key}.${c} 는 --override ${spec.name}.${c}=<대상 profiles.id> 가 필요합니다(또는 --keep-authors).`); }
        return o; });
      const t = tag();
      parts.push(`with i as (insert into ${R} (${collist}) select ${collist} from jsonb_populate_recordset(null::${R}, ${t}${JSON.stringify(chunk)}${t}::jsonb) ${conflict} returning 1) select 'INS|${key}|'||count(*) from i;`);
    }
    // 존재 검증: 가져온 pk 가 대상에 모두 있는지
    const t2 = tag();
    const pkRows = rows.map((r) => Object.fromEntries(spec.pk.map((k) => [k, r[k]])));
    const pkDef = spec.pk.map((k) => `${qi(k)} ${k === "code" ? "text" : "uuid"}`).join(",");
    const join = spec.pk.map((k) => `t.${qi(k)} = x.${qi(k)}`).join(" and ");
    parts.push(`select 'PRESENT|${key}|'||count(*) from jsonb_to_recordset(${t2}${JSON.stringify(pkRows)}${t2}::jsonb) as x(${pkDef}) join ${R} t on ${join};`);
    parts.push(`select 'TOTAL|${key}|'||count(*) from ${R};`);
  }
  parts.push(...deferredUpdates);
  for (const [c, cc, p, pc] of CHECKS) parts.push(`select 'ORPHAN|${c}.${cc}->${p}|'||count(*) from ${rel(c)} x where x.${qi(cc)} is not null and not exists (select 1 from ${rel(p)} y where y.${qi(pc)} = x.${qi(cc)});`);
  parts.push(apply ? "commit;" : "rollback;");
  return { sql: parts.join("\n"), plan };
}

async function uploadStorage() {
  const files = manifest.storage ?? [];
  if (!files.length) return;
  const su = process.env.TARGET_SUPABASE_URL, sk = process.env.TARGET_SUPABASE_SECRET_KEY;
  console.log(`\nStorage 그림 파일 ${files.length}개 ${apply ? "업로드" : "(dry-run: 업로드 안 함)"}`);
  if (!apply) return;
  if (!su || !sk) { console.warn("TARGET_SUPABASE_URL / TARGET_SUPABASE_SECRET_KEY 가 없어 Storage 업로드를 건너뜁니다."); return; }
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(su, sk, { auth: { autoRefreshToken: false, persistSession: false } });
  let ok = 0;
  for (const ref of files) {
    const [bucket, ...rest] = ref.split("/");
    const p = rest.join("/");
    const buf = readFileSync(path.join(dir!, "storage", bucket, p));
    const { error } = await db.storage.from(bucket).upload(p, buf, { upsert: false });
    if (!error || /already exists|Duplicate/i.test(error.message)) ok++; else console.warn(`업로드 실패 ${ref}: ${error.message}`);
  }
  console.log(`Storage ${ok}/${files.length}`);
}

async function main() {
  console.log(`대상: ${isLocal ? "local" : u.hostname} / ${apply ? "APPLY" : "dry-run(ROLLBACK)"} / replica=${useReplica} / keepAuthors=${keepAuthors}`);
  const { sql, plan } = build();
  plan.forEach((p) => console.log("  " + p));
  const out = psql(sql).split("\n").filter(Boolean);
  const sum = (tag: string) => { const m: Record<string, number> = {}; for (const l of out) { const [k, name, n] = l.split("|"); if (k === tag) m[name] = (m[name] ?? 0) + Number(n); } return m; };
  const ins = sum("INS"), present = sum("PRESENT"), total = sum("TOTAL"), del = sum("DEL");
  let bad = 0;
  console.log("\n표                                   원본   신규추가  대상존재  대상전체");
  for (const spec of TABLES) {
    const key = keyOf(spec);
    const n = manifest.tables[key].count;
    const ok = present[key] === n;
    if (!ok) bad++;
    console.log(`${key.padEnd(36)}${String(n).padStart(5)}${String(ins[key] ?? 0).padStart(10)}${String(present[key] ?? 0).padStart(10)}${String(total[key] ?? 0).padStart(10)} ${ok ? "OK" : "MISMATCH"}${del[key] != null ? `  (교체: 기존 ${del[key]}행 삭제)` : ""}`);
  }
  for (const l of out) {
    const [k, name, n] = l.split("|");
    if (k === "DEF") console.log(`순환 FK 채움 ${name}: ${n}행 갱신`);
    if (k === "ORPHAN" && Number(n) > 0) { bad++; console.log(`고아 행! ${name}: ${n}`); }
  }
  console.log(bad ? `\n검증 실패 ${bad}건 ${apply ? "(이미 커밋됨 — 원인 확인 필요)" : ""}` : `\n검증 통과 (${apply ? "커밋됨" : "롤백됨 — 변경 없음"})`);
  await uploadStorage();
  process.exit(bad ? 1 : 0);
}
main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
