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
  const { adminUserId } = await requireAdmin();
  // admin_set_student_consultant()는 service_role에만 execute 권한이 있다
  // (20261473000000) — 세션 클라이언트(authenticated)로 부르면 "permission
  // denied for function" 에러가 난다. 관리자 인증은 requireAdmin()이 이미
  // 확인했으니 실제 호출만 admin 클라이언트로 한다.
  const admin = createAdminClient();
  const { error } = await admin.rpc("admin_set_student_consultant", {
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

// Users > Consultants 프로필 상세(관리자 포털 정리 항목 1, 2026-09-23) —
// 기존 Consultants 탭(위 listConsultantsAction)은 배정 운영 화면으로 남기고,
// 여기서는 한 컨설턴트의 담당 학생·보호자, 배정 이력(종료 포함), 프로필
// 정보를 한 화면에서 보여준다. 매칭 변경은 같은 setStudentConsultantAction
// RPC를 그대로 호출해 두 화면의 결과가 항상 일치한다.
export type ConsultantAssignmentHistoryItem = {
  id: string;
  studentId: string | null;
  studentName: string | null;
  priorConsultantName: string | null;
  newConsultantName: string | null;
  reason: string | null;
  changedAt: string;
};

export type ConsultantDetail = {
  id: string;
  name: string | null;
  email: string | null;
  gender: string | null;
  careerBio: string | null;
  hireDate: string | null;
  currentStudents: { id: string; name: string | null; householdId: string | null; guardianNames: string[] }[];
  history: ConsultantAssignmentHistoryItem[];
};

export async function getConsultantDetailAction(consultantId: string): Promise<ConsultantDetail> {
  const { supabase } = await requireAdmin();

  const [{ data: profile, error: profileError }, { data: assignments }, { data: historyRows }] = await Promise.all([
    supabase.from("profiles").select("id, name, gender, career_bio, hire_date").eq("id", consultantId).single(),
    supabase
      .from("consultant_assignments")
      .select("student_id, student:profiles!consultant_assignments_student_id_fkey(id, name)")
      .eq("consultant_id", consultantId),
    supabase
      .from("consultant_assignment_history")
      .select(
        "id, student_id, changed_at, reason, student:profiles!consultant_assignment_history_student_id_fkey(name), prior:profiles!consultant_assignment_history_prior_consultant_id_fkey(name), new:profiles!consultant_assignment_history_new_consultant_id_fkey(name)"
      )
      .or(`prior_consultant_id.eq.${consultantId},new_consultant_id.eq.${consultantId}`)
      .order("changed_at", { ascending: false }),
  ]);
  if (profileError) throw new Error(profileError.message);

  const admin = createAdminClient();
  const { data: authUser } = await admin.auth.admin.getUserById(consultantId);

  const studentIds = (assignments ?? []).map((a) => a.student_id as string);
  const guardianByStudent = new Map<string, { householdId: string | null; names: string[] }>();
  if (studentIds.length > 0) {
    const { data: studentMemberships } = await supabase
      .from("household_members")
      .select("household_id, member_id")
      .in("member_id", studentIds)
      .eq("role", "student");
    const householdOfStudent = new Map<string, string>(
      (studentMemberships ?? []).map((m) => [m.member_id as string, m.household_id as string])
    );
    const householdIds = [...new Set(householdOfStudent.values())];

    if (householdIds.length > 0) {
      const { data: guardianMemberships } = await supabase
        .from("household_members")
        .select("household_id, member_id")
        .in("household_id", householdIds)
        .eq("role", "guardian");
      const guardianIds = [...new Set((guardianMemberships ?? []).map((m) => m.member_id as string))];
      const { data: guardianProfiles } = await supabase.from("profiles").select("id, name").in("id", guardianIds);
      const nameById = new Map((guardianProfiles ?? []).map((g) => [g.id as string, g.name as string | null]));

      const guardiansByHousehold = new Map<string, string[]>();
      for (const m of guardianMemberships ?? []) {
        const list = guardiansByHousehold.get(m.household_id as string) ?? [];
        const gname = nameById.get(m.member_id as string);
        if (gname) list.push(gname);
        guardiansByHousehold.set(m.household_id as string, list);
      }
      for (const sid of studentIds) {
        const hid = householdOfStudent.get(sid) ?? null;
        guardianByStudent.set(sid, { householdId: hid, names: hid ? guardiansByHousehold.get(hid) ?? [] : [] });
      }
    }
  }

  return {
    id: consultantId,
    name: (profile?.name as string | null) ?? null,
    email: authUser.user?.email ?? null,
    gender: (profile?.gender as string | null) ?? null,
    careerBio: (profile?.career_bio as string | null) ?? null,
    hireDate: (profile?.hire_date as string | null) ?? null,
    currentStudents: (assignments ?? []).map((a) => {
      const student = Array.isArray(a.student) ? a.student[0] : a.student;
      const g = guardianByStudent.get(a.student_id as string);
      return {
        id: a.student_id as string,
        name: (student as { name: string | null } | null)?.name ?? null,
        householdId: g?.householdId ?? null,
        guardianNames: g?.names ?? [],
      };
    }),
    history: (historyRows ?? []).map((h) => {
      const student = Array.isArray(h.student) ? h.student[0] : h.student;
      const prior = Array.isArray(h.prior) ? h.prior[0] : h.prior;
      const next = Array.isArray(h.new) ? h.new[0] : h.new;
      return {
        id: h.id as string,
        studentId: h.student_id as string | null,
        studentName: (student as { name: string | null } | null)?.name ?? null,
        priorConsultantName: (prior as { name: string | null } | null)?.name ?? null,
        newConsultantName: (next as { name: string | null } | null)?.name ?? null,
        reason: h.reason as string | null,
        changedAt: h.changed_at as string,
      };
    }),
  };
}
