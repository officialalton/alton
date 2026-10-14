// 라운드 2 readout 을 사람이 읽기 좋게 출력(읽기 전용, 로컬 파일만). npx tsx scripts/audit/r2-show.ts [gid-or-problem-prefix ...]
import { readFileSync } from "node:fs";
import type { ProblemReadout } from "../../lib/audit-fix/plan";

const file = process.env.R2_READOUT ?? "data/audit/2026-10-13-r2-readout.json";
const ro = JSON.parse(readFileSync(file, "utf-8")) as { problems: ProblemReadout[] };
const keys = process.argv.slice(2);
for (const p of ro.problems) {
  if (keys.length && !keys.some((k) => (p.gid ?? "").startsWith(k) || p.problem_id.startsWith(k))) continue;
  const v = p.pub!;
  console.log(`\n=== gid=${p.gid} problem=${p.problem_id} v${v.version_no} (${v.id}) ${p.pformat} skill=${p.skill_code}`);
  console.log(`placements: ${(p.placements ?? []).filter((x) => x.set_status === "published").map((x) => `${x.set_name} v${x.set_version} ${x.section}${x.module_key ? "/" + x.module_key : ""}#${x.position}`).join("; ")}`);
  console.log(`PASSAGE: ${v.passage}`);
  console.log(`QUESTION: ${v.question}`);
  console.log(`OPTIONS: ${JSON.stringify(v.options)} key=${v.correct_index}${v.answers ? " answers=" + JSON.stringify(v.answers) : ""}`);
  console.log(`EXPL: ${v.explanation}`);
  console.log(`EXPL_EN: ${v.explanation_en}`);
  if (v.figure) console.log(`FIGURE: ${JSON.stringify(v.figure)}`);
  if (v.statements) console.log(`STATEMENTS: ${JSON.stringify(v.statements)}`);
}
