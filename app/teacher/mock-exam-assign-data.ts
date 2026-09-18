import type { SupabaseClient } from "@supabase/supabase-js";

// 고정형 SAT 모의고사 V1 — 교사 배정 화면 데이터.
// 담당 학생 목록은 legacy `enrollments` 기준이다 — mock_exam_attempts RLS(20261415000000_..._foundation.sql,
// 20261416000000_..._assignment_and_answers_rls.sql)가 같은 테이블만 확인하므로 이 화면도 그와 일치시킨다.
// R5 v3 매칭 모델(teacher_assignments/subject_enrollments)까지 넓히려면 RLS도 같이 넓혀야 하므로
// 이번 패스 범위 밖으로 남긴다(app/teacher/mysubjects-data.ts 의 이중 모델 주석 참고).

export type TeacherMockExamStudent = { studentId: string; studentName: string | null };

export async function loadTeacherMockExamStudents(supabase: SupabaseClient, teacherId: string): Promise<TeacherMockExamStudent[]> {
  const { data, error } = await supabase
    .from("enrollments")
    .select("student_id, student:profiles!enrollments_student_id_fkey(name)")
    .eq("teacher_id", teacherId)
    .eq("status", "active");
  if (error) throw new Error(error.message);
  const seen = new Map<string, TeacherMockExamStudent>();
  for (const row of data ?? []) {
    const student = Array.isArray(row.student) ? row.student[0] : row.student;
    seen.set(row.student_id, { studentId: row.student_id, studentName: student?.name ?? null });
  }
  return [...seen.values()];
}
