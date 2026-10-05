"use server";

import { requireStudentFeature } from "@/lib/feature-access";

// 2026-10-05 무료 회원 S2 — "선생님과 이야기하기" 카드/안내 페이지의 상태 조회(자리표시자).
// 관심 등록·보호자 초대(student_consult_interests, guardian_link_invites)는 S4(20262100000003)에서
// 들어온다. 그때까지 상태는 항상 'preparing'이고, 쓰기 액션은 없다.
export type TutoringInterestStatus = "preparing";

export async function loadMyTutoringInterestStatusAction(): Promise<{ status: TutoringInterestStatus }> {
  await requireStudentFeature("tutoring_info");
  return { status: "preparing" };
}
