"use client";

// 2026-09-06 — "다른 이메일 사용하기" 경로 제거(제품 오너 확정): 관리자가 온보딩
// 초대를 발송할 때 이미 정확한 로그인 이메일을 입력하므로, 보호자가 이 화면에서
// 스스로 다른 이메일로 바꾸는 옵션은 불필요한 데다 레이아웃 겹침 버그도 있었다.
// Prospect 이메일 → 보호자 계정 이메일로 이어지는 기존 정책은 그대로 유지 —
// 이 화면은 이제 확인만 한다.
//
// 2026-09-11(제품 오너 재검토 — GET 부작용 제거) — 이 버튼은 더 이상 GET
// URL로의 <a href> 링크가 아니다. 실제 계정 생성은 이 폼이 제출하는 Server
// Action(confirmTrialOnboardingLinkAction)에서만 일어난다 — 이 페이지를
// 그냥 열거나 새로고침해도(=GET) 아무 일도 일어나지 않고, 이 버튼을 실제로
// 눌러야만(=폼 제출) 계정이 만들어진다.

import { useTransition } from "react";
import { confirmTrialOnboardingLinkAction } from "../../trial-onboarding-finalize-actions";

export default function ConfirmEmailForm({
  token,
  defaultEmail,
}: {
  token: string;
  linkId: string;
  defaultEmail: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={() => {
        startTransition(() => {
          confirmTrialOnboardingLinkAction(token);
        });
      }}
    >
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
      <button
        type="submit"
        disabled={isPending}
        className="inline-block text-[13px] font-bold px-4 py-2 rounded-lg bg-ink text-white disabled:opacity-60"
      >
        {isPending ? "처리 중..." : "이 이메일로 계속"}
      </button>
    </form>
  );
}
