"use client";

import { useState } from "react";
import { createSignupClient } from "@/utils/supabase/client";
import { MIN_PASSWORD_LENGTH, STUDENT_TERMS_VERSION, validateStudentSignup } from "@/lib/free-member-signup";

const inputClass =
  "w-full px-3.5 py-3 border-[1.5px] border-grey-200 rounded-lg text-[14.5px] text-ink focus:outline-none focus:border-ink disabled:bg-grey-100";

/**
 * 2026-10-05 무료 학습 회원 셀프 가입 폼(S1). supabase.auth.signUp()을 브라우저에서 직접 호출하고,
 * 확인 메일의 링크는 /signup/student/confirm(token_hash)로 돌아온다(이메일 템플릿 supabase/templates/confirmation.html).
 * 중복 이메일: Supabase는 확인 메일 ON일 때 기존 계정 여부를 응답으로 구분해 주지 않는다(계정 열거 방지) —
 * 안내 문구에 "이미 가입된 이메일이면 로그인/비밀번호 재설정"을 같이 적는다. 자동 병합 없음.
 */
export default function SignupForm({ initialError }: { initialError?: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [grade, setGrade] = useState("");
  const [school, setSchool] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const v = validateStudentSignup({ name, email, password, birthdate, grade, school, termsAccepted });
    if (!v.ok) {
      setError(v.message);
      return;
    }
    setSubmitting(true);
    const supabase = createSignupClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: v.email,
      password: v.password,
      options: {
        emailRedirectTo: `${window.location.origin}/signup/student/confirm`,
        data: v.metadata,
      },
    });
    setSubmitting(false);
    if (signUpError) {
      const msg = signUpError.message.toLowerCase();
      if (msg.includes("already registered") || msg.includes("already been registered")) {
        setError("This email is already registered. Please log in or reset your password.");
      } else if (msg.includes("password")) {
        setError(`Password is too weak. Use at least ${MIN_PASSWORD_LENGTH} characters with letters and numbers.`);
      } else if (msg.includes("rate limit") || msg.includes("too many")) {
        setError("Too many requests. Please try again in a moment.");
      } else {
        setError("We couldn't process your sign-up. Please try again in a moment.");
      }
      return;
    }
    // 확인 메일 ON: 기존 계정이면 identities가 빈 가짜 사용자가 돌아온다 — 구분 문구 없이 같은 안내를 보여준다.
    void data;
    setSentTo(v.email);
  }

  if (sentTo) {
    return (
      <div className="text-[14px] text-ink leading-[1.7]">
        <p className="font-bold text-[15px] mb-2">Check your email</p>
        <p>
          We sent a confirmation link to <span className="font-semibold">{sentTo}</span>. Open it to finish signing up.
        </p>
        <p className="text-grey-500 text-[13px] mt-3">
          Don&apos;t see it? Check your spam folder. If this email is already registered, no email will be sent —{" "}
          <a href="/login" className="text-red font-bold">log in</a> or{" "}
          <a href="/reset-password" className="text-red font-bold">reset your password</a> instead.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="mb-4">
        <label htmlFor="name" className="block text-[13px] font-bold text-ink mb-1.5">
          Name <span className="text-red">*</span>
        </label>
        <input id="name" name="name" type="text" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} disabled={submitting} className={inputClass} />
      </div>
      <div className="mb-4">
        <label htmlFor="email" className="block text-[13px] font-bold text-ink mb-1.5">
          Email <span className="text-red">*</span>
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={submitting} className={inputClass} />
      </div>
      <div className="mb-4">
        <label htmlFor="password" className="block text-[13px] font-bold text-ink mb-1.5">
          Password <span className="text-red">*</span>
        </label>
        <input id="password" name="password" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={submitting} className={inputClass} />
        <p className="text-[12px] text-grey-500 mt-1">At least {MIN_PASSWORD_LENGTH} characters, with letters and numbers</p>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label htmlFor="birthdate" className="block text-[13px] font-bold text-ink mb-1.5">
            Date of birth <span className="text-red">*</span>
          </label>
          <input id="birthdate" name="birthdate" type="date" required value={birthdate} onChange={(e) => setBirthdate(e.target.value)} disabled={submitting} className={inputClass} />
        </div>
        <div>
          <label htmlFor="grade" className="block text-[13px] font-bold text-ink mb-1.5">
            Grade <span className="text-red">*</span>
          </label>
          <input id="grade" name="grade" type="text" required placeholder="e.g. 10th grade" value={grade} onChange={(e) => setGrade(e.target.value)} disabled={submitting} className={inputClass} />
        </div>
      </div>
      <div className="mb-4">
        <label htmlFor="school" className="block text-[13px] font-bold text-ink mb-1.5">
          School <span className="text-grey-400 font-normal">(optional)</span>
        </label>
        <input id="school" name="school" type="text" value={school} onChange={(e) => setSchool(e.target.value)} disabled={submitting} className={inputClass} />
      </div>
      <label className="flex items-start gap-2 text-[13px] text-ink mb-5 leading-[1.6]">
        <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} disabled={submitting} className="mt-1" />
        <span>
          I agree to the Terms of Service and Privacy Policy (version {STUDENT_TERMS_VERSION}). <span className="text-red">*</span>
        </span>
      </label>

      {error && (
        <p role="alert" className="text-[13px] text-red mb-4">
          {error}
        </p>
      )}

      <button type="submit" disabled={submitting} className="block w-full text-center bg-red text-white font-bold text-[15px] py-3.5 rounded-lg hover:bg-[#a80e26] disabled:opacity-60">
        {submitting ? "Sending..." : "Send confirmation email"}
      </button>
    </form>
  );
}
