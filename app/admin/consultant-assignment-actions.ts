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

// R15-A(2026-09-23) — consultant_assignments.student_id에 유니크 제약을 걸어
// "학생 한 명 = 담당 컨설턴트 한 명"을 강제한 뒤로는(20261473000000), 여기서
// raw upsert(기본 conflict target = PK (consultant_id, student_id))로 쓰면
// 재배정(다른 컨설턴트로 바꾸는 경우) 시 student_id 유니크 위반 에러가 난다.
// admin_set_student_consultant() RPC(이력 기록 포함)로 전부 옮긴다 — Users/
// Consultants/계정 생성 발송 내역 네 화면이 전부 이 함수(또는 같은 RPC를 쓰는
// setLinkStudentConsultantAction의 post-account 짝)로 담당자를 바꿔야 어디서
// 바꾸든 같은 이력·같은 결과로 이어진다.
export async function setStudentConsultantAction(
  studentId: string,
  consultantId: string | null,
  reason?: string
): Promise<void> {
  const { supabase, adminUserId } = await requireAdmin();
  const { error } = await supabase.rpc("admin_set_student_consultant", {
    p_student_id: studentId,
    p_new_consultant_id: consultantId,
    p_admin_id: adminUserId,
    p_reason: reason ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function assignStudentToConsultantAction(consultantId: string, studentEmail: string): Promise<void> {
  const { supabase } = await requireAdmin();
  const { data: studentId, error: lookupError } = await supabase.rpc("find_profile_id_by_email", {
    p_email: studentEmail.trim(),
  });
  if (lookupError) throw new Error(lookupError.message);
  if (!studentId) throw new Error("해당 이메일의 학생 계정을 찾을 수 없습니다.");
  await setStudentConsultantAction(studentId as string, consultantId);
}

export async function unassignStudentFromConsultantAction(consultantId: string, studentId: string): Promise<void> {
  void consultantId; // 유니크 제약으로 학생당 담당 컨설턴트가 하나뿐이라 더 이상 필요 없지만, 호출부 호환을 위해 시그니처는 유지한다.
  await setStudentConsultantAction(studentId, null, "관리자 배정 해제");
}

/** 스펙 §Screen Scope "New request queue" — 어드미션 컨설턴트가 아직 없는 상담 요청. */
export async function listUnassignedConsultationsAction(): Promise<IntakeConsultation[]> {
  const { supabase } = await requireAdmin();
  return loadUnassignedConsultations(supabase);
}

/** 스펙 §Assignment Modes — 전역 수동/자동배정 설정 조회·변경. */
export async function loadAutoAssignEnabledAction(): Promise<boolean> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.from("consultant_assignment_settings").select("auto_assign_enabled").eq("id", true).single();
  if (error) throw new Error(error.message);
  return data.auto_assign_enabled;
}

export async function setAutoAssignEnabledAction(enabled: boolean): Promise<void> {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("set_consultant_auto_assign_enabled", { p_enabled: enabled });
  if (error) throw new Error(error.message);
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
