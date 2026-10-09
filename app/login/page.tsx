import { redirect } from "next/navigation";
import { login } from "./actions";
import { signInWithGoogleForStaff } from "./staff-google-actions";
import { createClient } from "@/utils/supabase/server";
import { resolveAccountDestination } from "@/lib/auth";
import { pendingFreeSignupDestination } from "@/lib/free-member-signup";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { error, notice } = await searchParams;

  // 2026-09-10(P0-3) — /login은 middleware matcher(포털 경로만 보호) 밖이라
  // 세션 유무와 무관하게 항상 로그인 폼을 그렸다. 그래서 로그인 직전 방문했던
  // /login 히스토리 항목으로 브라우저 뒤로가기를 누르면, 세션이 여전히
  // 유효한데도 다시 로그인 화면이 렌더링됐다(역할·계정 상태 무관하게 재현 —
  // middleware/캐시/OAuth 문제가 아니라 이 페이지 자체에 "이미 로그인돼
  // 있으면 돌려보낸다"는 분기가 없었던 것). login/actions.ts가 로그인 성공
  // 직후 이미 쓰고 있는 resolveAccountDestination()을 그대로 재사용해,
  // 유효한 세션이면 그 계정 상태에 맞는 곳(역할 홈/온보딩 게이트)으로 보내고,
  // 세션이 없거나 만료·로그아웃 상태일 때만 이 폼을 그대로 보여준다.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    // 2026-10-05 무료 학습 회원(S1) — 셀프 가입 대기자(프로필 없음+표식)만 완료 화면으로.
    const pending = pendingFreeSignupDestination(user, !!profile);
    if (pending) redirect(pending);
    redirect(await resolveAccountDestination(supabase, profile?.role));
  }

  return (
    <main className="min-h-screen bg-grey-100 flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-[420px] rounded-[14px] bg-white p-11 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="text-center font-extrabold text-lg tracking-[0.02em] text-ink mb-1.5">
          ALTON <span className="text-red">EDUCATION</span>
        </div>
        <h1 className="text-center text-[21px] font-extrabold text-ink mb-2">
          Log in
        </h1>
        <p className="text-center text-[13.5px] text-grey-500 mb-8 leading-[1.6]">
          One login for parents, students, tutors, and staff.
          <br />
          After signing in, you&apos;ll be taken to the right place for your role.
        </p>

        <form action={login}>
          <div className="mb-4">
            <label htmlFor="email" className="block text-[13px] font-bold text-ink mb-1.5">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full px-3.5 py-3 border-[1.5px] border-grey-200 rounded-lg text-[14.5px] text-ink focus:outline-none focus:border-ink"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="password" className="block text-[13px] font-bold text-ink mb-1.5">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full px-3.5 py-3 border-[1.5px] border-grey-200 rounded-lg text-[14.5px] text-ink focus:outline-none focus:border-ink"
            />
          </div>

          {error && (
            <p className="text-[13px] text-red mb-4">{error}</p>
          )}
          {!error && notice && (
            <p className="text-[13px] text-ink bg-grey-100 rounded-lg px-3 py-2 mb-4">{notice}</p>
          )}

          <div className="flex justify-between items-center mb-5 text-[13px]">
            <span />
            <a href="/reset-password" className="text-grey-500 font-semibold">
              Forgot your password?
            </a>
          </div>

          <button
            type="submit"
            className="block w-full text-center bg-red text-white font-bold text-[15px] py-3.5 rounded-lg hover:bg-[#a80e26]"
          >
            Log in
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-grey-200">
          <p className="text-center text-[12.5px] text-grey-400 mb-3">
            Tutors, staff, or consultants with an ALTON EDUCATION Google Workspace account?
          </p>
          <form action={signInWithGoogleForStaff}>
            <button
              type="submit"
              className="block w-full text-center border-[1.5px] border-grey-200 text-ink font-bold text-[14px] py-3 rounded-lg hover:bg-grey-100"
            >
              Staff - Google Login
            </button>
          </form>
        </div>

        <p className="text-center text-[13px] text-grey-500 mt-[22px] leading-[1.7]">
          Parent and student accounts are created by invitation after the consultation and enrollment process.
          <br />
          Students can{" "}
          <a href="/signup/student" className="text-red font-bold">
            join as a free member
          </a>{" "}
          and start taking practice tests right away.
          <br />
          Interested in tutoring with us?{" "}
          <a
            href="https://forms.gle/LU8dPY5tkwBMNX6S9"
            target="_blank"
            rel="noopener noreferrer"
            className="text-red font-bold"
          >
            Apply →
          </a>
        </p>
      </div>
    </main>
  );
}
