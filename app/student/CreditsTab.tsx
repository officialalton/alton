"use client";

import { useState } from "react";
import { requestParentPayment } from "./credits-actions";
import type { CreditsData } from "./credits-data";
import { useViewerTimezone } from "@/app/components/ViewerTimezoneProvider";
import { fmtIntlEn } from "@/lib/format-datetime-en";

function formatDate(iso: string | null, tz: string): string {
  if (!iso) return "-";
  return fmtIntlEn(new Date(iso), { year: "numeric", month: "long", day: "numeric" }, tz);
}

export default function CreditsTab({ data }: { data: CreditsData }) {
  const tz = useViewerTimezone();
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
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div className="max-w-[480px]">
      <p className="text-[13px] text-grey-500 mb-5">
        Check your lesson credits here. Purchases are made from the parent account.
      </p>

      {(data.regularRemaining > 0 || data.trialEntitlement) && (
        <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4.5 mb-4">
          <h2 className="text-[14px] font-bold text-ink mb-3">Your Lesson Credits</h2>
          {data.regularRemaining > 0 && (
            <div className="mb-3">
              <div className="text-[13px] font-bold text-ink">
                {data.regularRemaining} regular {data.regularRemaining === 1 ? "lesson" : "lessons"} remaining
              </div>
              <div className="text-[12px] text-grey-500">
                Earliest expiry: {formatDate(data.regularNearestExpiry, tz)}
              </div>
            </div>
          )}
          {/* M2 — 60분 전용 체험수업권. 정규 수업권과 절대 합산하지 않고 별도로 보여준다
              (구매·환불·양도 불가) — app/parent/EntitlementsTab.tsx와 동일한 표기.
              잔여가 0이 되면(체험 수업 예약에 소진됨) 그냥 사라진다. */}
          {data.trialEntitlement && (
            <div className="border-[1.5px] border-grey-200 rounded-lg px-3 py-2.5 bg-grey-50">
              <p className="text-[12px] font-bold text-ink">1 trial lesson credit (60 min) available</p>
              <p className="text-[11.5px] text-grey-500 mt-0.5">
                The trial lesson must start by {formatDate(data.trialEntitlement.expiresAt, tz)} (bookings after that date cannot
                use it) · Separate from regular credits; cannot be purchased, refunded, or transferred.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4.5">
        <h2 className="text-[14px] font-bold text-ink mb-3">Credit Balance</h2>
        <div className="text-[28px] font-extrabold text-ink">
          {data.balance}
          <span className="text-[14px] font-semibold text-grey-500 ml-1.5">
            {data.balance === 1 ? "credit" : "credits"}
          </span>
        </div>

        {data.guardianName ? (
          <button
            disabled={requesting}
            onClick={handleRequest}
            className="w-full mt-3.5 text-[13px] font-bold px-4 py-2.5 rounded-lg bg-ink text-white disabled:opacity-50"
          >
            {requesting ? "Sending..." : "Ask parent to purchase"}
          </button>
        ) : (
          <p className="text-[12px] text-grey-500 mt-3.5">
            No linked parent account, so a purchase request cannot be sent.
          </p>
        )}

        {confirmedFor && (
          <p className="text-[13px] font-semibold text-green mt-3">
            A credit purchase request was sent to {confirmedFor}.
          </p>
        )}
        {error && (
          <p className="text-[13px] font-semibold text-red mt-3">{error}</p>
        )}
      </div>
    </div>
  );
}
