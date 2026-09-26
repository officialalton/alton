import type { SupabaseClient } from "@supabase/supabase-js";
import { loadStudentSubjectEnrollments } from "@/app/student/enrollment-data";
import type { SubjectEnrollmentView } from "@/app/student/enrollment-data";
import { getProgressedTrialEnrollmentIds } from "./regular-intent-data";

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
  return Promise.all(
    children.map(async (c) => {
      const enrollments = await loadStudentSubjectEnrollments(supabase, c.studentId);
      return { childId: c.studentId, childName: c.name, enrollments };
    })
  );
}

// (2026-09-06) 홈 배너(regular-intent-data.ts)와 정확히 같은 기준으로 "정규 진행
// 희망 선택이 필요할 수 있는 과목"의 대상 universe를 계산한다 — 수강 과목 탭의
// TrialConversionPanel이 이 집합에 속한 과목만 그려서, 두 화면이 서로 다른 조건을
// 쓰다 "탭에는 뜨는데 홈엔 안 뜨는" 불일치가 생기지 않게 한다.
export async function loadProgressedTrialEnrollmentIds(
  supabase: SupabaseClient,
  childrenEnrollments: ChildSubjectEnrollments[]
): Promise<string[]> {
  const enrollmentIds = childrenEnrollments.flatMap((c) => c.enrollments.map((e) => e.id));
  const ids = await getProgressedTrialEnrollmentIds(supabase, enrollmentIds);
  return Array.from(ids);
}
