import type { SupabaseClient } from "@supabase/supabase-js";

// R5 — 선생님 "내 배정 학생/과목" 화면 데이터 로더(읽기 전용).
// teacher_assignments 조회는 RLS가 teacher_id = auth.uid()로 범위를 제한한다
// (20260830080000_r1_rls_policies.sql) — 종료된(다른 선생님 소유) 배정은 노출되지 않는다.

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}

export type TeacherAssignedSubject = {
  assignmentId: string;
  subjectEnrollmentId: string;
  studentId: string;
  studentName: string;
  studentGrade: string | null;
  studentPhone: string | null;
  subjectId: string;
  subjectName: string;
  status: "planned" | "active" | "ended";
  effectiveFrom: string;
  effectiveUntil: string | null;
  // 2026-09-09(UAT 정정) — 이 v3 배정과 같은 (student, subject) 조합의 레거시
  // enrollments 행이 실제로 있을 때만 true. "배정" 탭의 "커리큘럼 보기"(레거시
  // 커리큘럼 뷰) 버튼을 이 값이 있을 때만 보여줘, v3 전용 배정에서 아무 데도
  // 연결되지 않는 죽은 클릭을 만들지 않는다.
  hasLegacyCurriculum: boolean;
};

export async function loadTeacherAssignments(
  supabase: SupabaseClient,
  teacherId: string
): Promise<{ current: TeacherAssignedSubject[]; past: TeacherAssignedSubject[] }> {
  const { data: assignments } = await supabase
    .from("teacher_assignments")
    .select("id, subject_enrollment_id, status, effective_from, effective_until")
    .eq("teacher_id", teacherId)
    .order("effective_from", { ascending: false });

  if (!assignments || assignments.length === 0) return { current: [], past: [] };

  const enrollmentIds = Array.from(
    new Set(assignments.map((a) => a.subject_enrollment_id))
  );
  const { data: enrollments } = await supabase
    .from("subject_enrollments")
    .select("id, child_id, subject_id, subject:subjects(name)")
    .in("id", enrollmentIds);

  const enrollmentById = new Map((enrollments ?? []).map((e) => [e.id, e]));

  const childIds = Array.from(
    new Set((enrollments ?? []).map((e) => e.child_id))
  );
  const { data: students } = childIds.length
    ? await supabase.from("profiles").select("id, name, phone").in("id", childIds)
    : { data: [] as { id: string; name: string; phone: string | null }[] };
  const { data: studentRows } = childIds.length
    ? await supabase.from("students").select("id, grade").in("id", childIds)
    : { data: [] as { id: string; grade: string | null }[] };
  const studentNameById = new Map((students ?? []).map((s) => [s.id, s.name]));
  const studentPhoneById = new Map((students ?? []).map((s) => [s.id, s.phone]));
  const studentGradeById = new Map((studentRows ?? []).map((s) => [s.id, s.grade]));

  // 2026-09-09(UAT 정정) — "커리큘럼 보기"(레거시) 버튼을 실제 레거시 데이터가
  // 있는 조합에서만 보여주기 위해, 이 교사의 레거시 enrollments를 (student_id,
  // subject_id) 키로 조회해둔다(roster-data.ts::loadRoster()의 동일 패턴).
  const { data: legacyEnrollments } = childIds.length
    ? await supabase
        .from("enrollments")
        .select("student_id, subject_id")
        .eq("teacher_id", teacherId)
        .in("student_id", childIds)
    : { data: [] as { student_id: string; subject_id: string }[] };
  const legacyKeys = new Set(
    (legacyEnrollments ?? []).map((e) => `${e.student_id}:${e.subject_id}`)
  );

  const rows: TeacherAssignedSubject[] = assignments.map((a) => {
    const enrollment = enrollmentById.get(a.subject_enrollment_id);
    const childId = enrollment?.child_id ?? "";
    const subjectId = enrollment?.subject_id ?? "";
    return {
      assignmentId: a.id,
      subjectEnrollmentId: a.subject_enrollment_id,
      studentId: childId,
      studentName: studentNameById.get(childId) ?? "",
      studentGrade: studentGradeById.get(childId) ?? null,
      studentPhone: studentPhoneById.get(childId) ?? null,
      subjectId,
      subjectName: extractName(enrollment?.subject),
      status: a.status,
      effectiveFrom: a.effective_from,
      effectiveUntil: a.effective_until,
      hasLegacyCurriculum: legacyKeys.has(`${childId}:${subjectId}`),
    };
  });

  return {
    current: rows.filter((r) => r.status === "active" || r.status === "planned"),
    past: rows.filter((r) => r.status === "ended"),
  };
}
