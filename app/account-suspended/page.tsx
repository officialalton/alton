import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { logout } from "@/app/login/actions";

/**
 * R2 §5.7: suspended 계정 전용 안내 화면. requireUser()를 쓰지 않는다 —
 * requireUser()는 suspended 계정을 이 페이지로 리다이렉트하므로, 여기서
 * 또 requireUser()를 부르면 무한 리다이렉트가 된다. 세션 존재 여부만
 * 가볍게 확인하고, 실제 계정 상태 판정은 requireUser() 쪽에서 이미 끝난
 * 뒤 여기로 왔다고 가정한다(상태가 바뀌었으면 다음 페이지 이동에서
 * requireUser()가 다시 정확한 곳으로 보낸다).
 */
export default async function AccountSuspendedPage() {
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
          계정이 일시정지되었습니다
        </h1>
        <p className="text-[13.5px] text-grey-500 mb-8 leading-[1.6]">
          현재 계정 이용이 일시적으로 제한되어 있습니다.
          <br />
          자세한 사유는 관리자에게 문의해주세요.
          <br />
          관리자가 계정을 다시 활성화하면 별도 절차 없이 로그인할 수 있습니다.
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
