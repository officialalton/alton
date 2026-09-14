import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { logout } from "@/app/login/actions";

/**
 * R2 §5.7 + 정책 확인 1: pending 계정(관리자 승인 전 온보딩 상태)은 일반
 * 포털에 들어가지 않고 이 화면을 본다. requireUser()를 쓰지 않는다 —
 * requireUser()는 pending 계정을 이 페이지로 리다이렉트하므로, 여기서 또
 * requireUser()를 부르면 무한 리다이렉트가 된다.
 */
export default async function AccountPendingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-grey-100 flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-[420px] rounded-[14px] bg-white p-11 shadow-[0_1px_3px_rgba(0,0,0,0.06)] text-center">
        <div className="font-extrabold text-lg tracking-[0.02em] text-ink mb-1.5">
          ALTON <span className="text-red">EDUCATION</span>
        </div>
        <h1 className="text-[21px] font-extrabold text-ink mb-3">
          체험 배정 대기 중입니다
        </h1>
        <p className="text-[13.5px] text-grey-500 mb-8 leading-[1.6]">
          관리자의 별도 승인 절차는 없습니다 — 담당 과목·선생님 배정이
          완료되면 자동으로 다음 단계로 진행되며, 완료 즉시 별도 안내를
          드립니다.
        </p>
        <form action={logout}>
          <button
            type="submit"
            className="block w-full text-center bg-grey-200 text-ink font-bold text-[15px] py-3.5 rounded-lg hover:bg-grey-300"
          >
            로그아웃
          </button>
        </form>
      </div>
    </main>
  );
}
