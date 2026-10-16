"use client";

import { useState } from "react";
import { recordClosedAccountAccess } from "./users-actions";

// R12(Section 2, 2026-09-24) — closed 계정은 일반 관리자 화면에서도 사유
// 입력 없이 상세를 열 수 없다(§4.13). 사유를 입력하고 통과하면 그 세션
// 동안만(페이지 새로고침 전까지) 상세 화면을 보여준다 — 매 렌더마다 다시
// 묻지 않되, 감사 기록은 record_closed_account_access()가 이미 남긴다.
export default function ClosedAccountAccessGate({
  profileId,
  name,
  onBack,
  children,
}: {
  profileId: string;
  name: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [granted, setGranted] = useState(false);

  async function handleSubmit() {
    const trimmed = reason.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    try {
      await recordClosedAccountAccess(profileId, trimmed);
      setGranted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "조회 사유 확인에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  if (granted) return <>{children}</>;

  return (
    <div className="max-w-[480px] px-8 py-8">
      <button
        onClick={onBack}
        className="text-[13px] text-grey-600 font-semibold mb-4 border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 hover:bg-grey-100 active:scale-95 transition-transform"
      >
        ← 뒤로
      </button>
      <h1 className="text-[18px] font-extrabold text-ink mb-1.5">{name} — 폐쇄된 계정</h1>
      <p className="text-[13px] text-grey-500 mb-4">
        이 계정은 폐쇄(closed) 상태입니다. 조회 사유를 입력해야 상세 정보를 볼 수 있고, 조회 사실이 감사 기록에 남습니다.
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="조회 사유를 입력하세요 (예: 법무팀 요청, 데이터 정정 확인 등)"
        className="w-full px-3 py-2 border-[1.5px] border-grey-200 rounded-lg text-[13px] mb-3"
        rows={3}
      />
      <button
        onClick={handleSubmit}
        disabled={!reason.trim() || submitting}
        className="text-[13px] font-bold px-4 py-2 rounded-lg bg-ink text-white disabled:opacity-50"
      >
        {submitting ? "확인 중..." : "사유 확인 후 열람"}
      </button>
      {error && <p className="text-[12px] text-red mt-2">{error}</p>}
    </div>
  );
}
