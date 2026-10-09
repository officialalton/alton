// 파일 보고(data/ap/stock/items.json) vs DB 현재 집계(ap_stock_summary_v) 일치 점검 — 비프로덕션에서 실행.
//   npx tsx scripts/ap-generation/stock.ts && npx tsx scripts/ap-generation/stock-consistency.ts          # DB 조회(읽기 전용)
//   npx tsx scripts/ap-generation/stock-consistency.ts --emit-sql > /tmp/stock.sql                         # 로컬 검증용 SQL(트랜잭션+롤백)
// 현재 배치(is_current=true)만 비교한다. 불일치가 있으면 종료 코드 1.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { summarize, type StockItem } from "../../lib/ap-generation/stock";
import { compareSummaries, type DbSummaryRow } from "../../lib/ap-generation/stock-consistency";
import { connect } from "../keywords/db";

// DB 현재 집계에는 보조 배치(S1a, import-candidates --supplement)의 후보 행도 is_current=true 로 들어 있으므로 파일 쪽도 s1a-items.json 을 합쳐 비교한다(--no-supplement 로 끌 수 있음).
const read = (f: string) => JSON.parse(readFileSync(path.resolve(process.cwd(), f), "utf-8")) as StockItem[];
const SUPP = ["data/ap/stock/s1a-items.json", "data/ap/stock/v1ab-items.json", "data/ap/stock/v45ab-items.json", "data/ap/stock/bc-topup-items.json", "data/ap/stock/graph-s1-items.json", "data/ap/stock/graph-s2a-items.json", "data/ap/stock/graph-s2b-items.json"]; // 보조 배치 파일(있는 것만)
const items = [...read("data/ap/stock/items.json"), ...(!process.argv.includes("--no-supplement") ? SUPP.filter((f) => existsSync(f)).flatMap(read) : [])];
const file = summarize(items);
const q = (v: string | null | undefined) => (v == null ? "null" : `'${String(v).replace(/'/g, "''")}'`);
async function main() {
  if (process.argv.includes("--emit-sql")) {
    const out = ["begin;", "insert into subjects(name, ap_subject_code) select 'TMP '||c, c from (values ('ap_calculus_ab'),('ap_calculus_bc'),('ap_biology'),('ap_microeconomics')) v(c) on conflict do nothing;"];
    for (const i of items) out.push(`insert into ap_candidate_items(candidate_key,run_id,subject_id,ap_subject_code,kind,keyword_code,skill_primary,structure,response_mode,scoring_mode,payload,review_state,gate_version,item_family_id,used_in_sample,legacy_reserve,calculator) select ${q(i.stockKey)},${q(i.run)},id,${q(i.apSubjectCode)},${q(i.kind)},${q(i.keywordCode)},${q(i.skillPrimary)},${q(i.structure)},'select','exact','{}',${q(i.validation)},${q(i.gateVersion)},${q(i.itemFamilyId || null)},${i.selectedForSample},${i.legacyReserve},'na' from subjects where ap_subject_code=${q(i.apSubjectCode)} limit 1;`);
    out.push("select subject, kind, total_rows, rejected, exact_duplicates, needs_revalidation, auto_passed, unique_items, item_families from ap_stock_summary_v order by 1,2;", "rollback;");
    console.log(out.join("\n")); return;
  }
  const conn = await connect(); if (!conn) throw new Error("SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY 필요");
  const { data, error } = await conn.db.from("ap_stock_summary_v").select("*"); if (error) throw new Error(error.message);
  const diffs = compareSummaries(file, data as DbSummaryRow[]);
  console.log(`대상 ${conn.target}: 파일 ${items.length}행(보조 포함 여부는 위 주석) → ${file.length}개 집계 vs DB ${(data ?? []).length}개`);
  if (diffs.length) { diffs.forEach((d) => console.error("  ✗ " + d)); process.exit(1); }
  console.log("일치(파일 = DB 현재 배치 집계)");
}
main().catch((e) => { console.error(e); process.exit(1); });
