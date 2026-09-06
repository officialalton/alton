"use client";

// 2026-09-06 — "다른 이메일 사용하기" 경로 제거(제품 오너 확정): 관리자가 온보딩
// 초대를 발송할 때 이미 정확한 로그인 이메일을 입력하므로, 보호자가 이 화면에서
// 스스로 다른 이메일로 바꾸는 옵션은 불필요한 데다 레이아웃 겹침 버그도 있었다.
// Prospect 이메일 → 보호자 계정 이메일로 이어지는 기존 정책은 그대로 유지 —
// 이 화면은 이제 확인만 한다.

export default function ConfirmEmailForm({
  token,
  defaultEmail,
}: {
  token: string;
  linkId: string;
  defaultEmail: string;
}) {
  return (
    <div>
      <label htmlFor="onboarding-email" className="block text-[11.5px] font-semibold text-grey-500 mb-1">
        로그인 이메일
      </label>
      <input
        id="onboarding-email"
        type="email"
        className="w-full border border-grey-300 rounded px-3 py-2 text-[13.5px] mb-4"
        value={defaultEmail}
        readOnly
      />
      <a
        href={`/api/trial-onboarding/confirm-email?token=${encodeURIComponent(token)}`}
        className="inline-block text-[13px] font-bold px-4 py-2 rounded-lg bg-ink text-white"
      >
        이 이메일로 계속
      </a>
    </div>
  );
}
