"use client";

import { useState } from "react";
import type { ParentCreditsData } from "./credits-data";
import { createCreditCheckoutSession } from "./credits-actions";

export default function CreditsTab({
  data,
  studentId,
  purchaseStatus,
}: {
  data: ParentCreditsData;
  studentId: string;
  purchaseStatus?: "success" | "cancelled";
}) {
  const [loadingPackageId, setLoadingPackageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePurchase(packageId: string) {
    setError(null);
    setLoadingPackageId(packageId);
    try {
      const url = await createCreditCheckoutSession(packageId, studentId);
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "결제를 시작할 수 없습니다.");
      setLoadingPackageId(null);
    }
  }

  return (
    <div className="max-w-[560px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-5">수업권</h1>

      {purchaseStatus === "success" && (
        <div className="bg-green/10 text-green text-[13px] font-semibold rounded-lg px-4 py-3 mb-4">
          결제가 완료되었습니다. 잠시 후 수업권 잔여 장수에 반영됩니다.
        </div>
      )}
      {purchaseStatus === "cancelled" && (
        <div className="bg-grey-100 text-grey-500 text-[13px] font-semibold rounded-lg px-4 py-3 mb-4">
          결제가 취소되었습니다.
        </div>
      )}

      <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4.5 mb-4">
        <h2 className="text-[14px] font-bold text-ink mb-3">수업권 현황</h2>
        <div className="text-[28px] font-extrabold text-ink mb-4">
          {data.balance}
          <span className="text-[14px] font-semibold text-grey-500 ml-1.5">
            장 보유
          </span>
        </div>

        {data.packages.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            {data.packages.map((pkg) => (
              <div
                key={pkg.id}
                className="border-[1.5px] border-grey-200 rounded-xl px-3 py-3 text-center"
              >
                <div className="text-[14px] font-bold text-ink">{pkg.name}</div>
                <div className="text-[12px] text-grey-500 mt-0.5 mb-2">
                  ${pkg.priceUsd.toLocaleString()}
                </div>
                <button
                  onClick={() => handlePurchase(pkg.id)}
                  disabled={loadingPackageId !== null}
                  className="text-[12px] font-bold text-white bg-ink rounded-lg px-2 py-1.5 w-full disabled:opacity-50"
                >
                  {loadingPackageId === pkg.id ? "이동 중…" : "충전하기"}
                </button>
              </div>
            ))}
          </div>
        )}
        {error && <p className="text-[12px] text-red mb-1">{error}</p>}
        <p className="text-[12px] text-grey-500">
          충전 버튼을 누르면 Stripe 결제 페이지로 이동합니다.
        </p>
      </div>

      {data.referralCode && <ReferralCard code={data.referralCode} />}
    </div>
  );
}

function ReferralCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // 클립보드 접근이 막힌 환경에서는 조용히 무시 — 코드가 화면에 이미 보이므로
      // 사용자가 직접 선택해 복사할 수 있다.
    }
  }

  return (
    <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4.5">
      <h2 className="text-[14px] font-bold text-ink mb-1.5">
        지인 추천하고 수업권 받기
      </h2>
      <p className="text-[12px] text-grey-500 mb-3 leading-[1.6]">
        아래 코드를 공유한 지인이 상담 신청 시 이 코드를 입력하고 정식
        계약까지 이어지면, 수업권이 자동 지급됩니다.
      </p>
      <div className="flex items-center justify-between bg-grey-100 rounded-lg px-4 py-3">
        <span className="text-[14px] font-bold text-ink tracking-wide">
          {code}
        </span>
        <button
          onClick={handleCopy}
          className="text-[12px] font-bold text-blue"
        >
          {copied ? "복사됨" : "복사"}
        </button>
      </div>
    </div>
  );
}
