"use client";

// 포털 라우트 에러 바운더리 공통 화면(관리자 외 전부 영어 — docs/POLICY-DECISIONS.md).
// 'Back to sign in'은 세션이 끝난 경우의 탈출구다(로그인 상태면 /login이 역할 홈으로 보낸다).
export default function PortalErrorView({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div role="alert" className="max-w-[560px] px-8 py-16 mx-auto text-center">
      <h1 className="text-[16px] font-extrabold text-ink mb-2">Something went wrong while loading this page</h1>
      <p className="text-[13px] text-grey-500 mb-1">
        This may be a temporary error, or your session may have ended. Please try again.
      </p>
      {error.digest && (
        <p className="text-[11px] text-grey-300 mb-4 font-mono">Reference code: {error.digest}</p>
      )}
      <div className="mt-4 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="text-[13px] font-bold text-white bg-ink rounded-lg px-4 py-2"
        >
          Try again
        </button>
        {/* 전체 이동(<a>) — 깨진 클라이언트 상태를 버리고 로그인 화면을 새로 받는다. */}
        <a href="/login" className="text-[13px] font-bold text-ink border border-grey-300 rounded-lg px-4 py-2">
          Back to sign in
        </a>
      </div>
    </div>
  );
}
