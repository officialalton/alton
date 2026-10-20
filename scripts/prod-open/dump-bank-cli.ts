// dump-bank.ts 의 CLI 판: 서비스 키 없이 `supabase db query --linked`(읽기 SELECT 만)로 dump.json/weights.json 을 만든다.
//   npx tsx scripts/prod-open/dump-bank-cli.ts --out tmp/bank-dump-sat30
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const out = path.resolve(arg("--out") ?? "tmp/bank-dump-sat30");
function q(sql: string): any[] {
  const r = spawnSync("supabase", ["db", "query", "--linked", `select coalesce(jsonb_agg(t),'[]'::jsonb) as j from (${sql}) t`], { encoding: "utf-8", maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout).slice(0, 400));
  const o = r.stdout; return JSON.parse(o.slice(o.indexOf("{"), o.lastIndexOf("}") + 1)).rows[0].j;
}
const problems = q("select id,sat_domain,skill_code,subpattern,format,status,usage_scope,similarity_group,archived_at,difficulty,created_at from problems order by id");
const versions = q("select id,problem_id,status,difficulty,figure_checked,explanation_en,answers from problem_versions where status='published' order by id");
const sets = q("select id,name,status,access_tier,archived_at,difficulty_tier,format,set_group_id from mock_exam_sets order by id");
const items = q("select * from mock_exam_set_items order by exam_set_id,section,position");
const dom = q("select * from mock_exam_domain_weights where difficulty_tier='standard'");
const diff = q("select * from mock_exam_difficulty_weights where difficulty_tier='standard'");
let exp: any[] = []; try { exp = q("select * from mock_exam_problem_exposure_counts()"); } catch (e) { console.error("exposure skip", (e as Error).message); }
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, "dump.json"), JSON.stringify({ problems, versions, sets, items }));
writeFileSync(path.join(out, "weights.json"), JSON.stringify({ dom, diff, exp }));
console.error(`problems ${problems.length} versions ${versions.length} sets ${sets.length} items ${items.length} -> ${out}`);
