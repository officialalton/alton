import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn().mockResolvedValue({ data: { user: { id: "admin1" } } });
const profileSingleMock = vi.fn().mockResolvedValue({ data: { role: "admin" } });
const rpcMock = vi.fn();
const inviteFetchSingleMock = vi.fn();
const listSelectMock = vi.fn();
const sendInviteEmailMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/invite-email", () => ({
  sendInviteEmail: sendInviteEmailMock,
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: (table: string) => {
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ single: profileSingleMock }) }) };
      }
      if (table === "account_invites") {
        return {
          select: (cols: string) => {
            if (cols.includes("email_original, invitee_name, role") && !cols.includes("household_id")) {
              return { eq: () => ({ single: inviteFetchSingleMock }) };
            }
            return { order: listSelectMock };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
    rpc: rpcMock,
  }),
}));

describe("resendInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "admin1" } } });
    profileSingleMock.mockResolvedValue({ data: { role: "admin" } });
    inviteFetchSingleMock.mockResolvedValue({
      data: { email_original: "parent@example.com", invitee_name: "김민지", role: "parent" },
      error: null,
    });
    rpcMock.mockResolvedValue({ data: [{ invite_id: "invite2", raw_token: "newtoken" }], error: null });
  });

  it("resend_account_invite RPC를 호출하고 새 토큰으로 메일을 다시 보낸다", async () => {
    const { resendInvite } = await import("./invite-actions");
    await resendInvite("invite1");

    expect(rpcMock).toHaveBeenCalledWith("resend_account_invite", { p_invite_id: "invite1" });
    expect(sendInviteEmailMock).toHaveBeenCalledWith({
      to: "parent@example.com",
      name: "김민지",
      token: "newtoken",
      role: "parent",
    });
  });
});

describe("revokeInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "admin1" } } });
    profileSingleMock.mockResolvedValue({ data: { role: "admin" } });
    rpcMock.mockResolvedValue({ error: null });
  });

  it("revoke_account_invite RPC를 호출한다", async () => {
    const { revokeInvite } = await import("./invite-actions");
    await revokeInvite("invite1");
    expect(rpcMock).toHaveBeenCalledWith("revoke_account_invite", { p_invite_id: "invite1" });
  });
});

describe("resolveManualReviewInvite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "admin1" } } });
    profileSingleMock.mockResolvedValue({ data: { role: "admin" } });
    rpcMock.mockResolvedValue({ error: null });
  });

  it("link 액션은 targetProfileId/authUserId를 그대로 전달한다", async () => {
    const { resolveManualReviewInvite } = await import("./invite-actions");
    await resolveManualReviewInvite({
      inviteId: "invite1",
      action: "link",
      targetProfileId: "profile1",
      authUserId: "auth1",
    });

    expect(rpcMock).toHaveBeenCalledWith("resolve_manual_review_invite", {
      p_invite_id: "invite1",
      p_action: "link",
      p_target_profile_id: "profile1",
      p_auth_user_id: "auth1",
    });
  });

  it("revoke 액션은 targetProfileId/authUserId 없이 null로 전달한다", async () => {
    const { resolveManualReviewInvite } = await import("./invite-actions");
    await resolveManualReviewInvite({ inviteId: "invite1", action: "revoke" });

    expect(rpcMock).toHaveBeenCalledWith("resolve_manual_review_invite", {
      p_invite_id: "invite1",
      p_action: "revoke",
      p_target_profile_id: null,
      p_auth_user_id: null,
    });
  });
});
