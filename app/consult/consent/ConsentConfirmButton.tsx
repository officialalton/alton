"use client";

import { useState } from "react";
import { confirmConsultConsent } from "@/app/consult-actions";
import { useViewerTimezone } from "@/app/components/ViewerTimezoneProvider";
import { fmtDateTime } from "@/lib/format-datetime";

export default function ConsentConfirmButton({
  token,
  alreadyConfirmedAt,
}: {
  token: string;
  alreadyConfirmedAt: string | null;
}) {
  const tz = useViewerTimezone();
  const [confirmedAt, setConfirmedAt] = useState<string | null>(alreadyConfirmedAt);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (confirmedAt) {
    return (
      <p className="text-[13.5px] font-bold text-ink">
        확인 완료 ({fmtDateTime(confirmedAt, undefined, tz)}) — 다시 확인하실 필요가 없습니다.
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
            await confirmConsultConsent(token);
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
