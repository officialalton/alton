"use client";

import { useState } from "react";
import type { PayoutListItem } from "./payouts-data";
import {
  generatePayouts,
  markPayoutPaid,
  markPayoutsPaidBulk,
  revertPayoutToPending,
} from "./payouts-actions";

function previousMonthDefaults(): { start: string; end: string } {
  const now = new Date();
  const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfPrevMonth = new Date(firstOfThisMonth.getTime() - 1);
  const firstOfPrevMonth = new Date(lastOfPrevMonth.getFullYear(), lastOfPrevMonth.getMonth(), 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(firstOfPrevMonth), end: fmt(lastOfPrevMonth) };
}

export default function PayoutsTab({ initialPayouts }: { initialPayouts: PayoutListItem[] }) {
  const [payouts, setPayouts] = useState(initialPayouts);
  const defaults = previousMonthDefaults();
  const [periodStart, setPeriodStart] = useState(defaults.start);
  const [periodEnd, setPeriodEnd] = useState(defaults.end);
  const [generating, setGenerating] = useState(false);
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const pendingIds = payouts.filter((p) => p.status === "pending").map((p) => p.id);

  async function handleGenerate() {
    setGenerating(true);
    setGenerateMessage(null);
    try {
      const result = await generatePayouts({ periodStart, periodEnd });
      setGenerateMessage(
        `${result.created}건 생성됨` +
          (result.skippedNoRate.length > 0
            ? ` · 시급 미설정으로 건너뜀: ${result.skippedNoRate.map((s) => s.teacherName).join(", ")}`
            : "")
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleApprove(id: string) {
    setProcessingId(id);
    try {
      await markPayoutPaid(id);
      setPayouts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: "paid" as const, paidAt: new Date().toISOString() } : p))
      );
    } finally {
      setProcessingId(null);
    }
  }

  async function handleRevert(id: string) {
    setProcessingId(id);
    try {
      await revertPayoutToPending(id);
      setPayouts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: "pending" as const, paidAt: null } : p))
      );
    } finally {
      setProcessingId(null);
    }
  }

  async function handleApproveAll() {
    if (pendingIds.length === 0) return;
    setBulkProcessing(true);
    try {
      await markPayoutsPaidBulk(pendingIds);
      setPayouts((prev) =>
        prev.map((p) =>
          pendingIds.includes(p.id)
            ? { ...p, status: "paid" as const, paidAt: new Date().toISOString() }
            : p
        )
      );
    } finally {
      setBulkProcessing(false);
    }
  }

  return (
    <div className="max-w-[820px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1">정산</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        매달 1일 전월분이 자동 생성됩니다. 수기로 송금하신 뒤 승인해주세요.
      </p>

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
          {generating ? "생성 중..." : "정산 생성"}
        </button>
        {pendingIds.length > 0 && (
          <button
            disabled={bulkProcessing}
            onClick={handleApproveAll}
            className="text-[12px] font-bold px-3.5 py-2 rounded-lg bg-ink text-white disabled:opacity-50"
          >
            전체 승인
          </button>
        )}
      </div>
      {generateMessage && <p className="text-[12px] text-grey-500 mb-4">{generateMessage}</p>}

      {payouts.length === 0 ? (
        <p className="text-[13px] text-grey-500">정산 내역이 없습니다.</p>
      ) : (
        payouts.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-2.5"
          >
            <div>
              <div className="text-[13.5px] font-bold text-ink">{p.teacherName}</div>
              <div className="text-[12px] text-grey-500">
                {p.periodStart} ~ {p.periodEnd} · <span>{p.amountKrw.toLocaleString()}원</span>
              </div>
            </div>
            {p.status === "pending" ? (
              <button
                disabled={processingId === p.id}
                onClick={() => handleApprove(p.id)}
                className="text-[12px] font-bold px-3.5 py-2 rounded-lg bg-ink text-white disabled:opacity-50"
              >
                승인
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-grey-100 text-ink">
                  완료
                </span>
                <button
                  disabled={processingId === p.id}
                  onClick={() => handleRevert(p.id)}
                  className="text-[12px] font-semibold text-grey-500 disabled:opacity-50"
                >
                  완료 취소
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
