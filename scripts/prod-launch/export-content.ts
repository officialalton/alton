// 비프로덕션(원본) → JSONL 내보내기. 읽기 전용(SELECT·Storage download 만). 어떤 쓰기도 하지 않는다.
//   SOURCE_SUPABASE_URL=https://<ref>.supabase.co SOURCE_SUPABASE_SECRET_KEY=... \
//   npx tsx scripts/prod-launch/export-content.ts [--out DIR] [--no-storage]
// 키는 환경변수로만 받는다(출력·저장 안 함). 예: SOURCE_SUPABASE_SECRET_KEY=$(supabase projects api-keys ... | jq -r ...)
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { createClient } from "@supabase/supabase-js";
import { CONTENT_TABLES, TEST_NAME_RE } from "./content-tables";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };
const url = process.env.SOURCE_SUPABASE_URL;
const key = process.env.SOURCE_SUPABASE_SECRET_KEY;
if (!url || !key) { console.error("SOURCE_SUPABASE_URL / SOURCE_SUPABASE_SECRET_KEY 필요"); process.exit(2); }
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const out = arg("--out") ?? path.join(os.homedir(), ".alton-secrets", "prod-content", stamp);
const withStorage = !process.argv.includes("--no-storage");
mkdirSync(out, { recursive: true });

const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const PAGE = 500;

async function main() {
  console.log(`원본: ${new URL(url!).host} → ${out} (읽기 전용)`);
  const manifest: any = { exportedAt: new Date().toISOString(), source: new URL(url!).host, tables: {}, warnings: [] as string[] };
  const figureObjects = new Set<string>();

  for (const t of CONTENT_TABLES) {
    const file = path.join(out, `${t.name}.jsonl`);
    writeFileSync(file, "");
    let n = 0;
    const idHash = createHash("sha256");
    let cols: string[] = [];
    for (let from = 0; ; from += PAGE) {
      let q = db.from(t.name).select("*");
      for (const k of t.pk) q = q.order(k, { ascending: true });
      const { data, error } = await q.range(from, from + PAGE - 1);
      if (error) throw new Error(`${t.name}: ${error.message}`);
      if (!data?.length) break;
      cols = Object.keys(data[0]);
      appendFileSync(file, data.map((r) => JSON.stringify(r)).join("\n") + "\n");
      for (const r of data as any[]) {
        idHash.update(t.pk.map((k) => String(r[k])).join("|") + "\n");
        if (t.name === "problem_versions" && r.figure?.type === "image" && r.figure.bucket && r.figure.path) figureObjects.add(`${r.figure.bucket}/${r.figure.path}`);
        if (t.name === "subjects" && TEST_NAME_RE.test(r.name ?? "")) manifest.warnings.push(`테스트로 보이는 과목: ${r.name} (${r.id})`);
        if (t.name === "subject_keywords" && TEST_NAME_RE.test(r.label ?? "")) manifest.warnings.push(`테스트로 보이는 키워드: ${r.label} (${r.id})`);
      }
      n += data.length;
      if (data.length < PAGE) break;
    }
    manifest.tables[t.name] = { count: n, pk: t.pk, columns: cols, pkSha256: idHash.digest("hex") };
    console.log(`  ${t.name.padEnd(34)} ${n}`);
  }

  if (withStorage && figureObjects.size) {
    const dir = path.join(out, "storage");
    manifest.storage = [] as string[];
    for (const ref of figureObjects) {
      const [bucket, ...rest] = ref.split("/");
      const p = rest.join("/");
      const { data, error } = await db.storage.from(bucket).download(p);
      if (error || !data) { manifest.warnings.push(`그림 파일 다운로드 실패 ${ref}: ${error?.message}`); continue; }
      const dest = path.join(dir, bucket, p);
      mkdirSync(path.dirname(dest), { recursive: true });
      writeFileSync(dest, Buffer.from(await data.arrayBuffer()));
      manifest.storage.push(ref);
    }
    console.log(`  storage 그림 파일 ${manifest.storage.length}/${figureObjects.size}`);
  }
  writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
  manifest.warnings.slice(0, 10).forEach((w: string) => console.warn("경고:", w));
  if (manifest.warnings.length > 10) console.warn(`경고 외 ${manifest.warnings.length - 10}건 — manifest.json 참고`);
  console.log(`완료: ${out}/manifest.json`);
}
main().catch((e) => { console.error(e); process.exit(1); });
