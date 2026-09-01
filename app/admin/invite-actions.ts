"use server";

import { requireAdminOrCapability } from "@/lib/admin-auth";

const CAPABILITY = "manage_invites";
import { sendInviteEmail } from "@/lib/invite-email";

export type AccountInviteListItem = {
  id: string;
  emailOriginal: string;
  inviteeName: string;
  role: "parent" | "student";
  householdId: string | null;
  status: string;
  expiresAt: string;
  lastSentAt: string;
  invitedBy: string;
};

// 관리자는 전체 초대를 조회한다(§6). 보호자용 조회는 app/parent/invite-actions.ts에
// 별도로 둔다(본인이 보낸 것만 — RLS "관리자/발송자 조회" 정책이 이미 이 구분을
// 강제하므로, 여기서는 그냥 전체를 select하면 관리자 세션 기준으로 전체가 온다).
export async function listInvites(): Promise<AccountInviteListItem[]> {
  const { supabase } = await requireAdminOrCapability(CAPABILITY);
  const { data, error } = await supabase
    .from("account_invites")
    .select(
      "id, email_original, invitee_name, role, household_id, status, expires_at, last_sent_at, invited_by"
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    emailOriginal: row.email_original,
    inviteeName: row.invitee_name,
    role: row.role,
    householdId: row.household_id,
    status: row.status,
    expiresAt: row.expires_at,
    lastSentAt: row.last_sent_at,
    invitedBy: row.invited_by,
  }));
}

export async function resendInvite(inviteId: string): Promise<void> {
  const { supabase } = await requireAdminOrCapability(CAPABILITY);
  const { data: invite, error: fetchError } = await supabase
    .from("account_invites")
    .select("email_original, invitee_name, role")
    .eq("id", inviteId)
    .single();
  if (fetchError) throw new Error(fetchError.message);

  const { data, error } = await supabase.rpc("resend_account_invite", { p_invite_id: inviteId });
  if (error) throw new Error(error.message);

  const row = data![0];
  await sendInviteEmail({
    to: invite.email_original,
    name: invite.invitee_name,
    token: row.raw_token,
    role: invite.role,
  });
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const { supabase } = await requireAdminOrCapability(CAPABILITY);
  const { error } = await supabase.rpc("revoke_account_invite", { p_invite_id: inviteId });
  if (error) throw new Error(error.message);
}

// manual_review 상태에서 관리자가 명시적으로 확인한 기존 계정에만 연결한다 —
// 이메일이 같다는 이유만으로 자동 연결하지 않는다(§2). action="revoke"면
// targetProfileId/authUserId 없이 그냥 철회한다.
export async function resolveManualReviewInvite(params: {
  inviteId: string;
  action: "link" | "revoke";
  targetProfileId?: string;
  authUserId?: string;
}): Promise<void> {
  const { supabase } = await requireAdminOrCapability(CAPABILITY);
  const { error } = await supabase.rpc("resolve_manual_review_invite", {
    p_invite_id: params.inviteId,
    p_action: params.action,
    p_target_profile_id: params.targetProfileId ?? null,
    p_auth_user_id: params.authUserId ?? null,
  });
  if (error) throw new Error(error.message);
}
