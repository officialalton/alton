"use client";

import { useEffect, useState } from "react";
import { formatPeriodWithPayoutEn } from "@/lib/payout/payout-schedule";
import {
  getMyPayoutAccountAction,
  saveMyPayoutAccountAction,
  listMyPayoutPeriodsAction,
  listMyPayoutNoticesAction,
  markMyPayoutNoticeReadAction,
  type MaskedPayoutAccount,
  type ConsultantPayoutPeriod,
  type ConsultantPayoutNotice,
} from "./settlement-actions";

// Phase B(5, 2026-09-23) — 컨설턴트 Settlement 탭. 상담 건수·수업 수로
// 자동 계산하지 않는다 — 관리자가 확정한 지급 예정·지급 완료 내역만 조회.
// 정책(2026-10-06): 수취 계좌는 최초 1회만 본인이 등록하고(필수 등록 단계), 이후에는 읽기 전용(끝 4자리만)이다.
// 변경은 ALTON 직원만 한다 — 변경되면 아래 알림으로 알려 준다.

const STATUS_LABEL: Record<string, string> = { confirmed: "Upcoming payout", paid: "Paid" };

export default function SettlementPanel({ onAccountSaved }: { onAccountSaved?: () => void } = {}) {
  const [account, setAccount] = useState<MaskedPayoutAccount | null>(null);
  const [periods, setPeriods] = useState<ConsultantPayoutPeriod[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notices, setNotices] = useState<ConsultantPayoutNotice[]>([]);
  const [accountHolderName, setAccountHolderName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [swiftOrRouting, setSwiftOrRouting] = useState("");
  const [currency, setCurrency] = useState("KRW");
  const [country, setCountry] = useState("KR");

  function reload() {
    getMyPayoutAccountAction().then(setAccount).catch(() => setAccount(null));
    listMyPayoutNoticesAction().then(setNotices).catch(() => setNotices([]));
    listMyPayoutPeriodsAction()
      .then(setPeriods)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load."));
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleSaveAccount() {
    setBusy(true);
    setError(null);
    try {
      const result = await saveMyPayoutAccountAction({
        accountHolderName,
        bankName,
        accountNumber,
        currency,
        country,
        swiftOrRouting,
      });
      if (result.status === "invalid") {
        setError(result.message);
        return;
      }
      setAccount(result.account);
      setAccountNumber("");
      setSwiftOrRouting("");
      onAccountSaved?.();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-[640px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-5">Settlement</h1>
      {error && <div className="mb-4 text-[13px] font-semibold text-red bg-red/5 rounded-lg px-4 py-3">{error}</div>}
      {saved && <div className="mb-4 text-[13px] font-semibold text-green bg-green/10 rounded-lg px-4 py-3">Saved.</div>}

      {notices.length > 0 && (
        <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4" data-testid="payout-notices">
          <div className="text-[13px] font-bold text-ink mb-2">Payout notices</div>
          <ul className="space-y-2">
            {notices.map((n) => (
              <li key={n.id} className="flex items-start justify-between gap-3" data-testid={`payout-notice-${n.id}`}>
                <div className={"text-[12.5px] " + (n.read ? "text-grey-500" : "text-ink font-semibold")}>
                  {!n.read && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red mr-1.5 align-middle" aria-label="Unread" />}
                  {n.message}
                </div>
                {!n.read && (
                  <button
                    type="button"
                    data-testid={`mark-read-${n.id}`}
                    className="text-[11.5px] font-bold px-2.5 py-1 rounded-lg border-[1.5px] border-grey-200 shrink-0"
                    onClick={() => {
                      void markMyPayoutNoticeReadAction(n.id)
                        .then(() => setNotices((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x))))
                        .catch(() => setError("Couldn't mark the notice as read."));
                    }}
                  >
                    Mark as read
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {account ? (
        <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-6" data-testid="account-readonly">
          <div className="text-[11px] font-bold text-grey-500 uppercase tracking-wide mb-2">Payout Account</div>
          <div className="text-[13px] text-ink">
            {account.bankName} <span data-testid="account-masked">{account.accountNumberMasked}</span> · Holder {account.accountHolderName} · {account.currency}
          </div>
          <p className="text-[11.5px] text-grey-500 mt-2" data-testid="account-locked-note">To change your account details, contact ALTON staff.</p>
        </div>
      ) : (
        <div className="border-[1.5px] border-red/40 rounded-xl px-5 py-4 mb-6" data-testid="account-setup">
          <div className="text-[13px] font-bold text-ink mb-1">Set up your payout account</div>
          <p className="text-[12px] text-grey-500 mb-3">
            Payouts are made by bank transfer. Please enter your bank account once; after you save it, only ALTON staff can change it.
          </p>
          <div className="space-y-2">
            <input value={accountHolderName} onChange={(e) => setAccountHolderName(e.target.value)} placeholder="Account holder" aria-label="Account holder" className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 text-[13px]" />
            <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Bank name" aria-label="Bank name" className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 text-[13px]" />
            <select
              value={currency}
              onChange={(e) => { setCurrency(e.target.value); setCountry(e.target.value === "USD" ? "US" : "KR"); }}
              aria-label="Currency"
              className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 text-[13px] bg-white"
            >
              <option value="KRW">KRW (Korean won)</option>
              <option value="USD">USD (US dollar)</option>
            </select>
            <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country of the bank account (e.g. KR or US)" aria-label="Country" className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 text-[13px]" />
            <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Account number (digits only)" aria-label="Account number" autoComplete="off" className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 text-[13px]" />
            <input value={swiftOrRouting} onChange={(e) => setSwiftOrRouting(e.target.value)} placeholder={currency === "USD" ? "ABA routing number (9 digits)" : "SWIFT code (optional)"} aria-label="SWIFT or routing" autoComplete="off" className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 text-[13px]" />
            <button onClick={handleSaveAccount} disabled={busy} data-testid="account-save" className="text-[13px] font-bold bg-ink text-white rounded-lg px-4 py-1.5 disabled:opacity-50">
              Save payout account
            </button>
          </div>
        </div>
      )}

      <div className="text-[11px] font-bold text-grey-500 uppercase tracking-wide mb-2">Payout History</div>
      <p className="text-[12px] text-grey-500 mb-2">Payouts are made twice a month: the 1st–15th is paid no later than the 26th, and the 16th–end of month no later than the 10th of the next month (Pacific Time).</p>
      {periods === null ? (
        <p className="text-[13px] text-grey-500">Loading…</p>
      ) : periods.length === 0 ? (
        <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">No confirmed payouts yet.</div>
      ) : (
        periods.map((p) => (
          <div key={p.id} className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3 mb-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold text-ink">
                {formatPeriodWithPayoutEn(p.periodStart, p.periodEnd)}
              </span>
              <span className="text-[10.5px] font-bold text-grey-500 bg-grey-100 rounded-full px-2 py-0.5">{STATUS_LABEL[p.status] ?? p.status}</span>
            </div>
            <div className="text-[13px] text-ink mt-1">{new Intl.NumberFormat("en-US").format(p.amountMinor / 100)} {p.currency}</div>
            {p.note && <div className="text-[12px] text-grey-500 mt-1">{p.note}</div>}
          </div>
        ))
      )}
    </div>
  );
}
