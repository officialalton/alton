"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function SetPasswordPage() {
  const router = useRouter();
  const [showReferralField, setShowReferralField] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setShowReferralField(new URLSearchParams(window.location.search).get("role") === "parent");
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const password = form.get("password") as string;
    const confirm = form.get("confirm") as string;
    const consent = form.get("consent");

    if (password.length < 8) {
      setError("비밀번호는 8자 이상이어야 해요.");
      return;
    }
    if (password !== confirm) {
      setError("비밀번호가 서로 일치하지 않아요.");
      return;
    }
    if (!consent) {
      setError("이용약관 및 개인정보처리방침에 동의해주세요.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();

    // 이 브라우저에 이미 로그인된 다른 계정(예: 같은 컴퓨터를 쓰는 부모/학생, 혹은
    // 방금 초대를 보낸 관리자 본인)의 세션이 남아있을 수 있다. 반드시 초대/재설정
    // 링크의 토큰으로 세션을 명시적으로 새로 만든 뒤에만 비밀번호를 바꾼다 — 토큰이
    // 없거나 유효하지 않으면 절대로 그 자리에 남아있던 세션에 대고 진행하지 않는다.
    //
    // token_hash(+type) 쿼리 파라미터가 우선이다: 이메일의 확인 링크가 Supabase 자체
    // 확인 URL(GET만으로 토큰이 소진됨) 대신 이 페이지로 직접 오도록 이메일 템플릿을
    // 구성하면, 메일 스캐너가 링크를 미리 방문해도(GET만 하고 JS는 실행 안 함) 토큰이
    // 소진되지 않는다 — verifyOtp는 사용자가 폼을 제출하는 이 시점에만 호출된다.
    const search = new URLSearchParams(window.location.search);
    const tokenHash = search.get("token_hash");
    const otpType = search.get("type");

    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const hashParams = new URLSearchParams(hash);
    const access_token = hashParams.get("access_token");
    const refresh_token = hashParams.get("refresh_token");

    if (tokenHash && otpType) {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        type: otpType as "invite" | "recovery" | "email_change" | "signup" | "magiclink",
        token_hash: tokenHash,
      });
      if (verifyError) {
        setSubmitting(false);
        setError("링크가 만료되었거나 이미 사용됐어요. 다시 요청해주세요.");
        return;
      }
    } else if (access_token && refresh_token) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });
      if (sessionError) {
        setSubmitting(false);
        setError(sessionError.message);
        return;
      }
    } else {
      setSubmitting(false);
      setError("링크가 만료되었거나 유효하지 않아요. 다시 요청해주세요.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });
    setSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    // 추천인 코드(referral)는 이 단계에서 검증/적립하지 않는다 — 크레딧 적립 로직은
    // 결제/크레딧 티켓(024/032)에서 credit_transactions에 반영한다. 여기서는 값만 받아둔다.
    router.push("/post-auth");
  }

  return (
    <main className="min-h-screen bg-grey-100 flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-[420px] rounded-[14px] bg-white p-11 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="text-center font-extrabold text-lg tracking-[0.02em] text-ink mb-1.5">
          ALTON <span className="text-red">EDUCATION</span>
        </div>
        <h1 className="text-center text-[21px] font-extrabold text-ink mb-2">
          새 비밀번호 설정
        </h1>
        <p className="text-center text-[13.5px] text-grey-500 mb-8 leading-[1.6]">
          임시 비밀번호로 로그인하셨습니다.
          <br />
          계속하려면 본인만의 비밀번호를 설정해주세요.
        </p>

        <div className="flex gap-2.5 bg-yellow-bg border border-[#F2D98A] rounded-lg px-3.5 py-3 text-[12.5px] text-[#7A5C05] leading-[1.6] mb-[22px]">
          최초 로그인 시 1회만 진행되며, 설정 후 역할에 맞는 포털로 자동 이동합니다.
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="password" className="block text-[13px] font-bold text-ink mb-1.5">
              새 비밀번호
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              placeholder="8자 이상"
              className="w-full px-3.5 py-3 border-[1.5px] border-grey-200 rounded-lg text-[14.5px] text-ink focus:outline-none focus:border-ink"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="confirm" className="block text-[13px] font-bold text-ink mb-1.5">
              새 비밀번호 확인
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              required
              placeholder="다시 입력"
              className="w-full px-3.5 py-3 border-[1.5px] border-grey-200 rounded-lg text-[14.5px] text-ink focus:outline-none focus:border-ink"
            />
          </div>
          {showReferralField && (
            <div className="mb-4">
              <label htmlFor="referral" className="block text-[13px] font-bold text-ink mb-1.5">
                추천인 코드 (선택)
              </label>
              <input
                id="referral"
                name="referral"
                type="text"
                placeholder="예: ALTON-MINJI82"
                className="w-full px-3.5 py-3 border-[1.5px] border-grey-200 rounded-lg text-[14.5px] text-ink focus:outline-none focus:border-ink"
              />
            </div>
          )}

          <label className="flex items-start gap-2 text-[12.5px] text-grey-500 leading-[1.5] mb-[22px]">
            <input name="consent" type="checkbox" className="mt-0.5" />
            이용약관 및 개인정보처리방침에 동의합니다 (필수)
          </label>

          {error && <p className="text-[13px] text-red mb-4">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="block w-full text-center bg-red text-white font-bold text-[15px] py-3.5 rounded-lg hover:bg-[#a80e26] disabled:opacity-60"
          >
            {submitting ? "설정 중..." : "비밀번호 설정하고 계속하기"}
          </button>
        </form>
      </div>
    </main>
  );
}
