// M3 — 선생님 배정 종료(termination) 처리 오케스트레이션.
//
// 정책(2026-09-03 확정, 이전 "별도 체험 배정 모델" M3 지시는 전량 폐기):
// trial/regular는 teacher_assignments 레벨에서 분리된 개념이 아니다 — 단일 배정
// 관계이며, 실제 선생님 교체가 필요할 때만 change_teacher_assignment()를 쓴다.
// 이 모듈은 그 "실제 교체가 필요한 경우"의 정식 종료 플로우(요청 접수 → 영향 미리보기
// → 처리: 재배정 or 수강 종료 → 감사기록)만 담당한다.
//
// DB 소스오브트루스: supabase/migrations/20261014000000_m3_teacher_assignment_termination.sql

import { createAdminClient } from "@/lib/supabase-admin";
import { cancelLessonBooking } from "@/lib/booking/create-booking";

export type TerminationRequestedByRole = "guardian" | "teacher" | "admin";
export type TerminationResolution = "reassign" | "end_enrollment";

export type TerminationImpactReservation = {
  reservationId: string;
  startsAt: string;
  endsAt: string;
  hasActiveHold: boolean;
};

export async function previewTerminationImpact(
  teacherAssignmentId: string
): Promise<TerminationImpactReservation[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("preview_teacher_assignment_termination_impact", {
    p_teacher_assignment_id: teacherAssignmentId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: Record<string, unknown>) => ({
    reservationId: row.reservation_id as string,
    startsAt: row.starts_at as string,
    endsAt: row.ends_at as string,
    hasActiveHold: Boolean(row.has_active_hold),
  }));
}

export async function createTerminationRequest(params: {
  subjectEnrollmentId: string;
  teacherAssignmentId: string;
  requestedByRole: TerminationRequestedByRole;
  requestedBy: string;
  reason: string;
}): Promise<{ requestId: string }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("teacher_assignment_termination_requests")
    .insert({
      subject_enrollment_id: params.subjectEnrollmentId,
      teacher_assignment_id: params.teacherAssignmentId,
      requested_by_role: params.requestedByRole,
      requested_by: params.requestedBy,
      reason: params.reason,
      status: "requested",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { requestId: data.id as string };
}

export type ProcessTerminationParams = {
  requestId: string;
  resolution: TerminationResolution;
  processedBy: string;
  // resolution === "reassign" 일 때만 사용.
  newTeacherId?: string;
  effectiveFrom?: string;
};

export type ProcessTerminationResult = {
  status: "completed" | "failed";
  newAssignmentId?: string;
  error?: string;
};

// 멱등/재처리 가능 설계: status가 이미 'completed'면 바로 반환하고, 'processing' 중
// 중복 호출은 낙관적 락(conditional update)으로 한쪽만 진행하게 한다. 부분 실패 시
// status='failed' + error 컬럼에 사유를 남기고, 관리자가 다시 processTermination을
// 호출하면(동일 requestId) 이어서 재시도한다 — reservation별 처리는
// teacher_assignment_termination_reservation_actions에 이미 기록된 건은 건너뛴다.
export async function processTeacherAssignmentTermination(
  params: ProcessTerminationParams
): Promise<ProcessTerminationResult> {
  const admin = createAdminClient();

  const { data: request, error: fetchError } = await admin
    .from("teacher_assignment_termination_requests")
    .select("*")
    .eq("id", params.requestId)
    .single();
  if (fetchError || !request) {
    throw new Error(fetchError?.message ?? "종료 요청을 찾을 수 없습니다.");
  }
  if (request.status === "completed") {
    return { status: "completed", newAssignmentId: request.new_teacher_id ?? undefined };
  }
  if (request.status === "cancelled") {
    throw new Error("취소된 종료 요청입니다.");
  }

  // 요청을 processing으로 선점 (조건부 UPDATE — requested 또는 failed 상태에서만 전이).
  const { data: claimed, error: claimError } = await admin
    .from("teacher_assignment_termination_requests")
    .update({
      status: "processing",
      resolution: params.resolution,
      new_teacher_id: params.resolution === "reassign" ? params.newTeacherId : null,
      effective_from: params.effectiveFrom ?? null,
      processed_by: params.processedBy,
      error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.requestId)
    .in("status", ["requested", "failed"])
    .select("id")
    .maybeSingle();
  if (claimError) throw new Error(claimError.message);
  if (!claimed) {
    // 이미 다른 처리 흐름이 선점했거나 그 사이 완료됨 — 최신 상태 재조회로 반환.
    const { data: latest } = await admin
      .from("teacher_assignment_termination_requests")
      .select("status, new_teacher_id")
      .eq("id", params.requestId)
      .single();
    if (latest?.status === "completed") {
      return { status: "completed", newAssignmentId: latest.new_teacher_id ?? undefined };
    }
    throw new Error("이미 처리 중인 종료 요청입니다. 잠시 후 다시 시도하세요.");
  }

  try {
    const impact = await previewTerminationImpact(request.teacher_assignment_id);

    for (const r of impact) {
      const { data: already } = await admin
        .from("teacher_assignment_termination_reservation_actions")
        .select("id")
        .eq("termination_request_id", params.requestId)
        .eq("reservation_id", r.reservationId)
        .maybeSingle();
      if (already) continue; // 재처리 시 이미 처리한 예약은 건너뜀 — 중복 처리 방지.

      if (params.resolution === "reassign" && params.newTeacherId) {
        const reassigned = await tryReassignReservation(r.reservationId, params.newTeacherId);
        await admin.from("teacher_assignment_termination_reservation_actions").insert({
          termination_request_id: params.requestId,
          reservation_id: r.reservationId,
          action: reassigned ? "reassigned" : "cancelled",
          detail: reassigned
            ? "새 선생님 가능시간·중복예약 검증 통과, 예약 이관"
            : "새 선생님과 시간 충돌/가능시간 불일치 — 이관 불가하여 정식 취소 처리",
        });
        if (!reassigned) {
          await cancelLessonBooking({
            reservationId: r.reservationId,
            cancelledByRole: "company",
            cancelledById: params.processedBy,
            reason: "선생님 배정 종료 — 신규 선생님에게 이관 불가한 예약 취소",
          });
        }
      } else {
        // end_enrollment: 이관 대상 없음 — 전부 정식 취소(Calendar 삭제 + 보유분 해제 동시 처리).
        await cancelLessonBooking({
          reservationId: r.reservationId,
          cancelledByRole: "company",
          cancelledById: params.processedBy,
          reason: "선생님 배정 및 과목 수강 종료에 따른 예약 취소",
        });
        await admin.from("teacher_assignment_termination_reservation_actions").insert({
          termination_request_id: params.requestId,
          reservation_id: r.reservationId,
          action: "cancelled",
          detail: "수강 종료에 따른 정식 취소",
        });
      }
    }

    // 남은 미래 확정 예약이 없는지 최종 게이트 확인 (미해결 시 예외 발생 → catch로 이동).
    const { error: gateError } = await admin.rpc(
      "assert_teacher_assignment_ready_for_closure",
      { p_teacher_assignment_id: request.teacher_assignment_id }
    );
    if (gateError) throw new Error(gateError.message);

    let newAssignmentId: string | undefined;
    if (params.resolution === "reassign") {
      if (!params.newTeacherId || !params.effectiveFrom) {
        throw new Error("재배정에는 새 선생님과 적용일이 필요합니다.");
      }
      const { data: rpcData, error: rpcError } = await admin.rpc("change_teacher_assignment", {
        p_subject_enrollment_id: request.subject_enrollment_id,
        p_new_teacher_id: params.newTeacherId,
        p_effective_from: params.effectiveFrom,
        p_reason: request.reason,
        p_changed_by: params.processedBy,
      });
      if (rpcError) throw new Error(rpcError.message);
      newAssignmentId = rpcData as string;
    } else {
      const nowIso = new Date().toISOString();
      const { error: endAssignError } = await admin
        .from("teacher_assignments")
        .update({ status: "ended", effective_until: nowIso })
        .eq("id", request.teacher_assignment_id)
        .eq("status", "active");
      if (endAssignError) throw new Error(endAssignError.message);

      const { error: endEnrollError } = await admin
        .from("subject_enrollments")
        // subject_enrollments.status는 v3_subject_enrollment_status enum이라
        // teacher_assignments와 값 이름이 다르다(planned/active/paused/completed/
        // terminated — "ended"가 아니라 "terminated").
        .update({ status: "terminated" })
        .eq("id", request.subject_enrollment_id);
      if (endEnrollError) throw new Error(endEnrollError.message);
    }

    await admin
      .from("teacher_assignment_termination_requests")
      .update({
        status: "completed",
        new_teacher_id: newAssignmentId ?? request.new_teacher_id ?? null,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.requestId);

    return { status: "completed", newAssignmentId };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin
      .from("teacher_assignment_termination_requests")
      .update({ status: "failed", error: message, updated_at: new Date().toISOString() })
      .eq("id", params.requestId);
    return { status: "failed", error: message };
  }
}

// 예약을 새 선생님에게 이관 시도. reservations.owner_profile_id를 새 선생님으로
// UPDATE 하는데, 이 테이블의 배타 제약(exclusion constraint)이 새 선생님의 기존
// 예약과 겹치면(중복 예약) DB 레벨에서 거부한다 — 그 경우 false를 반환해
// 호출부가 정식 취소로 폴백하게 한다. 가능시간(availability rule) 자체도 함께
// 확인해, 제약을 통과하더라도 새 선생님이 애초에 그 시간대에 열어두지 않았다면
// 이관하지 않는다.
async function tryReassignReservation(reservationId: string, newTeacherId: string): Promise<boolean> {
  const admin = createAdminClient();

  const { data: reservation } = await admin
    .from("reservations")
    .select("starts_at, ends_at")
    .eq("id", reservationId)
    .single();
  if (!reservation) return false;

  const { data: slotOpen, error: slotError } = await admin.rpc("is_teacher_slot_open", {
    p_teacher_id: newTeacherId,
    p_starts_at: reservation.starts_at,
    p_ends_at: reservation.ends_at,
  });
  if (slotError || !slotOpen) return false;

  const { data: bufferViolation, error: bufferError } = await admin.rpc("violates_teacher_buffer", {
    p_teacher_id: newTeacherId,
    p_starts_at: reservation.starts_at,
    p_ends_at: reservation.ends_at,
  });
  if (bufferError || bufferViolation) return false;

  const { error: updateError } = await admin
    .from("reservations")
    .update({ owner_profile_id: newTeacherId })
    .eq("id", reservationId);
  if (updateError) return false; // 배타 제약 위반(중복 예약) 등은 여기서 걸러진다.

  await admin.from("sessions").update({ teacher_id: newTeacherId }).eq("reservation_id", reservationId);

  return true;
}
