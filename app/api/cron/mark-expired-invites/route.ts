import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { runGuardianLinkDailyStep } from "@/lib/guardian-link/cron";

// Section 2(2026-09-24) — "오픈 전 blocker: mark_expired_invites cron 연결".
// 다른 크론과 같은 fail-closed 규칙: CRON_SECRET이 없으면 아무것도 하지 않는다.
// mark_expired_invites() RPC는 pending·만료된 account_invites를 expired로 바꾸고
// account_invite_events에 기록만 한다 — 실제 이메일 재발송·계정 삭제는 하지
// 않는다(그 부분은 각각 별도 관리자 조작·정책 결정 영역).
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
  const { data, error } = await admin.rpc("mark_expired_invites");
  if (error) {
    console.error(JSON.stringify({ event: "mark_expired_invites_failed", error: error.message }));
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  console.log(JSON.stringify({ event: "mark_expired_invites_ran", expiredCount: data }));

  // 2026-10-05 무료 회원 S4 — 같은 일일 크론에 보호자 초대 만료·리마인더 단계를 붙인다(Vercel Hobby: 새 크론 항목 금지).
  // 이 단계의 실패는 위 결과에 영향을 주지 않는다(별도 필드로 보고).
  const guardianLink = await runGuardianLinkDailyStep(admin, new URL(request.url).origin);

  return NextResponse.json({ ok: true, expiredCount: data, guardianLink });
}
