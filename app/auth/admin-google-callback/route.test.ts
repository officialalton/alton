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

// profiles select 체이닝(.select().eq().maybeSingle())을 흉내낸다.
function mockProfileLookup(profile: { role: string } | null) {
  fromMock.mockReturnValue({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: profile, error: null }),
      }),
    }),
  });
}

describe("GET /auth/admin-google-callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 2026-09-22(통합 스태프 콜백) — profiles 행이 없을 때 선생님/컨설턴트
    // 프로비저닝을 순서대로 조회한다(find_teacher_provisioning_for_identity/
    // find_consultant_provisioning_for_identity) — 기본값은 "둘 다 매칭 없음".
    rpcMock.mockResolvedValue({ data: [], error: null });
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

  it("스태프가 아닌 역할(예: 학생)이면 거부한다 — 본인 계정이므로 삭제하지 않고 로그아웃만 한다", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ data: { session: {}, user: googleUser() }, error: null });
    mockProfileLookup({ role: "student" });

    const { GET } = await import("./route");
    const res = await GET(makeRequest({ code: "code1" }));

    expect(deleteUserMock).not.toHaveBeenCalled();
    expect(signOutMock).toHaveBeenCalled();
    expect(res.headers.get("location")).toContain("/login?error=");
  });

  // 2026-09-22(통합 스태프 콜백, 사용자 지시) — 선생님/관리자/컨설턴트
  // 로그인 버튼 3개를 하나로 합쳤다. 이미 profiles 행이 있는 재로그인은
  // role로 바로 라우팅한다(선생님·컨설턴트는 신원 재확인 없이, 관리자만
  // 기존처럼 매번 Google 신원 연결 여부를 재확인).
  it("이미 연결된 선생님 계정으로 재로그인하면 /teacher로 보낸다", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ data: { session: {}, user: googleUser() }, error: null });
    mockProfileLookup({ role: "teacher" });

    const { GET } = await import("./route");
    const res = await GET(makeRequest({ code: "code1" }));

    expect(res.headers.get("location")).toBe("http://localhost:3010/teacher");
  });

  it("이미 연결된 컨설턴트 계정으로 재로그인하면 /consultant로 보낸다", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ data: { session: {}, user: googleUser() }, error: null });
    mockProfileLookup({ role: "consultant" });

    const { GET } = await import("./route");
    const res = await GET(makeRequest({ code: "code1" }));

    expect(res.headers.get("location")).toBe("http://localhost:3010/consultant");
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

  // 2026-09-22 — profiles 행이 없는 첫 로그인(콜드 스타트)은 선생님 →
  // 컨설턴트 순서로 사전 등록 여부를 확인해 매칭되면 그 자리에서 연결한다.
  it("첫 로그인이고 선생님 프로비저닝에 매칭되면 연결하고 /teacher로 보낸다", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ data: { session: {}, user: googleUser() }, error: null });
    mockProfileLookup(null);
    rpcMock.mockImplementation(async (name: string) => {
      if (name === "find_teacher_provisioning_for_identity") return { data: [{ id: "prov-1", status: "created" }], error: null };
      if (name === "link_teacher_workspace_identity") return { data: null, error: null };
      return { data: [], error: null };
    });

    const { GET } = await import("./route");
    const res = await GET(makeRequest({ code: "code1" }));

    expect(rpcMock).toHaveBeenCalledWith(
      "link_teacher_workspace_identity",
      expect.objectContaining({ p_provisioning_id: "prov-1" })
    );
    expect(deleteUserMock).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe("http://localhost:3010/teacher");
  });

  it("첫 로그인이고 선생님은 아니지만 컨설턴트 프로비저닝에 매칭되면 연결하고 /consultant로 보낸다", async () => {
    exchangeCodeForSessionMock.mockResolvedValue({ data: { session: {}, user: googleUser() }, error: null });
    mockProfileLookup(null);
    rpcMock.mockImplementation(async (name: string) => {
      if (name === "find_teacher_provisioning_for_identity") return { data: [], error: null };
      if (name === "find_consultant_provisioning_for_identity") return { data: [{ id: "cprov-1", workspace_google_user_id: null }], error: null };
      if (name === "link_consultant_workspace_identity") return { data: null, error: null };
      return { data: [], error: null };
    });

    const { GET } = await import("./route");
    const res = await GET(makeRequest({ code: "code1" }));

    expect(rpcMock).toHaveBeenCalledWith(
      "link_consultant_workspace_identity",
      expect.objectContaining({ p_provisioning_id: "cprov-1" })
    );
    expect(deleteUserMock).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe("http://localhost:3010/consultant");
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
