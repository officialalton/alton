import { NextResponse } from "next/server";
import { runAutoPayoutDispatch } from "@/lib/payout/auto-dispatch";

// P4-2 — 자동 송금 크론 진입점(매일 17:00 UTC, 예정일이 도래한 승인 묶음만 처리).
//
// 월 마감 크론과 같은 fail-closed 규칙이다: CRON_SECRET이 없으면 아무것도 하지 않는다.
// 그리고 그 위에 지급 경계가 하나 더 있다 — real_disbursement_enabled()가 false면
// 대상이 있어도 상태를 바꾸지 않고 건너뛴 사실만 기록한다(runAutoPayoutDispatch 참고).
//
// 2026-09-24(사용자 지시) — CRON_SECRET은 vercel.json에 등록된 모든 크론에
// 공통으로 적용돼(Vercel이 크론 요청에 항상 같은 값을 Bearer로 붙임), 그것만으로는
// "정산 크론은 끄고 초대 만료 크론만 켠다"를 표현할 수 없다. 정산 크론 2개에만
// 이 추가 게이트를 얹어 CRON_SECRET을 설정해도 기본값으로는 계속 꺼져 있게 한다
// (다른 크론 — mark-expired-invites — 는 이 플래그와 무관하게 CRON_SECRET만으로 동작).
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
  if (process.env.PAYOUT_CRON_ENABLED !== "true") {
    return NextResponse.json(
      { ok: false, error: "disabled: PAYOUT_CRON_ENABLED=true가 아니면 정산 크론은 실행하지 않습니다." },
      { status: 503 }
    );
  }

  // 요일·날짜 게이트를 두지 않는다. 대상은 DB가 "지급 예정일 <= 오늘(LA)"로 정하므로
  // (list_due_auto_dispatch_batches) 미래 예정일은 나가지 않고, 크론이 하루 빠지거나 관리자가
  // 예정일을 10·26일이 아닌 날로 바꿨어도 다음 실행에서 따라잡는다. 중복 송금은 배치당
  // dispatch_idempotency_key(행 잠금 아래 1회 발급)가 막는다.

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
