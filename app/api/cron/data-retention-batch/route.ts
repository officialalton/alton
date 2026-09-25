import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

// R12(Section 2, 2026-09-24) — 자료 유형별 보존기간 자동 삭제·비식별화 배치.
// 다른 크론과 같은 fail-closed 규칙: CRON_SECRET이 없으면 아무것도 하지
// 않는다. 정산 크론(PAYOUT_CRON_ENABLED)과 같은 패턴으로, CRON_SECRET을
// 설정한 뒤에도 RETENTION_BATCH_ENABLED=true가 아니면 실행하지 않는다 —
// 실제 삭제·비식별화는 스케줄 등록과 별개로 명시적으로 켜야 한다.
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
  if (process.env.RETENTION_BATCH_ENABLED !== "true") {
    return NextResponse.json(
      { ok: false, error: "disabled: RETENTION_BATCH_ENABLED=true가 아니면 보존 배치는 실행하지 않습니다." },
      { status: 503 }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("run_data_retention_batch", { p_limit: 500, p_dry_run: false });
  if (error) {
    console.error(JSON.stringify({ event: "data_retention_batch_failed", error: error.message }));
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  console.log(JSON.stringify({ event: "data_retention_batch_ran", result: data }));
  return NextResponse.json({ ok: true, result: data });
}
