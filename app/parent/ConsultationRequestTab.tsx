"use client";

// R12.1 — 보호자 포털 "상담 신청" 서브탭. 신청 폼만 다룬다(단일 "상담 사유" 입력).
// 신청 내역·리뷰 열람은 ConsultationHistoryTab에서, 대화는 MessengerTab에서 다룬다.

import { useState } from "react";
import { submitMeetingRequest } from "./inquiry-actions";

export default function ConsultationRequestTab() {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!reason.trim()) {
      setError("상담 사유를 입력해주세요.");
      return;
    }
    setSubmitting(true);
    const result = await submitMeetingRequest({ reason });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setReason("");
    setSubmitted(true);
  }

  return (
    <div className="max-w-[720px] px-5 py-6">
      <h2 className="text-[16px] font-bold text-ink mb-1">상담 신청</h2>
      <p className="text-[12.5px] text-grey-500 mb-5">
        상담 사유를 입력해 상담을 신청할 수 있습니다. 신청 진행 상황과 대화는 각각 &quot;상담 내역&quot;·&quot;메신저&quot;에서 확인해주세요.
      </p>

      <section className="border-[1.5px] border-grey-200 rounded-xl p-4">
        {error && <p className="text-[12.5px] text-red mb-2">{error}</p>}
        {submitted && <p className="text-[12.5px] text-green-600 mb-2">상담 신청이 접수되었습니다.</p>}
        <textarea
          aria-label="상담 사유"
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setSubmitted(false);
          }}
          placeholder="상담 사유를 입력해주세요"
          className="w-full px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px] min-h-[120px]"
        />
        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          className="mt-3 px-6 py-2.5 rounded-xl bg-red text-white text-[13px] font-bold disabled:opacity-50"
        >
          {submitting ? "신청 중..." : "상담 신청하기"}
        </button>
      </section>
    </div>
  );
}
