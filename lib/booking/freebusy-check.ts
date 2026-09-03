import { createAdminClient } from "@/lib/supabase-admin";
import { queryFreeBusy } from "@/lib/google-calendar";

// R6 10/N — 예약 확정 직전 Google FreeBusy 조회. DB 잠금(reservations_no_overlap
// exclusion + confirm_lesson_booking의 버퍼/가용성 재검증)이 원본 방어선이고, FreeBusy는
// 그 위에 얹는 사전 경고용 이중 방어다(스펙 원문 "조회 후 DB 확정 시점까지의 경쟁 상태는
// 기존 DB 잠금으로 방어한다") — 그래서 이 함수는:
// - CALENDAR_SYNC_ALLOW_REAL_CALLS가 꺼져 있으면(현재 기본값) 조용히 스킵한다(실패로
//   취급하지 않음, 예약 자체를 막지 않는다) — 스펙 "실제 외부 호출을 켜지 않은 상태에서
//   앱 배선을 완성"과 일치.
// - 켜져 있는데 Google 쪽이 이미 그 시간을 busy로 보고하면 예약을 막는다(사전 경고).
// - Google 쪽 조회 자체가 실패(네트워크 오류 등)하면 그것도 예약을 막지 않는다 — DB
//   잠금이 최종 방어선이므로 FreeBusy 조회 실패가 정상 예약 흐름을 깨서는 안 된다.
export type FreeBusyCheckResult = { checked: boolean; conflict: boolean };

async function resolveTeacherWorkspaceEmailOrNull(
  admin: ReturnType<typeof createAdminClient>,
  teacherId: string
): Promise<string | null> {
  const { data } = await admin.from("teachers").select("workspace_email").eq("id", teacherId).maybeSingle();
  return (data?.workspace_email as string | undefined) ?? null;
}

export async function checkTeacherFreeBusyBeforeBooking(params: {
  teacherId: string;
  startsAt: Date;
  endsAt: Date;
}): Promise<FreeBusyCheckResult> {
  if (process.env.CALENDAR_SYNC_ALLOW_REAL_CALLS !== "true") {
    return { checked: false, conflict: false };
  }

  const admin = createAdminClient();
  try {
    const teacherWorkspaceEmail = await resolveTeacherWorkspaceEmailOrNull(admin, params.teacherId);
    if (!teacherWorkspaceEmail) {
      return { checked: false, conflict: false };
    }
    const busy = await queryFreeBusy({ teacherWorkspaceEmail, timeMin: params.startsAt, timeMax: params.endsAt });
    const conflict = busy.some((interval) => {
      const busyStart = new Date(interval.start).getTime();
      const busyEnd = new Date(interval.end).getTime();
      return busyStart < params.endsAt.getTime() && busyEnd > params.startsAt.getTime();
    });
    return { checked: true, conflict };
  } catch (e) {
    console.error(JSON.stringify({ type: "r6_freebusy_check_failed", teacherId: params.teacherId, error: e instanceof Error ? e.message : String(e) }));
    return { checked: false, conflict: false };
  }
}
