// 문제은행·세트 읽기 전용 덤프 + 조립 가중치(엄격 조립기 assemble-unique.ts 입력). 쓰기 없음, 서비스 키는 출력하지 않는다.
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SECRET_KEY=... npx tsx scripts/mock-exam-generation/dump-bank.ts --out DIR
//   -> DIR/dump.json ({problems, versions, sets, items}) , DIR/weights.json ({dom, diff, exp})
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined; };
const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) { console.error("NEXT_PUBLIC_SUPABASE_URL 과 SUPABASE_SECRET_KEY 가 필요합니다."); process.exit(2); }
const out = path.resolve(arg("--out") ?? "tmp/bank-dump");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function page<T = Record<string, unknown>>(name: string, q: () => any): Promise<T[]> {
  let rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q().range(from, from + 999);
    if (error) throw new Error(`${name}: ${error.message}`);
    rows = rows.concat(data ?? []);
    if ((data ?? []).length < 1000) break;
  }
  return rows;
}

async function main() {
  const problems = await page("problems", () => db.from("problems").select("id,sat_domain,skill_code,subpattern,format,status,usage_scope,similarity_group,archived_at,difficulty,created_at").order("id"));
  const versions = await page("problem_versions", () => db.from("problem_versions").select("id,problem_id,status,difficulty,figure_checked,explanation_en,answers").eq("status", "published").order("id"));
  const sets = await page("mock_exam_sets", () => db.from("mock_exam_sets").select("id,name,status,access_tier,archived_at,difficulty_tier,format,set_group_id").order("id"));
  const items = await page("mock_exam_set_items", () => db.from("mock_exam_set_items").select("*").order("exam_set_id").order("section").order("position"));
  const dom = await page("mock_exam_domain_weights", () => db.from("mock_exam_domain_weights").select("*").eq("difficulty_tier", "standard"));
  const diff = await page("mock_exam_difficulty_weights", () => db.from("mock_exam_difficulty_weights").select("*").eq("difficulty_tier", "standard"));
  const { data: exp } = await db.rpc("mock_exam_problem_exposure_counts");
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, "dump.json"), JSON.stringify({ problems, versions, sets, items }));
  writeFileSync(path.join(out, "weights.json"), JSON.stringify({ dom, diff, exp: exp ?? [] }));
  console.error(`problems ${problems.length} versions ${versions.length} sets ${sets.length} items ${items.length} -> ${out}`);
}
main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
