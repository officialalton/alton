import { createAdminClient } from "@/lib/supabase-admin";
import ConfirmEmailChangeForm from "./ConfirmEmailChangeForm";

// 2026-09-11(제품 오너 재지적 — GET 무변경 요구 미충족) — "다른 이메일로
// 변경 후 확인 완료" 흐름의 확인 화면. GET 경로(route.ts와 이 페이지 모두)는
// peek_trial_login_email_change()(순수 조회, 어떤 UPDATE/INSERT도 하지
// 않음)로만 상태를 확인한다 — confirm_trial_login_email_change()는 첫 호출에
// status를 'confirmed'로 바꾸고 이벤트를 남기는 실제 상태 전이라 GET에서
// 호출하지 않는다. 실제 이메일 확인 확정과 Auth 계정 생성은 이 페이지의
// 버튼이 호출하는 Server Action(confirmTrialOnboardingEmailChangeAction)에서만
// 일어난다 — 이 페이지를 그냥 열거나 새로고침해도 아무 일도 일어나지 않는다.
export default async function ConfirmEmailChangePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <main className="max-w-md mx-auto px-6 py-16">
        <p className="text-[14px] text-ink">유효하지 않은 확인 링크입니다.</p>
      </main>
    );
  }

  const admin = createAdminClient();
  // peek_trial_login_email_change()는 순수 조회 전용이다 — 화면 표시를
  // 위해 호출해도 status/confirmed_at/이벤트 어느 것도 바꾸지 않는다.
  const { data, error } = await admin.rpc("peek_trial_login_email_change", { p_token: token });
  const peeked = data?.[0];
  if (error || !peeked || peeked.status === "expired") {
    return (
      <main className="max-w-md mx-auto px-6 py-16">
        <p className="text-[14px] text-ink">
          유효하지 않거나 만료된 확인 링크입니다. 관리자에게 재발급을 요청해주세요.
        </p>
      </main>
    );
  }

  const { data: link, error: linkError } = await admin
    .from("trial_onboarding_links")
    .select("guardian_name, student_name")
    .eq("id", peeked.link_id)
    .maybeSingle();
  if (linkError || !link) {
    return (
      <main className="max-w-md mx-auto px-6 py-16">
        <p className="text-[14px] text-ink">온보딩 정보를 찾을 수 없습니다. 관리자에게 문의해주세요.</p>
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto px-6 py-16">
      <div className="text-[11.5px] font-bold text-grey-500 mb-2">온보딩 · 이메일 변경 확인</div>
      <h1 className="text-[18px] font-extrabold text-ink mb-2">새 로그인 이메일 확인</h1>
      <p className="text-[13px] text-grey-500 mb-6">
        {link.student_name} 학생의 보호자({link.guardian_name})님, 앞으로 Alton Education에 로그인할 때
        사용할 이메일이 아래 주소로 확인됐습니다.
      </p>
      <ConfirmEmailChangeForm token={token} confirmedEmail={peeked.requested_email} />
    </main>
  );
}
