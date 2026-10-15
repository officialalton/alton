// AP Psychology 표의 비율이 정수 인원과 맞는지 점검(읽기 전용): 한 행에 인원 수(그 행의 최대 정수)와 백분율이 함께 있으면 인원 x 백분율 / 100 이 정수여야 한다.
//   npx tsx scripts/audit/psych-table-pct-scan.ts [--write data/ap/stock/psych-table-pct-flags.json]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { STOCK_FILES } from "../ap-generation/keys-file";
type J = Record<string, any>;
export function pctRowViolations(table: { columns?: string[]; rows?: string[][] } | undefined): string[] {
  const out: string[] = []; if (!table?.rows) return out;
  for (const row of table.rows) {
    const ints = row.map((c) => /^\s*\d{1,5}\s*$/.test(String(c)) ? Number(c) : NaN).filter((n) => Number.isFinite(n));
    const pcts = row.map((c) => /^\s*(\d+(?:\.\d+)?)\s*%\s*$/.exec(String(c))).filter(Boolean).map((m) => Number(m![1]));
    if (!ints.length || !pcts.length) continue;
    const n = Math.max(...ints);
    for (const p of pcts) { const k = (p * n) / 100; if (Math.abs(k - Math.round(k)) > 1e-9) out.push(`row[${row.join(" | ")}]: ${p}% of ${n} = ${k.toFixed(2)} not an integer count`); }
  }
  return out;
}
export function itemTables(payload: J): any[] { const its: J[] = payload.items ?? [payload]; const t = [payload.stimulus, ...its.map((i) => i.stimulus)].filter((s) => s?.kind === "table").map((s) => s.data); return t; }
if (process.argv[1]?.endsWith("psych-table-pct-scan.ts")) {
  const flags: Record<string, string[]> = {}; const seen = new Set<string>();
  for (const f of STOCK_FILES) { const p = `data/ap/stock/${f}.json`; if (!existsSync(p)) continue; for (const r of JSON.parse(readFileSync(p, "utf-8")) as J[]) { if (r.apSubjectCode !== "ap_psychology" || seen.has(r.stockKey)) continue; seen.add(r.stockKey);
    const v = itemTables(r.payload).flatMap(pctRowViolations); const fq = r.kind === "frq_bundle" ? JSON.stringify(r.payload.stimulus ?? {}) : "";
    if (v.length) flags[r.stockKey] = v; else if (fq) { /* FRQ 표 외 텍스트는 아래 별도 */ } } }
  for (const [k, v] of Object.entries(flags)) console.log(k, v[0]);
  console.log("flagged", Object.keys(flags).length);
  const i = process.argv.indexOf("--write"); if (i > 0) writeFileSync(process.argv[i + 1], JSON.stringify(flags, null, 1));
}
