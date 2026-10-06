"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { revokeLearningSummarySharingAction } from "./free-member-consult-actions";

// 2026-10-05 무료 회원 S5 — 보호자가 연결 수락 때 동의한 "학습 요약 공유"를 언제든 철회한다(문구는 영어, 오너 결정).
export default function LearningSummarySharingCard({ items }: { items: { studentId: string; name: string | null }[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (items.length === 0) return null;

  return (
    <div className="mx-5 mt-5 space-y-3" data-testid="learning-summary-sharing">
      {items.map((c) => (
        <div key={c.studentId} className="rounded-xl border border-brand-border bg-white p-4">
          <p className="text-[13.5px] font-bold text-ink mb-1">Learning summary sharing{c.name ? ` — ${c.name}` : ""}</p>
          <p className="text-[12.5px] text-grey-500 mb-3">
            Your admissions consultant can see a short summary of {c.name ?? "your child"}&apos;s practice activity (counts and weakest areas only — never answers or notes). You can stop sharing at any time.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const r = await revokeLearningSummarySharingAction(c.studentId);
                if (r.ok) router.refresh();
                else setError(r.error);
              });
            }}
            className="px-4 py-2.5 rounded-lg border border-brand-border text-ink text-[13px] font-bold disabled:opacity-60"
          >
            {pending ? "Stopping…" : "Stop sharing"}
          </button>
        </div>
      ))}
      {error && (
        <p role="alert" className="text-[12.5px] text-brand-red">
          {error}
        </p>
      )}
    </div>
  );
}
