// 후보 적재 계획(순수 함수). scripts/ap-generation/import-candidates.ts 와 관리자 화면이 같은 행 구성·병합 규칙을 쓴다.
// 병합 규칙 자체는 lib/ap-generation/import-merge.ts: 새 키만 insert, 기존 행의 검증·변환·게시 필드는 절대 덮어쓰지 않는다.
import type { StockItem } from "../ap-generation/stock";
import { mergeRow, summarizeMerge, type ExistingRow, type MergeResult, type NewRow } from "../ap-generation/import-merge";

export type DefectScan = Map<string, string[]>;
export function parseDefectScan(raw: { key: string; flags: { code: string }[] }[]): DefectScan {
  return new Map(raw.map((r) => [r.key, [...new Set(r.flags.map((f) => f.code))]]));
}

export function buildCandidateRows(items: StockItem[], o: { subjectIds: Map<string, string>; batchId: string | null; scan: DefectScan; now?: string }) {
  const now = o.now ?? new Date().toISOString();
  return items.map((c) => ({
    candidate_key: c.stockKey, run_id: c.run, subject_id: o.subjectIds.get(c.apSubjectCode), ap_subject_code: c.apSubjectCode, kind: c.kind, keyword_code: c.keywordCode, skill_primary: c.skillPrimary, structure: c.structure,
    response_mode: c.kind === "mc" ? "select" : "explain", scoring_mode: c.kind === "mc" ? "exact" : "partial", difficulty_provisional: c.difficultyProvisional,
    payload: { ...c.payload, cellId: c.cellId, unitCode: c.unitCode, archetype: c.archetype ?? null, legacyReserveFlag: c.legacyReserve }, verification: {}, review: {},
    review_state: c.validation, rejection_reason: c.validation === "rejected" ? c.rejectionReason : null, gate_version: c.gateVersion, expert_status: c.expertStatus, release_tier: c.releaseTier, render_verified: c.renderVerified, screen_verified: c.screenVerified, load_batch_id: o.batchId, is_current: true, defect_flags: o.scan.get(c.stockKey) ?? [], defect_scanned_at: now,
    used_in_sample: c.selectedForSample, legacy_reserve: c.legacyReserve, item_family_id: c.itemFamilyId || null, duplicate_of: c.duplicateOf, duplicate_reason: c.duplicateReason,
    content_key: c.contentKey, shared_with: c.sharedWith, calculator: c.calculator === "required" || c.calculator === "not_allowed" ? c.calculator : "na", stock_cell: c.stockCell,
  }));
}

export const buildHistoryRows = (items: StockItem[]) => items.flatMap((c) => c.history.map((h) => ({ candidate_key: c.stockKey, run_label: h.run, gate_version: h.gateVersion, outcome: h.outcome, reasons: h.reasons })));

export function planImport(rows: ReturnType<typeof buildCandidateRows>, existing: Map<string, ExistingRow>) {
  const results = rows.map((r) => ({ key: r.candidate_key, m: mergeRow(r as unknown as NewRow, existing.get(r.candidate_key) ?? null) }));
  return { results, summary: summarizeMerge(results.map((x) => x.m)) };
}
export type ImportResult = { key: string; m: MergeResult };
export const EXISTING_COLUMNS = "candidate_key, payload, review_state, render_verified, screen_verified, release_tier, problem_id, purpose, converted_at, expert_status";
