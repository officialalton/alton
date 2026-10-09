// AB 초기 재고 목표(칸 단위): 생성·적재·검증. 목표는 초기 목표(MC 100 + FRQ 12 번들)이며 수업 용도 목표는 없다. 합계와 칸별 부족을 따로 보고한다.
//   npx tsx scripts/ap-generation/stock-targets.ts                    # data/ap/stock/stock-targets.json 생성 + 파일 기준 합계·칸별 부족 출력(DB 없음)
//   npx tsx scripts/ap-generation/stock-targets.ts --load [--execute] # ap_stock_cell_targets 적재(dry-run 기본; 마이그레이션 404 필요; 로컬/공유 비프로덕션만)
//   npx tsx scripts/ap-generation/stock-targets.ts --verify           # 적재 후: 파일 계산 부족분 vs DB ap_stock_cell_shortfall_v (읽기 전용)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { buildAbTargets, cellStatus, type CellTarget, type ItemAttrs } from "../../lib/ap-generation/targets";
import type { ApCurriculumFile } from "../../lib/ap-curriculum/types";
import { connect } from "../keywords/db";

const SUBJECT = "ap_calculus_ab";
type It = ItemAttrs & { apSubjectCode: string; stockKey: string; validation: string };
const read = (f: string) => JSON.parse(readFileSync(f, "utf-8")) as It[];
const files = ["data/ap/stock/items.json", "data/ap/stock/s1a-items.json", "data/ap/stock/v1ab-items.json", "data/ap/stock/v45ab-items.json", "data/ap/stock/bc-topup-items.json", "data/ap/stock/graph-s1-items.json", "data/ap/stock/graph-s2a-items.json", "data/ap/stock/graph-s2b-items.json"].filter(existsSync);
const defect = new Set((JSON.parse(readFileSync("data/ap/stock/defect-scan.json", "utf-8")) as { key: string }[]).map((r) => r.key));
const items = files.flatMap(read).filter((i) => i.apSubjectCode === SUBJECT && i.validation === "auto_passed" && !defect.has(i.stockKey)).map((i) => ({ ...i, candidateKey: i.stockKey }));
const cur = JSON.parse(readFileSync(`data/ap/curriculum-2027/${SUBJECT}.json`, "utf-8")) as ApCurriculumFile;
const units = cur.weights.filter((x) => x.axis === "unit" && x.section === "mc").map((x) => ({ code: x.code, min: x.min ?? 0, max: x.max ?? 0 }));
const targets = buildAbTargets(units);
const rows = targets.map((t) => ({ ...t, ...cellStatus(t, items) }));
const tot = (kd: "mc" | "frq_bundle") => ({ autoPassed: items.filter((i) => i.kind === kd).length, families: new Set(items.filter((i) => i.kind === kd).map((i) => i.itemFamilyId)).size });
const meta = { basis: "AB 초기 재고 목표(오너 승인 2026-10-09): 무료 AB 부분 연습(MC Part A 29×3 + Part B 13×1 = 100) + 풀 세트 1개 칸용 FRQ 12 번들(내부 구성 기준 6유형×2; 공식 고정 목록 아님). 수업 용도 목표 없음. 10세트 최종 목표가 아님.", mcTarget: 100, frqTarget: 12, generatedAt: new Date().toISOString() };
writeFileSync("data/ap/stock/stock-targets.json", JSON.stringify({ ...meta, rows: targets }, null, 1));
writeFileSync("data/ap/stock/stock-targets.status.json", JSON.stringify({ ...meta, totals: { mc: tot("mc"), frq_bundle: tot("frq_bundle") }, rows }, null, 1));
for (const kd of ["mc", "frq_bundle"] as const) {
  const r = rows.filter((x) => x.kind === kd); const cellRows = r.filter((x) => x.dimension === "cell" || x.dimension === "frq_type");
  console.log(`[${kd}] 합계 auto_passed ${tot(kd).autoPassed}(문항군 ${tot(kd).families}) — 칸 목표 ${cellRows.reduce((a, x) => a + x.target, 0)} / 칸별 부족 합 ${cellRows.reduce((a, x) => a + x.shortfall, 0)} (칸 ${cellRows.filter((x) => x.shortfall > 0).length}/${cellRows.length} 부족)`);
  for (const x of r.filter((x) => x.shortfall > 0)) console.log(`   - ${x.dimension} ${[x.unit_code && "단원" + x.unit_code, x.skill_category && "스킬" + x.skill_category, x.keyword_code, x.calculator_use, x.representation].filter(Boolean).join("/")}: 목표 ${x.target}, 달성 ${x.achieved} → 부족 ${x.shortfall}`);
}
(async () => {
  if (!process.argv.includes("--load") && !process.argv.includes("--verify")) return;
  const conn = await connect(); if (!conn) throw new Error("DB 환경변수 필요"); const { db, target } = conn;
  const { data: subs } = await db.from("subjects").select("id").eq("ap_subject_code", SUBJECT).limit(1); const sid = subs?.[0]?.id as string; if (!sid) throw new Error("AB 과목 행 없음");
  if (process.argv.includes("--load")) {
    const exec = process.argv.includes("--execute"); console.log(`대상 ${target} / ${exec ? "EXECUTE" : "dry-run"}: ap_stock_cell_targets ${targets.length}행(AB, ced-2027)`);
    if (exec) { if (!/^(local|worpsqwqgnspddnrtnvq\.supabase\.co)$/.test(target)) throw new Error(`허용되지 않은 대상 ${target}`); const { error } = await db.from("ap_stock_cell_targets").insert(targets.map((t: CellTarget) => ({ subject_id: sid, edition: "ced-2027", ...t }))); if (error) throw new Error(error.message); console.log("적재 완료"); }
  }
  if (process.argv.includes("--verify")) {
    const { data, error } = await db.from("ap_stock_cell_shortfall_v").select("*").eq("subject_id", sid); if (error) throw new Error(error.message);
    const key = (x: Record<string, unknown>) => [x.dimension, x.kind, x.unit_code ?? "", x.skill_category ?? "", x.keyword_code ?? "", x.calculator_use ?? "", x.representation ?? ""].join("|");
    const dbm = new Map((data ?? []).map((d) => [key(d), d])); let diff = 0;
    for (const r of rows) { const d = dbm.get(key(r)); if (!d || Number(d.shortfall) !== r.shortfall || Number(d.achieved) !== r.achieved) { diff++; console.error(`  ✗ ${key(r)} 파일 달성 ${r.achieved}/부족 ${r.shortfall} ≠ DB ${d ? `${d.achieved}/${d.shortfall}` : "행 없음"}`); } }
    console.log(diff ? `불일치 ${diff}건` : `일치: 파일 칸별 부족분 = DB ap_stock_cell_shortfall_v (${rows.length}행)`); if (diff) process.exit(1);
  }
})().catch((e) => { console.error(e); process.exit(1); });
