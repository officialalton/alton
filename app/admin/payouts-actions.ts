"use server";

import { requireAdmin } from "@/lib/admin-auth";
import type { MissingRatePayoutSkip, PayoutPeriod } from "./payouts-data";

// R10 Task C (2026-09-07) — 레거시 teacher_payouts에 쓰던 이 서버 액션들은
// v3 payout_batches(payout-batches-actions.ts)로 대체됐다. PayoutsTab이 더 이상
// 렌더링되지 않아 UI에서는 도달 불가능하지만, "use server" export는 액션 ID로
// 직접 호출될 수 있으므로 본문 자체를 막아 teacher_payouts에 대한 쓰기 경로를
// 완전히 차단한다. 테이블은 R13 전까지 읽기 전용으로 보존한다(docs/CURRENT.md 참고).
const LEGACY_DISABLED_MESSAGE =
  "레거시 정산 화면은 v3 payout_batches로 대체됐습니다. 이 작업은 더 이상 지원되지 않습니다.";

export async function generatePayouts(
  _period: PayoutPeriod
): Promise<{ created: number; skippedNoRate: MissingRatePayoutSkip[] }> {
  await requireAdmin();
  throw new Error(LEGACY_DISABLED_MESSAGE);
}

export async function markPayoutPaid(_id: string): Promise<void> {
  await requireAdmin();
  throw new Error(LEGACY_DISABLED_MESSAGE);
}

export async function markPayoutsPaidBulk(_ids: string[]): Promise<void> {
  await requireAdmin();
  throw new Error(LEGACY_DISABLED_MESSAGE);
}

export async function revertPayoutToPending(_id: string): Promise<void> {
  await requireAdmin();
  throw new Error(LEGACY_DISABLED_MESSAGE);
}
