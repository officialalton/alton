// 외부 검수 SAT Math 오류 신고(2026-10-18) 수정 패치 생성기. DB 에 쓰지 않고 DB 에도 접속하지 않는다 — 총괄이 읽기 전용 SELECT 결과(JSON)를 넣는다.
//   1) npx tsx scripts/audit/sat-error-report-1018-build-patches.ts --print-select-sql      (읽기 전용 SELECT 출력: 게시 SAT 세트의 Math 문항 현재 공개 버전)
//   2) supabase db query --linked "<위 SQL>" > rows.json   (총괄이 실행; {rows:[...]} 또는 [...] 둘 다 받는다)
//   3) npx tsx scripts/audit/sat-error-report-1018-build-patches.ts --in rows.json --out data/audit/2026-10-18-sat-error-report-patches.json
// 출력 patches 는 기존 감사 수정 흐름(scripts/audit/apply-audit-fixes.ts → lib/audit-fix/plan.ts planPatch → 새 problem_versions)과 같은 모양이다.
import { readFileSync, writeFileSync } from "node:fs";
import { planSatErrorReportFix, type SatRow } from "../../lib/audit-fix/sat-error-report-1018";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };

export const SELECT_SQL = `select s.name as set_name, s.status as set_status, i.section, i.module_key, i.position, p.id as problem_id, pv.id as version_id, p.skill_code,
  pv.passage, pv.question, pv.options, pv.correct_index, pv.explanation, pv.explanation_en, pv.figure
from mock_exam_sets s
join mock_exam_set_items i on i.exam_set_id = s.id
join problems p on p.id = i.problem_id
join problem_versions pv on pv.id = i.problem_version_id
where s.name ~ '^SAT Practice Test [0-9]+$' and s.archived_at is null and s.status in ('published', 'draft') and i.section = 'math'
order by s.name, i.module_key, i.position`;

type Row = SatRow & { set_name?: string; set_status?: string; module_key?: string; position?: number };

if (process.argv.includes("--print-select-sql")) { console.log(SELECT_SQL); process.exit(0); }

const inFile = arg("--in");
if (!inFile) { console.error("--in <rows.json> 또는 --print-select-sql 이 필요합니다."); process.exit(2); }
const raw = JSON.parse(readFileSync(inFile, "utf-8")) as Row[] | { rows: Row[] };
const rows = Array.isArray(raw) ? raw : raw.rows;

const patches: Record<string, unknown>[] = [];
const manual: Row[] = [];
const byRule: Record<string, number> = {};
const seenProblem = new Set<string>();
const placements: Record<string, string[]> = {};
for (const r of rows) {
  const hit = planSatErrorReportFix(r);
  if (!hit) continue;
  byRule[hit.rule] = (byRule[hit.rule] ?? 0) + 1;
  const where = `${r.set_name} ${r.module_key ?? ""} #${r.position}`;
  (placements[r.version_id ?? ""] ??= []).push(where);
  if (hit.status === "manual") { manual.push(r); console.log(`MANUAL  ${where}  problem=${r.problem_id}`); continue; }
  if (seenProblem.has(r.problem_id ?? "")) continue; // 같은 문항이 여러 세트에 있으면 새 버전은 한 번만 만든다(세트 새 버전은 plan 단계가 처리)
  seenProblem.add(r.problem_id ?? "");
  patches.push({ id: `E1018-${String(patches.length + 1).padStart(3, "0")}`, kind: "sat", problemId: r.problem_id, expectVersionId: r.version_id, route: "new problem version + rerun validation", why: `[${hit.rule}] ${hit.why}`, auditRefs: ["External reviewer error report 2026-10-18 (SAT Practice Test 1 Math)"], changes: hit.changes });
  console.log(`PATCH   ${where}  ${hit.rule}`);
}
console.log(`\nrows=${rows.length} patches=${patches.length} manual=${manual.length}`, byRule);
const out = arg("--out");
if (out) writeFileSync(out, JSON.stringify({ kind: "sat-error-report-1018", generatedBy: "scripts/audit/sat-error-report-1018-build-patches.ts", applies: "새 problem_versions(원격 DB 직접 수정 금지)", count: patches.length, placements, manual: manual.map((m) => ({ set: m.set_name, position: m.position, problemId: m.problem_id, versionId: m.version_id })), patches }, null, 1));
