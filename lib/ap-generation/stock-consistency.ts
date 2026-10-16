// 파일 집계(stock.ts)와 DB 현재 집계(ap_stock_summary_v)의 일치 점검 로직(순수). 불일치 목록을 반환한다.
import type { Summary } from "./stock";
export type DbSummaryRow = { subject: string; kind: string; total_rows: number; rejected: number; exact_duplicates: number; needs_revalidation: number; auto_passed: number; unique_items: number; item_families: number; selected_for_sample: number; legacy_reserve: number };
export function compareSummaries(file: Summary[], db: DbSummaryRow[]): string[] {
  const out: string[] = []; const key = (s: string, k: string) => `${s}|${k}`; const dm = new Map(db.map((r) => [key(r.subject, r.kind), r]));
  for (const f of file) {
    const d = dm.get(key(f.subject, f.kind));
    if (!d) { out.push(`DB 에 ${f.subject}/${f.kind} 없음`); continue; }
    const pairs: [string, number, number][] = [["total_rows", f.totalRows, d.total_rows], ["rejected", f.rejected, d.rejected], ["exact_duplicates", f.exactDuplicates, d.exact_duplicates], ["needs_revalidation", f.needsRevalidation, d.needs_revalidation], ["auto_passed", f.autoPassed, d.auto_passed],
      ["unique_items", f.autoPassed + f.needsRevalidation, d.unique_items], ["item_families", f.itemFamilies, d.item_families], ["selected_for_sample", f.selectedForSample, d.selected_for_sample], ["legacy_reserve", f.legacyReserve, d.legacy_reserve]];
    for (const [name, a, b] of pairs) if (a !== b) out.push(`${f.subject}/${f.kind} ${name}: 파일 ${a} ≠ DB ${b}`);
    dm.delete(key(f.subject, f.kind));
  }
  for (const [k] of dm) out.push(`파일에 없는 DB 집계 ${k}`);
  return out;
}
