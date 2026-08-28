"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function SetPasswordPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
