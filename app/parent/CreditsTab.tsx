"use client";

import { useState } from "react";
import type { ParentCreditsData } from "./credits-data";

// 2026-09-07 — 이 컴포넌트는 원래 "수업권 잔여 장수 조회 + 충전" 화면이었으나,
// R4에서 도입된 EntitlementsTab("수업권" 탭, entitlements-data.ts/purchases/
// entitlement_grants 기반)이 그 역할을 완전히 대체했다. 레거시 `students.
// credit_balance`/`credit_packages`(이 컴포넌트가 쓰던 데이터)는 R4 전환 이후
// 실제 구매로 절대 갱신되지 않는데, 두 탭이 똑같이 "수업권"이라는 이름으로
// 나란히 떠 있어 보호자가 최신 잔여 수업권을 확인할 때 이 탭(레거시, 항상 0)을
// 보고 "결제했는데 0장"이라고 오인하는 실제 버그가 발생했다(제품 오너 실사용
// 확인, `docs/CURRENT.md` 2026-09-07 항목). 잔여 장수/충전 UI는 제거하고
// 지인 추천 코드만 남긴다 — referral_code는 여전히 이 테이블(parents)이
// source of truth라 데이터 로더(`credits-data.ts`)는 그대로 재사용한다.
export default function CreditsTab({ data }: { data: ParentCreditsData }) {
  return (
    <div className="max-w-[560px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-5">지인 추천</h1>
      {data.referralCode ? (
        <ReferralCard code={data.referralCode} />
      ) : (
        <p className="text-[13px] text-grey-500">추천 코드가 아직 없습니다.</p>
      )}
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
