import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  const stripe = getStripe();
  let event;
  try {
    event =
      webhookSecret && signature
        ? stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
        : JSON.parse(rawBody);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "invalid signature" },
      { status: 400 }
    );
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ ok: true, skipped: event.type });
  }

  const session = event.data.object as {
    id: string;
    payment_intent: string | null;
    amount_total: number | null;
    metadata: { student_id?: string; package_id?: string } | null;
  };
  const studentId = session.metadata?.student_id;
  const packageId = session.metadata?.package_id;
  if (!studentId || !packageId) {
    return NextResponse.json({ error: "missing metadata" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: pkg } = await admin
    .from("credit_packages")
    .select("credit_count, price_usd")
    .eq("id", packageId)
    .single();
  if (!pkg) {
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

  return NextResponse.json({ ok: true });
}
