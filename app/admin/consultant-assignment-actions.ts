"use server";

import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { loadUnassignedConsultations, type IntakeConsultation } from "@/app/consultant/intake-data";

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
