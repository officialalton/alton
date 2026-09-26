"use server";

// R15-A(3/3) — 선생님이 받은 컨설턴트 배정 요청을 확인하고 수락/거절한다.
// 수락 시 실제 학생이면 RPC 내부에서 기존 공통 매칭 경로(confirm_student_
// teacher_subject_match)로 바로 확정된다. RPC 자체가 teacher_id = auth.uid()를
// 검사하므로(respond_teacher_assignment_request), 여기서는 로그인 확인만 한다.

import { requireUser } from "@/lib/auth";
import type { TeacherAssignmentRequestRow } from "@/app/consultant/teacher-assignment-request-actions";
import { postTeacherAssignmentResultSystemMessage } from "@/app/admin/staff-messenger-actions";

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
  const row = mapRow(data as Record<string, unknown>);

  // Phase A 마무리(2026-09-23) — "선생님 배정 요청의 수락·거절 결과가
  // 메신저에 반영되는지" — 관리자-컨설턴트 내부 채널에 시스템 메시지로
  // 남긴다. 실패해도 응답 자체는 이미 확정됐으므로 사용자에게 에러를
  // 보여주지 않는다(부가 알림일 뿐, 배정 결과의 정합성에 영향 없음).
  try {
    await postTeacherAssignmentResultSystemMessage({
      consultantId: row.consultantId,
      body: accept
        ? `선생님이 "${row.studentName}" 학생(${row.subjectId}) 배정 요청을 수락했습니다.`
        : `선생님이 "${row.studentName}" 학생(${row.subjectId}) 배정 요청을 거절했습니다.${rejectReason ? ` 사유: ${rejectReason}` : ""}`,
    });
  } catch (e) {
    console.error("teacher_assignment_request 결과 시스템 메시지 실패:", e);
  }

  return row;
}
