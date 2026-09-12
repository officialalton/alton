"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createEntitlementProductVersion,
  discontinueEntitlementProductVersion,
  approveRefund,
  rejectRefund,
  extendEntitlementForCompanyOrTeacherCancellation,
  transferEntitlementBetweenChildren,
  adminLookupPurchaseDetail,
} from "./entitlement-actions";
import type { PurchaseDetailItem } from "./entitlement-data";
import type {
  EntitlementProductListItem,
  ProductVersionListItem,
} from "./entitlement-data";
import type {
  listOpenPriceChangeNotices,
  listPendingRefundRequests,
  listPurchasesNeedingReconciliation,
  listOpenOrRecentPaymentDisputes,
} from "./entitlement-actions";

type SubTab = "versions" | "notices" | "reconciliation" | "refunds" | "adjust" | "purchase";

const SUB_NAV: { id: SubTab; label: string }[] = [
  { id: "versions", label: "상품·가격 버전" },
  { id: "notices", label: "30일 고지 대상" },
  { id: "reconciliation", label: "결제 실패·대사" },
  { id: "refunds", label: "환불 요청" },
  { id: "adjust", label: "조정·연장·이전" },
  { id: "purchase", label: "구매 상세 조회" },
];

const btnPrimary =
  "text-[12px] font-bold text-white bg-ink rounded-lg px-3 py-1.5 disabled:opacity-50";
const btnSecondary =
  "text-[12px] font-bold text-ink border-[1.5px] border-grey-200 rounded-lg px-3 py-1.5 disabled:opacity-50";
const card = "border-[1.5px] border-grey-200 rounded-xl px-5 py-4 mb-3";
const errText = "text-[12px] text-red mb-2";
const input = "border-[1.5px] border-grey-200 rounded-lg px-2.5 py-1.5 text-[12.5px]";

type OpenPriceChangeNotice = Awaited<ReturnType<typeof listOpenPriceChangeNotices>>[number];
type PendingRefundRequest = Awaited<ReturnType<typeof listPendingRefundRequests>>[number];
type ReconciliationItem = Awaited<ReturnType<typeof listPurchasesNeedingReconciliation>>[number];
type PaymentDisputeItem = Awaited<ReturnType<typeof listOpenOrRecentPaymentDisputes>>[number];

function formatMinor(minor: number, currency = "USD") {
  return `${(minor / 100).toLocaleString()} ${currency}`;
}

export default function EntitlementLedgerTab({
  products,
  productVersions,
  openPriceChangeNotices,
  pendingRefundRequests,
  purchasesNeedingReconciliation,
  openOrRecentPaymentDisputes,
}: {
  products: EntitlementProductListItem[];
  productVersions: ProductVersionListItem[];
  openPriceChangeNotices: OpenPriceChangeNotice[];
  pendingRefundRequests: PendingRefundRequest[];
  purchasesNeedingReconciliation: ReconciliationItem[];
  openOrRecentPaymentDisputes: PaymentDisputeItem[];
}) {
  const [sub, setSub] = useState<SubTab>("versions");

  return (
    <div className="px-8 py-8">
      <h1 className="text-[20px] font-extrabold text-ink mb-1">수업권 원장</h1>
      <p className="text-[13px] text-grey-500 mb-5">
        수업권 상품·가격 버전, 30일 고지, 결제 대사, 환불, 조정·연장·이전, 구매 상세를 관리합니다.
        (기존 &quot;구 크레딧(레거시)&quot; 탭과는 별개의 R4 수업권 시스템입니다.)
      </p>

      <div className="flex gap-1 mb-6 border-b border-grey-200 flex-wrap">
        {SUB_NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => setSub(n.id)}
            className={
              "text-[12.5px] font-bold px-3 py-2 -mb-px border-b-2 " +
              (sub === n.id ? "border-ink text-ink" : "border-transparent text-grey-500")
            }
          >
            {n.label}
          </button>
        ))}
      </div>

      {sub === "versions" && (
        <ProductVersionsSection products={products} versions={productVersions} />
      )}
      {sub === "notices" && <NoticesSection notices={openPriceChangeNotices} />}
      {sub === "reconciliation" && (
        <ReconciliationSection items={purchasesNeedingReconciliation} disputes={openOrRecentPaymentDisputes} />
      )}
      {sub === "refunds" && <RefundsSection requests={pendingRefundRequests} />}
      {sub === "adjust" && <AdjustSection />}
      {sub === "purchase" && <PurchaseLookupSection />}
    </div>
  );
}

// =========================================================================
// 1. 상품·가격 버전
// =========================================================================

function ProductVersionsSection({
  products,
  versions,
}: {
  products: EntitlementProductListItem[];
  versions: ProductVersionListItem[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [productId, setProductId] = useState("");
  const [priceMinor, setPriceMinor] = useState("");
  const [unitPriceMinor, setUnitPriceMinor] = useState("");
  const [discountMinor, setDiscountMinor] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [validityMonths, setValidityMonths] = useState("12");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveUntil, setEffectiveUntil] = useState("");

  async function submitCreate() {
    setCreating(true);
    setError(null);
    try {
      await createEntitlementProductVersion({
        productId,
        priceMinor: Number(priceMinor),
        unitPriceMinor: Number(unitPriceMinor),
        discountMinor: discountMinor ? Number(discountMinor) : undefined,
        discountPercent: discountPercent ? Number(discountPercent) : undefined,
        validityMonths: validityMonths ? Number(validityMonths) : undefined,
        effectiveFrom,
        effectiveUntil: effectiveUntil || undefined,
      });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "가격 버전 생성에 실패했습니다.");
    } finally {
      setCreating(false);
    }
  }

  async function discontinue(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await discontinueEntitlementProductVersion(id);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "판매 중단 처리에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      {error && <p className={errText}>{error}</p>}

      <div className={card}>
        <div className="text-[13px] font-bold text-ink mb-3">새 가격 버전 생성</div>
        <div className="flex flex-wrap gap-2 mb-2">
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={input}>
            <option value="">상품 선택</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} ({p.quantity})
              </option>
            ))}
          </select>
          <input
            className={input}
            placeholder="총 가격(minor)"
            value={priceMinor}
            onChange={(e) => setPriceMinor(e.target.value)}
          />
          <input
            className={input}
            placeholder="단가(minor)"
            value={unitPriceMinor}
            onChange={(e) => setUnitPriceMinor(e.target.value)}
          />
          <input
            className={input}
            placeholder="할인액(minor, 선택)"
            value={discountMinor}
            onChange={(e) => setDiscountMinor(e.target.value)}
          />
          <input
            className={input}
            placeholder="할인율%(선택)"
            value={discountPercent}
            onChange={(e) => setDiscountPercent(e.target.value)}
          />
          <input
            className={input}
            placeholder="유효기간(개월)"
            value={validityMonths}
            onChange={(e) => setValidityMonths(e.target.value)}
          />
          <input
            className={input}
            type="datetime-local"
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
          />
          <input
            className={input}
            type="datetime-local"
            placeholder="종료일(선택)"
            value={effectiveUntil}
            onChange={(e) => setEffectiveUntil(e.target.value)}
          />
        </div>
        <button
          disabled={creating || !productId || !priceMinor || !unitPriceMinor || !effectiveFrom}
          className={btnPrimary}
          onClick={submitCreate}
        >
          {creating ? "생성 중…" : "가격 버전 생성"}
        </button>
      </div>

      <div className="text-[13px] font-bold text-ink mb-2">가격 버전 목록</div>
      {versions.length === 0 ? (
        <p className="text-[13px] text-grey-500">등록된 가격 버전이 없습니다.</p>
      ) : (
        versions.map((v) => (
          <div key={v.id} className={card + " flex items-center justify-between"}>
            <div>
              <div className="text-[13.5px] font-bold text-ink">
                {v.productCode} v{v.versionNumber}{" "}
                {v.discontinuedAt && (
                  <span className="text-[11px] font-semibold text-red">(판매 중단)</span>
                )}
              </div>
              <div className="text-[12px] text-grey-500 mt-0.5">
                {formatMinor(v.priceMinor, v.currency)} · 단가 {formatMinor(v.unitPriceMinor, v.currency)} ·
                유효 {v.validityMonths}개월 · 할인 {formatMinor(v.discountMinor, v.currency)}({v.discountPercent}%)
              </div>
              <div className="text-[11.5px] text-grey-500 mt-0.5">
                적용: {new Date(v.effectiveFrom).toLocaleString("ko-KR")} ~{" "}
                {v.effectiveUntil ? new Date(v.effectiveUntil).toLocaleString("ko-KR") : "종료일 없음"}
              </div>
            </div>
            {!v.discontinuedAt && (
              <button
                disabled={busyId === v.id}
                className={btnSecondary}
                onClick={() => discontinue(v.id)}
              >
                {busyId === v.id ? "처리 중…" : "판매 중단"}
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// =========================================================================
// 2. 30일 고지 대상 (view-only)
// =========================================================================

function NoticesSection({ notices }: { notices: OpenPriceChangeNotice[] }) {
  return (
    <div>
      <p className="text-[12px] text-grey-500 mb-3">
        발송 대기 기록입니다(읽기 전용 — 실제 발송/수동 처리 표시 기능은 아직 없습니다).
      </p>
      {notices.length === 0 ? (
        <p className="text-[13px] text-grey-500">대기 중인 고지가 없습니다.</p>
      ) : (
        notices.map((n) => (
          <div key={n.id} className={card}>
            <div className="text-[13.5px] font-bold text-ink">상품 버전: {n.productVersionId}</div>
            <div className="text-[12px] text-grey-500 mt-0.5">
              고지 마감: {new Date(n.noticeRequiredBy).toLocaleString("ko-KR")} · 상태: {n.status}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// =========================================================================
// 3. 결제 실패·대사 (informational)
// =========================================================================

function ReconciliationSection({
  items,
  disputes,
}: {
  items: ReconciliationItem[];
  disputes: PaymentDisputeItem[];
}) {
  return (
    <div>
      <p className="text-[12px] text-grey-500 mb-3">
        대사가 필요한 결제 시도 목록입니다(정보 확인용 — 자동 해소 기능은 아직 없습니다).
      </p>
      {items.length === 0 ? (
        <p className="text-[13px] text-grey-500 mb-5">대사가 필요한 항목이 없습니다.</p>
      ) : (
        <div className="mb-5">
          {items.map((it) => (
            <div key={it.paymentAttemptId} className={card}>
              <div className="text-[13.5px] font-bold text-ink">구매 ID: {it.purchaseId}</div>
              <div className="text-[12px] text-grey-500 mt-0.5">결제 시도 ID: {it.paymentAttemptId}</div>
              <div className="text-[12px] text-grey-500 mt-0.5">
                실패 사유: {it.failureReason ?? "미기록"} · 생성: {new Date(it.createdAt).toLocaleString("ko-KR")}
              </div>
            </div>
          ))}
        </div>
      )}

      <h3 className="text-[14px] font-extrabold text-ink mb-2">Stripe 분쟁(chargeback)</h3>
      <p className="text-[12px] text-grey-500 mb-3">
        진행 중이거나 최근 종결된 분쟁입니다. 분쟁 생성만으로는 수업권이 자동 회수되지
        않습니다 — 패소로 실제 조정이 필요하면 &quot;조정·연장·이전&quot; 탭에서 수동으로
        처리하세요.
      </p>
      {disputes.length === 0 ? (
        <p className="text-[13px] text-grey-500">열려 있거나 최근 종결된 분쟁이 없습니다.</p>
      ) : (
        disputes.map((d) => (
          <div key={d.id} className={card}>
            <div className="text-[13.5px] font-bold text-ink">
              {d.purchaseId ? `구매 ID: ${d.purchaseId}` : "구매 미매칭(레거시 또는 미확인 결제)"}
            </div>
            <div className="text-[12px] text-grey-500 mt-0.5">
              분쟁 상태: {d.status} · 금액: {formatMinor(d.amountMinor, d.currency)} · 사유: {d.reason ?? "미기록"}
            </div>
            <div className="text-[12px] text-grey-500 mt-0.5">
              Stripe dispute: {d.stripeDisputeId} · charge: {d.stripeChargeId}
              {d.stripePaymentIntentId ? ` · payment_intent: ${d.stripePaymentIntentId}` : ""}
            </div>
            <div className="text-[12px] text-grey-500 mt-0.5">
              최근 갱신: {d.stripeUpdatedAt ? new Date(d.stripeUpdatedAt).toLocaleString("ko-KR") : "—"}
              {d.closedAt ? ` · 종결: ${new Date(d.closedAt).toLocaleString("ko-KR")}` : ""}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// =========================================================================
// 4. 환불 요청
// =========================================================================

function RefundsSection({ requests: initialRequests }: { requests: PendingRefundRequest[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectReasonById, setRejectReasonById] = useState<Record<string, string>>({});

  async function approve(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await approveRefund(id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "환불 승인에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    const reason = rejectReasonById[id] ?? "";
    setBusyId(id);
    setError(null);
    try {
      await rejectRefund(id, reason);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "환불 거부에 실패했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      {error && <p className={errText}>{error}</p>}
      {requests.length === 0 ? (
        <p className="text-[13px] text-grey-500">대기 중인 환불 요청이 없습니다.</p>
      ) : (
        requests.map((r) => (
          <div key={r.id} className={card}>
            <div className="text-[13.5px] font-bold text-ink">구매 ID: {r.purchaseId}</div>
            <div className="text-[12px] text-grey-500 mt-0.5">
              계산된 환불액: {formatMinor(r.calculatedRefundMinor)} · 소진 수량: {r.consumedCountAtCalculation} ·
              상태: {r.status}
              {r.withinFullRefundWindow && " · 구매 후 7일 이내 미사용(전액 환불 적용)"}
            </div>
            {r.reason && <div className="text-[12px] text-grey-500 mt-0.5">사유: {r.reason}</div>}
            <div className="flex items-center gap-2 mt-2">
              <button disabled={busyId === r.id} className={btnPrimary} onClick={() => approve(r.id)}>
                {busyId === r.id ? "처리 중…" : "승인"}
              </button>
              <input
                className={input}
                placeholder="거부 사유"
                value={rejectReasonById[r.id] ?? ""}
                onChange={(e) =>
                  setRejectReasonById((prev) => ({ ...prev, [r.id]: e.target.value }))
                }
              />
              <button
                disabled={busyId === r.id || !(rejectReasonById[r.id] ?? "")}
                className={btnSecondary}
                onClick={() => reject(r.id)}
              >
                거부
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// =========================================================================
// 5. 조정·연장·이전
// =========================================================================

function AdjustSection() {
  const [extendGrantId, setExtendGrantId] = useState("");
  const [cancellationDate, setCancellationDate] = useState("");
  const [extendBusy, setExtendBusy] = useState(false);
  const [extendError, setExtendError] = useState<string | null>(null);
  const [extendResult, setExtendResult] = useState<string | null>(null);

  const [sourceGrantId, setSourceGrantId] = useState("");
  const [destChildId, setDestChildId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferResult, setTransferResult] = useState<string | null>(null);

  async function submitExtend() {
    setExtendBusy(true);
    setExtendError(null);
    setExtendResult(null);
    try {
      const res = await extendEntitlementForCompanyOrTeacherCancellation(extendGrantId, cancellationDate);
      setExtendResult(
        res.extended ? `연장됨 — 새 만료일: ${res.newExpiresAt}` : "연장 조건을 충족하지 않아 변경되지 않았습니다."
      );
    } catch (e) {
      setExtendError(e instanceof Error ? e.message : "연장 처리에 실패했습니다.");
    } finally {
      setExtendBusy(false);
    }
  }

  async function submitTransfer() {
    setTransferBusy(true);
    setTransferError(null);
    setTransferResult(null);
    try {
      const res = await transferEntitlementBetweenChildren({
        sourceGrantId,
        destChildId,
        amount: Number(amount),
        reason,
      });
      setTransferResult(`이전 완료 — 신규 grant ID: ${res.newGrantId}`);
    } catch (e) {
      setTransferError(e instanceof Error ? e.message : "이전 처리에 실패했습니다.");
    } finally {
      setTransferBusy(false);
    }
  }

  return (
    <div>
      <div className={card}>
        <div className="text-[13px] font-bold text-ink mb-2">회사/선생님 귀책 취소 → 연장</div>
        {extendError && <p className={errText}>{extendError}</p>}
        {extendResult && <p className="text-[12px] text-green mb-2">{extendResult}</p>}
        <div className="flex flex-wrap gap-2 mb-2">
          <input
            className={input}
            placeholder="grant ID"
            value={extendGrantId}
            onChange={(e) => setExtendGrantId(e.target.value)}
          />
          <input
            className={input}
            type="datetime-local"
            value={cancellationDate}
            onChange={(e) => setCancellationDate(e.target.value)}
          />
        </div>
        <button
          disabled={extendBusy || !extendGrantId || !cancellationDate}
          className={btnPrimary}
          onClick={submitExtend}
        >
          {extendBusy ? "처리 중…" : "연장 실행"}
        </button>
      </div>

      <div className={card}>
        <div className="text-[13px] font-bold text-ink mb-2">자녀 간 이전(전환)</div>
        {transferError && <p className={errText}>{transferError}</p>}
        {transferResult && <p className="text-[12px] text-green mb-2">{transferResult}</p>}
        <div className="flex flex-wrap gap-2 mb-2">
          <input
            className={input}
            placeholder="source grant ID"
            value={sourceGrantId}
            onChange={(e) => setSourceGrantId(e.target.value)}
          />
          <input
            className={input}
            placeholder="destination child ID"
            value={destChildId}
            onChange={(e) => setDestChildId(e.target.value)}
          />
          <input
            className={input}
            placeholder="수량"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <input
            className={input}
            placeholder="사유(필수)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <button
          disabled={transferBusy || !sourceGrantId || !destChildId || !amount || !reason}
          className={btnPrimary}
          onClick={submitTransfer}
        >
          {transferBusy ? "처리 중…" : "이전 실행"}
        </button>
      </div>
    </div>
  );
}

// =========================================================================
// 6. 구매 상세 조회
// =========================================================================

function PurchaseLookupSection() {
  const [purchaseId, setPurchaseId] = useState("");
  const [detail, setDetail] = useState<PurchaseDetailItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lookup() {
    setBusy(true);
    setError(null);
    setDetail(null);
    try {
      const data = await adminLookupPurchaseDetail(purchaseId);
      if (!data) {
        setError("존재하지 않는 구매 ID입니다.");
      } else {
        setDetail(data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "조회에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {error && <p className={errText}>{error}</p>}
      <div className="flex items-center gap-2 mb-4">
        <input
          className={input}
          placeholder="구매(purchase) ID"
          value={purchaseId}
          onChange={(e) => setPurchaseId(e.target.value)}
        />
        <button disabled={busy || !purchaseId} className={btnPrimary} onClick={lookup}>
          {busy ? "조회 중…" : "조회"}
        </button>
      </div>

      {detail && (
        <div className={card}>
          <div className="text-[13.5px] font-bold text-ink mb-2">
            {detail.productCode} · {detail.status}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] text-grey-500">
            <div>가구 ID: {detail.householdId}</div>
            <div>자녀 ID: {detail.childId}</div>
            <div>계약 ID: {detail.contractId} (v{detail.contractVersionNumber ?? "-"})</div>
            <div>상품 버전 ID: {detail.productVersionId}</div>
            <div>수량: {detail.quantity}</div>
            <div>단가: {formatMinor(detail.unitPriceMinor, detail.currency)}</div>
            <div>총액: {formatMinor(detail.totalMinor, detail.currency)}</div>
            <div>
              할인: {formatMinor(detail.discountMinor, detail.currency)}({detail.discountPercent}%)
            </div>
            <div>세금: {formatMinor(detail.taxMinor, detail.currency)}</div>
            <div>유효기간: {detail.validityMonths}개월</div>
            <div>만료일: {detail.expiresAt ? new Date(detail.expiresAt).toLocaleString("ko-KR") : "-"}</div>
            <div>가격 정책 버전: {detail.pricePolicyVersion ?? "-"}</div>
            <div>환불 정책 버전: {detail.refundPolicyVersion}</div>
            <div>약관 버전: {detail.termsVersion ?? "-"}</div>
            <div>Stripe 세션 ID: {detail.stripeCheckoutSessionId ?? "-"}</div>
            <div>Stripe 결제 ID: {detail.stripePaymentIntentId ?? "-"}</div>
            <div>생성: {new Date(detail.createdAt).toLocaleString("ko-KR")}</div>
            <div>확정: {detail.confirmedAt ? new Date(detail.confirmedAt).toLocaleString("ko-KR") : "-"}</div>
          </div>
        </div>
      )}
    </div>
  );
}
