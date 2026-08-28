import crypto from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

// 070(Calendly): 상담 예약이 실제로 잡히면 Calendly가 이 엔드포인트로 웹훅을 보낸다.
// 등록은 scripts/register-calendly-webhook.mjs로 한 번만 하면 되고(배포된 URL 필요),
// 그때 발급되는 signing_key를 CALENDLY_WEBHOOK_SIGNING_KEY에 넣어야 서명 검증이 된다.
function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const signingKey = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
  if (!signingKey) return true; // 로컬 개발 등 서명 키 미설정 시 검증 생략
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => p.split("=") as [string, string])
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;

  const expected = crypto
    .createHmac("sha256", signingKey)
    .update(`${t}.${rawBody}`)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("Calendly-Webhook-Signature");

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as {
    event: string;
    payload: {
      email?: string;
      name?: string;
      questions_and_answers?: { question: string; answer: string }[];
      scheduled_event?: { uri: string; start_time: string };
    };
  };

  if (body.event !== "invitee.created") {
    return NextResponse.json({ ok: true, skipped: body.event });
  }

  const { email, name, questions_and_answers, scheduled_event } = body.payload;
  if (!email || !name) {
    return NextResponse.json({ error: "missing invitee info" }, { status: 400 });
  }

  const concerns = (questions_and_answers ?? [])
    .map((qa) => `${qa.question}: ${qa.answer}`)
    .join("\n");

  const admin = createAdminClient();
  const { error } = await admin.from("consult_requests").insert({
    category: "family",
    person_name: name,
    email,
    concerns: concerns || null,
    status: "confirmed",
    scheduled_at: scheduled_event?.start_time ?? null,
    calendly_event_uri: scheduled_event?.uri ?? null,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
