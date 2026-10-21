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
  currency?: string | null;
  payment_status?: string | null;
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

type RefundObject = {
  id: string;
  amount?: number;
  currency?: string;
  status?: string | null;
  reason?: string | null;
  charge?: string | null;
  payment_intent?: string | null;
};

type RefundOrChargeObject = {
  id: string;
  payment_intent?: string | null;
  amount_refunded?: number;
  currency?: string;
  refunds?: { data?: unknown[] } | null;
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

  let event: { id: string; type: string; livemode?: boolean; data: { object: unknown } };
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret) as typeof event;
  } catch (err) {
    logAudit("signature_verification_error", {
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  // 모드 혼입 방지: STRIPE_MODE(live|test)가 명시되면 그것이 기준이고 STRIPE_SECRET_KEY 접두사와
  // 반드시 일치해야 한다(불일치 = 배포 설정 오류 → 500 으로 Stripe 재시도를 받는다). 미설정이면
  // 키 접두사로 추정한다. 반대 모드 이벤트는 "처리 완료"로 위장하지 않고 payment_webhook_issues
  // (kind=livemode_mismatch, 이벤트 원문 포함)에 보관하고 receipt 는 만들지 않는다 — 설정 수정 후
  // Stripe 에서 재전송하면 정상 처리된다(처리는 멱등).
  const secretKey = process.env.STRIPE_SECRET_KEY ?? "";
  const keyLive = /^(sk|rk)_live_/.test(secretKey);
  const modeSetting = process.env.STRIPE_MODE;
  if (modeSetting && modeSetting !== "live" && modeSetting !== "test") {
    logAudit("stripe_mode_invalid", { modeSetting });
    return NextResponse.json({ error: "invalid STRIPE_MODE" }, { status: 500 });
  }
  if (modeSetting && (modeSetting === "live") !== keyLive) {
    logAudit("stripe_mode_key_conflict", { modeSetting, keyLive });
    return NextResponse.json({ error: "STRIPE_MODE conflicts with STRIPE_SECRET_KEY" }, { status: 500 });
  }
  const deploymentLive = modeSetting ? modeSetting === "live" : keyLive;
  if (typeof event.livemode === "boolean" && event.livemode !== deploymentLive) {
    logAudit("livemode_mismatch", { eventId: event.id, eventLivemode: event.livemode, deploymentLive });
    const { error: mismatchError } = await createAdminClient()
      .from("payment_webhook_issues")
      .upsert(
        {
          event_id: event.id,
          kind: "livemode_mismatch",
          detail: { eventType: event.type, eventLivemode: event.livemode, deploymentLive, event },
        },
        { onConflict: "event_id,kind", ignoreDuplicates: true }
      );
    if (mismatchError) {
      return NextResponse.json({ error: "mismatch_record_failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, skipped: "livemode mismatch", recorded: true });
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
      // unique violation(23505)만 동시 요청 경쟁 — 이미 처리 중/됨으로 취급한다.
      // 2026-09-21(기획자 리뷰 P2) — 그 외(DB 장애·권한·스키마 오류)까지 200 으로 ACK 하면 Stripe 가
      // 재전송을 멈춰 이벤트가 영구 유실된다. 500 으로 되돌려 재시도를 받는다.
      if (insertError.code === "23505") {
        return NextResponse.json({ ok: true, skipped: "race: already recorded" });
      }
      console.error(JSON.stringify({ type: "stripe_receipt_insert_failed", eventId: event.id, error: insertError.message }));
      return NextResponse.json({ error: "receipt_insert_failed" }, { status: 500 });
    }
  }

  const markProcessed = async () => {
    await admin
      .from("external_event_receipts")
      .update({ processed_at: new Date().toISOString() })
      .eq("provider", "stripe")
      .eq("event_id", event.id);
  };

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as CheckoutSessionObject;
    const metadata = session.metadata;
    const paid = session.payment_status === "paid";

    const recordIssue = async (kind: string, purchaseId: string | null, detail: Record<string, unknown>) => {
      logAudit(`issue_${kind}`, { eventId: event.id, purchaseId, ...detail });
      await admin
        .from("payment_webhook_issues")
        .upsert(
          { event_id: event.id, kind, purchase_id: purchaseId, detail },
          { onConflict: "event_id,kind", ignoreDuplicates: true }
        );
    };

    if (metadata?.purchase_id) {
      // R4 entitlement 구매 플로우.
      const purchaseId = metadata.purchase_id;

      // 지연 결제수단: 아직 미결제 — 수업권 부여 없이 processing 으로만 기록한다.
      // 이후 async_payment_succeeded/failed 이벤트가 확정한다.
      if (!paid) {
        const { error: pendingError } = await admin.from("payment_attempts").upsert(
          {
            purchase_id: purchaseId,
            status: "processing",
            stripe_payment_intent_id: session.payment_intent,
            attempt_key: `evt:${event.id}`,
          },
          { onConflict: "attempt_key", ignoreDuplicates: true }
        );
        if (pendingError) return NextResponse.json({ error: pendingError.message }, { status: 500 });
        await markProcessed();
        return NextResponse.json({ ok: true, skipped: "payment not paid yet" });
      }

      // 서버에 확정 저장된 구매(할인·세금 반영 total_minor, 통화)와 Stripe 결제를 대조한다.
      const { data: purchaseRow } = await admin
        .from("purchases")
        .select("total_minor, currency")
        .eq("id", purchaseId)
        .maybeSingle();
      const expectedCurrency = (purchaseRow?.currency ?? "").toLowerCase();
      const sessionCurrency = (session.currency ?? "").toLowerCase();
      if (
        !purchaseRow ||
        Number(purchaseRow.total_minor) !== session.amount_total ||
        expectedCurrency !== sessionCurrency
      ) {
        await recordIssue(purchaseRow ? "amount_mismatch" : "purchase_not_found", purchaseRow ? purchaseId : null, {
          sessionId: session.id,
          expectedMinor: purchaseRow?.total_minor ?? null,
          expectedCurrency: purchaseRow?.currency ?? null,
          amountTotal: session.amount_total,
          currency: session.currency ?? null,
        });
        if (purchaseRow) {
          await admin.from("payment_attempts").upsert(
            {
              purchase_id: purchaseId,
              status: "reconciliation_needed",
              stripe_payment_intent_id: session.payment_intent,
              failure_reason: "amount or currency mismatch with purchase record",
              attempt_key: `evt:${event.id}`,
            },
            { onConflict: "attempt_key", ignoreDuplicates: true }
          );
          await admin
            .from("purchases")
            .update({ status: "reconciliation_needed" })
            .eq("id", purchaseId)
            .neq("status", "succeeded");
        }
        await markProcessed();
        return NextResponse.json({ ok: true, skipped: "amount mismatch" });
      }

      const { error: attemptError } = await admin.from("payment_attempts").upsert(
        {
          purchase_id: purchaseId,
          status: "succeeded",
          stripe_payment_intent_id: session.payment_intent,
          attempt_key: `evt:${event.id}`,
        },
        { onConflict: "attempt_key", ignoreDuplicates: true }
      );
      if (attemptError) {
        return NextResponse.json({ error: attemptError.message }, { status: 500 });
      }

      // grant 생성은 멱등 — 같은 purchaseId로 두 번 호출돼도(다른 이벤트여도) grant를 두 번
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

    // 레거시 credit_packages 플로우.
    const studentId = metadata?.student_id;
    const packageId = metadata?.package_id;
    if (!studentId || !packageId) {
      return NextResponse.json({ error: "missing metadata" }, { status: 400 });
    }
    if (!paid) {
      await markProcessed();
      return NextResponse.json({ ok: true, skipped: "payment not paid yet" });
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
    const expectedMinor = Math.round(Number(pkg.price_usd) * 100);
    if (session.amount_total !== expectedMinor || (session.currency ?? "").toLowerCase() !== "usd") {
      await recordIssue("legacy_amount_mismatch", null, {
        sessionId: session.id,
        packageId,
        studentId,
        expectedMinor,
        amountTotal: session.amount_total,
        currency: session.currency ?? null,
      });
      await markProcessed();
      return NextResponse.json({ ok: true, skipped: "amount mismatch" });
    }

    // 한 트랜잭션 RPC — checkout session 당 1회만 지급(unique 제약), 중간 실패 시 전체 롤백.
    // 다른 event.id 가 같은 session 을 가리켜도, 동시 경합이어도 한 번만 지급된다.
    const { error: grantError } = await admin.rpc("grant_legacy_credit_purchase", {
      p_session_id: session.id,
      p_student_id: studentId,
      p_package_id: packageId,
      p_payment_intent: session.payment_intent,
    });
    if (grantError) {
      return NextResponse.json({ error: grantError.message }, { status: 500 });
    }

    await markProcessed();
    return NextResponse.json({ ok: true });
  }

  if (event.type === "checkout.session.async_payment_failed") {
    const session = event.data.object as CheckoutSessionObject;
    const purchaseId = session.metadata?.purchase_id;
    if (purchaseId) {
      await admin.from("payment_attempts").upsert(
        {
          purchase_id: purchaseId,
          status: "failed",
          stripe_payment_intent_id: session.payment_intent,
          failure_reason: "async payment failed",
          attempt_key: `evt:${event.id}`,
        },
        { onConflict: "attempt_key", ignoreDuplicates: true }
      );
      await admin.from("purchases").update({ status: "failed" }).eq("id", purchaseId).neq("status", "succeeded");
    }
    await markProcessed();
    return NextResponse.json({ ok: true });
  }

  if (event.type === "charge.refunded" || event.type === "charge.refund.updated") {
    // 환불 — payment_refunds 에 구매와 연결해 기록(항상 동작, needs_review=true 가 관리자 확인 큐).
    // 수업권 자동 회수는 STRIPE_AUTO_REVOKE_ON_REFUND=true 일 때만, 전액 환불 성공 + 전부 미사용일 때만
    // DB RPC(auto_revoke_refunded_purchase)가 그 구매의 grant 만 회수한다. 기본 꺼짐.
    const obj = event.data.object as RefundOrChargeObject;
    const isCharge = event.type === "charge.refunded";
    const refundObj = obj as unknown as RefundObject;
    const listed = (obj.refunds?.data ?? []) as RefundObject[];
    const refunds: RefundObject[] = isCharge
      ? listed.length
        ? listed
        : [{ id: `charge:${obj.id}`, amount: obj.amount_refunded ?? 0, currency: obj.currency, status: "succeeded" }]
      : [refundObj];
    const chargeId = isCharge ? obj.id : (refundObj.charge ?? null);
    const paymentIntent = isCharge ? (obj.payment_intent ?? null) : (refundObj.payment_intent ?? null);

    let purchaseId: string | null = null;
    if (paymentIntent) {
      const { data: purchase } = await admin
        .from("purchases")
        .select("id")
        .eq("stripe_payment_intent_id", paymentIntent)
        .maybeSingle();
      purchaseId = purchase?.id ?? null;
    }

    for (const refund of refunds) {
      const { error: refundError } = await admin.from("payment_refunds").upsert(
        {
          purchase_id: purchaseId,
          stripe_refund_id: refund.id,
          stripe_charge_id: chargeId,
          stripe_payment_intent_id: paymentIntent,
          amount_minor: refund.amount ?? 0,
          currency: (refund.currency ?? "usd").toUpperCase(),
          status: refund.status ?? null,
          reason: refund.reason ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "stripe_refund_id" }
      );
      if (refundError) return NextResponse.json({ error: refundError.message }, { status: 500 });
    }

    // pending/failed/canceled 환불은 성공으로 취급하지 않는다(RPC 가 status='succeeded' 합계만 본다).
    if (purchaseId && process.env.STRIPE_AUTO_REVOKE_ON_REFUND === "true") {
      const { data: revoke, error: revokeError } = await admin.rpc("auto_revoke_refunded_purchase", {
        p_purchase_id: purchaseId,
      });
      if (revokeError) return NextResponse.json({ error: revokeError.message }, { status: 500 });
      const result = revoke as { revoked?: boolean; reason?: string } | null;
      await admin
        .from("payment_refunds")
        .update({
          auto_revoke_status: result?.reason ?? null,
          needs_review: !result?.revoked,
        })
        .eq("purchase_id", purchaseId);
      logAudit("refund_auto_revoke", { purchaseId, ...result });
    }
    logAudit(`stripe_${event.type}`, { purchaseId, chargeId, count: refunds.length });
    await markProcessed();
    return NextResponse.json({ ok: true });
  }

  if (event.type === "payment_intent.payment_failed") {
    const pi = event.data.object as PaymentIntentObject;
    const purchaseId = pi.metadata?.purchase_id;
    if (purchaseId) {
      await admin.from("payment_attempts").upsert(
        {
          purchase_id: purchaseId,
          status: "failed",
          stripe_payment_intent_id: pi.id,
          failure_reason: pi.last_payment_error?.message ?? null,
          attempt_key: `evt:${event.id}`,
        },
        { onConflict: "attempt_key", ignoreDuplicates: true }
      );
      // 순서 뒤바뀐 이벤트가 이미 성공한 구매를 되돌리지 못하게 한다.
      await admin.from("purchases").update({ status: "failed" }).eq("id", purchaseId).neq("status", "succeeded");
    }
    await markProcessed();
    return NextResponse.json({ ok: true });
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as CheckoutSessionObject;
    const purchaseId = session.metadata?.purchase_id;
    if (purchaseId) {
      await admin.from("payment_attempts").upsert(
        {
          purchase_id: purchaseId,
          status: "cancelled",
          stripe_payment_intent_id: session.payment_intent,
          attempt_key: `evt:${event.id}`,
        },
        { onConflict: "attempt_key", ignoreDuplicates: true }
      );
      await admin.from("purchases").update({ status: "cancelled" }).eq("id", purchaseId).neq("status", "succeeded");
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
    await admin.from("payment_attempts").upsert(
      {
        purchase_id: unresolvedPurchaseId,
        status: "reconciliation_needed",
        failure_reason: `unhandled event type: ${event.type}`,
        attempt_key: `evt:${event.id}`,
      },
      { onConflict: "attempt_key", ignoreDuplicates: true }
    );
    await admin
      .from("purchases")
      .update({ status: "reconciliation_needed" })
      .eq("id", unresolvedPurchaseId);
  }

  logAudit("unhandled_event", { eventType: event.type, unresolvedPurchaseId: unresolvedPurchaseId ?? null });
  await markProcessed();
  return NextResponse.json({ ok: true, skipped: `unhandled event: ${event.type}` });
}
