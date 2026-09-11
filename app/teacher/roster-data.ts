import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCurriculumOverlayProgressByEnrollment, getCurriculumOverlayProgress } from "@/lib/curriculum-overlay-progress";

export type RosterSubject = {
  enrollmentId: string;
  subjectId: string;
  subjectName: string;
  currentSession: number;
  totalSessions: number;
  // 2026-09-09(UAT 정정) — "학생별" 탭이 이 과목을 눌렀을 때 레거시 커리큘럼
  // 뷰(`enrollmentId`가 legacy `enrollments.id`)로 갈지, v3 운영 커리큘럼 뷰
  // (`enrollmentId`가 실제로는 `subject_enrollments.id`)로 갈지 구분하는 데 쓴다.
  source: "legacy" | "v3";
  // C-1(2026-09-10) — v3 과목의 출처 표시("교사 운영 커리큘럼 기준"/"공통
  // 커리큘럼 기준"). legacy 과목은 이 개념이 없어 항상 null.
  curriculumSourceLabel: string | null;
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
      .select("id, student_id, subject_id, subject:subjects(name)")
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

  type LegacyRow = { id: string; student_id: string; subject_id: string; subject: unknown };
  type V3Row = { id: string; subjectId: string; studentId: string; subject: unknown };

  const legacyRows: LegacyRow[] = enrollments ?? [];
  const v3Rows: V3Row[] = (assignments ?? []).flatMap((a) => {
    const se = Array.isArray(a.subject_enrollment) ? a.subject_enrollment[0] : a.subject_enrollment;
    if (!se) return [];
    return [{ id: se.id, subjectId: se.subject_id, studentId: se.child_id, subject: se.subject }];
  });

  if (legacyRows.length === 0 && v3Rows.length === 0) return [];

  // 2026-09-10(P0 결함 수정) — enrollments.total_sessions/current_session은
  // 매칭 확정 시 더 이상 입력받지 않는다. 회차 표시는 그 대신 legacy_sessions
  // 실적으로 계산한다(app/student/teacher-data.ts가 v3 sessions로 계산하는
  // 것과 같은 접근).
  const legacyEnrollmentIds = legacyRows.map((e) => e.id);
  const { data: legacySessions } = legacyEnrollmentIds.length
    ? await supabase
        .from("legacy_sessions")
        .select("enrollment_id, status")
        .in("enrollment_id", legacyEnrollmentIds)
    : { data: [] as { enrollment_id: string; status: string }[] };
  const totalByEnrollment = new Map<string, number>();
  const doneByEnrollment = new Map<string, number>();
  for (const s of legacySessions ?? []) {
    totalByEnrollment.set(s.enrollment_id, (totalByEnrollment.get(s.enrollment_id) ?? 0) + 1);
    if (s.status === "completed") {
      doneByEnrollment.set(s.enrollment_id, (doneByEnrollment.get(s.enrollment_id) ?? 0) + 1);
    }
  }

  // C-1(2026-09-10) — v3 과목의 진도는 더 이상 세션 실적(0으로 고정되던 버그)이
  // 아니라 curriculum_overlay_units 기준으로 계산한다.
  const v3ProgressByEnrollment = await loadCurriculumOverlayProgressByEnrollment(
    supabase,
    v3Rows.map((r) => r.id)
  );

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
      currentSession: doneByEnrollment.get(e.id) ?? 0,
      totalSessions: totalByEnrollment.get(e.id) ?? 0,
      source: "legacy",
      curriculumSourceLabel: null,
    });
  }
  for (const r of v3Rows) {
    const student = ensureStudent(r.studentId);
    if (!student) continue;
    const key = `${r.studentId}:${r.subjectId}`;
    if (seenSubjectPerStudent.has(key)) continue;
    seenSubjectPerStudent.add(key);
    const progress = getCurriculumOverlayProgress(v3ProgressByEnrollment, r.id);
    student.subjects.push({
      enrollmentId: r.id,
      subjectId: r.subjectId,
      subjectName: extractName(r.subject),
      currentSession: progress.doneUnits,
      totalSessions: progress.totalUnits,
      source: "v3",
      curriculumSourceLabel: progress.sourceLabel,
    });
  }

  return Array.from(byStudent.values());
}
