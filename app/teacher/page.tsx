import { requireUser } from "@/lib/auth";
import { logout } from "@/app/login/actions";

export default async function TeacherHomePage() {
  const { profile } = await requireUser();

  return (
    <main className="min-h-screen bg-grey-100 flex items-center justify-center px-5">
      <div className="text-center">
        <p className="text-[13px] text-grey-500 mb-2">선생님 포털</p>
        <h1 className="text-2xl font-extrabold text-ink mb-1">
          {profile?.name ?? "선생님"}님, 환영합니다
        </h1>
        <p className="text-[14px] text-grey-500 mb-6">
          이 화면은 아직 준비 중입니다 (040-teacher-shell 티켓에서 구현).
        </p>
        <form action={logout}>
          <button className="text-[13px] font-bold text-red">로그아웃</button>
        </form>
      </div>
    </main>
  );
}
