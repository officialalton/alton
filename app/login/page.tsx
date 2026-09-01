import { login } from "./actions";
import { signInWithGoogleForTeacher } from "./teacher-google-actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

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
