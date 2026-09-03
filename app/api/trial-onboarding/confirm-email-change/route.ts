import { createAdminClient } from "@/lib/supabase-admin";
import { createGuardianAndStudentThenRedirect, redirectWithError } from "@/lib/trial-onboarding-finalize";

// M4 (6/N) — 보호자가 온보딩 중 로그인 이메일을 prospect 이메일과 다른 주소로
// 바꾸겠다고 요청한 뒤, 그 새 주소로 받은 확인 메일의 링크를 클릭했을 때
// 도달하는 라우트. confirm_trial_login_email_change()가 성공해야만(= 새
// 이메일 소유를 실제로 확인해야만) 이 시점에 처음으로 실제 Auth 계정을
// 만든다 — 검증 전에는 학생·수업권·계약 어느 것도 이 이메일에 연결되지 않는다.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return redirectWithError(url, "유효하지 않은 확인 링크입니다.");
  }

  const admin = createAdminClient();
  const { data: confirmData, error: confirmError } = await admin.rpc("confirm_trial_login_email_change", {
    p_token: token,
  });
  const confirmed = confirmData?.[0];
  if (confirmError || !confirmed) {
    return redirectWithError(url, "유효하지 않거나 만료된 확인 링크입니다.");
  }

  const { data: link, error: linkError } = await admin
    .from("trial_onboarding_links")
    .select("guardian_name, student_email, student_name")
    .eq("id", confirmed.link_id)
    .maybeSingle();
  if (linkError || !link) {
    return redirectWithError(url, "온보딩 정보를 찾을 수 없습니다. 관리자에게 문의해주세요.");
  }

  return createGuardianAndStudentThenRedirect({
    url,
    linkId: confirmed.link_id,
    guardianEmail: confirmed.requested_email,
    guardianName: link.guardian_name,
    studentEmail: link.student_email,
    studentName: link.student_name,
  });
}
