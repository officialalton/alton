// AttemptStore/EventStore의 Supabase(service role) 구현. 모든 상태 변경은 DB 함수를 거친다(직접 UPDATE 없음).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AttemptRow, AttemptStore } from "./attempts";
import type { EventStore } from "./mercury-events";
import type { AttemptStatus } from "./attempt-state";

export function createSupabaseAttemptStore(admin: SupabaseClient): AttemptStore & EventStore {
  async function rpc(name: string, args: Record<string, unknown>) {
    const { data, error } = await admin.rpc(name, args);
    if (error) throw new Error(error.message);
    return data;
  }
  async function find(column: "provider_transaction_id" | "payout_request_id", value: string) {
    const { data, error } = await admin
      .from("payout_attempts")
      .select("id, status, requested_currency")
      .eq(column, value)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? { id: data.id as string, status: data.status as AttemptStatus, requested_currency: data.requested_currency as "USD" | "KRW" } : null;
  }
  return {
    async getAttempt(id): Promise<AttemptRow | null> {
      const { data, error } = await admin
        .from("payout_attempts")
        .select("id, status, provider, manual_execution, requested_amount_minor, requested_currency, idempotency_key, payout_request_id, provider_transaction_id, request_uncertain, recipient_link_id")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      let recipientProviderId: string | null = null;
      if (data.recipient_link_id) {
        const { data: link } = await admin.from("payout_recipient_links").select("provider_recipient_id").eq("id", data.recipient_link_id).maybeSingle();
        recipientProviderId = (link?.provider_recipient_id as string | null) ?? null;
      }
      return {
        id: data.id,
        status: data.status,
        provider: data.provider,
        manual_execution: data.manual_execution,
        requested_amount_minor: Number(data.requested_amount_minor),
        requested_currency: data.requested_currency,
        idempotency_key: data.idempotency_key,
        payout_request_id: data.payout_request_id,
        provider_transaction_id: data.provider_transaction_id,
        request_uncertain: data.request_uncertain,
        recipient_provider_id: recipientProviderId,
      } as AttemptRow;
    },
    async isGateOpen() {
      return Boolean(await rpc("real_disbursement_enabled", {}));
    },
    async transition(id, to, actor, reason) {
      await rpc("payout_attempt_transition", { p_attempt: id, p_to: to, p_actor: actor, p_reason: reason ?? null });
    },
    async recordRequest(id, requestId, actor, uncertain) {
      await rpc("record_payout_attempt_request", { p_attempt: id, p_request_id: requestId, p_actor: actor, p_uncertain: uncertain });
    },
    findByTransactionId: (txId) => find("provider_transaction_id", txId),
    findByRequestId: (requestId) => find("payout_request_id", requestId),
    async applyTransition(attemptId, to, reason) {
      await rpc("payout_attempt_transition", { p_attempt: attemptId, p_to: to, p_actor: null, p_reason: reason ?? null });
    },
    async linkTransaction(attemptId, txId) {
      await rpc("link_payout_attempt_transaction", { p_attempt: attemptId, p_transaction_id: txId, p_actor: null });
    },
    async recordActuals(attemptId, principal, fee, finalRate) {
      await rpc("record_payout_attempt_actuals", { p_attempt: attemptId, p_usd_principal: principal, p_usd_fee: fee, p_final_rate: finalRate, p_actor: null });
    },
    async recordReturn(attemptId, returnTxId, returnedUsd, reason) {
      await rpc("record_payout_attempt_return", { p_attempt: attemptId, p_actor: null, p_return_transaction_id: returnTxId, p_returned_usd_minor: returnedUsd, p_reason: reason });
    },
  };
}
