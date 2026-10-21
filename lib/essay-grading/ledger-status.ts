import type { createAdminClient } from "@/lib/supabase-admin";

type Admin = ReturnType<typeof createAdminClient>;

/** essay_ai_ledger_status() 의 결과(마이그레이션 20262100000650). ledgerPresent=false 면 원장 미적용 — 월 예산은 소프트 한도로만 동작한다. */
export type LedgerStatus =
  | { ledgerPresent: false; reason: "migration_not_applied" | "error"; detail?: string }
  | { ledgerPresent: true; monthUtc: string; monthSpendUsd: number; unsettledCount: number; unsettledUsd: number; oldestUnsettledAt: string | null; expiredUnstartedReservations: number; rowLedgerMismatchRows: number; rowsCostTotalUsd: number; ledgerTotalUsd: number; needsAttention: boolean; attention: string[] };

/**
 * 원장 헬스. 서버(service_role)에서 호출한다 — 런북·점검 스크립트·관리자 API 가 쓴다.
 * 이 함수는 "원장 기반 예산이 전체 서비스 지출을 통제한다"를 뜻하지 않는다: 구형 코드가 만든 비용은 원장에 없고(mismatch/대조 쿼리로 확인), 원장은 이 앱 코드가 호출한 AI 채점 비용만 본다. 월 경계는 UTC(교사 정산의 America/Los_Angeles 와 다르다).
 */
export async function getEssayLedgerStatus(admin: Admin, now: Date = new Date()): Promise<LedgerStatus> {
  const { data, error } = await admin.rpc("essay_ai_ledger_status", { p_now: now.toISOString() });
  if (error) {
    const missing = error.code === "PGRST202" || error.code === "42883";
    if (missing) console.warn("[essay-ledger] WARNING: essay_ai_ledger_status 없음 — 원장 마이그레이션(20262100000650/660) 미적용. 폴백 소프트 한도로 운영 중.");
    return { ledgerPresent: false, reason: missing ? "migration_not_applied" : "error", detail: missing ? undefined : error.message };
  }
  const d = (data ?? {}) as Record<string, unknown>;
  const n = (k: string) => Number(d[k] ?? 0);
  const attention: string[] = [];
  if (n("unsettled_count") > 0) attention.push(`호출이 시작됐지만 정산되지 않은 예약 ${n("unsettled_count")}건(예약 최악액 $${n("unsettled_usd")} 월 합계에 포함 중) — 청구액 확인 후 정산`);
  if (n("row_ledger_mismatch_rows") > 0) attention.push(`응답 행 누적 비용과 원장 합이 다른 행 ${n("row_ledger_mismatch_rows")}건 — 구형 코드 쓰기 또는 중복 정산 의심`);
  return {
    ledgerPresent: true, monthUtc: String(d.month_utc ?? ""), monthSpendUsd: n("month_spend_usd"), unsettledCount: n("unsettled_count"), unsettledUsd: n("unsettled_usd"),
    oldestUnsettledAt: (d.oldest_unsettled_at as string | null) ?? null, expiredUnstartedReservations: n("expired_unstarted_reservations"), rowLedgerMismatchRows: n("row_ledger_mismatch_rows"),
    rowsCostTotalUsd: n("rows_cost_total_usd"), ledgerTotalUsd: n("ledger_settled_legacy_total_usd"), needsAttention: attention.length > 0, attention,
  };
}
