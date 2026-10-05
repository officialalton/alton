"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
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
    const supabase = createClient();
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
        setError("이미 가입된 이메일입니다. 로그인하거나 비밀번호 재설정을 이용해 주세요.");
      } else if (msg.includes("password")) {
        setError(`비밀번호가 너무 약합니다. ${MIN_PASSWORD_LENGTH}자 이상, 영문과 숫자를 포함해 주세요.`);
      } else if (msg.includes("rate limit") || msg.includes("too many")) {
        setError("요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
      } else {
        setError("가입 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
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
        <p className="font-bold text-[15px] mb-2">확인 메일을 보냈습니다</p>
        <p>
          <span className="font-semibold">{sentTo}</span>으로 보낸 메일의 링크를 열어 가입을 마무리해 주세요.
        </p>
        <p className="text-grey-500 text-[13px] mt-3">
          메일이 오지 않으면 스팸함을 확인해 주세요. 이미 가입된 이메일이라면 메일이 오지 않습니다 —{" "}
          <a href="/login" className="text-red font-bold">로그인</a> 또는{" "}
          <a href="/reset-password" className="text-red font-bold">비밀번호 재설정</a>을 이용해 주세요.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="mb-4">
        <label htmlFor="name" className="block text-[13px] font-bold text-ink mb-1.5">
          이름 <span className="text-red">*</span>
        </label>
        <input id="name" name="name" type="text" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} disabled={submitting} className={inputClass} />
      </div>
      <div className="mb-4">
        <label htmlFor="email" className="block text-[13px] font-bold text-ink mb-1.5">
          이메일 <span className="text-red">*</span>
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={submitting} className={inputClass} />
      </div>
      <div className="mb-4">
        <label htmlFor="password" className="block text-[13px] font-bold text-ink mb-1.5">
          비밀번호 <span className="text-red">*</span>
        </label>
        <input id="password" name="password" type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={submitting} className={inputClass} />
        <p className="text-[12px] text-grey-500 mt-1">{MIN_PASSWORD_LENGTH}자 이상, 영문과 숫자 포함</p>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label htmlFor="birthdate" className="block text-[13px] font-bold text-ink mb-1.5">
            생년월일 <span className="text-red">*</span>
          </label>
          <input id="birthdate" name="birthdate" type="date" required value={birthdate} onChange={(e) => setBirthdate(e.target.value)} disabled={submitting} className={inputClass} />
        </div>
        <div>
          <label htmlFor="grade" className="block text-[13px] font-bold text-ink mb-1.5">
            학년 <span className="text-red">*</span>
          </label>
          <input id="grade" name="grade" type="text" required placeholder="예: 10학년" value={grade} onChange={(e) => setGrade(e.target.value)} disabled={submitting} className={inputClass} />
        </div>
      </div>
      <div className="mb-4">
        <label htmlFor="school" className="block text-[13px] font-bold text-ink mb-1.5">
          학교 <span className="text-grey-400 font-normal">(선택)</span>
        </label>
        <input id="school" name="school" type="text" value={school} onChange={(e) => setSchool(e.target.value)} disabled={submitting} className={inputClass} />
      </div>
      <label className="flex items-start gap-2 text-[13px] text-ink mb-5 leading-[1.6]">
        <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} disabled={submitting} className="mt-1" />
        <span>
          이용약관과 개인정보 처리방침(버전 {STUDENT_TERMS_VERSION})에 동의합니다. <span className="text-red">*</span>
        </span>
      </label>

      {error && (
        <p role="alert" className="text-[13px] text-red mb-4">
          {error}
        </p>
      )}

      <button type="submit" disabled={submitting} className="block w-full text-center bg-red text-white font-bold text-[15px] py-3.5 rounded-lg hover:bg-[#a80e26] disabled:opacity-60">
        {submitting ? "처리 중..." : "확인 메일 받기"}
      </button>
    </form>
  );
}
