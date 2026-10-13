// DB 현재 공개 버전에 대한 결함 스캔(읽기 전용 SELECT, 2026-10-13): 빈칸 뒤 중복 · 목표 문장 이중 표시 · 평면 그림 교점 창 밖.
// 저장소 스캔(stock-defect-scans.py)은 생성물 기준이라 DB 와 다를 수 있어, 현재 공개 문제 버전을 직접 읽는다. 기계적으로 고칠 수 있는 것만 패치(SCAN-*)로 만들고 나머지는 review 로 남긴다.
//   npx tsx scripts/audit/db-defect-scan.ts [--write]   (--write: data/audit/2026-10-13-db-defect-scan.json, data/audit/2026-10-13-scan-patches.json)
import { readFileSync, writeFileSync } from "node:fs";
import { scanRows, type ScanFinding, type ScanRow } from "../../lib/audit-fix/scan";
import { dbSelect, loadPatches, matchProblem } from "./apply-audit-fixes";
import type { ProblemReadout } from "../../lib/audit-fix/plan";

const write = process.argv.includes("--write");
const rows = dbSelect<ScanRow>(`select p.id as problem_id, pv.id as version_id, pv.quality->'mockExamGeneration'->>'gid' as gid, pv.passage, pv.question, pv.options, pv.correct_index, pv.figure,
  coalesce((select jsonb_agg(distinct s.name) from mock_exam_set_items i join mock_exam_sets s on s.id = i.exam_set_id and s.status = 'published' and s.archived_at is null where i.problem_id = p.id), '[]'::jsonb) as sets
  from problems p join problem_versions pv on pv.id = p.published_version_id
 where p.status::text = 'confirmed' and p.archived_at is null and p.usage_scope in ('mock_exam', 'both') and coalesce(p.exam_system, '') like 'sat%' and p.format::text in ('mc', 'spr')`);
const { patches: allPatches } = loadPatches({ includeScan: false });
const readout = JSON.parse(readFileSync("data/audit/2026-10-13-db-readout.json", "utf-8")) as { problems: ProblemReadout[] };
// 이미 패치 목록(S/R/D/F/Q/C/U/A/E)이 다루는 문제 = 패치↔문제 매칭 결과(gid 접두사가 달라도 옛 지문으로 찾는다).
const known = new Set<string>();
for (const p of allPatches) { const m = matchProblem(p, readout.problems); if (m) known.add(m.problem_id); }
const findings: ScanFinding[] = scanRows(rows, known);
const by = (k: string) => findings.filter((f) => f.kind === k);
console.log(`스캔한 공개 SAT 문항 ${rows.length}건`);
for (const k of ["completion_duplicate", "question_in_stimulus", "intersection_off_axes"]) {
  const f = by(k); console.log(`${k}: ${f.length}건 (기계 패치 ${f.filter((x) => x.patch).length}, 기존 패치 목록에 있음 ${f.filter((x) => /already in the patch list/.test(x.detail + (x.review ?? ""))).length}, 사람 검토 ${f.filter((x) => x.review && !/already/.test(x.review)).length})`);
}
for (const f of findings.filter((x) => x.review && !/already/.test(x.review))) console.log(`  review [${f.kind}] ${f.problemId.slice(0, 8)} ${f.sets.join(",")} — ${f.detail.slice(0, 160)} :: ${f.review}`);
if (write) {
  writeFileSync("data/audit/2026-10-13-db-defect-scan.json", JSON.stringify({ kind: "db_defect_scan", generatedAt: new Date().toISOString(), project: "worpsqwqgnspddnrtnvq", scanned: rows.length, findings }, null, 1) + "\n");
  const patches = findings.filter((f) => f.patch).map((f) => f.patch!);
  writeFileSync("data/audit/2026-10-13-scan-patches.json", JSON.stringify({ kind: "sat_problem_scan_patch_list", generatedBy: "scripts/audit/db-defect-scan.ts", note: "Mechanical patches found by scanning the CURRENT published DB versions (not in the triage patch list). Matched by DB problem id + expected published version id.", count: patches.length, patches }, null, 1) + "\n");
  console.log(`wrote scan outputs (${patches.length} mechanical patches)`);
}
