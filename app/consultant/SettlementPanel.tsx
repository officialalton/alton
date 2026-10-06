"use client";

import { useEffect, useState } from "react";
import { formatPeriodWithPayoutEn } from "@/lib/payout/payout-schedule";
import {
  getMyPayoutAccountAction,
  saveMyPayoutAccountAction,
  listMyPayoutPeriodsAction,
  type MaskedPayoutAccount,
  type ConsultantPayoutPeriod,
} from "./settlement-actions";

// Phase B(5, 2026-09-23) — 컨설턴트 Settlement 탭. 상담 건수·수업 수로
// 자동 계산하지 않는다 — 관리자가 확정한 지급 예정·지급 완료 내역만 조회.
// 수취 계좌는 본인이 등록·수정한다(app/teacher/SettlementTab.tsx와 같은
// 마스킹 원칙 — 전체 계좌번호는 이 화면에도 절대 오지 않는다).

const STATUS_LABEL: Record<string, string> = { confirmed: "Upcoming payout", paid: "Paid" };

export default function SettlementPanel() {
  const [account, setAccount] = useState<MaskedPayoutAccount | null>(null);
  const [periods, setPeriods] = useState<ConsultantPayoutPeriod[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingAccount, setEditingAccount] = useState(false);
  const [accountHolderName, setAccountHolderName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  function reload() {
    getMyPayoutAccountAction().then(setAccount).catch(() => setAccount(null));
    listMyPayoutPeriodsAction()
      .then(setPeriods)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load."));
  }

  useEffect(() => {
    reload();
  }, []);

  function startEditAccount() {
    setEditingAccount(true);
    setAccountHolderName(account?.accountHolderName ?? "");
    setBankName(account?.bankName ?? "");
    setAccountNumber("");
  }

  async function handleSaveAccount() {
    setBusy(true);
    setError(null);
    try {
      const result = await saveMyPayoutAccountAction({
        accountHolderName,
        bankName,
        accountNumber,
        currency: "KRW",
      });
      if (result.status === "invalid") {
        setError(result.message);
        return;
      }
      setAccount(result.account);
      setEditingAccount(false);
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

      <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-6">
        <div className="text-[11px] font-bold text-grey-500 uppercase tracking-wide mb-2">Bank Account</div>
        {editingAccount ? (
          <div className="space-y-2">
            <input
              value={accountHolderName}
              onChange={(e) => setAccountHolderName(e.target.value)}
              placeholder="Account holder"
              className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 text-[13px]"
            />
            <input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="Bank name"
              className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 text-[13px]"
            />
            <input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="Account number (re-enter in full)"
              className="w-full border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 text-[13px]"
            />
            <div className="flex gap-2">
              <button onClick={handleSaveAccount} disabled={busy} className="text-[13px] font-bold bg-ink text-white rounded-lg px-4 py-1.5 disabled:opacity-50">
                Save
              </button>
              <button onClick={() => setEditingAccount(false)} className="text-[13px] font-bold text-grey-500">
                Cancel
              </button>
            </div>
          </div>
        ) : account ? (
          <div className="flex items-center justify-between">
            <div className="text-[13px] text-ink">
              {account.bankName} {account.accountNumberMasked} · Holder {account.accountHolderName}
            </div>
            <button onClick={startEditAccount} className="text-[12px] font-bold px-3 py-1 rounded-lg border-[1.5px] border-grey-200 text-ink">
              Edit
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="text-[13px] text-grey-500">No bank account registered yet.</div>
            <button onClick={startEditAccount} className="text-[12px] font-bold px-3 py-1 rounded-lg border-[1.5px] border-grey-200 text-ink">
              Add
            </button>
          </div>
        )}
      </div>

      <div className="text-[11px] font-bold text-grey-500 uppercase tracking-wide mb-2">Payout History</div>
      <p className="text-[12px] text-grey-500 mb-2">Payouts are made twice a month: the 1st–15th is paid on the 20th, and the 16th–end of month on the 5th of the next month (Pacific Time).</p>
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
