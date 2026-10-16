"use server";

import { requireUser } from "@/lib/auth";
import { loadMyAssignedConsultations, type IntakeConsultation } from "./intake-data";

// 컨설턴트 Phase 1 — 배정 자체는 관리자(또는 assign_admissions_consultant
// capability 보유자, MVP에서는 관리자뿐)만 한다(스펙 §Assignment and Handoff
// Rules — 자동배정/셀프클레임은 Phase 2). 여기서는 이미 배정된 요청의 연락
// 완료 기록만 컨설턴트가 직접 한다.
export async function markConsultationContactedAction(consultationId: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("mark_consultation_contacted", { p_consultation_id: consultationId });
  if (error) throw new Error(error.message);
}

export async function loadMyAssignedConsultationsAction(): Promise<IntakeConsultation[]> {
  const { user, supabase } = await requireUser();
  return loadMyAssignedConsultations(supabase, user.id);
}

// R15-A(2026-09-23) — 관리자가 계정 생성 안내를 발송했지만 아직 보호자가
// 확인하지 않았거나(가입 대기) 계정이 아직 안 만들어진, 내가 담당인 학생.
export type PendingOnboardingStudent = {
  linkStudentId: string;
  linkId: string;
  studentName: string;
  studentEmail: string;
  studentGrade: string | null;
  status: "pending" | "created" | "failed" | "cancelled";
  guardianName: string;
  guardianEmail: string;
  linkStatus: "pending" | "redeemed" | "expired" | "revoked";
  noticeDeliveryStatus: "pending" | "sent" | "failed";
  createdAt: string;
};

type PendingOnboardingStudentRow = {
  link_student_id: string;
  link_id: string;
  student_name: string;
  student_email: string;
  student_grade: string | null;
  status: string;
  guardian_name: string;
  guardian_email: string;
  link_status: string;
  notice_delivery_status: string;
  created_at: string;
};

export async function loadMyPendingOnboardingStudentsAction(): Promise<PendingOnboardingStudent[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("list_my_pending_onboarding_students");
  if (error) throw new Error(error.message);
  return ((data ?? []) as PendingOnboardingStudentRow[]).map((r) => ({
    linkStudentId: r.link_student_id,
    linkId: r.link_id,
    studentName: r.student_name,
    studentEmail: r.student_email,
    studentGrade: r.student_grade,
    status: r.status as PendingOnboardingStudent["status"],
    guardianName: r.guardian_name,
    guardianEmail: r.guardian_email,
    linkStatus: r.link_status as PendingOnboardingStudent["linkStatus"],
    noticeDeliveryStatus: r.notice_delivery_status as PendingOnboardingStudent["noticeDeliveryStatus"],
    createdAt: r.created_at,
  }));
}
