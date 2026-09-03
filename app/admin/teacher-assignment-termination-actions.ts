"use server";

// M3 — 선생님 배정 종료(termination) 관리자 서버 액션.
// DB 소스오브트루스: supabase/migrations/20261014000000_m3_teacher_assignment_termination.sql
// 처리 로직 본체는 lib/enrollment/teacher-assignment-termination.ts.

import { requireAdminOrCapability } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  createTerminationRequest,
  previewTerminationImpact,
  processTeacherAssignmentTermination,
  type TerminationImpactReservation,
  type TerminationResolution,
} from "@/lib/enrollment/teacher-assignment-termination";

const MATCHING_CAPABILITY = "매칭권한";

export type TerminationRequestListItem = {
  id: string;
  subjectEnrollmentId: string;
  teacherAssignmentId: string;
  requestedByRole: string;
  requestedBy: string;
  reason: string;
  status: string;
  resolution: string | null;
  newTeacherId: string | null;
  effectiveFrom: string | null;
  error: string | null;
  createdAt: string;
};

export async function listTerminationRequests(): Promise<TerminationRequestListItem[]> {
  await requireAdminOrCapability(MATCHING_CAPABILITY);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("teacher_assignment_termination_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    subjectEnrollmentId: r.subject_enrollment_id,
    teacherAssignmentId: r.teacher_assignment_id,
    requestedByRole: r.requested_by_role,
    requestedBy: r.requested_by,
    reason: r.reason,
    status: r.status,
    resolution: r.resolution,
    newTeacherId: r.new_teacher_id,
    effectiveFrom: r.effective_from,
    error: r.error,
    createdAt: r.created_at,
  }));
}

export async function previewTerminationImpactAction(
  teacherAssignmentId: string
): Promise<TerminationImpactReservation[]> {
  await requireAdminOrCapability(MATCHING_CAPABILITY);
  return previewTerminationImpact(teacherAssignmentId);
}

// 관리자가 보호자(외부 연락 경로)를 대신해 종료 요청을 접수하거나, 관리자 자신의 판단으로
// 요청을 생성할 때 사용. 선생님 본인의 요청은 별도 교사용 액션(request-own-termination)을 쓴다.
export async function adminCreateTerminationRequest(params: {
  subjectEnrollmentId: string;
  teacherAssignmentId: string;
  requestedByRole: "guardian" | "admin";
  reason: string;
}): Promise<{ requestId: string }> {
  const { actorUserId } = await requireAdminOrCapability(MATCHING_CAPABILITY);
  return createTerminationRequest({
    subjectEnrollmentId: params.subjectEnrollmentId,
    teacherAssignmentId: params.teacherAssignmentId,
    requestedByRole: params.requestedByRole,
    requestedBy: actorUserId,
    reason: params.reason,
  });
}

export async function processTerminationRequestAction(params: {
  requestId: string;
  resolution: TerminationResolution;
  newTeacherId?: string;
  effectiveFrom?: string;
}) {
  const { actorUserId } = await requireAdminOrCapability(MATCHING_CAPABILITY);
  return processTeacherAssignmentTermination({
    requestId: params.requestId,
    resolution: params.resolution,
    processedBy: actorUserId,
    newTeacherId: params.newTeacherId,
    effectiveFrom: params.effectiveFrom,
  });
}

export async function cancelTerminationRequestAction(requestId: string): Promise<void> {
  await requireAdminOrCapability(MATCHING_CAPABILITY);
  const admin = createAdminClient();
  const { error } = await admin
    .from("teacher_assignment_termination_requests")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .in("status", ["requested", "failed"]);
  if (error) throw new Error(error.message);
}

// 새로 배정된(또는 관리자) 선생님이 해당 과목의 과거 수업 이력(읽기전용)을 조회.
// 민감 컬럼(정산 단가, Smart Notes 원본, 내부 메모)은 애초에 SELECT하지 않는
// list_subject_teaching_history_for_current_teacher() 함수가 컬럼 단위로 걸러낸다.
export type TeachingHistoryItem = {
  sessionId: string;
  startsAt: string;
  endsAt: string;
  finalStatus: string;
  lessonTypeName: string | null;
};

export async function listSubjectTeachingHistoryForCurrentTeacher(
  subjectEnrollmentId: string
): Promise<TeachingHistoryItem[]> {
  await requireAdminOrCapability(MATCHING_CAPABILITY);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("list_subject_teaching_history_for_current_teacher", {
    p_subject_enrollment_id: subjectEnrollmentId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: Record<string, unknown>) => ({
    sessionId: row.session_id as string,
    startsAt: row.starts_at as string,
    endsAt: row.ends_at as string,
    finalStatus: row.final_status as string,
    lessonTypeName: (row.lesson_type_name as string) ?? null,
  }));
}
