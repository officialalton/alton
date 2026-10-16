// 라운드 6 보조: readout 의 모든 문항을 "시험|섹션|위치" 키의 JSON 으로 덤프(읽기 전용, 로컬). 사용: npx tsx scripts/audit/r6-dump.ts <out.json>
import { readFileSync, writeFileSync } from "node:fs";
import type { ProblemReadout } from "../../lib/audit-fix/plan";
const ro = JSON.parse(readFileSync("data/audit/2026-10-15-r6-readout.json", "utf-8")) as { problems: ProblemReadout[] };
const out: Record<string, unknown> = {};
for (const p of ro.problems) { const pl = (p.placements ?? []).find((x) => x.set_status === "published"); if (!pl) continue;
  out[`${pl.set_name.replace("AP ", "").replace(" — Practice Exam ", "#")}|${pl.section}|${pl.position}`] = { id: p.problem_id, key: p.ap_candidate_key, ver: p.pub?.id, q: p.pub?.question, passage: p.pub?.passage, options: p.pub?.options, ci: p.pub?.correct_index, answers: p.pub?.answers, ex: p.pub?.explanation, exen: p.pub?.explanation_en, fig: p.pub?.figure, st: p.pub?.statements }; }
writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
