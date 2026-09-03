"use client";

import { useState } from "react";
import { confirmConsultConsent } from "@/app/consult-actions";

export default function ConsentConfirmButton({
  consultationId,
  alreadyConfirmedAt,
}: {
  consultationId: string;
  alreadyConfirmedAt: string | null;
}) {
  const [confirmedAt, setConfirmedAt] = useState<string | null>(alreadyConfirmedAt);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (confirmedAt) {
    return (
      <p className="text-[13.5px] font-bold text-ink">
        확인 완료 ({new Date(confirmedAt).toLocaleString("ko-KR")}) — 다시 확인하실 필요가 없습니다.
      </p>
    );
  }

  return (
    <div>
      {error && <p className="text-[13px] text-red mb-3">{error}</p>}
      <button
        disabled={submitting}
        className="px-8 py-3.5 rounded-xl bg-red text-white text-[15px] font-bold disabled:opacity-50"
        onClick={async () => {
          setSubmitting(true);
          setError(null);
          try {
            await confirmConsultConsent(consultationId);
            setConfirmedAt(new Date().toISOString());
          } catch (e) {
            setError(e instanceof Error ? e.message : "확인 처리에 실패했습니다.");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {submitting ? "처리 중..." : "안내 내용을 확인했습니다"}
      </button>
    </div>
  );
}
