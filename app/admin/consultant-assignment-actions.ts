"use server";

import { randomBytes } from "node:crypto";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { loadUnassignedConsultations, loadAssignedAwaitingSchedule, type IntakeConsultation } from "@/app/consultant/intake-data";
import { sendConsultationSchedulingLinkEmail } from "@/lib/consultation/notifications";
import { currentRequestOrigin } from "@/lib/request-origin";

// 컨설턴트 포지션(2026-09-22, 가볍게 시작) — 신규 auth 계정 발급은 범위 밖.
// 기존 계정(이메일로 찾음)의 role을 consultant로 바꾸고, 담당 학생을
// 배정/해제하는 최소 기능만.
//
// Phase 1(스펙 docs/superpowers/specs/2026-09-22-consultant-role-and-intake-design.md)
// — 여기에 상담 요청(consultations) 레벨 인테이크 큐 배정도 추가한다. 자동배정
// 모드는 Phase 2로 미룬다 — 지금은 관리자가 큐에서 컨설턴트를 직접 고른다.

export type ConsultantWithStudents = {
  id: string;
  name: string | null;
  email: string | null;
  students: { id: string; name: string | null }[];
};

export async function listConsultantsAction(): Promise<ConsultantWithStudents[]> {
  const { supabase } = await requireAdmin();
  const [{ data: consultants }, { data: assignments }] = await Promise.all([
    supabase.from("profiles").select("id, name").eq("role", "consultant").order("name", { ascending: true }),
    supabase
      .from("consultant_assignments")
      .select("consultant_id, student_id, student:profiles!consultant_assignments_student_id_fkey(id, name)"),
  ]);

  const byConsultant = new Map<string, { id: string; name: string | null }[]>();
  for (const row of assignments ?? []) {
    const student = Array.isArray(row.student) ? row.student[0] : row.student;
    const list = byConsultant.get(row.consultant_id as string) ?? [];
    list.push({ id: row.student_id as string, name: (student as { name: string | null } | null)?.name ?? null });
    byConsultant.set(row.consultant_id as string, list);
  }

  const admin = createAdminClient();
  const rows = consultants ?? [];
  const emails = await Promise.all(
    rows.map(async (c) => {
      const { data } = await admin.auth.admin.getUserById(c.id as string);
      return data.user?.email ?? null;
    })
  );

  return rows.map((c, i) => ({
    id: c.id as string,
    name: c.name as string | null,
    email: emails[i],
    students: byConsultant.get(c.id as string) ?? [],
  }));
}

export async function promoteToConsultantAction(email: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { data: profileId, error: lookupError } = await supabase.rpc("find_profile_id_by_email", { p_email: email.trim() });
  if (lookupError) throw new Error(lookupError.message);
  if (!profileId) throw new Error("해당 이메일의 계정을 찾을 수 없습니다.");
  const { error } = await supabase.rpc("set_profile_role_to_consultant", { p_profile_id: profileId });
  if (error) throw new Error(error.message);
}

export async function assignStudentToConsultantAction(consultantId: string, studentEmail: string): Promise<void> {
  const { supabase, adminUserId } = await requireAdmin();
  const { data: studentId, error: lookupError } = await supabase.rpc("find_profile_id_by_email", {
    p_email: studentEmail.trim(),
  });
  if (lookupError) throw new Error(lookupError.message);
  if (!studentId) throw new Error("해당 이메일의 학생 계정을 찾을 수 없습니다.");
  const { error } = await supabase
    .from("consultant_assignments")
    .upsert({ consultant_id: consultantId, student_id: studentId, assigned_by: adminUserId });
  if (error) throw new Error(error.message);
}

export async function unassignStudentFromConsultantAction(consultantId: string, studentId: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase
    .from("consultant_assignments")
    .delete()
    .eq("consultant_id", consultantId)
    .eq("student_id", studentId);
  if (error) throw new Error(error.message);
}

/** 스펙 §Screen Scope "New request queue" — 어드미션 컨설턴트가 아직 없는 상담 요청. */
export async function listUnassignedConsultationsAction(): Promise<IntakeConsultation[]> {
  const { supabase } = await requireAdmin();
  return loadUnassignedConsultations(supabase);
}

/** 컨설턴트는 배정됐지만 아직 일정이 없는 요청 — 스케줄링 링크 발송 대상 큐. */
export async function listAssignedAwaitingScheduleAction(): Promise<IntakeConsultation[]> {
  const { supabase } = await requireAdmin();
  return loadAssignedAwaitingSchedule(supabase);
}

/**
 * 스펙 §Ownership Fields — MVP에서는 intake_owner와 admissions_consultant를
 * 한 번에 같은 사람에게 배정한다(둘 다 별도 필드로 저장되고 이력도 각각
 * 남는다 — assign_consultation_owner() RPC를 두 번 호출).
 */
export async function assignConsultationToConsultantAction(consultationId: string, consultantId: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error: intakeError } = await supabase.rpc("assign_consultation_owner", {
    p_consultation_id: consultationId,
    p_field: "intake_owner",
    p_new_owner_id: consultantId,
  });
  if (intakeError) throw new Error(intakeError.message);
  const { error: consultantError } = await supabase.rpc("assign_consultation_owner", {
    p_consultation_id: consultationId,
    p_field: "admissions_consultant",
    p_new_owner_id: consultantId,
  });
  if (consultantError) throw new Error(consultantError.message);
}

/**
 * 스펙 §Scheduling after Assignment — 배정 후 컨설턴트 전용 스케줄링 링크를
 * 만들고 고객에게 안내 이메일을 보낸다. Phase 2b는 자동 발송이 아니라 관리자가
 * "링크 보내기"를 명시적으로 눌러야만 실제 이메일이 나간다(안전장치).
 */
export async function sendConsultationSchedulingLinkAction(consultationId: string): Promise<void> {
  const { supabase } = await requireAdmin();

  const { data: consultation, error: consultationError } = await supabase
    .from("consultations")
    .select("contact_name, contact_email, admissions_consultant_id, starts_at")
    .eq("id", consultationId)
    .single();
  if (consultationError) throw new Error(consultationError.message);
  if (!consultation.admissions_consultant_id) throw new Error("담당 컨설턴트가 먼저 배정되어야 합니다.");
  if (consultation.starts_at) throw new Error("이미 일정이 확정된 상담입니다.");

  const { data: consultant, error: consultantLookupError } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", consultation.admissions_consultant_id)
    .single();
  if (consultantLookupError) throw new Error(consultantLookupError.message);

  const token = randomBytes(24).toString("hex");
  const { error: linkError } = await supabase.from("consultation_scheduling_links").insert({
    consultation_id: consultationId,
    consultant_id: consultation.admissions_consultant_id,
    token,
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (linkError) throw new Error(linkError.message);

  const origin = await currentRequestOrigin();
  await sendConsultationSchedulingLinkEmail({
    contact_name: consultation.contact_name,
    contact_email: consultation.contact_email,
    consultant_name: consultant.name ?? "담당 컨설턴트",
    scheduling_url: `${origin}/schedule/${token}`,
  });
}
