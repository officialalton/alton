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

// =========================================================================
// 수업 전 열람(예습)
// =========================================================================
// 2026-09-13 확정: 학생은 자기 회차의 교재·문제를 수업 전에 미리 볼 수 있다.
// 예약이나 수업 시작 여부로 막지 않는다. 정답·해설은 기존 공개 조건 그대로라
// **응답 데이터에 아예 담기지 않는다** — 화면에서 가리는 것이 아니다.
//
// 범위 판단과 내용 고르기는 전부 DB 함수(unit_preview_for_viewer)에 있다. 앱이
// 고르면 앱을 거치지 않는 경로에서 새어 나간다.

export type UnitPreviewMaterial = {
  curriculumDocId: string;
  title: string;
  versionId: string | null;
  sections: { id: string; title: string; body: string }[];
};

export type UnitPreviewProblem = {
  problemId: string;
  versionId: string | null;
  format: string;
  passage: string | null;
  options: string[] | null;
};

export type UnitPreview = {
  unitId: string;
  unitTitle: string;
  goal: string | null;
  /** 이 회차로 이미 수업이 시작됐는가. 그렇다면 그때 고정된 내용을 보여준다. */
  frozen: boolean;
  sessionId: string | null;
  materials: UnitPreviewMaterial[];
  problems: UnitPreviewProblem[];
};

export async function loadUnitPreview(overlayUnitId: string): Promise<UnitPreview | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("로그인이 필요합니다.");

  const { data, error } = await supabase.rpc("unit_preview_for_viewer", {
    p_overlay_unit_id: overlayUnitId,
  });
  if (error) {
    console.error(JSON.stringify({ event: "unit_preview_failed", message: error.message }));
    return null;
  }
  return (data as UnitPreview | null) ?? null;
}
