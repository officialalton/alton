import type { SupabaseClient } from "@supabase/supabase-js";

export type RosterSubject = {
  enrollmentId: string;
  subjectId: string;
  subjectName: string;
  currentSession: number;
  totalSessions: number;
};

export type RosterStudent = {
  studentId: string;
  studentName: string;
  grade: string | null;
  subjects: RosterSubject[];
};

function extractName(rel: unknown): string {
  const row = Array.isArray(rel) ? rel[0] : rel;
  return (row as { name?: string } | null)?.name ?? "";
}

export async function loadRoster(
  supabase: SupabaseClient,
  teacherId: string
): Promise<RosterStudent[]> {
  // 2026-09-09(UAT 지적): 레거시 1:1 enrollments만 조회하면 R5 매칭 모델
  // (teacher_assignments + subject_enrollments)로 배정된 v3 담당 학생이
  // "학생별" 탭에 전혀 보이지 않는다(mysubjects-data.ts::loadMySubjects()와
  // 동일한 부류의 표시 버그). 두 소스를 함께 조회해 합친다.
  const [{ data: enrollments }, { data: assignments }] = await Promise.all([
    supabase
      .from("enrollments")
      .select(
        "id, student_id, subject_id, current_session, total_sessions, subject:subjects(name)"
      )
      .eq("teacher_id", teacherId)
      .eq("status", "active"),
    supabase
      .from("teacher_assignments")
      .select(
        "subject_enrollment:subject_enrollments!inner(id, subject_id, child_id, subject:subjects(name))"
      )
      .eq("teacher_id", teacherId)
      .eq("status", "active"),
  ]);

  type LegacyRow = { id: string; student_id: string; subject_id: string; current_session: number; total_sessions: number; subject: unknown };
  type V3Row = { id: string; subjectId: string; studentId: string; subject: unknown };

  const legacyRows: LegacyRow[] = enrollments ?? [];
  const v3Rows: V3Row[] = (assignments ?? []).flatMap((a) => {
    const se = Array.isArray(a.subject_enrollment) ? a.subject_enrollment[0] : a.subject_enrollment;
    if (!se) return [];
    return [{ id: se.id, subjectId: se.subject_id, studentId: se.child_id, subject: se.subject }];
  });

  if (legacyRows.length === 0 && v3Rows.length === 0) return [];

  const studentIds = Array.from(
    new Set([...legacyRows.map((e) => e.student_id), ...v3Rows.map((r) => r.studentId)])
  );
  const { data: studentRows } = await supabase
    .from("students")
    .select("id, grade, profile:profiles(name)")
    .in("id", studentIds);

  const studentById = new Map(
    (studentRows ?? []).map((s) => [
      s.id,
      { name: extractName(s.profile), grade: s.grade as string | null },
    ])
  );

  const byStudent = new Map<string, RosterStudent>();
  // 같은 (subject_id, student_id) 조합이 legacy/v3 양쪽에 있어도 과목이 중복
  // 표시되지 않도록 조합 단위로도 방어한다.
  const seenSubjectPerStudent = new Set<string>();

  function ensureStudent(studentId: string): RosterStudent | null {
    const info = studentById.get(studentId);
    if (!info) return null;
    if (!byStudent.has(studentId)) {
      byStudent.set(studentId, {
        studentId,
        studentName: info.name,
        grade: info.grade,
        subjects: [],
      });
    }
    return byStudent.get(studentId)!;
  }

  for (const e of legacyRows) {
    const student = ensureStudent(e.student_id);
    if (!student) continue;
    const key = `${e.student_id}:${e.subject_id}`;
    if (seenSubjectPerStudent.has(key)) continue;
    seenSubjectPerStudent.add(key);
    student.subjects.push({
      enrollmentId: e.id,
      subjectId: e.subject_id,
      subjectName: extractName(e.subject),
      currentSession: e.current_session,
      totalSessions: e.total_sessions,
    });
  }
  for (const r of v3Rows) {
    const student = ensureStudent(r.studentId);
    if (!student) continue;
    const key = `${r.studentId}:${r.subjectId}`;
    if (seenSubjectPerStudent.has(key)) continue;
    seenSubjectPerStudent.add(key);
    student.subjects.push({
      enrollmentId: r.id,
      subjectId: r.subjectId,
      subjectName: extractName(r.subject),
      currentSession: 0,
      totalSessions: 0,
    });
  }

  return Array.from(byStudent.values());
}
