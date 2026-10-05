"use client";

import { useEffect, useState, useTransition } from "react";
import { trackEvent } from "@/lib/analytics/track";
import {
  cancelConsultInterestAction,
  createGuardianLinkInviteAction,
  loadMyTutoringInterestStateAction,
  registerConsultInterestAction,
  resendGuardianLinkInviteAction,
  revokeGuardianLinkInviteAction,
} from "../tutoring-actions";
import { ctaLabelFor, isInviteExpired, resendRemainingMs, validateGuardianEmail, type GuardianInviteRow, type TutoringInterestState } from "../tutoring-state";

// 2026-10-05 무료 회원 S4 — 관심 등록 CTA, 보호자 이메일 폼, 초대 상태(보냄/수락/검토중/만료), 재발송(쿨다운 표시),
// 취소, 이메일 수정(=취소 후 재초대). 모든 쓰기는 서버 액션 → RPC. 문구는 영어(오너 결정).

export default function TutoringInterestPanel({ initialState, entryPoint }: { initialState: TutoringInterestState; entryPoint: string }) {
  const [state, setState] = useState<TutoringInterestState>(initialState);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  async function refresh() {
    setState(await loadMyTutoringInterestStateAction());
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string } | undefined>, onOk?: () => void) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const r = await fn();
      if (r && !r.ok) {
        setError(r.error ?? "Something went wrong.");
        return;
      }
      onOk?.();
      await refresh();
    });
  }

  const cta = ctaLabelFor(state);
  const pendingInvites = state.invites.filter((i) => i.status === "pending" && !isInviteExpired(i.expiresAt, now));
  const expiredInvites = state.invites.filter((i) => i.status === "pending" && isInviteExpired(i.expiresAt, now));
  const accepted = state.invites.find((i) => i.status === "accepted");
  const review = state.invites.find((i) => i.status === "manual_review");
  const showForm =
    state.kind === "none" || (state.kind === "interest" && (state.status === "registered" || state.status === "invite_sent"));

  return (
    <div className="rounded-xl bg-white border border-brand-border p-6" data-testid="tutoring-interest-panel">
      <p className="text-[13px] font-bold text-navy mb-1">{cta.title}</p>
      <p className="text-[13px] text-grey-500 leading-[1.7] mb-4">{cta.body}</p>

      {state.kind === "none" && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() => registerConsultInterestAction(entryPoint), () => trackEvent("consult_interest_registered", { entry_point: entryPoint }))
          }
          className="px-4 py-2.5 rounded-lg bg-brand-red text-white text-[13px] font-bold disabled:opacity-60"
        >
          {pending ? "Saving…" : "I'm interested"}
        </button>
      )}

      {showForm && state.kind !== "none" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = validateGuardianEmail(email);
            if (!v.ok) {
              setError(v.error);
              return;
            }
            run(
              async () => {
                const r = await createGuardianLinkInviteAction(v.value);
                if (r.ok) {
                  setEmail("");
                  setNotice(
                    r.value.outcome === "already_linked"
                      ? "Your parent is already connected. We've emailed them to book a consultation."
                      : "Invitation sent. Ask your parent to check their inbox.",
                  );
                }
                return r;
              },
              () => trackEvent("guardian_invite_sent", { entry_point: entryPoint }),
            );
          }}
          className="mb-4"
        >
          <label htmlFor="guardian-email" className="block text-[12px] font-bold text-navy mb-1">
            Parent or guardian email
          </label>
          <div className="flex gap-2">
            <input
              id="guardian-email"
              type="email"
              inputMode="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="parent@example.com"
              className="flex-1 min-w-0 rounded-lg border border-brand-border px-3 py-2.5 text-[13px]"
              disabled={pending}
            />
            <button type="submit" disabled={pending} className="px-4 py-2.5 rounded-lg bg-brand-red text-white text-[13px] font-bold disabled:opacity-60">
              {pending ? "Sending…" : "Send invite"}
            </button>
          </div>
          <p className="text-[11.5px] text-grey-500 mt-1.5">
            We&apos;ll email your parent a link that expires in 7 days. Don&apos;t use your own email address.
          </p>
        </form>
      )}

      {error && (
        <p role="alert" className="text-[12.5px] text-brand-red mb-3">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-[12.5px] text-green mb-3">
          {notice}
        </p>
      )}

      {accepted && (
        <div className="rounded-lg bg-cream border border-brand-border p-3 mb-3 text-[12.5px]" data-testid="invite-accepted">
          <span className="font-bold text-navy">Connected:</span> {accepted.email}
          {state.kind === "interest" && state.status === "booked" ? " — consultation booked." : " — waiting for your parent to pick a consultation time."}
        </div>
      )}

      {review && (
        <div className="rounded-lg bg-cream border border-brand-border p-3 mb-3 text-[12.5px]" data-testid="invite-review">
          <span className="font-bold text-navy">Under review:</span> {review.email}. Our team needs to check this connection manually — we&apos;ll
          follow up by email.
          <button type="button" disabled={pending} onClick={() => run(() => revokeGuardianLinkInviteAction(review.id))} className="ml-2 underline">
            Cancel
          </button>
        </div>
      )}

      {pendingInvites.length > 0 && (
        <ul className="divide-y divide-brand-border mb-3" data-testid="invite-list">
          {pendingInvites.map((inv) => (
            <InviteRow key={inv.id} invite={inv} now={now} disabled={pending} onResend={() => run(() => resendGuardianLinkInviteAction(inv.id), () => setNotice("Invitation resent."))} onCancel={() => run(() => revokeGuardianLinkInviteAction(inv.id))} />
          ))}
        </ul>
      )}

      {expiredInvites.length > 0 && (
        <ul className="divide-y divide-brand-border mb-3" data-testid="invite-expired-list">
          {expiredInvites.map((inv) => (
            <li key={inv.id} className="py-2 flex items-center justify-between gap-2 text-[12.5px]">
              <span>
                <span className="font-bold text-grey-500">Expired:</span> {inv.email}
              </span>
              <button type="button" disabled={pending} onClick={() => run(() => revokeGuardianLinkInviteAction(inv.id))} className="underline text-grey-500">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {showForm && state.kind !== "none" && (
        <button type="button" disabled={pending} onClick={() => run(() => cancelConsultInterestAction())} className="text-[12px] text-grey-500 underline">
          I&apos;m no longer interested
        </button>
      )}
    </div>
  );
}

function InviteRow({ invite, now, disabled, onResend, onCancel }: { invite: GuardianInviteRow; now: number; disabled: boolean; onResend: () => void; onCancel: () => void }) {
  const remaining = resendRemainingMs(invite.lastSentAt, now);
  const minutes = Math.ceil(remaining / 60_000);
  return (
    <li className="py-2 flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
      <span>
        <span className="font-bold text-navy">Sent:</span> {invite.email}
      </span>
      <span className="flex items-center gap-3">
        <button type="button" disabled={disabled || remaining > 0} onClick={onResend} className="underline disabled:no-underline disabled:text-grey-500" title={remaining > 0 ? `Resend available in ${minutes} min` : "Resend"}>
          {remaining > 0 ? `Resend in ${minutes} min` : "Resend"}
        </button>
        <button type="button" disabled={disabled} onClick={onCancel} className="underline text-grey-500">
          Cancel / change email
        </button>
      </span>
    </li>
  );
}
