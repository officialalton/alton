// 사용: npx tsx scripts/ap-curriculum/validate.ts data/ap/curriculum-2027/<file>.json [...]
import { readFileSync } from "node:fs";
import { validateCurriculum } from "../../lib/ap-curriculum/validate";
import type { ApCurriculumFile } from "../../lib/ap-curriculum/types";

let bad = 0;
for (const p of process.argv.slice(2)) {
  const f = JSON.parse(readFileSync(p, "utf-8")) as ApCurriculumFile;
  const errs = validateCurriculum(f);
  const topics = f.units.reduce((n, u) => n + u.topics.length, 0);
  const subs = f.units.reduce((n, u) => n + u.topics.reduce((m, t) => m + t.subKeywords.length, 0), 0);
  console.log(`${p}: units=${f.units.length} topics=${topics} subKeywords=${subs} skills=${f.skills.length} weights=${f.weights.length} errors=${errs.length}`);
  errs.forEach((e) => console.log("  - " + e));
  bad += errs.length;
}
process.exit(bad ? 1 : 0);
