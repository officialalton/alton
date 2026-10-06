// P4-2 — 자동 송금 실행 오케스트레이션.
//
// 확정 정책: 송금 승인된 묶음은 지정된 **지급 예정일**에 자동 송금 대상이 된다.
// 2026-10-06 오너 확정: 지급 기한은 입금 완료 기준이라 대상은 **송금 요청일(기한 − N영업일) <= 오늘(LA)** 이다(SQL list_due_auto_dispatch_batches).
// (이전 설명) 대상은 **지급 예정일(승인 시 확정된 10일·26일 보정일, 관리자가 바꾼 날짜 포함) <= 오늘(회사 시간대 LA 날짜)**인 묶음이다. 크론은 매일 돌고 날짜 게이트가 없어 하루 빠져도 다음 실행이 따라잡는다.
//
// **게이트가 닫혀 있으면 아무것도 하지 않는다.** real_disbursement_enabled()가
// false면 상태를 바꾸지도, dispatch_idempotency_key를 만들지도 않는다 —
// 키를 만드는 순간 "송금을 요청했다"는 흔적이 남기 때문이다. 건너뛴 사실만
// payout_auto_dispatch_runs에 남긴다.
//
// 중복 실행·재시도 안전성은 기존 dispatch_payout_batch()가 담당한다:
// 배치당 dispatch_idempotency_key를 1회만 만들고, 이미 있으면 같은 키를 그대로
// 돌려준다(제공자에 Idempotency-Key로 전달할 값 — 이중 송금 방지).

import { createAdminClient } from "@/lib/supabase-admin";
import { companyDateOf } from "./payout-schedule";

// 2026-09-12(제품 오너 확정) — **교사 정산의 송금 제공자는 Wise 하나뿐이다.**
// Mercury는 법인 수취 계좌·운영비·법인카드·자금 관리용이며 교사 정산의 자동 송금·
// 수동 송금·대사·웹훅 경로에 들어가지 않는다. 그래서 provider는 상수이고, 앱 어디에도
// 제공자를 고르는 입력이 없다(고를 수 있게 두면 언젠가 Mercury가 섞인다).
export const TEACHER_PAYOUT_PROVIDER = "wise" as const;

export type AutoDispatchResult = {
  dueOn: string;
  eligibleCount: number;
  dispatchedCount: number;
  skippedGateClosedCount: number;
  skippedGlobalOff: boolean;
};

export async function runAutoPayoutDispatch(now: Date = new Date()): Promise<AutoDispatchResult> {
  const admin = createAdminClient();
  const dueOn = companyDateOf(now) ?? now.toISOString().slice(0, 10);

  const { data: settings, error: settingsError } = await admin
    .from("payout_auto_dispatch_settings")
    .select("enabled")
    .eq("id", true)
    .maybeSingle();
  if (settingsError) throw new Error(settingsError.message);
  const globalEnabled = Boolean(settings?.enabled);

  // 전역 스위치가 꺼져 있으면 대상 조회조차 하지 않는다(list_due_...도 같은 조건을
  // 보지만, 왜 아무것도 안 했는지를 실행 기록에 분명히 남기기 위해 여기서 갈라낸다).
  if (!globalEnabled) {
    const result: AutoDispatchResult = {
      dueOn,
      eligibleCount: 0,
      dispatchedCount: 0,
      skippedGateClosedCount: 0,
      skippedGlobalOff: true,
    };
    await recordRun(admin, result);
    return result;
  }

  const { data: due, error: dueError } = await admin.rpc("list_due_auto_dispatch_batches", { p_on: dueOn });
  if (dueError) throw new Error(dueError.message);
  const batches = (due ?? []) as Record<string, unknown>[];

  const { data: gateEnabled, error: gateError } = await admin.rpc("real_disbursement_enabled");
  if (gateError) throw new Error(gateError.message);

  const result: AutoDispatchResult = {
    dueOn,
    eligibleCount: batches.length,
    dispatchedCount: 0,
    skippedGateClosedCount: 0,
    skippedGlobalOff: false,
  };

  if (!gateEnabled) {
    // 법인 설립 전 지급 경계가 닫혀 있다 — 상태를 건드리지 않고 건너뛴 수만 센다.
    result.skippedGateClosedCount = batches.length;
    await recordRun(admin, result);
    return result;
  }

  // 한 묶음의 실패가 나머지 묶음을 막지 않게 하고, 실패는 실행 기록에 남긴 뒤 마지막에 던진다
  // (다음 실행이 같은 묶음을 다시 시도한다 — dispatch는 key 1회 발급이라 재시도가 안전하다).
  const failures: string[] = [];
  for (const batch of batches) {
    const { error } = await admin.rpc("dispatch_payout_batch", {
      p_batch_id: batch.batch_id as string,
      p_provider: TEACHER_PAYOUT_PROVIDER,
      p_requested_by: null,
    });
    if (error) {
      failures.push(`${batch.batch_id as string}: ${error.message}`);
      continue;
    }
    result.dispatchedCount += 1;
  }

  await recordRun(admin, result, failures.length ? failures.join("; ") : undefined);
  if (failures.length) throw new Error(failures.join("; "));
  return result;
}

async function recordRun(
  admin: ReturnType<typeof createAdminClient>,
  result: AutoDispatchResult,
  error?: string
): Promise<void> {
  await admin.from("payout_auto_dispatch_runs").insert({
    due_on: result.dueOn,
    eligible_count: result.eligibleCount,
    dispatched_count: result.dispatchedCount,
    skipped_gate_closed_count: result.skippedGateClosedCount,
    skipped_global_off: result.skippedGlobalOff,
    error: error ?? null,
  });
}
