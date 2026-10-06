"use client";

import { useState } from "react";
import type { ParentEntitlementsData, PurchaseReceipt } from "./entitlements-data";
import { createEntitlementCheckoutSession } from "./purchase-actions";
import UnderlineSubTabs from "@/app/components/UnderlineSubTabs";
import { useViewerTimezone } from "@/app/components/ViewerTimezoneProvider";
import { fmtDate, fmtDateTime } from "@/lib/format-datetime";

function formatMoney(minor: number, currency: string): string {
  const amount = minor / 100;
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string | null, tz: string): string {
  if (!iso) return "—";
  return fmtDate(iso, undefined, tz);
}

const STATUS_LABEL: Record<string, string> = {
  created: "Awaiting payment",
  pending: "Processing payment",
  succeeded: "Paid",
  confirmed: "Paid",
  failed: "Payment failed",
  cancelled: "Payment cancelled",
};

// Stripe dispute.status 표시용 — 원문 값을 그대로 저장하므로(신규 상태 추가돼도
// 스키마 변경 불필요) 매핑에 없는 값은 원문을 그대로 보여준다.
const DISPUTE_STATUS_LABEL: Record<string, string> = {
  warning_needs_response: "Dispute warning · Response needed",
  warning_under_review: "Dispute warning · Under review",
  warning_closed: "Dispute warning · Closed",
  needs_response: "Dispute open · Response needed",
  under_review: "Dispute under review",
  charge_refunded: "Dispute · Refunded",
  won: "Dispute · Won (charge upheld)",
  lost: "Dispute · Lost",
};

const CLOSED_DISPUTE_STATUSES = new Set(["won", "lost", "charge_refunded", "warning_closed"]);

export default function EntitlementsTab({
  data,
  purchaseStatus,
}: {
  data: ParentEntitlementsData;
  purchaseStatus?: "success" | "cancelled";
}) {
  const tz = useViewerTimezone();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(
    data.children.find((c) => c.eligibleForPurchase)?.childId ?? data.children[0]?.childId ?? null
  );
  const [selectedProductCode, setSelectedProductCode] = useState<string | null>(
    data.prices[0]?.productCode ?? null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPurchaseId, setExpandedPurchaseId] = useState<string | null>(null);
  // 2026-09-18(UI 폴리싱) — "현황"(잔여량/만료일/구매내역)과 "구매"(구매 전
  // 확인+결제)를 서브탭으로 분리한다. 결제 완료/취소 직후에는 실제 상태
  // 변화를 바로 보여주는 "현황"으로 기본 진입한다.
  const [subTab, setSubTab] = useState<"status" | "purchase">("status");

  const selectedChild = data.children.find((c) => c.childId === selectedChildId) ?? null;

  async function handlePurchase() {
    if (!selectedChildId || !selectedProductCode) return;
    setError(null);
    setLoading(true);
    try {
      const url = await createEntitlementCheckoutSession({
        childId: selectedChildId,
        entitlementProductCode: selectedProductCode,
      });
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to start checkout.");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-[720px]">
      <UnderlineSubTabs
        className="mb-5"
        items={[
          { id: "status", label: "Overview" },
          { id: "purchase", label: "Buy" },
        ]}
        activeId={subTab}
        onSelect={setSubTab}
      />

      {purchaseStatus === "success" && (
        <div className="bg-green/10 text-green text-[13px] font-semibold rounded-lg px-4 py-3 mb-4">
          Payment complete. Your lesson credits have been added.
        </div>
      )}
      {purchaseStatus === "cancelled" && (
        <div className="bg-grey-100 text-grey-500 text-[13px] font-semibold rounded-lg px-4 py-3 mb-4">
          Payment was cancelled. Please try again.
        </div>
      )}

      {subTab === "purchase" && (
      <>
      {/* 구매 전 확인 */}
      <section className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4.5 mb-4">
        <h2 className="text-[14px] font-bold text-ink mb-3">Before You Buy</h2>

        {data.prices.length === 0 ? (
          <p className="text-[12px] text-grey-500">No packages are available for purchase right now.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 mb-4">
            {data.prices.map((p) => (
              <button
                key={p.productCode}
                onClick={() => setSelectedProductCode(p.productCode)}
                className={
                  "text-left border-[1.5px] rounded-xl px-3.5 py-3 " +
                  (selectedProductCode === p.productCode
                    ? "border-ink"
                    : "border-grey-200")
                }
              >
                <div className="text-[13px] font-bold text-ink">{p.productName}</div>
                <div className="text-[12px] text-grey-500 mt-0.5">
                  {p.quantity} lessons · valid for {p.validityMonths} months
                </div>
                <div className="text-[16px] font-extrabold text-ink mt-1.5">
                  {formatMoney(p.packagePriceMinor, p.currency)}
                </div>
                {p.discountPercent > 0 && (
                  <div className="text-[11px] text-red font-semibold mt-0.5">
                    {p.discountPercent}% off (-{formatMoney(p.discountMinor, p.currency)})
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="bg-grey-100 rounded-lg px-3.5 py-3 mb-4 text-[11.5px] text-grey-500 leading-[1.6]">
          Refund amount = package price paid − (lessons used × single-lesson price at time of purchase)
        </div>

        <h3 className="text-[13px] font-bold text-ink mb-2">Select a Child</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {data.children.map((c) => (
            <button
              key={c.childId}
              disabled={!c.eligibleForPurchase}
              onClick={() => setSelectedChildId(c.childId)}
              title={c.ineligibleReason ?? undefined}
              className={
                "text-[12px] font-bold px-3.5 py-1.5 rounded-full border-[1.5px] " +
                (!c.eligibleForPurchase
                  ? "border-grey-200 text-grey-300 cursor-not-allowed"
                  : selectedChildId === c.childId
                    ? "bg-ink text-white border-ink"
                    : "border-grey-200 text-grey-500")
              }
            >
              {c.childName}
              {!c.eligibleForPurchase && " (not eligible)"}
            </button>
          ))}
        </div>
        {selectedChild && !selectedChild.eligibleForPurchase && (
          <p className="text-[12px] text-red mb-3">{selectedChild.ineligibleReason}</p>
        )}

        {error && <p className="text-[12px] text-red mb-2">{error}</p>}

        <button
          onClick={handlePurchase}
          disabled={
            loading ||
            !selectedChildId ||
            !selectedProductCode ||
            !selectedChild?.eligibleForPurchase
          }
          className="text-[13px] font-bold text-white bg-ink rounded-lg px-4 py-2.5 w-full disabled:opacity-50"
        >
          {loading ? "Redirecting…" : "Buy Now"}
        </button>
      </section>
      </>
      )}

      {subTab === "status" && (
      <>
      {/* 자녀별 잔여량/만료일/구매내역 */}
      {data.children.map((c) => (
        <section
          key={c.childId}
          className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4.5 mb-4"
        >
          <h2 className="text-[14px] font-bold text-ink mb-3">{c.childName}&apos;s Lesson Credits</h2>

          <div className="flex items-baseline gap-4 mb-4">
            <div>
              <div className="text-[24px] font-extrabold text-ink">
                {c.totalRemaining}
                <span className="text-[13px] font-semibold text-grey-500 ml-1">lessons left</span>
              </div>
            </div>
            <div className="text-[12px] text-grey-500">
              Earliest expiration: {formatDate(c.nearestExpiry, tz)}
            </div>
          </div>

          {c.balances.length > 0 && (
            <div className="mb-4">
              <h3 className="text-[12px] font-bold text-grey-500 mb-1.5">Credit Balances</h3>
              <ul className="text-[12px] text-grey-500 space-y-1">
                {c.balances.map((b) => (
                  <li key={b.grantId} className="flex justify-between">
                    <span>{b.remaining} lessons left</span>
                    <span>Expires {formatDate(b.expiresAt, tz)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* M2 — 60분 전용 체험수업권(구매·환불·양도 불가). 정규 수업권과 절대
              합산하지 않고 별도 카드로 보여준다 — 수업 시간이 달라 오해를 줄 수 있다. */}
          {c.trialEntitlement && (
            <div className="mb-4 border-[1.5px] border-grey-200 rounded-lg px-3 py-2.5 bg-grey-50">
              <p className="text-[12px] font-bold text-ink">1 trial lesson credit (60 min) available</p>
              <p className="text-[11.5px] text-grey-500 mt-0.5">
                The trial lesson must start by {formatDate(c.trialEntitlement.expiresAt, tz)} to use this credit (bookings after
                that date cannot use it). It is separate from regular lesson credits and cannot be purchased, refunded, or transferred.
              </p>
            </div>
          )}

          <h3 className="text-[12px] font-bold text-grey-500 mb-1.5">Purchases & Receipts</h3>
          {c.purchases.length === 0 ? (
            <p className="text-[12px] text-grey-500">No purchases yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {c.purchases.map((r) => (
                <li key={r.purchaseId} className="border-[1.5px] border-grey-200 rounded-lg">
                  <button
                    onClick={() =>
                      setExpandedPurchaseId((cur) => (cur === r.purchaseId ? null : r.purchaseId))
                    }
                    className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                  >
                    <span className="text-[12.5px] font-semibold text-ink">
                      {r.productName} · {formatDate(r.createdAt, tz)}
                    </span>
                    <span className="text-[12px] text-grey-500">
                      {STATUS_LABEL[r.status] ?? r.status}
                      {r.disputeStatus && !CLOSED_DISPUTE_STATUSES.has(r.disputeStatus) && (
                        <span className="ml-1.5 text-red font-semibold">· Dispute open</span>
                      )}
                    </span>
                  </button>
                  {expandedPurchaseId === r.purchaseId && <ReceiptDetail receipt={r} />}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      </>
      )}
    </div>
  );
}

function ReceiptDetail({ receipt: r }: { receipt: PurchaseReceipt }) {
  const tz = useViewerTimezone();
  const rows: [string, string][] = [
    ["Order / payment ID", r.purchaseId],
    ["Contract ID", r.contractId],
    ["Contract version", r.contractVersionNumber != null ? String(r.contractVersionNumber) : "—"],
    ["Product", r.productName],
    ["Lesson type", r.lessonTypeLabel ?? "—"],
    ["Lesson length", r.lessonDurationMinutes != null ? `${r.lessonDurationMinutes} min` : "—"],
    ["Quantity", `${r.quantity} lessons`],
    ["Single-lesson price", formatMoney(r.unitPriceMinor, r.currency)],
    ["Package price", formatMoney(r.packagePriceMinor, r.currency)],
    [
      "Discount",
      `${formatMoney(r.discountMinor, r.currency)} (${r.discountPercent}%)`,
    ],
    ["Tax", formatMoney(r.taxMinor, r.currency)],
    ["Total charged", formatMoney(r.totalMinor, r.currency)],
    ["Currency", r.currency],
    ["Validity", `${r.validityMonths} months`],
    ["Expires", formatDate(r.expiresAt, tz)],
    ["Price policy version", r.pricePolicyVersion ?? "—"],
    ["Refund policy version", r.refundPolicyVersion ?? "—"],
    ["Terms version", r.termsVersion ?? "—"],
    ["Payment status", STATUS_LABEL[r.status] ?? r.status],
    ["Dispute status", r.disputeStatus ? (DISPUTE_STATUS_LABEL[r.disputeStatus] ?? r.disputeStatus) : "None"],
    ["Payment processor transaction ID", r.stripePaymentIntentId ?? r.stripeCheckoutSessionId ?? "—"],
    ["Confirmed at", r.confirmedAt ? fmtDateTime(r.confirmedAt, undefined, tz) : "Not confirmed"],
  ];

  return (
    <div className="border-t-[1.5px] border-grey-200 px-3 py-2.5">
      <dl className="text-[11.5px] text-grey-500 space-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="shrink-0">{label}</dt>
            <dd className="text-ink font-medium text-right break-all">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
