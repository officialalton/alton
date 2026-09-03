"use client";

import { useState } from "react";
import { recordTrialSmartNotesConsent } from "@/app/consult/trial-onboarding-actions";

// placeholder 정책 버전 — 법률 문구 확정 전까지는 이 텍스트가 최종 확정본이
// 아니라는 점을 코드 주석으로도 남겨둔다(요구사항: placeholder를 확정본처럼
// 표현 금지). 실제 노출 문구는 여기 하드코딩하지 않고, 동의 자체는 이
// 버전 키만으로 기록한다.
const TRIAL_SMART_NOTES_POLICY_VERSION = "trial_smart_notes_v0.1_placeholder";

export default function TrialConsentButton({ childId }: { childId: string }) {
  const [consented, setConsented] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (consented) {
    return (
      <div className="text-[12.5px] text-green-600">
        동의 완료 — 체험수업권 지급 완료. 체험 예약을 진행할 수 있습니다.
      </div>
    );
  }

  return (
    <div>
      {error && <div className="text-[12px] text-red-600 mb-1.5">{error}</div>}
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await recordTrialSmartNotesConsent({ childId, policyVersion: TRIAL_SMART_NOTES_POLICY_VERSION });
            setConsented(true);
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          }
          setBusy(false);
        }}
        className="text-[13px] font-bold px-4 py-2 rounded-lg bg-ink text-white disabled:opacity-50"
      >
        {busy ? "처리 중..." : "Smart Notes 이용에 동의합니다"}
      </button>
    </div>
  );
}
