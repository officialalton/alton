// C-2(2026-09-11) — "선생님이 이 과목의 운영 커리큘럼(단원 1개 이상)을 가져야
// 배정 가능"(C-1, confirm_student_teacher_subject_match / C-2,
// change_teacher_assignment와 동일 기준)을 재등록 경로의 "최초 배정"
// (assignTeacherToSubjectEnrollment — 기존 활성 배정이 없는 subject_enrollment에
// 직접 INSERT하는 경로라 위 두 RPC의 가드를 거치지 않는다)에도 적용한다.
// 새 SQL을 만들지 않고 이미 있는 trial_teacher_succession_eligibility()의
// has_curriculum 계산(teacher_curriculum_templates + template_units 존재)을
// 그대로 재사용한다 — 기준이 하나로만 존재하게.

import type { createAdminClient } from "@/lib/supabase-admin";

export type AdminClient = ReturnType<typeof createAdminClient>;

export async function hasTeacherOperatingCurriculum(
  admin: AdminClient,
  teacherId: string,
  subjectId: string
): Promise<boolean> {
  const { data, error } = await admin
    .rpc("trial_teacher_succession_eligibility", {
      p_teacher_id: teacherId,
      p_subject_id: subjectId,
    })
    .single();
  if (error) throw new Error(error.message);
  return Boolean((data as { has_curriculum: boolean }).has_curriculum);
}

/**
 * 운영 커리큘럼이 없으면 주어진 안내 메시지로 즉시 던진다. UI 후보 목록
 * (app/admin/matching-data.ts::loadTeacherCandidatesBySubject)이 이미 같은
 * 기준으로 좁혀뒀지만, 직접 서버 액션/RPC 호출로 그 필터를 우회할 수 없도록
 * 서버에서도 항상 확인한다.
 */
export async function assertTeacherHasOperatingCurriculum(
  admin: AdminClient,
  teacherId: string,
  subjectId: string,
  friendlyMessage: string
): Promise<void> {
  const hasCurriculum = await hasTeacherOperatingCurriculum(admin, teacherId, subjectId);
  if (!hasCurriculum) {
    throw new Error(friendlyMessage);
  }
}
