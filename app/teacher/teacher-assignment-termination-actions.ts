"use server";

// M3 — 선생님 배정 종료 관련 교사용 서버 액션.
// 선생님은 자신의 배정에 대한 종료를 "요청"만 할 수 있고, 스스로 확정(finalize)할 수는
// 없다 — 실제 처리(재배정/수강종료)는 항상 관리자만 수행(app/admin/teacher-assignment-
// termination-actions.ts의 processTerminationRequestAction).

import { requireUser } from "@/lib/auth";
import { createTerminationRequest } from "@/lib/enrollment/teacher-assignment-termination";
import type { TeachingHistoryItem } from "@/app/admin/teacher-assignment-termination-actions";

export async function requestOwnTerminationAsTeacher(params: {
  subjectEnrollmentId: string;
  teacherAssignmentId: string;
  reason: string;
}): Promise<{ requestId: string }> {
  const { user } = await requireUser();
  return createTerminationRequest({
    subjectEnrollmentId: params.subjectEnrollmentId,
    teacherAssignmentId: params.teacherAssignmentId,
    requestedByRole: "teacher",
    requestedBy: user.id,
    reason: params.reason,
  });
}

export async function listMyTerminationRequests(): Promise<
  Array<{ id: string; status: string; reason: string; createdAt: string; subjectEnrollmentId: string }>
> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("teacher_assignment_termination_requests")
    .select("id, status, reason, created_at, subject_enrollment_id")
    .eq("requested_by", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    status: r.status,
    reason: r.reason,
    createdAt: r.created_at,
    subjectEnrollmentId: r.subject_enrollment_id,
  }));
}

// 현재 배정된 선생님 본인이 자신의 auth.uid() 컨텍스트로 과거 수업 이력을 조회 —
// list_subject_teaching_history_for_current_teacher()가 호출자가 실제 활성 배정
// 보유자인지 DB에서 다시 검증하므로, 다른 과목/학생 이력은 절대 노출되지 않는다.
export async function listMyTeachingHistoryForSubject(
  subjectEnrollmentId: string
): Promise<TeachingHistoryItem[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("list_subject_teaching_history_for_current_teacher", {
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
