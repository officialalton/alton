"use server";

// R15-A(3/3) — 컨설턴트 → 선생님 배정 요청. 실제 배정은 선생님이 수락해야만
// 확정된다(confirm_student_teacher_subject_match는 respond_teacher_assignment_request
// RPC 내부에서만 호출됨). 여기서는 요청 생성·취소·본인이 보낸 목록 조회만 다룬다.

import { requireConsultant } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { loadSubjectCatalog, type AdminSubject } from "@/app/admin/subject-data";
import { loadTeacherCandidatesBySubject, type MatchingTeacherCandidate } from "@/app/admin/matching-data";

export type TeacherAssignmentRequestRow = {
  id: string;
  consultantId: string;
  studentId: string | null;
  linkStudentId: string | null;
  subjectId: string;
  teacherId: string;
  studentName: string;
  grade: string | null;
  currentScore: string | null;
  goal: string | null;
  isNewStudent: boolean;
  preferredSchedule: string | null;
  requestNote: string | null;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  rejectReason: string | null;
  needsReprocessing: boolean;
  reprocessingError: string | null;
  createdAt: string;
  respondedAt: string | null;
};

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

/** 요청 폼(과목→선생님 선택) 배선용 — 매칭 탭과 동일한 카탈로그를 그대로 재사용한다. */
export async function loadSubjectsAndTeacherCandidatesAction(): Promise<{
  subjects: AdminSubject[];
  teacherCandidatesBySubject: Record<string, MatchingTeacherCandidate[]>;
}> {
  await requireConsultant();
  const admin = createAdminClient();
  const [subjects, teacherCandidatesBySubject] = await Promise.all([
    loadSubjectCatalog(admin),
    loadTeacherCandidatesBySubject(admin),
  ]);
  return { subjects, teacherCandidatesBySubject };
}

export async function requestTeacherAssignmentAction(params: {
  studentId?: string;
  linkStudentId?: string;
  subjectId: string;
  teacherId: string;
  studentName: string;
  grade?: string;
  currentScore?: string;
  goal?: string;
  isNewStudent: boolean;
  preferredSchedule?: string;
  requestNote?: string;
}): Promise<string> {
  const { supabase } = await requireConsultant();
  const { data, error } = await supabase.rpc("request_teacher_assignment", {
    p_student_id: params.studentId ?? null,
    p_link_student_id: params.linkStudentId ?? null,
    p_subject_id: params.subjectId,
    p_teacher_id: params.teacherId,
    p_student_name: params.studentName,
    p_grade: params.grade ?? null,
    p_current_score: params.currentScore ?? null,
    p_goal: params.goal ?? null,
    p_is_new_student: params.isNewStudent,
    p_preferred_schedule: params.preferredSchedule ?? null,
    p_request_note: params.requestNote ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function cancelTeacherAssignmentRequestAction(requestId: string): Promise<void> {
  const { supabase } = await requireConsultant();
  const { error } = await supabase.rpc("cancel_teacher_assignment_request", { p_request_id: requestId });
  if (error) throw new Error(error.message);
}

export async function listMySentTeacherAssignmentRequestsAction(): Promise<TeacherAssignmentRequestRow[]> {
  const { supabase } = await requireConsultant();
  const { data, error } = await supabase.rpc("list_my_sent_teacher_assignment_requests");
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapRow);
}

export async function reprocessTeacherAssignmentRequestAction(requestId: string): Promise<void> {
  const { supabase } = await requireConsultant();
  const { error } = await supabase.rpc("reprocess_teacher_assignment_request", { p_request_id: requestId });
  if (error) throw new Error(error.message);
}
