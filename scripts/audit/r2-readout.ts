// 라운드 2 읽기 전용 조회(SELECT 만, assertSelectOnly 가드). 대상 gid / 문제 id / 본문 검색어 → 현재 공개 버전과 세트 위치를 readout 형식으로 저장한다.
//   npx tsx scripts/audit/r2-readout.ts --targets data/audit/2026-10-13-r2-targets.json --out data/audit/2026-10-13-r2-readout.json
import { readFileSync, writeFileSync } from "node:fs";
import { dbSelect, PROBLEM_SELECT, type Readout } from "./apply-audit-fixes";
import type { ProblemReadout, SetRow } from "../../lib/audit-fix/plan";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const lit = (s: string) => { if (s.includes("$q$")) throw new Error("dollar tag in literal"); return `$q$${s}$q$`; };
const textArr = (xs: string[]) => (xs.length ? `array[${xs.map(lit).join(",")}]::text[]` : "array[]::text[]");
const uuidArr = (ids: string[]) => (ids.length ? `array[${ids.map((i) => `'${i.replace(/[^0-9a-f-]/g, "")}'`).join(",")}]::uuid[]` : "array[]::uuid[]");

type Targets = { gids?: string[]; problemIds?: string[]; passageLike?: string[]; explanationEnLike?: string[] };
const t = JSON.parse(readFileSync(arg("--targets") ?? "data/audit/2026-10-13-r2-targets.json", "utf-8")) as Targets;
const where = [
  `p.id in (select pv.problem_id from problem_versions pv where pv.quality->'mockExamGeneration'->>'gid' = any (${textArr(t.gids ?? [])}))`,
  `p.id = any (${uuidArr(t.problemIds ?? [])})`,
  ...(t.passageLike?.length ? [`p.id in (select pv.problem_id from problem_versions pv where pv.id = p.published_version_id and pv.passage ilike any (${textArr(t.passageLike)}))`] : []),
  ...(t.explanationEnLike?.length ? [`p.published_version_id in (select pv.id from problem_versions pv where pv.explanation_en ilike any (${textArr(t.explanationEnLike)}))`] : []),
].join(" or ");
const problems = dbSelect<ProblemReadout>(PROBLEM_SELECT(where));
const sets = dbSelect<SetRow>(`select id, set_group_id, name, version_no, status, format, access_tier, published_at, published_by, archived_at from mock_exam_sets where status in ('published', 'draft') order by name, version_no`);
const out: Readout = { generatedAt: new Date().toISOString(), project: "worpsqwqgnspddnrtnvq", problems, sets, triage: {} };
writeFileSync(arg("--out") ?? "data/audit/2026-10-13-r2-readout.json", JSON.stringify(out, null, 1) + "\n");
console.log(`problems ${problems.length}, sets ${sets.length}`);
