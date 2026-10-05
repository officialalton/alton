// 2026-10-05 무료 회원 S4 — 관심 등록/보호자 초대 상태 머신(순수 모듈, 클라이언트·서버 공용, DB 없음).
// 서버 액션(tutoring-actions.ts)과 화면(TutoringInterestPanel.tsx)이 같은 타입·문구를 쓴다.
// 오너 결정(2026-10-05): 학생·보호자 대면 문구는 영어.

export type InterestStatus = "registered" | "invite_sent" | "parent_linked" | "consultation_requested" | "booked";

export type GuardianInviteRow = {
  id: string;
  email: string;
  status: "pending" | "accepted" | "manual_review";
  expiresAt: string;
  lastSentAt: string;
  acceptedAt: string | null;
  manualReviewReason: string | null;
};

export type TutoringInterestState =
  | { kind: "tutoring_member"; invites: GuardianInviteRow[] }
  | { kind: "none"; invites: GuardianInviteRow[] }
  | { kind: "interest"; status: InterestStatus; invites: GuardianInviteRow[] };

export const RESEND_COOLDOWN_MS = 10 * 60 * 1000;
export const INVITE_TTL_DAYS = 7;
export const MAX_OPEN_INVITES = 3;

export function validateGuardianEmail(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const value = (raw ?? "").trim();
  if (!value) return { ok: false, error: "Enter your parent's email address." };
  if (value.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return { ok: false, error: "That doesn't look like a valid email address." };
  return { ok: true, value };
}

/** 재발송 가능 시각까지 남은 ms(0이면 가능). */
export function resendRemainingMs(lastSentAtIso: string, now: number = Date.now()): number {
  const last = Date.parse(lastSentAtIso);
  if (Number.isNaN(last)) return 0;
  return Math.max(0, last + RESEND_COOLDOWN_MS - now);
}

export function isInviteExpired(expiresAtIso: string, now: number = Date.now()): boolean {
  const t = Date.parse(expiresAtIso);
  return !Number.isNaN(t) && t <= now;
}

/** 화면 CTA 문구(홈 카드·결과 화면·과외 페이지가 공유). */
export function ctaLabelFor(state: TutoringInterestState): { title: string; body: string; button: string } {
  if (state.kind === "tutoring_member") {
    return { title: "1:1 Tutoring", body: "You're already set up with Alton tutoring. Talk to your consultant for anything you need.", button: "Open consultant tab" };
  }
  if (state.kind === "none" || state.status === "registered") {
    return {
      title: "Talk with a tutor",
      body: "Want help turning your practice results into a plan? Invite your parent so we can set up a free consultation.",
      button: state.kind === "none" ? "I'm interested" : "Invite my parent",
    };
  }
  switch (state.status) {
    case "invite_sent":
      return { title: "Invitation sent", body: "We emailed your parent. Once they connect, we'll schedule a free consultation.", button: "View status" };
    case "parent_linked":
      return { title: "Parent connected", body: "Your parent is connected. We've asked them to book a consultation from the parent portal.", button: "View status" };
    case "consultation_requested":
      return { title: "Consultation requested", body: "Your parent is connected and can pick a consultation time from their email or parent portal.", button: "View status" };
    case "booked":
      return { title: "Consultation booked", body: "Your consultation is scheduled. Keep practicing in the meantime!", button: "View status" };
  }
}

/** RPC 예외 코드 → 영어 안내. 알 수 없는 메시지는 일반 문구(내부 문구 노출 방지). */
export function mapGuardianLinkError(message: string): string {
  const code = message.trim();
  const table: Record<string, string> = {
    own_email: "Please enter your parent's email, not your own.",
    invalid_email: "That doesn't look like a valid email address.",
    too_many_open_invites: `You can have up to ${MAX_OPEN_INVITES} open invitations. Cancel one to invite another address.`,
    resend_cooldown: "Please wait 10 minutes before resending.",
    resend_daily_limit: "You've reached today's resend limit (3). Try again tomorrow.",
    expired: "This invitation has expired. Send a new one.",
    not_pending: "This invitation is no longer active.",
    not_found: "Invitation not found.",
    free_member_only: "This feature is for free study members.",
    login_required: "Please sign in again.",
    no_open_interest: "There's nothing to cancel.",
    already_in_consultation: "A consultation is already in progress for your account.",
  };
  for (const key of Object.keys(table)) {
    if (code === key || code.includes(key)) return table[key];
  }
  return "Something went wrong. Please try again.";
}
