import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase-admin";
import { createEntitlementGrantForPurchase } from "@/lib/entitlements";

// Stripe 웹훅. DocuSign 웹훅(app/api/webhooks/docusign/route.ts)과 같은 패턴을
// 따른다: 원문 바이트 한 번 읽기 → 서명 검증(fail closed) →
// external_event_receipts(provider, event_id) idempotency → 비즈니스 로직 →
// 처리 완료 표시.
//
// 이 라우트는 두 갈래를 다룬다:
// 1) R4 entitlement 구매 플로우(app/parent/purchase-actions.ts가 만든 Checkout
//    Session, metadata.purchase_id로 식별) — 이 작업(R4)의 본 대상.
// 2) 레거시 credit_packages/students 플로우(app/parent/credits-actions.ts,
//    CreditsTab.tsx가 여전히 실사용 중, metadata.student_id+package_id로 식별) —
//    v3 스키마 이전 기능이라 건드리지 않되, 신호를 좁혀 새 플로우와 섞이지
//    않게 한다. 서명 검증을 fail-closed로 통일한 것 외에는 기존 동작을 그대로
//    유지한다.
//
// 정책(product-architecture-v3.md §5.6):
// - payment_attempts.status: created→processing→succeeded/failed/cancelled/
//   reconciliation_needed. 모호하거나 우리가 모르는 이벤트는 절대 succeeded로
//   추측하지 않고 reconciliation_needed로 남긴다.
// - 이중 계층 idempotency: Stripe Checkout Session 생성 쪽은 SDK의
//   idempotencyKey(purchase-actions.ts), 웹훅 수신 쪽은 이 라우트의
//   external_event_receipts(provider='stripe', event_id=event.id).
//
// 분쟁(charge.dispute.*, 2026-09-01 후속): payment_disputes(20260924000000)로
// 저장 — purchases.status(v3_payment_attempt_status)에는 'disputed' 값이
// 없으므로 절대 쓰지 않는다. charge→purchase 매칭은 stripe_payment_intent_id로
// purchases 테이블만 조회한다(레거시 credit_purchases 플로우의 분쟁은 이
// 조회로 매칭되지 않아 purchase_id=null로 기록된다 — 레거시 전용 분쟁
// 테이블은 이번 범위에서 만들지 않았다, 최종 보고의 "결정 필요" 참고).

function logAudit(stage: string, extra: Record<string, unknown>) {
  console.info(JSON.stringify({ type: "stripe_webhook_audit", stage, ...extra }));
}

type CheckoutSessionObject = {
  id: string;
  payment_intent: string | null;
  amount_total: number | null;
  metadata: {
    purchase_id?: string;
    student_id?: string;
    package_id?: string;
  } | null;
};

type PaymentIntentObject = {
  id: string;
  metadata: { purchase_id?: string } | null;
  last_payment_error?: { message?: string } | null;
};

type ChargeObject = {
  id: string;
  payment_intent: string | null;
};

type DisputeObject = {
  id: string;
  charge: string;
  payment_intent: string | null;
  status: string;
  amount: number;
  currency: string;
  reason: string | null;
  created: number; // Stripe epoch seconds
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  const stripe = getStripe();

  // fail closed: secret이 설정되지 않았거나 서명 헤더가 없으면 어떤 payload도
  // 신뢰하지 않는다(DocuSign 웹훅과 동일한 정책).
  if (!webhookSecret || !signature) {
    logAudit("signature_verification_failed", {
      hasSecret: Boolean(webhookSecret),
      hasSignatureHeader: signature !== null,
    });
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let event: { id: string; type: string; data: { object: unknown } };
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret) as typeof event;
  } catch (err) {
    logAudit("signature_verification_error", {
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Idempotency: 같은 Stripe event.id가 두 번 오면 두 번째는 no-op.
  const { data: existingReceipt } = await admin
    .from("external_event_receipts")
    .select("id, processed_at")
    .eq("provider", "stripe")
    .eq("event_id", event.id)
    .maybeSingle();

  if (existingReceipt?.processed_at) {
    return NextResponse.json({ ok: true, skipped: "already processed" });
  }

  if (!existingReceipt) {
    const { error: insertError } = await admin
      .from("external_event_receipts")
      .insert({ provider: "stripe", event_id: event.id, payload: event });
    if (insertError) {
      // unique violation이면 동시 요청 경쟁 — 이미 처리 중/됨으로 취급.
      return NextResponse.json({ ok: true, skipped: "race: already recorded" });
    }
  }

  const markProcessed = async () => {
    await admin
      .from("external_event_receipts")
      .update({ processed_at: new Date().toISOString() })
      .eq("provider", "stripe")
      .eq("event_id", event.id);
  };

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as CheckoutSessionObject;
    const metadata = session.metadata;

    if (metadata?.purchase_id) {
      // R4 entitlement 구매 플로우.
      const purchaseId = metadata.purchase_id;

      const { error: attemptError } = await admin.from("payment_attempts").insert({
        purchase_id: purchaseId,
        status: "succeeded",
        stripe_payment_intent_id: session.payment_intent,
      });
      if (attemptError) {
        return NextResponse.json({ error: attemptError.message }, { status: 500 });
      }

      // grant 생성은 멱등 — 같은 purchaseId로 두 번 호출돼도 grant를 두 번
      // 만들지 않는다(lib/entitlements.ts).
      await createEntitlementGrantForPurchase(admin, purchaseId);

      const { error: purchaseUpdateError } = await admin
        .from("purchases")
        .update({
          status: "succeeded",
          stripe_payment_intent_id: session.payment_intent,
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", purchaseId);
      if (purchaseUpdateError) {
        return NextResponse.json({ error: purchaseUpdateError.message }, { status: 500 });
      }

      await markProcessed();
      return NextResponse.json({ ok: true });
    }

    // 레거시 credit_packages 플로우 — 기존 동작 그대로 유지.
    const studentId = metadata?.student_id;
    const packageId = metadata?.package_id;
    if (!studentId || !packageId) {
      return NextResponse.json({ error: "missing metadata" }, { status: 400 });
    }

    const { data: pkg } = await admin
      .from("credit_packages")
      .select("credit_count, price_usd")
      .eq("id", packageId)
      .single();
    if (!pkg) {
      await markProcessed();
      return NextResponse.json({ ok: true, skipped: "unknown package" });
    }

    const { data: purchase, error: purchaseError } = await admin
      .from("credit_purchases")
      .insert({
        student_id: studentId,
        package_id: packageId,
        stripe_payment_intent_id: session.payment_intent,
        amount_usd: pkg.price_usd,
        credits_purchased: pkg.credit_count,
      })
      .select("id")
      .single();
    if (purchaseError) {
      return NextResponse.json({ error: purchaseError.message }, { status: 500 });
    }

    const { error: txError } = await admin.from("credit_transactions").insert({
      student_id: studentId,
      type: "purchase",
      amount: pkg.credit_count,
      related_purchase_id: purchase.id,
      reason: "Stripe 결제",
    });
    if (txError) {
      return NextResponse.json({ error: txError.message }, { status: 500 });
    }

    const { data: student } = await admin
      .from("students")
      .select("credit_balance")
      .eq("id", studentId)
      .single();
    const { error: balanceError } = await admin
      .from("students")
      .update({ credit_balance: (student?.credit_balance ?? 0) + pkg.credit_count })
      .eq("id", studentId);
    if (balanceError) {
      return NextResponse.json({ error: balanceError.message }, { status: 500 });
    }

    await markProcessed();
    return NextResponse.json({ ok: true });
  }

  if (event.type === "payment_intent.payment_failed") {
    const pi = event.data.object as PaymentIntentObject;
    const purchaseId = pi.metadata?.purchase_id;
    if (purchaseId) {
      await admin.from("payment_attempts").insert({
        purchase_id: purchaseId,
        status: "failed",
        stripe_payment_intent_id: pi.id,
        failure_reason: pi.last_payment_error?.message ?? null,
      });
      await admin.from("purchases").update({ status: "failed" }).eq("id", purchaseId);
    }
    await markProcessed();
    return NextResponse.json({ ok: true });
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as CheckoutSessionObject;
    const purchaseId = session.metadata?.purchase_id;
    if (purchaseId) {
      await admin.from("payment_attempts").insert({
        purchase_id: purchaseId,
        status: "cancelled",
        stripe_payment_intent_id: session.payment_intent,
      });
      await admin.from("purchases").update({ status: "cancelled" }).eq("id", purchaseId);
    }
    await markProcessed();
    return NextResponse.json({ ok: true });
  }

  if (
    event.type === "charge.dispute.created" ||
    event.type === "charge.dispute.updated" ||
    event.type === "charge.dispute.closed"
  ) {
    // 분쟁(chargeback) — 자동 entitlement 회수는 절대 하지 않는다(사람 판단
    // 필요, 정책 확정). purchases.status는 v3_payment_attempt_status를
    // 재사용하고 'disputed' 값이 없으므로 여기서 절대 건드리지 않는다 —
    // payment_disputes(20260924000000)가 분쟁의 유일한 소스오브트루스이고,
    // created/updated/closed 세 이벤트 전부 stripe_dispute_id로 upsert한다
    // (idempotency는 unique(stripe_dispute_id) 제약이 보장).
    const dispute = event.data.object as DisputeObject;

    let purchaseId: string | null = null;
    if (dispute.payment_intent) {
      const { data: purchase } = await admin
        .from("purchases")
        .select("id")
        .eq("stripe_payment_intent_id", dispute.payment_intent)
        .maybeSingle();
      purchaseId = purchase?.id ?? null;
    }

    const { error: disputeUpsertError } = await admin.from("payment_disputes").upsert(
      {
        purchase_id: purchaseId,
        stripe_dispute_id: dispute.id,
        stripe_charge_id: dispute.charge,
        stripe_payment_intent_id: dispute.payment_intent,
        status: dispute.status,
        amount_minor: dispute.amount,
        currency: (dispute.currency ?? "usd").toUpperCase(),
        reason: dispute.reason ?? null,
        stripe_created_at: dispute.created ? new Date(dispute.created * 1000).toISOString() : null,
        stripe_updated_at: new Date().toISOString(),
        closed_at: event.type === "charge.dispute.closed" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_dispute_id" }
    );
    if (disputeUpsertError) {
      return NextResponse.json({ error: disputeUpsertError.message }, { status: 500 });
    }

    if (purchaseId) {
      logAudit(`stripe_${event.type}`, { purchaseId, chargeId: dispute.charge, disputeId: dispute.id });
    } else {
      logAudit(`stripe_${event.type}_unmatched_purchase`, { chargeId: dispute.charge, disputeId: dispute.id });
    }

    await markProcessed();
    return NextResponse.json({ ok: true });
  }

  // 우리가 명시적으로 다루지 않는 이벤트 타입, 또는 위 분기 어디에도 해당하지
  // 않는 모호한 payload — 영수증은 남기되(idempotency 목적) 성공으로 추측하지
  // 않는다. metadata에 purchase_id가 있으면 reconciliation_needed로 명확히
  // 표시해 관리자가 수동으로 확인할 수 있게 한다.
  const maybeObject = event.data.object as { metadata?: { purchase_id?: string } };
  const unresolvedPurchaseId = maybeObject?.metadata?.purchase_id;
  if (unresolvedPurchaseId) {
    await admin.from("payment_attempts").insert({
      purchase_id: unresolvedPurchaseId,
      status: "reconciliation_needed",
      failure_reason: `unhandled event type: ${event.type}`,
    });
    await admin
      .from("purchases")
      .update({ status: "reconciliation_needed" })
      .eq("id", unresolvedPurchaseId);
  }

  logAudit("unhandled_event", { eventType: event.type, unresolvedPurchaseId: unresolvedPurchaseId ?? null });
  await markProcessed();
  return NextResponse.json({ ok: true, skipped: `unhandled event: ${event.type}` });
}
