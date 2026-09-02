"use server";

// R6 6/N — 관리자 예약 운영 액션: 24시간 이내 예외 예약 생성, 회사/선생님 귀책 취소,
// Google 동기화 불일치(reconciliation_needed) 조회·재처리 트리거.

import { requireAdminOrCapability } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { confirmLessonBooking, cancelLessonBooking } from "@/lib/booking/create-booking";
import { processPendingCalendarSyncs } from "@/lib/booking/calendar-sync";

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
