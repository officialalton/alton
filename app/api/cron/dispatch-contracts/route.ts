import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { processContractDispatchQueue } from "@/lib/contract-dispatch/dispatcher";

// 계약 자동 발송 outbox 워커. fail-closed: CRON_SECRET이 없으면 동작하지 않고,
// CONTRACT_AUTO_DISPATCH_ENABLED가 "true"가 아니면 큐를 건드리지 않는다(발송 없음).
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "disabled: CRON_SECRET이 설정되지 않았습니다." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await processContractDispatchQueue(createAdminClient());
    console.log(JSON.stringify({ event: "contract_dispatch_cron_ran", ...result }));
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(JSON.stringify({ event: "contract_dispatch_cron_failed", error }));
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
