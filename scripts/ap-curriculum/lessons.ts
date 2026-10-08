// AP 회차 템플릿 계획 출력(DB 없음). 사용: npx tsx scripts/ap-curriculum/lessons.ts [--track compact|full] [--only ap_calculus_ab] [--list]
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { buildLessonPlan, checkLessonPlan, lessonTotals } from "../../lib/ap-curriculum/lessons";
import type { ApCurriculumFile } from "../../lib/ap-curriculum/types";

const onlyIdx = process.argv.indexOf("--only");
const only = onlyIdx > 0 ? process.argv[onlyIdx + 1] : undefined;
const ti = process.argv.indexOf("--track");
const track = (ti > 0 ? process.argv[ti + 1] : "compact") as "compact" | "full";
const DIR = path.resolve(process.cwd(), "data/ap/curriculum-2027");
let bad = 0;
for (const n of readdirSync(DIR).filter((x) => x.endsWith(".json") && (!only || x === `${only}.json`)).sort()) {
  const f = JSON.parse(readFileSync(path.join(DIR, n), "utf-8")) as ApCurriculumFile;
  const plan = buildLessonPlan(f, { track });
  const errs = checkLessonPlan(f, plan, { track });
  const t = lessonTotals(plan);
  console.log(`${f.subject.apCode}: 내용 ${t.content} + 단원복습 ${t.unitReview} + 시험준비 ${t.examPrep} = ${t.total}회 (${t.minutes}분/회, 총 ${(t.totalMinutes / 60).toFixed(0)}시간, 세부 core ${t.coreKeywords}/light ${t.lightKeywords}) 오류=${errs.length}`);
  errs.slice(0, 10).forEach((e) => console.log("  - " + e));
  bad += errs.length;
  if (process.argv.includes("--list")) plan.forEach((l) => console.log(`  ${String(l.position).padStart(3)} ${l.code.padEnd(7)} ${l.estLoad.toFixed(2)} ${l.title}`));
}
process.exit(bad ? 1 : 0);
