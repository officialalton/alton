// 공개 SAT 세트 Math 문항(현재 공개 버전)에서 그래프+식 중복 결함을 전수 탐지한다. 읽기 전용 rows.json(SELECT 결과) 입력.
//   npx tsx scripts/audit/sat-math-graph-scan.ts <rows.json>
import { readFileSync } from "node:fs";
import { planSatErrorReportFix } from "../../lib/audit-fix/sat-error-report-1018";
import { hasGraphAndExpressionForSameCurves } from "../../lib/problem-generation/graph-expression-redundancy";

const j = JSON.parse(readFileSync(process.argv[2], "utf-8"));
const rows = j.rows ?? j;
const seen = new Map<string, any>();
for (const r of rows) {
  const h = planSatErrorReportFix(r);
  const red = r.figure && hasGraphAndExpressionForSameCurves(r.figure, r.passage ?? "");
  const fig = r.figure?.type;
  if (h || red || (fig === "plane" && /=/.test(r.passage ?? "")) || /arch/i.test(r.passage ?? "")) {
    const e = seen.get(r.problem_id) ?? { rule: h?.rule ?? (red ? "redundant-nohit" : "plane-eq"), status: h?.status, sets: [] as string[], p: r };
    e.sets.push(`${r.set_name}(${r.set_status}) ${r.module_key}#${r.position}${r.set_version_id !== r.version_id ? "*" : ""}`);
    seen.set(r.problem_id, e);
  }
}
console.log(rows.length, seen.size);
const by: Record<string, number> = {};
for (const e of seen.values()) by[`${e.rule}/${e.status}`] = (by[`${e.rule}/${e.status}`] ?? 0) + 1;
console.log(by);
for (const e of seen.values()) if (e.status !== "patch") console.log("\n##", e.rule, e.p.problem_id, e.sets.join(", "), "\nP:", e.p.passage, "\nQ:", e.p.question, "\nFIG:", JSON.stringify(e.p.figure).slice(0, 300));
