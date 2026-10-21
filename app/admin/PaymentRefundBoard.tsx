"use client";

import { useCallback, useEffect, useState } from "react";
import { listPaymentRefundBoard, listPaymentRefundPage, resolvePaymentRefund, resolvePaymentWebhookIssue } from "./payment-refund-actions";
import { PENDING_LIMIT, type BoardCounts, type PaymentRefundBoardItem, type PaymentWebhookIssueItem } from "./payment-refund-data";
import { useViewerTimezone } from "@/app/components/ViewerTimezoneProvider";
import { fmtDateTime } from "@/lib/format-datetime";

// "결제 실패·대사" 탭 안의 Stripe 환불 처리·웹훅 이상 확인 섹션.
// 환불 기록은 웹훅이 항상 남긴다. 수업권 회수는 자동(플래그, 기본 꺼짐) 또는 여기서 관리자가 수동으로 한다.
const btnPrimary = "text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50";
const btnSecondary =
  "text-[12px] font-bold text-ink border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 disabled:opacity-50";
const card = "border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3";
const input = "border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[12.5px]";

const money = (minor: number, currency: string) => `${(minor / 100).toLocaleString()} ${currency}`;

const ISSUE_LABEL: Record<string, string> = {
  livemode_mismatch: "테스트/라이브 모드 불일치",
  amount_mismatch: "결제 금액·통화 불일치",
  purchase_not_found: "구매 기록 없음",
  legacy_amount_mismatch: "레거시 크레딧 금액 불일치",
};

/** 자동 회수 결과 또는 수동 처리 사유를 사람이 읽는 문장으로. */
function revokeNote(r: PaymentRefundBoardItem): string {
  if (r.handledAt) return r.handledAction === "revoke" ? "수동 회수 완료" : "확인 완료(수업권 변경 없음)";
  const map: Record<string, string> = {
    revoked: "자동 회수됨",
    already_revoked: "자동 회수됨",
    not_full_refund: "수동 처리 필요: 부분 환불 또는 환불 미확정",
    partially_used_or_reserved: "수동 처리 필요: 수업권 일부 사용·예약 이력",
    no_grant: "수동 처리 필요: 지급된 수업권 없음",
  };
  if (r.autoRevokeStatus) return map[r.autoRevokeStatus] ?? `수동 처리 필요: ${r.autoRevokeStatus}`;
  return "자동 회수 꺼짐 — 관리자 확인 필요";
}

export default function PaymentRefundBoard() {
  const tz = useViewerTimezone();
  const [refunds, setRefunds] = useState<PaymentRefundBoardItem[] | null>(null);
  const [issues, setIssues] = useState<PaymentWebhookIssueItem[]>([]);
  const [counts, setCounts] = useState<BoardCounts | null>(null);
  const [filter, setFilter] = useState<"all" | "review" | "stripe_issue">("all");
  const [error, setError] = useState<string | null>(null);
  const [paging, setPaging] = useState<"pending" | "done" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteById, setNoteById] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const board = await listPaymentRefundBoard();
      setRefunds(board.refunds);
      setIssues(board.issues);
      setCounts(board.counts ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오지 못했습니다.");
      setRefunds([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** 제한(처리 대기 1,000건·처리 완료 최근 100건) 밖의 기록을 키셋 커서로 이어서 불러온다. */
  async function loadMore(kind: "pending" | "done") {
    const list = (refunds ?? []).filter((r) => (kind === "pending" ? !r.handledAt : r.handledAt));
    const last = list[list.length - 1];
    const at = kind === "pending" ? last?.createdAt : last?.handledAt;
    if (!last || !at) return;
    setPaging(kind);
    setError(null);
    try {
      const page = await listPaymentRefundPage({ kind, after: { at, id: last.id } });
      setRefunds((prev) => {
        const seen = new Set((prev ?? []).map((r) => r.id));
        return [...(prev ?? []), ...page.items.filter((r) => !seen.has(r.id))];
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오지 못했습니다.");
    } finally {
      setPaging(null);
    }
  }

  async function run(id: string, fn: () => Promise<void>) {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      setNoteById((prev) => ({ ...prev, [id]: "" }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리하지 못했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  const pending = (refunds ?? []).filter((r) => !r.handledAt).filter((r) => (filter === "review" ? r.needsReview : filter === "stripe_issue" ? r.status !== "succeeded" : true));
  const done = (refunds ?? []).filter((r) => r.handledAt);
  const pendingLoaded = (refunds ?? []).filter((r) => !r.handledAt).length;
  const pendingHidden = counts ? Math.max(0, counts.refundsPending - pendingLoaded) : 0;
  const doneHidden = counts ? Math.max(0, counts.refundsDone - done.length) : 0;
  const openIssues = issues.filter((i) => !i.resolvedAt);
  const doneIssues = issues.filter((i) => i.resolvedAt);

  return (
    <div className="mt-8">
      <h3 className="text-[14px] font-extrabold text-ink mb-2">Stripe 환불 처리</h3>
      <p className="text-[12px] text-grey-500 mb-3">
        Stripe 에서 환불된 결제의 기록입니다. 수업권 회수는 &quot;회수&quot;(해당 구매의 수업권만, 미래 예약이 있으면 중단)
        또는 &quot;확인 완료&quot;(수업권 변경 없음)로 사유를 남기고 처리합니다. 한 번 처리된 기록은 다시 처리할 수 없습니다.
      </p>
      {error && (
        <p role="alert" className="text-[12.5px] text-red mb-3">
          {error}
        </p>
      )}
      {counts && (
        <div className="flex flex-wrap items-center gap-3 mb-3" data-testid="refund-counts">
          <span className="text-[12px] text-grey-500">
            환불 기록 {counts.refundsTotal}건 · 서버 처리 대기 {counts.refundsPending}건 중 {pendingLoaded}건 불러옴 · 처리 완료 {counts.refundsDone}건 중 {done.length}건 불러옴
          </span>
          <label className="text-[12px] text-grey-500">
            필터(불러온 대기 건에만 적용){" "}
            <select aria-label="환불 필터" className={input} value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
              <option value="all">불러온 처리 대기 전체</option>
              <option value="review">확인 필요만</option>
              <option value="stripe_issue">Stripe 상태 비성공만</option>
            </select>
          </label>
          {pendingHidden > 0 && (
            <p className="w-full text-[12px] text-red" role="status" data-testid="refund-truncated">
              처리 대기가 많아 오래된 순 {PENDING_LIMIT.toLocaleString()}건까지만 먼저 표시했습니다. 아직 표시되지 않은 대기 {pendingHidden}건이 있습니다.{" "}
              <button className={btnSecondary} disabled={paging !== null} onClick={() => void loadMore("pending")}>
                {paging === "pending" ? "불러오는 중…" : "처리 대기 더 불러오기"}
              </button>
            </p>
          )}
        </div>
      )}
      {refunds === null ? (
        <p className="text-[13px] text-grey-500">불러오는 중…</p>
      ) : pending.length === 0 ? (
        <p className="text-[13px] text-grey-500 mb-4">처리 대기 중인 환불 기록이 없습니다.</p>
      ) : (
        pending.map((r) => {
          const note = noteById[r.id] ?? "";
          const stripeOk = r.status === "succeeded";
          return (
            <div key={r.id} className={card} data-testid="refund-pending">
              <div className="text-[13.5px] font-bold text-ink">
                환불 {money(r.amountMinor, r.currency)} · Stripe 상태: {r.status ?? "미확인"}
                {!stripeOk && " (성공이 아니므로 회수하지 않음)"}
              </div>
              <div className="text-[12px] text-grey-500 mt-0.5">
                {r.purchaseId ? `구매 ID: ${r.purchaseId}` : "구매 미연결 환불"}
                {r.purchase && ` · 구매 총액 ${money(r.purchase.totalMinor, r.purchase.currency)} · 구매 상태 ${r.purchase.status}`}
              </div>
              {r.entitlement ? (
                <div className="text-[12px] text-grey-500 mt-0.5">
                  수업권: 지급 {r.entitlement.granted} · 잔여 {r.entitlement.balance} · 소비 {r.entitlement.consumed} · 예약 점유{" "}
                  {r.entitlement.activeHolds} · 회수 {r.entitlement.refunded}
                </div>
              ) : (
                <div className="text-[12px] text-grey-500 mt-0.5">수업권: 이 구매로 지급된 기록 없음</div>
              )}
              <div className="text-[12px] text-ink mt-0.5">{revokeNote(r)} · 접수 {fmtDateTime(r.createdAt, undefined, tz)}</div>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <input
                  aria-label="처리 사유"
                  className={input}
                  placeholder="처리 사유(필수)"
                  value={note}
                  onChange={(e) => setNoteById((prev) => ({ ...prev, [r.id]: e.target.value }))}
                />
                <button
                  className={btnPrimary}
                  disabled={busyId === r.id || !note.trim() || !stripeOk || !r.purchaseId}
                  onClick={() => run(r.id, () => resolvePaymentRefund({ refundId: r.id, action: "revoke", note }))}
                >
                  {busyId === r.id ? "처리 중…" : "수업권 회수"}
                </button>
                <button
                  className={btnSecondary}
                  disabled={busyId === r.id || !note.trim()}
                  onClick={() => run(r.id, () => resolvePaymentRefund({ refundId: r.id, action: "dismiss", note }))}
                >
                  확인 완료
                </button>
              </div>
            </div>
          );
        })
      )}
      {done.length > 0 && (
        <details className="mb-5">
          <summary className="text-[12.5px] text-grey-500 cursor-pointer">처리 완료 {done.length}건 표시{counts ? ` (전체 ${counts.refundsDone}건)` : ""}</summary>
          {done.map((r) => (
            <div key={r.id} className={card} data-testid="refund-done">
              <div className="text-[13px] font-bold text-ink">
                환불 {money(r.amountMinor, r.currency)} · {revokeNote(r)}
              </div>
              <div className="text-[12px] text-grey-500 mt-0.5">
                구매 ID: {r.purchaseId ?? "미연결"} · 처리자 {r.handledBy ?? "-"} · {r.handledAt ? fmtDateTime(r.handledAt, undefined, tz) : ""} ·
                사유: {r.handledNote}
              </div>
            </div>
          ))}
          {doneHidden > 0 && (
            <button className={btnSecondary} disabled={paging !== null} onClick={() => void loadMore("done")}>
              {paging === "done" ? "불러오는 중…" : `이전 처리 기록 더 보기(${doneHidden}건 남음)`}
            </button>
          )}
        </details>
      )}

      <h3 className="text-[14px] font-extrabold text-ink mt-6 mb-2">결제 웹훅 이상(모드·금액 불일치 등)</h3>
      <p className="text-[12px] text-grey-500 mb-3">
        이상이 있는 결제는 수업권이 자동 지급되지 않습니다. 원인을 확인(설정 수정 후 Stripe 에서 이벤트 재전송 등)한 뒤 사유를 남기고 해결 처리하세요.
      </p>
      {openIssues.length === 0 ? (
        <p className="text-[13px] text-grey-500">확인이 필요한 항목이 없습니다.</p>
      ) : (
        openIssues.map((i) => {
          const note = noteById[i.id] ?? "";
          return (
            <div key={i.id} className={card} data-testid="issue-open">
              <div className="text-[13.5px] font-bold text-ink">{ISSUE_LABEL[i.kind] ?? i.kind}</div>
              <div className="text-[12px] text-grey-500 mt-0.5">
                이벤트 {i.eventId}
                {i.purchaseId ? ` · 구매 ID: ${i.purchaseId}` : ""} · {fmtDateTime(i.createdAt, undefined, tz)}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <input
                  aria-label="확인 사유"
                  className={input}
                  placeholder="확인 사유(필수)"
                  value={note}
                  onChange={(e) => setNoteById((prev) => ({ ...prev, [i.id]: e.target.value }))}
                />
                <button
                  className={btnPrimary}
                  disabled={busyId === i.id || !note.trim()}
                  onClick={() => run(i.id, () => resolvePaymentWebhookIssue({ issueId: i.id, note }))}
                >
                  {busyId === i.id ? "처리 중…" : "해결 처리"}
                </button>
              </div>
            </div>
          );
        })
      )}
      {counts && (
        <p className="text-[12px] text-grey-500 mt-2" data-testid="issue-counts">
          웹훅 이상 {counts.issuesTotal}건 중 {counts.issuesShown}건 표시 · 미해결 {counts.issuesOpen}건(미해결은 항상 전부 표시)
        </p>
      )}
      {doneIssues.length > 0 && (
        <p className="text-[12px] text-grey-500 mt-2">해결 완료 {doneIssues.length}건(기록은 보존됩니다).</p>
      )}
    </div>
  );
}
