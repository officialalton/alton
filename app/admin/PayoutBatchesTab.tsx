"use client";

import { useState } from "react";
import type { PayoutBatchListItem } from "./payout-batches-data";
import { previousMonthRange } from "./payouts-data";
import {
  generatePayoutBatches,
  submitPayoutBatchForReview,
  approvePayoutBatch,
  markPayoutBatchFailed,
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

const ACTIONABLE_DRAFT = new Set(["draft", "calculated"]);
const ACTIONABLE_REVIEW = new Set(["draft", "calculated", "reviewing", "reviewed"]);
// R10 corrective(요구사항 4, 2026-09-07 리뷰): mark_payout_batch_failed()가
// 실제로 허용하는 상태와 정확히 일치시킨다(supabase/migrations/
// 20261224000000_r10_paid_transition_guard_and_reversal_fix.sql). 이 화면이
// 실제로 도달시킬 수 있는 상태는 draft/calculated/reviewing/reviewed/approved
// 뿐이지만(processing/dispatch_requested/provider_pending은 게이트가 닫혀
// 있어 이 화면에서 만들 수 없음), 버튼 노출 조건은 "DB가 허용하는 상태
// 전체"와 맞춰 향후 상태가 추가돼도 어긋나지 않게 한다. paid/failed는
// 절대 포함하지 않는다.
const ACTIONABLE_FAILED = new Set([
  "draft",
  "calculated",
  "reviewing",
  "reviewed",
  "approved",
  "processing",
  "dispatch_requested",
  "provider_pending",
]);

function money(amountMinor: number, currency: string): string {
  const amount = currency === "KRW" ? amountMinor : amountMinor / 100;
  return `${amount.toLocaleString()} ${currency}`;
}

export default function PayoutBatchesTab({
  initialBatches,
}: {
  initialBatches: PayoutBatchListItem[];
}) {
  const [batches, setBatches] = useState(initialBatches);
  const defaults = previousMonthRange(new Date());
  const [periodStart, setPeriodStart] = useState(defaults.periodStart);
  const [periodEnd, setPeriodEnd] = useState(defaults.periodEnd);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [failReasonDraft, setFailReasonDraft] = useState<Record<string, string>>({});

  async function refresh() {
    // 서버 컴포넌트 재로드 대신, batch 액션 성공 시 페이지 새로고침으로
    // 최신 payout_batches/payout_items/audit_log를 다시 읽는다(단순함 우선).
    window.location.reload();
  }

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

  return (
    <div className="max-w-[900px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1">정산</h1>
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
          onClick={handleGenerate}
          className="text-[12px] font-bold px-3.5 py-2 rounded-lg border-[1.5px] border-grey-200 disabled:opacity-50"
        >
          {generating ? "생성 중..." : "Batch 생성"}
        </button>
      </div>
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
                    <div key={it.id} className="text-[12px] text-grey-500 flex justify-between py-0.5">
                      <span>
                        {it.itemType} · {it.payableMinutes}분
                      </span>
                      <span>{money(it.amountMinor, it.currency)}</span>
                    </div>
                  ))}

                  <div className="text-[11px] font-bold text-grey-300 mt-3 mb-1">감사 로그</div>
                  {b.auditLog.length === 0 ? (
                    <p className="text-[12px] text-grey-400">기록 없음</p>
                  ) : (
                    b.auditLog.map((a) => (
                      <div key={a.id} className="text-[12px] text-grey-500 py-0.5">
                        {new Date(a.createdAt).toLocaleString("ko-KR")} · {a.action} ·{" "}
                        {a.actorName ?? "시스템"}
                        {a.note ? ` · ${a.note}` : ""}
                      </div>
                    ))
                  )}

                  {b.status === "failed" && b.failureReason && (
                    <div className="mt-2 text-[12px] text-red-600">실패 사유: {b.failureReason}</div>
                  )}

                  {ACTIONABLE_FAILED.has(b.status) && (
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        placeholder="실패 사유"
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
