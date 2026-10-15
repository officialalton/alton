// 게시된 AP 풀 모의고사의 DB 시점 단원 분포를 관리자 점검(fullPracticeUnitBounds)과 대조한다(읽기 전용·보고 전용).
// 스냅샷은 SELECT 한 번으로 얻는다(후보 keyword_code 첫 부분별 MC 슬롯 수):
//   select s.id,s.name,s.ap_subject,s.version_no,split_part(c.keyword_code,'.',1) unit,count(*) n from mock_exam_sets s join mock_exam_set_items i on i.exam_set_id=s.id join problems p on p.id=i.problem_id join ap_candidate_items c on c.candidate_key=p.ap_candidate_key where s.exam_program='ap' and s.ap_label='full_practice' and s.status='published' and c.kind='mc' group by 1,2,3,4,5
//   npx tsx scripts/ap-generation/audit-db-units.ts data/ap/audits/db-unit-snapshot-2026-10-15.json
import { readFileSync } from "node:fs";
import { fullPracticeUnitBounds } from "../../lib/ap-exam/full-set-rules";
export type UnitRow = { id: string; name: string; ap_subject: string; version_no: number; unit: string; n: number };
export function auditUnitSnapshot(rows: UnitRow[]) {
  const sets = new Map<string, { name: string; subject: string; v: number; counts: Record<string, number> }>();
  for (const r of rows) { const s = sets.get(r.id) ?? sets.set(r.id, { name: r.name, subject: r.ap_subject, v: r.version_no, counts: {} }).get(r.id)!; s.counts[r.unit] = (s.counts[r.unit] ?? 0) + Number(r.n); }
  const out: { id: string; name: string; subject: string; version: number; violations: string[]; noRule: boolean }[] = [];
  for (const [id, s] of sets) {
    const b = fullPracticeUnitBounds(s.subject, "full_practice"); const v: string[] = [];
    if (b) for (const [u, r] of Object.entries(b)) { const n = s.counts[u] ?? 0; if (n < r.min) v.push(`unit ${u}: ${n} < min ${r.min}`); if (n > r.max) v.push(`unit ${u}: ${n} > max ${r.max}`); }
    out.push({ id, name: s.name, subject: s.subject, version: s.v, violations: v, noRule: !b });
  }
  return out;
}
if (process.argv[1]?.endsWith("audit-db-units.ts")) {
  const res = auditUnitSnapshot(JSON.parse(readFileSync(process.argv[2], "utf-8")));
  for (const r of res) console.log(`${r.violations.length ? "VIOLATION" : r.noRule ? "n/a(규칙 없음)" : "ok       "} ${r.subject} v${r.version} ${r.name} ${r.id}${r.violations.length ? "\n    " + r.violations.join("\n    ") : ""}`);
  console.log(`sets=${res.length} violating=${res.filter((r) => r.violations.length).length}`);
}
