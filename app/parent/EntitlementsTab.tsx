"use client";

import { useState } from "react";
import type { ParentEntitlementsData, PurchaseReceipt } from "./entitlements-data";
import { createEntitlementCheckoutSession } from "./purchase-actions";

function formatMoney(minor: number, currency: string): string {
  const amount = minor / 100;
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ko-KR");
}

const STATUS_LABEL: Record<string, string> = {
  created: "결제 대기",
  pending: "결제 처리 중",
  succeeded: "결제 완료",
  confirmed: "결제 완료",
  failed: "결제 실패",
  cancelled: "결제 취소",
};

// Stripe dispute.status 표시용 — 원문 값을 그대로 저장하므로(신규 상태 추가돼도
// 스키마 변경 불필요) 매핑에 없는 값은 원문을 그대로 보여준다.
const DISPUTE_STATUS_LABEL: Record<string, string> = {
  warning_needs_response: "분쟁 경고 · 대응 필요",
  warning_under_review: "분쟁 경고 · 검토 중",
  warning_closed: "분쟁 경고 · 종결",
  needs_response: "분쟁 진행 중 · 대응 필요",
  under_review: "분쟁 검토 중",
  charge_refunded: "분쟁 · 환불 처리됨",
  won: "분쟁 · 승소(정상 유지)",
  lost: "분쟁 · 패소",
};

const CLOSED_DISPUTE_STATUSES = new Set(["won", "lost", "charge_refunded", "warning_closed"]);

export default function EntitlementsTab({
  data,
  purchaseStatus,
}: {
  data: ParentEntitlementsData;
  purchaseStatus?: "success" | "cancelled";
}) {
  const [selectedChildId, setSelectedChildId] = useState<string | null>(
    data.children.find((c) => c.eligibleForPurchase)?.childId ?? data.children[0]?.childId ?? null
  );
  const [selectedProductCode, setSelectedProductCode] = useState<string | null>(
    data.prices[0]?.productCode ?? null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedPurchaseId, setExpandedPurchaseId] = useState<string | null>(null);

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
      setError(e instanceof Error ? e.message : "결제를 시작할 수 없습니다.");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-[720px] px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1">수업권 구매/현황</h1>
      <p className="text-[12px] text-grey-500 mb-5">
        기존 &quot;수업권&quot; 탭과 별개의 R4 신규 화면입니다. 이용약관과 환불 정책은
        구매 시점 버전으로 각 구매 건에 스냅샷 고정됩니다.
      </p>

      {purchaseStatus === "success" && (
        <div className="bg-green/10 text-green text-[13px] font-semibold rounded-lg px-4 py-3 mb-4">
          결제 완료, 수업권이 지급되었습니다.
        </div>
      )}
      {purchaseStatus === "cancelled" && (
        <div className="bg-grey-100 text-grey-500 text-[13px] font-semibold rounded-lg px-4 py-3 mb-4">
          결제가 취소되었습니다. 다시 시도해주세요.
        </div>
      )}

      {/* 구매 전 확인 */}
      <section className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4.5 mb-4">
        <h2 className="text-[14px] font-bold text-ink mb-3">구매 전 확인</h2>

        {data.prices.length === 0 ? (
          <p className="text-[12px] text-grey-500">현재 판매 중인 상품이 없습니다.</p>
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
                  {p.quantity}회 · 유효기간 {p.validityMonths}개월
                </div>
                <div className="text-[16px] font-extrabold text-ink mt-1.5">
                  {formatMoney(p.packagePriceMinor, p.currency)}
                </div>
                {p.discountPercent > 0 && (
                  <div className="text-[11px] text-red font-semibold mt-0.5">
                    {p.discountPercent}% 할인 (-{formatMoney(p.discountMinor, p.currency)})
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="bg-grey-100 rounded-lg px-3.5 py-3 mb-4 text-[11.5px] text-grey-500 leading-[1.6]">
          환불액 = 실제 패키지 결제금액 − (소진 횟수 × 구매 당시 실제 단건 판매가)
        </div>

        <h3 className="text-[13px] font-bold text-ink mb-2">자녀 선택</h3>
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
              {!c.eligibleForPurchase && " (구매 불가)"}
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
          {loading ? "이동 중…" : "구매하기"}
        </button>
      </section>

      {/* 자녀별 잔여량/만료일/구매내역 */}
      {data.children.map((c) => (
        <section
          key={c.childId}
          className="border-[1.5px] border-grey-200 rounded-xl px-5 py-4.5 mb-4"
        >
          <h2 className="text-[14px] font-bold text-ink mb-3">{c.childName}의 수업권</h2>

          <div className="flex items-baseline gap-4 mb-4">
            <div>
              <div className="text-[24px] font-extrabold text-ink">
                {c.totalRemaining}
                <span className="text-[13px] font-semibold text-grey-500 ml-1">회 잔여</span>
              </div>
            </div>
            <div className="text-[12px] text-grey-500">
              가장 빠른 만료일: {formatDate(c.nearestExpiry)}
            </div>
          </div>

          {c.balances.length > 0 && (
            <div className="mb-4">
              <h3 className="text-[12px] font-bold text-grey-500 mb-1.5">보유 수업권 내역</h3>
              <ul className="text-[12px] text-grey-500 space-y-1">
                {c.balances.map((b) => (
                  <li key={b.grantId} className="flex justify-between">
                    <span>잔여 {b.remaining}회</span>
                    <span>만료 {formatDate(b.expiresAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* M2 — 60분 전용 체험수업권(구매·환불·양도 불가). 정규 수업권과 절대
              합산하지 않고 별도 카드로 보여준다 — 수업 시간이 달라 오해를 줄 수 있다. */}
          {c.trialEntitlement && (
            <div className="mb-4 border-[1.5px] border-grey-200 rounded-lg px-3 py-2.5 bg-grey-50">
              <p className="text-[12px] font-bold text-ink">체험수업권(60분) 1회 보유 중</p>
              <p className="text-[11.5px] text-grey-500 mt-0.5">
                만료 {formatDate(c.trialEntitlement.expiresAt)} · 정규수업권과 별개이며 구매·환불·양도가 불가능합니다.
              </p>
            </div>
          )}

          <h3 className="text-[12px] font-bold text-grey-500 mb-1.5">구매/영수증 내역</h3>
          {c.purchases.length === 0 ? (
            <p className="text-[12px] text-grey-500">구매 내역이 없습니다.</p>
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
                      {r.productName} · {formatDate(r.createdAt)}
                    </span>
                    <span className="text-[12px] text-grey-500">
                      {STATUS_LABEL[r.status] ?? r.status}
                      {r.disputeStatus && !CLOSED_DISPUTE_STATUSES.has(r.disputeStatus) && (
                        <span className="ml-1.5 text-red font-semibold">· 분쟁 진행 중</span>
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
    </div>
  );
}

function ReceiptDetail({ receipt: r }: { receipt: PurchaseReceipt }) {
  const rows: [string, string][] = [
    ["주문/결제 ID", r.purchaseId],
    ["계약 ID", r.contractId],
    ["계약 버전", r.contractVersionNumber != null ? String(r.contractVersionNumber) : "—"],
    ["상품명", r.productName],
    ["수업형태", r.lessonTypeLabel ?? "—"],
    ["수업시간", r.lessonDurationMinutes != null ? `${r.lessonDurationMinutes}분` : "—"],
    ["수량", `${r.quantity}회`],
    ["단건 실제 판매가", formatMoney(r.unitPriceMinor, r.currency)],
    ["패키지 가격", formatMoney(r.packagePriceMinor, r.currency)],
    [
      "할인액/할인율",
      `${formatMoney(r.discountMinor, r.currency)} (${r.discountPercent}%)`,
    ],
    ["세금", formatMoney(r.taxMinor, r.currency)],
    ["최종 결제금액", formatMoney(r.totalMinor, r.currency)],
    ["통화", r.currency],
    ["유효기간", `${r.validityMonths}개월`],
    ["만료일", formatDate(r.expiresAt)],
    ["가격 정책 버전", r.pricePolicyVersion ?? "—"],
    ["환불 정책 버전", r.refundPolicyVersion ?? "—"],
    ["약관 버전", r.termsVersion ?? "—"],
    ["결제 상태", STATUS_LABEL[r.status] ?? r.status],
    ["분쟁 상태", r.disputeStatus ? (DISPUTE_STATUS_LABEL[r.disputeStatus] ?? r.disputeStatus) : "없음"],
    ["결제대행사 거래 ID", r.stripePaymentIntentId ?? r.stripeCheckoutSessionId ?? "—"],
    ["구매 확인 시각", r.confirmedAt ? new Date(r.confirmedAt).toLocaleString("ko-KR") : "미확인"],
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
