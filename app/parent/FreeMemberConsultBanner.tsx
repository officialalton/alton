"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FreeMemberConsult } from "./free-member-data";
import { reissueFreeMemberSchedulingLinkAction } from "./free-member-consult-actions";

// 2026-10-05 무료 회원 S4 — 보호자 포털 상담 탭 배너(브리프 §3.3 "중단 복귀"): 미예약이면 "Pick a time"(재진입/재발급),
// 미배정이면 "담당자 배정 후 안내" 상태, 예약됨이면 확정 시각. 문구는 영어(오너 결정).
export default function FreeMemberConsultBanner({ consults }: { consults: FreeMemberConsult[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const open = consults.filter((c) => c.status === "requested");
  if (open.length === 0) return null;

  return (
    <div className="mx-5 mt-5 space-y-3" data-testid="free-member-consult-banner">
      {open.map((c) => (
        <div key={c.consultationId} className="rounded-xl border border-brand-border bg-white p-4">
          <p className="text-[12px] font-bold text-brand-red mb-1">Free consultation{c.childName ? ` for ${c.childName}` : ""}</p>
          {c.assigned ? (
            <>
              <p className="text-[13.5px] font-bold text-ink mb-1">Pick a consultation time</p>
              <p className="text-[12.5px] text-grey-500 mb-3">Your admissions consultant is assigned. Choose a time that works for you — it only takes a minute.</p>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setError(null);
                  startTransition(async () => {
                    const r = await reissueFreeMemberSchedulingLinkAction(c.consultationId);
                    if (r.ok) router.push(r.path);
                    else setError(r.error);
                  });
                }}
                className="px-4 py-2.5 rounded-lg bg-brand-red text-white text-[13px] font-bold disabled:opacity-60"
              >
                {pending ? "Opening…" : c.hasValidLink ? "Choose a time" : "Get a new scheduling link"}
              </button>
            </>
          ) : (
            <>
              <p className="text-[13.5px] font-bold text-ink mb-1">We&apos;re assigning your consultant</p>
              <p className="text-[12.5px] text-grey-500">You&apos;re connected. We&apos;ll email you a scheduling link as soon as an admissions consultant is assigned.</p>
            </>
          )}
          {error && (
            <p role="alert" className="text-[12.5px] text-brand-red mt-2">
              {error}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
