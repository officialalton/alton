import { NextResponse } from "next/server";
import { runMeetingCalendarResyncBatch } from "@/lib/consultation/meeting-calendar-sync";

// 미팅 Calendar 동기화 실패(google_sync_status='failed') 재시도 백스톱 — 하루 1회만(vercel.json).
// Vercel Hobby는 하루 1회보다 잦은 크론이 있으면 배포 자체가 실패한다. fail-closed: CRON_SECRET이 없으면 503.
// 실제 Google 호출은 CALENDAR_SYNC_ALLOW_REAL_CALLS=true 일 때만 — 꺼져 있으면 아무 행도 claim 하지 않는다.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "disabled: CRON_SECRET이 설정되지 않았습니다." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runMeetingCalendarResyncBatch();
    console.log(JSON.stringify({ event: "meeting_calendar_resync_cron_ran", ...result }));
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(JSON.stringify({ event: "meeting_calendar_resync_cron_failed", error }));
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
