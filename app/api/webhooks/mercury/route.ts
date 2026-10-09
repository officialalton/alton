import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { createSupabaseAttemptStore } from "@/lib/payout/supabase-attempt-store";
import { verifyMercuryWebhookSignature } from "@/lib/payout/mercury-webhook";
import { handleMercuryWebhook } from "@/lib/payout/mercury-webhook-handler";

// Mercury 웹훅 수신(상태·반환 인지 전용, 돈을 움직이지 않는다). MERCURY_WEBHOOK_SECRET이 없으면 503으로 아무것도 처리하지 않는다.
export async function POST(request: Request) {
  const secret = process.env.MERCURY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "webhook secret is not configured" }, { status: 503 });
  const rawBody = await request.text();
  const v = verifyMercuryWebhookSignature({ secret, header: request.headers.get("mercury-signature"), rawBody });
  if (!v.ok) return NextResponse.json({ ok: false, error: "invalid signature" }, { status: 401 });
  try {
    const outcome = await handleMercuryWebhook(createSupabaseAttemptStore(createAdminClient()), rawBody);
    return NextResponse.json({ ok: true, outcome });
  } catch {
    return NextResponse.json({ ok: false, error: "processing failed" }, { status: 500 }); // 5xx → Mercury가 재배달
  }
}
