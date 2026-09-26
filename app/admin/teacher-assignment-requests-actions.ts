"use server";

// R15-A(3/3) — 관리자는 전체 배정 요청 조회 + 재처리·취소(예외 처리) 권한을
// 갖는다. 요청 생성 자체는 컨설턴트 전용(request_teacher_assignment RPC가
// role='consultant'를 강제)이라 관리자는 만들지 않는다 — 이미 있는 요청의
// 예외 처리만 한다.

import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import type { TeacherAssignmentRequestRow } from "@/app/consultant/teacher-assignment-request-actions";

function mapRow(r: Record<string, unknown>): TeacherAssignmentRequestRow {
  return {
    id: r.id as string,
    consultantId: r.consultant_id as string,
    studentId: r.student_id as string | null,
    linkStudentId: r.link_student_id as string | null,
    subjectId: r.subject_id as string,
    teacherId: r.teacher_id as string,
    studentName: r.student_name as string,
    grade: r.grade as string | null,
    currentScore: r.current_score as string | null,
    goal: r.goal as string | null,
    isNewStudent: r.is_new_student as boolean,
    preferredSchedule: r.preferred_schedule as string | null,
    requestNote: r.request_note as string | null,
    status: r.status as TeacherAssignmentRequestRow["status"],
    rejectReason: r.reject_reason as string | null,
    needsReprocessing: r.needs_reprocessing as boolean,
    reprocessingError: r.reprocessing_error as string | null,
    createdAt: r.created_at as string,
    respondedAt: r.responded_at as string | null,
  };
}

export async function listAllTeacherAssignmentRequestsAction(): Promise<TeacherAssignmentRequestRow[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("teacher_assignment_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export async function adminReprocessTeacherAssignmentRequestAction(requestId: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("reprocess_teacher_assignment_request", { p_request_id: requestId });
  if (error) throw new Error(error.message);
}

export async function adminCancelTeacherAssignmentRequestAction(requestId: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("cancel_teacher_assignment_request", { p_request_id: requestId });
  if (error) throw new Error(error.message);
}
