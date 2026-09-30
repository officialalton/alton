"use client";

import Link from "next/link";

export default function SessionError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-base font-semibold">수업 화면을 불러오지 못했습니다.</p>
      <p className="text-sm text-gray-500">잠시 후 다시 시도해 주세요. 계속되면 일정으로 돌아가 다시 열어 주세요.</p>
      <div className="flex gap-2">
        <button type="button" onClick={reset} className="rounded border px-3 py-1.5 text-sm">다시 시도</button>
        <Link href="/" className="rounded border px-3 py-1.5 text-sm">일정으로 돌아가기</Link>
      </div>
    </div>
  );
}
