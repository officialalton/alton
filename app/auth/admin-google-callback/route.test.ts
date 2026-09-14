import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const exchangeCodeForSessionMock = vi.fn();
const rpcMock = vi.fn();
const signOutMock = vi.fn().mockResolvedValue({ error: null });
const fromMock = vi.fn();
const sessionSupabaseMock = {
  auth: { exchangeCodeForSession: exchangeCodeForSessionMock, signOut: signOutMock },
  rpc: rpcMock,
  from: fromMock,
};

vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => sessionSupabaseMock,
}));

const deleteUserMock = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ auth: { admin: { deleteUser: deleteUserMock } } }),
}));

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost:3010/auth/admin-google-callback");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

function googleUser(overrides: Partial<{ id: string; email: string; sub: string | null }> = {}) {
  const id = overrides.id ?? "auth-user-1";
  const email = overrides.email ?? "admin@alton.education";
  const sub = overrides.sub === undefined ? "google-uid-admin-1" : overrides.sub;
  return {
    id,
    email,
    identities: sub ? [{ provider: "google", identity_data: { sub } }] : [],
  };
}

// profiles select 체이닝(.select().eq().single())을 흉내낸다.
function mockProfileLookup(profile: { role: string } | null) {
  fromMock.mockReturnValue({
    select: () => ({
      eq: () => ({
        single: async () => ({ data: profile, error: profile ? null : { message: "not found" } }),
      }),
    }),
  });
}

describe("GET /auth/admin-google-callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Google 동의 화면 취소/실패(error 파라미터)는 랜딩 페이지가 아니라 로그인 에러로 보낸다", async () => {
    const { GET } = await import("./route");
    const res = await GET(makeRequest({ error: "access_denied", error_description: "user cancelled" }));
    expect(res.headers.get("location")).toContain("/login?error=");
    expect(res.headers.get("location")).not.toBe("http://localhost:3010/");
  });

  it("code가 없으면 로그인 에러로 리다이렉트한다(랜딩 페이지 아님)", async () => {
    const { GET } = await import("./route");
    const res = await GET(makeRequest());
    expect(res.headers.get("location")).toContain("/login?error=");
  });

  it("세션 교환 실패 시 로그인 에러로 리다이렉트한다", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ data: {}, error: { message: "bad code" } });
    const { GET } = await import("./route");
    const res = await GET(makeRequest({ code: "bad-code" }));
    expect(res.headers.get("location")).toContain("/login?error=");
  });

  it("등록되지 않은 Google 계정(=profiles 행 없음)은 거부하고 방금 생성된 auth 사용자를 삭제한다", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ data: { session: {}, user: googleUser() }, error: null });
    mockProfileLookup(null);

    const { GET } = await import("./route");
    const res = await GET(makeRequest({ code: "code1" }));

    expect(deleteUserMock).toHaveBeenCalledWith("auth-user-1");
    expect(res.headers.get("location")).toContain("/login?error=");
    expect(res.headers.get("location")).not.toContain("/admin");
  });

  it("관리자가 아닌 역할(예: 선생님)이면 거부한다 — 본인 계정이므로 삭제하지 않고 로그아웃만 한다", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ data: { session: {}, user: googleUser() }, error: null });
    mockProfileLookup({ role: "teacher" });

    const { GET } = await import("./route");
    const res = await GET(makeRequest({ code: "code1" }));

    expect(deleteUserMock).not.toHaveBeenCalled();
    expect(signOutMock).toHaveBeenCalled();
    expect(res.headers.get("location")).toContain("/login?error=");
  });

  it("관리자 계정이지만 Google 신원이 아직 연결되지 않았으면 거부한다", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ data: { session: {}, user: googleUser() }, error: null });
    mockProfileLookup({ role: "admin" });
    rpcMock.mockResolvedValue({ data: false, error: null });

    const { GET } = await import("./route");
    const res = await GET(makeRequest({ code: "code1" }));

    expect(rpcMock).toHaveBeenCalledWith("current_user_admin_google_identity_linked", {
      p_google_user_id: "google-uid-admin-1",
    });
    expect(signOutMock).toHaveBeenCalled();
    expect(res.headers.get("location")).toContain("/login?error=");
  });

  it("연결된 관리자 Google 로그인 성공 시 /admin으로 보낸다", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ data: { session: {}, user: googleUser() }, error: null });
    mockProfileLookup({ role: "admin" });
    rpcMock.mockResolvedValue({ data: true, error: null });

    const { GET } = await import("./route");
    const res = await GET(makeRequest({ code: "code1" }));

    expect(res.headers.get("location")).toBe("http://localhost:3010/admin");
  });

  it("이 콜백은 어떤 실패 경로에서도 랜딩 페이지('/')로 리다이렉트하지 않는다", async () => {
    const cases: { setup: () => void; params: Record<string, string> }[] = [
      { setup: () => {}, params: { error: "access_denied" } },
      { setup: () => {}, params: {} },
      {
        setup: () => {
          exchangeCodeForSessionMock.mockResolvedValue({ data: {}, error: { message: "bad" } });
        },
        params: { code: "x" },
      },
      {
        setup: () => {
          exchangeCodeForSessionMock.mockResolvedValue({ data: { session: {}, user: googleUser() }, error: null });
          mockProfileLookup(null);
        },
        params: { code: "x" },
      },
      {
        setup: () => {
          exchangeCodeForSessionMock.mockResolvedValue({ data: { session: {}, user: googleUser() }, error: null });
          mockProfileLookup({ role: "student" });
        },
        params: { code: "x" },
      },
      {
        setup: () => {
          exchangeCodeForSessionMock.mockResolvedValue({ data: { session: {}, user: googleUser() }, error: null });
          mockProfileLookup({ role: "admin" });
          rpcMock.mockResolvedValue({ data: false, error: null });
        },
        params: { code: "x" },
      },
    ];

    const { GET } = await import("./route");
    for (const { setup, params } of cases) {
      vi.clearAllMocks();
      setup();
      const res = await GET(makeRequest(params));
      const location = res.headers.get("location");
      expect(location).not.toBe("http://localhost:3010/");
    }
  });
});
