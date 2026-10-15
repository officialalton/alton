// 라운드 6 읽기 전용 조회(SELECT 만): 새 AP 9과목×2회차(18세트) 공개본의 모든 문항 + 세트 위치.
//   npx tsx scripts/audit/r6-readout.ts [--out data/audit/2026-10-15-r6-readout.json]
import { writeFileSync } from "node:fs";
import { dbSelect, PROBLEM_SELECT, type Readout } from "./apply-audit-fixes";
import type { ProblemReadout, SetRow } from "../../lib/audit-fix/plan";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
export const R6_SET_FILTER = `s.status = 'published' and s.format = 'ap_fixed' and s.name ~ '^AP (Biology|Chemistry|Computer Science A|English Language|Macroeconomics|Microeconomics|Physics 1|Psychology|Statistics) — Practice Exam [12]$'`;
const problems = dbSelect<ProblemReadout>(PROBLEM_SELECT(`p.id in (select i.problem_id from mock_exam_set_items i join mock_exam_sets s on s.id = i.exam_set_id where ${R6_SET_FILTER})`));
const sets = dbSelect<SetRow>(`select id, set_group_id, name, version_no, status, format, access_tier, published_at, published_by, archived_at from mock_exam_sets where status in ('published', 'draft') order by name, version_no`);
const out: Readout = { generatedAt: new Date().toISOString(), project: "worpsqwqgnspddnrtnvq", problems, sets, triage: {} };
writeFileSync(arg("--out") ?? "data/audit/2026-10-15-r6-readout.json", JSON.stringify(out, null, 1) + "\n");
console.log(`problems ${problems.length}, sets ${sets.length}`);
