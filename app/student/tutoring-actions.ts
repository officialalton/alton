"use server";

import { requireStudentFeature } from "@/lib/feature-access";
import { currentRequestOrigin } from "@/lib/request-origin";
import { sendGuardianLinkInviteEmail, sendLinkedGuardianBookingNoticeEmail } from "@/lib/guardian-link/emails";
import { mapGuardianLinkError, validateGuardianEmail, type GuardianInviteRow, type TutoringInterestState } from "./tutoring-state";

// 2026-10-05 무료 회원 S4 — "선생님과 이야기하기": 관심 등록·보호자 초대·재발송·취소(브리프 §3.3).
// 모든 상태 전이는 RPC(20262100000004)가 하고, 여기서는 호출 + 메일 발송만 한다. 메일은 lib/email sendEmail
// 한 경로(발송 실패는 사용자에게 돌려주되 초대 행은 남긴다 — 재발송으로 복구).

export type { TutoringInterestState, GuardianInviteRow } from "./tutoring-state";

type ActionResult<T = undefined> = { ok: true; value: T } | { ok: false; error: string };

export async function loadMyTutoringInterestStateAction(): Promise<TutoringInterestState> {
  const { supabase, user, featureAccess } = await requireStudentFeature("tutoring_info");
  const isFreeMember = !featureAccess.includes("class");
  if (!isFreeMember) return { kind: "tutoring_member", invites: [] };

  const [{ data: interest }, { data: invites }] = await Promise.all([
    supabase
      .from("student_consult_interests")
      .select("id, status, created_at")
      .eq("student_id", user.id)
      .not("status", "in", "(cancelled,expired)")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("guardian_link_invites")
      .select("id, email_original, status, expires_at, last_sent_at, token_generation, accepted_at, manual_review_reason")
      .eq("student_id", user.id)
      .in("status", ["pending", "accepted", "manual_review"])
      .order("created_at", { ascending: false }),
  ]);

  const rows: GuardianInviteRow[] = (invites ?? []).map((i) => ({
    id: i.id,
    email: i.email_original,
    status: i.status as GuardianInviteRow["status"],
    expiresAt: i.expires_at,
    lastSentAt: i.last_sent_at,
    acceptedAt: i.accepted_at,
    manualReviewReason: i.manual_review_reason,
  }));

  if (!interest) return { kind: "none", invites: rows };
  return { kind: "interest", status: interest.status as Extract<TutoringInterestState, { kind: "interest" }>["status"], invites: rows };
}

export async function registerConsultInterestAction(entryPoint: string): Promise<ActionResult> {
  const { supabase } = await requireStudentFeature("tutoring_info");
  const { error } = await supabase.rpc("register_consult_interest", { p_entry_point: entryPoint });
  if (error) return { ok: false, error: mapGuardianLinkError(error.message) };
  return { ok: true, value: undefined };
}

export async function cancelConsultInterestAction(): Promise<ActionResult> {
  const { supabase } = await requireStudentFeature("tutoring_info");
  const { error } = await supabase.rpc("cancel_consult_interest");
  if (error) return { ok: false, error: mapGuardianLinkError(error.message) };
  return { ok: true, value: undefined };
}

export type InviteOutcome = "invite_sent" | "already_linked";

export async function createGuardianLinkInviteAction(emailRaw: string): Promise<ActionResult<{ outcome: InviteOutcome }>> {
  const { supabase, user } = await requireStudentFeature("tutoring_info");
  const email = validateGuardianEmail(emailRaw);
  if (!email.ok) return { ok: false, error: email.error };

  const { data, error } = await supabase.rpc("create_guardian_link_invite", { p_email: email.value });
  if (error) return { ok: false, error: mapGuardianLinkError(error.message) };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: false, error: "Something went wrong. Please try again." };

  const origin = await currentRequestOrigin();
  if (row.outcome === "already_linked") {
    if (row.should_notify && row.guardian_email) {
      try {
        await sendLinkedGuardianBookingNoticeEmail({
          to: row.guardian_email,
          guardianName: row.guardian_name ?? null,
          studentFirstName: firstName(row.student_name),
          portalUrl: `${origin}/parent?tab=consult`,
        });
      } catch (e) {
        console.error(JSON.stringify({ type: "linked_guardian_notice_failed", studentId: user.id, error: e instanceof Error ? e.message : String(e) }));
      }
    }
    return { ok: true, value: { outcome: "already_linked" } };
  }

  try {
    await sendGuardianLinkInviteEmail({ to: email.value, studentFirstName: firstName(row.student_name), inviteUrl: `${origin}/guardian-link/${row.raw_token}` });
  } catch (e) {
    console.error(JSON.stringify({ type: "guardian_invite_email_failed", inviteId: row.invite_id, error: e instanceof Error ? e.message : String(e) }));
    return { ok: false, error: "We couldn't send the email right now. Your invitation was saved — use Resend in a few minutes." };
  }
  return { ok: true, value: { outcome: "invite_sent" } };
}

export async function resendGuardianLinkInviteAction(inviteId: string): Promise<ActionResult> {
  const { supabase, user } = await requireStudentFeature("tutoring_info");
  const { data, error } = await supabase.rpc("resend_guardian_link_invite", { p_invite_id: inviteId });
  if (error) return { ok: false, error: mapGuardianLinkError(error.message) };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { ok: false, error: "Something went wrong. Please try again." };

  // 새 행의 이메일·학생 이름은 RLS로 본인 것만 읽힌다.
  const { data: invite } = await supabase.from("guardian_link_invites").select("email_original").eq("id", row.invite_id).single();
  const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single();
  if (!invite) return { ok: false, error: "Something went wrong. Please try again." };
  const origin = await currentRequestOrigin();
  try {
    await sendGuardianLinkInviteEmail({ to: invite.email_original, studentFirstName: firstName(profile?.name), inviteUrl: `${origin}/guardian-link/${row.raw_token}` });
  } catch (e) {
    console.error(JSON.stringify({ type: "guardian_invite_email_failed", inviteId: row.invite_id, error: e instanceof Error ? e.message : String(e) }));
    return { ok: false, error: "We couldn't send the email right now. Please try again in a few minutes." };
  }
  return { ok: true, value: undefined };
}

export async function revokeGuardianLinkInviteAction(inviteId: string): Promise<ActionResult> {
  const { supabase } = await requireStudentFeature("tutoring_info");
  const { error } = await supabase.rpc("revoke_guardian_link_invite", { p_invite_id: inviteId });
  if (error) return { ok: false, error: mapGuardianLinkError(error.message) };
  return { ok: true, value: undefined };
}

function firstName(name: string | null | undefined): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}
