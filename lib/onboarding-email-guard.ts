import type { createAdminClient } from "@/lib/supabase-admin";

// 2026-09-11(제품 오너 확정 정책, 재결정 대상 아님) — 상담(sendTrialOnboardingNoticeAction)·
// 직접 생성(sendDirectOnboardingNoticeAction) 두 발송 경로("자녀 추가"는 두 경로
// 모두의 학생 배열에 행을 추가하는 것일 뿐 별도 진입점이 아님, 코드 확인 완료)가
// 공통으로 쓰는 발급 전 점검이다. 자녀 이메일이 기존 auth.users와 이미 겹치면
// 온보딩 링크 생성·이메일 발송 자체를 막는다. 발급 후(발송 이후) 발생하는
// 충돌(레이스 등)은 여기서 다루지 않는다 — lib/trial-onboarding-finalize.ts의
// 기존 부분 실패·재시도(orphan 처리) 경로가 계속 담당한다.
//
// 보호자 이메일은 대상에서 제외한다 — 기존 보호자 Auth 계정 재사용(형제자매
// 추가, 재상담)이 정상 흐름이라 보호자 쪽 중복은 의도된 것이다.
export type OnboardingEmailCollision = { name: string; email: string };

export async function findExistingAuthEmailCollisions(
  admin: ReturnType<typeof createAdminClient>,
  students: { name: string; email: string }[]
): Promise<OnboardingEmailCollision[]> {
  const collisions: OnboardingEmailCollision[] = [];
  for (const s of students) {
    const { data, error } = await admin.rpc("find_auth_user_id_by_email", { p_email: s.email });
    if (error) throw new Error(`이메일 중복 확인에 실패했습니다(${s.email}): ${error.message}`);
    if (data) collisions.push({ name: s.name, email: s.email });
  }
  return collisions;
}
