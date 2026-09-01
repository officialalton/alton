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

describe("inviteGuardianToHousehold", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "admin1" } } });
    profileSingleMock.mockResolvedValue({ data: { role: "admin" } });
    rpcMock.mockResolvedValue({ data: [{ invite_id: "invite3", raw_token: "tok3" }], error: null });
  });

  it("household_id를 지정해 create_account_invite를 호출하고 안내 메일을 보낸다", async () => {
    const { inviteGuardianToHousehold } = await import("./invite-actions");
    await inviteGuardianToHousehold({
      householdId: "house1",
      name: "공동 보호자",
      email: "coguardian@example.com",
    });

    expect(rpcMock).toHaveBeenCalledWith("create_account_invite", {
      p_email: "coguardian@example.com",
      p_name: "공동 보호자",
      p_role: "parent",
      p_household_id: "house1",
    });
    expect(sendInviteEmailMock).toHaveBeenCalledWith({
      to: "coguardian@example.com",
      name: "공동 보호자",
      token: "tok3",
      role: "parent",
    });
  });

  it("관리자가 아니고 학생관리 capability도 없으면 거부한다", async () => {
    profileSingleMock.mockResolvedValue({ data: { role: "parent" } });
    rpcMock.mockImplementation((fn: string) => {
      if (fn === "current_user_has_capability") return Promise.resolve({ data: false });
      throw new Error(`unexpected rpc ${fn}`);
    });
    const { inviteGuardianToHousehold } = await import("./invite-actions");
    await expect(
      inviteGuardianToHousehold({ householdId: "house1", name: "x", email: "x@example.com" })
    ).rejects.toThrow("이 작업을 수행할 권한이 없습니다.");
    expect(sendInviteEmailMock).not.toHaveBeenCalled();
  });
});

describe("setPrimaryGuardian", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({ data: { user: { id: "admin1" } } });
    profileSingleMock.mockResolvedValue({ data: { role: "admin" } });
    rpcMock.mockResolvedValue({ error: null });
  });

  it("set_primary_guardian RPC를 household_id/profile_id로 호출한다", async () => {
    const { setPrimaryGuardian } = await import("./invite-actions");
    await setPrimaryGuardian("house1", "profile1");
    expect(rpcMock).toHaveBeenCalledWith("set_primary_guardian", {
      p_household_id: "house1",
      p_profile_id: "profile1",
    });
  });
});
