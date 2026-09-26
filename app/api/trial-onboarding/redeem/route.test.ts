import { beforeEach, describe, expect, it, vi } from "vitest";

// P0(2026-09-10) — 이 라우트는 예전에 "쿠키 문자열에 sb-가 포함되는지"만으로
// 로그인 여부를 판정했는데, Supabase가 로그아웃 후·PKCE 시작 시에도 남기는
// 잔여 sb- 쿠키 때문에 실제로는 로그인하지 않은 사용자(관리자가 같은
// 브라우저로 새 초대 링크를 테스트하는 경우 등)가 requireUser()가 걸린
// /consult/trial-onboarding으로 잘못 보내져 곧바로 /login으로 튕기는 버그가
// 있었다. 이제는 실제 세션(auth.getUser())으로만 판정해야 한다.

const rpcMock = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({
  createAdminClient: () => ({ rpc: rpcMock }),
}));

const getUserMock = vi.fn();
vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: getUserMock } }),
}));

describe("GET /api/trial-onboarding/redeem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpcMock.mockResolvedValue({ data: [{ link_id: "link1" }], error: null });
  });

  it("실제 로그인 세션이 없으면(잔여 쿠키만 있어도) confirm-email 화면으로 보낸다", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    const { GET } = await import("./route");
    const res = await GET(
      new Request("https://app.example.com/api/trial-onboarding/redeem?token=abc", {
        headers: { cookie: "sb-project-auth-token-code-verifier=stale; other=1" },
      })
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://app.example.com/consult/trial-onboarding/confirm-email?token=abc"
    );
  });

  it("실제 로그인 세션이 있으면 기존 보호자 경로 화면으로 보낸다", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: "guardian1" } } });
    const { GET } = await import("./route");
    const res = await GET(new Request("https://app.example.com/api/trial-onboarding/redeem?token=abc"));
    expect(res.headers.get("location")).toBe(
      "https://app.example.com/consult/trial-onboarding?token=abc&existing=1"
    );
  });

  it("토큰이 없으면 오류와 함께 /login으로 보낸다", async () => {
    const { GET } = await import("./route");
    const res = await GET(new Request("https://app.example.com/api/trial-onboarding/redeem"));
    expect(res.headers.get("location")).toContain("/login?error=");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("RPC가 오류를 반환하면 /login으로 매핑된 오류 메시지와 함께 보낸다", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "이미 사용된 링크입니다." } });
    const { GET } = await import("./route");
    const res = await GET(new Request("https://app.example.com/api/trial-onboarding/redeem?token=abc"));
    expect(res.headers.get("location")).toBe(
      "https://app.example.com/login?error=" + encodeURIComponent("이미 사용된 온보딩 링크입니다.")
    );
  });
});
