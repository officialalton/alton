import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const exchangeCodeForSessionMock = vi.fn();
const rpcMock = vi.fn();
const fromMock = vi.fn();
const sessionSupabaseMock = {
  auth: { exchangeCodeForSession: exchangeCodeForSessionMock },
  rpc: rpcMock,
  from: fromMock,
};

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => sessionSupabaseMock,
}));

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost:3010/auth/admin-google-link-callback");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

function googleUser(overrides: Partial<{ id: string; email: string; sub: string | null }> = {}) {
  return {
    id: overrides.id ?? "admin-1",
    email: overrides.email ?? "admin@example.com",
    identities:
      overrides.sub === null
        ? []
        : [{ provider: "google", identity_data: { sub: overrides.sub ?? "google-uid-admin-1" } }],
  };
}

function mockProfileLookup(profile: { role: string } | null) {
  fromMock.mockReturnValue({
    select: () => ({
      eq: () => ({
        single: async () => ({ data: profile, error: profile ? null : { message: "not found" } }),
      }),
    }),
  });
}

describe("GET /auth/admin-google-link-callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("연결 취소/실패는 /admin?googleLinkError=로 보낸다", async () => {
    const { GET } = await import("./route");
    const res = await GET(makeRequest({ error: "access_denied" }));
    expect(res.headers.get("location")).toContain("/admin?googleLinkError=");
  });

  it("세션이 admin 역할이 아니면 거부한다", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ data: { session: {}, user: googleUser() }, error: null });
    mockProfileLookup({ role: "teacher" });

    const { GET } = await import("./route");
    const res = await GET(makeRequest({ code: "c1" }));

    expect(res.headers.get("location")).toContain("/admin?googleLinkError=");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("관리자 세션이면 link_admin_google_identity를 호출하고 성공 시 /admin?googleLinkSuccess=1로 보낸다", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ data: { session: {}, user: googleUser() }, error: null });
    mockProfileLookup({ role: "admin" });
    rpcMock.mockResolvedValue({ error: null });

    const { GET } = await import("./route");
    const res = await GET(makeRequest({ code: "c1" }));

    expect(rpcMock).toHaveBeenCalledWith("link_admin_google_identity", {
      p_google_user_id: "google-uid-admin-1",
      p_google_email: "admin@example.com",
    });
    expect(res.headers.get("location")).toBe("http://localhost:3010/admin?googleLinkSuccess=1");
  });

  it("link_admin_google_identity가 실패(예: 다른 관리자에 이미 연결됨)하면 에러 메시지를 담아 보낸다", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ data: { session: {}, user: googleUser() }, error: null });
    mockProfileLookup({ role: "admin" });
    rpcMock.mockResolvedValue({ error: { message: "이 Google 계정은 이미 다른 관리자 계정에 연결되어 있습니다." } });

    const { GET } = await import("./route");
    const res = await GET(makeRequest({ code: "c1" }));

    expect(res.headers.get("location")).toContain(
      encodeURIComponent("이 Google 계정은 이미 다른 관리자 계정에 연결되어 있습니다.")
    );
  });
});
