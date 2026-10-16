// 후보 재적재 병합 규칙(순수 함수). 이미 DB 에 있는 행은 검증·변환 필드를 절대 덮어쓰지 않고 상태(검증 판정) 필드만 갱신한다.
// 이유: import 가 render_verified/screen_verified/release_tier 를 stock 파일 값(false/candidate)으로 되돌리면 이미 검증·변환된 후보가 초기화된다.
// 402 트리거는 payload 의 내용(stimulus·stem·options·key_index·key_index_final·parts)이 바뀌면 검증을 푼다 → 검증·변환된 행의 payload 는 내용이 같아도 건드리지 않는다.
export type ExistingRow = { candidate_key: string; payload: Record<string, unknown> | null; review_state: string; render_verified: boolean; screen_verified: boolean; release_tier: string; problem_id: string | null; purpose: string | null; converted_at: string | null; expert_status: string | null };
export type NewRow = Record<string, unknown> & { candidate_key: string; payload: Record<string, unknown>; review_state: string };
export type MergeAction = "insert" | "update" | "preserve_only" | "unchanged";
export type MergeResult = {
  action: MergeAction; patch: Record<string, unknown> | null; row: NewRow | null;
  flags: { verified: boolean; converted: boolean; payloadContentDiffers: boolean; payloadSkipped: boolean; stateUpgrade: boolean; stateConflictKept: boolean };
};
const CONTENT = ["stimulus", "stem", "options", "key_index", "key_index_final", "parts"] as const;
export const contentDiffers = (a: Record<string, unknown> | null | undefined, b: Record<string, unknown> | null | undefined) => CONTENT.some((k) => JSON.stringify(a?.[k] ?? null) !== JSON.stringify(b?.[k] ?? null));
/** 이미 있는 행에서 상태 갱신으로 바꿀 수 있는 필드(검증·변환·게시 필드는 절대 포함하지 않는다). */
const STATE_FIELDS = ["rejection_reason", "gate_version", "used_in_sample", "legacy_reserve", "item_family_id", "duplicate_of", "duplicate_reason", "content_key", "shared_with", "stock_cell", "defect_flags", "defect_scanned_at", "difficulty_provisional", "is_current", "load_batch_id"] as const;
const RANK: Record<string, number> = { rejected: 0, exact_duplicate: 0, needs_revalidation: 1, candidate: 1, auto_passed: 2 };
export function mergeRow(row: NewRow, existing: ExistingRow | null): MergeResult {
  const flags = { verified: false, converted: false, payloadContentDiffers: false, payloadSkipped: false, stateUpgrade: false, stateConflictKept: false };
  if (!existing) return { action: "insert", patch: null, row, flags };
  const converted = Boolean(existing.problem_id || existing.purpose || existing.converted_at); const verified = Boolean(existing.render_verified || existing.screen_verified || existing.release_tier !== "candidate");
  flags.converted = converted; flags.verified = verified || converted;
  const patch: Record<string, unknown> = {};
  // 검증 판정: 변환·검증된 행의 review_state 는 낮추지 않는다(같거나 높은 판정만 허용; 변환된 행은 아예 유지).
  const next = row.review_state; const cur = existing.review_state;
  if (next !== cur) {
    if ((converted || verified) && (RANK[next] ?? 0) <= (RANK[cur] ?? 0)) flags.stateConflictKept = true; // 변환·검증된 행: 같거나 낮은 판정으로 바꾸지 않는다(승격만 허용)
    else { patch.review_state = next; flags.stateUpgrade = (RANK[next] ?? 0) > (RANK[cur] ?? 0); }
  }
  const stateChanged = patch.review_state !== undefined;
  if (converted) { if (stateChanged) { patch.rejection_reason = row.rejection_reason ?? null; patch.gate_version = row.gate_version; } } // 변환된 행은 판정 승격에 딸린 필드만 갱신
  else for (const f of STATE_FIELDS) { if (f in row && (f !== "rejection_reason" && f !== "gate_version" ? true : stateChanged || next === cur)) patch[f] = row[f]; }
  // payload: 내용이 같으면 쓰지 않는다(트리거·검증 보존). 내용이 다르면 검증·변환된 행은 건너뛰고(보고), 미검증 행만 갱신한다.
  flags.payloadContentDiffers = contentDiffers(existing.payload, row.payload);
  if (flags.payloadContentDiffers) { if (verified || converted) flags.payloadSkipped = true; else patch.payload = row.payload; }
  const changed = Object.keys(patch).length > 0;
  return { action: changed ? "update" : (verified || converted ? "preserve_only" : "unchanged"), patch: changed ? patch : null, row: null, flags };
}
export type MergeReport = { total: number; insert: number; update: number; unchanged: number; preserveOnly: number; verifiedPreserved: number; convertedPreserved: number; payloadSkipped: number; stateConflictsKept: number; stateUpgrades: number; upgradesOnVerifiedOrConverted: number };
export function summarizeMerge(rs: MergeResult[]): MergeReport {
  return { total: rs.length, insert: rs.filter((r) => r.action === "insert").length, update: rs.filter((r) => r.action === "update").length, unchanged: rs.filter((r) => r.action === "unchanged").length, preserveOnly: rs.filter((r) => r.action === "preserve_only").length,
    verifiedPreserved: rs.filter((r) => r.flags.verified).length, convertedPreserved: rs.filter((r) => r.flags.converted).length, payloadSkipped: rs.filter((r) => r.flags.payloadSkipped).length, stateConflictsKept: rs.filter((r) => r.flags.stateConflictKept).length,
    stateUpgrades: rs.filter((r) => r.flags.stateUpgrade).length, upgradesOnVerifiedOrConverted: rs.filter((r) => r.flags.stateUpgrade && r.flags.verified).length };
}
