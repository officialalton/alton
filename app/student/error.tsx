"use client";

// 라우트 레벨 에러 바운더리 — app/admin/error.tsx와 동일한 이유로 추가한다.
export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-[560px] px-8 py-16 mx-auto text-center">
      <h1 className="text-[16px] font-extrabold text-ink mb-2">Something went wrong while loading this page</h1>
      <p className="text-[13px] text-grey-500 mb-1">
        This may be a temporary error. Please try again.
      </p>
      {error.digest && (
        <p className="text-[11px] text-grey-300 mb-4 font-mono">Reference code: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="text-[13px] font-bold text-white bg-ink rounded-lg px-4 py-2"
      >
        Try again
      </button>
    </div>
  );
}
