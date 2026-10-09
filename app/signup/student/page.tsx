import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { resolveAccountDestination } from "@/lib/auth";
import { pendingFreeSignupDestination } from "@/lib/free-member-signup";
import SignupForm from "./SignupForm";

/**
 * 2026-10-05 무료 학습 회원 셀프 가입(S1, 공개 화면). 이미 유효한 세션이 있으면 /login과 같은 규칙으로
 * 그 계정의 목적지로 보낸다(프로필 없는 셀프 가입 대기자는 완료 화면으로).
 */
export default async function StudentSignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    const pending = pendingFreeSignupDestination(user, !!profile);
    if (pending) redirect(pending);
    if (profile) redirect(await resolveAccountDestination(supabase, profile.role));
    // 프로필도 표식도 없는 세션: 폼은 그대로 보여주되 세션은 정리한다(fail-closed).
    await supabase.auth.signOut();
  }

  return (
    <main className="min-h-screen bg-grey-100 flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-[420px] rounded-[14px] bg-white p-11 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="text-center font-extrabold text-lg tracking-[0.02em] text-ink mb-1.5">
          ALTON <span className="text-red">EDUCATION</span>
        </div>
        <h1 className="text-center text-[21px] font-extrabold text-ink mb-2">Free Student Sign-Up</h1>
        <p className="text-center text-[13.5px] text-grey-500 mb-8 leading-[1.6]">
          Free SAT practice tests, error logs, and vocab lists.
          <br />
          Students must be 13 or older and sign up themselves.
        </p>

        <SignupForm initialError={error} />

        <p className="text-center text-[13px] text-grey-500 mt-[22px] leading-[1.7]">
          Already have an account?{" "}
          <a href="/login" className="text-red font-bold">
            Log in
          </a>
          <br />
          Under 13, or exploring tutoring with a parent?{" "}
          <Link href="/#consult" className="text-red font-bold">
            Request a consultation
          </Link>
        </p>
      </div>
    </main>
  );
}
