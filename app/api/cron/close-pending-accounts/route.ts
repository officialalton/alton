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

  // 같은 일일 크론에 얹는다(Vercel Hobby는 하루 1회 초과 크론이 있으면 배포가 실패하므로 크론 항목을 늘리지 않는다).
  // 레거시 teachers.hourly_rate_krw/pay_currency 캐시를 "효력이 시작된" 기간별 단가에 맞춘다. 실패해도 폐쇄 결과는 그대로 돌려준다.
  let rateCacheSync: "ok" | { error: string } = "ok";
  const { error: syncError } = await admin.rpc("sync_teacher_rate_caches");
  if (syncError) {
    rateCacheSync = { error: syncError.message };
    console.error(JSON.stringify({ event: "sync_teacher_rate_caches_failed", error: syncError.message }));
  }

  console.log(JSON.stringify({ event: "close_pending_accounts_ran", closedCount: data, rateCacheSync }));
  return NextResponse.json({ ok: true, closedCount: data, rateCacheSync });
}
