import type { SupabaseClient } from "@supabase/supabase-js";
import { loadArchivedHouseholdIds } from "./users-data";

export type PendingConsult = {
  id: string;
  personName: string;
  email: string;
  submittedAt: string;
};

export type UpcomingConsult = {
  id: string;
  personName: string;
  scheduledAt: string;
};

export type PendingPerson = {
  id: string;
  name: string;
};

export type QcWarningRow = {
  teacherId: string;
  teacherName: string;
  count: number;
};

export type AdminDashboardData = {
  adminName: string;
  pendingConsults: PendingConsult[];
  upcomingConsults: UpcomingConsult[];
  pendingStudents: PendingPerson[];
  pendingTeachers: PendingPerson[];
  qcWarnings: QcWarningRow[];
};

export async function loadAdminDashboard(
  supabase: SupabaseClient,
  adminId: string
): Promise<AdminDashboardData> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", adminId)
    .single();

  const { data: pendingConsultRows } = await supabase
    .from("consultations")
    .select("id, contact_name, contact_email, requested_at")
    .eq("status", "requested")
    .order("requested_at", { ascending: true });

  const { data: upcomingConsultRows } = await supabase
    .from("consultations")
    .select("id, contact_name, scheduled_at")
    .eq("status", "scheduled")
    .not("scheduled_at", "is", null)
    .order("scheduled_at", { ascending: true });

  // 2026-09-12(UAT 지적) — 이 카드는 "학생 매칭 대기"인데 students.status가
  // 'pending'인 학생을 세고 있었다. 그건 **계정 가입 대기**이지 매칭 대기가
  // 아니다. 그래서 매칭과 무관한 학생들이 이 카드에 올라왔다.
  //
  // 매칭 대기 = 수강 중인 과목이 있는데 그 과목에 **활성 담당 교사가 없는**
  // 학생. 담당이 붙으면 이 목록에서 저절로 빠진다.
  const { data: openEnrollments } = await supabase
    .from("subject_enrollments")
    .select("id, child_id, status")
    .in("status", ["planned", "active"]);

  const enrollmentIds = (openEnrollments ?? []).map((e) => e.id as string);
  const { data: activeAssignments } = enrollmentIds.length
    ? await supabase
        .from("teacher_assignments")
        .select("subject_enrollment_id")
        .eq("status", "active")
        .in("subject_enrollment_id", enrollmentIds)
    : { data: [] as { subject_enrollment_id: string }[] };

  const matchedEnrollmentIds = new Set(
    (activeAssignments ?? []).map((a) => a.subject_enrollment_id as string)
  );
  const waitingChildIds = Array.from(
    new Set(
      (openEnrollments ?? [])
        .filter((e) => !matchedEnrollmentIds.has(e.id as string))
        .map((e) => e.child_id as string)
    )
  );

  // 아카이브된 가구의 자녀는 매칭 대상이 아니다(매칭 탭과 같은 기준).
  const archivedHouseholdIds = await loadArchivedHouseholdIds(supabase);
  const { data: childLinks } = waitingChildIds.length
    ? await supabase
        .from("household_members")
        .select("profile_id, household_id")
        .eq("role", "child")
        .in("profile_id", waitingChildIds)
    : { data: [] as { profile_id: string; household_id: string }[] };
  const householdByChild = new Map(
    (childLinks ?? []).map((l) => [l.profile_id as string, l.household_id as string])
  );

  const visibleChildIds = waitingChildIds.filter((id) => {
    const householdId = householdByChild.get(id);
    return !householdId || !archivedHouseholdIds.has(householdId);
  });

  const { data: pendingStudentRows } = visibleChildIds.length
    ? await supabase.from("students").select("id, profile:profiles(name)").in("id", visibleChildIds)
    : { data: [] as { id: string; profile: unknown }[] };

  const { data: pendingTeacherRows } = await supabase
    .from("teachers")
    .select("id, profile:profiles(name)")
    .eq("status", "pending");

  const { data: qcRows } = await supabase
    .from("teacher_qc_warnings")
    .select("teacher_id, teacher:teachers(profile:profiles(name))");

  const qcCountByTeacher = new Map<string, { name: string; count: number }>();
  for (const row of qcRows ?? []) {
    const existing = qcCountByTeacher.get(row.teacher_id);
    if (existing) {
      existing.count += 1;
    } else {
      const teacher = Array.isArray(row.teacher) ? row.teacher[0] : row.teacher;
      qcCountByTeacher.set(row.teacher_id, {
        name: extractName((teacher as { profile?: unknown } | null)?.profile),
        count: 1,
      });
    }
  }

  return {
    adminName: profile?.name ?? "관리자",
    pendingConsults: (pendingConsultRows ?? []).map((c) => ({
      id: c.id,
      personName: c.contact_name,
      email: c.contact_email,
      submittedAt: c.requested_at,
    })),
    upcomingConsults: (upcomingConsultRows ?? []).map((c) => ({
      id: c.id,
      personName: c.contact_name,
      scheduledAt: c.scheduled_at,
    })),
    pendingStudents: (pendingStudentRows ?? []).map((s) => ({
      id: s.id,
      name: extractName(s.profile),
    })),
    pendingTeachers: (pendingTeacherRows ?? []).map((t) => ({
      id: t.id,
      name: extractName(t.profile),
    })),
    qcWarnings: Array.from(qcCountByTeacher.entries()).map(([teacherId, v]) => ({
      teacherId,
      teacherName: v.name,
      count: v.count,
    })),
  };
}

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}
