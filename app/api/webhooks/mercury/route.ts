import { NextResponse } from "next/server";
import { mercuryConfigFromEnv } from "@/lib/payout/providers/mercury";
import { verifyMercuryWebhookSignature } from "@/lib/payout/mercury-events";

// Mercury 웹훅 수신 골격(2026-10-07). 스위치가 닫혀 있으면 503. 열려 있어도 서명 검증 방식이 공식 문서에서 확정되지 않아
// (docs/2026-10-07-mercury-capabilities.md) 검증기가 구현될 때까지 모든 요청을 거부한다(fail closed) — 서명 없는 본문은 절대 처리하지 않는다.
export async function POST(request: Request) {
  if (!mercuryConfigFromEnv().enabled) {
    return NextResponse.json({ ok: false, error: "disabled: MERCURY_PAYOUTS_ENABLED is not true" }, { status: 503 });
  }
  try {
    await request.text(); // 본문은 서명 검증 뒤에만 해석한다
    verifyMercuryWebhookSignature();
  } catch {
    return NextResponse.json({ ok: false, error: "signature verification is not configured" }, { status: 501 });
  }
  return NextResponse.json({ ok: true });
}
