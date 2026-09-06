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

// =========================================================================
// M5-a(R7) — 세션 최종판정·관리자 보정. 접속기록(session_incident_reports/
// session_access_events)은 증거일 뿐 이 화면에서 관리자가 명확한 규칙 기반 함수
// (finalize_lesson_session/reopen_session/recomplete_session)로 확정해야만
// 최종 판정이 된다(자동 확정 없음 — 요구사항 5).
// =========================================================================

export type SessionJudgmentRow = {
  sessionId: string;
  reservationId: string;
  teacherName: string | null;
  studentName: string | null;
  subjectName: string | null;
  startsAt: string;
  endsAt: string;
  finalStatus: string;
  isTrial: boolean;
  incidentReportCount: number;
  // true면 이 세션은 한 번 확정됐다가 admin_reopen으로 재개방된 상태('live') —
  // entitlement가 이미 소진/해제됐으므로 첫 판정용 finalize_lesson_session()이 아니라
  // recomplete_session()으로 재확정해야 한다(중복 소진/해제 방지).
  wasReopened: boolean;
};

function toSessionJudgmentRows(
  data: Array<Record<string, unknown>>,
  incidentCountBySession: Map<string, number>,
  reopenedSessionIds?: Set<string>
): SessionJudgmentRow[] {
  function one<T>(rel: T | T[] | null | undefined): T | null {
    return Array.isArray(rel) ? (rel[0] ?? null) : (rel ?? null);
  }
  return (data ?? []).map((row) => {
    const reservation = one(row.reservation as unknown) as { id?: string; starts_at?: string; ends_at?: string } | null;
    const subjectEnrollment = one(row.subject_enrollment as unknown) as { subject?: unknown; child?: unknown } | null;
    const teacher = one(row.teacher as unknown) as { name?: string } | null;
    const lessonType = one(row.lesson_type as unknown) as { code?: string } | null;
    return {
      sessionId: row.id as string,
      reservationId: reservation?.id ?? "",
      teacherName: teacher?.name ?? null,
      studentName: (one(subjectEnrollment?.child as unknown) as { name?: string } | null)?.name ?? null,
      subjectName: (one(subjectEnrollment?.subject as unknown) as { name?: string } | null)?.name ?? null,
      startsAt: reservation?.starts_at ?? "",
      endsAt: reservation?.ends_at ?? "",
      finalStatus: row.final_status as string,
      isTrial: lessonType?.code === "trial",
      incidentReportCount: incidentCountBySession.get(row.id as string) ?? 0,
      wasReopened: reopenedSessionIds?.has(row.id as string) ?? false,
    };
  });
}

async function reopenedSessionIdSet(admin: ReturnType<typeof createAdminClient>, sessionIds: string[]): Promise<Set<string>> {
  if (sessionIds.length === 0) return new Set();
  const { data } = await admin
    .from("session_status_events")
    .select("session_id")
    .eq("event_type", "reopened")
    .in("session_id", sessionIds);
  return new Set((data ?? []).map((r) => r.session_id as string));
}

const SESSION_JUDGMENT_SELECT =
  "id, final_status, lesson_type:lesson_types(code), teacher:profiles!sessions_teacher_id_fkey(name), " +
  "reservation:reservations!sessions_reservation_id_fkey(id, starts_at, ends_at), " +
  "subject_enrollment:subject_enrollments!sessions_subject_enrollment_id_fkey(subject:subjects(name), child:profiles!subject_enrollments_child_id_fkey(name))";

async function incidentReportCounts(admin: ReturnType<typeof createAdminClient>, sessionIds: string[]): Promise<Map<string, number>> {
  if (sessionIds.length === 0) return new Map();
  const { data } = await admin.from("session_incident_reports").select("session_id").in("session_id", sessionIds);
  const counts = new Map<string, number>();
  for (const r of data ?? []) {
    const id = r.session_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/**
 * 예약 시간이 이미 지났는데 아직 최종판정(final_status)이 'scheduled'/'live'로 남아있는
 * 세션 — 선생님이 "수업 종료"를 누르지 않았거나 판정이 필요한 건들. 관리자가 이 화면에서
 * finalize_lesson_session()으로 직접 확정한다.
 */
export async function listSessionsNeedingFinalJudgment(): Promise<SessionJudgmentRow[]> {
  await requireAdminOrCapability(BOOKING_CAPABILITY);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("sessions")
    .select(SESSION_JUDGMENT_SELECT)
    .in("final_status", ["scheduled", "live"])
    .order("id", { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);

  const preRows = toSessionJudgmentRows(data as unknown as Array<Record<string, unknown>>, new Map());
  const ended = preRows.filter((r) => r.endsAt && new Date(r.endsAt).getTime() < Date.now());
  const [counts, reopened] = await Promise.all([
    incidentReportCounts(admin, ended.map((r) => r.sessionId)),
    reopenedSessionIdSet(admin, ended.map((r) => r.sessionId)),
  ]);
  return ended.map((r) => ({
    ...r,
    incidentReportCount: counts.get(r.sessionId) ?? 0,
    wasReopened: reopened.has(r.sessionId),
  }));
}

/** 최근 확정(완료/노쇼/취소 등)된 세션 — 관리자가 재판정(reopen)이 필요한지 훑어보는 목록. */
export async function listRecentlyFinalizedSessions(): Promise<SessionJudgmentRow[]> {
  await requireAdminOrCapability(BOOKING_CAPABILITY);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("sessions")
    .select(SESSION_JUDGMENT_SELECT)
    .not("final_status", "in", "(scheduled,live)")
    .order("finalized_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  const rows = toSessionJudgmentRows(data as unknown as Array<Record<string, unknown>>, new Map());
  const counts = await incidentReportCounts(admin, rows.map((r) => r.sessionId));
  return rows.map((r) => ({ ...r, incidentReportCount: counts.get(r.sessionId) ?? 0 }));
}

export type SessionOutcome = "completed" | "student_no_show" | "teacher_no_show";

/**
 * 관리자가 15분 미접속 최종 노쇼를 확정하거나, 선생님이 종료 버튼을 누르지 않은 완료
 * 수업을 대신 확정하거나, 선생님 노쇼를 확정한다. 4대 규칙(취소는 cancel_lesson_booking,
 * 이 셋은 finalize_lesson_session)을 그대로 재사용 — 여기서 새 판정 로직을 만들지 않는다.
 */
export async function adminFinalizeLessonSession(params: {
  sessionId: string;
  outcome: SessionOutcome;
  reason: string;
  /** M5-b: 선생님 사유로 실제 제공 시간이 90분 미만이면 자동 QC 경고 대상 — 선택 입력. */
  teacherFaultProvidedMinutes?: number;
}): Promise<void> {
  const { actorUserId, supabase } = await requireAdminOrCapability(BOOKING_CAPABILITY);
  const admin = createAdminClient();

  // 이 세션이 한 번 확정됐다가 reopen_session()으로 재개방된 상태라면 entitlement가
  // 이미 소진/해제된 뒤다 — finalize_lesson_session()을 다시 부르면 consume_entitlement/
  // release_entitlement의 기존 "이미 처리됨" 가드에 걸린다. 그 경우는 recomplete_session()
  // (RLS-scoped 클라이언트, is_admin() 검사 필요)으로 재확정한다 — payable_minutes/정산
  // 항목만 재계산하고 entitlement 원장은 건드리지 않는다(수동 조정은 EntitlementLedgerTab).
  const [{ data: reopened }] = await Promise.all([
    admin.from("session_status_events").select("id").eq("session_id", params.sessionId).eq("event_type", "reopened").limit(1),
  ]);

  if (reopened && reopened.length > 0) {
    const { error } = await supabase.rpc("recomplete_session", {
      p_session_id: params.sessionId,
      p_new_final_status: params.outcome,
      p_reason: params.reason,
    });
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await admin.rpc("finalize_lesson_session", {
    p_session_id: params.sessionId,
    p_outcome: params.outcome,
    p_actor_id: actorUserId,
    p_reason: params.reason,
    p_teacher_fault_provided_minutes: params.teacherFaultProvidedMinutes ?? null,
  });
  if (error) throw new Error(error.message);
}

/**
 * M5-b(요구사항 4/5) — 회사·Meet 장애는 자동 감지하지 않는다. 관리자가 이 액션으로 수동
 * 최종판정한다. providedMinutes<=0(또는 미입력)이면 "미시작"(수업권 hold 복원·0분 정산·
 * 예약 취소로 재예약 가능), >0이면 "중단"(120분 정산 상한 + 못 제공한 분 보충시간 이관).
 */
export async function adminFinalizeSessionAsInfraIncident(params: {
  sessionId: string;
  reason: string;
  providedMinutes?: number;
}): Promise<void> {
  const { actorUserId } = await requireAdminOrCapability(BOOKING_CAPABILITY);
  const admin = createAdminClient();
  const { error } = await admin.rpc("finalize_session_as_infra_incident", {
    p_session_id: params.sessionId,
    p_actor_id: actorUserId,
    p_reason: params.reason,
    p_provided_minutes: params.providedMinutes ?? 0,
  });
  if (error) throw new Error(error.message);
}

/**
 * M5-c(2026-09-06) — 선생님 사유로 일부만 제공된 세션(teacher_partial_interruption)을
 * 관리자가 수동 최종판정한다. 수업권 1장 소진 + 실제 제공 분만 지급 + 미제공분은
 * makeup_obligations(reason='teacher_partial_interruption')로 이관 + 90분 미만이면 QC 경고.
 * resolve_teacher_lateness()가 이미 적용된 세션(late_start_minutes 채워짐)에는 DB 함수가
 * 중복 적용을 거부한다(지각과 부분중단은 서로 다른 사유).
 */
export async function adminResolveTeacherPartialInterruption(params: {
  sessionId: string;
  actualProvidedMinutes: number;
  reason: string;
}): Promise<void> {
  const { actorUserId } = await requireAdminOrCapability(BOOKING_CAPABILITY);
  const admin = createAdminClient();
  const { error } = await admin.rpc("resolve_teacher_partial_interruption", {
    p_session_id: params.sessionId,
    p_actual_provided_minutes: params.actualProvidedMinutes,
    p_actor_id: actorUserId,
    p_reason: params.reason,
  });
  if (error) throw new Error(error.message);
}

export type MakeupObligationRow = {
  obligationId: string;
  childId: string;
  childName: string | null;
  teacherId: string;
  teacherName: string | null;
  reason: string;
  owedMinutes: number;
  remainingMinutes: number;
  createdAt: string;
  /** 2026-09-05 확정: 생성 후 30일. 만료되면 apply_makeup_time_to_booking()이 적용을 거부한다. */
  expiresAt: string;
};

/**
 * M5-b(요구사항 9) — 잔여 보충시간(makeup_balances 뷰, owed_minutes+applied 합산 파생값)이
 * 남은 의무 목록, 관리자 열람·적용용. makeup_balances는 뷰라 PostgREST 임베드 조인 대상이
 * 아니므로 obligation과 balance를 각각 조회해 애플리케이션에서 합친다.
 */
export async function listOutstandingMakeupObligations(): Promise<MakeupObligationRow[]> {
  await requireAdminOrCapability(BOOKING_CAPABILITY);
  const admin = createAdminClient();
  const [{ data, error }, { data: balances, error: balanceError }] = await Promise.all([
    admin
      .from("makeup_obligations")
      .select(
        "id, child_id, teacher_id, reason, owed_minutes, created_at, expires_at, " +
          "child:profiles!makeup_obligations_child_id_fkey(name), teacher:profiles!makeup_obligations_teacher_id_fkey(name)"
      )
      .order("created_at", { ascending: false })
      .limit(200),
    admin.from("makeup_balances").select("obligation_id, remaining_minutes"),
  ]);
  if (error) throw new Error(error.message);
  if (balanceError) throw new Error(balanceError.message);
  const remainingByObligation = new Map((balances ?? []).map((b) => [b.obligation_id as string, b.remaining_minutes as number]));
  function one<T>(rel: T | T[] | null | undefined): T | null {
    return Array.isArray(rel) ? (rel[0] ?? null) : (rel ?? null);
  }
  return (data as unknown as Array<Record<string, unknown>> | null ?? [])
    .map((row) => ({
      obligationId: row.id as string,
      childId: row.child_id as string,
      childName: (one(row.child as unknown) as { name?: string } | null)?.name ?? null,
      teacherId: row.teacher_id as string,
      teacherName: (one(row.teacher as unknown) as { name?: string } | null)?.name ?? null,
      reason: row.reason as string,
      owedMinutes: row.owed_minutes as number,
      remainingMinutes: remainingByObligation.get(row.id as string) ?? 0,
      createdAt: row.created_at as string,
      expiresAt: row.expires_at as string,
    }))
    .filter((row) => row.remainingMinutes > 0);
}

/**
 * M5-b(요구사항 6/7/8) — 보충시간을 새 예약으로 만들지 않고 기존 미래 정규 예약 뒤에
 * 이어붙인다. apply_makeup_time_to_booking()이 선생님 가능시간·충돌 검사 + 이중적용
 * 방지를 전부 처리하며, entitlement_ledger에는 아무 이벤트도 새로 만들지 않는다.
 */
export async function adminApplyMakeupTimeToBooking(params: {
  reservationId: string;
  obligationId: string;
  minutes: number;
}): Promise<void> {
  const { actorUserId } = await requireAdminOrCapability(BOOKING_CAPABILITY);
  const admin = createAdminClient();
  const { error } = await admin.rpc("apply_makeup_time_to_booking", {
    p_reservation_id: params.reservationId,
    p_obligation_id: params.obligationId,
    p_minutes: params.minutes,
    p_actor_id: actorUserId,
  });
  if (error) throw new Error(error.message);
}

/**
 * 잘못 확정된 세션을 재검토 상태('live')로 되돌린다(append-only 이력 —
 * session_status_events에 'reopened'로 남는다, 기존 행 UPDATE로 지우지 않음).
 */
export async function adminReopenSession(params: { sessionId: string; reason: string }): Promise<void> {
  // reopen_session()/recomplete_session()은 내부에서 auth.uid() 기반 is_admin()을
  // 검사하도록 설계됐다(R1 원본 코멘트) — service_role(admin 클라이언트)로 호출하면
  // auth.uid()가 비어 항상 거부되므로, 반드시 RLS-scoped(로그인 세션) 클라이언트로 호출한다.
  const { supabase } = await requireAdminOrCapability(BOOKING_CAPABILITY);
  const { error } = await supabase.rpc("reopen_session", { p_session_id: params.sessionId, p_reason: params.reason });
  if (error) throw new Error(error.message);
}

/**
 * reopen_session() 이후 올바른 최종 상태로 재확정한다 — payable_minutes/정산 항목도
 * 함께 재계산된다(M5-a 확장). entitlement 원장 자체의 반대 이벤트는 예약당 1건 제약상
 * 자동 역전이 불가능해, 소진/해제 여부가 바뀌는 재판정은 EntitlementLedgerTab의 기존
 * 관리자 조정 기능으로 수동 반영해야 한다(안내 문구는 화면에 표시).
 */
export async function adminRecompleteSession(params: {
  sessionId: string;
  newFinalStatus: SessionOutcome | "student_cancelled" | "teacher_cancelled" | "company_cancelled" | "interrupted";
  reason: string;
}): Promise<void> {
  const { supabase } = await requireAdminOrCapability(BOOKING_CAPABILITY);
  const { error } = await supabase.rpc("recomplete_session", {
    p_session_id: params.sessionId,
    p_new_final_status: params.newFinalStatus,
    p_reason: params.reason,
  });
  if (error) throw new Error(error.message);
}

export type ReconciliationTaskRow = {
  taskId: string;
  sessionId: string;
  priorFinalStatus: string;
  newFinalStatus: string;
  priorPayableMinutes: number | null;
  newPayableMinutes: number | null;
  currentEntitlementDisposition: string | null;
  expectedEntitlementDisposition: string | null;
  requiredEntitlementAdjustmentAmount: number;
  status: "pending" | "resolved" | "superseded" | "needs_review";
  createdAt: string;
  resolvedAt: string | null;
  reason: string | null;
};

/**
 * 2026-09-05 — 재판정(reopen_session()→recomplete_session())이 자동 생성한 entitlement 대사
 * 작업 목록. pending 상태만 관리자 화면에서 바로 반영 대상으로 노출한다(resolved는 이력 확인용).
 */
export async function listSessionJudgmentReconciliationTasks(): Promise<ReconciliationTaskRow[]> {
  await requireAdminOrCapability(BOOKING_CAPABILITY);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("session_judgment_reconciliation_tasks")
    .select(
      "id, session_id, prior_final_status, new_final_status, prior_payable_minutes, new_payable_minutes, current_entitlement_disposition, expected_entitlement_disposition, required_entitlement_adjustment_amount, status, created_at, resolved_at, reason"
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    taskId: row.id as string,
    sessionId: row.session_id as string,
    priorFinalStatus: row.prior_final_status as string,
    newFinalStatus: row.new_final_status as string,
    priorPayableMinutes: row.prior_payable_minutes as number | null,
    newPayableMinutes: row.new_payable_minutes as number | null,
    currentEntitlementDisposition: row.current_entitlement_disposition as string | null,
    expectedEntitlementDisposition: row.expected_entitlement_disposition as string | null,
    requiredEntitlementAdjustmentAmount: row.required_entitlement_adjustment_amount as number,
    status: row.status as "pending" | "resolved" | "superseded" | "needs_review",
    createdAt: row.created_at as string,
    resolvedAt: row.resolved_at as string | null,
    reason: row.reason as string | null,
  }));
}

/**
 * 2026-09-05 — 대사 작업을 반영한다. required_entitlement_adjustment_amount가 0이 아니면
 * adjust_entitlement()로 실제 entitlement_ledger 조정을 남긴다(멱등 — resolved/superseded/
 * needs_review 작업은 재반영 불가, RLS-scoped 클라이언트로 호출해 auth.uid()가 함수 안의
 * is_admin() 검사를 통과하게 한다).
 *
 * 2026-09-06: 반영 직전 세션의 실제 상태가 작업 생성 시점의 전제와 달라졌으면(오래된 전제가
 * 깨진 경우) 예외 없이 "needs_review"를 반환한다 — 조정은 적용되지 않고 작업은 needs_review로
 * 전환된다. 정상 반영되면 "resolved"를 반환한다.
 */
export async function resolveSessionJudgmentReconciliationTask(params: {
  taskId: string;
  reason: string;
}): Promise<{ result: "resolved" | "needs_review" }> {
  const { supabase } = await requireAdminOrCapability(BOOKING_CAPABILITY);
  const { data, error } = await supabase.rpc("resolve_session_reconciliation_task", {
    p_task_id: params.taskId,
    p_reason: params.reason,
  });
  if (error) throw new Error(error.message);
  return { result: (data as "resolved" | "needs_review") ?? "resolved" };
}
