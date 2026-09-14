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

// M4 UAT #2(2026-09-05): 학생 프로필 완성 게이트. rpc 이름마다 다른 응답이
// 필요해(current_account_status/current_account_access_allowed/
// current_student_profile_completed) 위 fakeSupabase보다 세분화된 헬퍼를 쓴다.
function fakeSupabaseWithRpcMap(opts: {
  getUser?: { id: string } | null;
  profile?: { role?: string; name?: string } | null;
  rpc: Record<string, unknown>;
}) {
  const signOutMock = vi.fn().mockResolvedValue({ error: null });
  const rpcMock = vi.fn((name: string) =>
    Promise.resolve({ data: opts.rpc[name] ?? null, error: null })
  );
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

describe("resolveAccountDestination — 학생 프로필 완성 게이트(M4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("프로필 미완료 학생은 /complete-profile로 보낸다", async () => {
    const { resolveAccountDestination } = await import("./auth");
    const supabase = fakeSupabaseWithRpcMap({
      rpc: {
        current_account_status: "active",
        current_account_access_allowed: true,
        current_student_profile_completed: false,
      },
    });
    const dest = await resolveAccountDestination(supabase as never, "student");
    expect(dest).toBe("/complete-profile");
  });

  it("프로필 완료 학생은 정상 학생 홈으로 보낸다", async () => {
    const { resolveAccountDestination } = await import("./auth");
    const supabase = fakeSupabaseWithRpcMap({
      rpc: {
        current_account_status: "active",
        current_account_access_allowed: true,
        current_student_profile_completed: true,
      },
    });
    const dest = await resolveAccountDestination(supabase as never, "student");
    expect(dest).toBe("/student");
  });

  it("2026-09-10(P0 2차): pending 상태인 신규 학생도 프로필 미완료면 /account-pending보다 /complete-profile을 먼저 보여준다(비밀번호 설정 직후 학생은 항상 pending)", async () => {
    const { resolveAccountDestination } = await import("./auth");
    const supabase = fakeSupabaseWithRpcMap({
      rpc: {
        current_account_status: "pending",
        current_account_access_allowed: true,
        current_student_profile_completed: false,
      },
    });
    const dest = await resolveAccountDestination(supabase as never, "student");
    expect(dest).toBe("/complete-profile");
  });

  it("2026-09-10(P0 2차): pending 상태 학생도 프로필을 완료했으면 /account-pending으로 보낸다", async () => {
    const { resolveAccountDestination } = await import("./auth");
    const supabase = fakeSupabaseWithRpcMap({
      rpc: {
        current_account_status: "pending",
        current_account_access_allowed: true,
        current_student_profile_completed: true,
      },
    });
    const dest = await resolveAccountDestination(supabase as never, "student");
    expect(dest).toBe("/account-pending");
  });

  it("학생이 아닌 role(보호자)은 프로필 완성 게이트를 확인하지 않는다", async () => {
    const { resolveAccountDestination } = await import("./auth");
    const supabase = fakeSupabaseWithRpcMap({
      rpc: {
        current_account_status: "active",
        current_account_access_allowed: true,
      },
    });
    const dest = await resolveAccountDestination(supabase as never, "parent");
    expect(dest).toBe("/parent");
    expect(supabase.__rpcMock).not.toHaveBeenCalledWith(
      "current_student_profile_completed"
    );
  });
});

describe("requireUser — 학생 프로필 완성 게이트(M4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("프로필 미완료 학생은 /complete-profile로 리다이렉트한다", async () => {
    const supabase = fakeSupabaseWithRpcMap({
      getUser: { id: "u1" },
      profile: { role: "student", name: "학생" },
      rpc: {
        current_account_status: "active",
        current_account_access_allowed: true,
        current_student_profile_completed: false,
      },
    });
    vi.doMock("@/utils/supabase/server", () => ({ createClient: async () => supabase }));
    vi.resetModules();
    const { requireUser } = await import("./auth");

    await expect(requireUser()).rejects.toThrow("REDIRECT:/complete-profile");
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
