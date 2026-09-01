import { beforeEach, describe, expect, it, vi } from "vitest";

const membershipMaybeSingleMock = vi.fn();
const rpcMock = vi.fn();
const supabaseMock = {
  from: vi.fn((table: string) => {
    if (table !== "household_members") throw new Error(`unexpected table ${table}`);
    return {
      select: () => ({
        eq: () => ({
          eq: () => ({ limit: () => ({ maybeSingle: membershipMaybeSingleMock }) }),
        }),
      }),
    };
  }),
  rpc: rpcMock,
};

vi.mock("@/lib/auth", () => ({
  requireUser: vi.fn(async () => ({
    user: { id: "parent1" },
    profile: { role: "parent", name: "김민지" },
    supabase: supabaseMock,
  })),
}));

const sendInviteEmailMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/invite-email", () => ({
  sendInviteEmail: sendInviteEmailMock,
}));

describe("inviteChild", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    membershipMaybeSingleMock.mockResolvedValue({ data: { household_id: "household1" } });
    rpcMock.mockResolvedValue({ data: [{ invite_id: "invite1", raw_token: "tok" }], error: null });
    sendInviteEmailMock.mockResolvedValue(undefined);
  });

  it("호출자 본인의 household_id로만 자녀 초대를 생성한다(클라이언트가 household_id를 지정할 방법이 없음)", async () => {
    const { inviteChild } = await import("./invite-actions");
    const result = await inviteChild({ name: "새자녀", email: "child@example.com", grade: "9학년" });

    expect(result).toEqual({ ok: true, inviteId: "invite1" });
    expect(rpcMock).toHaveBeenCalledWith("create_account_invite", {
      p_email: "child@example.com",
      p_name: "새자녀",
      p_role: "student",
      p_household_id: "household1",
      p_grade: "9학년",
    });
    expect(sendInviteEmailMock).toHaveBeenCalledWith({
      to: "child@example.com",
      name: "새자녀",
      token: "tok",
      role: "student",
    });
  });

  it("소속 household가 없으면 초대를 시도하지 않고 실패를 반환한다", async () => {
    membershipMaybeSingleMock.mockResolvedValue({ data: null });
    const { inviteChild } = await import("./invite-actions");

    const result = await inviteChild({ name: "새자녀", email: "child@example.com" });
    expect(result).toEqual({ ok: false, error: "소속된 household가 없습니다. 관리자에게 문의해주세요." });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("보호자가 아니면 household 조회조차 하지 않고 거부한다", async () => {
    const { requireUser } = await import("@/lib/auth");
    vi.mocked(requireUser).mockResolvedValueOnce({
      user: { id: "student1" },
      profile: { role: "student", name: "학생" },
      supabase: supabaseMock,
    } as never);
    const { inviteChild } = await import("./invite-actions");

    const result = await inviteChild({ name: "새자녀", email: "child@example.com" });
    expect(result).toEqual({ ok: false, error: "보호자만 자녀를 초대할 수 있습니다." });
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it("이미 처리 대기 중인 초대가 있으면 RPC 오류 메시지를 그대로 실패로 반환한다", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "이미 처리 대기 중인 초대가 있습니다. 재발송하거나 철회한 뒤 다시 시도해주세요." },
    });
    const { inviteChild } = await import("./invite-actions");
    const result = await inviteChild({ name: "새자녀", email: "child@example.com" });
    expect(result).toEqual({
      ok: false,
      error: "이미 처리 대기 중인 초대가 있습니다. 재발송하거나 철회한 뒤 다시 시도해주세요.",
    });
    expect(sendInviteEmailMock).not.toHaveBeenCalled();
  });
});
