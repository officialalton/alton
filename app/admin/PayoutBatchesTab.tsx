"use client";

import { useEffect, useState } from "react";
import TeacherPayoutAccountsPanel from "./TeacherPayoutAccountsPanel";
import type { PayoutBatchListItem } from "./payout-batches-data";
import { previousMonthRange } from "./payouts-data";
import {
  generatePayoutBatches,
  submitPayoutBatchForReview,
  approvePayoutBatch,
  markPayoutBatchFailed,
  adjustPayoutBatchAmount,
  listPayoutBatchesAction,
  deletePayoutBatch,
  closePayoutMonthNow,
  setPayoutBatchScheduledDate,
  setPayoutBatchAutoDispatch,
  getAutoDispatchEnabled,
  getDisbursementGateEnabled,
  ensurePayoutBatchScheduledDate,
  setAutoDispatchEnabled,
  dispatchPayoutBatchNow,
  recordExternalPayoutTransfer,
} from "./payout-batches-actions";

// R10 Task C — 레거시 PayoutsTab(teacher_payouts)을 대체하는 v3 payout_batches
// 관리자 화면. 법인 설립 전 지급 경계(2026-09-07 정책) 때문에 이 화면에서
// 도달 가능한 가장 먼 상태는 "승인(approved)"이다 — processing/paid로 보내는
// 버튼은 의도적으로 없다(payout-batches-actions.ts 상단 주석 참고).
// 레거시 teacher_payouts 테이블/화면은 R13 전까지 읽기 전용으로 보존되며
// (docs/CURRENT.md 참고), 이 화면과 동시에 노출하지 않는다.

const STATUS_LABEL: Record<string, string> = {
  draft: "생성됨(초안)",
  calculated: "생성됨(초안)",
  reviewing: "검토 중",
  reviewed: "검토 완료",
  approved: "승인됨",
  dispatch_requested: "지급 요청됨",
  provider_pending: "지급 처리 중",
  processing: "지급 처리 중",
  paid: "지급 완료",
  failed: "실패",
};

// P4-2(2차) — 조정이 허용되는 상태. 송금 요청 이후(dispatch_requested/
// provider_pending/processing/paid)와 failed는 DB 함수가 거부하므로 버튼도 감춘다.
const ADJUSTABLE_STATUSES = new Set(["draft", "calculated", "reviewing", "reviewed", "approved"]);
// 승인 전(검토 단계)만 삭제 가능 — DB의 delete_payout_batch()와 같은 목록이다.
const DELETABLE_STATUSES = new Set(["draft", "calculated", "reviewing", "reviewed"]);
// 2026-09-12(UAT 후속) — 운영자가 읽는 화면에 내부 영문 값을 그대로 노출하지 않는다.
const ITEM_TYPE_LABEL: Record<string, string> = {
  trial: "체험 수업",
  regular: "정규 수업",
  makeup: "보강 수업",
  adjustment: "관리자 조정",
  reversal: "역분개",
};
const AUDIT_ACTION_LABEL: Record<string, string> = {
  auto_closed: "월 마감(자동)",
  auto_closed_appended: "월 마감 재실행 — 항목 추가",
  scheduled_date_backfilled: "지급 예정일 보정",
  submitted_for_review: "검토 제출",
  reviewing: "검토 제출",
  approved: "송금 승인",
  reverted_to_review: "검토 중으로 되돌림(재승인 필요)",
  adjusted: "금액 조정",
  auto_dispatch_toggled: "자동 송금 설정 변경",
  scheduled_date_changed: "지급 예정일 변경",
  external_transfer_recorded: "외부 송금 완료 기록",
  dispatch_requested: "송금 요청",
  provider_pending: "금융사 처리 중",
  paid: "지급 완료",
  failed: "지급 실패 기록",
};
// 송금 요청 이후 단계 — 이때만 "지급 실패 기록"이 의미가 있다.
const IN_FLIGHT_STATUSES = new Set(["dispatch_requested", "provider_pending", "processing"]);

const ACTIONABLE_DRAFT = new Set(["draft", "calculated"]);
const ACTIONABLE_REVIEW = new Set(["draft", "calculated", "reviewing", "reviewed"]);
// R10 corrective(요구사항 4)의 ACTIONABLE_FAILED는 제거했다 — '지급 실패 기록'은
// 이제 실제 송금 요청 이후(IN_FLIGHT_STATUSES) 또는 이미 failed인 건에만 노출한다.

function money(amountMinor: number, currency: string): string {
  const amount = currency === "KRW" ? amountMinor : amountMinor / 100;
  return `${amount.toLocaleString()} ${currency}`;
}

export default function PayoutBatchesTab({
  initialBatches,
}: {
  initialBatches: PayoutBatchListItem[];
}) {
  // P4-2(2026-09-12) — 관리자 정산 화면에 `수취 계좌` 서브탭을 추가한다.
  const [subtab, setSubtab] = useState<"batches" | "accounts">("batches");
  // P4-2(2차) — 최종 송금액 가감 조정 입력. 자동 산정 항목을 고치는 것이 아니라
  // 별도 조정 항목을 추가하는 것이므로 금액·사유만 받는다.
  const [adjustDraft, setAdjustDraft] = useState<Record<string, { amount: string; reason: string }>>({});
  // P4-2 — 자동 송금 전역 스위치 + 묶음별 지급 예정일/외부 송금 입력.
  const [autoDispatchOn, setAutoDispatchOn] = useState<boolean | null>(null);
  const [gateOpen, setGateOpen] = useState<boolean | null>(null);
  // 승인된 묶음에서 어떤 작업을 펼칠지 — 기본은 아무것도 펼치지 않는다.
  const [openAction, setOpenAction] = useState<Record<string, "schedule" | "external" | null>>({});
  const [externalErrors, setExternalErrors] = useState<Record<string, Record<string, string>>>({});
  const [dateDraft, setDateDraft] = useState<Record<string, { date: string; reason: string }>>({});
  const [externalDraft, setExternalDraft] = useState<
    Record<string, { date: string; amount: string; reference: string; memo: string }>
  >({});
  const [batches, setBatches] = useState(initialBatches);
  const defaults = previousMonthRange(new Date());
  const [periodStart, setPeriodStart] = useState(defaults.periodStart);
  const [periodEnd, setPeriodEnd] = useState(defaults.periodEnd);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [failReasonDraft, setFailReasonDraft] = useState<Record<string, string>>({});

  // P4-2(UAT 후속) — 전체 새로고침 대신 목록만 다시 읽는다. 탭을 처음 열 때도
  // 이 조회로 채운다(SSR initialBatches는 첫 진입 표시용일 뿐이며, 클라이언트
  // 탭 전환으로 들어오면 비어 있을 수 있다 — 실제로 "목록이 사라지는" 버그였다).
  // 상태 갱신은 전부 Promise 콜백 안에서만 한다(react-hooks/set-state-in-effect).
  function refresh(): Promise<void> {
    return listPayoutBatchesAction()
      .then((rows) => {
        setBatches(rows);
        setBusyId(null);
      })
      .catch((e) => {
        setMessage(e instanceof Error ? e.message : "정산 배치를 불러오지 못했습니다.");
        setBusyId(null);
      });
  }

  useEffect(() => {
    void getAutoDispatchEnabled()
      .then(setAutoDispatchOn)
      .catch(() => setAutoDispatchOn(null));
    void getDisbursementGateEnabled()
      .then(setGateOpen)
      .catch(() => setGateOpen(null));
    void refresh();
    // 최초 진입 시 1회만 조회한다(이후 갱신은 각 액션이 직접 부른다).
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    setMessage(null);
    try {
      const result = await generatePayoutBatches(periodStart, periodEnd);
      setMessage(`${result.created}개 batch 생성됨`);
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "생성 실패");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmitForReview(id: string) {
    setBusyId(id);
    try {
      await submitPayoutBatchForReview(id);
      setBatches((prev) => prev.map((b) => (b.id === id ? { ...b, status: "reviewing" } : b)));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "검토 제출 실패");
    } finally {
      setBusyId(null);
    }
  }

  async function handleApprove(id: string) {
    setBusyId(id);
    try {
      await approvePayoutBatch(id);
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "승인 실패");
      setBusyId(null);
    }
  }

  async function handleCloseMonth() {
    setGenerating(true);
    setMessage(null);
    try {
      const result = await closePayoutMonthNow(periodStart, periodEnd);
      setMessage(
        `자동 마감 실행: 묶음 ${result.closed}건 · 새로 담긴 항목 ${result.itemCount}건 (이미 담긴 항목은 건너뜁니다)`
      );
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "자동 마감 실행 실패");
    } finally {
      setGenerating(false);
    }
  }

  async function runBatchAction(id: string, fn: () => Promise<{ status: string; error?: string }>, okMessage: string) {
    setBusyId(id);
    try {
      const result = await fn();
      if (result.status === "rejected") {
        setMessage(result.error ?? "처리하지 못했습니다.");
        setBusyId(null);
        return;
      }
      setMessage(okMessage);
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "처리 실패");
      setBusyId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("이 정산 묶음을 삭제할까요? 수업 항목은 지워지지 않고 미배치로 돌아가 다음 마감에 다시 잡힙니다.")) {
      return;
    }
    setBusyId(id);
    try {
      const result = await deletePayoutBatch(id);
      if (result.status === "rejected") {
        setMessage(result.error);
        setBusyId(null);
        return;
      }
      setMessage("정산 묶음을 삭제했습니다. 수업 항목은 미배치로 돌아갔습니다.");
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "삭제 실패");
      setBusyId(null);
    }
  }

  // 외부 송금 완료 기록: 제출 전에 필수값을 확인하고, 비어 있으면 입력칸 아래에 표시한다.
  // 금액은 사용자가 입력하지 않는다 — 승인된 최종 송금액을 그대로 보낸다.
  async function handleRecordExternal(id: string, totalAmountMinor: number, currency: string) {
    const draft = externalDraft[id];
    const errors: Record<string, string> = {};
    // 필수는 송금 완료일과 승인된 최종 송금액 일치뿐이다(확인 메모는 선택).
    if (!draft?.date) errors.date = "송금 완료일을 입력해주세요.";
    if (totalAmountMinor <= 0) {
      errors.amount = "승인된 금액이 0입니다. 먼저 정산 항목을 확인해주세요.";
    }
    setExternalErrors((p) => ({ ...p, [id]: errors }));
    if (Object.keys(errors).length > 0) return;

    await runBatchAction(
      id,
      () =>
        recordExternalPayoutTransfer({
          batchId: id,
          transferredOn: draft!.date,
          amountMinor: totalAmountMinor,
          currency,
          bankReference: draft?.reference?.trim() || undefined,
        }),
      "외부 송금 완료로 기록했습니다."
    );
  }

  async function handleAdjust(id: string) {
    const draft = adjustDraft[id];
    const amount = Number(draft?.amount);
    if (!Number.isFinite(amount) || amount === 0) {
      setMessage("조정 금액을 0이 아닌 숫자로 입력해주세요.");
      return;
    }
    if (!draft?.reason?.trim()) {
      setMessage("조정 사유를 입력해주세요.");
      return;
    }
    setBusyId(id);
    try {
      const result = await adjustPayoutBatchAmount({
        batchId: id,
        amountMinor: Math.round(amount),
        reason: draft.reason.trim(),
      });
      if (result.status === "rejected") {
        setMessage(result.error);
        setBusyId(null);
        return;
      }
      setAdjustDraft((prev) => ({ ...prev, [id]: { amount: "", reason: "" } }));
      setMessage("조정을 반영했습니다. 승인된 묶음이었다면 재승인이 필요합니다.");
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "조정 실패");
      setBusyId(null);
    }
  }

  async function handleMarkFailed(id: string) {
    const reason = failReasonDraft[id]?.trim();
    if (!reason) {
      setMessage("실패 사유를 입력해주세요.");
      return;
    }
    setBusyId(id);
    try {
      await markPayoutBatchFailed(id, reason);
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "실패 처리 실패");
      setBusyId(null);
    }
  }

  if (subtab === "accounts") {
    return (
      <div className="max-w-[900px] px-8 py-8">
        <h1 className="text-[20px] font-extrabold text-ink mb-1">정산</h1>
        <SettlementSubtabs subtab={subtab} onChange={setSubtab} />
        <TeacherPayoutAccountsPanel />
      </div>
    );
  }

  return (
    <div className="max-w-[900px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1">정산</h1>
      <SettlementSubtabs subtab={subtab} onChange={setSubtab} />
      <p className="text-[13px] text-grey-500 mb-2">
        payout_batches 기반 정산 배치. 법인 설립 전이라 이 화면에서는 <b>승인</b>까지만
        진행할 수 있습니다 — 실제 지급(Mercury/Wise 연동)은 법인 설립 후 별도로 활성화됩니다.
      </p>
      <div className="mb-5 text-[12px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 inline-block">
        🔒 지급 실행(processing/paid)은 DB 레벨에서 잠겨 있습니다 — 승인 이후 상태는 이
        화면에서 만들 수 없습니다.
      </div>

      <div className="flex items-end gap-2 mb-3">
        <div>
          <label className="block text-[11px] font-bold text-grey-300 mb-1">시작일</label>
          <input
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            className="px-2.5 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px]"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-grey-300 mb-1">종료일</label>
          <input
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            className="px-2.5 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px]"
          />
        </div>
        <button
          disabled={generating}
          onClick={handleCloseMonth}
          data-testid="close-month-now"
          className="text-[12px] font-bold px-3.5 py-2 rounded-lg bg-ink text-white disabled:opacity-50"
        >
          {generating ? "처리 중..." : "월 마감 실행"}
        </button>
        <button
          disabled={generating}
          onClick={handleGenerate}
          className="text-[12px] font-bold px-3.5 py-2 rounded-lg border-[1.5px] border-grey-200 disabled:opacity-50"
        >
          {generating ? "생성 중..." : "Batch 생성(구경로)"}
        </button>
      </div>
      <div className="flex items-center gap-2 mb-3 text-[12px]">
        <span className="font-bold text-grey-400">자동 송금(전역)</span>
        <span data-testid="auto-dispatch-global">
          {autoDispatchOn === null ? "확인 중..." : autoDispatchOn ? "켜짐" : "꺼짐"}
        </span>
        <button
          disabled={autoDispatchOn === null}
          data-testid="toggle-auto-dispatch"
          onClick={async () => {
            const next = !autoDispatchOn;
            const result = await setAutoDispatchEnabled(next);
            if (result.status === "rejected") setMessage(result.error);
            else {
              setAutoDispatchOn(next);
              setMessage(next ? "자동 송금을 켰습니다." : "자동 송금을 껐습니다. 예정일이 와도 자동으로 나가지 않습니다.");
            }
          }}
          className="text-[12px] font-bold px-3 py-1 rounded-lg border-[1.5px] border-grey-200 disabled:opacity-50"
        >
          {autoDispatchOn ? "끄기" : "켜기"}
        </button>
        <span className="text-[11px] text-grey-400">
          매월 10일 03:00 UTC에 지급 예정일이 도래한 <b>송금 승인</b> 묶음만 자동 처리합니다.
        </span>
      </div>
      <p className="text-[11.5px] text-grey-500 mb-3">
        정상 경로는 <b>매월 1일 자동 마감</b>입니다(크론). 위 <b>월 마감 실행</b>은 같은 자동 마감을
        수동으로 한 번 더 돌리는 버튼이라 여러 번 눌러도 같은 항목이 두 번 묶이지 않고, 이미 만들어진
        묶음에 새 항목만 더합니다. <b>Batch 생성(구경로)</b>은 이전 방식으로, 열린 묶음을 재사용하지
        않아 같은 기간에 묶음이 또 생길 수 있으니 특별한 경우에만 쓰세요.
      </p>
      {message && <p className="text-[12px] text-grey-500 mb-4">{message}</p>}

      {batches.length === 0 ? (
        <p className="text-[13px] text-grey-500">정산 batch가 없습니다.</p>
      ) : (
        batches.map((b) => {
          const isExpanded = expandedId === b.id;
          return (
            <div key={b.id} className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13.5px] font-bold text-ink">{b.teacherName}</div>
                  <div className="text-[12px] text-grey-500">
                    {b.periodStart} ~ {b.periodEnd} · {money(b.totalAmountMinor, b.currency)} ·{" "}
                    {b.itemCount}건
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                      b.status === "failed"
                        ? "bg-red-100 text-red-700"
                        : b.status === "approved"
                          ? "bg-green-100 text-green-700"
                          : "bg-grey-100 text-ink"
                    }`}
                  >
                    {STATUS_LABEL[b.status] ?? b.status}
                  </span>
                  {ACTIONABLE_DRAFT.has(b.status) && (
                    <button
                      disabled={busyId === b.id}
                      onClick={() => handleSubmitForReview(b.id)}
                      className="text-[12px] font-semibold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 disabled:opacity-50"
                    >
                      검토 제출
                    </button>
                  )}
                  {ACTIONABLE_REVIEW.has(b.status) && (
                    <button
                      disabled={busyId === b.id}
                      onClick={() => handleApprove(b.id)}
                      className="text-[12px] font-bold px-3.5 py-2 rounded-lg bg-ink text-white disabled:opacity-50"
                    >
                      승인
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : b.id)}
                    className="text-[12px] font-semibold text-grey-500"
                  >
                    {isExpanded ? "접기" : "상세"}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-grey-100">
                  <div className="text-[11px] font-bold text-grey-300 mb-1">항목 ({b.items.length})</div>
                  {b.items.map((it) => (
                    <div key={it.id} className="text-[12px] text-grey-500 flex justify-between py-0.5 gap-2">
                      <span className="truncate">
                        {ITEM_TYPE_LABEL[it.itemType] ?? it.itemType}
                        {it.itemType === "adjustment"
                          ? it.adjustmentReason
                            ? ` · ${it.adjustmentReason}`
                            : ""
                          : ` · ${it.payableMinutes}분`}
                      </span>
                      <span className="shrink-0">{money(it.amountMinor, it.currency)}</span>
                    </div>
                  ))}

                  <div className="text-[11px] font-bold text-grey-300 mt-3 mb-1">감사 로그</div>
                  {b.auditLog.length === 0 ? (
                    <p className="text-[12px] text-grey-400">기록 없음</p>
                  ) : (
                    b.auditLog.map((a) => (
                      <div key={a.id} className="text-[12px] text-grey-500 py-0.5">
                        {new Date(a.createdAt).toLocaleString("ko-KR")} ·{" "}
                        {AUDIT_ACTION_LABEL[a.action] ?? a.action} · {a.actorName ?? "시스템(자동)"}
                        {a.note ? ` · ${a.note}` : ""}
                      </div>
                    ))
                  )}

                  {b.status === "failed" && b.failureReason && (
                    <div className="mt-2 text-[12px] text-red-600">실패 사유: {b.failureReason}</div>
                  )}

                  {ADJUSTABLE_STATUSES.has(b.status) && (
                    <div className="mt-3 pt-3 border-t border-grey-100">
                      <div className="text-[11px] font-bold text-grey-300 mb-1">최종 송금액 조정</div>
                      <p className="text-[11px] text-grey-400 mb-1.5">
                        수업별 자동 산정 금액은 고칠 수 없습니다. 가감할 금액과 사유를 남기면 별도
                        조정 항목으로 기록됩니다. 승인된 묶음을 조정하면 검토 중으로 되돌아가 재승인이
                        필요합니다. 송금 요청 이후에는 조정할 수 없습니다.
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          placeholder="금액(감액은 -)"
                          inputMode="numeric"
                          value={adjustDraft[b.id]?.amount ?? ""}
                          onChange={(e) =>
                            setAdjustDraft((prev) => ({
                              ...prev,
                              [b.id]: { amount: e.target.value, reason: prev[b.id]?.reason ?? "" },
                            }))
                          }
                          data-testid={`adjust-amount-${b.id}`}
                          className="px-2 py-1 border-[1.5px] border-grey-200 rounded-lg text-[12px] w-32"
                        />
                        <input
                          placeholder="조정 사유"
                          value={adjustDraft[b.id]?.reason ?? ""}
                          onChange={(e) =>
                            setAdjustDraft((prev) => ({
                              ...prev,
                              [b.id]: { amount: prev[b.id]?.amount ?? "", reason: e.target.value },
                            }))
                          }
                          data-testid={`adjust-reason-${b.id}`}
                          className="px-2 py-1 border-[1.5px] border-grey-200 rounded-lg text-[12px] flex-1"
                        />
                        <button
                          disabled={busyId === b.id}
                          onClick={() => handleAdjust(b.id)}
                          data-testid={`adjust-submit-${b.id}`}
                          className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 disabled:opacity-50"
                        >
                          조정 추가
                        </button>
                      </div>
                    </div>
                  )}

                  {b.status === "approved" && (
                    <div className="mt-3 pt-3 border-t border-grey-100">
                      <div className="text-[12px] text-grey-500 mb-2">
                        지급 예정일{" "}
                        <b data-testid={`sched-${b.id}`}>
                          {b.scheduledPayoutDate ?? "미정"}
                        </b>{" "}
                        · 자동 송금 <b>{b.autoDispatchEnabled ? "대상" : "제외"}</b>
                      </div>

                      {!b.scheduledPayoutDate && (
                        <div
                          className="text-[11.5px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2"
                          data-testid={`sched-missing-${b.id}`}
                        >
                          이 묶음은 지급 예정일 기능이 생기기 전에 승인돼 예정일이 비어 있습니다.
                          <b> 예정일이 없으면 자동 송금 대상에서 빠집니다.</b> 아래 버튼으로 승인 시각
                          기준 예정일을 확정하거나, 날짜를 직접 지정해주세요.
                          <button
                            disabled={busyId === b.id}
                            data-testid={`ensure-date-${b.id}`}
                            onClick={() =>
                              runBatchAction(b.id, () => ensurePayoutBatchScheduledDate(b.id), "지급 예정일을 확정했습니다.")
                            }
                            className="ml-2 text-[11.5px] font-bold underline disabled:opacity-50"
                          >
                            예정일 확정
                          </button>
                        </div>
                      )}

                      {/* 필요한 행동만 고르게 한다 — 기본은 아무것도 펼치지 않는다. */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          data-testid={`open-schedule-${b.id}`}
                          onClick={() =>
                            setOpenAction((p) => ({ ...p, [b.id]: p[b.id] === "schedule" ? null : "schedule" }))
                          }
                          className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200"
                        >
                          지급 예정일 · 자동 송금 설정
                        </button>
                        <button
                          data-testid={`open-external-${b.id}`}
                          onClick={() =>
                            setOpenAction((p) => ({ ...p, [b.id]: p[b.id] === "external" ? null : "external" }))
                          }
                          className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200"
                        >
                          외부 송금 완료 기록
                        </button>
                        {gateOpen ? (
                          <button
                            disabled={busyId === b.id}
                            data-testid={`dispatch-now-${b.id}`}
                            onClick={() =>
                              runBatchAction(b.id, () => dispatchPayoutBatchNow(b.id), "Wise 송금 요청을 보냈습니다.")
                            }
                            className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50"
                          >
                            지금 송금 요청
                          </button>
                        ) : (
                          <span
                            data-testid={`dispatch-disabled-${b.id}`}
                            className="text-[11.5px] text-grey-400 px-3 py-1.5 rounded-lg border border-dashed border-grey-200"
                          >
                            지금 송금 요청 — Wise 연동 전에는 사용할 수 없습니다
                          </span>
                        )}
                      </div>

                      {openAction[b.id] === "schedule" && (
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="date"
                              value={dateDraft[b.id]?.date ?? ""}
                              onChange={(e) =>
                                setDateDraft((p) => ({ ...p, [b.id]: { date: e.target.value, reason: p[b.id]?.reason ?? "" } }))
                              }
                              data-testid={`date-input-${b.id}`}
                              className="px-2 py-1 border-[1.5px] border-grey-200 rounded-lg text-[12px]"
                            />
                            <input
                              placeholder="변경 사유(필수)"
                              value={dateDraft[b.id]?.reason ?? ""}
                              onChange={(e) =>
                                setDateDraft((p) => ({ ...p, [b.id]: { date: p[b.id]?.date ?? "", reason: e.target.value } }))
                              }
                              className="px-2 py-1 border-[1.5px] border-grey-200 rounded-lg text-[12px] flex-1"
                            />
                            <button
                              disabled={busyId === b.id}
                              data-testid={`change-date-${b.id}`}
                              onClick={() =>
                                runBatchAction(
                                  b.id,
                                  () =>
                                    setPayoutBatchScheduledDate({
                                      batchId: b.id,
                                      newDate: dateDraft[b.id]?.date ?? "",
                                      reason: dateDraft[b.id]?.reason ?? "",
                                    }),
                                  "지급 예정일을 변경했습니다."
                                )
                              }
                              className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 disabled:opacity-50"
                            >
                              예정일 변경
                            </button>
                          </div>
                          <button
                            disabled={busyId === b.id}
                            data-testid={`toggle-batch-auto-${b.id}`}
                            onClick={() =>
                              runBatchAction(
                                b.id,
                                () => setPayoutBatchAutoDispatch(b.id, !b.autoDispatchEnabled),
                                b.autoDispatchEnabled ? "자동 송금 대상에서 제외했습니다." : "자동 송금 대상에 포함했습니다."
                              )
                            }
                            className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-grey-200 disabled:opacity-50"
                          >
                            {b.autoDispatchEnabled ? "자동 송금 대상에서 제외" : "자동 송금 대상에 포함"}
                          </button>
                        </div>
                      )}

                      {openAction[b.id] === "external" && (
                        <div className="mt-2 space-y-2">
                          <p className="text-[11px] text-grey-400">
                            <b>실제 은행에서 송금을 마친 뒤에만</b> 사용하세요. Wise API를 호출하지 않고 이미
                            보낸 사실만 기록합니다. 기록하면 지급 완료가 되고 금액·예정일을 더는 바꿀 수 없습니다.
                          </p>
                          <ExternalField
                            label="송금 완료일"
                            required
                            error={externalErrors[b.id]?.date}
                            testId={`external-date-${b.id}`}
                          >
                            <input
                              type="date"
                              value={externalDraft[b.id]?.date ?? ""}
                              onChange={(e) =>
                                setExternalDraft((p) => ({
                                  ...p,
                                  [b.id]: { ...(p[b.id] ?? { amount: "", reference: "", memo: "" }), date: e.target.value },
                                }))
                              }
                              aria-label="송금 완료일"
                              className="px-2 py-1 border-[1.5px] border-grey-200 rounded-lg text-[12px]"
                            />
                          </ExternalField>
                          {/* 2026-09-12 정정: 거래번호는 송금 실행에 필요한 값이 아니라 사후 대사
                              보조 정보다 — 선택값으로 두고, 값이 없다고 기록을 막지 않는다. */}
                          <ExternalField
                            label="송금 확인 메모(선택)"
                            hint="이체확인증 번호·은행 거래 ID·내부 전표 번호처럼 나중에 대사할 때 도움이 되는 값이 있으면 남겨주세요. 예: 2026091200123456"
                            testId={`external-ref-${b.id}`}
                          >
                            <input
                              placeholder="예: 2026091200123456 (없으면 비워두세요)"
                              value={externalDraft[b.id]?.reference ?? ""}
                              onChange={(e) =>
                                setExternalDraft((p) => ({
                                  ...p,
                                  [b.id]: { ...(p[b.id] ?? { date: "", amount: "", memo: "" }), reference: e.target.value },
                                }))
                              }
                              aria-label="송금 확인 메모"
                              className="px-2 py-1 border-[1.5px] border-grey-200 rounded-lg text-[12px] w-full"
                            />
                          </ExternalField>
                          <ExternalField label="최종 승인 금액" required testId={`external-amount-${b.id}`}>
                            {/* 금액은 추측해 넣는 값이 아니다 — 승인된 최종 송금액을 그대로 쓴다. */}
                            <input
                              readOnly
                              value={money(b.totalAmountMinor, b.currency)}
                              aria-label="최종 승인 금액"
                              className="px-2 py-1 border-[1.5px] border-grey-200 rounded-lg text-[12px] bg-grey-100 w-40"
                            />
                            <span className="block text-[11px] text-grey-400 mt-0.5">
                              금액을 바꾸려면 먼저 <b>조정 후 재승인</b>하세요.
                            </span>
                          </ExternalField>
                          <button
                            disabled={busyId === b.id}
                            data-testid={`record-external-${b.id}`}
                            onClick={() => handleRecordExternal(b.id, b.totalAmountMinor, b.currency)}
                            className="text-[12px] font-bold px-3 py-1.5 rounded-lg bg-ink text-white disabled:opacity-50"
                          >
                            송금 완료로 기록
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {DELETABLE_STATUSES.has(b.status) && (
                    <div className="mt-3 pt-3 border-t border-grey-100">
                      <div className="text-[11px] font-bold text-grey-300 mb-1">묶음 삭제</div>
                      <p className="text-[11px] text-grey-400 mb-1.5">
                        승인 전에만 삭제할 수 있습니다. 수업 항목은 지워지지 않고 <b>미배치</b>로 돌아가
                        다음 마감에 다시 잡힙니다. 이 묶음에 넣은 <b>관리자 조정은 묶음과 함께 사라지고</b>,
                        마감 뒤 재판정으로 생긴 이월 조정은 남아 다음 마감에 다시 잡힙니다.
                      </p>
                      <button
                        disabled={busyId === b.id}
                        onClick={() => handleDelete(b.id)}
                        data-testid={`delete-batch-${b.id}`}
                        className="text-[12px] font-bold px-3 py-1.5 rounded-lg border-[1.5px] border-red/30 text-red disabled:opacity-50"
                      >
                        묶음 삭제
                      </button>
                    </div>
                  )}

                  {(IN_FLIGHT_STATUSES.has(b.status) || b.status === "failed") && (
                    <div className="mt-3 pt-3 border-t border-grey-100">
                      <div className="text-[11px] font-bold text-grey-300 mb-1">지급 실패 기록</div>
                      <p className="text-[11px] text-grey-400 mb-1.5">
                        Wise 송금 요청 뒤 실패한 건을 사유와 함께 기록합니다. 실패로 기록해도 금액은
                        바뀌지 않습니다.
                      </p>
                    <div className="flex items-center gap-2">
                      <input
                        placeholder="지급 실패 사유(예: 계좌 오류로 송금 반려)"
                        value={failReasonDraft[b.id] ?? ""}
                        onChange={(e) =>
                          setFailReasonDraft((prev) => ({ ...prev, [b.id]: e.target.value }))
                        }
                        className="px-2.5 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12px] flex-1"
                      />
                      <button
                        disabled={busyId === b.id}
                        onClick={() => handleMarkFailed(b.id)}
                        className="text-[12px] font-semibold text-red-600 disabled:opacity-50"
                      >
                        실패 처리
                      </button>
                    </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// P4-2 — 정산 탭 서브탭(배치 / 수취 계좌).
function SettlementSubtabs({
  subtab,
  onChange,
}: {
  subtab: "batches" | "accounts";
  onChange: (v: "batches" | "accounts") => void;
}) {
  const tabs: { id: "batches" | "accounts"; label: string }[] = [
    { id: "batches", label: "정산 배치" },
    { id: "accounts", label: "수취 계좌" },
  ];
  return (
    <div className="flex gap-4 mb-4 border-b border-grey-200">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={
            "text-[13.5px] font-semibold pb-2.5 -mb-px border-b-2 " +
            (subtab === t.id ? "text-ink border-ink" : "text-grey-500 border-transparent")
          }
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// P4-2(UAT 후속) — 버튼을 눌렀는데 아무 반응이 없던 문제를 없애기 위해, 필수값은
// 제출 전에 각 입력칸 바로 아래에서 알려준다.
function ExternalField({
  label,
  required,
  hint,
  error,
  testId,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[11.5px] font-bold text-grey-400 mb-0.5">
        {label}
        {required && <span className="text-red ml-0.5">*</span>}
      </div>
      {children}
      {hint && <div className="text-[11px] text-grey-400 mt-0.5">{hint}</div>}
      {error && (
        <div className="text-[11px] text-red mt-0.5" data-testid={`${testId}-error`}>
          {error}
        </div>
      )}
    </div>
  );
}
