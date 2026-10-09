// Mercury 웹훅 이벤트 처리(2026-10-08). 상태·반환 인지 전용: 지급 생성·승인·요청을 하지 않는다.
// 기존 시도 상태 기계에서 허용된 전이만 기록하고, 맞지 않으면 관리자 검토 플래그만 남긴다.
import { createHash } from "node:crypto";
import type { AttemptStatus } from "./attempt-state";
import { canTransition } from "./attempt-state";
import { mapMercuryTransaction } from "./providers/mercury";
import type { EventStore } from "./mercury-events";

export type WebhookOutcome = "duplicate" | "ignored_type" | "ignored_no_status" | "ignored_unknown" | "noop" | "applied" | "flagged_mismatch" | "invalid_payload";

export type WebhookStore = EventStore & {
  /** event_id 신규면 true, 이미 있으면 false. */
  insertEvent(e: { eventId: string; resourceType: string | null; operationType: string | null; resourceId: string | null; payloadSha256: string }): Promise<boolean>;
  finishEvent(eventId: string, outcome: WebhookOutcome, attemptId: string | null): Promise<void>;
  /** 처리 중 예외 시 이벤트 행을 지워 Mercury 재배달이 다시 처리되게 한다. */
  discardEvent(eventId: string): Promise<void>;
  addFlag(attemptId: string, flag: string): Promise<void>;
};

export const WEBHOOK_MISMATCH_FLAG = "mercury_webhook_status_mismatch";

export async function handleMercuryWebhook(store: WebhookStore, rawBody: string): Promise<WebhookOutcome> {
  let ev: Record<string, unknown>;
  try {
    ev = JSON.parse(rawBody);
  } catch {
    return "invalid_payload";
  }
  const eventId = typeof ev?.id === "string" ? ev.id : "";
  if (!eventId) return "invalid_payload";
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  const resourceType = str(ev.resourceType), operationType = str(ev.operationType), resourceId = str(ev.resourceId);
  const fresh = await store.insertEvent({ eventId, resourceType, operationType, resourceId, payloadSha256: createHash("sha256").update(rawBody).digest("hex") });
  if (!fresh) return "duplicate";

  let attemptId: string | null = null;
  const done = async (o: WebhookOutcome) => { await store.finishEvent(eventId, o, attemptId); return o; };
  try {
    if (resourceType !== "transaction" || !resourceId) return await done("ignored_type");
    const patch = (ev.mergePatch && typeof ev.mergePatch === "object" ? ev.mergePatch : {}) as Record<string, unknown>;
    const tx = mapMercuryTransaction({ ...patch, id: resourceId });
    if (!tx) return await done("ignored_unknown");
    const attempt = (await store.findByTransactionId(resourceId)) ?? (tx.requestId ? await store.findByRequestId(tx.requestId) : null);
    if (!attempt) return await done("ignored_unknown");
    attemptId = attempt.id;
    await store.linkTransaction(attempt.id, resourceId);
    if (store.recordDetails && (tx.dashboardUrl || tx.estimatedDeliveryDate || tx.failedAt)) {
      await store.recordDetails(attempt.id, { dashboardUrl: tx.dashboardUrl ?? null, estimatedDeliveryDate: tx.estimatedDeliveryDate ?? null, failedAt: tx.failedAt ?? null });
    }
    if (typeof patch.status !== "string") return await done("ignored_no_status");

    const cur: AttemptStatus = attempt.status;
    const mismatch = async () => { await store.addFlag(attempt.id, WEBHOOK_MISMATCH_FLAG); return done("flagged_mismatch"); };
    if (tx.status === "reversed") {
      if (cur === "returned") return await done("noop");
      if (cur !== "sent" && cur !== "receipt_confirmed") return await mismatch();
      await store.recordReturn(attempt.id, resourceId, tx.amountMinorUsd ?? null, "Reversed by Mercury");
      return await done("applied");
    }
    const target: AttemptStatus = tx.status === "pending" ? "processing" : tx.status === "sent" ? "sent" : "failed";
    if (cur === target) return await done("noop");
    if (target === "processing") return cur === "sent" || cur === "receipt_confirmed" || cur === "returned" ? await done("noop") : cur === "awaiting_mercury_approval" ? (await store.applyTransition(attempt.id, "processing"), await done("applied")) : await mismatch();
    if (cur === "awaiting_mercury_approval" && target === "sent") {
      await store.applyTransition(attempt.id, "processing");
      await store.applyTransition(attempt.id, "sent");
      return await done("applied");
    }
    if (cur === "needs_review" || !canTransition(cur, target)) return await mismatch();
    await store.applyTransition(attempt.id, target, tx.failureReason ?? undefined);
    return await done("applied");
  } catch (e) {
    await store.discardEvent(eventId).catch(() => {});
    throw e;
  }
}
