"use client";

import { useEffect, useState } from "react";
import type { ConsultantWithStudents } from "./consultant-assignment-actions";
import {
  getConsultantPayoutAccountAction,
  getConsultantContractFeeAction,
  type ConsultantContractFee,
  listConsultantPayoutPeriodsAction,
  listConsultantPayoutPeriodEventsAction,
  createConsultantPayoutPeriodAction,
  updateConsultantPayoutPeriodAmountAction,
  updateConsultantPayoutPeriodStatusAction,
  listPayoutConsultantsAction,
  revealConsultantPayoutAccountAction,
  saveConsultantPayoutAccountByAdminAction,
  type ConsultantPayoutAccountAdminView,
  type ConsultantPayoutPeriodAdmin,
  type ConsultantPayoutPeriodEvent,
} from "./consultant-settlement-actions";
import { useViewerTimezone } from "@/app/components/ViewerTimezoneProvider";
import { fmtDateTime } from "@/lib/format-datetime";
import PayoutAccountAdminActions from "./PayoutAccountAdminActions";
import { getPayoutAccountStaffPermissionAction } from "./teacher-payout-accounts-actions";
import { compareManualWithSuggestion, contractAutoFillNote, findOverlappingPeriods, overlapWarning, suggestConsultantPeriodAmount } from "@/lib/consultant-agreements/suggestion";
import { COMPANY_TIME_ZONE, payoutDateForPeriodEnd, previousPayoutPeriod } from "@/lib/payout/payout-schedule";

// 2026-09-29 — Consultants 탭에 있던 `정산` 섹션을 Payouts 탭의 `컨설턴트 정산`
// 서브탭으로 옮겼다(동작 변경 없음). 컨설턴트 목록은 이 패널이 직접 읽는다.
// Phase B(5, 2026-09-23, 사용자 확정) — 관리자가 컨설턴트별 정산 기간·금액을
// 직접 입력·확정한다. 상담 건수·수업 수 자동 계산 없음. 컨설턴트를 고르면
// 그 사람의 수취 계좌(마스킹)와 지급 기간 목록(전체 상태 — draft 포함)이
// 뜬다. 금액 수정·상태 변경 버튼을 누를 때마다 이력이 남는다(아래 "이력
// 보기"에서 확인).
export default function ConsultantSettlementPanel() {
  const tz = useViewerTimezone();
  const [consultants, setConsultants] = useState<ConsultantWithStudents[]>([]);
  const [selectedConsultantId, setSelectedConsultantId] = useState("");
  const [account, setAccount] = useState<ConsultantPayoutAccountAdminView>(null);
  const [periods, setPeriods] = useState<ConsultantPayoutPeriodAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canManageAccount, setCanManageAccount] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newCurrency, setNewCurrency] = useState("KRW");
  const [contractFee, setContractFee] = useState<ConsultantContractFee>(null);
  const [editingAmountId, setEditingAmountId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [eventsByPeriod, setEventsByPeriod] = useState<Record<string, ConsultantPayoutPeriodEvent[]>>({});

  useEffect(() => {
    void getPayoutAccountStaffPermissionAction().then((p) => setCanManageAccount(p.canManage)).catch(() => setCanManageAccount(false));
    listPayoutConsultantsAction()
      .then(setConsultants)
      .catch((e) => setError(e instanceof Error ? e.message : "컨설턴트 목록을 불러오지 못했습니다."));
  }, []);

  function reload(consultantId: string) {
    if (!consultantId) return;
    getConsultantPayoutAccountAction(consultantId).then(setAccount).catch(() => setAccount(null));
    getConsultantContractFeeAction(consultantId).then(setContractFee).catch(() => setContractFee(null));
    listConsultantPayoutPeriodsAction(consultantId)
      .then(setPeriods)
      .catch((e) => setError(e instanceof Error ? e.message : "불러오지 못했습니다."));
  }

  useEffect(() => {
    reload(selectedConsultantId);
  }, [selectedConsultantId]);

  async function handleCreate() {
    if (!selectedConsultantId || !newStart || !newEnd || !newAmount) return;
    setBusy(true);
    setError(null);
    try {
      await createConsultantPayoutPeriodAction({
        consultantId: selectedConsultantId,
        periodStart: newStart,
        periodEnd: newEnd,
        amountMinor: Math.round(Number(newAmount) * 100),
        currency: newCurrency,
        note: newNote || undefined,
      });
      setNewStart("");
      setNewEnd("");
      setNewAmount("");
      setNewNote("");
      reload(selectedConsultantId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "등록하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveAmount(periodId: string) {
    setBusy(true);
    setError(null);
    try {
      await updateConsultantPayoutPeriodAmountAction({ periodId, amountMinor: Math.round(Number(editAmount) * 100) });
      setEditingAmountId(null);
      reload(selectedConsultantId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "금액을 바꾸지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handleStatusChange(periodId: string, status: "draft" | "confirmed" | "paid") {
    setBusy(true);
    setError(null);
    try {
      await updateConsultantPayoutPeriodStatusAction({ periodId, status });
      reload(selectedConsultantId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "상태를 바꾸지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleEvents(periodId: string) {
    if (eventsByPeriod[periodId]) {
      setEventsByPeriod((prev) => {
        const next = { ...prev };
        delete next[periodId];
        return next;
      });
      return;
    }
    const events = await listConsultantPayoutPeriodEventsAction(periodId);
    setEventsByPeriod((prev) => ({ ...prev, [periodId]: events }));
  }

  return (
    <div>
      <h2 className="text-[15px] font-extrabold text-ink mb-3">정산</h2>
      <select
        value={selectedConsultantId}
        onChange={(e) => setSelectedConsultantId(e.target.value)}
        className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[13px] mb-4"
      >
        <option value="">컨설턴트 선택</option>
        {consultants.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name ?? c.id}
          </option>
        ))}
      </select>

      {selectedConsultantId && (
        <div>
          {error && <div className="mb-3 text-[13px] font-semibold text-red bg-red/5 rounded-lg px-4 py-3">{error}</div>}

          <div className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3 mb-4">
            <div className="text-[11px] font-bold text-grey-500 uppercase tracking-wide mb-1">수취 계좌</div>
            {account ? (
              <div className="text-[13px] text-ink" data-testid="consultant-account-masked">
                {account.bankName} {account.accountNumberMasked} · 예금주 {account.accountHolderName} · {account.currency}
                {account.enteredByAdmin && <span className="ml-1.5 text-[10.5px] font-bold text-grey-500 bg-grey-100 rounded-full px-2 py-0.5">관리자 입력</span>}
              </div>
            ) : (
              <div className="text-[13px] text-amber-700" data-testid="consultant-account-missing">미등록 — 컨설턴트 포털에 계좌 등록 단계가 표시됩니다.</div>
            )}
            <p className="text-[11px] text-grey-400 mt-1">결제 수단은 은행 송금뿐입니다. 컨설턴트는 최초 1회만 등록하고, 이후 변경은 마스터·정산권한 관리자가 대신 입력합니다.</p>
            <PayoutAccountAdminActions
              idKey={`consultant-${selectedConsultantId}`}
              registered={Boolean(account)}
              initial={{ accountHolderName: account?.accountHolderName ?? "", bankName: account?.bankName ?? "", currency: account?.currency ?? "KRW", country: account?.country ?? null }}
              canManage={canManageAccount}
              onReveal={(reason) => revealConsultantPayoutAccountAction(selectedConsultantId, reason)}
              onSave={(input) => saveConsultantPayoutAccountByAdminAction(selectedConsultantId, input)}
              onSaved={() => reload(selectedConsultantId)}
            />
          </div>

          <p className="text-[11.5px] text-grey-500 mb-2">정산 기간은 월 2회(1~15일 → 같은 달 26일까지 지급, 16일~말일 → 다음 달 10일까지 지급)이며 날짜 기준은 {COMPANY_TIME_ZONE}입니다. 금액은 지금처럼 수기 입력합니다.</p>
          <form
            className="flex flex-wrap items-end gap-2 mb-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleCreate();
            }}
          >
            <button type="button" onClick={() => { const r = previousPayoutPeriod(new Date()); setNewStart(r.periodStart); setNewEnd(r.periodEnd); }} className="text-[12px] font-bold px-2.5 py-1.5 rounded-lg border-[1.5px] border-grey-200">직전 정산 기간 채우기</button>
            <input type="date" value={newStart} onChange={(e) => setNewStart(e.target.value)} className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[13px]" />
            <span className="text-[13px] text-grey-500">~</span>
            <input type="date" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[13px]" />
            <input
              type="number"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="금액"
              className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[13px] w-28"
            />
            <select value={newCurrency} onChange={(e) => setNewCurrency(e.target.value)} aria-label="통화" className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1.5 text-[13px] bg-white">
              <option value="KRW">KRW</option>
              <option value="USD">USD</option>
            </select>
            <input
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="메모(선택)"
              className="border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[13px] flex-1 min-w-[120px]"
            />
            <button type="submit" disabled={busy || !newStart || !newEnd || !newAmount} className="text-[13px] font-bold bg-ink text-white rounded-lg px-4 py-1.5 disabled:opacity-50">
              기간 등록
            </button>
          </form>
          {(() => {
            // 이중 계상 방지: 같은 기간과 겹치는 정산이 이미 있으면 경고(차단 아님). 계약 유무와 무관하게 보여 준다.
            const w = overlapWarning(findOverlappingPeriods(periods ?? [], newStart, newEnd));
            return w ? <p className="mb-2 text-[12px] text-amber-700 font-bold" data-testid="overlap-warning">⚠ {w}</p> : null;
          })()}
          {contractFee && (() => {
            const suggestion = suggestConsultantPeriodAmount(contractFee, newStart, newEnd);
            const warning = compareManualWithSuggestion(suggestion, { amountMajor: newAmount === "" ? null : Number(newAmount), currency: newCurrency });
            return (
              <div className="mb-4 text-[12px]" data-testid="contract-suggestion">
                <p className="text-grey-500">
                  서명된 계약서 월 보수 {contractFee.currency === "USD" ? new Intl.NumberFormat("en-US").format(contractFee.monthlyFeeMinor / 100) : new Intl.NumberFormat("en-US").format(contractFee.monthlyFeeMinor)} {contractFee.currency}
                  {suggestion.ok ? (
                    <> · <b className="text-ink" data-testid="suggested-amount">계약 기준 제안 {new Intl.NumberFormat("en-US").format(suggestion.amountMajor)} {suggestion.currency}</b> ({suggestion.basis}) — 자동 입력되지 않으며 참고용입니다.</>
                  ) : (
                    <> · {suggestion.reason}</>
                  )}
                </p>
                {suggestion.ok && (
                  <button
                    type="button"
                    data-testid="fill-from-contract"
                    className="mt-1 text-[12px] font-bold px-3 py-1 rounded-lg border-[1.5px] border-ink text-ink"
                    onClick={() => {
                      const note = contractAutoFillNote(contractFee.agreementId, suggestion.basis);
                      const ok = window.confirm(`계약서 기준으로 금액을 채웁니다.\n\n기간: ${newStart} ~ ${newEnd}\n금액: ${suggestion.amountMajor.toLocaleString("en-US")} ${suggestion.currency}\n근거: ${suggestion.basis}\n계약: ${contractFee.agreementId}\n\n채운 뒤에도 금액·통화를 직접 고칠 수 있고, 메모에 근거가 기록됩니다. 진행할까요?`);
                      if (!ok) return;
                      setNewAmount(String(suggestion.amountMajor));
                      setNewCurrency(suggestion.currency);
                      setNewNote(note);
                    }}
                  >
                    계약 기준으로 채우기
                  </button>
                )}
                {warning && <p className="text-amber-700 font-bold mt-0.5" data-testid="suggestion-warning">⚠ {warning} (등록은 막지 않습니다)</p>}
              </div>
            );
          })()}

          {periods === null ? (
            <p className="text-[13px] text-grey-500">불러오는 중…</p>
          ) : periods.length === 0 ? (
            <div className="text-[13px] text-grey-500 bg-grey-100 rounded-lg px-4 py-6 text-center">등록된 정산 기간이 없습니다.</div>
          ) : (
            periods.map((p) => (
              <div key={p.id} className="border-[1.5px] border-grey-200 rounded-xl px-4 py-3 mb-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-bold text-ink">
                    {p.periodStart} ~ {p.periodEnd}
                    {payoutDateForPeriodEnd(p.periodEnd) ? ` (예상 지급일 ${payoutDateForPeriodEnd(p.periodEnd)})` : ""}
                  </span>
                  <span className="text-[10.5px] font-bold text-grey-500 bg-grey-100 rounded-full px-2 py-0.5">
                    {p.status === "draft" ? "작성 중(컨설턴트에게 안 보임)" : p.status === "confirmed" ? "지급 예정" : "지급 완료"}
                  </span>
                  {editingAmountId === p.id ? (
                    <span className="flex items-center gap-1">
                      <input
                        type="number"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        className="border-[1.5px] border-grey-200 rounded-lg px-2 py-1 text-[12px] w-24"
                      />
                      <button disabled={busy} onClick={() => handleSaveAmount(p.id)} className="text-[11.5px] font-bold px-2 py-1 rounded-lg bg-ink text-white">
                        저장
                      </button>
                      <button onClick={() => setEditingAmountId(null)} className="text-[11.5px] font-bold text-grey-500">
                        취소
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingAmountId(p.id);
                        setEditAmount((p.amountMinor / 100).toString());
                      }}
                      className="text-[13px] font-bold text-ink underline"
                    >
                      {(p.amountMinor / 100).toLocaleString()} {p.currency}
                    </button>
                  )}
                </div>
                {p.note && <div className="text-[12px] text-grey-500 mt-1">{p.note}</div>}
                <div className="flex flex-wrap items-center gap-2 mt-2.5">
                  {p.status === "draft" && (
                    <button disabled={busy} onClick={() => handleStatusChange(p.id, "confirmed")} className="text-[12px] font-bold px-3 py-1 rounded-lg bg-ink text-white disabled:opacity-50">
                      확정
                    </button>
                  )}
                  {p.status === "confirmed" && (
                    <>
                      <button disabled={busy} onClick={() => handleStatusChange(p.id, "paid")} className="text-[12px] font-bold px-3 py-1 rounded-lg bg-ink text-white disabled:opacity-50">
                        지급 완료 처리
                      </button>
                      <button disabled={busy} onClick={() => handleStatusChange(p.id, "draft")} className="text-[12px] font-bold px-3 py-1 rounded-lg border-[1.5px] border-grey-200 text-ink disabled:opacity-50">
                        확정 취소
                      </button>
                    </>
                  )}
                  <button onClick={() => toggleEvents(p.id)} className="text-[12px] font-bold text-grey-500 underline">
                    {eventsByPeriod[p.id] ? "이력 접기" : "이력 보기"}
                  </button>
                </div>
                {eventsByPeriod[p.id] && (
                  <div className="mt-2 pt-2 border-t border-grey-100 text-[11.5px] text-grey-500 space-y-1">
                    {eventsByPeriod[p.id].length === 0 ? (
                      <div>이력이 없습니다.</div>
                    ) : (
                      eventsByPeriod[p.id].map((ev) => (
                        <div key={ev.id}>
                          {fmtDateTime(ev.createdAt, undefined, tz)} · {ev.actorName ?? "알 수 없음"} ·{" "}
                          {ev.eventType === "created" ? "생성" : ev.eventType === "amount_changed" ? "금액 변경" : "상태 변경"}
                          {ev.previousValue ? ` (${ev.previousValue} → ${ev.newValue})` : ` (${ev.newValue})`}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
