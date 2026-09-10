"use server";

// 2026-09-10(P0 결함 수정 + 매칭 공통화) — 학생-선생님-과목 배정의 유일한
// v3 확정 경로. 매칭 탭(app/admin/matching-actions.ts)과 상담 체험 신청
// (app/admin/trial-onboarding-actions.ts), 그리고 향후 "신규" 통합 보드가
// 전부 이 함수 하나만 호출한다.
//
// 실제 배정·상태 전환·커리큘럼 시딩 로직은 DB 함수
// confirm_student_teacher_subject_match()(migration 20261270000000)
// 안에서 하나의 트랜잭션으로 처리된다 — planSubjectEnrollment()와
// assignTeacherToSubjectEnrollment()를 이 서버 액션에서 순차 호출하지
// 않는다(그렇게 하면 앞 단계만 성공하고 뒷단계가 실패하는 부분 성공
// 상태를 막을 수 없다). 총 회차 수 파라미터는 이 경로에 존재하지 않는다.
//
// 권한은 "매칭권한" capability로 표준화한다 — DB 함수 내부에서도 같은
// capability를 확인한다(이중 확인이 아니라, 앱 레이어는 UI 진입을 막고
// DB 레이어는 실제 쓰기를 막는 서로 다른 방어선 — 기존 R2 원칙과 동일).

import { requireAdminOrCapability } from "@/lib/admin-auth";

const MATCHING_CAPABILITY = "매칭권한";

export type ConfirmStudentTeacherSubjectMatchResult =
  | {
      ok: true;
      subjectEnrollmentId: string;
      teacherAssignmentId: string;
      overlayId: string | null;
      activationWarning: string | null;
      curriculumWarning: string | null;
    }
  | { ok: false; error: string };

export async function confirmStudentTeacherSubjectMatch(params: {
  childId: string;
  teacherId: string;
  subjectId: string;
}): Promise<ConfirmStudentTeacherSubjectMatchResult> {
  const { supabase } = await requireAdminOrCapability(MATCHING_CAPABILITY);

  const { data, error } = await supabase
    .rpc("confirm_student_teacher_subject_match", {
      p_child_id: params.childId,
      p_teacher_id: params.teacherId,
      p_subject_id: params.subjectId,
    })
    .single();

  if (error) return { ok: false, error: error.message };

  const row = data as {
    out_subject_enrollment_id: string;
    out_teacher_assignment_id: string;
    out_overlay_id: string | null;
    out_activation_warning: string | null;
    out_curriculum_warning: string | null;
  };

  return {
    ok: true,
    subjectEnrollmentId: row.out_subject_enrollment_id,
    teacherAssignmentId: row.out_teacher_assignment_id,
    overlayId: row.out_overlay_id,
    activationWarning: row.out_activation_warning,
    curriculumWarning: row.out_curriculum_warning,
  };
}
