// RW 정답 누설 감사용 읽기 전용 덤프(2026-10-08). 게시된 mock_exam RW MC 문항 + 세트 위치.
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SECRET_KEY=... npx tsx scripts/qa/rw-leak-dump.ts --out tmp/rw-leak/dump.json
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const i = process.argv.indexOf("--out");
const out = path.resolve(i > 0 ? process.argv[i + 1] : "tmp/rw-leak/dump.json");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) { console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY 필요"); process.exit(2); }
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
async function page<T>(q: () => any): Promise<T[]> {
  let rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q().range(from, from + 999);
    if (error) throw new Error(error.message);
    rows = rows.concat(data ?? []);
    if ((data ?? []).length < 1000) break;
  }
  return rows;
}
async function main() {
  const problems = await page<any>(() => db.from("problems").select("id,sat_domain,skill_code,format,usage_scope,archived_at").neq("sat_domain", "math").order("id"));
  const rwIds = new Set(problems.filter((p) => !p.archived_at && ["mock_exam", "both"].includes(p.usage_scope)).map((p) => p.id));
  const versions = (await page<any>(() => db.from("problem_versions").select("id,problem_id,version_no,passage,question,options,correct_index,explanation,explanation_en,difficulty,figure,status").eq("status", "published").order("id"))).filter((v) => rwIds.has(v.problem_id));
  const sets = await page<any>(() => db.from("mock_exam_sets").select("id,name,status").order("id"));
  const items = await page<any>(() => db.from("mock_exam_set_items").select("exam_set_id,problem_id,problem_version_id,module_key,position").order("exam_set_id"));
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ problems: problems.filter((p) => rwIds.has(p.id)), versions, sets, items }));
  console.error(`problems ${rwIds.size} versions ${versions.length} sets ${sets.length} items ${items.length}`);
}
main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
