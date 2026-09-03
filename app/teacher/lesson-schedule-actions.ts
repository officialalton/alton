"use server";

// R6 11/N — 선생님이 본인의 정규수업(v3 예약) 목록을 조회·취소하는 서버 액션. 조회는
// RLS(`sessions_v3 조회`/`reservations 조회`가 teacher_id=auth.uid()/owner_profile_id=auth.uid()를
// 이미 허용)가 접근 제어를 담당하므로 RLS-scoped 세션 클라이언트를 그대로 쓴다. 취소는
// 다른 R6 취소 경로와 동일하게 lib/booking/create-booking.ts의 cancelLessonBooking()
// (admin 클라이언트, cancelledByRole='teacher')을 그대로 재사용한다.

import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { loadTeacherLessonSchedule, type TeacherLessonScheduleItem } from "./lesson-schedule-data";
import { cancelLessonBooking } from "@/lib/booking/create-booking";
import { listTeacherExternalBusyBlocks, type ExternalBusyBlock } from "@/lib/booking/external-busy";

export type { TeacherLessonScheduleItem, ExternalBusyBlock };

export async function listMyLessonSchedule(): Promise<TeacherLessonScheduleItem[]> {
  const { user, supabase } = await requireUser();
  return loadTeacherLessonSchedule(supabase, user.id);
}

/**
 * R6 12/N — 선생님 본인의 Google 외부 개인 일정을 "바쁨 블록"으로만 조회한다(제목·내용·
 * 참석자 없음, FreeBusy API 자체가 구조적으로 그 이상을 반환하지 않는다). 본인만 호출할
 * 수 있고(requireUser로 본인 확인 후 본인 workspace_email만 사용), 보호자·학생·다른
 * 선생님에게는 이 액션 자체가 노출되지 않는다(호출부가 이 화면들에서만 쓰임).
 */
export async function listMyExternalBusyBlocks(params: { rangeStart: string; rangeEnd: string }): Promise<ExternalBusyBlock[]> {
  const { user } = await requireUser();
  const admin = createAdminClient();
  const { data: teacher } = await admin.from("teachers").select("workspace_email").eq("id", user.id).maybeSingle();
  if (!teacher?.workspace_email) return [];
  return listTeacherExternalBusyBlocks({
    teacherWorkspaceEmail: teacher.workspace_email as string,
    rangeStart: new Date(params.rangeStart),
    rangeEnd: new Date(params.rangeEnd),
  });
}

/**
 * 선생님 본인 취소 — reservationId가 실제로 본인 소유(owner_profile_id)인지 admin
 * 클라이언트로 재확인한 뒤에만 취소한다(app/parent/booking-actions.ts의
 * assertReservationBelongsToChild와 동일한 목적, teacher_id 기준 변형).
 */
export async function cancelMyLessonScheduleBooking(params: { reservationId: string; reason: string }): Promise<void> {
  const { user } = await requireUser();
  const admin = createAdminClient();
  const { data } = await admin.from("reservations").select("owner_profile_id").eq("id", params.reservationId).maybeSingle();
  if (!data || data.owner_profile_id !== user.id) {
    throw new Error("본인 수업만 취소할 수 있습니다.");
  }
  return cancelLessonBooking({
    reservationId: params.reservationId,
    cancelledByRole: "teacher",
    cancelledById: user.id,
    reason: params.reason,
  });
}
