import { NextResponse } from "next/server";
import { runMeetingCalendarResyncBatch } from "@/lib/consultation/meeting-calendar-sync";
import { runConsultationCalendarResyncBatch } from "@/lib/consultation/calendar-sync";

// 미팅(meeting_requests)·첫 상담(consultations) Calendar 동기화 실패(google_sync_status='failed') 재시도 백스톱 — 한 크론에서 둘 다 처리(경로명은 호환을 위해 유지) — 하루 1회만(vercel.json).
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
  // 미팅과 상담은 서로 독립 — 한쪽이 예외를 던져도 다른 쪽은 계속 처리한다.
  const [meetings, consultations] = await Promise.allSettled([runMeetingCalendarResyncBatch(), runConsultationCalendarResyncBatch()]);
  const errorOf = (r: PromiseRejectedResult) => (r.reason instanceof Error ? r.reason.message : String(r.reason));
  if (meetings.status === "rejected" || consultations.status === "rejected") {
    const error = [
      meetings.status === "rejected" ? `meetings: ${errorOf(meetings)}` : null,
      consultations.status === "rejected" ? `consultations: ${errorOf(consultations)}` : null,
    ].filter(Boolean).join(" | ");
    console.error(JSON.stringify({ event: "calendar_resync_cron_failed", error }));
    return NextResponse.json(
      {
        ok: false,
        error,
        meetings: meetings.status === "fulfilled" ? meetings.value : null,
        consultations: consultations.status === "fulfilled" ? consultations.value : null,
      },
      { status: 500 }
    );
  }
  console.log(JSON.stringify({ event: "calendar_resync_cron_ran", meetings: meetings.value, consultations: consultations.value }));
  // 최상위 필드는 기존(미팅) 응답 형태를 그대로 유지한다.
  return NextResponse.json({ ok: true, ...meetings.value, consultations: consultations.value });
}
