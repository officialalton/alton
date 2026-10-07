"use server";

// Mercury 지급 통합(2026-10-07) — 관리자 "Mercury payouts" 패널의 서버 액션. 화면 문구는 영어(이 영역 한정).
// 모든 변경은 DB 함수(payout_attempt_* / approve_payout_attempt 등)를 거치며 권한은 앱과 DB 양쪽에서 확인한다.
// MERCURY_PAYOUTS_ENABLED 와 real_disbursement_enabled() 가 둘 다 열려 있지 않으면 외부 호출은 일어나지 않는다.
import { requirePayoutCapability, type PayoutCapability } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { requestAttemptPayout, type RequestOutcome } from "@/lib/payout/attempts";
import { createMercuryProvider, mercuryConfigFromEnv } from "@/lib/payout/providers/mercury";
import { createSupabaseAttemptStore } from "@/lib/payout/supabase-attempt-store";
import type { AttemptStatus } from "@/lib/payout/attempt-state";

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };

const ERROR_EN: Array<[RegExp, string]> = [
  [/직무 분리/, "Dual control is on: the settlement approver or attempt creator cannot approve this payout."],
  [/real_disbursement_enabled|지급 경계/, "The disbursement gate is closed, so this real-world step is blocked."],
  [/승인되지 않았|재승인/, "This attempt is not approved (or its approval was invalidated). Approve it again first."],
  [/금액이 시도 생성 이후 바뀌었습니다/, "The settlement amount changed after this attempt was created. Create a new attempt."],
  [/재검증/, "The recipient's bank details changed and must be re-verified before approval."],
  [/verified\)되지 않았/, "The Mercury recipient is not verified yet."],
  [/권한이 없습니다/, "You do not have permission for this action."],
  [/거래 ID/, "A transaction ID is required or already linked to another record."],
  [/이미 진행 중인 재송금/, "A resend is already in progress for this attempt."],
  [/승인된\(approved\) 정산만|확정된\(confirmed\)/, "Only an approved settlement can have a payout attempt."],
];
function toEnglish(message: string): string {
  for (const [re, en] of ERROR_EN) if (re.test(message)) return en;
  return /[가-힣]/.test(message) ? "The action could not be completed (see audit log)." : message;
}
async function run<T>(capability: PayoutCapability, fn: (ctx: { actor: string; admin: ReturnType<typeof createAdminClient> }) => Promise<{ data?: T; message?: string } | void>): Promise<ActionResult<T>> {
  try {
    const { actorUserId } = await requirePayoutCapability(capability);
    const out = (await fn({ actor: actorUserId, admin: createAdminClient() })) ?? {};
    return { ok: true, ...out };
  } catch (e) {
    return { ok: false, error: toEnglish(e instanceof Error ? e.message : String(e)) };
  }
}
async function rpc(admin: ReturnType<typeof createAdminClient>, name: string, args: Record<string, unknown>) {
  const { data, error } = await admin.rpc(name, args);
  if (error) throw new Error(error.message);
  return data;
}

export type MercuryPayoutRow = {
  attemptId: string;
  settlementId: string;
  recipientId: string;
  recipientName: string;
  recipientKind: "teacher" | "consultant";
  periodStart: string;
  periodEnd: string;
  paymentDeadline: string;
  scheduledTransferDate: string;
  provider: "wise" | "mercury" | "manual";
  rail: string;
  kind: "normal" | "resend" | "top_up";
  attemptNo: number;
  status: AttemptStatus;
  manualExecution: boolean;
  requestedAmountMinor: number;
  requestedCurrency: "USD" | "KRW";
  contractualAmountMinor: number;
  contractualCurrency: "USD" | "KRW";
  bankName: string | null;
  accountLast4: string | null;
  recipientLinkStatus: string | null;
  approvedAt: string | null;
  approvalInvalidated: boolean;
  sentAt: string | null;
  receivedConfirmedAt: string | null;
  actualUsdPrincipalMinor: number | null;
  actualUsdFeeMinor: number | null;
  actualUsdTotalDebitMinor: number | null;
  providerTransactionId: string | null;
  trackingUrl: string | null;
  receiptUrl: string | null;
  reasons: string[];
  reconciliationFlag: string;
  failureReason: string | null;
  returnReason: string | null;
};

export type MercuryPayoutFilter = { currency?: "USD" | "KRW"; status?: AttemptStatus | "all"; problemsOnly?: boolean };

export async function listMercuryPayoutsAction(filter: MercuryPayoutFilter = {}): Promise<ActionResult<{ rows: MercuryPayoutRow[]; gateOpen: boolean; mercuryEnabled: boolean }>> {
  return run("view", async ({ admin }) => {
    let q = admin.from("payout_reconciliation_rows").select("*").order("payment_deadline", { ascending: true }).limit(300);
    if (filter.currency) q = q.eq("requested_currency", filter.currency);
    if (filter.status && filter.status !== "all") q = q.eq("status", filter.status);
    const { data: recon, error } = await q;
    if (error) throw new Error(error.message);
    const reconRows = (recon ?? []) as Array<Record<string, unknown>>;
    const ids = reconRows.map((r) => r.attempt_id as string);
    const people = [...new Set(reconRows.map((r) => r.recipient_profile_id as string))];
    const [{ data: attempts }, { data: profiles }, { data: tAcc }, { data: cAcc }, { data: links }] = await Promise.all([
      ids.length ? admin.from("payout_attempts").select("id, manual_execution, approved_at, approval_invalidated_at, tracking_url, receipt_url, failure_reason, return_reason, recipient_link_id").in("id", ids) : { data: [] },
      people.length ? admin.from("profiles").select("id, name").in("id", people) : { data: [] },
      people.length ? admin.from("teacher_payout_accounts").select("teacher_id, bank_name, account_number_last4").in("teacher_id", people) : { data: [] },
      people.length ? admin.from("consultant_payout_accounts").select("consultant_id, bank_name, account_number_last4").in("consultant_id", people) : { data: [] },
      people.length ? admin.from("payout_recipient_links").select("profile_id, status").in("profile_id", people) : { data: [] },
    ]);
    const aMap = new Map((attempts ?? []).map((a) => [a.id as string, a]));
    const nameMap = new Map((profiles ?? []).map((p) => [p.id as string, (p.name as string) ?? ""]));
    const acc = new Map<string, { bank_name: string; last4: string }>();
    for (const a of tAcc ?? []) acc.set(a.teacher_id as string, { bank_name: a.bank_name as string, last4: a.account_number_last4 as string });
    for (const a of cAcc ?? []) acc.set(a.consultant_id as string, { bank_name: a.bank_name as string, last4: a.account_number_last4 as string });
    const linkMap = new Map((links ?? []).map((l) => [l.profile_id as string, l.status as string]));
    const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
    let rows: MercuryPayoutRow[] = reconRows.map((r) => {
      const a = aMap.get(r.attempt_id as string) as Record<string, unknown> | undefined;
      const info = acc.get(r.recipient_profile_id as string);
      return {
        attemptId: r.attempt_id as string,
        settlementId: r.settlement_id as string,
        recipientId: r.recipient_profile_id as string,
        recipientName: nameMap.get(r.recipient_profile_id as string) ?? "",
        recipientKind: r.recipient_kind as "teacher" | "consultant",
        periodStart: r.period_start as string,
        periodEnd: r.period_end as string,
        paymentDeadline: r.payment_deadline as string,
        scheduledTransferDate: r.scheduled_transfer_date as string,
        provider: r.provider as MercuryPayoutRow["provider"],
        rail: r.rail as string,
        kind: r.kind as MercuryPayoutRow["kind"],
        attemptNo: Number(r.attempt_no),
        status: r.status as AttemptStatus,
        manualExecution: Boolean(a?.manual_execution),
        requestedAmountMinor: Number(r.requested_amount_minor),
        requestedCurrency: r.requested_currency as "USD" | "KRW",
        contractualAmountMinor: Number(r.contractual_amount_minor),
        contractualCurrency: r.contractual_currency as "USD" | "KRW",
        bankName: info?.bank_name ?? null,
        accountLast4: info?.last4 ?? null,
        recipientLinkStatus: linkMap.get(r.recipient_profile_id as string) ?? null,
        approvedAt: (a?.approved_at as string | null) ?? null,
        approvalInvalidated: Boolean(a?.approval_invalidated_at),
        sentAt: (r.sent_at as string | null) ?? null,
        receivedConfirmedAt: (r.received_confirmed_at as string | null) ?? null,
        actualUsdPrincipalMinor: num(r.actual_usd_principal_minor),
        actualUsdFeeMinor: num(r.actual_usd_fee_minor),
        actualUsdTotalDebitMinor: num(r.actual_usd_total_debit_minor),
        providerTransactionId: (r.provider_transaction_id as string | null) ?? null,
        trackingUrl: (a?.tracking_url as string | null) ?? null,
        receiptUrl: (a?.receipt_url as string | null) ?? null,
        reasons: (r.needs_review_reasons as string[]) ?? [],
        reconciliationFlag: r.reconciliation_flag as string,
        failureReason: (a?.failure_reason as string | null) ?? null,
        returnReason: (a?.return_reason as string | null) ?? null,
      };
    });
    if (filter.problemsOnly) rows = rows.filter((r) => !["ok", "pending"].includes(r.reconciliationFlag) || r.reasons.length > 0);
    const gateOpen = Boolean(await rpc(admin, "real_disbursement_enabled", {}));
    return { data: { rows, gateOpen, mercuryEnabled: mercuryConfigFromEnv().enabled } };
  });
}

export async function createPayoutAttemptAction(input: { batchId?: string; consultantPeriodId?: string; provider?: "mercury" | "manual" }): Promise<ActionResult<{ attemptId: string }>> {
  return run("payout_request_mercury", async ({ admin, actor }) => {
    const id = await rpc(admin, "create_payout_attempt", {
      p_batch_id: input.batchId ?? null,
      p_consultant_period_id: input.consultantPeriodId ?? null,
      p_kind: "normal",
      p_original_attempt_id: null,
      p_actor: actor,
      p_provider: input.provider ?? "mercury",
      p_top_up_amount_minor: null,
    });
    return { data: { attemptId: id as string }, message: "Payout attempt created." };
  });
}

export async function createResendAttemptAction(input: { originalAttemptId: string; kind: "resend" | "top_up"; topUpAmountMinor?: number }): Promise<ActionResult<{ attemptId: string }>> {
  return run("payout_request_mercury", async ({ admin, actor }) => {
    const { data: orig, error } = await admin.from("payout_attempts").select("settlement_batch_id, settlement_consultant_period_id, provider").eq("id", input.originalAttemptId).single();
    if (error) throw new Error(error.message);
    const id = await rpc(admin, "create_payout_attempt", {
      p_batch_id: orig.settlement_batch_id,
      p_consultant_period_id: orig.settlement_consultant_period_id,
      p_kind: input.kind,
      p_original_attempt_id: input.originalAttemptId,
      p_actor: actor,
      p_provider: orig.provider,
      p_top_up_amount_minor: input.topUpAmountMinor ?? null,
    });
    return { data: { attemptId: id as string }, message: input.kind === "resend" ? "Resend attempt created; it needs its own approval." : "Top-up attempt created; it needs its own approval." };
  });
}

export async function approvePayoutAttemptAction(attemptId: string): Promise<ActionResult> {
  return run("payout_approve_mercury", async ({ admin, actor }) => {
    await rpc(admin, "approve_payout_attempt", { p_attempt: attemptId, p_actor: actor });
    return { message: "Payout approved." };
  });
}

const OUTCOME_MESSAGE: Record<RequestOutcome["kind"], string> = {
  requested: "Payout request sent to Mercury; approve it in the Mercury dashboard.",
  recovered_existing: "An earlier request was found at Mercury and linked; no new request was made.",
  already_requested: "A request already exists for this attempt; nothing was sent.",
  uncertain: "Mercury did not confirm the request. Do not resend; use Retry to look it up first.",
  manual_required: "This attempt is executed manually in the Mercury dashboard. Download the input list, create the wire there, then link the transaction ID.",
  blocked: "Blocked: a safety switch is closed. No request was sent.",
};
export async function requestPayoutAttemptAction(attemptId: string): Promise<ActionResult<{ outcome: RequestOutcome["kind"] }>> {
  return run("payout_request_mercury", async ({ admin, actor }) => {
    const provider = createMercuryProvider(mercuryConfigFromEnv());
    const outcome = await requestAttemptPayout(createSupabaseAttemptStore(admin), provider, attemptId, actor);
    const reason = "reason" in outcome ? ` ${outcome.reason}.` : "";
    return { data: { outcome: outcome.kind }, message: OUTCOME_MESSAGE[outcome.kind] + (outcome.kind === "blocked" || outcome.kind === "manual_required" ? reason : "") };
  });
}

export async function linkTransactionAction(input: { attemptId: string; transactionId: string; trackingUrl?: string; receiptUrl?: string }): Promise<ActionResult> {
  return run("payout_request_mercury", async ({ admin, actor }) => {
    await rpc(admin, "link_payout_attempt_transaction", {
      p_attempt: input.attemptId,
      p_transaction_id: input.transactionId.trim(),
      p_actor: actor,
      p_tracking_url: input.trackingUrl?.trim() || null,
      p_receipt_url: input.receiptUrl?.trim() || null,
    });
    return { message: "Mercury transaction linked." };
  });
}

/** 수동(KRW) 경로: 거래 ID가 연결된 뒤 관리자가 송금 처리를 기록한다. 게이트가 닫혀 있으면 DB가 거부한다. */
export async function markManualAttemptSentAction(attemptId: string): Promise<ActionResult> {
  return run("payout_request_mercury", async ({ admin, actor }) => {
    const store = createSupabaseAttemptStore(admin);
    const a = await store.getAttempt(attemptId);
    if (!a) throw new Error("Attempt not found");
    if (a.status === "queued") await store.transition(attemptId, "awaiting_mercury_approval", actor);
    if (a.status === "queued" || a.status === "awaiting_mercury_approval") await store.transition(attemptId, "processing", actor);
    await store.transition(attemptId, "sent", actor);
    return { message: "Marked as sent. A sent Mercury transaction counts as paid; record a return only if it comes back." };
  });
}

export async function recordActualsAction(input: { attemptId: string; usdPrincipal: number; usdFee: number; quotedRate?: number; finalRate?: number }): Promise<ActionResult> {
  return run("payout_request_mercury", async ({ admin, actor }) => {
    const cents = (v: number) => Math.round(v * 100);
    await rpc(admin, "record_payout_attempt_actuals", {
      p_attempt: input.attemptId,
      p_usd_principal: cents(input.usdPrincipal),
      p_usd_fee: cents(input.usdFee),
      p_quoted_rate: input.quotedRate ?? null,
      p_final_rate: input.finalRate ?? null,
      p_fx_locked_at: null,
      p_actor: actor,
    });
    return { message: "Actual USD amounts recorded." };
  });
}

export async function recordReturnAction(input: { attemptId: string; returnTransactionId: string; returnedUsd: number; reason: string }): Promise<ActionResult> {
  return run("payout_approve_mercury", async ({ admin, actor }) => {
    await rpc(admin, "record_payout_attempt_return", {
      p_attempt: input.attemptId,
      p_actor: actor,
      p_return_transaction_id: input.returnTransactionId.trim(),
      p_returned_usd_minor: Math.round(input.returnedUsd * 100),
      p_reason: input.reason,
    });
    return { message: "Return recorded as a separate transaction." };
  });
}

export async function failOrCancelAttemptAction(input: { attemptId: string; to: "failed" | "cancelled"; reason: string }): Promise<ActionResult> {
  return run("payout_request_mercury", async ({ admin, actor }) => {
    await rpc(admin, "payout_attempt_transition", { p_attempt: input.attemptId, p_to: input.to, p_actor: actor, p_reason: input.reason });
    return { message: input.to === "failed" ? "Recorded as failed." : "Attempt cancelled." };
  });
}

/** 직무 분리(정산 승인자 ≠ 지급 승인자) 설정. 기본 꺼짐. 마스터 관리자만 바꾼다. */
export async function setPayoutDualControlAction(required: boolean): Promise<ActionResult> {
  return run("view", async ({ admin, actor }) => {
    await rpc(admin, "set_payout_dual_control", { p_required: required, p_actor: actor });
    return { message: required ? "Dual control turned on." : "Dual control turned off." };
  });
}
