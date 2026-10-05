"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { provisionFreeMemberAction } from "../actions";

/**
 * 2026-10-05 무료 학습 회원 이메일 확인(S1). 확인 메일의 링크(token_hash&type=signup)가 이 화면으로 온다.
 * /set-password와 같은 이유로 GET만으로는 토큰을 소진하지 않는다(메일 스캐너 방어) — 사용자가 버튼을
 * 눌렀을 때 verifyOtp → 세션 생성 → 서버 액션이 provision_free_member를 호출 → /student.
 * 다른 브라우저에서 메일을 열어도 동작한다(PKCE code 교환이 아니라 token_hash 방식).
 */
export default function StudentSignupConfirmPage() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setError(null);
    setSubmitting(true);
    const supabase = createClient();
    const search = new URLSearchParams(window.location.search);
    const tokenHash = search.get("token_hash");
    const otpType = search.get("type");

    if (tokenHash && otpType) {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        type: otpType as "signup" | "email",
        token_hash: tokenHash,
      });
      if (verifyError) {
        setSubmitting(false);
        setError("링크가 만료되었거나 이미 사용됐습니다. 가입 화면에서 다시 시도해 주세요.");
        return;
      }
    } else {
      // 이미 세션이 있는 경우(같은 브라우저에서 두 번 눌렀을 때 등)만 계속 진행한다.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setSubmitting(false);
        setError("링크가 유효하지 않습니다. 가입 화면에서 다시 시도해 주세요.");
        return;
      }
    }

    const result = await provisionFreeMemberAction();
    if (!result.ok) {
      setSubmitting(false);
      setError(result.message);
      return;
    }
    window.location.assign(result.redirectTo);
  }

  return (
    <main className="min-h-screen bg-grey-100 flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-[420px] rounded-[14px] bg-white p-11 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="text-center font-extrabold text-lg tracking-[0.02em] text-ink mb-1.5">
          ALTON <span className="text-red">EDUCATION</span>
        </div>
        <h1 className="text-center text-[21px] font-extrabold text-ink mb-2">이메일 확인</h1>
        <p className="text-center text-[13.5px] text-grey-500 mb-8 leading-[1.6]">
          아래 버튼을 누르면 이메일 확인이 완료되고
          <br />
          무료 학습 회원으로 바로 시작합니다.
        </p>
        {error && (
          <p role="alert" className="text-[13px] text-red mb-4">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          className="block w-full text-center bg-red text-white font-bold text-[15px] py-3.5 rounded-lg hover:bg-[#a80e26] disabled:opacity-60"
        >
          {submitting ? "확인 중..." : "이메일 확인하고 시작하기"}
        </button>
        <p className="text-center text-[13px] text-grey-500 mt-[22px]">
          <a href="/signup/student" className="text-red font-bold">
            가입 화면으로
          </a>
        </p>
      </div>
    </main>
  );
}
