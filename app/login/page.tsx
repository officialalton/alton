import { redirect } from "next/navigation";
import { login } from "./actions";
import { signInWithGoogleForTeacher } from "./teacher-google-actions";
import { signInWithGoogleForAdmin } from "@/app/admin/google-link-actions";
import { createClient } from "@/utils/supabase/server";
import { resolveAccountDestination } from "@/lib/auth";

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
    redirect(await resolveAccountDestination(supabase, profile?.role));
  }

  return (
    <main className="min-h-screen bg-grey-100 flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-[420px] rounded-[14px] bg-white p-11 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="text-center font-extrabold text-lg tracking-[0.02em] text-ink mb-1.5">
          ALTON <span className="text-red">EDUCATION</span>
        </div>
        <h1 className="text-center text-[21px] font-extrabold text-ink mb-2">
          로그인
        </h1>
        <p className="text-center text-[13.5px] text-grey-500 mb-8 leading-[1.6]">
          학부모·학생·선생님·관리자 공용 로그인입니다.
          <br />
          로그인 후 역할에 맞는 화면으로 이동합니다.
        </p>

        <form action={login}>
          <div className="mb-4">
            <label htmlFor="email" className="block text-[13px] font-bold text-ink mb-1.5">
              이메일
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
              비밀번호
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
              비밀번호를 잃어버리셨나요?
            </a>
          </div>

          <button
            type="submit"
            className="block w-full text-center bg-red text-white font-bold text-[15px] py-3.5 rounded-lg hover:bg-[#a80e26]"
          >
            로그인
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-grey-200">
          <p className="text-center text-[12.5px] text-grey-400 mb-3">
            Alton Education Google Workspace 계정을 발급받은 선생님이신가요?
          </p>
          <form action={signInWithGoogleForTeacher}>
            <button
              type="submit"
              className="block w-full text-center border-[1.5px] border-grey-200 text-ink font-bold text-[14px] py-3 rounded-lg hover:bg-grey-100"
            >
              선생님 — Google로 로그인
            </button>
          </form>

          <form action={signInWithGoogleForAdmin} className="mt-2.5">
            <button
              type="submit"
              className="block w-full text-center border-[1.5px] border-grey-200 text-ink font-bold text-[14px] py-3 rounded-lg hover:bg-grey-100"
            >
              관리자 — Google로 로그인
            </button>
          </form>
        </div>

        <p className="text-center text-[13px] text-grey-500 mt-[22px] leading-[1.7]">
          학부모·학생 계정은 상담·계약 절차 이후 초대를 통해 생성됩니다.
          <br />
          선생님으로 지원하고 싶으신가요?{" "}
          <a
            href="https://forms.gle/LU8dPY5tkwBMNX6S9"
            target="_blank"
            rel="noopener noreferrer"
            className="text-red font-bold"
          >
            지원하기 →
          </a>
        </p>
      </div>
    </main>
  );
}
