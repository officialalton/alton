import type { SupabaseClient } from "@supabase/supabase-js";

// 고정형 SAT 모의고사 V1 — 교사 배정 화면 데이터.
// 담당 학생 목록은 legacy `enrollments` 기준이다 — mock_exam_attempts RLS(20261415000000_..._foundation.sql,
// 20261416000000_..._assignment_and_answers_rls.sql)가 같은 테이블만 확인하므로 이 화면도 그와 일치시킨다.
// R5 v3 매칭 모델(teacher_assignments/subject_enrollments)까지 넓히려면 RLS도 같이 넓혀야 하므로
// 이번 패스 범위 밖으로 남긴다(app/teacher/mysubjects-data.ts 의 이중 모델 주석 참고).

export type TeacherMockExamStudent = { studentId: string; studentName: string | null };

export async function loadTeacherMockExamStudents(supabase: SupabaseClient, teacherId: string): Promise<TeacherMockExamStudent[]> {
  // `enrollments.student_id`는 `students(id)`를 참조한다(profiles가 아니다) — 그래서
  // `profiles!enrollments_student_id_fkey` 형태의 nested-select는 PostgREST가 그 제약을
  // students 테이블로 해석해 "no relationship" 스키마 캐시 오류를 낸다. `students.id`가
  // 곧 `profiles.id`(1:1 확장 테이블)이므로, student_id 목록을 profiles에 별도 조회해
  // 붙인다(app/student/teacher-data.ts와 동일 패턴).
  const { data, error } = await supabase
    .from("enrollments")
    .select("student_id")
    .eq("teacher_id", teacherId)
    .eq("status", "active");
  if (error) throw new Error(error.message);
  const studentIds = [...new Set((data ?? []).map((row) => row.student_id))];
  if (studentIds.length === 0) return [];

  const { data: profiles, error: profilesError } = await supabase.from("profiles").select("id, name").in("id", studentIds);
  if (profilesError) throw new Error(profilesError.message);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));

  return studentIds.map((studentId) => ({ studentId, studentName: nameById.get(studentId) ?? null }));
}
