// AP 재고 → 비프로덕션 DB 적재(총괄 실행용). 기본 dry-run, --execute 때만 쓴다. 멱등(candidate_key = stockKey upsert).
//   npx tsx scripts/ap-generation/stock.ts                       # 먼저 data/ap/stock/items.json 생성(LLM·DB 없음)
//   npx tsx scripts/ap-generation/import-candidates.ts           # 계획만
//   npx tsx scripts/ap-generation/import-candidates.ts --execute # 적재(마이그레이션 380·381·393 + AP 커리큘럼 시드가 먼저 적용돼 있어야 함)
// 새 행은 load_batch_id 로 현재 배치에 연결하고 is_current=true 로 적재한다. 이전 적재 행의 표식은 mark-batches.ts / ap_mark_load_batches() 로 별도 수행(삭제 없음).
// 상태는 stock.ts 가 계산한 값 그대로: review_state(rejected|needs_revalidation|auto_passed|exact_duplicate), expert_status, used_in_sample, legacy_reserve, 문항군.
// problems/problem_versions 는 건드리지 않는다(학생 비노출). 완전 중복·반려 행도 이력 보존을 위해 적재한다.
import { readFileSync } from "node:fs";
import path from "node:path";
import { connect } from "../keywords/db";
import type { StockItem } from "../../lib/ap-generation/stock";

const execute = process.argv.includes("--execute");
async function main() {
  const items = JSON.parse(readFileSync(path.resolve(process.cwd(), "data/ap/stock/items.json"), "utf-8")) as StockItem[];
  const by = items.reduce<Record<string, number>>((m, c) => ((m[c.validation] = (m[c.validation] ?? 0) + 1), m), {});
  console.log(`재고 행 ${items.length}건`, by);
  const conn = await connect();
  const BATCH = process.argv.includes("--batch") ? process.argv[process.argv.indexOf("--batch") + 1] : "current-stock-2026-10-08";
  let batchId: string | null = null;
  if (!conn) { console.log("DB 환경변수가 없어 파일 요약만 출력합니다."); return; }
  const { db, target } = conn;
  console.log(`대상: ${target} / ${execute ? "EXECUTE" : "dry-run"}`);
  if (execute && !/^(local|worpsqwqgnspddnrtnvq\.supabase\.co)$/.test(target)) throw new Error(`허용되지 않은 대상 ${target}`);
  const { data: subs, error } = await db.from("subjects").select("id, ap_subject_code").not("ap_subject_code", "is", null);
  if (error) throw new Error(error.message);
  const sid = new Map((subs ?? []).map((s) => [s.ap_subject_code as string, s.id as string]));
  const missing = [...new Set(items.map((c) => c.apSubjectCode))].filter((c) => !sid.has(c));
  if (missing.length) throw new Error(`AP 과목 행이 없습니다(커리큘럼 시드 먼저): ${missing.join(", ")}`);
  if (execute) {
    const { error: be } = await db.from("ap_load_batches").upsert({ label: BATCH, note: "current stock load (stock.ts)" }, { onConflict: "label" }); if (be) throw new Error(be.message);
    const { data: b } = await db.from("ap_load_batches").select("id").eq("label", BATCH).single(); batchId = b?.id ?? null;
  }
  const rows = items.map((c) => ({
    candidate_key: c.stockKey, run_id: c.run, subject_id: sid.get(c.apSubjectCode), ap_subject_code: c.apSubjectCode, kind: c.kind, keyword_code: c.keywordCode, skill_primary: c.skillPrimary, structure: c.structure,
    response_mode: c.kind === "mc" ? "select" : "explain", scoring_mode: c.kind === "mc" ? "exact" : "partial", difficulty_provisional: c.difficultyProvisional,
    payload: { ...c.payload, cellId: c.cellId, unitCode: c.unitCode, archetype: c.archetype ?? null, legacyReserveFlag: c.legacyReserve }, verification: {}, review: {},
    review_state: c.validation, rejection_reason: c.validation === "rejected" ? c.rejectionReason : null, gate_version: c.gateVersion, expert_status: c.expertStatus, release_tier: c.releaseTier, render_verified: c.renderVerified, screen_verified: c.screenVerified, load_batch_id: batchId, is_current: true,
    used_in_sample: c.selectedForSample, legacy_reserve: c.legacyReserve, item_family_id: c.itemFamilyId || null, duplicate_of: c.duplicateOf, duplicate_reason: c.duplicateReason,
    content_key: c.contentKey, shared_with: c.sharedWith, calculator: c.calculator === "required" || c.calculator === "not_allowed" ? c.calculator : "na", stock_cell: c.stockCell,
  }));
  const hist = items.flatMap((c) => c.history.map((h) => ({ candidate_key: c.stockKey, run_label: h.run, gate_version: h.gateVersion, outcome: h.outcome, reasons: h.reasons })));
  if (!execute) { console.log(`dry-run: ap_candidate_items upsert ${rows.length}행, ap_candidate_review_history ${hist.length}행`); return; }
  for (let i = 0; i < rows.length; i += 50) { const { error: e } = await db.from("ap_candidate_items").upsert(rows.slice(i, i + 50), { onConflict: "candidate_key" }); if (e) throw new Error(e.message); }
  for (let i = 0; i < hist.length; i += 200) { const { error: e } = await db.from("ap_candidate_review_history").upsert(hist.slice(i, i + 200), { onConflict: "candidate_key,run_label,gate_version" }); if (e) throw new Error(e.message); }
  console.log("적재 완료", rows.length, "행, 이력", hist.length);
}
main().catch((e) => { console.error(e); process.exit(1); });
