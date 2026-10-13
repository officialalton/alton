"use client";

export default function RootError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F8F5EF] px-5">
      <div className="max-w-[420px] text-center flex flex-col gap-4">
        <h1 className="m-0 text-[28px] font-bold text-[#142240]">Something went wrong</h1>
        <p className="m-0 text-[15px] leading-[1.7] text-[#4F5A6B]">Please try again. If the problem continues, email official@alton.education.</p>
        <div className="flex items-center justify-center gap-3">
          <button type="button" onClick={reset} className="h-11 px-5 rounded-xl bg-[#C8102E] text-white text-[14px] font-semibold">Try again</button>
          <a href="/login" className="h-11 px-5 rounded-xl border border-[#142240] text-[#142240] text-[14px] font-semibold flex items-center">Back to sign in</a>
        </div>
      </div>
    </main>
  );
}
