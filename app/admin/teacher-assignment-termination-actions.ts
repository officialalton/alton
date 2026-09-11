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
  // C-2(2차, 2026-09-11) — 재배정 선생님 선택을 이름 드롭다운(과목별 커리큘럼
  // 보유 후보)으로 바꾸려면 subjectId가 필요하다(이전엔 UUID를 직접 입력받아
  // 필요 없었음). 확인 화면에 "학생·과목·현재 선생님"을 보여주기 위한 표시용
  // 필드도 함께 채운다.
  subjectId: string;
  subjectName: string | null;
  childName: string | null;
  currentTeacherName: string | null;
};

// 2026-09-11(매칭 화면 서브탭 분리) — "종료 요청" 탭의 미처리 건수 배지용.
// 상세 목록(listTerminationRequests, enrollment/assignment 조인까지 포함)을
// 배지 하나 때문에 항상 불러오지 않도록 개수만 별도로 가볍게 조회한다.
export async function countPendingTerminationRequests(): Promise<number> {
  await requireAdminOrCapability(MATCHING_CAPABILITY);
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("teacher_assignment_termination_requests")
    .select("id", { count: "exact", head: true })
    .in("status", ["requested", "processing", "failed"]);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function listTerminationRequests(): Promise<TerminationRequestListItem[]> {
  await requireAdminOrCapability(MATCHING_CAPABILITY);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("teacher_assignment_termination_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return [];

  const enrollmentIds = Array.from(new Set(data.map((r) => r.subject_enrollment_id as string)));
  const assignmentIds = Array.from(new Set(data.map((r) => r.teacher_assignment_id as string)));

  const [{ data: enrollmentRows }, { data: assignmentRows }] = await Promise.all([
    admin
      .from("subject_enrollments")
      .select("id, subject_id, child:profiles!subject_enrollments_child_id_fkey(name), subject:subjects(name)")
      .in("id", enrollmentIds),
    admin
      .from("teacher_assignments")
      .select("id, teacher:profiles!teacher_assignments_teacher_id_fkey(name)")
      .in("id", assignmentIds),
  ]);

  const enrollmentById = new Map((enrollmentRows ?? []).map((e) => [e.id as string, e]));
  const teacherNameByAssignmentId = new Map(
    (assignmentRows ?? []).map((a) => [
      a.id as string,
      extractOneName(a.teacher),
    ])
  );

  return data.map((r) => {
    const enrollment = enrollmentById.get(r.subject_enrollment_id as string);
    return {
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
      subjectId: (enrollment?.subject_id as string) ?? "",
      subjectName: enrollment ? extractOneName(enrollment.subject) : null,
      childName: enrollment ? extractOneName(enrollment.child) : null,
      currentTeacherName: teacherNameByAssignmentId.get(r.teacher_assignment_id as string) ?? null,
    };
  });
}

function extractOneName(rel: unknown): string | null {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? null;
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

// C-2(2차, 2026-09-11, 제품 오너 지시) — 관리자 직접 종료는 "요청 생성 →
// 목록에서 재조회해 처리" 두 단계로 화면을 나누지 않는다: 영향 미리보기까지
// 확인한 관리자가 한 번의 확인으로 즉시 종료를 실행하는 단일 흐름이 필요하다.
// 내부적으로는 기존 요청·감사·재시도 경로(createTerminationRequest →
// processTeacherAssignmentTermination)를 그대로 재사용한다 — 새 종료 로직을
// 만들지 않고, 같은 호출을 한 서버 액션 안에서 연달아 실행할 뿐이다. 교사·
// 보호자가 접수한 요청을 관리자가 나중에 목록에서 처리하는 기존 흐름
// (processTerminationRequestAction, 위)은 그대로 유지 — 이 함수는 "관리자가
// 지금 바로 종료를 시작"하는 경우에만 쓴다. 재배정(reassign)은 이미
// TeacherChangeForm(변경 확정 버튼)으로 요청 없이 즉시 가능하므로, 이 빠른
// 경로는 수강 종료(end_enrollment)만 지원한다.
export async function adminTerminateAssignmentNow(params: {
  subjectEnrollmentId: string;
  teacherAssignmentId: string;
  reason: string;
}) {
  const { actorUserId } = await requireAdminOrCapability(MATCHING_CAPABILITY);
  const { requestId } = await createTerminationRequest({
    subjectEnrollmentId: params.subjectEnrollmentId,
    teacherAssignmentId: params.teacherAssignmentId,
    requestedByRole: "admin",
    requestedBy: actorUserId,
    reason: params.reason,
  });
  return processTeacherAssignmentTermination({
    requestId,
    resolution: "end_enrollment",
    processedBy: actorUserId,
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
