"use server";

import { createClient } from "@/utils/supabase/server";
import { loadStudentCurriculum, type StudentCurriculum } from "@/lib/curriculum-overlay-data";

// v3 커리큘럼 열람 결함 수정(2026-09-11) — 학생 본인·연결된 학부모의 읽기 전용
// 커리큘럼 열람 전용 경로. 편집 가능한 교사용 서버 액션
// (app/teacher/student-curriculum-actions.ts::requireAssignedTeacherOrAdmin)은
// 학생·학부모를 명시적으로 거부하므로 재사용하지 않는다 — 대신 이 액션은
// "로그인했는가"만 확인하고, 실제 범위(본인 학생 또는 그 가구 보호자만)는
// RLS(20261229000000_r9_student_curriculum_overlay.sql +
// 20261275000000_v3_curriculum_overlay_guardian_read.sql의
// is_enrollment_child_or_guardian)가 담당한다 — 다른 학생·다른 가구의
// subjectEnrollmentId를 넣어도 행이 전혀 반환되지 않아, 단원이 없는 과목과
// 구별되지 않는 빈 상태로만 보인다(추가 정보 노출 없음).
export async function loadMyCurriculumOverlay(
  subjectEnrollmentId: string
): Promise<StudentCurriculum> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  return loadStudentCurriculum(supabase, subjectEnrollmentId);
}
