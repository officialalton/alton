import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

function fakeSupabase(opts: {
  status?: string;
  getUser?: { id: string } | null;
  profile?: { role?: string; name?: string } | null;
}) {
  const signOutMock = vi.fn().mockResolvedValue({ error: null });
  const rpcMock = vi.fn().mockResolvedValue({ data: opts.status ?? "active", error: null });
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: opts.getUser ?? null } }),
      signOut: signOutMock,
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: vi.fn().mockResolvedValue({ data: opts.profile ?? null }),
        }),
      }),
    }),
    rpc: rpcMock,
    __signOutMock: signOutMock,
    __rpcMock: rpcMock,
  };
}

describe("resolveAccountDestination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("active 계정은 role 홈으로 보낸다", async () => {
    const { resolveAccountDestination } = await import("./auth");
    const supabase = fakeSupabase({ status: "active" });
    const dest = await resolveAccountDestination(supabase as never, "student");
    expect(dest).toBe("/student");
    expect(supabase.__signOutMock).not.toHaveBeenCalled();
    expect(supabase.__rpcMock).toHaveBeenCalledWith("current_account_status");
  });

  it("pending 계정은 /account-pending으로 보낸다(정상 포털 진입 차단)", async () => {
    const { resolveAccountDestination } = await import("./auth");
    const supabase = fakeSupabase({ status: "pending" });
    const dest = await resolveAccountDestination(supabase as never, "teacher");
    expect(dest).toBe("/account-pending");
    expect(supabase.__signOutMock).not.toHaveBeenCalled();
  });

  it("suspended 계정은 /account-suspended로 보내고 로그아웃하지 않는다", async () => {
    const { resolveAccountDestination } = await import("./auth");
    const supabase = fakeSupabase({ status: "suspended" });
    const dest = await resolveAccountDestination(supabase as never, "teacher");
    expect(dest).toBe("/account-suspended");
    expect(supabase.__signOutMock).not.toHaveBeenCalled();
  });

  it("closure_pending 계정은 로그아웃하고 /login으로 보낸다", async () => {
    const { resolveAccountDestination } = await import("./auth");
    const supabase = fakeSupabase({ status: "closure_pending" });
    const dest = await resolveAccountDestination(supabase as never, "parent");
    expect(dest).toContain("/login");
    expect(supabase.__signOutMock).toHaveBeenCalledOnce();
  });

  it("closed 계정은 로그아웃하고 /login으로 보낸다", async () => {
    const { resolveAccountDestination } = await import("./auth");
    const supabase = fakeSupabase({ status: "closed" });
    const dest = await resolveAccountDestination(supabase as never, "student");
    expect(dest).toContain("/login");
    expect(supabase.__signOutMock).toHaveBeenCalledOnce();
  });

  it("unknown(불완전한 계정, fail-closed)은 로그아웃하고 /login으로 보낸다", async () => {
    const { resolveAccountDestination } = await import("./auth");
    const supabase = fakeSupabase({ status: "unknown" });
    const dest = await resolveAccountDestination(supabase as never, "student");
    expect(dest).toContain("/login");
    expect(supabase.__signOutMock).toHaveBeenCalledOnce();
  });
});

describe("requireUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("세션이 없으면 /login으로 리다이렉트한다", async () => {
    const supabase = fakeSupabase({ getUser: null });
    vi.doMock("@/utils/supabase/server", () => ({ createClient: async () => supabase }));
    vi.resetModules();
    const { requireUser } = await import("./auth");

    await expect(requireUser()).rejects.toThrow("REDIRECT:/login");
  });

  it("suspended 계정은 포털 대신 /account-suspended로 리다이렉트한다", async () => {
    const supabase = fakeSupabase({
      getUser: { id: "u1" },
      profile: { role: "student", name: "학생" },
      status: "suspended",
    });
    vi.doMock("@/utils/supabase/server", () => ({ createClient: async () => supabase }));
    vi.resetModules();
    const { requireUser } = await import("./auth");

    await expect(requireUser()).rejects.toThrow("REDIRECT:/account-suspended");
  });

  it("pending 계정은 포털 대신 /account-pending으로 리다이렉트한다", async () => {
    const supabase = fakeSupabase({
      getUser: { id: "u1" },
      profile: { role: "teacher", name: "선생님" },
      status: "pending",
    });
    vi.doMock("@/utils/supabase/server", () => ({ createClient: async () => supabase }));
    vi.resetModules();
    const { requireUser } = await import("./auth");

    await expect(requireUser()).rejects.toThrow("REDIRECT:/account-pending");
  });

  it("active 계정은 리다이렉트 없이 user/profile을 반환한다", async () => {
    const supabase = fakeSupabase({
      getUser: { id: "u1" },
      profile: { role: "student", name: "학생" },
      status: "active",
    });
    vi.doMock("@/utils/supabase/server", () => ({ createClient: async () => supabase }));
    vi.resetModules();
    const { requireUser } = await import("./auth");

    const result = await requireUser();
    expect(result.user).toEqual({ id: "u1" });
    expect(result.profile).toEqual({ role: "student", name: "학생" });
  });
});
