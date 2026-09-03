"use server";

// R6 6/N — 관리자 예약 운영 액션: 24시간 이내 예외 예약 생성, 회사/선생님 귀책 취소,
// Google 동기화 불일치(reconciliation_needed) 조회·재처리 트리거.

import { requireAdminOrCapability } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { confirmLessonBooking, cancelLessonBooking } from "@/lib/booking/create-booking";
import { processPendingCalendarSyncs } from "@/lib/booking/calendar-sync";
import { reconcileTeacherCalendarChanges } from "@/lib/booking/external-change-detection";
import {
  acceptGoogleTimeForReservation,
  restoreGoogleEventToAltonTime,
  recreateCalendarEventAfterDeletion,
} from "@/lib/booking/external-change-resolution";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";

const BOOKING_CAPABILITY = "예약관리권한";

export async function adminCreateLessonBooking(params: {
  childId: string;
  subjectEnrollmentId: string;
  teacherId: string;
  lessonTypeId: string;
  startsAt: Date;
  durationMinutes: number;
}): Promise<{ reservationId: string; sessionId: string }> {
  await requireAdminOrCapability(BOOKING_CAPABILITY);
  const idempotencyKey = `admin-booking:${params.childId}:${params.subjectEnrollmentId}:${params.startsAt.toISOString()}`;
  return confirmLessonBooking({ ...params, idempotencyKey, adminOverride: true });
}

export type AdminCancelReason = "teacher_unavailable" | "company_operational" | "other";

export async function adminCancelLessonBooking(params: {
  reservationId: string;
  cancelledByRole: "teacher" | "company";
  reason: string;
}): Promise<void> {
  const { actorUserId } = await requireAdminOrCapability(BOOKING_CAPABILITY);
  return cancelLessonBooking({
    reservationId: params.reservationId,
    cancelledByRole: params.cancelledByRole,
    cancelledById: actorUserId,
    reason: params.reason,
  });
}

export type ReconciliationRow = {
  reservationId: string;
  teacherId: string;
  teacherName: string | null;
  startsAt: string;
  googleSyncStatus: string;
  googleSyncError: string | null;
  googleSyncRetryCount: number;
};

/** Calendar/Meet 동기화가 재시도 한도를 넘겨 수동 개입이 필요한 예약 목록. */
export async function listReconciliationNeededBookings(): Promise<ReconciliationRow[]> {
  await requireAdminOrCapability(BOOKING_CAPABILITY);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("reservations")
    .select("id, owner_profile_id, starts_at, google_sync_status, google_sync_error, google_sync_retry_count, teacher:profiles!reservations_owner_profile_id_fkey(name)")
    .in("google_sync_status", ["reconciliation_needed", "failed"])
    .order("starts_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    reservationId: r.id as string,
    teacherId: r.owner_profile_id as string,
    teacherName: ((r.teacher as { name?: string } | null)?.name) ?? null,
    startsAt: r.starts_at as string,
    googleSyncStatus: r.google_sync_status as string,
    googleSyncError: (r.google_sync_error as string) ?? null,
    googleSyncRetryCount: r.google_sync_retry_count as number,
  }));
}

/** 관리자가 "지금 재처리" 버튼을 눌렀을 때 — 대기/실패 상태 예약에 대해 즉시 한 번 더 시도. */
export async function retryCalendarSyncNow(): Promise<{
  attempted: number;
  succeeded: number;
  failed: number;
  reconciliationNeeded: number;
}> {
  await requireAdminOrCapability(BOOKING_CAPABILITY);
  const result = await processPendingCalendarSyncs();
  return {
    attempted: result.attempted,
    succeeded: result.succeeded,
    failed: result.failed,
    reconciliationNeeded: result.reconciliationNeeded,
  };
}

export type NotificationOutboxSummary = {
  notificationType: string;
  status: string;
  count: number;
};

/**
 * R6 8/N — 알림 outbox 발송 대기 현황 요약(type × status 건수). 실제 발송 인프라가 없으므로
 * "발송 대기 상태까지만 검증"하는 이 R6 범위에서는 sent가 항상 0이다 — 그 자체가 정상이다
 * (R4에서 이미 등록된 정식 오픈 전 blocker, 실제 이메일 발송 미구현).
 */
export async function listNotificationOutboxSummary(): Promise<NotificationOutboxSummary[]> {
  await requireAdminOrCapability(BOOKING_CAPABILITY);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("booking_notification_outbox")
    .select("notification_type, status");
  if (error) throw new Error(error.message);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const key = `${row.notification_type}::${row.status}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([key, count]) => {
    const [notificationType, status] = key.split("::");
    return { notificationType, status, count };
  });
}

export type UnifiedScheduleLessonRow = {
  reservationId: string;
  sessionId: string;
  teacherId: string;
  teacherName: string | null;
  studentName: string | null;
  subjectName: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
  googleSyncStatus: string;
  externalChangeStatus: string;
};

/**
 * R6 11/N — 관리자 통합 일정 화면용: `official` 관리자 계정에 선생님 개인 Google
 * Calendar를 직접 공유하지 않고, 전체 선생님의 확정 예약을 ALTON DB에서 중앙 조회한다.
 * 취소·변경은 기존 `adminCancelLessonBooking()`/`adminCreateLessonBooking()`이 이미
 * 타는 전체 재검증 체인(가용성·FreeBusy·버퍼·중복예약·수업권·알림)을 그대로 재사용한다 —
 * 이 함수는 조회 전용.
 */
export async function listAllTeacherLessons(): Promise<UnifiedScheduleLessonRow[]> {
  await requireAdminOrCapability(BOOKING_CAPABILITY);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("sessions")
    .select(
      "id, teacher_id, teacher:profiles!sessions_teacher_id_fkey(name), reservation:reservations!sessions_reservation_id_fkey(id, starts_at, ends_at, status, google_sync_status, external_change_status), subject_enrollment:subject_enrollments!sessions_subject_enrollment_id_fkey(subject:subjects(name), child:profiles!subject_enrollments_child_id_fkey(name))"
    )
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);

  function one<T>(rel: T | T[] | null | undefined): T | null {
    return Array.isArray(rel) ? (rel[0] ?? null) : (rel ?? null);
  }

  return (data ?? [])
    .map((row): UnifiedScheduleLessonRow | null => {
      const reservation = one(row.reservation as unknown) as {
        id?: string;
        starts_at?: string;
        ends_at?: string;
        status?: string;
        google_sync_status?: string;
        external_change_status?: string;
      } | null;
      if (!reservation?.id || reservation.status !== "confirmed") return null;
      const subjectEnrollment = one(row.subject_enrollment as unknown) as { subject?: unknown; child?: unknown } | null;
      return {
        reservationId: reservation.id,
        sessionId: row.id as string,
        teacherId: row.teacher_id as string,
        teacherName: (one(row.teacher as unknown) as { name?: string } | null)?.name ?? null,
        studentName: (one(subjectEnrollment?.child as unknown) as { name?: string } | null)?.name ?? null,
        subjectName: (one(subjectEnrollment?.subject as unknown) as { name?: string } | null)?.name ?? null,
        startsAt: reservation.starts_at as string,
        endsAt: reservation.ends_at as string,
        status: reservation.status,
        googleSyncStatus: reservation.google_sync_status ?? "pending",
        externalChangeStatus: reservation.external_change_status ?? "none",
      };
    })
    .filter((row): row is UnifiedScheduleLessonRow => row !== null)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

export type IncidentReportAdminRow = {
  id: string;
  sessionId: string;
  reportType: string;
  reportedByName: string | null;
  studentName: string | null;
  teacherName: string | null;
  minutesLate: number | null;
  notes: string | null;
  reportedAt: string;
};

/**
 * R6 10/N — 학생/보호자/선생님이 제출한 지각·노쇼 신고 목록(관리자 열람용). 최종 판정·
 * 수업권 소진·정산은 R7 범위 — 여기서는 신고 원문만 보여준다(가공·자동 확정 없음).
 */
export async function listRecentIncidentReports(): Promise<IncidentReportAdminRow[]> {
  await requireAdminOrCapability(BOOKING_CAPABILITY);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("session_incident_reports")
    .select(
      "id, session_id, report_type, minutes_late, notes, reported_at, reporter:profiles!session_incident_reports_reported_by_fkey(name), session:sessions!session_incident_reports_session_id_fkey(teacher:profiles!sessions_teacher_id_fkey(name), subject_enrollment:subject_enrollments!sessions_subject_enrollment_id_fkey(child:profiles!subject_enrollments_child_id_fkey(name)))"
    )
    .order("reported_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);

  function one<T>(rel: T | T[] | null): T | null {
    return Array.isArray(rel) ? (rel[0] ?? null) : rel;
  }

  return (data ?? []).map((r) => {
    const session = one(r.session as unknown) as { teacher?: unknown; subject_enrollment?: unknown } | null;
    const subjectEnrollment = one(session?.subject_enrollment as unknown) as { child?: unknown } | null;
    return {
      id: r.id as string,
      sessionId: r.session_id as string,
      reportType: r.report_type as string,
      reportedByName: (one(r.reporter as unknown) as { name?: string } | null)?.name ?? null,
      studentName: (one(subjectEnrollment?.child as unknown) as { name?: string } | null)?.name ?? null,
      teacherName: (one(session?.teacher as unknown) as { name?: string } | null)?.name ?? null,
      minutesLate: (r.minutes_late as number) ?? null,
      notes: (r.notes as string) ?? null,
      reportedAt: r.reported_at as string,
    };
  });
}

export type ExternalCalendarChangeRow = {
  reservationId: string;
  teacherName: string | null;
  startsAt: string;
  externalChangeStatus: string;
  externalChangeDetectedAt: string | null;
  externalChangeDetail: Record<string, unknown> | null;
};

const EXTERNAL_CHANGE_STATUS_LABEL: Record<string, string> = {
  time_changed: "시간 변경 감지",
  deleted: "이벤트 삭제 감지",
  meet_link_changed: "Meet 링크 변경 감지",
};

/**
 * R6 11/N — Google Calendar에서 직접 바뀐 ALTON 수업 이벤트 목록(관리자 확인 대기).
 * `reservations.external_change_status <> 'none'`인 것만 반환 — 감지만 됐을 뿐 예약·
 * 세션·수업권 hold는 전혀 바뀌지 않은 상태다.
 */
export async function listExternalCalendarChanges(): Promise<ExternalCalendarChangeRow[]> {
  await requireAdminOrCapability(BOOKING_CAPABILITY);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("reservations")
    .select(
      "id, starts_at, external_change_status, external_change_detected_at, external_change_detail, teacher:profiles!reservations_owner_profile_id_fkey(name)"
    )
    .neq("external_change_status", "none")
    .order("external_change_detected_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    reservationId: r.id as string,
    teacherName: ((r.teacher as { name?: string } | null)?.name) ?? null,
    startsAt: r.starts_at as string,
    externalChangeStatus: r.external_change_status as string,
    externalChangeDetectedAt: (r.external_change_detected_at as string) ?? null,
    externalChangeDetail: (r.external_change_detail as Record<string, unknown>) ?? null,
  }));
}

export type ExternalChangeResolution =
  | "accepted_google_time"
  | "kept_alton_time"
  | "confirmed_cancelled"
  | "dismissed"
  | "recreated_after_deletion";

/**
 * 관리자가 외부 변경을 확인·처리한다. **이 함수 자체는 재검증을 하지 않는다** —
 * "kept_alton_time"(ALTON 시간 유지, Google 쪽을 다시 덮어쓰기) 처리는 호출부가
 * syncOneReservationCalendarEvent 등으로 Google을 ALTON 상태에 맞게 재동기화한 뒤에만
 * 호출해야 하고, "accepted_google_time"(Google 시간을 ALTON에 반영) 처리는 호출부가
 * 가용성·FreeBusy·버퍼·중복예약·수업권·알림 영향을 전부 재검사해 통과시킨 뒤에만
 * 호출해야 한다 — 이 함수는 그 검사를 통과했다고 가정하고 external_change_status만
 * 정리하는 "확정 기록" 단계다(다른 R6 확정 함수와 동일한 계층 분리).
 */
export async function resolveExternalCalendarChange(params: {
  reservationId: string;
  resolution: ExternalChangeResolution;
  reason: string;
}): Promise<void> {
  const { actorUserId } = await requireAdminOrCapability(BOOKING_CAPABILITY);
  const admin = createAdminClient();
  const { error } = await admin.rpc("resolve_external_calendar_change", {
    p_reservation_id: params.reservationId,
    p_admin_id: actorUserId,
    p_resolution: params.resolution,
    p_reason: params.reason,
  });
  if (error) throw new Error(error.message);
}

/**
 * "Google 시간 반영" — external_change_detail에 저장된 Google 쪽 새 시간을 재검증(가용성·
 * 버퍼·중복예약·수업권) 후 ALTON DB에 반영한다. 재검증 실패 시 예외를 던지고
 * external_change_status는 그대로 남는다(어중간하게 확정 처리되지 않음).
 */
export async function resolveExternalChangeAcceptGoogleTime(params: { reservationId: string; reason: string }): Promise<void> {
  const { actorUserId } = await requireAdminOrCapability(BOOKING_CAPABILITY);
  const admin = createAdminClient();
  const { data: reservation, error } = await admin
    .from("reservations")
    .select("external_change_detail")
    .eq("id", params.reservationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const detail = reservation?.external_change_detail as { google_starts_at?: string; google_ends_at?: string } | null;
  if (!detail?.google_starts_at || !detail?.google_ends_at) {
    throw new Error("Google 쪽 새 시간 정보가 없습니다(감지 데이터 누락).");
  }

  await acceptGoogleTimeForReservation({
    reservationId: params.reservationId,
    googleStartsAt: detail.google_starts_at,
    googleEndsAt: detail.google_ends_at,
    adminId: actorUserId,
    reason: params.reason,
  });
  await resolveExternalCalendarChange({ reservationId: params.reservationId, resolution: "accepted_google_time", reason: params.reason });
}

/**
 * "ALTON 시간 유지" — ALTON DB는 그대로 두고 Google 이벤트만 ALTON 기준 시간으로
 * 되돌린다. 재검증하지 않는다(ALTON 시간은 confirm_lesson_booking() 통과 시점에 이미
 * 유효했음).
 */
export async function resolveExternalChangeKeepAltonTime(params: { reservationId: string; reason: string }): Promise<void> {
  const { actorUserId } = await requireAdminOrCapability(BOOKING_CAPABILITY);
  const admin = createAdminClient();
  const { data: reservation, error } = await admin
    .from("reservations")
    .select("starts_at, ends_at, google_event_id, owner_profile_id")
    .eq("id", params.reservationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!reservation?.google_event_id) {
    throw new Error("Google 이벤트 정보가 없어 복원할 수 없습니다.");
  }
  const { data: teacher, error: teacherError } = await admin
    .from("teachers")
    .select("workspace_email")
    .eq("id", reservation.owner_profile_id as string)
    .maybeSingle();
  if (teacherError) throw new Error(teacherError.message);
  if (!teacher?.workspace_email) {
    throw new Error(`선생님(${reservation.owner_profile_id})의 workspace_email이 없어 복원할 수 없습니다.`);
  }

  await restoreGoogleEventToAltonTime({
    reservationId: params.reservationId,
    teacherWorkspaceEmail: teacher.workspace_email as string,
    googleEventId: reservation.google_event_id as string,
    altonStartsAt: reservation.starts_at as string,
    altonEndsAt: reservation.ends_at as string,
    timezone: DEFAULT_TIMEZONE,
    adminId: actorUserId,
    reason: params.reason,
  });
  await resolveExternalCalendarChange({ reservationId: params.reservationId, resolution: "kept_alton_time", reason: params.reason });
}

/**
 * "ALTON 일정 유지"(Google 이벤트 직접 삭제 케이스) — 예약·세션·수업권 hold는 그대로
 * 두고 담당 선생님 소유의 Calendar 이벤트+Meet을 다시 생성한다. 자동 재생성이 아니라
 * 관리자가 이 버튼을 명시적으로 눌러야만 실행된다.
 */
export async function resolveExternalChangeRecreateAfterDeletion(params: { reservationId: string; reason: string }): Promise<void> {
  const { actorUserId } = await requireAdminOrCapability(BOOKING_CAPABILITY);
  await recreateCalendarEventAfterDeletion({ reservationId: params.reservationId, adminId: actorUserId, reason: params.reason });
  await resolveExternalCalendarChange({ reservationId: params.reservationId, resolution: "recreated_after_deletion", reason: params.reason });
}

/**
 * "예약 취소"(Google 이벤트 직접 삭제 케이스) — 기존 정식 취소 절차(cancelLessonBooking,
 * 회사 귀책)를 실행해 예약·세션·수업권·알림·Google 상태를 함께 정리한다. 자동 취소가
 * 아니라 관리자가 이 버튼을 명시적으로 눌러야만 실행된다.
 */
export async function resolveExternalChangeCancelDueToDeletion(params: { reservationId: string; reason: string }): Promise<void> {
  const { actorUserId } = await requireAdminOrCapability(BOOKING_CAPABILITY);
  await cancelLessonBooking({
    reservationId: params.reservationId,
    cancelledByRole: "company",
    cancelledById: actorUserId,
    reason: params.reason,
  });
  await resolveExternalCalendarChange({ reservationId: params.reservationId, resolution: "confirmed_cancelled", reason: params.reason });
}

/** 관리자가 "지금 재처리"를 누를 때 재처리 워커와 함께 모든 선생님의 외부 변경도 한 번 대조한다. */
export async function retryExternalCalendarReconciliationNow(): Promise<{ teachersChecked: number; changesDetected: number }> {
  await requireAdminOrCapability(BOOKING_CAPABILITY);
  const admin = createAdminClient();
  const { data: teachers, error } = await admin.from("teachers").select("id").not("workspace_email", "is", null);
  if (error) throw new Error(error.message);

  let teachersChecked = 0;
  let changesDetected = 0;
  for (const t of teachers ?? []) {
    const result = await reconcileTeacherCalendarChanges(t.id as string);
    if (result.checked) teachersChecked += 1;
    changesDetected += result.changesDetected;
  }
  return { teachersChecked, changesDetected };
}
