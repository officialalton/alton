"use client";

import { useState } from "react";
import { setStudentStatus, adjustStudentCredit } from "./users-actions";
import type { CreditTransaction, StudentListItem } from "./users-data";

const STATUS_LABEL: Record<string, string> = {
  active: "활성",
  pending: "매칭 대기",
  inactive: "비활성",
};

const TX_TYPE_LABEL: Record<string, string> = {
  purchase: "구매",
  debit: "차감",
  refund: "환불",
  adjustment: "조정",
  referral_bonus: "추천 보너스",
};

export default function StudentDetailPanel({
  student,
  history,
  onBack,
  onUpdated,
}: {
  student: StudentListItem;
  history: CreditTransaction[];
  onBack: () => void;
  onUpdated: (patch: Partial<StudentListItem>, newTx?: CreditTransaction) => void;
}) {
  const [status, setStatus] = useState(student.status);
  const [amount, setAmount] = useState(0);
  const [type, setType] = useState<"refund" | "adjustment">("adjustment");
  const [reason, setReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStatusChange(next: string) {
    setStatus(next);
    await setStudentStatus(student.id, next as "active" | "pending" | "inactive");
    onUpdated({ status: next });
  }

  async function handleAdjust() {
    setError(null);
    if (amount === 0 || !reason.trim() || adjusting) return;
    setAdjusting(true);
    try {
      const { newBalance, transactionId } = await adjustStudentCredit({
        studentId: student.id,
        amount,
        type,
        reason,
      });
      onUpdated(
        { creditBalance: newBalance },
        { id: transactionId, type, amount, reason, createdAt: new Date().toISOString() }
      );
      setAmount(0);
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "조정에 실패했습니다.");
    } finally {
      setAdjusting(false);
    }
  }

  return (
    <div className="max-w-[640px] px-8 py-8">
      <button onClick={onBack} className="text-[13px] text-grey-500 font-semibold mb-4">
        ← 뒤로
      </button>
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">{student.name}</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        {student.email} {student.grade ? `· ${student.grade}` : ""}
      </p>

      <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4">
        <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">
          상태
        </div>
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[13px] font-semibold"
        >
          {Object.entries(STATUS_LABEL).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4">
        <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">
          학부모 / 담당 과목
        </div>
        <p className="text-[13px] text-ink">
          {student.parentNames.length ? student.parentNames.join(", ") : "연결된 학부모 없음"}
        </p>
        <p className="text-[13px] text-ink mt-1">
          {student.subjectNames.length ? student.subjectNames.join(", ") : "매칭된 과목 없음"}
        </p>
      </div>

      <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide">
            수업권
          </div>
          <div className="text-[16px] font-extrabold text-ink">{student.creditBalance}장</div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-2.5">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            placeholder="+/- 장수"
            className="px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px]"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "refund" | "adjustment")}
            className="px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px]"
          >
            <option value="adjustment">조정(굿윌/오류정정/기타)</option>
            <option value="refund">환불</option>
          </select>
        </div>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="조정 사유 (필수)"
          className="w-full px-3 py-1.5 border-[1.5px] border-grey-200 rounded-lg text-[12.5px] mb-2.5"
        />
        <button
          disabled={amount === 0 || !reason.trim() || adjusting}
          onClick={handleAdjust}
          className="text-[12px] font-bold px-3.5 py-2 rounded-lg bg-ink text-white disabled:opacity-50"
        >
          {adjusting ? "적용 중..." : "조정 적용"}
        </button>
        {error && <p className="text-[12px] text-red mt-2">{error}</p>}

        {history.length > 0 && (
          <div className="mt-4 pt-3 border-t border-grey-200">
            <div className="text-[11px] font-bold text-grey-300 uppercase tracking-wide mb-2">
              조정 내역
            </div>
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between text-[12.5px] py-1">
                <span className="text-ink">
                  {TX_TYPE_LABEL[h.type] ?? h.type}
                  {h.reason ? ` · ${h.reason}` : ""}
                </span>
                <span className={"font-bold " + (h.amount >= 0 ? "text-green" : "text-red")}>
                  {h.amount >= 0 ? `+${h.amount}` : h.amount}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
