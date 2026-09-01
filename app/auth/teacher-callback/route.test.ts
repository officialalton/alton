import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const exchangeCodeForSessionMock = vi.fn();
const rpcMock = vi.fn();
const sessionSupabaseMock = {
  auth: { exchangeCodeForSession: exchangeCodeForSessionMock },
  rpc: rpcMock,
};

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => sessionSupabaseMock,
}));

const deleteUserMock = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ auth: { admin: { deleteUser: deleteUserMock } } }),
}));

function makeRequest(code: string | null) {
  const url = new URL("http://localhost:3010/auth/teacher-callback");
  if (code) url.searchParams.set("code", code);
  return new NextRequest(url);
}

function googleUser(overrides: Partial<{ id: string; email: string; sub: string | null }> = {}) {
  const id = overrides.id ?? "auth-user-1";
  const email = overrides.email ?? "newteacher@alton.education";
  const sub = overrides.sub === undefined ? "google-uid-123" : overrides.sub;
  return {
    id,
    email,
    user_metadata: { full_name: "김새로운" },
    identities: sub ? [{ provider: "google", identity_data: { sub } }] : [],
  };
}

describe("GET /auth/teacher-callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("code가 없으면 로그인 에러로 리다이렉트한다", async () => {
    const { GET } = await import("./route");
    const res = await GET(makeRequest(null));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login?error=");
  });

  it("세션 교환 실패 시 로그인 에러로 리다이렉트한다", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ data: {}, error: { message: "bad code" } });
    const { GET } = await import("./route");
    const res = await GET(makeRequest("bad-code"));
    expect(res.headers.get("location")).toContain("/login?error=");
  });

  it("사전 등록된 provisioning 레코드가 없으면 거부하고 방금 생성된 auth 사용자를 삭제한다", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({
      data: { session: {}, user: googleUser() },
      error: null,
    });
    rpcMock.mockImplementation((fn: string) => {
      if (fn === "find_teacher_provisioning_for_identity") return Promise.resolve({ data: [], error: null });
      if (fn === "log_workspace_link_rejected") return Promise.resolve({ error: null });
      throw new Error(`unexpected rpc ${fn}`);
    });

    const { GET } = await import("./route");
    const res = await GET(makeRequest("code1"));

    expect(rpcMock).toHaveBeenCalledWith(
      "log_workspace_link_rejected",
      expect.objectContaining({ p_reason: expect.stringContaining("newteacher@alton.education") })
    );
    expect(deleteUserMock).toHaveBeenCalledWith("auth-user-1");
    expect(res.headers.get("location")).toContain("/login?error=");
    expect(res.headers.get("location")).not.toContain("/teacher");
  });

  it("Google identity에 sub가 없으면(비정상 응답) 거부하고 orphan auth 사용자를 삭제한다", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({
      data: { session: {}, user: googleUser({ sub: null }) },
      error: null,
    });
    rpcMock.mockImplementation((fn: string) => {
      if (fn === "log_workspace_link_rejected") return Promise.resolve({ error: null });
      throw new Error(`unexpected rpc ${fn}`);
    });

    const { GET } = await import("./route");
    await GET(makeRequest("code1"));

    expect(rpcMock).toHaveBeenCalledWith(
      "log_workspace_link_rejected",
      expect.objectContaining({ p_reason: expect.stringContaining("Google identity") })
    );
    expect(deleteUserMock).toHaveBeenCalledWith("auth-user-1");
  });

  it("provisioning 레코드를 찾으면 link_teacher_workspace_identity를 호출하고 /teacher로 보낸다", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({
      data: { session: {}, user: googleUser() },
      error: null,
    });
    rpcMock.mockImplementation((fn: string) => {
      if (fn === "find_teacher_provisioning_for_identity") {
        return Promise.resolve({ data: [{ id: "prov1", status: "first_login_pending" }], error: null });
      }
      if (fn === "link_teacher_workspace_identity") return Promise.resolve({ error: null });
      throw new Error(`unexpected rpc ${fn}`);
    });

    const { GET } = await import("./route");
    const res = await GET(makeRequest("code1"));

    expect(rpcMock).toHaveBeenCalledWith("link_teacher_workspace_identity", {
      p_auth_user_id: "auth-user-1",
      p_provisioning_id: "prov1",
      p_google_user_id: "google-uid-123",
      p_workspace_email: "newteacher@alton.education",
      p_teacher_name: "김새로운",
    });
    expect(deleteUserMock).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toContain("/teacher");
  });

  it("link_teacher_workspace_identity가 실패하면(DB의 최종 검증 실패) 거부하고 orphan 계정을 삭제한다", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({
      data: { session: {}, user: googleUser() },
      error: null,
    });
    rpcMock.mockImplementation((fn: string) => {
      if (fn === "find_teacher_provisioning_for_identity") {
        return Promise.resolve({ data: [{ id: "prov1", status: "first_login_pending" }], error: null });
      }
      if (fn === "link_teacher_workspace_identity") {
        return Promise.resolve({ error: { message: "Google 신원이 프로비저닝 레코드와 일치하지 않습니다." } });
      }
      if (fn === "log_workspace_link_rejected") return Promise.resolve({ error: null });
      throw new Error(`unexpected rpc ${fn}`);
    });

    const { GET } = await import("./route");
    const res = await GET(makeRequest("code1"));

    expect(deleteUserMock).toHaveBeenCalledWith("auth-user-1");
    expect(res.headers.get("location")).toContain("/login?error=");
  });
});
