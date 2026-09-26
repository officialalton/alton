// P4-1(B) — 경량 가구 아카이브·복귀 오케스트레이션.
//
// DB 소스오브트루스: supabase/migrations/20261283000000_p4_1b_household_archive.sql
// 착수 정리: docs/2026-09-11-p4-1b-household-archive-plan.md
//
// 제품 오너 확정 정책(2026-09-11):
//  * C-2 종료 파이프라인(processTeacherAssignmentTermination)과 cancelLessonBooking()을
//    그대로 재사용한다 — 새 종료·취소 경로를 만들지 않는다.
//  * 진행 중(live) 수업이 있으면 **어떤 변경보다 먼저** 차단한다(부분 진행 금지).
//  * 완료된 수업과 이미 소진된 수업권은 보존한다(C-2의 skipped_already_delivered 규칙).
//  * 복귀는 플래그 해제만 한다 — 예약·매칭·수강 상태를 자동 복원하지 않는다.
//
// 하나의 큰 plpgsql 트랜잭션으로 만들 수 없다: 예약 취소가 DB RPC + Google Calendar
// 삭제(HTTP) 조합이기 때문이다. 대신 teacher_assignment_termination_requests와 같은
// 패턴(선점 + 항목별 멱등 처리 + 재시도)을 한 단계 위에서 반복한다.

import { createAdminClient } from "@/lib/supabase-admin";
import { cancelLessonBooking } from "@/lib/booking/create-booking";
import {
  createTerminationRequest,
  processTeacherAssignmentTermination,
} from "@/lib/enrollment/teacher-assignment-termination";

export type HouseholdArchiveImpact = {
  childId: string;
  activeAssignmentCount: number;
  cancellableReservationCount: number;
  liveReservationCount: number;
};

export type HouseholdArchiveResult =
  | { status: "completed"; requestId: string | null; endedAssignments: number; cancelledReservations: number }
  // blocked: 진행 중 수업 때문에 아무 것도 바꾸지 않고 멈춘 상태(재시도 가능).
  | { status: "blocked"; requestId: string; error: string }
  | { status: "failed"; requestId: string; error: string };

export async function previewHouseholdArchiveImpact(householdId: string): Promise<HouseholdArchiveImpact[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("preview_household_archive_impact", { p_household_id: householdId });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: Record<string, unknown>) => ({
    childId: row.child_id as string,
    activeAssignmentCount: Number(row.active_assignment_count ?? 0),
    cancellableReservationCount: Number(row.cancellable_reservation_count ?? 0),
    liveReservationCount: Number(row.live_reservation_count ?? 0),
  }));
}

export async function archiveHousehold(params: {
  householdId: string;
  actorId: string;
}): Promise<HouseholdArchiveResult> {
  const admin = createAdminClient();

  const { data: household, error: householdError } = await admin
    .from("households")
    .select("id, archived_at")
    .eq("id", params.householdId)
    .maybeSingle();
  if (householdError) throw new Error(householdError.message);
  if (!household) throw new Error("존재하지 않는 가구입니다.");
  // 이미 아카이브됨 — 재실행해도 아무 것도 바꾸지 않는다(멱등).
  if (household.archived_at) {
    return { status: "completed", requestId: null, endedAssignments: 0, cancelledReservations: 0 };
  }

  const requestId = await claimArchiveRequest(params.householdId, params.actorId);

  try {
    // 1) 진행 중 수업 확인 — 어느 예약도 손대기 전에 전체를 먼저 본다.
    const impact = await previewHouseholdArchiveImpact(params.householdId);
    const liveTotal = impact.reduce((sum, i) => sum + i.liveReservationCount, 0);
    if (liveTotal > 0) {
      const message = `진행 중인 수업이 ${liveTotal}건 있어 지금 아카이브할 수 없습니다 — 수업이 끝난 뒤 다시 시도하세요.`;
      await failRequest(requestId, message);
      return { status: "blocked", requestId, error: message };
    }

    const childIds = impact.map((i) => i.childId);
    const enrollmentIds = await loadEnrollmentIds(childIds);

    // 2) 활성 매칭 종료 — C-2 종료 파이프라인 재사용(end_enrollment).
    const endedAssignments = await endActiveAssignments(enrollmentIds, params.actorId);

    // 3) 배정 종료로도 남은 미래 확정 예약 취소(배정에 딸리지 않은 건).
    const cancelledReservations = await cancelRemainingFutureReservations(enrollmentIds, params.actorId);

    // 4) 전부 성공했을 때만 아카이브 플래그를 세운다.
    const nowIso = new Date().toISOString();
    const { error: archiveError } = await admin
      .from("households")
      .update({ archived_at: nowIso, archived_by: params.actorId })
      .eq("id", params.householdId)
      .is("archived_at", null);
    if (archiveError) throw new Error(archiveError.message);

    await admin.from("household_archive_events").insert({
      household_id: params.householdId,
      action: "archived",
      actor_id: params.actorId,
      detail: {
        ended_assignments: endedAssignments,
        cancelled_reservations: cancelledReservations,
        children: childIds.length,
        request_id: requestId,
      },
    });
    await admin
      .from("household_archive_requests")
      .update({ status: "completed", error: null, updated_at: nowIso })
      .eq("id", requestId);

    return { status: "completed", requestId, endedAssignments, cancelledReservations };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await failRequest(requestId, message);
    return { status: "failed", requestId, error: message };
  }
}

export async function restoreHousehold(params: {
  householdId: string;
  actorId: string;
}): Promise<{ restored: boolean }> {
  const admin = createAdminClient();
  // 복귀는 플래그 해제만 한다 — 취소된 예약·종료된 매칭·수강 상태는 복원하지 않는다.
  const { data, error } = await admin
    .from("households")
    .update({ archived_at: null, archived_by: null })
    .eq("id", params.householdId)
    .not("archived_at", "is", null)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { restored: false }; // 이미 활성 상태 — 멱등.

  await admin.from("household_archive_events").insert({
    household_id: params.householdId,
    action: "restored",
    actor_id: params.actorId,
    detail: { note: "예약·매칭 자동 복원 없음(확정 정책)" },
  });
  return { restored: true };
}

// 아카이브된 가구에 속한 profile id 집합 — 관리자 목록에서 제외할 때 쓴다(왕복 1회).
// 호출자가 이미 admin 클라이언트를 들고 있으면 그대로 넘긴다(목록 로더는 대부분
// 그렇다) — 여기서 새로 만들면 같은 요청에 클라이언트가 둘 생기고, 클라이언트를
// 주입받아 테스트하는 기존 로더 스펙에서도 쓸 수 없게 된다.
export async function archivedHouseholdProfileIds(
  client?: ReturnType<typeof createAdminClient>
): Promise<Set<string>> {
  const admin = client ?? createAdminClient();
  const { data, error } = await admin.rpc("archived_household_profile_ids");
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row: Record<string, unknown>) => row.profile_id as string));
}

// ---------------------------------------------------------------------------

async function claimArchiveRequest(householdId: string, actorId: string): Promise<string> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  // 재시도는 새 요청을 만들지 않고 기존 요청을 이어 쓴다 — 관리자 화면에서
  // "이 가구의 아카이브가 어디까지 갔는지"가 한 줄로 보이게 하기 위함.
  const { data: existing, error: existingError } = await admin
    .from("household_archive_requests")
    .select("id, status")
    .eq("household_id", householdId)
    .in("status", ["requested", "processing", "failed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  if (existing) {
    const { data: claimed, error: claimError } = await admin
      .from("household_archive_requests")
      .update({ status: "processing", requested_by: actorId, error: null, updated_at: nowIso })
      .eq("id", existing.id)
      .in("status", ["requested", "failed"])
      .select("id")
      .maybeSingle();
    if (claimError) throw new Error(claimError.message);
    if (!claimed) throw new Error("이미 처리 중인 아카이브 요청입니다. 잠시 후 다시 시도하세요.");
    return claimed.id as string;
  }

  const { data: created, error: createError } = await admin
    .from("household_archive_requests")
    .insert({ household_id: householdId, status: "processing", requested_by: actorId })
    .select("id")
    .single();
  if (createError) throw new Error(createError.message);
  return created.id as string;
}

async function failRequest(requestId: string, message: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("household_archive_requests")
    .update({ status: "failed", error: message, updated_at: new Date().toISOString() })
    .eq("id", requestId);
}

async function loadEnrollmentIds(childIds: string[]): Promise<string[]> {
  if (childIds.length === 0) return [];
  const admin = createAdminClient();
  const { data, error } = await admin.from("subject_enrollments").select("id").in("child_id", childIds);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.id as string);
}

async function endActiveAssignments(enrollmentIds: string[], actorId: string): Promise<number> {
  if (enrollmentIds.length === 0) return 0;
  const admin = createAdminClient();
  const { data: assignments, error } = await admin
    .from("teacher_assignments")
    .select("id, subject_enrollment_id")
    .eq("status", "active")
    .in("subject_enrollment_id", enrollmentIds);
  if (error) throw new Error(error.message);

  let ended = 0;
  for (const assignment of assignments ?? []) {
    const requestId = await reuseOrCreateTerminationRequest(
      assignment.subject_enrollment_id as string,
      assignment.id as string,
      actorId
    );
    if (!requestId) continue; // 이미 완료된 종료 요청이 있다 — 건너뛴다(멱등).
    const result = await processTeacherAssignmentTermination({
      requestId,
      resolution: "end_enrollment",
      processedBy: actorId,
    });
    if (result.status !== "completed") {
      throw new Error(result.error ?? "매칭 종료 처리에 실패했습니다.");
    }
    ended += 1;
  }
  return ended;
}

// 재실행 시 종료 요청이 중복 생성되지 않게 한다. 이미 완료된 요청이 있으면 null을
// 돌려 건너뛰고, 진행 중·실패 요청이 있으면 그 id를 그대로 이어 쓴다.
async function reuseOrCreateTerminationRequest(
  subjectEnrollmentId: string,
  teacherAssignmentId: string,
  actorId: string
): Promise<string | null> {
  const admin = createAdminClient();
  const { data: existing, error } = await admin
    .from("teacher_assignment_termination_requests")
    .select("id, status")
    .eq("teacher_assignment_id", teacherAssignmentId)
    .in("status", ["requested", "processing", "failed", "completed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (existing?.status === "completed") return null;
  if (existing) return existing.id as string;

  const { requestId } = await createTerminationRequest({
    subjectEnrollmentId,
    teacherAssignmentId,
    requestedByRole: "admin",
    requestedBy: actorId,
    reason: "가구 아카이브에 따른 매칭 종료",
  });
  return requestId;
}

async function cancelRemainingFutureReservations(enrollmentIds: string[], actorId: string): Promise<number> {
  if (enrollmentIds.length === 0) return 0;
  const admin = createAdminClient();

  const { data: reservations, error } = await admin
    .from("reservations")
    .select("id")
    .eq("kind", "lesson")
    .eq("status", "confirmed")
    .gt("starts_at", new Date().toISOString())
    .in("subject_enrollment_id", enrollmentIds);
  if (error) throw new Error(error.message);
  if (!reservations?.length) return 0;

  const reservationIds = reservations.map((r) => r.id as string);
  const { data: sessions, error: sessionsError } = await admin
    .from("sessions")
    .select("reservation_id, final_status")
    .in("reservation_id", reservationIds);
  if (sessionsError) throw new Error(sessionsError.message);
  const finalStatusByReservation = new Map(
    (sessions ?? []).map((s) => [s.reservation_id as string, s.final_status as string])
  );

  let cancelled = 0;
  for (const reservationId of reservationIds) {
    // 이미 최종 판정된 세션(완료·취소·노쇼 등)은 손대지 않는다 — 완료된 수업과
    // 이미 소진된 수업권을 보존한다. 세션 행이 없으면 아직 예정 상태로 본다.
    const finalStatus = finalStatusByReservation.get(reservationId) ?? "scheduled";
    if (finalStatus !== "scheduled") continue;
    await cancelLessonBooking({
      reservationId,
      cancelledByRole: "company",
      cancelledById: actorId,
      reason: "가구 아카이브에 따른 예약 취소",
    });
    cancelled += 1;
  }
  return cancelled;
}
