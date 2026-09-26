"use server";

// 2026-09-11(제품 오너 재검토 — GET 부작용 제거) — 실제 계정 생성·복구 링크
// 발급·메일 발송은 반드시 여기(Server Action, "이 이메일로 계속" 버튼이 직접
// 호출)에서만 일어난다. app/api/trial-onboarding/confirm-email(-change)/route.ts의
// GET 핸들러는 더 이상 이 로직을 부르지 않고 확인 페이지로 리다이렉트만
// 한다 — 이메일 클라이언트의 링크 프리스캔이나 재클릭처럼 GET이 여러 번
// 일어날 수 있는 상황에서 그 자체로는 어떤 부작용도 내지 않는다.

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase-admin";
import { createGuardianAndStudentThenRedirect, redirectWithError } from "@/lib/trial-onboarding-finalize";

// "prospect 이메일 그대로 유지" 경로 — 클라이언트가 보여주기 위해 이미 알고
// 있는 linkId/guardianEmail이 아니라, 토큰 하나만 받아 서버에서 다시
// redeem_trial_onboarding_link()로 신원을 재도출한다(클라이언트가 넘긴 값을
// 신뢰하지 않는다 — 사용자가 폼 필드를 조작해 다른 링크의 정보를 넘길 수
// 없게 한다).
export async function confirmTrialOnboardingLinkAction(token: string): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("redeem_trial_onboarding_link", { p_token: token });
  const redeemed = data?.[0];
  if (error || !redeemed) {
    redirect(redirectWithError("유효하지 않거나 만료된 온보딩 링크입니다.").redirectPath);
  }

  const result = await createGuardianAndStudentThenRedirect({
    linkId: redeemed.link_id,
    guardianEmail: redeemed.guardian_email,
    guardianName: redeemed.guardian_name,
  });
  redirect(result.redirectPath);
}

// "다른 이메일로 변경 후 확인 완료" 경로 — 이메일로 받은 확인 링크의 토큰을
// 그대로 받아, confirm_trial_login_email_change()(이미 멱등)로 신원을
// 재도출한다. 이 RPC 자체(이메일 소유 확인 마킹)는 GET에 남아 있지만, 계정
// 생성은 여기서만 일어난다.
export async function confirmTrialOnboardingEmailChangeAction(token: string): Promise<void> {
  const admin = createAdminClient();
  const { data: confirmData, error: confirmError } = await admin.rpc("confirm_trial_login_email_change", {
    p_token: token,
  });
  const confirmed = confirmData?.[0];
  if (confirmError || !confirmed) {
    redirect(redirectWithError("유효하지 않거나 만료된 확인 링크입니다.").redirectPath);
  }

  const { data: link, error: linkError } = await admin
    .from("trial_onboarding_links")
    .select("guardian_name")
    .eq("id", confirmed.link_id)
    .maybeSingle();
  if (linkError || !link) {
    redirect(redirectWithError("온보딩 정보를 찾을 수 없습니다. 관리자에게 문의해주세요.").redirectPath);
  }

  const result = await createGuardianAndStudentThenRedirect({
    linkId: confirmed.link_id,
    guardianEmail: confirmed.requested_email,
    guardianName: link.guardian_name,
  });
  redirect(result.redirectPath);
}
