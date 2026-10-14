// 라운드 5 읽기 전용 조회(SELECT 만). 대상 문제 id → 현재 공개 버전과 세트 위치를 readout 형식으로 저장한다.
//   npx tsx scripts/audit/r5-readout.ts [--targets data/audit/2026-10-14-r5-targets.json] [--out data/audit/2026-10-14-r5-readout.json]
import { readFileSync, writeFileSync } from "node:fs";
import { dbSelect, PROBLEM_SELECT, type Readout } from "./apply-audit-fixes";
import type { ProblemReadout, SetRow } from "../../lib/audit-fix/plan";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const uuidArr = (ids: string[]) => `array[${ids.map((i) => `'${i.replace(/[^0-9a-f-]/g, "")}'`).join(",")}]::uuid[]`;
const t = JSON.parse(readFileSync(arg("--targets") ?? "data/audit/2026-10-14-r5-targets.json", "utf-8")) as { problemIds: string[] };
const problems = dbSelect<ProblemReadout>(PROBLEM_SELECT(`p.id = any (${uuidArr(t.problemIds)})`));
const sets = dbSelect<SetRow>(`select id, set_group_id, name, version_no, status, format, access_tier, published_at, published_by, archived_at from mock_exam_sets where status in ('published', 'draft') order by name, version_no`);
const out: Readout = { generatedAt: new Date().toISOString(), project: "worpsqwqgnspddnrtnvq", problems, sets, triage: {} };
writeFileSync(arg("--out") ?? "data/audit/2026-10-14-r5-readout.json", JSON.stringify(out, null, 1) + "\n");
console.log(`problems ${problems.length}/${t.problemIds.length}, sets ${sets.length}`);
