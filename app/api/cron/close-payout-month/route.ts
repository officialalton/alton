import { NextResponse } from "next/server";
import { closePreviousMonth } from "@/lib/payout/close-payout-month";

// P4-2(2차) — 자동 월 마감 크론 진입점.
//
// **fail-closed**: CRON_SECRET이 설정돼 있지 않으면 아무것도 하지 않는다. Vercel은
// cron 호출 시 CRON_SECRET이 설정된 경우에만 `Authorization: Bearer <secret>`를
// 붙이므로, 환경변수를 넣기 전까지 이 경로는 구조적으로 비활성이다 — 스케줄
// 등록과 실제 활성화를 분리해 두기 위함이다(실제 송금 게이트와 같은 취지).
//
// 이 라우트는 정산 묶음 생성(= 검토 중 진입)까지만 한다. 송금 승인·송금 요청·
// 지급 완료는 사람과 금융 연동의 영역이며 여기서 절대 진행하지 않는다.
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
    const result = await closePreviousMonth();
    console.log(
      JSON.stringify({
        event: "payout_month_auto_closed",
        periodStart: result.periodStart,
        periodEnd: result.periodEnd,
        batchCount: result.batches.length,
        itemCount: result.batches.reduce((n, b) => n + b.itemCount, 0),
      })
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(JSON.stringify({ event: "payout_month_auto_close_failed", error: message }));
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
