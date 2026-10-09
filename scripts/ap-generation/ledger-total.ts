// 누적 원장 합계 출력(무효 측정 포함을 명시): npx tsx scripts/ap-generation/ledger-total.ts
// 누적 = ledger.spent − 승인 범위 시작 기준(61.21) + 시작 전 별도 집행(1.26). 무효로 표시된 측정(validity.json)의 비용도 합계에 포함된다(원장에는 이미 들어 있음) — 아래에 명시.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
export const APPROVED_RANGE_BASELINE = 61.21; export const PRE_RANGE_SPEND = 1.26; export const STOP_LINE = 27; export const TOTAL_CAP = 30;
const root = path.resolve("data/ap/sample-2027");
const runCost = (dir: string) => { let c = 0; for (const f of readdirSync(dir)) if (/\.results\.jsonl$/.test(f)) for (const l of readFileSync(path.join(dir, f), "utf-8").split("\n").filter(Boolean)) { try { c += Number(JSON.parse(l).cost ?? 0); } catch { /* skip */ } } return c; };
export function ledgerTotal() {
  const spent = (JSON.parse(readFileSync(path.join(root, "ledger.json"), "utf-8")) as { spent: number }).spent; const cumulative = spent - APPROVED_RANGE_BASELINE + PRE_RANGE_SPEND;
  const invalid = readdirSync(root).filter((d) => existsSync(path.join(root, d, "validity.json"))).map((d) => ({ run: d, validity: JSON.parse(readFileSync(path.join(root, d, "validity.json"), "utf-8")) as { valid?: boolean; reason?: string }, usd: Number(runCost(path.join(root, d)).toFixed(4)) })).filter((x) => x.validity.valid === false);
  return { ledgerSpent: Number(spent.toFixed(4)), approvedRangeBaseline: APPROVED_RANGE_BASELINE, preRangeSpend: PRE_RANGE_SPEND, cumulativeUsd: Number(cumulative.toFixed(4)), stopLine: STOP_LINE, totalCap: TOTAL_CAP, headroomToStopLine: Number((STOP_LINE - cumulative).toFixed(4)), includesInvalidMeasurements: invalid.map((x) => ({ run: x.run, usd: x.usd, reason: x.validity.reason })) };
}
if (require.main === module) { const t = ledgerTotal(); console.log(JSON.stringify(t, null, 1)); writeFileSync(path.join(root, "ledger-summary.json"), JSON.stringify(t, null, 1)); console.log(`누적 $${t.cumulativeUsd} (무효 측정 포함: ${t.includesInvalidMeasurements.map((x) => `${x.run} $${x.usd}`).join(", ") || "없음"}) / 중단선 $${t.stopLine} 여유 $${t.headroomToStopLine}`); }
