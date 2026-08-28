"use client";

import { useState } from "react";
import { requestParentPayment } from "./credits-actions";
import type { CreditsData } from "./credits-data";

export default function CreditsTab({ data }: { data: CreditsData }) {
  const [requesting, setRequesting] = useState(false);
  const [confirmedFor, setConfirmedFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRequest() {
    if (requesting) return;
    setRequesting(true);
    setError(null);
    try {
      const { guardianName } = await requestParentPayment();
      setConfirmedFor(guardianName);
    } catch (e) {
      setError(e instanceof Error ? e.message : "요청에 실패했습니다.");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div className="max-w-[480px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1.5">수업권</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        보유한 수업권 현황을 확인하세요. 충전은 학부모 계정에서 진행됩니다.
      </p>

      <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4.5">
        <h2 className="text-[14px] font-bold text-ink mb-3">수업권 현황</h2>
        <div className="text-[28px] font-extrabold text-ink">
          {data.balance}
          <span className="text-[14px] font-semibold text-grey-500 ml-1.5">
            장 보유
          </span>
        </div>

        {data.guardianName ? (
          <button
            disabled={requesting}
            onClick={handleRequest}
            className="w-full mt-3.5 text-[13px] font-bold px-4 py-2.5 rounded-lg bg-ink text-white disabled:opacity-50"
          >
            {requesting ? "요청 중..." : "부모님께 결제 요청"}
          </button>
        ) : (
          <p className="text-[12px] text-grey-500 mt-3.5">
            연결된 학부모 계정이 없어 결제 요청을 보낼 수 없습니다.
          </p>
        )}

        {confirmedFor && (
          <p className="text-[13px] font-semibold text-green mt-3">
            {confirmedFor} 학부모님께 수업권 충전 요청 알림을 보냈습니다.
          </p>
        )}
        {error && (
          <p className="text-[13px] font-semibold text-red mt-3">{error}</p>
        )}
      </div>
    </div>
  );
}
