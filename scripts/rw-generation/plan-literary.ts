// 실행: npx tsx scripts/rw-generation/plan-literary.ts [--share 0.4] [--out data/rw-generation/plan-literary-40.json]
// 출력: 문학 40% 기준 배치 계획(JSON)과 요약. API·DB 호출 없음.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildLiteraryPlan, ADOPT_RATE_V3_HARD } from "./batch-plan";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const share = Number(arg("--share") ?? 0.4);
const out = path.resolve(arg("--out") ?? `data/rw-generation/plan-literary-${Math.round(share * 100)}.json`);
const plan = buildLiteraryPlan({ literaryShare: share });
const v3 = buildLiteraryPlan({ literaryShare: share, adoptRate: { hard: ADOPT_RATE_V3_HARD } });
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ ...plan, scenarioV3HardRate: { hardAdoptRate: ADOPT_RATE_V3_HARD, totals: v3.totals } }, null, 1));
console.log(JSON.stringify(plan.totals, null, 1));
console.log("v3 hard 수율 시나리오", JSON.stringify(v3.totals));
console.log("저장:", out);
