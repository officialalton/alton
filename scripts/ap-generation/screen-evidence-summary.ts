// 증거 JSON 요약: 점검 항목 × 뷰포트별 pass/fail/na 건수와 실패 목록. npx tsx scripts/ap-generation/screen-evidence-summary.ts <evidence.json>
import { readFileSync } from "node:fs";
import type { ScreenEntry } from "../../lib/ap-generation/verify-guard";
const ev = JSON.parse(readFileSync(process.argv[2], "utf-8")) as { entries: ScreenEntry[] };
const tally: Record<string, Record<string, number>> = {};
for (const e of ev.entries) for (const [name, c] of Object.entries(e.checks)) { const k = `${name} @${e.viewport}`; (tally[k] ??= { pass: 0, fail: 0, na: 0 })[c!.result]++; }
for (const k of Object.keys(tally).sort()) console.log(k.padEnd(40), JSON.stringify(tally[k]));
console.log(`항목 ${ev.entries.length}건, 후보 ${new Set(ev.entries.map((e) => e.candidate_key)).size}개, 해시 ${new Set(ev.entries.map((e) => e.content_hash)).size}종`);
for (const e of ev.entries) for (const [n, c] of Object.entries(e.checks)) if (c!.result === "fail") console.log(`FAIL ${e.candidate_key} @${e.viewport} ${n}: ${c!.note}`);
