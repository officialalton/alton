"use client";

// 라우트 레벨 에러 바운더리(Next.js 관례). 지금까지 /admin은 이게 없어서 어느
// 한 패널의 렌더링 에러(Server Components render 실패 시 production에서는
// 원인 메시지가 가려지고 "Minified React error #441"류의 일반 문구만 남는다)가
// 화면 전체를 되돌릴 수 없는 상태로 만들었다 — 실사용 중 "예약 취소" 같은 평범한
// 액션 뒤에 이 문구가 뜨면 브라우저를 새로고침하는 것 말고는 복구 방법이 없었다.
// 이 파일이 있으면 Next.js가 이 세그먼트 아래 렌더링 에러를 여기서 잡아 "다시
// 시도" 버튼으로 즉시 리셋할 수 있게 해준다(전체 새로고침 불필요).
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-[560px] px-8 py-16 mx-auto text-center">
      <h1 className="text-[16px] font-extrabold text-ink mb-2">Something went wrong while loading this screen</h1>
      <p className="text-[13px] text-grey-500 mb-1">
        This may be a temporary problem. Please try again.
      </p>
      {error.digest && (
        <p className="text-[11px] text-grey-300 mb-4 font-mono">Reference: {error.digest}</p>
      )}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="text-[13px] font-bold text-white bg-ink rounded-lg px-4 py-2"
        >
          Try again
        </button>
        {/* 세션이 끝난 경우의 탈출구 — 오류 화면은 관리자 포털도 영어(오너 2026-10-13). */}
        <a href="/login" className="text-[13px] font-bold text-ink border border-grey-300 rounded-lg px-4 py-2">
          Back to sign in
        </a>
      </div>
    </div>
  );
}
