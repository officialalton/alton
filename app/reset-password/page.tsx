import { requestReset } from "./actions";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  return (
    <main className="min-h-screen bg-grey-100 flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-[420px] rounded-[14px] bg-white p-11 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="text-center font-extrabold text-lg tracking-[0.02em] text-ink mb-1.5">
          ALTON <span className="text-red">EDUCATION</span>
        </div>
        <h1 className="text-center text-[21px] font-extrabold text-ink mb-2">
          Reset your password
        </h1>
        <p className="text-center text-[13.5px] text-grey-500 mb-8 leading-[1.6]">
          Enter the email on your account
          <br />
          and we&apos;ll send you a reset link.
        </p>

        {sent ? (
          <p className="text-center text-[14px] text-ink mb-6 leading-[1.6]">
            We sent a reset link to that email.
            <br />
            Please check your inbox.
          </p>
        ) : (
          <form action={requestReset}>
            <div className="mb-4">
              <label htmlFor="email" className="block text-[13px] font-bold text-ink mb-1.5">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="you@example.com"
                className="w-full px-3.5 py-3 border-[1.5px] border-grey-200 rounded-lg text-[14.5px] text-ink focus:outline-none focus:border-ink"
              />
            </div>
            <button
              type="submit"
              className="block w-full text-center bg-red text-white font-bold text-[15px] py-3.5 rounded-lg hover:bg-[#a80e26]"
            >
              Send reset link
            </button>
          </form>
        )}

        <p className="text-center text-[13px] text-grey-500 mt-[22px]">
          <a href="/login" className="text-red font-bold">
            ← Back to login
          </a>
        </p>
      </div>
    </main>
  );
}
