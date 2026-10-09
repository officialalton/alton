"use client";

import Link from "next/link";

export default function SessionError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-base font-semibold">Couldn&apos;t load the lesson screen.</p>
      <p className="text-sm text-gray-500">Please try again in a moment. If this keeps happening, go back to your schedule and reopen the lesson.</p>
      <div className="flex gap-2">
        <button type="button" onClick={reset} className="rounded border px-3 py-1.5 text-sm">Try again</button>
        <Link href="/" className="rounded border px-3 py-1.5 text-sm">Back to schedule</Link>
      </div>
    </div>
  );
}
