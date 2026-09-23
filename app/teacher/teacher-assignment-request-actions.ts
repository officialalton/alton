"use server";

// R15-A(3/3) — 선생님이 받은 컨설턴트 배정 요청을 확인하고 수락/거절한다.
// 수락 시 실제 학생이면 RPC 내부에서 기존 공통 매칭 경로(confirm_student_
// teacher_subject_match)로 바로 확정된다. RPC 자체가 teacher_id = auth.uid()를
// 검사하므로(respond_teacher_assignment_request), 여기서는 로그인 확인만 한다.

import { requireUser } from "@/lib/auth";
import type { TeacherAssignmentRequestRow } from "@/app/consultant/teacher-assignment-request-actions";

function mapRow(r: Record<string, unknown>): TeacherAssignmentRequestRow {
  return {
    id: r.id as string,
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

export async function listMyReceivedTeacherAssignmentRequestsAction(): Promise<TeacherAssignmentRequestRow[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("list_my_received_teacher_assignment_requests");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapRow);
}

export async function respondTeacherAssignmentRequestAction(
  requestId: string,
  accept: boolean,
  rejectReason?: string
): Promise<TeacherAssignmentRequestRow> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .rpc("respond_teacher_assignment_request", {
      p_request_id: requestId,
      p_accept: accept,
      p_reject_reason: rejectReason ?? null,
    })
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}
