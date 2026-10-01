import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

// R12(Section 2, 2026-09-24) — closure_pending 30일 철회 유예가 끝난 계정을
// closed로 자동 전환한다. 다른 크론과 같은 fail-closed 규칙: CRON_SECRET이
// 없으면 아무것도 하지 않는다. close_expired_pending_accounts() RPC는 상태
// 전환과 account_status_events 기록만 하고, 자료 삭제·비식별화는 별도
// 후속 배치(§4.13) 영역이다.
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

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("close_expired_pending_accounts");
  if (error) {
    console.error(JSON.stringify({ event: "close_pending_accounts_failed", error: error.message }));
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  console.log(JSON.stringify({ event: "close_pending_accounts_ran", closedCount: data }));
  return NextResponse.json({ ok: true, closedCount: data });
}
