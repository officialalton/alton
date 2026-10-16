import { describe, expect, it, vi, beforeEach } from "vitest";

const requireAdmin = vi.fn();
vi.mock("@/lib/admin-auth", () => ({ requireAdmin: (...a: unknown[]) => requireAdmin(...a) }));

const getAccessToken = vi.fn();
const isDocusignRealCallsAllowed = vi.fn();
vi.mock("@/lib/docusign", () => ({
  getAccessToken: () => getAccessToken(),
  isDocusignRealCallsAllowed: () => isDocusignRealCallsAllowed(),
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

beforeEach(() => {
  vi.clearAllMocks();
  requireAdmin.mockResolvedValue({ supabase: {}, adminUserId: "admin-1" });
  isDocusignRealCallsAllowed.mockReturnValue(true);
  getAccessToken.mockResolvedValue("tok");
  fetchMock.mockResolvedValue({ ok: true, status: 200 });
  process.env.DOCUSIGN_INTEGRATION_KEY = "k";
  process.env.DOCUSIGN_USER_ID = "u";
  process.env.DOCUSIGN_ACCOUNT_ID = "ACCOUNT-SECRET-9931";
  process.env.DOCUSIGN_PRIVATE_KEY = "PRIVATE-KEY-SECRET-7742";
  process.env.DOCUSIGN_BASE_URI = "https://demo.docusign.net";
  process.env.DOCUSIGN_AUTH_SERVER = "account-d.docusign.com";
});

describe("DocuSign 진단 경로", () => {
  it("관리자가 아니면 403이고 외부 호출을 하지 않는다", async () => {
    requireAdmin.mockRejectedValue(new Error("관리자만"));
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.status).toBe(403);
    expect(getAccessToken).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("아무것도 발송하지 않는다 — 봉투 생성 경로를 부르지 않는다", async () => {
    const src = (await import("node:fs")).readFileSync(
      "app/api/admin/docusign-preflight/route.ts",
      "utf-8"
    );
    expect(src).not.toContain("createEnvelope");
    expect(src).not.toContain("envelopes");
  });

  it("비밀값을 돌려주지 않는다", async () => {
    const { GET } = await import("./route");
    const body = await (await GET()).json();
    const text = JSON.stringify(body);
    // 값이 아니라 존재 여부만 담는다.
    expect(body.env.hasPrivateKey).toBe(true);
    expect(text).not.toContain("PRIVATE-KEY-SECRET-7742");
    expect(text).not.toContain("ACCOUNT-SECRET-9931");
  });

  it("설정이 빠졌으면 무엇이 빠졌는지 말하고 인증을 시도하지 않는다", async () => {
    delete process.env.DOCUSIGN_PRIVATE_KEY;
    const { GET } = await import("./route");
    const body = await (await GET()).json();
    expect(body.steps[0]).toMatchObject({ step: "env", ok: false });
    expect(body.steps[0].detail).toContain("DOCUSIGN_PRIVATE_KEY");
    expect(getAccessToken).not.toHaveBeenCalled();
  });

  it("게이트가 닫혀 있어도 인증은 확인한다 — 남은 문제가 게이트뿐인지 가른다", async () => {
    isDocusignRealCallsAllowed.mockReturnValue(false);
    const { GET } = await import("./route");
    const body = await (await GET()).json();
    const gate = body.steps.find((s: { step: string }) => s.step === "real_calls_gate");
    expect(gate.ok).toBe(false);
    expect(body.steps.find((s: { step: string }) => s.step === "jwt_token").ok).toBe(true);
    expect(body.note).toContain("발송 게이트만 닫혀");
  });

  it("인증이 실패하면 그 단계에서 멈추고 사유는 짧게 남긴다", async () => {
    getAccessToken.mockRejectedValue(new Error("DocuSign 토큰 요청 실패 (status 400): consent_required"));
    const { GET } = await import("./route");
    const body = await (await GET()).json();
    const step = body.steps.find((s: { step: string }) => s.step === "jwt_token");
    expect(step.ok).toBe(false);
    expect(step.detail).toBe("status 400");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sandbox를 가리키는지 확인한다", async () => {
    const { GET } = await import("./route");
    const body = await (await GET()).json();
    expect(body.env.baseUriIsSandbox).toBe(true);
    expect(body.env.authServerIsSandbox).toBe(true);
  });
});
