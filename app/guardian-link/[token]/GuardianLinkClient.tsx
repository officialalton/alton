"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { trackEvent } from "@/lib/analytics/track";
import { acceptGuardianLinkAction, createGuardianAccountFromLinkAction, rememberGuardianLinkReturnAction, type ClaimResult } from "./actions";

// 2026-10-05 무료 회원 S4 — 상태별 화면: 무효/만료/철회/대체/검토중, 계정 없음(가입), 계정 있음(로그인), 로그인됨(동의+수락).
// 공유 항목 목록(§3.3 ④)은 SHARED_ITEMS 상수 하나로 고정한다(테스트가 스냅샷).

export const SHARED_ITEMS = [
  "Practice-test attempts, scores, and section breakdowns",
  "Weak areas by domain and skill (aggregated)",
  "Saved practice problems and vocabulary list size",
  "Basic profile: name, grade, and school (if provided)",
] as const;

export const NOT_SHARED_ITEMS = ["Your student's private notes, highlights, and annotations", "Individual answer responses"] as const;

export default function GuardianLinkClient({ token, claim }: { token: string; claim: ClaimResult }) {
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [review, setReview] = useState<string | null>(null);

  const student = claim.studentFirstName || "Your student";

  if (claim.status === "invalid") return <Card title="This link isn't valid">Check that you opened the full link from the email, or ask {student} to send a new invitation.</Card>;
  if (claim.status === "expired") return <Card title="This invitation has expired">Invitations are valid for 7 days. Ask {student} to send a new one from their Alton account.</Card>;
  if (claim.status === "revoked") return <Card title="This invitation was cancelled">{student} cancelled this invitation. If that was a mistake, ask them to send a new one.</Card>;
  if (claim.status === "superseded") return <Card title="A newer invitation was sent">Please open the most recent email from Alton Education — this older link no longer works.</Card>;
  if (claim.status === "manual_review" || review) {
    return (
      <Card title="We need to review this connection">
        Thanks for confirming. Our team needs to check this connection manually (for example, when a student is already linked to another family). We&apos;ll follow up at{" "}
        <strong>{claim.inviteEmail}</strong> shortly.
      </Card>
    );
  }
  if (claim.status === "accepted") {
    return (
      <Card title="Already connected">
        This invitation was already accepted.{" "}
        {claim.viewer.loggedIn ? "Sign in with the account that accepted it to continue." : "Sign in to continue to your parent portal."}
        <div className="mt-4">
          <button type="button" onClick={() => startTransition(() => rememberGuardianLinkReturnAction(token))} className="px-4 py-2.5 rounded-lg bg-red text-white text-[13px] font-bold">
            Sign in
          </button>
        </div>
      </Card>
    );
  }

  // pending
  const header = (
    <>
      <p className="text-[12px] font-bold text-red mb-1">Parent connection</p>
      <h1 className="text-[20px] font-extrabold text-ink mb-2">
        {student}
        {claim.studentGrade ? ` (Grade ${claim.studentGrade})` : ""} invited you to connect
      </h1>
      <p className="text-[13px] text-grey-600 leading-[1.7] mb-4">
        {student} has been using Alton&apos;s free SAT practice and would like to talk with a tutor. Connecting lets you see their results and book a free
        consultation. This invitation was sent to <strong>{claim.inviteEmail}</strong>.
      </p>
    </>
  );

  if (!claim.viewer.loggedIn) {
    if (claim.accountExists) {
      return (
        <Card>
          {header}
          <p className="text-[13px] text-ink mb-3">You already have an Alton account with this email. Sign in to review and accept.</p>
          <button type="button" disabled={pending} onClick={() => startTransition(() => rememberGuardianLinkReturnAction(token))} className="px-4 py-2.5 rounded-lg bg-red text-white text-[13px] font-bold disabled:opacity-60">
            Sign in to continue
          </button>
        </Card>
      );
    }
    return (
      <Card>
        {header}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              const r = await createGuardianAccountFromLinkAction(token, name);
              if (r && !r.ok) setError(r.error);
            });
          }}
        >
          <label htmlFor="guardian-name" className="block text-[12px] font-bold text-ink mb-1">
            Your name
          </label>
          <input id="guardian-name" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-grey-200 px-3 py-2.5 text-[13px] mb-3" placeholder="Full name" disabled={pending} />
          <p className="text-[12px] text-grey-600 mb-3">
            We&apos;ll create a parent account for <strong>{claim.inviteEmail}</strong> and ask you to set a password. You&apos;ll review what&apos;s shared before anything is connected.
          </p>
          {error && (
            <p role="alert" className="text-[12.5px] text-red mb-3">
              {error}
            </p>
          )}
          <button type="submit" disabled={pending} className="px-4 py-2.5 rounded-lg bg-red text-white text-[13px] font-bold disabled:opacity-60">
            {pending ? "Creating…" : "Create my account"}
          </button>
        </form>
      </Card>
    );
  }

  if (!claim.viewer.emailMatches || !claim.viewer.isParent) {
    return (
      <Card>
        {header}
        <p role="alert" className="text-[13px] text-red mb-3">
          {!claim.viewer.isParent
            ? "You're signed in with an account that isn't a parent account."
            : "You're signed in with a different email than the one this invitation was sent to."}{" "}
          Sign out and use <strong>{claim.inviteEmail}</strong>, or ask {student} to re-send the invitation to your current email.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      {header}
      <div className="rounded-lg bg-grey-50 border border-grey-200 p-4 mb-4">
        <p className="text-[12.5px] font-bold text-ink mb-2">What will be shared with you and your admissions consultant</p>
        <ul className="text-[12.5px] text-grey-700 list-disc pl-5 leading-[1.7]" data-testid="shared-items">
          {SHARED_ITEMS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <p className="text-[12.5px] font-bold text-ink mt-3 mb-1">Not shared</p>
        <ul className="text-[12.5px] text-grey-700 list-disc pl-5 leading-[1.7]" data-testid="not-shared-items">
          {NOT_SHARED_ITEMS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <p className="text-[12px] text-grey-600 mt-3">Connecting does not sign you up for paid lessons. You can revoke summary sharing from your parent portal at any time.</p>
      </div>
      <label className="flex items-start gap-2 text-[13px] text-ink mb-4">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
        <span>I&apos;m {student}&apos;s parent or guardian and I agree to share the information above.</span>
      </label>
      {error && (
        <p role="alert" className="text-[12.5px] text-red mb-3">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={pending || !consent}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const r = await acceptGuardianLinkAction(token, consent);
            if (!r.ok) {
              setError(r.error);
              return;
            }
            trackEvent("guardian_invite_accepted", { outcome: r.outcome });
            if (r.outcome === "manual_review") {
              setReview(r.reason ?? "review");
              return;
            }
            router.replace(r.schedulingToken ? `/schedule/${r.schedulingToken}` : "/parent?tab=consult");
          });
        }}
        className="px-4 py-2.5 rounded-lg bg-red text-white text-[13px] font-bold disabled:opacity-60"
      >
        {pending ? "Connecting…" : "Connect and continue"}
      </button>
    </Card>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.06)] text-[13.5px] text-grey-700 leading-[1.7]">
      {title && <h1 className="text-[18px] font-extrabold text-ink mb-2">{title}</h1>}
      {children}
    </div>
  );
}
