import type { SupabaseClient } from "@supabase/supabase-js";

// R5 — 학생/보호자 "과목 수강 현황" 화면 데이터 로더(읽기 전용).
//
// subject_enrollments / teacher_assignments 조회는 RLS가 이미 child_id 본인,
// 보호자(household 포함), 배정된 선생님, 관리자로 범위를 제한한다
// (20260830080000_r1_rls_policies.sql). 여기서는 세션 클라이언트로 그대로
// 조회하며 추가 소유권 검증을 하지 않는다 — RLS가 fail-closed로 막아준다.

export type TeacherAssignmentRecord = {
  id: string;
  teacherId: string;
  teacherName: string;
  status: "planned" | "active" | "ended";
  effectiveFrom: string;
  effectiveUntil: string | null;
  reason: string | null;
};

export type SubjectEnrollmentView = {
  id: string;
  subjectId: string;
  subjectName: string;
  status: "planned" | "active" | "paused" | "ended";
  currentTeacher: TeacherAssignmentRecord | null;
  upcomingTeacherChange: TeacherAssignmentRecord | null;
  history: TeacherAssignmentRecord[];
};

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}

export async function loadStudentSubjectEnrollments(
  supabase: SupabaseClient,
  childId: string
): Promise<SubjectEnrollmentView[]> {
  const { data: enrollments } = await supabase
    .from("subject_enrollments")
    .select("id, subject_id, status, subject:subjects(name)")
    .eq("child_id", childId)
    .order("created_at", { ascending: true });

  if (!enrollments || enrollments.length === 0) return [];

  const enrollmentIds = enrollments.map((e) => e.id);
  const { data: assignments } = await supabase
    .from("teacher_assignments")
    .select(
      "id, subject_enrollment_id, teacher_id, status, effective_from, effective_until, reason, teacher:profiles!teacher_assignments_teacher_id_fkey(name)"
    )
    .in("subject_enrollment_id", enrollmentIds)
    .order("effective_from", { ascending: true });

  const byEnrollment = new Map<string, TeacherAssignmentRecord[]>();
  for (const a of assignments ?? []) {
    const rec: TeacherAssignmentRecord = {
      id: a.id,
      teacherId: a.teacher_id,
      teacherName: extractName(a.teacher),
      status: a.status,
      effectiveFrom: a.effective_from,
      effectiveUntil: a.effective_until,
      reason: a.reason,
    };
    const list = byEnrollment.get(a.subject_enrollment_id) ?? [];
    list.push(rec);
    byEnrollment.set(a.subject_enrollment_id, list);
  }

  return enrollments.map((e) => {
    const all = byEnrollment.get(e.id) ?? [];
    const current = all.find((a) => a.status === "active") ?? null;
    const upcoming =
      all.find(
        (a) => a.status === "planned" && new Date(a.effectiveFrom) > new Date()
      ) ?? null;
    const history = all
      .filter((a) => a.status === "ended")
      .sort(
        (x, y) =>
          new Date(y.effectiveFrom).getTime() - new Date(x.effectiveFrom).getTime()
      );
    return {
      id: e.id,
      subjectId: e.subject_id,
      subjectName: extractName(e.subject),
      status: e.status,
      currentTeacher: current,
      upcomingTeacherChange: upcoming,
      history,
    };
  });
}
