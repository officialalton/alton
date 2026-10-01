"use client";

// 2026-09-11(제품 오너 재검토 — GET 부작용 제거) — 실제 계정 생성은 이 폼이
// 제출하는 Server Action(confirmTrialOnboardingEmailChangeAction)에서만
// 일어난다. 이 페이지를 그냥 열거나 새로고침해도(=GET) 아무 일도 일어나지
// 않고, 이 버튼을 실제로 눌러야만(=폼 제출) 계정이 만들어진다.

import { useTransition } from "react";
import { confirmTrialOnboardingEmailChangeAction } from "../../trial-onboarding-finalize-actions";

export default function ConfirmEmailChangeForm({
  token,
  confirmedEmail,
}: {
  token: string;
  confirmedEmail: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={() => {
        startTransition(() => {
          confirmTrialOnboardingEmailChangeAction(token);
        });
      }}
    >
      <label htmlFor="confirmed-email" className="block text-[11.5px] font-semibold text-grey-500 mb-1">
        로그인 이메일
      </label>
      <input
        id="confirmed-email"
        type="email"
        className="w-full border border-grey-300 rounded px-3 py-2 text-[13.5px] mb-4"
        value={confirmedEmail}
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
