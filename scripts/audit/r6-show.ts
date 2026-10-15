// 라운드 6 보조: readout 에서 시험·섹션·위치로 문항 한 건을 출력(읽기 전용, 로컬 파일).
//   npx tsx scripts/audit/r6-show.ts "AP Microeconomics — Practice Exam 2" ap_mc 56
import { readFileSync } from "node:fs";
import type { ProblemReadout } from "../../lib/audit-fix/plan";
const ro = JSON.parse(readFileSync("data/audit/2026-10-15-r6-readout.json", "utf-8")) as { problems: ProblemReadout[] };
const [name, section, pos] = process.argv.slice(2);
for (const p of ro.problems) {
  const pl = (p.placements ?? []).find((x) => x.set_name === name && x.section === section && (pos === undefined || String(x.position) === pos) && x.set_status === "published");
  if (!pl) continue;
  console.log(JSON.stringify({ problem_id: p.problem_id, key: p.ap_candidate_key, idx: p.ap_item_index, pos: pl.position, version: p.pub?.id, no: p.pub?.version_no, passage: p.pub?.passage, question: p.pub?.question, options: p.pub?.options, correct_index: p.pub?.correct_index, answers: p.pub?.answers, explanation: p.pub?.explanation, explanation_en: p.pub?.explanation_en, figure: p.pub?.figure, statements: p.pub?.statements }, null, 1));
}
