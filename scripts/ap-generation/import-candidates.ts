// AP 재고 → 비프로덕션 DB 적재(총괄 실행용). 기본 dry-run, --execute 때만 쓴다. 멱등(candidate_key = stockKey upsert).
//   npx tsx scripts/ap-generation/stock.ts                       # 먼저 data/ap/stock/items.json 생성(LLM·DB 없음)
//   npx tsx scripts/ap-generation/import-candidates.ts           # 계획만
//   npx tsx scripts/ap-generation/import-candidates.ts --execute # 적재(마이그레이션 380·381·393 + AP 커리큘럼 시드가 먼저 적용돼 있어야 함)
// 새 행은 load_batch_id 로 현재 배치에 연결하고 is_current=true 로 적재한다. 이전 적재 행의 표식은 mark-batches.ts / ap_mark_load_batches() 로 별도 수행(삭제 없음).
// 상태는 stock.ts 가 계산한 값 그대로: review_state(rejected|needs_revalidation|auto_passed|exact_duplicate), expert_status, used_in_sample, legacy_reserve, 문항군.
// **재적재 안전**: 이미 DB 에 있는 키는 render_verified·screen_verified·*_evidence·release_tier·problem_id·purpose·converted_*·expert_status 를 절대 덮어쓰지 않고
//   검증 판정 필드만 갱신한다(변환된 행의 review_state 는 유지, 검증된 행은 강등 금지, payload 는 내용이 바뀌고 미검증일 때만). 새 키만 전체 행 insert. 규칙: lib/ap-generation/import-merge.ts.
//   --report: dry-run 에서도 기존 행의 보존/갱신 건수와 목록을 출력(data/ap/stock/import-merge-report.json).
// problems/problem_versions 는 건드리지 않는다(학생 비노출). 완전 중복·반려 행도 이력 보존을 위해 적재한다.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { connect } from "../keywords/db";
import type { StockItem } from "../../lib/ap-generation/stock";
import { mergeRow, summarizeMerge, type ExistingRow, type NewRow } from "../../lib/ap-generation/import-merge";

const execute = process.argv.includes("--execute");
const arg = (n: string, d = "") => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
// 보조 적재(S1a): npx tsx scripts/ap-generation/import-candidates.ts --items data/ap/stock/s1a-items.json --batch s1a-ab-2026-10-09 --supplement [--execute]
//   --supplement: 배치 행은 is_current=false(기본 현재 배치 유지)로 두고, 이 배치의 후보 행은 is_current=true 로 적재해 현재 재고 뷰에 포함한다. 게시·확정 재고 승격이 아니다(관리자 후보 표 한정).
const SUPPLEMENT = process.argv.includes("--supplement");
const scan = existsSync("data/ap/stock/defect-scan.json") ? new Map((JSON.parse(readFileSync("data/ap/stock/defect-scan.json", "utf-8")) as { key: string; flags: { code: string }[] }[]).map((r) => [r.key, [...new Set(r.flags.map((f) => f.code))]])) : new Map<string, string[]>();
async function main() {
  const items = JSON.parse(readFileSync(path.resolve(process.cwd(), arg("--items", "data/ap/stock/items.json")), "utf-8")) as StockItem[];
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
    const { error: be } = await db.from("ap_load_batches").upsert(SUPPLEMENT ? { label: BATCH, is_current: false, note: "supplement batch (S1a code-first AB candidates; loading is not publication)" } : { label: BATCH, note: "current stock load (stock.ts)" }, { onConflict: "label" }); if (be) throw new Error(be.message);
    const { data: b } = await db.from("ap_load_batches").select("id").eq("label", BATCH).single(); batchId = b?.id ?? null;
  }
  const rows = items.map((c) => ({
    candidate_key: c.stockKey, run_id: c.run, subject_id: sid.get(c.apSubjectCode), ap_subject_code: c.apSubjectCode, kind: c.kind, keyword_code: c.keywordCode, skill_primary: c.skillPrimary, structure: c.structure,
    response_mode: c.kind === "mc" ? "select" : "explain", scoring_mode: c.kind === "mc" ? "exact" : "partial", difficulty_provisional: c.difficultyProvisional,
    payload: { ...c.payload, cellId: c.cellId, unitCode: c.unitCode, archetype: c.archetype ?? null, legacyReserveFlag: c.legacyReserve }, verification: {}, review: {},
    review_state: c.validation, rejection_reason: c.validation === "rejected" ? c.rejectionReason : null, gate_version: c.gateVersion, expert_status: c.expertStatus, release_tier: c.releaseTier, render_verified: c.renderVerified, screen_verified: c.screenVerified, load_batch_id: batchId, is_current: true, defect_flags: scan.get(c.stockKey) ?? [], defect_scanned_at: new Date().toISOString(),
    used_in_sample: c.selectedForSample, legacy_reserve: c.legacyReserve, item_family_id: c.itemFamilyId || null, duplicate_of: c.duplicateOf, duplicate_reason: c.duplicateReason,
    content_key: c.contentKey, shared_with: c.sharedWith, calculator: c.calculator === "required" || c.calculator === "not_allowed" ? c.calculator : "na", stock_cell: c.stockCell,
  }));
  const hist = items.flatMap((c) => c.history.map((h) => ({ candidate_key: c.stockKey, run_label: h.run, gate_version: h.gateVersion, outcome: h.outcome, reasons: h.reasons })));
  // 기존 행 조회(병합 규칙에 필요한 열만)
  const existing = new Map<string, ExistingRow>(); const keys = rows.map((r) => r.candidate_key);
  for (let i = 0; i < keys.length; i += 150) { const { data, error: e } = await db.from("ap_candidate_items").select("candidate_key, payload, review_state, render_verified, screen_verified, release_tier, problem_id, purpose, converted_at, expert_status").in("candidate_key", keys.slice(i, i + 150)); if (e) throw new Error(e.message); for (const r of data ?? []) existing.set(r.candidate_key as string, r as ExistingRow); }
  const results = rows.map((r) => ({ key: r.candidate_key, m: mergeRow(r as unknown as NewRow, existing.get(r.candidate_key) ?? null) }));
  const sum = summarizeMerge(results.map((x) => x.m));
  console.log(`병합 계획: 새 키 insert ${sum.insert}, 기존 행 update ${sum.update}, 변경 없음 ${sum.unchanged}, 검증·변환 보존만 ${sum.preserveOnly}`);
  console.log(`  보존: 검증/변환된 기존 행 ${sum.verifiedPreserved}(변환 ${sum.convertedPreserved}), payload 갱신 건너뜀 ${sum.payloadSkipped}, 판정 충돌로 기존 판정 유지 ${sum.stateConflictsKept}, 판정 승격 ${sum.stateUpgrades}(그중 검증·변환 행 ${sum.upgradesOnVerifiedOrConverted})`);
  if (process.argv.includes("--report")) {
    const list = (f: (x: (typeof results)[number]) => boolean) => results.filter(f).map((x) => x.key);
    const rep = { summary: sum, verifiedPreservedKeys: list((x) => x.m.flags.verified), convertedKeys: list((x) => x.m.flags.converted), payloadSkippedKeys: list((x) => x.m.flags.payloadSkipped), stateConflictKeptKeys: list((x) => x.m.flags.stateConflictKept), stateUpgradeKeys: list((x) => x.m.flags.stateUpgrade), upgradeOnVerifiedKeys: list((x) => x.m.flags.stateUpgrade && x.m.flags.verified) };
    writeFileSync("data/ap/stock/import-merge-report.json", JSON.stringify(rep, null, 1)); console.log("보고서: data/ap/stock/import-merge-report.json");
  }
  if (!execute) { console.log(`dry-run: 이력 ${hist.length}행, 실제 쓰기 없음(--execute 로 위 계획 적용)`); return; }
  const inserts = results.filter((x) => x.m.action === "insert").map((x) => x.m.row!);
  for (let i = 0; i < inserts.length; i += 50) { const { error: e } = await db.from("ap_candidate_items").insert(inserts.slice(i, i + 50)); if (e) throw new Error(e.message); }
  const updates = results.filter((x) => x.m.action === "update");
  for (let i = 0; i < updates.length; i += 20) await Promise.all(updates.slice(i, i + 20).map(async (x) => { const { error: e } = await db.from("ap_candidate_items").update(x.m.patch!).eq("candidate_key", x.key); if (e) throw new Error(`${x.key}: ${e.message}`); }));
  for (let i = 0; i < hist.length; i += 200) { const { error: e } = await db.from("ap_candidate_review_history").upsert(hist.slice(i, i + 200), { onConflict: "candidate_key,run_label,gate_version" }); if (e) throw new Error(e.message); }
  console.log(`적재 완료: insert ${inserts.length}, update ${updates.length}, 이력 ${hist.length}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
