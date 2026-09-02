"use server";

// R5 — 과목 수강(subject_enrollments)/선생님 배정(teacher_assignments) 관리자
// 서버 액션. DB 소스오브트루스는
// supabase/migrations/20260925000000_r5_subject_enrollment_teacher_assignment.sql
// (R1 스키마 20260830020000/20260830100000 위에 얹은 것).
//
// 활성화 선행조건·승계 자격 판단은 lib/enrollment/subject-enrollment-decision.ts의
// 순수 함수를 그대로 재사용한다 — 여기서는 DB 조회 후 그 함수에 넘기기만 한다.

import { requireAdminOrCapability } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  decideSubjectEnrollmentActivation,
  decideReturningSubjectEnrollment,
  decideTrialTeacherSuccessionProposal,
  TRIAL_SUCCESSION_BLOCK_MESSAGES,
  type SubjectEnrollmentActivationResult,
  type TrialSuccessionProposal,
} from "@/lib/enrollment/subject-enrollment-decision";

const MATCHING_CAPABILITY = "매칭권한";

export type SubjectEnrollmentListItem = {
  id: string;
  childId: string;
  childName: string | null;
  subjectId: string;
  subjectName: string | null;
  status: string;
  contractId: string;
  currentTeacherId: string | null;
  currentTeacherName: string | null;
  createdAt: string;
};

export async function listSubjectEnrollmentsForChild(
  childId: string
): Promise<SubjectEnrollmentListItem[]> {
  await requireAdminOrCapability(MATCHING_CAPABILITY);
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("subject_enrollments")
    .select(
      "id, child_id, subject_id, status, contract_id, created_at, child:profiles!subject_enrollments_child_id_fkey(name), subject:subjects(name)"
    )
    .eq("child_id", childId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return [];

  const enrollmentIds = data.map((r) => r.id);
  const { data: activeAssignments } = await admin
    .from("teacher_assignments")
    .select("subject_enrollment_id, teacher_id, teacher:profiles!teacher_assignments_teacher_id_fkey(name)")
    .in("subject_enrollment_id", enrollmentIds)
    .eq("status", "active");

  const teacherByEnrollment = new Map(
    (activeAssignments ?? []).map((a) => [
      a.subject_enrollment_id as string,
      {
        id: a.teacher_id as string,
        name: (extractOne<{ name?: string }>(a.teacher)?.name as string | undefined) ?? null,
      },
    ])
  );

  return data.map((row) => {
    const t = teacherByEnrollment.get(row.id);
    return {
      id: row.id,
      childId: row.child_id,
      childName: extractOne<{ name?: string }>(row.child)?.name ?? null,
      subjectId: row.subject_id,
      subjectName: extractOne<{ name?: string }>(row.subject)?.name ?? null,
      status: row.status,
      contractId: row.contract_id,
      currentTeacherId: t?.id ?? null,
      currentTeacherName: t?.name ?? null,
      createdAt: row.created_at,
    };
  });
}

function extractOne<T>(rel: unknown): T | null {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as T | undefined) ?? null;
}

/**
 * 신규 과목 수강 계획(planned) 생성. 복귀 회원 정책(과거 종료 행 재사용 금지)을
 * decideReturningSubjectEnrollment로 판단한 뒤, 살아있는 수강이 이미 있으면
 * 그 id를 그대로 반환하고 새로 만들지 않는다(unique index와 일치).
 */
export async function planSubjectEnrollment(params: {
  childId: string;
  subjectId: string;
  contractId: string;
}): Promise<{ id: string; created: boolean }> {
  await requireAdminOrCapability(MATCHING_CAPABILITY);
  const admin = createAdminClient();

  const { data: existing, error: existingError } = await admin
    .from("subject_enrollments")
    .select("id, status")
    .eq("child_id", params.childId)
    .eq("subject_id", params.subjectId);
  if (existingError) throw new Error(existingError.message);

  const live = (existing ?? []).find((r) => ["planned", "active", "paused"].includes(r.status));
  const hasEnded = (existing ?? []).some((r) => ["completed", "terminated"].includes(r.status));

  const decision = decideReturningSubjectEnrollment({
    hasEndedEnrollmentForSubject: hasEnded,
    hasLiveEnrollmentForSubject: !!live,
  });

  if (decision.decision === "reuse_live_enrollment" && live) {
    return { id: live.id, created: false };
  }

  const { data: created, error } = await admin
    .from("subject_enrollments")
    .insert({
      child_id: params.childId,
      subject_id: params.subjectId,
      contract_id: params.contractId,
      status: "planned",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: created.id, created: true };
}

export async function checkSubjectEnrollmentActivationReadiness(
  subjectEnrollmentId: string
): Promise<SubjectEnrollmentActivationResult> {
  await requireAdminOrCapability(MATCHING_CAPABILITY);
  const admin = createAdminClient();

  const { data: enrollment, error } = await admin
    .from("subject_enrollments")
    .select("id, contract_id")
    .eq("id", subjectEnrollmentId)
    .single();
  if (error) throw new Error(error.message);

  const { data: contract } = await admin
    .from("contracts")
    .select("status")
    .eq("id", enrollment.contract_id)
    .single();

  const { data: ready, error: rpcError } = await admin.rpc("subject_enrollment_activation_ready", {
    p_subject_enrollment_id: subjectEnrollmentId,
  });
  if (rpcError) throw new Error(rpcError.message);

  return decideSubjectEnrollmentActivation({
    contractStatus: contract?.status ?? "draft",
    activationReady: !!ready,
  });
}

export async function activateSubjectEnrollment(subjectEnrollmentId: string): Promise<void> {
  await requireAdminOrCapability(MATCHING_CAPABILITY);
  const readiness = await checkSubjectEnrollmentActivationReadiness(subjectEnrollmentId);
  if (!readiness.canActivate) {
    const messages: Record<string, string> = {
      contract_not_active: "기본계약이 아직 active 상태가 아닙니다.",
      no_paid_entitlement: "결제완료된 수업권 부여가 아직 없습니다.",
      both: "기본계약도 active가 아니고 결제완료된 수업권도 없습니다.",
    };
    throw new Error(messages[readiness.blockedBy] ?? "활성화 선행조건이 충족되지 않았습니다.");
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("subject_enrollments")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", subjectEnrollmentId);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// 선생님 배정 / 변경
// ---------------------------------------------------------------------------

export type TrialSuccessionCheckResult = {
  proposal: TrialSuccessionProposal;
  hasCurriculum: boolean;
  blockMessages: string[];
};

export async function checkTrialTeacherSuccession(params: {
  teacherId: string;
  subjectId: string;
}): Promise<TrialSuccessionCheckResult> {
  await requireAdminOrCapability(MATCHING_CAPABILITY);
  const admin = createAdminClient();

  const { data, error } = await admin
    .rpc("trial_teacher_succession_eligibility", {
      p_teacher_id: params.teacherId,
      p_subject_id: params.subjectId,
    })
    .single();
  if (error) throw new Error(error.message);

  const row = data as {
    is_active: boolean;
    has_subject_qualification: boolean;
    has_curriculum: boolean;
    has_valid_rate: boolean;
  };

  const proposal = decideTrialTeacherSuccessionProposal({
    isActive: row.is_active,
    hasSubjectQualification: row.has_subject_qualification,
    hasCurriculum: row.has_curriculum,
    hasValidRate: row.has_valid_rate,
  });

  return {
    proposal,
    hasCurriculum: row.has_curriculum,
    blockMessages: proposal.canPropose
      ? []
      : proposal.blockedBy.map((b) => TRIAL_SUCCESSION_BLOCK_MESSAGES[b]),
  };
}

/**
 * 최초 선생님 배정(체험 배정을 정규로 전환하는 경우 포함, 기존 활성 배정이
 * 없는 경우) — teacher_assignments에 직접 INSERT. DB 트리거
 * (teacher_assignments_enforce_rate)가 최종 방어선이지만, 원시 에러 대신
 * 먼저 확인해 안내한다.
 */
export async function assignTeacherToSubjectEnrollment(params: {
  subjectEnrollmentId: string;
  teacherId: string;
  effectiveFrom: string;
}): Promise<{ id: string }> {
  const { actorUserId } = await requireAdminOrCapability(MATCHING_CAPABILITY);
  const admin = createAdminClient();

  const { data: hasRate, error: rateError } = await admin.rpc("has_valid_current_teacher_rate", {
    p_teacher_id: params.teacherId,
  });
  if (rateError) {
    // service_role만 실행 가능한 함수라 admin 클라이언트로 문제 없이 호출된다.
    throw new Error(rateError.message);
  }
  if (!hasRate) {
    throw new Error(TRIAL_SUCCESSION_BLOCK_MESSAGES.no_valid_rate);
  }

  const { data, error } = await admin
    .from("teacher_assignments")
    .insert({
      subject_enrollment_id: params.subjectEnrollmentId,
      teacher_id: params.teacherId,
      status: "active",
      effective_from: params.effectiveFrom,
      changed_by: actorUserId,
      source: "app",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

export type FutureBookingImpactItem = {
  reservationId: string;
  scheduledStart: string;
  status: string;
};

/**
 * 선생님 변경 전 관리자에게 보여줄 "영향받는 확정 미래 예약" 목록.
 * 읽기 전용 — 여기서 예약을 취소·이전하지 않는다(R6 범위, spec 명시).
 */
export async function listFutureBookingImpact(
  subjectEnrollmentId: string
): Promise<FutureBookingImpactItem[]> {
  await requireAdminOrCapability(MATCHING_CAPABILITY);
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("reservations")
    .select("id, starts_at, status")
    .eq("subject_enrollment_id", subjectEnrollmentId)
    .in("status", ["holding", "confirmed"])
    .gt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    reservationId: r.id,
    scheduledStart: r.starts_at,
    status: r.status,
  }));
}

/**
 * 선생님 변경 — 기존 활성 배정 종료 + 신규 배정 생성을 change_teacher_assignment()
 * 단일 트랜잭션 RPC로 원자적으로 처리한다(스레드 archive/생성, 문서 권한 재처리
 * 큐 등록까지 그 함수 안에서 함께 일어남).
 */
export async function changeTeacherAssignment(params: {
  subjectEnrollmentId: string;
  newTeacherId: string;
  effectiveFrom: string;
  reason: string;
}): Promise<{ newAssignmentId: string }> {
  const { actorUserId } = await requireAdminOrCapability(MATCHING_CAPABILITY);
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("change_teacher_assignment", {
    p_subject_enrollment_id: params.subjectEnrollmentId,
    p_new_teacher_id: params.newTeacherId,
    p_effective_from: params.effectiveFrom,
    p_reason: params.reason,
    p_changed_by: actorUserId,
  });
  if (error) throw new Error(error.message);
  return { newAssignmentId: data as string };
}

export type TeacherAssignmentHistoryItem = {
  id: string;
  teacherId: string;
  teacherName: string | null;
  status: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  reason: string | null;
  changedBy: string | null;
  createdAt: string;
};

export async function listTeacherAssignmentHistory(
  subjectEnrollmentId: string
): Promise<TeacherAssignmentHistoryItem[]> {
  await requireAdminOrCapability(MATCHING_CAPABILITY);
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("teacher_assignments")
    .select(
      "id, teacher_id, status, effective_from, effective_until, reason, changed_by, created_at, teacher:profiles!teacher_assignments_teacher_id_fkey(name)"
    )
    .eq("subject_enrollment_id", subjectEnrollmentId)
    .order("effective_from", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    id: r.id,
    teacherId: r.teacher_id,
    teacherName: extractOne<{ name?: string }>(r.teacher)?.name ?? null,
    status: r.status,
    effectiveFrom: r.effective_from,
    effectiveUntil: r.effective_until,
    reason: r.reason,
    changedBy: r.changed_by,
    createdAt: r.created_at,
  }));
}

// ---------------------------------------------------------------------------
// 문서 권한 재처리 큐(관리자 조회/재시도 상태 표시용) — 실제 Drive 호출은
// lib/documents/permission-retry-worker.ts의 stub이 담당(R8 전까지 no-op).
// ---------------------------------------------------------------------------

export type DocumentPermissionRetryItem = {
  id: string;
  subjectEnrollmentId: string;
  teacherId: string;
  action: "grant" | "revoke";
  status: string;
  attemptCount: number;
  lastError: string | null;
  createdAt: string;
};

export async function listDocumentPermissionRetries(): Promise<DocumentPermissionRetryItem[]> {
  await requireAdminOrCapability(MATCHING_CAPABILITY);
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("document_permission_retries")
    .select("id, subject_enrollment_id, teacher_id, action, status, attempt_count, last_error, created_at")
    .in("status", ["queued", "failed"])
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    id: r.id,
    subjectEnrollmentId: r.subject_enrollment_id,
    teacherId: r.teacher_id,
    action: r.action,
    status: r.status,
    attemptCount: r.attempt_count,
    lastError: r.last_error,
    createdAt: r.created_at,
  }));
}
