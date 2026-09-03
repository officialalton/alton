import { createAdminClient } from "@/lib/supabase-admin";
import { createGuardianAndStudentThenRedirect, redirectWithError } from "@/lib/trial-onboarding-finalize";

// M4 (6/N) — 보호자가 확인 화면에서 "이 이메일로 계속"을 선택했을 때(= prospect
// 이메일을 그대로 로그인 이메일로 쓰는 가장 흔한 경로). 온보딩 링크를 받은
// 그 주소로 실제로 링크를 열어 이 라우트까지 도달했다는 사실 자체가 상담
// 연락처(이메일) 접근 확인이다 — 별도 이메일 소유 확인 절차를 추가로 거치지
// 않는다(요구사항: 다른 이메일로 바꿀 때만 별도 확인 필요).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return redirectWithError(url, "유효하지 않은 온보딩 링크입니다.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("redeem_trial_onboarding_link", { p_token: token });
  if (error || !data?.[0]) {
    return redirectWithError(url, "유효하지 않거나 만료된 온보딩 링크입니다.");
  }
  const redeemed = data[0];

  return createGuardianAndStudentThenRedirect({
    url,
    linkId: redeemed.link_id,
    guardianEmail: redeemed.guardian_email,
    guardianName: redeemed.guardian_name,
    studentEmail: redeemed.student_email,
    studentName: redeemed.student_name,
  });
}
