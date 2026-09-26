import type { SupabaseClient } from "@supabase/supabase-js";

// 고정형 SAT 모의고사 V1 — 교사 배정 화면 데이터.
//
// 2026-09-21(UAT 지적 "배정 대상에 자녀 리스트가 제대로 안 나옴") — 예전엔 legacy `enrollments` 만 봐서
// v3 매칭(teacher_assignments → subject_enrollments.child_id, planned/active)으로 담당 중인 학생이 빠졌다.
// DB 의 teaches_student() 와 같은 두 모델을 합쳐서 본다(RLS 도 20261430000000 에서 같은 기준으로 통일).

export type TeacherMockExamStudent = { studentId: string; studentName: string | null };

export async function loadTeacherMockExamStudents(supabase: SupabaseClient, teacherId: string): Promise<TeacherMockExamStudent[]> {
  const [{ data: legacy, error: legacyErr }, { data: v3, error: v3Err }] = await Promise.all([
    supabase.from("enrollments").select("student_id").eq("teacher_id", teacherId).eq("status", "active"),
    supabase
      .from("teacher_assignments")
      .select("status, subject_enrollment:subject_enrollments!teacher_assignments_subject_enrollment_id_fkey(child_id)")
      .eq("teacher_id", teacherId)
      .in("status", ["planned", "active"]),
  ]);
  if (legacyErr) throw new Error(legacyErr.message);
  if (v3Err) throw new Error(v3Err.message);

  const ids = new Set<string>();
  for (const row of legacy ?? []) ids.add(row.student_id as string);
  for (const row of v3 ?? []) {
    const se = row.subject_enrollment as { child_id: string } | { child_id: string }[] | null;
    const childId = Array.isArray(se) ? se[0]?.child_id : se?.child_id;
    if (childId) ids.add(childId);
  }
  const studentIds = [...ids];
  if (studentIds.length === 0) return [];

  // `students.id` 가 곧 `profiles.id`(1:1) — 이름은 profiles 에서 따로 붙인다(nested-select 는 FK 가
  // students 를 가리켜 PostgREST 스키마 캐시 오류가 난다. app/student/teacher-data.ts 와 동일 패턴).
  const { data: profiles, error: profilesError } = await supabase.from("profiles").select("id, name").in("id", studentIds);
  if (profilesError) throw new Error(profilesError.message);
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));
  return studentIds
    .map((studentId) => ({ studentId, studentName: nameById.get(studentId) ?? null }))
    .sort((a, b) => (a.studentName ?? "").localeCompare(b.studentName ?? "", "ko"));
}
