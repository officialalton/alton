// S1~S3 그래프·일반 신규 배치 건수·비용 대조(무료·읽기 전용): 재고 파일 행 수 ↔ 원장 호출 비용(시각 창) ↔ 통과/반려(사유)를 한 표로.
//   npx tsx scripts/ap-generation/graph-reconcile.ts
// 원장(data/ap/sample-2027/ledger.json)에는 실행 라벨이 없고 호출 시각만 있다. 각 배치의 호출 시각 창(UTC)을 아래에 고정하고, 창 안의 합이 보고서 지출과 같은지 대조한다.
import { readFileSync } from "node:fs";

const WIN: { file: string; stage: string; from: string; to: string; reported: number }[] = [
  { file: "graph-s1-items", stage: "S1 BC#1+AB#2(AB)", from: "2026-10-09T08:04:00", to: "2026-10-09T08:07:00", reported: 1.697 },
  { file: "graph-s2b-items", stage: "S2 BC#2(BC)", from: "2026-10-09T08:14:00", to: "2026-10-09T08:15:10", reported: 0.2771 },
  { file: "graph-s2a-items", stage: "S2 BC#2(AB)", from: "2026-10-09T08:15:20", to: "2026-10-09T08:16:30", reported: 0.2368 },
  { file: "graph-s3a-items", stage: "S3a AB", from: "2026-10-09T08:26:00", to: "2026-10-09T08:28:50", reported: 0.8688 },
  { file: "graph-s3b-items", stage: "S3a BC", from: "2026-10-09T08:28:51", to: "2026-10-09T08:30:00", reported: 0.1304 },
  { file: "graph-s3c-items", stage: "S3b AB", from: "2026-10-09T08:35:00", to: "2026-10-09T08:36:20", reported: 0.2522 },
  { file: "graph-s3d-items", stage: "S3b BC", from: "2026-10-09T08:36:21", to: "2026-10-09T08:37:30", reported: 0.1148 },
  { file: "graph-s3e-items", stage: "S3c AB", from: "2026-10-09T08:44:00", to: "2026-10-09T08:45:05", reported: 0.2907 },
  { file: "graph-s3f-items", stage: "S3c BC", from: "2026-10-09T08:45:06", to: "2026-10-09T08:46:00", reported: 0.1892 },
  { file: "graph-s3g-items", stage: "S3d BC FRQ 재시도(원형 수정 후 새 후보)", from: "2026-10-09T08:46:30", to: "2026-10-09T08:48:00", reported: 0.0788 },
];
type Row = { stockKey: string; kind: string; validation: string; rejectionReason: string | null; duplicateOf: string | null; archetype?: string };
const ledger = (JSON.parse(readFileSync("data/ap/sample-2027/ledger.json", "utf-8")) as { entries: { at: string; usd: number }[] }).entries;
const out: string[] = ["| 단계 | 재고 파일 | 호출 비용(원장 창, $) | 보고 지출($) | 행 | MC 통과 | MC 반려 | FRQ 통과 | FRQ 반려 | 완전 중복 |", "|---|---|---|---|---|---|---|---|---|---|"];
let tot = { cost: 0, rep: 0, rows: 0, mcp: 0, mcr: 0, fp: 0, fr: 0, dup: 0 }; const reasons = new Map<string, number>(); const rejected: string[] = []; const frq: string[] = [];
for (const w of WIN) {
  const rows = JSON.parse(readFileSync(`data/ap/stock/${w.file}.json`, "utf-8")) as Row[];
  const cost = ledger.filter((e) => e.at >= w.from && e.at <= w.to + "Z").reduce((a, e) => a + e.usd, 0);
  const c = (k: string, v: string) => rows.filter((r) => r.kind === k && r.validation === v).length; const dup = rows.filter((r) => r.validation === "exact_duplicate" || r.duplicateOf).length;
  out.push(`| ${w.stage} | ${w.file}.json | ${cost.toFixed(4)} | ${w.reported.toFixed(4)} | ${rows.length} | ${c("mc", "auto_passed")} | ${c("mc", "rejected")} | ${c("frq_bundle", "auto_passed")} | ${c("frq_bundle", "rejected")} | ${dup} |`);
  tot = { cost: tot.cost + cost, rep: tot.rep + w.reported, rows: tot.rows + rows.length, mcp: tot.mcp + c("mc", "auto_passed"), mcr: tot.mcr + c("mc", "rejected"), fp: tot.fp + c("frq_bundle", "auto_passed"), fr: tot.fr + c("frq_bundle", "rejected"), dup: tot.dup + dup };
  for (const r of rows) {
    if (r.validation === "rejected") { rejected.push(`${r.stockKey} (${r.kind})`); const first = String(r.rejectionReason ?? "").split(";")[0].trim() || "(사유 없음)"; reasons.set(first, (reasons.get(first) ?? 0) + 1); }
    if (r.kind === "frq_bundle") frq.push(`${r.stockKey}: ${r.validation}${r.archetype ? ` (${r.archetype})` : ""}`);
  }
}
out.push(`| **합계** | | **${tot.cost.toFixed(4)}** | **${tot.rep.toFixed(4)}** | **${tot.rows}** | **${tot.mcp}** | **${tot.mcr}** | **${tot.fp}** | **${tot.fr}** | **${tot.dup}** |`);
console.log(out.join("\n"));
console.log(`\n반려 ${rejected.length}건(첫 번째 사유 기준): ${[...reasons].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ")}`);
console.log(`FRQ 후보: ${frq.join(" | ")}`);
console.log(`반려 후보 ID: ${rejected.join(", ")}`);
