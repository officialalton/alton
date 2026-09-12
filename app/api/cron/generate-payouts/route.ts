import { NextResponse } from "next/server";

// R10 Task C (2026-09-07) — 레거시 teacher_payouts 생성 크론을 비활성화했다.
// v3 payout_batches(payout-batches-data.ts/-actions.ts, generate_payout_batches RPC)가
// 이 역할을 대체한다. vercel.json에서도 이 경로의 cron 항목을 제거했다.
// teacher_payouts 테이블 자체는 R13 전까지 읽기 전용으로 보존하되(docs/CURRENT.md 참고),
// 이 라우트가 다시 예약 호출되더라도 아무 것도 쓰지 않도록 no-op으로 남겨둔다.
export async function GET() {
  return NextResponse.json(
    { ok: false, error: "deprecated: superseded by v3 payout_batches, see docs/CURRENT.md" },
    { status: 410 }
  );
}
