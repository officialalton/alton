// SAT 수학 상향(2026-10-20) 1단계: 후보 문항(미사용 확정 Math, medium/hard)의 공개 버전 본문·품질 메타를 읽기 SELECT 로만 가져온다.
//   --all 이면 사용 중·easy 포함 모든 확정 Math(신규 생성분의 정확 중복 점검용).
//   npx tsx scripts/prod-open/sat-math-harder-fetch.ts --dump tmp/bank-dump-math/dump.json --out tmp/bank-dump-math/cand-content.json
// 출력 행: problem_id, version_id, skill_code, difficulty, format, passage, question, options, correct_index, explanation, explanation_en, figure, diff_status, created_via
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const dump = JSON.parse(readFileSync(path.resolve(arg("--dump")!), "utf-8"));
// 수학 상향 초안(44번이 만든 draft 30개)은 폐기 예정이라 사용 중으로 세지 않는다(--drafts-count 로 되돌림).
const DRAFT_OFF = !process.argv.includes("--drafts-count");
const live = new Set<string>(dump.sets.filter((s: any) => !s.archived_at && s.status !== "failed" && !(DRAFT_OFF && s.status === "draft" && /^SAT Practice Test \d+$/.test(s.name))).map((s: any) => s.id));
const used = new Set<string>(dump.items.filter((i: any) => live.has(i.exam_set_id)).map((i: any) => i.problem_id));
const ALL = process.argv.includes("--all");
const ids: string[] = dump.problems.filter((p: any) => (ALL || !used.has(p.id)) && !p.archived_at && p.status === "confirmed" && p.usage_scope === "mock_exam" && p.sat_domain && !String(p.sat_domain).startsWith("rw_") && (ALL || p.difficulty !== "easy")).map((p: any) => p.id);
console.error(`candidates ${ids.length}`);
const rows: any[] = [];
for (let i = 0; i < ids.length; i += 150) {
  const lit = ids.slice(i, i + 150).map((x) => `'${x}'`).join(",");
  const sql = `select coalesce(jsonb_agg(t),'[]'::jsonb) as j from (select p.id as problem_id, pv.id as version_id, p.skill_code, p.sat_domain, p.difficulty, p.format, p.similarity_group, p.subpattern, pv.passage, pv.question, pv.options, pv.correct_index, pv.explanation, pv.explanation_en, pv.figure, pv.quality->'mockExamGeneration'->>'difficultyStatus' as diff_status, pv.quality->'mockExamGeneration'->>'source' as src from problems p join problem_versions pv on pv.id = p.published_version_id where p.id in (${lit})) t`;
  const r = spawnSync("supabase", ["db", "query", "--linked", sql], { encoding: "utf-8", maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout).slice(0, 300));
  rows.push(...JSON.parse(r.stdout.slice(r.stdout.indexOf("{"), r.stdout.lastIndexOf("}") + 1)).rows[0].j);
}
writeFileSync(path.resolve(arg("--out")!), JSON.stringify(rows));
console.log(`fetched ${rows.length}`);
