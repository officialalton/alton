import type { SupabaseClient } from "@supabase/supabase-js";

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
    .from("consult_requests")
    .select("id, person_name, email, submitted_at")
    .eq("status", "requested")
    .order("submitted_at", { ascending: true });

  const { data: upcomingConsultRows } = await supabase
    .from("consult_requests")
    .select("id, person_name, scheduled_at")
    .eq("status", "confirmed")
    .not("scheduled_at", "is", null)
    .order("scheduled_at", { ascending: true });

  const { data: pendingStudentRows } = await supabase
    .from("students")
    .select("id, profile:profiles(name)")
    .eq("status", "pending");

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
      personName: c.person_name,
      email: c.email,
      submittedAt: c.submitted_at,
    })),
    upcomingConsults: (upcomingConsultRows ?? []).map((c) => ({
      id: c.id,
      personName: c.person_name,
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
