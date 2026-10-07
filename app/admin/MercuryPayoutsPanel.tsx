"use client";

// Mercury 지급 패널(2026-10-07) — 관리자 정산 > "Mercury payouts". 이 영역의 화면 문구는 영어(오너 지시).
// 표시: 통화 필터, 기간·기한·송금 예정일, 수취인별 금액, 은행정보 등록 상태, 승인/송금/수취 상태, 실제 USD 출금·수수료,
// Mercury 거래·추적·영수증, 실패·반환·대사 불일치. 실행 버튼은 스위치가 닫혀 있으면 이유를 보여 준다.
// 폴리싱(탭 구조·밀도·문구)은 마일스톤 종료 뒤 라운드에서 한다.
import { useCallback, useEffect, useState } from "react";
import {
  approvePayoutAttemptAction,
  confirmReceiptAction,
  createResendAttemptAction,
  failOrCancelAttemptAction,
  linkTransactionAction,
  listMercuryPayoutsAction,
  markManualAttemptSentAction,
  recordActualsAction,
  recordReturnAction,
  requestPayoutAttemptAction,
  type MercuryPayoutFilter,
  type MercuryPayoutRow,
} from "./mercury-payout-actions";
import { ATTEMPT_STATUS_LABEL_EN, ATTEMPT_STATUSES, type AttemptStatus } from "@/lib/payout/attempt-state";
import { formatDateOnlyEn } from "@/lib/payout/payout-schedule";
import { formatMinor } from "@/lib/payout/reconciliation-csv";

const FLAG_LABEL_EN: Record<string, string> = {
  ok: "Reconciled",
  pending: "Pending",
  not_paid: "Not paid",
  returned: "Returned",
  return_amount_mismatch: "Return amount differs from debit",
  needs_review: "Needs review",
  missing_transaction: "Missing Mercury transaction ID",
  missing_actual_usd: "Actual USD amounts missing",
  amount_mismatch: "USD principal differs from contract",
  awaiting_receipt: "Awaiting receipt confirmation",
};
const REASON_LABEL_EN: Record<string, string> = {
  short_received: "Short received",
  late: "Received after deadline",
  recipient_changed: "Bank details changed",
  amount_changed: "Amount changed",
  amount_changed_after_execution: "Amount changed after sending",
  recipient_changed_after_execution: "Bank details changed after sending",
  returned_amount_mismatch: "Return differs from debit",
  unverified_calendar: "Korean holiday calendar not verified for this year",
  transfer_date_already_passed: "Transfer date already passed",
  usd_principal_differs_from_contract: "USD principal differs from contract",
  received_currency_differs: "Received currency differs",
};
const USD_FORMAT = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const KRW_FORMAT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const money = (minor: number | null, cur: string | null) =>
  minor === null || cur === null ? "—" : `${cur} ${(cur === "USD" ? USD_FORMAT : KRW_FORMAT).format(Number(formatMinor(minor, cur)))}`;

type Msg = { tone: "ok" | "error"; text: string } | null;

export default function MercuryPayoutsPanel() {
  const [filter, setFilter] = useState<MercuryPayoutFilter>({ status: "all" });
  const [rows, setRows] = useState<MercuryPayoutRow[] | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [mercuryEnabled, setMercuryEnabled] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [exportRange, setExportRange] = useState({ from: "", to: "" });

  const load = useCallback((f: MercuryPayoutFilter) => {
    return listMercuryPayoutsAction(f).then((res) => {
      if (!res.ok) {
        setMsg({ tone: "error", text: res.error });
        setRows([]);
        return;
      }
      setRows(res.data?.rows ?? []);
      setGateOpen(Boolean(res.data?.gateOpen));
      setMercuryEnabled(Boolean(res.data?.mercuryEnabled));
    });
  }, []);
  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  async function act(id: string, fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    setBusy(id);
    setMsg(null);
    const res = await fn();
    setMsg(res.ok ? { tone: "ok", text: res.message ?? "Done." } : { tone: "error", text: res.error ?? "Failed." });
    await load(filter);
    setBusy(null);
  }
  const exportHref = (type: string) => `/api/admin/payout-exports?type=${type}${exportRange.from ? `&from=${exportRange.from}` : ""}${exportRange.to ? `&to=${exportRange.to}` : ""}`;

  return (
    <div className="max-w-[1100px]" data-testid="mercury-payouts-panel">
      <h2 className="text-[15px] font-extrabold text-ink mb-1">Mercury payouts</h2>
      <p className="text-[12px] text-grey-500 mb-3">
        US teachers and consultants are paid in USD by ACH. Korea-based recipients are paid in KRW by international wire created manually in the Mercury dashboard.
        Contract amounts stay in their contract currency; actual USD debits and fees are recorded separately and never added to KRW totals.
      </p>
      <div className="flex flex-wrap gap-2 mb-3 text-[12px]" data-testid="mercury-switches">
        <span className={`px-2 py-1 rounded-full font-bold ${mercuryEnabled ? "bg-green/10 text-green" : "bg-grey-100 text-grey-500"}`}>Mercury API: {mercuryEnabled ? "enabled" : "closed"}</span>
        <span className={`px-2 py-1 rounded-full font-bold ${gateOpen ? "bg-green/10 text-green" : "bg-grey-100 text-grey-500"}`}>Disbursement gate: {gateOpen ? "open" : "closed"}</span>
        {!gateOpen && <span className="text-grey-500 py-1">Real-world steps (request, processing, sent) are blocked until the gate is opened by the owner.</span>}
      </div>

      <div className="flex flex-wrap items-end gap-2 mb-3">
        <label className="text-[12px] text-grey-500">
          Currency
          <select className="block border-[1.5px] border-grey-200 rounded-lg px-2 py-1 text-[13px]" value={filter.currency ?? ""} onChange={(e) => setFilter((f) => ({ ...f, currency: (e.target.value || undefined) as MercuryPayoutFilter["currency"] }))}>
            <option value="">All</option>
            <option value="USD">US · USD</option>
            <option value="KRW">KR · KRW</option>
          </select>
        </label>
        <label className="text-[12px] text-grey-500">
          Status
          <select className="block border-[1.5px] border-grey-200 rounded-lg px-2 py-1 text-[13px]" value={filter.status ?? "all"} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value as AttemptStatus | "all" }))}>
            <option value="all">All</option>
            {ATTEMPT_STATUSES.map((s) => (
              <option key={s} value={s}>{ATTEMPT_STATUS_LABEL_EN[s]}</option>
            ))}
          </select>
        </label>
        <label className="text-[12px] text-grey-500 flex items-center gap-1 pb-1">
          <input type="checkbox" checked={Boolean(filter.problemsOnly)} onChange={(e) => setFilter((f) => ({ ...f, problemsOnly: e.target.checked }))} /> Problems only
        </label>
        <div className="ml-auto flex flex-wrap items-end gap-2">
          <input type="date" aria-label="Deadline from" className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1 text-[13px]" value={exportRange.from} onChange={(e) => setExportRange((r) => ({ ...r, from: e.target.value }))} />
          <input type="date" aria-label="Deadline to" className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1 text-[13px]" value={exportRange.to} onChange={(e) => setExportRange((r) => ({ ...r, to: e.target.value }))} />
          <a className="text-[12px] font-bold px-2.5 py-1.5 rounded-lg border-[1.5px] border-grey-200" href={exportHref("payout-list")}>Download payout list</a>
          <a className="text-[12px] font-bold px-2.5 py-1.5 rounded-lg border-[1.5px] border-grey-200" href={exportHref("mercury-krw-input")}>Download Mercury KRW input list</a>
          <a className="text-[12px] font-bold px-2.5 py-1.5 rounded-lg border-[1.5px] border-grey-200" href={exportHref("reconciliation")}>Download reconciliation file</a>
        </div>
      </div>

      {msg && <div role="status" className={`mb-3 text-[13px] font-semibold rounded-lg px-4 py-3 ${msg.tone === "ok" ? "text-green bg-green/5" : "text-red bg-red/5"}`}>{msg.text}</div>}
      {rows === null && <div className="text-[13px] text-grey-500">Loading…</div>}
      {rows !== null && rows.length === 0 && <div className="text-[13px] text-grey-500" data-testid="mercury-empty">No payout attempts match this filter. Create attempts from approved settlements.</div>}

      <div className="space-y-2">
        {(rows ?? []).map((r) => {
          const completed = r.status === "receipt_confirmed";
          const isOpen = openId === r.attemptId;
          return (
            <div key={r.attemptId} className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3" data-testid="mercury-row">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <div className="min-w-[160px]">
                  <div className="text-[13px] font-bold text-ink">{r.recipientName || r.recipientId.slice(0, 8)}</div>
                  <div className="text-[11px] text-grey-500">{r.recipientKind} · {r.requestedCurrency === "KRW" ? "KR · KRW wire" : "US · USD ACH"}{r.kind !== "normal" ? ` · ${r.kind} #${r.attemptNo}` : ""}</div>
                </div>
                <div className="text-[13px] font-bold">{money(r.requestedAmountMinor, r.requestedCurrency)}</div>
                <div className="text-[11.5px] text-grey-500">
                  {formatDateOnlyEn(r.periodStart)}–{formatDateOnlyEn(r.periodEnd, true)} · deadline {formatDateOnlyEn(r.paymentDeadline, true)} · transfer by {formatDateOnlyEn(r.scheduledTransferDate, true)}
                </div>
                <div className="text-[11.5px] text-grey-500">
                  Bank: {r.bankName ? `${r.bankName} ••${r.accountLast4}` : "not registered"}{r.recipientLinkStatus ? ` · Mercury recipient ${r.recipientLinkStatus}` : ""}
                </div>
                <span className={`ml-auto text-[11px] font-bold rounded-full px-2 py-0.5 ${completed ? "bg-green/10 text-green" : "bg-grey-100 text-grey-600"}`} data-testid="mercury-status">{ATTEMPT_STATUS_LABEL_EN[r.status]}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 text-[11.5px] text-grey-500">
                <span>USD debit: {r.actualUsdTotalDebitMinor === null ? "not recorded" : `${money(r.actualUsdPrincipalMinor, "USD")} + fees ${money(r.actualUsdFeeMinor, "USD")} = ${money(r.actualUsdTotalDebitMinor, "USD")}`}</span>
                <span>Mercury tx: {r.providerTransactionId ?? "—"}</span>
                {r.trackingUrl && <a className="underline" href={r.trackingUrl} target="_blank" rel="noreferrer">Tracking</a>}
                {r.receiptUrl && <a className="underline" href={r.receiptUrl} target="_blank" rel="noreferrer">Receipt</a>}
                <span>Reconciliation: {FLAG_LABEL_EN[r.reconciliationFlag] ?? r.reconciliationFlag}</span>
                {r.sentAt && !r.receivedConfirmedAt && <span className="text-amber-700 font-semibold">Sent — receipt not confirmed yet</span>}
              </div>
              {(r.reasons.length > 0 || r.approvalInvalidated) && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {r.approvalInvalidated && <span className="text-[10.5px] font-bold bg-red/10 text-red rounded-full px-2 py-0.5">Approval invalidated — re-approval required</span>}
                  {r.reasons.map((x) => <span key={x} className="text-[10.5px] font-bold bg-amber-100 text-amber-800 rounded-full px-2 py-0.5">{REASON_LABEL_EN[x] ?? x}</span>)}
                </div>
              )}
              {(r.failureReason || r.returnReason) && <div className="mt-1 text-[11.5px] text-red">{r.failureReason ?? r.returnReason}</div>}

              <div className="mt-2 flex flex-wrap gap-2">
                {(r.status === "queued" || r.status === "needs_review") && (
                  <button disabled={busy === r.attemptId} className="text-[12px] font-bold px-2.5 py-1.5 rounded-lg border-[1.5px] border-ink" onClick={() => act(r.attemptId, () => approvePayoutAttemptAction(r.attemptId))}>Approve payout</button>
                )}
                {r.status === "queued" && !r.manualExecution && r.approvedAt && !r.approvalInvalidated && (
                  <button disabled={busy === r.attemptId || !gateOpen || !mercuryEnabled} title={!gateOpen || !mercuryEnabled ? "A safety switch is closed" : undefined} className="text-[12px] font-bold px-2.5 py-1.5 rounded-lg border-[1.5px] border-ink disabled:opacity-40" onClick={() => act(r.attemptId, () => requestPayoutAttemptAction(r.attemptId))}>
                    Request via Mercury
                  </button>
                )}
                <button className="text-[12px] font-bold px-2.5 py-1.5 rounded-lg border-[1.5px] border-grey-200" onClick={() => setOpenId(isOpen ? null : r.attemptId)}>{isOpen ? "Hide details" : "Details & records"}</button>
              </div>

              {isOpen && (
                <div className="mt-3 grid gap-3 md:grid-cols-2 text-[12px]" data-testid="mercury-details">
                  <fieldset className="border border-grey-200 rounded-lg p-2">
                    <legend className="px-1 font-bold">Link Mercury transaction</legend>
                    <input aria-label="Mercury transaction ID" placeholder="Transaction ID" className="w-full border border-grey-200 rounded px-2 py-1 mb-1" value={form[`${r.attemptId}:tx`] ?? ""} onChange={(e) => set(`${r.attemptId}:tx`, e.target.value)} />
                    <input aria-label="Tracking URL" placeholder="Tracking URL (optional)" className="w-full border border-grey-200 rounded px-2 py-1 mb-1" value={form[`${r.attemptId}:track`] ?? ""} onChange={(e) => set(`${r.attemptId}:track`, e.target.value)} />
                    <div className="flex gap-2">
                      <button className="font-bold underline" onClick={() => act(r.attemptId, () => linkTransactionAction({ attemptId: r.attemptId, transactionId: form[`${r.attemptId}:tx`] ?? "", trackingUrl: form[`${r.attemptId}:track`] }))}>Link</button>
                      {r.manualExecution && r.providerTransactionId && (r.status === "queued" || r.status === "awaiting_mercury_approval" || r.status === "processing") && (
                        <button disabled={!gateOpen} className="font-bold underline disabled:opacity-40" onClick={() => act(r.attemptId, () => markManualAttemptSentAction(r.attemptId))}>Mark sent</button>
                      )}
                    </div>
                  </fieldset>
                  <fieldset className="border border-grey-200 rounded-lg p-2">
                    <legend className="px-1 font-bold">Actual USD cost (from Mercury)</legend>
                    <div className="flex gap-1 mb-1">
                      <input aria-label="USD principal" placeholder="USD principal" className="w-1/2 border border-grey-200 rounded px-2 py-1" value={form[`${r.attemptId}:p`] ?? ""} onChange={(e) => set(`${r.attemptId}:p`, e.target.value)} />
                      <input aria-label="USD fees" placeholder="USD fees" className="w-1/2 border border-grey-200 rounded px-2 py-1" value={form[`${r.attemptId}:f`] ?? ""} onChange={(e) => set(`${r.attemptId}:f`, e.target.value)} />
                    </div>
                    <div className="flex gap-1 mb-1">
                      <input aria-label="Quoted FX rate" placeholder="Quoted rate" className="w-1/2 border border-grey-200 rounded px-2 py-1" value={form[`${r.attemptId}:q`] ?? ""} onChange={(e) => set(`${r.attemptId}:q`, e.target.value)} />
                      <input aria-label="Final FX rate" placeholder="Final rate" className="w-1/2 border border-grey-200 rounded px-2 py-1" value={form[`${r.attemptId}:fr`] ?? ""} onChange={(e) => set(`${r.attemptId}:fr`, e.target.value)} />
                    </div>
                    <button className="font-bold underline" onClick={() => act(r.attemptId, () => recordActualsAction({ attemptId: r.attemptId, usdPrincipal: Number(form[`${r.attemptId}:p`]), usdFee: Number(form[`${r.attemptId}:f`] || 0), quotedRate: form[`${r.attemptId}:q`] ? Number(form[`${r.attemptId}:q`]) : undefined, finalRate: form[`${r.attemptId}:fr`] ? Number(form[`${r.attemptId}:fr`]) : undefined }))}>Record actuals</button>
                  </fieldset>
                  {r.status === "sent" && (
                    <fieldset className="border border-grey-200 rounded-lg p-2">
                      <legend className="px-1 font-bold">Confirm receipt (evidence required)</legend>
                      <input aria-label="Received amount" placeholder={`Received amount (${r.requestedCurrency})`} className="w-full border border-grey-200 rounded px-2 py-1 mb-1" value={form[`${r.attemptId}:ra`] ?? ""} onChange={(e) => set(`${r.attemptId}:ra`, e.target.value)} />
                      <input aria-label="Receipt evidence" placeholder="Evidence (e.g. teacher confirmation, bank statement)" className="w-full border border-grey-200 rounded px-2 py-1 mb-1" value={form[`${r.attemptId}:ev`] ?? ""} onChange={(e) => set(`${r.attemptId}:ev`, e.target.value)} />
                      <button className="font-bold underline" onClick={() => act(r.attemptId, () => confirmReceiptAction({ attemptId: r.attemptId, receivedAmountMinor: Math.round(Number(form[`${r.attemptId}:ra`]) * (r.requestedCurrency === "USD" ? 100 : 1)), currency: r.requestedCurrency, evidence: form[`${r.attemptId}:ev`] ?? "" }))}>Confirm receipt</button>
                    </fieldset>
                  )}
                  {(r.status === "sent" || r.status === "receipt_confirmed") && (
                    <fieldset className="border border-grey-200 rounded-lg p-2">
                      <legend className="px-1 font-bold">Record return</legend>
                      <input aria-label="Return transaction ID" placeholder="Return transaction ID" className="w-full border border-grey-200 rounded px-2 py-1 mb-1" value={form[`${r.attemptId}:rt`] ?? ""} onChange={(e) => set(`${r.attemptId}:rt`, e.target.value)} />
                      <input aria-label="Returned USD" placeholder="Returned USD amount" className="w-full border border-grey-200 rounded px-2 py-1 mb-1" value={form[`${r.attemptId}:ru`] ?? ""} onChange={(e) => set(`${r.attemptId}:ru`, e.target.value)} />
                      <input aria-label="Return reason" placeholder="Reason" className="w-full border border-grey-200 rounded px-2 py-1 mb-1" value={form[`${r.attemptId}:rr`] ?? ""} onChange={(e) => set(`${r.attemptId}:rr`, e.target.value)} />
                      <button className="font-bold underline" onClick={() => act(r.attemptId, () => recordReturnAction({ attemptId: r.attemptId, returnTransactionId: form[`${r.attemptId}:rt`] ?? "", returnedUsd: Number(form[`${r.attemptId}:ru`]), reason: form[`${r.attemptId}:rr`] ?? "" }))}>Record return</button>
                    </fieldset>
                  )}
                  {["queued", "awaiting_mercury_approval", "processing", "sent", "needs_review"].includes(r.status) && (
                    <fieldset className="border border-grey-200 rounded-lg p-2">
                      <legend className="px-1 font-bold">Fail or cancel</legend>
                      <input aria-label="Reason" placeholder="Reason (required)" className="w-full border border-grey-200 rounded px-2 py-1 mb-1" value={form[`${r.attemptId}:why`] ?? ""} onChange={(e) => set(`${r.attemptId}:why`, e.target.value)} />
                      <div className="flex gap-3">
                        {r.status !== "queued" && <button className="font-bold underline" onClick={() => act(r.attemptId, () => failOrCancelAttemptAction({ attemptId: r.attemptId, to: "failed", reason: form[`${r.attemptId}:why`] ?? "" }))}>Record failed</button>}
                        {r.status !== "sent" && r.status !== "processing" && <button className="font-bold underline" onClick={() => act(r.attemptId, () => failOrCancelAttemptAction({ attemptId: r.attemptId, to: "cancelled", reason: form[`${r.attemptId}:why`] ?? "" }))}>Cancel attempt</button>}
                      </div>
                    </fieldset>
                  )}
                  {["failed", "returned", "cancelled"].includes(r.status) && (
                    <fieldset className="border border-grey-200 rounded-lg p-2">
                      <legend className="px-1 font-bold">Resend</legend>
                      <p className="text-grey-500 mb-1">Creates a new attempt linked to this one. It needs its own approval; the original record is kept.</p>
                      <button className="font-bold underline" onClick={() => act(r.attemptId, () => createResendAttemptAction({ originalAttemptId: r.attemptId, kind: "resend" }))}>Create resend attempt</button>
                    </fieldset>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
