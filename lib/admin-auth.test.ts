import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn();
const profileSingleMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: getUserMock },
    from: (table: string) => {
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ single: profileSingleMock }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
    rpc: rpcMock,
  }),
}));

describe("requireAdminOrCapability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("로그인하지 않았으면 거부한다", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { requireAdminOrCapability } = await import("./admin-auth");
    await expect(requireAdminOrCapability("manage_invites")).rejects.toThrow("로그인이 필요합니다.");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("role='admin'이면 capability를 확인하지 않고 통과한다", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "admin1" } } });
    profileSingleMock.mockResolvedValue({ data: { role: "admin" } });
    const { requireAdminOrCapability } = await import("./admin-auth");
    const result = await requireAdminOrCapability("manage_invites");
    expect(result.actorUserId).toBe("admin1");
    expect(rpcMock).not.toHaveBeenCalledWith("current_user_has_capability", expect.anything());
  });

  it("admin이 아니어도 지정된 capability가 있으면 통과한다", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "operator1" } } });
    profileSingleMock.mockResolvedValue({ data: { role: "teacher" } });
    rpcMock.mockResolvedValue({ data: true });
    const { requireAdminOrCapability } = await import("./admin-auth");
    const result = await requireAdminOrCapability("manage_invites");
    expect(result.actorUserId).toBe("operator1");
    expect(rpcMock).toHaveBeenCalledWith("current_user_has_capability", {
      p_capability: "manage_invites",
    });
  });

  it("admin도 아니고 capability도 없으면 거부한다", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user1" } } });
    profileSingleMock.mockResolvedValue({ data: { role: "parent" } });
    rpcMock.mockResolvedValue({ data: false });
    const { requireAdminOrCapability } = await import("./admin-auth");
    await expect(requireAdminOrCapability("manage_invites")).rejects.toThrow(
      "이 작업을 수행할 권한이 없습니다."
    );
  });

  it("capability 이름이 다르면(예: manage_account_merges 보유자가 manage_invites 요구) 거부한다", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "user1" } } });
    profileSingleMock.mockResolvedValue({ data: { role: "parent" } });
    rpcMock.mockImplementation((_fn: string, args: { p_capability: string }) =>
      Promise.resolve({ data: args.p_capability === "manage_account_merges" })
    );
    const { requireAdminOrCapability } = await import("./admin-auth");
    await expect(requireAdminOrCapability("manage_invites")).rejects.toThrow(
      "이 작업을 수행할 권한이 없습니다."
    );
    const passing = await requireAdminOrCapability("manage_account_merges");
    expect(passing.actorUserId).toBe("user1");
  });
});
