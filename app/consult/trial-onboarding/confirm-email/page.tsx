import { previewTrialOnboardingLink } from "@/app/consult/trial-onboarding-actions";
import ConfirmEmailForm from "./ConfirmEmailForm";

// M4 (6/N) — 온보딩 링크를 연 직후, 실제 계정을 만들기 전에 로그인 이메일을
// 확인/변경하는 화면. prospect 이메일(상담 연락처)이 기본값으로 채워져
// 있고, 이 화면에 도달했다는 사실 자체가 그 이메일에 대한 접근을 이미
// 증명한다 — 다른 주소로 바꾸는 경우에만 별도 확인 메일을 보낸다.
export default async function ConfirmEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <main className="max-w-md mx-auto px-6 py-16">
        <p className="text-[14px] text-ink">유효하지 않은 온보딩 링크입니다.</p>
      </main>
    );
  }

  let preview;
  try {
    preview = await previewTrialOnboardingLink(token);
  } catch {
    return (
      <main className="max-w-md mx-auto px-6 py-16">
        <p className="text-[14px] text-ink">
          유효하지 않거나 만료된 온보딩 링크입니다. 관리자에게 재발급을 요청해주세요.
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto px-6 py-16">
      <div className="text-[11.5px] font-bold text-grey-500 mb-2">온보딩 · 1단계</div>
      <h1 className="text-[18px] font-extrabold text-ink mb-2">로그인 이메일 확인</h1>
      <p className="text-[13px] text-grey-500 mb-6">
        {preview.studentName} 학생의 보호자({preview.guardianName})님, 앞으로 Alton
        Education에 로그인할 때 사용할 이메일을 확인해주세요.
      </p>
      <ConfirmEmailForm token={token} linkId={preview.linkId} defaultEmail={preview.guardianEmail} />
    </main>
  );
}
