// 읽기 전용 rows.json 에서 지정한 problem id 접두사(또는 G-manual 자동 탐지)의 현재 공개 버전 전체를 출력한다.
import { readFileSync } from "node:fs";
import { planSatErrorReportFix } from "../../lib/audit-fix/sat-error-report-1018";
const [file, ...ids] = process.argv.slice(2);
const j = JSON.parse(readFileSync(file, "utf-8"));
const rows = j.rows ?? j;
const done = new Set<string>();
for (const r of rows) {
  const manual = ids.includes("MANUAL") && planSatErrorReportFix(r)?.status === "manual";
  if (!manual && !ids.some((i) => r.problem_id.startsWith(i))) continue;
  if (done.has(r.problem_id)) continue;
  done.add(r.problem_id);
  console.log("\n=====", r.problem_id, r.version_id, r.set_name, r.module_key, "#" + r.position);
  console.log("P:", r.passage, "\nQ:", r.question, "\nO:", JSON.stringify(r.options), "ans", r.correct_index, "\nE:", r.explanation, "\nEE:", r.explanation_en, "\nF:", JSON.stringify(r.figure));
}
