// 증거 content_hash 가 현재 재고 payload 와 일치하는지 점검(무료).
import { readFileSync } from "node:fs";
import { STOCK_FILES } from "./keys-file";
import { itemContentHash } from "../../lib/ap-generation/verify-guard";
const stock = new Map<string, Record<string, unknown>>();
for (const f of STOCK_FILES) { try { for (const r of JSON.parse(readFileSync(`data/ap/stock/${f}.json`, "utf-8")) as { stockKey: string; payload: Record<string, unknown> }[]) if (!stock.has(r.stockKey)) stock.set(r.stockKey, r.payload); } catch { /* 없음 */ } }
for (const name of process.argv.slice(2)) {
  const ev = JSON.parse(readFileSync(`data/ap/screen-evidence/evidence-${name}.json`, "utf-8")) as { entries: { candidate_key: string; content_hash: string }[] };
  const bad = ev.entries.filter((e) => { const p = stock.get(e.candidate_key); return !p || itemContentHash(p) !== e.content_hash; });
  console.log(name, "entries", ev.entries.length, "stale/missing", bad.length, [...new Set(bad.map((b) => b.candidate_key))].slice(0, 6));
}
