import type { SupabaseClient } from "@supabase/supabase-js";
import { loadStudentSubjectEnrollments } from "@/app/student/enrollment-data";
import type { SubjectEnrollmentView } from "@/app/student/enrollment-data";

// R5 — 보호자 "자녀 과목 수강 현황" 화면 데이터 로더(읽기 전용).
// 자녀별 subject_enrollments 로딩은 student/enrollment-data.ts를 그대로 재사용한다
// (household guardian 접근은 RLS의 is_guardian_of/is_household_guardian_of가 처리).

export type ChildSubjectEnrollments = {
  childId: string;
  childName: string;
  enrollments: SubjectEnrollmentView[];
};

export async function loadChildrenSubjectEnrollments(
  supabase: SupabaseClient,
  children: { studentId: string; name: string }[]
): Promise<ChildSubjectEnrollments[]> {
  const result: ChildSubjectEnrollments[] = [];
  for (const c of children) {
    const enrollments = await loadStudentSubjectEnrollments(supabase, c.studentId);
    result.push({ childId: c.studentId, childName: c.name, enrollments });
  }
  return result;
}
