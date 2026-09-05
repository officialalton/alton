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
      <h1 className="text-[16px] font-extrabold text-ink mb-2">화면을 불러오는 중 문제가 발생했습니다</h1>
      <p className="text-[13px] text-grey-500 mb-1">
        일시적인 오류일 수 있습니다. 아래 버튼으로 다시 시도해보세요.
      </p>
      {error.digest && (
        <p className="text-[11px] text-grey-300 mb-4 font-mono">참조 코드: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="text-[13px] font-bold text-white bg-ink rounded-lg px-4 py-2"
      >
        다시 시도
      </button>
    </div>
  );
}
