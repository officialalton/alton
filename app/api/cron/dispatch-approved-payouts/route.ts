import { NextResponse } from "next/server";
import { runAutoPayoutDispatch } from "@/lib/payout/auto-dispatch";

// P4-2 — 자동 송금 크론 진입점(매월 10일 03:00 UTC).
//
// 월 마감 크론과 같은 fail-closed 규칙이다: CRON_SECRET이 없으면 아무것도 하지 않는다.
// 그리고 그 위에 지급 경계가 하나 더 있다 — real_disbursement_enabled()가 false면
// 대상이 있어도 상태를 바꾸지 않고 건너뛴 사실만 기록한다(runAutoPayoutDispatch 참고).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "disabled: CRON_SECRET이 설정되지 않았습니다." },
      { status: 503 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runAutoPayoutDispatch();
    console.log(JSON.stringify({ event: "payout_auto_dispatch_ran", ...result }));
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(JSON.stringify({ event: "payout_auto_dispatch_failed", error: message }));
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
